import { NextResponse } from 'next/server';

// Cache for stock data (5 minute TTL)
let cachedData: {
  gainers: StockData[];
  losers: StockData[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  // Alternative field names from different NSE endpoints
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  previousPrice?: number;
  netPrice?: number;
  tradedQuantity?: number;
  turnoverInLakhs?: number;
}

async function fetchFromNSE(): Promise<{ gainers: StockData[]; losers: StockData[] }> {
  try {
    // First, get cookies from NSE main page
    const mainResponse = await fetch('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const cookies = mainResponse.headers.get('set-cookie') || '';

    // Fetch gainers
    const gainersResponse = await fetch('https://www.nseindia.com/api/live-analysis-variations?index=gainers', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
        'Cookie': cookies,
      },
    });

    // Fetch losers
    const losersResponse = await fetch('https://www.nseindia.com/api/live-analysis-variations?index=losers', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
        'Cookie': cookies,
      },
    });

    if (gainersResponse.ok && losersResponse.ok) {
      const gainersData = await gainersResponse.json();
      const losersData = await losersResponse.json();

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
            price: price,
            change: change,
            changePercent: changePercent,
            volume: stock.traded_quantity || stock.tradedQuantity,
            high: stock.high_price || stock.highPrice,
            low: stock.low_price || stock.lowPrice,
          };
        });
      };

      // Try different response structures from NSE
      const extractData = (response: any): NSEStockData[] => {
        if (response?.NIFTY?.data) return response.NIFTY.data;
        if (response?.allSec) return response.allSec;
        if (response?.data) return response.data;
        if (Array.isArray(response)) return response;
        return [];
      };

      const gainers = mapStockData(extractData(gainersData));
      const losers = mapStockData(extractData(losersData));
      
      console.log(`NSE API: ${gainers.length} gainers, ${losers.length} losers`);

      return { gainers, losers };
    }

    throw new Error('NSE API returned non-OK status');
  } catch (error) {
    console.error('NSE API Error:', error);
    throw error;
  }
}

function getMockData(): { gainers: StockData[]; losers: StockData[] } {
  // Realistic mock data based on typical Nifty 50 stocks
  const gainers: StockData[] = [
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', price: 987.45, change: 45.30, changePercent: 4.81 },
    { symbol: 'ADANIENT', name: 'Adani Enterprises', price: 2456.80, change: 98.50, changePercent: 4.18 },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance', price: 7234.55, change: 245.60, changePercent: 3.52 },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1678.90, change: 42.35, changePercent: 2.59 },
    { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2890.45, change: 56.80, changePercent: 2.01 },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 1234.50, change: 23.45, changePercent: 1.94 },
    { symbol: 'SBIN', name: 'State Bank of India', price: 789.30, change: 12.80, changePercent: 1.65 },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel', price: 1567.80, change: 21.30, changePercent: 1.38 },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', price: 1890.25, change: 24.50, changePercent: 1.31 },
    { symbol: 'LT', name: 'Larsen & Toubro', price: 3456.70, change: 38.90, changePercent: 1.14 },
  ];

  const losers: StockData[] = [
    { symbol: 'WIPRO', name: 'Wipro Ltd', price: 456.30, change: -23.45, changePercent: -4.89 },
    { symbol: 'TECHM', name: 'Tech Mahindra', price: 1234.50, change: -56.70, changePercent: -4.39 },
    { symbol: 'INFY', name: 'Infosys Ltd', price: 1567.80, change: -45.20, changePercent: -2.80 },
    { symbol: 'TCS', name: 'TCS Ltd', price: 3890.25, change: -78.90, changePercent: -1.99 },
    { symbol: 'HCLTECH', name: 'HCL Technologies', price: 1456.70, change: -23.40, changePercent: -1.58 },
    { symbol: 'SUNPHARMA', name: 'Sun Pharma', price: 1234.50, change: -18.90, changePercent: -1.51 },
    { symbol: 'DRREDDY', name: "Dr Reddy's Labs", price: 5678.90, change: -78.50, changePercent: -1.36 },
    { symbol: 'CIPLA', name: 'Cipla Ltd', price: 1345.60, change: -16.80, changePercent: -1.23 },
    { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', price: 6234.50, change: -67.80, changePercent: -1.08 },
    { symbol: 'DIVISLAB', name: "Divi's Laboratories", price: 3890.25, change: -34.50, changePercent: -0.88 },
  ];

  // Add some randomness to make it feel more real
  const addVariation = (stocks: StockData[]): StockData[] => {
    return stocks.map(stock => ({
      ...stock,
      price: stock.price * (1 + (Math.random() - 0.5) * 0.02),
      change: stock.change * (1 + (Math.random() - 0.5) * 0.1),
      changePercent: stock.changePercent * (1 + (Math.random() - 0.5) * 0.1),
    }));
  };

  return {
    gainers: addVariation(gainers),
    losers: addVariation(losers),
  };
}

export async function GET() {
  try {
    // Check cache first
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        gainers: cachedData.gainers,
        losers: cachedData.losers,
        source: 'cache',
        timestamp: new Date(cachedData.timestamp).toISOString(),
      });
    }

    // Try to fetch from NSE
    try {
      const { gainers, losers } = await fetchFromNSE();
      
      // Update cache
      cachedData = {
        gainers,
        losers,
        timestamp: Date.now(),
      };

      return NextResponse.json({
        success: true,
        gainers,
        losers,
        source: 'nse',
        timestamp: new Date().toISOString(),
      });
    } catch (nseError) {
      console.log('NSE fetch failed, using mock data');
      
      // Use mock data as fallback
      const { gainers, losers } = getMockData();
      
      return NextResponse.json({
        success: true,
        gainers,
        losers,
        source: 'mock',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Gainers/Losers API Error:', error);
    
    // Return mock data on any error
    const { gainers, losers } = getMockData();
    
    return NextResponse.json({
      success: true,
      gainers,
      losers,
      source: 'mock',
      timestamp: new Date().toISOString(),
    });
  }
}
