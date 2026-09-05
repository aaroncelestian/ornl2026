export type Vec3 = [number, number, number]

export type CrystalPhase = 'k' | 'pore' | 'h-point' | 'exchange' | 'locked'

export type Hydroxyl = {
  id: string
  oxygen: Vec3
  kPos: Vec3
  point: Vec3
  bend: Vec3
  out: Vec3
}

export type Potassium = {
  id: number
  pos: Vec3
}

export type PoreWindow = {
  id: string
  center: Vec3
  normal: Vec3
  radius: number
  oxygens: Vec3[]
}

type Atom = {
  id: number
  element: string
  x: number
  y: number
  z: number
}

const OH = 0.97
const KO_CUTOFF = 3.15
const BEND = 1.28
const LEAVE = 2.15

function v(x: number, y: number, z: number): Vec3 {
  return [x, y, z]
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

function len(a: Vec3) {
  return Math.hypot(a[0], a[1], a[2])
}

function nrm(a: Vec3): Vec3 {
  const d = len(a) || 1
  return scale(a, 1 / d)
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function rotate(dir: Vec3, axisHint: Vec3, angle: number): Vec3 {
  let axis = cross(dir, axisHint)
  if (len(axis) < 1e-5) axis = cross(dir, [0, 1, 0])
  if (len(axis) < 1e-5) axis = cross(dir, [1, 0, 0])
  axis = nrm(axis)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const d = nrm(dir)
  // Rodrigues
  const kxd = cross(axis, d)
  const kdot = axis[0] * d[0] + axis[1] * d[1] + axis[2] * d[2]
  return nrm([
    d[0] * c + kxd[0] * s + axis[0] * kdot * (1 - c),
    d[1] * c + kxd[1] * s + axis[1] * kdot * (1 - c),
    d[2] * c + kxd[2] * s + axis[2] * kdot * (1 - c),
  ])
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function smooth(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export function phaseForBeat(id?: string): CrystalPhase {
  if (id === 'pore') return 'pore'
  if (id === 'protons') return 'h-point'
  if (id === 'lock') return 'exchange'
  if (id === 'patients') return 'locked'
  return 'k'
}

export function buildExchangeSites(atoms: Atom[]) {
  const potassium: Potassium[] = atoms
    .filter((atom) => atom.element === 'K')
    .map((atom) => ({ id: atom.id, pos: v(atom.x, atom.y, atom.z) }))
  const oxygens = atoms.filter((atom) => atom.element === 'O')
  const hydroxyls: Hydroxyl[] = []

  for (const k of potassium) {
    const coordinated = oxygens
      .map((o) => ({ o, d: Math.hypot(o.x - k.pos[0], o.y - k.pos[1], o.z - k.pos[2]) }))
      .filter((row) => row.d > 0.5 && row.d < KO_CUTOFF)
      .sort((a, b) => a.d - b.d)
    const near = coordinated.slice(0, Math.round(coordinated.length * 0.5))

    for (const { o } of near) {
      const oxygen = v(o.x, o.y, o.z)
      const towardK = nrm(sub(k.pos, oxygen))
      const radial = nrm(oxygen)
      const bent = rotate(towardK, radial, BEND)
      const leaving = nrm(add(rotate(towardK, radial, LEAVE), scale(towardK, -0.35)))
      hydroxyls.push({
        id: `${k.id}-${o.id}`,
        oxygen,
        kPos: k.pos,
        point: add(oxygen, scale(towardK, OH)),
        bend: add(oxygen, scale(bent, OH)),
        out: add(oxygen, scale(leaving, 2.35)),
      })
    }
  }

  return { potassium, hydroxyls }
}

function pairKey(a: number, b: number) {
  return a < b ? `${a},${b}` : `${b},${a}`
}

export function buildPoreWindows(atoms: Atom[], bonds: [number, number][]): PoreWindow[] {
  const oxygenOf = new Map<number, number[]>()
  for (const [i, j] of bonds) {
    const list = oxygenOf.get(i)
    if (list) list.push(j)
    else oxygenOf.set(i, [j])
  }

  const neighbors = new Map<number, Set<number>>()
  const bridge = new Map<string, number>()
  const tIds = [...oxygenOf.keys()].filter((id) => {
    const el = atoms[id]?.element
    return el === 'Si' || el === 'Zr'
  })

  for (let a = 0; a < tIds.length; a++) {
    const i = tIds[a]
    const oi = oxygenOf.get(i) ?? []
    for (let b = a + 1; b < tIds.length; b++) {
      const j = tIds[b]
      const shared = (oxygenOf.get(j) ?? []).find((o) => oi.includes(o))
      if (shared == null) continue
      if (!neighbors.has(i)) neighbors.set(i, new Set())
      if (!neighbors.has(j)) neighbors.set(j, new Set())
      neighbors.get(i)!.add(j)
      neighbors.get(j)!.add(i)
      bridge.set(pairKey(i, j), shared)
    }
  }

  const cycles: number[][] = []
  const seen = new Set<string>()
  const nodes = [...neighbors.keys()].sort((a, b) => a - b)

  function walk(start: number, cur: number, path: number[], used: Set<number>) {
    if (path.length === 7) {
      if (!neighbors.get(cur)?.has(start)) return
      const key = [...path].sort((a, b) => a - b).join('-')
      if (seen.has(key)) return
      seen.add(key)
      cycles.push([...path])
      return
    }
    for (const next of neighbors.get(cur) ?? []) {
      if (next < start || used.has(next)) continue
      used.add(next)
      path.push(next)
      walk(start, next, path, used)
      path.pop()
      used.delete(next)
    }
  }

  for (const start of nodes) walk(start, start, [start], new Set([start]))

  const windows: PoreWindow[] = []
  for (const cycle of cycles) {
    const oxygenIds: number[] = []
    for (let i = 0; i < cycle.length; i++) {
      const o = bridge.get(pairKey(cycle[i], cycle[(i + 1) % cycle.length]))
      if (o == null) break
      oxygenIds.push(o)
    }
    if (oxygenIds.length !== 7) continue
    const oxygens = oxygenIds.map((id) => v(atoms[id].x, atoms[id].y, atoms[id].z))
    const center = scale(
      oxygens.reduce((sum, p) => add(sum, p), v(0, 0, 0)),
      1 / oxygens.length,
    )
    if (len(center) < 2.2) continue
    let nx = 0
    let ny = 0
    let nz = 0
    for (let i = 0; i < oxygens.length; i++) {
      const a = sub(oxygens[i], center)
      const b = sub(oxygens[(i + 1) % oxygens.length], center)
      const n = cross(a, b)
      nx += n[0]
      ny += n[1]
      nz += n[2]
    }
    const radius = oxygens.reduce((sum, p) => sum + len(sub(p, center)), 0) / oxygens.length
    windows.push({
      id: oxygenIds.join('-'),
      center,
      normal: nrm([nx, ny, nz]),
      radius,
      oxygens,
    })
  }

  return windows
}

export type ExchangeAnim = {
  hMix: number
  hOp: number
  kOp: number
  kLock: number
  cellScale: number
  cellGlow: number
  poreOp: number
  flash: number
}

export const CELL_OPEN = 1
export const CELL_SHRUNK = 0.82
export const K_HELD = 0.14
const K_READY = 0.4
const CELL_CLAMP = 0.76

function shrinkScale(t: number) {
  const s = smooth(t)
  if (s < 0.72) return CELL_OPEN - (CELL_OPEN - CELL_CLAMP) * smooth(s / 0.72)
  return CELL_CLAMP + (CELL_SHRUNK - CELL_CLAMP) * smooth((s - 0.72) / 0.28)
}

function openScale(t: number) {
  const s = smooth(t)
  if (s < 0.78) return CELL_SHRUNK + (1.04 - CELL_SHRUNK) * smooth(s / 0.78)
  return 1.04 - 0.04 * smooth((s - 0.78) / 0.22)
}

export function sampleHEntry(progress: number, kStart = 1): ExchangeAnim {
  const p = Math.max(0, Math.min(1, progress))
  const t = smooth(p)
  return {
    hMix: 0,
    hOp: t,
    kOp: kStart + (K_HELD - kStart) * t,
    kLock: 0,
    cellScale: shrinkScale(p),
    cellGlow: t,
    poreOp: 0,
    flash: 0,
  }
}

export function samplePore(progress: number): ExchangeAnim {
  const p = Math.max(0, Math.min(1, progress))
  return {
    hMix: 0,
    hOp: 0,
    kOp: 1 - 0.88 * smooth(p / 0.4),
    kLock: 0,
    cellScale: 1,
    cellGlow: 0.22 * smooth((p - 0.36) / 0.4),
    poreOp: smooth((p - 0.38) / 0.48),
    flash: 0,
  }
}

const RISE_END = 0.14
const PAUSE_END = 0.32
const FLASH_END = 0.42
const FILL_END = 0.82

export function sampleExchange(progress: number): ExchangeAnim {
  const p = Math.max(0, Math.min(1, progress))

  let kOp = K_HELD
  if (p < RISE_END) {
    kOp = K_HELD + (K_READY - K_HELD) * smooth(p / RISE_END)
  } else if (p < FLASH_END) {
    kOp = K_READY
  } else {
    kOp = K_READY + (1 - K_READY) * smooth((p - FLASH_END) / (FILL_END - FLASH_END))
  }

  let flash = 0
  if (p >= PAUSE_END && p < FLASH_END) {
    const u = (p - PAUSE_END) / (FLASH_END - PAUSE_END)
    flash = Math.sin(u * Math.PI) ** 1.25
  }

  let hMix = 0
  let hOp = 1
  if (p >= FLASH_END) {
    const hT = smooth((p - FLASH_END) / 0.52)
    if (hT < 0.42) {
      hMix = hT / 0.42
    } else {
      const u = (hT - 0.42) / 0.58
      hMix = 1 + u
      hOp = 1 - u
    }
  }

  const opening = p < FLASH_END + 0.04 ? 0 : smooth((p - FLASH_END - 0.04) / 0.44)
  const kLock = p < 0.76 ? 0 : smooth((p - 0.76) / 0.22)
  return {
    hMix,
    hOp,
    kOp: Math.min(1, kOp),
    kLock,
    cellScale: openScale(opening),
    cellGlow: 1 - opening,
    poreOp: 0,
    flash,
  }
}

export function hydroxylAt(site: Hydroxyl, hMix: number): Vec3 {
  if (hMix <= 1) return lerp3(site.point, site.bend, hMix)
  return lerp3(site.bend, site.out, hMix - 1)
}

export function flashAt(site: Hydroxyl): Vec3 {
  return lerp3(site.point, site.kPos, 0.5)
}
