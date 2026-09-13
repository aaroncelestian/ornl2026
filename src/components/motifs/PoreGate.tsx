import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import data from '../../data/poreGate.json'
import styles from './Motifs.module.css'

/** Hydrated cations vs ~3 Å filter. Color tracks hydration energy (warmer = harder to strip). */
const PORE_R = 108
const CX = 620
const CY = 248

const HYD_MIN = Math.min(...data.ions.map((i) => i.hydration))
const HYD_MAX = Math.max(...data.ions.map((i) => i.hydration))

function ionRadius(angstrom: number) {
  return (angstrom / data.poreA) * PORE_R * 0.88
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

export function PoreGate({ active, label }: { active: boolean; label?: string }) {
  const reduced = usePrefersReducedMotion()

  const arc = data.ions.map((ion, i) => {
    const t = i / (data.ions.length - 1)
    const angle = -Math.PI * 0.72 + t * Math.PI * 0.95
    const rHyd = ionRadius(ion.hydrated)
    const rCry = Math.max(12, ionRadius(ion.crystal) * 0.72)
    const oversized = ion.hydrated > data.poreA
    const dist = PORE_R + 96 + (oversized ? 10 : 0) + Math.abs(t - 0.5) * 28
    return {
      ...ion,
      rHyd,
      rCry,
      x: CX + Math.cos(angle) * dist,
      y: CY + Math.sin(angle) * dist * 0.9,
      oversized,
      fill: hydrationColor(ion.hydration, 0.92),
      shell: hydrationColor(ion.hydration, 0.2),
      stroke: hydrationColor(ion.hydration, 0.72),
    }
  })

  return (
    <div
      className={styles.theater}
      aria-label={
        label || 'Hydrated cations with H₂O shells colored by hydration energy against a ~3 Å filter'
      }
    >
      <svg viewBox="0 0 920 520" className={styles.theaterSvg} role="img">
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
                  radius={Math.max(ion.rCry + 11, ion.rHyd * 0.64)}
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
              <text x={ion.x} y={ion.y + ion.rHyd + 16} textAnchor="middle" className={styles.theaterMark}>
                {ion.hydration} kJ/mol
              </text>
            </motion.g>
          )
        })}

        <g transform="translate(48, 468)">
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
