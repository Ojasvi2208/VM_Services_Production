import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

/**
 * Market Data API — DB-backed, zero Yahoo Finance calls from user requests.
 *
 * All 33 indices are pre-fetched by the /api/cron/cache-indices cron every 15 min
 * and stored in market_cache (key: live_indices). This handler reads from that
 * single DB row and filters to the requested symbols.
 *
 * Emergency fallback: if the DB row is missing or older than 30 minutes, fetches
 * the requested symbols live so the page is never blank on first deploy.
 */

const CF_RELAY_URL = process.env.CF_RELAY_URL
  || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

// Maximum age before we fall back to a live fetch (covers cold-start / missed crons)
const MAX_CACHE_AGE_MS = 30 * 60 * 1000;

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

// ─── Symbol Map ───────────────────────────────────────────────────────────────
const SYMBOL_MAP: Record<string, { yahoo: string; name: string; exchange: string }> = {
  // NSE Indices
  'NIFTY':            { yahoo: '^NSEI',                name: 'NIFTY 50',            exchange: 'NSE' },
  'BANKNIFTY':        { yahoo: '^NSEBANK',             name: 'BANK NIFTY',          exchange: 'NSE' },
  'NIFTYIT':          { yahoo: '^CNXIT',               name: 'NIFTY IT',            exchange: 'NSE' },
  'NIFTYNEXT50':      { yahoo: '^CNXNJR',              name: 'NIFTY NEXT 50',       exchange: 'NSE' },
  'NIFTYMIDCAP50':    { yahoo: '^NSMIDCP',             name: 'NIFTY MIDCAP 50',     exchange: 'NSE' },
  'NIFTYMIDCAP150':   { yahoo: 'NIFTYMIDCAP150.NS',     name: 'NIFTY MIDCAP 150',    exchange: 'NSE' },
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

function isMarketCurrentlyOpen(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 555 && mins <= 930;
}

// ─── Read from DB ─────────────────────────────────────────────────────────────
async function readFromDB(): Promise<{ items: MarketDataItem[]; fetchedAt: string } | null> {
  try {
    const result = await pool.query(
      `SELECT data, scraped_at FROM market_cache WHERE cache_key = 'live_indices' LIMIT 1`
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const ageMs = Date.now() - new Date(row.scraped_at).getTime();
    if (ageMs > MAX_CACHE_AGE_MS) return null; // stale — trigger emergency fallback

    const payload = row.data as { items: MarketDataItem[]; fetchedAt: string };
    if (!Array.isArray(payload?.items)) return null;
    return payload;
  } catch (err: any) {
    console.error('[market-data] DB read error:', err?.message);
    return null;
  }
}

// ─── Emergency live fetch (only on cold-start or missed cron) ─────────────────
async function fetchLive(symbol: string): Promise<MarketDataItem | null> {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping) return null;

  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapping.yahoo)}`;
    const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
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
    console.error(`[market-data] live fetch failed for ${symbol}:`, err?.name === 'AbortError' ? 'timeout' : err?.message);
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')
      ?.split(',').map(s => s.trim().toUpperCase())
      .filter(s => s in SYMBOL_MAP)
      ?? ['NIFTY'];

    // ── Primary: read from DB cache ──────────────────────────────────────────
    const cached = await readFromDB();

    if (cached) {
      const symbolSet = new Set(symbols);
      const data = cached.items.filter(item => symbolSet.has(item.symbol));

      return NextResponse.json({
        success: true,
        data,
        timestamp: cached.fetchedAt,
        isMarketOpen: isMarketCurrentlyOpen(),
        source: 'db_cache',
      });
    }

    // ── Emergency fallback: live fetch (cold-start or missed cron) ───────────
    console.warn('[market-data] DB cache miss — falling back to live fetch for', symbols.join(','));

    const BATCH = 8;
    const live: MarketDataItem[] = [];
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(s => fetchLive(s)));
      live.push(...(results.filter(Boolean) as MarketDataItem[]));
    }

    return NextResponse.json({
      success: true,
      data: live,
      timestamp: new Date().toISOString(),
      isMarketOpen: isMarketCurrentlyOpen(),
      source: 'live_fallback',
    });

  } catch (error: any) {
    console.error('[market-data] handler error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch market data',
      data: [],
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
