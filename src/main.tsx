import {
  Component,
  StrictMode,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import { isPrintMode } from './lib/asset'
import { printDocumentHtml } from './lib/printDocument'
import { retryImport } from './lib/retryImport'

const crashBox: CSSProperties = {
  margin: 0,
  padding: 24,
  whiteSpace: 'pre-wrap',
  font: '14px/1.45 ui-monospace, Menlo, monospace',
  color: '#f3eee4',
  background: '#1a0a0a',
  minHeight: '100vh',
}

function showBootError(err: unknown) {
  const message =
    err instanceof Error ? `${err.name}: ${err.message}\n\n${err.stack ?? ''}` : String(err)
  document.body.innerHTML = `<pre style="margin:0;padding:24px;white-space:pre-wrap;font:14px/1.45 ui-monospace,Menlo,monospace;color:#f3eee4;background:#1a0a0a;min-height:100vh">Talk failed to boot.\n\n${message.replace(/</g, '&lt;')}\n\n<button onclick="location.reload()" style="margin-top:16px;padding:8px 14px;font:inherit;cursor:pointer">Reload</button></pre>`
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Talk render error', error, info.componentStack)
    if (
      /Importing a module script failed|Failed to fetch dynamically imported module/i.test(
        error.message,
      )
    ) {
      const key = 'ornl-module-reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.setTimeout(() => location.reload(), 120)
      }
    }
  }

  render() {
    if (this.state.error) {
      const message = `${this.state.error.name}: ${this.state.error.message}\n\n${this.state.error.stack ?? ''}`
      const isModule =
        /Importing a module script failed|Failed to fetch dynamically imported module/i.test(
          this.state.error.message,
        )
      return (
        <div style={crashBox}>
          <pre style={{ margin: 0, font: 'inherit', whiteSpace: 'pre-wrap' }}>
            {`Talk crashed while rendering.\n\n${message}`}
          </pre>
          {isModule ? (
            <p style={{ margin: '16px 0 0', opacity: 0.75 }}>
              Usually a stale Vite/HMR chunk (common while editing on iCloud). Reload fixes it.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 14px',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

if (isPrintMode()) {
  try {
    document.open()
    document.write(printDocumentHtml())
    document.close()
  } catch (err) {
    showBootError(err)
  }
} else {
  void bootDeck().catch(showBootError)
}

async function bootDeck() {
  await retryImport(() => import('./styles/tokens.css'))
  const { default: App } = await retryImport(() => import('./App'))
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing #root element')

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )

  // Allow a future module-flake reload after a successful boot.
  try {
    sessionStorage.removeItem('ornl-module-reload')
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('ornl-motif-reload-')) sessionStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }

  const boot = document.getElementById('boot')
  if (boot && !boot.dataset.error) boot.remove()
}
