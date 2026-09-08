import { asset } from '../lib/asset'

export type LayoutKind =
  | 'cover'
  | 'divider'
  | 'content'
  | 'split'
  | 'bleed'
  | 'stage'
  | 'hero'
  | 'void'
  | 'monument'
  | 'image'
  | 'litany'
  | 'impact'

export type MotifKind =
  | 'ion-chart'
  | 'crystal-viewer'
  | 'void-viewer'
  | 'lithium-cycle'
  | 'prep-modes'
  | 'selectivity-plume'
  | 'pore-gate'
  | 'framework-lineage'
  | 'void-fit'
  | 'raman-exchange'
  | 'double-lever'
  | 'framework-density'
  | 'lmo-spinel'
  | 'mineral-constellation'

export type ChapterId = 'open' | 'spinel' | 'lokelma' | 'rowleyite' | 'pipeline' | 'close'

export type CameraKind =
  | 'push'
  | 'pull'
  | 'pan-left'
  | 'pan-right'
  | 'rise'
  | 'fall'
  | 'rack'
  | 'drift'
  | 'zoom-pan'
  | 'pan-bounce'
  | 'hold'

export type SceneLayerKind = 'image' | 'motif' | 'video' | 'slideshow'

export interface SceneSlide {
  src: string
  alt: string
  cutout?: boolean
}

export interface SceneLayer {
  id: string
  kind: SceneLayerKind
  src?: string
  poster?: string
  alt?: string
  fit?: 'cover' | 'contain'
  camera?: CameraKind
  motif?: MotifKind
  slides?: SceneSlide[]
  dwellMs?: [number, number]
  holdAt?: number
  holds?: VideoHold[]
  scaleBar?: ScaleBar
  marks?: SpecimenCallout[]
}

export type VideoMarkKind = 'mineral' | 'biomass' | 'onion'

export interface VideoMark {
  id: string
  x: number
  y: number
  kind: VideoMarkKind
  title: string
  body?: string
  side?: 'left' | 'right'
  rx?: number
  ry?: number
  rings?: number
}

export interface VideoHold {
  at: number
  marks?: VideoMark[]
}

export interface ScaleBar {
  mm: number
  width: number
}

export interface SpecimenCallout {
  id: string
  x: number
  y: number
  side?: 'left' | 'right'
  title: string
  formula?: string
  body?: string
  es?: string
  ly?: number
  tilt?: number
  inset?: number
}

export interface SceneBeat {
  id: string
  label: string
  kicker?: string
  title?: string
  subtitle?: string
  layers?: string[]
  guests?: boolean
  callouts?: string[]
  calloutDelay?: number
  calloutFade?: number
  bullets?: string[]
  notes?: string
}

export interface StoneMark {
  label: string
  x: number
  y: number
  w: number
  h: number
  src?: string
  tint?: string
}

export interface Slide {
  id: string
  label: string
  chapter: ChapterId
  layout: LayoutKind
  brand?: string
  kicker?: string
  title?: string
  displayTitle?: string
  subtitle?: string
  body?: string
  bullets?: string[]
  quote?: string
  meta?: string
  ghostNum?: string
  heroNum?: string
  image?: {
    src: string
    alt: string
    fit?: 'cover' | 'contain'
    focus?: { x: number; y: number; w: number; h: number }
    detail?: string
    detailFocus?: { x: number; y: number; w: number; h: number }
    marks?: StoneMark[]
  }
  motif?: MotifKind
  yaw?: 1 | -1
  camera?: CameraKind
  clearPlate?: boolean
  enterDelay?: number
  exitHold?: number
  enterBlack?: boolean
  /** Soft warm light wash on enter (drawer dive → Act I). */
  enterLight?: boolean
  enterHit?: boolean
  copySnap?: boolean
  promoAfter?: number
  promo?: {
    src: string
    alt: string
    kicker?: string
    title?: string
    subtitle?: string
    credit?: string
  }
  splitFlip?: boolean
  notes?: string
  layers?: SceneLayer[]
  scene?: SceneBeat[]
}

export const CHAPTERS: { id: ChapterId; num: string; title: string }[] = [
  { id: 'spinel', num: '01', title: 'Spinel → DLE' },
  { id: 'lokelma', num: '02', title: 'Convergent pores' },
  { id: 'rowleyite', num: '03', title: 'Rowleyite' },
  { id: 'pipeline', num: '04', title: 'Pipeline' },
  { id: 'close', num: '05', title: 'Ask' },
]

