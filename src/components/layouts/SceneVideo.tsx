import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { ScaleBar, VideoHold, VideoMark, VideoMarkKind } from '../../data/slides'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import styles from './SceneVideo.module.css'

type Box = { x: number; y: number; w: number; h: number }

const SLACK = 0.05
const NEAR = 0.12
const VIDEO_W = 1482
const VIDEO_H = 834
const GAP = 14

function contain(cw: number, ch: number, vw: number, vh: number): Box {
  const s = Math.min(cw / vw, ch / vh)
  const w = vw * s
  const h = vh * s
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
}

function stackTops(items: Array<{ id: string; preferred: number; height: number }>) {
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

const KIND_META: Record<VideoMarkKind, { label: string; title: string; color: string }> = {
  mineral: { label: 'Strong layering', title: 'Strong layering.', color: 'var(--video-mineral)' },
  biomass: { label: 'Weak / no layering', title: 'Weak / no layering.', color: 'var(--video-biomass)' },
  onion: { label: 'Onion', title: 'Onion structure.', color: 'var(--color-accent-600)' },
}

const GENERIC_TITLES = new Set<string>([
  ...Object.values(KIND_META).map((k) => k.title),
  'Mineral.',
  'Biomass.',
])

function markColor(kind: VideoMark['kind']) {
  return KIND_META[kind].color
}

function patchForKind(kind: VideoMarkKind, current: VideoMark): Partial<VideoMark> {
  return {
    kind,
    title: GENERIC_TITLES.has(current.title) ? KIND_META[kind].title : current.title,
    rx: kind === 'onion' ? (current.rx ?? 0.12) : undefined,
    ry: kind === 'onion' ? (current.ry ?? 0.135) : undefined,
    rings: kind === 'onion' ? (current.rings ?? 4) : undefined,
  }
}

function fmt(t: number) {
  if (!Number.isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function cloneHolds(holds: VideoHold[]): VideoHold[] {
  return holds.map((h) => ({
    at: h.at,
    marks: h.marks?.map((m) => ({ ...m })),
  }))
}

function sortHolds(holds: VideoHold[]) {
  return [...holds].sort((a, b) => a.at - b.at)
}

function holdsJson(holds: VideoHold[]) {
  return JSON.stringify(holds, null, 2)
}

function SceneVideoOverlay({
  marks,
  plate,
  reduced,
  selectedId,
  onSelect,
}: {
  marks: VideoMark[]
  plate: Box
  reduced: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  const labelRefs = useRef<Array<HTMLDivElement | null>>([])
  const [layout, setLayout] = useState<Record<string, { top: number; width: number }>>({})
  const shownKey = marks.map((m) => `${m.id}:${m.title}:${m.body ?? ''}:${m.side ?? ''}`).join('|')

  useLayoutEffect(() => {
    if (!shownKey || !plate.w) {
      setLayout({})
      return
    }
    const bySide: Record<'left' | 'right', Array<{ id: string; preferred: number; height: number }>> =
      { left: [], right: [] }
    const widths: Record<string, number> = {}
    marks.forEach((mark, i) => {
      const side = mark.side ?? 'right'
      const box = labelRefs.current[i]?.getBoundingClientRect()
      const height = box?.height ?? 52
      widths[mark.id] = box?.width ?? 120
      bySide[side].push({
        id: mark.id,
        preferred: mark.y * plate.h,
        height,
      })
    })
    const tops = { ...stackTops(bySide.left), ...stackTops(bySide.right) }
    const next: Record<string, { top: number; width: number }> = {}
    for (const mark of marks) {
      next[mark.id] = { top: tops[mark.id] ?? mark.y * plate.h, width: widths[mark.id] ?? 120 }
    }
    setLayout(next)
  }, [marks, plate.h, plate.w, shownKey])

  return (
    <>
      <svg className={styles.svg} viewBox={`0 0 ${plate.w} ${plate.h}`} aria-hidden>
        {marks.map((mark) => {
          const cx = mark.x * plate.w
          const cy = mark.y * plate.h
          const side = mark.side ?? 'right'
          const loc = layout[mark.id]
          const labelY = (loc?.top ?? cy) + 12
          const labelW = loc?.width ?? 120
          const edge = 10
          const gap = 8
          const textX =
            side === 'left' ? edge + labelW + gap : plate.w - edge - labelW - gap
          const midX = (cx + textX) / 2
          const color = markColor(mark.kind)
          const rings = mark.kind === 'onion' ? (mark.rings ?? 3) : 0
          const rx = (mark.rx ?? 0.05) * plate.w
          const ry = (mark.ry ?? 0.055) * plate.h
          const selected = selectedId === mark.id
          return (
            <g key={mark.id}>
              {Array.from({ length: rings }, (_, i) => {
                const t = (i + 1) / rings
                return (
                  <motion.ellipse
                    key={`${mark.id}-r${i}`}
                    cx={cx}
                    cy={cy}
                    rx={rx * t}
                    ry={ry * t}
                    className={styles.onion}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.85 }}
                    transition={{
                      pathLength: { duration: reduced ? 0 : 0.85, delay: reduced ? 0 : i * 0.12 },
                      opacity: { duration: reduced ? 0 : 0.4 },
                    }}
                  />
                )
              })}
              <motion.circle
                key={`${mark.id}-orb-${mark.kind}`}
                cx={cx}
                cy={cy}
                r={mark.kind === 'onion' ? 4 : selected ? 7 : 5.5}
                className={styles.orb}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1, fill: color }}
                transition={{ duration: reduced ? 0 : 0.4 }}
                style={{
                  color,
                  ...(selected ? { stroke: '#fff', strokeWidth: 2 } : undefined),
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.(mark.id)
                }}
              />
              <motion.path
                key={`${mark.id}-line-${mark.kind}`}
                d={`M ${cx} ${cy} C ${midX} ${cy}, ${midX} ${labelY}, ${textX} ${labelY}`}
                className={styles.line}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.9, stroke: color }}
                transition={{
                  pathLength: { duration: reduced ? 0 : 0.7, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: reduced ? 0 : 0.3 },
                }}
              />
            </g>
          )
        })}
      </svg>
      {marks.map((mark, i) => (
        <motion.div
          key={mark.id}
          ref={(el) => {
            labelRefs.current[i] = el
          }}
          className={styles.label}
          data-side={mark.side ?? 'right'}
          data-kind={mark.kind}
          data-selected={selectedId === mark.id || undefined}
          style={{ top: layout[mark.id]?.top ?? mark.y * plate.h }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : 0.08 }}
          onClick={(e) => {
            e.stopPropagation()
            onSelect?.(mark.id)
          }}
        >
          <div className={styles.title}>{mark.title}</div>
          {mark.body && <div className={styles.body}>{mark.body}</div>}
        </motion.div>
      ))}
    </>
  )
}

