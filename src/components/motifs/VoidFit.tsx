import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import styles from './Motifs.module.css'

const CX = 560
const CY = 230
const R = 118
const EASE = [0.16, 1, 0.3, 1] as const

type Phase = 'mismatch' | 'synthetic' | 'other'

type Step = { id: string; label: string; detail: string }

/** 8.5 — hand-sketch sequence: hold → acid → V first → cargo. */
const ACID_STEPS: Step[] = [
  { id: 'hold', label: 'Hold', detail: 'Cargo in the large cage' },
  { id: 'acid', label: 'Acid', detail: 'H⁺ docks on the framework' },
  { id: 'v', label: 'V first', detail: 'Vanadium groups leave; cage opens' },
  { id: 'cargo', label: 'Cargo', detail: 'Only at acidic sites' },
]

/** 8.6 — same geometry, engineered as reverse exchange. */
const SYNTH_STEPS: Step[] = [
  { id: 'load', label: 'Load', detail: 'Guest enters the large cage' },
  { id: 'hold', label: 'Hold', detail: 'Templated until the trigger' },
  { id: 'trigger', label: 'Trigger', detail: 'pH / exchange at the site' },
  { id: 'release', label: 'Release', detail: 'V first, then cargo' },
]

function phaseForBeat(id?: string): Phase {
  if (id === 'fit' || id === 'mismatch') return 'mismatch'
  if (id === 'synthetic' || id === 'scaffold') return 'synthetic'
  return 'other'
}

