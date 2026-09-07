import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import data from '../../data/lmoSpinel.json'
import raman from '../../data/ramanExchange.json'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import { ExchangeIons, H_COLOR, type RideState } from './LmoExchange'
import styles from './Motifs.module.css'

const SCALE = 0.42
const HOME = new THREE.Vector3(4.2, 2.6, 5.8)
const CELL_A = data.cell.a
const CELL_HALF = CELL_A * 0.5
const VOID_OUT = '#5e87a0'
const VOID_IN = '#f0d7a0'
const VOID_GHOST = '#e0b15c'
const LI_COLOR = '#6ecf7a'
const MN_COLOR = '#8b5cad'
const O_COLOR = '#c45a3a'
const ARROW_MN = '#c4894a'
const ARROW_O = '#7ec4d4'
const C_RAMAN = '#7ec4d4'
const C_RAMAN_DIM = '#564f48'
const _Y_UP = new THREE.Vector3(0, 1, 0)
const _DIR = new THREE.Vector3()
const _QUAT = new THREE.Quaternion()

type Phase = 'framework' | 'voids' | 'hydrogen' | 'lithium' | 'cubane'

function phaseForBeat(id?: string): Phase {
  if (id === 'voids') return 'voids'
  if (id === '8a') return 'hydrogen'
  if (id === 'li-in') return 'lithium'
  if (id === 'cubane') return 'cubane'
  return 'framework'
}

const CAPTION: Record<Phase, string> = {
  framework: 'LiMn₂O₄ · Mn–O balls · drag to orbit',
  voids: 'VdW empty space · Mn/O spheres · Li removed',
  hydrogen: 'H enters · sits on O · OH → 8a',
  lithium: 'Li in · H out the pore',
  cubane: 'A₁g · Mn₄O₄ cubane breathe · 4 MnO₆',
}

function CellWire({ size, opacity = 0.28 }: { size: number; opacity?: number }) {
  const edges = useMemo(() => {
    const h = size / 2
    const c: [number, number, number][] = [
      [-h, -h, -h],
      [h, -h, -h],
      [h, h, -h],
      [-h, h, -h],
      [-h, -h, h],
      [h, -h, h],
      [h, h, h],
      [-h, h, h],
    ]
    const pairs: [number, number][] = [
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
    return pairs.map(([i, j]) => [c[i], c[j]] as [[number, number, number], [number, number, number]])
  }, [size])

  return (
    <group>
      {edges.map((points, i) => (
        <Line key={i} points={points} color="#d4a04a" lineWidth={1} transparent opacity={opacity} />
      ))}
    </group>
  )
}

function cellClipPlanes() {
  const h = CELL_HALF * SCALE
  return [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), h),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), h),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), h),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), h),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), h),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), h),
  ]
}

function softenNormals(geo: THREE.BufferGeometry, passes = 2) {
  geo.computeVertexNormals()
  const nrm = geo.getAttribute('normal')
  const idx = geo.getIndex()
  if (!nrm || !idx) return
  const nV = nrm.count
  const nbrs: number[][] = Array.from({ length: nV }, () => [])
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t)
    const b = idx.getX(t + 1)
    const c = idx.getX(t + 2)
    nbrs[a].push(b, c)
    nbrs[b].push(a, c)
    nbrs[c].push(a, b)
  }
  const next = new Float32Array(nV * 3)
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < nV; i++) {
      let x = nrm.getX(i)
      let y = nrm.getY(i)
      let z = nrm.getZ(i)
      for (const j of nbrs[i]) {
        x += nrm.getX(j)
        y += nrm.getY(j)
        z += nrm.getZ(j)
      }
      const len = Math.hypot(x, y, z) || 1
      next[i * 3] = x / len
      next[i * 3 + 1] = y / len
      next[i * 3 + 2] = z / len
    }
    for (let i = 0; i < nV; i++) {
      nrm.setXYZ(i, next[i * 3], next[i * 3 + 1], next[i * 3 + 2])
    }
  }
  nrm.needsUpdate = true
}

