/**
 * Capture 16:9 screenshots of every script beat for the print / speaker view.
 *
 * Usage (dev server must be running on 5173):
 *   npm run previews
 *
 * Writes:
 *   public/previews/beat-000.png …
 *   public/previews/manifest.json
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = path.dirname(fileURLToPath(import.meta.url))
const project = path.resolve(root, '..')
const outDir = path.join(project, 'public', 'previews')
const base = process.env.CAPTURE_URL ?? 'http://127.0.0.1:5173'
const width = Number(process.env.CAPTURE_WIDTH ?? 1600)
const height = Number(process.env.CAPTURE_HEIGHT ?? 900)

const browsers = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

function chromePath() {
  return browsers.find(existsSync)
}

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 304) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Dev server not reachable at ${url}`)
}

async function main() {
  await waitForServer(base)
  await mkdir(outDir, { recursive: true })

  const executablePath = chromePath()
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : { channel: 'chrome' }),
  })

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  })

  await page.goto(`${base}/?capture=1&beat=0`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => typeof window.__ornlBeatCount === 'number')
  const total = await page.evaluate(() => window.__ornlBeatCount)
  if (!total || total < 1) throw new Error('No beats exposed on window.__ornlBeatCount')

  console.log(`Capturing ${total} beats at ${width}×${height} → ${outDir}`)
  const files = []

  for (let i = 0; i < total; i++) {
    const name = `beat-${String(i).padStart(3, '0')}.png`
    const dest = path.join(outDir, name)
    await page.goto(`${base}/?capture=1&beat=${i}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__ornlCaptureReady === true, null, {
      timeout: 20000,
    })
    // One extra frame for WebGL / lazy motifs
    await page.waitForTimeout(350)
    const shell = page.locator('#deck')
    await shell.screenshot({ path: dest, type: 'png' })
    files.push(name)
    process.stdout.write(`  ${i + 1}/${total} ${name}\n`)
  }

  const manifest = {
    generated: new Date().toISOString(),
    width,
    height,
    count: files.length,
    files,
  }
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(
    path.join(project, 'src', 'data', 'slidePreviews.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )
  await browser.close()
  console.log(`Done. ${files.length} previews + manifest.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
