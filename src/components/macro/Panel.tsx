// One plot: an x axis in time, a y axis in the panel's unit, recession bands,
// reference lines, and either lines or bars. The card above it owns hover
// state so a crosshair can run through every panel in the card at once.

import { useMemo } from 'react';
import {
  clip, extent, indexNearest, lttb, monthTicks, niceScale, yearTicks,
  type Freq, type Series, type Span,
} from './compute';
import { tickLabel } from './format';
import { RECESSION_FILL } from './registry';
import { useSize } from './useSize';

export interface SeriesSpec {
  id: string;
  name: string;
  color: string;
  data: Series;
  format: (v: number) => string;
  freq: Freq;
}

export interface RefLine {
  v: number;
  label?: string;
  dashed?: boolean;
}

export interface Band {
  spans: Span[];
  fill: string;
}

export interface PanelSpec {
  key: string;
  series: SeriesSpec[];
  kind?: 'line' | 'bars';
  yFormat: (v: number) => string;
  refLines?: RefLine[];
  includeZero?: boolean;
  /** Bars only: clip the y domain to ±this and mark bars that run past it. */
  clampAbs?: number;
  /** Wash between the line and zero while it is negative, and optionally the line's colour there. */
  fillSign?: { below: string; strokeBelow?: string };
  /** Extra full-height bands, drawn over the recession bands. */
  bands?: Band[];
  /** Caption above the plot, for panels that have no legend. Rendered by the card. */
  caption?: string;
  flex?: number;
  xAxis?: boolean;
  endLabels?: boolean;
}

interface Props {
  spec: PanelSpec;
  x0: number;
  x1: number;
  recessions: Span[];
  hoverT: number | null;
  onHover: (t: number | null) => void;
}

const FONT = 11;
const TEXT_MUTED = '#667085';
const TEXT_INK = '#111827';
const GRID = '#EEF0F3';
const ZERO = 'rgba(16, 24, 40, 0.28)';
const PAD_T = 10;
/** Same left gutter for every panel in a card, so stacked plots share an x scale. */
const MIN_PAD_L = 44;
const PAD_R_PLAIN = 10;
const PAD_R_LABELS = 50;
const PAD_B_AXIS = 22;
const PAD_B_PLAIN = 6;

