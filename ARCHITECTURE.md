# Architecture

## Stack

- **Astro 5** static site generator, one page.
- **React 19** island (`client:load`) for the whole dashboard.
- **Tailwind 3** (`@astrojs/tailwind`, `applyBaseStyles: false`; base styles live in `global.css`).
- **Hand-rolled SVG charts.** No charting library; runtime dependencies are only Astro, React and Tailwind.
- **Fonts:** Bricolage Grotesque (headings, numbers) and Figtree (body), loaded from Google Fonts in `global.css`.
- **Data:** FRED public CSV endpoint, committed to the repo.
- **Tests:** `node --test` on the pure helpers (relies on Node 24 stripping types from `compute.ts`).

## Folder structure

```
/
├── PRD.md, ARCHITECTURE.md, CLAUDE.md   ← read-first specs
├── README.md                            ← public readme (lags the code, see PRD open questions)
├── astro.config.mjs, tailwind.config.mjs, tsconfig.json
├── .github/workflows/fred.yml           ← Mondays 12:00 UTC (and manual): runs the fetch, commits public/data/fred
├── scripts/fetch-fred.mjs               ← SERIES list, FALLBACK metadata, CSV + series-page fetch, writes public/data/fred
├── public/
│   ├── favicon.svg
│   └── data/fred/                       ← <ID>.csv per series (untouched FRED output), manifest.json, bundle.json (what the page loads)
├── docs/screenshot.png                  ← README image
└── src/
    ├── pages/index.astro                ← the only page: Layout + <MacroDashboard>, manifest.json imported at build
    ├── layouts/Layout.astro             ← html shell, title, favicon
    ├── styles/global.css                ← font import, Tailwind layers, body background
    └── components/macro/
        ├── MacroDashboard.tsx           ← page body: header, window toggle, tiles, the eight ChartCards, Sources. Chart definitions (series, panels, captions, ref lines) live here
        ├── registry.ts                  ← Key type, COLOR, NAME, FORMAT, AXIS, TILES, USED_AS, RANGES, band colours
        ├── data.ts                      ← loadMacro() fetches /data/fred/bundle.json; derive() builds every drawn series from raw levels
        ├── compute.ts                   ← pure helpers: yoy, diff, windowing, recession/inversion spans, LTTB downsampling, nice ticks
        ├── compute.test.mjs             ← 14 unit tests for compute.ts and format.ts
        ├── format.ts                    ← number and date formatters
        ├── ChartCard.tsx                ← card with title, subtitle, legend, note; lays panels out as stack or row; shared hover time
        ├── Panel.tsx                    ← one SVG panel: lines or bars, axes, recession/inversion bands, ref lines, crosshair, end labels
        ├── Tile.tsx                     ← headline tile with sparkline
        ├── Sources.tsx                  ← collapsed Data & sources table
        └── useSize.ts                   ← ResizeObserver hook
```

## Data

Source: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<SERIES>`. No API key. Metadata (name, units, frequency, source, release) is scraped from `https://fred.stlouisfed.org/series/<ID>`; `FALLBACK` in the script fills any field if FRED's markup changes.

The script writes nothing until every series has been fetched, so a failed run leaves the committed files consistent.

| Series | Used as |
|---|---|
| `FEDFUNDS`, `DGS2`, `DGS10`, `T10Y2Y` | Rates and curve spread, as published |
| `CPIAUCSL`, `CPILFESL`, `PCEPILFE` | Headline CPI, core CPI, core PCE: YoY from the index. Real policy rate = fed funds − core PCE YoY |
| `UNRATE`, `PAYEMS` | Unemployment rate; payroll change = month-over-month difference |
| `A191RL1Q225SBEA` | Real GDP growth, quarterly annualized |
| `MORTGAGE30US`, `BAA10Y`, `WALCL` | Mortgage rate, Baa spread, Fed assets (millions → trillions) |
| `SAHMREALTIME`, `RECPROUSM156N` | Sahm rule (real-time), smoothed recession probability |
| `PERMIT`, `HOUST`, `CSUSHPINSA` | Permits, starts, Case-Shiller (YoY) |
| `ADXTNO`, `TOTALSA` | Durable goods ex-transport (YoY), total vehicle sales |
| `USREC` | NBER recession shading |

To add a series: `SERIES` and `FALLBACK` in `scripts/fetch-fred.mjs` → `npm run fred` → `Key` type, `COLOR`, `NAME`, `FORMAT`, `USED_AS` in `registry.ts` → `derive()` in `data.ts` → a panel in `MacroDashboard.tsx`.

## Design

The Fika look: white ground, tinted surface for tiles and cards, ink text. Tokens are the `fika` colours in `tailwind.config.mjs` plus the `grotesk` and `figtree` font families. Container is `max-w-[1160px]`. Each series has one colour everywhere, set in `registry.ts` `COLOR`: blues for rates, warm hues for inflation, green for labour, ink for derived lines. Recession shading is neutral grey; inversion is rose.

## Commands

```
npm install
npm run dev        # http://localhost:4321
npm run build      # static site to dist/
npm run preview    # serve dist/
npm test           # unit tests (Node 24+)
npm run fred       # refetch every series into public/data/fred
```

## Deploy

Static `dist/`, hosted on Vercel at macroecodashboard.vercel.app (Astro auto-detected, default settings; no `vercel.json`). The Monday GitHub Action commits fresh data to `main`; a push to `main` redeploys if the Vercel project is connected to the repo (not verified).

## Env vars

None. `.env` and `.env.*` are gitignored but nothing reads them.

## Known pitfalls

- The Action pushes to `main` weekly, so `git pull` before starting work.
- `compute.test.mjs` imports `.ts` directly: Node older than 24 fails the tests.
- Chart data loads client-side from `/data/fred/bundle.json` after hydration; `manifest.json` is baked into the page for the first paint.
