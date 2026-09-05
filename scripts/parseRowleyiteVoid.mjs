#!/usr/bin/env node
/**
 * Parse rowleyite.cif → void-space mesh for the crystal viewer.
 * Expands Fd-3m, builds a signed-distance field around the framework,
 * keeps the large accessible cavities, and writes a surface-nets mesh.
 * The extra-framework contents are already absent from this CIF, so the
 * holes are the cages / channels.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const cifPath = join(root, 'original_images', 'supporting', 'rowleyite.cif')
const outPath = join(root, 'src', 'data', 'rowleyiteVoid.json')

const GRID = 52
const PROBE = 1.35
const MIN_VOID_VOXELS = 120
const SMOOTH_ITERS = 10
const RADII = { O: 1.32, V: 1.58, P: 1.48, As: 1.52 }

const cif = readFileSync(cifPath, 'utf8')

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
  return rows.map((row) => {
    const label = row[iLabel]
    const type = iType >= 0 ? row[iType] : label.replace(/\d+/g, '')
    return {
      label,
      element: type,
      x: parseNum(row[iX]),
      y: parseNum(row[iY]),
      z: parseNum(row[iZ]),
    }
  })
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

function applyOp(op, atom) {
  const parts = op.split(',')
  return {
    element: atom.element,
    x: evalCoord(parts[0], atom.x, atom.y, atom.z),
    y: evalCoord(parts[1], atom.x, atom.y, atom.z),
    z: evalCoord(parts[2], atom.x, atom.y, atom.z),
  }
}

function wrap(v) {
  let r = v % 1
  if (r < 0) r += 1
  if (r > 0.9999) r = 0
  return r
}

function key(a) {
  return `${a.x.toFixed(4)},${a.y.toFixed(4)},${a.z.toFixed(4)}`
}

function minImage(d, a) {
  const half = a * 0.5
  if (d > half) return d - a
  if (d < -half) return d + a
  return d
}

const a = parseNum(cif.match(/_cell_length_a\s+(\S+)/)?.[1] ?? '31.704')
const ops = parseOps(cif)
const asym = parseAtoms(cif)

const unit = new Map()
for (const atom of asym) {
  if (!(atom.element in RADII)) continue
  for (const op of ops) {
    const p = applyOp(op, atom)
    const w = { element: p.element, x: wrap(p.x), y: wrap(p.y), z: wrap(p.z) }
    unit.set(key(w), w)
  }
}

const atoms = [...unit.values()].map((atom) => ({
  element: atom.element,
  x: atom.x * a,
  y: atom.y * a,
  z: atom.z * a,
  r: RADII[atom.element],
}))

const counts = {}
for (const atom of atoms) counts[atom.element] = (counts[atom.element] ?? 0) + 1
console.log(`Framework: ${atoms.length} atoms ${JSON.stringify(counts)}  cell ${a.toFixed(3)} Å`)

const n = GRID
const field = new Float64Array((n + 1) ** 3)

function fIndex(i, j, k) {
  return (i * (n + 1) + j) * (n + 1) + k
}

function sdfAt(x, y, z) {
  let best = Infinity
  for (const atom of atoms) {
    const dx = minImage(x - atom.x, a)
    const dy = minImage(y - atom.y, a)
    const dz = minImage(z - atom.z, a)
    const d = Math.hypot(dx, dy, dz) - atom.r
    if (d < best) best = d
  }
  return best
}

console.log(`Sampling ${n + 1}³ signed-distance field…`)
for (let i = 0; i <= n; i++) {
  const x = (i / n) * a
  for (let j = 0; j <= n; j++) {
    const y = (j / n) * a
    for (let k = 0; k <= n; k++) {
      const z = (k / n) * a
      field[fIndex(i, j, k)] = sdfAt(x, y, z)
    }
  }
}

const iso = PROBE
const totalSamples = (n + 1) ** 3
let voidCount = 0
const label = new Int32Array(totalSamples).fill(-1)
for (let i = 0; i < totalSamples; i++) {
  if (field[i] > iso) {
    label[i] = 0
    voidCount++
  }
}
console.log(`Raw void fraction ${(voidCount / totalSamples).toFixed(3)}`)

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
    const nbrs = [
      [i + 1, j, k],
      [i - 1, j, k],
      [i, j + 1, k],
      [i, j - 1, k],
      [i, j, k + 1],
      [i, j, k - 1],
    ]
    for (const [ni, nj, nk] of nbrs) {
      const ii = wrapI(ni)
      const jj = wrapI(nj)
      const kk = wrapI(nk)
      const nidx = fIndex(ii, jj, kk)
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
console.log(
  `Void components: ${sizes.length} · kept ${keep.size} · largest ${sizes
    .slice(0, 5)
    .map((c) => c.size)
    .join(', ')}`,
)

let keptVoid = 0
for (let i = 0; i < totalSamples; i++) {
  if (label[i] > 0 && !keep.has(label[i])) field[i] = iso - 1
  if (field[i] > iso) keptVoid++
}
console.log(`Kept void fraction ${(keptVoid / totalSamples).toFixed(3)}`)

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

const cubeVerts = new Array(n * n * n)
function cubeKey(i, j, k) {
  return (i * n + j) * n + k
}

let vertexCount = 0
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      const v = cubeVertex(i, j, k)
      if (v) {
        cubeVerts[cubeKey(i, j, k)] = v
        vertexCount++
      }
    }
  }
}

const positions = []
const index = []
const vertId = new Int32Array(n * n * n).fill(-1)

function ensureVert(i, j, k) {
  const ck = cubeKey(i, j, k)
  if (vertId[ck] >= 0) return vertId[ck]
  const v = cubeVerts[ck]
  if (!v) return -1
  const id = positions.length / 3
  positions.push(v[0] - a * 0.5, v[1] - a * 0.5, v[2] - a * 0.5)
  vertId[ck] = id
  return id
}

function emitQuad(a0, a1, a2, a3, flip) {
  if (a0 < 0 || a1 < 0 || a2 < 0 || a3 < 0) return
  if (flip) {
    index.push(a0, a3, a2, a0, a2, a1)
  } else {
    index.push(a0, a1, a2, a0, a2, a3)
  }
}

for (let i = 0; i < n; i++) {
  for (let j = 1; j < n; j++) {
    for (let k = 1; k < n; k++) {
      const v0 = sample(i, j, k)
      const v1 = sample(i + 1, j, k)
      if (v0 * v1 > 0) continue
      emitQuad(
        ensureVert(i, j - 1, k - 1),
        ensureVert(i, j, k - 1),
        ensureVert(i, j, k),
        ensureVert(i, j - 1, k),
        v0 > 0,
      )
    }
  }
}

for (let i = 1; i < n; i++) {
  for (let j = 0; j < n; j++) {
    for (let k = 1; k < n; k++) {
      const v0 = sample(i, j, k)
      const v1 = sample(i, j + 1, k)
      if (v0 * v1 > 0) continue
      emitQuad(
        ensureVert(i - 1, j, k - 1),
        ensureVert(i - 1, j, k),
        ensureVert(i, j, k),
        ensureVert(i, j, k - 1),
        v0 > 0,
      )
    }
  }
}

for (let i = 1; i < n; i++) {
  for (let j = 1; j < n; j++) {
    for (let k = 0; k < n; k++) {
      const v0 = sample(i, j, k)
      const v1 = sample(i, j, k + 1)
      if (v0 * v1 > 0) continue
      emitQuad(
        ensureVert(i - 1, j - 1, k),
        ensureVert(i, j - 1, k),
        ensureVert(i, j, k),
        ensureVert(i - 1, j, k),
        v0 > 0,
      )
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

console.log(`Smoothing pore surface (${SMOOTH_ITERS} Taubin iterations)…`)
taubinSmooth(positions, index, SMOOTH_ITERS)
projectToIso(positions)

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
  // Point out of the void, toward the framework.
  normals[i] = -gx / len
  normals[i + 1] = -gy / len
  normals[i + 2] = -gz / len
}

function round(v) {
  return Math.round(v * 1000) / 1000
}

const payload = {
  mineral: 'Rowleyite',
  source: 'rowleyite.cif · Fd-3m · Taubin-smoothed void surface',
  cell: { a, b: a, c: a },
  probe: PROBE,
  positions: positions.map(round),
  normals: normals.map(round),
  index,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload))
const kb = Math.round(readFileSync(outPath).byteLength / 1024)
console.log(
  `Wrote ${positions.length / 3} verts, ${index.length / 3} tris (${kb} KB) → ${outPath}`,
)
