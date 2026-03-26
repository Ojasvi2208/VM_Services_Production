/**
 * Gainers/Losers Cache Cron
 * Pre-fetches top gainers and losers from NSE API.
 * Writes to market_cache (key: gainers_losers).
 * User-facing /api/stocks/gainers-losers reads from DB first — zero per-user NSE calls.
 *
 * Schedule: Every 15 min during market hours (Mon-Fri 8:30AM-3:30PM IST)
 * Calls: 1 session cookie + 2 NSE API calls per run
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

interface NSEStockData {
  symbol: string;
  series?: string;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  ltp?: number;
  prev_price?: number;
  pChange?: number;
  change?: number;
  traded_quantity?: number;
  turnover_in_lakhs?: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  previousPrice?: number;
  netPrice?: number;
  tradedQuantity?: number;
  turnoverInLakhs?: number;
}

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  high?: number;
  low?: number;
}

const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.5',
};

async function fetchFromNSE(): Promise<{ gainers: StockData[]; losers: StockData[] }> {
  // 1. Get session cookies
  const mainResponse = await fetch('https://www.nseindia.com', {
    headers: { ...NSE_HEADERS, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' },
  });
  const cookies = mainResponse.headers.get('set-cookie') || '';

  const apiHeaders = {
    ...NSE_HEADERS,
    'Accept': 'application/json',
    'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
    'Cookie': cookies,
  };

  // 2. Fetch gainers and losers in parallel
  const [gainersResponse, losersResponse] = await Promise.all([
    fetch('https://www.nseindia.com/api/live-analysis-variations?index=gainers', { headers: apiHeaders }),
    fetch('https://www.nseindia.com/api/live-analysis-variations?index=losers', { headers: apiHeaders }),
  ]);

  if (!gainersResponse.ok || !losersResponse.ok) {
    throw new Error(`NSE API returned non-OK: gainers=${gainersResponse.status} losers=${losersResponse.status}`);
  }

  const [gainersData, losersData] = await Promise.all([
    gainersResponse.json(),
    losersResponse.json(),
  ]);

  const extractData = (response: any): NSEStockData[] => {
    if (response?.NIFTY?.data) return response.NIFTY.data;
    if (response?.allSec) return response.allSec;
    if (response?.data) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  };

  const mapStockData = (data: NSEStockData[]): StockData[] => {
    if (!Array.isArray(data)) return [];
    return data.slice(0, 10).map((stock) => {
      const price = stock.ltp || 0;
      const prevPrice = stock.prev_price || stock.previousPrice || price;
      const changePercent = stock.pChange || stock.netPrice || 0;
      const change = stock.change || (price - prevPrice);
      return {
        symbol: stock.symbol,
        name: stock.symbol,
        price,
        change,
        changePercent,
        volume: stock.traded_quantity || stock.tradedQuantity,
        high: stock.high_price || stock.highPrice,
        low: stock.low_price || stock.lowPrice,
      };
    });
  };

  return {
    gainers: mapStockData(extractData(gainersData)),
    losers: mapStockData(extractData(losersData)),
  };
}

export async function GET(request: NextRequest) {
  // Auth gate
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
    const { gainers, losers } = await fetchFromNSE();

    if (gainers.length === 0 && losers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'NSE returned empty data — skipping cache write',
        elapsed: Date.now() - startMs,
      }, { status: 502 });
    }

    const payload = JSON.stringify({
      success: true,
      gainers,
      losers,
      isLive: true,
      timestamp: new Date().toISOString(),
    });

    await pool.query(
      `INSERT INTO market_cache (cache_key, data, scraped_at, is_stale, source_url, updated_at)
       VALUES ('gainers_losers', $1, NOW(), FALSE, 'nse_api', NOW())
       ON CONFLICT (cache_key) DO UPDATE
         SET data = EXCLUDED.data,
             scraped_at = EXCLUDED.scraped_at,
             is_stale = FALSE,
             updated_at = NOW()`,
      [payload]
    );

    console.log(`[cache-gainers-losers] Cached ${gainers.length}G/${losers.length}L in ${Date.now() - startMs}ms`);

    return NextResponse.json({
      success: true,
      cached: { gainers: gainers.length, losers: losers.length },
      elapsed: Date.now() - startMs,
    });
  } catch (error) {
    console.error('[cache-gainers-losers] Failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      elapsed: Date.now() - startMs,
    }, { status: 502 });
  }
}
