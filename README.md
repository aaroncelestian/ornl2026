# ORNL 2026 — Museum Collections as Blueprints for Engineered Materials

Invited talk (~40–50 min) for Oak Ridge National Laboratory scientists.

Dark-room cinema deck: specimens and interactive plots on a black stage, argument in your voice. Scroll-snap + keyboard + fullscreen. Forked from the Dallas 2026 presentation shell; rebuilt for science depth and collaboration.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Stage window (Zoom)

Do **not** use browser fullscreen — Zoom keeps sharing the old window and the slides freeze.

From the rehearsal tab, press **P** (or click **Stage**). That opens a chrome-less window for Zoom. Share **that window**.

Or, with the server already running:

```bash
npm run stage
```

## Present keys

| Key | Action |
|-----|--------|
| `→` `↓` `Space` `PageDown` | Next beat |
| `←` `↑` `PageUp` | Previous |
| `Home` / `End` | First / last |
| `P` | Open stage window (share this in Zoom) |
| `Esc` or `P` again | Leave stage |
| Print button | Speaker script — copy for an AI, or print / save as PDF |
| `Shift+F` | Native fullscreen (breaks Zoom window-share) |
| `H` | Lokelma H/K exchange (on structure beats) |
| `1`–`9` | Jump to scene beat N |
| Drag | Orbit Lokelma structure or rowleyite void |
| Hover counter | Jump to a slide or scene beat |

## Argument

Natural mineral frameworks solved selective ion transport and molecular capture before engineered solutions existed. A curated museum collection is a searchable topology library. Three deep cases:

1. **Spinel interstitial chemistry → λ-MnO₂ DLE** (ORNL / Element3 / R&D 100)
2. **Zirconosilicate / titanosilicate convergence → Lokelma (~3 Å K⁺ binder)**
3. **Rowleyite cages → synthetic drug-delivery scaffold**

Close on the working museum + national-lab characterization pipeline.

Outline: [`docs/ORNL_Talk_Outline.md`](docs/ORNL_Talk_Outline.md). Slides source of truth: [`src/data/slides.ts`](src/data/slides.ts).

## Interactive plots

| Motif | Beats |
|-------|--------|
| `SelectivityPlume` | Li⁺ selectivity vs ionic radius (NYT-style spaghetti; λ-MnO₂ highlighted) |
| `LithiumCycle` | Process loop (brine → absorb → CO₂ → Li₂CO₃ → recycle) |
| `FrameworkLineage` | Natural precedents → ZS-9 / Lokelma |
| `PoreGate` | Hydrated diameters vs ~3 Å window |
| `CrystalViewer` | ZS-9 structure + H exchange |
| `VoidViewer` / `VoidFit` | Rowleyite voids + guest volume match |

## Timing guide (~45 min)

- Open + history + thesis: ~8 min
- Spinel / DLE + plume + cycle: ~12–14 min
- Lokelma lineage + pore + structure: ~12–14 min
- Rowleyite: ~8–10 min
- Pipeline + close: ~6–8 min

Hold on the selectivity plume peak, the pore gate, the H-exchange lock, and the pipeline ask.

## Build for projector / USB

```bash
npm run offline
```

Writes `offline/Celestian_ORNL2026/` and a zip. AV double-clicks `Celestian_ORNL2026.html` — no Node, no internet.

```bash
npm run build
```

`dist/` is the web build. Opening `dist/index.html` from disk often fails in Chrome (`file://` modules). Use `npm run offline` for USB.
