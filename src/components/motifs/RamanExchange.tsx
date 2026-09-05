import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/ramanExchange.json'
import styles from './Motifs.module.css'

const W = 960
const H = 500
const GAP = 36
const PAD = { t: 56, r: 28, b: 52, l: 48 }

type Phase = 'raman' | 'both' | 'durability'

function phaseForBeat(id?: string): Phase {
  if (id === 'recycle' || id === 'durability' || id === 'mn-loss') return 'durability'
  if (id === 'raman' || id === 'mechanism') return 'raman'
  return 'both'
}

function linePath(
  pts: { x: number; y: number }[],
): string {
  if (!pts.length) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

export function RamanExchange({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const panelW = (W - GAP) / 2
  const plotW = panelW - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  const a = data.a1g
  const sxA = (t: number) => PAD.l + (t / a.xMax) * plotW
  const syA = (w: number) => PAD.t + plotH - ((w - a.yMin) / (a.yMax - a.yMin)) * plotH
  const aPts = a.points.map((p) => ({ x: sxA(p.t), y: syA(p.w) }))

  const m = data.mnLoss
  const ox = panelW + GAP
  const sxM = (n: number) => ox + PAD.l + (n / m.xMax) * plotW
  const syM = (pct: number) => PAD.t + plotH - (pct / m.yMax) * plotH
  const fullPts = m.fullLoad.map((p) => ({ x: sxM(p.n), y: syM(p.pct) }))
  const partPts = m.partialLoad.map((p) => ({ x: sxM(p.n), y: syM(p.pct) }))

  const showLeft = phase !== 'durability'
  const showRight = phase !== 'raman'
  const leftOpacity = phase === 'both' ? 1 : showLeft ? 1 : 0.18
  const rightOpacity = phase === 'both' ? 1 : showRight ? 1 : 0.18

  const foot =
    phase === 'durability'
      ? data.footnotes.durability
      : phase === 'raman'
        ? data.footnotes.raman
        : 'In situ Raman mechanism · cycle protocol decides lattice survival'

  return (
    <div className={styles.plot} aria-label={label || 'LMO Raman A1g shift and Mn loss versus cycles'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.plotSvg} role="img">
        <defs>
          <linearGradient id="ramanFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e07040" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e07040" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Left panel — A1g */}
        <g opacity={leftOpacity}>
          <text x={PAD.l} y={28} className={styles.plotHiLabel}>
            A₁g during Li uptake
          </text>
          <text x={PAD.l} y={46} className={styles.plotHiSub}>
            H-LMO → Li · 635 → 656 cm⁻¹
          </text>

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

          {[635, 645, 656].map((w) => (
            <g key={w}>
              <line
                x1={PAD.l}
                y1={syA(w)}
                x2={PAD.l + plotW}
                y2={syA(w)}
                stroke="rgba(243,238,228,0.08)"
              />
              <text x={PAD.l - 8} y={syA(w) + 4} textAnchor="end" className={styles.plotTick}>
                {w}
              </text>
            </g>
          ))}

          <motion.path
            d={`${linePath(aPts)} L ${sxA(a.points[a.points.length - 1].t)} ${PAD.t + plotH} L ${sxA(a.points[0].t)} ${PAD.t + plotH} Z`}
            fill="url(#ramanFill)"
            initial={false}
            animate={{ opacity: active && showLeft ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.6 }}
          />
          <motion.path
            d={linePath(aPts)}
            fill="none"
            stroke="#e07040"
            strokeWidth={2.5}
            initial={false}
            animate={{ pathLength: active && showLeft ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
          />

          {a.markers.map((mk, i) => (
            <motion.g
              key={mk.t}
              initial={false}
              animate={{ opacity: active && showLeft ? 1 : 0 }}
              transition={{ delay: reduced ? 0 : 0.4 + i * 0.12 }}
            >
              <line
                x1={sxA(mk.t)}
                y1={PAD.t}
                x2={sxA(mk.t)}
                y2={PAD.t + plotH}
                stroke="rgba(243,238,228,0.2)"
                strokeDasharray="3 4"
              />
              <text x={sxA(mk.t) + 4} y={PAD.t + 14} className={styles.plotAnnotate}>
                {mk.label}
              </text>
            </motion.g>
          ))}

          {[0, 12, 22, 42].map((t) => (
            <text key={t} x={sxA(t)} y={H - 18} textAnchor="middle" className={styles.plotTick}>
              {t}
            </text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
            {a.xLabel}
          </text>
        </g>

        {/* Right panel — Mn loss */}
        <g opacity={rightOpacity}>
          <text x={ox + PAD.l} y={28} className={styles.plotHiLabel}>
            Mn loss vs protocol
          </text>
          <text x={ox + PAD.l} y={46} className={styles.plotHiSub}>
            Full load vs stop-before-max
          </text>

          <line
            x1={ox + PAD.l}
            y1={PAD.t + plotH}
            x2={ox + PAD.l + plotW}
            y2={PAD.t + plotH}
            stroke="rgba(243,238,228,0.22)"
          />
          <line
            x1={ox + PAD.l}
            y1={PAD.t}
            x2={ox + PAD.l}
            y2={PAD.t + plotH}
            stroke="rgba(243,238,228,0.22)"
          />

          {[0, 12, 24].map((pct) => (
            <g key={pct}>
              <line
                x1={ox + PAD.l}
                y1={syM(pct)}
                x2={ox + PAD.l + plotW}
                y2={syM(pct)}
                stroke="rgba(243,238,228,0.08)"
              />
              <text x={ox + PAD.l - 8} y={syM(pct) + 4} textAnchor="end" className={styles.plotTick}>
                {pct}%
              </text>
            </g>
          ))}

          <motion.path
            d={linePath(fullPts)}
            fill="none"
            stroke="#e07040"
            strokeWidth={2.5}
            initial={false}
            animate={{ pathLength: active && showRight ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 1, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            d={linePath(partPts)}
            fill="none"
            stroke="#7ec4d4"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            initial={false}
            animate={{ pathLength: active && showRight ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.9, delay: reduced ? 0 : 0.15 }}
          />

          <motion.circle
            cx={sxM(100)}
            cy={syM(24)}
            r={5}
            fill="#e07040"
            initial={false}
            animate={{ opacity: active && showRight ? 1 : 0 }}
          />
          <motion.text
            x={sxM(100) - 8}
            y={syM(24) - 10}
            textAnchor="end"
            className={styles.plotAnnotate}
            initial={false}
            animate={{ opacity: active && showRight ? 1 : 0 }}
          >
            24% · full load
          </motion.text>
          <motion.text
            x={sxM(100) - 8}
            y={syM(0) - 10}
            textAnchor="end"
            className={styles.plotAnnotate}
            fill="#7ec4d4"
            initial={false}
            animate={{ opacity: active && showRight ? 1 : 0 }}
          >
            ~0% · partial
          </motion.text>

          {[0, 50, 100].map((n) => (
            <text key={n} x={sxM(n)} y={H - 18} textAnchor="middle" className={styles.plotTick}>
              {n}
            </text>
          ))}
          <text x={ox + PAD.l + plotW / 2} y={H - 2} textAnchor="middle" className={styles.plotAxis}>
            {m.xLabel}
          </text>
        </g>
      </svg>
      <p className={styles.plotFoot}>{foot}</p>
    </div>
  )
}
