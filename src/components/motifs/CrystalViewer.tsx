import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import structure from '../../data/lokelmaAtoms.json'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import {
  CELL_SHRUNK,
  K_HELD,
  buildExchangeSites,
  buildPoreWindows,
  flashAt,
  hydroxylAt,
  phaseForBeat,
  sampleExchange,
  sampleHEntry,
  samplePore,
  type CrystalPhase,
  type ExchangeAnim,
  type Hydroxyl,
  type PoreWindow,
  type Vec3,
} from '../../lib/lokelmaExchange'
import styles from './Motifs.module.css'

const K_COLOR = '#f0c878'
const H_COLOR = '#e8f2f6'
const SCALE = 0.4
const PHASES: CrystalPhase[] = ['k', 'h-point', 'exchange', 'locked']

const LEGEND = [
  { color: '#8a9aa8', label: 'Zr' },
  { color: '#7ec4d4', label: 'Si' },
  { color: '#c8c0b4', label: 'O' },
  { color: K_COLOR, label: 'K⁺' },
  { color: H_COLOR, label: 'H' },
] as const

const CAPTION: Record<CrystalPhase, string> = {
  k: 'ZS-9 · K⁺ in the channels · drag to orbit',
  pore: 'ZS-9 · ~3 Å 7-ring · drag to orbit',
  'h-point': 'H in · the cell contracts',
  exchange: 'H out · the cell opens · K locks',
  locked: 'K locked · cell restored',
}

const PORE_COLOR = '#f3cc7a'
const PORE_FREE = 1.5

function scaled(p: Vec3): Vec3 {
  return [p[0] * SCALE, p[1] * SCALE, p[2] * SCALE]
}

function Bond({ a, b }: { a: Vec3; b: Vec3 }) {
  const mid = useMemo(() => {
    const A = new THREE.Vector3(...a)
    const B = new THREE.Vector3(...b)
    const dir = new THREE.Vector3().subVectors(B, A)
    const length = dir.length()
    const quat = new THREE.Quaternion()
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    return { length, quat, pos: A.clone().add(B).multiplyScalar(0.5) }
  }, [a, b])
  return (
    <mesh position={mid.pos.toArray()} quaternion={mid.quat}>
      <cylinderGeometry args={[0.028, 0.028, mid.length, 6]} />
      <meshStandardMaterial color="#6a645c" roughness={0.7} metalness={0.1} />
    </mesh>
  )
}

function CellWire({
  size,
  anim,
}: {
  size: number
  anim: MutableRefObject<ExchangeAnim>
}) {
  const group = useRef<THREE.Group>(null)
  const edges = useMemo(() => {
    const h = size / 2
    const c: Vec3[] = [
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
    return pairs.map(([i, j]) => [c[i], c[j]] as [Vec3, Vec3])
  }, [size])

  useFrame(() => {
    const root = group.current
    if (!root) return
    const glow = anim.current.cellGlow
    const opacity = 0.22 + glow * 0.52
    const width = 1.05 + glow * 1.45
    for (const child of root.children) {
      const mat = (child as THREE.Object3D & { material?: { opacity: number; linewidth: number } })
        .material
      if (!mat) continue
      mat.opacity = opacity
      mat.linewidth = width
    }
  })

  return (
    <group ref={group}>
      {edges.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#e4b45a"
          lineWidth={1.05}
          transparent
          opacity={0.28}
        />
      ))}
    </group>
  )
}

function alignBond(mesh: THREE.Mesh, a: Vec3, b: Vec3) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const dir = new THREE.Vector3().subVectors(B, A)
  const length = dir.length()
  mesh.position.copy(A.clone().add(B).multiplyScalar(0.5))
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  mesh.scale.set(1, length, 1)
}

