import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { StoneMark } from '../../data/slides'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import styles from './ImpactHit.module.css'

type Phase = 'hold' | 'pull' | 'stones' | 'argument'

const HOLD_MS = 2000
const PULL_MS = 15000
const DETAIL_FADE_S = 4
const DETAIL_FADE_DELAY_S = 9
const ORB_START_MS = 10000
const STONE_STAGGER_MS = 480
const LINE_DELAY_MS = 220
const PLATE_DELAY_MS = 780
const NONE: string[] = []
const NO_MARKS: StoneMark[] = []
const HOLD_PUSH = 1.06

type Focus = { x: number; y: number; w: number; h: number }

type Pose = {
  holdScale: number
  holdX: number
  holdY: number
  endScale: number
  endX: number
  endY: number
  originX: number
  originY: number
  imgW: number
  imgH: number
}

type Pair = {
  label: string
  orbX: number
  orbY: number
  plateX: number
  plateY: number
}

function measure(frame: DOMRect, imgW: number, imgH: number, focus?: Focus): Pose {
  const region = focus ?? { x: 0.35, y: 0.35, w: 0.3, h: 0.22 }
  const focusW = Math.max(imgW * region.w, 1)
  const focusH = Math.max(imgH * region.h, 1)
  const originX = (region.x + region.w / 2) * imgW
  const originY = (region.y + region.h / 2) * imgH
  const pad = frame.width * 0.045
  const endScale = frame.height / imgH
  return {
    holdScale: Math.max(frame.width / focusW, frame.height / focusH),
    holdX: frame.width / 2 - originX,
    holdY: frame.height / 2 - originY,
    endScale,
    endX: frame.width - pad - originX - (imgW - originX) * endScale,
    endY: originY * (endScale - 1),
    originX,
    originY,
    imgW,
    imgH,
  }
}

function readPairs(
  plane: HTMLElement,
  slot: HTMLElement,
  plates: Array<HTMLElement | null>,
  marks: StoneMark[],
): Pair[] {
  const pr = plane.getBoundingClientRect()
  const sr = slot.getBoundingClientRect()
  return marks.map((m, i) => {
    const plate = plates[i]
    const pb = plate?.getBoundingClientRect()
    return {
      label: m.label,
      orbX: pr.left - sr.left + (m.x + m.w / 2) * pr.width,
      orbY: pr.top - sr.top + (m.y + m.h / 2) * pr.height,
      plateX: pb ? pb.right - sr.left : 0,
      plateY: pb ? pb.top - sr.top + pb.height / 2 : 0,
    }
  })
}

function curve(p: Pair) {
  const mx = (p.orbX + p.plateX) / 2
  return `M ${p.orbX} ${p.orbY} C ${mx} ${p.orbY}, ${mx} ${p.plateY}, ${p.plateX} ${p.plateY}`
}

