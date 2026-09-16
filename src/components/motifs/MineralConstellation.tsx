import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, Html, OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import { useSlideNav } from '../../hooks/useSlideNav'
import { STRUCTURE_DPR, STRUCTURE_GL_OPAQUE } from '../../lib/structureCanvas'
import data from '../../data/mineralConstellation.json'
import { slides } from '../../data/slides'
import styles from './Motifs.module.css'

type Tier = 'hero' | 'peer' | 'field'
type Domain = keyof typeof data.domains
type Habit =
  | 'cube'
  | 'octa'
  | 'dodeca'
  | 'hexprism'
  | 'needle'
  | 'ortho'
  | 'tetra'
  | 'bipyramid'
  | 'rhombo'

type Mineral = {
  id: string
  name: string
  apps: string[]
  domain: Domain
  tier: Tier
  x: number
  y: number
  named?: number
  afterlife?: string
}

type Phase =
  | 'peri'
  | 'peers'
  | 'sky'
  | 'reveal'
  | 'cabinets'
  | 'instrument'
  | 'turn'
  | 'dive'
  | 'return'
  | 'case-spinel'
  | 'case-fringe'
  | 'beyond'
  | 'thanks'

type Body = Mineral & {
  pos: THREE.Vector3
  color: string
  habit: Habit
  scale: number
}

const minerals = data.minerals as Mineral[]
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const TMP = new THREE.Vector3()

/** Lokelma teachers + rowleyite — rim of the known materials sky. */
const FRINGE_IDS = new Set(['rowleyite', 'sitinakite', 'georgechaoite', 'umbite', 'zorite'])

function closeSkyPhase(phase: Phase) {
  return (
    phase === 'return' ||
    phase === 'case-spinel' ||
    phase === 'case-fringe' ||
    phase === 'beyond' ||
    phase === 'thanks'
  )
}

function litIdsForPhase(phase: Phase): Set<string> | null {
  if (phase === 'case-spinel') return new Set(['spinel'])
  if (phase === 'case-fringe') return FRINGE_IDS
  if (phase === 'beyond' || phase === 'thanks') {
    return new Set(['spinel', ...FRINGE_IDS])
  }
  return null
}

const HABIT_BY_ID: Record<string, Habit> = {
  perovskite: 'cube',
  zeolite: 'hexprism',
  olivine: 'ortho',
  fluorite: 'cube',
  garnet: 'dodeca',
  stibnite: 'needle',
  quartz: 'hexprism',
  corundum: 'hexprism',
  beryl: 'hexprism',
  diamond: 'octa',
  spinel: 'octa',
  magnetite: 'octa',
  pyrite: 'cube',
  halite: 'cube',
  calcite: 'rhombo',
  dolomite: 'rhombo',
  tourmaline: 'hexprism',
  apatite: 'hexprism',
  topaz: 'ortho',
  gypsum: 'ortho',
  barite: 'ortho',
  rutile: 'needle',
  graphite: 'hexprism',
  mica: 'ortho',
  rowleyite: 'dodeca',
}

const HABIT_BY_DOMAIN: Record<Domain, Habit> = {
  energy: 'cube',
  medicine: 'hexprism',
  optics: 'octa',
  sieves: 'hexprism',
  electronics: 'octa',
  structural: 'ortho',
  other: 'tetra',
}

function phaseForBeat(id?: string): Phase {
  if (id === 'peers') return 'peers'
  if (id === 'sky') return 'sky'
  if (id === 'reveal') return 'reveal'
  if (id === 'cabinets') return 'cabinets'
  if (id === 'instrument') return 'instrument'
  if (id === 'turn') return 'turn'
  if (id === 'dive') return 'dive'
  if (id === 'return') return 'return'
  if (id === 'spinel') return 'case-spinel'
  if (id === 'fringe') return 'case-fringe'
  if (id === 'beyond') return 'beyond'
  if (id === 'thanks') return 'thanks'
  return 'peri'
}

function inHallPhase(phase: Phase) {
  return (
    phase === 'reveal' ||
    phase === 'cabinets' ||
    phase === 'instrument' ||
    phase === 'turn' ||
    phase === 'dive'
  )
}

function skyVisiblePhase(phase: Phase) {
  // Open: constellation through sky + reveal fade. Close: full sky bookend.
  return (
    phase === 'peri' ||
    phase === 'peers' ||
    phase === 'sky' ||
    phase === 'reveal' ||
    closeSkyPhase(phase)
  )
}

function hash01(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

function habitFor(m: Mineral): Habit {
  return HABIT_BY_ID[m.id] ?? HABIT_BY_DOMAIN[m.domain] ?? 'octa'
}

function toWorld(m: Mineral): THREE.Vector3 {
  // Flatten museum map into a shallow celestial disc with depth jitter
  const x = (m.x - 500) * 0.028
  const z = (m.y - 300) * 0.028
  const y = (hash01(m.id) - 0.5) * 3.4 + (m.tier === 'hero' ? 0.15 : 0)
  return new THREE.Vector3(x, y, z)
}

function buildBodies(): Body[] {
  return minerals.map((m) => {
    const scale = m.tier === 'hero' ? 0.42 : m.tier === 'peer' ? 0.26 : 0.09 + hash01(m.id + 's') * 0.05
    return {
      ...m,
      pos: toWorld(m),
      color: data.domains[m.domain],
      habit: habitFor(m),
      scale,
    }
  })
}

const BODIES = buildBodies()
const HERO = BODIES.find((b) => b.tier === 'hero') ?? BODIES[0]
const PEERS = BODIES.filter((b) => b.tier === 'peer' || b.tier === 'hero')
const SPINEL_BODY = BODIES.find((b) => b.id === 'spinel') ?? BODIES[0]
const FRINGE_BODIES = BODIES.filter((b) => FRINGE_IDS.has(b.id))
const FRINGE_CENTER = (() => {
  if (!FRINGE_BODIES.length) return new THREE.Vector3(12, 0.2, 7)
  const c = FRINGE_BODIES.reduce((acc, b) => acc.add(TMP.copy(b.pos)), new THREE.Vector3())
  return c.multiplyScalar(1 / FRINGE_BODIES.length)
})()
const FRINGE_OUT = (() => {
  const o = FRINGE_CENTER.clone()
  o.y = 0
  if (o.lengthSq() < 0.01) o.set(1, 0, 0.35)
  return o.normalize()
})()

function CrystalMesh({
  habit,
  color,
  emissive = 0.55,
}: {
  habit: Habit
  color: string
  emissive?: number
}) {
  const material = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={emissive}
      roughness={0.28}
      metalness={0.35}
      transparent
      opacity={0.92}
    />
  )
  if (habit === 'cube') {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        {material}
        <Edges color="#f3e2b8" threshold={15} lineWidth={1.35} />
      </mesh>
    )
  }
  if (habit === 'octa') {
    return (
      <mesh>
        <octahedronGeometry args={[0.72, 0]} />
        {material}
      </mesh>
    )
  }
  if (habit === 'dodeca') {
    return (
      <mesh>
        <dodecahedronGeometry args={[0.62, 0]} />
        {material}
      </mesh>
    )
  }
  if (habit === 'tetra') {
    return (
      <mesh>
        <tetrahedronGeometry args={[0.78, 0]} />
        {material}
      </mesh>
    )
  }
  if (habit === 'needle') {
    return (
      <mesh rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.12, 0.18, 1.6, 6]} />
        {material}
      </mesh>
    )
  }
  if (habit === 'ortho') {
    return (
      <mesh>
        <boxGeometry args={[0.7, 1.15, 0.55]} />
        {material}
      </mesh>
    )
  }
  if (habit === 'rhombo') {
    return (
      <mesh rotation={[0.55, 0.35, 0.2]}>
        <boxGeometry args={[0.85, 0.85, 0.85]} />
        {material}
      </mesh>
    )
  }
  if (habit === 'bipyramid') {
    return (
      <mesh>
        <octahedronGeometry args={[0.7, 0]} />
        {material}
      </mesh>
    )
  }
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.42, 0.42, 0.85, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          roughness={0.28}
          metalness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <coneGeometry args={[0.42, 0.35, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          roughness={0.28}
          metalness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.42, 0.35, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          roughness={0.28}
          metalness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
    </group>
  )
}

function labelDistanceFactor(phase: Phase, focused: boolean) {
  // Keep CSS scale near 1 so labels rasterize at their font size instead of
  // being blown up from 11px (drei Html uses transform: scale).
  if (focused) return 2.8
  if (phase === 'peri') return 1.9
  if (phase === 'peers') return 5.4
  if (closeSkyPhase(phase)) return 6.2
  return 9
}

