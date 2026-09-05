import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { SpecimenCallout } from '../../data/slides'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import styles from './SpecimenCallouts.module.css'

type Box = { left: number; top: number; width: number; height: number }

type Pair = {
  id: string
  orbX: number
  orbY: number
  textX: number
  textY: number
}

const GAP = 16

function curve(p: Pair) {
  const mx = (p.orbX + p.textX) / 2
  return `M ${p.orbX} ${p.orbY} C ${mx} ${p.orbY}, ${mx} ${p.textY}, ${p.textX} ${p.textY}`
}

function isDump(mark: SpecimenCallout) {
  return mark.ly != null
}

function sameBox(a: Box | null, b: Box) {
  return Boolean(
    a &&
      a.left === b.left &&
      a.top === b.top &&
      a.width === b.width &&
      a.height === b.height,
  )
}

function sameTops(a: Record<string, number>, b: Record<string, number>) {
  const keys = Object.keys(b)
  return keys.length === Object.keys(a).length && keys.every((key) => a[key] === b[key])
}

function attach(lb: DOMRect, rr: DOMRect, side: 'left' | 'right') {
  return {
    textX: (side === 'left' ? lb.right : lb.left) - rr.left,
    textY: lb.top - rr.top + lb.height / 2,
  }
}

function stackTops(
  items: Array<{ id: string; preferred: number; height: number }>,
): Record<string, number> {
  const tops: Record<string, number> = {}
  const ordered = [...items].sort((a, b) => a.preferred - b.preferred)
  let bottom = -Infinity
  for (const item of ordered) {
    const top = Math.max(item.preferred - item.height / 2, bottom + GAP)
    tops[item.id] = top
    bottom = top + item.height
  }
  return tops
}

