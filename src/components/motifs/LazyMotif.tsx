import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import type { MotifKind } from '../../data/slides'
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

const cache = new Map<MotifKind, ComponentType<MotifProps>>()

function getLazy(kind: MotifKind) {
  const hit = cache.get(kind)
  if (hit) return hit
  const loader = loaders[kind]
  if (!loader) return null
  const Comp = lazy(() => retryImport(loader))
  cache.set(kind, Comp)
  return Comp
}

function clearLazy(kind: MotifKind) {
  cache.delete(kind)
}

class MotifBoundary extends Component<
  { kind: MotifKind; children: ReactNode },
  { error: Error | null; nonce: number }
> {
  state = { error: null as Error | null, nonce: 0 }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`Motif "${this.props.kind}" failed to load`, error, info.componentStack)
    clearLazy(this.props.kind)
  }

  private retry = () => {
    clearLazy(this.props.kind)
    this.setState((s) => ({ error: null, nonce: s.nonce + 1 }))
  }

  render() {
    if (this.state.error) {
      return (
        <button
          type="button"
          onClick={this.retry}
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
    return <div key={this.state.nonce}>{this.props.children}</div>
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
  if (kind === 'prep-modes') return null
  const Comp = getLazy(kind)
  if (!Comp) return null
  return (
    <MotifBoundary kind={kind}>
      <Suspense fallback={null}>
        <Comp active={active} label={label} guests={guests} />
      </Suspense>
    </MotifBoundary>
  )
}
