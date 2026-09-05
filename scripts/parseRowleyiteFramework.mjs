#!/usr/bin/env node
/**
 * Expand rowleyite.cif to a ball-and-stick framework (V–O, As–O)
 * in the same centered-Å frame as the void mesh and guest molecules.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const cifPath = join(root, 'original_images', 'supporting', 'rowleyite.cif')
const outPath = join(root, 'src', 'data', 'rowleyiteFramework.json')

const DISPLAY = {
  V: { color: '#9a8ab0', radius: 0.32 },
  As: { color: '#d4b45a', radius: 0.28 },
  P: { color: '#d4b45a', radius: 0.28 },
  O: { color: '#d0c8bc', radius: 0.18 },
}
const BOND_MAX = { V: 2.15, As: 1.85, P: 1.8 }

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
  const iX = tags.indexOf('_atom_site_fract_x')
  const iY = tags.indexOf('_atom_site_fract_y')
  const iZ = tags.indexOf('_atom_site_fract_z')
  const iType = tags.indexOf('_atom_site_type_symbol')
  const iLabel = tags.indexOf('_atom_site_label')
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

const cif = readFileSync(cifPath, 'utf8')
const a = parseNum(cif.match(/_cell_length_a\s+(\S+)/)?.[1] ?? '31.704')
const ops = parseOps(cif)
const unit = new Map()
for (const atom of parseAtoms(cif)) {
  if (!(atom.element in DISPLAY)) continue
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
  element: atom.element === 'P' ? 'As' : atom.element,
  x: atom.x * a - a * 0.5,
  y: atom.y * a - a * 0.5,
  z: atom.z * a - a * 0.5,
}))

const oxygens = atoms.filter((p) => p.element === 'O')
const metals = atoms.filter((p) => p.element === 'V' || p.element === 'As')
const bonds = []
const lengths = { V: [], As: [] }

for (const metal of metals) {
  const max = BOND_MAX[metal.element]
  for (const ox of oxygens) {
    const dx = minImage(ox.x - metal.x, a)
    const dy = minImage(ox.y - metal.y, a)
    const dz = minImage(ox.z - metal.z, a)
    const d = Math.hypot(dx, dy, dz)
    if (d < 1.2 || d > max) continue
    bonds.push({
      a: [metal.x, metal.y, metal.z],
      b: [metal.x + dx, metal.y + dy, metal.z + dz],
    })
    lengths[metal.element].push(d)
  }
}

function mean(xs) {
  return xs.reduce((s, v) => s + v, 0) / xs.length
}

const payload = {
  source: 'rowleyite.cif · Fd-3m · V–O / As–O framework',
  cell: { a },
  atoms: atoms.map((p) => ({
    element: p.element,
    x: Math.round(p.x * 1000) / 1000,
    y: Math.round(p.y * 1000) / 1000,
    z: Math.round(p.z * 1000) / 1000,
    color: DISPLAY[p.element].color,
    radius: DISPLAY[p.element].radius,
  })),
  bonds: bonds.map((b) => ({
    a: b.a.map((v) => Math.round(v * 1000) / 1000),
    b: b.b.map((v) => Math.round(v * 1000) / 1000),
  })),
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload))
console.log(
  `Framework ${atoms.length} atoms, ${bonds.length} bonds · ` +
    `V–O ${mean(lengths.V).toFixed(3)} Å · As–O ${mean(lengths.As).toFixed(3)} Å → ${outPath}`,
)
