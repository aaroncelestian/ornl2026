import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/ramanExchange.json'
import styles from './Motifs.module.css'

const W = 960
const H = 520
const COPY_GUTTER = 300
const GAP = 28
const PAD = { t: 64, r: 20, b: 52, l: 48 }

const C_PEAK = '#e07040'
const C_FWHM = '#7ec4d4'
const C_MN = '#f0c878'
const C_O = '#c4894a'
const C_ARROW = '#7ec4d4'
const C_AXIS = 'rgba(243,238,228,0.22)'
const C_GRID = 'rgba(243,238,228,0.08)'

type Phase = 'raman' | 'durability'
type Pt = { x: number; y: number }

function phaseForBeat(id?: string): Phase {
  if (id === 'durability' || id === 'mn-loss') return 'durability'
  return 'raman'
}

function linePath(pts: Pt[]): string {
  if (!pts.length) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function interpSeries(points: { t: number; w: number }[], u: number): { t: number; w: number } {
  if (!points.length) return { t: 0, w: 0 }
  if (u <= 0) return points[0]
  if (u >= 1) return points[points.length - 1]
  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  const target = t0 + u * (t1 - t0)
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (target >= a.t && target <= b.t) {
      const f = (target - a.t) / Math.max(1e-6, b.t - a.t)
      return { t: target, w: a.w + f * (b.w - a.w) }
    }
  }
  return points[points.length - 1]
}

/**
 * Mn₄O₄ cubane A₁g — symmetric stretch of four face-shared MnO₆
 * (paper Fig 7 / Raman PDF comparison). Radial arrows on Mn.
 */