export function ImpactHit({
  src,
  alt,
  active,
  facts,
  focus,
  detailSrc,
  detailFocus,
  marks,
}: {
  src: string
  alt: string
  active: boolean
  facts?: string[]
  focus?: Focus
  detailSrc?: string
  detailFocus?: Focus
  marks?: StoneMark[]
}) {
  const lines = facts ?? NONE
  const stones = marks ?? NO_MARKS
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)
  const plateRefs = useRef<Array<HTMLDivElement | null>>([])
  const seqRef = useRef(0)
  const [phase, setPhase] = useState<Phase>('hold')
  const [shown, setShown] = useState(0)
  const [orbs, setOrbs] = useState(0)
  const [drawn, setDrawn] = useState(0)
  const [plated, setPlated] = useState(0)
  const [pose, setPose] = useState<Pose | null>(null)
  const [pairs, setPairs] = useState<Pair[]>([])

  const pulling = reduced || phase !== 'hold'
  const arguing = phase === 'argument'
  const plate = detailFocus ?? focus
  const overlay = Boolean(plate && detailSrc)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const img = new Image()
    img.src = src
    const update = () => {
      const frame = root.getBoundingClientRect()
      if (!img.naturalWidth || !frame.width) return
      setPose(measure(frame, img.naturalWidth, img.naturalHeight, focus))
    }
    img.onload = update
    if (img.complete) update()
    const ro = new ResizeObserver(update)
    ro.observe(root)
    return () => ro.disconnect()
  }, [src, focus])

  useEffect(() => {
    if (!active) {
      setPhase('hold')
      setShown(0)
      setOrbs(0)
      setDrawn(0)
      setPlated(0)
      return
    }
    if (reduced) {
      setPhase('stones')
      setOrbs(stones.length)
      setDrawn(stones.length)
      setPlated(stones.length)
      return
    }
    setPhase('hold')
    setShown(0)
    setOrbs(0)
    setDrawn(0)
    setPlated(0)
    const seq = ++seqRef.current
    const later = (fn: () => void, ms: number) =>
      window.setTimeout(() => {
        if (seqRef.current === seq) fn()
      }, ms)
    const pull = later(() => setPhase('pull'), HOLD_MS)
    const orbTimers = stones.map((_, i) =>
      later(() => setOrbs(i + 1), HOLD_MS + ORB_START_MS + i * STONE_STAGGER_MS),
    )
    const lineTimers = stones.map((_, i) =>
      later(() => setDrawn(i + 1), HOLD_MS + ORB_START_MS + LINE_DELAY_MS + i * STONE_STAGGER_MS),
    )
    const plateTimers = stones.map((_, i) =>
      later(() => setPlated(i + 1), HOLD_MS + ORB_START_MS + PLATE_DELAY_MS + i * STONE_STAGGER_MS),
    )
    const stonesReady = later(() => setPhase('stones'), HOLD_MS + PULL_MS)
    return () => {
      seqRef.current += 1
      window.clearTimeout(pull)
      window.clearTimeout(stonesReady)
      orbTimers.forEach((id) => window.clearTimeout(id))
      lineTimers.forEach((id) => window.clearTimeout(id))
      plateTimers.forEach((id) => window.clearTimeout(id))
    }
  }, [active, reduced, stones])

  useEffect(() => {
    if (!active || phase === 'hold') {
      setPairs([])
      return
    }
    const write = () => {
      const plane = planeRef.current
      const slot = slotRef.current
      if (!plane || !slot) return
      setPairs(readPairs(plane, slot, plateRefs.current, stones))
    }
    write()
    if (phase !== 'pull') {
      const slot = slotRef.current
      if (!slot) return
      const ro = new ResizeObserver(write)
      ro.observe(slot)
      return () => ro.disconnect()
    }
    let id = 0
    const tick = () => {
      write()
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [active, phase, stones])

  useEffect(() => {
    if (!active || !arguing) {
      setShown(0)
      return
    }
    if (reduced) {
      setShown(lines.length)
      return
    }
    const timers = lines.map((_, i) => window.setTimeout(() => setShown(i + 1), 180 + i * 480))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [active, arguing, lines, reduced])

  useEffect(() => {
    if (!active) return
    const skip = () => {
      seqRef.current += 1
      setPhase('stones')
      setOrbs(stones.length)
      setDrawn(stones.length)
      setPlated(stones.length)
    }
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      if (document.documentElement.hasAttribute('data-resource')) return
      const next = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)
      const prev = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)
      if (next && (phase === 'hold' || phase === 'pull')) {
        e.preventDefault()
        e.stopPropagation()
        skip()
        return
      }
      if (next && phase === 'stones') {
        e.preventDefault()
        e.stopPropagation()
        setPhase('argument')
        return
      }
      if (prev && phase === 'argument') {
        e.preventDefault()
        e.stopPropagation()
        setPhase('stones')
        setShown(0)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, phase, stones.length])

  return (
    <div ref={rootRef} className={styles.root} data-phase={phase}>
      <div ref={slotRef} className={styles.slot}>
        {pose && (
          <motion.div
            ref={planeRef}
            className={styles.plane}
            style={{
              width: pose.imgW,
              height: pose.imgH,
              transformOrigin: `${pose.originX}px ${pose.originY}px`,
            }}
            initial={false}
            animate={{
              scale: pulling
                ? pose.endScale
                : phase === 'hold'
                  ? pose.holdScale * HOLD_PUSH
                  : pose.holdScale,
              x: pulling ? pose.endX : pose.holdX,
              y: pulling ? pose.endY : pose.holdY,
            }}
            transition={
              reduced
                ? { duration: 0 }
                : phase === 'pull'
                  ? { duration: PULL_MS / 1000, ease: [0.4, 0, 0.6, 1] }
                  : phase === 'hold'
                    ? { duration: HOLD_MS / 1000, ease: 'linear' }
                    : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
            }
          >
            <img src={src} alt={alt} className={styles.photo} draggable={false} />
            {overlay && plate && (
              <motion.img
                src={detailSrc}
                alt=""
                className={styles.detail}
                style={{
                  left: `${plate.x * 100}%`,
                  top: `${plate.y * 100}%`,
                  width: `${plate.w * 100}%`,
                  height: `${plate.h * 100}%`,
                }}
                initial={false}
                animate={{ opacity: phase === 'hold' ? 1 : 0 }}
                transition={{
                  duration: reduced ? 0 : phase === 'pull' ? DETAIL_FADE_S : phase === 'hold' ? 0 : 0.8,
                  delay: reduced ? 0 : phase === 'pull' ? DETAIL_FADE_DELAY_S : 0,
                  ease: 'linear',
                }}
                draggable={false}
              />
            )}
            {stones.map((m, i) => (
              <div
                key={m.label}
                className={styles.orbAnchor}
                style={{
                  left: `${(m.x + m.w / 2) * 100}%`,
                  top: `${(m.y + m.h / 2) * 100}%`,
                }}
              >
                <motion.div
                  className={styles.orb}
                  style={{
                    background: `radial-gradient(circle, ${m.tint ?? '#e0b15c'}f5 0%, ${m.tint ?? '#e0b15c'}d8 22%, ${m.tint ?? '#e0b15c'}88 48%, transparent 74%)`,
                  }}
                  initial={false}
                  animate={{
                    opacity: i < orbs ? (arguing ? 0.35 : 1) : 0,
                    scale: i < orbs ? 1 : 0.35,
                  }}
                  transition={{ duration: reduced ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            ))}
          </motion.div>
        )}

        <svg className={styles.calloutSvg} aria-hidden>
          {pairs.map((p, i) =>
            i < drawn ? (
              <motion.path
                key={p.label}
                d={curve(p)}
                className={styles.calloutLine}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: arguing ? 0.2 : 0.85 }}
                transition={{
                  pathLength: { duration: reduced ? 0 : 0.8, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: reduced ? 0 : 0.45 },
                }}
              />
            ) : null,
          )}
        </svg>

        {stones.length > 0 && (
          <div className={styles.plates} data-blur={arguing || undefined}>
            {stones.map((m, i) => (
              <div key={m.label} className={styles.plateWrap}>
                <motion.div
                  ref={(el) => {
                    plateRefs.current[i] = el
                  }}
                  className={styles.plate}
                  initial={false}
                  animate={{ opacity: i < plated ? 1 : 0 }}
                  transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  {m.src ? (
                    <img src={m.src} alt="" className={styles.plateMedia} draggable={false} />
                  ) : (
                    <div
                      className={styles.plateMedia}
                      style={{ background: m.tint ?? 'var(--color-accent)' }}
                    />
                  )}
                </motion.div>
                <motion.span
                  className={styles.plateLabel}
                  initial={false}
                  animate={{ opacity: i < plated && !arguing ? 1 : 0 }}
                  transition={{ duration: reduced ? 0 : 0.4 }}
                >
                  {m.label}
                </motion.span>
              </div>
            ))}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <ul className={styles.facts} aria-label="Cabinet facts">
          {lines.map((line, i) => (
            <motion.li
              key={line}
              className={styles.fact}
              initial={false}
              animate={{ opacity: i < shown ? 1 : 0 }}
              transition={{ duration: reduced ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              {line}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}
