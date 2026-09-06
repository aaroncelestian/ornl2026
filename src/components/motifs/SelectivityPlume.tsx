import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/selectivityPlume.json'
import styles from './Motifs.module.css'

const W = 920
const H = 520
const PAD = { t: 56, r: 40, b: 56, l: 200 }

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
  if (c < 0.5) {
    const u = c / 0.5
    const r = Math.round(255)
    const g = Math.round(220 - u * 100)
    const b = Math.round(40 + u * 20)
    return `rgb(${r},${g},${b})`
  }
  const u = (c - 0.5) / 0.5
  const r = Math.round(255 - u * 80)
  const g = Math.round(120 - u * 90)
  const b = Math.round(60 - u * 40)
  return `rgb(${r},${g},${b})`
}

type Phase = 'cloud' | 'gate' | 'spinel' | 'ions'

function phaseForBeat(id?: string): Phase {
  if (id === 'gate' || id === 'radius') return 'gate'
  if (id === 'spinel-peak' || id === 'absorb' || id === 'selectivity') return 'spinel'
  if (id === 'ions' || id === 'competitors') return 'ions'
  return 'cloud'
}

export function SelectivityPlume({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const xMin = data.radii[0]
  const xMax = data.radii[data.radii.length - 1]
  const yMax = data.yMax
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  const sx = (r: number) => PAD.l + ((r - xMin) / (xMax - xMin)) * plotW
  const sy = (v: number) => PAD.t + plotH - (v / yMax) * plotH

  const bgPaths = useMemo(
    () =>
      data.series.map((s) => {
        const pts: [number, number][] = data.radii.map((r, i) => [sx(r), sy(s.vals[i] ?? 0)])
        const peak = Math.max(...s.vals)
        return { id: s.id, d: catmullRom(pts), peak, color: heatColor(peak / yMax) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const hiPts: [number, number][] = data.radii.map((r, i) => [
    sx(r),
    sy(data.highlight.vals[i] ?? 0),
  ])
  const hiPath = catmullRom(hiPts)
  const showGate = phase === 'gate' || phase === 'spinel' || phase === 'ions'
  const showHi = phase === 'spinel' || phase === 'ions'
  const showIons = phase === 'ions'

  return (
    <div className={styles.plot} aria-label={label || 'Lithium selectivity plume versus ionic radius'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.plotSvg} role="img">
        <defs>
          <linearGradient id="plumeFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffcc44" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#e07030" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#8a2010" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* axes */}
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
        {data.xTicks.map((t) => (
          <g key={t}>
            <line
              x1={sx(t)}
              y1={PAD.t + plotH}
              x2={sx(t)}
              y2={PAD.t + plotH + 6}
              stroke="rgba(243,238,228,0.35)"
            />
            <text x={sx(t)} y={H - 18} textAnchor="middle" className={styles.plotTick}>
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        <text x={PAD.l + plotW / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
          {data.xLabel}
        </text>
        <text
          x={16}
          y={PAD.t + plotH / 2}
          textAnchor="middle"
          className={styles.plotAxis}
          transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}
        >
          {data.yLabel}
        </text>

        {/* background plume */}
        {bgPaths.map((p, i) => (
          <motion.path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={1.1}
            strokeOpacity={phase === 'cloud' ? 0.45 : 0.18}
            initial={false}
            animate={{
              pathLength: active ? 1 : 0,
              opacity: active ? (phase === 'cloud' ? 0.45 : 0.18) : 0,
            }}
            transition={{
              duration: reduced ? 0 : 1.1,
              delay: reduced || !active ? 0 : 0.02 * i,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}

        {/* Li radius gate */}
        <motion.line
          x1={sx(data.gate)}
          x2={sx(data.gate)}
          y1={PAD.t}
          y2={PAD.t + plotH}
          stroke="rgba(243,238,228,0.55)"
          strokeDasharray="4 5"
          initial={false}
          animate={{ opacity: active && showGate ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.45 }}
        />
        <motion.text
          x={sx(data.gate) + 8}
          y={PAD.t + 16}
          className={styles.plotAnnotate}
          initial={false}
          animate={{ opacity: active && showGate ? 1 : 0 }}
        >
          Li⁺ · 0.76 Å
        </motion.text>

        {/* highlighted spinel */}
        <motion.path
          d={hiPath}
          fill="none"
          stroke="url(#plumeFade)"
          strokeWidth={3.2}
          strokeLinecap="round"
          initial={false}
          animate={{
            pathLength: active && showHi ? 1 : 0,
            opacity: active && showHi ? 1 : 0,
          }}
          transition={{ duration: reduced ? 0 : 1.0, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.g
          initial={false}
          animate={{ opacity: active && showHi ? 1 : 0 }}
          transition={{ delay: reduced ? 0 : 0.35 }}
        >
          <text x={sx(0.76) + 14} y={sy(5.8) - 8} className={styles.plotAnnotate}>
            {data.highlight.label}
          </text>
          <text x={sx(0.76) + 14} y={sy(5.8) + 12} className={styles.plotTick}>
            {data.highlight.subtitle}
          </text>
        </motion.g>

        {/* ion callouts */}
        {showIons &&
          data.ions.map((ion, i) => (
            <motion.g
              key={ion.id}
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
              transition={{ delay: reduced ? 0 : 0.1 + i * 0.08 }}
            >
              <circle
                cx={sx(ion.r)}
                cy={PAD.t + 28 + (i % 2) * 16}
                r={3}
                fill="rgba(243,238,228,0.7)"
              />
              <text
                x={sx(ion.r)}
                y={PAD.t + 48 + (i % 2) * 16}
                textAnchor="middle"
                className={styles.plotAnnotate}
              >
                {ion.label}
              </text>
            </motion.g>
          ))}
      </svg>
    </div>
  )
}
