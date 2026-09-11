// Loads /data/fred/bundle.json (written by scripts/fetch-fred.mjs) and derives
// the series the charts draw from the raw FRED levels.

import {
  diff, fromBundle, last, negativeSpans, normFreq, parseDate, recessionSpans, scale, subtractByMonth, yoy,
  type Freq, type Series, type Span,
} from './compute';
import type { Key } from './registry';

export interface ManifestEntry {
  id: string;
  name: string;
  units: string;
  frequency: string;
  source: string;
  sourceUrl: string | null;
  release: string | null;
  releaseUrl: string | null;
  firstDate: string;
  lastDate: string;
  observations: number;
  fredUpdated: string | null;
  fredUrl: string;
  csvUrl: string;
  localCsv: string;
}

export interface Bundle {
  fetchedAt: string;
  series: ManifestEntry[];
  data: Record<string, { dates: string[]; values: number[] }>;
}

export interface MacroData {
  fetchedAt: string;
  manifest: ManifestEntry[];
  series: Record<Key, Series>;
  freq: Record<Key, Freq>;
  recessions: Span[];
  /** Stretches where the 10y−2y spread sat below zero. */
  inversions: Span[];
  /** Latest observation across everything drawn. */
  dataEnd: number;
}

export function derive(b: Bundle): MacroData {
  if (!b || typeof b.fetchedAt !== 'string' || !Array.isArray(b.series) || !b.data || typeof b.data !== 'object') {
    throw new Error('bundle.json has an unexpected shape');
  }
  const raw = (id: string): Series => {
    const e = b.data[id];
    if (!e || !Array.isArray(e.dates) || !Array.isArray(e.values) || e.dates.length !== e.values.length) {
      throw new Error(`bundle.json is missing ${id}`);
    }
    return fromBundle(e);
  };
  const freqOf = (id: string): Freq => normFreq(b.series.find(s => s.id === id)?.frequency);

  const fedfunds = raw('FEDFUNDS');
  const corePce = yoy(raw('PCEPILFE'));

  const series: Record<Key, Series> = {
    FEDFUNDS: fedfunds,
    DGS2: raw('DGS2'),
    DGS10: raw('DGS10'),
    T10Y2Y: raw('T10Y2Y'),
    CPI_YOY: yoy(raw('CPIAUCSL')),
    CORECPI_YOY: yoy(raw('CPILFESL')),
    COREPCE_YOY: corePce,
    REAL_RATE: subtractByMonth(fedfunds, corePce),
    UNRATE: raw('UNRATE'),
    PAYROLL_CHG: diff(raw('PAYEMS')),
    GDP: raw('A191RL1Q225SBEA'),
    MORTGAGE30US: raw('MORTGAGE30US'),
    BAA10Y: raw('BAA10Y'),
    WALCL_T: scale(raw('WALCL'), 1e-6),
    SAHM: raw('SAHMREALTIME'),
    RECPROB: raw('RECPROUSM156N'),
    PERMIT: raw('PERMIT'),
    HOUST: raw('HOUST'),
    HPI_YOY: yoy(raw('CSUSHPINSA')),
    DURABLES_YOY: yoy(raw('ADXTNO')),
    TOTALSA: raw('TOTALSA'),
  };

  const freq: Record<Key, Freq> = {
    FEDFUNDS: freqOf('FEDFUNDS'),
    DGS2: freqOf('DGS2'),
    DGS10: freqOf('DGS10'),
    T10Y2Y: freqOf('T10Y2Y'),
    CPI_YOY: 'monthly',
    CORECPI_YOY: 'monthly',
    COREPCE_YOY: 'monthly',
    REAL_RATE: 'monthly',
    UNRATE: freqOf('UNRATE'),
    PAYROLL_CHG: 'monthly',
    GDP: freqOf('A191RL1Q225SBEA'),
    MORTGAGE30US: freqOf('MORTGAGE30US'),
    BAA10Y: freqOf('BAA10Y'),
    WALCL_T: freqOf('WALCL'),
    SAHM: freqOf('SAHMREALTIME'),
    RECPROB: freqOf('RECPROUSM156N'),
    PERMIT: freqOf('PERMIT'),
    HOUST: freqOf('HOUST'),
    HPI_YOY: 'monthly',
    DURABLES_YOY: 'monthly',
    TOTALSA: freqOf('TOTALSA'),
  };

  let dataEnd = 0;
  for (const s of Object.values(series)) {
    const l = last(s);
    if (l && l.t > dataEnd) dataEnd = l.t;
  }

  return {
    fetchedAt: b.fetchedAt,
    manifest: b.series,
    series,
    freq,
    recessions: recessionSpans(raw('USREC')),
    // ~20 trading days: long enough to be an episode, short enough to keep 2019's.
    inversions: negativeSpans(series.T10Y2Y, 20),
    dataEnd,
  };
}

export async function loadMacro(url = '/data/fred/bundle.json'): Promise<MacroData> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return derive((await r.json()) as Bundle);
}

/** Latest date across the manifest without parsing the whole bundle. */
export function manifestEnd(manifest: ManifestEntry[]): number {
  return Math.max(...manifest.filter(m => m.id !== 'USREC').map(m => parseDate(m.lastDate)));
}