/** Open C-ring with the gap on the right (matches the sketch). */
function openRingPath(cx: number, cy: number, r: number) {
  const start = (55 * Math.PI) / 180
  const end = (305 * Math.PI) / 180
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`
}

const H_SITES = [
  { a: -40, r: R + 22 },
  { a: 8, r: R + 22 },
  { a: 55, r: R + 22 },
  { a: 200, r: R + 22 },
]

const V_BITS = [
  { a: 10, dist: 46 },
  { a: -15, dist: 58 },
  { a: 35, dist: 64 },
  { a: -40, dist: 52 },
]

export function VoidFit({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const synthetic = phase === 'synthetic'
  const steps = synthetic ? SYNTH_STEPS : ACID_STEPS
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
  }, [phase, active, steps.length])

  // Manual advance: arrows / space step the animation before leaving the beat.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        (e.target as HTMLElement)?.isContentEditable ||
        Boolean((e.target as HTMLElement)?.closest?.('[data-playhead]'))
      if (editable) return
      if (document.documentElement.hasAttribute('data-resource')) return

      const forward = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)
      const back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)
      if (forward && step < steps.length - 1) {
        e.preventDefault()
        e.stopPropagation()
        setStep((s) => s + 1)
        return
      }
      if (back && step > 0) {
        e.preventDefault()
        e.stopPropagation()
        setStep((s) => s - 1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, step, steps.length])

  const current = steps[step]

  // Shared stage logic mapped from the sketch
  const loading = synthetic && step === 0
  const acidOn = synthetic ? step >= 2 : step >= 1
  const opened = synthetic ? step >= 3 : step >= 2
  const vOut = synthetic ? step >= 3 : step >= 2
  const cargoOut = synthetic ? step >= 3 : step >= 3
  const vFlying = vOut && (synthetic || step >= 2)
  const cargoFlying = cargoOut

  const cargoX = loading ? CX - 200 : cargoFlying ? CX + 168 : CX
  const cargoY = cargoFlying ? CY + 36 : CY

  const go = (i: number) => setStep(Math.max(0, Math.min(steps.length - 1, i)))

  const advance = () => {
    if (step < steps.length - 1) setStep((s) => s + 1)
  }

  return (
    <div
      className={styles.theater}
      role="button"
      tabIndex={active ? 0 : -1}
      onClick={(e) => {
        if ((e.target as Element).closest?.('[data-step-dot]')) return
        advance()
      }}
      aria-label={
        label ||
        (synthetic
          ? 'Synthetic analog: load, hold, acid trigger, V then cargo release. Click or press right to advance.'
          : 'Acid opens the large cage: H⁺ docks, vanadium leaves first, then cargo. Click or press right to advance.')
      }
    >
      <svg viewBox="0 0 920 500" className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="vfWash" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(126,196,212,0.12)" />
            <stop offset="100%" stopColor="rgba(126,196,212,0)" />
          </radialGradient>
          <marker
            id="vfArrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 Z" fill="rgba(243,238,228,0.7)" />
          </marker>
        </defs>

        <motion.circle
          cx={CX}
          cy={CY}
          r={170}
          fill="url(#vfWash)"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />

        {/* Intact ring */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={R}
          fill="rgba(126,196,212,0.04)"
          stroke="#7ec4d4"
          strokeWidth={3.5}
          initial={false}
          animate={{ opacity: active && !opened ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.45 }}
        />

        {/* Open C-ring after acid attack */}
        <motion.path
          d={openRingPath(CX, CY, R)}
          fill="none"
          stroke="#e07040"
          strokeWidth={3.5}
          strokeLinecap="round"
          initial={false}
          animate={{ opacity: active && opened ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.55, ease: EASE }}
        />

        <text x={CX} y={CY - R - 28} textAnchor="middle" className={styles.theaterMark}>
          Large cage · 12MR access
        </text>

        {/* Acid label during transition into H⁺ docking */}
        <motion.text
          x={CX + R + 70}
          y={CY - 40}
          className={styles.theaterCall}
          initial={false}
          animate={{ opacity: active && acidOn && !opened ? 1 : 0 }}
        >
          acid
        </motion.text>
        <motion.line
          x1={CX + R + 48}
          y1={CY - 28}
          x2={CX + R + 8}
          y2={CY - 8}
          stroke="rgba(240,200,120,0.7)"
          strokeWidth={1.5}
          markerEnd="url(#vfArrow)"
          initial={false}
          animate={{ opacity: active && acidOn && !opened ? 1 : 0 }}
        />

        {/* H⁺ on the rim */}
        {H_SITES.map((h, i) => {
          const rad = (h.a * Math.PI) / 180
          const x = CX + Math.cos(rad) * h.r
          const y = CY + Math.sin(rad) * h.r
          return (
            <motion.g
              key={`h${i}`}
              initial={false}
              animate={{ opacity: active && acidOn ? 1 : 0 }}
              transition={{ delay: reduced ? 0 : 0.05 * i, duration: reduced ? 0 : 0.35 }}
            >
              <circle
                cx={x}
                cy={y}
                r={13}
                fill="rgba(240,200,120,0.16)"
                stroke="#f0c878"
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                className={styles.theaterIon}
                style={{ fontSize: 12 }}
              >
                H
              </text>
            </motion.g>
          )
        })}

        {/* Vanadium leaves first through the opening */}
        {V_BITS.map((v, i) => {
          const rad = (v.a * Math.PI) / 180
          const parked = { x: CX + Math.cos(rad) * (R - 18), y: CY + Math.sin(rad) * (R - 18) }
          const flown = {
            x: CX + Math.cos(rad) * (R + v.dist + 36),
            y: CY + Math.sin(rad) * (R + v.dist * 0.55),
          }
          const pos = vFlying ? flown : parked
          return (
            <motion.g
              key={`v${i}`}
              initial={false}
              animate={{
                opacity: active && vFlying ? 1 : 0,
                x: pos.x - parked.x,
                y: pos.y - parked.y,
              }}
              transition={{
                duration: reduced ? 0 : 0.7,
                ease: EASE,
                delay: reduced ? 0 : 0.08 * i,
              }}
            >
              <text
                x={parked.x}
                y={parked.y + 5}
                textAnchor="middle"
                className={styles.theaterIon}
                style={{ fontSize: 16, fill: '#7ec4d4' }}
              >
                V
              </text>
              {vFlying && (
                <line
                  x1={parked.x + Math.cos(rad) * 10}
                  y1={parked.y + Math.sin(rad) * 10}
                  x2={parked.x + Math.cos(rad) * 28}
                  y2={parked.y + Math.sin(rad) * 28}
                  stroke="rgba(126,196,212,0.55)"
                  strokeWidth={1.25}
                  markerEnd="url(#vfArrow)"
                />
              )}
            </motion.g>
          )
        })}

        {/* Dashed cargo — sketch style */}
        <motion.g
          initial={false}
          animate={{
            opacity: active ? 1 : 0,
            x: cargoX - CX,
            y: cargoY - CY,
          }}
          transition={{
            duration: reduced ? 0 : cargoFlying ? 0.9 : 0.75,
            ease: EASE,
            delay: reduced || !cargoFlying ? 0 : 0.35,
          }}
        >
          <circle
            cx={CX}
            cy={CY}
            r={44}
            fill="rgba(224,112,64,0.1)"
            stroke="#e07040"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          <text x={CX} y={CY + 6} textAnchor="middle" className={styles.theaterIon}>
            Cargo
          </text>
        </motion.g>

        {/* Exit arrow once cargo moves */}
        <motion.path
          d={`M ${CX + 36} ${CY + 10} Q ${CX + 100} ${CY + 70} ${CX + 150} ${CY + 48}`}
          fill="none"
          stroke="rgba(224,112,64,0.65)"
          strokeWidth={2}
          markerEnd="url(#vfArrow)"
          initial={false}
          animate={{ opacity: active && cargoFlying ? 1 : 0 }}
          transition={{ delay: reduced ? 0 : 0.4 }}
        />

        {/* Live caption only — layout owns the slide title */}
        <motion.g
          key={`${phase}-${current.id}`}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: active ? 1 : 0, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.3 }}
        >
          <text x={CX} y={420} textAnchor="middle" className={styles.theaterCall}>
            {step + 1} · {current.label}
          </text>
          <text x={CX} y={444} textAnchor="middle" className={styles.theaterMark}>
            {current.detail}
          </text>
        </motion.g>

        {steps.map((s, i) => (
          <g
            key={s.id}
            data-step-dot=""
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              go(i)
            }}
          >
            <circle
              cx={CX - ((steps.length - 1) * 20) / 2 + i * 20}
              cy={472}
              r={10}
              fill="transparent"
            />
            <circle
              cx={CX - ((steps.length - 1) * 20) / 2 + i * 20}
              cy={472}
              r={i === step ? 5 : 3.5}
              fill={i === step ? '#e07040' : 'rgba(243,238,228,0.28)'}
              opacity={active ? 1 : 0}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
