import { slides, type ChapterId, type SceneBeat, type Slide } from '../data/slides'
import { PREP_MODES } from '../data/prepModes'

export const SCRIPT_TITLE = 'Museum Collections as Blueprints for Engineered Materials'

const CHAPTER_HEAD: Record<ChapterId, string> = {
  open: 'Open',
  spinel: '01  Spinel → DLE',
  lokelma: '02  Convergent pores',
  rowleyite: '03  Rowleyite',
  pipeline: '04  Pipeline',
  close: '05  Ask',
}

export interface ScriptBeat {
  index: number
  slide: Slide
  chapter: ChapterId
  onScreen: string[]
  notes?: string
  sceneLabel?: string
  /** Visual card for the print / script preview. */
  card: {
    layout: string
    kicker?: string
    title?: string
    subtitle?: string
    brand?: string
    motif?: string
    image?: { src: string; alt: string }
  }
}

export function chapterTitle(id: ChapterId) {
  return CHAPTER_HEAD[id]
}

/** Spoken notes are the accessible description for whatever is on screen. */
export function spokenAlt(slide: Slide, beat?: Pick<SceneBeat, 'notes'> | null): string {
  return (beat?.notes ?? slide.notes ?? '').trim()
}

export function beatPreview(beat: ScriptBeat): { src: string; alt: string } | null {
  if (beat.card.image) return beat.card.image
  const layer = beat.slide.layers?.find(
    (item) =>
      (item.kind === 'image' || item.kind === 'video' || item.kind === 'slideshow') &&
      (item.poster || item.src || item.slides?.[0]?.src) &&
      (!beat.sceneLabel ||
        beat.slide.scene
          ?.find((scene) => scene.label === beat.sceneLabel)
          ?.layers?.includes(item.id)),
  )
  const src =
    (layer?.kind === 'video'
      ? layer.poster
      : layer?.kind === 'slideshow'
        ? layer.slides?.[0]?.src
        : layer?.src) ?? beat.slide.image?.src
  if (!src) return null
  const alt =
    beat.notes ||
    layer?.slides?.[0]?.alt ||
    layer?.alt ||
    beat.slide.image?.alt ||
    ''
  return { src, alt }
}

function activeMotif(slide: Slide, beat?: SceneBeat): string | undefined {
  if (beat?.layers && slide.layers) {
    for (const id of beat.layers) {
      const layer = slide.layers.find((item) => item.id === id)
      if (layer?.kind === 'motif' && layer.motif) return layer.motif
    }
  }
  return slide.motif
}

function activeImage(
  slide: Slide,
  beat?: SceneBeat,
): { src: string; alt: string } | undefined {
  if (beat?.layers && slide.layers) {
    for (const id of beat.layers) {
      const layer = slide.layers.find((item) => item.id === id)
      if (!layer) continue
      if (layer.kind === 'image' && layer.src) {
        return { src: layer.src, alt: layer.alt || '' }
      }
      if (layer.kind === 'video' && (layer.poster || layer.src)) {
        return { src: layer.poster || layer.src!, alt: layer.alt || '' }
      }
      if (layer.kind === 'slideshow' && layer.slides?.[0]?.src) {
        return { src: layer.slides[0].src, alt: layer.slides[0].alt }
      }
    }
  }
  if (slide.image?.src) return { src: slide.image.src, alt: slide.image.alt }
  return undefined
}

function beatCard(slide: Slide, beat?: SceneBeat): ScriptBeat['card'] {
  const title = (beat?.title ?? slide.displayTitle ?? slide.title)?.replace(/\n/g, ' ')
  const fallbackLayer = slide.layers?.find((l) => l.kind === 'image' && l.src)
  const image =
    activeImage(slide, beat) ??
    (slide.image?.src
      ? { src: slide.image.src, alt: slide.image.alt }
      : fallbackLayer?.src
        ? { src: fallbackLayer.src, alt: fallbackLayer.alt || '' }
        : undefined)
  return {
    layout: slide.layout,
    kicker: beat?.kicker ?? slide.kicker,
    title,
    subtitle: beat?.subtitle ?? slide.subtitle,
    brand: slide.brand,
    motif: activeMotif(slide, beat),
    image,
  }
}

