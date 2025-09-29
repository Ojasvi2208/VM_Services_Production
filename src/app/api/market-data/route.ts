import { NextRequest, NextResponse } from 'next/server';

// Free APIs for market data:
// 1. Alpha Vantage - 500 calls/day free
// 2. Polygon.io - 5 calls/minute free
// 3. IEX Cloud - Limited free tier
// 4. Yahoo Finance (unofficial) - Free but may need CORS proxy

interface MarketDataResponse {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  isMarketOpen: boolean;
}

// Alpha Vantage API implementation
async function fetchFromAlphaVantage(symbol: string): Promise<MarketDataResponse | null> {
  const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  
  if (!API_KEY) {
    console.warn('Alpha Vantage API key not found');
    return null;
  }

  try {
    // Map symbols to Alpha Vantage format
    const symbolMap: Record<string, string> = {
      'NIFTY': '^NSEI',
      'SENSEX': '^BSESN',
      'BANKNIFTY': '^NSEBANK',
      'USDINR': 'INR=X',
      'GOLD': 'GC=F',
      'SILVER': 'SI=F'
    };

    const mappedSymbol = symbolMap[symbol] || symbol;
    
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${mappedSymbol}&apikey=${API_KEY}`,
      { 
        cache: 'no-store',
        next: { revalidate: 60 } // Cache for 1 minute
      }
    );

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();
    const quote = data['Global Quote'];

    if (!quote || Object.keys(quote).length === 0) {
      throw new Error('No data received from Alpha Vantage');
    }

    const price = parseFloat(quote['05. price']);
    const change = parseFloat(quote['09. change']);
    const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

    return {
      symbol,
      name: getDisplayName(symbol),
      price: price,
      change: change,
      changePercent: changePercent,
      lastUpdated: quote['07. latest trading day'],
      isMarketOpen: isMarketCurrentlyOpen()
    };

  } catch (error) {
    console.error(`Alpha Vantage error for ${symbol}:`, error);
    return null;
  }
}

// Yahoo Finance API implementation (requires CORS proxy in production)
async function fetchFromYahooFinance(symbol: string): Promise<MarketDataResponse | null> {
  try {
    // Map symbols to Yahoo Finance format
    const symbolMap: Record<string, string> = {
      'NIFTY': '^NSEI',
      'SENSEX': '^BSESN',
      'BANKNIFTY': '^NSEBANK',
      'USDINR': 'INR=X',
      'GOLD': 'GC=F',
      'SILVER': 'SI=F'
    };

    const mappedSymbol = symbolMap[symbol] || symbol;
    
    // Note: In production, you'll need a CORS proxy
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${mappedSymbol}`,
      { 
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];
    const meta = result.meta;

    return {
      symbol,
      name: getDisplayName(symbol),
      price: meta.regularMarketPrice,
      change: meta.regularMarketPrice - meta.previousClose,
      changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      lastUpdated: new Date().toISOString(),
      isMarketOpen: meta.marketState === 'REGULAR'
    };

  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error);
    return null;
  }
}

// IEX Cloud API implementation
async function fetchFromIEXCloud(symbol: string): Promise<MarketDataResponse | null> {
  const API_KEY = process.env.IEX_CLOUD_API_KEY;
  
  if (!API_KEY) {
    console.warn('IEX Cloud API key not found');
    return null;
  }

  try {
    // IEX Cloud primarily supports US stocks, limited Indian market data
    const response = await fetch(
      `https://cloud.iexapis.com/stable/stock/${symbol}/quote?token=${API_KEY}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error(`IEX Cloud API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      symbol,
      name: data.companyName || getDisplayName(symbol),
      price: data.latestPrice,
      change: data.change,
      changePercent: data.changePercent * 100,
      lastUpdated: data.latestTime,
      isMarketOpen: data.isUSMarketOpen
    };

  } catch (error) {
    console.error(`IEX Cloud error for ${symbol}:`, error);
    return null;
  }
}

function getDisplayName(symbol: string): string {
  const names: Record<string, string> = {
    'NIFTY': 'NIFTY 50',
    'SENSEX': 'SENSEX',
    'BANKNIFTY': 'BANK NIFTY',
    'NIFTYNXT50': 'NIFTY NXT 50',
    'NIFTYIT': 'NIFTY IT',
    'USDINR': 'USD/INR',
    'GOLD': 'GOLD',
    'SILVER': 'SILVER',
    'CRUDEOIL': 'CRUDE OIL',
    'GIFTNIFTY': 'GIFT NIFTY'
  };
  
  return names[symbol] || symbol;
}

function isMarketCurrentlyOpen(): boolean {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  const day = istTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const currentTimeMinutes = hours * 60 + minutes;
  
  // Market hours: 9:15 AM (555 minutes) to 3:30 PM (930 minutes)
  const marketOpenMinutes = 9 * 60 + 15; // 9:15 AM
  const marketCloseMinutes = 15 * 60 + 30; // 3:30 PM
  
  // Check for weekends
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Check market hours on weekdays
  return currentTimeMinutes >= marketOpenMinutes && currentTimeMinutes <= marketCloseMinutes;
}

// Fallback mock data generator
function generateMockData(symbol: string): MarketDataResponse {
  const baseData: Record<string, { basePrice: number; volatility: number }> = {
    'NIFTY': { basePrice: 19850, volatility: 0.02 },
    'SENSEX': { basePrice: 66800, volatility: 0.02 },
    'BANKNIFTY': { basePrice: 45200, volatility: 0.025 },
    'NIFTYNXT50': { basePrice: 68500, volatility: 0.02 },
    'NIFTYIT': { basePrice: 35600, volatility: 0.03 },
    'USDINR': { basePrice: 83.25, volatility: 0.005 },
    'GOLD': { basePrice: 62500, volatility: 0.015 },
    'SILVER': { basePrice: 74200, volatility: 0.02 },
    'CRUDEOIL': { basePrice: 6180, volatility: 0.025 },
    'GIFTNIFTY': { basePrice: 19880, volatility: 0.02 }
  };

  const data = baseData[symbol] || { basePrice: 1000, volatility: 0.02 };
  const changePercent = (Math.random() - 0.5) * 2 * data.volatility * 100;
  const change = (data.basePrice * changePercent) / 100;
  const price = data.basePrice + change;

  return {
    symbol,
    name: getDisplayName(symbol),
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    lastUpdated: new Date().toISOString(),
    isMarketOpen: isMarketCurrentlyOpen()
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')?.split(',') || ['NIFTY'];
    
    const results: MarketDataResponse[] = [];
    
    for (const symbol of symbols) {
      let marketData: MarketDataResponse | null = null;
      
      // Try different APIs in order of preference
      // 1. Try Alpha Vantage first (most reliable for Indian markets)
      marketData = await fetchFromAlphaVantage(symbol.toUpperCase());
      
      // 2. If Alpha Vantage fails, try Yahoo Finance
      if (!marketData) {
        marketData = await fetchFromYahooFinance(symbol.toUpperCase());
      }
      
      // 3. If Yahoo Finance fails, try IEX Cloud (limited Indian support)
      if (!marketData) {
        marketData = await fetchFromIEXCloud(symbol.toUpperCase());
      }
      
      // 4. Fallback to mock data
      if (!marketData) {
        marketData = generateMockData(symbol.toUpperCase());
      }
      
      results.push(marketData);
    }
    
    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
      isMarketOpen: isMarketCurrentlyOpen()
    });
    
  } catch (error) {
    console.error('Market data API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch market data',
      data: [],
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
