/**
 * Commodity Cache Cron
 * Pre-fetches 11 commodity prices via CF relay → Yahoo Finance.
 * Writes to market_cache (key: commodities_all).
 * User-facing /api/commodities reads from DB — zero per-user external calls.
 *
 * Schedule: Every 30 min during market hours + once off-hours
 * Vercel.json: every-30-min 3-10 Mon-Fri + 0 22 daily
 * Calls: 2 batch fetches + 1 USD/INR = ~3 Yahoo calls per run
 * Monthly: ~600 calls (capped, predictable, zero user dependency)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

const CF_RELAY_URL = process.env.CF_RELAY_URL || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

const COMMODITY_SYMBOLS = [
  { yahoo: 'CL=F',  name: 'Crude Oil (WTI)',  unit: '/barrel', exchange: 'NYMEX',  flag: '🛢️', currency: 'USD' },
  { yahoo: 'BZ=F',  name: 'Brent Crude',      unit: '/barrel', exchange: 'ICE',    flag: '🛢️', currency: 'USD' },
  { yahoo: 'GC=F',  name: 'Gold',             unit: '/oz',     exchange: 'COMEX',  flag: '🥇', currency: 'USD' },
  { yahoo: 'SI=F',  name: 'Silver',           unit: '/oz',     exchange: 'COMEX',  flag: '🥈', currency: 'USD' },
  { yahoo: 'PL=F',  name: 'Platinum',         unit: '/oz',     exchange: 'NYMEX',  flag: '⚪', currency: 'USD' },
  { yahoo: 'NG=F',  name: 'Natural Gas',      unit: '/MMBtu',  exchange: 'NYMEX',  flag: '🔥', currency: 'USD' },
  { yahoo: 'HG=F',  name: 'Copper',           unit: '/lb',     exchange: 'COMEX',  flag: '🔶', currency: 'USD' },
  { yahoo: 'ALI=F', name: 'Aluminum',         unit: '/lb',     exchange: 'COMEX',  flag: '🔩', currency: 'USD' },
  { yahoo: 'ZW=F',  name: 'Wheat',            unit: '/bu',     exchange: 'CBOT',   flag: '🌾', currency: 'USD' },
  { yahoo: 'CT=F',  name: 'Cotton',           unit: '/lb',     exchange: 'ICE',    flag: '🧶', currency: 'USD' },
  { yahoo: 'SB=F',  name: 'Sugar',            unit: '/lb',     exchange: 'ICE',    flag: '🍬', currency: 'USD' },
];

async function fetchSingle(yahooSymbol: string): Promise<any | null> {
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`;
    const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startMs = Date.now();

  try {
    // 1. Fetch USD/INR rate
    const inrMeta = await fetchSingle('INR=X');
    const usdInr = inrMeta?.regularMarketPrice || 86.5;

    // 2. Fetch all commodities in batches of 6
    const BATCH = 6;
    const results: (any | null)[] = [];
    for (let i = 0; i < COMMODITY_SYMBOLS.length; i += BATCH) {
      const batch = COMMODITY_SYMBOLS.slice(i, i + BATCH);
      const batchResults = await Promise.all(batch.map(s => fetchSingle(s.yahoo)));
      results.push(...batchResults);
    }

    const commodities = [];
    for (let i = 0; i < COMMODITY_SYMBOLS.length; i++) {
      const meta = results[i];
      const info = COMMODITY_SYMBOLS[i];
      if (!meta || !meta.regularMarketPrice) continue;

      const price = meta.regularMarketPrice;
      const prevClose = meta.previousClose || meta.chartPreviousClose || price;
      const change = price - prevClose;
      const changePct = prevClose ? (change / prevClose) * 100 : 0;
      const priceINR = info.currency === 'USD' ? price * usdInr : price;

      commodities.push({
        symbol: info.yahoo.replace('=F', '').replace('.NS', ''),
        name: info.name,
        price: Number(price.toFixed(2)),
        priceINR: Number(priceINR.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePct.toFixed(2)),
        unit: info.unit,
        exchange: info.exchange,
        currency: info.currency,
        flag: info.flag,
        lastUpdated: new Date().toISOString(),
      });
    }

    if (commodities.length === 0) {
      return NextResponse.json({ success: false, error: 'No commodities fetched — CF relay may be down' }, { status: 502 });
    }

    // 3. Write to market_cache
    const payload = { commodities, usdInr, fetchedAt: new Date().toISOString() };
    await pool.query(
      `INSERT INTO market_cache (cache_key, data, scraped_at, is_stale, source_url, updated_at)
       VALUES ('commodities_all', $1, NOW(), FALSE, 'yahoo_finance_cf_relay', NOW())
       ON CONFLICT (cache_key) DO UPDATE SET
         data = EXCLUDED.data, scraped_at = EXCLUDED.scraped_at,
         is_stale = FALSE, updated_at = NOW()`,
      [JSON.stringify(payload)]
    );

    const elapsed = Date.now() - startMs;
    console.log(`[cache-commodities] ${commodities.length} commodities cached in ${elapsed}ms, USD/INR=${usdInr}`);

    return NextResponse.json({
      success: true,
      count: commodities.length,
      usdInr,
      elapsedMs: elapsed,
    });
  } catch (error: any) {
    console.error('[cache-commodities] error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