function motifLine(slide: Slide): string | undefined {
  if (slide.motif === 'prep-modes') return undefined
  if (slide.motif === 'ion-chart') return 'Motif: ion-exchange chart'
  if (slide.motif === 'crystal-viewer') {
    return 'Motif: ZS-9 crystal structure — K⁺ in the channels (drag to orbit)'
  }
  if (slide.motif === 'void-viewer') {
    return 'Motif: Rowleyite void space — cages and channels, no atoms (drag to orbit)'
  }
  if (slide.motif === 'lithium-cycle') {
    return 'Motif: lithium ride — first-person on the loop, then pullback'
  }
  if (slide.motif === 'selectivity-plume') {
    return 'Motif: Li⁺ selectivity plume versus ionic radius'
  }
  if (slide.motif === 'pore-gate') {
    return 'Motif: hydrated ions sized against the ~3 Å aperture'
  }
  if (slide.motif === 'framework-lineage') {
    return 'Motif: OpenAlex literature mentions versus year'
  }
  if (slide.motif === 'void-fit') {
    return 'Motif: guest orbs sized against the rowleyite cage'
  }
  if (slide.motif === 'raman-exchange') {
    return 'Motif: LMO XRD vs Raman story — as-synth / H-blank / Li returns'
  }
  if (slide.motif === 'lmo-spinel') {
    return 'Motif: LiMn₂O₄ CIF — MnO₆ polyhedra and interstitial voids'
  }
  if (slide.motif === 'double-lever') {
    return 'Motif: CZS double-lever K⁺ exchange mechanism'
  }
  if (slide.motif === 'framework-density') {
    return 'Motif: porosity as luminous voids — rowleyite as the hero hole'
  }
  if (slide.motif === 'mineral-constellation') {
    return 'Motif: mineral constellation — perovskite zoom-out to cabinets'
  }
  if (slide.motif === 'crystal-viewer') {
    return 'Motif: ZS-9 structure from CIF — 7MR windows and exchange'
  }
  return undefined
}

