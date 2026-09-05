import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/voidFit.json'
import styles from './Motifs.module.css'

const W = 880
const H = 460
const PAD = { t: 36, r: 40, b: 48, l: 48 }

type Phase = 'cage' | 'guests' | 'mismatch' | 'synthetic'

function phaseForBeat(id?: string): Phase {
  if (id === 'cargo' || id === 'guests') return 'guests'
  if (id === 'fit' || id === 'mismatch') return 'mismatch'
  if (id === 'lead' || id === 'synthetic' || id === 'scaffold') return 'synthetic'
  return 'cage'
}

export function VoidFit({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const maxV = Math.max(data.cageVolume, ...data.guests.map((g) => g.volume)) * 1.15
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sx = (v: number) => PAD.l + (v / maxV) * plotW
  const cageX = sx(data.cageVolume)
  const showGuests = phase !== 'cage'
  const showMismatch = phase === 'mismatch' || phase === 'synthetic'

  return (
    <div className={styles.plot} aria-label={label || 'Guest molecular volume versus rowleyite cage volume'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.plotSvg} role="img">
        <text x={PAD.l} y={24} className={styles.plotHiLabel}>
          Cage free volume vs chemotherapeutic guests
        </text>
        <text x={PAD.l} y={44} className={styles.plotHiSub}>
          {data.unit}
        </text>

        {/* cage reference band */}
        <motion.rect
          x={PAD.l}
          y={PAD.t + 24}
          height={plotH - 24}
          fill="rgba(126, 196, 212, 0.1)"
          initial={false}
          animate={{ width: active ? cageX - PAD.l : 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.line
          x1={cageX}
          x2={cageX}
          y1={PAD.t + 16}
          y2={PAD.t + plotH}
          stroke="#7ec4d4"
          strokeWidth={2}
          strokeDasharray="5 5"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />
        <motion.text
          x={cageX + 8}
          y={PAD.t + 28}
          className={styles.plotAnnotate}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        >
          Rowleyite cage ≈ {data.cageVolume} Å³
        </motion.text>

        {data.guests.map((g, i) => {
          const y = PAD.t + 56 + i * ((plotH - 40) / data.guests.length)
          const barW = sx(g.volume) - PAD.l
          const over = g.volume > data.cageVolume
          const show = showGuests
          return (
            <g key={g.id} opacity={show ? 1 : 0.15}>
              <text x={PAD.l - 8} y={y + 5} textAnchor="end" className={styles.plotTick}>
                {g.label}
              </text>
              <motion.rect
                x={PAD.l}
                y={y - 11}
                height={22}
                fill={g.color}
                fillOpacity={over && showMismatch ? 0.45 : 0.85}
                initial={false}
                animate={{ width: active && show ? barW : 0 }}
                transition={{
                  duration: reduced ? 0 : 0.7,
                  delay: reduced || !active ? 0 : 0.1 + i * 0.1,
                }}
              />
              {over && showMismatch && (
                <motion.text
                  x={Math.max(cageX, PAD.l + barW) + 10}
                  y={y + 5}
                  className={styles.plotAnnotate}
                  initial={false}
                  animate={{ opacity: active ? 1 : 0 }}
                >
                  tight / needs synthetic redesign
                </motion.text>
              )}
              {!over && showGuests && (
                <motion.text
                  x={PAD.l + barW + 10}
                  y={y + 5}
                  className={styles.plotAnnotate}
                  initial={false}
                  animate={{ opacity: active ? 1 : 0 }}
                >
                  {g.volume} Å³ · fit {(g.fit * 100).toFixed(0)}%
                </motion.text>
              )}
            </g>
          )
        })}

        <line
          x1={PAD.l}
          y1={PAD.t + plotH}
          x2={PAD.l + plotW}
          y2={PAD.t + plotH}
          stroke="rgba(243,238,228,0.22)"
        />
      </svg>
      <p className={styles.plotFoot}>
        {phase === 'synthetic'
          ? 'Natural specimen supplied the geometry. Pharma demands a synthetic, pharmaceutical-grade analog.'
          : phase === 'mismatch'
            ? 'Void match is a hypothesis generator — not a finished drug'
            : 'The useful part of the mineral is the hole'}
      </p>
    </div>
  )
}
