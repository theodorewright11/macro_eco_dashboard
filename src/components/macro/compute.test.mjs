// node --test src/components/tools/macro/compute.test.mjs
// Node 24 strips the types from compute.ts at import time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDate, fromBundle, yoy, diff, subtractByMonth, yearAgo, recessionSpans, negativeSpans, clip,
  lttb, niceTicks, niceDomain, niceScale, yearTicks, monthTicks, indexNearest, atOrBefore, normFreq,
} from './compute.ts';
import { pct, signedPt, jobs, dateLabel, trillions } from './format.ts';

const D = s => parseDate(s);
const S = pairs => pairs.map(([d, v]) => ({ t: D(d), v }));

test('parseDate is UTC midnight', () => {
  assert.equal(new Date(D('2026-08-01')).toISOString(), '2026-08-01T00:00:00.000Z');
});

test('fromBundle pairs dates with values', () => {
  const s = fromBundle({ dates: ['2020-01-01', '2020-02-01'], values: [1, 2] });
  assert.deepEqual(s, [{ t: D('2020-01-01'), v: 1 }, { t: D('2020-02-01'), v: 2 }]);
});

test('yoy matches the same calendar month a year back and skips months without a base', () => {
  const s = [];
  for (let m = 0; m < 24; m++) s.push({ t: Date.UTC(2020 + Math.floor(m / 12), m % 12, 1), v: 100 + m });
  const y = yoy(s);
  assert.equal(y.length, 12);
  assert.equal(new Date(y[0].t).toISOString().slice(0, 7), '2021-01');
  assert.ok(Math.abs(y[0].v - 12) < 1e-9); // 112/100 − 1
  // A gap shifts nothing: remove Jan 2020, then Jan 2021 has no base.
  const gapped = s.filter(o => o.t !== D('2020-01-01'));
  assert.equal(yoy(gapped).length, 11);
});

test('diff is the change from the previous observation', () => {
  assert.deepEqual(diff(S([['2020-01-01', 10], ['2020-02-01', 12], ['2020-03-01', 11]])),
    S([['2020-02-01', 2], ['2020-03-01', -1]]));
});

test('subtractByMonth aligns by month and drops unmatched months', () => {
  const a = S([['2020-01-01', 5], ['2020-02-01', 5], ['2020-03-01', 5]]);
  const b = S([['2020-01-15', 2], ['2020-03-15', 3]]);
  assert.deepEqual(subtractByMonth(a, b), S([['2020-01-01', 3], ['2020-03-01', 2]]));
});

test('yearAgo: monthly uses the same month, daily uses last obs on or before', () => {
  const m = S([['2025-07-01', 3.0], ['2025-08-01', 3.2], ['2026-07-01', 2.5], ['2026-08-01', 2.7]]);
  const r = yearAgo(m, 'monthly');
  assert.equal(r.then.t, D('2025-08-01'));
  assert.ok(Math.abs(r.delta - (-0.5)) < 1e-9);

  const d = S([['2025-09-02', 4.0], ['2025-09-04', 4.1], ['2026-09-03', 4.77]]);
  const r2 = yearAgo(d, 'daily');
  assert.equal(r2.then.t, D('2025-09-02')); // 2025-09-03 is missing → the obs before it
  const none = yearAgo(S([['2026-01-01', 1]]), 'monthly');
  assert.equal(none.then, null);
  assert.equal(none.delta, null);
});

test('recessionSpans covers whole months and closes an open run', () => {
  const u = S([['2019-12-01', 0], ['2020-01-01', 0], ['2020-02-01', 0], ['2020-03-01', 1], ['2020-04-01', 1], ['2020-05-01', 0], ['2020-06-01', 1]]);
  assert.deepEqual(recessionSpans(u), [
    { start: D('2020-03-01'), end: D('2020-05-01') },
    { start: D('2020-06-01'), end: D('2020-07-01') },
  ]);
});

test('negativeSpans merges small gaps and drops short runs', () => {
  const s = [];
  for (let i = 0; i < 100; i++) {
    // negative 10..39, one-day pop at 25, negative again 42..45 (gap of 2 → merged), short blip at 80..82
    const neg = (i >= 10 && i <= 39 && i !== 25) || (i >= 42 && i <= 45) || (i >= 80 && i <= 82);
    s.push({ t: i * 86400000, v: neg ? -0.5 : 0.5 });
  }
  assert.deepEqual(negativeSpans(s, 20, 5), [{ start: 10 * 86400000, end: 46 * 86400000 }]);
  // An open run at the end closes one day after the last observation.
  const open = [{ t: 0, v: -1 }, { t: 86400000, v: -1 }];
  assert.deepEqual(negativeSpans(open, 2, 0), [{ start: 0, end: 2 * 86400000 }]);
  assert.deepEqual(negativeSpans(open, 3, 0), []);
});

