import { printUrl } from './asset'
import {
  SCRIPT_TITLE,
  beatPreview,
  chapterTitle,
  scriptBeats,
  scriptMarkdown,
} from './script'

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
  .doc { max-width: 820px; margin: 0 auto; padding: 48px 28px 96px; }
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
  .lede { color: #564f48; margin: 0 0 10px; max-width: 42em; }
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
    margin: 0 0 32px;
    padding: 0 0 28px;
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
  .grid { display: grid; grid-template-columns: 1fr 1.35fr; gap: 28px; }
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
  figure { margin: 0 0 12px; }
  img {
    display: block;
    width: 100%;
    max-height: 160px;
    object-fit: contain;
    object-position: left center;
  }
  @media (max-width: 700px) {
    .grid { grid-template-columns: 1fr; }
    .doc { padding: 32px 18px 72px; }
  }
  @page { size: letter; margin: 0.6in; }
  @media print {
    html, body { background: #fff; color: #1a1815; }
    .toolbar { display: none !important; }
    .doc { max-width: none; padding: 0; }
    img { max-height: 120px; }
    .beat { break-inside: avoid; page-break-inside: avoid; }
  }
`

export function printDocumentHtml() {
  const beats = scriptBeats()
  const parts: string[] = []
  let lastChapter = ''

  for (const beat of beats) {
    if (beat.chapter !== lastChapter) {
      parts.push(`<h2 class="chapter">${esc(chapterTitle(beat.chapter))}</h2>`)
      lastChapter = beat.chapter
    }
    const title = beat.sceneLabel
      ? `${beat.slide.label} · ${beat.sceneLabel}`
      : beat.slide.label
    const preview = beatPreview(beat)
    parts.push(`<section class="beat">`)
    parts.push(`<h3><span class="num">${beat.index + 1}</span>${esc(title)}</h3>`)
    parts.push(`<div class="grid"><div><h4>On screen</h4>`)
    if (preview) {
      const alt = beat.notes || preview.alt
      parts.push(
        `<figure><img src="${esc(absUrl(preview.src))}" alt="${esc(alt)}"></figure>`,
      )
    }
    parts.push('<ul>')
    for (const line of beat.onScreen) parts.push(`<li>${esc(line)}</li>`)
    parts.push('</ul></div>')
    if (beat.notes) {
      const noteHtml = esc(beat.notes).replace(/\n/g, '<br>')
      parts.push(`<div><p>${noteHtml}</p></div>`)
    }
    parts.push('</div></section>')
  }

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
      <p class="lede">Speaker script. Each beat lists what is on the projection, then a short description of what is said.</p>
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
