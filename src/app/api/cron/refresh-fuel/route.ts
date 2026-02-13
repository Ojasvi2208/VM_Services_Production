import { NextResponse } from 'next/server';
import { getScrapedFuelCache, isScrapedCacheFresh } from '@/lib/fuel-cache';

// DEPRECATED: This cron previously called indianapi.in which drained the free tier.
// Fuel prices are now scraped from goodreturns.in via GitHub Action → POST /api/cron/update-fuel-scraped.
// This endpoint is kept as a health-check / no-op so the Vercel cron doesn't 404.

export async function GET() {
  const cache = getScrapedFuelCache();
  return NextResponse.json({
    success: true,
    message: 'Fuel prices now managed by GitHub Action scraper (goodreturns.in). This cron is a no-op.',
    scrapedCachePresent: !!cache,
    scrapedCacheFresh: isScrapedCacheFresh(),
    cityCount: cache ? Object.keys(cache.cities).length : 0,
    stateCount: cache ? Object.keys(cache.states).length : 0,
    fetchedAt: cache?.fetchedAt || null,
  });
}