export function SpecimenCallouts({
  marks,
  visible,
  active,
  delay: hold = 0,
  fade = 0.4,
}: {
  marks: SpecimenCallout[]
  visible: string[]
  active: boolean
  delay?: number
  fade?: number
}) {
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<Array<HTMLDivElement | null>>([])
  const marksRef = useRef(marks)
  marksRef.current = marks
  const [plate, setPlate] = useState<Box | null>(null)
  const [tops, setTops] = useState<Record<string, number>>({})
  const [pairs, setPairs] = useState<Pair[]>([])
  const shown = marks.filter((mark) => visible.includes(mark.id))
  const shownKey = shown.map((mark) => mark.id).join('|')

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !active || !shownKey) {
      setPlate(null)
      return
    }

    const readPlate = () => {
      const img = root.closest('[data-scene]')?.querySelector<HTMLElement>('[data-plate]')
      if (!img) return
      const rr = root.getBoundingClientRect()
      const pr = img.getBoundingClientRect()
      const next: Box = {
        left: pr.left - rr.left,
        top: pr.top - rr.top,
        width: pr.width,
        height: pr.height,
      }
      setPlate((prev) => (sameBox(prev, next) ? prev : next))
    }

    readPlate()
    const img = root.closest('[data-scene]')?.querySelector('[data-plate]')
    const ro = new ResizeObserver(readPlate)
    ro.observe(root)
    if (img) ro.observe(img)
    window.addEventListener('resize', readPlate)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', readPlate)
    }
  }, [active, shownKey])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !active || !shownKey || !plate) {
      setTops({})
      return
    }

    const current = shownKey
      .split('|')
      .map((id) => marksRef.current.find((m) => m.id === id))
      .filter((mark): mark is SpecimenCallout => Boolean(mark))

    const bySide: Record<'left' | 'right', Array<{ id: string; preferred: number; height: number }>> = {
      left: [],
      right: [],
    }
    const dumpTops: Record<string, number> = {}
    current.forEach((mark, i) => {
      const height = labelRefs.current[i]?.getBoundingClientRect().height ?? 64
      const preferred = plate.top + (mark.ly ?? mark.y) * plate.height
      if (isDump(mark)) {
        dumpTops[mark.id] = preferred - height / 2
        return
      }
      bySide[mark.side ?? 'right'].push({ id: mark.id, preferred, height })
    })
    const next = { ...stackTops(bySide.left), ...stackTops(bySide.right), ...dumpTops }
    setTops((prev) => (sameTops(prev, next) ? prev : next))
  }, [active, shownKey, plate])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !active || !shownKey || !plate) {
      setPairs([])
      return
    }

    const current = shownKey
      .split('|')
      .map((id) => marksRef.current.find((m) => m.id === id))
      .filter((mark): mark is SpecimenCallout => Boolean(mark))
    const rr = root.getBoundingClientRect()
    setPairs(
      current.map((mark, i) => {
        const lb = labelRefs.current[i]?.getBoundingClientRect()
        const edge = lb ? attach(lb, rr, mark.side ?? 'right') : { textX: 0, textY: 0 }
        return {
          id: mark.id,
          orbX: plate.left + mark.x * plate.width,
          orbY: plate.top + mark.y * plate.height,
          textX: edge.textX,
          textY: edge.textY,
        }
      }),
    )
  }, [active, shownKey, plate, tops])

  if (!shown.length) return null

  let dump = 0

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-clutter={shown.some(isDump) || undefined}
      aria-hidden={!active}
    >
      <svg className={styles.svg} aria-hidden>
        {pairs.map((p) => {
          const mark = shown.find((item) => item.id === p.id)
          const dumped = mark ? isDump(mark) : false
          const order = mark ? shown.filter(isDump).findIndex((item) => item.id === p.id) : 0
          const calm = shown.findIndex((item) => item.id === p.id)
          const slow = !reduced && !dumped && fade > 0.5
          const wait =
            reduced ? 0 : hold + (dumped ? 0.06 + Math.max(0, order) * 0.11 : slow ? Math.max(0, calm) * 0.35 : 0)
          const fadeIn = reduced ? 0 : dumped ? 0.35 : fade
          const ease = [0.22, 1, 0.36, 1] as const
          return (
            <g key={p.id}>
              <motion.circle
                cx={p.orbX}
                cy={p.orbY}
                r={3.5}
                className={styles.tick}
                initial={hold ? { opacity: 0 } : false}
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: fadeIn, delay: wait, ease }}
              />
              <motion.path
                d={curve(p)}
                className={styles.line}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: active ? 0.9 : 0 }}
                transition={{
                  pathLength: { duration: reduced ? 0 : Math.max(0.7, fadeIn), delay: wait, ease },
                  opacity: { duration: fadeIn, delay: wait, ease },
                }}
              />
            </g>
          )
        })}
      </svg>

      {shown.map((mark, i) => {
        const dumped = isDump(mark)
        const slow = !reduced && !dumped && fade > 0.5
        const wait = reduced ? 0 : hold + (dumped ? 0.06 + dump++ * 0.11 : slow ? i * 0.35 : 0.08)
        const fadeIn = reduced ? 0 : dumped ? 0.4 : fade
        return (
          <motion.div
            key={mark.id}
            ref={(el) => {
              labelRefs.current[i] = el
            }}
            className={styles.label}
            data-side={mark.side ?? 'right'}
            data-dump={dumped || undefined}
            style={{
              top:
                tops[mark.id] ??
                (plate ? plate.top + (mark.ly ?? mark.y) * plate.height : `${(mark.ly ?? mark.y) * 100}%`),
              ['--tilt' as string]: `${mark.tilt ?? 0}deg`,
              ['--inset' as string]: `${mark.inset ?? 0}rem`,
            }}
            initial={dumped || hold ? { opacity: 0 } : false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ duration: fadeIn, delay: wait, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.title}>{mark.title}</div>
            {mark.formula && <div className={styles.formula}>{mark.formula}</div>}
            {mark.body && <div className={styles.body}>{mark.body}</div>}
            {mark.es && <div className={styles.es}>{mark.es}</div>}
          </motion.div>
        )
      })}
    </div>
  )
}