function MoonSystem({
  apps,
  color,
  radius,
  showLabels,
  reduced,
  count,
  distanceFactor,
}: {
  apps: string[]
  color: string
  radius: number
  showLabels: boolean
  reduced: boolean
  count: number
  distanceFactor: number
}) {
  const group = useRef<THREE.Group>(null)
  const moons = useMemo(() => {
    const n = Math.max(count, apps.length)
    return Array.from({ length: n }, (_, i) => {
      const app = apps[i % apps.length]
      const u = hash01(`${app}-${i}`)
      const incl = (u - 0.5) * 0.9
      const phase = (i / n) * Math.PI * 2 + u
      const r = radius * (0.85 + u * 0.45)
      const speed = 0.18 + u * 0.35
      const size = 0.035 + (i % 3) * 0.012
      return { app, incl, phase, r, speed, size, label: i < apps.length }
    })
  }, [apps, count, radius])

  useFrame((_, dt) => {
    if (!group.current || reduced) return
    group.current.rotation.y += dt * 0.22
  })

  return (
    <group ref={group}>
      {moons.map((m, i) => {
        const x = Math.cos(m.phase) * m.r
        const z = Math.sin(m.phase) * m.r
        const y = Math.sin(m.phase * 1.7) * m.r * m.incl
        return (
          <group key={`${m.app}-${i}`} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[m.size, 12, 12]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={1.1}
                roughness={0.35}
              />
            </mesh>
            {/* soft halo */}
            <mesh>
              <sphereGeometry args={[m.size * 2.4, 10, 10]} />
              <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
            </mesh>
            {showLabels && m.label && (
              <Html
                center
                distanceFactor={distanceFactor}
                style={{ pointerEvents: 'none' }}
                wrapperClass={styles.constellationMoonLabel}
              >
                <span>{m.app}</span>
              </Html>
            )}
          </group>
        )
      })}
      {/* faint orbit rings */}
      {[0.92, 1.18].map((f, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.25, i * 0.4, 0]}>
          <torusGeometry args={[radius * f, 0.004, 6, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function MineralBody({
  body,
  phase,
  focused,
  reduced,
  lit,
  dimField,
  onSelect,
}: {
  body: Body
  phase: Phase
  focused: boolean
  reduced: boolean
  lit: boolean
  dimField: boolean
  onSelect: (id: string) => void
}) {
  const root = useRef<THREE.Group>(null)
  const isHero = body.tier === 'hero'
  const isPeer = body.tier === 'peer'
  const close = closeSkyPhase(phase)
  const inSky = phase === 'peri' || phase === 'peers' || phase === 'sky' || close
  // Reveal keeps sky look (labels + crystals) while the group fades — no nest shrink
  const fadingSky = phase === 'reveal'
  const skyLook = inSky || fadingSky

  const visible =
    fadingSky ||
    (inSky &&
      (focused ||
        lit ||
        isHero ||
        (isPeer && phase !== 'peri') ||
        phase === 'sky' ||
        phase === 'peers' ||
        close))

  const showMoons =
    skyLook &&
    (focused ||
      lit ||
      (phase === 'peri' && isHero) ||
      (phase === 'peers' && (isHero || isPeer)) ||
      ((phase === 'sky' || fadingSky) && (isHero || isPeer)) ||
      (phase === 'return' && (isHero || isPeer)))

  const moonCount =
    focused || isHero || lit
      ? Math.max(5, body.apps.length + 2)
      : isPeer
        ? Math.max(3, body.apps.length)
        : 3

  const showLabel =
    skyLook &&
    !(fadingSky && revealBlend > 0.38) &&
    (focused ||
      lit ||
      (phase === 'peri' && isHero) ||
      (phase === 'peers' && (isHero || isPeer)) ||
      ((phase === 'sky' || fadingSky) && (isHero || isPeer)) ||
      (phase === 'return' && (isHero || isPeer)))

  const showCrystal =
    fadingSky ||
    (inSky && (focused || lit || isHero || isPeer || phase === 'sky' || close))

  const scaleMul = focused
    ? 1.35
    : lit
      ? 1.28
      : dimField && !lit
        ? 0.82
        : 1
  const emissive = focused
    ? 0.95
    : lit
      ? phase === 'beyond' || phase === 'thanks'
        ? 0.55
        : 1.05
      : dimField
        ? 0.06
        : isHero
          ? 0.7
          : isPeer
            ? 0.55
            : 0.28

  useFrame((_, dt) => {
    if (!root.current || reduced || !visible) return
    root.current.rotation.y += dt * (isHero || lit ? 0.15 : isPeer ? 0.1 : 0.05)
  })

  if (!visible && body.tier === 'field' && phase === 'peri') return null

  return (
    <group
      ref={root}
      position={body.pos}
      scale={body.scale * scaleMul}
      visible={visible}
      onClick={(e) => {
        e.stopPropagation()
        if (phase === 'sky') onSelect(body.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (phase === 'sky') document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      {(isHero || isPeer || focused || lit) && (
        <mesh>
          <sphereGeometry args={[1.55, 16, 16]} />
          <meshBasicMaterial
            color={body.color}
            transparent
            opacity={lit ? 0.14 : 0.08}
            depthWrite={false}
          />
        </mesh>
      )}
      {showCrystal ? (
        <CrystalMesh habit={body.habit} color={body.color} emissive={emissive} />
      ) : (
        body.tier === 'field' &&
        phase === 'peers' && (
          <mesh>
            <sphereGeometry args={[0.45, 8, 8]} />
            <meshBasicMaterial color={body.color} transparent opacity={0.4} />
          </mesh>
        )
      )}
      {showMoons && (
        <MoonSystem
          apps={body.apps}
          color={body.color}
          radius={isHero || focused || lit ? 2.1 : isPeer ? 1.55 : 1.1}
          showLabels={Boolean(showMoons && (isHero || isPeer || focused || lit))}
          reduced={reduced}
          count={moonCount}
          distanceFactor={labelDistanceFactor(phase, focused || lit)}
        />
      )}
      {showLabel && (
        <Html
          position={[0, 1.55, 0]}
          center
          distanceFactor={labelDistanceFactor(phase, focused || lit)}
          style={{ pointerEvents: 'none' }}
          wrapperClass={styles.constellationNameLabel}
        >
          <div data-hero={isHero || focused || lit || undefined}>
            {isHero && phase === 'peri' && body.named ? <em>{body.named}</em> : null}
            <strong>{body.name}</strong>
            {lit && body.afterlife ? <em>{body.afterlife}</em> : null}
          </div>
        </Html>
      )}
    </group>
  )
}

function CabinetsRoom({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const show = inHallPhase(phase)
  const group = useRef<THREE.Group>(null)
  const appear = useRef(0)

  useFrame((_, dt) => {
    if (!group.current) return
    const target = show ? 1 : 0
    if (phase === 'reveal') {
      // Hall under the sky early so cutting constellation never leaves a black void
      const b = reduced ? 1 : revealBlend
      appear.current = reduced ? 1 : THREE.MathUtils.smoothstep(b, 0.08, 0.4)
    } else {
      appear.current = reduced
        ? target
        : THREE.MathUtils.damp(appear.current, target, 2.8, dt)
    }
    const next = appear.current
    group.current.scale.setScalar(Math.max(0.001, next))
    group.current.visible = next > 0.02
    group.current.position.y = THREE.MathUtils.lerp(-2.4, ROOM_Y, next)
  })

  const cabinets = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = []
    // Dense back wall — sells “hundreds” without new assets
    for (let i = 0; i < 11; i++) out.push({ x: -12.5 + i * 2.5, z: -6.5, rot: 0 })
    for (let i = 0; i < 9; i++) out.push({ x: -10 + i * 2.5, z: -9.2, rot: 0 })
    for (let i = 0; i < 4; i++) out.push({ x: -12.5, z: -5.2 + i * 2.8, rot: Math.PI / 2 })
    for (let i = 0; i < 4; i++) out.push({ x: 12.5, z: -5.2 + i * 2.8, rot: -Math.PI / 2 })
    return out
  }, [])

  const silhouette = phase === 'reveal'

  return (
    <group ref={group} position={[0, ROOM_Y, ROOM_Z]} scale={0.001} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[48, 32]} />
        <meshStandardMaterial color="#2a241c" roughness={0.9} metalness={0.04} />
      </mesh>
      {/* Same hall fill for reveal → cabinets so the beat handoff does not relight the room */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 8, 6]} intensity={1.15} color="#f5e6c8" />
      <pointLight position={[0, 5, 4]} intensity={1.4} color="#f2e0b4" distance={36} />
      <pointLight position={[-7, 3.5, 0]} intensity={0.7} color="#b8dfc8" distance={22} />
      <pointLight position={[7, 3.5, 0]} intensity={0.65} color="#e8c898" distance={22} />

      {cabinets.map((c, ci) => (
        <CabinetUnit
          key={ci}
          index={ci}
          x={c.x}
          z={c.z}
          rotY={c.rot}
          phase={phase}
          reduced={reduced}
          silhouette={silhouette && ci !== ENTRY_CABINET}
        />
      ))}
    </group>
  )
}

function CabinetUnit({
  index,
  x,
  z,
  rotY,
  phase,
  reduced,
  silhouette = false,
}: {
  index: number
  x: number
  z: number
  rotY: number
  phase: Phase
  reduced: boolean
  silhouette?: boolean
}) {
  const drawers = 6
  const isEntryCab = index === ENTRY_CABINET
  const isDiveCab = index === DIVE_CABINET
  const isBackRow = Math.abs(rotY) < 0.01 && z > -8
  const wood = '#4a3f32'
  const face = '#5a4c3c'

  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {/* carcass shell — open at the front */}
      <mesh position={[0, 1.55, -0.08]}>
        <boxGeometry args={[2.4, 3.1, 0.95]} />
        <meshStandardMaterial color={wood} roughness={0.72} metalness={0.08} />
      </mesh>
      {/* side walls */}
      <mesh position={[-1.18, 1.55, 0.35]}>
        <boxGeometry args={[0.06, 3.1, 0.85]} />
        <meshStandardMaterial color={wood} roughness={0.7} />
      </mesh>
      <mesh position={[1.18, 1.55, 0.35]}>
        <boxGeometry args={[0.06, 3.1, 0.85]} />
        <meshStandardMaterial color={wood} roughness={0.7} />
      </mesh>
      {/* top / bottom lips */}
      <mesh position={[0, 3.07, 0.35]}>
        <boxGeometry args={[2.4, 0.08, 0.85]} />
        <meshStandardMaterial color={face} roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.04, 0.35]}>
        <boxGeometry args={[2.4, 0.08, 0.85]} />
        <meshStandardMaterial color={face} roughness={0.55} metalness={0.1} />
      </mesh>
      {/* face rails between drawer slots */}
      {Array.from({ length: drawers + 1 }).map((_, ri) => (
        <mesh key={`rail-${ri}`} position={[0, 0.14 + ri * 0.48, 0.56]}>
          <boxGeometry args={[2.28, 0.04, 0.05]} />
          <meshStandardMaterial color={face} roughness={0.55} metalness={0.12} />
        </mesh>
      ))}
      {Array.from({ length: drawers }).map((_, di) => {
        const y = 0.35 + di * 0.48
        return (
          <Drawer
            key={di}
            y={y}
            drawerIndex={di}
            cabinetX={x}
            isEntry={isEntryCab && di === ENTRY_DRAWER}
            isDive={isDiveCab && di === DIVE_DRAWER}
            isBackRow={isBackRow}
            phase={phase}
            silhouette={silhouette}
            reduced={reduced}
            seed={index * 10 + di}
          />
        )
      })}
    </group>
  )
}

const COL_TRAY_CLOSED = new THREE.Color('#524536')
const COL_TRAY_OPEN = new THREE.Color('#5c4c3a')
const COL_TRAY_HI = new THREE.Color('#7a6548')
const COL_FRONT = new THREE.Color('#5f5140')
const COL_FRONT_HI = new THREE.Color('#8a7354')
const COL_EMISSIVE = new THREE.Color('#c4a06a')
const COL_EMISSIVE_HI = new THREE.Color('#e8b86a')
const COL_BLACK = new THREE.Color('#000000')

function Drawer({
  y,
  drawerIndex,
  cabinetX,
  isEntry,
  isDive,
  isBackRow,
  phase,
  silhouette,
  reduced,
  seed,
}: {
  y: number
  drawerIndex: number
  cabinetX: number
  isEntry: boolean
  isDive: boolean
  isBackRow: boolean
  phase: Phase
  silhouette: boolean
  reduced: boolean
  seed: number
}) {
  const ref = useRef<THREE.Group>(null)
  const fillRef = useRef<THREE.Group>(null)
  const pull = useRef(0)
  const trayMat = useRef<THREE.MeshStandardMaterial>(null)
  const sideMatL = useRef<THREE.MeshStandardMaterial>(null)
  const sideMatR = useRef<THREE.MeshStandardMaterial>(null)
  const backMat = useRef<THREE.MeshStandardMaterial>(null)
  const frontMat = useRef<THREE.MeshStandardMaterial>(null)
  const glowMat = useRef<THREE.MeshBasicMaterial>(null)
  const hiLightA = useRef<THREE.PointLight>(null)
  const hiLightB = useRef<THREE.PointLight>(null)
  const hiLightC = useRef<THREE.PointLight>(null)
  const surgeLight = useRef<THREE.PointLight>(null)
  const gemLight = useRef<THREE.PointLight>(null)
  const idle = useRef(false)

  const highlight =
    (isEntry && (phase === 'reveal' || phase === 'cabinets')) ||
    (isDive && (phase === 'instrument' || phase === 'turn' || phase === 'dive'))
  const spill = phase === 'reveal' && isEntry
  const surge = phase === 'dive' && isDive
  const glow = surge ? 1.7 : spill ? 1.15 : highlight && isDive ? 1.35 : 1
  /** Feature drawers keep crystals + lights; aisle-walk drawers stay emissive-only. */
  const featureFill = highlight

  useFrame((_, dt) => {
    if (!ref.current) return
    let want = false
    if (!silhouette) {
      if (phase === 'reveal' || phase === 'cabinets') {
        want = isEntry
      } else if (phase === 'instrument') {
        if (isDive) want = true
        else if (isBackRow && hallWalkActive) {
          // One drawer per nearby cabinet — avoids a cascade of lights/meshes mid-walk
          const near = Math.abs(cabinetX - hallWalkX) < 2.6
          want = near && drawerIndex === 2
        }
      } else if (phase === 'turn' || phase === 'dive') {
        want = isDive
      }
    }
    let target = want ? (highlight ? (spill ? 1.15 : 1.05) : 0.72) : 0
    if (spill) {
      // Already open so the zoom lands on a lit tray with specimens
      target = 1.15
      if (pull.current < target * 0.95) {
        pull.current = reduced ? target : Math.max(pull.current, target * 0.98)
      }
    }

    // Silhouette / closed drawers: skip material + light work once settled
    if (!want && pull.current < 0.001 && target < 0.001) {
      if (!idle.current) {
        pull.current = 0
        ref.current.position.z = 0.08
        if (fillRef.current) fillRef.current.visible = false
        idle.current = true
      }
      return
    }
    idle.current = false

    pull.current = reduced ? target : THREE.MathUtils.damp(pull.current, target, spill ? 2.8 : 2.6, dt)
    ref.current.position.z = 0.08 + pull.current

    const opened = pull.current > 0.06
    const amt = Math.min(1, pull.current / 0.72)

    if (trayMat.current) {
      trayMat.current.color.copy(highlight ? COL_TRAY_HI : opened ? COL_TRAY_OPEN : COL_TRAY_CLOSED)
      trayMat.current.emissive.copy(
        highlight ? COL_EMISSIVE_HI : opened ? COL_EMISSIVE : COL_BLACK,
      )
      trayMat.current.emissiveIntensity = (highlight ? 0.28 : opened ? 0.12 * amt : 0) * glow
    }
    const sideColor = highlight ? COL_TRAY_HI : opened ? COL_TRAY_OPEN : COL_TRAY_CLOSED
    sideMatL.current?.color.copy(sideColor)
    sideMatR.current?.color.copy(sideColor)
    backMat.current?.color.copy(sideColor)
    if (frontMat.current) {
      frontMat.current.color.copy(highlight ? COL_FRONT_HI : COL_FRONT)
      frontMat.current.emissive.copy(
        highlight ? COL_EMISSIVE_HI : opened ? COL_EMISSIVE : COL_BLACK,
      )
      frontMat.current.emissiveIntensity = (highlight ? 0.2 : opened ? 0.08 * amt : 0) * glow
    }

    if (fillRef.current) fillRef.current.visible = opened
    if (glowMat.current) {
      let glowOp = (highlight ? 0.12 : 0.1) * Math.min(1.15, glow) * amt
      if (spill) {
        const b = reduced ? 1 : revealBlend
        const washIn = THREE.MathUtils.smoothstep(b, 0.3, 0.75)
        glowOp *= THREE.MathUtils.lerp(0.2, 0.45, washIn)
      }
      glowMat.current.opacity = glowOp
    }
    // Walk drawers: no PointLights — emissive tray + plane only (instrument fps)
    if (hiLightA.current) {
      hiLightA.current.intensity = featureFill && opened ? (spill ? 1.05 : 3.2) * glow * amt : 0
      hiLightA.current.visible = featureFill && opened
    }
    if (hiLightB.current) {
      let hiB = featureFill && opened ? (spill ? 1.1 : 2.4) * glow * amt : 0
      if (spill && hiB > 0) {
        const b = reduced ? 1 : revealBlend
        const washIn = THREE.MathUtils.smoothstep(b, 0.25, 0.7)
        hiB *= THREE.MathUtils.lerp(0.45, 1, washIn)
      }
      hiLightB.current.intensity = hiB
      hiLightB.current.visible = featureFill && opened
    }
    if (hiLightC.current) {
      // Spill drawer keeps an extra mouth light so we can zoom to it
      let hiC = spill && opened ? 0.95 * amt : 0
      if (spill && hiC > 0) {
        const b = reduced ? 1 : revealBlend
        const washIn = THREE.MathUtils.smoothstep(b, 0.2, 0.6)
        hiC *= THREE.MathUtils.lerp(0.35, 1, washIn)
      }
      hiLightC.current.intensity = hiC
      hiLightC.current.visible = spill && opened
    }
    if (surgeLight.current) {
      surgeLight.current.intensity = surge && opened ? 5.5 * amt : 0
      surgeLight.current.visible = surge && opened
    }
    if (gemLight.current) {
      gemLight.current.intensity = featureFill && opened ? 2.8 * glow * amt : 0
      gemLight.current.visible = featureFill && opened
    }
  })

  const specimens = useMemo(() => {
    if (!featureFill) return []
    return Array.from({ length: 5 }, (_, i) => {
      const u = hash01(`d${seed}-${i}`)
      const colors = ['#e8b86a', '#7ec4a8', '#8eb4d8', '#d4a574', '#9bc48a']
      return {
        x: -0.72 + i * 0.36 + (u - 0.5) * 0.06,
        y: 0.05,
        z: -0.12,
        color: colors[i % colors.length],
        habit: (['octa', 'cube', 'hexprism', 'dodeca', 'needle'] as Habit[])[i % 5],
        s: 0.14 + u * 0.06,
      }
    })
  }, [seed, featureFill])

  const W = 2.12
  const D = 0.88
  const H = 0.36
  const T = 0.045

  return (
    <group ref={ref} position={[0, y, 0.08]}>
      {/* tray bottom */}
      <mesh position={[0, -H / 2 + T / 2, 0]}>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial ref={trayMat} color="#524536" roughness={0.7} emissive="#000000" />
      </mesh>
      {/* left / right sides */}
      <mesh position={[-(W / 2 - T / 2), 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial ref={sideMatL} color="#524536" roughness={0.68} />
      </mesh>
      <mesh position={[W / 2 - T / 2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial ref={sideMatR} color="#524536" roughness={0.68} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, 0, -(D / 2 - T / 2)]}>
        <boxGeometry args={[W - T * 2, H, T]} />
        <meshStandardMaterial ref={backMat} color="#524536" roughness={0.68} />
      </mesh>
      {/* front face — taller lip like a real drawer front */}
      <mesh position={[0, 0.02, D / 2 - T / 2]}>
        <boxGeometry args={[W + 0.04, H + 0.06, T * 1.2]} />
        <meshStandardMaterial
          ref={frontMat}
          color="#5f5140"
          roughness={0.55}
          metalness={0.08}
          emissive="#000000"
        />
      </mesh>
      {/* handle */}
      <mesh position={[0, 0.02, D / 2 + 0.03]}>
        <boxGeometry args={[0.38, 0.035, 0.035]} />
        <meshStandardMaterial color="#f0e2c0" metalness={0.55} roughness={0.28} />
      </mesh>

      {/* Always mounted; visibility toggled in useFrame — no React remounts mid-walk */}
      <group ref={fillRef} visible={false}>
        <mesh position={[0, H / 2 - 0.02, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W * 0.88, D * 0.7]} />
          <meshBasicMaterial
            ref={glowMat}
            color={highlight ? '#f0c878' : '#e8b86a'}
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {featureFill && (
          <>
            <pointLight
              ref={hiLightA}
              position={[0, 0.12, 0.15]}
              color="#f0c878"
              intensity={0}
              distance={6.5}
              decay={1.4}
            />
            <pointLight
              ref={hiLightB}
              position={[0, 0.35, 0.55]}
              color="#ffe6a8"
              intensity={0}
              distance={spill ? 12 : 8}
              decay={1.2}
            />
            {spill && (
              <pointLight
                ref={hiLightC}
                position={[0, 0.25, 1.1]}
                color="#fff3c8"
                intensity={0}
                distance={16}
                decay={1.05}
              />
            )}
            {isDive && (
              <pointLight
                ref={surgeLight}
                position={[0, 0.2, 0.9]}
                color="#fff3c8"
                intensity={0}
                distance={14}
                decay={1.05}
              />
            )}
            {specimens.map((s, i) => (
              <group key={i} position={[s.x, s.y, s.z]} scale={s.s}>
                <CrystalMesh
                  habit={s.habit}
                  color={s.color}
                  emissive={(highlight ? 1.55 : 0.85) * (surge ? 1.35 : 1)}
                />
                {i === 2 && (
                  <pointLight
                    ref={gemLight}
                    color={s.color}
                    intensity={0}
                    distance={4.5}
                    decay={1.3}
                  />
                )}
              </group>
            ))}
          </>
        )}
      </group>
    </group>
  )
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const CAM_EASE_SEC = 2.45
/** Longer ease for sky ↔ reveal ↔ cabinets nested-doll handoff. */
const REVEAL_CAM_EASE_SEC = 3.2
/** Pan-up to overlook the glowing drawer (2× the original pan duration). */
const DIVE_PAN_SEC = 2.7
/** Plunge into the drawer light — left at the previous zoom pace. */
const DIVE_PLUNGE_SEC = 2.0
const SKY_R = 14.4
const SKY_Y = 3.1
/** Match OrbitControls autoRotate (positive speed → rotateLeft → decreasing theta). */
const SKY_AUTO_ROTATE_SPEED = 0.42
const SKY_SPIN_RAD_PER_SEC = ((2 * Math.PI) / 60) * SKY_AUTO_ROTATE_SPEED

/** Hall room placement — back-wall cabinets at local z=-6.5. */
const ROOM_Y = -1.2
const ROOM_Z = 18
/** Back-wall front row: x = -12.5 + index * 2.5 (indices 0–10). */
const ENTRY_CABINET = 5
const ENTRY_DRAWER = 2
/** Different cabinet/slot for the turn→dive — not the tray we just left. */
const DIVE_CABINET = 8
const DIVE_DRAWER = 4

function backWallDrawerMouth(cabinetIndex: number, drawerIndex: number) {
  const x = -12.5 + cabinetIndex * 2.5
  const y = ROOM_Y + (0.35 + drawerIndex * 0.48)
  const z = ROOM_Z - 6.5 + 1.55
  return new THREE.Vector3(x, y, z)
}

const ENTRY_MOUTH = backWallDrawerMouth(ENTRY_CABINET, ENTRY_DRAWER)
const DIVE_MOUTH = backWallDrawerMouth(DIVE_CABINET, DIVE_DRAWER)

/** Reveal settle: facing the open drawer with fixed specimens — not the full hall. */
const REVEAL_OUT = {
  pos: new THREE.Vector3(ENTRY_MOUTH.x + 0.25, ENTRY_MOUTH.y + 1.35, ENTRY_MOUTH.z + 6.2),
  look: new THREE.Vector3(ENTRY_MOUTH.x, ENTRY_MOUTH.y + 0.15, ENTRY_MOUTH.z),
}

/** Cabinets beat: pull further into the aisle / full room. */
const CABINETS_AISLE = {
  pos: new THREE.Vector3(0.2, 2.6, 25.5),
  look: new THREE.Vector3(0, 1.15, 14.5),
}

const DIVE_PAN = {
  pos: new THREE.Vector3(DIVE_MOUTH.x + 0.1, DIVE_MOUTH.y + 5.8, 18.6),
  look: new THREE.Vector3(DIVE_MOUTH.x, DIVE_MOUTH.y + 0.05, DIVE_MOUTH.z + 0.05),
}
const DIVE_PLUNGE = {
  pos: new THREE.Vector3(DIVE_MOUTH.x, DIVE_MOUTH.y + 0.06, DIVE_MOUTH.z - 0.5),
  look: new THREE.Vector3(DIVE_MOUTH.x, DIVE_MOUTH.y, DIVE_MOUTH.z - 1.35),
}

/** Aisle walk from room entry toward the dive drawer on the right. */
const WALK_SEC = 7.5
const WALK_END = {
  pos: new THREE.Vector3(DIVE_MOUTH.x - 0.6, 1.75, 19.0),
  look: new THREE.Vector3(DIVE_MOUTH.x, DIVE_MOUTH.y + 0.15, DIVE_MOUTH.z),
}

/** Shared aisle walk X so cabinets can open as the camera passes. */
let hallWalkX = 0
let hallWalkActive = false
/**
 * sky→reveal: zoom from constellation to the open drawer light.
 * Constellation keeps its look and fades; drawer already holds fixed specimens.
 */
const REVEAL_ENTER_SEC = 3.6

/**
 * Shared 0–1 progress for sky→reveal zoom.
 * Driven by CameraRig during the enter path; held at 1 while reveal is settled.
 */
let revealBlend = 0

const COL_SKY = new THREE.Color('#030303')
const COL_HALL = new THREE.Color('#0a0806')
const COL_FOG_HALL = new THREE.Color('#0c0b09')
const COL_DIVE = new THREE.Color('#1a1408')
const COL_BG = new THREE.Color()
const COL_FOG = new THREE.Color()
const SKY_ORIGIN = new THREE.Vector3(0, 0, 0)

/** Fade starfield materials only (never scale — scale-collapse makes the pixel ball). */
function setGroupFade(root: THREE.Object3D, fade: number) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh | THREE.Points
    if (!mesh.material) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!('opacity' in mat)) continue
      const m = mat as THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean }
      if (m.userData._baseOpacity == null) {
        m.userData._baseOpacity = m.opacity
        m.userData._baseDepthWrite = m.depthWrite
        m.userData._baseTransparent = m.transparent
      }
      const base = m.userData._baseOpacity as number
      m.transparent = fade < 0.999 ? true : Boolean(m.userData._baseTransparent)
      m.opacity = base * fade
      m.depthWrite = fade > 0.92 ? Boolean(m.userData._baseDepthWrite) : false
      m.needsUpdate = true
    }
  })
}

