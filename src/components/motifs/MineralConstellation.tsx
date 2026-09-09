import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
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

type Phase = 'peri' | 'peers' | 'sky' | 'reveal' | 'cabinets' | 'instrument' | 'turn' | 'dive'

type Body = Mineral & {
  pos: THREE.Vector3
  color: string
  habit: Habit
  scale: number
}

const minerals = data.minerals as Mineral[]
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const TMP = new THREE.Vector3()

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
  return (
    phase === 'peri' ||
    phase === 'peers' ||
    phase === 'sky' ||
    phase === 'reveal' ||
    phase === 'cabinets'
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
  onSelect,
}: {
  body: Body
  phase: Phase
  focused: boolean
  reduced: boolean
  onSelect: (id: string) => void
}) {
  const root = useRef<THREE.Group>(null)
  const isHero = body.tier === 'hero'
  const isPeer = body.tier === 'peer'
  const inSpill = phase === 'reveal' || phase === 'cabinets'

  const visible =
    focused ||
    isHero ||
    (isPeer && phase !== 'peri') ||
    phase === 'sky' ||
    phase === 'peers' ||
    inSpill

  const showMoons =
    focused ||
    (phase === 'peri' && isHero) ||
    (phase === 'peers' && (isHero || isPeer)) ||
    phase === 'sky'

  const moonCount =
    focused || isHero
      ? Math.max(5, body.apps.length + 2)
      : isPeer
        ? Math.max(3, body.apps.length)
        : 3

  const showLabel =
    focused ||
    (phase === 'peri' && isHero) ||
    (phase === 'peers' && (isHero || isPeer)) ||
    (phase === 'sky' && (isHero || isPeer))

  const showCrystal = focused || isHero || isPeer || phase === 'sky' || inSpill

  useFrame((_, dt) => {
    if (!root.current || reduced) return
    root.current.rotation.y += dt * (isHero ? 0.15 : isPeer ? 0.1 : 0.05)
  })

  if (!visible && body.tier === 'field' && phase === 'peri') return null

  return (
    <group
      ref={root}
      position={body.pos}
      scale={body.scale * (focused ? 1.35 : 1)}
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
      {(isHero || isPeer || focused) && phase !== 'reveal' && phase !== 'cabinets' && (
        <mesh>
          <sphereGeometry args={[1.55, 16, 16]} />
          <meshBasicMaterial color={body.color} transparent opacity={0.08} depthWrite={false} />
        </mesh>
      )}
      {showCrystal ? (
        <CrystalMesh
          habit={body.habit}
          color={body.color}
          emissive={
            focused
              ? 0.95
              : isHero
                ? phase === 'reveal'
                  ? 1.15
                  : 0.7
                : isPeer
                  ? phase === 'reveal'
                    ? 0.85
                    : 0.55
                  : phase === 'reveal'
                    ? 0.55
                    : phase === 'cabinets'
                      ? 0.4
                      : 0.28
          }
        />
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
          radius={isHero || focused ? 2.1 : isPeer ? 1.55 : 1.1}
          showLabels={Boolean(showMoons && (isHero || isPeer || focused))}
          reduced={reduced}
          count={moonCount}
          distanceFactor={labelDistanceFactor(phase, focused)}
        />
      )}
      {showLabel && (
        <Html
          position={[0, 1.55, 0]}
          center
          distanceFactor={labelDistanceFactor(phase, focused)}
          style={{ pointerEvents: 'none' }}
          wrapperClass={styles.constellationNameLabel}
        >
          <div data-hero={isHero || focused || undefined}>
            {isHero && phase === 'peri' && body.named ? <em>{body.named}</em> : null}
            <strong>{body.name}</strong>
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
    // Snap in faster on reveal so the drawer frame meets the collapsing sky
    const rate = phase === 'reveal' ? 4.8 : 2.4
    appear.current = reduced ? target : THREE.MathUtils.damp(appear.current, target, rate, dt)
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
      <ambientLight intensity={silhouette ? 0.22 : 0.55} />
      <directionalLight
        position={[2, 8, 6]}
        intensity={silhouette ? 0.35 : 1.15}
        color="#f5e6c8"
      />
      <pointLight
        position={[0, 5, 4]}
        intensity={silhouette ? 0.45 : 1.4}
        color="#f2e0b4"
        distance={36}
      />
      {!silhouette && (
        <>
          <pointLight position={[-7, 3.5, 0]} intensity={0.7} color="#b8dfc8" distance={22} />
          <pointLight position={[7, 3.5, 0]} intensity={0.65} color="#e8c898" distance={22} />
        </>
      )}

      {cabinets.map((c, ci) => (
        <CabinetUnit
          key={ci}
          index={ci}
          x={c.x}
          z={c.z}
          rotY={c.rot}
          phase={phase}
          reduced={reduced}
          silhouette={silhouette && ci !== FEATURED_CABINET}
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
  const openSet =
    phase === 'turn' || phase === 'dive' || phase === 'reveal' || phase === 'cabinets'
      ? new Set([FEATURED_DRAWER])
      : phase === 'instrument'
        ? new Set([1, FEATURED_DRAWER, 4])
        : new Set([FEATURED_DRAWER])
  const isFeature = index === FEATURED_CABINET
  const wood = silhouette ? '#1a1612' : '#4a3f32'
  const face = silhouette ? '#221c16' : '#5a4c3c'

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
        const wantOpen = !silhouette && isFeature && openSet.has(di)
        const highlight =
          (phase === 'reveal' ||
            phase === 'cabinets' ||
            phase === 'turn' ||
            phase === 'dive') &&
          isFeature &&
          di === FEATURED_DRAWER
        return (
          <Drawer
            key={di}
            y={y}
            open={wantOpen}
            highlight={highlight}
            surge={phase === 'dive' && isFeature && di === FEATURED_DRAWER}
            reduced={reduced}
            seed={index * 10 + di}
            spill={phase === 'reveal' && highlight}
          />
        )
      })}
    </group>
  )
}

function Drawer({
  y,
  open,
  highlight,
  surge = false,
  reduced,
  seed,
  spill = false,
}: {
  y: number
  open: boolean
  highlight: boolean
  surge?: boolean
  reduced: boolean
  seed: number
  spill?: boolean
}) {
  const ref = useRef<THREE.Group>(null)
  const pull = useRef(0)

  useFrame((_, dt) => {
    if (!ref.current) return
    const target = open ? (highlight ? (spill ? 1.15 : 1.05) : 0.72) : 0
    pull.current = reduced ? target : THREE.MathUtils.damp(pull.current, target, spill ? 3.4 : 2.6, dt)
    ref.current.position.z = 0.08 + pull.current
  })

  const specimens = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const u = hash01(`d${seed}-${i}`)
      const colors = ['#e8b86a', '#7ec4a8', '#8eb4d8', '#d4a574', '#9bc48a']
      return {
        x: -0.72 + i * 0.36 + (u - 0.5) * 0.06,
        y: 0.05,
        z: -0.12,
        color: colors[i % colors.length],
        habit: (['octa', 'cube', 'hexprism', 'dodeca', 'needle'] as Habit[])[i % 5],
        s: 0.08 + u * 0.045,
      }
    })
  }, [seed])

  const tray = highlight ? '#7a6548' : open ? '#5c4c3a' : '#524536'
  const front = highlight ? '#8a7354' : '#5f5140'
  const W = 2.12
  const D = 0.88
  const H = 0.36
  const T = 0.045
  const glow = surge ? 1.7 : spill ? 1.45 : 1

  return (
    <group ref={ref} position={[0, y, 0.08]}>
      {/* tray bottom */}
      <mesh position={[0, -H / 2 + T / 2, 0]}>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial
          color={tray}
          roughness={0.7}
          emissive={highlight ? '#e8b86a' : open ? '#c4a06a' : '#000000'}
          emissiveIntensity={(highlight ? 0.28 : open ? 0.1 : 0) * glow}
        />
      </mesh>
      {/* left / right sides */}
      <mesh position={[-(W / 2 - T / 2), 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial color={tray} roughness={0.68} />
      </mesh>
      <mesh position={[W / 2 - T / 2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial color={tray} roughness={0.68} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, 0, -(D / 2 - T / 2)]}>
        <boxGeometry args={[W - T * 2, H, T]} />
        <meshStandardMaterial color={tray} roughness={0.68} />
      </mesh>
      {/* front face — taller lip like a real drawer front */}
      <mesh position={[0, 0.02, D / 2 - T / 2]}>
        <boxGeometry args={[W + 0.04, H + 0.06, T * 1.2]} />
        <meshStandardMaterial
          color={front}
          roughness={0.55}
          metalness={0.08}
          emissive={highlight ? '#e8b86a' : open ? '#c4a06a' : '#000000'}
          emissiveIntensity={(highlight ? 0.2 : open ? 0.06 : 0) * glow}
        />
      </mesh>
      {/* handle */}
      <mesh position={[0, 0.02, D / 2 + 0.03]}>
        <boxGeometry args={[0.38, 0.035, 0.035]} />
        <meshStandardMaterial color="#f0e2c0" metalness={0.55} roughness={0.28} />
      </mesh>

      {open && (
        <>
          <mesh position={[0, H / 2 - 0.02, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W * 0.88, D * 0.7]} />
            <meshBasicMaterial
              color={highlight ? '#f0c878' : '#e8b86a'}
              transparent
              opacity={(highlight ? 0.28 : 0.1) * Math.min(1.4, glow)}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <pointLight
            position={[0, 0.12, 0.15]}
            color="#f0c878"
            intensity={(highlight ? 3.2 : 0.9) * glow}
            distance={highlight ? 6.5 : 3.2}
            decay={1.4}
          />
          {highlight && (
            <pointLight
              position={[0, 0.35, 0.55]}
              color="#ffe6a8"
              intensity={(spill ? 3.6 : 2.4) * glow}
              distance={spill ? 12 : 8}
              decay={1.2}
            />
          )}
          {spill && (
            <pointLight
              position={[0, 0.25, 1.1]}
              color="#fff3c8"
              intensity={4.2}
              distance={16}
              decay={1.05}
            />
          )}
          {surge && (
            <pointLight
              position={[0, 0.2, 0.9]}
              color="#fff3c8"
              intensity={5.5}
              distance={14}
              decay={1.05}
            />
          )}
          {/* Specimens stay for hall beats; reveal lets the constellation be the light */}
          {!spill &&
            specimens.map((s, i) => (
              <group key={i} position={[s.x, s.y, s.z]} scale={s.s}>
                <CrystalMesh
                  habit={s.habit}
                  color={s.color}
                  emissive={(highlight ? 1.55 : 0.85) * (surge ? 1.35 : 1)}
                />
                {highlight && i === 2 && (
                  <pointLight
                    color={s.color}
                    intensity={2.8 * glow}
                    distance={4.5}
                    decay={1.3}
                  />
                )}
              </group>
            ))}
        </>
      )}
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

/** Hall room placement — featured cabinet sits on the back wall at local x=0. */
const ROOM_Y = -1.2
const ROOM_Z = 18
/** Featured cabinet index in densified layout (back-wall center). */
const FEATURED_CABINET = 5
const FEATURED_DRAWER = 2
/**
 * Highlight drawer mouth in hall space.
 * Cabinet FEATURED_CABINET at local (0,0,-6.5) → world z = ROOM_Z - 6.5 = 11.5;
 * open drawer mouth ~1.5 in front of carcass → z ≈ 13.05.
 */
const DRAWER_MOUTH = new THREE.Vector3(0, 0.12, 13.05)
/** Constellation nestled just inside the open tray during reveal. */
const SKY_IN_DRAWER = new THREE.Vector3(0, 0.18, 12.55)
const SKY_COLLAPSED = new THREE.Vector3(0, 0.14, 12.35)
const SKY_SCALE_REVEAL = 0.085
const SKY_SCALE_COLLAPSED = 0.018

const DIVE_PAN = {
  pos: new THREE.Vector3(0.1, 6.4, 18.6),
  look: new THREE.Vector3(0, 0.2, 13.1),
}
const DIVE_PLUNGE = {
  pos: new THREE.Vector3(0, 0.18, 12.55),
  look: new THREE.Vector3(0, 0.12, 11.2),
}

/** Collapse the celestial disc into the featured drawer (0=sky, 1=reveal, 2=collapsed). */
function ConstellationSky({
  phase,
  reduced,
  children,
}: {
  phase: Phase
  reduced: boolean
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  const amount = useRef(
    phase === 'reveal' ? 1 : phase === 'cabinets' ? 1.65 : inHallPhase(phase) ? 2 : 0,
  )

  useFrame((_, dt) => {
    if (!ref.current) return
    let target = 0
    if (phase === 'reveal') target = 1
    else if (phase === 'cabinets') target = 1.65
    else if (inHallPhase(phase)) target = 2
    amount.current = reduced ? target : THREE.MathUtils.damp(amount.current, target, 2.2, dt)
    const a = amount.current

    if (a < 1) {
      ref.current.position.set(0, 0, 0).lerp(SKY_IN_DRAWER, a)
      ref.current.scale.setScalar(THREE.MathUtils.lerp(1, SKY_SCALE_REVEAL, a))
    } else {
      const t = Math.min(1, a - 1)
      ref.current.position.copy(SKY_IN_DRAWER).lerp(SKY_COLLAPSED, t)
      ref.current.scale.setScalar(THREE.MathUtils.lerp(SKY_SCALE_REVEAL, SKY_SCALE_COLLAPSED, t))
    }
    ref.current.visible = skyVisiblePhase(phase) && a < 1.95
  })

  return (
    <group ref={ref} visible={skyVisiblePhase(phase)}>
      {children}
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
  if (phase === 'sky') {
    return {
      pos: new THREE.Vector3(Math.sin(skyYaw) * SKY_R, SKY_Y, Math.cos(skyYaw) * SKY_R),
      look: new THREE.Vector3(0, 0.2, 0),
    }
  }
  if (phase === 'reveal') {
    // Just outside the drawer mouth, looking into the tray so stars fill the aperture
    return {
      pos: new THREE.Vector3(0.05, 0.42, 15.35),
      look: DRAWER_MOUTH.clone(),
    }
  }
  if (phase === 'cabinets') {
    return {
      pos: new THREE.Vector3(0.2, 2.4, 26.5),
      look: new THREE.Vector3(0, 1.2, 18),
    }
  }
  if (phase === 'instrument') {
    return {
      pos: new THREE.Vector3(-1.2, 2.1, 24.2),
      look: new THREE.Vector3(0, 1.4, 16.5),
    }
  }
  if (phase === 'dive') {
    return { pos: DIVE_PLUNGE.pos.clone(), look: DIVE_PLUNGE.look.clone() }
  }
  return {
    pos: new THREE.Vector3(0.6, 1.55, 22.4),
    look: new THREE.Vector3(-0.2, 1.25, 17.8),
  }
}

function camEaseSec(from: Phase, to: Phase) {
  const nest =
    (from === 'sky' && to === 'reveal') ||
    (from === 'reveal' && to === 'cabinets') ||
    (from === 'reveal' && to === 'sky') ||
    (from === 'cabinets' && to === 'reveal')
  return nest ? REVEAL_CAM_EASE_SEC : CAM_EASE_SEC
}

function CameraRig({
  phase,
  focusId,
  reduced,
  scripted,
  onSettle,
  onDiveProgress,
}: {
  phase: Phase
  focusId: string | null
  reduced: boolean
  scripted: boolean
  onSettle?: (settled: boolean) => void
  /** 0–1 wash coverage during the plunge (0 while panning). */
  onDiveProgress?: (wash: number, done: boolean) => void
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
  const prevPhase = useRef(phase)
  const prevFocus = useRef(focusId)
  const skyYaw = useRef(Math.atan2(-9.6, 10.8))
  const settled = useRef(true)
  const baseFov = useRef(42)
  const easeDur = useRef(CAM_EASE_SEC)

  useFrame((_, dt) => {
    const persp = camera as THREE.PerspectiveCamera

    if (!scripted) {
      if (phase === 'sky') look.current.set(0, 0.2, 0)
      else if (phase === 'peers') look.current.copy(HERO.pos)
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
      } else {
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
    }

    if (!focus && phase === 'dive') {
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
          // Full-frame light by the end of the plunge
          const wash = Math.min(1, easeInOutCubic(Math.max(0, (raw - 0.15) / 0.55)))
          onDiveProgress?.(wash, raw >= 1)
          if (raw >= 1 && !settled.current) {
            settled.current = true
            onSettle?.(true)
          }
        }
        persp.updateProjectionMatrix()
      }
    } else if (!focus && phase === 'sky' && progress.current >= 1) {
      if (!reduced) skyYaw.current -= dt * SKY_SPIN_RAD_PER_SEC
      const g = goalForPhase('sky', skyYaw.current)
      toPos.current.copy(g.pos)
      toLook.current.copy(g.look)
      camera.position.lerp(toPos.current, 1 - Math.exp(-1.6 * dt))
      look.current.lerp(toLook.current, 1 - Math.exp(-1.6 * dt))
      if (persp.fov !== baseFov.current) {
        persp.fov = THREE.MathUtils.damp(persp.fov, 42, 3, dt)
        persp.updateProjectionMatrix()
      }
    } else if (progress.current < 1) {
      // Same yaw sense + speed as settled OrbitControls autoRotate.
      if (!focus && phase === 'sky' && !reduced) {
        skyYaw.current -= dt * SKY_SPIN_RAD_PER_SEC
        const g = goalForPhase('sky', skyYaw.current)
        toPos.current.copy(g.pos)
        toLook.current.copy(g.look)
      }
      const dur = easeDur.current
      progress.current = Math.min(1, progress.current + dt / dur)
      const u = easeInOutCubic(progress.current)
      camera.position.lerpVectors(fromPos.current, toPos.current, u)
      look.current.lerpVectors(fromLook.current, toLook.current, u)
      const goalFov = phase === 'reveal' ? 36 : 42
      if (persp.fov !== goalFov) {
        persp.fov = THREE.MathUtils.lerp(baseFov.current, goalFov, u)
        persp.updateProjectionMatrix()
      }
      if (progress.current >= 1 && !settled.current) {
        settled.current = true
        onSettle?.(true)
      }
    } else {
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
  const inHall = inHallPhase(phase)
  const revealish = phase === 'reveal'
  const [camSettled, setCamSettled] = useState(true)
  const canOrbit = phase === 'sky' || phase === 'peers'
  const orbit = active && canOrbit && !focusId && !reduced && camSettled
  const scripted = !orbit

  useEffect(() => {
    setCamSettled(reduced)
  }, [phase, focusId, reduced])

  const fogColor =
    phase === 'dive' ? '#1a1408' : revealish ? '#0a0806' : inHall ? '#0c0b09' : '#030303'
  const fogNear = revealish ? 6 : inHall ? 22 : 14
  const fogFar = revealish ? 38 : inHall ? 55 : 44

  return (
    <>
      <color attach="background" args={[revealish || inHall ? '#0a0806' : '#030303']} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
      <ambientLight
        intensity={
          phase === 'dive' ? 0.5 : revealish ? 0.28 : inHall ? 0.38 : 0.22
        }
      />
      <directionalLight
        position={[4, 8, 3]}
        intensity={phase === 'dive' ? 1.15 : revealish ? 0.55 : inHall ? 0.95 : 0.62}
        color="#f2e6c8"
      />
      <pointLight
        position={revealish ? DRAWER_MOUTH.toArray() : [0, 2, 2]}
        intensity={phase === 'dive' ? 1.1 : revealish ? 1.6 : inHall ? 0.7 : 0.45}
        color="#e8b86a"
        distance={revealish ? 28 : 24}
      />
      {(phase === 'dive' || phase === 'reveal') && (
        <pointLight
          position={DRAWER_MOUTH.toArray()}
          intensity={phase === 'reveal' ? 3.8 : 4.5}
          color="#fff0c0"
          distance={16}
        />
      )}

      <Stars
        radius={80}
        depth={40}
        count={reduced ? 800 : revealish || inHall ? 1200 : 2800}
        factor={revealish ? 2.4 : 3.2}
        saturation={0}
        fade
        speed={reduced || inHall ? 0 : 0.35}
      />

      <CameraRig
        phase={phase}
        focusId={focusId}
        reduced={reduced}
        scripted={scripted}
        onSettle={setCamSettled}
        onDiveProgress={onDiveProgress}
      />

      <ConstellationSky phase={phase} reduced={reduced}>
        {BODIES.map((body) => (
          <MineralBody
            key={body.id}
            body={body}
            phase={phase}
            focused={focusId === body.id}
            reduced={reduced}
            onSelect={(id) => setFocusId(focusId === id ? null : id)}
          />
        ))}
      </ConstellationSky>

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
          far: 120,
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
          One drawer · light spilling
        </div>
      )}
      {(phase === 'cabinets' || phase === 'instrument' || phase === 'turn') && (
        <div className={styles.constellationHint} data-idle="">
          Collection hall · one tray glowing
        </div>
      )}
    </div>
  )
}
