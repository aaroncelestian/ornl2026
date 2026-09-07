#!/usr/bin/env node
/**
 * Parse LiMn2O4.cif → MnO₆ polyhedra + Li (8a) sites + interstitial void mesh
 * for the LMO spinel motif (Celestian et al., J. Raman Spectrosc. 2026).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const cifPath = join(root, 'docs', 'data-assets', 'LMO', 'LiMn2O4.cif')
const outPath = join(root, 'src', 'data', 'lmoSpinel.json')

const MN_O_MAX = 2.25
/**
 * CrystalMaker-style pore space of the Mn–O framework (Li removed).
 *
 * Atoms are van der Waals spheres (Bondi / CrystalMaker defaults).
 * Empty space is the complement: sdf = dist_to_nucleus − r_vdw.
 * Iso at the probe radius traces accessible empty space (8a → 16c → 8a).
 * Polyhedra are display-only — they are not subtracted from the field.
 */
const GRID = 120
/** Clearance outside the VdW spheres — the wall must never enter an atom. */
const PROBE = 0.18
const MIN_VOID_VOXELS = 40
const SMOOTH_ITERS = 18
/** Extra Taubin after the last iso snap — rounds patches without re-faceting. */
const RELAX_ITERS = 22
const BOUNDARY_SMOOTH = 16
const RADII = { Mn: 2.0, O: 1.52 }
/** Keep only channel mouths (Å from loop centroid). */
const CAP_MIN_R = 0.32
const CAP_MAX_R = 3.8
const VOID_SUPERCELL = 2
/** Spherical cluster, CrystalMaker range-style. Just inside the 2×2×2 box. */
const CLIP_RADIUS = 7.7

function parseNum(value) {
  return Number(String(value).replace(/\([^)]*\)/g, ''))
}

function parseLoop(text, requiredTag) {
  const chunks = text.split(/\bloop_/)
  for (const chunk of chunks) {
    const lines = chunk.split('\n')
    const tags = []
    let i = 0
    while (i < lines.length) {
      const t = lines[i].trim()
      if (t.startsWith('_')) {
        tags.push(t.split(/\s+/)[0])
        i++
        continue
      }
      if (t === '' || t.startsWith('#')) {
        i++
        continue
      }
      break
    }
    if (!tags.includes(requiredTag)) continue
    const rows = []
    for (; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith('#') || line.startsWith('loop_')) break
      if (line.startsWith('_')) break
      const fields = []
      const re = /'([^']*)'|"([^"]*)"|(\S+)/g
      let m
      while ((m = re.exec(line))) fields.push(m[1] ?? m[2] ?? m[3])
      if (fields.length) rows.push(fields)
    }
    return { tags, rows }
  }
  throw new Error(`No CIF loop containing ${requiredTag}`)
}

function parseOps(text) {
  const tag = text.includes('_symmetry_equiv_pos_as_xyz')
    ? '_symmetry_equiv_pos_as_xyz'
    : '_space_group_symop_operation_xyz'
  const { tags, rows } = parseLoop(text, tag)
  const idx = tags.indexOf(tag)
  return rows.map((row) => row[idx].replace(/\s+/g, ''))
}

function parseAtoms(text) {
  const { tags, rows } = parseLoop(text, '_atom_site_label')
  const iLabel = tags.indexOf('_atom_site_label')
  const iX = tags.indexOf('_atom_site_fract_x')
  const iY = tags.indexOf('_atom_site_fract_y')
  const iZ = tags.indexOf('_atom_site_fract_z')
  const iType = tags.indexOf('_atom_site_type_symbol')
  return rows.map((row) => ({
    element: iType >= 0 ? row[iType] : row[iLabel].replace(/\d+/g, ''),
    x: parseNum(row[iX]),
    y: parseNum(row[iY]),
    z: parseNum(row[iZ]),
  }))
}

function evalCoord(expr, x, y, z) {
  const e = expr
    .toLowerCase()
    .replace(/(\d)\/(\d)/g, '($1/$2)')
    .replace(/x/g, `(${x})`)
    .replace(/y/g, `(${y})`)
    .replace(/z/g, `(${z})`)
  return Function(`"use strict"; return (${e});`)()
}

function wrap01(v) {
  let r = v % 1
  if (r < 0) r += 1
  if (r > 0.9999) r = 0
  return r
}

function minImage(d, cell) {
  const half = cell * 0.5
  if (d > half) return d - cell
  if (d < -half) return d + cell
  return d
}

function r3(v) {
  return Math.round(v * 1000) / 1000
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s]
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function len(a) {
  return Math.hypot(a[0], a[1], a[2])
}

function hullFaces(points) {
  const n = points.length
  const faces = []
  const centroid = scale(
    points.reduce((acc, p) => add(acc, p), [0, 0, 0]),
    1 / n,
  )
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = points[i]
        const b = points[j]
        const c = points[k]
        const nrm = cross(sub(b, a), sub(c, a))
        const nLen = len(nrm)
        if (nLen < 1e-8) continue
        const nn = scale(nrm, 1 / nLen)
        const d0 = dot(nn, a)
        let pos = 0
        let neg = 0
        for (let t = 0; t < n; t++) {
          if (t === i || t === j || t === k) continue
          const s = dot(nn, points[t]) - d0
          if (s > 1e-5) pos++
          else if (s < -1e-5) neg++
        }
        if (pos > 0 && neg > 0) continue
        if (dot(nn, sub(a, centroid)) < 0) faces.push([i, k, j])
        else faces.push([i, j, k])
      }
    }
  }
  return faces
}

const cif = readFileSync(cifPath, 'utf8')
const a = parseNum(cif.match(/_cell_length_a\s+(\S+)/)?.[1] ?? '8.422474')
const ops = parseOps(cif)
const unit = new Map()

for (const atom of parseAtoms(cif)) {
  for (const op of ops) {
    const parts = op.split(',')
    const w = {
      element: atom.element,
      x: wrap01(evalCoord(parts[0], atom.x, atom.y, atom.z)),
      y: wrap01(evalCoord(parts[1], atom.x, atom.y, atom.z)),
      z: wrap01(evalCoord(parts[2], atom.x, atom.y, atom.z)),
    }
    unit.set(`${w.element}:${w.x.toFixed(4)},${w.y.toFixed(4)},${w.z.toFixed(4)}`, w)
  }
}

const atoms = [...unit.values()].map((atom) => ({
  element: atom.element,
  x: atom.x * a - a * 0.5,
  y: atom.y * a - a * 0.5,
  z: atom.z * a - a * 0.5,
}))

const counts = {}
for (const p of atoms) counts[p.element] = (counts[p.element] ?? 0) + 1
console.log(`Unit cell: ${atoms.length} atoms ${JSON.stringify(counts)} · a=${a.toFixed(4)} Å`)

const mns = atoms.filter((p) => p.element === 'Mn')
const oxys = atoms.filter((p) => p.element === 'O')
const lis = atoms.filter((p) => p.element === 'Li')

const polyhedra = []
const mnOLengths = []
for (const mn of mns) {
  const neighbors = []
  for (const ox of oxys) {
    const dx = minImage(ox.x - mn.x, a)
    const dy = minImage(ox.y - mn.y, a)
    const dz = minImage(ox.z - mn.z, a)
    const d = Math.hypot(dx, dy, dz)
    if (d > 1.4 && d < MN_O_MAX) {
      neighbors.push({ x: mn.x + dx, y: mn.y + dy, z: mn.z + dz, d })
      mnOLengths.push(d)
    }
  }
  neighbors.sort((p, q) => p.d - q.d)
  const verts = neighbors.slice(0, 6).map((p) => [p.x, p.y, p.z])
  if (verts.length < 6) {
    console.warn(`Mn (${mn.x.toFixed(2)}) cn=${verts.length} — skip`)
    continue
  }
  polyhedra.push({
    center: [r3(mn.x), r3(mn.y), r3(mn.z)],
    vertices: verts.map((v) => v.map(r3)),
    faces: hullFaces(verts),
  })
}

