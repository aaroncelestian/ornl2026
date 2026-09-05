import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/poreGate.json'
import styles from './Motifs.module.css'

const W = 880
const H = 480
const PAD = { t: 48, r: 40, b: 72, l: 72 }

type Phase = 'scale' | 'gate' | 'k' | 'exchange'

function phaseForBeat(id?: string): Phase {
  if (id === 'pore' || id === 'gate') return 'gate'
  if (id === 'lock' || id === 'k' || id === 'capture') return 'k'
  if (id === 'protons' || id === 'exchange') return 'exchange'
  return 'scale'
}

export function PoreGate({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const maxR = Math.max(...data.ions.map((i) => i.hydrated)) * 1.08
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sx = (r: number) => PAD.l + (r / maxR) * plotW
  const gateX = sx(data.poreA)
  const rowH = plotH / data.ions.length

  const emphasizeK = phase === 'k' || phase === 'exchange'
  const showGate = phase !== 'scale'

  return (
    <div className={styles.plot} aria-label={label || 'Pore gate versus hydrated ion diameter'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.plotSvg} role="img">
        <text x={PAD.l} y={28} className={styles.plotHiLabel}>
          Hydrated diameter vs channel window
        </text>
        <text x={PAD.l} y={48} className={styles.plotHiSub}>
          {data.caption}
        </text>

        {/* gate band */}
        <motion.rect
          x={gateX}
          y={PAD.t}
          width={Math.max(2, sx(maxR) - gateX)}
          height={plotH}
          fill="rgba(208, 80, 50, 0.12)"
          initial={false}
          animate={{ opacity: active && showGate ? 1 : 0 }}
        />
        <motion.line
          x1={gateX}
          x2={gateX}
          y1={PAD.t - 8}
          y2={PAD.t + plotH + 8}
          stroke="rgba(243,238,228,0.75)"
          strokeWidth={2}
          initial={false}
          animate={{ opacity: active && showGate ? 1 : 0 }}
        />
        <motion.text
          x={gateX + 10}
          y={PAD.t - 14}
          className={styles.plotAnnotate}
          initial={false}
          animate={{ opacity: active && showGate ? 1 : 0 }}
        >
          {data.poreA.toFixed(1)} Å pore
        </motion.text>

        {data.ions.map((ion, i) => {
          const y = PAD.t + rowH * i + rowH * 0.5
          const barW = sx(ion.hydrated) - PAD.l
          const isK = ion.id === 'K'
          const dim = emphasizeK && !isK
          const hot = emphasizeK && isK
          return (
            <g key={ion.id} opacity={dim ? 0.28 : 1}>
              <text x={PAD.l - 14} y={y + 5} textAnchor="end" className={styles.plotTick}>
                {ion.label}
              </text>
              <motion.rect
                x={PAD.l}
                y={y - 10}
                height={20}
                rx={0}
                fill={
                  ion.pass
                    ? 'url(#passGrad)'
                    : hot
                      ? '#e07040'
                      : 'rgba(224, 112, 64, 0.55)'
                }
                initial={false}
                animate={{ width: active ? barW : 0 }}
                transition={{
                  duration: reduced ? 0 : 0.75,
                  delay: reduced || !active ? 0 : 0.08 + i * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
              <motion.text
                x={PAD.l + barW + 10}
                y={y + 5}
                className={styles.plotAnnotate}
                initial={false}
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ delay: reduced ? 0 : 0.35 + i * 0.08 }}
              >
                {ion.hydrated.toFixed(2)} Å · {ion.note}
              </motion.text>
            </g>
          )
        })}

        <defs>
          <linearGradient id="passGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7ec4d4" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#7ec4d4" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        <line
          x1={PAD.l}
          y1={PAD.t + plotH}
          x2={PAD.l + plotW}
          y2={PAD.t + plotH}
          stroke="rgba(243,238,228,0.22)"
        />
        {[1, 2, 3, 3.5].map((t) => (
          <g key={t}>
            <line
              x1={sx(t)}
              y1={PAD.t + plotH}
              x2={sx(t)}
              y2={PAD.t + plotH + 6}
              stroke="rgba(243,238,228,0.35)"
            />
            <text x={sx(t)} y={H - 28} textAnchor="middle" className={styles.plotTick}>
              {t}
            </text>
          </g>
        ))}
        <text x={PAD.l + plotW / 2} y={H - 8} textAnchor="middle" className={styles.plotAxis}>
          Hydrated diameter (Å)
        </text>
      </svg>
      <p className={styles.plotFoot}>
        {phase === 'exchange'
          ? 'Protons reorient · K⁺ locks · size-selective capture, not a soak'
          : 'Physics leaves one answer for selective monovalent transport'}
      </p>
    </div>
  )
}
