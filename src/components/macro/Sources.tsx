// The collapsed "Data & sources" drawer: when the data was pulled, then every
// FRED series with its units, cadence, source, last observation and links to
// the FRED page and to the exact CSV this page reads.

import { useEffect, useState } from 'react';
import { normFreq, parseDate } from './compute';
import type { ManifestEntry } from './data';
import { dateLabel, localStamp, utcStamp } from './format';
import { USED_AS } from './registry';

interface Props {
  fetchedAt: string;
  manifest: ManifestEntry[];
}

/** "Aug 2026" for a monthly series, "Q2 2026" for a quarterly one, the full date otherwise. */
function lastObs(s: ManifestEntry): string {
  return dateLabel(parseDate(s.lastDate), normFreq(s.frequency));
}

function cleanFreq(f: string): string {
  return f.replace(/,.*$/, '');
}

const LINK = 'font-semibold text-fika-text underline decoration-fika-border underline-offset-2 hover:text-fika-accent-text hover:decoration-fika-accent-text';

export default function Sources({ fetchedAt, manifest }: Props) {
  const [open, setOpen] = useState(false);
  // The server renders UTC (deterministic, so hydration matches); the viewer's
  // own zone replaces it after mount.
  const [pulled, setPulled] = useState(() => utcStamp(fetchedAt));
  useEffect(() => setPulled(localStamp(fetchedAt)), [fetchedAt]);

  return (
    <section className="rounded-xl border border-fika-border bg-fika-surface overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <h2 className="font-grotesk text-[14px] font-bold text-fika-text m-0">Data &amp; sources</h2>
        <span className="text-[12px] text-fika-tertiary whitespace-nowrap">
          {manifest.length} FRED series<span className="hidden sm:inline"> · pulled {pulled}</span>
          <span className="ml-3 text-[18px] leading-none text-fika-tertiary" aria-hidden>{open ? '−' : '+'}</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-fika-border bg-white px-4 pb-4 pt-3">
          <p className="text-[12.5px] text-fika-secondary leading-snug m-0 mb-3 max-w-[760px]">
            Everything on this page comes from FRED (Federal Reserve Bank of St. Louis), pulled on {pulled}.
            Each row links to the FRED series page and to the exact CSV this page reads. Year-over-year rates, the real
            policy rate and the monthly payroll change are computed here from the published levels, and the Fed balance
            sheet is rescaled from millions to trillions of dollars. Nothing else is transformed.
          </p>
          <div className="overflow-x-auto -mx-4 px-4" tabIndex={0} role="region" aria-label="Series table">
            <table className="w-full text-[12px] leading-snug border-collapse min-w-[900px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-fika-tertiary">
                  <th className="font-bold py-1.5 pr-3 border-b border-fika-border">Series</th>
                  <th className="font-bold py-1.5 pr-3 border-b border-fika-border">Used as</th>
                  <th className="font-bold py-1.5 pr-3 border-b border-fika-border">Units</th>
                  <th className="font-bold py-1.5 pr-3 border-b border-fika-border">Cadence</th>
                  <th className="font-bold py-1.5 pr-3 border-b border-fika-border">Source</th>
                  <th className="font-bold py-1.5 pr-3 border-b border-fika-border whitespace-nowrap">Last obs.</th>
                  <th className="font-bold py-1.5 border-b border-fika-border">Links</th>
                </tr>
              </thead>
              <tbody>
                {manifest.map(s => (
                  <tr key={s.id} className="align-top border-b border-fika-border/60 last:border-b-0">
                    <td className="py-2 pr-3 max-w-[340px]">
                      <div className="font-semibold text-fika-text">{s.name}</div>
                      <div className="font-mono text-[11px] text-fika-tertiary mt-0.5">{s.id}</div>
                    </td>
                    <td className="py-2 pr-3 text-fika-secondary max-w-[300px]">{USED_AS[s.id] ?? ''}</td>
                    <td className="py-2 pr-3 text-fika-secondary whitespace-nowrap">{s.units}</td>
                    <td className="py-2 pr-3 text-fika-secondary whitespace-nowrap">{cleanFreq(s.frequency)}</td>
                    <td className="py-2 pr-3 text-fika-secondary max-w-[180px]">{s.source}</td>
                    <td className="py-2 pr-3 text-fika-text whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{lastObs(s)}</td>
                    <td className="py-2 whitespace-nowrap">
                      <a href={s.fredUrl} target="_blank" rel="noreferrer" className={LINK}>FRED ↗</a>
                      <span className="text-fika-tertiary mx-1.5">·</span>
                      <a href={s.localCsv} download className={LINK}>CSV ↓</a>
                      <span className="text-fika-tertiary mx-1.5">·</span>
                      <a href={s.csvUrl} target="_blank" rel="noreferrer" className="text-fika-secondary underline decoration-fika-border underline-offset-2 hover:text-fika-accent-text">live CSV</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