function nextMonth(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** A bar with only its data end rounded; the baseline edge stays square. */
function barPath(x: number, y0: number, yEnd: number, w: number): string {
  const r = Math.min(2, w / 2);
  if (w < 6 || Math.abs(yEnd - y0) < r) return `M${x} ${y0}H${x + w}V${yEnd}H${x}Z`;
  if (yEnd < y0) {
    return `M${x} ${y0}V${yEnd + r}Q${x} ${yEnd} ${x + r} ${yEnd}H${x + w - r}Q${x + w} ${yEnd} ${x + w} ${yEnd + r}V${y0}Z`;
  }
  return `M${x} ${y0}V${yEnd - r}Q${x} ${yEnd} ${x + r} ${yEnd}H${x + w - r}Q${x + w} ${yEnd} ${x + w} ${yEnd - r}V${y0}Z`;
}

export default function Panel({ spec, x0, x1, recessions, hoverT, onHover }: Props) {
  const { ref, w, h } = useSize<HTMLDivElement>();
  const bars = spec.kind === 'bars';
  const showEnd = spec.endLabels !== false;
  const showX = spec.xAxis !== false;

  const clipped = useMemo(() => spec.series.map(s => clip(s.data, x0, x1)), [spec.series, x0, x1]);

  const layout = useMemo(() => {
    if (w === 0 || h === 0) return null;
    const vals = extent(clipped);
    let lo = vals ? vals[0] : 0;
    let hi = vals ? vals[1] : 1;
    for (const r of spec.refLines ?? []) {
      lo = Math.min(lo, r.v);
      hi = Math.max(hi, r.v);
    }
    if (spec.includeZero) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    if (spec.clampAbs !== undefined) {
      lo = Math.max(lo, -spec.clampAbs);
      hi = Math.min(hi, spec.clampAbs);
    }
    const padB = showX ? PAD_B_AXIS : PAD_B_PLAIN;
    const ph = Math.max(10, h - PAD_T - padB);
    const tickCount = Math.max(2, Math.min(4, Math.floor(ph / 40)));
    const { domain: [d0, d1], ticks: allTicks } = niceScale(lo, hi, tickCount);
    // niceScale may hand back more ticks than fit; keep every k-th, anchored on zero.
    const k = Math.max(1, Math.ceil((allTicks.length - 1) / tickCount));
    const anchor = Math.max(0, allTicks.indexOf(0)) % k;
    const yTicks = allTicks.filter((_, i) => i % k === anchor);
    const labels = yTicks.map(spec.yFormat);
    const padL = Math.max(MIN_PAD_L, 8 + Math.max(...labels.map(l => l.length)) * (FONT * 0.6));
    const padR = showEnd ? PAD_R_LABELS : PAD_R_PLAIN;
    const pw = Math.max(10, w - padL - padR);
    const x = (t: number) => padL + ((t - x0) / (x1 - x0)) * pw;
    const y = (v: number) => PAD_T + (1 - (v - d0) / (d1 - d0)) * ph;
    const maxTicks = Math.max(2, Math.floor(pw / 64));
    let xTicks = yearTicks(x0, x1, maxTicks);
    let monthly = false;
    const months = (x1 - x0) / (30.44 * 86_400_000);
    // Month labels only for windows too short to hold three year marks.
    if (xTicks.length < 3 && months < 36) {
      const every = [1, 2, 3, 4, 6, 12].find(n => months / n <= maxTicks) ?? 12;
      xTicks = monthTicks(x0, x1, every);
      monthly = true;
    }
    return { padL, padR, padB, pw, ph, x, y, d0, d1, yTicks, xTicks, monthly };
  }, [w, h, clipped, spec, x0, x1, showEnd, showX]);

  const thinned = useMemo(
    () => (layout ? clipped.map(s => lttb(s, Math.ceil(layout.pw * 1.5))) : clipped),
    [clipped, layout],
  );

  if (!layout) return <div ref={ref} className="w-full h-full min-h-0" />;

  const { padL, padB, pw, ph, x, y, d0, d1, yTicks, xTicks, monthly } = layout;
  const clipId = `clip-${spec.key}`;
  const y0 = y(0);
  const bottom = PAD_T + ph;
  const zeroInside = d0 <= 0 && d1 >= 0;
  const clampV = (v: number) => Math.max(d0, Math.min(d1, v));

  const paths = thinned.map(s => {
    let d = '';
    for (let i = 0; i < s.length; i++) d += `${i ? 'L' : 'M'}${x(s[i].t).toFixed(1)} ${y(s[i].v).toFixed(1)}`;
    return d;
  });

  // Hover: snap to the first series that has started by the hovered time.
  // A series that begins later than the pointer simply sits this one out.
  let hoverX: number | null = null;
  const hoverPts: { x: number; y: number; color: string }[] = [];
  if (hoverT !== null) {
    const nearIn = (s: Series) => {
      if (!s.length || hoverT < s[0].t) return null;
      let i = indexNearest(s, hoverT);
      if (s[i].t < x0 && i + 1 < s.length) i += 1; // the lead-in point sits outside the plot
      return s[i].t > x1 ? null : s[i];
    };
    const primary = clipped.map(nearIn).find(o => o !== null);
    hoverX = primary ? x(primary.t) : x(Math.max(x0, Math.min(x1, hoverT)));
    clipped.forEach((s, k) => {
      const o = nearIn(s);
      if (o) hoverPts.push({ x: x(o.t), y: y(clampV(o.v)), color: spec.series[k].color });
    });
  }

  // End labels: the latest value of each series, pushed apart when they collide.
  // A bar is labelled at its right edge; a line at its last point.
  const ends = showEnd
    ? clipped
        .map((s, k) => {
          const o = s[s.length - 1];
          if (!o) return null;
          const yy = y(bars ? clampV(o.v) : o.v);
          return { k, x: bars ? x(nextMonth(o.t)) : x(o.t), yLine: yy, y: yy, text: spec.series[k].format(o.v), color: spec.series[k].color };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .sort((a, b) => a.y - b.y)
    : [];
  const GAP = 13;
  for (let i = 1; i < ends.length; i++) if (ends[i].y < ends[i - 1].y + GAP) ends[i].y = ends[i - 1].y + GAP;
  for (let i = ends.length - 1; i >= 0; i--) {
    const limit = i === ends.length - 1 ? bottom : ends[i + 1].y - GAP;
    if (ends[i].y > limit) ends[i].y = limit;
  }

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    onHover(x0 + Math.max(0, Math.min(1, frac)) * (x1 - x0));
  };

  const barGeom = bars && clipped[0]
    ? clipped[0].map(o => {
        const xa = x(o.t);
        const xb = x(nextMonth(o.t));
        const slot = xb - xa;
        const gap = slot >= 5 ? 2 : slot >= 2.5 ? 1 : 0;
        const v = clampV(o.v);
        return { x: xa + gap / 2, w: Math.max(0.6, slot - gap), yEnd: y(v), up: o.v >= 0, cut: v !== o.v };
      })
    : [];
  // One marker per run of cut bars, so the 2020 months don't stack six triangles.
  const cutRuns: { x: number; up: boolean }[] = [];
  for (let i = 0; i < barGeom.length; i++) {
    const b = barGeom[i];
    if (!b.cut) continue;
    const prev = barGeom[i - 1];
    if (prev && prev.cut && prev.up === b.up) {
      const run = cutRuns[cutRuns.length - 1];
      run.x = (run.x + b.x + b.w) / 2;
    } else {
      cutRuns.push({ x: b.x + b.w / 2, up: b.up });
    }
  }

  const bandRects = (spans: Span[], fill: string, prefix: string) =>
    spans.map(r =>
      r.end < x0 || r.start > x1 ? null : (
        <rect
          key={`${prefix}${r.start}`}
          x={x(Math.max(r.start, x0))}
          y={PAD_T}
          width={Math.max(1, x(Math.min(r.end, x1)) - x(Math.max(r.start, x0)))}
          height={ph}
          fill={fill}
        />
      ),
    );

  return (
    <div ref={ref} className="relative w-full h-full min-h-0">
      <svg width={w} height={h} className="block overflow-visible select-none" style={{ fontFamily: 'inherit' }}>
        <defs>
          <clipPath id={clipId}>
            <rect x={padL} y={PAD_T} width={pw} height={ph} />
          </clipPath>
          {spec.fillSign && (
            <clipPath id={`${clipId}-below`}>
              <rect x={padL} y={y0} width={pw} height={Math.max(0, bottom - y0)} />
            </clipPath>
          )}
        </defs>

        {bandRects(recessions, RECESSION_FILL, 'r')}
        {(spec.bands ?? []).map((b, i) => bandRects(b.spans, b.fill, `b${i}-`))}

        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} x2={padL + pw} y1={y(v)} y2={y(v)} stroke={v === 0 && zeroInside ? ZERO : GRID} strokeWidth={1} shapeRendering="crispEdges" />
            <text x={padL - 6} y={y(v)} dy="0.35em" textAnchor="end" fontSize={FONT} fill={TEXT_MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {spec.yFormat(v)}
            </text>
          </g>
        ))}
        {zeroInside && !yTicks.includes(0) && (
          <line x1={padL} x2={padL + pw} y1={y0} y2={y0} stroke={ZERO} strokeWidth={1} shapeRendering="crispEdges" />
        )}

        {(spec.refLines ?? []).map(r =>
          r.v === 0 ? null : (
            <line key={r.v} x1={padL} x2={padL + pw} y1={y(r.v)} y2={y(r.v)} stroke={ZERO} strokeWidth={1} strokeDasharray={r.dashed ? '3 3' : undefined} />
          ),
        )}

        {showX &&
          xTicks.map(t => (
            <text key={t} x={x(t)} y={h - 6} textAnchor="middle" fontSize={FONT} fill={TEXT_MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {tickLabel(t, monthly)}
            </text>
          ))}

        <g clipPath={`url(#${clipId})`}>
          {spec.fillSign && paths[0] && (
            <path
              d={`${paths[0]}L${x(x1).toFixed(1)} ${y0.toFixed(1)}L${x(x0).toFixed(1)} ${y0.toFixed(1)}Z`}
              fill={spec.fillSign.below}
              clipPath={`url(#${clipId}-below)`}
            />
          )}

          {bars
            ? barGeom.map((b, i) => (
                <path key={i} d={barPath(b.x, y0, b.yEnd, b.w)} fill={spec.series[0].color} opacity={0.85} />
              ))
            : paths.map((d, k) => (
                <path key={spec.series[k].id} d={d} fill="none" stroke={spec.series[k].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              ))}

          {spec.fillSign?.strokeBelow && paths[0] && (
            <path d={paths[0]} fill="none" stroke={spec.fillSign.strokeBelow} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipId}-below)`} />
          )}
        </g>

        {cutRuns.map((r, i) => (
          <path key={i} d={r.up ? `M${r.x} ${PAD_T - 1}l-3 5h6z` : `M${r.x} ${bottom + 1}l-3 -5h6z`} fill={TEXT_INK} />
        ))}

        {(spec.refLines ?? []).map(r =>
          r.label ? (
            <text key={`l${r.v}`} x={padL + pw - 4} y={y(r.v) - 4} textAnchor="end" fontSize={10.5} fontWeight={600} fill={TEXT_MUTED} stroke="#fff" strokeWidth={3} paintOrder="stroke">
              {r.label}
            </text>
          ) : null,
        )}

        {ends.map(e => (
          <g key={e.k}>
            {Math.abs(e.y - e.yLine) > 1 && (
              <line x1={e.x} y1={e.yLine} x2={e.x + 7} y2={e.y} stroke={e.color} strokeWidth={1} opacity={0.6} />
            )}
            {!bars && <circle cx={e.x} cy={e.yLine} r={3.5} fill={e.color} stroke="#fff" strokeWidth={2} />}
            <text x={e.x + 9} y={e.y} dy="0.35em" fontSize={11.5} fontWeight={700} fill={TEXT_INK} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {e.text}
            </text>
          </g>
        ))}

        {hoverX !== null && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={PAD_T} y2={bottom} stroke={TEXT_INK} strokeWidth={1} opacity={0.35} />
            {hoverPts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4} fill={p.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        )}

        <rect
          data-plot=""
          x={padL}
          y={PAD_T}
          width={pw}
          height={ph + (showX ? padB : 0)}
          fill="transparent"
          style={{ cursor: 'crosshair', touchAction: 'pan-y' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={e => { if (e.pointerType !== 'touch') onHover(null); }}
          onPointerCancel={() => onHover(null)}
        />
      </svg>
    </div>
  );
}