test('clip keeps one observation before the window', () => {
  const s = S([['2020-01-01', 1], ['2020-02-01', 2], ['2020-03-01', 3], ['2020-04-01', 4]]);
  assert.deepEqual(clip(s, D('2020-02-15'), D('2020-03-15')), S([['2020-02-01', 2], ['2020-03-01', 3]]));
  assert.deepEqual(clip(s, D('2019-01-01'), D('2020-02-01')), S([['2020-01-01', 1], ['2020-02-01', 2]]));
  assert.deepEqual(clip(s, D('2021-01-01'), D('2021-06-01')), S([['2020-04-01', 4]]));
});

test('lttb keeps ends and the extreme, and is a no-op under the threshold', () => {
  const s = [];
  for (let i = 0; i < 1000; i++) s.push({ t: i * 86400000, v: i === 500 ? 100 : Math.sin(i / 50) });
  const out = lttb(s, 100);
  assert.equal(out.length, 100);
  assert.equal(out[0], s[0]);
  assert.equal(out[out.length - 1], s[s.length - 1]);
  assert.ok(out.some(o => o.v === 100), 'spike survives');
  assert.equal(lttb(s, 5000), s);
});

test('ticks are clean numbers', () => {
  assert.deepEqual(niceTicks(0.1, 5.3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(niceTicks(-1.2, 2.4, 5), [-1, 0, 1, 2]);
  assert.deepEqual(niceDomain(0.1, 5.3, 5), [0, 6]);
  assert.deepEqual(niceDomain(3.2, 3.9, 4), [3.2, 4]);
  // One step for domain and ticks: the ±2.4/2.9 spread window used to pad to ±4 and then tick at 5.
  assert.deepEqual(niceScale(-2.4, 2.9, 2), { domain: [-4, 4], ticks: [-4, -2, 0, 2, 4] });
  assert.deepEqual(niceScale(3.2, 5.1, 4), { domain: [3, 5.5], ticks: [3, 3.5, 4, 4.5, 5, 5.5] });
  assert.deepEqual(niceScale(0, 0, 3), { domain: [-1, 1], ticks: [-1, 0, 1] });
  assert.deepEqual(yearTicks(D('2016-09-05'), D('2026-09-04'), 12).map(t => new Date(t).getUTCFullYear()),
    [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.deepEqual(yearTicks(D('1954-07-01'), D('2026-09-04'), 8).map(t => new Date(t).getUTCFullYear()),
    [1960, 1970, 1980, 1990, 2000, 2010, 2020]);
  assert.deepEqual(monthTicks(D('2025-09-04'), D('2026-09-04'), 3).map(t => new Date(t).toISOString().slice(0, 7)),
    ['2025-10', '2026-01', '2026-04', '2026-07']);
});

test('nearest / atOrBefore', () => {
  const s = S([['2020-01-01', 1], ['2020-01-10', 2], ['2020-01-20', 3]]);
  assert.equal(indexNearest(s, D('2020-01-04')), 0);
  assert.equal(indexNearest(s, D('2020-01-06')), 1);
  assert.equal(indexNearest(s, D('2019-01-01')), 0);
  assert.equal(indexNearest(s, D('2021-01-01')), 2);
  assert.equal(atOrBefore(s, D('2019-12-31')), undefined);
});

test('normFreq', () => {
  assert.equal(normFreq('Weekly, Ending Thursday'), 'weekly');
  assert.equal(normFreq('Daily, Close'), 'daily');
  assert.equal(normFreq('Quarterly'), 'quarterly');
  assert.equal(normFreq('Monthly'), 'monthly');
});

test('formatting', () => {
  assert.equal(pct(3.625), '3.63%');
  assert.equal(pct(-0.4, 1), '−0.4%');
  assert.equal(signedPt(0.375), '+0.38 pt');
  assert.equal(signedPt(-0.5), '−0.50 pt');
  assert.equal(signedPt(0.001), '0.00 pt');
  assert.equal(jobs(142), '+142k');
  assert.equal(jobs(-20477), '−20.5M');
  assert.equal(jobs(0), '0');
  assert.equal(jobs(500, false), '500k');
  assert.equal(trillions(6.737204), '$6.74T');
  assert.equal(dateLabel(D('2026-04-01'), 'quarterly'), 'Q2 2026');
  assert.equal(dateLabel(D('2026-08-01'), 'monthly'), 'Aug 2026');
  assert.equal(dateLabel(D('2026-09-03'), 'daily'), 'Sep 3, 2026');
});
