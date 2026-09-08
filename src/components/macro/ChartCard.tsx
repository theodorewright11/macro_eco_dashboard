// A titled card holding one or more panels that share a time window and a
// hover. The title is the question the chart answers; the subtitle says what
// to look for. The tooltip lists every series in the card at the hovered date.

import { useCallback, useMemo, useRef, useState } from 'react';
import { clip, indexNearest, type Freq, type Span } from './compute';
import { dateLabel } from './format';
import Panel, { type PanelSpec } from './Panel';

interface Props {
  title: string;
  subtitle: string;
  panels: PanelSpec[];
  layout?: 'stack' | 'row';
  /** null = the window starts where the data starts. */
  start: number | null;
  end: number;
  recessions: Span[];
  legend?: { name: string; color: string; kind?: 'line' | 'swatch' }[];
  note?: string;
  className?: string;
}

/** Observations per arrow-key press, so a daily series moves about a month. */
const KEY_STEP: Record<Freq, number> = { daily: 21, weekly: 4, monthly: 1, quarterly: 1 };

function firstOf(series: PanelSpec['series']): number {
  let f = Infinity;
  for (const s of series) if (s.data.length && s.data[0].t < f) f = s.data[0].t;
  return f;
}

export default function ChartCard({ title, subtitle, panels, layout = 'stack', start, end, recessions, legend, note, className = '' }: Props) {
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number; touch: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  // Stacked panels share one x axis, so they share the card's earliest date.
  // Side-by-side panels each draw their own axis, so each starts with its own data.
  const x0s = useMemo(() => {
    if (start !== null) return panels.map(() => start);
    const cardFirst = Math.min(...panels.map(p => firstOf(p.series)));
    const fallback = cardFirst === Infinity ? end : cardFirst;
    return panels.map(p => {
      if (layout !== 'row') return fallback;
      const f = firstOf(p.series);
      return f === Infinity ? fallback : f;
    });
  }, [panels, start, end, layout]);

  // Stable spec objects, so Panel's memos survive the re-render every pointer move causes.
  const specs = useMemo(
    () => panels.map((p, i) => ({ ...p, xAxis: p.xAxis ?? (layout === 'row' || i === panels.length - 1) })),
    [panels, layout],
  );

  const onHover = useCallback((t: number | null) => setHoverT(t), []);

  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setPointer({ x: e.clientX - r.left, y: e.clientY - r.top, touch: e.pointerType === 'touch' });
  };

  // Keyboard: arrows walk the first series' observations inside the window.
  const primary = panels[0]?.series[0];
  const primaryX0 = x0s[0] ?? end;
  const primaryClipped = useMemo(
    () => (primary ? clip(primary.data, primaryX0, end).filter(o => o.t >= primaryX0) : []),
    [primary, primaryX0, end],
  );
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!primary || !primaryClipped.length) return;
    if (e.key === 'Escape') { setHoverT(null); return; }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = KEY_STEP[primary.freq] * (e.shiftKey ? 12 : 1) * (e.key === 'ArrowLeft' ? -1 : 1);
    const n = primaryClipped.length;
    const i = hoverT === null ? n - 1 : Math.max(0, Math.min(n - 1, indexNearest(primaryClipped, hoverT) + step));
    const t = primaryClipped[i].t;
    setHoverT(t);
    // Anchor the tooltip on the first panel's plot, where the crosshair is.
    const plot = wrap.current?.querySelector<SVGRectElement>('rect[data-plot]');
    const wr = wrap.current?.getBoundingClientRect();
    if (plot && wr) {
      const pr = plot.getBoundingClientRect();
      setPointer({ x: pr.left - wr.left + ((t - primaryX0) / (end - primaryX0)) * pr.width, y: pr.top - wr.top + 8, touch: false });
    }
  };

  // Tooltip rows: each series' nearest observation to the hovered time. A
  // series that hasn't started yet at that time is left out.
  const rows = useMemo(() => {
    if (hoverT === null) return null;
    const out: { name: string; color: string; value: string; date: string }[] = [];
    let header = '';
    panels.forEach((p, pi) => {
      const px0 = x0s[pi];
      for (const s of p.series) {
        const c = clip(s.data, px0, end);
        if (!c.length || hoverT < c[0].t) continue;
        let i = indexNearest(c, hoverT);
        if (c[i].t < px0 && i + 1 < c.length) i += 1;
        const o = c[i];
        const date = dateLabel(o.t, s.freq);
        if (!header) header = date;
        out.push({ name: s.name, color: s.color, value: s.format(o.v), date });
      }
    });
    return out.length ? { header, rows: out } : null;
  }, [hoverT, panels, x0s, end]);

  let tipStyle: React.CSSProperties | undefined;
  if (rows && pointer) {
    if (pointer.touch) {
      tipStyle = { top: 0, right: 0 };
    } else {
      const wrapW = wrap.current?.clientWidth ?? 600;
      const wrapH = wrap.current?.clientHeight ?? 300;
      const tipW = tip.current?.offsetWidth ?? 190;
      const tipH = tip.current?.offsetHeight ?? 84;
      const left = pointer.x + 12 + tipW > wrapW ? Math.max(0, pointer.x - 12 - tipW) : pointer.x + 12;
      const top = Math.max(0, Math.min(pointer.y + 14, wrapH - tipH));
      tipStyle = { left, top };
    }
  }

  return (
    <section className={`flex flex-col rounded-xl border border-fika-border bg-white p-4 min-w-0 ${className}`}>
      <header className="mb-2">
        <h2 className="font-grotesk text-[17px] font-bold leading-tight text-fika-text m-0 tracking-[-0.01em]">{title}</h2>
        <p className="text-[12.5px] text-fika-secondary leading-snug mt-1 mb-0">{subtitle}</p>
        {legend && legend.length > 0 && (
          <ul className="list-none p-0 m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {legend.map(l => (
              <li key={l.name} className="flex items-center gap-1.5 text-[12px] font-semibold text-fika-secondary leading-none">
                {l.kind === 'swatch' ? (
                  <span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: l.color, border: '1px solid rgba(16,24,40,0.12)' }} />
                ) : (
                  <span className="inline-block w-3.5 h-[2px] rounded-full" style={{ background: l.color }} />
                )}
                {l.name}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div
        ref={wrap}
        className={`relative flex-1 min-h-0 flex outline-none rounded-md focus-visible:ring-2 focus-visible:ring-fika-text/30 focus-visible:ring-offset-2 ${layout === 'row' ? 'flex-col sm:flex-row gap-4 sm:gap-3' : 'flex-col'}`}
        tabIndex={0}
        role="group"
        aria-label={`${title} chart. Left and right arrow keys step through the observations; hold Shift for a year at a time; Escape clears.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onKeyDown={onKey}
        onBlur={() => setHoverT(null)}
      >
        {specs.map((p, i) => (
          <div
            key={p.key}
            className={`min-w-0 min-h-0 flex flex-col ${layout === 'row' ? 'h-[170px] flex-none sm:h-auto sm:flex-1' : ''}`}
            style={layout === 'row' ? undefined : { flex: `${p.flex ?? 1} 1 0` }}
          >
            {p.caption && (
              <div className={`text-[11px] font-bold uppercase tracking-wider text-fika-secondary leading-none mb-1 truncate ${layout === 'stack' && i > 0 ? 'mt-3' : ''}`}>
                {p.caption}
              </div>
            )}
            <div className="flex-1 min-h-0">
              <Panel spec={p} x0={x0s[i]} x1={end} recessions={recessions} hoverT={hoverT} onHover={onHover} />
            </div>
          </div>
        ))}

        {rows && tipStyle && (
          <div
            ref={tip}
            className="absolute z-10 pointer-events-none rounded-lg border border-fika-border bg-white shadow-[0_6px_20px_rgba(16,24,40,0.14)] px-3 py-2 min-w-[150px]"
            style={tipStyle}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-fika-secondary leading-none mb-1.5">{rows.header}</div>
            <ul className="list-none p-0 m-0 space-y-1">
              {rows.rows.map(r => (
                <li key={r.name} className="flex items-baseline gap-2 leading-none">
                  <span className="inline-block w-3 h-[2px] rounded-full self-center shrink-0" style={{ background: r.color }} />
                  <span className="font-grotesk text-[13px] font-bold text-fika-text" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
                  <span className="text-[12px] text-fika-secondary">{r.name}</span>
                  {r.date !== rows.header && <span className="text-[11px] text-fika-tertiary ml-auto pl-2">{r.date}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {note && <p className="text-[11px] text-fika-tertiary leading-snug mt-2 mb-0">{note}</p>}
    </section>
  );
}
