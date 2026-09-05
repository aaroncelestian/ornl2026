import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import styles from './Motifs.module.css'

const ions = [
  { id: 'Na', label: 'Na⁺', radius: 1.02, pass: true, note: 'Fits' },
  { id: 'Ca', label: 'Ca²⁺', radius: 1.0, pass: true, note: 'Fits' },
  { id: 'K', label: 'K⁺', radius: 1.38, pass: false, note: 'Excluded' },
]

const maxR = 1.5

export function IonChart({ active, label }: { active: boolean; label?: string }) {
  const reduced = usePrefersReducedMotion()

  return (
    <div className={styles.ion} aria-label={label || 'Ion radius versus channel selectivity'}>
      <div className={styles.ionBars}>
        {ions.map((ion, i) => (
          <div key={ion.id} className={styles.ionRow} data-pass={ion.pass || undefined}>
            <div className={styles.ionLabel}>
              <strong>{ion.label}</strong>
              <span>{ion.radius.toFixed(2)} Å</span>
            </div>
            <div className={styles.ionTrack}>
              <motion.div
                className={styles.ionFill}
                initial={false}
                animate={{
                  width: active ? `${(ion.radius / maxR) * 100}%` : '0%',
                }}
                transition={{
                  duration: reduced ? 0 : 0.7,
                  delay: reduced ? 0 : 0.12 + i * 0.12,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
              />
              <motion.div
                className={styles.ionGate}
                aria-hidden
                initial={false}
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ delay: reduced ? 0 : 0.55 }}
              />
            </div>
            <span className={styles.ionNote}>{ion.note}</span>
          </div>
        ))}
      </div>
      <p className={styles.ionFoot}>
        Three million patients.
      </p>
    </div>
  )
}
