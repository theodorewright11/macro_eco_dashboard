// Pure helpers for the macro dashboard: parsing FRED observations, the
// transformations the charts need (year-over-year, monthly change, real rate),
// windowing, recession spans, downsampling, and axis ticks. No DOM, no React,
// so it can be tested with plain node (see compute.test.mjs).

export interface Obs {
  /** UTC midnight, milliseconds. */
  t: number;
  v: number;
}
export type Series = Obs[];

export type Freq = 'daily' | 'weekly' | 'monthly' | 'quarterly';

const DAY = 86_400_000;

export function parseDate(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromBundle(e: { dates: string[]; values: number[] }): Series {
  const out: Series = new Array(e.dates.length);
  for (let i = 0; i < e.dates.length; i++) out[i] = { t: parseDate(e.dates[i]), v: e.values[i] };
  return out;
}

/** FRED's frequency strings ("Weekly, Ending Thursday") to one word. */
export function normFreq(s: string | null | undefined): Freq {
  const f = (s ?? '').toLowerCase();
  if (f.startsWith('daily')) return 'daily';
  if (f.startsWith('weekly')) return 'weekly';
  if (f.startsWith('quarterly')) return 'quarterly';
  return 'monthly';
}

/** Months since year 0, so two observations in the same month share a key. */
export function monthKey(t: number): number {
  const d = new Date(t);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

export function addYears(t: number, years: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate());
}

export function last(s: Series): Obs | undefined {
  return s[s.length - 1];
}

/** Largest index with t <= target, by binary search. */
export function indexAtOrBefore(s: Series, t: number): number {
  let lo = 0;
  let hi = s.length - 1;
  if (hi < 0 || s[0].t > t) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function atOrBefore(s: Series, t: number): Obs | undefined {
  const i = indexAtOrBefore(s, t);
  return i < 0 ? undefined : s[i];
}

/** Index of the observation nearest in time to t. */
export function indexNearest(s: Series, t: number): number {
  if (s.length === 0) return -1;
  const i = indexAtOrBefore(s, t);
  if (i < 0) return 0;
  if (i >= s.length - 1) return s.length - 1;
  return t - s[i].t <= s[i + 1].t - t ? i : i + 1;
}

/**
 * Percent change versus the same month a year earlier. Matches by calendar
 * month rather than by position, so a gap in the data can't shift the base.
 */
export function yoy(s: Series): Series {
  const byMonth = new Map<number, number>();
  for (const o of s) byMonth.set(monthKey(o.t), o.v);
  const out: Series = [];
  for (const o of s) {
    const base = byMonth.get(monthKey(o.t) - 12);
    if (base === undefined || base === 0) continue;
    out.push({ t: o.t, v: (o.v / base - 1) * 100 });
  }
  return out;
}

/** Change from the previous observation. */
export function diff(s: Series): Series {
  const out: Series = [];
  for (let i = 1; i < s.length; i++) out.push({ t: s[i].t, v: s[i].v - s[i - 1].v });
  return out;
}

/** a − b, matched by calendar month. Only months present in both survive. */
export function subtractByMonth(a: Series, b: Series): Series {
  const byMonth = new Map<number, number>();
  for (const o of b) byMonth.set(monthKey(o.t), o.v);
  const out: Series = [];
  for (const o of a) {
    const bv = byMonth.get(monthKey(o.t));
    if (bv === undefined) continue;
    out.push({ t: o.t, v: o.v - bv });
  }
  return out;
}

export function scale(s: Series, k: number): Series {
  return s.map(o => ({ t: o.t, v: o.v * k }));
}

export interface YearAgo {
  now: Obs;
  then: Obs | null;
  delta: number | null;
}

/**
 * The latest value and the one a year before it. Monthly and quarterly series
 * want the same calendar month; daily and weekly take the last observation on
 * or before the date a year back.
 */
export function yearAgo(s: Series, freq: Freq): YearAgo | null {
  const now = last(s);
  if (!now) return null;
  let then: Obs | undefined;
  if (freq === 'monthly' || freq === 'quarterly') {
    const want = monthKey(now.t) - 12;
    then = s.find(o => monthKey(o.t) === want);
  } else {
    then = atOrBefore(s, addYears(now.t, -1));
  }
  return { now, then: then ?? null, delta: then ? now.v - then.v : null };
}

export interface Span {
  start: number;
  end: number;
}

/**
 * Contiguous runs of 1s in USREC as [start, end) spans. The end is the start
 * of the first non-recession month after the run, so shading covers the whole
 * of the last recession month.
 */
export function recessionSpans(usrec: Series): Span[] {
  const spans: Span[] = [];
  let start: number | null = null;
  for (let i = 0; i < usrec.length; i++) {
    const o = usrec[i];
    if (o.v === 1 && start === null) start = o.t;
    if (o.v !== 1 && start !== null) {
      spans.push({ start, end: o.t });
      start = null;
    }
  }
  if (start !== null) {
    const end = last(usrec)!.t;
    const d = new Date(end);
    spans.push({ start, end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) });
  }
  return spans;
}

/**
 * Runs where a series is below zero (an inverted curve), as [start, end)
 * spans. Runs separated by no more than `mergeGap` observations are joined so
 * a brief pop above zero doesn't split one episode into slivers, and runs
 * shorter than `minObs` observations are dropped as noise.
 */
export function negativeSpans(s: Series, minObs = 20, mergeGap = 5): Span[] {
  const runs: { a: number; b: number }[] = [];
  let a = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i].v < 0) {
      if (a < 0) a = i;
    } else if (a >= 0) {
      runs.push({ a, b: i - 1 });
      a = -1;
    }
  }
  if (a >= 0) runs.push({ a, b: s.length - 1 });
  const merged: { a: number; b: number }[] = [];
  for (const r of runs) {
    const prev = merged[merged.length - 1];
    if (prev && r.a - prev.b - 1 <= mergeGap) prev.b = r.b;
    else merged.push({ ...r });
  }
  return merged
    .filter(r => r.b - r.a + 1 >= minObs)
    .map(r => ({ start: s[r.a].t, end: r.b + 1 < s.length ? s[r.b + 1].t : s[r.b].t + DAY }));
}

