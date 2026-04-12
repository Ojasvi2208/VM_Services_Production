import { NextResponse } from 'next/server';

/**
 * Wraps a NextResponse.json() with Cache-Control headers.
 * Reduces redundant fetches from web browsers + mobile app.
 *
 * Usage: return cachedJson(data, 900); // 15 min
 */
export function cachedJson(data: any, maxAgeSeconds: number, staleWhileRevalidate = 60) {
  const res = NextResponse.json(data);
  res.headers.set(
    'Cache-Control',
    `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidate}`
  );
  return res;
}

/** Common TTLs (seconds) */
export const CACHE_TTL = {
  MARKET_DATA: 900,      // 15 min (server cron updates every 15 min)
  MARKET_CHART: 900,     // 15 min
  COMMODITIES: 21600,    // 6 hours
  CURRENCY: 1800,        // 30 min
  FUND_LIST: 3600,       // 1 hour
  FUND_DETAIL: 14400,    // 4 hours (NAV updates once daily)
  FUND_HOLDINGS: 86400,  // 24 hours (monthly update cycle)
  FUND_MANAGERS: 604800, // 7 days
  NEWS: 7200,            // 2 hours
  NFO: 21600,            // 6 hours
  FUEL: 86400,           // 24 hours
  GAINERS_LOSERS: 3600,  // 1 hour
  CORPORATE_ACTIONS: 86400, // 24 hours
} as const;
