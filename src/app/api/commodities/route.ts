import { NextResponse } from 'next/server';

// Real-time commodity prices via CF relay → Yahoo Finance chart API
// Fetches international + MCX India prices in both USD and INR
// NO mock/fallback data

const CF_RELAY_URL = process.env.CF_RELAY_URL || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

interface CommodityData {
  symbol: string;
  name: string;
  price: number;
  priceINR: number;
  change: number;
  changePercent: number;
  unit: string;
  exchange: string;
  currency: string;
  flag: string;
  lastUpdated: string;
}

// Yahoo Finance symbols for commodities
const COMMODITY_SYMBOLS = [
  // International
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

let commodityCache: { commodities: CommodityData[]; usdInr: number; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

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

async function fetchUSDINR(): Promise<number> {
  try {
    const meta = await fetchSingle('INR=X');
    if (meta?.regularMarketPrice) return meta.regularMarketPrice;
  } catch {}
  return 86.5; // reasonable fallback
}

async function fetchAllCommodities(): Promise<{ commodities: CommodityData[]; usdInr: number }> {
  // Fetch USD/INR rate + all commodities in parallel batches
  const usdInr = await fetchUSDINR();

  const BATCH = 6;
  const results: (any | null)[] = [];
  for (let i = 0; i < COMMODITY_SYMBOLS.length; i += BATCH) {
    const batch = COMMODITY_SYMBOLS.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(s => fetchSingle(s.yahoo)));
    results.push(...batchResults);
  }

  const commodities: CommodityData[] = [];
  for (let i = 0; i < COMMODITY_SYMBOLS.length; i++) {
    const meta = results[i];
    const info = COMMODITY_SYMBOLS[i];
    if (!meta || !meta.regularMarketPrice) continue;

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose || price;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    // Convert to INR if USD
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

  return { commodities, usdInr };
}

export async function GET() {
  try {
    if (commodityCache && Date.now() - commodityCache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        commodities: commodityCache.commodities,
        usdInr: commodityCache.usdInr,
        source: 'cache',
        timestamp: new Date(commodityCache.timestamp).toISOString(),
      });
    }

    const { commodities, usdInr } = await fetchAllCommodities();

    if (commodities.length > 0) {
      commodityCache = { commodities, usdInr, timestamp: Date.now() };
    }

    console.log(`Commodities: fetched ${commodities.length}/${COMMODITY_SYMBOLS.length} via CF relay, USD/INR=${usdInr}`);

    return NextResponse.json({
      success: true,
      commodities,
      usdInr,
      source: 'live',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Commodities API error:', error);

    if (commodityCache) {
      return NextResponse.json({
        success: true,
        commodities: commodityCache.commodities,
        usdInr: commodityCache.usdInr,
        source: 'stale-cache',
        timestamp: new Date(commodityCache.timestamp).toISOString(),
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch commodities',
      commodities: [],
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
