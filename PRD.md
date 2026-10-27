# Product Requirements

A one-page U.S. macro dashboard: the moving parts of the economy from FRED, each chart answering one plain question. Built for a finance professor (Teddy's dad) who wanted "one place to see all the moving things in the macro economy." Public repo (`theodorewright11/macro_eco_dashboard`), MIT licensed, live at **macroecodashboard.vercel.app**.

## Audience

- **The professor**, and anyone he shares it with: opens it, reads it, hovers. No sign-in, no setup.
- **Teddy**, who maintains it and uses it as a portfolio piece.

## What's on the page

One route, `/`. Desktop-first, works on a phone.

| Block | Content |
|---|---|
| **Header** | Title, one-line description, "Data through (date)", recession-shading key, and the **5Y / 10Y / 20Y / Max** window toggle (default 10Y). The toggle scopes every chart. |
| **Six tiles** | Fed funds rate · 10-year Treasury · CPI inflation (YoY) · core PCE inflation (YoY) · unemployment rate · real GDP growth. Each: current value, change from a year earlier, five-year sparkline, date and cadence of the last observation. |
| **Eight question-led charts** | Is policy tight or loose? · What is the yield curve saying? · Is the labor market holding? · Where is inflation coming from? · Is a recession starting? (Sahm rule, recession probability) · Are people buying big things? (durable goods, vehicle sales) · How tight are financial conditions? (mortgage rate, Baa spread, Fed balance sheet) · What is housing doing? (permits, starts, Case-Shiller). |
| **Data & sources** | A collapsed table at the bottom: every series with FRED ID, units, cadence, source agency, last observation, how the page uses it, and links to the FRED page, the committed CSV and the live CSV. |

Every time series carries NBER recession shading. Hover (or focus and arrow-key) any chart for exact values and dates. The yield-curve card also shades inversions.

## Scope

In:
- FRED series only, no API key, no accounts, no backend.
- Static site; data committed to the repo and refreshed weekly by a GitHub Action.
- Plain-language framing: every chart has a question title and a subtitle that explains how to read it.
- Derived series computed on the page from published levels (YoY, payroll change, real policy rate, Fed balance sheet in trillions). Nothing else is transformed.

Out:
- Forecasts, alerts, user settings, saved views, auth.
- Non-FRED data sources.
- A charting library (charts are hand-rolled SVG).

## Known data quirks (stated on the page)

- CPI inflation uses the seasonally adjusted index, so it can differ from the BLS headline by about a tenth.
- BLS never published October 2025: that month has no YoY value and no unemployment rate.
- The Sahm rule is the real-time variant (unemployment as known each month, not as later revised).
- Sahm rule and recession probability are coincident, not leading.

## Status

Shipped and live. Three feature commits (Sep 8-11, 2026), then weekly automated "Refresh FRED data" commits. No known bugs.

## Open questions

- Is the Vercel project connected to the GitHub repo for auto-deploy on every push? The README says to set it up that way and nothing is configured in-repo; not verified.
- `README.md` still describes five charts and 14 series; the page now has eight charts and 21 series. Update it when next touching docs.
