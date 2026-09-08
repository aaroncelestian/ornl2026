import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/ramanExchange.json'
import {
  atTime,
  exchangeStatus,
  smoothSeries,
  VIBE_HEX,
  VIBE_SYNTH,
  VIBE_WORN,
} from '../../lib/smoothSeries'
import { CubaneInset } from './CubaneUnit'
import styles from './Motifs.module.css'

const W = 960
const H = 520
const COPY_GUTTER = 300
const GAP = 28
const PAD = { t: 64, r: 20, b: 52, l: 48 }
const STACK_LEFT = 428
const STACK_GAP = 14
const STACK_PAD = { t: 38, r: 14, b: 22, l: 38 }

const C_PEAK = '#e07040'
const C_FWHM = '#7ec4d4'
const C_XRD = '#d4a04a'
const C_RAMAN = '#7ec4d4'
const C_LIVE = '#c8f0f8'
const C_F2G = '#e0b45a'
const C_SPLIT = '#c4894a'
const C_GONE = '#564f48'
const C_AXIS = 'rgba(243,238,228,0.22)'
const C_GRID = 'rgba(243,238,228,0.08)'

const BAND_COLOR = { a1g: C_PEAK, split: C_SPLIT, f2g: C_F2G } as const

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

function spectrumPath(
  peaks: { w: number; h: number; sig?: number }[],
  sx: (w: number) => number,
  sy: (h: number) => number,
  wMin: number,
  wMax: number,
  amp: number,
  noise = 0,
) {
  const pts: Pt[] = []
  const n = 140
  for (let i = 0; i <= n; i++) {
    const w = wMin + (i / n) * (wMax - wMin)
    let y = 0.04
    for (const p of peaks) {
      const dw = w - p.w
      const sig = p.sig ?? 9
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

  const leftW = storyMode ? half : 0
  const rightW = showMn ? usable : storyMode ? half : 0
  const leftOx = COPY_GUTTER
  const rightOx = showMn ? COPY_GUTTER : COPY_GUTTER + leftW + GAP

  const plotH = H - PAD.t - PAD.b
  const plotWA = Math.max(1, leftW - PAD.l - PAD.r)
  const plotWR = Math.max(1, rightW - PAD.l - PAD.r)

  const stackH = (H - 12 - STACK_GAP) / 2
  const aBox = showOperando
    ? { ox: STACK_LEFT, oy: 6, w: W - STACK_LEFT, h: stackH, pad: STACK_PAD }
    : { ox: leftOx, oy: 0, w: leftW, h: H, pad: PAD }
  const fBox = showOperando
    ? { ox: STACK_LEFT, oy: 6 + stackH + STACK_GAP, w: W - STACK_LEFT, h: stackH, pad: STACK_PAD }
    : { ox: rightOx, oy: 0, w: rightW, h: H, pad: PAD }
  const aPlotW = Math.max(1, aBox.w - aBox.pad.l - aBox.pad.r)
  const aPlotH = Math.max(1, aBox.h - aBox.pad.t - aBox.pad.b)
  const fPlotW = Math.max(1, fBox.w - fBox.pad.l - fBox.pad.r)
  const fPlotH = Math.max(1, fBox.h - fBox.pad.t - fBox.pad.b)
  const aTop = aBox.oy + aBox.pad.t
  const aBot = aTop + aPlotH
  const fTop = fBox.oy + fBox.pad.t
  const fBot = fTop + fPlotH

  const aSmooth = useMemo(
    () => smoothSeries(data.a1g.points, { sigma: 1.0, range: 2.2, breakupT: 30, breakupSigma: 2.3 }),
    [],
  )
  const fSmooth = useMemo(
    () => smoothSeries(data.fwhm.points, { sigma: 0.9, range: 3.2, breakupT: 32, breakupSigma: 1.8 }),
    [],
  )
  const a = data.a1g
  const f = data.fwhm
  const tMax = aSmooth[aSmooth.length - 1]?.t ?? a.xMax
  const t0 = aSmooth[0]?.t ?? 0

  const sxA = (t: number) => aBox.ox + aBox.pad.l + (t / a.xMax) * aPlotW
  const syA = (w: number) => aBot - ((w - a.yMin) / (a.yMax - a.yMin)) * aPlotH
  const aPts = aSmooth.map((p) => ({ x: sxA(p.t), y: syA(p.w) }))

  const sxF = (t: number) => fBox.ox + fBox.pad.l + (t / f.xMax) * fPlotW
  const syF = (w: number) => fBot - ((w - f.yMin) / (f.yMax - f.yMin)) * fPlotH
  const fPts = fSmooth.map((p) => ({ x: sxF(p.t), y: syF(p.w) }))

  const m = data.mnLoss
  const sxM = (n: number) => rightOx + PAD.l + (n / m.xMax) * plotWR
  const syM = (pct: number) => PAD.t + plotH - (pct / m.yMax) * plotH
  const fullPts = m.fullLoad.map((p) => ({ x: sxM(p.n), y: syM(p.pct) }))
  const partPts = m.partialLoad.map((p) => ({ x: sxM(p.n), y: syM(p.pct) }))

  const [playT, setPlayT] = useState(t0)

  useEffect(() => {
    setPlayT(t0)
  }, [active, showOperando, beatKey, t0])

  const liveW = atTime(aSmooth, playT)
  const liveFwhm = atTime(fSmooth, playT)
  const exchange = exchangeStatus(playT, liveW, liveFwhm)
  const cursor = { x: sxA(playT), y: syA(liveW) }
  const cursorF = { x: sxF(playT), y: syF(liveFwhm) }

  const liveRamW0 = 540
  const liveRamW1 = 700
  const liveBaseY = 118
  const liveSx = (w: number) => 18 + ((w - liveRamW0) / (liveRamW1 - liveRamW0)) * 264
  const liveSy = (h: number) => liveBaseY - h * 92
  const livePath = spectrumPath(exchange.bands, liveSx, liveSy, liveRamW0, liveRamW1, 1)
  const liveMarks = exchange.bands.filter((b) => b.h > 0.12)

  const pathD = linePath(aPts)
  const fillD = aPts.length
    ? `${pathD} L ${sxA(aSmooth[aSmooth.length - 1].t)} ${aBot} L ${sxA(aSmooth[0].t)} ${aBot} Z`
    : ''
  const fPathD = linePath(fPts)

  const xrdAmp = 1
  const ramanAmp = phase === 'h-ex' ? 0.06 : 1
  const ramanPeaks = data.ramanSynth
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

  const vibe = showOperando
    ? exchange.vibe
    : phase === 'h-ex'
      ? VIBE_HEX
      : phase === 'durability'
        ? VIBE_WORN
        : VIBE_SYNTH

  const cubaneCaption =
    phase === 'h-ex'
      ? 'OH mutes Mn–O · disordered'
      : phase === 'durability'
        ? 'Partial load keeps the cubane'
        : 'A₁g · Mn₄O₄ breathe'

  const stateLabel =
    phase === 'as-synth'
      ? 'As-synthesized LMO'
      : phase === 'h-ex'
        ? 'H-exchanged'
        : phase === 'li-return'
          ? 'Li back in'
          : 'Durability'

  const reveal = showOperando ? Math.max(0.2, Math.min(1, playT / 8)) : 1

  return (
    <div
      className={styles.plot}
      data-operando={showOperando || undefined}
      aria-label={label || 'LMO XRD stays good; Raman blanks then returns changed'}
    >
      {showOperando ? (
        <div className={styles.cubaneStack}>
          <div className={styles.exchangeDock} data-compact="">
            <div className={styles.exchangeHead}>
              <div className={styles.exchangeFill} aria-hidden>
                <span>H</span>
                <div className={styles.exchangeBar}>
                  <i style={{ width: `${Math.round(exchange.li * 100)}%` }} />
                </div>
                <span>Li</span>
              </div>
            </div>
            <svg viewBox="0 0 300 140" className={styles.liveRaman} aria-hidden>
              <text x="18" y="16" className={styles.plotAnnotate} fontSize={13} fill="currentColor">
                Raman · live
              </text>
              <line x1="18" y1={liveBaseY} x2="282" y2={liveBaseY} stroke={C_AXIS} />
              <path
                d={livePath}
                fill="none"
                stroke={C_LIVE}
                strokeWidth="2.8"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 4px rgba(200,240,248,0.55))' }}
              />
              {liveMarks.map((b) => (
                <g key={b.kind}>
                  <line
                    x1={liveSx(b.w)}
                    y1={22}
                    x2={liveSx(b.w)}
                    y2={liveBaseY}
                    stroke={BAND_COLOR[b.kind]}
                    strokeOpacity={0.55}
                  />
                  <text
                    x={liveSx(b.w)}
                    y={34}
                    textAnchor="middle"
                    fill={BAND_COLOR[b.kind]}
                    fontSize={11}
                  >
                    {b.label}
                  </text>
                </g>
              ))}
              <text x="18" y="134" className={styles.plotTick} fontSize={10} fill="currentColor">
                540
              </text>
              <text x="268" y="134" className={styles.plotTick} fontSize={10} fill="currentColor">
                700
              </text>
            </svg>
          </div>
          <CubaneInset active={active} vibe={vibe} open />
          <p className={styles.cubaneReadout}>{exchange.cubane}</p>
        </div>
      ) : (
        <CubaneInset active={active} vibe={vibe} caption={cubaneCaption} />
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.plotSvg}
        data-has-scrub={showOperando || undefined}
        role="img"
      >
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
            <rect x={aBox.ox + aBox.pad.l} y={aTop} width={Math.max(0, aPlotW)} height={aPlotH} />
          </clipPath>
          <clipPath id="ramanRightClip">
            <rect x={fBox.ox + fBox.pad.l} y={fTop} width={Math.max(0, fPlotW)} height={fPlotH} />
          </clipPath>
        </defs>

        {storyMode && (
          <g opacity={active ? 1 : 0.45}>
            <text x={148} y={118} textAnchor="middle" className={styles.plotAnnotate} fontSize={15}>
              {stateLabel}
            </text>
            <text x={148} y={140} textAnchor="middle" className={styles.plotTick}>
              XRD keeps the lattice
            </text>
            <text x={148} y={158} textAnchor="middle" className={styles.plotTick}>
              Raman reads the cubane
            </text>
            {[
              { id: 'as-synth', y: 188, label: '1 · as-synth' },
              { id: 'h-ex', y: 222, label: '2 · H-exchange' },
              { id: 'li-return', y: 256, label: '3 · Li returns' },
            ].map((step) => {
              const on = phase === step.id
              const done = phase === 'h-ex' && step.id === 'as-synth'
              return (
                <g key={step.id} opacity={on || done ? 1 : 0.35}>
                  <circle cx={60} cy={step.y} r={5} fill={on ? C_PEAK : done ? C_XRD : C_GONE} />
                  <text x={74} y={step.y + 4} className={styles.plotTick} fill={on ? '#f3eee4' : undefined}>
                    {step.label}
                  </text>
                </g>
              )
            })}
          </g>
        )}

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
              <line x1={leftOx + PAD.l} y1={PAD.t} x2={leftOx + PAD.l} y2={PAD.t + plotH} stroke={C_AXIS} />
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
                {phase === 'h-ex' ? 'A₁g cubane stretch · basically gone' : 'A₁g cubane stretch · strong'}
              </text>
              <line
                x1={rightOx + PAD.l}
                y1={PAD.t + plotH}
                x2={rightOx + PAD.l + plotWR}
                y2={PAD.t + plotH}
                stroke={C_AXIS}
              />
              <line x1={rightOx + PAD.l} y1={PAD.t} x2={rightOx + PAD.l} y2={PAD.t + plotH} stroke={C_AXIS} />
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

        {showOperando && (
          <>
            <g>
              <text x={aBox.ox + aBox.pad.l} y={aBox.oy + 16} className={styles.plotAnnotate}>
                A₁g peak · {exchange.title}
              </text>
              <line x1={aBox.ox + aBox.pad.l} y1={aBot} x2={aBox.ox + aBox.pad.l + aPlotW} y2={aBot} stroke={C_AXIS} />
              <line x1={aBox.ox + aBox.pad.l} y1={aTop} x2={aBox.ox + aBox.pad.l} y2={aBot} stroke={C_AXIS} />
              {[630, 645, 660].map((w) => (
                <g key={w}>
                  <line x1={aBox.ox + aBox.pad.l} y1={syA(w)} x2={aBox.ox + aBox.pad.l + aPlotW} y2={syA(w)} stroke={C_GRID} />
                  <text x={aBox.ox + aBox.pad.l - 8} y={syA(w) + 4} textAnchor="end" className={styles.plotTick}>
                    {w}
                  </text>
                </g>
              ))}
              <g clipPath="url(#ramanLeftClip)">
                <path d={fillD} fill="url(#ramanFill)" opacity={active ? reveal : 0} />
                <path
                  d={pathD}
                  fill="none"
                  stroke={C_PEAK}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              {a.markers.map((mk) => {
                const revealed = playT >= mk.t - 0.5
                const onCurve = atTime(aSmooth, mk.t)
                const nearEnd = mk.t >= 25
                return (
                  <g key={mk.t} opacity={active && revealed ? 1 : 0}>
                    <line
                      x1={sxA(mk.t)}
                      y1={aTop}
                      x2={sxA(mk.t)}
                      y2={aBot}
                      stroke="rgba(243,238,228,0.22)"
                      strokeDasharray="3 4"
                    />
                    <text
                      x={sxA(mk.t) + (nearEnd ? -6 : 6)}
                      y={syA(onCurve) + (nearEnd ? 16 : -10)}
                      textAnchor={nearEnd ? 'end' : 'start'}
                      className={styles.plotAnnotate}
                      fontSize={12}
                    >
                      {mk.label}
                    </text>
                  </g>
                )
              })}
              {active && (
                <g pointerEvents="none">
                  <line x1={cursor.x} y1={aTop} x2={cursor.x} y2={aBot} stroke={C_PEAK} strokeOpacity={0.35} />
                  <circle cx={cursor.x} cy={cursor.y} r={6} fill={C_PEAK} />
                  <text x={cursor.x + 10} y={cursor.y - 10} className={styles.plotHiLabel} fontSize={18}>
                    {Math.round(liveW)}
                    <tspan className={styles.plotTick} fontSize={11} dx={3}>
                      cm⁻¹
                    </tspan>
                  </text>
                </g>
              )}
              {[0, 20, 40, 60].map((t) => (
                <text key={t} x={sxA(t)} y={aBot + 14} textAnchor="middle" className={styles.plotTick}>
                  {t}
                </text>
              ))}
            </g>

            <g>
              <text x={fBox.ox + fBox.pad.l} y={fBox.oy + 16} className={styles.plotAnnotate}>
                A₁g FWHM
              </text>
              <line x1={fBox.ox + fBox.pad.l} y1={fBot} x2={fBox.ox + fBox.pad.l + fPlotW} y2={fBot} stroke={C_AXIS} />
              <line x1={fBox.ox + fBox.pad.l} y1={fTop} x2={fBox.ox + fBox.pad.l} y2={fBot} stroke={C_AXIS} />
              {[0, 25, 50].map((w) => (
                <g key={w}>
                  <line x1={fBox.ox + fBox.pad.l} y1={syF(w)} x2={fBox.ox + fBox.pad.l + fPlotW} y2={syF(w)} stroke={C_GRID} />
                  <text x={fBox.ox + fBox.pad.l - 8} y={syF(w) + 4} textAnchor="end" className={styles.plotTick}>
                    {w}
                  </text>
                </g>
              ))}
              <g clipPath="url(#ramanRightClip)">
                <path
                  d={`${fPathD} L ${sxF(fSmooth[fSmooth.length - 1].t)} ${fBot} L ${sxF(fSmooth[0].t)} ${fBot} Z`}
                  fill="url(#fwhmFill)"
                  opacity={active ? reveal : 0}
                />
                <path
                  d={fPathD}
                  fill="none"
                  stroke={C_FWHM}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              {active && (
                <g pointerEvents="none">
                  <line x1={cursorF.x} y1={fTop} x2={cursorF.x} y2={fBot} stroke={C_FWHM} strokeOpacity={0.35} />
                  <circle cx={cursorF.x} cy={cursorF.y} r={5} fill={C_FWHM} />
                  <text x={cursorF.x + 10} y={cursorF.y - 8} className={styles.plotAnnotate} fontSize={14}>
                    {Math.round(liveFwhm)} cm⁻¹
                  </text>
                </g>
              )}
            </g>
          </>
        )}

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
            <line x1={rightOx + PAD.l} y1={PAD.t} x2={rightOx + PAD.l} y2={PAD.t + plotH} stroke={C_AXIS} />
            {[0, 12, 24].map((pct) => (
              <g key={pct}>
                <line x1={rightOx + PAD.l} y1={syM(pct)} x2={rightOx + PAD.l + plotWR} y2={syM(pct)} stroke={C_GRID} />
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
              <line x1={110} y1={0} x2={138} y2={0} stroke={C_FWHM} strokeWidth={2.5} strokeDasharray="7 5" />
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
      {showOperando && (
        <div
          className={styles.timeScrub}
          style={{
            marginLeft: `${(STACK_LEFT / W) * 100}%`,
            width: `${((W - STACK_LEFT) / W) * 100}%`,
          }}
        >
          <div className={styles.timeScrubLabel}>Time (min)</div>
          <input
            className={styles.timeScrubRange}
            type="range"
            min={t0}
            max={tMax}
            step={0.1}
            value={playT}
            data-playhead=""
            aria-label="Time in minutes"
            aria-valuemin={t0}
            aria-valuemax={tMax}
            aria-valuenow={Math.round(playT)}
            aria-valuetext={`${playT.toFixed(0)} minutes`}
            onChange={(e) => setPlayT(Number(e.target.value))}
          />
          <div className={styles.timeScrubTicks} aria-hidden>
            {[0, 20, 40, 60].map((t) => (
              <span key={t} style={{ left: `${(t / a.xMax) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
          <div className={styles.timeScrubNow}>
            {playT.toFixed(0)} min
          </div>
        </div>
      )}
    </div>
  )
}