export const slides: Slide[] = [
  // ── Open ──────────────────────────────────────────────
  {
    id: 'title',
    label: 'Title',
    chapter: 'open',
    layout: 'cover',
    camera: 'rack',
    brand: 'NHMLAC  ·  ORNL',
    displayTitle: 'Museum Collections\nas Blueprints for\nEngineered Materials',
    meta: 'Aaron Celestian  ·  Mineral Sciences  ·  Oak Ridge  ·  40–50 min',
    image: {
      src: asset('images/zeolite.jpg'),
      alt: 'Porous mineral specimen',
      fit: 'contain',
    },
    yaw: 1,
    exitHold: 1,
    notes:
      'Museum collections as blueprints for engineered materials. Not display cases. Not nostalgia. A searchable library of framework topologies whose selectivity had to be rediscovered under synthetic control before it became deployable.',
  },
  {
    id: 'open-zoom',
    label: 'Pull back',
    chapter: 'open',
    layout: 'stage',
    clearPlate: true,
    camera: 'hold',
    layers: [
      {
        id: 'sky',
        kind: 'motif',
        motif: 'mineral-constellation',
        alt: 'Zoom from perovskite through a mineral constellation into museum cabinets',
      },
    ],
    scene: [
      {
        id: 'peri',
        label: 'Perovskite',
        kicker: '1839',
        title: 'Perovskite',
        subtitle: 'Ferroelectrics · solar',
        layers: ['sky'],
        notes:
          'Start here — every physicist in the room already speaks this name. Gustav Rose, 1839, Urals, named for Lev Perovski. BaTiO₃ ceramics in the 1940s; halide perovskite solar after 2009. The mineralogist named the architecture. Industry showed up speaking the name as if it were a materials term. Hold the close-up, then pull.',
      },
      {
        id: 'sky',
        label: 'Constellation',
        title: 'Minerals are in\nnearly everything.',
        layers: ['sky'],
        notes:
          'Pull out into the full constellation. Names the room already uses show up first — zeolite → molecular sieves; olivine → LiFePO₄; fluorite → YSZ; garnet → YIG then LLZO; stibnite → thin-film PV — then a hundred more across energy, medicine, optics, sieves, electronics, structure. Tiny labels on purpose. Invite a click; Esc or empty click pulls back. Spinel waits for Act I.',
      },
      {
        id: 'cabinets',
        label: 'Cabinets',
        title: 'Not a warehouse.',
        layers: ['sky'],
        notes:
          'Zoom out again until the constellation becomes a place. Cabinets. Drawers. Specimens with provenance. This is where the names still have rocks attached — not a slide of jargon, a physical instrument.',
      },
      {
        id: 'instrument',
        label: 'Instrument',
        title: '150,000 specimens.\nA materials instrument.',
        layers: ['sky'],
        notes:
          'Natural History Museum of Los Angeles County — more than 150,000 mineral specimens, provenance-documented, spanning framework chemistries you would not assemble from scratch in a materials lab without years and a small fortune. Comparative depth is the point: when a channel geometry shows up in one place, you can ask whether related topologies elsewhere in the collection already solved a neighboring problem. Nature solved selective ion transport first. Collections keep the answers.',
      },
      {
        id: 'turn',
        label: 'The turn',
        title: 'The next sorbent\nis already in a drawer.',
        layers: ['sky'],
        notes:
          'Hard cut into one open drawer. The collection is not a museum of finished answers — it is a drawer of geometries waiting for the right problem. We’re going deep on three of them, mechanism first: spinel → λ-MnO₂ DLE (J. Raman 2026); zirconosilicate → Lokelma (PLoS ONE 2024); rowleyite cages → drug delivery (Am. Mineral. 2017). Nature supplied the geometry; regulation and engineering demanded the synthesis.',
      },
      {
        id: 'dive',
        label: 'Dive',
        layers: ['sky'],
        notes:
          'Pan up, then fall into the light — into the soul of the museum. Let the drawer take us into Act I.',
      },
    ],
    exitHold: 0.4,
    notes:
      'Cinematic open: perovskite → constellation → cabinets → instrument → drawer → dive into Act I.',
  },

  // ── 01 Spinel → DLE ───────────────────────────────────
  {
    id: 'act-spinel',
    label: 'Act I',
    chapter: 'spinel',
    layout: 'divider',
    ghostNum: '01',
    title: 'Interstitial sites\nas a design brief.',
    enterLight: true,
    enterDelay: 1.15,
    notes:
      'Case one: natural spinel taught interstitial-site chemistry. The engineered answer is lithium manganese oxide — Li₄Mn₅O₁₂ / λ-MnO₂ — for direct lithium extraction from geothermal and reject brine. Partners: ORNL (Kumar, Paranthaman), Mineral Selective Technologies / Element3 (Bourcier, Camiré), NHMLAC. DOE AMO DE-EE0009442. Mechanism paper: Celestian et al., J. Raman Spectrosc. 2026.',
  },
  {
    id: 'lithium',
    label: 'Lithium',
    chapter: 'spinel',
    layout: 'stage',
    clearPlate: true,
    layers: [
      {
        id: 'spinel',
        kind: 'image',
        src: asset('images/spinel.jpg'),
        alt: 'Spinel octahedron',
        fit: 'contain',
      },
      {
        id: 'plume',
        kind: 'motif',
        motif: 'selectivity-plume',
      },
      {
        id: 'cycle',
        kind: 'motif',
        motif: 'lithium-cycle',
      },
      {
        id: 'raman',
        kind: 'motif',
        motif: 'raman-exchange',
      },
      {
        id: 'lmo',
        kind: 'motif',
        motif: 'lmo-spinel',
      },
    ],
    scene: [
      {
        id: 'property',
        label: 'The property',
        kicker: 'Direct lithium extraction',
        title: 'Not the mineral.\nThe interstitial site.',
        layers: ['spinel'],
        notes:
          'Look at this spinel. Nobody accessioned it as battery feedstock. Natural AB₂O₄ spinels already know how to host a small cation in tetrahedral interstices — selective, reversible, geometrically fussy. The engineered rebuild is Li₄Mn₅O₁₂ spinel (λ-MnO₂ after H⁺ priming). We take the interstitial property, not the hand specimen, and put it under synthetic control.',
      },
      {
        id: 'lattice',
        label: 'Lattice',
        kicker: 'LiMn₂O₄ · Fd-3m',
        title: 'MnO₆ builds the cage.',
        layers: ['lmo'],
        notes:
          'Real CIF: sixteen MnO₆ octahedra in the conventional cell. Edge- and face-sharing Mn octahedra make the spinel framework — the Mn₄O₄ cubane units whose A₁g stretch the Raman tracks. Drag to orbit.',
      },
      {
        id: 'voids',
        label: 'Voids',
        kicker: 'Interstitial geometry',
        title: 'The voids are the product.',
        layers: ['lmo'],
        notes:
          'Ball-and-stick Mn–O with the crystallographic 8a→16c→8a Li path as open tubes — no cubic shell on the cell faces. That tunnel geometry is the product.',
      },
      {
        id: '8a',
        label: 'H-Li exchange',
        kicker: 'Acid prime → 8a',
        title: 'H-Li Exchange',
        layers: ['lmo'],
        notes:
          'One beat, two motions. Acid prime: protons enter the 8a→16c pores and sit on framework oxygen — the OH vector points into the tetrahedral 8a cavity. The cubane no longer breathes as one. Raman does not blank — A₁g goes broad (about 2× the Li-exchanged width) and walks ~20 cm⁻¹ down. Then Li lands in 8a first — stable, back-exchangeable, no Mn loss yet. A₁g walks ~20 cm⁻¹ back up and HWHM halves as each inbound Li pushes the priming H out the same channel.',
      },
      {
        id: 'li-return',
        label: 'Li returns',
        layers: ['raman'],
        notes:
          'Start H-form: cubane is there, A₁g is muted. First Li into 8a jumps A₁g 645→657 and narrows it — the cubane breathes again; back-exchangeable, no Mn loss yet. More Li forces the next step: Li into the cubane interior (8b). Local Oh breaks — four Mn–O environments are no longer equivalent — A₁g splits and F₂g turns on. That spectral rewrite is the same strain that ejects Mn. IC shows Mn leaching; after many full cycles there is less and less LMO. XRD can still look ordered while the lattice is dissolving from the cubane out.',
      },
      {
        id: 'al-doped',
        label: 'Al-doped',
        kicker: 'Same clock · different lattice',
        title: 'A₁g holds\nfor hours.',
        layers: ['raman'],
        notes:
          'Same experiment, Al in the spinel — 0.1 wt% Al. Scrub hours of ion exchange — A₁g barely moves. No split, no F₂g surge. Aluminum blocks the cubane over-exchange site that undoped LMO overloads, so Mn stays put and the lattice holds. Partial load and Al doping are two ways to the same durability: do not open the dissolve step.',
      },
      {
        id: 'cloud',
        label: 'Selectivity cloud',
        kicker: 'Why geometry wins',
        title: 'Why spinel wins.\nWhy LiMn specifically?',
        layers: ['plume'],
        notes:
          'The question this plot answers. Spinel is not a brand preference — it is a geometry. Among candidate sorbents, only a lattice with the right interstitial size pulls Li⁺ out of brine. Lithium manganese oxide — Li₄Mn₅O₁₂ / λ-MnO₂ — is the engineered answer because its tetrahedral 8a sites sit in that window.',
      },
      {
        id: 'gate',
        label: 'Li gate',
        kicker: 'Why geometry wins',
        title: 'Most pores are\ntoo big for Li.',
        layers: ['plume'],
        notes:
          'Most porous materials — zeolites, MOFs, soft ion exchangers — open channels wider than Li⁺ needs. Selectivity collapses. The cloud is noisy: soft peaks, weak discrimination. That is what you get when pores admit Na⁺, Ca²⁺, Mg²⁺ as easily as lithium. Watch the dashed gate at 0.76 Å — everything useful has to peak there.',
      },
      {
        id: 'spinel-peak',
        label: 'λ-MnO₂',
        kicker: 'ORNL · Element3 · NHMLAC',
        title: 'A narrow pore\nselects for Li.',
        layers: ['plume'],
        notes:
          'There is a very narrow pore-size window that fits Li⁺ and rejects the rest — and λ-MnO₂ sits in it. Sharp Li⁺ selectivity. Na⁺, Ca²⁺, Mg²⁺ rejected. R&D 100, 2024 — High Lithium Capacity Sorbents for Direct Lithium Extraction — ORNL + Element3 Mineral Selective Technologies + museum mineralogy. DOE AMO Award DE-EE0009442. Loading tests: 10–15 mg Li per gram LMO, ~20% of stoichiometric Li₄Mn₅O₁₂ sites; elution recovers >95% of loaded Li in under two minutes. Mechanism: Celestian, Bourcier, Camiré, Kumar, Paranthaman — J. Raman Spectrosc. 2026, 57:131–139.',
      },
      {
        id: 'ions',
        label: 'Competitors',
        kicker: 'Brine reality',
        title: 'That window leaves\nLi⁺ almost alone.',
        layers: ['plume'],
        notes:
          'Same narrow gate against real brine competitors. Shannon radii: Li⁺ ~0.76 Å, Mg²⁺ 0.72, Na⁺ 1.02, Ca²⁺ 1.0, K⁺ 1.38. Size-selective interstitial chemistry is why a spinel can still pull Li out of desalination reject and geothermal brine — Na and Mg dominate the soup; the pore does not care.',
      },
      {
        id: 'brine',
        label: 'Brine',
        kicker: 'Process loop',
        title: 'Desalination already\nconcentrated the brine.',
        layers: ['cycle'],
        notes:
          'Process side. The plant already did the hard work. Reject brine is sitting there. Not a new pit. Not a new evaporative field. The lithium is in a liquid we already make. That helix on the rail is the Materials Genome idea — composition and structure searched with a natural prior.',
      },
      {
        id: 'absorb',
        label: 'Absorb',
        kicker: 'Process loop',
        title: 'The spinel takes\nthe lithium.',
        layers: ['cycle'],
        notes:
          'Li₄Mn₅O₁₂ — size-selective uptake. Characterization punchline from the 2026 paper: as-synthesized LMO has good XRD and good Raman; H-exchanged keeps good XRD but Raman is basically gone; as Li goes back in, XRD stays good and the Raman pattern returns — changed. Larger seawater cations do not fit the interstitial gate.',
      },
      {
        id: 'air',
        label: 'Air',
        kicker: 'Process loop',
        title: 'The acid comes\nfrom the air.',
        layers: ['cycle'],
        notes:
          'Process story: CO₂ / dilute acid strip closes the loop without evaporative ponds. Lab reality from the paper: HCl priming populates exchange sites with H⁺; dilute acid elution recovers lithium fast. The geometry is still the point — reversible H⁺/Li⁺ exchange in a spinel lattice that already knew which cation fits.',
      },
      {
        id: 'product',
        label: 'Li₂CO₃',
        kicker: 'Process loop',
        title: 'Li₂CO₃.\nBattery-ready feedstock.',
        layers: ['cycle'],
        notes:
          'The wash is also the product. Lithium carbonate — the feedstock battery plants already know. Loop closed at the molecule the supply chain already buys.',
      },
      {
        id: 'award',
        label: 'R&D 100',
        kicker: 'Collaboration stamp',
        title: 'R&D 100 · 2024.',
        subtitle: 'ORNL · Element3 · museum mineralogy on the team.',
        layers: ['cycle'],
        notes:
          'R&D World. Global competition. The stamp matters here because this room knows what it takes to move a sorbent from a diffraction pattern to a deployable extraction media. The museum was on the team because someone had spent years watching how natural structures already solve selective uptake.',
      },
      {
        id: 'recycle',
        label: 'Recycle',
        kicker: 'Process loop',
        title: 'The spinel comes back.',
        layers: ['cycle'],
        notes:
          'Recyclable sorbent — empty spinel back to brine. Act I closes on the loop: geometry in, Li₂CO₃ out, lattice reusable. Same selectivity logic does not stop at lithium.',
      },
    ],
  },

  // ── 02 Convergent pores → Lokelma ─────────────────────
  {
    id: 'act-lokelma',
    label: 'Act II',
    chapter: 'lokelma',
    layout: 'divider',
    ghostNum: '02',
    title: 'Unrelated frameworks.\nOne channel answer.',
    notes:
      'Case two: zirconosilicates and titanosilicates converging on K⁺-selective channels. Natural lineage first. Synthetic cubic zirconium silicate — ZS-9 / CZS-(Na,H), marketed as Lokelma — under pharmaceutical control second. Mechanism paper: Lively & Celestian, PLoS ONE 2024 — in situ XRD + Raman on the exchange path.',
  },
  {
    id: 'lokelma',
    label: 'Lokelma',
    chapter: 'lokelma',
    layout: 'stage',
    clearPlate: true,
    layers: [
      {
        id: 'zeolite',
        kind: 'image',
        src: asset('images/zeolite.jpg'),
        alt: 'Porous mineral specimen, stellarite',
        fit: 'contain',
      },
      {
        id: 'lineage',
        kind: 'motif',
        motif: 'framework-lineage',
      },
      {
        id: 'gate',
        kind: 'motif',
        motif: 'pore-gate',
      },
      {
        id: 'structure',
        kind: 'motif',
        motif: 'crystal-viewer',
      },
      {
        id: 'lever',
        kind: 'motif',
        motif: 'double-lever',
      },
    ],
    scene: [
      {
        id: 'specimen',
        label: 'Porous mineral',
        kicker: 'Channel structure',
        title: 'Nobody bought this\nas medicine.',
        layers: ['zeolite'],
        notes:
          'Acquired for channel structure and mineralogical completeness. Not as a hyperkalemia program. The specimen is the class. The drug is what happens when you rebuild the class under GMP.',
      },
      {
        id: 'cloud',
        label: 'Quiet literature',
        kicker: 'Framework lineage',
        title: 'Natural names barely\nmove the literature.',
        layers: ['lineage'],
        notes:
          'Same axis for all. Lump only where mineral = industrial rebuild: zorite/ETS-4; sitinakite/CST/ETS-10. Georgechaoite has no trade name — stays on the floor. Umbite may have one; we do not know it, so it stays mineral-only. SZC / ZS-9 / Lokelma are one product under three names — that is the curve that detonates.',
      },
      {
        id: 'precedents',
        label: 'Precedents',
        kicker: 'Natural teachers',
        title: 'Same pore.\nMineral name, then trade name.',
        layers: ['lineage'],
        notes:
          'Where the mapping is known, mineral and industry share a line: zorite → ETS-4; sitinakite → CST / ETS-10. Georgechaoite taught the Zr–Si 3MR (DFT analog in the Lokelma Raman paper) but never got a product name. Umbite is the other natural Zr teacher — industrial alias unknown. The product that did get named is SZC / ZS-9 / Lokelma.',
      },
      {
        id: 'converge',
        label: 'Convergence',
        kicker: 'Why unrelated lattices agree',
        title: 'Two chemistries.\nOne physically viable door.',
        layers: ['lineage'],
        notes:
          'Zirconium silicate and titanium silicate are not the same structure type. Yet both lineages converge on channel apertures that select K⁺ and Cs⁺ over Na⁺. That is not coincidence. Hydrated ion diameters and framework oxygen coordination leave a narrow band of viable pore sizes for selective monovalent transport. Collections preserve both lineages side by side — synthetic libraries usually rediscover one lineage at a time.',
      },
      {
        id: 'zs9',
        label: 'ZS-9',
        kicker: 'Synthetic rebuild',
        title: 'Industrial use.\nSame axis.\nThe literature detonates.',
        layers: ['lineage'],
        notes:
          'Highlight SZC / ZS-9 / Lokelma — one material, three names. Clinical deployment is why that line leaves the mineral floor. Georgechaoite and umbite stay quiet beside it: teachers without a trade name (or without one we can cite). Paper: Lively & Celestian, PLoS ONE 19(3): e0298661, 2024.',
      },
      {
        id: 'scale',
        label: 'Hydrated sizes',
        kicker: 'Pore physics',
        title: 'Hydrated diameters\nare the real players.',
        layers: ['gate'],
        notes:
          'Crystal radii mislead in water. Watch the spheres: Na⁺ ~2.8 Å, Ca²⁺ ~2.7 Å, K⁺ ~3.3 Å. The channel sees solvated cations shedding water at the window — not bare Shannon radii.',
      },
      {
        id: 'pore',
        label: 'Pore',
        kicker: 'From the CIF',
        title: 'A 7-ring window.\nBuilt like a K⁺ channel.',
        layers: ['structure'],
        notes:
          'Orbit the real ZS-9 cell from CZS-K.cif. Seven-membered rings — four SiO₄ and three ZrO₆ — light up as the free aperture. Same geometric idea as a biological K⁺ channel. Effective hydrated cutoff ~3 Å; crystallographic O–O axes ~6.5 × 5 Å.',
      },
      {
        id: 'k',
        label: 'Capture',
        kicker: 'From the CIF',
        title: 'K⁺ is the cargo.',
        layers: ['structure'],
        notes:
          'Potassium sits in the channels of the same CIF model. In the clinic it is captured in the gut lumen — never in blood, never on kidney tissue. Partial protonation opens the 7MR and locks K⁺ in.',
      },
      {
        id: 'gut',
        label: 'Gut',
        kicker: 'Clinical geometry',
        title: 'Not blood.\nNot kidney.\nGut.',
        layers: ['structure'],
        notes:
          'Drag to orbit. Lokelma never leaves the intestine. Clinical trials brought hyperkalemic patients back toward normal within hours. Site of action is as structural as the pore.',
      },
      {
        id: 'protons',
        label: 'Protons',
        kicker: 'Exchange mechanism',
        title: 'Protons point\nat the empty site.',
        layers: ['structure'],
        notes:
          'Still the CIF — now with H entering. Hydroxyls on bridging O1 of ZrO₆ point into the 7MR, toward the site K⁺ wants. Bond-valence puts H there; neutron work is next.',
      },
      {
        id: 'lock',
        label: 'Lock',
        kicker: 'Exchange mechanism',
        title: 'They bend.\nThey leave.\nK stays.',
        layers: ['structure'],
        notes:
          'Watch the cell open, then lock. H leaves; K stays. Hydration energy favors K over Na (−321 vs −405 kJ/mol). That lock is crystallography, not a marketing claim.',
      },
      {
        id: 'patients',
        label: '3 million',
        kicker: 'Consequence of geometry',
        title: 'Size-selective exchange\nbecomes a drug.',
        subtitle: 'On the order of 3 million patients.',
        layers: ['structure'],
        notes:
          'Three million patients is what happens when a channel minerals already invented is rebuilt to pharmaceutical specification. Same family as cesium cleanup frameworks. One geometry. Two deployments.',
      },
    ],
  },

  // ── 03 Rowleyite ──────────────────────────────────────
  {
    id: 'act-rowleyite',
    label: 'Act III',
    chapter: 'rowleyite',
    layout: 'divider',
    ghostNum: '03',
    title: 'A new mineral\nis a new material.',
    notes:
      'Case three: rowleyite — Kampf, Cooper, Nash, Cerling, Marty, Hummer, Celestian, Rose & Trebisky, American Mineralogist 2017. Vanadium-phosphate polyoxovanadate framework; among the most porous crystalline frameworks known. Cage and channel architecture invites host–guest thinking. The specimen is the blueprint. Any drug-delivery scaffold has to be synthetic.',
  },
  {
    id: 'rowleyite',
    label: 'Rowleyite',
    chapter: 'rowleyite',
    layout: 'stage',
    clearPlate: true,
    layers: [
      {
        id: 'specimen',
        kind: 'image',
        src: asset('images/rowleyite.jpg'),
        alt: 'Rowleyite crystals on matrix',
        fit: 'contain',
      },
      {
        id: 'voids',
        kind: 'motif',
        motif: 'void-viewer',
      },
      {
        id: 'fit',
        kind: 'motif',
        motif: 'void-fit',
      },
      {
        id: 'density',
        kind: 'motif',
        motif: 'framework-density',
      },
    ],
    scene: [
      {
        id: 'novelty',
        label: 'Novelty',
        kicker: 'IMA 2016-037 · Rowley mine, Arizona',
        title: 'Named for novelty.\nUseful for emptiness.',
        layers: ['specimen'],
        notes:
          'Rowleyite. [Na(NH₄,K)₉Cl₄][V₂⁵⁺,⁴⁺(P,As)O₈]₆·n[H₂O,Na,NH₄,K,Cl]. Cubic Fd̅3m, a = 31.704 Å, V ≈ 31,867 Å³. Truncated octahedra ~50 μm, very dark brownish green. Five co-types at NHMLAC — 66268–66272. Collector logic starts at taxonomic novelty. Materials logic starts one question later: what can this arrangement of atoms do that nothing else can?',
      },
      {
        id: 'cage',
        label: 'Void space',
        kicker: 'Architecture',
        title: 'The useful part\nis the hole.',
        layers: ['density'],
        notes:
          'Bigger glow means more empty. Rowleyite at FD 9.8 — lowest natural crystalline framework. 12MR windows 9.7 Å; salt-cage access 4.1 Å. The empty volume is the scientific object.',
      },
      {
        id: 'voids-view',
        label: 'Channels',
        kicker: 'Architecture',
        title: 'Cages you can\norbit.',
        layers: ['voids'],
        notes:
          'Drag the void map. Salt-templated small cages and open large cages — the geometry the glow just named.',
      },
      {
        id: 'cargo',
        label: 'Cargo',
        kicker: 'Host–guest hypothesis',
        title: 'Four guests.\nOne scaffold idea.',
        layers: ['voids'],
        guests: true,
        notes:
          'Doxorubicin, vincristine, cisplatin, temozolomide — placed as guests on the near face. Not in the 2017 mineral paper: a materials hypothesis built on that porosity. The mineral is the scaffold idea, not the drug.',
      },
      {
        id: 'mismatch',
        label: 'Fit test',
        kicker: 'Volumes as a filter',
        title: 'Match is a filter.\nNot a finished medicine.',
        layers: ['fit'],
        notes:
          'Cage ~420 Å³. Cisplatin and temozolomide fit. Doxorubicin is near the edge. Vincristine overflows — useful tension. Void matching generates candidates; it does not ship a vial.',
      },
      {
        id: 'scaffold',
        label: 'Synthetic analog',
        kicker: 'Blueprint → build',
        title: 'Natural geometry.\nPharmaceutical-grade analog.',
        layers: ['fit'],
        notes:
          'You will not put Arizona hand-specimen into an oncology ward. You synthesize a clean analog of the cage–channel architecture. Same pattern as Lokelma and λ-MnO₂.',
      },
      {
        id: 'lead',
        label: 'Design template',
        title: 'Rowleyite as design template',
        subtitle: 'Controlled-release scaffold candidate — geometry first.',
        layers: ['voids'],
        guests: true,
        notes:
          'Seventeen new mineral species with my name on them. Each one is a door. Most discoverers stop at the catalogue entry. The scientific obligation is the next question: does this geometry solve a problem anyone has? For rowleyite — lowest natural framework density, salt-templated channels, 9.7 Å cage windows — that problem may be targeted, controlled-release delivery. The channel is the lead, not the trophy.',
      },
    ],
  },

  // ── 04 Pipeline ───────────────────────────────────────
  {
    id: 'act-pipeline',
    label: 'Act IV',
    chapter: 'pipeline',
    layout: 'divider',
    ghostNum: '04',
    title: 'One discovery pipeline.',
    notes:
      'Close the argument. What a curated collection concretely offers outside research groups — and how museum collections plus national-lab characterization already operate as a single materials-discovery loop.',
  },
  {
    id: 'pattern',
    label: 'The pattern',
    chapter: 'pipeline',
    layout: 'void',
    camera: 'drift',
    title: 'Geometry from nature.\nMechanism in the lab.\nSynthesis for deployment.',
    exitHold: 1.5,
    enterBlack: true,
    copySnap: true,
    notes:
      'Say it plainly. Natural specimen → mechanism characterization → engineered or synthetic form that regulators and engineers can trust. Spinel (J. Raman 2026). Lokelma (PLoS ONE 2024). Rowleyite (Am. Mineral. 2017). Same sentence three times.',
  },
  {
    id: 'offers',
    label: 'What collections offer',
    chapter: 'pipeline',
    layout: 'litany',
    kicker: 'Outside the research group',
    bullets: [
      'Framework diversity that is slow and expensive to generate synthetically from scratch',
      'Provenance: named locality, paragenesis, comparable series across deposits',
      'Time depth: topologies waiting decades for the right analytical question',
      'A prior for Materials Genome and inverse-design searches — not a blank composition space',
    ],
    notes:
      'This is the practical offer to a national lab. You are not asking for display loans. You are asking for a topology library with metadata. Comparative series beat one-off curiosities. Provenance is experimental reproducibility for geology.',
  },
  {
    id: 'working',
    label: 'Working model',
    chapter: 'pipeline',
    layout: 'stage',
    clearPlate: true,
    camera: 'hold',
    image: {
      src: asset('images/spinel.jpg'),
      alt: 'Spinel octahedron',
      fit: 'contain',
    },
    kicker: 'Already running',
    title: 'Museum collection\n+\nORNL characterization\n=\none pipeline',
    notes:
      'This is not aspirational theater. DOE AMO DE-EE0009442 lithium extraction research already couples museum-informed geometric priors to national-lab synthesis and characterization — Raman, diffraction, XPS on LMO; synchrotron XRD + Raman on CZS at APS 17-BM; neutron follow-ups planned for H sites in zirconium silicates. R&D 100 with ORNL and Element3 is the public receipt. The pipeline works when both ends stay honest: collections as blueprints, labs as builders and validators.',
  },
  {
    id: 'next',
    label: 'What to try next',
    chapter: 'pipeline',
    layout: 'litany',
    kicker: 'For this room',
    bullets: [
      'Operando Raman/XRD under real brine — and cycle protocols that avoid full-load Mn loss',
      'Neutron / PDF on CZS hydroxyl networks (H positions still inferred from bond valence)',
      'Systematic screen of collection framework topologies against critical-ion selectivity maps',
      'Synthetic SIS analogs of rowleyite cages (9.7 Å windows, FD ~9.8) with release specs',
    ],
    notes:
      'Concrete next steps grounded in the papers. LMO: partial-load cycling preserves the lattice; full load costs Mn. Lokelma: neutron diffraction for the H/OH network the double-lever model needs. Rowleyite: salt-templated POV synthesis at mild conditions, then pharmaceutical impurity and release kinetics. A shared workflow from CIF to deployable media. That is the collaboration ask.',
  },

  // ── Close ─────────────────────────────────────────────
  {
    id: 'bet',
    label: 'The bet',
    chapter: 'close',
    layout: 'void',
    camera: 'drift',
    title: 'Keep the geometry.\nBuild what regulation requires.',
    exitHold: 1.5,
    enterBlack: true,
    copySnap: true,
    notes:
      'Collections are not where science goes to be preserved. They are where unfinished materials problems wait with answers already crystallized. Your instruments finish the sentence.',
  },
  {
    id: 'close',
    label: 'Close',
    chapter: 'close',
    layout: 'bleed',
    camera: 'pull',
    image: {
      src: asset('images/spinel.jpg'),
      alt: 'Spinel octahedron',
      fit: 'contain',
    },
    kicker: 'Aaron Celestian · NHMLAC',
    title: 'Let’s build the next\nframework together.',
    notes:
      'Thank you. Happy to talk spinel operando work, zirconium silicate neutrons, rowleyite analogs, or how to query the collection against a selectivity target. aaroncelestian.github.io/MineralSciences — CV, papers, and contact.',
  },
]