function VoidSurface({ pore }: { pore: boolean }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.void.positions, 3))
    geo.setIndex(data.void.index)
    softenNormals(geo, 3)
    return geo
  }, [])

  const clip = useMemo(() => cellClipPlanes(), [])

  // Steel on the outer skin, cream on the channel interior (cut-open look).
  // Clipped to the same unit cell as the ball-and-stick model.
  if (pore) {
    return (
      <group>
        <mesh geometry={geometry} renderOrder={1}>
          <meshPhysicalMaterial
            color={VOID_OUT}
            roughness={0.42}
            metalness={0.06}
            clearcoat={0.18}
            clearcoatRoughness={0.45}
            sheen={0.22}
            sheenColor="#b8d4e0"
            flatShading={false}
            side={THREE.BackSide}
            clippingPlanes={clip}
            clipShadows
          />
        </mesh>
        <mesh geometry={geometry} renderOrder={2}>
          <meshPhysicalMaterial
            color={VOID_IN}
            emissive={VOID_IN}
            emissiveIntensity={0.1}
            roughness={0.55}
            metalness={0.02}
            sheen={0.16}
            sheenColor="#f0d7a0"
            flatShading={false}
            side={THREE.FrontSide}
            clippingPlanes={clip}
            clipShadows
          />
        </mesh>
      </group>
    )
  }

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color={VOID_GHOST}
        transparent
        opacity={0.28}
        roughness={0.4}
        metalness={0.08}
        transmission={0.12}
        thickness={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

type VoidAtom = { element: string; x: number; y: number; z: number }

const ATOM_DRAW = { Mn: 0.36, O: 0.24 }
const MN_O_MIN = 1.4
const MN_O_MAX = 2.25

function minImage(d: number, cell: number) {
  const half = cell * 0.5
  if (d > half) return d - cell
  if (d < -half) return d + cell
  return d
}

function atomKey(x: number, y: number, z: number) {
  return `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
}

type CellBond = { ia: number; ib: number; rest: number }

type CellModel = {
  atoms: VoidAtom[]
  bonds: CellBond[]
  neighbors: number[][]
}

/** Unit-cell Mn + O, plus periodic O images so every MnO₆ is complete outside the box. */
function completeCellAtoms(): CellModel {
  const atoms: VoidAtom[] = data.manganese.map((p) => ({ element: 'Mn', ...p }))
  const seen = new Set<string>()
  const addO = (x: number, y: number, z: number) => {
    const key = atomKey(x, y, z)
    if (seen.has(key)) return
    seen.add(key)
    atoms.push({ element: 'O', x, y, z })
  }
  for (const ox of data.oxygen) addO(ox.x, ox.y, ox.z)
  for (const mn of data.manganese) {
    for (const ox of data.oxygen) {
      const dx = minImage(ox.x - mn.x, CELL_A)
      const dy = minImage(ox.y - mn.y, CELL_A)
      const dz = minImage(ox.z - mn.z, CELL_A)
      const d = Math.hypot(dx, dy, dz)
      if (d > MN_O_MIN && d < MN_O_MAX) addO(mn.x + dx, mn.y + dy, mn.z + dz)
    }
  }
  const neighbors = atoms.map(() => [] as number[])
  const bonds: CellBond[] = []
  const pairSeen = new Set<string>()
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i].element !== 'Mn') continue
    for (let j = 0; j < atoms.length; j++) {
      if (atoms[j].element !== 'O') continue
      const d = Math.hypot(atoms[j].x - atoms[i].x, atoms[j].y - atoms[i].y, atoms[j].z - atoms[i].z)
      if (d <= MN_O_MIN || d >= MN_O_MAX) continue
      const key = `${i}-${j}`
      if (pairSeen.has(key)) continue
      pairSeen.add(key)
      neighbors[i].push(j)
      neighbors[j].push(i)
      bonds.push({ ia: i, ib: j, rest: d })
    }
  }
  return { atoms, bonds, neighbors }
}

function vibeKind(phase: Phase): 'coherent' | 'damped' | 'stiff' {
  if (phase === 'hydrogen') return 'damped'
  if (phase === 'lithium') return 'stiff'
  return 'coherent'
}

function placeHalfBond(
  mesh: THREE.Mesh,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  rest: number,
  towardA: boolean,
) {
  _DIR.set(bx - ax, by - ay, bz - az)
  const live = _DIR.length() || rest
  _DIR.normalize()
  _QUAT.setFromUnitVectors(_Y_UP, _DIR)
  const mx = (ax + bx) * 0.5
  const my = (ay + by) * 0.5
  const mz = (az + bz) * 0.5
  if (towardA) {
    mesh.position.set((ax + mx) * 0.5, (ay + my) * 0.5, (az + mz) * 0.5)
  } else {
    mesh.position.set((bx + mx) * 0.5, (by + my) * 0.5, (bz + mz) * 0.5)
  }
  mesh.quaternion.copy(_QUAT)
  mesh.scale.set(1, live / rest, 1)
}

function VibratingCell({
  phase,
  vibeOn,
  active,
  reduced,
}: {
  phase: Phase
  vibeOn: boolean
  active: boolean
  reduced: boolean
}) {
  const model = useMemo(() => completeCellAtoms(), [])
  const atomRefs = useRef<(THREE.Mesh | null)[]>([])
  const bondA = useRef<(THREE.Mesh | null)[]>([])
  const bondB = useRef<(THREE.Mesh | null)[]>([])
  const kind = vibeKind(phase)

  useFrame(({ clock }) => {
    const { atoms, bonds, neighbors } = model
    const n = atoms.length
    const on = vibeOn && active && !reduced
    const t = clock.getElapsedTime()
    const baseAmp = kind === 'damped' ? 0.07 : kind === 'stiff' ? 0.11 : 0.14
    const baseHz = kind === 'damped' ? 0.72 : kind === 'stiff' ? 1.32 : 1.05

    for (let i = 0; i < n; i++) {
      const atom = atoms[i]
      let x = atom.x
      let y = atom.y
      let z = atom.z
      if (on) {
        const links = neighbors[i]
        let dx = 0
        let dy = 0
        let dz = 0
        for (const j of links) {
          const other = atoms[j]
          let ux = atom.x - other.x
          let uy = atom.y - other.y
          let uz = atom.z - other.z
          const len = Math.hypot(ux, uy, uz) || 1
          ux /= len
          uy /= len
          uz /= len
          const local = kind === 'damped' ? (i * 1.7 + j * 0.31) : 0
          const hz = kind === 'damped' ? baseHz + ((i * 13) % 7) * 0.08 : baseHz
          const s = Math.sin(t * Math.PI * 2 * hz + local) * baseAmp
          const w = atom.element === 'Mn' ? 0.35 : 1
          dx += ux * s * w
          dy += uy * s * w
          dz += uz * s * w
        }
        const count = Math.max(1, links.length)
        x += dx / count
        y += dy / count
        z += dz / count
      }
      const mesh = atomRefs.current[i]
      if (mesh) mesh.position.set(x, y, z)
    }

    for (let b = 0; b < bonds.length; b++) {
      const { ia, ib, rest } = bonds[b]
      const A = atomRefs.current[ia]
      const B = atomRefs.current[ib]
      const ha = bondA.current[b]
      const hb = bondB.current[b]
      if (!A || !B || !ha || !hb) continue
      placeHalfBond(ha, A.position.x, A.position.y, A.position.z, B.position.x, B.position.y, B.position.z, rest, true)
      placeHalfBond(hb, A.position.x, A.position.y, A.position.z, B.position.x, B.position.y, B.position.z, rest, false)
    }
  })

  return (
    <group>
      {model.bonds.map((bond, i) => (
        <group key={`b-${i}`}>
          <mesh
            ref={(el) => {
              bondA.current[i] = el
            }}
          >
            <cylinderGeometry args={[0.07, 0.07, bond.rest * 0.5, 8]} />
            <meshStandardMaterial color={MN_COLOR} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh
            ref={(el) => {
              bondB.current[i] = el
            }}
          >
            <cylinderGeometry args={[0.07, 0.07, bond.rest * 0.5, 8]} />
            <meshStandardMaterial color={O_COLOR} roughness={0.4} metalness={0.15} />
          </mesh>
        </group>
      ))}
      {model.atoms.map((atom, i) => (
        <mesh
          key={i}
          ref={(el) => {
            atomRefs.current[i] = el
          }}
          position={[atom.x, atom.y, atom.z]}
          renderOrder={2}
        >
          <sphereGeometry args={[atom.element === 'Mn' ? ATOM_DRAW.Mn : ATOM_DRAW.O, 20, 20]} />
          <meshStandardMaterial
            color={atom.element === 'Mn' ? MN_COLOR : O_COLOR}
            roughness={0.34}
            metalness={atom.element === 'Mn' ? 0.22 : 0.1}
          />
        </mesh>
      ))}
    </group>
  )
}

type CubaneData = {
  center: number[]
  mn: number[][]
  coreO: number[][]
  terminalO: number[][]
  bonds: { mn: number; o: number[]; core: boolean }[]
}

function BondStick({
  a,
  b,
  colorA,
  colorB,
}: {
  a: [number, number, number]
  b: [number, number, number]
  colorA: string
  colorB: string
}) {
  const mid = useMemo(() => {
    const A = new THREE.Vector3(...a)
    const B = new THREE.Vector3(...b)
    const dir = new THREE.Vector3().subVectors(B, A)
    const len = dir.length()
    const quat = new THREE.Quaternion()
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    const half = A.clone().add(B).multiplyScalar(0.5)
    const aMid = A.clone().lerp(half, 0.5)
    const bMid = B.clone().lerp(half, 0.5)
    return { len, quat, aMid, bMid }
  }, [a, b])

  return (
    <group>
      <mesh position={mid.aMid.toArray()} quaternion={mid.quat}>
        <cylinderGeometry args={[0.07, 0.07, mid.len * 0.5, 8]} />
        <meshStandardMaterial color={colorA} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={mid.bMid.toArray()} quaternion={mid.quat}>
        <cylinderGeometry args={[0.07, 0.07, mid.len * 0.5, 8]} />
        <meshStandardMaterial color={colorB} roughness={0.4} metalness={0.15} />
      </mesh>
    </group>
  )
}

/** Radial A₁g displacement arrow (cone + shaft) */
function ModeArrow({
  from,
  dir,
  color,
  amp,
}: {
  from: [number, number, number]
  dir: THREE.Vector3
  color: string
  amp: number
}) {
  const geom = useMemo(() => {
    const u = dir.clone().normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), u)
    const baseLen = 0.95
    const tip = 0.28
    const start = new THREE.Vector3(...from).addScaledVector(u, 0.35)
    const shaftMid = start.clone().addScaledVector(u, (baseLen * 0.5) * (0.85 + amp * 0.35))
    const tipPos = start.clone().addScaledVector(u, baseLen * (0.85 + amp * 0.35) + tip * 0.35)
    return { quat, shaftMid, tipPos, shaftLen: baseLen * (0.85 + amp * 0.35) }
  }, [from, dir, amp])

  return (
    <group>
      <mesh position={geom.shaftMid.toArray()} quaternion={geom.quat}>
        <cylinderGeometry args={[0.055, 0.055, geom.shaftLen, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.35} />
      </mesh>
      <mesh position={geom.tipPos.toArray()} quaternion={geom.quat}>
        <coneGeometry args={[0.14, 0.32, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.3} />
      </mesh>
    </group>
  )
}

/**
 * Ball-and-stick Mn₄O₄ cubane + terminal O of four face-shared MnO₆.
 * A₁g: Mn (copper) and core O (mineral blue) displace radially outward.
 */
function CubaneUnit({
  cubane,
  active,
  reduced,
  vibeOn,
}: {
  cubane: CubaneData
  active: boolean
  reduced: boolean
  vibeOn: boolean
}) {
  const breath = useRef(0)
  const atomGroup = useRef<THREE.Group>(null)

  const center = cubane.center as [number, number, number]
  const mnLocal = useMemo(
    () => cubane.mn.map((m) => [m[0] - center[0], m[1] - center[1], m[2] - center[2]] as [number, number, number]),
    [cubane.mn, center],
  )
  const coreLocal = useMemo(
    () =>
      cubane.coreO.map(
        (o) => [o[0] - center[0], o[1] - center[1], o[2] - center[2]] as [number, number, number],
      ),
    [cubane.coreO, center],
  )
  const termLocal = useMemo(
    () =>
      cubane.terminalO.map(
        (o) => [o[0] - center[0], o[1] - center[1], o[2] - center[2]] as [number, number, number],
      ),
    [cubane.terminalO, center],
  )
  const bondsLocal = useMemo(
    () =>
      cubane.bonds.map((b) => ({
        mn: mnLocal[b.mn],
        o: [b.o[0] - center[0], b.o[1] - center[1], b.o[2] - center[2]] as [number, number, number],
      })),
    [cubane.bonds, mnLocal, center],
  )

  useFrame(({ clock }) => {
    const t = active && !reduced && vibeOn ? Math.sin(clock.getElapsedTime() * Math.PI * 2 * 1.05) : 0
    breath.current = t
    const root = atomGroup.current
    if (!root) return
    // Displace core Mn and O along radial vectors (A₁g breathe)
    let idx = 0
    for (const m of mnLocal) {
      const child = root.children[idx++]
      if (!child) continue
      const u = new THREE.Vector3(...m).normalize()
      child.position.set(m[0] + u.x * t * 0.22, m[1] + u.y * t * 0.22, m[2] + u.z * t * 0.22)
    }
    for (const o of coreLocal) {
      const child = root.children[idx++]
      if (!child) continue
      const u = new THREE.Vector3(...o).normalize()
      child.position.set(o[0] + u.x * t * 0.18, o[1] + u.y * t * 0.18, o[2] + u.z * t * 0.18)
    }
  })

  const amp = active && !reduced && vibeOn ? 0.5 + 0.5 * Math.max(0, breath.current) : 0.35

  return (
    <group position={center}>
      {bondsLocal.map((b, i) => (
        <BondStick key={i} a={b.mn} b={b.o} colorA={MN_COLOR} colorB={O_COLOR} />
      ))}

      <group ref={atomGroup}>
        {mnLocal.map((m, i) => (
          <mesh key={`mn-${i}`} position={m}>
            <sphereGeometry args={[0.38, 28, 28]} />
            <meshStandardMaterial
              color={MN_COLOR}
              roughness={0.28}
              metalness={0.35}
              emissive={MN_COLOR}
              emissiveIntensity={0.12}
            />
          </mesh>
        ))}
        {coreLocal.map((o, i) => (
          <mesh key={`co-${i}`} position={o}>
            <sphereGeometry args={[0.26, 24, 24]} />
            <meshStandardMaterial
              color={O_COLOR}
              roughness={0.32}
              metalness={0.12}
              emissive={O_COLOR}
              emissiveIntensity={0.1}
            />
          </mesh>
        ))}
      </group>

      {termLocal.map((o, i) => (
        <mesh key={`to-${i}`} position={o}>
          <sphereGeometry args={[0.24, 20, 20]} />
          <meshStandardMaterial color={O_COLOR} roughness={0.38} metalness={0.08} />
        </mesh>
      ))}

      {vibeOn &&
        mnLocal.map((m, i) => (
          <ModeArrow
            key={`amn-${i}`}
            from={m}
            dir={new THREE.Vector3(...m)}
            color={ARROW_MN}
            amp={amp}
          />
        ))}
      {vibeOn &&
        coreLocal.map((o, i) => (
          <ModeArrow
            key={`ao-${i}`}
            from={o}
            dir={new THREE.Vector3(...o)}
            color={ARROW_O}
            amp={amp}
          />
        ))}
    </group>
  )
}

function Scene({
  active,
  phase,
  ride,
  vibeOn,
}: {
  active: boolean
  phase: Phase
  ride: MutableRefObject<RideState>
  vibeOn: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const cell = data.cell.a * SCALE
  const poreView = phase === 'voids'
  const cubaneFocus = phase === 'cubane'
  const exchange = phase === 'hydrogen' || phase === 'lithium'

  const showVoids = phase === 'voids'
  const showCubane = phase === 'cubane'
  const showBalls = !showCubane
  const heroCubane = data.cubanes[0] as CubaneData
  const controls = useRef<{ enabled: boolean } | null>(null)

  useEffect(() => {
    if (exchange && group.current) group.current.rotation.set(0, 0, 0)
  }, [exchange, phase])

  useFrame((_, dt) => {
    const root = group.current
    if (controls.current) controls.current.enabled = !ride.current.following
    if (!root || !active || reduced) return
    if (exchange) return
    if (cubaneFocus) root.rotation.y += dt * 0.12
    else root.rotation.y += dt * (poreView ? 0.055 : 0.1)
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={cubaneFocus ? 0.4 : poreView ? 0.52 : 0.55} />
      <directionalLight
        position={[6, 8, 4]}
        intensity={cubaneFocus ? 1.55 : poreView ? 1.25 : 1.15}
        color="#fff3dc"
      />
      <directionalLight
        position={[-4, 2, -6]}
        intensity={cubaneFocus ? 0.5 : poreView ? 0.75 : 0.35}
        color="#9ec4d4"
      />
      {cubaneFocus && <directionalLight position={[2, -4, 5]} intensity={0.3} color="#f0c878" />}
      {poreView && <pointLight position={[0, 0, 0]} intensity={0.55} color="#f0d7a0" distance={8} />}
      <group ref={group} scale={SCALE}>
        {!cubaneFocus && <CellWire size={CELL_A} opacity={poreView ? 0.22 : 0.28} />}
        {showBalls && <VibratingCell phase={phase} vibeOn={vibeOn} active={active} reduced={reduced} />}
        {showVoids && <VoidSurface pore={poreView} />}
        {exchange && (
          <ExchangeIons
            phase={phase}
            active={active}
            reduced={reduced}
            scale={SCALE}
            ride={ride}
          />
        )}
        {showCubane && heroCubane && (
          <CubaneUnit cubane={heroCubane} active={active} reduced={reduced} vibeOn={vibeOn} />
        )}
      </group>
      <OrbitControls
        ref={(el) => {
          controls.current = el
        }}
        enablePan={false}
        minDistance={cell * (cubaneFocus ? 0.85 : 1.25)}
        maxDistance={cell * 4.5}
        makeDefault
      />
    </>
  )
}

function CameraHome({
  phase,
  ride,
}: {
  phase: Phase
  ride: MutableRefObject<RideState>
}) {
  const prev = useRef<Phase | null>(null)
  const cubaneHome = useMemo(() => {
    const c = data.cubanes[0]?.center
    if (!c) return new THREE.Vector3(3.2, 2.4, 4.2)
    return new THREE.Vector3(c[0] * SCALE + 2.8, c[1] * SCALE + 2.2, c[2] * SCALE + 3.4)
  }, [])
  const cubaneTarget = useMemo(() => {
    const c = data.cubanes[0]?.center
    if (!c) return new THREE.Vector3(0, 0, 0)
    return new THREE.Vector3(c[0] * SCALE, c[1] * SCALE, c[2] * SCALE)
  }, [])

  useFrame(({ camera }) => {
    if (phase === 'lithium' && ride.current.following) {
      camera.position.lerp(ride.current.pos, 0.14)
      camera.lookAt(ride.current.look)
      prev.current = null
      return
    }
    if (phase === 'lithium' && ride.current.done) {
      camera.position.lerp(HOME, 0.04)
      camera.lookAt(0, 0, 0)
      return
    }
    if (prev.current === phase) return
    const targetPos = phase === 'cubane' ? cubaneHome : HOME
    const look = phase === 'cubane' ? cubaneTarget : new THREE.Vector3(0, 0, 0)
    camera.position.lerp(targetPos, 0.12)
    camera.lookAt(look)
    if (camera.position.distanceTo(targetPos) < 0.08) {
      camera.position.copy(targetPos)
      prev.current = phase
    }
  })
  return null
}

type SeriesPt = { t: number; w: number }

function atTime(points: SeriesPt[], t: number): number {
  if (!points.length) return 0
  if (t <= points[0].t) return points[0].w
  const last = points[points.length - 1]
  if (t >= last.t) return last.w
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return a.w + f * (b.w - a.w)
    }
  }
  return last.w
}

function lorentzPath(center: number, fwhm: number, amp: number, w0 = 500, w1 = 780) {
  const pts: string[] = []
  const n = 80
  const gamma = Math.max(2.4, fwhm * 0.5)
  for (let i = 0; i <= n; i++) {
    const w = w0 + (i / n) * (w1 - w0)
    const dw = w - center
    const y = amp / (1 + (dw * dw) / (gamma * gamma))
    const x = 8 + ((w - w0) / (w1 - w0)) * 284
    const yy = 52 - y * 40
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yy.toFixed(1)}`)
  }
  return pts.join(' ')
}

