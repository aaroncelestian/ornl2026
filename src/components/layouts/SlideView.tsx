import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Slide, MotifKind } from '../../data/slides'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { DepthField } from './DepthField'
import { ImpactHit } from './ImpactHit'
import { LazyMotif } from '../motifs/LazyMotif'
import { spokenAlt } from '../../lib/script'
import { SceneView } from './SceneView'
import styles from './Layouts.module.css'

const rise = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
}

function Rise({
  active,
  children,
  delay = 0,
  className,
  snap = false,
}: {
  active: boolean
  children: React.ReactNode
  delay?: number
  className?: string
  snap?: boolean
}) {
  const reduced = usePrefersReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={false}
      animate={active ? 'show' : 'hidden'}
      variants={rise}
      transition={{
        duration: snap ? 0 : 0.7,
        ease: [0.16, 1, 0.3, 1],
        delay: snap || !active ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  )
}

function Kicker({ text }: { text?: string }) {
  if (!text) return null
  return <div className="kicker">{text}</div>
}

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

function BleedSlide({
  slide,
  active,
  copyActive,
  alt,
  yaw,
  ownImage,
}: {
  slide: Slide
  active: boolean
  copyActive: boolean
  alt: string
  yaw: 1 | -1
  ownImage: boolean
}) {
  const reduced = usePrefersReducedMotion()
  const [promoOn, setPromoOn] = useState(false)
  const promo = slide.promo

  useEffect(() => {
    if (!active || !promo) {
      setPromoOn(false)
      return
    }
    if (!copyActive) return
    const id = window.setTimeout(() => setPromoOn(true), (slide.promoAfter ?? 8) * 1000)
    return () => window.clearTimeout(id)
  }, [active, copyActive, promo, slide.promoAfter])

  const showPromo = Boolean(promo && promoOn)
  const copyVisible = copyActive && !showPromo
  const promoVisible = Boolean(promo && showPromo && copyActive)
  const duration = reduced ? 0 : 0.7
  const fade = { duration, ease: [0.16, 1, 0.3, 1] as const }

  return (
    <div className={styles.bleedWrap}>
      {ownImage && slide.image && (
        <DepthField
          src={slide.image.src}
          alt={alt}
          active={active}
          fit={slide.image.fit ?? 'cover'}
          yaw={yaw}
          camera={slide.camera}
        />
      )}
      <div className={styles.bleedScrim} aria-hidden />
      <motion.div
        initial={false}
        animate={{ opacity: copyVisible ? 1 : 0 }}
        transition={fade}
        aria-hidden={!copyVisible}
      >
        {slide.kicker && (
          <div className={`${styles.bleedKicker} kicker`}>
            <TitleLines text={slide.kicker} />
          </div>
        )}
        {slide.title && (
          <div className={styles.bleedCopy}>
            <h2>
              <TitleLines text={slide.title} />
            </h2>
          </div>
        )}
      </motion.div>
      {promo ? (
        <motion.div
          className={styles.bleedPromo}
          initial={false}
          animate={{ opacity: promoVisible ? 1 : 0 }}
          transition={fade}
          aria-hidden={!promoVisible}
        >
          <img src={promo.src} alt={promoVisible ? promo.alt : ''} className={styles.bleedPromoLogo} />
          {promo.kicker && <div className={`kicker ${styles.bleedPromoKicker}`}>{promo.kicker}</div>}
          <div className={styles.bleedPromoCopy}>
            {promo.title && (
              <h2>
                <TitleLines text={promo.title} />
              </h2>
            )}
            {promo.subtitle && <p className={styles.bleedPromoMeta}>{promo.subtitle}</p>}
            {promo.credit && <p className={styles.bleedPromoCredit}>{promo.credit}</p>}
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}

function Motif({
  kind,
  active,
  label,
}: {
  kind: MotifKind
  active: boolean
  label?: string
}) {
  return <LazyMotif kind={kind} active={active} label={label} />
}

export function SlideView({
  slide,
  active,
  plated = false,
  copyActive = true,
}: {
  slide: Slide
  active: boolean
  plated?: boolean
  copyActive?: boolean
}) {
  const yaw = (slide.yaw ?? 1) as 1 | -1
  const ownImage = !plated
  const say = spokenAlt(slide)
  const alt = say || slide.image?.alt || ''

  if (slide.scene) {
    return <SceneView slide={slide} active={active} />
  }

  if (slide.layout === 'impact') {
    return (
      <ImpactHit
        src={slide.image?.src ?? ''}
        alt={alt || 'Cabinet'}
        active={active}
        facts={slide.bullets}
        focus={slide.image?.focus}
        detailSrc={slide.image?.detail}
        detailFocus={slide.image?.detailFocus}
        marks={slide.image?.marks}
      />
    )
  }

  if (slide.layout === 'image') {
    return (
      <div className={styles.bleedWrap}>
        {ownImage && slide.image && (
          <DepthField
            src={slide.image.src}
            alt={alt}
            active={active}
            fit={slide.image.fit ?? 'contain'}
            yaw={yaw}
            camera={slide.camera}
          />
        )}
      </div>
    )
  }

  if (slide.layout === 'void') {
    return (
      <div className={styles.voidSlide}>
        <Rise active={copyActive} snap={Boolean(slide.copySnap)} className={styles.voidInner}>
          {say && <p className="sr-only">{say}</p>}
          <Kicker text={slide.kicker} />
          {slide.title && (
            <h2 className={styles.voidTitle}>
              <TitleLines text={slide.title} />
            </h2>
          )}
        </Rise>
      </div>
    )
  }

  if (slide.layout === 'monument') {
    const snap = Boolean(slide.copySnap)
    return (
      <div className={styles.monument}>
        {say && <p className="sr-only">{say}</p>}
        <Rise active={copyActive} snap={snap}>
          {slide.heroNum && <div className={styles.monumentYear}>{slide.heroNum}</div>}
        </Rise>
        {slide.subtitle && (
          <Rise active={copyActive} snap={snap} delay={copyActive && !snap ? 0.18 : 0}>
            <p className={styles.monumentLine}>{slide.subtitle}</p>
          </Rise>
        )}
      </div>
    )
  }

  if (slide.layout === 'litany') {
    return (
      <div className={styles.litany}>
        {say && <p className="sr-only">{say}</p>}
        <Rise active={active}>
          <Kicker text={slide.kicker} />
        </Rise>
        <div className={styles.litanyList}>
          {(slide.bullets ?? []).map((line, i) => (
            <Rise key={line} active={active} delay={0.12 + i * 0.1}>
              <p>{line}</p>
            </Rise>
          ))}
        </div>
      </div>
    )
  }

  if (slide.layout === 'cover') {
    return (
      <div className={styles.cover} data-active={active || undefined}>
        {ownImage && slide.image && (
          <DepthField
            src={slide.image.src}
            alt={alt}
            active={active}
            fit={slide.image.fit ?? 'cover'}
            yaw={yaw}
            camera={slide.camera}
          />
        )}
        <div className={styles.coverScrim} aria-hidden />
        <Rise active={copyActive} delay={0.15} className={styles.coverContent}>
          {slide.brand && <div className={styles.brand}>{slide.brand}</div>}
          {slide.displayTitle && (
            <h1 className={styles.display}>
              <TitleLines text={slide.displayTitle} />
            </h1>
          )}
        </Rise>
        {slide.meta && (
          <Rise active={copyActive} delay={0.28} className={styles.meta}>
            {slide.meta}
          </Rise>
        )}
      </div>
    )
  }

  if (slide.layout === 'divider') {
    return (
      <div className={styles.divider}>
        {say && <p className="sr-only">{say}</p>}
        <Rise active={active}>
          <div className={styles.ghost}>{slide.ghostNum}</div>
        </Rise>
        <Rise active={active} delay={0.16}>
          <h2 className={styles.dividerTitle}>
            {slide.title && <TitleLines text={slide.title} />}
          </h2>
        </Rise>
      </div>
    )
  }

  if (slide.layout === 'bleed') {
    return (
      <BleedSlide
        slide={slide}
        active={active}
        copyActive={copyActive}
        alt={alt}
        yaw={yaw}
        ownImage={ownImage}
      />
    )
  }

  if (slide.layout === 'stage') {
    const motifFull = slide.motif === 'crystal-viewer'
    return (
      <div className={styles.stage} data-motif={slide.motif || undefined}>
        {ownImage && slide.image && !motifFull && (
          <DepthField
            src={slide.image.src}
            alt={alt}
            active={active}
            fit={slide.image.fit ?? 'cover'}
            yaw={yaw}
            camera={slide.camera}
          />
        )}
        {slide.motif === 'crystal-viewer' && (
          <div className={styles.stageCrystal}>
            <Motif kind="crystal-viewer" active={active} label={say} />
          </div>
        )}
        <div className={styles.stageScrim} aria-hidden />
        <Rise active={active} delay={0.15} className={styles.stageCopy}>
          <Kicker text={slide.kicker} />
          {slide.title && (
            <h2>
              <TitleLines text={slide.title} />
            </h2>
          )}
          {slide.subtitle && <p className={`${styles.body} text-muted`}>{slide.subtitle}</p>}
          {slide.motif && slide.motif !== 'crystal-viewer' && (
            <div className={styles.stageMotif}>
              <Motif kind={slide.motif} active={active} label={say} />
            </div>
          )}
        </Rise>
      </div>
    )
  }

  if (slide.layout === 'hero') {
    return (
      <div className={styles.hero}>
        <Rise active={active} className={styles.heroCopy}>
          <Kicker text={slide.kicker} />
          {slide.heroNum && <div className={styles.heroNum}>{slide.heroNum}</div>}
          {slide.title && (
            <h2>
              <TitleLines text={slide.title} />
            </h2>
          )}
        </Rise>
        {slide.motif && (
          <Rise active={active} delay={0.16} className={styles.heroMotif}>
            <Motif kind={slide.motif} active={active} label={say} />
          </Rise>
        )}
      </div>
    )
  }

  if (slide.layout === 'split') {
    return (
      <div className={`${styles.split}${slide.splitFlip ? ` ${styles.splitFlip}` : ''}`}>
        <Rise active={active} className={styles.splitCopy}>
          <Kicker text={slide.kicker} />
          {slide.title && (
            <h2>
              <TitleLines text={slide.title} />
            </h2>
          )}
          {slide.subtitle && <p className={`${styles.body} text-muted`}>{slide.subtitle}</p>}
        </Rise>
        <Rise active={active} delay={0.1} className={styles.splitMedia}>
          {slide.motif ? (
            <Motif kind={slide.motif} active={active} label={say} />
          ) : slide.image ? (
            <div className={styles.splitDepth}>
              <DepthField
                src={slide.image.src}
                alt={alt}
                active={active}
                fit={slide.image.fit ?? 'cover'}
                yaw={yaw}
              />
            </div>
          ) : null}
        </Rise>
      </div>
    )
  }

  return (
    <div className={styles.contentSlide}>
      {say && <p className="sr-only">{say}</p>}
      <Rise active={active} className={styles.contentFill}>
        <Kicker text={slide.kicker} />
        {slide.title && (
          <h2>
            <TitleLines text={slide.title} />
          </h2>
        )}
        {slide.subtitle && <p className={`${styles.body} text-muted`}>{slide.subtitle}</p>}
      </Rise>
    </div>
  )
}