function CubaneA1g({
  cx,
  cy,
  scale,
  breathe,
  periodSec,
}: {
  cx: number
  cy: number
  scale: number
  breathe: boolean
  periodSec: number
}) {
  // Tetrahedral Mn cage (projected) — the four Mn of the cubane
  const mn = [
    { x: 0, y: -0.72 },
    { x: 0.68, y: 0.18 },
    { x: -0.68, y: 0.18 },
    { x: 0, y: 0.62 },
  ]
  // Oxygen on opposite cube corners, between Mn pairs
  const ox = [
    { x: 0.38, y: -0.28 },
    { x: -0.38, y: -0.28 },
    { x: 0.32, y: 0.42 },
    { x: -0.32, y: 0.42 },
  ]

  return (
    <motion.g
      initial={false}
      animate={breathe ? { scale: [1, 1.14, 1] } : { scale: 1 }}
      transition={
        breathe
          ? { duration: periodSec, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {/* Mn–Mn cage edges */}
      {mn.map((a, i) =>
        mn.slice(i + 1).map((b, j) => (
          <line
            key={`mn-${i}-${j}`}
            x1={cx + a.x * scale}
            y1={cy + a.y * scale}
            x2={cx + b.x * scale}
            y2={cy + b.y * scale}
            stroke="rgba(240,200,120,0.4)"
            strokeWidth={1.6}
          />
        )),
      )}
      {/* Mn–O spokes */}
      {ox.map((o, i) => {
        const near = [...mn].sort(
          (a, b) =>
            (a.x - o.x) ** 2 + (a.y - o.y) ** 2 - ((b.x - o.x) ** 2 + (b.y - o.y) ** 2),
        )
        return near.slice(0, 2).map((m, k) => (
          <line
            key={`mo-${i}-${k}`}
            x1={cx + o.x * scale}
            y1={cy + o.y * scale}
            x2={cx + m.x * scale}
            y2={cy + m.y * scale}
            stroke="rgba(196,137,74,0.45)"
            strokeWidth={1.2}
          />
        ))
      })}
      {/* A₁g radial arrows through Mn — outward breathing */}
      {mn.map((m, i) => {
        const len = Math.hypot(m.x, m.y) || 1
        const ux = m.x / len
        const uy = m.y / len
        const x1 = cx + ux * scale * 0.15
        const y1 = cy + uy * scale * 0.15
        const x2 = cx + ux * scale * 1.45
        const y2 = cy + uy * scale * 1.45
        return (
          <line
            key={`arrow-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={C_ARROW}
            strokeWidth={2.2}
            strokeLinecap="round"
            markerEnd="url(#a1gArrow)"
          />
        )
      })}
      {ox.map((o, i) => (
        <circle
          key={`o-${i}`}
          cx={cx + o.x * scale}
          cy={cy + o.y * scale}
          r={5}
          fill={C_O}
          fillOpacity={0.95}
        />
      ))}
      {mn.map((m, i) => (
        <g key={`m-${i}`}>
          <circle cx={cx + m.x * scale} cy={cy + m.y * scale} r={8} fill={C_MN} />
          <text
            x={cx + m.x * scale}
            y={cy + m.y * scale + 3}
            textAnchor="middle"
            className={styles.a1gMnLabel}
          >
            Mn
          </text>
        </g>
      ))}
    </motion.g>
  )
}

export function RamanExchange({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const beatKey = scene.beat?.id ?? 'idle'

  const usable = W - COPY_GUTTER
  const half = (usable - GAP) / 2
  // Raman: Fig 5 dual panel. Durability: Mn-loss full usable width.
  const leftW = phase === 'raman' ? half : 0
  const rightW = phase === 'durability' ? usable : half
  const leftOx = COPY_GUTTER
  const rightOx = phase === 'durability' ? COPY_GUTTER : COPY_GUTTER + leftW + GAP

  const showPeak = phase === 'raman'
  const showFwhm = phase === 'raman'
  const showMn = phase === 'durability'

  const a = data.a1g
  const f = data.fwhm
  const plotH = H - PAD.t - PAD.b
  const plotWA = Math.max(1, leftW - PAD.l - PAD.r)
  const sxA = (t: number) => leftOx + PAD.l + (t / a.xMax) * plotWA
  const syA = (w: number) => PAD.t + plotH - ((w - a.yMin) / (a.yMax - a.yMin)) * plotH
  const aPts = a.points.map((p) => ({ x: sxA(p.t), y: syA(p.w) }))

  const plotWR = Math.max(1, rightW - PAD.l - PAD.r)
  const sxF = (t: number) => rightOx + PAD.l + (t / f.xMax) * plotWR
  const syF = (w: number) => PAD.t + plotH - ((w - f.yMin) / (f.yMax - f.yMin)) * plotH
  const fPts = f.points.map((p) => ({ x: sxF(p.t), y: syF(p.w) }))

  const m = data.mnLoss
  const sxM = (n: number) => rightOx + PAD.l + (n / m.xMax) * plotWR
  const syM = (pct: number) => PAD.t + plotH - (pct / m.yMax) * plotH
  const fullPts = m.fullLoad.map((p) => ({ x: sxM(p.n), y: syM(p.pct) }))
  const partPts = m.partialLoad.map((p) => ({ x: sxM(p.n), y: syM(p.pct) }))

  const [progress, setProgress] = useState(1)

  useEffect(() => {
    if (!active || !showPeak) {
      setProgress(showPeak ? 1 : 0)
      return
    }
    if (reduced) {
      setProgress(1)
      return
    }
    setProgress(0)
    const start = performance.now()
    const dur = 2800
    let raf = 0
    const tick = (now: number) => {
      const u = easeOutCubic(Math.min(1, (now - start) / dur))
      setProgress(u)
      if (u < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, showPeak, reduced, beatKey])

  const live = interpSeries(a.points, progress)
  const liveF = interpSeries(f.points, progress)
  const cursor = { x: sxA(live.t), y: syA(live.w) }
  const cursorF = { x: sxF(liveF.t), y: syF(liveF.w) }
  // Faster breathe as mode stiffens on the plateau; slower through the breakup dip
  const vibPeriod = live.w >= 654 ? 0.42 : live.w >= 645 ? 0.58 : live.w <= 640 ? 0.95 : 0.72

  const pathD = linePath(aPts)
  const fillD = aPts.length
    ? `${pathD} L ${sxA(a.points[a.points.length - 1].t)} ${PAD.t + plotH} L ${sxA(a.points[0].t)} ${PAD.t + plotH} Z`
    : ''
  const fPathD = linePath(fPts)

  const vibeCx = 148
  const vibeCy = 292

  return (
    <div className={styles.plot} aria-label={label || 'LMO Raman A1g shift, FWHM, and Mn loss'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.plotSvg} role="img">
        <defs>
          <linearGradient id="ramanFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C_PEAK} stopOpacity="0.38" />
            <stop offset="100%" stopColor={C_PEAK} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="fwhmFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C_FWHM} stopOpacity="0.32" />
            <stop offset="100%" stopColor={C_FWHM} stopOpacity="0.02" />
          </linearGradient>
          <marker id="a1gArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill={C_ARROW} />
          </marker>
          <clipPath id="ramanLeftClip">
            <rect x={leftOx + PAD.l} y={PAD.t} width={Math.max(0, plotWA)} height={plotH} />
          </clipPath>
          <clipPath id="ramanRightClip">
            <rect x={rightOx + PAD.l} y={PAD.t} width={Math.max(0, plotWR)} height={plotH} />
          </clipPath>
        </defs>

        {/* Cubane A₁g schematic — 4 MnO₆ / Mn₄O₄ stretch */}
        {showPeak && (
          <g opacity={active ? 0.98 : 0.45}>
            <text x={vibeCx} y={vibeCy - 78} textAnchor="middle" className={styles.plotAnnotate} fontSize={15}>
              A₁g · Mn₄O₄ cubane
            </text>
            <text x={vibeCx} y={vibeCy - 60} textAnchor="middle" className={styles.plotTick}>
              4 face-shared MnO₆
            </text>
            <CubaneA1g
              cx={vibeCx}
              cy={vibeCy}
              scale={38}
              breathe={active && !reduced}
              periodSec={vibPeriod}
            />
            <text x={vibeCx} y={vibeCy + 78} textAnchor="middle" className={styles.plotTick}>
              stretch · {Math.round(live.w)} cm⁻¹
            </text>
          </g>
        )}

        {/* Left — Fig 5B A₁g peak position */}
        {showPeak && (
          <g>
            <text x={leftOx + PAD.l} y={28} className={styles.plotAnnotate}>
              A₁g peak position
            </text>
            <text x={leftOx + PAD.l} y={48} className={styles.plotTick}>
              Fig 5B · ~645 → 657 cm⁻¹ · breakup ~29 min
            </text>

            <line
              x1={leftOx + PAD.l}
              y1={PAD.t + plotH}
              x2={leftOx + PAD.l + plotWA}
              y2={PAD.t + plotH}
              stroke={C_AXIS}
            />
            <line
              x1={leftOx + PAD.l}
              y1={PAD.t}
              x2={leftOx + PAD.l}
              y2={PAD.t + plotH}
              stroke={C_AXIS}
            />

            {[630, 645, 660].map((w) => (
              <g key={w}>
                <line
                  x1={leftOx + PAD.l}
                  y1={syA(w)}
                  x2={leftOx + PAD.l + plotWA}
                  y2={syA(w)}
                  stroke={C_GRID}
                />
                <text x={leftOx + PAD.l - 8} y={syA(w) + 4} textAnchor="end" className={styles.plotTick}>
                  {w}
                </text>
              </g>
            ))}

            <g clipPath="url(#ramanLeftClip)">
              <path d={fillD} fill="url(#ramanFill)" opacity={active ? Math.min(1, progress * 1.2) : 0} />
              <path
                d={pathD}
                fill="none"
                stroke={C_PEAK}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - (active ? progress : 0)}
              />
            </g>

            {a.markers.map((mk) => {
              const revealed = live.t >= mk.t - 0.5
              const onCurve = interpSeries(
                a.points,
                (mk.t - a.points[0].t) / (a.points[a.points.length - 1].t - a.points[0].t),
              )
              const nearEnd = mk.t >= 25
              return (
                <g key={mk.t} opacity={active && revealed ? 1 : 0}>
                  <line
                    x1={sxA(mk.t)}
                    y1={PAD.t}
                    x2={sxA(mk.t)}
                    y2={PAD.t + plotH}
                    stroke="rgba(243,238,228,0.22)"
                    strokeDasharray="3 4"
                  />
                  <text
                    x={sxA(mk.t) + (nearEnd ? -6 : 6)}
                    y={syA(onCurve.w) + (nearEnd ? 20 : -12)}
                    textAnchor={nearEnd ? 'end' : 'start'}
                    className={styles.plotAnnotate}
                    fontSize={13}
                  >
                    {mk.label}
                  </text>
                </g>
              )
            })}

            {active && (
              <g>
                <circle cx={cursor.x} cy={cursor.y} r={6} fill={C_PEAK} />
                <text x={cursor.x + 12} y={cursor.y - 12} className={styles.plotHiLabel} fontSize={20}>
                  {Math.round(live.w)}
                  <tspan className={styles.plotTick} fontSize={12} dx={3}>
                    cm⁻¹
                  </tspan>
                </text>
              </g>
            )}

            {[0, 20, 40, 60].map((t) => (
              <text key={t} x={sxA(t)} y={H - 18} textAnchor="middle" className={styles.plotTick}>
                {t}
              </text>
            ))}
            <text x={leftOx + PAD.l + plotWA / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
              {a.xLabel}
            </text>
          </g>
        )}

        {/* Right on Raman — Fig 5A FWHM */}
        {showFwhm && (
          <g>
            <text x={rightOx + PAD.l} y={28} className={styles.plotAnnotate}>
              A₁g FWHM
            </text>
            <text x={rightOx + PAD.l} y={48} className={styles.plotTick}>
              Fig 5A · narrows in 8a · spikes at breakup
            </text>

            <line
              x1={rightOx + PAD.l}
              y1={PAD.t + plotH}
              x2={rightOx + PAD.l + plotWR}
              y2={PAD.t + plotH}
              stroke={C_AXIS}
            />
            <line
              x1={rightOx + PAD.l}
              y1={PAD.t}
              x2={rightOx + PAD.l}
              y2={PAD.t + plotH}
              stroke={C_AXIS}
            />

            {[0, 25, 50].map((w) => (
              <g key={w}>
                <line
                  x1={rightOx + PAD.l}
                  y1={syF(w)}
                  x2={rightOx + PAD.l + plotWR}
                  y2={syF(w)}
                  stroke={C_GRID}
                />
                <text x={rightOx + PAD.l - 8} y={syF(w) + 4} textAnchor="end" className={styles.plotTick}>
                  {w}
                </text>
              </g>
            ))}

            <g clipPath="url(#ramanRightClip)">
              <path
                d={`${fPathD} L ${sxF(f.points[f.points.length - 1].t)} ${PAD.t + plotH} L ${sxF(f.points[0].t)} ${PAD.t + plotH} Z`}
                fill="url(#fwhmFill)"
                opacity={active ? Math.min(1, progress * 1.2) : 0}
              />
              <path
                d={fPathD}
                fill="none"
                stroke={C_FWHM}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - (active ? progress : 0)}
              />
            </g>

            {active && (
              <g>
                <circle cx={cursorF.x} cy={cursorF.y} r={5} fill={C_FWHM} />
                <text x={cursorF.x + 10} y={cursorF.y - 10} className={styles.plotAnnotate} fontSize={15}>
                  {Math.round(liveF.w)} cm⁻¹
                </text>
              </g>
            )}

            {[0, 20, 40, 60].map((t) => (
              <text key={t} x={sxF(t)} y={H - 18} textAnchor="middle" className={styles.plotTick}>
                {t}
              </text>
            ))}
            <text x={rightOx + PAD.l + plotWR / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
              {f.xLabel}
            </text>
          </g>
        )}

        {/* Durability — Mn loss */}
        {showMn && (
          <g>
            <text x={rightOx + PAD.l} y={28} className={styles.plotAnnotate}>
              Mn loss vs protocol
            </text>
            <text x={rightOx + PAD.l} y={48} className={styles.plotTick}>
              Full load vs stop-before-max · 24% at 100 cycles
            </text>

            <line
              x1={rightOx + PAD.l}
              y1={PAD.t + plotH}
              x2={rightOx + PAD.l + plotWR}
              y2={PAD.t + plotH}
              stroke={C_AXIS}
            />
            <line
              x1={rightOx + PAD.l}
              y1={PAD.t}
              x2={rightOx + PAD.l}
              y2={PAD.t + plotH}
              stroke={C_AXIS}
            />

            {[0, 12, 24].map((pct) => (
              <g key={pct}>
                <line
                  x1={rightOx + PAD.l}
                  y1={syM(pct)}
                  x2={rightOx + PAD.l + plotWR}
                  y2={syM(pct)}
                  stroke={C_GRID}
                />
                <text x={rightOx + PAD.l - 8} y={syM(pct) + 4} textAnchor="end" className={styles.plotTick}>
                  {pct}%
                </text>
              </g>
            ))}

            <motion.path
              d={linePath(fullPts)}
              fill="none"
              stroke={C_PEAK}
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
              transition={{ duration: reduced ? 0 : 1, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.path
              d={linePath(partPts)}
              fill="none"
              stroke={C_FWHM}
              strokeWidth={2.75}
              strokeDasharray="7 5"
              strokeLinecap="round"
              initial={false}
              animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
              transition={{ duration: reduced ? 0 : 0.9, delay: reduced ? 0 : 0.12 }}
            />

            <motion.circle
              cx={sxM(100)}
              cy={syM(24)}
              r={6}
              fill={C_PEAK}
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
            />
            <motion.circle
              cx={sxM(100)}
              cy={syM(0)}
              r={6}
              fill={C_FWHM}
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
            />
            <motion.text
              x={sxM(100) - 10}
              y={syM(24) - 12}
              textAnchor="end"
              className={styles.plotAnnotate}
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
            >
              24% · full load
            </motion.text>
            <motion.text
              x={sxM(100) - 10}
              y={syM(0) - 12}
              textAnchor="end"
              className={styles.plotAnnotate}
              fill={C_FWHM}
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
            >
              ~0% · partial
            </motion.text>

            {/* Legend */}
            <g transform={`translate(${rightOx + PAD.l + 8}, ${PAD.t + 18})`} opacity={active ? 1 : 0}>
              <line x1={0} y1={0} x2={28} y2={0} stroke={C_PEAK} strokeWidth={2.5} />
              <text x={34} y={4} className={styles.plotTick}>
                full Li/H
              </text>
              <line
                x1={110}
                y1={0}
                x2={138}
                y2={0}
                stroke={C_FWHM}
                strokeWidth={2.5}
                strokeDasharray="7 5"
              />
              <text x={144} y={4} className={styles.plotTick}>
                stop-before-max
              </text>
            </g>

            {[0, 50, 100].map((n) => (
              <text key={n} x={sxM(n)} y={H - 18} textAnchor="middle" className={styles.plotTick}>
                {n}
              </text>
            ))}
            <text x={rightOx + PAD.l + plotWR / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
              {m.xLabel}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
