import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import styles from './Motifs.module.css'

export type PrepMode = {
  id: string
  title: string
  body: string
  src: string
  alt: string
  objectPosition?: string
  video?: string
  poster?: string
}

function FeatureMedia({
  mode,
  active,
  label,
}: {
  mode: PrepMode
  active: boolean
  label?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !mode.video) return
    if (reduced || !active) {
      el.pause()
      return
    }
    el.currentTime = 0
    void el.play()
  }, [active, mode.video, reduced])

  if (mode.video) {
    return (
      <video
        ref={ref}
        className={styles.prepMedia}
        src={mode.video}
        poster={mode.poster ?? mode.src}
        muted
        loop
        playsInline
        preload="auto"
        aria-label={label || mode.alt}
      />
    )
  }

  return <img className={styles.prepMedia} src={mode.src} alt={label || mode.alt} />
}

export function PrepModes({
  active,
  modes,
  label,
  children,
}: {
  active: boolean
  modes: PrepMode[]
  label?: string
  children?: ReactNode
}) {
  const reduced = usePrefersReducedMotion()
  const scene = useScene()
  const [local, setLocal] = useState<number | null>(null)
  const sceneFocus = modes.findIndex((mode) => mode.id === scene.beat?.id)
  const focus = scene.hasScene ? sceneFocus : (local ?? -1)
  const current = focus >= 0 ? modes[focus] : undefined
  const overview = !current

  const go = (index: number | null) => {
    if (scene.hasScene) {
      scene.go(index === null ? 0 : index + 1)
      return
    }
    setLocal(index)
  }

  useEffect(() => {
    if (!active) {
      setLocal(null)
      return
    }
    if (reduced) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ']' && e.key !== '.' && e.key !== '[' && e.key !== ',') return
      e.preventDefault()
      e.stopPropagation()
      const pos = current ? focus + 1 : 0
      const step = e.key === ']' || e.key === '.' ? 1 : -1
      const next = (pos + step + modes.length + 1) % (modes.length + 1)
      go(next === 0 ? null : next - 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, current, focus, modes.length, reduced, scene.hasScene])

  return (
    <div
      className={styles.prep}
      data-overview={overview || undefined}
      aria-label={label || 'Spectrum of preparation modes'}
    >
      <div className={styles.prepColumn}>
        <div className={styles.prepThumbs}>
          {modes.map((mode, i) => (
            <button
              key={mode.id}
              type="button"
              className={styles.prepCell}
              data-focus={i === focus || undefined}
              onClick={() => go(i === focus ? null : i)}
              aria-pressed={i === focus}
              aria-label={mode.title}
            >
              <span className={styles.prepThumb}>
                <img
                  src={mode.src}
                  alt=""
                  style={mode.objectPosition ? { objectPosition: mode.objectPosition } : undefined}
                />
              </span>
              <span className={styles.prepLabel}>{mode.title}</span>
            </button>
          ))}
        </div>
        <div className={styles.prepCopy}>{children}</div>
      </div>
      <div className={styles.prepStage}>
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.id}
              className={styles.prepFeature}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <FeatureMedia mode={current} active={active} label={label} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
