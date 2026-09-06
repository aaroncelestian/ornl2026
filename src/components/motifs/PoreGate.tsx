import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/poreGate.json'
import styles from './Motifs.module.css'

/** Hydrated diameters staged against a circular aperture. CIF 7MR arrives on the next beat. */
const PORE_R = 108
const CX = 620
const CY = 255

type Phase = 'scale' | 'gate' | 'k'

function phaseForBeat(id?: string): Phase {
  if (id === 'pore' || id === 'gate') return 'gate'
  if (id === 'lock' || id === 'k' || id === 'capture') return 'k'
  return 'scale'
}

function ionRadius(hydrated: number) {
  return (hydrated / data.poreA) * PORE_R * 0.88
}

export function PoreGate({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const emphasizeK = phase === 'k'
  const showGate = phase !== 'scale'

  // Ions stay in the right half — clear of stageCopy on the left.
  const arc = data.ions.map((ion, i) => {
    const t = i / (data.ions.length - 1)
    const angle = -Math.PI * 0.72 + t * Math.PI * 0.95
    const r = ionRadius(ion.hydrated)
    const blocked = !ion.pass
    const dist =
      emphasizeK && ion.id === 'K'
        ? PORE_R * 0.2
        : PORE_R + 78 + (blocked ? 18 : 0) + Math.abs(t - 0.5) * 36
    return {
      ...ion,
      r,
      x: CX + Math.cos(angle) * dist,
      y: CY + Math.sin(angle) * dist * 0.92,
      blocked,
      hot: emphasizeK && ion.id === 'K',
    }
  })

  return (
    <div className={styles.theater} aria-label={label || 'Hydrated ions approaching a channel aperture'}>
      <svg viewBox="0 0 920 500" className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="apertureGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(243,204,122,0.2)" />
            <stop offset="55%" stopColor="rgba(243,204,122,0.05)" />
            <stop offset="100%" stopColor="rgba(243,204,122,0)" />
          </radialGradient>
          <radialGradient id="ionPass" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#a8dce8" />
            <stop offset="100%" stopColor="#4a8a98" />
          </radialGradient>
          <radialGradient id="ionHot" cx="35%" cy="30%" r="70%">
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
          strokeDasharray={showGate ? '0' : '7 9'}
          initial={false}
          animate={{ opacity: active ? 1 : 0, r: active ? PORE_R : PORE_R * 0.55 }}
          transition={{ duration: reduced ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x={CX} y={CY + 6} textAnchor="middle" className={styles.theaterMark}>
          ~{data.poreA.toFixed(1)} Å
        </text>
        <text x={CX} y={CY + PORE_R + 26} textAnchor="middle" className={styles.theaterMark}>
          effective window
        </text>

        {arc.map((ion, i) => (
          <motion.g
            key={ion.id}
            initial={false}
            animate={{ opacity: active ? (emphasizeK && !ion.hot ? 0.28 : 1) : 0 }}
            transition={{
              duration: reduced ? 0 : 0.5,
              delay: reduced || !active ? 0 : 0.05 + i * 0.06,
            }}
          >
            <motion.circle
              cx={ion.x}
              cy={ion.y}
              r={ion.r}
              fill={ion.hot || ion.blocked ? 'url(#ionHot)' : 'url(#ionPass)'}
              fillOpacity={0.9}
              initial={false}
              animate={{
                cx: active ? ion.x : ion.x + 36,
                scale: ion.hot && active ? 1.06 : 1,
              }}
              style={{ transformOrigin: `${ion.x}px ${ion.y}px` }}
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
              style={{ fill: ion.hot ? '#1a1210' : '#f3eee4' }}
            >
              {ion.label}
            </text>
            {ion.hot && (
              <text x={ion.x} y={ion.y + ion.r + 20} textAnchor="middle" className={styles.theaterCall}>
                cargo
              </text>
            )}
          </motion.g>
        ))}
      </svg>
    </div>
  )
}
