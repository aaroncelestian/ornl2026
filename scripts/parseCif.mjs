#!/usr/bin/env node
/**
 * Parse CZS-K.cif → compact lokelmaAtoms.json for the crystal viewer.
 * Expands the asymmetric unit through Pa-3, then keeps a centered cluster
 * so the 7-ring channels and K sites stay readable on a projector.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const cifPath = join(root, 'original_images', 'supporting', 'CZS-K.cif')
const outPath = join(root, 'src', 'data', 'lokelmaAtoms.json')

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
    const water = /^Ow/i.test(label)
    return {
      label,
      element: water ? 'Ow' : type,
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
  return `${a.element}:${a.x.toFixed(4)},${a.y.toFixed(4)},${a.z.toFixed(4)}`
}

const a = parseNum(cif.match(/_cell_length_a\s+(\S+)/)?.[1] ?? '12.79417')
const ops = parseOps(cif)
const asym = parseAtoms(cif)

const unit = new Map()
for (const atom of asym) {
  if (atom.element === 'Ow') continue
  for (const op of ops) {
    const p = applyOp(op, atom)
    const w = { element: p.element, x: wrap(p.x), y: wrap(p.y), z: wrap(p.z) }
    unit.set(key(w), w)
  }
}

const translations = [-1, 0, 1]
const supercell = []
for (const atom of unit.values()) {
  for (const tx of translations) {
    for (const ty of translations) {
      for (const tz of translations) {
        supercell.push({
          element: atom.element,
          x: (atom.x + tx - 0.5) * a,
          y: (atom.y + ty - 0.5) * a,
          z: (atom.z + tz - 0.5) * a,
        })
      }
    }
  }
}

const radius = 8.6
const cluster = supercell.filter((p) => {
  const d = Math.hypot(p.x, p.y, p.z)
  return d < radius
})

const seen = new Map()
for (const atom of cluster) {
  const k = `${atom.element}:${atom.x.toFixed(3)},${atom.y.toFixed(3)},${atom.z.toFixed(3)}`
  if (!seen.has(k)) seen.set(k, atom)
}
const picked = [...seen.values()]

const positions = picked.map((atom, i) => ({
  id: i,
  element: atom.element,
  x: atom.x,
  y: atom.y,
  z: atom.z,
}))

const bondMax = { Si: 1.78, Zr: 2.28 }
const bonds = []
for (let i = 0; i < positions.length; i++) {
  const A = positions[i]
  const max = bondMax[A.element]
  if (!max) continue
  for (let j = 0; j < positions.length; j++) {
    const B = positions[j]
    if (B.element !== 'O') continue
    const d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z)
    if (d > 0.5 && d < max) bonds.push([i, j])
  }
}

const colors = {
  Zr: '#8a9aa8',
  Si: '#7ec4d4',
  O: '#c8c0b4',
  K: '#f0c878',
}

const sizes = {
  Zr: 0.34,
  Si: 0.26,
  O: 0.16,
  K: 0.42,
}

const counts = {}
for (const p of positions) counts[p.element] = (counts[p.element] ?? 0) + 1

const payload = {
  mineral: 'Sodium zirconium cyclosilicate (ZS-9 / Lokelma)',
  source: 'CZS-K.cif · Pa-3 · K in the 7-ring channels',
  cell: { a, b: a, c: a },
  atoms: positions.map((p) => ({
    ...p,
    color: colors[p.element],
    radius: sizes[p.element],
  })),
  bonds,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload))
console.log(
  `Wrote ${payload.atoms.length} atoms (${JSON.stringify(counts)}), ${bonds.length} bonds → ${outPath}`,
)
