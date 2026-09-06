import { Suspense, lazy, type ComponentType } from 'react'
import type { MotifKind } from '../../data/slides'

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
  'double-lever': () =>
    import('../motifs/DoubleLever').then((m) => ({ default: m.DoubleLever })),
  'framework-density': () =>
    import('../motifs/FrameworkDensity').then((m) => ({ default: m.FrameworkDensity })),
}

const cache = new Map<MotifKind, ComponentType<MotifProps>>()

function getLazy(kind: MotifKind) {
  const hit = cache.get(kind)
  if (hit) return hit
  const loader = loaders[kind]
  if (!loader) return null
  const Comp = lazy(loader)
  cache.set(kind, Comp)
  return Comp
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
    <Suspense fallback={null}>
      <Comp active={active} label={label} guests={guests} />
    </Suspense>
  )
}
