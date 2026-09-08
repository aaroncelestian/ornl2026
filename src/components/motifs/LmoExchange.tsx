import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import data from '../../data/lmoSpinel.json'
import { isCaptureMode } from '../../lib/asset'

export const H_COLOR = '#eef2f6'
export const OH_COLOR = '#d8c49a'
export const LI_COLOR = '#6ecf7a'
export const LI_EXTRA = '#4a9a58'

type Vec3 = [number, number, number]
type XYZ = readonly [number, number, number]

function v3(x: number, y: number, z: number): Vec3 {
  return [x, y, z]
}

const OH_LEN = 0.97
const CELL = data.cell.a
const CELL_PAD = CELL * 0.5 + 0.2
const HERO_AT = v3(CELL * 0.25, -CELL * 0.25, CELL * 0.25)

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

export const LI_GATHER = 1.2
const LI_STAGGER = 0.45
const LI_TRAVEL = 3.6
const H_EXIT_TRAVEL = 1.15
const BOLT_AFTER = 0.55
/** Far enough to enter from off-frame, short enough to finish in LI_TRAVEL. */
const LI_OFFSTAGE = 14

export type RideStage = 'idle' | 'approach' | 'chase' | 'orbit' | 'flash' | 'escape' | 'hold' | 'pullback'

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

export type ExchangeSite = {
  site8a: Vec3
  oxygen: Vec3
  hHome: Vec3
  c16: Vec3
  outward: Vec3
  hIn: Vec3[]
  liIn: Vec3[]
  hOut: Vec3[]
}

