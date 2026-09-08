// One headline metric: value, change from a year earlier, a sparkline over the
// last few years, and the date of the last observation. Bare stat tiles carry
// no hover of their own; the charts below do that job.

import { useMemo } from 'react';
import { addYears, clip, lttb, yearAgo, type Series, type Span } from './compute';
import { dateLabel } from './format';
import { FORMAT, RECESSION_FILL, SPARKLINE_YEARS, type TileSpec } from './registry';
import { useSize } from './useSize';

interface Props {
  spec: TileSpec;
  data: Series;
  color: string;
  end: number;
  recessions: Span[];
}

function Sparkline({ data, color, end, recessions }: { data: Series; color: string; end: number; recessions: Span[] }) {
  const { ref, w, h } = useSize<HTMLDivElement>();
  const start = addYears(end, -SPARKLINE_YEARS);
  const pts = useMemo(() => lttb(clip(data, start, end), 120), [data, start, end]);

  let path = '';
  let endPt: { x: number; y: number } | null = null;
  let bands: { x: number; w: number }[] = [];
  if (w > 0 && h > 0 && pts.length > 1) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pts) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
    if (hi === lo) { hi += 1; lo -= 1; }
    const x = (t: number) => 3 + ((t - start) / (end - start || 1)) * (w - 6);
    const y = (v: number) => 3 + (1 - (v - lo) / (hi - lo)) * (h - 6);
    path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
    endPt = { x: x(pts[pts.length - 1].t), y: y(pts[pts.length - 1].v) };
    bands = recessions
      .filter(r => r.end > start && r.start < end)
      .map(r => ({ x: x(Math.max(r.start, start)), w: Math.max(1, x(Math.min(r.end, end)) - x(Math.max(r.start, start))) }));
  }

  return (
    <div ref={ref} className="w-full h-9">
      {path && (
        <svg width={w} height={h} className="block overflow-visible" aria-hidden>
          {bands.map(b => <rect key={b.x} x={b.x} y={0} width={b.w} height={h} fill={RECESSION_FILL} />)}
          <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          {endPt && <circle cx={endPt.x} cy={endPt.y} r={2.5} fill={color} stroke="#fff" strokeWidth={1.5} />}
        </svg>
      )}
    </div>
  );
}

export default function Tile({ spec, data, color, end, recessions }: Props) {
  const ya = useMemo(() => yearAgo(data, spec.freq), [data, spec.freq]);
  if (!ya) return null;
  const fmt = FORMAT[spec.key];

  return (
    <div className="rounded-xl border border-fika-border bg-fika-surface px-3 sm:px-4 pt-3 pb-3 min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fika-secondary leading-none truncate">
        {spec.label}
      </div>
      <div className="text-[11px] text-fika-tertiary leading-tight mt-1">{spec.qualifier}</div>
      <div className="font-grotesk text-[27px] font-bold text-fika-text leading-none mt-2.5 tracking-[-0.02em]">{fmt(ya.now.v)}</div>
      <div className="text-[12px] text-fika-secondary leading-tight mt-1.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {ya.delta === null || !ya.then ? 'no year-ago value' : (
          <>
            <span className="font-semibold text-fika-text">{spec.delta(ya.delta)}</span>
            {' '}vs {dateLabel(ya.then.t, spec.freq)}
          </>
        )}
      </div>
      <div className="mt-2">
        <Sparkline data={data} color={color} end={end} recessions={recessions} />
      </div>
      <div className="text-[11px] text-fika-tertiary leading-none mt-1.5 truncate">
        <span className="font-semibold text-fika-secondary">{dateLabel(ya.now.t, spec.freq)}</span> · {spec.freq}
      </div>
    </div>
  );
}
