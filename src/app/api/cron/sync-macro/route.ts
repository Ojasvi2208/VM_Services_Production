/**
 * Macro Data Sync Cron
 *
 * Runs daily at 10:00 PM UTC (3:30 AM IST).
 * After global forex settlements (5 PM EST) and MCX closure (11:30 PM IST).
 *
 * 1. Fetches currency rates (USDINR, EURINR, GBPINR) from open.er-api.com
 * 2. Fetches commodity prices (Gold, Silver, Brent Crude) via CF relay → Yahoo Finance
 * 3. Computes day-over-day change from previous DB snapshot
 * 4. Upserts into macro_snapshots table
 *
 * Schedule: 0 22 * * *
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

const CF_RELAY_URL = process.env.CF_RELAY_URL
  || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CurrencySnapshot {
  symbol: string;
  name: string;
  price: number;
}

interface CommoditySnapshot {
  symbol: string;
  name: string;
  price: number;
  priceInr: number;
  unit: string;
  exchange: string;
}

const MACRO_COMMODITIES = [
  { yahoo: 'GC=F',  symbol: 'GOLD',   name: 'Gold',        unit: '/oz',     exchange: 'COMEX' },
  { yahoo: 'SI=F',  symbol: 'SILVER', name: 'Silver',      unit: '/oz',     exchange: 'COMEX' },
  { yahoo: 'BZ=F',  symbol: 'BRENT',  name: 'Brent Crude', unit: '/barrel', exchange: 'ICE'   },
];

// ─── Cron Auth (from market-update/route.ts) ────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

// ─── Currency Fetch (from currency-rates/route.ts) ──────────────────────────

async function fetchCurrencies(): Promise<CurrencySnapshot[]> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/INR', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) return [];

    const data = await response.json();
    if (data.result !== 'success' || !data.rates) return [];

    const targets = ['USD', 'EUR', 'GBP'];
    return targets
      .filter(c => data.rates[c])
      .map(c => ({
        symbol: `${c}INR`,
        name: `${c}/INR`,
        price: Math.round((1 / data.rates[c]) * 10000) / 10000,
      }));
  } catch (err: any) {
    console.error('sync-macro: currency fetch error:', err?.message);
    return [];
  }
}

// ─── CF Relay Fetch (from commodities/route.ts) ─────────────────────────────

async function fetchSingle(yahooSymbol: string): Promise<any | null> {
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`;
    const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta || null;
  } catch {
    return null;
  }
}

async function fetchUSDINR(): Promise<number> {
  try {
    const meta = await fetchSingle('INR=X');
    if (meta?.regularMarketPrice) return meta.regularMarketPrice;
  } catch {}
  return 86.5; // reasonable fallback
}

async function fetchCommodities(usdInr: number): Promise<CommoditySnapshot[]> {
  const results = await Promise.all(MACRO_COMMODITIES.map(c => fetchSingle(c.yahoo)));
  const snapshots: CommoditySnapshot[] = [];

  for (let i = 0; i < MACRO_COMMODITIES.length; i++) {
    const meta = results[i];
    const info = MACRO_COMMODITIES[i];
    if (!meta?.regularMarketPrice) continue;

    const price = Number(meta.regularMarketPrice.toFixed(2));
    snapshots.push({
      symbol: info.symbol,
      name: info.name,
      price,
      priceInr: Number((price * usdInr).toFixed(2)),
      unit: info.unit,
      exchange: info.exchange,
    });
  }
  return snapshots;
}

// ─── Previous Day Lookup ────────────────────────────────────────────────────

async function getPreviousSnapshots(
  client: any,
  assetClass: string,
  symbols: string[],
  today: string
): Promise<Map<string, number>> {
  if (symbols.length === 0) return new Map();

  const result = await client.query(
    `SELECT DISTINCT ON (symbol) symbol, price
     FROM macro_snapshots
     WHERE asset_class = $1 AND symbol = ANY($2) AND snapshot_date < $3
     ORDER BY symbol, snapshot_date DESC`,
    [assetClass, symbols, today]
  );

  const map = new Map<string, number>();
  for (const row of result.rows) {
    map.set(row.symbol, parseFloat(row.price));
  }
  return map;
}

// ─── Upsert ─────────────────────────────────────────────────────────────────

async function upsertSnapshot(
  client: any,
  assetClass: string,
  symbol: string,
  name: string,
  price: number,
  priceInr: number | null,
  change: number,
  changePercent: number,
  unit: string | null,
  source: string,
  exchange: string | null,
  snapshotDate: string
): Promise<void> {
  await client.query(
    `INSERT INTO macro_snapshots
       (asset_class, symbol, name, price, price_inr, change, change_percent, unit, source, exchange, snapshot_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (asset_class, symbol, snapshot_date)
     DO UPDATE SET
       price = EXCLUDED.price,
       price_inr = EXCLUDED.price_inr,
       change = EXCLUDED.change,
       change_percent = EXCLUDED.change_percent,
       last_updated = NOW()`,
    [assetClass, symbol, name, price, priceInr, change, changePercent, unit, source, exchange, snapshotDate]
  );
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD IST
  const stats = {
    currenciesUpserted: 0,
    commoditiesUpserted: 0,
    errors: [] as string[],
  };

  const client = await pool.connect();
  try {
    // 1. Fetch all data in parallel
    const [currencies, usdInr] = await Promise.all([
      fetchCurrencies(),
      fetchUSDINR(),
    ]);
    const commodities = await fetchCommodities(usdInr);

    // 2. Get previous day prices for change calculation
    const prevCurrencies = await getPreviousSnapshots(
      client, 'currency', currencies.map(c => c.symbol), today
    );
    const prevCommodities = await getPreviousSnapshots(
      client, 'commodity', commodities.map(c => c.symbol), today
    );

    // 3. Upsert currencies
    for (const curr of currencies) {
      try {
        const prev = prevCurrencies.get(curr.symbol);
        const change = prev ? Math.round((curr.price - prev) * 10000) / 10000 : 0;
        const changePct = prev && prev > 0
          ? Math.round((change / prev) * 10000) / 100
          : 0;

        await upsertSnapshot(
          client, 'currency', curr.symbol, curr.name,
          curr.price, null, change, changePct,
          null, 'er-api', null, today
        );
        stats.currenciesUpserted++;
      } catch (err: any) {
        stats.errors.push(`currency:${curr.symbol}: ${err.message}`);
      }
    }

    // 4. Upsert commodities
    for (const comm of commodities) {
      try {
        const prev = prevCommodities.get(comm.symbol);
        const change = prev ? Math.round((comm.price - prev) * 100) / 100 : 0;
        const changePct = prev && prev > 0
          ? Math.round((change / prev) * 10000) / 100
          : 0;

        await upsertSnapshot(
          client, 'commodity', comm.symbol, comm.name,
          comm.price, comm.priceInr, change, changePct,
          comm.unit, 'yahoo-cf-relay', comm.exchange, today
        );
        stats.commoditiesUpserted++;
      } catch (err: any) {
        stats.errors.push(`commodity:${comm.symbol}: ${err.message}`);
      }
    }

    console.log(`sync-macro: ${stats.currenciesUpserted} currencies, ${stats.commoditiesUpserted} commodities upserted for ${today}`);

    return NextResponse.json({
      success: true,
      ...stats,
      usdInr,
      snapshotDate: today,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('sync-macro cron error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      ...stats,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
