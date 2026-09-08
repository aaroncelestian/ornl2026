import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import { useScene } from '../../hooks/useSceneBeats'
import data from '../../data/mineralConstellation.json'
import styles from './Motifs.module.css'

type Tier = 'hero' | 'peer' | 'field'
type Domain = keyof typeof data.domains

type Mineral = {
  id: string
  name: string
  apps: string[]
  domain: Domain
  tier: Tier
  x: number
  y: number
  named?: number
  afterlife?: string
}

type Phase = 'peri' | 'peers' | 'sky' | 'cabinets' | 'instrument' | 'turn'

const W = data.view.w
const H = data.view.h
const minerals = data.minerals as Mineral[]
const hero = minerals.find((m) => m.tier === 'hero') ?? minerals[0]

function phaseForBeat(id?: string): Phase {
  if (id === 'peers') return 'peers'
  if (id === 'sky') return 'sky'
  if (id === 'cabinets') return 'cabinets'
  if (id === 'instrument') return 'instrument'
  if (id === 'turn') return 'turn'
  return 'peri'
}

function cameraFor(phase: Phase, focus: Mineral | null) {
  if (focus) {
    return { cx: focus.x, cy: focus.y, scale: 3.2 }
  }
  if (phase === 'peri') return { cx: hero.x - 18, cy: hero.y + 6, scale: 4.6 }
  if (phase === 'peers') return { cx: 420, cy: 310, scale: 1.85 }
  if (phase === 'sky') return { cx: W / 2, cy: H / 2, scale: 1 }
  // cabinets and later: pull slightly wider then hide under cabinet plate
  return { cx: W / 2, cy: H / 2, scale: 0.72 }
}

function rayEnds(m: Mineral, count: number) {
  const base = (m.id.charCodeAt(0) * 17 + m.id.length * 13) % 360
  return m.apps.slice(0, count).map((app, i) => {
    const ang = ((base + i * (360 / Math.max(count, 1)) + i * 28) * Math.PI) / 180
    const len = m.tier === 'hero' ? 78 : m.tier === 'peer' ? 58 : 36
    return {
      app,
      x2: m.x + Math.cos(ang) * len,
      y2: m.y + Math.sin(ang) * len,
      lx: m.x + Math.cos(ang) * (len + 10),
      ly: m.y + Math.sin(ang) * (len + 10),
    }
  })
}

