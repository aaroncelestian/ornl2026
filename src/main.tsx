import {
  Component,
  StrictMode,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import { isPrintMode } from './lib/asset'
import { printDocumentHtml } from './lib/printDocument'

function showBootError(err: unknown) {
  const message =
    err instanceof Error ? `${err.name}: ${err.message}\n\n${err.stack ?? ''}` : String(err)
  document.body.innerHTML = `<pre style="margin:0;padding:24px;white-space:pre-wrap;font:14px/1.45 ui-monospace,Menlo,monospace;color:#f3eee4;background:#1a0a0a;min-height:100vh">Talk failed to boot.\n\n${message.replace(/</g, '&lt;')}</pre>`
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Talk render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const message = `${this.state.error.name}: ${this.state.error.message}\n\n${this.state.error.stack ?? ''}`
      return (
        <pre
          style={{
            margin: 0,
            padding: 24,
            whiteSpace: 'pre-wrap',
            font: '14px/1.45 ui-monospace, Menlo, monospace',
            color: '#f3eee4',
            background: '#1a0a0a',
            minHeight: '100vh',
          }}
        >
          {`Talk crashed while rendering.\n\n${message}`}
        </pre>
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
  await import('./styles/tokens.css')
  const { default: App } = await import('./App')
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing #root element')

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )

  const boot = document.getElementById('boot')
  if (boot && !boot.dataset.error) boot.remove()
}