const lithium = lis.map((li) => ({ x: r3(li.x), y: r3(li.y), z: r3(li.z) }))
const oxygen = oxys.map((ox) => ({ x: r3(ox.x), y: r3(ox.y), z: r3(ox.z) }))
const manganese = mns.map((mn) => ({ x: r3(mn.x), y: r3(mn.y), z: r3(mn.z) }))

function oxNear(mn, maxD = MN_O_MAX) {
  const neighbors = []
  for (const ox of oxys) {
    const dx = minImage(ox.x - mn.x, a)
    const dy = minImage(ox.y - mn.y, a)
    const dz = minImage(ox.z - mn.z, a)
    const d = Math.hypot(dx, dy, dz)
    if (d > 1.4 && d < maxD) {
      neighbors.push({ x: mn.x + dx, y: mn.y + dy, z: mn.z + dz, d })
    }
  }
  neighbors.sort((p, q) => p.d - q.d)
  return neighbors
}

// Cubane = face-shared Mn₄ tetrahedron + interlocking O₄ (Mn₄O₄) + terminal O of each MnO₆
const cubanes = []
for (let i = 0; i < mns.length; i++) {
  for (let j = i + 1; j < mns.length; j++) {
    for (let k = j + 1; k < mns.length; k++) {
      for (let l = k + 1; l < mns.length; l++) {
        const group = [mns[i], mns[j], mns[k], mns[l]]
        const cx = (group[0].x + group[1].x + group[2].x + group[3].x) / 4
        const cy = (group[0].y + group[1].y + group[2].y + group[3].y) / 4
        const cz = (group[0].z + group[1].z + group[2].z + group[3].z) / 4
        const dists = group.map((m) => Math.hypot(m.x - cx, m.y - cy, m.z - cz))
        const maxD = Math.max(...dists)
        const minD = Math.min(...dists)
        // Face-sharing Mn₄ cubane: Mn–center ~1.7–2.2 Å, nearly equal
        if (maxD > 2.35 || minD < 1.45 || maxD - minD > 0.35) continue

        // Collect unique O around the four Mn
        const oMap = new Map()
        for (const mn of group) {
          for (const ox of oxNear(mn)) {
            const key = `${ox.x.toFixed(3)},${ox.y.toFixed(3)},${ox.z.toFixed(3)}`
            const hit = oMap.get(key) ?? { x: ox.x, y: ox.y, z: ox.z, mnHits: 0 }
            hit.mnHits++
            oMap.set(key, hit)
          }
        }
        const allO = [...oMap.values()]
        // Core cubane O: bridge ≥3 of the 4 Mn (interlocking O₄ tetrahedron)
        let coreO = allO.filter((o) => o.mnHits >= 3)
        if (coreO.length < 4) {
          // Fallback: 4 O nearest the cubane center among bridging (≥2)
          coreO = allO
            .filter((o) => o.mnHits >= 2)
            .sort(
              (p, q) =>
                Math.hypot(p.x - cx, p.y - cy, p.z - cz) - Math.hypot(q.x - cx, q.y - cy, q.z - cz),
            )
            .slice(0, 4)
        } else {
          coreO = coreO
            .sort(
              (p, q) =>
                Math.hypot(p.x - cx, p.y - cy, p.z - cz) - Math.hypot(q.x - cx, q.y - cy, q.z - cz),
            )
            .slice(0, 4)
        }
        const coreKeys = new Set(coreO.map((o) => `${o.x.toFixed(3)},${o.y.toFixed(3)},${o.z.toFixed(3)}`))
        // Terminal O: complete each MnO₆ outside the cubane core
        const terminalO = allO.filter((o) => !coreKeys.has(`${o.x.toFixed(3)},${o.y.toFixed(3)},${o.z.toFixed(3)}`))

        const bondKeys = new Set()
        const cleanBonds = []
        for (let mi = 0; mi < group.length; mi++) {
          const mn = group[mi]
          for (const ox of [...coreO, ...terminalO]) {
            const d = Math.hypot(ox.x - mn.x, ox.y - mn.y, ox.z - mn.z)
            if (d >= MN_O_MAX + 0.05) continue
            const ok = `${ox.x.toFixed(3)},${ox.y.toFixed(3)},${ox.z.toFixed(3)}`
            const key = `${mi}|${ok}`
            if (bondKeys.has(key)) continue
            bondKeys.add(key)
            cleanBonds.push({
              mn: mi,
              o: [r3(ox.x), r3(ox.y), r3(ox.z)],
              core: coreKeys.has(ok),
            })
          }
        }

        cubanes.push({
          center: [r3(cx), r3(cy), r3(cz)],
          mn: group.map((m) => [r3(m.x), r3(m.y), r3(m.z)]),
          coreO: coreO.map((o) => [r3(o.x), r3(o.y), r3(o.z)]),
          terminalO: terminalO.map((o) => [r3(o.x), r3(o.y), r3(o.z)]),
          bonds: cleanBonds,
        })
      }
    }
  }
}
// Deduplicate cubane centers
const cubaneUnique = []
for (const c of cubanes) {
  if (
    cubaneUnique.some(
      (u) =>
        Math.hypot(u.center[0] - c.center[0], u.center[1] - c.center[1], u.center[2] - c.center[2]) < 0.4,
    )
  ) {
    continue
  }
  cubaneUnique.push(c)
}
console.log(
  `Cubanes: ${cubaneUnique.length} · coreO=${cubaneUnique[0]?.coreO.length} · termO=${cubaneUnique[0]?.terminalO.length} · bonds=${cubaneUnique[0]?.bonds.length}`,
)

// ── Void mesh on a 2×2×2 supercell (Li removed → continuous 8a→16c tubing) ──
const sc = VOID_SUPERCELL
const A = a * sc
/** Display frame is cell-centered, same as Mn/O/Li. The 2×2×2 grid spans ±A/2. */
const MESH_ORIGIN = a * 0.5
const unitFw = atoms
  .filter((p) => p.element === 'Mn' || p.element === 'O')
  .map((p) => ({
    element: p.element,
    x: p.x + a * 0.5,
    y: p.y + a * 0.5,
    z: p.z + a * 0.5,
    r: RADII[p.element],
  }))
const framework = []
for (let ix = 0; ix < sc; ix++) {
  for (let iy = 0; iy < sc; iy++) {
    for (let iz = 0; iz < sc; iz++) {
      for (const p of unitFw) {
        framework.push({
          element: p.element,
          x: p.x + ix * a,
          y: p.y + iy * a,
          z: p.z + iz * a,
          r: p.r,
        })
      }
    }
  }
}
console.log(`Void supercell ${sc}×${sc}×${sc} · box ${A.toFixed(2)} Å · ${framework.length} Mn/O images`)

const n = GRID
const field = new Float64Array((n + 1) ** 3)
function fIndex(i, j, k) {
  return (i * (n + 1) + j) * (n + 1) + k
}
function hardAtomSdf(x, y, z) {
  let best = Infinity
  for (const atom of unitFw) {
    const dx = minImage(x - atom.x, a)
    const dy = minImage(y - atom.y, a)
    const dz = minImage(z - atom.z, a)
    const d = Math.hypot(dx, dy, dz) - atom.r
    if (d < best) best = d
  }
  return best
}
function sdfAt(x, y, z) {
  return hardAtomSdf(x, y, z)
}

const iso = PROBE

for (let i = 0; i <= n; i++) {
  const x = (i / n) * A - A * 0.5
  for (let j = 0; j <= n; j++) {
    const y = (j / n) * A - A * 0.5
    for (let k = 0; k <= n; k++) {
      const z = (k / n) * A - A * 0.5
      field[fIndex(i, j, k)] = hardAtomSdf(x + MESH_ORIGIN, y + MESH_ORIGIN, z + MESH_ORIGIN)
    }
  }
}

