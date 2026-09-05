import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { build } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'offline', 'Celestian_ORNL2026')
const zipPath = join(root, 'offline', 'Celestian_ORNL2026.zip')

process.env.OFFLINE = '1'

await build({
  root,
  configFile: join(root, 'vite.config.ts'),
  build: { outDir, emptyOutDir: true },
})

const indexPath = join(outDir, 'index.html')
let html = readFileSync(indexPath, 'utf8')

html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '')

const cssHrefs = []
html = html.replace(
  /<link[^>]*rel="stylesheet"[^>]*href="(\.\/assets\/[^"]+\.css)"[^>]*>\s*/g,
  (_, href) => {
    cssHrefs.push(href)
    return ''
  },
)

let script = ''
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>\s*/g, (_, src) => {
  const abs = join(outDir, src.replace(/^\.\//, ''))
  const code = readFileSync(abs, 'utf8').replace(/<\/script/gi, '<\\/script')
  try {
    unlinkSync(abs)
  } catch {
    // keep going if the file is already gone
  }
  script = `<script type="module">${code}</script>`
  return ''
})

html = html.replace(/ crossorigin(="[^"]*")?/g, '')

if (cssHrefs.length) {
  const tags = cssHrefs.map((href) => `    <link rel="stylesheet" href="${href}">`).join('\n')
  html = html.replace('</title>', `</title>\n${tags}`)
}

if (script) {
  html = html.replace('</body>', `    ${script}\n  </body>`)
}

writeFileSync(indexPath, html)
writeFileSync(join(outDir, 'Celestian_ORNL2026.html'), html)

const assetsDir = join(outDir, 'assets')
if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir)) {
    if (name.endsWith('.js') || name.endsWith('.js.map')) unlinkSync(join(assetsDir, name))
  }
}

writeFileSync(
  join(outDir, '00-README.txt'),
  `Celestian — ORNL 2026
Museum Collections as Blueprints for Engineered Materials

HOW TO OPEN
1. Keep this whole folder together. Do not move the HTML file out of it.
2. Double-click  Celestian_ORNL2026.html
3. If asked which app: Chrome, Edge, Firefox, or Safari. Chrome is best.
4. Fullscreen: F11 (Windows) or Ctrl-Cmd-F (Mac). Or press Shift+F in the talk.

This is a browser talk, not PowerPoint. It does not need the internet.

If the screen stays black, open the same file in Google Chrome.

Arrow keys or space = next beat.  P = stage window for Zoom share.
H = Lokelma H/K exchange animation (on structure beats).

Aaron Celestian  ·  NHMLAC  ·  Oak Ridge invited talk
`,
)

mkdirSync(join(root, 'offline'), { recursive: true })
const zip = spawnSync(
  'zip',
  ['-r', '-X', zipPath, 'Celestian_ORNL2026', '-x', '*.DS_Store', '-x', '*__MACOSX*'],
  { cwd: join(root, 'offline'), stdio: 'inherit' },
)
if (zip.status !== 0) {
  console.error('Zip failed; the folder is still at', outDir)
  process.exit(zip.status ?? 1)
}

console.log('\nOffline talk:')
console.log('  folder  ', outDir)
console.log('  zip     ', zipPath)
console.log('\nUpload the zip, or the folder. Double-click Celestian_ORNL2026.html')
