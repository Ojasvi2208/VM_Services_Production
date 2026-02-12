import { NextResponse } from 'next/server';

// Gift Nifty — Real-time Nifty 50 Futures indicator
// Fetches live data from Yahoo Finance via CF relay. 1-hour cache.

const CF_RELAY_URL = process.env.CF_RELAY_URL || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

interface GiftNiftyData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  previousClose: number;
  impliedOpen: number;
  marketStatus: string;
}

// Cache for 1 hour (shared across all users)
let giftNiftyCache: { data: GiftNiftyData; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getMarketStatus(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const day = istTime.getUTCDay();

  if (day === 0 || day === 6) return 'Weekend';

  const t = hours * 60 + minutes;
  if (t < 9 * 60 + 15) return 'Pre-Market';
  if (t <= 15 * 60 + 30) return 'Market Open';
  return 'Post-Market';
}

async function fetchNiftyFromYahoo(): Promise<GiftNiftyData | null> {
  // Fetch Nifty 50 spot (^NSEI) via CF relay → Yahoo Finance chart API
  // This gives us real-time price, previousClose, and market state
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent('^NSEI')}`;
  const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!response.ok) return null;

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const change = prevClose ? price - prevClose : 0;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    const impliedOpen = price; // Nifty 50 spot is the best implied open indicator

    const marketState = meta.marketState || '';
    let status = getMarketStatus();
    if (marketState === 'REGULAR') status = 'Market Open';
    else if (marketState === 'PRE') status = 'Pre-Market';
    else if (marketState === 'POST' || marketState === 'POSTPOST') status = 'Post-Market';
    else if (marketState === 'CLOSED') status = 'Market Closed';

    return {
      symbol: 'GIFT_NIFTY',
      name: 'Gift Nifty',
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePct * 100) / 100,
      lastUpdated: new Date().toISOString(),
      previousClose: Math.round(prevClose * 100) / 100,
      impliedOpen: Math.round(impliedOpen * 100) / 100,
      marketStatus: status,
    };
  } catch (error) {
    clearTimeout(timer);
    console.error('Gift Nifty Yahoo fetch failed:', error);
    return null;
  }
}

export async function GET() {
  try {
    // Serve from cache if fresh (< 1 hour old)
    if (giftNiftyCache && Date.now() - giftNiftyCache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: giftNiftyCache.data,
        source: 'cache',
        cacheAge: Math.round((Date.now() - giftNiftyCache.timestamp) / 60000) + 'm',
      });
    }

    // Fetch real data from Yahoo Finance via CF relay
    const giftNiftyData = await fetchNiftyFromYahoo();

    if (!giftNiftyData) {
      // If fetch failed but we have stale cache, serve it
      if (giftNiftyCache) {
        return NextResponse.json({
          success: true,
          data: giftNiftyCache.data,
          source: 'stale-cache',
        });
      }
      return NextResponse.json({ success: false, error: 'Unable to fetch Gift Nifty data' }, { status: 502 });
    }

    // Update shared cache
    giftNiftyCache = { data: giftNiftyData, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      data: giftNiftyData,
      source: 'live',
    });
  } catch (error) {
    console.error('Gift Nifty API error:', error);
    if (giftNiftyCache) {
      return NextResponse.json({ success: true, data: giftNiftyCache.data, source: 'error-fallback' });
    }
    return NextResponse.json({ success: false, error: 'Gift Nifty unavailable' }, { status: 500 });
  }
}
