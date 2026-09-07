export type SeriesPt = { t: number; w: number }

function median3(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[1] ?? s[0] ?? 0
}

/**
 * Median spike kill, then bilateral smooth.
 * Real edges (Li → 8a jump, breakup collapse) stay; fit chatter dies.
 * After `breakupT` the kernel widens — peak-picking after A₁g collapse is the artifact.
 */
export function smoothSeries(
  points: SeriesPt[],
  opts: { sigma?: number; range?: number; breakupT?: number; breakupSigma?: number } = {},
): SeriesPt[] {
  if (points.length < 3) return points.map((p) => ({ ...p }))
  const sigma = opts.sigma ?? 1.0
  const range = opts.range ?? 2.4
  const breakupT = opts.breakupT ?? 30
  const breakupSigma = opts.breakupSigma ?? 2.2

  const cleaned = points.map((p, i) => {
    const lo = points[Math.max(0, i - 1)].w
    const mid = p.w
    const hi = points[Math.min(points.length - 1, i + 1)].w
    return { t: p.t, w: median3([lo, mid, hi]) }
  })

  return cleaned.map((p) => {
    const late = p.t >= breakupT
    const s = late ? breakupSigma : sigma
    const r = late ? range * 3.2 : range
    let num = 0
    let den = 0
    for (const q of cleaned) {
      const dt = q.t - p.t
      const dw = q.w - p.w
      const k = Math.exp(-(dt * dt) / (2 * s * s)) * Math.exp(-(dw * dw) / (2 * r * r))
      num += q.w * k
      den += k
    }
    return { t: p.t, w: num / Math.max(1e-9, den) }
  })
}

export function atTime(points: SeriesPt[], t: number): number {
  if (!points.length) return 0
  if (t <= points[0].t) return points[0].w
  const last = points[points.length - 1]
  if (t >= last.t) return last.w
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return a.w + f * (b.w - a.w)
    }
  }
  return last.w
}

export type CubaneVibe = {
  hz: number
  amp: number
  disorder: number
  mute: number
  /** 0–1: Mn pairs leave the single A₁g breathe (split / F₂g). */
  split: number
}

export function vibeFromTrace(w: number, fwhm: number): CubaneVibe {
  const hz = 0.72 + ((w - 632) / 34) * 0.7
  const narrow = Math.max(0, Math.min(1, (22 - fwhm) / 14))
  const wide = Math.max(0, Math.min(1, (fwhm - 16) / 30))
  const collapsed = Math.max(0, Math.min(1, (fwhm - 36) / 18))
  return {
    hz: Math.max(0.55, Math.min(1.5, hz)),
    amp: 0.22 + 0.78 * (1 - collapsed) * (0.4 + 0.6 * narrow),
    disorder: wide,
    mute: collapsed * 0.78,
    split: collapsed * 0.85 + wide * 0.25,
  }
}

export const VIBE_SYNTH: CubaneVibe = { hz: 1.05, amp: 1, disorder: 0, mute: 0, split: 0 }
export const VIBE_HEX: CubaneVibe = { hz: 0.64, amp: 0.22, disorder: 1, mute: 0.72, split: 0 }
export const VIBE_WORN: CubaneVibe = { hz: 0.88, amp: 0.55, disorder: 0.38, mute: 0.18, split: 0.2 }

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function smoothstep(a: number, b: number, x: number) {
  const u = clamp01((x - a) / Math.max(1e-6, b - a))
  return u * u * (3 - 2 * u)
}

export type ExchangeStage = 'h-form' | 'li-8a' | 'split' | 'stable'

export type RamanBand = {
  w: number
  h: number
  sig: number
  label: string
  kind: 'a1g' | 'split' | 'f2g'
}

export type ExchangeStatus = {
  id: ExchangeStage
  li: number
  vibe: CubaneVibe
  bands: RamanBand[]
  title: string
  cubane: string
}

const STAGE_COPY: Record<ExchangeStage, { title: string; cubane: string }> = {
  'h-form': {
    title: 'H-form',
    cubane: 'OH mutes Mn–O. Cubane is still there — it just cannot breathe as one.',
  },
  'li-8a': {
    title: 'Li → 8a',
    cubane: 'Li in tetrahedral 8a restores a coherent A₁g. The cubane breathes again, stiffer.',
  },
  split: {
    title: 'A₁g splits · F₂g on',
    cubane: 'Local Oh breaks. Four Mn–O environments are no longer equivalent — not dissolving.',
  },
  stable: {
    title: 'Weak · stable',
    cubane: 'Cubane reorders as a weaker Li-occupied oscillator. Rewritten, not gone.',
  },
}

/**
 * licl2-1 clock: H-form at t=0, Li lands in 8a by ~3 min,
 * A₁g dip / split / F₂g near 23–32 min, then a weak settled pattern.
 */
export function exchangeStatus(t: number, w: number, fwhm: number): ExchangeStatus {
  const toLi = smoothstep(0.5, 3.4, t)
  const intoDip = smoothstep(21.5, 26.5, t)
  const midDip = smoothstep(24, 30, t)
  const recover = smoothstep(33, 44, t)

  const li = clamp01(0.05 + 0.4 * toLi + 0.22 * smoothstep(4, 21, t) + 0.25 * intoDip + 0.08 * recover)

  const id: ExchangeStage =
    recover > 0.55 ? 'stable' : midDip > 0.38 ? 'split' : toLi > 0.5 ? 'li-8a' : 'h-form'

  const hzLive = Math.max(0.55, Math.min(1.5, 0.72 + ((w - 632) / 34) * 0.7))
  const vibe: CubaneVibe = {
    hz: hzLive,
    amp: clamp01(0.18 + 0.82 * toLi * (1 - 0.72 * midDip) + 0.36 * recover),
    disorder: clamp01((1 - toLi) * 0.95 + midDip * 0.88 * (1 - recover) + recover * 0.28),
    mute: clamp01((1 - toLi) * 0.74 + midDip * 0.42 * (1 - recover) + recover * 0.16),
    split: clamp01(midDip * 0.95 * (1 - 0.45 * recover) + recover * 0.36),
  }

  const a1gAmp = (0.16 + 0.84 * toLi) * (1 - 0.82 * midDip) + recover * 0.34
  const splitAmp = midDip * 0.58 * (1 - 0.3 * recover) + recover * 0.2
  const f2gAmp = 0.05 + 0.06 * toLi + midDip * 0.62 * (1 - recover) + recover * 0.32
  const wide = Math.max(7, fwhm * 0.42)

  const bands: RamanBand[] = [
    { w: 578, h: f2gAmp, sig: 7 + midDip * 3, label: 'F₂g', kind: 'f2g' },
    { w: 616 + recover * 3, h: splitAmp, sig: 8 + midDip * 5, label: 'A₁g′', kind: 'split' },
    { w, h: a1gAmp, sig: wide, label: 'A₁g', kind: 'a1g' },
  ]

  return { id, li, vibe, bands, ...STAGE_COPY[id] }
}

export const EXCHANGE_STEPS: { id: ExchangeStage; label: string }[] = [
  { id: 'h-form', label: 'H-form' },
  { id: 'li-8a', label: 'Li → 8a' },
  { id: 'split', label: 'A₁g split · F₂g' },
  { id: 'stable', label: 'Weak · stable' },
]
