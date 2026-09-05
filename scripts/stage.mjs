import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const url = process.env.PRESENT_URL ?? 'http://127.0.0.1:5173/?present=1'

const browsers = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

const chrome = browsers.find(existsSync)

if (!chrome) {
  console.error('No Chrome/Edge found. Open this URL in its own window:\n' + url)
  process.exit(1)
}

spawn(chrome, [`--app=${url}`], { detached: true, stdio: 'ignore' }).unref()
console.log('Stage window:', url)
