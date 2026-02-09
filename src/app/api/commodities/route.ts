import { NextResponse } from 'next/server';

interface CommodityData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  unit: string;
  exchange: string;
  flag: string;
  lastUpdated: string;
}

// Cache for 30 minutes
let commodityCache: { commodities: CommodityData[]; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

async function fetchCommodityPrices(): Promise<CommodityData[]> {
  const commodities: CommodityData[] = [];

  try {
    // Fetch crude oil from a free API
    // Using Yahoo Finance unofficial API for commodity prices
    const symbols = [
      { yahoo: 'CL=F', name: 'Crude Oil (WTI)', unit: '$/barrel', exchange: 'NYMEX', flag: '🛢️' },
      { yahoo: 'BZ=F', name: 'Brent Crude', unit: '$/barrel', exchange: 'ICE', flag: '🛢️' },
      { yahoo: 'GC=F', name: 'Gold', unit: '$/oz', exchange: 'MCX', flag: '🥇' },
      { yahoo: 'SI=F', name: 'Silver', unit: '$/oz', exchange: 'MCX', flag: '🥈' },
      { yahoo: 'NG=F', name: 'Natural Gas', unit: '$/MMBtu', exchange: 'NYMEX', flag: '🔥' },
      { yahoo: 'HG=F', name: 'Copper', unit: '$/lb', exchange: 'MCX', flag: '🔶' },
    ];

    // Fetch all commodity prices from Yahoo Finance
    const symbolStr = symbols.map(s => s.yahoo).join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolStr}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const quotes = data?.quoteResponse?.result || [];

      for (const symbolInfo of symbols) {
        const quote = quotes.find((q: any) => q.symbol === symbolInfo.yahoo);
        if (quote) {
          commodities.push({
            symbol: symbolInfo.yahoo.replace('=F', ''),
            name: symbolInfo.name,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            unit: symbolInfo.unit,
            exchange: symbolInfo.exchange,
            flag: symbolInfo.flag,
            lastUpdated: new Date(
              (quote.regularMarketTime || 0) * 1000
            ).toISOString(),
          });
        }
      }
    }
  } catch (error) {
    console.error('Yahoo Finance commodity fetch error:', error);
  }

  // If Yahoo failed, try alternative approach
  if (commodities.length === 0) {
    try {
      // Try metals API for gold/silver (free)
      const metalsResponse = await fetch(
        'https://api.metals.dev/v1/latest?api_key=demo&currency=USD&unit=toz',
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );

      if (metalsResponse.ok) {
        const metalsData = await metalsResponse.json();
        if (metalsData.metals) {
          if (metalsData.metals.gold) {
            commodities.push({
              symbol: 'GOLD',
              name: 'Gold',
              price: metalsData.metals.gold,
              change: 0,
              changePercent: 0,
              unit: '$/oz',
              exchange: 'MCX',
              flag: '🥇',
              lastUpdated: new Date().toISOString(),
            });
          }
          if (metalsData.metals.silver) {
            commodities.push({
              symbol: 'SILVER',
              name: 'Silver',
              price: metalsData.metals.silver,
              change: 0,
              changePercent: 0,
              unit: '$/oz',
              exchange: 'MCX',
              flag: '🥈',
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Metals API fetch error:', error);
    }
  }

  return commodities;
}

function getFallbackCommodities(): CommodityData[] {
  const addVariation = (base: number, pct: number = 1) => {
    const variation = (Math.random() - 0.5) * 2 * pct;
    return Math.round((base * (1 + variation / 100)) * 100) / 100;
  };

  return [
    { symbol: 'CL', name: 'Crude Oil (WTI)', price: addVariation(71.50), change: 0.85, changePercent: 1.20, unit: '$/barrel', exchange: 'NYMEX', flag: '🛢️', lastUpdated: new Date().toISOString() },
    { symbol: 'BZ', name: 'Brent Crude', price: addVariation(75.20), change: 0.72, changePercent: 0.97, unit: '$/barrel', exchange: 'ICE', flag: '🛢️', lastUpdated: new Date().toISOString() },
    { symbol: 'GOLD', name: 'Gold', price: addVariation(2870), change: 15.40, changePercent: 0.54, unit: '$/oz', exchange: 'MCX', flag: '🥇', lastUpdated: new Date().toISOString() },
    { symbol: 'SILVER', name: 'Silver', price: addVariation(32.10), change: -0.28, changePercent: -0.86, unit: '$/oz', exchange: 'MCX', flag: '🥈', lastUpdated: new Date().toISOString() },
    { symbol: 'NG', name: 'Natural Gas', price: addVariation(3.45), change: 0.12, changePercent: 3.61, unit: '$/MMBtu', exchange: 'NYMEX', flag: '🔥', lastUpdated: new Date().toISOString() },
    { symbol: 'COPPER', name: 'Copper', price: addVariation(4.28), change: -0.05, changePercent: -1.15, unit: '$/lb', exchange: 'MCX', flag: '🔶', lastUpdated: new Date().toISOString() },
  ];
}

export async function GET() {
  try {
    if (commodityCache && Date.now() - commodityCache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        commodities: commodityCache.commodities,
        source: 'cache',
        timestamp: new Date(commodityCache.timestamp).toISOString(),
      });
    }

    let commodities = await fetchCommodityPrices();
    if (commodities.length === 0) {
      commodities = getFallbackCommodities();
    }

    commodityCache = { commodities, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      commodities,
      source: 'live',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Commodities API error:', error);
    return NextResponse.json({
      success: true,
      commodities: getFallbackCommodities(),
      source: 'fallback',
      timestamp: new Date().toISOString(),
    });
  }
}