/** Keep constellation fixed in sky space until React unmounts mid-reveal. */
function ConstellationSky({
  phase,
  children,
}: {
  phase: Phase
  reduced?: boolean
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!ref.current) return

    if (phase === 'peri' || phase === 'peers' || phase === 'sky' || closeSkyPhase(phase)) {
      ref.current.position.copy(SKY_ORIGIN)
      ref.current.scale.setScalar(1)
      ref.current.visible = true
      setGroupFade(ref.current, 1)
      return
    }

    if (phase === 'reveal') {
      // Stay opaque — React unmounts mid-zoom so drei Html labels die with the group
      ref.current.position.copy(SKY_ORIGIN)
      ref.current.scale.setScalar(1)
      ref.current.visible = true
      setGroupFade(ref.current, 1)
      return
    }

    ref.current.visible = false
  })

  return (
    <group ref={ref} visible={skyVisiblePhase(phase)}>
      {children}
    </group>
  )
}

/** Stars fade out early — never scaled with the nest (avoids the pixel ball). */
function SkyStars({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const inSky =
    phase === 'peri' || phase === 'peers' || phase === 'sky' || closeSkyPhase(phase)
  const nesting = phase === 'reveal'
  const dimClose = phase === 'beyond' || phase === 'thanks'

  useFrame(() => {
    if (!ref.current) return
    if (inSky) {
      ref.current.scale.setScalar(1)
      ref.current.visible = true
      setGroupFade(ref.current, dimClose ? 0.42 : 1)
      return
    }
    if (nesting) {
      const b = reduced ? 1 : revealBlend
      // Stars fade early while labeled crystals linger a beat longer
      const u = Math.min(1, b / 0.45)
      const fade = 1 - easeInOutCubic(u)
      ref.current.scale.setScalar(1)
      ref.current.visible = fade > 0.02
      setGroupFade(ref.current, fade)
      return
    }
    ref.current.visible = false
  })

  return (
    <group ref={ref} visible={inSky || nesting}>
      <Stars
        radius={80}
        depth={40}
        count={reduced ? 800 : 2800}
        factor={3.2}
        saturation={0}
        fade
        speed={reduced || !inSky || dimClose ? 0 : 0.35}
      />
    </group>
  )
}

/** Distant galaxies beyond the fringe — visible on beyond / thanks. */
function DistantGalaxies({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const show = phase === 'beyond' || phase === 'thanks'
  const opacity = useRef(0)

  const hubs = useMemo(() => {
    const base = FRINGE_CENTER.clone().add(FRINGE_OUT.clone().multiplyScalar(28))
    return [
      { pos: base.clone().add(new THREE.Vector3(0, 1.2, 0)), count: reduced ? 400 : 1200, factor: 4.2 },
      {
        pos: base
          .clone()
          .add(FRINGE_OUT.clone().multiplyScalar(14))
          .add(new THREE.Vector3(-8, -2.5, 6)),
        count: reduced ? 280 : 900,
        factor: 3.6,
      },
      {
        pos: base
          .clone()
          .add(FRINGE_OUT.clone().multiplyScalar(22))
          .add(new THREE.Vector3(10, 3.5, -4)),
        count: reduced ? 220 : 700,
        factor: 3.1,
      },
    ]
  }, [reduced])

  useFrame((_, dt) => {
    if (!ref.current) return
    const target = show ? 1 : 0
    opacity.current = reduced
      ? target
      : THREE.MathUtils.damp(opacity.current, target, 1.4, dt)
    const fade = opacity.current
    ref.current.visible = fade > 0.02
    setGroupFade(ref.current, fade)
  })

  return (
    <group ref={ref} visible={false}>
      {hubs.map((h, i) => (
        <group key={i} position={h.pos.toArray()}>
          <Stars
            radius={36 + i * 8}
            depth={22}
            count={h.count}
            factor={h.factor}
            saturation={0.15}
            fade
            speed={reduced || !show ? 0 : 0.12}
          />
          {/* Sparse cool crystal dust — reads as another constellation, not labels */}
          {Array.from({ length: reduced ? 4 : 9 }, (_, k) => {
            const a = hash01(`gal-${i}-${k}`)
            const b = hash01(`gal-b-${i}-${k}`)
            const c = hash01(`gal-c-${i}-${k}`)
            return (
              <mesh
                key={k}
                position={[(a - 0.5) * 14, (b - 0.5) * 6, (c - 0.5) * 14]}
                scale={0.04 + c * 0.06}
              >
                <octahedronGeometry args={[1, 0]} />
                <meshBasicMaterial color="#8eb4d8" transparent opacity={0.35} depthWrite={false} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

function goalForPhase(phase: Phase, skyYaw: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
  if (phase === 'peri') {
    return {
      pos: new THREE.Vector3(HERO.pos.x + 0.2, HERO.pos.y + 0.42, HERO.pos.z + 2.35),
      look: HERO.pos.clone(),
    }
  }
  if (phase === 'peers') {
    const c = PEERS.reduce((acc, b) => acc.add(TMP.copy(b.pos)), new THREE.Vector3()).multiplyScalar(
      1 / PEERS.length,
    )
    return {
      pos: new THREE.Vector3(c.x + 0.4, c.y + 2.2, c.z + 6.2),
      look: c,
    }
  }
  if (phase === 'sky' || phase === 'return') {
    return {
      pos: new THREE.Vector3(Math.sin(skyYaw) * SKY_R, SKY_Y, Math.cos(skyYaw) * SKY_R),
      look: new THREE.Vector3(0, 0.2, 0),
    }
  }
  if (phase === 'case-spinel') {
    const s = SPINEL_BODY.pos
    return {
      pos: new THREE.Vector3(s.x + 2.4, s.y + 1.5, s.z + 5.2),
      look: s.clone(),
    }
  }
  if (phase === 'case-fringe') {
    return {
      pos: FRINGE_CENTER.clone()
        .add(FRINGE_OUT.clone().multiplyScalar(9.5))
        .add(new THREE.Vector3(0, 3.4, 0)),
      look: FRINGE_CENTER.clone(),
    }
  }
  if (phase === 'beyond' || phase === 'thanks') {
    return {
      pos: FRINGE_CENTER.clone()
        .add(FRINGE_OUT.clone().multiplyScalar(17))
        .add(new THREE.Vector3(0, 5.2, 0)),
      look: FRINGE_CENTER.clone()
        .add(FRINGE_OUT.clone().multiplyScalar(34))
        .add(new THREE.Vector3(0, 1.5, 0)),
    }
  }
  if (phase === 'reveal') {
    // Settled after pulling out of the open drawer (not the full hall)
    return { pos: REVEAL_OUT.pos.clone(), look: REVEAL_OUT.look.clone() }
  }
  if (phase === 'cabinets') {
    return { pos: CABINETS_AISLE.pos.clone(), look: CABINETS_AISLE.look.clone() }
  }
  if (phase === 'instrument') {
    return { pos: WALK_END.pos.clone(), look: WALK_END.look.clone() }
  }
  if (phase === 'dive') {
    return { pos: DIVE_PLUNGE.pos.clone(), look: DIVE_PLUNGE.look.clone() }
  }
  // turn — stop at the dive drawer (not the entry tray), looking in before the plunge
  return {
    pos: new THREE.Vector3(DIVE_MOUTH.x - 0.35, DIVE_MOUTH.y + 0.35, 17.8),
    look: DIVE_MOUTH.clone(),
  }
}

function camEaseSec(from: Phase, to: Phase) {
  if (
    (from === 'sky' && to === 'reveal') ||
    (from === 'reveal' && to === 'cabinets') ||
    (from === 'cabinets' && to === 'instrument') ||
    (from === 'instrument' && to === 'turn')
  ) {
    return REVEAL_CAM_EASE_SEC
  }
  if ((from === 'reveal' && to === 'sky') || (from === 'cabinets' && to === 'reveal')) {
    return REVEAL_CAM_EASE_SEC
  }
  // Peri close-up → constellation: longer dolly so the pullback reads as one zoom.
  if (from === 'peri' && to === 'sky') return 3.35
  if (closeSkyPhase(from) || closeSkyPhase(to)) {
    return 2.9
  }
  return CAM_EASE_SEC
}

function CameraRig({
  phase,
  focusId,
  reduced,
  scripted,
  onSettle,
  onDiveProgress,
  onRevealProgress,
}: {
  phase: Phase
  focusId: string | null
  reduced: boolean
  scripted: boolean
  onSettle?: (settled: boolean) => void
  /** 0–1 wash coverage during the plunge (0 while panning). */
  onDiveProgress?: (wash: number, done: boolean) => void
  onRevealProgress?: (blend: number) => void
}) {
  const { camera } = useThree()
  const focus = BODIES.find((b) => b.id === focusId) ?? null
  const look = useRef(new THREE.Vector3().copy(HERO.pos))
  const fromPos = useRef(new THREE.Vector3(HERO.pos.x + 0.2, HERO.pos.y + 0.42, HERO.pos.z + 2.35))
  const fromLook = useRef(new THREE.Vector3().copy(HERO.pos))
  const midPos = useRef(DIVE_PAN.pos.clone())
  const midLook = useRef(DIVE_PAN.look.clone())
  const toPos = useRef(new THREE.Vector3(HERO.pos.x + 0.2, HERO.pos.y + 0.42, HERO.pos.z + 2.35))
  const toLook = useRef(new THREE.Vector3().copy(HERO.pos))
  const progress = useRef(1)
  const diveClock = useRef(0)
  const revealClock = useRef(0)
  const walkClock = useRef(0)
  const prevPhase = useRef(phase)
  const prevFocus = useRef(focusId)
  const skyYaw = useRef(Math.atan2(-9.6, 10.8))
  const settled = useRef(true)
  const baseFov = useRef(42)
  const easeDur = useRef(CAM_EASE_SEC)
  const revealEnter = useRef(false)
  const walkActive = useRef(false)
  /** peri→sky: hold look on perovskite through the dolly, then reframe late. */
  const periZoomOut = useRef(false)
  const booted = useRef(false)

  useFrame((_, dt) => {
    const persp = camera as THREE.PerspectiveCamera

    if (!booted.current) {
      booted.current = true
      if (closeSkyPhase(phase)) {
        const g = goalForPhase(phase, skyYaw.current)
        camera.position.copy(g.pos)
        look.current.copy(g.look)
        fromPos.current.copy(g.pos)
        fromLook.current.copy(g.look)
        toPos.current.copy(g.pos)
        toLook.current.copy(g.look)
        progress.current = 1
        prevPhase.current = phase
        camera.up.copy(WORLD_UP)
        camera.lookAt(look.current)
        settled.current = true
        onSettle?.(true)
        return
      }
    }

    if (!scripted) {
      if (phase === 'sky') look.current.set(0, 0.2, 0)
      else if (phase === 'peers') look.current.copy(HERO.pos)
      hallWalkActive = false
      if (!settled.current) {
        settled.current = true
        onSettle?.(true)
      }
      return
    }

    const phaseChanged = phase !== prevPhase.current
    const focusChanged = focusId !== prevFocus.current

    if (phaseChanged || focusChanged) {
      fromPos.current.copy(camera.position)
      fromLook.current.copy(look.current)
      baseFov.current = persp.fov
      diveClock.current = 0
      revealClock.current = 0
      walkClock.current = 0
      revealEnter.current = false
      walkActive.current = false
      periZoomOut.current = false
      hallWalkActive = false

      if (focus) {
        toPos.current.set(focus.pos.x + 1.6, focus.pos.y + 0.9, focus.pos.z + 2.4)
        toLook.current.copy(focus.pos)
        easeDur.current = CAM_EASE_SEC * 0.55
      } else if (phase === 'dive') {
        midPos.current.copy(DIVE_PAN.pos)
        midLook.current.copy(DIVE_PAN.look)
        toPos.current.copy(DIVE_PLUNGE.pos)
        toLook.current.copy(DIVE_PLUNGE.look)
        easeDur.current = CAM_EASE_SEC
      } else if (phase === 'reveal' && prevPhase.current === 'sky') {
        // Zoom from constellation to the open drawer light
        revealEnter.current = true
        revealBlend = reduced ? 1 : 0
        fromLook.current.set(0, 0.2, 0)
        toPos.current.copy(REVEAL_OUT.pos)
        toLook.current.copy(REVEAL_OUT.look)
        easeDur.current = REVEAL_ENTER_SEC
      } else if (phase === 'instrument') {
        // Continue from the cabinets entry view and walk right to the dive drawer
        walkActive.current = true
        hallWalkActive = true
        toPos.current.copy(WALK_END.pos)
        toLook.current.copy(WALK_END.look)
        hallWalkX = camera.position.x
        easeDur.current = WALK_SEC
      } else if (phase === 'sky' && prevPhase.current === 'peri') {
        // Pull straight back along the peri line of sight, then settle into sky orbit.
        // Avoid panning look to origin in lockstep — that slides perovskite off-center.
        periZoomOut.current = true
        const backX = camera.position.x - HERO.pos.x
        const backZ = camera.position.z - HERO.pos.z
        skyYaw.current = Math.atan2(
          HERO.pos.x + backX * 6,
          HERO.pos.z + backZ * 6,
        )
        if (!Number.isFinite(skyYaw.current)) skyYaw.current = Math.atan2(-9.6, 10.8)
        const g = goalForPhase('sky', skyYaw.current)
        toPos.current.copy(g.pos)
        toLook.current.copy(g.look)
        easeDur.current = camEaseSec('peri', 'sky')
      } else {
        periZoomOut.current = false
        if (phase === 'sky') {
          skyYaw.current = Math.atan2(camera.position.x - 0, camera.position.z - 0)
          if (!Number.isFinite(skyYaw.current)) skyYaw.current = Math.atan2(-9.6, 10.8)
        }
        const g = goalForPhase(phase, skyYaw.current)
        toPos.current.copy(g.pos)
        toLook.current.copy(g.look)
        easeDur.current = camEaseSec(prevPhase.current, phase)
      }
      progress.current = reduced ? 1 : 0
      prevPhase.current = phase
      prevFocus.current = focusId
      if (settled.current) {
        settled.current = false
        onSettle?.(false)
      }
      if (phase !== 'dive') onDiveProgress?.(0, false)

      if (reduced && phase === 'instrument') {
        camera.position.copy(WALK_END.pos)
        look.current.copy(WALK_END.look)
        hallWalkX = WALK_END.pos.x
        progress.current = 1
        settled.current = true
        onSettle?.(true)
      }
      if (reduced && revealEnter.current) {
        camera.position.copy(REVEAL_OUT.pos)
        look.current.copy(REVEAL_OUT.look)
        revealEnter.current = false
        revealBlend = 1
        onRevealProgress?.(1)
        progress.current = 1
        settled.current = true
        onSettle?.(true)
      }
      if (phase === 'reveal' && !revealEnter.current) {
        revealBlend = 1
        onRevealProgress?.(1)
      }
      if (phase !== 'reveal') {
        onRevealProgress?.(
          phase === 'sky' || phase === 'peri' || phase === 'peers' || closeSkyPhase(phase) ? 0 : 1,
        )
      }
    }

    if (!focus && phase === 'dive') {
      hallWalkActive = false
      if (reduced) {
        camera.position.copy(toPos.current)
        look.current.copy(toLook.current)
        persp.fov = 72
        persp.updateProjectionMatrix()
        onDiveProgress?.(1, true)
        if (!settled.current) {
          settled.current = true
          onSettle?.(true)
        }
      } else {
        diveClock.current += dt
        const panDur = DIVE_PAN_SEC
        const plungeDur = DIVE_PLUNGE_SEC
        if (diveClock.current <= panDur) {
          const v = easeInOutCubic(diveClock.current / panDur)
          camera.position.lerpVectors(fromPos.current, midPos.current, v)
          look.current.lerpVectors(fromLook.current, midLook.current, v)
          persp.fov = THREE.MathUtils.lerp(baseFov.current, 38, v)
          onDiveProgress?.(0, false)
        } else {
          const raw = Math.min(1, (diveClock.current - panDur) / plungeDur)
          const v = easeInOutCubic(raw)
          camera.position.lerpVectors(midPos.current, toPos.current, v)
          look.current.lerpVectors(midLook.current, toLook.current, v)
          persp.fov = THREE.MathUtils.lerp(38, 72, v)
          const wash = Math.min(1, easeInOutCubic(Math.max(0, (raw - 0.15) / 0.55)))
          onDiveProgress?.(wash, raw >= 1)
          if (raw >= 1 && !settled.current) {
            settled.current = true
            onSettle?.(true)
          }
        }
        persp.updateProjectionMatrix()
      }
    } else if (!focus && revealEnter.current && phase === 'reveal') {
      hallWalkActive = false
      revealClock.current += dt
      const t = Math.min(1, revealClock.current / REVEAL_ENTER_SEC)
      revealBlend = t
      onRevealProgress?.(t)
      const v = easeInOutCubic(t)
      camera.position.lerpVectors(fromPos.current, REVEAL_OUT.pos, v)
      look.current.lerpVectors(fromLook.current, REVEAL_OUT.look, v)
      persp.fov = THREE.MathUtils.lerp(baseFov.current, 40, v)
      persp.updateProjectionMatrix()
      progress.current = t
      if (t >= 1) {
        revealEnter.current = false
        revealBlend = 1
        onRevealProgress?.(1)
        if (!settled.current) {
          settled.current = true
          onSettle?.(true)
        }
      }
    } else if (!focus && walkActive.current && phase === 'instrument') {
      walkClock.current += dt
      const walk = reduced ? 0.01 : WALK_SEC
      hallWalkActive = true
      const raw = Math.min(1, walkClock.current / walk)
      const v = easeInOutCubic(raw)
      camera.position.lerpVectors(fromPos.current, toPos.current, v)
      look.current.lerpVectors(fromLook.current, toLook.current, v)
      hallWalkX = camera.position.x
      persp.fov = THREE.MathUtils.lerp(baseFov.current, 40, v)
      persp.updateProjectionMatrix()
      progress.current = raw
      if (raw >= 1) {
        walkActive.current = false
        hallWalkActive = true
        if (!settled.current) {
          settled.current = true
          onSettle?.(true)
        }
      }
    } else if (!focus && (phase === 'sky' || phase === 'return') && progress.current >= 1) {
      hallWalkActive = false
      if (!reduced) skyYaw.current -= dt * SKY_SPIN_RAD_PER_SEC
      const g = goalForPhase(phase === 'return' ? 'return' : 'sky', skyYaw.current)
      toPos.current.copy(g.pos)
      toLook.current.copy(g.look)
      camera.position.lerp(toPos.current, 1 - Math.exp(-1.6 * dt))
      look.current.lerp(toLook.current, 1 - Math.exp(-1.6 * dt))
      if (persp.fov !== baseFov.current) {
        persp.fov = THREE.MathUtils.damp(persp.fov, 42, 3, dt)
        persp.updateProjectionMatrix()
      }
    } else if (progress.current < 1) {
      hallWalkActive = phase === 'instrument'
      // Freeze orbit while dollying out of peri so the zoom reads as a straight pullback.
      if (!focus && (phase === 'sky' || phase === 'return') && !reduced && !periZoomOut.current) {
        skyYaw.current -= dt * SKY_SPIN_RAD_PER_SEC
        const g = goalForPhase(phase === 'return' ? 'return' : 'sky', skyYaw.current)
        toPos.current.copy(g.pos)
        toLook.current.copy(g.look)
      }
      const dur = easeDur.current
      progress.current = Math.min(1, progress.current + dt / dur)
      const u = easeInOutCubic(progress.current)
      camera.position.lerpVectors(fromPos.current, toPos.current, u)
      if (periZoomOut.current) {
        // Keep perovskite centered through most of the pullback; reframe to sky late.
        const lookU = easeInOutCubic(Math.max(0, (progress.current - 0.58) / 0.42))
        look.current.lerpVectors(fromLook.current, toLook.current, lookU)
      } else {
        look.current.lerpVectors(fromLook.current, toLook.current, u)
      }
      if (phase === 'instrument') hallWalkX = camera.position.x
      const goalFov = phase === 'reveal' ? 42 : phase === 'turn' ? 38 : 42
      if (persp.fov !== goalFov) {
        persp.fov = THREE.MathUtils.lerp(baseFov.current, goalFov, u)
        persp.updateProjectionMatrix()
      }
      if (progress.current >= 1 && !settled.current) {
        periZoomOut.current = false
        settled.current = true
        onSettle?.(true)
      }
    } else {
      if (phase !== 'instrument') hallWalkActive = false
      camera.position.lerp(toPos.current, 1 - Math.exp(-2.2 * dt))
      look.current.lerp(toLook.current, 1 - Math.exp(-2.2 * dt))
      if (!settled.current) {
        settled.current = true
        onSettle?.(true)
      }
    }

    camera.up.copy(WORLD_UP)
    camera.lookAt(look.current)
  })

  return null
}

function Atmosphere({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const { scene } = useThree()

  useFrame(() => {
    const inHall = inHallPhase(phase)
    let near = 14
    let far = 44

    if (phase === 'reveal') {
      const b = reduced ? 1 : revealBlend
      // Sky → hall as we arrive at the drawer (keep night sky early)
      const u = easeInOutCubic(Math.min(1, Math.max(0, (b - 0.22) / 0.58)))
      COL_BG.copy(COL_SKY).lerp(COL_HALL, u)
      COL_FOG.copy(COL_SKY).lerp(COL_FOG_HALL, u)
      near = THREE.MathUtils.lerp(14, 16, u)
      far = THREE.MathUtils.lerp(44, 42, u)
    } else if (phase === 'dive') {
      COL_BG.copy(COL_DIVE)
      COL_FOG.copy(COL_DIVE)
      near = 4
      far = 28
    } else if (inHall) {
      COL_BG.copy(COL_HALL)
      COL_FOG.copy(COL_FOG_HALL)
      near = 22
      far = 55
    } else if (phase === 'beyond' || phase === 'thanks') {
      COL_BG.copy(COL_SKY)
      COL_FOG.copy(COL_SKY)
      near = 18
      far = 95
    } else {
      COL_BG.copy(COL_SKY)
      COL_FOG.copy(COL_SKY)
      near = 14
      far = closeSkyPhase(phase) ? 55 : 44
    }

    scene.background = COL_BG
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(COL_FOG)
      scene.fog.near = near
      scene.fog.far = far
    }
  })

  return <fog attach="fog" args={['#030303', 14, 44]} />
}

function SceneKeyLights({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const amb = useRef<THREE.AmbientLight>(null)
  const dir = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.PointLight>(null)
  const mouth = useRef<THREE.PointLight>(null)

  useFrame(() => {
    const inHall = inHallPhase(phase)
    let hallU = 0
    if (phase === 'dive') hallU = 1
    else if (phase === 'reveal') {
      const b = reduced ? 1 : revealBlend
      hallU = easeInOutCubic(Math.min(1, Math.max(0, (b - 0.22) / 0.58)))
    } else if (inHall) hallU = 1

    if (amb.current) {
      amb.current.intensity =
        phase === 'dive' ? 0.5 : THREE.MathUtils.lerp(0.22, 0.38, hallU)
    }
    if (dir.current) {
      dir.current.intensity =
        phase === 'dive' ? 1.15 : THREE.MathUtils.lerp(0.62, 0.95, hallU)
    }
    if (fill.current) {
      fill.current.intensity =
        phase === 'dive' ? 1.1 : THREE.MathUtils.lerp(0.45, 0.7, hallU)
    }
    if (mouth.current) {
      const show = phase === 'reveal' || phase === 'cabinets'
      const b = reduced ? 1 : revealBlend
      const mouthU =
        phase === 'cabinets' ? 1 : show ? THREE.MathUtils.smoothstep(b, 0.05, 0.45) : 0
      mouth.current.intensity = 0.95 * mouthU
      mouth.current.visible = mouthU > 0.02
    }
  })

  return (
    <>
      <ambientLight ref={amb} intensity={0.22} />
      <directionalLight ref={dir} position={[4, 8, 3]} intensity={0.62} color="#f2e6c8" />
      <pointLight ref={fill} position={[0, 2, 2]} intensity={0.45} color="#e8b86a" distance={24} />
      {(phase === 'reveal' || phase === 'cabinets') && (
        <pointLight
          ref={mouth}
          position={ENTRY_MOUTH.toArray()}
          intensity={0}
          color="#fff0c0"
          distance={16}
        />
      )}
    </>
  )
}

function Scene({
  active,
  phase,
  focusId,
  setFocusId,
  reduced,
  onDiveProgress,
}: {
  active: boolean
  phase: Phase
  focusId: string | null
  setFocusId: (id: string | null) => void
  reduced: boolean
  onDiveProgress?: (wash: number, done: boolean) => void
}) {
  const [camSettled, setCamSettled] = useState(true)
  /** Unmount constellation mid-reveal so drei Html labels cannot linger over the hall. */
  const [skyMounted, setSkyMounted] = useState(true)
  const canOrbit = phase === 'sky' || phase === 'peers'
  const orbit = active && canOrbit && !focusId && !reduced && camSettled
  const scripted = !orbit
  const litIds = litIdsForPhase(phase)
  const dimField = litIds != null

  useEffect(() => {
    setCamSettled(reduced)
    if (phase === 'sky' || phase === 'peri' || phase === 'peers') setSkyMounted(true)
    if (phase === 'reveal' && reduced) setSkyMounted(false)
  }, [phase, focusId, reduced])

  const onRevealProgress = useCallback(
    (blend: number) => {
      if (phase !== 'reveal') {
        setSkyMounted(
          phase === 'sky' || phase === 'peri' || phase === 'peers' || closeSkyPhase(phase),
        )
        return
      }
      setSkyMounted(blend < 0.48)
    },
    [phase],
  )

  return (
    <>
      <Atmosphere phase={phase} reduced={reduced} />
      <SceneKeyLights phase={phase} reduced={reduced} />

      {(phase === 'instrument' || phase === 'turn' || phase === 'dive') && (
        <pointLight
          position={DIVE_MOUTH.toArray()}
          intensity={phase === 'dive' ? 4.5 : 3.2}
          color="#fff0c0"
          distance={16}
        />
      )}
      {(phase === 'case-fringe' || phase === 'beyond' || phase === 'thanks') && (
        <pointLight
          position={FRINGE_CENTER.toArray()}
          intensity={phase === 'case-fringe' ? 1.6 : 0.85}
          color="#7ec4a8"
          distance={22}
        />
      )}

      {skyVisiblePhase(phase) && skyMounted && <SkyStars phase={phase} reduced={reduced} />}
      <DistantGalaxies phase={phase} reduced={reduced} />

      <CameraRig
        phase={phase}
        focusId={focusId}
        reduced={reduced}
        scripted={scripted}
        onSettle={setCamSettled}
        onDiveProgress={onDiveProgress}
        onRevealProgress={onRevealProgress}
      />

      {/* Unmount mid-reveal so Html labels die; hall is already under us */}
      {skyVisiblePhase(phase) && skyMounted && (
        <ConstellationSky phase={phase} reduced={reduced}>
          {BODIES.map((body) => (
            <MineralBody
              key={body.id}
              body={body}
              phase={phase}
              focused={focusId === body.id}
              reduced={reduced}
              lit={Boolean(litIds?.has(body.id))}
              dimField={dimField}
              onSelect={(id) => setFocusId(focusId === id ? null : id)}
            />
          ))}
        </ConstellationSky>
      )}

      <CabinetsRoom phase={phase} reduced={reduced} />

      <OrbitControls
        enabled={orbit}
        enablePan={false}
        enableZoom
        autoRotate={orbit && phase === 'sky'}
        autoRotateSpeed={SKY_AUTO_ROTATE_SPEED}
        minDistance={phase === 'peers' ? 3.5 : 6}
        maxDistance={phase === 'peers' ? 14 : 28}
        maxPolarAngle={Math.PI * 0.48}
        target={phase === 'peers' ? HERO.pos.toArray() : [0, 0.2, 0]}
      />
    </>
  )
}

export function MineralConstellation({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const goTo = useSlideNav()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const [focusId, setFocusId] = useState<string | null>(null)
  const washRef = useRef<HTMLDivElement>(null)
  const advanced = useRef(false)

  useEffect(() => {
    if (phase !== 'sky') setFocusId(null)
  }, [phase])

  useEffect(() => {
    if (!active) setFocusId(null)
  }, [active])

  useEffect(() => {
    if (phase !== 'dive') {
      advanced.current = false
      if (washRef.current) washRef.current.style.opacity = '0'
    }
  }, [phase])

  useEffect(() => {
    if (!focusId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setFocusId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusId])

  const onDiveProgress = useCallback(
    (wash: number, done: boolean) => {
      if (washRef.current) washRef.current.style.opacity = String(wash)
      if (!done || advanced.current || !active) return
      advanced.current = true
      const i = slides.findIndex((s) => s.id === 'open-zoom')
      // Hold full light briefly so Act I can pick up the same wash
      window.setTimeout(
        () => {
          if (i >= 0) goTo(i + 1, 'auto', true)
        },
        reduced ? 80 : 380,
      )
    },
    [active, goTo, reduced],
  )

  const focusName = BODIES.find((b) => b.id === focusId)?.name

  return (
    <div
      className={styles.constellation}
      aria-label={label || 'Night-sky mineral constellation with idealized crystals'}
    >
      <Canvas
        dpr={STRUCTURE_DPR}
        camera={{
          position: [HERO.pos.x + 0.2, HERO.pos.y + 0.42, HERO.pos.z + 2.35],
          fov: 42,
          near: 0.05,
          far: 220,
        }}
        gl={STRUCTURE_GL_OPAQUE}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => {
          if (focusId) setFocusId(null)
        }}
      >
        <Suspense fallback={null}>
          <Scene
            active={active}
            phase={phase}
            focusId={focusId}
            setFocusId={setFocusId}
            reduced={reduced}
            onDiveProgress={onDiveProgress}
          />
        </Suspense>
      </Canvas>

      <div ref={washRef} className={styles.constellationWash} aria-hidden />

      {phase === 'sky' && !focusId && (
        <div className={styles.constellationHint} data-idle="">
          Drag to orbit · click a crystal to zoom
        </div>
      )}
      {focusName && (
        <button
          type="button"
          className={styles.constellationHint}
          onClick={() => setFocusId(null)}
        >
          {focusName} · Esc / click empty to pull back
        </button>
      )}
      {phase === 'reveal' && (
        <div className={styles.constellationHint} data-idle="">
          Zoom to the open drawer
        </div>
      )}
      {phase === 'cabinets' && (
        <div className={styles.constellationHint} data-idle="">
          Collection hall · one tray open
        </div>
      )}
      {phase === 'instrument' && (
        <div className={styles.constellationHint} data-idle="">
          Walk the row · stop at the glowing drawer
        </div>
      )}
      {phase === 'turn' && (
        <div className={styles.constellationHint} data-idle="">
          Look in · then dive
        </div>
      )}
    </div>
  )
}
