import { NextRequest, NextResponse } from 'next/server';

// Real market data via Cloudflare Worker relay → Yahoo Finance chart API
// All Indian indices supported. Parallel fetch. 5-minute cache. NO mock data.

const CF_RELAY_URL = process.env.CF_RELAY_URL || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

interface MarketDataItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  isMarketOpen: boolean;
  exchange: string;
}

// ─── Symbol map: our key → { Yahoo Finance symbol, display name } ───────────
const SYMBOL_MAP: Record<string, { yahoo: string; name: string; exchange: string }> = {
  // ─── NSE Indices ───
  'NIFTY':            { yahoo: '^NSEI',                 name: 'NIFTY 50',            exchange: 'NSE' },
  'BANKNIFTY':        { yahoo: '^NSEBANK',              name: 'BANK NIFTY',          exchange: 'NSE' },
  'NIFTYIT':          { yahoo: '^CNXIT',                name: 'NIFTY IT',            exchange: 'NSE' },
  'NIFTYNEXT50':      { yahoo: '^NSMIDCP',              name: 'NIFTY NEXT 50',       exchange: 'NSE' },
  'NIFTYMIDCAP150':   { yahoo: 'NIFTY_MIDCAP_150.NS',  name: 'NIFTY MIDCAP 150',    exchange: 'NSE' },
  'NIFTYSMALLCAP100': { yahoo: 'NIFTY_SMLCAP_100.NS',  name: 'NIFTY SMALLCAP 100',  exchange: 'NSE' },
  'NIFTYPHARMA':      { yahoo: '^CNXPHARMA',            name: 'NIFTY PHARMA',        exchange: 'NSE' },
  'NIFTYAUTO':        { yahoo: '^CNXAUTO',              name: 'NIFTY AUTO',          exchange: 'NSE' },
  'NIFTYFMCG':        { yahoo: '^CNXFMCG',              name: 'NIFTY FMCG',          exchange: 'NSE' },
  'NIFTYMETAL':       { yahoo: '^CNXMETAL',             name: 'NIFTY METAL',         exchange: 'NSE' },
  'NIFTYREALTY':      { yahoo: '^CNXREALTY',            name: 'NIFTY REALTY',        exchange: 'NSE' },
  'NIFTYENERGY':      { yahoo: '^CNXENERGY',            name: 'NIFTY ENERGY',        exchange: 'NSE' },
  'NIFTYINFRA':       { yahoo: '^CNXINFRA',             name: 'NIFTY INFRA',         exchange: 'NSE' },
  'NIFTYPSE':         { yahoo: '^CNXPSE',               name: 'NIFTY PSE',           exchange: 'NSE' },
  'NIFTYFINSERVICE':  { yahoo: 'NIFTY_FIN_SERVICE.NS',  name: 'NIFTY FIN SERVICE',   exchange: 'NSE' },
  'NIFTYPVTBANK':     { yahoo: 'NIFTY_PVT_BANK.NS',    name: 'NIFTY PVT BANK',      exchange: 'NSE' },
  // ─── BSE Indices ───
  'SENSEX':           { yahoo: '^BSESN',                name: 'SENSEX',              exchange: 'BSE' },
  'BSE500':           { yahoo: 'BSE-500.BO',            name: 'BSE 500',             exchange: 'BSE' },
  'BSEMIDCAP':        { yahoo: 'BSE-MIDCAP.BO',        name: 'BSE MIDCAP',          exchange: 'BSE' },
  'BSESMALLCAP':      { yahoo: 'BSE-SMLCAP.BO',        name: 'BSE SMALLCAP',        exchange: 'BSE' },
  'BSEFMCG':           { yahoo: 'BSE-FMCG.BO',           name: 'BSE FMCG',            exchange: 'BSE' },
  'BSEIT':            { yahoo: 'BSE-IT.BO',             name: 'BSE IT',              exchange: 'BSE' },
  'BSEHEALTHCARE':    { yahoo: 'BSE-HC.BO',             name: 'BSE HEALTHCARE',      exchange: 'BSE' },
  'BSEAUTO':          { yahoo: 'BSE-AUTO.BO',           name: 'BSE AUTO',            exchange: 'BSE' },
  'BSEMETAL':         { yahoo: 'BSE-METAL.BO',          name: 'BSE METAL',           exchange: 'BSE' },
  'BSEOILGAS':        { yahoo: 'BSE-OILGAS.BO',         name: 'BSE OIL & GAS',       exchange: 'BSE' },
  'BSEREALTY':        { yahoo: 'BSE-REALTY.BO',         name: 'BSE REALTY',          exchange: 'BSE' },
  'BSECG':            { yahoo: 'BSE-CG.BO',             name: 'BSE CAPITAL GOODS',   exchange: 'BSE' },
  'BSEPOWER':         { yahoo: 'BSE-POWER.BO',          name: 'BSE POWER',           exchange: 'BSE' },
};

