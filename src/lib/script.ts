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
}

export function chapterTitle(id: ChapterId) {
  return CHAPTER_HEAD[id]
}

/** Spoken notes are the accessible description for whatever is on screen. */
export function spokenAlt(slide: Slide, beat?: Pick<SceneBeat, 'notes'> | null): string {
  return (beat?.notes ?? slide.notes ?? '').trim()
}

export function beatPreview(beat: ScriptBeat): { src: string; alt: string } | null {
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
    return 'Motif: hydrated ion diameters versus ~3 Å pore gate'
  }
  if (slide.motif === 'framework-lineage') {
    return 'Motif: natural → synthetic framework lineage'
  }
  if (slide.motif === 'void-fit') {
    return 'Motif: chemotherapeutic volumes versus rowleyite cage volume'
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
        lines.push('Motif: pore gate — hydrated diameters versus ~3 Å K⁺-selective window')
      }
      if (layer?.kind === 'motif' && layer.motif === 'framework-lineage') {
        lines.push(
          beat?.id === 'zs9' || beat?.id === 'patients'
            ? 'Motif: framework lineage — ZS-9 / Lokelma highlighted'
            : beat?.id === 'converge'
              ? 'Motif: framework lineage — convergent natural → synthetic paths'
              : 'Motif: framework lineage — georgechaoite, umbite, sitinakite',
        )
      }
      if (layer?.kind === 'motif' && layer.motif === 'void-fit') {
        lines.push('Motif: void fit — guest molecular volumes versus rowleyite cage volume')
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
        })
      }
    } else {
      beats.push({
        index: index++,
        slide,
        chapter: slide.chapter,
        onScreen: onScreenLines(slide),
        notes: slide.notes,
      })
    }
  }
  return beats
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
