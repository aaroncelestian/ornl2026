import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import data from '../../data/lmoSpinel.json'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import { isCaptureMode } from '../../lib/asset'
import {
  buildExchangeSites,
  ExchangeIons,
  H_COLOR,
  H_STAGGER,
  H_START,
  H_TRAVEL,
  LI_GATHER,
  OH_COLOR,
  protonBind,
  type RideState,
} from './LmoExchange'
import { CubaneUnit, type CubaneData } from './CubaneUnit'
import { STRUCTURE_DPR, STRUCTURE_GL } from '../../lib/structureCanvas'
import styles from './Motifs.module.css'

const SCALE = 0.42
const HOME = new THREE.Vector3(4.2, 2.6, 5.8)
const LOOK_ORIGIN = new THREE.Vector3(0, 0, 0)
const CELL_A = data.cell.a
const VOID_OUT = '#7eafc4'
const VOID_IN = '#d4a574'
const VOID_GHOST = '#9bb8c8'
const LI_COLOR = '#6ecf7a'
const MN_COLOR = '#8b5cad'
const O_COLOR = '#c45a3a'
const C_RAMAN = '#7ec4d4'
const C_RAMAN_DIM = '#564f48'
const SYNTH_W = 648
const SYNTH_FWHM = 14.1
const LI_W = 657
const LI_FWHM = 8.5
const H_W = LI_W - 20
/** H-form vs as-synth: ~50% wider A₁g. */
const H_FWHM = SYNTH_FWHM * 1.5
const H_AMP = 0.5
const _Y_UP = new THREE.Vector3(0, 1, 0)
const _DIR = new THREE.Vector3()
const _QUAT = new THREE.Quaternion()

type Phase = 'framework' | 'voids' | 'hydrogen' | 'lithium' | 'cubane'

const CELL_PHASES: Phase[] = ['framework', 'voids', 'hydrogen', 'lithium']

function isCellPhase(phase: Phase | null): phase is Phase {
  return phase != null && CELL_PHASES.includes(phase)
}

function phaseForBeat(id?: string): Phase {
  if (id === 'voids') return 'voids'
  if (id === '8a') return 'hydrogen'
  if (id === 'cubane') return 'cubane'
  return 'framework'
}

const EXCHANGE_N = buildExchangeSites().length
const H_TO_LI = H_START + Math.max(0, EXCHANGE_N - 1) * H_STAGGER + H_TRAVEL + 0.9
const LI_RAMAN_AT = H_TO_LI + LI_GATHER
const LI_RAMAN = 4.2

