import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/voidFit.json'
import styles from './Motifs.module.css'

const CX = 620
const CY = 250

type Phase = 'cage' | 'guests' | 'mismatch' | 'synthetic'

function phaseForBeat(id?: string): Phase {
  if (id === 'cargo' || id === 'guests') return 'guests'
  if (id === 'fit' || id === 'mismatch') return 'mismatch'
  if (id === 'synthetic' || id === 'scaffold') return 'synthetic'
  return 'cage'
}

/** Mechanism beats — hydration / exchange / delivery — not redundant size-fit orbs. */
export function VoidFit({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)

  const steps =
    phase === 'synthetic'
      ? [
          { id: 'load', label: 'Load', detail: 'Guest + waters\nenter salt cage', x: 420 },
          { id: 'hold', label: 'Hold', detail: 'Templated in\nthe 4.1 Å cage', x: 560 },
          { id: 'trigger', label: 'Trigger', detail: 'Ion exchange /\npH shift', x: 700 },
          { id: 'release', label: 'Release', detail: 'Controlled egress\ninto the channel', x: 840 },
        ]
      : [
          { id: 'shell', label: 'Hydration', detail: 'Guest arrives\nwith its H₂O shell', x: 430 },
          { id: 'strip', label: 'Strip / keep', detail: 'Desolvation cost\ngates entry', x: 590 },
          { id: 'exchange', label: 'Exchange', detail: 'Framework ions\ntrade places', x: 750 },
          { id: 'egress', label: 'Delivery', detail: 'Channel chemistry\nsets the release', x: 880 },
        ]

  const title =
    phase === 'synthetic'
      ? 'Delivery is reverse exchange'
      : 'Hydration writes the release rate'
  const sub =
    phase === 'synthetic'
      ? `Salt-templated cages · ${data.structureNote.split('·')[2]?.trim() ?? '12MR 9.7 Å'}`
      : 'Not a size checklist — a mechanism sequence'

  return (
    <div
      className={styles.theater}
      aria-label={label || 'Rowleyite cage hydration, exchange, and delivery mechanism'}
    >
      <svg viewBox="0 0 920 500" className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="cageWash" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(126,196,212,0.14)" />
            <stop offset="70%" stopColor="rgba(126,196,212,0.03)" />
            <stop offset="100%" stopColor="rgba(126,196,212,0)" />
          </radialGradient>
          <radialGradient id="saltGlow" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(240,200,120,0.35)" />
            <stop offset="100%" stopColor="rgba(240,200,120,0)" />
          </radialGradient>
        </defs>

        <motion.circle
          cx={CX - 220}
          cy={CY}
          r={150}
          fill="url(#cageWash)"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />

        {/* Large cage / channel */}
        <motion.circle
          cx={CX - 220}
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
        <text x={CX - 220} y={CY - 128} textAnchor="middle" className={styles.theaterMark}>
          12MR channel · 9.7 Å
        </text>

        {/* Salt cage */}
        <motion.circle
          cx={CX - 220}
          cy={CY}
          r={42}
          fill="url(#saltGlow)"
          stroke="#f0c878"
          strokeWidth={2}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />
        <text x={CX - 220} y={CY + 5} textAnchor="middle" className={styles.theaterIon}>
          salt
        </text>
        <text x={CX - 220} y={CY + 58} textAnchor="middle" className={styles.theaterMark}>
          4.1 Å cage
        </text>

        {/* H₂O mediators around salt cage */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = -Math.PI / 2 + (i / 6) * Math.PI * 2
          const r = 68
          const ox = CX - 220 + Math.cos(a) * r
          const oy = CY + Math.sin(a) * r
          return (
            <motion.g
              key={i}
              initial={false}
              animate={{ opacity: active && phase !== 'cage' ? 0.9 : 0 }}
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

        <motion.text
          x={480}
          y={72}
          className={styles.theaterCall}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        >
          {title}
        </motion.text>
        <motion.text
          x={480}
          y={94}
          className={styles.theaterMark}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        >
          {sub}
        </motion.text>

        {/* Mechanism steps */}
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
                y1={CY - 10}
                x2={step.x - 28}
                y2={CY - 10}
                stroke="rgba(243,238,228,0.28)"
                strokeWidth={1.5}
              />
            )}
            <circle
              cx={step.x}
              cy={CY - 10}
              r={22}
              fill={phase === 'synthetic' ? 'rgba(224,112,64,0.18)' : 'rgba(126,196,212,0.16)'}
              stroke={phase === 'synthetic' ? '#e07040' : '#7ec4d4'}
              strokeWidth={1.75}
            />
            <text x={step.x} y={CY - 5} textAnchor="middle" className={styles.theaterIon} style={{ fontSize: 12 }}>
              {i + 1}
            </text>
            <text x={step.x} y={CY + 36} textAnchor="middle" className={styles.theaterCall}>
              {step.label}
            </text>
            {step.detail.split('\n').map((line, li) => (
              <text
                key={line}
                x={step.x}
                y={CY + 56 + li * 16}
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
