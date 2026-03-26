/**
 * News Cache Cron — Populates market_cache with aggregated news
 *
 * Every 2 hours (0 every-2h daily)
 *
 * Self-fetches the existing /api/news/aggregated endpoint (which handles all
 * RSS parsing, og:image scraping, dedup, and sorting), then writes the full
 * response payload as a JSONB blob to market_cache (key: news_aggregated).
 *
 * The user-facing route reads this DB cache first, falling back to live RSS
 * only if the cache is missing or stale (>3 hours). This eliminates redundant
 * RSS fetches across concurrent user requests in serverless cold-starts.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// ─── Auth ─────────────────────────────────────────────────────────────────────
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startMs = Date.now();

  try {
    // Self-fetch the existing news aggregation endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/news/aggregated`, {
      headers: { 'User-Agent': 'VMFSCronBot/1.0' },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`News endpoint returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (!data.success || !data.articles || data.articles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'News endpoint returned no articles',
        elapsed: Date.now() - startMs,
      }, { status: 502 });
    }

    // Write full response payload to market_cache
    await pool.query(
      `INSERT INTO market_cache (cache_key, data, scraped_at, is_stale, source_url, updated_at)
       VALUES ('news_aggregated', $1, NOW(), FALSE, 'rss_feeds', NOW())
       ON CONFLICT (cache_key) DO UPDATE SET
         data       = EXCLUDED.data,
         scraped_at = EXCLUDED.scraped_at,
         is_stale   = FALSE,
         updated_at = NOW()`,
      [JSON.stringify(data)]
    );

    const elapsed = Date.now() - startMs;
    console.log(`[cache-news] Wrote ${data.articles.length} articles to DB in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      articles: data.articles.length,
      categories: data.categories,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[cache-news] cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
