import { useEffect, useRef, useState, useCallback } from 'react'

export function useActiveSlide(
  count: number,
  interceptRef?: { current: ((from: number, to: number) => boolean) | null },
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  const setIndex = useCallback((index: number) => {
    activeIndexRef.current = index
    setActiveIndex(index)
  }, [])

  const goTo = useCallback(
    (index: number, _behavior?: ScrollBehavior, force = false) => {
      const clamped = Math.max(0, Math.min(count - 1, index))
      if (!force && interceptRef?.current?.(activeIndexRef.current, clamped)) return
      setIndex(clamped)
    },
    [count, setIndex, interceptRef],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        (e.target as HTMLElement)?.isContentEditable
      if (editable) return
      if (document.documentElement.hasAttribute('data-resource')) return

      const current = activeIndexRef.current

      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        goTo(current + 1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        goTo(current - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        goTo(0, 'auto', true)
      } else if (e.key === 'End') {
        e.preventDefault()
        goTo(count - 1, 'auto', true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, goTo])

  useEffect(() => {
    const EDGE = 56
    const THRESH = 64
    let tracking = false
    let pointerId = 0
    let startX = 0
    let startY = 0

    const chrome = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      return Boolean(
        target.closest(
          'button, a, input, textarea, select, [role="listbox"], [role="menu"], aside',
        ),
      )
    }

    const fromEdge = (x: number) => x <= EDGE || x >= window.innerWidth - EDGE

    const ignore = (target: EventTarget | null, x: number) => {
      if (chrome(target)) return true
      if (fromEdge(x)) return false
      return target instanceof Element && Boolean(target.closest('canvas'))
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      if (e.isPrimary === false) return
      if (document.documentElement.hasAttribute('data-resource')) return
      if (ignore(e.target, e.clientX)) return
      tracking = true
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      if (
        fromEdge(e.clientX) &&
        e.target instanceof Element &&
        e.target.closest('canvas')
      ) {
        e.stopPropagation()
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return
      tracking = false
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (ax < THRESH || ax < ay * 1.35) return
      const swallow = (ev: Event) => {
        ev.preventDefault()
        ev.stopPropagation()
      }
      window.addEventListener('click', swallow, true)
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 500)
      goTo(activeIndexRef.current + (dx < 0 ? 1 : -1))
    }

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) tracking = false
    }

    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
    }
  }, [goTo])

  return { containerRef, activeIndex, goTo }
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReduced(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}
