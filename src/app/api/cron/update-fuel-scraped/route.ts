import { NextRequest, NextResponse } from 'next/server';
import { setScrapedFuelCache, type ScrapedFuelData } from '@/lib/fuel-cache';

const SCRAPE_SECRET = process.env.FUEL_SCRAPE_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // Verify secret (skip in dev or if no secret configured)
    const secret = request.headers.get('x-scrape-secret') || '';
    if (SCRAPE_SECRET && secret !== SCRAPE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data: ScrapedFuelData = await request.json();

    // Basic validation
    if (!data.cities || !data.states || !data.fetchedAt) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const cityCount = Object.keys(data.cities).length;
    const stateCount = Object.keys(data.states).length;

    if (cityCount === 0 && stateCount === 0) {
      return NextResponse.json({ error: 'No price data in payload' }, { status: 400 });
    }

    // Store in module-level cache
    setScrapedFuelCache(data);

    // Persist to /tmp for cold-start recovery
    try {
      const fs = await import('fs');
      fs.writeFileSync('/tmp/fuel-scraped-cache.json', JSON.stringify(data));
    } catch { /* non-critical */ }

    console.log(`[update-fuel-scraped] Stored ${cityCount} cities, ${stateCount} states from ${data.source}`);

    return NextResponse.json({
      success: true,
      cities: cityCount,
      states: stateCount,
      fetchedAt: data.fetchedAt,
    });
  } catch (error) {
    console.error('[update-fuel-scraped] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Also support GET for health check / manual trigger
export async function GET() {
  const { getScrapedFuelCache, isScrapedCacheFresh } = await import('@/lib/fuel-cache');
  const cache = getScrapedFuelCache();
  return NextResponse.json({
    hasCachedData: !!cache,
    isFresh: isScrapedCacheFresh(),
    cityCount: cache ? Object.keys(cache.cities).length : 0,
    stateCount: cache ? Object.keys(cache.states).length : 0,
    fetchedAt: cache?.fetchedAt || null,
    source: cache?.source || null,
  });
}
