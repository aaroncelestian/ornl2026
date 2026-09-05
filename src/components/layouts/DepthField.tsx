import { useEffect, useRef, useState } from 'react'
import { motion, useSpring } from 'framer-motion'
import { isPresentMode } from '../../lib/asset'
import { usePrefersReducedMotion } from '../../hooks/useActiveSlide'
import type { CameraKind } from '../../data/slides'
import styles from './DepthField.module.css'

export type PlateMode = 'live' | 'ghost'

export type DepthFieldProps = {
  src: string
  alt: string
  active: boolean
  fit?: 'cover' | 'contain'
  yaw?: 1 | -1
  camera?: CameraKind
  mode?: PlateMode
  cutout?: boolean
  className?: string
  children?: React.ReactNode
}

function useEdgeExtend(src: string, enabled: boolean) {
  const [edges, setEdges] = useState<{ left: string; right: string } | null>(null)

  useEffect(() => {
    if (!enabled) {
      setEdges(null)
      return
    }

    let dead = false
    const img = new Image()
    img.src = src

    const paint = () => {
      if (dead || !img.naturalWidth) return
      const w = img.naturalWidth
      const h = img.naturalHeight
      const sw = Math.max(16, Math.round(w * 0.03))
      const ctxFor = (sx: number) => {
        const canvas = document.createElement('canvas')
        canvas.width = sw
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return ''
        ctx.drawImage(img, sx, 0, sw, h, 0, 0, sw, h)
        try {
          return canvas.toDataURL('image/jpeg', 0.75)
        } catch {
          // file:// taints the canvas; skip edge extend.
          return ''
        }
      }
      const left = ctxFor(0)
      const right = ctxFor(w - sw)
      if (left && right) setEdges({ left, right })
    }

    if (img.complete) paint()
    else img.onload = paint
    return () => {
      dead = true
    }
  }, [src, enabled])

  return edges
}

export function DepthField({
  src,
  alt,
  active,
  fit = 'cover',
  camera = 'push',
  mode = 'live',
  cutout = false,
  className,
  children,
}: DepthFieldProps) {
  const reduced = usePrefersReducedMotion()
  const present = isPresentMode()
  const rootRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const edges = useEdgeExtend(src, fit === 'contain' && !cutout)

  const px = useSpring(0, { stiffness: 28, damping: 24, mass: 0.8 })
  const py = useSpring(0, { stiffness: 28, damping: 24, mass: 0.8 })

  useEffect(() => {
    if (!active) {
      setReady(false)
      return
    }
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [active, src])

  useEffect(() => {
    if (!active || reduced || present || mode === 'ghost') {
      px.set(0)
      py.set(0)
      return
    }

    const el = rootRef.current
    if (!el) return

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      px.set(nx * 10)
      py.set(ny * 6)
    }

    const onLeave = () => {
      px.set(0)
      py.set(0)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [active, reduced, present, mode, px, py])

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      data-fit={fit}
      data-cutout={cutout || undefined}
      data-active={active || undefined}
      data-ready={ready || undefined}
      data-camera={reduced ? 'hold' : camera}
      data-mode={mode}
    >
      <div className={styles.perspective}>
        <motion.div
          className={styles.stage}
          style={{
            x: present || reduced ? 0 : px,
            y: present || reduced ? 0 : py,
          }}
        >
          {edges && (
            <div className={styles.edgeField} aria-hidden>
              <img src={edges.left} alt="" className={styles.edgeBleed} data-side="left" />
              <img src={edges.right} alt="" className={styles.edgeBleed} data-side="right" />
              <div className={styles.floorWash} />
            </div>
          )}
          <div className={styles.backPlate} aria-hidden>
            <img src={src} alt="" />
          </div>
          <div className={styles.midGlow} aria-hidden />
          <div className={styles.fore}>
            <img src={src} alt={alt} data-plate="" />
          </div>
          <div className={styles.sheen} aria-hidden />
          <div className={styles.vignette} aria-hidden />
        </motion.div>
      </div>
      {children}
    </div>
  )
}
