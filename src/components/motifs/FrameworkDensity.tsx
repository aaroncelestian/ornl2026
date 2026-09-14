import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import data from '../../data/frameworkDensity.json'
import styles from './Motifs.module.css'

const CX = 580
const CY = 250

function voidRadius(density: number) {
  const maxD = Math.max(...data.materials.map((m) => m.density))
  const minD = Math.min(...data.materials.map((m) => m.density))
  const t = (maxD - density) / (maxD - minD || 1)
  return 36 + t * 118
}

export function FrameworkDensity({ active, label }: { active: boolean; label?: string }) {
  const reduced = usePrefersReducedMotion()

  const peers = data.materials.filter((m) => m.kind !== 'highlight')
  const hero = data.materials.find((m) => m.kind === 'highlight')!
  const heroR = voidRadius(hero.density) * 1.28

  const orbit = peers.map((mat, i) => {
    const angle = -Math.PI * 0.92 + (i / Math.max(1, peers.length - 1)) * Math.PI * 1.65
    const dist = 218
    return {
      ...mat,
      r: voidRadius(mat.density) * 0.7,
      x: CX + Math.cos(angle) * dist,
      y: CY + Math.sin(angle) * dist * 0.82,
    }
  })

  return (
    <div className={styles.theater} aria-label={label || 'Framework porosity as luminous voids'}>
      <svg viewBox="0 0 920 500" className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="rowleyCore" cx="42%" cy="38%" r="58%">
            <stop offset="0%" stopColor="rgba(255,210,140,0.95)" />
            <stop offset="28%" stopColor="rgba(224,112,64,0.72)" />
            <stop offset="62%" stopColor="rgba(224,112,64,0.22)" />
            <stop offset="100%" stopColor="rgba(224,112,64,0)" />
          </radialGradient>
          <radialGradient id="rowleyHalo" cx="45%" cy="40%" r="70%">
            <stop offset="0%" stopColor="rgba(224,112,64,0.35)" />
            <stop offset="45%" stopColor="rgba(224,112,64,0.12)" />
            <stop offset="100%" stopColor="rgba(224,112,64,0)" />
          </radialGradient>
          <radialGradient id="voidGlow" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(240,190,100,0.55)" />
            <stop offset="40%" stopColor="rgba(212,160,74,0.28)" />
            <stop offset="100%" stopColor="rgba(212,160,74,0)" />
          </radialGradient>
          <radialGradient id="synthGlow" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(180,230,240,0.7)" />
            <stop offset="35%" stopColor="rgba(126,196,212,0.38)" />
            <stop offset="100%" stopColor="rgba(126,196,212,0)" />
          </radialGradient>
          <filter id="orbBloom" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="heroBloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer atmospheric wash */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={heroR * 1.85}
          fill="url(#rowleyHalo)"
          filter={reduced ? undefined : 'url(#heroBloom)'}
          initial={false}
          animate={{ opacity: active ? 1 : 0, r: active ? heroR * 1.85 : 40 }}
          transition={{ duration: reduced ? 0 : 1.15, ease: [0.16, 1, 0.3, 1] }}
        />

        {orbit.map((mat, i) => {
          const synth = mat.kind === 'synthetic'
          const fill = synth ? 'url(#synthGlow)' : 'url(#voidGlow)'
          return (
            <motion.g
              key={mat.id}
              initial={false}
              animate={{ opacity: active ? 0.85 : 0 }}
              transition={{
                duration: reduced ? 0 : 0.55,
                delay: reduced || !active ? 0 : 0.06 + i * 0.07,
              }}
            >
              <motion.circle
                cx={mat.x}
                cy={mat.y}
                r={mat.r * 1.35}
                fill={fill}
                filter={reduced ? undefined : 'url(#orbBloom)'}
                initial={false}
                animate={{ r: active ? mat.r * 1.35 : 8 }}
                transition={{
                  duration: reduced ? 0 : 0.9,
                  delay: reduced || !active ? 0 : 0.05 + i * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
              <motion.circle
                cx={mat.x}
                cy={mat.y}
                r={mat.r}
                fill={fill}
                initial={false}
                animate={{ r: active ? mat.r : 6 }}
                transition={{
                  duration: reduced ? 0 : 0.85,
                  delay: reduced || !active ? 0 : 0.05 + i * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
              <text x={mat.x} y={mat.y + mat.r + 22} textAnchor="middle" className={styles.theaterMark}>
                {mat.label.replace(' (synth.)', '')}
              </text>
            </motion.g>
          )
        })}

        <motion.g
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.6 }}
        >
          <motion.circle
            cx={CX}
            cy={CY}
            r={heroR * 1.35}
            fill="url(#rowleyHalo)"
            initial={false}
            animate={
              reduced || !active
                ? { r: heroR * 1.35, opacity: active ? 1 : 0 }
                : {
                    r: [heroR * 1.28, heroR * 1.42, heroR * 1.28],
                    opacity: [0.85, 1, 0.85],
                  }
            }
            transition={
              reduced || !active
                ? { duration: 0.9 }
                : { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <circle
            cx={CX}
            cy={CY}
            r={heroR}
            fill="url(#rowleyCore)"
            filter={reduced ? undefined : 'url(#heroBloom)'}
          />
          <text x={CX} y={CY + 5} textAnchor="middle" className={styles.theaterIon}>
            Rowleyite
          </text>
          <text x={CX} y={CY + heroR + 30} textAnchor="middle" className={styles.theaterCall}>
            FD {hero.density} · lowest natural
          </text>
        </motion.g>
      </svg>
    </div>
  )
}