// ─── Cache (5 minutes) ──────────────────────────────────────────────────────
let marketCache: { data: Map<string, MarketDataItem>; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// ─── Fetch single symbol via CF relay → Yahoo Finance chart API ─────────────
async function fetchSymbol(symbol: string): Promise<MarketDataItem | null> {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping) return null;

  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapping.yahoo)}`;
    const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!response.ok) return null;

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const change = prevClose ? price - prevClose : 0;
    const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

    return {
      symbol,
      name: mapping.name,
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      lastUpdated: new Date().toISOString(),
      isMarketOpen: meta.marketState === 'REGULAR',
      exchange: mapping.exchange,
    };
  } catch (error: any) {
    console.error(`Market fetch error for ${symbol}:`, error?.name === 'AbortError' ? 'timeout' : error?.message);
    return null;
  }
}

function isMarketCurrentlyOpen(): boolean {
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = istTime.getDay();
  const mins = istTime.getHours() * 60 + istTime.getMinutes();
  if (day === 0 || day === 6) return false;
  return mins >= 555 && mins <= 930; // 9:15 AM – 3:30 PM IST
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()) || ['NIFTY'];

    // Serve from cache if fresh
    if (marketCache && Date.now() - marketCache.timestamp < CACHE_TTL) {
      const cached = symbols
        .map(s => marketCache!.data.get(s))
        .filter(Boolean) as MarketDataItem[];

      if (cached.length > 0) {
        return NextResponse.json({
          success: true,
          data: cached,
          timestamp: new Date(marketCache.timestamp).toISOString(),
          isMarketOpen: isMarketCurrentlyOpen(),
          source: 'cache',
        });
      }
    }

    // Fetch in batches of 8 to avoid overwhelming CF relay
    const BATCH_SIZE = 8;
    const valid: MarketDataItem[] = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(s => fetchSymbol(s)));
      valid.push(...results.filter(Boolean) as MarketDataItem[]);
    }

    // Update cache (merge with existing)
    const cacheMap = marketCache?.data ? new Map(marketCache.data) : new Map<string, MarketDataItem>();
    for (const item of valid) {
      cacheMap.set(item.symbol, item);
    }
    marketCache = { data: cacheMap, timestamp: Date.now() };

    console.log(`Market data: fetched ${valid.length}/${symbols.length} indices via CF relay`);

    return NextResponse.json({
      success: true,
      data: valid,
      timestamp: new Date().toISOString(),
      isMarketOpen: isMarketCurrentlyOpen(),
    });
  } catch (error) {
    console.error('Market data API error:', error);

    // Return stale cache if available
    if (marketCache) {
      const { searchParams } = new URL(request.url);
      const symbols = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()) || ['NIFTY'];
      const stale = symbols.map(s => marketCache!.data.get(s)).filter(Boolean) as MarketDataItem[];
      return NextResponse.json({
        success: true,
        data: stale,
        timestamp: new Date(marketCache.timestamp).toISOString(),
        isMarketOpen: isMarketCurrentlyOpen(),
        source: 'stale-cache',
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch market data',
      data: [],
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
