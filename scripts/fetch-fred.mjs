// Pull every FRED series the macro dashboard uses and write:
//
//   public/data/fred/<ID>.csv       the exact CSV FRED served, untouched
//   public/data/fred/manifest.json  one entry per series: name, units, frequency,
//                                   source, first/last observation, links
//   public/data/fred/bundle.json    manifest + parsed observations in one file,
//                                   which is what the page actually loads
//
// Run it right before showing the dashboard:   npm run fred
//
// No API key. FRED's graph endpoint serves any public series as CSV, and the
// series page carries the metadata (units, frequency, source) in its HTML. If
// FRED ever changes that markup the FALLBACK table below keeps the manifest
// complete; the script says so when it has to use it.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'fred');

// Order here is the order in the Data & sources table.
const SERIES = [
  'FEDFUNDS',
  'DGS2',
  'DGS10',
  'T10Y2Y',
  'CPIAUCSL',
  'CPILFESL',
  'PCEPILFE',
  'UNRATE',
  'PAYEMS',
  'A191RL1Q225SBEA',
  'MORTGAGE30US',
  'BAA10Y',
  'WALCL',
  'USREC',
  'SAHMREALTIME',
  'RECPROUSM156N',
  'PERMIT',
  'HOUST',
  'CSUSHPINSA',
  'ADXTNO',
  'TOTALSA',
];

// Used only when the series page cannot be parsed.
const FALLBACK = {
  FEDFUNDS: { name: 'Federal Funds Effective Rate', units: 'Percent', frequency: 'Monthly', source: 'Board of Governors of the Federal Reserve System (US)', release: 'H.15 Selected Interest Rates' },
  DGS2: { name: 'Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity', units: 'Percent', frequency: 'Daily', source: 'Board of Governors of the Federal Reserve System (US)', release: 'H.15 Selected Interest Rates' },
  DGS10: { name: 'Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity', units: 'Percent', frequency: 'Daily', source: 'Board of Governors of the Federal Reserve System (US)', release: 'H.15 Selected Interest Rates' },
  T10Y2Y: { name: '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity', units: 'Percent', frequency: 'Daily', source: 'Federal Reserve Bank of St. Louis', release: '' },
  CPIAUCSL: { name: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', units: 'Index 1982-1984=100', frequency: 'Monthly', source: 'U.S. Bureau of Labor Statistics', release: 'Consumer Price Index' },
  CPILFESL: { name: 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy in U.S. City Average', units: 'Index 1982-1984=100', frequency: 'Monthly', source: 'U.S. Bureau of Labor Statistics', release: 'Consumer Price Index' },
  PCEPILFE: { name: 'Personal Consumption Expenditures Excluding Food and Energy (Chain-Type Price Index)', units: 'Index 2017=100', frequency: 'Monthly', source: 'U.S. Bureau of Economic Analysis', release: 'Personal Income and Outlays' },
  UNRATE: { name: 'Unemployment Rate', units: 'Percent', frequency: 'Monthly', source: 'U.S. Bureau of Labor Statistics', release: 'Employment Situation' },
  PAYEMS: { name: 'All Employees, Total Nonfarm', units: 'Thousands of Persons', frequency: 'Monthly', source: 'U.S. Bureau of Labor Statistics', release: 'Employment Situation' },
  A191RL1Q225SBEA: { name: 'Real Gross Domestic Product', units: 'Percent Change from Preceding Period', frequency: 'Quarterly', source: 'U.S. Bureau of Economic Analysis', release: 'Gross Domestic Product' },
  MORTGAGE30US: { name: '30-Year Fixed Rate Mortgage Average in the United States', units: 'Percent', frequency: 'Weekly, Ending Thursday', source: 'Freddie Mac', release: 'Primary Mortgage Market Survey' },
  BAA10Y: { name: "Moody's Seasoned Baa Corporate Bond Yield Relative to Yield on 10-Year Treasury Constant Maturity", units: 'Percent', frequency: 'Daily', source: 'Federal Reserve Bank of St. Louis', release: '' },
  WALCL: { name: 'Assets: Total Assets: Total Assets (Less Eliminations from Consolidation): Wednesday Level', units: 'Millions of U.S. Dollars', frequency: 'Weekly, As of Wednesday', source: 'Board of Governors of the Federal Reserve System (US)', release: 'H.4.1 Factors Affecting Reserve Balances' },
  USREC: { name: 'NBER based Recession Indicators for the United States from the Period following the Peak through the Trough', units: '+1 or 0', frequency: 'Monthly', source: 'Federal Reserve Bank of St. Louis', release: 'Recession Indicators Series' },
  SAHMREALTIME: { name: 'Real-time Sahm Rule Recession Indicator', units: 'Percentage Points', frequency: 'Monthly', source: 'Sahm, Claudia', release: 'Sahm Rule Recession Indicator' },
  RECPROUSM156N: { name: 'Smoothed U.S. Recession Probabilities', units: 'Percent', frequency: 'Monthly', source: 'Chauvet, Marcelle', release: 'U.S. Recession Probabilities' },
  PERMIT: { name: 'New Privately-Owned Housing Units Authorized in Permit-Issuing Places: Total Units', units: 'Thousands of Units', frequency: 'Monthly', source: 'U.S. Census Bureau', release: 'New Residential Construction' },
  HOUST: { name: 'New Privately-Owned Housing Units Started: Total Units', units: 'Thousands of Units', frequency: 'Monthly', source: 'U.S. Census Bureau', release: 'New Residential Construction' },
  CSUSHPINSA: { name: 'S&P Cotality Case-Shiller U.S. National Home Price Index', units: 'Index Jan 2000=100', frequency: 'Monthly', source: 'S&P Dow Jones Indices LLC', release: 'S&P Cotality Case-Shiller Home Price Indices' },
  ADXTNO: { name: "Manufacturers' New Orders: Durable Goods Excluding Transportation", units: 'Millions of Dollars', frequency: 'Monthly', source: 'U.S. Census Bureau', release: "Manufacturer's Shipments, Inventories, and Orders (M3) Survey" },
  TOTALSA: { name: 'Total Vehicle Sales', units: 'Millions of Units', frequency: 'Monthly', source: 'U.S. Bureau of Economic Analysis', release: 'Supplemental Estimates, Motor Vehicles' },
};

const csvUrl = id => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
const pageUrl = id => `https://fred.stlouisfed.org/series/${id}`;

async function get(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'macro-eco-dashboard fetch (node)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      last = e;
      await new Promise(res => setTimeout(res, 800 * (i + 1)));
    }
  }
  throw new Error(`${url}: ${last?.message ?? last}`);
}