const totalSamples = (n + 1) ** 3
const label = new Int32Array(totalSamples).fill(-1)
let voidCount = 0
for (let i = 0; i < totalSamples; i++) {
  if (field[i] > iso) {
    label[i] = 0
    voidCount++
  }
}

function decode(idx) {
  const s = n + 1
  const k = idx % s
  const j = Math.floor(idx / s) % s
  const i = Math.floor(idx / (s * s))
  return [i, j, k]
}
function wrapI(v) {
  if (v < 0) return v + n + 1
  if (v > n) return v - (n + 1)
  return v
}

const sizes = []
let next = 1
for (let start = 0; start < totalSamples; start++) {
  if (label[start] !== 0) continue
  const stack = [start]
  label[start] = next
  let size = 0
  while (stack.length) {
    const idx = stack.pop()
    size++
    const [i, j, k] = decode(idx)
    for (const [ni, nj, nk] of [
      [i + 1, j, k],
      [i - 1, j, k],
      [i, j + 1, k],
      [i, j - 1, k],
      [i, j, k + 1],
      [i, j, k - 1],
    ]) {
      const nidx = fIndex(wrapI(ni), wrapI(nj), wrapI(nk))
      if (label[nidx] === 0) {
        label[nidx] = next
        stack.push(nidx)
      }
    }
  }
  sizes.push({ id: next, size })
  next++
}
sizes.sort((p, q) => q.size - p.size)
const keep = new Set(sizes.filter((c) => c.size >= MIN_VOID_VOXELS).map((c) => c.id))
for (let i = 0; i < totalSamples; i++) {
  if (label[i] > 0 && !keep.has(label[i])) field[i] = iso - 1
}

const CORNER = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
]
const EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

function sample(i, j, k) {
  return field[fIndex(i, j, k)] - iso
}

function cubeVertex(i, j, k) {
  const crossings = []
  for (const [ia, ib] of EDGES) {
    const [ax, ay, az] = CORNER[ia]
    const [bx, by, bz] = CORNER[ib]
    const va = sample(i + ax, j + ay, k + az)
    const vb = sample(i + bx, j + by, k + bz)
    if (va === 0 && vb === 0) continue
    if (va * vb > 0) continue
    const t = va === vb ? 0.5 : va / (va - vb)
    crossings.push([
      ((i + ax + t * (bx - ax)) / n) * A - A * 0.5,
      ((j + ay + t * (by - ay)) / n) * A - A * 0.5,
      ((k + az + t * (bz - az)) / n) * A - A * 0.5,
    ])
  }
  if (!crossings.length) return null
  const v = [0, 0, 0]
  for (const c of crossings) {
    v[0] += c[0]
    v[1] += c[1]
    v[2] += c[2]
  }
  const inv = 1 / crossings.length
  return [v[0] * inv, v[1] * inv, v[2] * inv]
}

function cubeKey(i, j, k) {
  return (i * n + j) * n + k
}

const cubeVerts = new Array(n * n * n)
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      cubeVerts[cubeKey(i, j, k)] = cubeVertex(i, j, k)
    }
  }
}

const positions = []
const index = []
const vertId = new Int32Array(n * n * n).fill(-1)

for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      const v = cubeVerts[cubeKey(i, j, k)]
      if (!v) continue
      vertId[cubeKey(i, j, k)] = positions.length / 3
      positions.push(r3(v[0]), r3(v[1]), r3(v[2]))
    }
  }
}

function vid(i, j, k) {
  const ii = ((i % n) + n) % n
  const jj = ((j % n) + n) % n
  const kk = ((k % n) + n) % n
  return vertId[cubeKey(ii, jj, kk)]
}

function quad(i0, j0, k0, i1, j1, k1, i2, j2, k2, i3, j3, k3, flip) {
  const a0 = vid(i0, j0, k0)
  const b0 = vid(i1, j1, k1)
  const c0 = vid(i2, j2, k2)
  const d0 = vid(i3, j3, k3)
  if (a0 < 0 || b0 < 0 || c0 < 0 || d0 < 0) return
  if (flip) index.push(a0, c0, b0, a0, d0, c0)
  else index.push(a0, b0, c0, a0, c0, d0)
}

for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      const s = sample(i, j, k)
      if (s * sample(i + 1, j, k) < 0) quad(i, j, k, i, j - 1, k, i, j - 1, k - 1, i, j, k - 1, s > 0)
      if (s * sample(i, j + 1, k) < 0) quad(i, j, k, i, j, k - 1, i - 1, j, k - 1, i - 1, j, k, s > 0)
      if (s * sample(i, j, k + 1) < 0) quad(i, j, k, i - 1, j, k, i - 1, j - 1, k, i, j - 1, k, s > 0)
    }
  }
}

function taubinSmooth(pos, faces, iterations, lambda = 0.5, mu = -0.53) {
  const nV = pos.length / 3
  const nbrs = Array.from({ length: nV }, () => new Set())
  for (let t = 0; t < faces.length; t += 3) {
    const a0 = faces[t]
    const a1 = faces[t + 1]
    const a2 = faces[t + 2]
    nbrs[a0].add(a1)
    nbrs[a0].add(a2)
    nbrs[a1].add(a0)
    nbrs[a1].add(a2)
    nbrs[a2].add(a0)
    nbrs[a2].add(a1)
  }
  const adj = nbrs.map((set) => [...set])

  const pass = (factor) => {
    const next = pos.slice()
    for (let i = 0; i < nV; i++) {
      const list = adj[i]
      if (!list.length) continue
      let ax = 0
      let ay = 0
      let az = 0
      for (const j of list) {
        ax += pos[j * 3]
        ay += pos[j * 3 + 1]
        az += pos[j * 3 + 2]
      }
      const inv = 1 / list.length
      next[i * 3] = pos[i * 3] + factor * (ax * inv - pos[i * 3])
      next[i * 3 + 1] = pos[i * 3 + 1] + factor * (ay * inv - pos[i * 3 + 1])
      next[i * 3 + 2] = pos[i * 3 + 2] + factor * (az * inv - pos[i * 3 + 2])
    }
    for (let i = 0; i < pos.length; i++) pos[i] = next[i]
  }

  for (let k = 0; k < iterations; k++) {
    pass(lambda)
    pass(mu)
  }
}

/** Laplacian that refuses any step into a VdW sphere — rounds patches, keeps atoms hollow. */
function constrainedSmooth(pos, faces, iterations, lambda = 0.38, skip = null) {
  const nV = pos.length / 3
  const nbrs = Array.from({ length: nV }, () => new Set())
  for (let t = 0; t < faces.length; t += 3) {
    const a0 = faces[t]
    const a1 = faces[t + 1]
    const a2 = faces[t + 2]
    nbrs[a0].add(a1)
    nbrs[a0].add(a2)
    nbrs[a1].add(a0)
    nbrs[a1].add(a2)
    nbrs[a2].add(a0)
    nbrs[a2].add(a1)
  }
  const adj = nbrs.map((set) => [...set])
  for (let k = 0; k < iterations; k++) {
    const next = pos.slice()
    for (let i = 0; i < nV; i++) {
      if (skip?.has(i)) continue
      const list = adj[i]
      if (!list.length) continue
      let ax = 0
      let ay = 0
      let az = 0
      for (const j of list) {
        ax += pos[j * 3]
        ay += pos[j * 3 + 1]
        az += pos[j * 3 + 2]
      }
      const inv = 1 / list.length
      const nx = pos[i * 3] + lambda * (ax * inv - pos[i * 3])
      const ny = pos[i * 3 + 1] + lambda * (ay * inv - pos[i * 3 + 1])
      const nz = pos[i * 3 + 2] + lambda * (az * inv - pos[i * 3 + 2])
      if (hardAtomSdf(nx + MESH_ORIGIN, ny + MESH_ORIGIN, nz + MESH_ORIGIN) < iso) continue
      next[i * 3] = nx
      next[i * 3 + 1] = ny
      next[i * 3 + 2] = nz
    }
    for (let i = 0; i < pos.length; i++) pos[i] = next[i]
  }
}

