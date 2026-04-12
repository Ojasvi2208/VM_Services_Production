/**
 * GET /api/markets/bundle
 * Single endpoint returning all data needed for the Markets home screen.
 * Reduces 5 parallel API calls to 1 — saves round trips for mobile app.
 *
 * Returns: indices, fiiDii, movers (gainers/losers), commodities, currency
 * All read from market_cache (DB) — zero external API calls.
 */

import { NextResponse } from 'next/server';
import { cachedJson, CACHE_TTL } from '@/lib/api-cache-headers';
import pool from '@/lib/postgres-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Parallel DB reads — all from market_cache table
    const [indicesRes, fiiDiiRes, moversRes, commoditiesRes, gainersRes] = await Promise.allSettled([
      pool.query(`SELECT data FROM market_cache WHERE key = 'live_indices' LIMIT 1`),
      pool.query(`SELECT data FROM market_cache WHERE key = 'fii_dii' LIMIT 1`),
      pool.query(`SELECT data FROM market_cache WHERE key = 'index_movers_nifty' LIMIT 1`),
      pool.query(`SELECT data FROM market_cache WHERE key = 'commodities_all' LIMIT 1`),
      pool.query(`SELECT data FROM market_cache WHERE key = 'gainers_losers' LIMIT 1`),
    ]);

    const extract = (res: PromiseSettledResult<any>) => {
      if (res.status === 'fulfilled' && res.value.rows.length > 0) {
        return res.value.rows[0].data;
      }
      return null;
    };

    const indices = extract(indicesRes);
    const fiiDii = extract(fiiDiiRes);
    const movers = extract(moversRes);
    const commodities = extract(commoditiesRes);
    const gainers = extract(gainersRes);

    return cachedJson({
      success: true,
      indices: indices?.items ?? [],
      fiiDii: fiiDii?.fii_dii ?? null,
      movers: movers?.index_movers_nifty ?? null,
      commodities: commodities?.commodities ?? commodities ?? [],
      gainersLosers: gainers ?? { gainers: [], losers: [] },
      timestamp: new Date().toISOString(),
    }, CACHE_TTL.MARKET_DATA);
  } catch (error: any) {
    console.error('[markets/bundle] error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      indices: [],
      fiiDii: null,
      movers: null,
      commodities: [],
      gainersLosers: { gainers: [], losers: [] },
    }, { status: 500 });
  }
}