const CAPTION: Record<Phase, string> = {
  framework: 'LiMn₂O₄ · Mn–O balls · drag to orbit',
  voids: '8a→16c channels · ball-and-stick',
  hydrogen: 'H-exchange · A₁g −50% amp, +50% width',
  lithium: 'Li in 8a · A₁g up and sharp',
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
    if (data.void.normals?.length === data.void.positions.length) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.void.normals, 3))
    }
    geo.setIndex(data.void.index)
    softenNormals(geo, 2)
    return geo
  }, [])

  // Outer = cool blue (FrontSide), inner = warm amber (BackSide). Geometry unchanged.
  if (pore) {
    return (
      <group>
        <mesh geometry={geometry} renderOrder={1}>
          <meshPhysicalMaterial
            color={VOID_OUT}
            transparent
            opacity={0.72}
            roughness={0.34}
            metalness={0.04}
            transmission={0.08}
            thickness={0.35}
            sheen={0.1}
            sheenColor="#d0e4ee"
            side={THREE.FrontSide}
            depthWrite={false}
          />
        </mesh>
        <mesh geometry={geometry} renderOrder={1}>
          <meshPhysicalMaterial
            color={VOID_IN}
            transparent
            opacity={0.55}
            roughness={0.48}
            metalness={0.02}
            emissive={VOID_IN}
            emissiveIntensity={0.08}
            side={THREE.BackSide}
            depthWrite={false}
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
  const elapsed = useRef(0)
  const muteOf = useRef<Float32Array>(new Float32Array(0))
  const rested = useRef(false)
  const kind = vibeKind(phase)
  const capturing = isCaptureMode()
  const protonated = useMemo(() => {
    const sites = buildExchangeSites()
    const { atoms } = model
    return sites.map((site, siteIndex) => {
      let oIndex = -1
      let bestD = Infinity
      for (let i = 0; i < atoms.length; i++) {
        if (atoms[i].element !== 'O') continue
        const d = Math.hypot(
          atoms[i].x - site.oxygen[0],
          atoms[i].y - site.oxygen[1],
          atoms[i].z - site.oxygen[2],
        )
        if (d < bestD) {
          bestD = d
          oIndex = i
        }
      }
      return { oIndex, siteIndex }
    }).filter((p) => p.oIndex >= 0)
  }, [model])

  useEffect(() => {
    if (phase === 'hydrogen') elapsed.current = 0
  }, [phase])

  useFrame(({ clock }, dt) => {
    const { atoms, bonds, neighbors } = model
    const n = atoms.length
    const on = vibeOn && active && !reduced
    const t = clock.getElapsedTime()
    if (phase === 'hydrogen' && active && !reduced) elapsed.current += dt
    const protonT = capturing ? 99 : elapsed.current

    if (!on) {
      if (!rested.current) {
        for (let i = 0; i < n; i++) {
          const atom = atoms[i]
          const mesh = atomRefs.current[i]
          if (mesh) mesh.position.set(atom.x, atom.y, atom.z)
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
        rested.current = true
      }
      return
    }
    rested.current = false

    if (muteOf.current.length !== n) muteOf.current = new Float32Array(n)
    muteOf.current.fill(0)
    if (kind === 'damped') {
      for (const p of protonated) {
        const bind = protonBind(protonT, p.siteIndex)
        muteOf.current[p.oIndex] = Math.max(muteOf.current[p.oIndex], bind)
      }
    }
    const baseAmp = kind === 'damped' ? 0.05 : kind === 'stiff' ? 0.11 : 0.14
    const baseHz = kind === 'damped' ? 0.68 : kind === 'stiff' ? 1.32 : 1.05

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
          const bondMute = muteOf.current[i] > muteOf.current[j] ? muteOf.current[i] : muteOf.current[j]
          const amp = baseAmp * (1 - 0.94 * bondMute)
          const local = kind === 'damped' ? i * 2.41 + j * 0.73 : 0
          const hz = kind === 'damped' ? baseHz + ((i * 17 + j * 9) % 13) * 0.13 : baseHz
          const s = Math.sin(t * Math.PI * 2 * hz + local) * amp
          const w = atom.element === 'Mn' ? 0.35 : 1
          dx += ux * s * w
          dy += uy * s * w
          dz += uz * s * w
          if (kind === 'damped' && bondMute < 0.2) {
            const px = uy * 0.55 - uz * 0.35
            const py = uz * 0.55 - ux * 0.35
            const pz = ux * 0.55 - uy * 0.35
            const plen = Math.hypot(px, py, pz) || 1
            const jitter = Math.sin(t * Math.PI * 2 * (hz + 0.41) + i * 1.9) * amp * 0.45
            dx += (px / plen) * jitter * w
            dy += (py / plen) * jitter * w
            dz += (pz / plen) * jitter * w
          }
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
          <sphereGeometry args={[atom.element === 'Mn' ? ATOM_DRAW.Mn : ATOM_DRAW.O, 14, 14]} />
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
  // Voids beat: channels + Mn/O; mesh is open at cell faces (no cubic shell).
  const showBalls = !showCubane
  const heroCubane = data.cubanes[0] as CubaneData
  const controls = useRef<{ enabled: boolean; target: THREE.Vector3 } | null>(null)

  useFrame((_, dt) => {
    const root = group.current
    if (controls.current) {
      controls.current.enabled = !ride.current.following
      if (ride.current.wide) controls.current.target.set(0, 0, 0)
    }
    if (!root || !active || reduced) return
    root.rotation.y += dt * (cubaneFocus ? 0.12 : 0.08)
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={cubaneFocus ? 0.4 : poreView ? 0.5 : 0.55} />
      <directionalLight
        position={[6, 8, 4]}
        intensity={cubaneFocus ? 1.55 : poreView ? 1.2 : 1.15}
        color="#fff3dc"
      />
      <directionalLight
        position={[-4, 2, -6]}
        intensity={cubaneFocus ? 0.5 : poreView ? 0.7 : 0.35}
        color="#9ec4d4"
      />
      {cubaneFocus && <directionalLight position={[2, -4, 5]} intensity={0.3} color="#f0c878" />}
      {poreView && <pointLight position={[0, 0, 0]} intensity={0.35} color="#b8d4e4" distance={9} />}
      <group ref={group} scale={SCALE}>
        {!cubaneFocus && <CellWire size={CELL_A} opacity={poreView ? 0.2 : 0.28} />}
        {showBalls && <VibratingCell phase={phase} vibeOn={vibeOn} active={active} reduced={reduced} />}
        {showVoids && <VoidSurface pore={poreView} />}
        {exchange && (
          <ExchangeIons
            phase={phase}
            active={active}
            reduced={reduced}
            scale={SCALE}
            ride={ride}
            vibeOn={vibeOn}
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
  onRideUi,
}: {
  phase: Phase
  ride: MutableRefObject<RideState>
  onRideUi?: (ui: { pullable: boolean; flashing: boolean }) => void
}) {
  const prev = useRef<Phase | null>(null)
  const look = useRef(new THREE.Vector3())
  const uiKey = useRef('')
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

  useFrame(({ camera }, dt) => {
    const r = ride.current
    if (onRideUi) {
      const key = `${r.pullable ? 1 : 0}|${r.flash > 0.16 ? 1 : 0}`
      if (key !== uiKey.current) {
        uiKey.current = key
        onRideUi({ pullable: r.pullable, flashing: r.flash > 0.16 })
      }
    }

    if (prev.current === phase) return
    // lattice → voids → H → Li share one orbit. Homing here is the snap.
    if (isCellPhase(prev.current) && isCellPhase(phase)) {
      prev.current = phase
      return
    }
    const targetPos = phase === 'cubane' ? cubaneHome : HOME
    const targetLook = phase === 'cubane' ? cubaneTarget : LOOK_ORIGIN
    camera.position.lerp(targetPos, 0.12)
    camera.lookAt(targetLook)
    look.current.copy(targetLook)
    const persp = camera as THREE.PerspectiveCamera
    if (Math.abs(persp.fov - 40) > 0.05) {
      persp.fov = THREE.MathUtils.damp(persp.fov, 40, 1.4, dt)
      persp.updateProjectionMatrix()
    }
    if (camera.position.distanceTo(targetPos) < 0.08) {
      camera.position.copy(targetPos)
      persp.fov = 40
      persp.updateProjectionMatrix()
      prev.current = phase
    }
  })
  return null
}

function lorentzPath(
  center: number,
  fwhm: number,
  amp: number,
  w0: number,
  w1: number,
  baseY: number,
  peakScale: number,
) {
  const pts: string[] = []
  const n = 100
  const gamma = Math.max(2.4, fwhm * 0.5)
  for (let i = 0; i <= n; i++) {
    const w = w0 + (i / n) * (w1 - w0)
    const dw = w - center
    const y = amp / (1 + (dw * dw) / (gamma * gamma))
    const x = 8 + ((w - w0) / (w1 - w0)) * 284
    const yy = baseY - y * peakScale
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yy.toFixed(1)}`)
  }
  return pts.join(' ')
}

function RamanTrack({
  phase,
  active,
  beatId,
}: {
  phase: Phase
  active: boolean
  beatId?: string
}) {
  const [elapsed, setElapsed] = useState(0)
  const t0 = useRef(performance.now())

  useEffect(() => {
    t0.current = performance.now()
    setElapsed(0)
  }, [beatId])

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
  }, [active, beatId])

  const track = useMemo(() => {
    const kind = vibeKind(phase)
    if (phase === 'hydrogen' || phase === 'lithium') {
      if (elapsed < LI_RAMAN_AT) {
        const u = Math.min(1, elapsed / 4.8)
        const ease = u * u * (3 - 2 * u)
        return {
          w: SYNTH_W + (H_W - SYNTH_W) * ease,
          fwhm: SYNTH_FWHM + (H_FWHM - SYNTH_FWHM) * ease,
          amp: 1 - (1 - H_AMP) * ease,
          label: ease < 0.4 ? 'H in · A₁g softening' : 'H-exchange · A₁g broad −50%, −20 cm⁻¹',
          mode: 'OH dominates · MnO disordered',
          kind: 'damped' as const,
        }
      }
      const u = Math.min(1, (elapsed - LI_RAMAN_AT) / LI_RAMAN)
      const ease = u * u * (3 - 2 * u)
      return {
        w: H_W + (LI_W - H_W) * ease,
        fwhm: H_FWHM + (LI_FWHM - H_FWHM) * ease,
        amp: H_AMP + (1 - H_AMP) * ease,
        label: ease < 0.45 ? 'Li → 8a · A₁g walking up' : 'Li in 8a · A₁g sharp',
        mode: 'MnO₆ A₁g · stiffer',
        kind: 'stiff' as const,
      }
    }
    if (phase === 'cubane') {
      return {
        w: SYNTH_W,
        fwhm: SYNTH_FWHM,
        amp: 1,
        label: 'A₁g cubane stretch',
        mode: 'Mn₄O₄ breathe',
        kind,
      }
    }
    return {
      w: SYNTH_W,
      fwhm: SYNTH_FWHM,
      amp: 1,
      label: 'As-synth · A₁g on',
      mode: 'MnO₆ A₁g · in phase',
      kind,
    }
  }, [phase, elapsed])

  const tight = phase === 'framework' || phase === 'voids' || phase === 'hydrogen' || phase === 'lithium'
  const w0 = tight ? 600 : 500
  const w1 = tight ? 700 : 780
  const vbH = tight ? 108 : 64
  const baseY = tight ? 88 : 52
  // Fixed scale so track.amp is a true intensity multiplier (H-form = 50% of as-synth).
  const peakScale = tight ? 80 : 40
  const path = lorentzPath(track.w, track.fwhm, track.amp, w0, w1, baseY, peakScale)
  const collapsed = track.amp < 0.2
  const peakX = 8 + ((track.w - w0) / (w1 - w0)) * 284

  return (
    <div
      className={styles.ramanHud}
      data-dock={tight ? 'left' : undefined}
      data-tight={tight || undefined}
      data-bare={phase === 'hydrogen' || phase === 'lithium' ? '' : undefined}
      aria-hidden
    >
      <div className={styles.ramanHudTitle}>Raman · A₁g</div>
      <svg viewBox={`0 0 300 ${vbH}`} className={styles.ramanHudSvg}>
        <path d={path} fill="none" stroke={collapsed ? C_RAMAN_DIM : C_RAMAN} strokeWidth="2" strokeLinecap="round" />
        <line
          x1={peakX}
          y1={tight ? 8 : 10}
          x2={peakX}
          y2={baseY}
          stroke={collapsed ? C_RAMAN_DIM : C_RAMAN}
          strokeWidth="1"
          opacity="0.35"
        />
        <text x="8" y={vbH - 2} fill="currentColor" fontSize="9" opacity="0.55">
          {w0}
        </text>
        <text x="268" y={vbH - 2} fill="currentColor" fontSize="9" opacity="0.55">
          {w1}
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
  const beatId = scene.beat?.id
  const basePhase = phaseForBeat(beatId)
  const [phase, setPhase] = useState(basePhase)

  useEffect(() => {
    if (beatId !== '8a') {
      setPhase(basePhase)
      return
    }
    setPhase('hydrogen')
    if (!active) return
    const id = window.setTimeout(() => setPhase('lithium'), H_TO_LI * 1000)
    return () => window.clearTimeout(id)
  }, [active, basePhase, beatId])
  const [vibeOn, setVibeOn] = useState(false)
  const [rideUi, setRideUi] = useState({ pullable: false, flashing: false })
  const [flashOn, setFlashOn] = useState(false)
  const ride = useRef<RideState>({
    following: false,
    done: false,
    pull: false,
    wide: false,
    pullable: false,
    flash: 0,
    fov: 40,
    stage: 'idle',
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
  })
  const vibrations = vibeOn && !reduced

  useEffect(() => {
    setRideUi({ pullable: false, flashing: false })
    setFlashOn(false)
  }, [phase])

  useEffect(() => {
    if (!rideUi.flashing) return
    setFlashOn(true)
    const id = window.setTimeout(() => setFlashOn(false), 780)
    return () => window.clearTimeout(id)
  }, [rideUi.flashing])

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
            { color: VOID_OUT, label: 'outer' },
            { color: VOID_IN, label: 'inner' },
          ]
        : phase === 'hydrogen' || phase === 'lithium'
          ? [
              { color: MN_COLOR, label: 'Mn' },
              { color: O_COLOR, label: 'O' },
              { color: H_COLOR, label: 'H' },
              { color: OH_COLOR, label: 'OH' },
              { color: LI_COLOR, label: 'Li' },
            ]
          : [
              { color: MN_COLOR, label: 'Mn' },
              { color: O_COLOR, label: 'O' },
            ]

  return (
    <div
      className={styles.crystal}
      aria-label={label || 'LMO spinel — MnO₆ framework, voids, and A1g cubane'}
    >
      <div className={styles.crystalBtns}>
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
      </div>
      <div className={styles.liFlash} data-on={flashOn || undefined} aria-hidden />
      <div className={styles.legend}>
        {legend.map((row) => (
          <div key={row.label} className={styles.legendRow}>
            <span className={styles.swatch} style={{ background: row.color }} />
            {row.label}
          </div>
        ))}
      </div>
      <Canvas
        dpr={STRUCTURE_DPR}
        camera={{ position: HOME.toArray(), fov: 40 }}
        gl={{ ...STRUCTURE_GL, localClippingEnabled: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <CameraHome phase={phase} ride={ride} onRideUi={setRideUi} />
          <Scene active={active} phase={phase} ride={ride} vibeOn={vibrations} />
        </Suspense>
      </Canvas>
      {(phase === 'hydrogen' || phase === 'lithium' || phase === 'cubane') && (
        <RamanTrack phase={phase} active={active} beatId={beatId} />
      )}
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
