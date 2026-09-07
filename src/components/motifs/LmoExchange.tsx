import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import data from '../../data/lmoSpinel.json'
import { isCaptureMode } from '../../lib/asset'

export const H_COLOR = '#eef2f6'
export const OH_COLOR = '#d8c49a'
export const LI_COLOR = '#6ecf7a'
export const LI_EXTRA = '#4a9a58'

const OH_LEN = 0.97
const CELL = data.cell.a
const HERO = 7

export const H_STAGGER = 0.45
export const H_TRAVEL = 3.2
export const H_START = 0.35
const OH_STRETCH_HZ = 2.82
const OH_BEND_HZ = 1.88
const OH_WAG_HZ = 2.24

/** 0–1 as each inbound H finishes sitting on its oxygen (matches the OH-stick fade). */
export function protonBind(t: number, i: number) {
  const local = (t - H_START - i * H_STAGGER) / H_TRAVEL
  const u = Math.min(1, Math.max(0, (local - 0.78) / 0.22))
  return u * u * (3 - 2 * u)
}

const LI_GATHER = 2.6
const LI_STAGGER = 0.55
const LI_TRAVEL = 2.9
const H_EXIT_TRAVEL = 2.2
const H_EXIT_AT = 0.48

export type RideState = {
  following: boolean
  done: boolean
  pos: THREE.Vector3
  look: THREE.Vector3
}

type Vec3 = [number, number, number]

export type ExchangeSite = {
  site8a: Vec3
  oxygen: Vec3
  hHome: Vec3
  c16: Vec3
  hIn: Vec3[]
  liIn: Vec3[]
  hOut: Vec3[]
}

