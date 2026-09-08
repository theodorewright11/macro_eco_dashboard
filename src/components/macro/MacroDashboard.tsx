// The macro dashboard: six headline tiles, five charts that each answer one
// question, and a collapsed table of every series used. One time window for
// everything, recession shading on every time series.

import { useEffect, useMemo, useState } from 'react';
import ChartCard from './ChartCard';
import { addYears, clip } from './compute';
import { loadMacro, manifestEnd, type MacroData, type ManifestEntry } from './data';
import { longDate } from './format';
import type { PanelSpec, SeriesSpec } from './Panel';
import {
  AXIS, COLOR, FORMAT, INVERSION_BAND, INVERSION_FILL, INVERSION_STROKE, NAME, PAYROLL_CLAMP, RANGES,
  RECESSION_FILL, TILES, type Key,
} from './registry';
import Sources from './Sources';
import Tile from './Tile';

interface Props {
  label?: string;
  manifest: ManifestEntry[];
  fetchedAt: string;
}

export default function MacroDashboard({ label = 'Macro Dashboard', manifest, fetchedAt }: Props) {
  const [data, setData] = useState<MacroData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [years, setYears] = useState<number | null>(10);

  useEffect(() => {
    loadMacro().then(setData).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const end = data ? data.dataEnd : manifestEnd(manifest);
  const start = years === null ? null : addYears(end, -years);

  const charts = useMemo(() => {
    if (!data) return null;
    const S = (key: Key): SeriesSpec =>
      ({ id: key, name: NAME[key], color: COLOR[key], data: data.series[key], format: FORMAT[key], freq: data.freq[key] });
    const inversion = [{ spans: data.inversions, fill: INVERSION_BAND }];
    const policy: PanelSpec[] = [{
      key: 'policy',
      series: [S('FEDFUNDS'), S('COREPCE_YOY'), S('REAL_RATE')],
      yFormat: AXIS.pct,
      includeZero: true,
    }];
    const curve: PanelSpec[] = [
      { key: 'curve', series: [S('DGS2'), S('DGS10')], yFormat: AXIS.pct, bands: inversion, flex: 3 },
      {
        key: 'spread',
        series: [S('T10Y2Y')],
        yFormat: AXIS.pt,
        includeZero: true,
        bands: inversion,
        fillSign: { below: INVERSION_FILL, strokeBelow: INVERSION_STROKE },
        caption: '10-year minus 2-year',
        flex: 2,
      },
    ];
    const labor: PanelSpec[] = [
      { key: 'unrate', series: [S('UNRATE')], yFormat: AXIS.pct, caption: 'Unemployment rate', flex: 3 },
      {
        key: 'payrolls',
        series: [S('PAYROLL_CHG')],
        kind: 'bars',
        yFormat: AXIS.jobs,
        includeZero: true,
        clampAbs: PAYROLL_CLAMP,
        caption: 'Monthly change in nonfarm payrolls',
        flex: 2,
      },
    ];
    const inflation: PanelSpec[] = [{
      key: 'inflation',
      series: [S('CPI_YOY'), S('CORECPI_YOY'), S('COREPCE_YOY')],
      yFormat: AXIS.pct,
      includeZero: true,
      refLines: [{ v: 2, label: '2% target', dashed: true }],
    }];
    const conditions: PanelSpec[] = [
      { key: 'mortgage', series: [S('MORTGAGE30US')], yFormat: AXIS.pct, caption: '30-year fixed mortgage rate' },
      { key: 'baa', series: [S('BAA10Y')], yFormat: AXIS.pt, caption: 'Baa corporate spread over 10-year Treasury' },
      { key: 'walcl', series: [S('WALCL_T')], yFormat: AXIS.trillions, caption: 'Fed balance sheet, total assets' },
    ];
    return { policy, curve, labor, inflation, conditions };
  }, [data]);

  // The payroll note only earns its line when a bar in the window is actually cut.
  const payrollCut = useMemo(
    () => (data ? clip(data.series.PAYROLL_CHG, start ?? -Infinity, end).some(o => Math.abs(o.v) > PAYROLL_CLAMP) : false),
    [data, start, end],
  );

  const recessions = data?.recessions ?? [];
  const legendOf = (keys: Key[]) => keys.map(k => ({ name: NAME[k], color: COLOR[k] }));

  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 sm:px-6 pt-6 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-5">
        <div className="min-w-0">
          <h1 className="font-grotesk text-[28px] font-bold leading-none text-fika-text m-0 tracking-[-0.02em]">{label}</h1>
          <p className="text-[13.5px] text-fika-secondary leading-snug mt-2 mb-0 max-w-[640px]">
            The moving parts of the U.S. macro economy on one page: policy, the curve, jobs, prices and credit, straight from FRED.
          </p>
          <p className="text-[12px] text-fika-tertiary leading-none mt-2 mb-0">
            Data through <span className="font-semibold text-fika-secondary">{longDate(end)}</span>
            <span className="mx-2">·</span>
            <span className="inline-block w-3 h-3 rounded-[3px] align-[-2px] mr-1.5" style={{ background: RECESSION_FILL, border: '1px solid rgba(16,24,40,0.10)' }} />
            shaded bands are NBER recessions
          </p>
        </div>

        <div role="group" aria-label="Time window" className="flex rounded-full border border-fika-border bg-fika-surface p-0.5 shrink-0">
          {RANGES.map(r => {
            const on = r.years === years;
            return (
              <button
                key={r.label}
                aria-pressed={on}
                onClick={() => setYears(r.years)}
                className={`font-grotesk text-[12.5px] font-bold rounded-full px-3.5 py-1.5 leading-none transition-colors ${on ? 'bg-fika-text text-white' : 'text-fika-secondary hover:text-fika-text'}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </header>

      {error && (
        <p className="text-[13px] font-semibold text-fika-red mb-4 m-0">Could not load the data file ({error}). Re-run <code className="font-mono">npm run fred</code> and redeploy.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {TILES.map(t =>
          data ? (
            <Tile key={t.key} spec={t} data={data.series[t.key]} color={COLOR[t.key]} end={end} recessions={data.recessions} />
          ) : (
            <div key={t.key} className="rounded-xl border border-fika-border bg-fika-surface h-[168px]" />
          ),
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="Is policy tight or loose?"
          subtitle="Fed funds against core PCE inflation. The gap is the real policy rate: fed funds minus trailing core PCE. Judge tight or loose against neutral, which most estimates put a little under 1%, not against zero."
          panels={charts?.policy ?? []}
          start={start}
          end={end}
          recessions={recessions}
          legend={legendOf(['FEDFUNDS', 'COREPCE_YOY', 'REAL_RATE'])}
          className="min-h-[360px]"
        />
        <ChartCard
          title="What is the yield curve saying?"
          subtitle="2-year and 10-year Treasury yields. When the 2-year sits above the 10-year the curve is inverted, which has preceded every recession since 1980."
          panels={charts?.curve ?? []}
          start={start}
          end={end}
          recessions={recessions}
          legend={[...legendOf(['DGS2', 'DGS10']), { name: 'Inverted', color: INVERSION_FILL, kind: 'swatch' as const }]}
          className="min-h-[360px]"
        />
        <ChartCard
          title="Is the labor market holding?"
          subtitle="Unemployment rises slowly, then fast. Payroll growth usually stalls first."
          panels={charts?.labor ?? []}
          start={start}
          end={end}
          recessions={recessions}
          note={payrollCut ? 'Bars beyond ±1M jobs a month are cut at the edge and marked; hover for the exact figure.' : undefined}
          className="min-h-[360px]"
        />
        <ChartCard
          title="Where is inflation coming from?"
          subtitle="Headline CPI swings with food and energy; core CPI and core PCE show what sticks. The Fed's target is 2% on PCE."
          panels={charts?.inflation ?? []}
          start={start}
          end={end}
          recessions={recessions}
          legend={legendOf(['CPI_YOY', 'CORECPI_YOY', 'COREPCE_YOY'])}
          className="min-h-[360px]"
        />
        <ChartCard
          title="How tight are financial conditions?"
          subtitle="What borrowing actually costs, the premium investors demand to hold corporate risk, and the size of the Fed's balance sheet."
          panels={charts?.conditions ?? []}
          layout="row"
          start={start}
          end={end}
          recessions={recessions}
          className="lg:col-span-2 min-h-[280px]"
        />
      </div>

      <div className="mt-4">
        <Sources fetchedAt={data?.fetchedAt ?? fetchedAt} manifest={data?.manifest ?? manifest} />
      </div>
    </div>
  );
}
