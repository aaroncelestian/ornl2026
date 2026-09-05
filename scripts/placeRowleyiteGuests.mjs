#!/usr/bin/env node
/**
 * Dock doxorubicin / vincristine into rowleyite cages near the +Z cell face
 * so the default camera looks into the opening.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const cifPath = join(root, 'original_images', 'supporting', 'rowleyite.cif')
const outPath = join(root, 'src', 'data', 'rowleyiteGuests.json')

const GRID = 52
const PROBE = 1.35
const RADII = { O: 1.32, V: 1.58, P: 1.48, As: 1.52 }
const GUEST_CLEAR = 0.45
const DISPLAY = {
  C: { color: '#e8d4c0', radius: 0.2 },
  N: { color: '#5b7ec7', radius: 0.19 },
  O: { color: '#e24b4b', radius: 0.18 },
  PT: { color: '#d0d6de', radius: 0.42 },
  CL: { color: '#5aaa5a', radius: 0.28 },
}

const GUESTS = [
  {
    id: 'temozolomide',
    file: 'temozolomide_3D.pdb',
    carbon: '#e8a0c8',
    minClear: -0.25,
    pull: 1.6,
  },
  {
    id: 'cisplatin',
    file: 'cisplatin_3D.pdb',
    carbon: '#d0d6de',
    minClear: -0.2,
    pull: 1.6,
  },
  {
    id: 'doxorubicin',
    file: 'doxorubicin_3D.pdb',
    carbon: '#f0c4a8',
    minClear: 0.12,
    thorough: true,
    pull: 0,
    scale: 0.82,
  },
  {
    id: 'vincristine',
    file: 'vincristine_3D.pdb',
    carbon: '#c5d8e6',
    minClear: 0.12,
    thorough: true,
    pull: 0,
    scale: 0.75,
  },
]

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

function applyOp(op, atom) {
  const parts = op.split(',')
  return {
    element: atom.element,
    x: evalCoord(parts[0], atom.x, atom.y, atom.z),
    y: evalCoord(parts[1], atom.x, atom.y, atom.z),
    z: evalCoord(parts[2], atom.x, atom.y, atom.z),
  }
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

function parsePdb(path) {
  const text = readFileSync(path, 'utf8')
  const raw = []
  const conect = new Map()
  for (const line of text.split('\n')) {
    if (line.startsWith('HETATM') || line.startsWith('ATOM  ')) {
      const serial = Number(line.slice(6, 11))
      const col = line.length >= 78 ? line.slice(76, 78).trim() : ''
      const name = line.slice(12, 16).trim()
      const tail = line.trim().split(/\s+/).pop() ?? ''
      let element = (col || (/^[A-Za-z]{1,2}$/.test(tail) ? tail : '') || name.replace(/[^A-Za-z]/g, '')).toUpperCase()
      if (element === 'T' && /pt/i.test(name + tail)) element = 'PT'
      if (element === 'L' && /cl/i.test(name + tail)) element = 'CL'
      if (element.length > 2) element = element.slice(0, 2)
      raw.push({
        serial,
        element,
        x: Number(line.slice(30, 38)),
        y: Number(line.slice(38, 46)),
        z: Number(line.slice(46, 54)),
      })
    } else if (line.startsWith('CONECT')) {
      const nums = line.slice(6).trim().split(/\s+/).map(Number)
      const from = nums[0]
      conect.set(from, [...(conect.get(from) ?? []), ...nums.slice(1)])
    }
  }
  const heavy = raw.filter((p) => p.element !== 'H')
  const bySerial = new Map(heavy.map((p, i) => [p.serial, i]))
  const bonds = []
  const seen = new Set()
  for (const [from, tos] of conect) {
    const i = bySerial.get(from)
    if (i == null) continue
    for (const to of tos) {
      const j = bySerial.get(to)
      if (j == null || i === j) continue
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (seen.has(key)) continue
      seen.add(key)
      bonds.push([i, j])
    }
  }
  const cx = heavy.reduce((s, p) => s + p.x, 0) / heavy.length
  const cy = heavy.reduce((s, p) => s + p.y, 0) / heavy.length
  const cz = heavy.reduce((s, p) => s + p.z, 0) / heavy.length
  const local = heavy.map((p) => ({
    element: p.element,
    x: p.x - cx,
    y: p.y - cy,
    z: p.z - cz,
  }))
  let maxR = 0
  for (const p of local) maxR = Math.max(maxR, Math.hypot(p.x, p.y, p.z))
  return { atoms: local, bonds, radius: maxR }
}

function scaleMol(mol, scale = 1) {
  if (scale === 1) return mol
  const atoms = mol.atoms.map((p) => ({
    ...p,
    x: p.x * scale,
    y: p.y * scale,
    z: p.z * scale,
  }))
  return { atoms, bonds: mol.bonds, radius: mol.radius * scale }
}

function rotMat(rx, ry, rz) {
  const cx = Math.cos(rx)
  const sx = Math.sin(rx)
  const cy = Math.cos(ry)
  const sy = Math.sin(ry)
  const cz = Math.cos(rz)
  const sz = Math.sin(rz)
  return [
    cy * cz,
    sx * sy * cz - cx * sz,
    cx * sy * cz + sx * sz,
    cy * sz,
    sx * sy * sz + cx * cz,
    cx * sy * sz - sx * cz,
    -sy,
    sx * cy,
    cx * cy,
  ]
}

function applyRot(p, m) {
  return {
    element: p.element,
    x: m[0] * p.x + m[1] * p.y + m[2] * p.z,
    y: m[3] * p.x + m[4] * p.y + m[5] * p.z,
    z: m[6] * p.x + m[7] * p.y + m[8] * p.z,
  }
}

const cif = readFileSync(cifPath, 'utf8')
const a = parseNum(cif.match(/_cell_length_a\s+(\S+)/)?.[1] ?? '31.704')
const ops = parseOps(cif)
const asym = parseAtoms(cif)
const unit = new Map()
for (const atom of asym) {
  if (!(atom.element in RADII)) continue
  for (const op of ops) {
    const p = applyOp(op, atom)
    const w = { element: p.element, x: wrap01(p.x), y: wrap01(p.y), z: wrap01(p.z) }
    unit.set(`${w.x.toFixed(4)},${w.y.toFixed(4)},${w.z.toFixed(4)}`, w)
  }
}
const atoms = [...unit.values()].map((atom) => ({
  element: atom.element,
  x: atom.x * a,
  y: atom.y * a,
  z: atom.z * a,
  r: RADII[atom.element],
}))

const n = GRID
const field = new Float64Array((n + 1) ** 3)
function fIndex(i, j, k) {
  return (i * (n + 1) + j) * (n + 1) + k
}
function sdfExact(x, y, z) {
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

console.log(`Sampling ${n + 1}³ field…`)
for (let i = 0; i <= n; i++) {
  const x = (i / n) * a
  for (let j = 0; j <= n; j++) {
    const y = (j / n) * a
    for (let k = 0; k <= n; k++) {
      const z = (k / n) * a
      field[fIndex(i, j, k)] = sdfExact(x, y, z)
    }
  }
}

function wrapI(v) {
  const s = n + 1
  return ((v % s) + s) % s
}

function sdfInterp(x, y, z) {
  let wx = ((x % a) + a) % a
  let wy = ((y % a) + a) % a
  let wz = ((z % a) + a) % a
  const fx = (wx / a) * n
  const fy = (wy / a) * n
  const fz = (wz / a) * n
  const i0 = Math.floor(fx)
  const j0 = Math.floor(fy)
  const k0 = Math.floor(fz)
  const tx = fx - i0
  const ty = fy - j0
  const tz = fz - k0
  let acc = 0
  for (let di = 0; di < 2; di++) {
    for (let dj = 0; dj < 2; dj++) {
      for (let dk = 0; dk < 2; dk++) {
        const w = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty) * (dk ? tz : 1 - tz)
        acc += w * field[fIndex(wrapI(i0 + di), wrapI(j0 + dj), wrapI(k0 + dk))]
      }
    }
  }
  return acc
}

const sites = []
for (let i = 1; i < n; i++) {
  for (let j = 1; j < n; j++) {
    for (let k = 1; k < n; k++) {
      const v = field[fIndex(i, j, k)]
      if (v <= PROBE + 1.1) continue
      let isMax = true
      for (let di = -1; di <= 1 && isMax; di++) {
        for (let dj = -1; dj <= 1 && isMax; dj++) {
          for (let dk = -1; dk <= 1; dk++) {
            if (di === 0 && dj === 0 && dk === 0) continue
            if (field[fIndex(i + di, j + dj, k + dk)] > v + 1e-6) {
              isMax = false
              break
            }
          }
        }
      }
      if (!isMax) continue
      const x = (i / n) * a
      const y = (j / n) * a
      const z = (k / n) * a
      const zFace = a - z
      const xFace = Math.min(x, a - x)
      const yFace = Math.min(y, a - y)
      sites.push({
        x,
        y,
        z,
        r: v,
        zFace,
        edge: Math.min(xFace, yFace, zFace),
        score: v * (1.15 + 2.4 * Math.max(0, 1 - zFace / 9) * (xFace > 4 && yFace > 4 ? 1 : 0.35)),
      })
    }
  }
}

sites.sort((p, q) => q.score - p.score)

const MIN_CAGE_R = 6.0
const CAGE_SEP = 9
const allLarge = []
for (const site of sites) {
  if (site.r < MIN_CAGE_R) continue
  if (allLarge.some((c) => Math.hypot(site.x - c.x, site.y - c.y, site.z - c.z) < CAGE_SEP)) continue
  allLarge.push(site)
}
allLarge.sort((p, q) => q.z + 0.35 * q.x + 0.2 * q.y - (p.z + 0.35 * p.x + 0.2 * p.y))
const large = allLarge.filter((s) => s.zFace < 16).slice(0, 6)
console.log(
  `Large open cages: ${allLarge.length} total, using ${large.length} toward camera · ` +
    large.map((s) => `r=${s.r.toFixed(2)} zFace=${s.zFace.toFixed(1)} z=${s.z.toFixed(1)}`).join(' · '),
)

function guestClearance(placed) {
  let min = Infinity
  for (const p of placed) {
    const wall = DISPLAY[p.element]?.radius ?? DISPLAY.C.radius
    const d = sdfInterp(p.x, p.y, p.z) - PROBE - wall
    if (d < min) min = d
  }
  return min
}

function principalAxes(pts) {
  const n = pts.length || 1
  let xx = 0
  let yy = 0
  let zz = 0
  let xy = 0
  let xz = 0
  let yz = 0
  for (const p of pts) {
    xx += p.x * p.x
    yy += p.y * p.y
    zz += p.z * p.z
    xy += p.x * p.y
    xz += p.x * p.z
    yz += p.y * p.z
  }
  xx /= n
  yy /= n
  zz /= n
  xy /= n
  xz /= n
  yz /= n
  const mul = (v) => [
    xx * v[0] + xy * v[1] + xz * v[2],
    xy * v[0] + yy * v[1] + yz * v[2],
    xz * v[0] + yz * v[1] + zz * v[2],
  ]
  const power = (exclude) => {
    let v = [0.57, 0.31, 0.76]
    for (let i = 0; i < 48; i++) {
      if (exclude) {
        const d = v[0] * exclude[0] + v[1] * exclude[1] + v[2] * exclude[2]
        v = [v[0] - d * exclude[0], v[1] - d * exclude[1], v[2] - d * exclude[2]]
      }
      v = mul(v)
      const len = Math.hypot(v[0], v[1], v[2]) || 1
      v = [v[0] / len, v[1] / len, v[2] / len]
    }
    return v
  }
  const a0 = power(null)
  const a1 = power(a0)
  const a2 = [
    a0[1] * a1[2] - a0[2] * a1[1],
    a0[2] * a1[0] - a0[0] * a1[2],
    a0[0] * a1[1] - a0[1] * a1[0],
  ]
  return [a0, a1, a2]
}

function mulMat(A, B) {
  return [
    A[0] * B[0] + A[1] * B[3] + A[2] * B[6],
    A[0] * B[1] + A[1] * B[4] + A[2] * B[7],
    A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
    A[3] * B[0] + A[4] * B[3] + A[5] * B[6],
    A[3] * B[1] + A[4] * B[4] + A[5] * B[7],
    A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
    A[6] * B[0] + A[7] * B[3] + A[8] * B[6],
    A[6] * B[1] + A[7] * B[4] + A[8] * B[7],
    A[6] * B[2] + A[7] * B[5] + A[8] * B[8],
  ]
}

function axesToMat(axes) {
  return [
    axes[0][0],
    axes[1][0],
    axes[2][0],
    axes[0][1],
    axes[1][1],
    axes[2][1],
    axes[0][2],
    axes[1][2],
    axes[2][2],
  ]
}

function transpose(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
}

function cageCloud(site, radius = 7, step = 0.75) {
  const pts = []
  for (let x = -radius; x <= radius; x += step) {
    for (let y = -radius; y <= radius; y += step) {
      for (let z = -radius; z <= radius; z += step) {
        if (sdfInterp(site.x + x, site.y + y, site.z + z) > PROBE) {
          pts.push({ x, y, z })
        }
      }
    }
  }
  return pts
}

function placeWith(mol, site, m, t) {
  return mol.atoms.map((p) => {
    const q = applyRot(p, m)
    return {
      element: q.element,
      x: q.x + site.x + t[0],
      y: q.y + site.y + t[1],
      z: q.z + site.z + t[2],
    }
  })
}

function dock(mol, site, occupied, thorough = false) {
  const cloud = thorough ? cageCloud(site, 10.5, 0.7) : cageCloud(site)
  const cageAxes = cloud.length > 12 ? principalAxes(cloud) : [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  const molAxes = principalAxes(mol.atoms)
  const signs = [
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
    [-1, 1, 1],
    [-1, 1, -1],
    [-1, -1, 1],
    [-1, -1, -1],
  ]
  const shifts = thorough ? [-2.4, -1.2, 0, 1.2, 2.4] : [-1.4, 0, 1.4]
  let best = null
  const consider = (m, t) => {
    const placed = placeWith(mol, site, m, t)
    if (
      occupied.some(
        (o) => Math.hypot(site.x + t[0] - o.x, site.y + t[1] - o.y, site.z + t[2] - o.z) < o.span,
      )
    ) {
      return
    }
    const clear = guestClearance(placed)
    const score = clear - 0.06 * Math.hypot(t[0], t[1], t[2])
    if (!best || score > best.score) best = { placed, clear, score, dz: t[2], m, t }
  }

  for (const s of signs) {
    const aligned = [
      [s[0] * cageAxes[0][0], s[0] * cageAxes[0][1], s[0] * cageAxes[0][2]],
      [s[1] * cageAxes[1][0], s[1] * cageAxes[1][1], s[1] * cageAxes[1][2]],
      [s[2] * cageAxes[2][0], s[2] * cageAxes[2][1], s[2] * cageAxes[2][2]],
    ]
    const m = mulMat(axesToMat(aligned), transpose(axesToMat(molAxes)))
    for (const tx of shifts) {
      for (const ty of shifts) {
        for (const tz of shifts) consider(m, [tx, ty, tz])
      }
    }
  }

  if (best?.m && thorough) {
    const deg = Math.PI / 180
    for (let twist = 0; twist < 360; twist += 20) {
      const m = mulMat(rotMat(twist * deg, 0, 0), best.m)
      consider(m, best.t)
      const m2 = mulMat(rotMat(0, twist * deg, 0), best.m)
      consider(m2, best.t)
    }
  }

  if (best?.m) {
    const deg = Math.PI / 180
    const span = thorough ? 20 : 15
    const step = thorough ? 10 : 15
    for (let rx = -span; rx <= span; rx += step) {
      for (let ry = -span; ry <= span; ry += step) {
        for (let rz = -span; rz <= span; rz += step) {
          if (rx === 0 && ry === 0 && rz === 0) continue
          const m = mulMat(rotMat(rx * deg, ry * deg, rz * deg), best.m)
          consider(m, best.t)
        }
      }
    }
  }

  if (best?.m && thorough) {
    const deg = Math.PI / 180
    for (let iter = 0; iter < 6; iter++) {
      const dR = (10 / (iter + 1)) * deg
      const dT = 0.55 / (iter + 1)
      let improved = false
      const dirs = [
        [dR, 0, 0, 0, 0, 0],
        [-dR, 0, 0, 0, 0, 0],
        [0, dR, 0, 0, 0, 0],
        [0, -dR, 0, 0, 0, 0],
        [0, 0, dR, 0, 0, 0],
        [0, 0, -dR, 0, 0, 0],
        [0, 0, 0, dT, 0, 0],
        [0, 0, 0, -dT, 0, 0],
        [0, 0, 0, 0, dT, 0],
        [0, 0, 0, 0, -dT, 0],
        [0, 0, 0, 0, 0, dT],
        [0, 0, 0, 0, 0, -dT],
      ]
      for (const [rx, ry, rz, tx, ty, tz] of dirs) {
        const prev = best.clear
        consider(mulMat(rotMat(rx, ry, rz), best.m), [best.t[0] + tx, best.t[1] + ty, best.t[2] + tz])
        if (best.clear > prev + 1e-4) improved = true
      }
      if (!improved) break
    }
  }
  return best
}

const placedGuests = []
const occupied = []

for (const spec of GUESTS) {
  const pdbPath = join(root, 'original_images', 'supporting', spec.file)
  const mol = scaleMol(parsePdb(pdbPath), spec.scale ?? 1)
  console.log(
    `${spec.id}: ${mol.atoms.length} heavy atoms, radius ${mol.radius.toFixed(1)} Å` +
      (spec.scale && spec.scale !== 1 ? ` (×${spec.scale})` : ''),
  )
  let chosen = null
  for (const site of large) {
    if (occupied.some((o) => Math.hypot(site.x - o.x, site.y - o.y, site.z - o.z) < CAGE_SEP)) continue
    const trial = dock(mol, site, occupied, spec.thorough)
    if (!trial || trial.clear < spec.minClear) continue
    chosen = { ...trial, site }
    break
  }
  if (!chosen) {
    console.log(`  skipped — no large open cage accepted it`)
    continue
  }
  console.log(
    `  docked in large cage r=${chosen.site.r.toFixed(2)} Å  zFace=${chosen.site.zFace.toFixed(1)} Å  clearance=${chosen.clear.toFixed(2)} Å`,
  )
  const pull = spec.pull ?? 0.5
  occupied.push({
    x: chosen.site.x,
    y: chosen.site.y,
    z: chosen.site.z + chosen.dz + pull,
    span: mol.radius + 1.5,
  })
  placedGuests.push({
    name: spec.id,
    carbon: spec.carbon,
    site: {
      x: chosen.site.x - a * 0.5,
      y: chosen.site.y - a * 0.5,
      z: chosen.site.z + chosen.dz + pull - a * 0.5,
    },
    atoms: chosen.placed.map((p, i) => {
      const look = DISPLAY[p.element] ?? DISPLAY.C
      return {
        id: i,
        element: p.element,
        x: p.x - a * 0.5,
        y: p.y - a * 0.5,
        z: p.z + pull - a * 0.5,
        color: p.element === 'C' ? spec.carbon : look.color,
        radius: look.radius,
      }
    }),
    bonds: mol.bonds,
  })
}

if (!placedGuests.length) {
  throw new Error('Could not dock either guest into an edge cage')
}

const focus = placedGuests.reduce(
  (acc, g) => ({
    x: acc.x + g.site.x / placedGuests.length,
    y: acc.y + g.site.y / placedGuests.length,
    z: acc.z + g.site.z / placedGuests.length,
  }),
  { x: 0, y: 0, z: 0 },
)

const payload = {
  source: 'rowleyite.cif + doxorubicin, vincristine, cisplatin, temozolomide PDBs',
  cell: { a },
  focus: {
    x: Math.round(focus.x * 1000) / 1000,
    y: Math.round(focus.y * 1000) / 1000,
    z: Math.round(focus.z * 1000) / 1000,
  },
  molecules: placedGuests.map((g) => ({
    ...g,
    site: {
      x: Math.round(g.site.x * 1000) / 1000,
      y: Math.round(g.site.y * 1000) / 1000,
      z: Math.round(g.site.z * 1000) / 1000,
    },
    atoms: g.atoms.map((p) => ({
      ...p,
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000,
      z: Math.round(p.z * 1000) / 1000,
    })),
  })),
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload))
console.log(`Wrote ${placedGuests.map((g) => g.name).join(' + ')} → ${outPath}`)
