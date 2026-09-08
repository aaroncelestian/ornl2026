import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import { STRUCTURE_DPR, STRUCTURE_GL_OPAQUE } from '../../lib/structureCanvas'
import data from '../../data/mineralConstellation.json'
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

type Phase = 'peri' | 'peers' | 'sky' | 'cabinets' | 'instrument' | 'turn'

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
  if (id === 'cabinets') return 'cabinets'
  if (id === 'instrument') return 'instrument'
  if (id === 'turn') return 'turn'
  return 'peri'
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
  const inCabinets = phase === 'cabinets' || phase === 'instrument' || phase === 'turn'

  const visible =
    focused ||
    isHero ||
    (isPeer && phase !== 'peri') ||
    phase === 'sky' ||
    phase === 'peers' ||
    inCabinets

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

  const showCrystal = focused || isHero || isPeer || phase === 'sky'

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
      {(isHero || isPeer || focused) && (
        <mesh>
          <sphereGeometry args={[1.55, 16, 16]} />
          <meshBasicMaterial color={body.color} transparent opacity={0.08} depthWrite={false} />
        </mesh>
      )}
      {showCrystal ? (
        <CrystalMesh
          habit={body.habit}
          color={body.color}
          emissive={focused ? 0.95 : isHero ? 0.7 : isPeer ? 0.55 : 0.28}
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
  const show = phase === 'cabinets' || phase === 'instrument' || phase === 'turn'
  const group = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    if (!group.current) return
    const target = show ? 1 : 0
    const cur = group.current.scale.x
    const next = reduced ? target : THREE.MathUtils.damp(cur, target, 2.4, dt)
    group.current.scale.setScalar(Math.max(0.001, next))
    group.current.visible = next > 0.02
    group.current.position.y = THREE.MathUtils.lerp(-2.4, -1.2, next)
  })

  const cabinets = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = []
    for (let i = 0; i < 7; i++) out.push({ x: -9 + i * 3, z: -6.5, rot: 0 })
    for (let i = 0; i < 3; i++) out.push({ x: -10.5, z: -4 + i * 3.2, rot: Math.PI / 2 })
    for (let i = 0; i < 3; i++) out.push({ x: 10.5, z: -4 + i * 3.2, rot: -Math.PI / 2 })
    return out
  }, [])

  return (
    <group ref={group} position={[0, -1.2, 18]} scale={0.001} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[40, 28]} />
        <meshStandardMaterial color="#2a241c" roughness={0.9} metalness={0.04} />
      </mesh>
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
}: {
  index: number
  x: number
  z: number
  rotY: number
  phase: Phase
  reduced: boolean
}) {
  const drawers = 6
  const openSet =
    phase === 'turn'
      ? new Set([2])
      : phase === 'instrument'
        ? new Set([1, 3, 4])
        : new Set([2, 4])
  const isFeature = index === 3 || index === 1 || index === 8
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
        const wantOpen = isFeature && openSet.has(di)
        return (
          <Drawer
            key={di}
            y={y}
            open={wantOpen}
            highlight={phase === 'turn' && index === 3 && di === 2}
            reduced={reduced}
            seed={index * 10 + di}
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
  reduced,
  seed,
}: {
  y: number
  open: boolean
  highlight: boolean
  reduced: boolean
  seed: number
}) {
  const ref = useRef<THREE.Group>(null)
  const pull = useRef(0)

  useFrame((_, dt) => {
    if (!ref.current) return
    const target = open ? (highlight ? 1.05 : 0.72) : 0
    pull.current = reduced ? target : THREE.MathUtils.damp(pull.current, target, 2.6, dt)
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

  return (
    <group ref={ref} position={[0, y, 0.08]}>
      {/* tray bottom */}
      <mesh position={[0, -H / 2 + T / 2, 0]}>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial
          color={tray}
          roughness={0.7}
          emissive={highlight ? '#e8b86a' : open ? '#c4a06a' : '#000000'}
          emissiveIntensity={highlight ? 0.28 : open ? 0.1 : 0}
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
          emissiveIntensity={highlight ? 0.2 : open ? 0.06 : 0}
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
              opacity={highlight ? 0.4 : 0.16}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0.08, D / 2 + 0.12]}>
            <sphereGeometry args={[highlight ? 0.48 : 0.28, 12, 12]} />
            <meshBasicMaterial
              color={highlight ? '#f2d08a' : '#e0b87a'}
              transparent
              opacity={highlight ? 0.26 : 0.1}
              depthWrite={false}
            />
          </mesh>
          <pointLight
            position={[0, 0.12, 0.15]}
            color="#f0c878"
            intensity={highlight ? 3.2 : 0.9}
            distance={highlight ? 6.5 : 3.2}
            decay={1.4}
          />
          {highlight && (
            <pointLight
              position={[0, 0.35, 0.55]}
              color="#ffe6a8"
              intensity={2.4}
              distance={8}
              decay={1.2}
            />
          )}
          {specimens.map((s, i) => (
            <group key={i} position={[s.x, s.y, s.z]} scale={s.s}>
              <CrystalMesh habit={s.habit} color={s.color} emissive={highlight ? 1.55 : 0.85} />
              {highlight && i === 2 && (
                <pointLight color={s.color} intensity={2.8} distance={4.5} decay={1.3} />
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
const SKY_R = 14.4
const SKY_Y = 3.1

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
  return {
    pos: new THREE.Vector3(0.6, 1.55, 22.4),
    look: new THREE.Vector3(-0.2, 1.25, 17.8),
  }
}

function CameraRig({
  phase,
  focusId,
  reduced,
  scripted,
  onSettle,
}: {
  phase: Phase
  focusId: string | null
  reduced: boolean
  scripted: boolean
  onSettle?: (settled: boolean) => void
}) {
  const { camera } = useThree()
  const focus = BODIES.find((b) => b.id === focusId) ?? null
  const look = useRef(new THREE.Vector3().copy(HERO.pos))
  const fromPos = useRef(new THREE.Vector3(HERO.pos.x + 0.2, HERO.pos.y + 0.42, HERO.pos.z + 2.35))
  const fromLook = useRef(new THREE.Vector3().copy(HERO.pos))
  const toPos = useRef(new THREE.Vector3(HERO.pos.x + 0.2, HERO.pos.y + 0.42, HERO.pos.z + 2.35))
  const toLook = useRef(new THREE.Vector3().copy(HERO.pos))
  const progress = useRef(1)
  const prevPhase = useRef(phase)
  const prevFocus = useRef(focusId)
  const skyYaw = useRef(Math.atan2(-9.6, 10.8))
  const settled = useRef(true)

  useFrame((_, dt) => {
    if (!scripted) {
      // OrbitControls owns the camera; keep look in sync for the next scripted ease
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
      if (focus) {
        toPos.current.set(focus.pos.x + 1.6, focus.pos.y + 0.9, focus.pos.z + 2.4)
        toLook.current.copy(focus.pos)
      } else {
        if (phase === 'sky') {
          // Continue from current azimuth so peri → sky does not whip sideways
          skyYaw.current = Math.atan2(camera.position.x - 0, camera.position.z - 0)
          if (!Number.isFinite(skyYaw.current)) skyYaw.current = Math.atan2(-9.6, 10.8)
        }
        const g = goalForPhase(phase, skyYaw.current)
        toPos.current.copy(g.pos)
        toLook.current.copy(g.look)
      }
      progress.current = reduced ? 1 : 0
      prevPhase.current = phase
      prevFocus.current = focusId
      if (settled.current) {
        settled.current = false
        onSettle?.(false)
      }
    }

    if (!focus && phase === 'sky' && progress.current >= 1) {
      if (!reduced) skyYaw.current += dt * 0.055
      const g = goalForPhase('sky', skyYaw.current)
      toPos.current.copy(g.pos)
      toLook.current.copy(g.look)
      camera.position.lerp(toPos.current, 1 - Math.exp(-1.6 * dt))
      look.current.lerp(toLook.current, 1 - Math.exp(-1.6 * dt))
    } else if (progress.current < 1) {
      const dur = focus ? CAM_EASE_SEC * 0.55 : CAM_EASE_SEC
      progress.current = Math.min(1, progress.current + dt / dur)
      const u = easeInOutCubic(progress.current)
      camera.position.lerpVectors(fromPos.current, toPos.current, u)
      look.current.lerpVectors(fromLook.current, toLook.current, u)
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
}: {
  active: boolean
  phase: Phase
  focusId: string | null
  setFocusId: (id: string | null) => void
  reduced: boolean
}) {
  const inHall = phase === 'cabinets' || phase === 'instrument' || phase === 'turn'
  const [camSettled, setCamSettled] = useState(true)
  const canOrbit = phase === 'sky' || phase === 'peers'
  const orbit = active && canOrbit && !focusId && !reduced && camSettled
  const scripted = !orbit

  useEffect(() => {
    setCamSettled(reduced)
  }, [phase, focusId, reduced])

  return (
    <>
      <color attach="background" args={['#030303']} />
      <fog attach="fog" args={[inHall ? '#0c0b09' : '#030303', inHall ? 22 : 14, inHall ? 55 : 44]} />
      <ambientLight intensity={inHall ? 0.38 : 0.22} />
      <directionalLight position={[4, 8, 3]} intensity={inHall ? 0.95 : 0.62} color="#f2e6c8" />
      <pointLight position={[0, 2, 2]} intensity={inHall ? 0.7 : 0.45} color="#e8b86a" distance={24} />

      <Stars
        radius={80}
        depth={40}
        count={reduced ? 800 : 2800}
        factor={3.2}
        saturation={0}
        fade
        speed={reduced ? 0 : 0.35}
      />

      <CameraRig
        phase={phase}
        focusId={focusId}
        reduced={reduced}
        scripted={scripted}
        onSettle={setCamSettled}
      />

      <group visible={!inHall}>
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
      </group>

      <CabinetsRoom phase={phase} reduced={reduced} />

      <OrbitControls
        enabled={orbit}
        enablePan={false}
        enableZoom
        autoRotate={orbit && phase === 'sky'}
        autoRotateSpeed={0.42}
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
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'sky') setFocusId(null)
  }, [phase])

  useEffect(() => {
    if (!active) setFocusId(null)
  }, [active])

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
          />
        </Suspense>
      </Canvas>

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
      {(phase === 'cabinets' || phase === 'instrument' || phase === 'turn') && (
        <div className={styles.constellationHint} data-idle="">
          Collection hall · drawers open
        </div>
      )}
    </div>
  )
}
