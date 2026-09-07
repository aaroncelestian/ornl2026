import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import data from '../../data/lmoSpinel.json'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import styles from './Motifs.module.css'

const SCALE = 0.55
const HOME = new THREE.Vector3(4.2, 2.6, 5.8)
/** ¾ view that keeps Mn–O framework readable under the pore surface */
const VOID_HOME = new THREE.Vector3(4.6, 3.1, 5.4)
const POLY_COLOR = '#9a6ab8'
const VOID_PORE = '#9eb8c8'
const VOID_IN = '#e0b15c'
const LI_COLOR = '#6ecf7a'
const MN_COLOR = '#8b5cad'
const O_COLOR = '#c45a3a'
const ARROW_MN = '#c4894a'
const ARROW_O = '#7ec4d4'

type Phase = 'framework' | 'voids' | 'lithium' | 'cubane'

function phaseForBeat(id?: string): Phase {
  if (id === 'voids') return 'voids'
  if (id === '8a') return 'lithium'
  if (id === 'cubane') return 'cubane'
  return 'framework'
}

const CAPTION: Record<Phase, string> = {
  framework: 'LiMn₂O₄ · MnO₆ polyhedra · drag to orbit',
  voids: 'Pore space · Mn–O framework · Li removed',
  lithium: 'Li in tetrahedral 8a voids',
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

function Polyhedron({
  vertices,
  faces,
  opacity,
}: {
  vertices: number[][]
  faces: number[][]
  opacity: number
}) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const normals: number[] = []
    for (const face of faces) {
      const a = new THREE.Vector3(...vertices[face[0]])
      const b = new THREE.Vector3(...vertices[face[1]])
      const c = new THREE.Vector3(...vertices[face[2]])
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
      for (const v of [a, b, c]) {
        positions.push(v.x, v.y, v.z)
        normals.push(n.x, n.y, n.z)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    return geo
  }, [vertices, faces])

  const edges = useMemo(() => {
    const segs: [[number, number, number], [number, number, number]][] = []
    const seen = new Set<string>()
    for (const face of faces) {
      for (let i = 0; i < 3; i++) {
        const ia = face[i]
        const ib = face[(i + 1) % 3]
        const key = ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`
        if (seen.has(key)) continue
        seen.add(key)
        segs.push([
          vertices[ia] as [number, number, number],
          vertices[ib] as [number, number, number],
        ])
      }
    }
    return segs
  }, [vertices, faces])

  if (opacity < 0.04) return null

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={POLY_COLOR}
          transparent
          opacity={opacity}
          roughness={0.45}
          metalness={0.15}
          side={THREE.DoubleSide}
          depthWrite={opacity > 0.55}
        />
      </mesh>
      {edges.map((pts, i) => (
        <Line key={i} points={pts} color="#d4b8e8" lineWidth={1} transparent opacity={opacity * 0.85} />
      ))}
    </group>
  )
}

function VoidSurface({ pore }: { pore: boolean }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.void.positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.void.normals, 3))
    geo.setIndex(data.void.index)
    return geo
  }, [])

  // Pore beat: translucent blue continuum around the Mn–O framework (Li removed)
  if (pore) {
    return (
      <mesh geometry={geometry} renderOrder={1}>
        <meshPhysicalMaterial
          color={VOID_PORE}
          transparent
          opacity={0.34}
          roughness={0.55}
          metalness={0.04}
          transmission={0.28}
          thickness={0.65}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    )
  }

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color={VOID_IN}
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

function OxygenAtoms({ opacity = 1 }: { opacity?: number }) {
  if (opacity < 0.04) return null
  return (
    <group>
      {data.oxygen.map((ox, i) => (
        <mesh key={i} position={[ox.x, ox.y, ox.z]}>
          <sphereGeometry args={[0.28, 18, 18]} />
          <meshStandardMaterial
            color={O_COLOR}
            roughness={0.35}
            metalness={0.1}
            transparent={opacity < 0.98}
            opacity={opacity}
            depthWrite={opacity > 0.7}
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
}: {
  cubane: CubaneData
  active: boolean
  reduced: boolean
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
    const t = active && !reduced ? Math.sin(clock.getElapsedTime() * Math.PI * 2 * 1.05) : 0
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

  const amp = active && !reduced ? 0.5 + 0.5 * Math.max(0, breath.current) : 0.35

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

      {/* A₁g arrows — Mn copper, core O mineral blue — both outward */}
      {mnLocal.map((m, i) => (
        <ModeArrow
          key={`amn-${i}`}
          from={m}
          dir={new THREE.Vector3(...m)}
          color={ARROW_MN}
          amp={amp}
        />
      ))}
      {coreLocal.map((o, i) => (
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

function Scene({ active, phase }: { active: boolean; phase: Phase }) {
  const group = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const cell = data.cell.a * SCALE
  const poreView = phase === 'voids'
  const cubaneFocus = phase === 'cubane'

  const showVoids = phase === 'voids' || phase === 'lithium'
  const showLi = phase === 'lithium'
  const showCubane = phase === 'cubane'
  const showPoly = phase === 'framework' || phase === 'voids' || phase === 'lithium'
  const showOxygen = phase === 'voids'
  const polyOpacity = phase === 'framework' ? 0.72 : phase === 'voids' ? 0.58 : 0.32

  const heroCubane = data.cubanes[0] as CubaneData

  useFrame((_, dt) => {
    const root = group.current
    if (!root || !active || reduced) return
    if (cubaneFocus) root.rotation.y += dt * 0.12
    else root.rotation.y += dt * (poreView ? 0.06 : 0.1)
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={cubaneFocus ? 0.4 : poreView ? 0.48 : 0.55} />
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
      {cubaneFocus && <directionalLight position={[2, -4, 5]} intensity={0.32} color="#f0c878" />}
      <group ref={group} scale={SCALE}>
        {!cubaneFocus && !poreView && <CellWire size={data.cell.a} opacity={0.28} />}
        {showPoly &&
          data.polyhedra.map((poly, i) => (
            <Polyhedron key={i} vertices={poly.vertices} faces={poly.faces} opacity={polyOpacity} />
          ))}
        {showOxygen && <OxygenAtoms />}
        {showVoids && <VoidSurface pore={poreView} />}
        {showLi &&
          data.lithium.map((li, i) => (
            <mesh key={i} position={[li.x, li.y, li.z]}>
              <sphereGeometry args={[0.42, 18, 18]} />
              <meshStandardMaterial
                color={LI_COLOR}
                emissive={LI_COLOR}
                emissiveIntensity={0.45}
                roughness={0.3}
                metalness={0.1}
                transparent
                opacity={0.92}
              />
            </mesh>
          ))}
        {showCubane && heroCubane && (
          <CubaneUnit cubane={heroCubane} active={active} reduced={reduced} />
        )}
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={cell * (cubaneFocus ? 0.85 : 1.25)}
        maxDistance={cell * 4.5}
        makeDefault
      />
    </>
  )
}

function CameraHome({ phase }: { phase: Phase }) {
  const prev = useRef<Phase | null>(null)
  const cubaneHome = useMemo(() => {
    const c = data.cubanes[0]?.center
    if (!c) return new THREE.Vector3(3.2, 2.4, 4.2)
    // Orbit a bit off the cubane center
    return new THREE.Vector3(c[0] * SCALE + 2.8, c[1] * SCALE + 2.2, c[2] * SCALE + 3.4)
  }, [])
  const cubaneTarget = useMemo(() => {
    const c = data.cubanes[0]?.center
    if (!c) return new THREE.Vector3(0, 0, 0)
    return new THREE.Vector3(c[0] * SCALE, c[1] * SCALE, c[2] * SCALE)
  }, [])

  useFrame(({ camera }) => {
    if (prev.current === phase) return
    const targetPos = phase === 'voids' ? VOID_HOME : phase === 'cubane' ? cubaneHome : HOME
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

export function LmoSpinel({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const phase = phaseForBeat(scene.beat?.id)

  const legend =
    phase === 'framework'
      ? [{ color: POLY_COLOR, label: 'MnO₆' }]
      : phase === 'voids'
        ? [
            { color: POLY_COLOR, label: 'Mn' },
            { color: O_COLOR, label: 'O' },
          ]
        : phase === 'lithium'
          ? [
              { color: POLY_COLOR, label: 'MnO₆' },
              { color: VOID_IN, label: 'void' },
              { color: LI_COLOR, label: 'Li (8a)' },
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
        camera={{ position: (phase === 'voids' ? VOID_HOME : HOME).toArray(), fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <CameraHome phase={phase} />
          <Scene active={active} phase={phase} />
        </Suspense>
      </Canvas>
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
