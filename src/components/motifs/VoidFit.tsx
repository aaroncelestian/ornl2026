import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/voidFit.json'
import styles from './Motifs.module.css'

const CX = 460
const CY = 220
const STEP_MS = 2200
const HOLD_LAST_MS = 3200
const EASE = [0.16, 1, 0.3, 1] as const

type Phase = 'cage' | 'guests' | 'mismatch' | 'synthetic'

type Step = {
  id: string
  label: string
  detail: string
}

const MISMATCH_STEPS: Step[] = [
  { id: 'shell', label: 'Hydration', detail: 'Cargo held with its H₂O shell' },
  { id: 'acid', label: 'Acid cue', detail: 'Tumor pH hits the V–P framework' },
  { id: 'open', label: 'Open', detail: 'V groups leach; cage softens' },
  { id: 'egress', label: 'Delivery', detail: 'Drug + V exit the 12MR channel' },
]

const SYNTHETIC_STEPS: Step[] = [
  { id: 'load', label: 'Load', detail: 'Guest + waters enter the cage' },
  { id: 'hold', label: 'Hold', detail: 'Templated in the 4.1 Å cage' },
  { id: 'trigger', label: 'Trigger', detail: 'Ion exchange / pH shift' },
  { id: 'release', label: 'Release', detail: 'Controlled egress into the channel' },
]

function phaseForBeat(id?: string): Phase {
  if (id === 'cargo' || id === 'guests') return 'guests'
  if (id === 'fit' || id === 'mismatch') return 'mismatch'
  if (id === 'synthetic' || id === 'scaffold') return 'synthetic'
  return 'cage'
}

function WaterShell({
  radius,
  opacity,
  reduced,
  visible,
}: {
  radius: number
  opacity: number
  reduced: boolean
  visible: boolean
}) {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = -Math.PI / 2 + (i / 6) * Math.PI * 2
        const ox = CX + Math.cos(a) * radius
        const oy = CY + Math.sin(a) * radius
        return (
          <motion.g
            key={i}
            initial={false}
            animate={{ opacity: visible ? opacity : 0 }}
            transition={{ delay: reduced ? 0 : 0.04 * i, duration: reduced ? 0 : 0.35 }}
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
    </>
  )
}