function projectToIso(pos, iters = 8, skip = null) {
  const step = A / n
  for (let k = 0; k < iters; k++) {
    for (let i = 0; i < pos.length; i += 3) {
      if (skip?.has(i / 3)) continue
      const x = pos[i] + MESH_ORIGIN
      const y = pos[i + 1] + MESH_ORIGIN
      const z = pos[i + 2] + MESH_ORIGIN
      const s = sdfAt(x, y, z) - iso
      const gx = sdfAt(x + step, y, z) - sdfAt(x - step, y, z)
      const gy = sdfAt(x, y + step, z) - sdfAt(x, y - step, z)
      const gz = sdfAt(x, y, z + step) - sdfAt(x, y, z - step)
      const len = Math.hypot(gx, gy, gz) || 1
      pos[i] -= (s * gx) / len
      pos[i + 1] -= (s * gy) / len
      pos[i + 2] -= (s * gz) / len
    }
  }
}

/** Newton-push any leftover verts out of the atom spheres onto the hard VdW iso. */
function enforceOutsideAtoms(pos, skip = null) {
  const step = A / n
  for (let i = 0; i < pos.length; i += 3) {
    if (skip?.has(i / 3)) continue
    for (let k = 0; k < 16; k++) {
      const x = pos[i] + MESH_ORIGIN
      const y = pos[i + 1] + MESH_ORIGIN
      const z = pos[i + 2] + MESH_ORIGIN
      const s = hardAtomSdf(x, y, z) - iso
      if (s >= -1e-4) break
      const gx = hardAtomSdf(x + step, y, z) - hardAtomSdf(x - step, y, z)
      const gy = hardAtomSdf(x, y + step, z) - hardAtomSdf(x, y - step, z)
      const gz = hardAtomSdf(x, y, z + step) - hardAtomSdf(x, y, z - step)
      const glen = Math.hypot(gx, gy, gz) || 1
      pos[i] -= (s * gx) / glen
      pos[i + 1] -= (s * gy) / glen
      pos[i + 2] -= (s * gz) / glen
    }
  }
}

function sphereIntersect(a, b, radius) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const aq = dx * dx + dy * dy + dz * dz
  const snap = (p) => {
    const r = Math.hypot(p[0], p[1], p[2]) || 1
    const s = radius / r
    return [p[0] * s, p[1] * s, p[2] * s]
  }
  if (aq < 1e-16) return snap(a)
  const bq = 2 * (a[0] * dx + a[1] * dy + a[2] * dz)
  const cq = a[0] * a[0] + a[1] * a[1] + a[2] * a[2] - radius * radius
  const disc = bq * bq - 4 * aq * cq
  if (disc < 0) return snap([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])
  const root = Math.sqrt(disc)
  const t0 = (-bq - root) / (2 * aq)
  const t1 = (-bq + root) / (2 * aq)
  const ok = []
  if (t0 >= -1e-4 && t0 <= 1 + 1e-4) ok.push(t0)
  if (t1 >= -1e-4 && t1 <= 1 + 1e-4) ok.push(t1)
  let t = 0.5
  if (ok.length) t = ok.reduce((best, u) => (Math.abs(u - 0.5) < Math.abs(best - 0.5) ? u : best))
  t = Math.min(1, Math.max(0, t))
  return snap([a[0] + t * dx, a[1] + t * dy, a[2] + t * dz])
}

function planeIntersect(a, b, nx, ny, nz, d) {
  const da = nx * a[0] + ny * a[1] + nz * a[2]
  const db = nx * b[0] + ny * b[1] + nz * b[2]
  const t = (d - da) / (db - da || 1e-16)
  const u = Math.min(1, Math.max(0, t))
  return [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), a[2] + u * (b[2] - a[2])]
}

function snapToBoxFace(x, y, z, h) {
  x = Math.min(h, Math.max(-h, x))
  y = Math.min(h, Math.max(-h, y))
  z = Math.min(h, Math.max(-h, z))
  const dx = h - Math.abs(x)
  const dy = h - Math.abs(y)
  const dz = h - Math.abs(z)
  if (dx <= dy && dx <= dz) x = (x >= 0 ? 1 : -1) * h
  else if (dy <= dz) y = (y >= 0 ? 1 : -1) * h
  else z = (z >= 0 ? 1 : -1) * h
  return [x, y, z]
}

function faceNormal(x, y, z) {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  if (ax >= ay && ax >= az) return [x >= 0 ? 1 : -1, 0, 0]
  if (ay >= az) return [0, y >= 0 ? 1 : -1, 0]
  return [0, 0, z >= 0 ? 1 : -1]
}

function onBoxFace(x, y, z, h, tol = 0.14) {
  return (
    Math.abs(Math.abs(x) - h) <= tol ||
    Math.abs(Math.abs(y) - h) <= tol ||
    Math.abs(Math.abs(z) - h) <= tol
  )
}

function compactMesh(pos, faces) {
  const used = new Uint8Array(pos.length / 3)
  for (const i of faces) used[i] = 1
  const remap = new Int32Array(pos.length / 3).fill(-1)
  const newPos = []
  for (let i = 0; i < used.length; i++) {
    if (!used[i]) continue
    remap[i] = newPos.length / 3
    newPos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
  }
  const newFaces = []
  for (let t = 0; t < faces.length; t += 3) {
    const a0 = remap[faces[t]]
    const a1 = remap[faces[t + 1]]
    const a2 = remap[faces[t + 2]]
    if (a0 < 0 || a1 < 0 || a2 < 0) continue
    newFaces.push(a0, a1, a2)
  }
  return { pos: newPos, faces: newFaces }
}

/** Clip the mesh to a half-space n·x <= d by splitting straddling triangles. */
function clipMeshToPlane(pos, faces, nx, ny, nz, d) {
  const nV = pos.length / 3
  const inside = new Uint8Array(nV)
  for (let i = 0; i < nV; i++) {
    inside[i] =
      nx * pos[i * 3] + ny * pos[i * 3 + 1] + nz * pos[i * 3 + 2] <= d + 1e-7 ? 1 : 0
  }
  const get = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
  const edgeHit = new Map()
  const newPos = pos.slice()
  const hit = (ia, ib) => {
    const key = ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`
    if (edgeHit.has(key)) return edgeHit.get(key)
    const p = planeIntersect(get(ia), get(ib), nx, ny, nz, d)
    const id = newPos.length / 3
    newPos.push(p[0], p[1], p[2])
    edgeHit.set(key, id)
    return id
  }
  const newFaces = []
  for (let t = 0; t < faces.length; t += 3) {
    const i0 = faces[t]
    const i1 = faces[t + 1]
    const i2 = faces[t + 2]
    const c = inside[i0] + inside[i1] + inside[i2]
    if (c === 3) {
      newFaces.push(i0, i1, i2)
      continue
    }
    if (c === 0) continue
    if (c === 1) {
      let a0
      let a1
      let a2
      if (inside[i0]) {
        a0 = i0
        a1 = i1
        a2 = i2
      } else if (inside[i1]) {
        a0 = i1
        a1 = i2
        a2 = i0
      } else {
        a0 = i2
        a1 = i0
        a2 = i1
      }
      newFaces.push(a0, hit(a0, a1), hit(a0, a2))
    } else {
      let a0
      let a1
      let a2
      if (!inside[i2]) {
        a0 = i0
        a1 = i1
        a2 = i2
      } else if (!inside[i0]) {
        a0 = i1
        a1 = i2
        a2 = i0
      } else {
        a0 = i2
        a1 = i0
        a2 = i1
      }
      const p = hit(a0, a2)
      const q = hit(a1, a2)
      newFaces.push(a0, a1, q, a0, q, p)
    }
  }
  return compactMesh(newPos, newFaces)
}

/** Clip the mesh to a sphere by splitting straddling triangles on the surface. */
function clipMeshToSphere(pos, faces, radius) {
  const nV = pos.length / 3
  const r2 = radius * radius
  const inside = new Uint8Array(nV)
  for (let i = 0; i < nV; i++) {
    const x = pos[i * 3]
    const y = pos[i * 3 + 1]
    const z = pos[i * 3 + 2]
    inside[i] = x * x + y * y + z * z <= r2 ? 1 : 0
  }
  const get = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
  const edgeHit = new Map()
  const newPos = pos.slice()
  const hit = (ia, ib) => {
    const key = ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`
    if (edgeHit.has(key)) return edgeHit.get(key)
    const p = sphereIntersect(get(ia), get(ib), radius)
    const id = newPos.length / 3
    newPos.push(p[0], p[1], p[2])
    edgeHit.set(key, id)
    return id
  }
  const newFaces = []
  for (let t = 0; t < faces.length; t += 3) {
    const i0 = faces[t]
    const i1 = faces[t + 1]
    const i2 = faces[t + 2]
    const c = inside[i0] + inside[i1] + inside[i2]
    if (c === 3) {
      newFaces.push(i0, i1, i2)
      continue
    }
    if (c === 0) continue
    if (c === 1) {
      let a0
      let a1
      let a2
      if (inside[i0]) {
        a0 = i0
        a1 = i1
        a2 = i2
      } else if (inside[i1]) {
        a0 = i1
        a1 = i2
        a2 = i0
      } else {
        a0 = i2
        a1 = i0
        a2 = i1
      }
      newFaces.push(a0, hit(a0, a1), hit(a0, a2))
    } else {
      let a0
      let a1
      let a2
      if (!inside[i2]) {
        a0 = i0
        a1 = i1
        a2 = i2
      } else if (!inside[i0]) {
        a0 = i1
        a1 = i2
        a2 = i0
      } else {
        a0 = i2
        a1 = i0
        a2 = i1
      }
      const p = hit(a0, a2)
      const q = hit(a1, a2)
      newFaces.push(a0, a1, q, a0, q, p)
    }
  }
  return compactMesh(newPos, newFaces)
}

