import { NextRequest, NextResponse } from 'next/server';

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume?: number;
}

async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    // First, get cookies from NSE main page
    const mainResponse = await fetch('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    const cookies = mainResponse.headers.get('set-cookie') || '';

    // Fetch stock quote
    const quoteResponse = await fetch(
      `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol.toUpperCase())}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.nseindia.com/get-quotes/equity',
          'Cookie': cookies,
        },
      }
    );

    if (quoteResponse.ok) {
      const data = await quoteResponse.json();
      
      if (data.info && data.priceInfo) {
        return {
          symbol: data.info.symbol,
          name: data.info.companyName,
          price: data.priceInfo.lastPrice,
          change: data.priceInfo.change,
          changePercent: data.priceInfo.pChange,
          open: data.priceInfo.open,
          high: data.priceInfo.intraDayHighLow?.max || data.priceInfo.high,
          low: data.priceInfo.intraDayHighLow?.min || data.priceInfo.low,
          previousClose: data.priceInfo.previousClose,
          volume: data.preOpenMarket?.totalTradedVolume,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('NSE Quote Error:', error);
    return null;
  }
}

// Popular stock symbols for autocomplete
const popularStocks = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { symbol: 'INFY', name: 'Infosys Ltd' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd' },
  { symbol: 'ITC', name: 'ITC Ltd' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd' },
  { symbol: 'WIPRO', name: 'Wipro Ltd' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd' },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd' },
  { symbol: 'ADANIPORTS', name: 'Adani Ports and SEZ Ltd' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd' },
  { symbol: 'NTPC', name: 'NTPC Ltd' },
  { symbol: 'ONGC', name: 'Oil and Natural Gas Corporation Ltd' },
  { symbol: 'COALINDIA', name: 'Coal India Ltd' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd' },
  { symbol: 'TITAN', name: 'Titan Company Ltd' },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';

  if (!query || query.length < 1) {
    return NextResponse.json({
      success: false,
      error: 'Query parameter is required',
      stocks: [],
    });
  }

  try {
    // First, try to get exact quote if query looks like a symbol
    if (query.length <= 15 && /^[A-Za-z]+$/.test(query)) {
      const quote = await fetchStockQuote(query);
      
      if (quote) {
        return NextResponse.json({
          success: true,
          stocks: [quote],
          source: 'nse',
        });
      }
    }

    // Search in popular stocks list
    const searchLower = query.toLowerCase();
    const matchingStocks = popularStocks.filter(
      stock =>
        stock.symbol.toLowerCase().includes(searchLower) ||
        stock.name.toLowerCase().includes(searchLower)
    );

    if (matchingStocks.length > 0) {
      // Try to get real-time quotes for matching stocks (limit to 5)
      const stocksToFetch = matchingStocks.slice(0, 5);
      const quotes: StockQuote[] = [];

      for (const stock of stocksToFetch) {
        const quote = await fetchStockQuote(stock.symbol);
        if (quote) {
          quotes.push(quote);
        } else {
          // Add mock data if NSE fails
          quotes.push({
            symbol: stock.symbol,
            name: stock.name,
            price: Math.random() * 3000 + 500,
            change: (Math.random() - 0.5) * 100,
            changePercent: (Math.random() - 0.5) * 5,
            open: 0,
            high: 0,
            low: 0,
            previousClose: 0,
          });
        }
      }

      return NextResponse.json({
        success: true,
        stocks: quotes,
        source: quotes.some(q => q.open > 0) ? 'nse' : 'mock',
      });
    }

    // No matches found
    return NextResponse.json({
      success: true,
      stocks: [],
      message: 'No stocks found matching your query',
    });
  } catch (error) {
    console.error('Stock Search Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to search stocks',
      stocks: [],
    });
  }
}
