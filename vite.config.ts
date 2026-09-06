import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const realRoot = fs.realpathSync.native(rootDir)

function buildStamp() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp =
    process.env.VITE_BUILD_TIME ||
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const sha = (
    process.env.VITE_BUILD_SHA ||
    process.env.GITHUB_SHA ||
    (() => {
      try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim()
      } catch {
        return 'local'
      }
    })()
  ).slice(0, 7)
  const num = process.env.VITE_BUILD_NUM || process.env.GITHUB_RUN_NUMBER
  return num ? `b${num} · ${stamp} · ${sha}` : `${stamp} · ${sha}`
}

const offline = process.env.OFFLINE === '1'

// Relative base so the built folder works from USB / local disk / any host path.
export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildStamp()),
  },
  plugins: [react()],
  optimizeDeps: {
    // Only crawl the real app entry — never offline USB HTML bundles.
    entries: ['./index.html'],
  },
  build: {
    // Offline USB build: one JS file, no modulepreload (file:// has no MIME types).
    ...(offline
      ? {
          cssCodeSplit: false,
          modulePreload: false,
          rollupOptions: {
            output: { inlineDynamicImports: true },
          },
        }
      : {}),
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: null,
    fs: {
      // iCloud "Mobile Documents" realpath can diverge from the workspace path.
      strict: false,
      allow: [searchForWorkspaceRoot(process.cwd()), rootDir, realRoot],
      deny: ['**/offline/**', '**/dist/**'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
