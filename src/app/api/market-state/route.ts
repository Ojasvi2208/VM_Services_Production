import { NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// In-memory cache — 5-min TTL avoids a DB hit on every request
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const ALL_KEYS = ['nifty_constituents', 'fii_dii', 'index_movers_nifty', 'index_movers_banknifty'];

// Postgres error code for "relation does not exist" (table not yet migrated)
const PG_UNDEFINED_TABLE = '42P01';

/** Empty envelope returned when the scraper has not yet populated data. */
function emptyEnvelope(keys: string[]) {
  const data: Record<string, any> = {};
  const staleness: Record<string, any> = {};
  for (const k of keys) {
    data[k] = null;
    staleness[k] = { is_stale: true, scraped_at: null };
  }
  return { success: true, data, staleness, source: 'empty' };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') || 'all';
  const cacheKey = `market_state_${key}`;

  // Serve from in-memory cache if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, source: 'cache' });
  }

  const keys = key === 'all' ? ALL_KEYS : [key];

  try {
    const result = await pool.query(
      `SELECT cache_key, data, scraped_at, is_stale
         FROM market_cache
        WHERE cache_key = ANY($1)`,
      [keys],
    );

    // Scraper hasn't run yet — return empty envelope, not an error
    if (result.rows.length === 0) {
      const envelope = emptyEnvelope(keys);
      cache.set(cacheKey, { data: envelope, timestamp: Date.now() });
      return NextResponse.json(envelope);
    }

    const data: Record<string, any> = {};
    const staleness: Record<string, any> = {};

    for (const row of result.rows) {
      // Empty seed rows have data = {} — treat as null so the UI shows "unavailable"
      const isEmpty = !row.data || Object.keys(row.data).length === 0;
      data[row.cache_key] = isEmpty ? null : row.data;
      staleness[row.cache_key] = {
        is_stale: row.is_stale,
        scraped_at: row.scraped_at ?? null,
      };
    }

    // Fill any keys that were not in DB at all (partial result)
    for (const k of keys) {
      if (!(k in data)) {
        data[k] = null;
        staleness[k] = { is_stale: true, scraped_at: null };
      }
    }

    const response = { success: true, data, staleness, source: 'db' };
    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);

  } catch (error: any) {
    // Table does not exist yet — migration 020 hasn't been run.
    // Return a graceful empty envelope so the UI degrades cleanly.
    if (error?.code === PG_UNDEFINED_TABLE) {
      console.warn('[market-state] market_cache table missing — run migration 020');
      const envelope = emptyEnvelope(keys);
      return NextResponse.json(envelope);
    }

    console.error('[market-state] DB error:', error?.message ?? error);
    // Return empty envelope even on unexpected errors — never 500 to the client
    return NextResponse.json(emptyEnvelope(keys));
  }
}
