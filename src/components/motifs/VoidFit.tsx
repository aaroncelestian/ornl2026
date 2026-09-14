import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/voidFit.json'
import styles from './Motifs.module.css'

const CX = 200
const CY = 210
/** Baseline for the numbered mechanism row — clear of the cage graphic. */
const STEP_Y = 390

type Phase = 'cage' | 'guests' | 'mismatch' | 'synthetic'

function phaseForBeat(id?: string): Phase {
  if (id === 'cargo' || id === 'guests') return 'guests'
  if (id === 'fit' || id === 'mismatch') return 'mismatch'
  if (id === 'synthetic' || id === 'scaffold') return 'synthetic'
  return 'cage'
}

/** Mechanism beats — hydration / acid open / dual release — not redundant size-fit orbs. */
export function VoidFit({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const steps =
    phase === 'synthetic'
      ? [
          { id: 'load', label: 'Load', detail: 'Guest + waters\nenter the cage', x: 200 },
          { id: 'hold', label: 'Hold', detail: 'Templated in\nthe 4.1 Å cage', x: 400 },
          { id: 'trigger', label: 'Trigger', detail: 'Ion exchange /\npH shift', x: 600 },
          { id: 'release', label: 'Release', detail: 'Controlled egress\ninto the channel', x: 800 },
        ]
      : [
          { id: 'shell', label: 'Hydration', detail: 'Cargo held with\nits H₂O shell', x: 200 },
          { id: 'acid', label: 'Acid cue', detail: 'Tumor pH hits\nthe V–P framework', x: 400 },
          { id: 'open', label: 'Open', detail: 'V groups leach;\ncage softens', x: 600 },
          { id: 'egress', label: 'Delivery', detail: 'Drug + V exit\nthe 12MR channel', x: 800 },
        ]

  const title =
    phase === 'synthetic'
      ? 'Delivery is reverse exchange'
      : 'Acid opens the cage'
  const sub =
    phase === 'synthetic'
      ? `Salt-templated cages · ${data.structureNote.split('·')[2]?.trim() ?? '12MR 9.7 Å'}`
      : 'Hydration holds · low pH at a tumor site can write the release'

  return (
    <div
      className={styles.theater}
      aria-label={
        label ||
        (phase === 'synthetic'
          ? 'Rowleyite cage load, hold, pH trigger, and release sequence'
          : 'Rowleyite cage hydration, acid cue, vanadium open, and dual delivery sequence')
      }
    >
      <svg viewBox="0 0 920 500" className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="cageWash" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(126,196,212,0.14)" />
            <stop offset="70%" stopColor="rgba(126,196,212,0.03)" />
            <stop offset="100%" stopColor="rgba(126,196,212,0)" />
          </radialGradient>
          <radialGradient id="cargoGlow" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(224,112,64,0.32)" />
            <stop offset="100%" stopColor="rgba(224,112,64,0)" />
          </radialGradient>
          <radialGradient id="acidGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(240,200,120,0.45)" />
            <stop offset="100%" stopColor="rgba(240,200,120,0)" />
          </radialGradient>
        </defs>

        <motion.circle
          cx={CX}
          cy={CY}
          r={150}
          fill="url(#cageWash)"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />

        {/* Large cage / channel */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={118}
          fill="rgba(126,196,212,0.05)"
          stroke="#7ec4d4"
          strokeWidth={2}
          strokeDasharray="9 8"
          initial={false}
          animate={{ opacity: active ? 1 : 0, r: active ? 118 : 40 }}
          transition={{ duration: reduced ? 0 : 0.85, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x={CX} y={CY - 128} textAnchor="middle" className={styles.theaterMark}>
          12MR channel · 9.7 Å
        </text>
        <text x={CX} y={CY + 138} textAnchor="middle" className={styles.theaterMark}>
          V–P polyoxovanadate framework
        </text>

        {/* Hydrated cargo in the cage — not the mineralogical “salt net” */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={42}
          fill="url(#cargoGlow)"
          stroke="#e07040"
          strokeWidth={2}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />
        <text x={CX} y={CY + 5} textAnchor="middle" className={styles.theaterIon}>
          cargo
        </text>
        <text x={CX} y={CY + 58} textAnchor="middle" className={styles.theaterMark}>
          4.1 Å cage
        </text>

        {/* H₂O shell around cargo */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = -Math.PI / 2 + (i / 6) * Math.PI * 2
          const r = 68
          const ox = CX + Math.cos(a) * r
          const oy = CY + Math.sin(a) * r
          return (
            <motion.g
              key={i}
              initial={false}
              animate={{ opacity: active ? 0.9 : 0 }}
              transition={{ delay: reduced ? 0 : 0.08 + i * 0.04 }}
            >
              <circle cx={ox} cy={oy} r={5} fill="#7ec4d4" fillOpacity={0.85} />
              <circle
                cx={ox + Math.cos(a) * 7 + Math.cos(a + 1.2) * 4}
                cy={oy + Math.sin(a) * 7 + Math.sin(a + 1.2) * 4}
                r={2.2}
                fill="rgba(243,238,228,0.9)"
              />
              <circle
                cx={ox + Math.cos(a) * 7 + Math.cos(a - 1.2) * 4}
                cy={oy + Math.sin(a) * 7 + Math.sin(a - 1.2) * 4}
                r={2.2}
                fill="rgba(243,238,228,0.9)"
              />
            </motion.g>
          )
        })}

        {/* Acid cue — H⁺ approaching the framework (mismatch narrative) */}
        {phase !== 'synthetic' &&
          [
            { x: CX + 95, y: CY - 70, delay: 0.2 },
            { x: CX + 118, y: CY - 20, delay: 0.28 },
            { x: CX + 108, y: CY + 40, delay: 0.36 },
          ].map((h, i) => (
            <motion.g
              key={`h${i}`}
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
              transition={{ delay: reduced ? 0 : h.delay }}
            >
              <circle cx={h.x} cy={h.y} r={14} fill="url(#acidGlow)" />
              <circle
                cx={h.x}
                cy={h.y}
                r={11}
                fill="rgba(240,200,120,0.18)"
                stroke="#f0c878"
                strokeWidth={1.5}
              />
              <text x={h.x} y={h.y + 4} textAnchor="middle" className={styles.theaterIon} style={{ fontSize: 11 }}>
                H⁺
              </text>
            </motion.g>
          ))}

        <motion.text
          x={420}
          y={48}
          className={styles.theaterCall}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        >
          {title}
        </motion.text>
        <motion.text
          x={420}
          y={70}
          className={styles.theaterMark}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        >
          {sub}
        </motion.text>

        {/* Mechanism steps — row below the cage so stage-1 copy never sits on the graphic */}
        {steps.map((step, i) => (
          <motion.g
            key={step.id}
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{
              duration: reduced ? 0 : 0.45,
              delay: reduced || !active ? 0 : 0.12 + i * 0.1,
            }}
          >
            {i > 0 && (
              <line
                x1={steps[i - 1].x + 28}
                y1={STEP_Y}
                x2={step.x - 28}
                y2={STEP_Y}
                stroke="rgba(243,238,228,0.28)"
                strokeWidth={1.5}
              />
            )}
            <circle
              cx={step.x}
              cy={STEP_Y}
              r={22}
              fill={phase === 'synthetic' ? 'rgba(224,112,64,0.18)' : 'rgba(126,196,212,0.16)'}
              stroke={phase === 'synthetic' ? '#e07040' : '#7ec4d4'}
              strokeWidth={1.75}
            />
            <text
              x={step.x}
              y={STEP_Y + 5}
              textAnchor="middle"
              className={styles.theaterIon}
              style={{ fontSize: 12 }}
            >
              {i + 1}
            </text>
            <text x={step.x} y={STEP_Y + 42} textAnchor="middle" className={styles.theaterCall}>
              {step.label}
            </text>
            {step.detail.split('\n').map((line, li) => (
              <text
                key={line}
                x={step.x}
                y={STEP_Y + 62 + li * 16}
                textAnchor="middle"
                className={styles.theaterMark}
              >
                {line}
              </text>
            ))}
          </motion.g>
        ))}
      </svg>
    </div>
  )
}
