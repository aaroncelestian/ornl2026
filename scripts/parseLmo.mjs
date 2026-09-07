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
 * Same void pipeline as rowleyite (SDF → cavities → surface nets → Taubin),
 * but radii/probe tuned so 8a→16c→8a stays ONE connected channel network.
 * (Water probe 1.35 Å leaves almost nothing in spinel.)
 */
const GRID = 56
const PROBE = 0.22
const MIN_VOID_VOXELS = 40
const SMOOTH_ITERS = 10
const RADII = { Mn: 1.18, O: 1.12 }

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

// ── Void mesh: Mn+O framework only (Li removed → 8a interstitial network) ──
const framework = atoms
  .filter((p) => p.element === 'Mn' || p.element === 'O')
  .map((p) => ({
    x: p.x + a * 0.5,
    y: p.y + a * 0.5,
    z: p.z + a * 0.5,
    r: RADII[p.element],
  }))

const n = GRID
const field = new Float64Array((n + 1) ** 3)
function fIndex(i, j, k) {
  return (i * (n + 1) + j) * (n + 1) + k
}
function sdfAt(x, y, z) {
  let best = Infinity
  for (const atom of framework) {
    const dx = minImage(x - atom.x, a)
    const dy = minImage(y - atom.y, a)
    const dz = minImage(z - atom.z, a)
    const d = Math.hypot(dx, dy, dz) - atom.r
    if (d < best) best = d
  }
  return best
}

for (let i = 0; i <= n; i++) {
  const x = (i / n) * a
  for (let j = 0; j <= n; j++) {
    const y = (j / n) * a
    for (let k = 0; k <= n; k++) {
      field[fIndex(i, j, k)] = sdfAt(x, y, (k / n) * a)
    }
  }
}

const iso = PROBE
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
      ((i + ax + t * (bx - ax)) / n) * a,
      ((j + ay + t * (by - ay)) / n) * a,
      ((k + az + t * (bz - az)) / n) * a,
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
      positions.push(r3(v[0] - a * 0.5), r3(v[1] - a * 0.5), r3(v[2] - a * 0.5))
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

function projectToIso(pos) {
  const step = a / n
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] + a * 0.5
    const y = pos[i + 1] + a * 0.5
    const z = pos[i + 2] + a * 0.5
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

console.log(`Smoothing LMO void surface (${SMOOTH_ITERS} Taubin iterations, probe ${PROBE} Å)…`)
taubinSmooth(positions, index, SMOOTH_ITERS)
projectToIso(positions)

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

const normals = new Array(positions.length).fill(0)
const step = a / n
for (let i = 0; i < positions.length; i += 3) {
  const x = positions[i] + a * 0.5
  const y = positions[i + 1] + a * 0.5
  const z = positions[i + 2] + a * 0.5
  const gx = sdfAt(x + step, y, z) - sdfAt(x - step, y, z)
  const gy = sdfAt(x, y + step, z) - sdfAt(x, y - step, z)
  const gz = sdfAt(x, y, z + step) - sdfAt(x, y, z - step)
  const len = Math.hypot(gx, gy, gz) || 1
  // Point out of the void, toward the framework (same as rowleyite).
  normals[i] = -gx / len
  normals[i + 1] = -gy / len
  normals[i + 2] = -gz / len
}
for (let i = 0; i < normals.length; i++) normals[i] = r3(normals[i])
for (let i = 0; i < positions.length; i++) positions[i] = r3(positions[i])

function mean(xs) {
  return xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length)
}

const payload = {
  mineral: 'Lithium manganese oxide (spinel)',
  source: 'LiMn2O4.cif · Fd-3m · Taubin-smoothed probe void (Li removed)',
  paper: 'Celestian et al., J. Raman Spectrosc. 2026, 57:131–139',
  cell: { a },
  polyhedra,
  manganese,
  oxygen,
  lithium,
  cubanes: cubaneUnique.slice(0, 8),
  void: {
    probe: PROBE,
    grid: GRID,
    note: 'Connected 8a→16c→8a pore channels of Mn–O framework (Li removed); Taubin-smoothed',
    positions: [...positions],
    normals: [...normals],
    index,
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
    voidFraction: r3(voidCount / totalSamples),
    voidComponents: sizes.filter((c) => c.size >= MIN_VOID_VOXELS).length,
  },
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload))
console.log(
  `LMO: ${polyhedra.length} MnO₆ · ${lithium.length} Li(8a) · ${cubaneUnique.length} cubanes · ` +
    `void ${payload.stats.voidVerts}v/${payload.stats.voidTris}t · Mn–O ${payload.stats.mnOMean} Å`,
)
