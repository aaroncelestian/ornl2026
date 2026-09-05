/** Public-folder asset URL, respectful of Vite `base`. */
export function asset(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return `${import.meta.env.BASE_URL}${clean}`
}

export function isPresentMode(): boolean {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).has('present')) return true
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches
  )
}

export function isPrintMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('print')
}

export function printUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('present')
  url.searchParams.set('print', '1')
  return url.toString()
}

export function presentUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.set('present', '1')
  return url.toString()
}

/** Opens a chrome-less window Zoom can share. Do not use the Fullscreen API. */
export function openPresentWindow() {
  const width = screen.availWidth
  const height = screen.availHeight
  const features = [
    'popup=yes',
    'toolbar=no',
    'location=no',
    'menubar=no',
    'status=no',
    'scrollbars=no',
    `width=${width}`,
    `height=${height}`,
    'left=0',
    'top=0',
  ].join(',')
  const win = window.open(presentUrl(), 'dallas-present', features)
  win?.focus()
  return win
}

export function exitPresent() {
  if (window.opener && !window.opener.closed) {
    window.close()
    return
  }
  const url = new URL(window.location.href)
  if (!url.searchParams.has('present')) return
  url.searchParams.delete('present')
  const next = `${url.pathname}${url.search}${url.hash}`
  window.location.replace(next || './')
}

export function fillAvailableScreen() {
  try {
    window.moveTo(0, 0)
    window.resizeTo(screen.availWidth, screen.availHeight)
  } catch {
    // Browsers only allow this on script-opened windows.
  }
}