function add(a: XYZ, b: XYZ): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function sub(a: XYZ, b: XYZ): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function scale(a: XYZ, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

function len(a: XYZ) {
  return Math.hypot(a[0], a[1], a[2])
}

function dot(a: XYZ, b: XYZ) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Pore direction that leaves the crystal, not the one that tunnels through it. */
function outwardDir(site8a: XYZ, gate: XYZ): Vec3 {
  const toGate = norm(sub(gate, site8a))
  const radial = len(site8a) > 0.35 ? norm(site8a) : toGate
  return dot(toGate, radial) >= -0.05 ? toGate : scale(toGate, -1)
}

function norm(a: XYZ): Vec3 {
  const d = len(a) || 1
  return scale(a, 1 / d)
}

function cross(a: XYZ, b: XYZ): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function ohBasis(n: XYZ) {
  const axis = Math.abs(n[1]) < 0.85 ? v3(0, 1, 0) : v3(1, 0, 0)
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

function inCell(p: XYZ) {
  return Math.abs(p[0]) <= CELL_PAD && Math.abs(p[1]) <= CELL_PAD && Math.abs(p[2]) <= CELL_PAD
}

function pickHero(sites: ExchangeSite[]) {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < sites.length; i++) {
    const d = len(sub(sites[i].site8a, HERO_AT))
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function sites16c(): Vec3[] {
  const bases = [v3(0.125, 0.125, 0.125), v3(0.125, 0.875, 0.875), v3(0.875, 0.125, 0.875), v3(0.875, 0.875, 0.125)]
  const fcc = [v3(0, 0, 0), v3(0.5, 0.5, 0), v3(0.5, 0, 0.5), v3(0, 0.5, 0.5)]
  const out: Vec3[] = []
  for (const b of bases) {
    for (const t of fcc) {
      out.push(
        v3(
          (((b[0] + t[0]) % 1) - 0.5) * CELL,
          (((b[1] + t[1]) % 1) - 0.5) * CELL,
          (((b[2] + t[2]) % 1) - 0.5) * CELL,
        ),
      )
    }
  }
  return out
}

function nearest(origin: XYZ, pts: readonly XYZ[]) {
  let best = pts[0] ?? v3(0, 0, 0)
  let bestD = Infinity
  let bestDelta = v3(0, 0, 0)
  for (const p of pts) {
    const dlt = v3(minImage(p[0] - origin[0]), minImage(p[1] - origin[1]), minImage(p[2] - origin[2]))
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
    const outward = outwardDir(site8a, gate)
    const mouth = add(site8a, scale(outward, 1.35))
    const hStart = add(site8a, scale(outward, 5.8))
    // Same axis as the pore mouth — long radial detours never reached 8a in time.
    const liStart = add(site8a, scale(outward, LI_OFFSTAGE))
    const approach = add(site8a, scale(outward, 4.2))
    const hExit = add(site8a, scale(outward, 7.4))
    const hIn: Vec3[] = [hStart, mouth, hHome]
    // Off-stage → approach → mouth → 8a (arc-length sampled below).
    const liIn: Vec3[] = [liStart, approach, mouth, site8a]
    const hOut: Vec3[] = [hHome, mouth, hExit]
    return { site8a, oxygen, hHome, c16: gate, outward, hIn, liIn, hOut }
  }).filter((site) => inCell(site.oxygen) && inCell(site.hHome))
}

function easeInOut(t: number) {
  const u = Math.min(1, Math.max(0, t))
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
}

function easeInExpo(t: number) {
  const u = Math.min(1, Math.max(0, t))
  return u === 0 ? 0 : 2 ** (10 * u - 10)
}

function samplePath(path: Vec3[], t: number, ease: (u: number) => number = easeInOut) {
  const u = ease(t)
  if (path.length === 1) {
    return { p: new THREE.Vector3(...path[0]), tan: new THREE.Vector3(0, 0, 1) }
  }
  // Arc-length parameterization — equal time per segment stranded Li on the long leg.
  const segLen: number[] = []
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    const d = len(sub(path[i + 1], path[i]))
    segLen.push(d)
    total += d
  }
  if (total < 1e-8) {
    return { p: new THREE.Vector3(...path[path.length - 1]), tan: new THREE.Vector3(0, 0, 1) }
  }
  let dist = u * total
  let i = 0
  while (i < segLen.length - 1 && dist > segLen[i]) {
    dist -= segLen[i]
    i++
  }
  const span = segLen[i] || 1
  const f = Math.min(1, Math.max(0, dist / span))
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
  const HERO = useMemo(() => pickHero(sites), [sites])
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
    radius: 2.55,
    height: 0.92,
    dir: 1,
    targetYaw: 0,
  })

  const extras = useMemo(() => {
    return [0, 1, 2].map((i) => {
      const ang = (i / 3) * Math.PI * 2 + 0.4
      return {
        base: v3(Math.cos(ang) * 14, -1.6 + i * 1.2, Math.sin(ang) * 14),
        spin: 0.2 + i * 0.04,
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
        } else {
          // Linear in arc-length so the long approach still finishes on 8a.
          const samp = samplePath(site.liIn, local, (u) => Math.min(1, Math.max(0, u)))
          lx = samp.p.x
          ly = samp.p.y
          lz = samp.p.z
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
      if (li) {
        li.position.set(lx, ly, lz)
        const lm = liMat.current[i]
        if (lm) {
          const local = (t - LI_GATHER - i * LI_STAGGER) / LI_TRAVEL
          // Fade in once the fly-in starts; stay fully opaque through arrival.
          const fade =
            phase === 'lithium'
              ? reduced || capturing || local >= 1
                ? 1
                : local <= 0
                  ? 0
                  : THREE.MathUtils.smoothstep(0, 0.12, local)
              : 0
          lm.opacity = fade
          lm.transparent = true
          li.visible = fade > 0.02
        }
      }
      if (i === HERO) {
        heroWorld.set(lx, ly, lz)
        heroH.set(hx, hy, hz)
      }
    }

    extras.forEach((e, i) => {
      const mesh = extraMesh.current[i]
      if (!mesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      // Drift in from farther out after the hero Li is already moving.
      const u = THREE.MathUtils.smoothstep(0, 1, (t - LI_GATHER - 0.4) / 2.2)
      const ang = Math.max(0, t) * e.spin
      const r = THREE.MathUtils.lerp(1.35, 1, u)
      mesh.position.set(
        e.base[0] * r * Math.cos(ang) - e.base[2] * r * Math.sin(ang),
        e.base[1] + Math.sin(Math.max(0, t) * 0.7 + i) * 0.25,
        e.base[0] * r * Math.sin(ang) + e.base[2] * r * Math.cos(ang),
      )
      if (mat) {
        mat.opacity = 0.72 * u
        mesh.visible = u > 0.02
      }
    })

    if (phase === 'lithium' && !reduced) {
      const heroLocal = (t - LI_GATHER - HERO * LI_STAGGER) / LI_TRAVEL
      const r = ride.current
      const c = cam.current
      r.following = false
      r.pullable = false
      r.fov = 40
      r.stage = 'idle'

      if (heroLocal >= 1 && !c.bolted) {
        c.orbitT += capturing ? 0 : dt
        if (capturing || c.orbitT >= BOLT_AFTER) {
          c.bolted = true
          c.boltT = t
        }
      }

      const flashAge = t - c.boltT
      r.flash = !c.bolted || flashAge < 0 ? 0 : Math.exp(-flashAge * 3.8) * (flashAge < 0.07 ? flashAge / 0.07 : 1)
      r.done = c.bolted && flashAge > H_EXIT_TRAVEL

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
                transparent
                opacity={0}
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
              opacity={0}
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