function clipMeshToBox(pos, faces, h) {
  const planes = [
    [1, 0, 0, h],
    [-1, 0, 0, h],
    [0, 1, 0, h],
    [0, -1, 0, h],
    [0, 0, 1, h],
    [0, 0, -1, h],
  ]
  let p = pos
  let f = faces
  for (const [nx, ny, nz, d] of planes) {
    const r = clipMeshToPlane(p, f, nx, ny, nz, d)
    p = r.pos
    f = r.faces
  }
  return { pos: p, faces: f }
}

function boundaryLoops(faces) {
  const keyOf = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  const count = new Map()
  const directed = []
  for (let t = 0; t < faces.length; t += 3) {
    const ring = [
      [faces[t], faces[t + 1]],
      [faces[t + 1], faces[t + 2]],
      [faces[t + 2], faces[t]],
    ]
    for (const [a, b] of ring) {
      directed.push([a, b])
      const k = keyOf(a, b)
      count.set(k, (count.get(k) ?? 0) + 1)
    }
  }
  const nexts = new Map()
  for (const [a, b] of directed) {
    if (count.get(keyOf(a, b)) !== 1) continue
    const list = nexts.get(a)
    if (list) list.push(b)
    else nexts.set(a, [b])
  }
  const used = new Set()
  const loops = []
  for (const [start, outs] of nexts) {
    for (const first of outs) {
      const mark0 = `${start}>${first}`
      if (used.has(mark0)) continue
      const loop = [start]
      let prev = start
      let cur = first
      used.add(mark0)
      let guard = 0
      while (cur !== start && guard++ < 20000) {
        loop.push(cur)
        const cands = nexts.get(cur) || []
        let nxt = cands.find((cand) => cand !== prev && !used.has(`${cur}>${cand}`))
        if (nxt == null) nxt = cands.find((cand) => !used.has(`${cur}>${cand}`))
        if (nxt == null) break
        used.add(`${cur}>${nxt}`)
        prev = cur
        cur = nxt
      }
      if (cur === start && loop.length >= 6) loops.push(loop)
    }
  }
  return loops
}

function loopCentroid(pos, loop) {
  let cx = 0
  let cy = 0
  let cz = 0
  for (const i of loop) {
    cx += pos[i * 3]
    cy += pos[i * 3 + 1]
    cz += pos[i * 3 + 2]
  }
  const inv = 1 / loop.length
  return [cx * inv, cy * inv, cz * inv]
}

function loopRadius(pos, loop, c) {
  let r = 0
  for (const i of loop) {
    r += Math.hypot(pos[i * 3] - c[0], pos[i * 3 + 1] - c[1], pos[i * 3 + 2] - c[2])
  }
  return r / loop.length
}

function loopSpread(pos, loop, c, meanR) {
  let acc = 0
  for (const i of loop) {
    const r = Math.hypot(pos[i * 3] - c[0], pos[i * 3 + 1] - c[1], pos[i * 3 + 2] - c[2])
    acc += (r - meanR) ** 2
  }
  return Math.sqrt(acc / loop.length) / Math.max(meanR, 1e-6)
}

function faceBasis(n) {
  let ax = 0
  let ay = 1
  let az = 0
  if (Math.abs(n[1]) > 0.9) {
    ax = 1
    ay = 0
  }
  let ux = n[1] * az - n[2] * ay
  let uy = n[2] * ax - n[0] * az
  let uz = n[0] * ay - n[1] * ax
  const ul = Math.hypot(ux, uy, uz) || 1
  ux /= ul
  uy /= ul
  uz /= ul
  return {
    u: [ux, uy, uz],
    v: [n[1] * uz - n[2] * uy, n[2] * ux - n[0] * uz, n[0] * uy - n[1] * ux],
  }
}

/** Pull each mouth toward a circle on the clip sphere so caps read as clean discs. */
function circularizeLoopsOnSphere(pos, loops, radius, mix = 0.78) {
  let n = 0
  for (const loop of loops) {
    const c = loopCentroid(pos, loop)
    const meanR = loopRadius(pos, loop, c)
    if (meanR < CAP_MIN_R || meanR > CAP_MAX_R) continue
    if (loopSpread(pos, loop, c, meanR) > 0.32) continue
    const nlen = Math.hypot(c[0], c[1], c[2]) || 1
    const nx = c[0] / nlen
    const ny = c[1] / nlen
    const nz = c[2] / nlen
    const { u, v } = faceBasis([nx, ny, nz])
    for (const i of loop) {
      const dx = pos[i * 3] - c[0]
      const dy = pos[i * 3 + 1] - c[1]
      const dz = pos[i * 3 + 2] - c[2]
      const x = dx * u[0] + dy * u[1] + dz * u[2]
      const y = dx * v[0] + dy * v[1] + dz * v[2]
      const ang = Math.atan2(y, x)
      const tx = c[0] + (u[0] * Math.cos(ang) + v[0] * Math.sin(ang)) * meanR
      const ty = c[1] + (u[1] * Math.cos(ang) + v[1] * Math.sin(ang)) * meanR
      const tz = c[2] + (u[2] * Math.cos(ang) + v[2] * Math.sin(ang)) * meanR
      const px = pos[i * 3] * (1 - mix) + tx * mix
      const py = pos[i * 3 + 1] * (1 - mix) + ty * mix
      const pz = pos[i * 3 + 2] * (1 - mix) + tz * mix
      const r = Math.hypot(px, py, pz) || 1
      const s = radius / r
      pos[i * 3] = px * s
      pos[i * 3 + 1] = py * s
      pos[i * 3 + 2] = pz * s
    }
    n++
  }
  return n
}

