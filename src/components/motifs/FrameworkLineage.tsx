import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/frameworkLineage.json'
import styles from './Motifs.module.css'

const W = 920
const H = 500
const PAD = { t: 48, r: 220, b: 56, l: 64 }
const LABEL_GAP = 36

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

const STROKE: Record<string, string> = {
  zorite_ets4: '#8fd4a8',
  sitinakite: '#6ebf8a',
  cst_ets10: '#3d9a68',
  georgechaoite: '#7ec4d4',
  umbite: '#5aa8c4',
  szc: '#f0c878',
}

type Phase = 'cloud' | 'sitinakite' | 'natural'

function phaseForBeat(id?: string): Phase {
  if (id === 'sitinakite' || id === 'split') return 'sitinakite'
  if (id === 'precedents' || id === 'natural' || id === 'zs9' || id === 'synthetic') {
    return 'natural'
  }
  return 'cloud'
}

function separateLabels(raw: number[], minY: number, maxY: number) {
  const ys = [...raw]
  const order = ys
    .map((y, i) => ({ y, i }))
    .sort((a, b) => a.y - b.y)
  for (let n = 0; n < 8; n++) {
    for (let k = 1; k < order.length; k++) {
      const prev = order[k - 1]
      const cur = order[k]
      const gap = cur.y - prev.y
      if (gap >= LABEL_GAP) continue
      const need = (LABEL_GAP - gap) / 2
      prev.y = Math.max(minY, prev.y - need)
      cur.y = Math.min(maxY, cur.y + need)
    }
  }
  const out = [...ys]
  for (const row of order) out[row.i] = row.y
  return out
}

export function FrameworkLineage({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const years = data.years
  const xMin = years[0]
  const xMax = years[years.length - 1]
  const yMax = data.yMax
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sx = (yr: number) => PAD.l + ((yr - xMin) / (xMax - xMin)) * plotW
  const sy = (v: number) => PAD.t + plotH - (v / yMax) * plotH

  const named = useMemo(() => {
    const built = data.named.map((s) => {
      const start = years.findIndex((_, i) => (s.vals[i] ?? 0) > 0 || years[i] >= s.discovery)
      const sliceFrom = Math.max(0, start)
      const pts: [number, number][] = years
        .slice(sliceFrom)
        .map((yr, i) => [sx(yr), sy(s.vals[sliceFrom + i] ?? 0)])
      const last = pts[pts.length - 1]
      return {
        ...s,
        d: catmullRom(pts),
        end: last,
        labelY: last?.[1] ?? PAD.t + plotH,
        stroke: STROKE[s.id] ?? '#7ec4d4',
        focus: s.id === 'szc',
        isMineral: s.family === 'mineral',
        isSplit: s.id === 'sitinakite' || s.id === 'cst_ets10',
      }
    })
    const separated = separateLabels(
      built.map((s) => s.labelY),
      PAD.t + 8,
      PAD.t + plotH - 8,
    )
    return built.map((s, i) => ({ ...s, labelY: separated[i] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const yTicks = [0, Math.round(yMax / 3), Math.round((2 * yMax) / 3), Math.round(yMax)]

  return (
    <div
      className={styles.plot}
      aria-label={label || 'OpenAlex literature mentions versus year'}
    >
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
        {data.xTicks.map((yr) => (
          <g key={yr}>
            <line
              x1={sx(yr)}
              y1={PAD.t + plotH}
              x2={sx(yr)}
              y2={PAD.t + plotH + 6}
              stroke="rgba(243,238,228,0.35)"
            />
            <text x={sx(yr)} y={H - 18} textAnchor="middle" className={styles.plotTick}>
              {yr}
            </text>
          </g>
        ))}
        {yTicks.map((v) => (
          <text key={v} x={PAD.l - 10} y={sy(v) + 4} textAnchor="end" className={styles.plotTick}>
            {v}
          </text>
        ))}
        <text x={PAD.l + plotW / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
          {data.xLabel}
        </text>
        <text
          x={14}
          y={PAD.t + plotH / 2}
          textAnchor="middle"
          className={styles.plotAxis}
          transform={`rotate(-90 14 ${PAD.t + plotH / 2})`}
        >
          {data.yLabel}
        </text>

        {named.map((s, i) => {
          const hiddenOnCloud = phase === 'cloud' && s.id === 'cst_ets10'
          const dimOthers = phase === 'sitinakite' && !s.isSplit
          const emphasize = phase === 'sitinakite' && s.isSplit
          const opacity = hiddenOnCloud
            ? 0
            : dimOthers
              ? 0.28
              : 1
          return (
            <g key={s.id}>
              <motion.path
                d={s.d}
                fill="none"
                stroke={s.stroke}
                strokeWidth={emphasize || s.focus ? 3.2 : s.isMineral ? 1.8 : 2.2}
                strokeLinecap="round"
                initial={false}
                animate={{
                  pathLength: active && !hiddenOnCloud ? 1 : 0,
                  opacity: active ? opacity : 0,
                }}
                transition={{
                  duration: reduced ? 0 : hiddenOnCloud ? 0.35 : 1.05,
                  delay: reduced || !active || hiddenOnCloud ? 0 : 0.1 + i * 0.08,
                }}
              />
              <motion.g
                initial={false}
                animate={{ opacity: active ? (hiddenOnCloud ? 0 : dimOthers ? 0.35 : 1) : 0 }}
                transition={{ delay: reduced || hiddenOnCloud ? 0 : 0.3 + i * 0.06 }}
              >
                <text x={(s.end?.[0] ?? 0) + 10} y={s.labelY + 4} className={styles.plotAnnotate}>
                  {s.label}
                </text>
                <text x={(s.end?.[0] ?? 0) + 10} y={s.labelY + 20} className={styles.plotTick}>
                  {s.kind}
                </text>
              </motion.g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
