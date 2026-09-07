import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import spinel from '../../data/lmoSpinel.json'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { VIBE_SYNTH, type CubaneVibe } from '../../lib/smoothSeries'
import styles from './Motifs.module.css'

export const MN_COLOR = '#8b5cad'
export const O_COLOR = '#c45a3a'
export const ARROW_MN = '#c4894a'
export const ARROW_O = '#7ec4d4'

export type CubaneData = {
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
    const shaftMid = start.clone().addScaledVector(u, baseLen * 0.5 * (0.85 + amp * 0.35))
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
 * A₁g: Mn and core O displace radially. Disorder / mute follow the Raman playhead.
 */
export function CubaneUnit({
  cubane,
  active,
  reduced,
  vibeOn,
  vibe = VIBE_SYNTH,
  atOrigin = false,
}: {
  cubane: CubaneData
  active: boolean
  reduced: boolean
  vibeOn: boolean
  vibe?: CubaneVibe
  atOrigin?: boolean
}) {
  const breath = useRef(0)
  const atomGroup = useRef<THREE.Group>(null)
  const vibeRef = useRef(vibe)
  vibeRef.current = vibe

  const center = cubane.center as [number, number, number]
  const mnLocal = useMemo(
    () => cubane.mn.map((m) => [m[0] - center[0], m[1] - center[1], m[2] - center[2]] as [number, number, number]),
    [cubane.mn, center],
  )
  const coreLocal = useMemo(
    () =>
      cubane.coreO.map((o) => [o[0] - center[0], o[1] - center[1], o[2] - center[2]] as [number, number, number]),
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
    const root = atomGroup.current
    if (!root) return
    const live = vibeRef.current
    const on = active && !reduced && vibeOn
    const strength = on ? live.amp * (1 - live.mute) : 0
    const time = clock.getElapsedTime()
    let idx = 0
    const place = (local: [number, number, number], radial: number, i: number) => {
      const child = root.children[idx++]
      if (!child) return
      const u = new THREE.Vector3(...local)
      const len = u.length() || 1
      u.multiplyScalar(1 / len)
      const phase = live.disorder > 0.02 ? i * 2.17 : 0
      const hz = live.hz * (1 + live.disorder * (((i * 3) % 5) - 2) * 0.11)
      const s = on ? Math.sin(time * Math.PI * 2 * hz + phase) * strength : 0
      let jx = 0
      let jy = 0
      let jz = 0
      if (live.disorder > 0.15 && on) {
        const px = u.y * 0.55 - u.z * 0.35
        const py = u.z * 0.55 - u.x * 0.35
        const pz = u.x * 0.55 - u.y * 0.35
        const plen = Math.hypot(px, py, pz) || 1
        const jitter = Math.sin(time * Math.PI * 2 * (hz + 0.37) + i * 1.7) * strength * live.disorder * 0.7
        jx = (px / plen) * jitter
        jy = (py / plen) * jitter
        jz = (pz / plen) * jitter
      }
      child.position.set(
        local[0] + u.x * s * radial + jx,
        local[1] + u.y * s * radial + jy,
        local[2] + u.z * s * radial + jz,
      )
      if (i === 0) breath.current = s
    }
    mnLocal.forEach((m, i) => place(m, 0.22, i))
    coreLocal.forEach((o, i) => place(o, 0.18, i + 4))
  })

  const arrowAmp = active && !reduced && vibeOn ? 0.25 + 0.75 * vibe.amp * (1 - vibe.mute) : 0.28
  const showArrows = vibeOn && vibe.disorder < 0.55 && vibe.mute < 0.55

  return (
    <group position={atOrigin ? [0, 0, 0] : center}>
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

      {showArrows &&
        mnLocal.map((m, i) => (
          <ModeArrow key={`amn-${i}`} from={m} dir={new THREE.Vector3(...m)} color={ARROW_MN} amp={arrowAmp} />
        ))}
      {showArrows &&
        coreLocal.map((o, i) => (
          <ModeArrow key={`ao-${i}`} from={o} dir={new THREE.Vector3(...o)} color={ARROW_O} amp={arrowAmp} />
        ))}
    </group>
  )
}

function InsetScene({
  active,
  reduced,
  vibe,
}: {
  active: boolean
  reduced: boolean
  vibe: CubaneVibe
}) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!group.current || !active || reduced) return
    group.current.rotation.y += dt * 0.18
  })
  const cubane = spinel.cubanes[0] as CubaneData | undefined
  if (!cubane) return null
  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[4, 6, 3]} intensity={1.5} color="#fff3dc" />
      <directionalLight position={[-3, 1, -4]} intensity={0.48} color="#9ec4d4" />
      <directionalLight position={[1, -3, 4]} intensity={0.28} color="#f0c878" />
      <group ref={group}>
        <CubaneUnit cubane={cubane} active={active} reduced={reduced} vibeOn vibe={vibe} atOrigin />
      </group>
    </>
  )
}

export function CubaneInset({
  active,
  vibe,
  caption,
  open,
}: {
  active: boolean
  vibe: CubaneVibe
  caption?: string
  open?: boolean
}) {
  const reduced = usePrefersReducedMotion()
  return (
    <div className={styles.cubaneDock} data-open={open || undefined} aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: open ? [3.4, 2.0, 4.2] : [2.55, 1.55, 3.15], fov: open ? 32 : 36 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <Suspense fallback={null}>
          <InsetScene active={active} reduced={reduced} vibe={vibe} />
        </Suspense>
      </Canvas>
      {caption && <div className={styles.cubaneCap}>{caption}</div>}
    </div>
  )
}
