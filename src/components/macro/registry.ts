// What the dashboard shows and how each series is drawn. Names, units and
// sources come from manifest.json at runtime; this file holds only what the
// data file can't know: colours, formats and the plain-language framing.

import type { Freq } from './compute';
import { fixed, jobs, millions, pct, signedPt, trillions, units } from './format';

/** Keys of the series the charts draw, raw and derived. */
export type Key =
  | 'FEDFUNDS' | 'DGS2' | 'DGS10' | 'T10Y2Y'
  | 'CPI_YOY' | 'CORECPI_YOY' | 'COREPCE_YOY' | 'REAL_RATE'
  | 'UNRATE' | 'PAYROLL_CHG' | 'GDP'
  | 'MORTGAGE30US' | 'BAA10Y' | 'WALCL_T'
  | 'SAHM' | 'RECPROB'
  | 'PERMIT' | 'HOUST' | 'HPI_YOY'
  | 'DURABLES_YOY' | 'TOTALSA';

/**
 * One colour per series, everywhere it appears. Families carry meaning:
 * blues for rates, warm hues for inflation, green for labour, ink for a
 * derived line (a spread or a real rate) because that line is the answer.
 * Every pair that shares a panel was run through the dataviz palette
 * validator on a white surface.
 */
export const COLOR: Record<Key, string> = {
  FEDFUNDS: '#2F6BFF',
  DGS10: '#1D4ED8',
  DGS2: '#0D9488',
  T10Y2Y: '#111827',
  CPI_YOY: '#D97706',
  CORECPI_YOY: '#7C3AED',
  COREPCE_YOY: '#E11D48',
  REAL_RATE: '#111827',
  UNRATE: '#16A34A',
  PAYROLL_CHG: '#16A34A',
  GDP: '#475467',
  MORTGAGE30US: '#0369A1',
  BAA10Y: '#C2410C',
  WALCL_T: '#64748B',
  SAHM: '#111827',
  RECPROB: '#B42318',
  PERMIT: '#0891B2',
  HOUST: '#155E75',
  HPI_YOY: '#9A3412',
  DURABLES_YOY: '#4338CA',
  TOTALSA: '#B45309',
};

/** Neutral grey behind every time series: NBER recession months. */
export const RECESSION_FILL = 'rgba(16, 24, 40, 0.07)';
/** Full-height rose band on the yield-curve card while the 10y−2y spread is below zero. */
export const INVERSION_BAND = 'rgba(225, 29, 72, 0.10)';
/** The wash between the spread line and zero, and the colour the line turns, while inverted. */
export const INVERSION_FILL = 'rgba(225, 29, 72, 0.28)';
export const INVERSION_STROKE = '#E11D48';

/** Short names used in legends, tooltips and tiles. */
export const NAME: Record<Key, string> = {
  FEDFUNDS: 'Fed funds rate',
  DGS2: '2-year Treasury',
  DGS10: '10-year Treasury',
  T10Y2Y: '10-year minus 2-year',
  CPI_YOY: 'Headline CPI',
  CORECPI_YOY: 'Core CPI',
  COREPCE_YOY: 'Core PCE',
  REAL_RATE: 'Real policy rate',
  UNRATE: 'Unemployment rate',
  PAYROLL_CHG: 'Payroll change',
  GDP: 'Real GDP growth',
  MORTGAGE30US: '30-year mortgage rate',
  BAA10Y: 'Baa spread',
  WALCL_T: 'Fed balance sheet',
  SAHM: 'Sahm rule',
  RECPROB: 'Recession probability',
  PERMIT: 'Building permits',
  HOUST: 'Housing starts',
  HPI_YOY: 'Home prices, Case-Shiller',
  DURABLES_YOY: 'Durable goods orders',
  TOTALSA: 'Vehicle sales',
};

/** Rates read as percents; spreads and the real rate read as percentage points. */
export const FORMAT: Record<Key, (v: number) => string> = {
  FEDFUNDS: v => pct(v, 2),
  DGS2: v => pct(v, 2),
  DGS10: v => pct(v, 2),
  T10Y2Y: v => signedPt(v, 2),
  CPI_YOY: v => pct(v, 1),
  CORECPI_YOY: v => pct(v, 1),
  COREPCE_YOY: v => pct(v, 1),
  REAL_RATE: v => signedPt(v, 2),
  UNRATE: v => pct(v, 1),
  PAYROLL_CHG: v => jobs(v),
  GDP: v => pct(v, 1),
  MORTGAGE30US: v => pct(v, 2),
  BAA10Y: v => `${fixed(v, 2)} pt`,
  WALCL_T: v => trillions(v, 2),
  SAHM: v => `${fixed(v, 2)} pt`,
  RECPROB: v => pct(v, 1),
  PERMIT: v => units(v),
  HOUST: v => units(v),
  HPI_YOY: v => pct(v, 1),
  DURABLES_YOY: v => pct(v, 1),
  TOTALSA: v => millions(v),
};