export function onScreenLines(slide: Slide, beat?: SceneBeat): string[] {
  const lines: string[] = []
  if (slide.brand) lines.push(slide.brand)
  const kicker = beat?.kicker ?? slide.kicker
  const title = beat?.title ?? slide.title
  const subtitle = beat?.subtitle ?? slide.subtitle
  if (kicker) lines.push(kicker)
  if (slide.ghostNum) lines.push(slide.ghostNum)
  if (slide.heroNum) lines.push(slide.heroNum)
  if (slide.displayTitle) lines.push(slide.displayTitle.replace(/\n/g, ' '))
  if (title) lines.push(title.replace(/\n/g, ' '))
  if (subtitle) lines.push(subtitle)
  if (slide.promo) {
    if (slide.promo.kicker) lines.push(slide.promo.kicker)
    if (slide.promo.title) lines.push(slide.promo.title.replace(/\n/g, ' '))
    if (slide.promo.subtitle) lines.push(slide.promo.subtitle)
    if (slide.promo.credit) lines.push(slide.promo.credit)
  }
  if (slide.body) lines.push(slide.body)
  if (slide.quote) lines.push(`“${slide.quote}”`)
  if (slide.meta) lines.push(slide.meta)
  for (const bullet of slide.bullets ?? []) lines.push(`• ${bullet}`)
  for (const bullet of beat?.bullets ?? []) lines.push(`• ${bullet}`)
  if (beat?.layers && slide.layers) {
    for (const id of beat.layers) {
      const layer = slide.layers.find((item) => item.id === id)
      if (layer?.kind === 'slideshow' && layer.slides?.length) {
        for (const plate of layer.slides) lines.push(`Image: ${plate.alt}`)
      } else if (layer?.alt) {
        lines.push(layer.kind === 'video' ? `Video: ${layer.alt}` : `Image: ${layer.alt}`)
      }
      if (layer?.kind === 'motif' && layer.motif === 'crystal-viewer') {
        if (beat?.id === 'pore') {
          lines.push('Motif: ZS-9 — K fades, then the ~3 Å 7-ring pore (drag to orbit)')
        } else if (beat?.id === 'protons') {
          lines.push('Motif: ZS-9 — K removed, H pointing at the vacant site (H to step)')
        } else if (beat?.id === 'lock') {
          lines.push('Motif: ZS-9 — H bends and exchanges out; K locks in')
        } else if (beat?.id === 'patients') {
          lines.push('Motif: ZS-9 — K locked in the 7-ring (drag to orbit)')
        } else {
          lines.push('Motif: ZS-9 crystal structure — K⁺ in the channels (drag to orbit)')
        }
      }
      if (layer?.kind === 'motif' && layer.motif === 'void-viewer') {
        lines.push(
          beat?.guests
            ? 'Motif: Rowleyite void — doxorubicin, vincristine, cisplatin, temozolomide in the near-face cages (click a name to enter the cage)'
            : 'Motif: Rowleyite void space — cages and channels, no atoms (drag to orbit)',
        )
      }
      if (layer?.kind === 'motif' && layer.motif === 'prep-modes') {
        if (!beat || beat.id === 'question') {
          for (const mode of PREP_MODES) lines.push(`• ${mode.title} — ${mode.body}`)
        } else {
          const mode = PREP_MODES.find((item) => item.id === beat.id)
          if (mode) lines.push(`• ${mode.title} — ${mode.body}`)
        }
      }
      if (layer?.kind === 'motif' && layer.motif === 'lithium-cycle') {
        const cycle =
          beat?.id === 'brine'
            ? 'Motif: lithium ride — first-person at the brine; DNA double helix on the rail (Materials Genome)'
            : beat?.id === 'absorb'
              ? 'Motif: lithium ride — flying to LiMn₂O₄; cash the helix as Materials Genome'
              : beat?.id === 'air'
                ? 'Motif: lithium ride — arriving at CO₂; the wash falls in'
                : beat?.id === 'product'
                  ? 'Motif: lithium ride — flying to Li₂CO₃'
                  : beat?.id === 'award'
                    ? 'Motif: lithium ride — holding at Li₂CO₃'
                    : beat?.id === 'recycle'
                      ? 'Motif: lithium pullback — full loop and DNA wreath revealed; dashed CO₂ → brine return'
                      : 'Motif: lithium ride — first-person on the loop'
        lines.push(cycle)
      }
      if (layer?.kind === 'motif' && layer.motif === 'selectivity-plume') {
        lines.push(
          beat?.id === 'spinel-peak' || beat?.id === 'ions'
            ? 'Motif: selectivity plume — λ-MnO₂ highlighted against candidate sorbent cloud'
            : beat?.id === 'gate'
              ? 'Motif: selectivity plume — Li⁺ 0.76 Å gate'
              : 'Motif: selectivity plume — candidate sorbent cloud versus ionic radius',
        )
      }
      if (layer?.kind === 'motif' && layer.motif === 'pore-gate') {
        lines.push('Motif: ion aperture — hydrated spheres sized against the ~3 Å window')
      }
      if (layer?.kind === 'motif' && layer.motif === 'crystal-viewer') {
        lines.push(
          beat?.id === 'pore'
            ? 'Motif: ZS-9 CIF — 7-membered-ring windows lit'
            : beat?.id === 'protons'
              ? 'Motif: ZS-9 CIF — protons point into the empty site'
              : beat?.id === 'lock'
                ? 'Motif: ZS-9 CIF — H leaves; K locks'
                : beat?.id === 'patients'
                  ? 'Motif: ZS-9 CIF — K locked; geometry as drug'
                  : 'Motif: ZS-9 structure from CIF — drag to orbit',
        )
      }
      if (layer?.kind === 'motif' && layer.motif === 'framework-lineage') {
        lines.push(
          beat?.id === 'zs9' || beat?.id === 'patients'
            ? 'Motif: OpenAlex mentions/year — SZC / ZS-9 / Lokelma highlighted on shared axis'
            : beat?.id === 'converge'
              ? 'Motif: OpenAlex mentions/year — lumped industrials + mineral-only georgechaoite/umbite'
              : 'Motif: OpenAlex mentions/year — zorite/ETS-4 · sitinakite/CST/ETS-10 · georgechaoite · umbite · SZC/ZS-9/Lokelma',
        )
      }
      if (layer?.kind === 'motif' && layer.motif === 'void-fit') {
        lines.push('Motif: guest orbs sized against the rowleyite cage void')
      }
      if (layer?.kind === 'motif' && layer.motif === 'raman-exchange') {
        lines.push(
          beat?.id === 'durability'
            ? 'Motif: Raman — Mn loss vs cycle protocol (full load 24% vs partial ~0%)'
            : beat?.id === 'h-ex'
              ? 'Motif: XRD still good · Raman basically gone (H-exchange)'
              : beat?.id === 'li-return'
                ? 'Motif: Li returns — smoothed Fig 5 operando + cubane; drag the marker'
                : 'Motif: As-synthesized LMO — good XRD + good Raman · cubane inset',
        )
      }
      if (layer?.kind === 'motif' && layer.motif === 'lmo-spinel') {
        lines.push(
          beat?.id === 'voids'
            ? 'Motif: LMO 8a→16c channels — open tubes + ball-and-stick Mn/O (no cell-face wrapper)'
            : beat?.id === '8a'
              ? 'Motif: LMO — H in (A₁g broad, −20 cm⁻¹), then Li in 8a (A₁g up and sharp)'
              : beat?.id === 'cubane'
                ? 'Motif: LMO CIF — A₁g Mn₄O₄ cubane breathing'
                : 'Motif: LMO CIF — MnO₆ polyhedral framework',
        )
      }
      if (layer?.kind === 'motif' && layer.motif === 'framework-density') {
        lines.push(
          'Motif: porosity voids — rowleyite as the luminous hole · 12MR 9.7 Å / 4.1 Å',
        )
      }
      if (layer?.kind === 'motif' && layer.motif === 'mineral-constellation') {
        lines.push(
          beat?.id === 'peri'
            ? 'Motif: constellation — perovskite close-up; ferroelectrics · solar'
            : beat?.id === 'peers'
              ? 'Motif: constellation — peer minerals with application rays'
              : beat?.id === 'sky'
                ? 'Motif: night-sky constellation — ~100 crystals; drag to orbit, click to zoom'
                : beat?.id === 'cabinets'
                  ? 'Motif: 3D collection hall — cabinets with open drawers of specimens'
                  : beat?.id === 'instrument'
                    ? 'Motif: collection hall — cabinets as materials instrument'
                    : beat?.id === 'turn'
                      ? 'Motif: collection hall — one glowing drawer; next sorbent waiting'
                      : 'Motif: mineral night-sky constellation',
        )
      }
    }
  } else if (slide.image) {
    lines.push(`Image: ${slide.image.alt}`)
  }
  if (slide.motif === 'prep-modes') {
    for (const mode of PREP_MODES) lines.push(`• ${mode.title} — ${mode.body}`)
  } else {
    const motif = motifLine(slide)
    if (motif && !beat) lines.push(motif)
  }
  if (lines.length === 0) lines.push('(specimen only — no type)')
  return lines
}