/** Planar discs that seal each spherical cut — CrystalMaker-style channel mouths. */
function capSphereLoops(pos, loops) {
  const capPos = []
  const capNorm = []
  const capIndex = []
  let count = 0
  for (const loop of loops) {
    const c = loopCentroid(pos, loop)
    const meanR = loopRadius(pos, loop, c)
    if (meanR < CAP_MIN_R || meanR > CAP_MAX_R) continue
    if (loopSpread(pos, loop, c, meanR) > 0.32) continue
    const cr = Math.hypot(c[0], c[1], c[2]) || 1
    if (Math.abs(cr - CLIP_RADIUS) > 0.55) continue
    const out = [c[0] / cr, c[1] / cr, c[2] / cr]
    const lift = 0.02
    const cx = c[0] + out[0] * lift
    const cy = c[1] + out[1] * lift
    const cz = c[2] + out[2] * lift
    const base = capPos.length / 3
    capPos.push(r3(cx), r3(cy), r3(cz))
    capNorm.push(r3(out[0]), r3(out[1]), r3(out[2]))
    const rim = capPos.length / 3
    for (const i of loop) {
      capPos.push(r3(pos[i * 3]), r3(pos[i * 3 + 1]), r3(pos[i * 3 + 2]))
      capNorm.push(r3(out[0]), r3(out[1]), r3(out[2]))
    }
    for (let k = 0; k < loop.length; k++) {
      const ia = rim + k
      const ib = rim + ((k + 1) % loop.length)
      const v0 = [capPos[ia * 3] - cx, capPos[ia * 3 + 1] - cy, capPos[ia * 3 + 2] - cz]
      const v1 = [capPos[ib * 3] - cx, capPos[ib * 3 + 1] - cy, capPos[ib * 3 + 2] - cz]
      if (dot(cross(v0, v1), out) >= 0) capIndex.push(base, ia, ib)
      else capIndex.push(base, ib, ia)
    }
    count++
  }
  return { positions: capPos, normals: capNorm, index: capIndex, count }
}

/** Pull each mouth toward a circle on its cube face. */
function circularizeLoopsOnBox(pos, loops, h, mix = 0.72) {
  let n = 0
  for (const loop of loops) {
    const c = loopCentroid(pos, loop)
    const meanR = loopRadius(pos, loop, c)
    if (meanR < CAP_MIN_R || meanR > CAP_MAX_R) continue
    if (loopSpread(pos, loop, c, meanR) > 0.32) continue
    if (!onBoxFace(c[0], c[1], c[2], h, 0.55)) continue
    const fn = faceNormal(c[0], c[1], c[2])
    const { u, v } = faceBasis(fn)
    for (const i of loop) {
      const dx = pos[i * 3] - c[0]
      const dy = pos[i * 3 + 1] - c[1]
      const dz = pos[i * 3 + 2] - c[2]
      const x = dx * u[0] + dy * u[1] + dz * u[2]
      const y = dx * v[0] + dy * v[1] + dz * v[2]
      const ang = Math.atan2(y, x)
      const tx = c[0] + (u[0] * Math.cos(ang) + v[0] * Math.sin(ang)) * meanR
      const ty = c[1] + (u[1] * Math.cos(ang) + v[1] * Math.sin(ang)) * meanR
      const tz = c[2] + (u[2] * Math.cos(ang) + v[2] * Math.sin(ang)) * meanR
      const px = pos[i * 3] * (1 - mix) + tx * mix
      const py = pos[i * 3 + 1] * (1 - mix) + ty * mix
      const pz = pos[i * 3 + 2] * (1 - mix) + tz * mix
      const s = snapToBoxFace(px, py, pz, h)
      pos[i * 3] = s[0]
      pos[i * 3 + 1] = s[1]
      pos[i * 3 + 2] = s[2]
    }
    n++
  }
  return n
}

/** Planar discs on cube faces — resampled circles so the lids stay clean. */
function capBoxLoops(pos, loops, h) {
  const SEG = 28
  const capPos = []
  const capNorm = []
  const capIndex = []
  let count = 0
  for (const loop of loops) {
    const c = loopCentroid(pos, loop)
    const meanR = loopRadius(pos, loop, c)
    if (meanR < CAP_MIN_R || meanR > CAP_MAX_R) continue
    if (loopSpread(pos, loop, c, meanR) > 0.32) continue
    if (!onBoxFace(c[0], c[1], c[2], h, 0.55)) continue
    const out = faceNormal(c[0], c[1], c[2])
    const { u, v } = faceBasis(out)
    const lift = 0.05
    const cx = c[0] + out[0] * lift
    const cy = c[1] + out[1] * lift
    const cz = c[2] + out[2] * lift
    const rad = meanR * 1.02
    const base = capPos.length / 3
    capPos.push(r3(cx), r3(cy), r3(cz))
    capNorm.push(out[0], out[1], out[2])
    const rim = capPos.length / 3
    for (let k = 0; k < SEG; k++) {
      const ang = (k / SEG) * Math.PI * 2
      capPos.push(
        r3(cx + (u[0] * Math.cos(ang) + v[0] * Math.sin(ang)) * rad),
        r3(cy + (u[1] * Math.cos(ang) + v[1] * Math.sin(ang)) * rad),
        r3(cz + (u[2] * Math.cos(ang) + v[2] * Math.sin(ang)) * rad),
      )
      capNorm.push(out[0], out[1], out[2])
    }
    for (let k = 0; k < SEG; k++) {
      capIndex.push(base, rim + k, rim + ((k + 1) % SEG))
    }
    count++
  }
  return { positions: capPos, normals: capNorm, index: capIndex, count }
}

function boundaryVerts(faces, nV) {
  const edgeCount = new Map()
  const add = (a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1)
  }
  for (let t = 0; t < faces.length; t += 3) {
    add(faces[t], faces[t + 1])
    add(faces[t + 1], faces[t + 2])
    add(faces[t + 2], faces[t])
  }
  const bound = new Set()
  for (const [key, count] of edgeCount) {
    if (count !== 1) continue
    const dash = key.indexOf('-')
    bound.add(Number(key.slice(0, dash)))
    bound.add(Number(key.slice(dash + 1)))
  }
  return bound
}

function smoothBoundaryOnSphere(pos, faces, bound, radius, iters) {
  const nV = pos.length / 3
  const nbrs = Array.from({ length: nV }, () => [])
  for (let t = 0; t < faces.length; t += 3) {
    const a0 = faces[t]
    const a1 = faces[t + 1]
    const a2 = faces[t + 2]
    const ring = [
      [a0, a1],
      [a1, a2],
      [a2, a0],
    ]
    for (const [u, v] of ring) {
      if (!bound.has(u) || !bound.has(v)) continue
      nbrs[u].push(v)
      nbrs[v].push(u)
    }
  }
  for (let k = 0; k < iters; k++) {
    const next = pos.slice()
    for (const i of bound) {
      const list = nbrs[i]
      if (list.length < 2) continue
      let ax = 0
      let ay = 0
      let az = 0
      for (const j of list) {
        ax += pos[j * 3]
        ay += pos[j * 3 + 1]
        az += pos[j * 3 + 2]
      }
      const inv = 1 / list.length
      next[i * 3] = pos[i * 3] * 0.3 + ax * inv * 0.7
      next[i * 3 + 1] = pos[i * 3 + 1] * 0.3 + ay * inv * 0.7
      next[i * 3 + 2] = pos[i * 3 + 2] * 0.3 + az * inv * 0.7
      const r = Math.hypot(next[i * 3], next[i * 3 + 1], next[i * 3 + 2]) || 1
      const s = radius / r
      next[i * 3] *= s
      next[i * 3 + 1] *= s
      next[i * 3 + 2] *= s
    }
    for (let i = 0; i < pos.length; i++) pos[i] = next[i]
  }
}

