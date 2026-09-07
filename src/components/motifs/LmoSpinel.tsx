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
const POLY_COLOR = '#9a6ab8'
const VOID_COLOR = '#e0b15c'
const LI_COLOR = '#6ecf7a'
const CUBANE_COLOR = '#f0c878'

type Phase = 'framework' | 'voids' | 'lithium' | 'cubane'

function phaseForBeat(id?: string): Phase {
  if (id === 'voids') return 'voids'
  if (id === '8a') return 'lithium'
  if (id === 'cubane') return 'cubane'
  return 'framework'
}

const CAPTION: Record<Phase, string> = {
  framework: 'LiMn₂O₄ · MnO₆ polyhedra · drag to orbit',
  voids: 'Interstitial void network · 8a channels open',
  lithium: 'Li in tetrahedral 8a voids',
  cubane: 'A₁g · Mn₄O₄ cubane symmetric stretch',
}

function CellWire({ size }: { size: number }) {
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
        <Line key={i} points={points} color="#d4a04a" lineWidth={1} transparent opacity={0.28} />
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

function VoidMesh({ opacity }: { opacity: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.void.positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.void.normals, 3))
    geo.setIndex(data.void.index)
    return geo
  }, [])

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color={VOID_COLOR}
        transparent
        opacity={opacity}
        roughness={0.35}
        metalness={0.05}
        transmission={0.15}
        thickness={0.4}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function CubaneBreath({
  cubane,
  active,
  reduced,
}: {
  cubane: { center: number[]; mn: number[][] }
  active: boolean
  reduced: boolean
}) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const root = group.current
    if (!root) return
    if (!active || reduced) {
      root.scale.setScalar(1)
      return
    }
    const t = clock.getElapsedTime()
    root.scale.setScalar(1 + Math.sin(t * Math.PI * 2 * 1.15) * 0.07)
  })

  const center = cubane.center as [number, number, number]
  return (
    <group ref={group} position={center}>
      {cubane.mn.map((mn, i) => {
        const local: [number, number, number] = [mn[0] - center[0], mn[1] - center[1], mn[2] - center[2]]
        return (
          <group key={i}>
            <mesh position={local}>
              <sphereGeometry args={[0.28, 16, 16]} />
              <meshStandardMaterial color={CUBANE_COLOR} emissive={CUBANE_COLOR} emissiveIntensity={0.35} />
            </mesh>
            <Line
              points={[
                [0, 0, 0],
                local,
              ]}
              color={CUBANE_COLOR}
              lineWidth={2}
              transparent
              opacity={0.75}
            />
          </group>
        )
      })}
      <mesh>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#f3eee4" emissive="#f3eee4" emissiveIntensity={0.4} />
      </mesh>
    </group>
  )
}

function Scene({ active, phase }: { active: boolean; phase: Phase }) {
  const group = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const cell = data.cell.a * SCALE

  const showVoids = phase === 'voids' || phase === 'lithium' || phase === 'cubane'
  const showLi = phase === 'lithium' || phase === 'cubane'
  const showCubane = phase === 'cubane'
  const polyOpacity = phase === 'framework' ? 0.72 : phase === 'voids' ? 0.38 : 0.28

  useFrame((_, dt) => {
    const root = group.current
    if (!root || !active || reduced) return
    if (phase !== 'cubane') root.rotation.y += dt * 0.1
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 8, 4]} intensity={1.15} />
      <directionalLight position={[-4, 2, -6]} intensity={0.35} />
      <group ref={group} scale={SCALE}>
        <CellWire size={data.cell.a} />
        {data.polyhedra.map((poly, i) => (
          <Polyhedron key={i} vertices={poly.vertices} faces={poly.faces} opacity={polyOpacity} />
        ))}
        {showVoids && <VoidMesh opacity={phase === 'voids' ? 0.55 : 0.28} />}
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
        {showCubane &&
          data.cubanes.slice(0, 2).map((c, i) => (
            <CubaneBreath key={i} cubane={c} active={active} reduced={reduced} />
          ))}
      </group>
      <OrbitControls enablePan={false} minDistance={cell * 1.4} maxDistance={cell * 4.5} makeDefault />
    </>
  )
}

export function LmoSpinel({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const phase = phaseForBeat(scene.beat?.id)

  const legend =
    phase === 'framework'
      ? [{ color: POLY_COLOR, label: 'MnO₆' }]
      : phase === 'voids'
        ? [
            { color: POLY_COLOR, label: 'MnO₆' },
            { color: VOID_COLOR, label: 'void' },
          ]
        : phase === 'lithium'
          ? [
              { color: POLY_COLOR, label: 'MnO₆' },
              { color: VOID_COLOR, label: 'void' },
              { color: LI_COLOR, label: 'Li (8a)' },
            ]
          : [
              { color: POLY_COLOR, label: 'MnO₆' },
              { color: LI_COLOR, label: 'Li (8a)' },
              { color: CUBANE_COLOR, label: 'A₁g cubane' },
            ]

  return (
    <div className={styles.crystal} aria-label={label || 'LMO spinel MnO6 polyhedra and interstitial voids'}>
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
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene active={active} phase={phase} />
        </Suspense>
      </Canvas>
      <div className={styles.crystalCaption}>
        <span data-on="">{CAPTION[phase]}</span>
      </div>
    </div>
  )
}
