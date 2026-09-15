import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import data from '../../data/poreGate.json'
import styles from './Motifs.module.css'

/** Hydrated cations vs ~3 Å filter. Color tracks hydration energy (warmer = harder to strip). */
const PORE_R = 72
const CX = 510
const CY = 275
const VIEW_W = 980
const VIEW_H = 560
/** Keep shells near true Å scale so Li/K/Cs read larger than the ~3 Å filter. */
const SHELL_SCALE = 0.9
const LABEL_PAD = 38
/** Keep ion centers out of the left title column. */
const TITLE_GUTTER = 350
const SHELL_GAP = 24

const HYD_MIN = Math.min(...data.ions.map((i) => i.hydration))
const HYD_MAX = Math.max(...data.ions.map((i) => i.hydration))

/** Seeded right-hand fan — then collision-resolved with breathing room. */
const SEEDS = [
  { angle: -2.05, dist: 200 },
  { angle: -1.4, dist: 245 },
  { angle: -0.7, dist: 285 },
  { angle: 0.05, dist: 290 },
  { angle: 0.7, dist: 285 },
  { angle: 1.3, dist: 265 },
]

function ionRadius(angstrom: number) {
  return (angstrom / data.poreA) * PORE_R * SHELL_SCALE
}

/** Map ΔHhyd (more negative → warmer). Presentation amber → copper → cool mineral blue. */
function hydrationColor(dh: number, alpha = 1) {
  const t = (dh - HYD_MIN) / (HYD_MAX - HYD_MIN || 1)
  const r = Math.round(224 + t * (126 - 224))
  const g = Math.round(112 + t * (196 - 112))
  const b = Math.round(64 + t * (212 - 64))
  return `rgba(${r},${g},${b},${alpha})`
}

function Water({
  cx,
  cy,
  angle,
  radius,
  color,
}: {
  cx: number
  cy: number
  angle: number
  radius: number
  color: string
}) {
  const ox = cx + Math.cos(angle) * radius
  const oy = cy + Math.sin(angle) * radius
  const hx = Math.cos(angle)
  const hy = Math.sin(angle)
  const px = -hy
  const py = hx
  const h1x = ox + hx * 7 + px * 5.5
  const h1y = oy + hy * 7 + py * 5.5
  const h2x = ox + hx * 7 - px * 5.5
  const h2y = oy + hy * 7 - py * 5.5
  return (
    <g>
      <line x1={cx} y1={cy} x2={ox} y2={oy} stroke={color} strokeWidth={1.1} opacity={0.5} />
      <circle cx={ox} cy={oy} r={5.2} fill={color} fillOpacity={0.88} />
      <text x={ox} y={oy + 3} textAnchor="middle" fontSize="6" fill="#1a1210" fontWeight="700">
        O
      </text>
      <circle cx={h1x} cy={h1y} r={2.5} fill="rgba(243,238,228,0.95)" />
      <text x={h1x} y={h1y + 2.2} textAnchor="middle" fontSize="4.5" fill="#3a352f" fontWeight="600">
        H
      </text>
      <circle cx={h2x} cy={h2y} r={2.5} fill="rgba(243,238,228,0.95)" />
      <text x={h2x} y={h2y + 2.2} textAnchor="middle" fontSize="4.5" fill="#3a352f" fontWeight="600">
        H
      </text>
    </g>
  )
}

type PlacedIon = (typeof data.ions)[number] & {
  rHyd: number
  rCry: number
  x: number
  y: number
  oversized: boolean
  fill: string
  shell: string
  stroke: string
}

function placeIons(): PlacedIon[] {
  const placed: PlacedIon[] = data.ions.map((ion, i) => {
    const seed = SEEDS[i] ?? SEEDS[SEEDS.length - 1]
    const rHyd = ionRadius(ion.hydrated)
    const rCry = Math.max(11, ionRadius(ion.crystal) * 0.72)
    return {
      ...ion,
      rHyd,
      rCry,
      x: CX + Math.cos(seed.angle) * seed.dist,
      y: CY + Math.sin(seed.angle) * seed.dist * 0.9,
      oversized: ion.hydrated > data.poreA,
      fill: hydrationColor(ion.hydration, 0.92),
      shell: hydrationColor(ion.hydration, 0.2),
      stroke: hydrationColor(ion.hydration, 0.72),
    }
  })

  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]
        const b = placed[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 0.01
        const min = a.rHyd + b.rHyd + SHELL_GAP
        if (d < min) {
          const push = (min - d) * 0.5
          const ux = dx / d
          const uy = dy / d
          a.x -= ux * push
          a.y -= uy * push
          b.x += ux * push
          b.y += uy * push
        }
      }

      const p = placed[i]
      p.x = Math.min(VIEW_W - p.rHyd - 8, Math.max(TITLE_GUTTER + p.rHyd * 0.15, p.x))
      p.y = Math.min(VIEW_H - p.rHyd - LABEL_PAD - 8, Math.max(p.rHyd + 22, p.y))

      const dx = p.x - CX
      const dy = p.y - CY
      const d = Math.hypot(dx, dy) || 0.01
      const min = PORE_R + p.rHyd + 6
      if (d < min) {
        const push = min - d
        p.x += (dx / d) * push
        p.y += (dy / d) * push
      }
    }
  }

  return placed
}

