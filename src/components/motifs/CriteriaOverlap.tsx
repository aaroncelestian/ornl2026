import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import styles from './Motifs.module.css'

const criteria = [
  { id: 'size', label: 'Crystal size & completeness' },
  { id: 'form', label: 'Form' },
  { id: 'color', label: 'Color' },
  { id: 'transparency', label: 'Transparency' },
  { id: 'luster', label: 'Luster' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'provenance', label: 'Provenance' },
]

export function CriteriaOverlap({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion()

  return (
    <div className={styles.criteria} aria-label="Aesthetic and scientific criteria overlap">
      <div className={styles.criteriaCols}>
        <div className={styles.criteriaCol}>
          <h3>Aesthetic object</h3>
          <p>What collectors and visitors respond to.</p>
        </div>
        <div className={styles.criteriaCol} data-science>
          <h3>Scientific dataset</h3>
          <p>What future instruments can still read.</p>
        </div>
      </div>
      <ul className={styles.criteriaList}>
        {criteria.map((c, i) => (
          <motion.li
            key={c.id}
            initial={false}
            animate={
              active
                ? { opacity: 1, x: 0 }
                : { opacity: 0, x: reduced ? 0 : -12 }
            }
            transition={{
              duration: reduced ? 0 : 0.4,
              delay: reduced ? 0 : 0.08 + i * 0.06,
              ease: [0.2, 0.8, 0.2, 1],
            }}
          >
            <span className={styles.criteriaBar} aria-hidden />
            {c.label}
          </motion.li>
        ))}
      </ul>
      <motion.p
        className={styles.criteriaThesis}
        initial={false}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ delay: reduced ? 0 : 0.55, duration: reduced ? 0 : 0.45 }}
      >
        Same act of looking. A complete crystal face is a better object and a better
        growth history.
      </motion.p>
    </div>
  )
}
