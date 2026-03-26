/**
 * Index Cache Cron — Server-Level Shared Market Cache
 *
 * Runs every 15 minutes during market hours (Mon–Fri, 9:00 AM – 4:30 PM IST).
 * Fetches ALL 33 Indian market indices from Yahoo Finance via CF relay and
 * writes the results as a single JSONB blob to market_cache (key: live_indices).
 *
 * ALL user requests for market data read from this DB row — zero Yahoo Finance
 * calls from user-facing APIs, regardless of how many concurrent users hit the site.
 *
 * Schedule: every 15 min, UTC 3–10, Mon–Fri (IST ~8:30–15:30)
 * Off-hours: once at UTC 20:00 daily to refresh closing prices
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

const CF_RELAY_URL = process.env.CF_RELAY_URL
  || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

// ─── Symbol Map (identical to market-data route) ─────────────────────────────
const SYMBOL_MAP: Record<string, { yahoo: string; name: string; exchange: string }> = {
  // NSE Indices
  'NIFTY':            { yahoo: '^NSEI',                name: 'NIFTY 50',            exchange: 'NSE' },
  'BANKNIFTY':        { yahoo: '^NSEBANK',             name: 'BANK NIFTY',          exchange: 'NSE' },
  'NIFTYIT':          { yahoo: '^CNXIT',               name: 'NIFTY IT',            exchange: 'NSE' },
  'NIFTYNEXT50':      { yahoo: '^CNXNJR',              name: 'NIFTY NEXT 50',       exchange: 'NSE' },
  'NIFTYMIDCAP50':    { yahoo: '^NSMIDCP',             name: 'NIFTY MIDCAP 50',     exchange: 'NSE' },
  'NIFTYMIDCAP150':   { yahoo: '^CNXMIDCAP',           name: 'NIFTY MIDCAP 150',    exchange: 'NSE' },
  'NIFTYSMALLCAP100': { yahoo: '^CNXSC',               name: 'NIFTY SMALLCAP 100',  exchange: 'NSE' },
  'NIFTYPHARMA':      { yahoo: '^CNXPHARMA',           name: 'NIFTY PHARMA',        exchange: 'NSE' },
  'NIFTYAUTO':        { yahoo: '^CNXAUTO',             name: 'NIFTY AUTO',          exchange: 'NSE' },
  'NIFTYFMCG':        { yahoo: '^CNXFMCG',             name: 'NIFTY FMCG',          exchange: 'NSE' },
  'NIFTYMETAL':       { yahoo: '^CNXMETAL',            name: 'NIFTY METAL',         exchange: 'NSE' },
  'NIFTYREALTY':      { yahoo: '^CNXREALTY',           name: 'NIFTY REALTY',        exchange: 'NSE' },
  'NIFTYENERGY':      { yahoo: '^CNXENERGY',           name: 'NIFTY ENERGY',        exchange: 'NSE' },
  'NIFTYINFRA':       { yahoo: '^CNXINFRA',            name: 'NIFTY INFRA',         exchange: 'NSE' },
  'NIFTYPSE':         { yahoo: '^CNXPSE',              name: 'NIFTY PSE',           exchange: 'NSE' },
  'NIFTYFINSERVICE':  { yahoo: 'NIFTY_FIN_SERVICE.NS', name: 'NIFTY FIN SERVICE',   exchange: 'NSE' },
  'NIFTYPVTBANK':     { yahoo: 'NIFTY_PVT_BANK.NS',   name: 'NIFTY PVT BANK',      exchange: 'NSE' },
  // BSE Indices
  'SENSEX':           { yahoo: '^BSESN',               name: 'SENSEX',              exchange: 'BSE' },
  'BSE500':           { yahoo: 'BSE-500.BO',           name: 'BSE 500',             exchange: 'BSE' },
  'BSEMIDCAP':        { yahoo: 'BSE-MIDCAP.BO',        name: 'BSE MIDCAP',          exchange: 'BSE' },
  'BSESMALLCAP':      { yahoo: 'BSE-SMLCAP.BO',        name: 'BSE SMALLCAP',        exchange: 'BSE' },
  'BSEFMCG':          { yahoo: 'BSE-FMCG.BO',          name: 'BSE FMCG',            exchange: 'BSE' },
  'BSEIT':            { yahoo: 'BSE-IT.BO',            name: 'BSE IT',              exchange: 'BSE' },
  'BSEHEALTHCARE':    { yahoo: 'BSE-HC.BO',            name: 'BSE HEALTHCARE',      exchange: 'BSE' },
  'BSEAUTO':          { yahoo: 'BSE-AUTO.BO',          name: 'BSE AUTO',            exchange: 'BSE' },
  'BSEMETAL':         { yahoo: 'BSE-METAL.BO',         name: 'BSE METAL',           exchange: 'BSE' },
  'BSEOILGAS':        { yahoo: 'BSE-OILGAS.BO',        name: 'BSE OIL & GAS',       exchange: 'BSE' },
  'BSEREALTY':        { yahoo: 'BSE-REALTY.BO',        name: 'BSE REALTY',          exchange: 'BSE' },
  'BSECG':            { yahoo: 'BSE-CG.BO',            name: 'BSE CAPITAL GOODS',   exchange: 'BSE' },
  'BSEPOWER':         { yahoo: 'BSE-POWER.BO',         name: 'BSE POWER',           exchange: 'BSE' },
};

interface MarketDataItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  isMarketOpen: boolean;
  exchange: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

// ─── Market open check ────────────────────────────────────────────────────────
function isMarketCurrentlyOpen(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 555 && mins <= 930;
}

// ─── Fetch one symbol via CF relay ────────────────────────────────────────────
async function fetchSymbol(symbol: string): Promise<MarketDataItem | null> {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping) return null;

  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapping.yahoo)}`;
    const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const response = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!response.ok) return null;

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price = meta.regularMarketPrice as number;
    const prevClose = (meta.previousClose || meta.chartPreviousClose || 0) as number;
    const change = prevClose ? price - prevClose : 0;
    const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

    return {
      symbol,
      name: mapping.name,
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      lastUpdated: new Date().toISOString(),
      isMarketOpen: meta.marketState === 'REGULAR',
      exchange: mapping.exchange,
    };
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'timeout' : err?.message;
    console.error(`[cache-indices] fetch failed for ${symbol}: ${reason}`);
    return null;
  }
}

// ─── Fetch all symbols in batches of 8 ───────────────────────────────────────
async function fetchAllSymbols(): Promise<MarketDataItem[]> {
  const symbols = Object.keys(SYMBOL_MAP);
  const BATCH = 8;
  const results: MarketDataItem[] = [];

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(s => fetchSymbol(s)));
    results.push(...(batchResults.filter(Boolean) as MarketDataItem[]));
  }

  return results;
}

// ─── Write to DB ──────────────────────────────────────────────────────────────
async function writeToCache(items: MarketDataItem[]): Promise<void> {
  const payload = {
    items,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    isMarketOpen: isMarketCurrentlyOpen(),
  };

  await pool.query(
    `INSERT INTO market_cache (cache_key, data, scraped_at, is_stale, source_url, updated_at)
     VALUES ('live_indices', $1, NOW(), FALSE, 'yahoo_finance_via_cf_relay', NOW())
     ON CONFLICT (cache_key) DO UPDATE SET
       data       = EXCLUDED.data,
       scraped_at = EXCLUDED.scraped_at,
       is_stale   = FALSE,
       updated_at = NOW()`,
    [JSON.stringify(payload)]
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startMs = Date.now();

  try {
    const items = await fetchAllSymbols();
    const elapsed = Date.now() - startMs;

    if (items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'All symbol fetches failed — CF relay may be down',
        elapsed,
      }, { status: 502 });
    }

    await writeToCache(items);

    console.log(`[cache-indices] Wrote ${items.length}/${Object.keys(SYMBOL_MAP).length} indices to DB in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      fetched: items.length,
      total: Object.keys(SYMBOL_MAP).length,
      elapsedMs: elapsed,
      isMarketOpen: isMarketCurrentlyOpen(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[cache-indices] cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