function outwardLabel(
  ion: PlacedIon,
  distance: number,
): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  // Ca sits between Mg and Li — radial outward lands on Li; pin to shell top-right.
  if (ion.id === 'Ca') {
    const a = -Math.PI / 4
    return {
      x: Math.min(VIEW_W - 12, ion.x + Math.cos(a) * (ion.rHyd + distance)),
      y: Math.max(18, ion.y + Math.sin(a) * (ion.rHyd + distance)),
      anchor: 'start',
    }
  }

  const dx = ion.x - CX
  const dy = ion.y - CY
  const len = Math.hypot(dx, dy) || 1
  let ux = dx / len
  let uy = dy / len

  // Prefer open side when radial outward would clip the viewBox.
  const topClear = ion.y - ion.rHyd
  const botClear = VIEW_H - (ion.y + ion.rHyd)
  if (topClear < 28 && uy < 0) {
    ux = Math.max(0.55, Math.abs(ux))
    uy = 0.15
  } else if (botClear < 28 && uy > 0) {
    ux = Math.max(0.35, Math.abs(ux))
    uy = -0.1
  }

  const n = Math.hypot(ux, uy) || 1
  ux /= n
  uy /= n

  const x = ion.x + ux * (ion.rHyd + distance)
  const y = ion.y + uy * (ion.rHyd + distance)
  const anchor = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle'
  return {
    x: Math.min(VIEW_W - 12, Math.max(12, x)),
    y: Math.min(VIEW_H - 14, Math.max(18, y)),
    anchor,
  }
}

export function PoreGate({ active, label }: { active: boolean; label?: string }) {
  const reduced = usePrefersReducedMotion()
  const arc = placeIons()

  return (
    <div
      className={styles.theater}
      aria-label={
        label || 'Hydrated cations with H₂O shells colored by hydration energy against a ~3 Å filter'
      }
    >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="apertureGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(243,204,122,0.2)" />
            <stop offset="55%" stopColor="rgba(243,204,122,0.05)" />
            <stop offset="100%" stopColor="rgba(243,204,122,0)" />
          </radialGradient>
          <linearGradient id="hydScale" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(224,112,64,0.95)" />
            <stop offset="55%" stopColor="rgba(212,160,74,0.9)" />
            <stop offset="100%" stopColor="rgba(126,196,212,0.95)" />
          </linearGradient>
        </defs>

        <motion.circle
          cx={CX}
          cy={CY}
          r={PORE_R * 2.15}
          fill="url(#apertureGlow)"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />

        <motion.circle
          cx={CX}
          cy={CY}
          r={PORE_R}
          fill="rgba(243,238,228,0.03)"
          stroke="rgba(243,238,228,0.85)"
          strokeWidth={2.5}
          strokeDasharray="7 9"
          initial={false}
          animate={{ opacity: active ? 1 : 0, r: active ? PORE_R : PORE_R * 0.55 }}
          transition={{ duration: reduced ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x={CX} y={CY - 4} textAnchor="middle" className={styles.theaterMark}>
          ~{data.poreA.toFixed(1)} Å
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" className={styles.theaterMark}>
          hydrated filter
        </text>

        {arc.map((ion, i) => {
          const waters = Array.from({ length: ion.waters }, (_, wi) => {
            return -Math.PI / 2 + (wi / ion.waters) * Math.PI * 2
          })
          const energy = outwardLabel(ion, 15)
          return (
            <motion.g
              key={ion.id}
              initial={false}
              animate={{ opacity: active ? 1 : 0, x: active ? 0 : 28 }}
              transition={{
                duration: reduced ? 0 : 0.55,
                delay: reduced || !active ? 0 : 0.05 + i * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <circle
                cx={ion.x}
                cy={ion.y}
                r={ion.rHyd}
                fill={ion.shell}
                stroke={ion.stroke}
                strokeWidth={1.4}
                strokeDasharray="3 4"
              />
              {waters.map((a) => (
                <Water
                  key={a}
                  cx={ion.x}
                  cy={ion.y}
                  angle={a}
                  radius={Math.max(ion.rCry + 10, ion.rHyd * 0.64)}
                  color={ion.fill}
                />
              ))}
              <circle cx={ion.x} cy={ion.y} r={ion.rCry} fill={ion.fill} />
              <text
                x={ion.x}
                y={ion.y + 4}
                textAnchor="middle"
                className={styles.theaterIon}
                style={{ fill: '#1a1210', fontSize: 13 }}
              >
                {ion.label}
              </text>
              <text
                x={energy.x}
                y={energy.y}
                textAnchor={energy.anchor}
                className={styles.theaterCallout}
              >
                {ion.hydration} kJ/mol
              </text>
            </motion.g>
          )
        })}

        <g transform="translate(48, 508)">
          <text x={0} y={0} className={styles.theaterMark}>
            hydration energy · warmer = harder to shed H₂O
          </text>
          <rect x={0} y={10} width={168} height={8} fill="url(#hydScale)" />
          <text x={0} y={32} className={styles.theaterMark}>
            Mg²⁺
          </text>
          <text x={168} y={32} textAnchor="end" className={styles.theaterMark}>
            Cs⁺
          </text>
        </g>
      </svg>
    </div>
  )
}
