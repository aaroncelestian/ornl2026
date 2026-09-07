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
  }
}

export const VIBE_SYNTH: CubaneVibe = { hz: 1.05, amp: 1, disorder: 0, mute: 0 }
export const VIBE_HEX: CubaneVibe = { hz: 0.64, amp: 0.22, disorder: 1, mute: 0.72 }
export const VIBE_WORN: CubaneVibe = { hz: 0.88, amp: 0.55, disorder: 0.38, mute: 0.18 }
