import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import spinel from '../../data/lmoSpinel.json'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { VIBE_SYNTH, type CubaneVibe } from '../../lib/smoothSeries'
import styles from './Motifs.module.css'

export const MN_COLOR = '#8b5cad'
export const O_COLOR = '#c45a3a'

export type CubaneData = {
  center: number[]
  mn: number[][]
  coreO: number[][]
  terminalO: number[][]
  bonds: { mn: number; o: number[]; core: boolean }[]
}

type LiveBond = {
  mn: number
  oKind: 'core' | 'term'
  o: number
  rest: number
}

const _Y_UP = new THREE.Vector3(0, 1, 0)
const _DIR = new THREE.Vector3()
const _QUAT = new THREE.Quaternion()

function nearKey(p: [number, number, number]) {
  return `${p[0].toFixed(3)},${p[1].toFixed(3)},${p[2].toFixed(3)}`
}

function nearestIndex(pts: [number, number, number][], target: [number, number, number]) {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - target[0], pts[i][1] - target[1], pts[i][2] - target[2])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
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
  if (towardA) mesh.position.set((ax + mx) * 0.5, (ay + my) * 0.5, (az + mz) * 0.5)
  else mesh.position.set((bx + mx) * 0.5, (by + my) * 0.5, (bz + mz) * 0.5)
  mesh.quaternion.copy(_QUAT)
  mesh.scale.set(1, live / rest, 1)
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
  const atomGroup = useRef<THREE.Group>(null)
  const bondA = useRef<(THREE.Mesh | null)[]>([])
  const bondB = useRef<(THREE.Mesh | null)[]>([])
  const mnLive = useRef<THREE.Vector3[]>([])
  const coreLive = useRef<THREE.Vector3[]>([])
  const termLive = useRef<THREE.Vector3[]>([])
  const vibeRef = useRef(vibe)
  vibeRef.current = vibe
  const liveVibe = useRef({ ...vibe })
  const wave = useRef(0)
  const radial = useRef(new THREE.Vector3())

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
  const liveBonds = useMemo<LiveBond[]>(() => {
    const coreMap = new Map(coreLocal.map((o, i) => [nearKey(o), i]))
    const termMap = new Map(termLocal.map((o, i) => [nearKey(o), i]))
    return cubane.bonds.map((b) => {
      const oLocal: [number, number, number] = [
        b.o[0] - center[0],
        b.o[1] - center[1],
        b.o[2] - center[2],
      ]
      const key = nearKey(oLocal)
      const oKind: 'core' | 'term' = b.core ? 'core' : 'term'
      const o =
        oKind === 'core'
          ? (coreMap.get(key) ?? nearestIndex(coreLocal, oLocal))
          : (termMap.get(key) ?? nearestIndex(termLocal, oLocal))
      const mn = mnLocal[b.mn]
      const rest = Math.hypot(mn[0] - oLocal[0], mn[1] - oLocal[1], mn[2] - oLocal[2]) || 1
      return { mn: b.mn, oKind, o, rest }
    })
  }, [cubane.bonds, mnLocal, coreLocal, termLocal, center])

  const termOwners = useMemo(() => {
    const owners: number[][] = termLocal.map(() => [])
    for (const bond of liveBonds) {
      if (bond.oKind === 'term') owners[bond.o].push(bond.mn)
    }
    return owners.map((list, i) =>
      list.length ? list : [nearestIndex(mnLocal, termLocal[i])],
    )
  }, [liveBonds, termLocal, mnLocal])

  if (mnLive.current.length !== mnLocal.length) {
    mnLive.current = mnLocal.map((m) => new THREE.Vector3(...m))
  }
  if (coreLive.current.length !== coreLocal.length) {
    coreLive.current = coreLocal.map((o) => new THREE.Vector3(...o))
  }
  if (termLive.current.length !== termLocal.length) {
    termLive.current = termLocal.map((o) => new THREE.Vector3(...o))
  }

  useFrame((_, dt) => {
    const root = atomGroup.current
    if (!root) return
    const want = vibeRef.current
    const live = liveVibe.current
    live.hz = THREE.MathUtils.damp(live.hz, want.hz, 2.4, dt)
    live.amp = THREE.MathUtils.damp(live.amp, want.amp, 2.8, dt)
    live.disorder = THREE.MathUtils.damp(live.disorder, want.disorder, 2.6, dt)
    live.mute = THREE.MathUtils.damp(live.mute, want.mute, 2.8, dt)
    live.split = THREE.MathUtils.damp(live.split ?? 0, want.split ?? 0, 2.6, dt)
    const on = active && !reduced && vibeOn
    const strength = on ? live.amp * (1 - live.mute) : 0
    wave.current += dt * live.hz
    const theta = wave.current * Math.PI * 2
    const displace = (
      local: [number, number, number],
      scale: number,
      i: number,
      out: THREE.Vector3,
    ) => {
      const u = radial.current.set(local[0], local[1], local[2])
      const len = u.length() || 1
      u.multiplyScalar(1 / len)
      const pair = i % 2
      const split = live.split ?? 0
      const phase = (live.disorder > 0.02 ? i * 2.17 : 0) + split * pair * Math.PI
      const hzScale =
        (1 + live.disorder * (((i * 3) % 5) - 2) * 0.11) * (1 + split * (pair === 0 ? 0.16 : -0.2))
      const s = on ? Math.sin(theta * hzScale + phase) * strength : 0
      let jx = 0
      let jy = 0
      let jz = 0
      if (live.disorder > 0.15 && on) {
        const px = u.y * 0.55 - u.z * 0.35
        const py = u.z * 0.55 - u.x * 0.35
        const pz = u.x * 0.55 - u.y * 0.35
        const plen = Math.hypot(px, py, pz) || 1
        const jitter = Math.sin(theta * hzScale + i * 1.7) * strength * live.disorder * 0.7
        jx = (px / plen) * jitter
        jy = (py / plen) * jitter
        jz = (pz / plen) * jitter
      }
      out.set(
        local[0] + u.x * s * scale + jx,
        local[1] + u.y * s * scale + jy,
        local[2] + u.z * s * scale + jz,
      )
    }

    mnLocal.forEach((m, i) => {
      displace(m, 0.22, i, mnLive.current[i])
      const child = root.children[i]
      if (child) child.position.copy(mnLive.current[i])
    })
    coreLocal.forEach((o, i) => {
      displace(o, 0.18, i + 4, coreLive.current[i])
      const child = root.children[mnLocal.length + i]
      if (child) child.position.copy(coreLive.current[i])
    })
    termLocal.forEach((o, i) => {
      const owners = termOwners[i]
      let dx = 0
      let dy = 0
      let dz = 0
      for (const mn of owners) {
        const rest = mnLocal[mn]
        const liveMn = mnLive.current[mn]
        dx += liveMn.x - rest[0]
        dy += liveMn.y - rest[1]
        dz += liveMn.z - rest[2]
      }
      const n = owners.length || 1
      const out = termLive.current[i]
      out.set(o[0] + dx / n, o[1] + dy / n, o[2] + dz / n)
      const child = root.children[mnLocal.length + coreLocal.length + i]
      if (child) child.position.copy(out)
    })

    for (let b = 0; b < liveBonds.length; b++) {
      const bond = liveBonds[b]
      const A = mnLive.current[bond.mn]
      const B = bond.oKind === 'core' ? coreLive.current[bond.o] : termLive.current[bond.o]
      const ha = bondA.current[b]
      const hb = bondB.current[b]
      if (!A || !B || !ha || !hb) continue
      placeHalfBond(ha, A.x, A.y, A.z, B.x, B.y, B.z, bond.rest, true)
      placeHalfBond(hb, A.x, A.y, A.z, B.x, B.y, B.z, bond.rest, false)
    }
  })

  return (
    <group position={atOrigin ? [0, 0, 0] : center}>
      {liveBonds.map((bond, i) => (
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
        {termLocal.map((o, i) => (
          <mesh key={`to-${i}`} position={o}>
            <sphereGeometry args={[0.24, 20, 20]} />
            <meshStandardMaterial color={O_COLOR} roughness={0.38} metalness={0.08} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const CAM_OPEN = new THREE.Vector3(8.2, 4.2, 10.1)
const CAM_CLOSED = new THREE.Vector3(6.4, 3.4, 7.8)

function InsetScene({
  active,
  reduced,
  vibe,
  open,
}: {
  active: boolean
  reduced: boolean
  vibe: CubaneVibe
  open?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ camera }, dt) => {
    camera.position.copy(open ? CAM_OPEN : CAM_CLOSED)
    camera.lookAt(0, 0, 0)
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
  embedded,
}: {
  active: boolean
  vibe: CubaneVibe
  caption?: string
  open?: boolean
  embedded?: boolean
}) {
  const reduced = usePrefersReducedMotion()
  return (
    <div
      className={embedded ? styles.cubaneEmbed : styles.cubaneDock}
      data-open={!embedded && open ? '' : undefined}
      aria-hidden
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: CAM_OPEN.toArray(), fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <Suspense fallback={null}>
          <InsetScene active={active} reduced={reduced} vibe={vibe} open={open} />
        </Suspense>
      </Canvas>
      {caption && <div className={styles.cubaneCap}>{caption}</div>}
    </div>
  )
}
