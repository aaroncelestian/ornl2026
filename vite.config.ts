import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function buildStamp() {
  const sha = (
    process.env.VITE_BUILD_SHA ||
    process.env.GITHUB_SHA ||
    (() => {
      try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim()
      } catch {
        return 'unknown'
      }
    })()
  ).slice(0, 7)
  const num = process.env.VITE_BUILD_NUM || process.env.GITHUB_RUN_NUMBER || 'local'
  return `${num} · ${sha}`
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
      deny: ['**/offline/**', '**/dist/**'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
