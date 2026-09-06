import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/frameworkDensity.json'
import styles from './Motifs.module.css'

const CX = 640
const CY = 235

type Phase = 'density' | 'rings' | 'both'

function phaseForBeat(id?: string): Phase {
  if (id === 'rings' || id === 'window') return 'rings'
  if (id === 'density-only') return 'density'
  return 'both'
}

function voidRadius(density: number) {
  const maxD = Math.max(...data.materials.map((m) => m.density))
  const minD = Math.min(...data.materials.map((m) => m.density))
  const t = (maxD - density) / (maxD - minD || 1)
  return 32 + t * 100
}

export function FrameworkDensity({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const showVoids = phase !== 'rings'
  const showRings = phase === 'rings' || phase === 'both'

  const peers = data.materials.filter((m) => m.kind !== 'highlight')
  const hero = data.materials.find((m) => m.kind === 'highlight')!
  const heroR = voidRadius(hero.density) * 1.2

  const orbit = peers.map((mat, i) => {
    const angle = -Math.PI * 0.85 + (i / Math.max(1, peers.length - 1)) * Math.PI * 1.55
    const dist = 195
    return {
      ...mat,
      r: voidRadius(mat.density) * 0.68,
      x: CX + Math.cos(angle) * dist,
      y: CY + Math.sin(angle) * dist * 0.78,
    }
  })

  return (
    <div className={styles.theater} aria-label={label || 'Framework porosity as luminous voids'}>
      <svg viewBox="0 0 920 500" className={styles.theaterSvg} role="img">
        <defs>
          <radialGradient id="rowleyGlow" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(224,112,64,0.5)" />
            <stop offset="55%" stopColor="rgba(224,112,64,0.1)" />
            <stop offset="100%" stopColor="rgba(224,112,64,0)" />
          </radialGradient>
          <radialGradient id="voidGlow" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(212,160,74,0.32)" />
            <stop offset="100%" stopColor="rgba(212,160,74,0)" />
          </radialGradient>
          <radialGradient id="synthGlow" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(126,196,212,0.38)" />
            <stop offset="100%" stopColor="rgba(126,196,212,0)" />
          </radialGradient>
        </defs>

        {showVoids && (
          <motion.circle
            cx={CX}
            cy={CY}
            r={heroR * 1.45}
            fill="url(#rowleyGlow)"
            initial={false}
            animate={{ opacity: active ? 1 : 0, r: active ? heroR * 1.45 : 36 }}
            transition={{ duration: reduced ? 0 : 1.0, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {orbit.map((mat, i) => {
          const synth = mat.kind === 'synthetic'
          const fill = synth ? 'url(#synthGlow)' : 'url(#voidGlow)'
          const stroke = synth ? '#7ec4d4' : 'rgba(212,160,74,0.75)'
          return (
            <motion.g
              key={mat.id}
              initial={false}
              animate={{ opacity: active && showVoids ? 0.7 : 0 }}
              transition={{
                duration: reduced ? 0 : 0.5,
                delay: reduced || !active ? 0 : 0.05 + i * 0.06,
              }}
            >
              <motion.circle
                cx={mat.x}
                cy={mat.y}
                r={mat.r}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.25}
                initial={false}
                animate={{ r: active && showVoids ? mat.r : 6 }}
                transition={{
                  duration: reduced ? 0 : 0.8,
                  delay: reduced || !active ? 0 : 0.04 + i * 0.05,
                }}
              />
              <text x={mat.x} y={mat.y + mat.r + 18} textAnchor="middle" className={styles.theaterMark}>
                {mat.label.replace(' (synth.)', '')}
              </text>
            </motion.g>
          )
        })}

        {showVoids && (
          <motion.g
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.55 }}
          >
            <circle cx={CX} cy={CY} r={heroR} fill="url(#rowleyGlow)" stroke="#e07040" strokeWidth={2.5} />
            <text x={CX} y={CY + 5} textAnchor="middle" className={styles.theaterIon}>
              Rowleyite
            </text>
            <text x={CX} y={CY + heroR + 26} textAnchor="middle" className={styles.theaterCall}>
              FD {hero.density} · lowest natural
            </text>
          </motion.g>
        )}

        <motion.g
          initial={false}
          animate={{ opacity: active && showRings ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.45 }}
        >
          <circle
            cx={CX}
            cy={CY}
            r={92}
            fill="none"
            stroke="rgba(126,196,212,0.55)"
            strokeWidth={1.75}
            strokeDasharray="4 6"
          />
          <circle cx={CX} cy={CY} r={38} fill="none" stroke="rgba(243,204,122,0.65)" strokeWidth={1.75} />
          <text x={CX + 118} y={CY - 78} className={styles.theaterMark}>
            12MR · {data.rings.large.value} Å
          </text>
          <text x={CX + 118} y={CY - 58} className={styles.theaterMark}>
            salt cage · {data.rings.small.value} Å
          </text>
        </motion.g>
      </svg>
    </div>
  )
}
