import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import styles from './Motifs.module.css'

export function ColorReveal({
  active,
  src,
  alt,
}: {
  active: boolean
  src: string
  alt: string
}) {
  const reduced = usePrefersReducedMotion()
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!active) {
      setRevealed(false)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'r' && e.key !== 'R') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      e.preventDefault()
      e.stopPropagation()
      setRevealed((v) => !v)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active])

  return (
    <div className={styles.reveal} aria-label="Blue Wave color reveal">
      <div className={styles.revealStage}>
        <motion.img
          src={src}
          alt={alt}
          className={styles.revealImg}
          animate={{
            filter: revealed
              ? 'saturate(1.15) contrast(1.05)'
              : 'saturate(0.55) contrast(0.95) brightness(1.05)',
            scale: revealed ? 1.02 : 1,
          }}
          transition={{ duration: reduced ? 0 : 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        />
        <div className={styles.revealScrim} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={revealed ? 'after' : 'before'}
          className={styles.revealCopy}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
        >
          {!revealed ? (
            <>
              <p className={styles.revealQuestion}>Visitors assume it&apos;s dyed.</p>
              <button
                type="button"
                className={styles.revealBtn}
                onClick={() => setRevealed(true)}
              >
                Reveal the blue · Enter
              </button>
            </>
          ) : (
            <>
              <p className={styles.revealAnswer}>
                Trace copper substitution in the aragonite lattice — the same
                transition-metal mechanism as malachite and azurite.
              </p>
              <p className={styles.revealSub}>
                Aesthetic surprise delivering a mineralogy lesson.
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
