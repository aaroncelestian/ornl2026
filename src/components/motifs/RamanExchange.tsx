import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
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
const C_XRD = '#d4a04a'
const C_RAMAN = '#7ec4d4'
const C_GONE = '#564f48'
const C_AXIS = 'rgba(243,238,228,0.22)'
const C_GRID = 'rgba(243,238,228,0.08)'

type Phase = 'as-synth' | 'h-ex' | 'li-return' | 'durability'
type Pt = { x: number; y: number }

function phaseForBeat(id?: string): Phase {
  if (id === 'durability' || id === 'mn-loss') return 'durability'
  if (id === 'h-ex' || id === 'h-blank') return 'h-ex'
  if (id === 'li-return' || id === 'raman' || id === 'operando') return 'li-return'
  return 'as-synth'
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

/** Lorentzian-ish peak envelope from sparse peak list */
function spectrumPath(
  peaks: { w: number; h: number }[],
  sx: (w: number) => number,
  sy: (h: number) => number,
  wMin: number,
  wMax: number,
  amp: number,
  noise = 0,
) {
  const pts: Pt[] = []
  const n = 120
  for (let i = 0; i <= n; i++) {
    const w = wMin + (i / n) * (wMax - wMin)
    let y = 0.04
    for (const p of peaks) {
      const dw = w - p.w
      const sig = 9
      y += p.h * Math.exp((-dw * dw) / (2 * sig * sig))
    }
    if (noise > 0) y += noise * (0.5 + 0.5 * Math.sin(w * 0.37) * Math.cos(w * 0.11))
    pts.push({ x: sx(w), y: sy(y * amp) })
  }
  return linePath(pts)
}

function xrdSticks(
  peaks: { t: number; h: number }[],
  sx: (t: number) => number,
  y0: number,
  yTop: number,
  amp: number,
) {
  return peaks.map((p) => {
    const x = sx(p.t)
    const y1 = y0 - (y0 - yTop) * p.h * amp
    return { x, y0, y1 }
  })
}

export function RamanExchange({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const beatKey = scene.beat?.id ?? 'idle'

  const usable = W - COPY_GUTTER
  const half = (usable - GAP) / 2
  const storyMode = phase === 'as-synth' || phase === 'h-ex'
  const showOperando = phase === 'li-return'
  const showMn = phase === 'durability'

  const leftW = showOperando ? half : storyMode ? half : 0
  const rightW = showMn ? usable : half
  const leftOx = COPY_GUTTER
  const rightOx = showMn ? COPY_GUTTER : COPY_GUTTER + leftW + GAP

  const plotH = H - PAD.t - PAD.b
  const plotWA = Math.max(1, leftW - PAD.l - PAD.r)
  const plotWR = Math.max(1, rightW - PAD.l - PAD.r)

  const a = data.a1g
  const f = data.fwhm
  const sxA = (t: number) => leftOx + PAD.l + (t / a.xMax) * plotWA
  const syA = (w: number) => PAD.t + plotH - ((w - a.yMin) / (a.yMax - a.yMin)) * plotH
  const aPts = a.points.map((p) => ({ x: sxA(p.t), y: syA(p.w) }))

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
    if (!active || !showOperando) {
      setProgress(showOperando ? 1 : 0)
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
  }, [active, showOperando, reduced, beatKey])

  const live = interpSeries(a.points, progress)
  const liveF = interpSeries(f.points, progress)
  const cursor = { x: sxA(live.t), y: syA(live.w) }
  const cursorF = { x: sxF(liveF.t), y: syF(liveF.w) }

  const pathD = linePath(aPts)
  const fillD = aPts.length
    ? `${pathD} L ${sxA(a.points[a.points.length - 1].t)} ${PAD.t + plotH} L ${sxA(a.points[0].t)} ${PAD.t + plotH} Z`
    : ''
  const fPathD = linePath(fPts)

  // Story panels — XRD left, Raman right
  const xrdAmp = 1
  const ramanAmp = phase === 'h-ex' ? 0.06 : 1
  const ramanPeaks = phase === 'h-ex' ? data.ramanSynth : data.ramanSynth
  const ramanNoise = phase === 'h-ex' ? 0.08 : 0

  const sxXrd = (t: number) => leftOx + PAD.l + ((t - 10) / 60) * plotWA
  const sticks = useMemo(
    () => xrdSticks(data.xrdPeaks, sxXrd, PAD.t + plotH, PAD.t + 8, xrdAmp),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leftOx, plotWA, plotH, phase],
  )

  const sxRam = (w: number) => rightOx + PAD.l + ((w - 450) / 350) * plotWR
  const syRam = (h: number) => PAD.t + plotH - h * plotH * 0.92
  const ramanPath = spectrumPath(ramanPeaks, sxRam, syRam, 450, 800, ramanAmp, ramanNoise)

  const stateLabel =
    phase === 'as-synth' ? 'As-synthesized LMO' : phase === 'h-ex' ? 'H-exchanged' : phase === 'li-return' ? 'Li back in' : 'Durability'

  return (
    <div className={styles.plot} aria-label={label || 'LMO XRD stays good; Raman blanks then returns changed'}>
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
          <clipPath id="ramanLeftClip">
            <rect x={leftOx + PAD.l} y={PAD.t} width={Math.max(0, plotWA)} height={plotH} />
          </clipPath>
          <clipPath id="ramanRightClip">
            <rect x={rightOx + PAD.l} y={PAD.t} width={Math.max(0, plotWR)} height={plotH} />
          </clipPath>
        </defs>

        {/* Story gutter */}
        {(storyMode || showOperando) && (
          <g opacity={active ? 1 : 0.45}>
            <text x={148} y={210} textAnchor="middle" className={styles.plotAnnotate} fontSize={15}>
              {stateLabel}
            </text>
            <text x={148} y={232} textAnchor="middle" className={styles.plotTick}>
              XRD keeps the lattice
            </text>
            <text x={148} y={250} textAnchor="middle" className={styles.plotTick}>
              Raman reads the cubane
            </text>
            {/* Three-step rail */}
            {[
              { id: 'as-synth', y: 300, label: '1 · as-synth' },
              { id: 'h-ex', y: 340, label: '2 · H-exchange' },
              { id: 'li-return', y: 380, label: '3 · Li returns' },
            ].map((step) => {
              const on = phase === step.id || (phase === 'li-return' && step.id === 'li-return')
              const done =
                (phase === 'h-ex' && step.id === 'as-synth') ||
                (phase === 'li-return' && step.id !== 'li-return')
              return (
                <g key={step.id} opacity={on || done ? 1 : 0.35}>
                  <circle
                    cx={60}
                    cy={step.y}
                    r={5}
                    fill={on ? C_PEAK : done ? C_XRD : C_GONE}
                  />
                  <text x={74} y={step.y + 4} className={styles.plotTick} fill={on ? '#f3eee4' : undefined}>
                    {step.label}
                  </text>
                </g>
              )
            })}
          </g>
        )}

        {/* ── Story: XRD | Raman ───────────────────────── */}
        {storyMode && (
          <>
            <g>
              <text x={leftOx + PAD.l} y={28} className={styles.plotAnnotate}>
                XRD
              </text>
              <text x={leftOx + PAD.l} y={48} className={styles.plotTick}>
                {phase === 'h-ex' ? 'Still sharp · spinel intact' : 'Sharp spinel pattern · good XRD'}
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
              {sticks.map((s, i) => (
                <motion.line
                  key={i}
                  x1={s.x}
                  x2={s.x}
                  y1={s.y0}
                  y2={s.y1}
                  stroke={C_XRD}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  initial={false}
                  animate={{ opacity: active ? 1 : 0.2 }}
                  transition={{ delay: reduced ? 0 : i * 0.04 }}
                />
              ))}
              <text x={leftOx + PAD.l + plotWA / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
                2θ (Cu)
              </text>
              <text
                x={leftOx + PAD.l + plotWA - 4}
                y={PAD.t + 18}
                textAnchor="end"
                className={styles.plotHiLabel}
                fontSize={22}
                fill={C_XRD}
              >
                good
              </text>
            </g>

            <g>
              <text x={rightOx + PAD.l} y={28} className={styles.plotAnnotate}>
                Raman
              </text>
              <text x={rightOx + PAD.l} y={48} className={styles.plotTick}>
                {phase === 'h-ex'
                  ? 'A₁g cubane stretch · basically gone'
                  : 'A₁g cubane stretch · strong'}
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
              <motion.path
                d={ramanPath}
                fill="none"
                stroke={phase === 'h-ex' ? C_GONE : C_RAMAN}
                strokeWidth={phase === 'h-ex' ? 1.5 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{ opacity: active ? 1 : 0.25 }}
                transition={{ duration: reduced ? 0 : 0.5 }}
              />
              <text x={rightOx + PAD.l + plotWR / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
                cm⁻¹
              </text>
              <text
                x={rightOx + PAD.l + plotWR - 4}
                y={PAD.t + 18}
                textAnchor="end"
                className={styles.plotHiLabel}
                fontSize={22}
                fill={phase === 'h-ex' ? C_GONE : C_RAMAN}
              >
                {phase === 'h-ex' ? 'gone' : 'good'}
              </text>
            </g>
          </>
        )}

        {/* ── Li return: Fig 5 operando ─────────────────── */}
        {showOperando && (
          <>
            <g>
              <text x={leftOx + PAD.l} y={28} className={styles.plotAnnotate}>
                A₁g peak · Li back in
              </text>
              <text x={leftOx + PAD.l} y={48} className={styles.plotTick}>
                Fig 5B · Raman returns — changed · XRD still good
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

            <g>
              <text x={rightOx + PAD.l} y={28} className={styles.plotAnnotate}>
                A₁g FWHM
              </text>
              <text x={rightOx + PAD.l} y={48} className={styles.plotTick}>
                Fig 5A · pattern back · then breakup broadening
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
          </>
        )}

        {/* ── Durability ───────────────────────────────── */}
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
