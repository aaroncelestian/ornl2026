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
const H_EXIT_TRAVEL = 1.15
const CHASE_BACK = 2.55
const CHASE_AHEAD = 1.48
const CHASE_HEIGHT = 0.92
const ORBIT_SPEED = 0.5
const ORBIT_MIN_S = 2.35
const ORBIT_FALLBACK_S = 5.1
const APPROACH_FROM = -1.18
const APPROACH_TO = 0.16
const CAM_HOME = new THREE.Vector3(4.2, 2.6, 5.8)

export type RideStage = 'idle' | 'approach' | 'chase' | 'orbit' | 'flash' | 'hold' | 'pullback'

export type RideState = {
  following: boolean
  done: boolean
  pull: boolean
  wide: boolean
  pullable: boolean
  flash: number
  fov: number
  stage: RideStage
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

function easeInExpo(t: number) {
  const u = Math.min(1, Math.max(0, t))
  return u === 0 ? 0 : 2 ** (10 * u - 10)
}

function shortestAngle(a: number) {
  let x = a
  while (x > Math.PI) x -= Math.PI * 2
  while (x < -Math.PI) x += Math.PI * 2
  return x
}

function samplePath(path: Vec3[], t: number, ease: (u: number) => number = easeInOut) {
  const u = ease(t)
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
  const liMat = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const extraMesh = useRef<(THREE.Mesh | null)[]>([])
  const flashLight = useRef<THREE.PointLight>(null)
  const heroTan = useRef(new THREE.Vector3(0, 0, 1))
  const heroH = useMemo(() => new THREE.Vector3(), [])
  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])
  const tmpMid = useMemo(() => new THREE.Vector3(), [])
  const tmpDir = useMemo(() => new THREE.Vector3(), [])
  const heroWorld = useMemo(() => new THREE.Vector3(), [])
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const yUp = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const cam = useRef({
    arrived: false,
    bolted: false,
    boltT: Infinity,
    orbitT: 0,
    startYaw: 0,
    radius: CHASE_BACK,
    height: CHASE_HEIGHT,
    dir: 1,
    targetYaw: 0,
  })

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
    cam.current.arrived = false
    cam.current.bolted = false
    cam.current.boltT = Infinity
    cam.current.orbitT = 0
    ride.current.following = false
    ride.current.done = false
    ride.current.pull = false
    ride.current.wide = false
    ride.current.pullable = false
    ride.current.flash = 0
    ride.current.fov = 40
    ride.current.stage = 'idle'
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
          if (i === HERO) heroTan.current.copy(samplePath(site.liIn, 0).tan)
        } else {
          const samp = samplePath(site.liIn, local)
          lx = samp.p.x
          ly = samp.p.y
          lz = samp.p.z
          if (i === HERO) heroTan.current.copy(samp.tan)
        }

        const stagger = i === HERO ? 0 : 0.12 + i * 0.05
        const exitT = (t - cam.current.boltT - stagger) / H_EXIT_TRAVEL
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
          const samp = samplePath(site.hOut, exitT, i === HERO ? easeInExpo : easeInOut)
          hx = samp.p.x
          hy = samp.p.y
          hz = samp.p.z
          oop = 0
          hop = 1 - THREE.MathUtils.smoothstep(0.55, 1, exitT)
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
      if (i === HERO) {
        heroWorld.set(lx, ly, lz)
        heroH.set(hx, hy, hz)
      }
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
      const hero = sites[HERO]
      const heroLocal = (t - LI_GATHER - HERO * LI_STAGGER) / LI_TRAVEL
      const tan = heroTan.current
      const r = ride.current
      const c = cam.current

      tmpA.copy(heroWorld).addScaledVector(tan, -CHASE_BACK)
      tmpA.y = heroWorld.y + CHASE_HEIGHT
      tmpB.copy(heroWorld).addScaledVector(tan, CHASE_AHEAD)
      const chasePos = tmpA.multiplyScalar(scale)
      const chaseLook = tmpB.multiplyScalar(scale)

      if (capturing) {
        r.stage = 'chase'
        r.following = true
        r.done = false
        r.pullable = false
        r.flash = 0
        r.fov = 33
        r.pos.copy(chasePos)
        r.look.copy(chaseLook)
      } else if (r.wide) {
        r.stage = 'idle'
        r.following = false
        r.done = true
        r.pullable = false
        r.flash = 0
        r.fov = 40
      } else if (r.pull) {
        r.stage = 'pullback'
        r.following = true
        r.done = false
        r.pullable = false
        r.flash = 0
        r.fov = 40
        r.pos.copy(CAM_HOME)
        r.look.set(0, 0, 0)
      } else if (heroLocal < 1) {
        const u = THREE.MathUtils.smoothstep(APPROACH_FROM, APPROACH_TO, heroLocal)
        r.stage = u < 0.999 ? 'approach' : 'chase'
        r.following = u > 0.01
        r.done = false
        r.pullable = false
        r.flash = 0
        r.fov = THREE.MathUtils.lerp(40, 33, u)
        r.pos.lerpVectors(CAM_HOME, chasePos, easeInOut(u))
        r.look.lerpVectors(tmpDir.set(0, 0, 0), chaseLook, easeInOut(u))
      } else {
        if (!c.arrived) {
          c.arrived = true
          const offX = -CHASE_BACK * tan.x
          const offZ = -CHASE_BACK * tan.z
          c.startYaw = Math.atan2(offX, offZ)
          c.radius = Math.hypot(offX, offZ) || CHASE_BACK
          c.height = CHASE_HEIGHT
          const hYaw = Math.atan2(hero.hHome[0] - hero.site8a[0], hero.hHome[2] - hero.site8a[2])
          const sideA = hYaw + Math.PI * 0.5
          const sideB = hYaw - Math.PI * 0.5
          const dA = shortestAngle(sideA - c.startYaw)
          const dB = shortestAngle(sideB - c.startYaw)
          if (Math.abs(dA) <= Math.abs(dB)) {
            c.targetYaw = sideA
            c.dir = Math.sign(dA) || 1
          } else {
            c.targetYaw = sideB
            c.dir = Math.sign(dB) || 1
          }
        }

        c.orbitT += capturing ? 0 : dt
        const yaw = c.startYaw + c.dir * c.orbitT * ORBIT_SPEED
        const breathe = 1 + 0.05 * Math.sin(c.orbitT * 0.34)
        const lift = c.height + 0.1 * Math.sin(c.orbitT * 0.21 + 0.5)
        tmpA.set(Math.sin(yaw) * c.radius * breathe, lift, Math.cos(yaw) * c.radius * breathe)
        r.pos.copy(heroWorld).add(tmpA).multiplyScalar(scale)

        const towardH = THREE.MathUtils.smoothstep(0.15, 2.1, c.orbitT)
        tmpB.set(hero.hHome[0] - hero.site8a[0], hero.hHome[1] - hero.site8a[1], hero.hHome[2] - hero.site8a[2])
        r.look
          .copy(heroWorld)
          .addScaledVector(tan, CHASE_AHEAD * (1 - towardH))
          .addScaledVector(tmpB, 0.58 * towardH)

        if (!c.bolted) {
          const aligned = Math.abs(shortestAngle(yaw - c.targetYaw)) < 0.24
          if ((c.orbitT > ORBIT_MIN_S && aligned) || c.orbitT > ORBIT_FALLBACK_S) {
            c.bolted = true
            c.boltT = t
          }
        }

        const flashAge = t - c.boltT
        r.flash = flashAge < 0 ? 0 : Math.exp(-flashAge * 3.8) * (flashAge < 0.07 ? flashAge / 0.07 : 1)
        if (c.bolted && flashAge >= 0 && flashAge < 1.25) {
          const kick = Math.sin(Math.min(1, flashAge / 0.32) * Math.PI) * 0.55
          tmpDir.copy(heroH).sub(heroWorld)
          r.look.addScaledVector(tmpDir, kick)
        }
        r.look.multiplyScalar(scale)

        r.stage = !c.bolted ? 'orbit' : flashAge < 0.55 ? 'flash' : 'hold'
        r.following = true
        r.done = true
        r.pullable = c.bolted && flashAge > 0.4
        r.fov = THREE.MathUtils.lerp(33, 36, THREE.MathUtils.smoothstep(0, 2.4, c.orbitT))
      }

      const hm = hMat.current[HERO]
      const lm = liMat.current[HERO]
      if (hm) hm.emissiveIntensity = 0.55 + r.flash * 2.4
      if (lm) lm.emissiveIntensity = 0.42 + r.flash * 1.9
      if (flashLight.current) {
        flashLight.current.position.copy(heroH)
        flashLight.current.intensity = r.flash * 14
      }
    } else {
      ride.current.following = false
      ride.current.done = false
      ride.current.pullable = false
      ride.current.flash = 0
      ride.current.fov = 40
      ride.current.stage = 'idle'
      if (flashLight.current) flashLight.current.intensity = 0
    }
  })

  return (
    <group>
      <pointLight ref={flashLight} color="#f6fff4" intensity={0} distance={7} decay={2} />
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
                ref={(el) => {
                  liMat.current[i] = el
                }}
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
