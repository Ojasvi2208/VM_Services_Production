import { NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// In-memory cache with 5-minute TTL (avoids DB hit on every request)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const ALL_KEYS = ['nifty_constituents', 'fii_dii', 'index_movers_nifty', 'index_movers_banknifty'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key') || 'all';
    const cacheKey = `market_state_${key}`;

    // Check in-memory cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ ...cached.data, source: 'cache' });
    }

    // Read from PostgreSQL market_cache table (populated by FastAPI scraper)
    const keys = key === 'all' ? ALL_KEYS : [key];
    const result = await pool.query(
      `SELECT cache_key, data, scraped_at, is_stale FROM market_cache WHERE cache_key = ANY($1)`,
      [keys]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No market state data available. Scraper may not have run yet.',
        data: {},
        staleness: {},
      });
    }

    // Assemble response with staleness metadata
    const data: Record<string, any> = {};
    const staleness: Record<string, any> = {};

    for (const row of result.rows) {
      data[row.cache_key] = row.data;
      staleness[row.cache_key] = {
        is_stale: row.is_stale,
        scraped_at: row.scraped_at,
      };
    }

    const response = { success: true, data, staleness, source: 'db' };

    // Store in in-memory cache
    cache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('market-state error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch market state' },
      { status: 500 }
    );
  }
}