function Cabinets({
  phase,
  reduced,
}: {
  phase: Phase
  reduced: boolean
}) {
  const show = phase === 'cabinets' || phase === 'instrument' || phase === 'turn'
  const focusDrawer = phase === 'turn'
  const openDrawers = phase === 'instrument' || phase === 'turn' ? [1, 3, 5] : [2, 4]

  const units = useMemo(() => {
    const cols = 5
    const rows = 2
    const out: { x: number; y: number; drawers: number }[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({ x: 48 + c * 184, y: 70 + r * 250, drawers: 6 })
      }
    }
    return out
  }, [])

  return (
    <motion.g
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: show ? 'auto' : 'none' }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#050505" opacity={0.55} />
      {units.map((unit, ui) => {
        const w = 168
        const h = 228
        const drawerH = 28
        return (
          <g key={ui} transform={`translate(${unit.x} ${unit.y})`}>
            <rect
              width={w}
              height={h}
              rx={2}
              fill="#12110f"
              stroke="rgba(220,210,190,0.18)"
              strokeWidth={1}
            />
            <rect x={6} y={6} width={w - 12} height={14} fill="rgba(220,210,190,0.06)" />
            {Array.from({ length: unit.drawers }).map((_, di) => {
              const open = openDrawers.includes(di) && (ui === 1 || ui === 3 || ui === 6)
              const y = 28 + di * (drawerH + 4)
              const pull = open ? (focusDrawer && ui === 3 && di === 3 ? 54 : 34) : 0
              const glow = open
              return (
                <g key={di} transform={`translate(${pull} 0)`}>
                  <rect
                    x={8}
                    y={y}
                    width={w - 16}
                    height={drawerH}
                    rx={1}
                    fill={open ? '#1a1814' : '#161512'}
                    stroke="rgba(220,210,190,0.14)"
                    strokeWidth={1}
                  />
                  <rect
                    x={w / 2 - 10}
                    y={y + drawerH / 2 - 1.5}
                    width={20}
                    height={3}
                    rx={1}
                    fill="rgba(220,210,190,0.28)"
                  />
                  {glow &&
                    [0, 1, 2, 3, 4].map((gi) => {
                      const gx = 22 + gi * 26 + (gi % 2) * 4
                      const gy = y + 10 + (gi % 3)
                      const color =
                        gi % 3 === 0 ? '#e8b86a' : gi % 3 === 1 ? '#7ec4a8' : '#8eb4d8'
                      return (
                        <g key={gi}>
                          <circle cx={gx} cy={gy} r={7} fill={color} opacity={0.12} />
                          <circle cx={gx} cy={gy} r={2.4} fill={color} opacity={0.85} />
                        </g>
                      )
                    })}
                  {focusDrawer && ui === 3 && di === 3 && (
                    <circle cx={w / 2} cy={y + drawerH / 2} r={10} fill="#e8b86a" opacity={0.35}>
                      {!reduced && (
                        <animate
                          attributeName="opacity"
                          values="0.2;0.45;0.2"
                          dur="2.4s"
                          repeatCount="indefinite"
                        />
                      )}
                    </circle>
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
    </motion.g>
  )
}

export function MineralConstellation({ active, label }: { active: boolean; label?: string }) {
  const scene = useScene()
  const reduced = usePrefersReducedMotion()
  const phase = phaseForBeat(scene.beat?.id)
  const [focusId, setFocusId] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const focus = useMemo(
    () => (focusId ? minerals.find((m) => m.id === focusId) ?? null : null),
    [focusId],
  )

  // Clear exploratory zoom when leaving sky or changing beat
  useEffect(() => {
    if (phase !== 'sky') setFocusId(null)
  }, [phase])

  useEffect(() => {
    if (!active) setFocusId(null)
  }, [active])

  useEffect(() => {
    if (!focusId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setFocusId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusId])

  const cam = cameraFor(phase, focus)
  const springCfg = reduced
    ? { stiffness: 400, damping: 40, mass: 0.2 }
    : { stiffness: 48, damping: 18, mass: 0.85 }

  const scale = useSpring(cam.scale, springCfg)
  const cx = useSpring(cam.cx, springCfg)
  const cy = useSpring(cam.cy, springCfg)

  useEffect(() => {
    scale.set(cam.scale)
    cx.set(cam.cx)
    cy.set(cam.cy)
  }, [cam.cx, cam.cy, cam.scale, cx, cy, scale])

  const viewBox = useTransform([scale, cx, cy], ([s, x, y]) => {
    const sw = W / Number(s)
    const sh = H / Number(s)
    return `${Number(x) - sw / 2} ${Number(y) - sh / 2} ${sw} ${sh}`
  })

  const [vb, setVb] = useState(() => {
    const s = cam.scale
    const sw = W / s
    const sh = H / s
    return `${cam.cx - sw / 2} ${cam.cy - sh / 2} ${sw} ${sh}`
  })

  useEffect(() => {
    const unsub = viewBox.on('change', (v) => setVb(String(v)))
    return () => unsub()
  }, [viewBox])

  const showField = phase === 'sky' || phase === 'cabinets' || Boolean(focus)
  const showPeers = phase !== 'peri' || Boolean(focus)
  const constellationOpacity =
    phase === 'cabinets' || phase === 'instrument' || phase === 'turn' ? 0.08 : 1
  const labelMode: 'hero' | 'peers' | 'sky' | 'focus' | 'none' =
    focus ? 'focus' : phase === 'peri' ? 'hero' : phase === 'peers' ? 'peers' : phase === 'sky' ? 'sky' : 'none'

  const clickable = phase === 'sky' && !focus

  return (
    <div
      ref={wrapRef}
      className={styles.constellation}
      aria-label={label || 'Mineral constellation — from perovskite to the collection'}
      onClick={(e) => {
        if (focus && e.target === e.currentTarget) setFocusId(null)
      }}
    >
      <svg
        className={styles.constellationSvg}
        viewBox={vb}
        width="100%"
        height="100%"
        role="img"
        onClick={(e) => {
          if (focus && (e.target as Element).tagName === 'svg') setFocusId(null)
        }}
      >
        <defs>
          <radialGradient id="mc-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0d9a0" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#e8b86a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#e8b86a" stopOpacity="0" />
          </radialGradient>
          <filter id="mc-soft" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        <motion.g
          initial={false}
          animate={{ opacity: constellationOpacity }}
          transition={{ duration: reduced ? 0 : 0.85, ease: [0.16, 1, 0.3, 1] }}
        >
          {minerals.map((m) => {
            const isHero = m.tier === 'hero'
            const isPeer = m.tier === 'peer'
            const isFocus = focus?.id === m.id
            const visible =
              isFocus ||
              isHero ||
              (isPeer && showPeers) ||
              (m.tier === 'field' && showField)

            if (!visible && m.tier === 'field') {
              // keep faint dust on peers beat
              if (phase === 'peers') {
                return (
                  <circle
                    key={m.id}
                    cx={m.x}
                    cy={m.y}
                    r={1.2}
                    fill={data.domains[m.domain]}
                    opacity={0.18}
                  />
                )
              }
              return null
            }

            const color = data.domains[m.domain]
            const r = isHero ? 14 : isPeer ? 8.5 : isFocus ? 10 : 3.2
            const showRays =
              isFocus ||
              (labelMode === 'hero' && isHero) ||
              (labelMode === 'peers' && (isHero || isPeer)) ||
              (labelMode === 'sky' && (isHero || isPeer)) ||
              (labelMode === 'focus' && isFocus)

            const rays = showRays ? rayEnds(m, isHero || isFocus ? m.apps.length : Math.min(2, m.apps.length)) : []
            const showName =
              isFocus ||
              (labelMode === 'hero' && isHero) ||
              (labelMode === 'peers' && (isHero || isPeer)) ||
              (labelMode === 'sky' && (isHero || isPeer || m.tier === 'field'))

            const nameSize = isFocus ? 11 : labelMode === 'sky' && m.tier === 'field' ? 4.2 : isHero ? 13 : 8
            const appSize = isFocus ? 8 : labelMode === 'sky' && m.tier === 'field' ? 3.4 : 6.5

            return (
              <g
                key={m.id}
                className={clickable || isFocus ? styles.constellationNode : undefined}
                style={{ cursor: clickable || isFocus ? 'pointer' : 'default' }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (phase !== 'sky') return
                  setFocusId((cur) => (cur === m.id ? null : m.id))
                }}
              >
                {(isHero || isPeer || isFocus) && (
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={r * 3.4}
                    fill="url(#mc-glow)"
                    opacity={isFocus ? 1 : isHero ? 0.95 : 0.55}
                    filter="url(#mc-soft)"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {rays.map((ray) => (
                  <g key={ray.app} style={{ pointerEvents: 'none' }}>
                    <line
                      x1={m.x}
                      y1={m.y}
                      x2={ray.x2}
                      y2={ray.y2}
                      stroke={color}
                      strokeWidth={isFocus || isHero ? 1.1 : 0.7}
                      opacity={0.55}
                    />
                    <circle cx={ray.x2} cy={ray.y2} r={1.6} fill={color} opacity={0.7} />
                    <text
                      x={ray.lx}
                      y={ray.ly}
                      fill="rgba(236,228,210,0.82)"
                      fontSize={appSize}
                      fontFamily="var(--font-body), sans-serif"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {ray.app}
                    </text>
                  </g>
                ))}
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={Math.max(r, clickable ? 10 : r)}
                  fill="transparent"
                  opacity={0}
                />
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={r}
                  fill={color}
                  opacity={m.tier === 'field' && !isFocus ? 0.72 : 0.95}
                  stroke="rgba(255,248,230,0.35)"
                  strokeWidth={isHero || isFocus ? 1.2 : 0.4}
                  style={{ pointerEvents: 'none' }}
                />
                {showName && (
                  <text
                    x={m.x}
                    y={m.y + r + (labelMode === 'sky' && m.tier === 'field' ? 6 : 16)}
                    fill={
                      m.tier === 'field' && !isFocus
                        ? 'rgba(236,228,210,0.42)'
                        : 'rgba(245,238,220,0.92)'
                    }
                    fontSize={nameSize}
                    fontFamily="var(--font-display, var(--font-body)), serif"
                    fontWeight={isHero || isFocus ? 600 : 500}
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {m.name}
                  </text>
                )}
                {isFocus && m.afterlife && (
                  <text
                    x={m.x}
                    y={m.y + r + 28}
                    fill="rgba(236,228,210,0.55)"
                    fontSize={7}
                    fontFamily="var(--font-body), sans-serif"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {m.named ? `${m.named} · ${m.afterlife}` : m.afterlife}
                  </text>
                )}
                {isHero && labelMode === 'hero' && m.named && (
                  <text
                    x={m.x}
                    y={m.y - r - 22}
                    fill="rgba(236,228,210,0.5)"
                    fontSize={7}
                    fontFamily="var(--font-body), sans-serif"
                    letterSpacing="0.12em"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {m.named}
                  </text>
                )}
              </g>
            )
          })}
        </motion.g>

        <Cabinets phase={phase} reduced={reduced} />
      </svg>

      <AnimatePresence>
        {focus && (
          <motion.button
            type="button"
            className={styles.constellationHint}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            onClick={() => setFocusId(null)}
          >
            {focus.name} · click empty / Esc to pull back
          </motion.button>
        )}
      </AnimatePresence>

      {phase === 'sky' && !focus && (
        <div className={styles.constellationHint} data-idle="">
          Click a mineral to zoom in
        </div>
      )}
    </div>
  )
}
