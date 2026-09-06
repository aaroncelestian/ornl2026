import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/doubleLever.json'
import styles from './Motifs.module.css'

const W = 920
const H = 500

type Phase = 'idle' | 'enter' | 'torque'

function phaseForBeat(id?: string): Phase {
  if (id === 'lock' || id === 'torque' || id === 'patients') return 'torque'
  if (id === 'protons' || id === 'enter' || id === 'k') return 'enter'
  return 'idle'
}

function rot(cx: number, cy: number, x: number, y: number, deg: number) {
  const a = (deg * Math.PI) / 180
  const dx = x - cx
  const dy = y - cy
  return {
    x: cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: cy + dx * Math.sin(a) + dy * Math.cos(a),
  }
}

export function DoubleLever({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const copy = data.phases[phase]

  const cx = 340
  const cy = 250
  const rOuter = 118

  const ringAngles = [-90, -38, 14, 66, 118, 170, 222].map((d) => (d * Math.PI) / 180)
  const ringPts = ringAngles.map((a, i) => {
    const rr = i % 2 === 0 ? rOuter : rOuter - 18
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr }
  })
  const ringPath =
    ringPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  const triBase = [
    { x: cx + 78, y: cy + 28 },
    { x: cx + 118, y: cy + 8 },
    { x: cx + 108, y: cy + 58 },
  ]
  const triTwist = phase === 'torque' ? 14 : 0
  const tri = triBase.map((p) => rot(triBase[0].x, triBase[0].y, p.x, p.y, triTwist))
  const triPath = `M ${tri[0].x} ${tri[0].y} L ${tri[1].x} ${tri[1].y} L ${tri[2].x} ${tri[2].y} Z`

  const kTargets = {
    idle: { x: cx - 210, y: cy },
    enter: { x: cx - 48, y: cy },
    torque: { x: cx + 6, y: cy - 2 },
  }
  const kPos = kTargets[phase]

  const waterPivot = { x: cx - 10, y: cy + 20 }
  const waterAngle = phase === 'torque' ? -40 : phase === 'enter' ? -14 : 16
  const h1 = rot(waterPivot.x, waterPivot.y, waterPivot.x - 12, waterPivot.y - 10, waterAngle)
  const h2 = rot(waterPivot.x, waterPivot.y, waterPivot.x + 12, waterPivot.y - 10, waterAngle)

  const ohEnd = {
    idle: { x: cx + 22, y: cy - 32 },
    enter: { x: cx + 18, y: cy - 28 },
    torque: { x: cx + 8, y: cy - 18 },
  }[phase]

  return (
    <div className={styles.plot} aria-label={label || 'CZS double-lever potassium exchange mechanism'}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.plotSvg} role="img">
        <text x={40} y={32} className={styles.plotHiLabel}>
          {copy.title}
        </text>
        <text x={40} y={52} className={styles.plotHiSub}>
          {data.source}
        </text>

        <rect
          x={cx - 200}
          y={cy - rOuter - 20}
          width={400}
          height={rOuter * 2 + 40}
          rx={8}
          fill="rgba(126,196,212,0.06)"
          stroke="rgba(126,196,212,0.18)"
        />

        <motion.path
          d={ringPath}
          fill="rgba(224,112,64,0.08)"
          stroke="#e07040"
          strokeWidth={2}
          initial={false}
          animate={{ opacity: active ? 1 : 0.3 }}
        />
        {ringPts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i % 2 === 0 ? 7 : 5.5}
            fill={i % 2 === 0 ? '#7ec4d4' : '#d4a04a'}
            stroke="rgba(7,6,5,0.5)"
            strokeWidth={1}
          />
        ))}
        <text x={cx} y={cy - rOuter - 28} textAnchor="middle" className={styles.plotAnnotate}>
          7MR window
        </text>

        <motion.line
          x1={cx + 52}
          y1={cy - 70}
          x2={ohEnd.x}
          y2={ohEnd.y}
          stroke="#c4899a"
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />
        <motion.circle
          cx={ohEnd.x}
          cy={ohEnd.y}
          r={5}
          fill="#c4899a"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />
        <text x={cx + 58} y={cy - 78} className={styles.plotTick}>
          OH · O1
        </text>

        <motion.circle
          cx={waterPivot.x}
          cy={waterPivot.y}
          r={11}
          fill="#7ec4d4"
          fillOpacity={0.85}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
        />
        <motion.circle cx={h1.x} cy={h1.y} r={4} fill="#f3eee4" initial={false} animate={{ opacity: active ? 1 : 0 }} />
        <motion.circle cx={h2.x} cy={h2.y} r={4} fill="#f3eee4" initial={false} animate={{ opacity: active ? 1 : 0 }} />
        <text x={waterPivot.x} y={waterPivot.y + 28} textAnchor="middle" className={styles.plotTick}>
          H₂O
        </text>

        <motion.text
          x={cx - 100}
          y={cy - 100}
          className={styles.plotAnnotate}
          initial={false}
          animate={{ opacity: active && phase !== 'idle' ? 1 : 0 }}
        >
          ① hydrate + rotate
        </motion.text>
        <motion.text
          x={cx + 86}
          y={cy + 108}
          className={styles.plotAnnotate}
          initial={false}
          animate={{ opacity: active && phase === 'torque' ? 1 : 0 }}
        >
          ② OH torque · 3MR opens
        </motion.text>

        <motion.path
          d={triPath}
          fill="rgba(212,160,74,0.25)"
          stroke="#d4a04a"
          strokeWidth={2}
          initial={false}
          animate={{ opacity: active ? 1 : 0.4 }}
        />
        <text x={tri[1].x + 8} y={tri[1].y} className={styles.plotTick}>
          3MR
        </text>

        <motion.g
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.4 }}
        >
          <motion.circle
            cx={kPos.x}
            cy={kPos.y}
            r={16}
            fill="#e07040"
            initial={false}
            animate={{ cx: kPos.x, cy: kPos.y }}
            transition={{ duration: reduced ? 0 : 0.85, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.text
            x={kPos.x}
            y={kPos.y + 5}
            textAnchor="middle"
            fill="#070605"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700 }}
            initial={false}
            animate={{ x: kPos.x, y: kPos.y + 5 }}
            transition={{ duration: reduced ? 0 : 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            K⁺
          </motion.text>
        </motion.g>

        <circle
          cx={cx}
          cy={cy}
          r={28}
          fill="none"
          stroke="rgba(243,238,228,0.2)"
          strokeDasharray="4 4"
        />

        {data.callouts.map((c, i) => (
          <motion.g
            key={c.id}
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ delay: reduced ? 0 : 0.12 + i * 0.08 }}
          >
            <text x={700} y={118 + i * 64} className={styles.plotTick}>
              {c.label}
            </text>
            <text x={700} y={144 + i * 64} className={styles.plotHiLabel}>
              {c.value}
            </text>
          </motion.g>
        ))}
      </svg>
      <p className={styles.plotFoot}>{copy.foot}</p>
    </div>
  )
}