/**
 * Observations inside [start, end], plus the one just before `start` so a
 * line still enters from the left edge instead of starting mid-plot.
 */
export function clip(s: Series, start: number, end: number): Series {
  if (s.length === 0) return s;
  let i = indexAtOrBefore(s, start);
  if (i < 0) i = 0;
  let j = indexAtOrBefore(s, end);
  if (j < 0) return [];
  return s.slice(i, j + 1);
}

export function extent(series: Series[]): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) for (const o of s) {
    if (o.v < lo) lo = o.v;
    if (o.v > hi) hi = o.v;
  }
  return lo === Infinity ? null : [lo, hi];
}

/**
 * Largest-Triangle-Three-Buckets downsampling. Keeps the visual shape (peaks
 * and troughs survive) while cutting a daily series to roughly one point per
 * pixel. Returns the input untouched when it already fits.
 */
export function lttb(s: Series, threshold: number): Series {
  const n = s.length;
  if (threshold >= n || threshold < 3) return s;
  const out: Series = [s[0]];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * every) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
    let avgT = 0;
    let avgV = 0;
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgT += s[j].t;
      avgV += s[j].v;
    }
    const len = rangeEnd - rangeStart;
    avgT /= len;
    avgV /= len;

    const bStart = Math.floor(i * every) + 1;
    const bEnd = Math.min(Math.floor((i + 1) * every) + 1, n);
    const at = s[a].t;
    const av = s[a].v;
    let maxArea = -1;
    let next = bStart;
    for (let j = bStart; j < bEnd; j++) {
      const area = Math.abs((at - avgT) * (s[j].v - av) - (at - s[j].t) * (avgV - av));
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    out.push(s[next]);
    a = next;
  }
  out.push(s[n - 1]);
  return out;
}

/** d3's tick step: 1, 2 or 5 times a power of ten. */
export function tickStep(lo: number, hi: number, count: number): number {
  const step0 = Math.abs(hi - lo) / Math.max(1, count);
  if (step0 === 0) return 1;
  const power = 10 ** Math.floor(Math.log10(step0));
  const err = step0 / power;
  const f = err >= Math.sqrt(50) ? 10 : err >= Math.sqrt(10) ? 5 : err >= Math.sqrt(2) ? 2 : 1;
  return power * f;
}

export function niceTicks(lo: number, hi: number, count: number): number[] {
  if (lo === hi) return [lo];
  const step = tickStep(lo, hi, count);
  const start = Math.ceil(lo / step);
  const stop = Math.floor(hi / step);
  const out: number[] = [];
  for (let i = start; i <= stop; i++) out.push(round(i * step));
  return out;
}

/** Expand [lo, hi] outward to tick boundaries. */
export function niceDomain(lo: number, hi: number, count: number): [number, number] {
  if (lo === hi) return [lo - 1, hi + 1];
  const step = tickStep(lo, hi, count);
  return [round(Math.floor(lo / step) * step), round(Math.ceil(hi / step) * step)];
}

/**
 * Domain and ticks from one step, so the ticks always land on the domain's
 * ends. Computing them separately let the padded domain pick a coarser step
 * and lose every tick but zero.
 */
export function niceScale(lo: number, hi: number, count: number): { domain: [number, number]; ticks: number[] } {
  if (lo === hi) return { domain: [lo - 1, hi + 1], ticks: [lo - 1, lo, lo + 1] };
  const step = tickStep(lo, hi, count);
  const d0 = round(Math.floor(lo / step) * step);
  const d1 = round(Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let v = d0; v <= d1 + step / 2; v += step) ticks.push(round(v));
  return { domain: [d0, d1], ticks };
}

/** Kill floating-point residue like 2.0000000000000004. */
function round(x: number): number {
  return Number(x.toPrecision(12));
}

/** Jan 1 of every Nth year inside [start, end], N chosen so at most `max` fit. */
export function yearTicks(start: number, end: number, max: number): number[] {
  const y0 = new Date(start).getUTCFullYear();
  const y1 = new Date(end).getUTCFullYear();
  const span = Math.max(1, y1 - y0);
  const steps = [1, 2, 5, 10, 20, 25, 50];
  let step = steps[steps.length - 1];
  for (const s of steps) {
    if (span / s <= max) {
      step = s;
      break;
    }
  }
  const out: number[] = [];
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
    const t = Date.UTC(y, 0, 1);
    if (t >= start && t <= end) out.push(t);
  }
  return out;
}

/** Month ticks for short windows, every `everyN` months. */
export function monthTicks(start: number, end: number, everyN: number): number[] {
  const d0 = new Date(start);
  const out: number[] = [];
  let y = d0.getUTCFullYear();
  let m = d0.getUTCMonth();
  if (d0.getUTCDate() !== 1) m += 1;
  m = Math.ceil(m / everyN) * everyN;
  for (;;) {
    const t = Date.UTC(y, m, 1);
    if (t > end) break;
    if (t >= start) out.push(t);
    m += everyN;
  }
  return out;
}

export const MS_PER_DAY = DAY;