export function scriptBeats(): ScriptBeat[] {
  const beats: ScriptBeat[] = []
  let index = 0
  for (const slide of slides) {
    if (slide.scene?.length) {
      for (const beat of slide.scene) {
        beats.push({
          index: index++,
          slide,
          chapter: slide.chapter,
          onScreen: onScreenLines(slide, beat),
          notes: beat.notes,
          sceneLabel: beat.label,
          card: beatCard(slide, beat),
        })
      }
    } else {
      beats.push({
        index: index++,
        slide,
        chapter: slide.chapter,
        onScreen: onScreenLines(slide),
        notes: slide.notes,
        card: beatCard(slide),
      })
    }
  }
  return beats
}

/** Flat script-beat index → slide index + in-scene beat index for deep links / capture. */
export function beatRoute(flatIndex: number): { slide: number; scene: number } | null {
  let cursor = 0
  for (let slide = 0; slide < slides.length; slide++) {
    const sceneCount = slides[slide].scene?.length ?? 0
    const span = Math.max(1, sceneCount)
    if (flatIndex < cursor + span) {
      return { slide, scene: sceneCount ? flatIndex - cursor : 0 }
    }
    cursor += span
  }
  return null
}

export function previewPath(beatIndex: number) {
  return `previews/beat-${String(beatIndex).padStart(3, '0')}.png`
}

export function scriptMarkdown(): string {
  const beats = scriptBeats()
  const parts = [
    `# ${SCRIPT_TITLE}`,
    '',
    'Speaker script. Each beat lists what is on the projection, then a short description of what is said.',
    '',
  ]

  let lastChapter: ChapterId | undefined
  for (const beat of beats) {
    if (beat.chapter !== lastChapter) {
      parts.push(`## ${chapterTitle(beat.chapter)}`, '')
      lastChapter = beat.chapter
    }
    const title = beat.sceneLabel
      ? `${beat.slide.label} · ${beat.sceneLabel}`
      : beat.slide.label
    parts.push(`### ${beat.index + 1}. ${title}`, '')
    parts.push('**On screen**', '')
    for (const line of beat.onScreen) parts.push(`- ${line}`)
    parts.push('')
    if (beat.notes) {
      parts.push(beat.notes, '')
    }
  }

  return parts.join('\n').trim() + '\n'
}
