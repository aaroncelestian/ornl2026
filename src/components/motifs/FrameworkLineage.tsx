import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/frameworkLineage.json'
import styles from './Motifs.module.css'

const W = 920
const H = 500
const PAD = { t: 40, r: 160, b: 52, l: 56 }

function catmullRom(points: [number, number][]) {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`
  }
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

function heatColor(t: number) {
  const c = Math.max(0, Math.min(1, t))
  const r = Math.round(255)
  const g = Math.round(210 - c * 140)
  const b = Math.round(50 + c * 20)
  return `rgb(${r},${g},${b})`
}

type Phase = 'cloud' | 'natural' | 'synthetic' | 'converge'

function phaseForBeat(id?: string): Phase {
  if (id === 'precedents' || id === 'natural') return 'natural'
  if (id === 'zs9' || id === 'synthetic' || id === 'patients') return 'synthetic'
  if (id === 'converge' || id === 'same') return 'converge'
  return 'cloud'
}

export function FrameworkLineage({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const years = data.years
  const xMin = years[0]
  const xMax = years[years.length - 1]
  const yMax = 4.5
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sx = (y: number) => PAD.l + ((y - xMin) / (xMax - xMin)) * plotW
  const sy = (v: number) => PAD.t + plotH - (v / yMax) * plotH

  const bg = useMemo(
    () =>
      data.background.map((s) => {
        const pts: [number, number][] = years.map((yr, i) => [sx(yr), sy(s.vals[i] ?? 0)])
        const peak = Math.max(...s.vals)
        return { id: s.id, d: catmullRom(pts), color: heatColor(peak / yMax) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const named = data.named.map((s) => {
    const pts: [number, number][] = years.map((yr, i) => [sx(yr), sy(s.vals[i] ?? 0)])
    return { ...s, d: catmullRom(pts), end: pts[pts.length - 1] }
  })

  const showNatural = phase === 'natural' || phase === 'synthetic' || phase === 'converge'
  const showSynthetic = phase === 'synthetic' || phase === 'converge'
  const dimBg = phase !== 'cloud'

  return (
    <div className={styles.plot} aria-label={label || 'Natural to synthetic framework lineage'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.plotSvg} role="img">
        <line
          x1={PAD.l}
          y1={PAD.t + plotH}
          x2={PAD.l + plotW}
          y2={PAD.t + plotH}
          stroke="rgba(243,238,228,0.22)"
        />
        <line
          x1={PAD.l}
          y1={PAD.t}
          x2={PAD.l}
          y2={PAD.t + plotH}
          stroke="rgba(243,238,228,0.22)"
        />
        {years.map((yr) => (
          <g key={yr}>
            <line
              x1={sx(yr)}
              y1={PAD.t + plotH}
              x2={sx(yr)}
              y2={PAD.t + plotH + 6}
              stroke="rgba(243,238,228,0.35)"
            />
            <text x={sx(yr)} y={H - 16} textAnchor="middle" className={styles.plotTick}>
              {yr}
            </text>
          </g>
        ))}
        <text x={16} y={PAD.t + plotH / 2} textAnchor="middle" className={styles.plotAxis}
          transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}>
          {data.yLabel}
        </text>

        {bg.map((p, i) => (
          <motion.path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={1.05}
            initial={false}
            animate={{
              pathLength: active ? 1 : 0,
              opacity: active ? (dimBg ? 0.12 : 0.4) : 0,
            }}
            transition={{
              duration: reduced ? 0 : 1.0,
              delay: reduced || !active ? 0 : i * 0.03,
            }}
          />
        ))}

        {named.map((s, i) => {
          const isZs = s.id === 'zs9'
          const show = isZs ? showSynthetic : showNatural
          const strong = phase === 'converge' || (isZs && showSynthetic) || (!isZs && phase === 'natural')
          return (
            <g key={s.id}>
              <motion.path
                d={s.d}
                fill="none"
                stroke={isZs ? '#f0c878' : '#7ec4d4'}
                strokeWidth={isZs ? 3.2 : 2.2}
                strokeLinecap="round"
                initial={false}
                animate={{
                  pathLength: active && show ? 1 : 0,
                  opacity: active && show ? (strong ? 1 : 0.55) : 0,
                }}
                transition={{
                  duration: reduced ? 0 : 1.05,
                  delay: reduced || !active ? 0 : 0.15 + i * 0.12,
                }}
              />
              <motion.g
                initial={false}
                animate={{ opacity: active && show ? 1 : 0 }}
                transition={{ delay: reduced ? 0 : 0.4 + i * 0.1 }}
              >
                <text x={(s.end?.[0] ?? 0) + 10} y={(s.end?.[1] ?? 0) + 4} className={styles.plotHiLabel}>
                  {s.label}
                </text>
                <text x={(s.end?.[0] ?? 0) + 10} y={(s.end?.[1] ?? 0) + 20} className={styles.plotHiSub}>
                  {s.kind}
                </text>
              </motion.g>
            </g>
          )
        })}
      </svg>
      <p className={styles.plotFoot}>
        {phase === 'converge'
          ? 'Unrelated frameworks. Same channel answer. Physics left one door.'
          : phase === 'synthetic'
            ? 'Natural geometry rediscovered under synthetic and regulatory control'
            : 'Museum specimens preserved the topologies before anyone needed the drug'}
      </p>
    </div>
  )
}
