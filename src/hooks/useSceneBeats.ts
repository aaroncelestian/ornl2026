import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { SceneBeat, Slide } from '../data/slides'

export interface SceneController {
  hasScene: boolean
  index: number
  total: number
  beat?: SceneBeat
  atStart: boolean
  atEnd: boolean
  next: () => boolean
  prev: () => boolean
  go: (index: number) => void
}

const empty: SceneController = {
  hasScene: false,
  index: 0,
  total: 0,
  atStart: true,
  atEnd: true,
  next: () => false,
  prev: () => false,
  go: () => {},
}

const SceneContext = createContext<SceneController>(empty)

export function useScene() {
  return useContext(SceneContext)
}

export function useSceneController(slide: Slide): SceneController {
  const beats = slide.scene
  const [index, setIndex] = useState(0)
  const [slideId, setSlideId] = useState(slide.id)

  if (slide.id !== slideId) {
    setSlideId(slide.id)
    setIndex(0)
  }

  const total = beats?.length ?? 0
  const clamped = total === 0 ? 0 : Math.min(index, total - 1)
  const atStart = clamped <= 0
  const atEnd = total === 0 || clamped >= total - 1

  const next = useCallback(() => {
    if (!beats?.length || clamped >= beats.length - 1) return false
    setIndex(clamped + 1)
    return true
  }, [beats, clamped])

  const prev = useCallback(() => {
    if (!beats?.length || clamped <= 0) return false
    setIndex(clamped - 1)
    return true
  }, [beats, clamped])

  const go = useCallback(
    (nextIndex: number) => {
      if (!beats?.length) return
      setIndex(Math.max(0, Math.min(beats.length - 1, nextIndex)))
    },
    [beats],
  )

  return useMemo(
    () => ({
      hasScene: Boolean(beats?.length),
      index: clamped,
      total,
      beat: beats?.[clamped],
      atStart,
      atEnd,
      next,
      prev,
      go,
    }),
    [atEnd, atStart, beats, clamped, go, next, prev, total],
  )
}

export const SceneProvider = SceneContext.Provider
