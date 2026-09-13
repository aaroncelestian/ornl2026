import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import data from '../../data/poreGate.json'
import styles from './Motifs.module.css'

/** Shannon core vs hydrated shell against the ~3 Å hydrated filter. CIF 7MR is the next beat. */
const PORE_R = 108
const CX = 620
const CY = 255

function ionRadius(angstrom: number) {
  return (angstrom / data.poreA) * PORE_R * 0.88
}

export function PoreGate({ active, label }: { active: boolean; label?: string }) {
  const reduced = usePrefersReducedMotion()

  // Ions stay in the right half — clear of stageCopy on the left.
  const arc = data.ions.map((ion, i) => {
    const t = i / (data.ions.length - 1)
    const angle = -Math.PI * 0.72 + t * Math.PI * 0.95
    const rHyd = ionRadius(ion.hydrated)
    const rCry = Math.max(10, ionRadius(ion.crystal))
    const oversized = ion.hydrated > data.poreA
    const dist = PORE_R + 78 + (oversized ? 14 : 0) + Math.abs(t - 0.5) * 36
    return {
      ...ion,
      rHyd,
      rCry,
      x: CX + Math.cos(angle) * dist,
      y: CY + Math.sin(angle) * dist * 0.92,
      oversized,
    }
  })

  return (
    <div
      className={styles.theater}
      aria-label={label || 'Crystal cores inside hydrated shells sized against a ~3 Å hydrated filter'}
    >
      <svg viewBox="0 0 920 500" className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="apertureGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(243,204,122,0.2)" />
            <stop offset="55%" stopColor="rgba(243,204,122,0.05)" />
            <stop offset="100%" stopColor="rgba(243,204,122,0)" />
          </radialGradient>
          <radialGradient id="ionShell" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(168,220,232,0.55)" />
            <stop offset="100%" stopColor="rgba(74,138,152,0.35)" />
          </radialGradient>
          <radialGradient id="ionShellHot" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(240,168,120,0.55)" />
            <stop offset="100%" stopColor="rgba(192,80,40,0.38)" />
          </radialGradient>
          <radialGradient id="ionCore" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#d8eef2" />
            <stop offset="100%" stopColor="#6a9aa4" />
          </radialGradient>
          <radialGradient id="ionCoreHot" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f0a878" />
            <stop offset="100%" stopColor="#c05028" />
          </radialGradient>
        </defs>

        <motion.circle
          cx={CX}
          cy={CY}
          r={PORE_R * 2.2}
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
        <text x={CX} y={CY + PORE_R + 28} textAnchor="middle" className={styles.theaterCall}>
          not the CIF window
        </text>

        {arc.map((ion, i) => (
          <motion.g
            key={ion.id}
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{
              duration: reduced ? 0 : 0.5,
              delay: reduced || !active ? 0 : 0.05 + i * 0.06,
            }}
          >
            {/* Hydrated shell — the size water actually presents */}
            <motion.circle
              cx={ion.x}
              cy={ion.y}
              r={ion.rHyd}
              fill={ion.oversized ? 'url(#ionShellHot)' : 'url(#ionShell)'}
              stroke={ion.oversized ? 'rgba(240,168,120,0.7)' : 'rgba(168,220,232,0.55)'}
              strokeWidth={1.5}
              initial={false}
              animate={{ cx: active ? ion.x : ion.x + 36 }}
              transition={{
                duration: reduced ? 0 : 0.85,
                delay: reduced || !active ? 0 : 0.06 + i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
            {/* Shannon core — the wrong ruler */}
            <motion.circle
              cx={ion.x}
              cy={ion.y}
              r={ion.rCry}
              fill={ion.oversized ? 'url(#ionCoreHot)' : 'url(#ionCore)'}
              initial={false}
              animate={{ cx: active ? ion.x : ion.x + 36 }}
              transition={{
                duration: reduced ? 0 : 0.85,
                delay: reduced || !active ? 0 : 0.06 + i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
            <text
              x={ion.x}
              y={ion.y + 5}
              textAnchor="middle"
              className={styles.theaterIon}
              style={{ fill: '#1a1210' }}
            >
              {ion.label}
            </text>
            <text x={ion.x} y={ion.y + ion.rHyd + 18} textAnchor="middle" className={styles.theaterMark}>
              {ion.hydrated.toFixed(1)} Å
            </text>
          </motion.g>
        ))}

        <text x={CX - 210} y={CY + PORE_R + 58} textAnchor="start" className={styles.theaterMark}>
          core = crystal · shell = hydrated
        </text>
      </svg>
    </div>
  )
}