function smoothBoundaryOnBox(pos, faces, bound, h, iters) {
  const nV = pos.length / 3
  const nbrs = Array.from({ length: nV }, () => [])
  for (let t = 0; t < faces.length; t += 3) {
    const a0 = faces[t]
    const a1 = faces[t + 1]
    const a2 = faces[t + 2]
    const ring = [
      [a0, a1],
      [a1, a2],
      [a2, a0],
    ]
    for (const [u, v] of ring) {
      if (!bound.has(u) || !bound.has(v)) continue
      nbrs[u].push(v)
      nbrs[v].push(u)
    }
  }
  for (let k = 0; k < iters; k++) {
    const next = pos.slice()
    for (const i of bound) {
      const list = nbrs[i]
      if (list.length < 2) continue
      let ax = 0
      let ay = 0
      let az = 0
      for (const j of list) {
        ax += pos[j * 3]
        ay += pos[j * 3 + 1]
        az += pos[j * 3 + 2]
      }
      const inv = 1 / list.length
      const s = snapToBoxFace(
        pos[i * 3] * 0.3 + ax * inv * 0.7,
        pos[i * 3 + 1] * 0.3 + ay * inv * 0.7,
        pos[i * 3 + 2] * 0.3 + az * inv * 0.7,
        h,
      )
      next[i * 3] = s[0]
      next[i * 3 + 1] = s[1]
      next[i * 3 + 2] = s[2]
    }
    for (let i = 0; i < pos.length; i++) pos[i] = next[i]
  }
}

function sdfStats(pos, label) {
  let inside = 0
  let minS = Infinity
  let maxS = -Infinity
  for (let i = 0; i < pos.length; i += 3) {
    const s = hardAtomSdf(pos[i] + MESH_ORIGIN, pos[i + 1] + MESH_ORIGIN, pos[i + 2] + MESH_ORIGIN)
    if (s < 0) inside++
    if (s < minS) minS = s
    if (s > maxS) maxS = s
  }
  const nV = pos.length / 3
  console.log(
    `  ${label}: ${inside}/${nV} verts inside solid (${((inside / nV) * 100).toFixed(1)}%) · sdf ${minS.toFixed(2)}…${maxS.toFixed(2)}`,
  )
}

console.log(
  `Smoothing LMO void (${SMOOTH_ITERS} Taubin + ${RELAX_ITERS} relax, VdW Mn ${RADII.Mn} / O ${RADII.O} Å, iso ${PROBE} Å)…`,
)
sdfStats(positions, 'before smooth')
taubinSmooth(positions, index, SMOOTH_ITERS)
sdfStats(positions, 'after Taubin')
projectToIso(positions)
sdfStats(positions, 'after project')
constrainedSmooth(positions, index, RELAX_ITERS)
enforceOutsideAtoms(positions)
sdfStats(positions, 'after relax')

// Keep only the dominant connected channel network (drop tiny cavities)
{
  const nV = positions.length / 3
  const nbrs = Array.from({ length: nV }, () => new Set())
  for (let t = 0; t < index.length; t += 3) {
    const a0 = index[t]
    const a1 = index[t + 1]
    const a2 = index[t + 2]
    nbrs[a0].add(a1)
    nbrs[a0].add(a2)
    nbrs[a1].add(a0)
    nbrs[a1].add(a2)
    nbrs[a2].add(a0)
    nbrs[a2].add(a1)
  }
  const labelV = new Int32Array(nV).fill(-1)
  const sizesV = []
  let cid = 0
  for (let s = 0; s < nV; s++) {
    if (labelV[s] >= 0) continue
    const stack = [s]
    labelV[s] = cid
    let size = 0
    while (stack.length) {
      const u = stack.pop()
      size++
      for (const v of nbrs[u]) {
        if (labelV[v] < 0) {
          labelV[v] = cid
          stack.push(v)
        }
      }
    }
    sizesV.push({ id: cid, size })
    cid++
  }
  sizesV.sort((p, q) => q.size - p.size)
  const keepId = sizesV[0]?.id
  const keepFrac = (sizesV[0]?.size ?? 0) / Math.max(1, nV)
  console.log(
    `Mesh components: ${sizesV.length} · keeping #${keepId} (${((keepFrac) * 100).toFixed(1)}% of verts)`,
  )
  if (keepId != null && sizesV.length > 1) {
    const remap = new Int32Array(nV).fill(-1)
    const newPos = []
    for (let i = 0; i < nV; i++) {
      if (labelV[i] !== keepId) continue
      remap[i] = newPos.length / 3
      newPos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    }
    const newIndex = []
    for (let t = 0; t < index.length; t += 3) {
      const a0 = remap[index[t]]
      const a1 = remap[index[t + 1]]
      const a2 = remap[index[t + 2]]
      if (a0 < 0 || a1 < 0 || a2 < 0) continue
      newIndex.push(a0, a1, a2)
    }
    positions.length = 0
    for (let i = 0; i < newPos.length; i++) positions.push(newPos[i])
    index.length = 0
    for (let i = 0; i < newIndex.length; i++) index.push(newIndex[i])
  }
}

constrainedSmooth(positions, index, 10)
enforceOutsideAtoms(positions)
sdfStats(positions, 'after extra relax')

{
  const clipped = clipMeshToSphere(positions, index, CLIP_RADIUS)
  positions.length = 0
  for (let i = 0; i < clipped.pos.length; i++) positions.push(clipped.pos[i])
  index.length = 0
  for (let i = 0; i < clipped.faces.length; i++) index.push(clipped.faces[i])
  const rimTol = 0.12
  const bound = new Set()
  for (let i = 0; i < positions.length / 3; i++) {
    const r = Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    if (Math.abs(r - CLIP_RADIUS) <= rimTol) bound.add(i)
  }
  for (const i of boundaryVerts(index, positions.length / 3)) bound.add(i)
  taubinSmooth(positions, index, 4)
  for (const i of bound) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    const r = Math.hypot(x, y, z) || 1
    const s = CLIP_RADIUS / r
    positions[i * 3] = x * s
    positions[i * 3 + 1] = y * s
    positions[i * 3 + 2] = z * s
  }
  smoothBoundaryOnSphere(positions, index, bound, CLIP_RADIUS, BOUNDARY_SMOOTH)
  constrainedSmooth(positions, index, 8, 0.38, bound)
  enforceOutsideAtoms(positions, bound)
  const mouths = boundaryLoops(index)
  const rounded = circularizeLoopsOnSphere(positions, mouths, CLIP_RADIUS, 0.55)
  smoothBoundaryOnSphere(positions, index, bound, CLIP_RADIUS, 8)
  enforceOutsideAtoms(positions)
  for (const i of bound) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    const r = Math.hypot(x, y, z) || 1
    const s = CLIP_RADIUS / r
    positions[i * 3] = x * s
    positions[i * 3 + 1] = y * s
    positions[i * 3 + 2] = z * s
  }
  console.log(
    `  clipped to ${CLIP_RADIUS} Å sphere · ${bound.size} rim verts · ${mouths.length} loops · ${rounded} circularized`,
  )
}

enforceOutsideAtoms(positions)
sdfStats(positions, 'final')
{
  const drop = new Uint8Array(positions.length / 3)
  let nDrop = 0
  for (let i = 0; i < positions.length; i += 3) {
    if (hardAtomSdf(positions[i] + MESH_ORIGIN, positions[i + 1] + MESH_ORIGIN, positions[i + 2] + MESH_ORIGIN) < 0) {
      drop[i / 3] = 1
      nDrop++
    }
  }
  if (nDrop) {
    const remap = new Int32Array(drop.length).fill(-1)
    const newPos = []
    for (let i = 0; i < drop.length; i++) {
      if (drop[i]) continue
      remap[i] = newPos.length / 3
      newPos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    }
    const newIndex = []
    for (let t = 0; t < index.length; t += 3) {
      const a0 = remap[index[t]]
      const a1 = remap[index[t + 1]]
      const a2 = remap[index[t + 2]]
      if (a0 < 0 || a1 < 0 || a2 < 0) continue
      newIndex.push(a0, a1, a2)
    }
    positions.length = 0
    for (const v of newPos) positions.push(v)
    index.length = 0
    for (const v of newIndex) index.push(v)
    console.log(`  culled ${nDrop} verts still inside a VdW sphere`)
  }
}