function RamanTrack({ phase, active }: { phase: Phase; active: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  const t0 = useRef(performance.now())

  useEffect(() => {
    t0.current = performance.now()
    setElapsed(0)
  }, [phase])

  useEffect(() => {
    if (!active) return
    let id = 0
    let last = 0
    const loop = (now: number) => {
      if (now - last > 80) {
        setElapsed((now - t0.current) / 1000)
        last = now
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [active, phase])

  const track = useMemo(() => {
    const kind = vibeKind(phase)
    if (phase === 'hydrogen') {
      const u = Math.min(1, elapsed / 4.8)
      const ease = u * u
      return {
        w: 647.8,
        fwhm: 14.1 + 26 * ease,
        amp: 1 - 0.9 * ease,
        label: ease < 0.2 ? 'As-synth · A₁g on' : 'H-exchange · A₁g collapsing',
        mode: 'MnO₆ modes decohere',
        kind,
      }
    }
    if (phase === 'lithium') {
      const tMin = Math.min(8, elapsed * 0.85)
      return {
        w: atTime(raman.a1g.points, tMin),
        fwhm: atTime(raman.fwhm.points, tMin),
        amp: 0.55 + 0.4 * Math.min(1, tMin / 3),
        label: tMin < 2.8 ? 'Li → 8a · peak rising' : 'Li in 8a · A₁g shifted',
        mode: 'MnO₆ A₁g · stiffer',
        kind,
      }
    }
    if (phase === 'cubane') {
      return {
        w: 648,
        fwhm: 14.1,
        amp: 1,
        label: 'A₁g cubane stretch',
        mode: 'Mn₄O₄ breathe',
        kind,
      }
    }
    return {
      w: 648,
      fwhm: 14.1,
      amp: 1,
      label: 'As-synth · A₁g on',
      mode: 'MnO₆ A₁g · in phase',
      kind,
    }
  }, [phase, elapsed])

  const path = lorentzPath(track.w, track.fwhm, track.amp)
  const collapsed = track.amp < 0.2
  const peakX = 8 + ((track.w - 500) / 280) * 284

  return (
    <div className={styles.ramanHud} aria-hidden>
      <div className={styles.ramanHudTitle}>Raman · A₁g</div>
      <svg viewBox="0 0 300 64" className={styles.ramanHudSvg}>
        <path d={path} fill="none" stroke={collapsed ? C_RAMAN_DIM : C_RAMAN} strokeWidth="2" strokeLinecap="round" />
        <line x1={peakX} y1="10" x2={peakX} y2="54" stroke={collapsed ? C_RAMAN_DIM : C_RAMAN} strokeWidth="1" opacity="0.35" />
        <text x="8" y="62" fill="currentColor" fontSize="9" opacity="0.55">
          500
        </text>
        <text x="268" y="62" fill="currentColor" fontSize="9" opacity="0.55">
          780
        </text>
      </svg>
      <div className={styles.ramanHudMeta}>
        <span>{track.label}</span>
        <span>
          {track.w.toFixed(0)} cm⁻¹ · Γ {track.fwhm.toFixed(0)}
        </span>
      </div>
      <div className={styles.ramanHudMode}>{track.mode}</div>
    </div>
  )
}

export function LmoSpinel({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const [vibeOn, setVibeOn] = useState(true)
  const ride = useRef<RideState>({
    following: false,
    done: false,
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
  })
  const vibrations = vibeOn && !reduced

  const legend =
    phase === 'framework'
      ? [
          { color: MN_COLOR, label: 'Mn' },
          { color: O_COLOR, label: 'O' },
        ]
      : phase === 'voids'
        ? [
            { color: MN_COLOR, label: 'Mn' },
            { color: O_COLOR, label: 'O' },
            { color: VOID_OUT, label: 'void out' },
            { color: VOID_IN, label: 'void in' },
          ]
        : phase === 'hydrogen'
          ? [
              { color: MN_COLOR, label: 'Mn' },
              { color: O_COLOR, label: 'O' },
              { color: H_COLOR, label: 'H' },
            ]
          : phase === 'lithium'
            ? [
                { color: MN_COLOR, label: 'Mn' },
                { color: O_COLOR, label: 'O' },
                { color: H_COLOR, label: 'H' },
                { color: LI_COLOR, label: 'Li' },
              ]
            : [
                { color: MN_COLOR, label: 'Mn' },
                { color: O_COLOR, label: 'O' },
                { color: ARROW_MN, label: 'A₁g Mn' },
                { color: ARROW_O, label: 'A₁g O' },
              ]

  return (
    <div
      className={styles.crystal}
      aria-label={label || 'LMO spinel — MnO₆ framework, voids, and A1g cubane'}
    >
      <button
        type="button"
        className={styles.vibeBtn}
        data-on={vibrations || undefined}
        aria-pressed={vibrations}
        onClick={() => setVibeOn((on) => !on)}
      >
        <span className={styles.vibeDot} />
        Vibrations
      </button>
      <div className={styles.legend}>
        {legend.map((row) => (
          <div key={row.label} className={styles.legendRow}>
            <span className={styles.swatch} style={{ background: row.color }} />
            {row.label}
          </div>
        ))}
      </div>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: HOME.toArray(), fov: 40 }}
        gl={{ antialias: true, alpha: true, localClippingEnabled: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <CameraHome phase={phase} ride={ride} />
          <Scene active={active} phase={phase} ride={ride} vibeOn={vibrations} />
        </Suspense>
      </Canvas>
      <RamanTrack phase={phase} active={active} />
      {phase === 'voids' && (
        <div className={styles.scaleBar} aria-hidden>
          <span className={styles.scaleTick} />
          4 Å
        </div>
      )}
      <div className={styles.crystalCaption}>
        <span data-on="">{CAPTION[phase]}</span>
      </div>
    </div>
  )
}