export function SceneVideo({
  src,
  poster,
  alt,
  active,
  fit = 'contain',
  holdAt,
  holds,
  scaleBar,
}: {
  src: string
  poster?: string
  alt?: string
  active: boolean
  fit?: 'cover' | 'contain'
  holdAt?: number
  holds?: VideoHold[]
  scaleBar?: ScaleBar
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduced = usePrefersReducedMotion()
  const seed = useMemo(
    () => (holds?.length ? cloneHolds(holds) : holdAt != null ? [{ at: holdAt }] : []),
    [holdAt, holds],
  )
  const [draft, setDraft] = useState<VideoHold[]>(seed)
  const stops = draft
  const last = Math.max(0, stops.length - 1)
  const [step, setStep] = useState(0)
  const [parked, setParked] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [annotate, setAnnotate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 })
  const [videoSize, setVideoSize] = useState({ w: VIDEO_W, h: VIDEO_H })
  const resumeGateRef = useRef(0)
  const live = useRef({ step: 0, parked: false, annotate: false, last: 0 })
  live.current = { step, parked, annotate, last }

  useEffect(() => {
    setDraft(seed)
  }, [seed])

  const hold = parked ? stops[step] : undefined
  const marks = hold?.marks ?? []
  const selected = marks.find((m) => m.id === selectedId) ?? null

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const r = stage.getBoundingClientRect()
      setBox(contain(r.width, r.height, videoSize.w, videoSize.h))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [videoSize.h, videoSize.w])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (reduced || !active) {
      el.pause()
      setPlaying(false)
      if (reduced && active && stops.length) {
        const end = stops[last]
        el.currentTime = end.at
        setT(end.at)
        setStep(last)
        setParked(true)
      }
      if (!active) {
        el.currentTime = 0
        setT(0)
        setStep(0)
        setParked(false)
        setAnnotate(false)
        setSelectedId(null)
      }
      return
    }
    el.currentTime = 0
    setT(0)
    setStep(0)
    setParked(false)
    setSelectedId(null)
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [active, last, reduced, src, stops.length])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const onTime = () => {
      setT(el.currentTime)
      if (live.current.parked || !stops.length) return
      if (el.currentTime < resumeGateRef.current) return
      const target = stops[live.current.step]
      if (!target) return // tail after last hold — play through to the end
      if (el.currentTime + SLACK < target.at) return
      el.pause()
      el.currentTime = target.at
      setT(target.at)
      setStep(live.current.step)
      setParked(true)
      setPlaying(false)
      resumeGateRef.current = 0
    }
    const onMeta = () => setDur(el.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setParked(false)
      live.current.parked = false
      live.current.step = stops.length
      setStep(stops.length)
      setT(el.duration || 0)
      resumeGateRef.current = 0
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnded)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    if (el.duration) setDur(el.duration)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [src, stops])

  /** Leave a hold and play forward. Last hold plays through to the end of the clip. */
  const resumeFromHold = (i: number) => {
    const el = videoRef.current
    if (!el || i < 0) return false
    const gate = stops[i].at + 0.2
    resumeGateRef.current = gate
    live.current.parked = false
    const nextStep = i >= last ? stops.length : i + 1
    live.current.step = nextStep
    setParked(false)
    setStep(nextStep)
    setSelectedId(null)
    setPlaying(true)
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    return true
  }

  const atClipEnd = (el: HTMLVideoElement | null) => {
    if (!el) return false
    if (el.ended) return true
    const d = el.duration
    if (!Number.isFinite(d) || d <= 0) return false
    return el.currentTime >= d - 0.2
  }

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    if (!el.paused) {
      el.pause()
      setPlaying(false)
      return
    }
    const { step: i, parked: atHold } = live.current
    if (atHold) {
      resumeFromHold(i)
      return
    }
    if (atClipEnd(el)) {
      el.currentTime = 0
      setT(0)
      setStep(0)
      live.current.step = 0
    }
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  useEffect(() => {
    if (!active) return
    const el = videoRef.current

    const goNext = () => {
      const { step: i, parked: atHold } = live.current
      if (atClipEnd(el)) return false

      if (!atHold) {
        const target = stops[i]
        if (!target) {
          // Playing the tail after the last hold — skip to the end, then next advance leaves.
          if (!el) return false
          el.pause()
          if (Number.isFinite(el.duration)) {
            el.currentTime = el.duration
            setT(el.duration)
          }
          setPlaying(false)
          live.current.step = stops.length
          setStep(stops.length)
          return true
        }
        if (!el) return false
        resumeGateRef.current = 0
        el.pause()
        el.currentTime = target.at
        setT(target.at)
        setParked(true)
        setPlaying(false)
        return true
      }
      return resumeFromHold(i)
    }

    const goPrev = () => {
      const { step: i, parked: atHold } = live.current
      if (atClipEnd(el) && !atHold) {
        // From end of clip, go back to last hold
        if (!el || !stops.length) return false
        const back = last
        el.pause()
        el.currentTime = stops[back].at
        setT(stops[back].at)
        setStep(back)
        setParked(true)
        setPlaying(false)
        setSelectedId(null)
        return true
      }
      const back = atHold ? i - 1 : i - 1
      if (back < 0) return false
      if (!el) return false
      resumeGateRef.current = 0
      el.pause()
      el.currentTime = stops[back].at
      setT(stops[back].at)
      setStep(back)
      setParked(true)
      setPlaying(false)
      setSelectedId(null)
      return true
    }

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return
      if (document.documentElement.hasAttribute('data-resource')) return

      if (e.key === 'a' || e.key === 'A') {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        e.preventDefault()
        e.stopPropagation()
        setAnnotate((v) => !v)
        return
      }

      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        e.stopPropagation()
        togglePlay()
        return
      }

      if (
        live.current.annotate &&
        (e.key === 'Backspace' || e.key === 'Delete') &&
        live.current.parked
      ) {
        e.preventDefault()
        e.stopPropagation()
        removeHold()
        return
      }

      if (live.current.annotate) return

      const next = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)
      const prev = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)
      if (next && goNext()) {
        e.preventDefault()
        e.stopPropagation()
      } else if (prev && goPrev()) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, last, stops])

  const scrubTo = (next: number) => {
    const el = videoRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(dur || el.duration || next, next))
    el.pause()
    el.currentTime = clamped
    setT(clamped)
    setPlaying(false)

    const near = stops.findIndex((h) => Math.abs(h.at - clamped) <= NEAR)
    if (near >= 0) {
      el.currentTime = stops[near].at
      setT(stops[near].at)
      setStep(near)
      setParked(true)
      return
    }
    setParked(false)
    const upcoming = stops.findIndex((h) => h.at > clamped + SLACK)
    setStep(upcoming >= 0 ? upcoming : Math.max(0, stops.length - 1))
    setSelectedId(null)
  }

  const addHoldHere = () => {
    const at = Math.round(t * 100) / 100
    setDraft((prev) => {
      const existing = prev.findIndex((h) => Math.abs(h.at - at) <= NEAR)
      if (existing >= 0) return prev
      return sortHolds([...prev, { at, marks: [] }])
    })
    const el = videoRef.current
    if (el) {
      el.pause()
      el.currentTime = at
    }
    setPlaying(false)
    setParked(true)
    setSelectedId(null)
    // step will resolve on next render via effect below
  }

  useEffect(() => {
    if (!parked) return
    const i = stops.findIndex((h) => Math.abs(h.at - t) <= NEAR)
    if (i >= 0 && i !== step) setStep(i)
  }, [parked, stops, t, step])

  const removeHold = (index?: number) => {
    const i = index ?? (parked ? step : stops.findIndex((h) => Math.abs(h.at - t) <= NEAR))
    if (i < 0 || !stops[i]) return
    const remaining = stops.filter((_, j) => j !== i)
    setDraft(remaining)
    setSelectedId(null)
    const el = videoRef.current
    if (!remaining.length) {
      setParked(false)
      setStep(0)
      return
    }
    const next = Math.min(i, remaining.length - 1)
    const hold = remaining[next]
    if (el) {
      el.pause()
      el.currentTime = hold.at
      setT(hold.at)
      setPlaying(false)
    }
    setStep(next)
    setParked(true)
  }

  const placeMark = (clientX: number, clientY: number) => {
    const stage = stageRef.current
    if (!stage || !box.w || !box.h) return
    const stageRect = stage.getBoundingClientRect()
    const x = Math.min(0.98, Math.max(0.02, (clientX - stageRect.left - box.x) / box.w))
    const y = Math.min(0.98, Math.max(0.02, (clientY - stageRect.top - box.y) / box.h))
    const at = Math.round(t * 100) / 100

    setDraft((prev) => {
      let next = cloneHolds(prev)
      let hi = next.findIndex((h) => Math.abs(h.at - at) <= NEAR)
      if (hi < 0) {
        next = sortHolds([...next, { at, marks: [] }])
        hi = next.findIndex((h) => Math.abs(h.at - at) <= NEAR)
      }
      const id = `mark-${Date.now().toString(36)}`
      const mark: VideoMark = {
        id,
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        kind: 'mineral',
        side: x < 0.5 ? 'left' : 'right',
        title: KIND_META.mineral.title,
        body: '',
      }
      const marks = [...(next[hi].marks ?? []), mark]
      next[hi] = { ...next[hi], marks }
      setSelectedId(id)
      setStep(hi)
      setParked(true)
      const el = videoRef.current
      if (el) {
        el.pause()
        el.currentTime = next[hi].at
        setT(next[hi].at)
        setPlaying(false)
      }
      return next
    })
  }

  const patchMark = (id: string, patch: Partial<VideoMark>) => {
    setDraft((prev) =>
      prev.map((h, i) => {
        if (i !== step) return h
        return {
          ...h,
          marks: (h.marks ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }
      }),
    )
  }

  const deleteMark = (id: string) => {
    setDraft((prev) =>
      prev.map((h, i) => {
        if (i !== step) return h
        return { ...h, marks: (h.marks ?? []).filter((m) => m.id !== id) }
      }),
    )
    setSelectedId(null)
  }

  const copyJson = async () => {
    const text = holdsJson(draft)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy holds JSON', text)
    }
  }

  const framed = Boolean(stops.length || scaleBar || annotate)
  const video = (
    <video
      ref={videoRef}
      className={framed ? styles.video : styles.bleed}
      data-fit={framed ? undefined : fit}
      src={src}
      poster={poster}
      muted
      loop={!stops.length && !annotate}
      playsInline
      preload="auto"
      aria-label={alt}
      onLoadedMetadata={(e) => {
        const v = e.currentTarget
        if (v.videoWidth && v.videoHeight) setVideoSize({ w: v.videoWidth, h: v.videoHeight })
        setDur(v.duration || 0)
      }}
    />
  )

  if (!framed) return video

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-annotate={annotate || undefined}
      onClick={(e) => {
        if (!active) return
        if ((e.target as HTMLElement).closest(`.${styles.chrome}`)) return
        if ((e.target as HTMLElement).closest(`.${styles.panel}`)) return

        if (annotate) {
          placeMark(e.clientX, e.clientY)
          return
        }

        if (!stops.length) return
        const { step: i, parked: atHold } = live.current
        const el = videoRef.current
        if (!atHold) {
          const target = stops[i]
          if (!target || !el) return
          resumeGateRef.current = 0
          el.pause()
          el.currentTime = target.at
          setT(target.at)
          setParked(true)
          setPlaying(false)
          return
        }
        resumeFromHold(i)
      }}
    >
      <div
        className={styles.plate}
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        data-video-plate=""
      >
        {video}
        {scaleBar && box.w > 0 && (
          <div className={styles.scale} aria-hidden>
            <span className={styles.scaleBar} style={{ width: `${scaleBar.width * 100}%` }} />
            <span className={styles.scaleLabel}>{scaleBar.mm} mm</span>
          </div>
        )}
        <div className={styles.legend} aria-hidden>
          <span data-kind="mineral">Strong layering</span>
          <span data-kind="biomass">Weak / no layering</span>
        </div>
        <AnimatePresence>
          {parked && marks.length > 0 && box.w > 0 && (
            <motion.div
              key={hold?.at ?? 'hold'}
              className={styles.readout}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.35 }}
            >
              <SceneVideoOverlay
                marks={marks}
                plate={{ ...box, x: 0, y: 0 }}
                reduced={reduced}
                selectedId={annotate ? selectedId : null}
                onSelect={annotate ? setSelectedId : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {active &&
        createPortal(
          <div
            className={styles.chrome}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.transportBtn}
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              title="Play / pause (K)"
            >
              {playing ? 'Pause' : 'Play'}
            </button>

            <div className={styles.scrubWrap}>
              <input
                className={styles.scrub}
                type="range"
                min={0}
                max={Math.max(dur, 0.01)}
                step={0.01}
                value={Math.min(t, dur || t)}
                aria-label="Scrub timeline"
                onChange={(e) => scrubTo(Number(e.target.value))}
              />
              <div className={styles.holdTicks} aria-hidden>
                {stops.map((h, i) => (
                  <button
                    key={`${h.at}-${i}`}
                    type="button"
                    className={styles.holdTick}
                    data-active={(parked && step === i) || undefined}
                    style={{ left: `${dur ? (h.at / dur) * 100 : 0}%` }}
                    title={
                      annotate
                        ? `Hold ${i + 1} · ${fmt(h.at)} — click to jump, Shift+click to delete`
                        : `Hold ${i + 1} · ${fmt(h.at)}`
                    }
                    onClick={(e) => {
                      if (annotate && e.shiftKey) {
                        e.preventDefault()
                        removeHold(i)
                        return
                      }
                      scrubTo(h.at)
                    }}
                  />
                ))}
              </div>
            </div>

            <span className={styles.time}>
              {fmt(t)} / {fmt(dur)}
            </span>

            <button
              type="button"
              className={styles.transportBtn}
              data-on={annotate || undefined}
              onClick={() => setAnnotate((v) => !v)}
              title="Annotate callouts (A)"
            >
              Annotate
            </button>

            {annotate && (
              <>
                <button
                  type="button"
                  className={styles.transportBtn}
                  onClick={addHoldHere}
                  title="Add a pause at the playhead"
                >
                  HOLD +
                </button>
                <button
                  type="button"
                  className={styles.transportBtn}
                  disabled={!parked && stops.every((h) => Math.abs(h.at - t) > NEAR)}
                  onClick={() => removeHold()}
                  title="Delete current pause (Delete / Backspace, or Shift+click a tick)"
                >
                  HOLD -
                </button>
                <button
                  type="button"
                  className={styles.transportBtn}
                  onClick={() => void copyJson()}
                >
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
              </>
            )}
          </div>,
          document.getElementById('talk-transport') ?? document.body,
        )}

      {active &&
        annotate &&
        createPortal(
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <p className={styles.panelHint}>
              Click the CT frame to place a circle. Scrub, then <strong>HOLD +</strong> for a
              pause. Delete a pause with <strong>HOLD -</strong>, <strong>Delete</strong>, or{' '}
              <strong>Shift+click</strong> an orange tick.               Change a mark's type in the form — the
              color updates on the frame. Then <strong>Copy JSON</strong> into the{' '}
              <code>holds</code> array in <code>slides.ts</code> (stones → ct layer) to keep it.
            </p>
            {selected ? (
              <div className={styles.form}>
                <label>
                  Title
                  <input
                    value={selected.title}
                    onChange={(e) => patchMark(selected.id, { title: e.target.value })}
                  />
                </label>
                <label>
                  Body
                  <input
                    value={selected.body ?? ''}
                    onChange={(e) => patchMark(selected.id, { body: e.target.value })}
                  />
                </label>
                <div className={styles.kindField}>
                  <span>Kind</span>
                  <div className={styles.kindBtns} role="radiogroup" aria-label="Mark type">
                    {(Object.keys(KIND_META) as VideoMarkKind[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        role="radio"
                        className={styles.kindBtn}
                        data-kind={kind}
                        aria-checked={selected.kind === kind}
                        data-on={selected.kind === kind || undefined}
                        onClick={() => patchMark(selected.id, patchForKind(kind, selected))}
                      >
                        <span className={styles.kindSwatch} aria-hidden />
                        {KIND_META[kind].label}
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  Side
                  <select
                    value={selected.side ?? 'right'}
                    onChange={(e) =>
                      patchMark(selected.id, {
                        side: e.target.value as 'left' | 'right',
                      })
                    }
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                {selected.kind === 'onion' && (
                  <div className={styles.onionSize}>
                    <p className={styles.onionSizeHead}>Onion size</p>
                    <label>
                      Width (X) · {(selected.rx ?? 0.12).toFixed(3)}
                      <input
                        type="range"
                        min={0.04}
                        max={0.35}
                        step={0.005}
                        value={selected.rx ?? 0.12}
                        onChange={(e) =>
                          patchMark(selected.id, {
                            kind: 'onion',
                            rx: Number(e.target.value),
                            ry: selected.ry ?? 0.135,
                            rings: selected.rings ?? 4,
                          })
                        }
                      />
                    </label>
                    <label>
                      Height (Y) · {(selected.ry ?? 0.135).toFixed(3)}
                      <input
                        type="range"
                        min={0.04}
                        max={0.35}
                        step={0.005}
                        value={selected.ry ?? 0.135}
                        onChange={(e) =>
                          patchMark(selected.id, {
                            kind: 'onion',
                            rx: selected.rx ?? 0.12,
                            ry: Number(e.target.value),
                            rings: selected.rings ?? 4,
                          })
                        }
                      />
                    </label>
                    <label>
                      Rings · {selected.rings ?? 4}
                      <input
                        type="range"
                        min={2}
                        max={8}
                        step={1}
                        value={selected.rings ?? 4}
                        onChange={(e) =>
                          patchMark(selected.id, {
                            kind: 'onion',
                            rx: selected.rx ?? 0.12,
                            ry: selected.ry ?? 0.135,
                            rings: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <div className={styles.formRow}>
                      <label>
                        X
                        <input
                          type="number"
                          min={0.04}
                          max={0.35}
                          step={0.01}
                          value={selected.rx ?? 0.12}
                          onChange={(e) =>
                            patchMark(selected.id, {
                              kind: 'onion',
                              rx: Number(e.target.value),
                              ry: selected.ry ?? 0.135,
                              rings: selected.rings ?? 4,
                            })
                          }
                        />
                      </label>
                      <label>
                        Y
                        <input
                          type="number"
                          min={0.04}
                          max={0.35}
                          step={0.01}
                          value={selected.ry ?? 0.135}
                          onChange={(e) =>
                            patchMark(selected.id, {
                              kind: 'onion',
                              rx: selected.rx ?? 0.12,
                              ry: Number(e.target.value),
                              rings: selected.rings ?? 4,
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className={styles.transportBtn}
                  onClick={() => deleteMark(selected.id)}
                >
                  Delete mark
                </button>
              </div>
            ) : (
              <p className={styles.panelEmpty}>No mark selected.</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
