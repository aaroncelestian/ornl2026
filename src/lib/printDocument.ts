import { asset, printUrl } from './asset'
import previewManifestJson from '../data/slidePreviews.json'
import {
  SCRIPT_TITLE,
  chapterTitle,
  previewPath,
  scriptBeats,
  scriptMarkdown,
  type ScriptBeat,
} from './script'

type PreviewManifest = {
  files?: string[]
  count?: number
  generated?: string | null
}

const previewManifest = previewManifestJson as PreviewManifest

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function absUrl(src: string) {
  try {
    return new URL(src, window.location.href).href
  } catch {
    return src
  }
}

function homeUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('print')
  url.searchParams.delete('present')
  return url.toString()
}

function motifLabel(motif?: string) {
  if (!motif) return ''
  return motif
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function slideCardHtml(beat: ScriptBeat, hasShot: boolean) {
  const { card } = beat
  const img = card.image
  const shotSrc = hasShot ? absUrl(asset(previewPath(beat.index))) : null
  const parts: string[] = [
    `<figure class="slideCard" data-layout="${esc(card.layout)}">`,
    `<div class="slideFrame">`,
  ]

  if (shotSrc) {
    parts.push(
      `<img class="slideMedia slideShot" src="${esc(shotSrc)}" alt="${esc(card.title || beat.slide.label)}">`,
    )
  } else if (img) {
    parts.push(
      `<img class="slideMedia" src="${esc(absUrl(img.src))}" alt="${esc(img.alt || card.title || '')}">`,
    )
  } else {
    parts.push(`<div class="slideWash" aria-hidden="true"></div>`)
  }

  if (!shotSrc) {
    if (card.motif) {
      parts.push(`<div class="slideMotif">${esc(motifLabel(card.motif))}</div>`)
    }
    parts.push(`<div class="slideOverlay">`)
    if (card.brand) parts.push(`<div class="slideBrand">${esc(card.brand)}</div>`)
    if (card.kicker) parts.push(`<div class="slideKicker">${esc(card.kicker)}</div>`)
    if (card.title) parts.push(`<div class="slideTitle">${esc(card.title)}</div>`)
    if (card.subtitle) parts.push(`<div class="slideSub">${esc(card.subtitle)}</div>`)
    if (!card.title && !card.kicker && !img) {
      parts.push(`<div class="slideTitle">${esc(beat.slide.label)}</div>`)
    }
    parts.push(`</div>`)
  }

  parts.push(`</div>`)
  parts.push(
    `<figcaption class="slideCap">${esc(card.layout)}${card.motif ? ` · ${esc(motifLabel(card.motif))}` : ''}${shotSrc ? ' · capture' : ''}</figcaption>`,
  )
  parts.push(`</figure>`)
  return parts.join('')
}

const PRINT_CSS = `
  :root { color-scheme: light only; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #f4efe6;
    color: #1a1815;
    font-family: "Instrument Sans", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.5;
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: #f4efe6;
    border-bottom: 1px solid rgba(26, 24, 21, 0.12);
  }
  .actions { display: flex; gap: 8px; }
  button {
    font: 600 12px/1 "Instrument Sans", system-ui, sans-serif;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #1a1815;
    background: #fff;
    border: 1px solid rgba(26, 24, 21, 0.18);
    padding: 7px 12px;
    cursor: pointer;
  }
  button:hover { border-color: #c4893a; color: #8a5a1a; }
  .doc { max-width: 920px; margin: 0 auto; padding: 48px 28px 96px; }
  .masthead {
    margin-bottom: 48px;
    padding-bottom: 28px;
    border-bottom: 1px solid rgba(26, 24, 21, 0.14);
  }
  .brand {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #8a5a1a;
    margin: 0 0 16px;
  }
  h1 {
    font-family: "Source Serif 4", "Times New Roman", serif;
    font-size: clamp(2rem, 5vw, 3.1rem);
    line-height: 1.08;
    margin: 0 0 16px;
  }
  .lede { color: #564f48; margin: 0 0 10px; max-width: 46em; }
  .chapter {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8a5a1a;
    margin: 40px 0 18px;
  }
  .beat {
    break-inside: avoid;
    page-break-inside: avoid;
    margin: 0 0 36px;
    padding: 0 0 32px;
    border-bottom: 1px solid rgba(26, 24, 21, 0.1);
  }
  h3 {
    font-family: "Source Serif 4", "Times New Roman", serif;
    font-size: 1.45rem;
    letter-spacing: -0.02em;
    margin: 0 0 16px;
  }
  .num {
    display: inline-block;
    min-width: 2.1em;
    margin-right: 8px;
    font-family: "Instrument Sans", system-ui, sans-serif;
    font-size: 0.72em;
    font-weight: 600;
    color: #958e83;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(220px, 0.95fr) 1.25fr;
    gap: 24px;
    align-items: start;
  }
  h4 {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #958e83;
    margin: 0 0 10px;
  }
  p, li { font-size: 15px; line-height: 1.55; color: #24211c; }
  ul { margin: 0; padding: 0; list-style: none; }
  li + li { margin-top: 4px; }

  .slideCard { margin: 0 0 14px; }
  .slideFrame {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #070605;
    border: 1px solid rgba(26, 24, 21, 0.2);
    box-shadow: 0 10px 28px rgba(26, 24, 21, 0.12);
  }
  .slideMedia {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    background: #070605;
  }
  .slideShot {
    object-fit: cover;
  }
  .slideWash {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 60% at 55% 45%, rgba(212,160,74,0.18), transparent 70%),
      linear-gradient(135deg, #12100d 0%, #070605 55%, #1a1410 100%);
  }
  .slideFrame::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(105deg, rgba(7,6,5,0.82) 0%, rgba(7,6,5,0.35) 42%, transparent 72%),
      linear-gradient(180deg, transparent 55%, rgba(7,6,5,0.55) 100%);
  }
  .slideMotif {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    padding: 4px 8px;
    border: 1px solid rgba(243,238,228,0.22);
    background: rgba(7,6,5,0.55);
    color: rgba(243,238,228,0.78);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .slideOverlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    padding: 14px 16px 12px;
    color: #f3eee4;
  }
  .slideBrand {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #d4a04a;
    margin-bottom: 6px;
  }
  .slideKicker {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #d4a04a;
    margin-bottom: 6px;
  }
  .slideTitle {
    font-family: "Source Serif 4", "Times New Roman", serif;
    font-size: clamp(0.95rem, 1.8vw, 1.25rem);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 12px rgba(0,0,0,0.55);
  }
  .slideSub {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.35;
    color: rgba(243,238,228,0.72);
  }
  .slideCap {
    margin-top: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #958e83;
  }
  .slideCard[data-layout="void"] .slideFrame::after,
  .slideCard[data-layout="divider"] .slideFrame::after {
    background: radial-gradient(ellipse 70% 55% at 50% 50%, rgba(7,6,5,0.15), rgba(7,6,5,0.55));
  }
  .slideCard[data-layout="void"] .slideOverlay,
  .slideCard[data-layout="divider"] .slideOverlay {
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 18px;
  }
  .slideCard[data-layout="void"] .slideTitle,
  .slideCard[data-layout="divider"] .slideTitle {
    font-style: italic;
    font-size: clamp(1.05rem, 2vw, 1.4rem);
  }

  .notesCol p { margin: 0; }
  .screenList { margin-top: 4px; }

  @media (max-width: 700px) {
    .grid { grid-template-columns: 1fr; }
    .doc { padding: 32px 18px 72px; }
  }
  @page { size: letter; margin: 0.55in; }
  @media print {
    html, body { background: #fff; color: #1a1815; }
    .toolbar { display: none !important; }
    .doc { max-width: none; padding: 0; }
    .slideFrame {
      box-shadow: none;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .beat { break-inside: avoid; page-break-inside: avoid; }
  }
`

export function printDocumentHtml() {
  const beats = scriptBeats()
  const parts: string[] = []
  let lastChapter = ''
  const shotSet = loadPreviewSet()

  for (const beat of beats) {
    if (beat.chapter !== lastChapter) {
      parts.push(`<h2 class="chapter">${esc(chapterTitle(beat.chapter))}</h2>`)
      lastChapter = beat.chapter
    }
    const title = beat.sceneLabel
      ? `${beat.slide.label} · ${beat.sceneLabel}`
      : beat.slide.label
    const hasShot = shotSet.has(previewPath(beat.index).split('/').pop()!)
    parts.push(`<section class="beat">`)
    parts.push(`<h3><span class="num">${beat.index + 1}</span>${esc(title)}</h3>`)
    parts.push(`<div class="grid">`)
    parts.push(`<div>${slideCardHtml(beat, hasShot)}`)
    parts.push(`<h4>On screen</h4><ul class="screenList">`)
    for (const line of beat.onScreen) parts.push(`<li>${esc(line)}</li>`)
    parts.push(`</ul></div>`)
    if (beat.notes) {
      const noteHtml = esc(beat.notes).replace(/\n/g, '<br>')
      parts.push(`<div class="notesCol"><h4>Say</h4><p>${noteHtml}</p></div>`)
    }
    parts.push(`</div></section>`)
  }

  const missing = beats.length - shotSet.size
  const lede =
    shotSet.size > 0
      ? `Speaker script with captured slide previews (${shotSet.size} of ${beats.length} beats).${missing > 0 ? ` Run npm run previews to refresh missing captures.` : ''}`
      : 'Speaker script. Slide captures are missing — with the deck running, run npm run previews, then reopen this view.'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light only">
  <meta name="theme-color" content="#ffffff">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(SCRIPT_TITLE)} — speaker script</title>
  <link rel="stylesheet" href="./fonts/fonts.css">
  <style>${PRINT_CSS}</style>
</head>
<body>
  <header class="toolbar">
    <button type="button" id="back-btn">Back</button>
    <div class="actions">
      <button type="button" id="copy-btn">Copy</button>
      <button type="button" id="print-btn">Print / PDF</button>
    </div>
  </header>
  <article class="doc">
    <header class="masthead">
      <p class="brand">NHMLAC</p>
      <h1>${esc(SCRIPT_TITLE)}</h1>
      <p class="lede">${esc(lede)}</p>
    </header>
    ${parts.join('\n')}
  </article>
  <script>
    const HOME = ${JSON.stringify(homeUrl())};
    const SCRIPT = ${JSON.stringify(scriptMarkdown())};
    document.getElementById('back-btn').addEventListener('click', () => {
      if (window.opener && !window.opener.closed) window.close();
      else location.replace(HOME);
    });
    document.getElementById('copy-btn').addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      try {
        await navigator.clipboard.writeText(SCRIPT);
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      } catch {}
    });
    document.getElementById('print-btn').addEventListener('click', () => window.print());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (window.opener && !window.opener.closed) window.close();
        else location.replace(HOME);
      }
    });
  </script>
</body>
</html>`
}

function loadPreviewSet() {
  return new Set<string>(previewManifest.files ?? [])
}

/** Open a standalone script document that cannot inherit the deck's dark CSS. */
export function writePrintDocument(win: Window) {
  win.document.open()
  win.document.write(printDocumentHtml())
  win.document.close()
  win.focus()
}

/** Opens the speaker script — copy for an AI, or print / save as PDF. */
export function openPrintView() {
  const win = window.open('', 'dallas-print')
  if (win) {
    writePrintDocument(win)
    return win
  }
  window.location.assign(printUrl())
  return null
}
