import { NextRequest, NextResponse } from 'next/server';

// Cron job for comprehensive market updates
// Runs every hour during market hours, every 4 hours otherwise
// Updates: Gift Nifty, Market indices, Top movers, News

interface MarketUpdate {
  giftNifty: {
    price: number;
    change: number;
    changePercent: number;
    impliedOpen: number;
  };
  indices: {
    nifty50: { price: number; change: number; changePercent: number };
    sensex: { price: number; change: number; changePercent: number };
    bankNifty: { price: number; change: number; changePercent: number };
  };
  topGainers: Array<{ symbol: string; price: number; changePercent: number }>;
  topLosers: Array<{ symbol: string; price: number; changePercent: number }>;
  marketStatus: string;
  timestamp: string;
}

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) return true; // Allow if no secret configured
  return authHeader === `Bearer ${cronSecret}`;
}

async function fetchMarketData(): Promise<MarketUpdate> {
  const now = new Date();
  
  // Determine market status
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const hours = istTime.getUTCHours();
  const day = istTime.getUTCDay();
  
  let marketStatus = 'closed';
  if (day >= 1 && day <= 5) {
    if (hours >= 9 && hours < 16) {
      marketStatus = hours < 9.25 ? 'pre-open' : 'open';
    } else if (hours < 9) {
      marketStatus = 'pre-market';
    } else {
      marketStatus = 'post-market';
    }
  }

  // Base values (would be fetched from real APIs in production)
  const baseNifty = 23500;
  const baseSensex = 77500;
  const baseBankNifty = 50000;
  
  // Add realistic variation
  const variation = (Math.random() - 0.5) * 2; // -1% to +1%
  
  const niftyPrice = baseNifty * (1 + variation / 100);
  const sensexPrice = baseSensex * (1 + variation / 100);
  const bankNiftyPrice = baseBankNifty * (1 + (variation * 1.2) / 100);
  
  return {
    giftNifty: {
      price: Math.round(niftyPrice * 0.998 * 100) / 100,
      change: Math.round((niftyPrice * 0.998 - baseNifty) * 100) / 100,
      changePercent: Math.round(variation * 100) / 100,
      impliedOpen: Math.round(niftyPrice * 100) / 100,
    },
    indices: {
      nifty50: {
        price: Math.round(niftyPrice * 100) / 100,
        change: Math.round((niftyPrice - baseNifty) * 100) / 100,
        changePercent: Math.round(variation * 100) / 100,
      },
      sensex: {
        price: Math.round(sensexPrice * 100) / 100,
        change: Math.round((sensexPrice - baseSensex) * 100) / 100,
        changePercent: Math.round(variation * 100) / 100,
      },
      bankNifty: {
        price: Math.round(bankNiftyPrice * 100) / 100,
        change: Math.round((bankNiftyPrice - baseBankNifty) * 100) / 100,
        changePercent: Math.round(variation * 1.2 * 100) / 100,
      },
    },
    topGainers: [
      { symbol: 'TATAMOTORS', price: 987.45, changePercent: 4.81 },
      { symbol: 'ADANIENT', price: 2456.80, changePercent: 4.18 },
      { symbol: 'BAJFINANCE', price: 7234.55, changePercent: 3.52 },
    ],
    topLosers: [
      { symbol: 'WIPRO', price: 456.30, changePercent: -4.89 },
      { symbol: 'TECHM', price: 1234.50, changePercent: -4.39 },
      { symbol: 'INFY', price: 1567.80, changePercent: -2.80 },
    ],
    marketStatus,
    timestamp: now.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const marketData = await fetchMarketData();
    
    // In production, you would:
    // 1. Store this data in a database/cache
    // 2. Send push notifications for significant changes
    // 3. Update any real-time websocket connections
    
    console.log(`Market update completed at ${marketData.timestamp}`);
    console.log(`Market status: ${marketData.marketStatus}`);
    console.log(`Nifty: ${marketData.indices.nifty50.price} (${marketData.indices.nifty50.changePercent}%)`);

    return NextResponse.json({
      success: true,
      message: 'Market update completed',
      data: marketData,
      nextRun: getNextRunTime(marketData.marketStatus),
    });

  } catch (error) {
    console.error('Market update cron error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Market update failed',
    }, { status: 500 });
  }
}

function getNextRunTime(marketStatus: string): string {
  const now = new Date();
  let nextRun: Date;
  
  switch (marketStatus) {
    case 'open':
    case 'pre-open':
      // Every 30 seconds during market hours
      nextRun = new Date(now.getTime() + 30 * 1000);
      break;
    case 'pre-market':
      // Every hour before market
      nextRun = new Date(now.getTime() + 60 * 60 * 1000);
      break;
    default:
      // Every 4 hours when market is closed
      nextRun = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  }
  
  return nextRun.toISOString();
}

// POST endpoint for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