/** Animated cage mechanism — 8.5 acid open, 8.6 reverse-exchange load path. */
export function VoidFit({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const synthetic = phase === 'synthetic'
  const steps = synthetic ? SYNTHETIC_STEPS : MISMATCH_STEPS
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(reduced ? steps.length - 1 : 0)
  }, [phase, active, reduced, steps.length])

  useEffect(() => {
    if (!active || reduced) return
    const last = step >= steps.length - 1
    const id = window.setTimeout(
      () => setStep((s) => (s >= steps.length - 1 ? 0 : s + 1)),
      last ? HOLD_LAST_MS : STEP_MS,
    )
    return () => window.clearTimeout(id)
  }, [active, reduced, step, steps.length])

  const title = synthetic ? 'Delivery is reverse exchange' : 'Acid opens the cage'
  const sub = synthetic
    ? `Salt-templated cages · ${data.structureNote.split('·')[2]?.trim() ?? '12MR 9.7 Å'}`
    : 'Hydration holds · tumor pH can write the release'
  const current = steps[step]

  const showLoadApproach = synthetic && step === 0
  const shellOn = synthetic ? step <= 2 : step < 3
  const shellLoose = !synthetic && step === 2
  const acidOn = synthetic ? step === 2 : step >= 1 && step < 3
  const cageSoft = !synthetic && step >= 2
  const vLeach = !synthetic && step >= 2
  const egress = synthetic ? step >= 3 : step >= 3

  const cargoX = showLoadApproach ? CX - 210 : egress ? CX + 210 : CX
  const cageDash = cageSoft ? '4 6' : '9 8'
  const cageStroke = cageSoft ? 'rgba(224,112,64,0.85)' : '#7ec4d4'
  const cageFill = cageSoft ? 'rgba(224,112,64,0.08)' : 'rgba(126,196,212,0.05)'

  const vBits = [
    { x: 28, y: -55 },
    { x: 48, y: -10 },
    { x: 36, y: 42 },
    { x: -40, y: -48 },
  ]

  return (
    <div
      className={styles.theater}
      aria-label={
        label ||
        (synthetic
          ? 'Animated reverse-exchange delivery: load, hold, trigger, release'
          : 'Animated acid-open delivery: hydration, acid cue, vanadium open, dual release')
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
          <radialGradient id="vGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(126,196,212,0.55)" />
            <stop offset="100%" stopColor="rgba(126,196,212,0)" />
          </radialGradient>
        </defs>

        <motion.text
          x={40}
          y={42}
          className={styles.theaterCall}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        >
          {title}
        </motion.text>
        <motion.text
          x={40}
          y={64}
          className={styles.theaterMark}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        >
          {sub}
        </motion.text>

        <motion.circle
          cx={CX}
          cy={CY}
          r={168}
          fill="url(#cageWash)"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />

        <motion.circle
          cx={CX}
          cy={CY}
          r={128}
          fill={cageFill}
          stroke={cageStroke}
          strokeWidth={2.25}
          strokeDasharray={cageDash}
          initial={false}
          animate={{
            opacity: active ? 1 : 0,
            r: active ? (cageSoft ? 138 : 128) : 40,
          }}
          transition={{ duration: reduced ? 0 : 0.7, ease: EASE }}
        />
        <text x={CX} y={CY - 148} textAnchor="middle" className={styles.theaterMark}>
          12MR channel · 9.7 Å
        </text>
        <text x={CX} y={CY + 158} textAnchor="middle" className={styles.theaterMark}>
          {synthetic ? 'Synthetic cage–channel analog' : 'V–P polyoxovanadate framework'}
        </text>

        {[
          { x: CX + 108, y: CY - 78 },
          { x: CX + 132, y: CY - 18 },
          { x: CX + 118, y: CY + 52 },
        ].map((h, i) => (
          <motion.g
            key={`h${i}`}
            initial={false}
            animate={{
              opacity: active && acidOn ? 1 : 0,
              x: acidOn && !reduced ? [0, -8, 0] : 0,
            }}
            transition={{
              opacity: { duration: reduced ? 0 : 0.35, delay: reduced ? 0 : i * 0.06 },
              x: { duration: 1.4, repeat: acidOn && !reduced ? Infinity : 0, ease: 'easeInOut' },
            }}
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
            <text
              x={h.x}
              y={h.y + 4}
              textAnchor="middle"
              className={styles.theaterIon}
              style={{ fontSize: 11 }}
            >
              H⁺
            </text>
          </motion.g>
        ))}

        {vBits.map((v, i) => (
          <motion.g
            key={`v${i}`}
            initial={false}
            animate={{
              opacity: active && vLeach ? (egress ? 0.4 : 0.95) : 0,
              x: active && vLeach ? (egress ? v.x + 110 : v.x * 0.55) : 0,
              y: active && vLeach ? (egress ? v.y * 0.35 : v.y * 0.35) : 0,
            }}
            transition={{ duration: reduced ? 0 : 0.85, ease: EASE, delay: reduced ? 0 : i * 0.05 }}
          >
            <circle cx={CX} cy={CY} r={16} fill="url(#vGlow)" />
            <circle
              cx={CX}
              cy={CY}
              r={9}
              fill="rgba(126,196,212,0.55)"
              stroke="#7ec4d4"
              strokeWidth={1.25}
            />
            <text
              x={CX}
              y={CY + 4}
              textAnchor="middle"
              className={styles.theaterIon}
              style={{ fontSize: 10 }}
            >
              V
            </text>
          </motion.g>
        ))}

        <motion.g
          initial={false}
          animate={{
            opacity: active ? 1 : 0,
            x: cargoX - CX,
          }}
          transition={{ duration: reduced ? 0 : 0.85, ease: EASE }}
        >
          <WaterShell
            radius={shellLoose ? 78 : showLoadApproach ? 52 : 62}
            opacity={shellLoose ? 0.45 : 0.9}
            reduced={reduced}
            visible={shellOn}
          />
          <circle cx={CX} cy={CY} r={42} fill="url(#cargoGlow)" stroke="#e07040" strokeWidth={2} />
          <text x={CX} y={CY + 5} textAnchor="middle" className={styles.theaterIon}>
            {synthetic ? 'guest' : 'cargo'}
          </text>
        </motion.g>

        {!egress && !showLoadApproach && (
          <motion.text
            x={CX}
            y={CY + 72}
            textAnchor="middle"
            className={styles.theaterMark}
            initial={false}
            animate={{ opacity: active ? 0.85 : 0 }}
          >
            4.1 Å cage
          </motion.text>
        )}

        <motion.g
          key={`${phase}-${current.id}`}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: active ? 1 : 0, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.35 }}
        >
          <text x={CX} y={420} textAnchor="middle" className={styles.theaterCall}>
            {step + 1} · {current.label}
          </text>
          <text x={CX} y={444} textAnchor="middle" className={styles.theaterMark}>
            {current.detail}
          </text>
        </motion.g>

        {steps.map((s, i) => (
          <motion.circle
            key={s.id}
            cx={CX - ((steps.length - 1) * 18) / 2 + i * 18}
            cy={472}
            r={i === step ? 5 : 3.5}
            fill={i === step ? (synthetic ? '#e07040' : '#7ec4d4') : 'rgba(243,238,228,0.28)'}
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
          />
        ))}
      </svg>
    </div>
  )
}