function Hydroxyls({
  sites,
  anim,
}: {
  sites: Hydroxyl[]
  anim: MutableRefObject<ExchangeAnim>
}) {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const root = group.current
    if (!root) return
    const { hMix, hOp } = anim.current
    root.visible = hOp > 0.02
    sites.forEach((site, i) => {
      const pair = root.children[i] as THREE.Group | undefined
      const atom = pair?.children[0] as THREE.Mesh | undefined
      const bond = pair?.children[1] as THREE.Mesh | undefined
      if (!atom || !bond) return
      const h = scaled(hydroxylAt(site, hMix))
      atom.position.set(...h)
      const mat = atom.material as THREE.MeshStandardMaterial
      mat.opacity = hOp
      mat.emissiveIntensity = 0.7 * hOp
      alignBond(bond, scaled(site.oxygen), h)
      const bondMat = bond.material as THREE.MeshStandardMaterial
      bondMat.opacity = hOp * 0.85
    })
  })

  return (
    <group ref={group} visible={false}>
      {sites.map((site) => (
        <group key={site.id}>
          <mesh position={scaled(site.point)}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial
              color={H_COLOR}
              roughness={0.25}
              metalness={0.05}
              emissive={H_COLOR}
              emissiveIntensity={0.7}
              transparent
              opacity={1}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.016, 0.016, 1, 6]} />
            <meshStandardMaterial
              color="#c5d4dc"
              roughness={0.45}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function ExchangeFlashes({
  sites,
  anim,
}: {
  sites: Hydroxyl[]
  anim: MutableRefObject<ExchangeAnim>
}) {
  const group = useRef<THREE.Group>(null)
  const mids = useMemo(() => sites.map((site) => scaled(flashAt(site))), [sites])

  useFrame(() => {
    const root = group.current
    if (!root) return
    const flash = anim.current.flash
    root.visible = flash > 0.02
    const grow = 0.55 + flash * 1.2
    for (const child of root.children) {
      const pair = child as THREE.Group
      for (const node of pair.children) {
        const mesh = node as THREE.Mesh
        const mat = mesh.material as THREE.MeshBasicMaterial
        const gain = (mesh.userData.gain as number | undefined) ?? 1
        const scale = (mesh.userData.scale as number | undefined) ?? 1
        mat.opacity = flash * gain
        mesh.scale.setScalar(grow * scale)
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      {mids.map((pos, i) => (
        <group key={sites[i].id} position={pos}>
          <mesh userData={{ gain: 1, scale: 1 }}>
            <sphereGeometry args={[0.065, 12, 12]} />
            <meshBasicMaterial
              color="#fff6d0"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh userData={{ gain: 0.32, scale: 2.35 }}>
            <sphereGeometry args={[0.065, 12, 12]} />
            <meshBasicMaterial
              color={K_COLOR}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function PotassiumSites({
  atoms,
  anim,
}: {
  atoms: { id: number; x: number; y: number; z: number; radius: number }[]
  anim: MutableRefObject<ExchangeAnim>
}) {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const root = group.current
    if (!root) return
    const { kOp, kLock } = anim.current
    root.visible = kOp > 0.02
    for (const child of root.children) {
      const mesh = child as THREE.Mesh
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.opacity = kOp
      mat.emissiveIntensity = (0.55 + kLock * 0.45) * kOp
      const base = (mesh.userData.radius as number) * (1 + kLock * 0.08)
      mesh.scale.setScalar(base)
    }
  })

  return (
    <group ref={group}>
      {atoms.map((atom) => (
        <mesh
          key={atom.id}
          userData={{ radius: atom.radius * 1.08 }}
          position={[atom.x * SCALE, atom.y * SCALE, atom.z * SCALE]}
          scale={atom.radius * 1.08}
        >
          <sphereGeometry args={[1, 20, 20]} />
          <meshStandardMaterial
            color={K_COLOR}
            roughness={0.22}
            metalness={0.55}
            emissive={K_COLOR}
            emissiveIntensity={0.55}
            transparent
            opacity={1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function circlePoints(center: Vec3, normal: Vec3, radius: number, steps = 48): Vec3[] {
  const n = new THREE.Vector3(...normal)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
  const pts: Vec3[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const p = new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0)
    p.applyQuaternion(q)
    pts.push([center[0] + p.x, center[1] + p.y, center[2] + p.z])
  }
  return pts
}

function PoreWindows({
  windows,
  anim,
}: {
  windows: PoreWindow[]
  anim: MutableRefObject<ExchangeAnim>
}) {
  const group = useRef<THREE.Group>(null)
  const loops = useMemo(
    () =>
      windows.map((w) => {
        const center = scaled(w.center)
        const aperture = circlePoints(center, w.normal, PORE_FREE * SCALE)
        const window = [...w.oxygens.map(scaled), scaled(w.oxygens[0])]
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(...w.normal),
        )
        return { id: w.id, center, quat, aperture, window, oxygens: w.oxygens.map(scaled) }
      }),
    [windows],
  )

  useFrame((state) => {
    const root = group.current
    if (!root) return
    const { poreOp } = anim.current
    root.visible = poreOp > 0.02
    const pulse = 0.82 + 0.18 * Math.sin(state.clock.elapsedTime * 2.1)
    const op = poreOp * pulse
    for (const child of root.children) {
      const ring = child as THREE.Group
      for (const node of ring.children) {
        const mesh = node as THREE.Mesh & { material?: THREE.Material | THREE.Material[] }
        const mat = mesh.material
        if (!mat || Array.isArray(mat)) continue
        if ('opacity' in mat) {
          const base = (mesh.userData.opacity as number | undefined) ?? 1
          mat.opacity = base * op
        }
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissiveIntensity = ((mesh.userData.emissive as number | undefined) ?? 0.8) * op
        }
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      {loops.map((loop) => (
        <group key={loop.id}>
          <Line
            points={loop.aperture}
            color={PORE_COLOR}
            lineWidth={2.4}
            transparent
            opacity={0.95}
            userData={{ opacity: 0.95 }}
          />
          <Line
            points={loop.window}
            color={PORE_COLOR}
            lineWidth={1.45}
            transparent
            opacity={0.7}
            userData={{ opacity: 0.7 }}
          />
          <mesh position={loop.center} quaternion={loop.quat} userData={{ opacity: 0.16 }}>
            <circleGeometry args={[PORE_FREE * SCALE, 32]} />
            <meshBasicMaterial
              color={PORE_COLOR}
              transparent
              opacity={0.16}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {loop.oxygens.map((pos, i) => (
            <mesh key={i} position={pos} userData={{ opacity: 0.95, emissive: 1.15 }}>
              <sphereGeometry args={[0.085, 12, 12]} />
              <meshStandardMaterial
                color={PORE_COLOR}
                emissive={PORE_COLOR}
                emissiveIntensity={1.15}
                roughness={0.28}
                transparent
                opacity={0.95}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

const REST: ExchangeAnim = {
  hMix: 0,
  hOp: 0,
  kOp: 1,
  kLock: 0,
  cellScale: 1,
  cellGlow: 0,
  poreOp: 0,
  flash: 0,
}

const PORE_HELD: ExchangeAnim = {
  hMix: 0,
  hOp: 0,
  kOp: 0.12,
  kLock: 0,
  cellScale: 1,
  cellGlow: 0.22,
  poreOp: 1,
  flash: 0,
}

const HELD: ExchangeAnim = {
  hMix: 0,
  hOp: 1,
  kOp: K_HELD,
  kLock: 0,
  cellScale: CELL_SHRUNK,
  cellGlow: 1,
  poreOp: 0,
  flash: 0,
}

const LOCKED: ExchangeAnim = {
  hMix: 2,
  hOp: 0,
  kOp: 1,
  kLock: 1,
  cellScale: 1,
  cellGlow: 0,
  poreOp: 0,
  flash: 0,
}

function applyPhase(
  phase: CrystalPhase,
  progress: number,
  reduced: boolean,
  kStart = 1,
): ExchangeAnim {
  if (phase === 'k') return REST
  if (phase === 'pore') return reduced ? PORE_HELD : samplePore(progress)
  if (phase === 'h-point') return reduced ? HELD : sampleHEntry(progress, kStart)
  if (phase === 'locked' || (phase === 'exchange' && reduced)) return LOCKED
  return sampleExchange(progress)
}

function Scene({ active, phase }: { active: boolean; phase: CrystalPhase }) {
  const group = useRef<THREE.Group>(null)
  const prevPhase = useRef(phase)
  const kStart = useRef(1)
  const progress = useRef(phase === 'locked' || phase === 'k' ? 1 : 0)
  const anim = useRef<ExchangeAnim>(applyPhase(phase, progress.current, false))
  const reduced = usePrefersReducedMotion()
  const atoms = structure.atoms
  const bonds = structure.bonds as [number, number][]
  const framework = useMemo(() => atoms.filter((atom) => atom.element !== 'K'), [atoms])
  const kAtoms = useMemo(() => atoms.filter((atom) => atom.element === 'K'), [atoms])
  const sites = useMemo(() => buildExchangeSites(atoms), [atoms])
  const pores = useMemo(() => buildPoreWindows(atoms, bonds), [atoms, bonds])

  useEffect(() => {
    kStart.current = phase === 'h-point' && prevPhase.current === 'pore' ? 0.12 : 1
    const live = (phase === 'pore' || phase === 'h-point' || phase === 'exchange') && !reduced
    progress.current = live ? 0 : 1
    anim.current = applyPhase(phase, progress.current, reduced, kStart.current)
    prevPhase.current = phase
  }, [phase, reduced])

  useFrame((_, dt) => {
    const root = group.current
    if (root && !reduced && active) {
      root.rotation.y += dt * 0.1
    }
    const live = (phase === 'pore' || phase === 'h-point' || phase === 'exchange') && !reduced
    if (live && progress.current < 1) {
      const dur = phase === 'exchange' ? 5.2 : phase === 'pore' ? 1.85 : 1.65
      progress.current = Math.min(1, progress.current + dt / dur)
    }
    anim.current = applyPhase(phase, progress.current, reduced, kStart.current)
    if (root) {
      const s = anim.current.cellScale
      root.scale.setScalar(s)
    }
  })

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 8, 4]} intensity={1.15} />
      <directionalLight position={[-4, -2, -6]} intensity={0.32} />
      <pointLight
        position={[0, 0.4, 2.2]}
        intensity={phase === 'h-point' || phase === 'exchange' ? 0.85 : 1.15}
        color={phase === 'h-point' || phase === 'exchange' ? H_COLOR : PORE_COLOR}
        distance={14}
      />
      <group ref={group}>
        <CellWire size={structure.cell.a * SCALE} anim={anim} />
        {bonds.map(([i, j]) => {
          const A = atoms[i]
          const B = atoms[j]
          if (!A || !B) return null
          return (
            <Bond
              key={`${i}-${j}`}
              a={[A.x * SCALE, A.y * SCALE, A.z * SCALE]}
              b={[B.x * SCALE, B.y * SCALE, B.z * SCALE]}
            />
          )
        })}
        {framework.map((atom) => (
          <mesh key={atom.id} position={[atom.x * SCALE, atom.y * SCALE, atom.z * SCALE]}>
            <sphereGeometry args={[atom.radius * 0.92, 14, 14]} />
            <meshStandardMaterial
              color={atom.color}
              roughness={0.4}
              metalness={atom.element === 'Zr' ? 0.45 : 0.12}
            />
          </mesh>
        ))}
        <PotassiumSites atoms={kAtoms} anim={anim} />
        <PoreWindows windows={pores} anim={anim} />
        <Hydroxyls sites={sites.hydroxyls} anim={anim} />
        <ExchangeFlashes sites={sites.hydroxyls} anim={anim} />
      </group>
      <OrbitControls enablePan={false} enableZoom={false} makeDefault />
    </>
  )
}

export function CrystalViewer({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const beatPhase = phaseForBeat(scene.beat?.id)
  const [override, setOverride] = useState<CrystalPhase | null>(null)

  useEffect(() => {
    setOverride(null)
  }, [scene.beat?.id])

  useEffect(() => {
    if (!active) {
      setOverride(null)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'h' && e.key !== 'H') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      e.preventDefault()
      e.stopPropagation()
      setOverride((current) => {
        const now = current ?? beatPhase
        return PHASES[(PHASES.indexOf(now) + 1) % PHASES.length]
      })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, beatPhase])

  const phase = override ?? beatPhase
  const showH = phase === 'h-point' || phase === 'exchange'
  const legend =
    phase === 'pore'
      ? [...LEGEND.filter((row) => row.label !== 'K⁺' && row.label !== 'H'), { color: PORE_COLOR, label: '3 Å' }]
      : showH
        ? LEGEND
        : LEGEND.filter((row) => row.label !== 'H')

  return (
    <div className={styles.crystal} aria-label={label || CAPTION[phase]}>
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
        camera={{ position: [3.2, 1.6, 9.2], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene active={active} phase={phase} />
        </Suspense>
      </Canvas>
      <div className={styles.crystalCaption}>{CAPTION[phase]}</div>
    </div>
  )
}
