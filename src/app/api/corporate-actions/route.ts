import { NextRequest, NextResponse } from 'next/server';

// Corporate Actions: Dividends, Earnings for top Indian stocks
// Primary: Yahoo Finance via Cloudflare Worker relay (handles cookie/crumb auth)
// CF Worker URL: https://bse-nse-relay.vmfinancialservices.workers.dev

const CF_RELAY = process.env.CF_RELAY_URL || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

interface CorporateAction {
  id: string;
  symbol: string;
  companyName: string;
  actionType: 'dividend' | 'bonus' | 'split' | 'rights' | 'results' | 'agm' | 'buyback';
  description: string;
  exDate?: string;
  recordDate?: string;
  announcementDate: string;
  details: string;
  value?: string;
  ratio?: string;
  impact: 'positive' | 'neutral' | 'negative';
}

// Cache for 2 hours
let actionsCache: { actions: CorporateAction[]; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 60 * 1000;

const TRACKED_STOCKS: { symbol: string; name: string }[] = [
  { symbol: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'RELIANCE', name: 'Reliance Industries' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'INFY', name: 'Infosys' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
  { symbol: 'ITC', name: 'ITC Ltd' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { symbol: 'LT', name: 'Larsen & Toubro' },
  { symbol: 'AXISBANK', name: 'Axis Bank' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki' },
  { symbol: 'TITAN', name: 'Titan Company' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors' },
  { symbol: 'WIPRO', name: 'Wipro' },
  { symbol: 'NTPC', name: 'NTPC' },
  { symbol: 'POWERGRID', name: 'Power Grid Corp' },
  { symbol: 'COALINDIA', name: 'Coal India' },
  { symbol: 'TATASTEEL', name: 'Tata Steel' },
  { symbol: 'HCLTECH', name: 'HCL Technologies' },
  { symbol: 'TECHM', name: 'Tech Mahindra' },
  { symbol: 'DRREDDY', name: "Dr Reddy's Labs" },
  { symbol: 'NESTLEIND', name: 'Nestle India' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement' },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv' },
  { symbol: 'ONGC', name: 'ONGC' },
  { symbol: 'DIVISLAB', name: "Divi's Laboratories" },
];

// Fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Primary: Yahoo Finance via CF Worker relay (handles auth internally)
async function fetchCorporateActions(): Promise<CorporateAction[]> {
  const actions: CorporateAction[] = [];

  try {
    const symbols = TRACKED_STOCKS.map(s => `${s.symbol}.NS`).join(',');
    const url = `${CF_RELAY}/yahoo-quotes?symbols=${encodeURIComponent(symbols)}`;

    console.log('Fetching corporate actions via CF relay...');
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('CF relay failed:', response.status, errText.substring(0, 200));
      return actions;
    }

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let idx = 0;

    // Start of today (midnight UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    for (const quote of quotes) {
      const nseSymbol = (quote.symbol || '').replace('.NS', '');
      const stockInfo = TRACKED_STOCKS.find(s => s.symbol === nseSymbol);
      const companyName = stockInfo?.name || quote.shortName || nseSymbol;

      // Dividend event — ONLY if ex-date is today or in the future (truly upcoming)
      const exDivEpoch = quote.exDividendDate;
      if (exDivEpoch) {
        const exDivMs = exDivEpoch * 1000;
        if (exDivMs >= todayMs && exDivMs < todayMs + sevenDaysMs) {
          const exDate = new Date(exDivMs).toISOString().split('T')[0];
          const divDateEpoch = quote.dividendDate;
          const payDate = divDateEpoch ? new Date(divDateEpoch * 1000).toISOString().split('T')[0] : undefined;

          actions.push({
            id: `yf-div-${idx++}`,
            symbol: nseSymbol,
            companyName,
            actionType: 'dividend',
            description: 'Dividend declared',
            exDate,
            recordDate: payDate,
            announcementDate: new Date().toISOString().split('T')[0],
            details: payDate ? `Ex-Date: ${exDate}. Payment: ${payDate}.` : `Ex-Date: ${exDate}.`,
            impact: 'positive',
          });
        }
      }

      // Earnings / Results event — ONLY if date is today or in the future
      const earningsEpoch = quote.earningsTimestamp || quote.earningsTimestampStart;
      if (earningsEpoch) {
        const earningsMs = earningsEpoch * 1000;
        if (earningsMs >= todayMs && earningsMs < todayMs + sevenDaysMs) {
          const earningsDate = new Date(earningsMs).toISOString().split('T')[0];
          const endEpoch = quote.earningsTimestampEnd;
          const rangeEnd = endEpoch ? new Date(endEpoch * 1000).toISOString().split('T')[0] : undefined;

          actions.push({
            id: `yf-res-${idx++}`,
            symbol: nseSymbol,
            companyName,
            actionType: 'results',
            description: 'Quarterly Results',
            exDate: earningsDate,
            announcementDate: earningsDate,
            details: rangeEnd && rangeEnd !== earningsDate
              ? `Results expected between ${earningsDate} and ${rangeEnd}.`
              : `Results expected on ${earningsDate}.`,
            impact: 'neutral',
          });
        }
      }
    }

    console.log(`Corporate actions: ${actions.length} events from ${quotes.length} stocks`);
  } catch (error: any) {
    console.error('Corporate actions fetch error:', error?.name === 'AbortError' ? 'timeout' : error?.message);
  }

  return actions;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'all';
  const symbol = searchParams.get('symbol');
  const upcoming = searchParams.get('upcoming') === 'true';

  try {
    // Check cache
    if (actionsCache && Date.now() - actionsCache.timestamp < CACHE_TTL) {
      let actions = [...actionsCache.actions];
      if (type !== 'all') actions = actions.filter(a => a.actionType === type);
      if (symbol) actions = actions.filter(a => a.symbol.toLowerCase() === symbol.toLowerCase());

      return NextResponse.json({
        success: true, actions, total: actions.length,
        types: ['dividend', 'bonus', 'split', 'rights', 'results', 'agm', 'buyback'],
        source: 'cache', timestamp: new Date(actionsCache.timestamp).toISOString(),
      });
    }

    // Fetch via CF Worker relay
    const actions = await fetchCorporateActions();
    const source = actions.length > 0 ? 'yahoo-cf' : 'none';

    // Cache results
    actionsCache = { actions, timestamp: Date.now() };

    // Apply filters
    let filtered = [...actions];
    if (type !== 'all') filtered = filtered.filter(a => a.actionType === type);
    if (symbol) filtered = filtered.filter(a => a.symbol.toLowerCase() === symbol.toLowerCase());
    if (upcoming) {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(a => { const d = a.exDate || a.announcementDate; return d >= today; });
    }

    filtered.sort((a, b) => {
      const dateA = a.exDate || a.announcementDate;
      const dateB = b.exDate || b.announcementDate;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    return NextResponse.json({
      success: true, actions: filtered, total: filtered.length,
      types: ['dividend', 'bonus', 'split', 'rights', 'results', 'agm', 'buyback'],
      source, timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Corporate actions API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch corporate actions', actions: [] }, { status: 500 });
  }
}