/** Axis tick formats: fewer decimals, no sign noise. */
export const AXIS = {
  pct: (v: number) => `${v}%`,
  pt: (v: number) => (v === 0 ? '0' : `${v} pt`),
  jobs: (v: number) => jobs(v, false),
  trillions: (v: number) => trillions(v, Number.isInteger(v) ? 0 : 1),
  units: (v: number) => units(v, 1),
  millions: (v: number) => millions(v, 0),
};

export interface TileSpec {
  key: Key;
  label: string;
  /** One quiet line under the label: what the number is, exactly. */
  qualifier: string;
  freq: Freq;
  /** Change from a year earlier, in the unit that makes sense for the metric. */
  delta: (v: number) => string;
}

export const TILES: TileSpec[] = [
  { key: 'FEDFUNDS', label: 'Fed funds rate', qualifier: 'effective, monthly average', freq: 'monthly', delta: v => signedPt(v, 2) },
  { key: 'DGS10', label: '10-year Treasury', qualifier: 'constant maturity yield', freq: 'daily', delta: v => signedPt(v, 2) },
  { key: 'CPI_YOY', label: 'CPI inflation', qualifier: 'all items, year over year', freq: 'monthly', delta: v => signedPt(v, 1) },
  { key: 'COREPCE_YOY', label: 'Core PCE inflation', qualifier: "Fed's preferred gauge, YoY", freq: 'monthly', delta: v => signedPt(v, 1) },
  { key: 'UNRATE', label: 'Unemployment rate', qualifier: 'U-3, seasonally adjusted', freq: 'monthly', delta: v => signedPt(v, 1) },
  { key: 'GDP', label: 'Real GDP growth', qualifier: 'quarterly, annualized', freq: 'quarterly', delta: v => signedPt(v, 1) },
];

/** Years of history each tile's sparkline shows, whatever the chart window is. */
export const SPARKLINE_YEARS = 5;

/** Bars past this many thousand jobs a month are cut at the plot edge and marked. */
export const PAYROLL_CLAMP = 1000;

/** How each FRED series is used, for the Data & sources table. */
export const USED_AS: Record<string, string> = {
  FEDFUNDS: 'Fed funds rate, as published',
  DGS2: '2-year yield, as published',
  DGS10: '10-year yield, as published',
  T10Y2Y: 'Curve spread, as published (FRED computes 10y − 2y); inverted-curve shading is every stretch below zero',
  CPIAUCSL: 'Headline CPI inflation = % change vs the same month a year earlier, from the seasonally adjusted index (BLS headlines use the unadjusted index, which can differ by a tenth). BLS never published October 2025, so that month is blank.',
  CPILFESL: 'Core CPI inflation = % change vs the same month a year earlier, from the seasonally adjusted index. October 2025 was never published.',
  PCEPILFE: 'Core PCE inflation = % change vs a year earlier; real policy rate = fed funds − this',
  UNRATE: 'Unemployment rate, as published (October 2025 was never published)',
  PAYEMS: 'Payroll change = month-over-month difference, thousands of jobs',
  A191RL1Q225SBEA: 'Real GDP growth, as published (quarterly, seasonally adjusted annual rate)',
  MORTGAGE30US: 'Mortgage rate, as published',
  BAA10Y: 'Credit spread, as published (Baa corporate yield − 10-year Treasury)',
  WALCL: 'Fed balance sheet, rescaled from millions to trillions of dollars',
  USREC: 'Recession shading on every chart (NBER peak-to-trough months)',
  SAHMREALTIME: 'Sahm rule, as published. The real-time variant: it uses the unemployment rate as it was known each month, not as later revised, so the line shows what the signal actually said at the time.',
  RECPROUSM156N: 'Smoothed recession probability, as published (Chauvet–Piger model of payrolls, industrial production, real income and manufacturing sales)',
  PERMIT: 'Building permits, as published (seasonally adjusted annual rate)',
  HOUST: 'Housing starts, as published (seasonally adjusted annual rate)',
  CSUSHPINSA: 'Home-price growth = % change vs the same month a year earlier, from the Case-Shiller national index. Repeat sales of the same houses, so it is not distorted by the mix of what happens to sell. Index level itself (Jan 2000 = 100) is not shown. © S&P Dow Jones Indices LLC; reprinted with permission.',
  ADXTNO: 'Durable goods orders excluding transportation = % change vs the same month a year earlier, from the published dollar level. Transportation is excluded because a single aircraft order swings the headline.',
  TOTALSA: 'Total vehicle sales, as published (seasonally adjusted annual rate, millions of units)',
};

export const RANGES: { label: string; years: number | null }[] = [
  { label: '5Y', years: 5 },
  { label: '10Y', years: 10 },
  { label: '20Y', years: 20 },
  { label: 'Max', years: null },
];