const clean = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

function metaFromPage(id, html) {
  const grab = cls => {
    const m = html.match(new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)</`));
    return m ? clean(m[1]) : null;
  };
  const title = html.match(new RegExp(`<title>([\\s\\S]*?)\\s*\\(${id}\\)`));
  const source = html.match(/Source:<\/strong>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
  const release = html.match(/Release:<\/strong>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
  return {
    name: title ? clean(title[1]) : null,
    units: grab('series-meta-value-units'),
    frequency: grab('series-meta-value-frequency'),
    source: source ? clean(source[2]) : null,
    sourceUrl: source ? source[1] : null,
    release: release ? clean(release[2]) : null,
    releaseUrl: release ? release[1] : null,
    updated: grab('series-meta-updated-date'),
  };
}

function parseCsv(id, text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  if (header[0] !== 'observation_date' || header[1] !== id) {
    throw new Error(`${id}: unexpected CSV header "${lines[0]}"`);
  }
  const dates = [];
  const values = [];
  for (const line of lines.slice(1)) {
    const [d, v] = line.split(',');
    if (!d || v === undefined || v === '.' || v === '') continue; // FRED marks holidays "."
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    dates.push(d);
    values.push(n);
  }
  return { dates, values };
}

mkdirSync(OUT, { recursive: true });
const fetchedAt = new Date().toISOString();
const manifest = [];
const data = {};
const files = [];
let usedFallback = 0;

for (const id of SERIES) {
  process.stdout.write(`${id.padEnd(16)}`);
  const csv = await get(csvUrl(id));
  const parsed = parseCsv(id, csv);
  if (parsed.dates.length === 0) throw new Error(`${id}: no observations`);
  files.push([join(OUT, `${id}.csv`), csv]);

  let meta = {};
  try {
    meta = metaFromPage(id, await get(pageUrl(id)));
  } catch (e) {
    console.warn(`\n  series page failed (${e.message}); using fallback metadata`);
  }
  const fb = FALLBACK[id] ?? {};
  const pick = k => {
    if (meta[k]) return meta[k];
    if (fb[k]) { usedFallback++; return fb[k]; }
    return fb[k] ?? null;
  };

  const entry = {
    id,
    name: pick('name'),
    units: pick('units'),
    frequency: pick('frequency'),
    source: pick('source'),
    sourceUrl: meta.sourceUrl ?? null,
    release: pick('release'),
    releaseUrl: meta.releaseUrl ?? null,
    firstDate: parsed.dates[0],
    lastDate: parsed.dates[parsed.dates.length - 1],
    observations: parsed.dates.length,
    fredUpdated: meta.updated ?? null,
    fredUrl: pageUrl(id),
    csvUrl: csvUrl(id),
    localCsv: `/data/fred/${id}.csv`,
  };
  manifest.push(entry);
  data[id] = parsed;
  console.log(`${String(parsed.dates.length).padStart(6)} obs  ${entry.firstDate} → ${entry.lastDate}  ${entry.frequency}`);
}

// Nothing touches disk until every series is in hand, so a failed run leaves
// the previous CSVs, manifest and bundle consistent with each other.
for (const [path, text] of files) writeFileSync(path, text);
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ fetchedAt, series: manifest }, null, 2) + '\n');
writeFileSync(join(OUT, 'bundle.json'), JSON.stringify({ fetchedAt, series: manifest, data }));

console.log(`\nfetched ${SERIES.length} series at ${fetchedAt}`);
if (usedFallback) console.log(`(${usedFallback} metadata field(s) came from the fallback table — check FRED's page markup)`);
