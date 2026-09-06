import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/frameworkDensity.json'
import styles from './Motifs.module.css'

const W = 920
const H = 500
const PAD = { t: 78, r: 48, b: 100, l: 168 }

type Phase = 'density' | 'rings' | 'both'

function phaseForBeat(id?: string): Phase {
  if (id === 'rings' || id === 'window') return 'rings'
  if (id === 'density-only') return 'density'
  return 'both'
}

export function FrameworkDensity({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const maxD = Math.max(...data.materials.map((m) => m.density)) * 1.12
  const sx = (d: number) => PAD.l + (d / maxD) * plotW
  const rowH = plotH / data.materials.length

  const showBars = phase !== 'rings'
  const showRings = phase === 'rings' || phase === 'both'

  const foot =
    phase === 'rings'
      ? `12-membered rings: ${data.rings.large.value} Å between large cages · ${data.rings.small.value} Å effective into the salt cage`
      : phase === 'both'
        ? 'Extreme porosity is the prior — guest volumes are the next filter'
        : 'Rowleyite: lowest framework density of any natural crystalline framework'

  return (
    <div className={styles.plot} aria-label={label || 'Framework density comparison for rowleyite'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.plotSvg} role="img">
        <text x={PAD.l} y={32} className={styles.plotHiLabel}>
          {data.caption}
        </text>
        <text x={PAD.l} y={54} className={styles.plotHiSub}>
          {data.source}
        </text>

        {/* density axis ticks */}
        {[5, 10, 15].map((d) => (
          <g key={d} opacity={showBars ? 1 : 0.25}>
            <line
              x1={sx(d)}
              y1={PAD.t}
              x2={sx(d)}
              y2={PAD.t + plotH}
              stroke="rgba(243,238,228,0.08)"
            />
            <text x={sx(d)} y={PAD.t + plotH + 18} textAnchor="middle" className={styles.plotTick}>
              {d}
            </text>
          </g>
        ))}

        {data.materials.map((mat, i) => {
          const y = PAD.t + rowH * i + rowH * 0.5
          const barW = sx(mat.density) - PAD.l
          const hi = mat.kind === 'highlight'
          const synth = mat.kind === 'synthetic'
          const color = hi ? '#e07040' : synth ? 'rgba(126,196,212,0.55)' : 'rgba(212,160,74,0.7)'
          return (
            <g key={mat.id} opacity={showBars ? 1 : 0.2}>
              <text x={PAD.l - 14} y={y + 5} textAnchor="end" className={styles.plotTick}>
                {mat.label}
              </text>
              <motion.rect
                x={PAD.l}
                y={y - (hi ? 5 : 3.5)}
                height={hi ? 10 : 7}
                fill={color}
                initial={false}
                animate={{ width: active && showBars ? barW : 0 }}
                transition={{
                  duration: reduced ? 0 : 0.7,
                  delay: reduced || !active ? 0 : 0.08 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
              <motion.circle
                cx={PAD.l + barW}
                cy={y}
                r={hi ? 8 : 5.5}
                fill={color}
                initial={false}
                animate={{
                  opacity: active && showBars ? 1 : 0,
                  cx: active && showBars ? PAD.l + barW : PAD.l,
                }}
                transition={{
                  duration: reduced ? 0 : 0.7,
                  delay: reduced || !active ? 0 : 0.08 + i * 0.08,
                }}
              />
              <motion.text
                x={PAD.l + barW + 12}
                y={y + 5}
                className={styles.plotAnnotate}
                initial={false}
                animate={{ opacity: active && showBars ? 1 : 0 }}
                transition={{ delay: reduced ? 0 : 0.35 + i * 0.06 }}
              >
                {mat.density.toFixed(1)}
                {hi ? ' · lowest natural' : ''}
              </motion.text>
            </g>
          )
        })}

        <text x={PAD.l + plotW / 2} y={PAD.t + plotH + 38} textAnchor="middle" className={styles.plotAxis}>
          {data.unit}
        </text>

        {/* Ring annotation strip */}
        <motion.g
          initial={false}
          animate={{ opacity: active && showRings ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.5 }}
        >
          <rect
            x={PAD.l}
            y={H - 52}
            width={plotW}
            height={36}
            fill="rgba(126,196,212,0.1)"
            stroke="rgba(126,196,212,0.28)"
          />
          <text x={PAD.l + 16} y={H - 30} className={styles.plotAnnotate}>
            {data.rings.large.label}: {data.rings.large.value} {data.rings.large.unit}
          </text>
          <text x={PAD.l + plotW / 2 + 8} y={H - 30} className={styles.plotAnnotate}>
            {data.rings.small.label}: {data.rings.small.value} {data.rings.small.unit}
          </text>
        </motion.g>
      </svg>
      <p className={styles.plotFoot}>{foot}</p>
    </div>
  )
}
