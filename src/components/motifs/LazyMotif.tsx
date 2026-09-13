import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ErrorInfo,
} from 'react'
import type { MotifKind } from '../../data/slides'
import { useScene } from '../../hooks/useSceneBeats'
import { retryImport } from '../../lib/retryImport'

type MotifProps = { active: boolean; label?: string; guests?: boolean }

const loaders: Partial<Record<MotifKind, () => Promise<{ default: ComponentType<MotifProps> }>>> = {
  'lithium-cycle': () =>
    import('../motifs/LithiumCycle').then((m) => ({ default: m.LithiumCycle })),
  'crystal-viewer': () =>
    import('../motifs/CrystalViewer').then((m) => ({ default: m.CrystalViewer })),
  'void-viewer': () =>
    import('../motifs/VoidViewer').then((m) => ({
      default: (props: MotifProps) => <m.VoidViewer {...props} guests={Boolean(props.guests)} />,
    })),
  'selectivity-plume': () =>
    import('../motifs/SelectivityPlume').then((m) => ({ default: m.SelectivityPlume })),
  'pore-gate': () => import('../motifs/PoreGate').then((m) => ({ default: m.PoreGate })),
  'framework-lineage': () =>
    import('../motifs/FrameworkLineage').then((m) => ({ default: m.FrameworkLineage })),
  'void-fit': () => import('../motifs/VoidFit').then((m) => ({ default: m.VoidFit })),
  'ion-chart': () => import('../motifs/IonChart').then((m) => ({ default: m.IonChart })),
  'raman-exchange': () =>
    import('../motifs/RamanExchange').then((m) => ({ default: m.RamanExchange })),
  'lmo-spinel': () =>
    import('../motifs/LmoSpinel').then((m) => ({ default: m.LmoSpinel })),
  'double-lever': () =>
    import('../motifs/DoubleLever').then((m) => ({ default: m.DoubleLever })),
  'framework-density': () =>
    import('../motifs/FrameworkDensity').then((m) => ({ default: m.FrameworkDensity })),
  'mineral-constellation': () =>
    import('../motifs/MineralConstellation').then((m) => ({ default: m.MineralConstellation })),
}

/**
 * React.lazy caches a rejected promise forever on that component type.
 * Keep a generation counter so retries construct a fresh lazy().
 */
const cache = new Map<string, ComponentType<MotifProps>>()
const generation = new Map<MotifKind, number>()

function cacheKey(kind: MotifKind) {
  return `${kind}#${generation.get(kind) ?? 0}`
}

function getLazy(kind: MotifKind) {
  const key = cacheKey(kind)
  const hit = cache.get(key)
  if (hit) return hit
  const loader = loaders[kind]
  if (!loader) return null
  const Comp = lazy(() => retryImport(loader))
  cache.set(key, Comp)
  return Comp
}

function bumpLazy(kind: MotifKind) {
  generation.set(kind, (generation.get(kind) ?? 0) + 1)
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${kind}#`) && key !== cacheKey(kind)) cache.delete(key)
  }
}

function isImportError(error: Error) {
  return /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError/i.test(
    error.message,
  )
}

type BoundaryProps = {
  kind: MotifKind
  resetKey: string
  active: boolean
  label?: string
  guests?: boolean
}

class MotifBoundary extends Component<BoundaryProps, { error: Error | null; nonce: number }> {
  state = { error: null as Error | null, nonce: 0 }
  private autoTries = 0

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`Motif "${this.props.kind}" failed to load`, error, info.componentStack)
    bumpLazy(this.props.kind)
    // Import flakes (Vite/iCloud) — auto-retry a few times without a click
    if (isImportError(error) && this.autoTries < 3) {
      this.autoTries += 1
      window.setTimeout(() => this.retry(), 200 * this.autoTries)
    }
  }

  componentDidUpdate(prevProps: Readonly<BoundaryProps>) {
    // Plume (and other multi-beat motifs) stay mounted across beats.
    // If load failed on 4.7, advancing to 4.10 used to keep the dead error UI.
    if (
      this.state.error &&
      (prevProps.resetKey !== this.props.resetKey || prevProps.kind !== this.props.kind)
    ) {
      this.autoTries = 0
      this.retry()
    }
  }

  private retry = () => {
    bumpLazy(this.props.kind)
    this.setState((s) => ({ error: null, nonce: s.nonce + 1 }))
  }

  render() {
    if (this.state.error) {
      return (
        <button
          type="button"
          onClick={() => {
            this.autoTries = 0
            this.retry()
          }}
          style={{
            appearance: 'none',
            border: '1px solid rgba(243,238,228,0.25)',
            background: 'transparent',
            color: 'rgba(243,238,228,0.7)',
            font: '13px/1.4 ui-monospace, Menlo, monospace',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          Motif failed to load — click to retry
        </button>
      )
    }

    // Resolve lazy HERE so bumpLazy()+setState picks up a fresh component type.
    const Comp = getLazy(this.props.kind)
    if (!Comp) return null

    // Fill the motif host — an unsized wrapper collapses 100%-height canvases
    // (constellation, crystal viewer, etc.) and leaves Html labels floating over copy.
    return (
      <div
        key={this.state.nonce}
        style={{ width: '100%', height: '100%', minHeight: 0 }}
      >
        <Suspense fallback={null}>
          <Comp
            active={this.props.active}
            label={this.props.label}
            guests={this.props.guests}
          />
        </Suspense>
      </div>
    )
  }
}

export function LazyMotif({
  kind,
  active,
  label,
  guests,
}: {
  kind: MotifKind
  active: boolean
  label?: string
  guests?: boolean
}) {
  const scene = useScene()
  // Beat changes must reach the boundary so a failed load can retry without a click
  const resetKey = `${kind}:${scene.beat?.id ?? ''}:${guests ? 'g' : ''}`

  if (kind === 'prep-modes') return null
  if (!loaders[kind]) return null

  return (
    <MotifBoundary
      kind={kind}
      resetKey={resetKey}
      active={active}
      label={label}
      guests={guests}
    />
  )
}
