import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/voidFit.json'
import styles from './Motifs.module.css'

const CX = 640
const CY = 250
const CAGE_R = 148

type Phase = 'cage' | 'guests' | 'mismatch' | 'synthetic'

function phaseForBeat(id?: string): Phase {
  if (id === 'cargo' || id === 'guests') return 'guests'
  if (id === 'fit' || id === 'mismatch') return 'mismatch'
  if (id === 'lead' || id === 'synthetic' || id === 'scaffold') return 'synthetic'
  return 'cage'
}

function guestR(volume: number) {
  return Math.sqrt(volume / data.cageVolume) * CAGE_R
}

export function VoidFit({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const showGuests = phase !== 'cage'
  const showMismatch = phase === 'mismatch' || phase === 'synthetic'

  // Clock positions — labels sit outside the orbs, clear of each other.
  const slots = [
    { angle: -Math.PI * 0.55, dist: 0.42 },
    { angle: Math.PI * 0.08, dist: 1.05 },
    { angle: -Math.PI * 0.15, dist: 0.22 },
    { angle: Math.PI * 0.55, dist: 0.48 },
  ]

  const placed = data.guests.map((g, i) => {
    const slot = slots[i] ?? slots[0]
    const r = guestR(g.volume)
    const over = g.volume > data.cageVolume
    const dist = over ? CAGE_R * slot.dist : CAGE_R * slot.dist
    return {
      ...g,
      r,
      over,
      x: CX + Math.cos(slot.angle) * dist,
      y: CY + Math.sin(slot.angle) * dist,
      lx: CX + Math.cos(slot.angle) * (Math.max(dist, CAGE_R * 0.55) + r + 28),
      ly: CY + Math.sin(slot.angle) * (Math.max(dist, CAGE_R * 0.55) + r + 28),
    }
  })

  return (
    <div className={styles.theater} aria-label={label || 'Guest molecules sized against the rowleyite cage'}>
      <svg viewBox="0 0 920 500" className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="cageWash" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(126,196,212,0.16)" />
            <stop offset="70%" stopColor="rgba(126,196,212,0.03)" />
            <stop offset="100%" stopColor="rgba(126,196,212,0)" />
          </radialGradient>
        </defs>

        <motion.circle
          cx={CX}
          cy={CY}
          r={CAGE_R * 1.7}
          fill="url(#cageWash)"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />

        <motion.circle
          cx={CX}
          cy={CY}
          r={CAGE_R}
          fill="rgba(126,196,212,0.05)"
          stroke="#7ec4d4"
          strokeWidth={2.5}
          strokeDasharray="10 9"
          initial={false}
          animate={{ opacity: active ? 1 : 0, r: active ? CAGE_R : CAGE_R * 0.45 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x={CX} y={CY - CAGE_R - 16} textAnchor="middle" className={styles.theaterMark}>
          Rowleyite cage · ~{data.cageVolume} Å³
        </text>

        {placed.map((g, i) => (
          <motion.g
            key={g.id}
            initial={false}
            animate={{ opacity: active && showGuests ? 1 : 0 }}
            transition={{
              duration: reduced ? 0 : 0.45,
              delay: reduced || !active ? 0 : 0.1 + i * 0.08,
            }}
          >
            <motion.circle
              cx={g.x}
              cy={g.y}
              r={g.r}
              fill={g.color}
              fillOpacity={g.over && showMismatch ? 0.4 : 0.78}
              stroke={g.over && showMismatch ? 'rgba(243,238,228,0.75)' : 'transparent'}
              strokeWidth={2}
              initial={false}
              animate={{ scale: active && showGuests ? 1 : 0.15 }}
              style={{ transformOrigin: `${g.x}px ${g.y}px` }}
              transition={{
                duration: reduced ? 0 : 0.7,
                delay: reduced || !active ? 0 : 0.08 + i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
            <text x={g.lx} y={g.ly} textAnchor="middle" className={styles.theaterIon}>
              {g.label}
            </text>
            {g.over && showMismatch && (
              <text x={g.lx} y={g.ly + 18} textAnchor="middle" className={styles.theaterCall}>
                needs redesign
              </text>
            )}
          </motion.g>
        ))}

        {phase === 'synthetic' && (
          <motion.text
            x={CX}
            y={CY + CAGE_R + 40}
            textAnchor="middle"
            className={styles.theaterCall}
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
          >
            Natural geometry · pharmaceutical-grade analog
          </motion.text>
        )}
      </svg>
    </div>
  )
}