function v3(x: number, y: number, z: number): Vec3 {
  return [x, y, z]
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

function len(a: Vec3) {
  return Math.hypot(a[0], a[1], a[2])
}

function norm(a: Vec3): Vec3 {
  const d = len(a) || 1
  return scale(a, 1 / d)
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function ohBasis(n: Vec3) {
  const axis: Vec3 = Math.abs(n[1]) < 0.85 ? [0, 1, 0] : [1, 0, 0]
  const u = norm(cross(n, axis))
  const v = norm(cross(n, u))
  return { n, u, v }
}

function minImage(d: number) {
  const half = CELL * 0.5
  if (d > half) return d - CELL
  if (d < -half) return d + CELL
  return d
}

function sites16c(): Vec3[] {
  const bases: Vec3[] = [
    [0.125, 0.125, 0.125],
    [0.125, 0.875, 0.875],
    [0.875, 0.125, 0.875],
    [0.875, 0.875, 0.125],
  ]
  const fcc: Vec3[] = [
    [0, 0, 0],
    [0.5, 0.5, 0],
    [0.5, 0, 0.5],
    [0, 0.5, 0.5],
  ]
  const out: Vec3[] = []
  for (const b of bases) {
    for (const t of fcc) {
      out.push([
        (((b[0] + t[0]) % 1) - 0.5) * CELL,
        (((b[1] + t[1]) % 1) - 0.5) * CELL,
        (((b[2] + t[2]) % 1) - 0.5) * CELL,
      ])
    }
  }
  return out
}

function nearest<T extends Vec3>(origin: Vec3, pts: T[]) {
  let best = pts[0]
  let bestD = Infinity
  let bestDelta: Vec3 = [0, 0, 0]
  for (const p of pts) {
    const dlt: Vec3 = [minImage(p[0] - origin[0]), minImage(p[1] - origin[1]), minImage(p[2] - origin[2])]
    const d = len(dlt)
    if (d < bestD) {
      bestD = d
      best = p
      bestDelta = dlt
    }
  }
  return { point: add(origin, bestDelta), raw: best, dist: bestD }
}

export function buildExchangeSites(): ExchangeSite[] {
  const c16 = sites16c()
  const oxy = data.oxygen.map((o) => v3(o.x, o.y, o.z))
  return data.lithium.map((li) => {
    const site8a = v3(li.x, li.y, li.z)
    const oHit = nearest(site8a, oxy)
    const oxygen = oHit.point
    const toward8a = norm(sub(site8a, oxygen))
    const hHome = add(oxygen, scale(toward8a, OH_LEN))
    const gate = nearest(site8a, c16).point
    const outDir = norm(sub(gate, site8a))
    const hStart = add(gate, scale(outDir, 5.2))
    const liStart = add(gate, scale(outDir, 7.4))
    const approach = add(site8a, scale(outDir, 0.55))
    const hIn: Vec3[] = [hStart, gate, approach, hHome]
    const liIn: Vec3[] = [liStart, gate, site8a]
    const hOut: Vec3[] = [hHome, gate, add(gate, scale(outDir, 6.2))]
    return { site8a, oxygen, hHome, c16: gate, hIn, liIn, hOut }
  })
}

function easeInOut(t: number) {
  const u = Math.min(1, Math.max(0, t))
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
}

function samplePath(path: Vec3[], t: number) {
  const u = easeInOut(t)
  if (path.length === 1) {
    return { p: new THREE.Vector3(...path[0]), tan: new THREE.Vector3(0, 0, 1) }
  }
  const segs = path.length - 1
  const x = u * segs
  const i = Math.min(segs - 1, Math.floor(x))
  const f = x - i
  const a = path[i]
  const b = path[i + 1]
  const p = new THREE.Vector3(
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  )
  const tan = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  if (tan.lengthSq() < 1e-8 && i > 0) {
    tan.set(a[0] - path[i - 1][0], a[1] - path[i - 1][1], a[2] - path[i - 1][2])
  }
  if (tan.lengthSq() < 1e-8) tan.set(0, 0, 1)
  else tan.normalize()
  return { p, tan }
}

export function ExchangeIons({
  phase,
  active,
  reduced,
  scale,
  ride,
  vibeOn = true,
}: {
  phase: 'hydrogen' | 'lithium'
  active: boolean
  reduced: boolean
  scale: number
  ride: MutableRefObject<RideState>
  vibeOn?: boolean
}) {
  const sites = useMemo(() => buildExchangeSites(), [])
  const ohAxes = useMemo(
    () => sites.map((site) => ohBasis(norm(sub(site.hHome, site.oxygen)))),
    [sites],
  )
  const clock = useRef(0)
  const capturing = isCaptureMode()
  const hMesh = useRef<(THREE.Mesh | null)[]>([])
  const hMat = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const ohMesh = useRef<(THREE.Mesh | null)[]>([])
  const ohMat = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const liMesh = useRef<(THREE.Mesh | null)[]>([])
  const extraMesh = useRef<(THREE.Mesh | null)[]>([])
  const heroTan = useRef(new THREE.Vector3(0, 0, 1))
  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])
  const tmpMid = useMemo(() => new THREE.Vector3(), [])
  const tmpDir = useMemo(() => new THREE.Vector3(), [])
  const heroWorld = useMemo(() => new THREE.Vector3(), [])
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const yUp = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  const extras = useMemo(() => {
    return [0, 1, 2].map((i) => {
      const ang = (i / 3) * Math.PI * 2 + 0.4
      return {
        base: v3(Math.cos(ang) * 8.6, -1.2 + i * 1.1, Math.sin(ang) * 8.6),
        spin: 0.22 + i * 0.05,
      }
    })
  }, [])

  useEffect(() => {
    clock.current = 0
    ride.current.following = false
    ride.current.done = false
  }, [phase, active, ride])

  useFrame((_, dt) => {
    if (!active) return
    if (!reduced && !capturing) clock.current += dt
    const t = capturing
      ? phase === 'hydrogen'
        ? 12
        : LI_GATHER + LI_STAGGER * HERO + LI_TRAVEL * 0.62
      : reduced
        ? 99
        : clock.current

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i]
      const h = hMesh.current[i]
      const hm = hMat.current[i]
      const oh = ohMesh.current[i]
      const om = ohMat.current[i]
      const li = liMesh.current[i]

      let hx = site.hHome[0]
      let hy = site.hHome[1]
      let hz = site.hHome[2]
      let hop = 1
      let oop = 0
      let lx = site.liIn[0][0]
      let ly = site.liIn[0][1]
      let lz = site.liIn[0][2]

      if (phase === 'hydrogen') {
        const local = (t - H_START - i * H_STAGGER) / H_TRAVEL
        if (reduced || capturing || local >= 1) {
          oop = 1
        } else if (local <= 0) {
          hx = site.hIn[0][0]
          hy = site.hIn[0][1]
          hz = site.hIn[0][2]
        } else {
          const samp = samplePath(site.hIn, local)
          hx = samp.p.x
          hy = samp.p.y
          hz = samp.p.z
          oop = THREE.MathUtils.smoothstep(0.78, 1, local)
        }
      } else {
        const local = (t - LI_GATHER - i * LI_STAGGER) / LI_TRAVEL
        if (reduced || local >= 1) {
          lx = site.site8a[0]
          ly = site.site8a[1]
          lz = site.site8a[2]
        } else if (local <= 0) {
          lx = site.liIn[0][0]
          ly = site.liIn[0][1]
          lz = site.liIn[0][2]
        } else {
          const samp = samplePath(site.liIn, local)
          lx = samp.p.x
          ly = samp.p.y
          lz = samp.p.z
          if (i === HERO) heroTan.current.copy(samp.tan)
        }

        const exitT = (local - H_EXIT_AT) / (H_EXIT_TRAVEL / LI_TRAVEL)
        if (reduced) {
          hop = 0
          oop = 0
          const last = site.hOut[site.hOut.length - 1]
          hx = last[0]
          hy = last[1]
          hz = last[2]
        } else if (exitT <= 0) {
          oop = local < 0 ? 1 : THREE.MathUtils.smoothstep(0.35, 0, local)
        } else if (exitT >= 1) {
          const last = site.hOut[site.hOut.length - 1]
          hx = last[0]
          hy = last[1]
          hz = last[2]
          hop = 0
          oop = 0
        } else {
          const samp = samplePath(site.hOut, exitT)
          hx = samp.p.x
          hy = samp.p.y
          hz = samp.p.z
          oop = 0
          hop = 1 - THREE.MathUtils.smoothstep(0.72, 1, exitT)
        }
      }

      if (phase === 'hydrogen' && vibeOn && !reduced && !capturing && oop > 0.04) {
        const ax = ohAxes[i]
        const stretch = Math.sin(t * Math.PI * 2 * OH_STRETCH_HZ + i * 1.73) * 0.28 * oop
        const bend = Math.sin(t * Math.PI * 2 * OH_BEND_HZ + i * 2.11) * 0.16 * oop
        const wag = Math.sin(t * Math.PI * 2 * OH_WAG_HZ + i * 0.67) * 0.12 * oop
        hx += ax.n[0] * stretch + ax.u[0] * bend + ax.v[0] * wag
        hy += ax.n[1] * stretch + ax.u[1] * bend + ax.v[1] * wag
        hz += ax.n[2] * stretch + ax.u[2] * bend + ax.v[2] * wag
      }

      if (h) h.position.set(hx, hy, hz)
      if (hm) {
        hm.opacity = hop
        hm.visible = hop > 0.04
      }
      if (oh) {
        tmpA.set(hx, hy, hz)
        tmpB.set(...site.oxygen)
        tmpMid.copy(tmpB).add(tmpA).multiplyScalar(0.5)
        tmpDir.copy(tmpA).sub(tmpB)
        const L = tmpDir.length()
        oh.visible = oop > 0.05 && L > 0.2
        if (oh.visible) {
          oh.position.copy(tmpMid)
          oh.scale.set(1, L / OH_LEN, 1)
          tmpQ.setFromUnitVectors(yUp, tmpDir.normalize())
          oh.quaternion.copy(tmpQ)
        }
        if (om) om.opacity = oop
      }
      if (li) li.position.set(lx, ly, lz)
      if (i === HERO) heroWorld.set(lx, ly, lz)
    }

    extras.forEach((e, i) => {
      const mesh = extraMesh.current[i]
      if (!mesh) return
      const ang = Math.max(0, t) * e.spin
      mesh.position.set(
        e.base[0] * Math.cos(ang) - e.base[2] * Math.sin(ang),
        e.base[1] + Math.sin(Math.max(0, t) * 0.7 + i) * 0.25,
        e.base[0] * Math.sin(ang) + e.base[2] * Math.cos(ang),
      )
    })

    if (phase === 'lithium' && !reduced) {
      const heroLocal = (t - LI_GATHER - HERO * LI_STAGGER) / LI_TRAVEL
      const follow = capturing || (heroLocal > -0.12 && heroLocal < 1.18)
      const heroDone = !capturing && heroLocal >= 1.18
      ride.current.following = Boolean(follow && !heroDone)
      ride.current.done = Boolean(heroDone)
      const tan = heroTan.current
      ride.current.pos
        .copy(heroWorld)
        .addScaledVector(tan, -2.35)
        .setY(heroWorld.y + 0.85)
        .multiplyScalar(scale)
      ride.current.look.copy(heroWorld).addScaledVector(tan, 1.55).multiplyScalar(scale)
    } else {
      ride.current.following = false
      ride.current.done = false
    }
  })

  return (
    <group>
      {sites.map((site, i) => (
        <group key={`pair-${i}`}>
          <mesh
            ref={(el) => {
              hMesh.current[i] = el
            }}
            position={site.hIn[0]}
          >
            <sphereGeometry args={[0.22, 18, 18]} />
            <meshStandardMaterial
              ref={(el) => {
                hMat.current[i] = el
              }}
              color={H_COLOR}
              emissive={H_COLOR}
              emissiveIntensity={0.55}
              roughness={0.28}
              metalness={0.08}
              transparent
              opacity={1}
            />
          </mesh>
          <mesh
            ref={(el) => {
              ohMesh.current[i] = el
            }}
            visible={false}
          >
            <cylinderGeometry args={[0.045, 0.045, 0.97, 8]} />
            <meshStandardMaterial
              ref={(el) => {
                ohMat.current[i] = el
              }}
              color={OH_COLOR}
              emissive={OH_COLOR}
              emissiveIntensity={0.38}
              transparent
              opacity={0}
              roughness={0.4}
            />
          </mesh>
          {phase === 'lithium' && (
            <mesh
              ref={(el) => {
                liMesh.current[i] = el
              }}
              position={site.liIn[0]}
            >
              <sphereGeometry args={[0.4, 18, 18]} />
              <meshStandardMaterial
                color={LI_COLOR}
                emissive={LI_COLOR}
                emissiveIntensity={0.42}
                roughness={0.28}
                metalness={0.12}
              />
            </mesh>
          )}
        </group>
      ))}
      {phase === 'lithium' &&
        extras.map((e, i) => (
          <mesh
            key={`ex-${i}`}
            ref={(el) => {
              extraMesh.current[i] = el
            }}
            position={e.base}
          >
            <sphereGeometry args={[0.34, 16, 16]} />
            <meshStandardMaterial
              color={LI_EXTRA}
              emissive={LI_EXTRA}
              emissiveIntensity={0.18}
              transparent
              opacity={0.72}
              roughness={0.35}
            />
          </mesh>
        ))}
    </group>
  )
}

export function HomeOxygen() {
  return (
    <group>
      {data.oxygen.map((ox, i) => (
        <mesh key={i} position={[ox.x, ox.y, ox.z]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#c45a3a" roughness={0.36} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )
}