/** Drop any triangle that chords through a VdW sphere. Atoms fill those holes. */
{
  const samples = [0.25, 0.5, 0.75]
  const insideSeg = (ia, ib) => {
    for (const t of samples) {
      const x = positions[ia * 3] * (1 - t) + positions[ib * 3] * t
      const y = positions[ia * 3 + 1] * (1 - t) + positions[ib * 3 + 1] * t
      const z = positions[ia * 3 + 2] * (1 - t) + positions[ib * 3 + 2] * t
      if (hardAtomSdf(x + MESH_ORIGIN, y + MESH_ORIGIN, z + MESH_ORIGIN) < 0) return true
    }
    return false
  }
  const kept = []
  let dropped = 0
  for (let t = 0; t < index.length; t += 3) {
    const a0 = index[t]
    const a1 = index[t + 1]
    const a2 = index[t + 2]
    const cx = (positions[a0 * 3] + positions[a1 * 3] + positions[a2 * 3]) / 3
    const cy = (positions[a0 * 3 + 1] + positions[a1 * 3 + 1] + positions[a2 * 3 + 1]) / 3
    const cz = (positions[a0 * 3 + 2] + positions[a1 * 3 + 2] + positions[a2 * 3 + 2]) / 3
    if (
      hardAtomSdf(cx + MESH_ORIGIN, cy + MESH_ORIGIN, cz + MESH_ORIGIN) < 0 ||
      insideSeg(a0, a1) ||
      insideSeg(a1, a2) ||
      insideSeg(a2, a0)
    ) {
      dropped++
      continue
    }
    kept.push(a0, a1, a2)
  }
  const compact = compactMesh(positions, kept)
  positions.length = 0
  for (const v of compact.pos) positions.push(v)
  index.length = 0
  for (const v of compact.faces) index.push(v)
  console.log(`  dropped ${dropped} triangles that cut a VdW sphere`)
  sdfStats(positions, 'after atom-safe drop')
}

const voidAtoms = []
{
  const rKeep = CLIP_RADIUS + 0.35
  const r2 = rKeep * rKeep
  const seen = new Set()
  for (let ix = -1; ix <= 2; ix++) {
    for (let iy = -1; iy <= 2; iy++) {
      for (let iz = -1; iz <= 2; iz++) {
        for (const atom of unitFw) {
          const x = atom.x + ix * a - MESH_ORIGIN
          const y = atom.y + iy * a - MESH_ORIGIN
          const z = atom.z + iz * a - MESH_ORIGIN
          if (x * x + y * y + z * z > r2) continue
          const key = `${atom.element}:${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
          if (seen.has(key)) continue
          seen.add(key)
          voidAtoms.push({ element: atom.element, x: r3(x), y: r3(y), z: r3(z) })
        }
      }
    }
  }
  console.log(`Void cluster atoms: ${voidAtoms.length} within ${rKeep.toFixed(2)} Å`)
}

const normals = new Array(positions.length).fill(0)
const step = A / n
for (let t = 0; t < index.length; t += 3) {
  const i0 = index[t]
  const i1 = index[t + 1]
  const i2 = index[t + 2]
  const ax = positions[i1 * 3] - positions[i0 * 3]
  const ay = positions[i1 * 3 + 1] - positions[i0 * 3 + 1]
  const az = positions[i1 * 3 + 2] - positions[i0 * 3 + 2]
  const bx = positions[i2 * 3] - positions[i0 * 3]
  const by = positions[i2 * 3 + 1] - positions[i0 * 3 + 1]
  const bz = positions[i2 * 3 + 2] - positions[i0 * 3 + 2]
  const nx = ay * bz - az * by
  const ny = az * bx - ax * bz
  const nz = ax * by - ay * bx
  normals[i0 * 3] += nx
  normals[i0 * 3 + 1] += ny
  normals[i0 * 3 + 2] += nz
  normals[i1 * 3] += nx
  normals[i1 * 3 + 1] += ny
  normals[i1 * 3 + 2] += nz
  normals[i2 * 3] += nx
  normals[i2 * 3 + 1] += ny
  normals[i2 * 3 + 2] += nz
}
for (let i = 0; i < positions.length; i += 3) {
  const x = positions[i] + MESH_ORIGIN
  const y = positions[i + 1] + MESH_ORIGIN
  const z = positions[i + 2] + MESH_ORIGIN
  const gx = sdfAt(x + step, y, z) - sdfAt(x - step, y, z)
  const gy = sdfAt(x, y + step, z) - sdfAt(x, y - step, z)
  const gz = sdfAt(x, y, z + step) - sdfAt(x, y, z - step)
  // Point out of the void, toward the framework (same as rowleyite).
  const wantX = -gx
  const wantY = -gy
  const wantZ = -gz
  if (normals[i] * wantX + normals[i + 1] * wantY + normals[i + 2] * wantZ < 0) {
    normals[i] *= -1
    normals[i + 1] *= -1
    normals[i + 2] *= -1
  }
  const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
  normals[i] /= len
  normals[i + 1] /= len
  normals[i + 2] /= len
}
for (let i = 0; i < normals.length; i++) normals[i] = r3(normals[i])
for (let i = 0; i < positions.length; i++) positions[i] = r3(positions[i])

const voidCaps = capSphereLoops(positions, boundaryLoops(index))
console.log(`  capped ${voidCaps.count} channel mouths (${voidCaps.positions.length / 3} cap verts)`)

function mean(xs) {
  return xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length)
}

const payload = {
  mineral: 'Lithium manganese oxide (spinel)',
  source: 'LiMn2O4.cif · Fd-3m · van der Waals empty space (Li removed)',
  paper: 'Celestian et al., J. Raman Spectrosc. 2026, 57:131–139',
  cell: { a },
  polyhedra,
  manganese,
  oxygen,
  lithium,
  cubanes: cubaneUnique.slice(0, 8),
  voidAtoms,
  void: {
    probe: PROBE,
    radii: RADII,
    grid: GRID,
    supercell: sc,
    box: A,
    clipRadius: CLIP_RADIUS,
    clipShape: 'sphere',
    note: `Accessible void outside VdW spheres (Mn ${RADII.Mn} Å, O ${RADII.O} Å) with ${PROBE} Å probe; Taubin-smoothed; Li removed; sphere-clipped`,
    positions,
    normals,
    index,
    caps: {
      positions: voidCaps.positions,
      normals: voidCaps.normals,
      index: voidCaps.index,
    },
  },
  stats: {
    counts,
    mnOMean: r3(mean(mnOLengths)),
    polyCount: polyhedra.length,
    mnCount: manganese.length,
    oCount: oxygen.length,
    liCount: lithium.length,
    cubaneCount: cubaneUnique.length,
    voidVerts: positions.length / 3,
    voidTris: index.length / 3,
    voidCaps: voidCaps.count,
    voidFraction: r3(voidCount / totalSamples),
    voidComponents: sizes.filter((c) => c.size >= MIN_VOID_VOXELS).length,
    voidAtomCount: voidAtoms.length,
  },
}

{
  const minTo = (pts) => {
    let best = Infinity
    for (const p of pts) {
      for (let i = 0; i < positions.length; i += 3) {
        const r = Math.hypot(positions[i] - p.x, positions[i + 1] - p.y, positions[i + 2] - p.z)
        if (r < best) best = r
      }
    }
    return best
  }
  const mnGap = minTo(manganese)
  const liGap = minTo(lithium)
  console.log(
    `Sanity: min Mn–void ${mnGap.toFixed(2)} Å (VdW ${RADII.Mn}) · min Li–void ${liGap.toFixed(2)} Å (should sit in the channel)`,
  )
  if (mnGap < RADII.Mn * 0.7) {
    throw new Error(`Void mesh still intersects Mn (min gap ${mnGap.toFixed(2)} Å)`)
  }
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload))
console.log(
  `LMO: ${polyhedra.length} MnO₆ · ${lithium.length} Li(8a) · ${cubaneUnique.length} cubanes · ` +
    `void ${payload.stats.voidVerts}v/${payload.stats.voidTris}t · ${payload.stats.voidCaps} caps · Mn–O ${payload.stats.mnOMean} Å`,
)
