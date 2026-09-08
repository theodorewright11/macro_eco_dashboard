import type { Freq } from './compute';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Real minus sign, not a hyphen. */
const MINUS = '−';

export function fixed(v: number, dp: number): string {
  const s = Math.abs(v).toFixed(dp);
  return v < 0 && Number(s) !== 0 ? MINUS + s : s;
}

export function pct(v: number, dp = 2): string {
  return fixed(v, dp) + '%';
}

/** "+0.38 pt" / "−0.12 pt" / "0.00 pt". Percentage points, for changes in a rate. */
export function signedPt(v: number, dp = 2): string {
  const s = Math.abs(v).toFixed(dp);
  if (Number(s) === 0) return `0${dp ? '.' + '0'.repeat(dp) : ''} pt`;
  return (v > 0 ? '+' : MINUS) + s + ' pt';
}

/** Thousands of jobs: "+142k", "−20.5M". */
export function jobs(v: number, signed = true): string {
  if (v === 0) return '0';
  const sign = v < 0 ? MINUS : signed && v > 0 ? '+' : '';
  const a = Math.abs(v);
  if (a >= 1000) return `${sign}${(a / 1000).toFixed(1)}M`;
  return `${sign}${Math.round(a)}k`;
}

/** Trillions, from a value already in trillions. */
export function trillions(v: number, dp = 2): string {
  return `$${fixed(v, dp)}T`;
}

export function dateLabel(t: number, freq: Freq): string {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (freq === 'quarterly') return `Q${Math.floor(m / 3) + 1} ${y}`;
  if (freq === 'monthly') return `${MONTHS[m]} ${y}`;
  return `${MONTHS[m]} ${d.getUTCDate()}, ${y}`;
}

export function longDate(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Axis labels: years, or "Mar 24" when the ticks are months. */
export function tickLabel(t: number, monthly: boolean): string {
  const d = new Date(t);
  if (!monthly) return String(d.getUTCFullYear());
  const m = d.getUTCMonth();
  return m === 0 ? String(d.getUTCFullYear()) : `${MONTHS[m]} ${String(d.getUTCFullYear()).slice(2)}`;
}

export function isoDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** "Sep 8, 2026, 03:43 UTC" — identical on the build server and in every browser. */
export function utcStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${longDate(d.getTime())}, ${hh}:${mm} UTC`;
}

/** The same instant in the viewer's zone; only call after mount. */
export function localStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}
