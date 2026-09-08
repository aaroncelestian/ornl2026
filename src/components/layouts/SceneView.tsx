import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { SceneBeat, SceneLayer, SceneSlide, Slide } from '../../data/slides'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import { LazyMotif } from '../motifs/LazyMotif'
import { spokenAlt } from '../../lib/script'
import { DepthField } from './DepthField'
import { SceneVideo } from './SceneVideo'
import { SpecimenCallouts } from './SpecimenCallouts'
import styles from './Layouts.module.css'

function TitleLines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={`${i}-${line}`}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  )
}

function SceneSlideshow({
  slides,
  active,
  fit = 'contain',
  dwellMs = [14000, 9000],
  alt,
}: {
  slides: SceneSlide[]
  active: boolean
  fit?: 'cover' | 'contain'
  dwellMs?: [number, number]
  alt?: string
}) {
  const [index, setIndex] = useState(0)
  const reduced = usePrefersReducedMotion()
  const plate = slides[index] ?? slides[0]

  useEffect(() => {
    if (!active) setIndex(0)
  }, [active])

  useEffect(() => {
    if (!active || reduced || slides.length < 2) return
    const wait = index === 0 ? dwellMs[0] : dwellMs[1]
    const id = window.setTimeout(() => {
      setIndex((current) => (current + 1) % slides.length)
    }, wait)
    return () => window.clearTimeout(id)
  }, [active, dwellMs, index, reduced, slides.length])

  if (!plate) return null

  return (
    <div
      className={styles.sceneShow}
      onClick={() => {
        if (slides.length < 2) return
        setIndex((current) => (current + 1) % slides.length)
      }}
    >
      <AnimatePresence>
        <motion.div
          key={plate.src}
          className={styles.sceneShowPlate}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <DepthField
            src={plate.src}
            alt={alt || plate.alt}
            active={active}
            fit={fit}
            yaw={1}
            camera="hold"
            cutout={plate.cutout}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function LayerView({
  layer,
  active,
  showGuests,
  alt,
}: {
  layer: SceneLayer
  active: boolean
  showGuests?: boolean
  alt?: string
}) {
  if (layer.kind === 'motif' && layer.motif) {
    return (
      <div className={styles.sceneMotif}>
        <LazyMotif kind={layer.motif} active={active} label={alt} guests={showGuests} />
      </div>
    )
  }

  if (layer.kind === 'slideshow' && layer.slides?.length) {
    return (
      <SceneSlideshow
        slides={layer.slides}
        active={active}
        fit={layer.fit}
        dwellMs={layer.dwellMs}
        alt={alt}
      />
    )
  }

  if (layer.kind === 'video' && layer.src) {
    return (
      <SceneVideo
        src={layer.src}
        poster={layer.poster}
        alt={alt || layer.alt}
        active={active}
        fit={layer.fit}
        holdAt={layer.holdAt}
        holds={layer.holds}
        scaleBar={layer.scaleBar}
      />
    )
  }

  if (layer.src) {
    return (
      <DepthField
        src={layer.src}
        alt={alt || layer.alt || ''}
        active={active}
        fit={layer.fit ?? 'contain'}
        yaw={1}
        camera={layer.camera ?? 'hold'}
      />
    )
  }

  return null
}

function beatForSlide(slide: Slide, live?: SceneBeat) {
  return live && slide.scene?.includes(live) ? live : undefined
}

export function SceneView({ slide, active }: { slide: Slide; active: boolean }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const liveBeat = beatForSlide(slide, scene.beat)
  const heldBeat = useRef(liveBeat ?? slide.scene?.[0])
  if (liveBeat) heldBeat.current = liveBeat
  const beat = liveBeat ?? heldBeat.current
  const say = spokenAlt(slide, beat)
  const visible = new Set(beat?.layers ?? [])
  const layers = (slide.layers ?? []).filter((layer) => visible.has(layer.id))
  const hasPlate = layers.length > 0
  const duration = reduced ? 0 : 0.7
  const camera = layers[0]?.camera
  const marks = layers.flatMap((layer) => layer.marks ?? [])
  const callouts = beat?.callouts ?? []
  const videoHolds = layers.some((layer) => layer.holds?.length || layer.scaleBar)
  const copy = (
    <AnimatePresence mode="wait">
      {(beat?.kicker || beat?.title || beat?.subtitle || beat?.bullets?.length) && (
        <motion.div
          key={beat?.id ?? 'copy'}
          className={hasPlate ? styles.stageCopy : styles.voidInner}
          data-facts={beat?.bullets?.length ? '' : undefined}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
        >
          {beat?.kicker && <div className="kicker">{beat.kicker}</div>}
          {beat?.title && (
            <h2 className={hasPlate ? undefined : styles.voidTitle}>
              <TitleLines text={beat.title} />
            </h2>
          )}
          {beat?.subtitle && <p className={`${styles.body} text-muted`}>{beat.subtitle}</p>}
          {beat?.bullets?.length ? (
            <ul className={styles.sceneFacts}>
              {beat.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div
      className={styles.scene}
      data-scene=""
      data-empty={!hasPlate || undefined}
      data-camera={camera}
      data-motif={layers[0]?.motif}
      data-beat={beat?.id}
      data-callouts={callouts.length || videoHolds ? '' : undefined}
    >
      <div className={styles.sceneStage}>
        <AnimatePresence>
          {layers.map((layer) => (
            <motion.div
              key={layer.id}
              className={styles.sceneLayer}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
            >
              <LayerView layer={layer} active={active} showGuests={beat?.guests} alt={say} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {hasPlate && <div className={styles.stageScrim} aria-hidden />}
      {!hasPlate && say && <p className="sr-only">{say}</p>}
      <SpecimenCallouts
        marks={marks}
        visible={callouts}
        active={active}
        delay={beat?.calloutDelay ?? 0}
        fade={beat?.calloutFade}
      />
      {copy}
    </div>
  )
}
