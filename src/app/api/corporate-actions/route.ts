import { NextRequest, NextResponse } from 'next/server';

// Corporate Actions: Dividends, Earnings, Bonus, Splits
// Primary: Yahoo Finance (works from Railway)
// Secondary: BSE India via optional proxy (set BSE_PROXY_URL env var)
// Fallback: Curated data

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

// Cache for 2 hours (corporate actions don't change frequently)
let actionsCache: { actions: CorporateAction[]; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Top Indian stocks to track (NSE symbols -> Yahoo Finance suffix .NS)
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

// 1. Primary: Yahoo Finance — real dividend + earnings dates
async function fetchYahooFinanceCorporateActions(): Promise<CorporateAction[]> {
  const actions: CorporateAction[] = [];

  try {
    const symbols = TRACKED_STOCKS.map(s => `${s.symbol}.NS`).join(',');
    const fields = 'shortName,dividendDate,exDividendDate,trailingAnnualDividendRate,earningsTimestamp,earningsTimestampStart,earningsTimestampEnd';
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=${fields}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Yahoo Finance response not ok:', response.status);
      return actions;
    }

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];
    const now = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    let idx = 0;

    for (const quote of quotes) {
      const nseSymbol = (quote.symbol || '').replace('.NS', '');
      const stockInfo = TRACKED_STOCKS.find(s => s.symbol === nseSymbol);
      const companyName = stockInfo?.name || quote.shortName || nseSymbol;

      // Dividend event
      const exDivEpoch = quote.exDividendDate;
      if (exDivEpoch) {
        const exDivMs = exDivEpoch * 1000;
        // Show if ex-date is within -7 days to +60 days from now
        if (exDivMs > now - 7 * 24 * 60 * 60 * 1000 && exDivMs < now + sixtyDaysMs) {
          const exDate = new Date(exDivMs).toISOString().split('T')[0];
          const divRate = quote.trailingAnnualDividendRate;
          const divDateEpoch = quote.dividendDate;
          const payDate = divDateEpoch ? new Date(divDateEpoch * 1000).toISOString().split('T')[0] : undefined;

          actions.push({
            id: `yf-div-${idx++}`,
            symbol: nseSymbol,
            companyName,
            actionType: 'dividend',
            description: divRate ? `Dividend Rs ${divRate.toFixed(2)}/share` : 'Dividend',
            exDate,
            recordDate: payDate,
            announcementDate: new Date().toISOString().split('T')[0],
            details: payDate ? `Ex-Date: ${exDate}. Payment: ${payDate}.` : `Ex-Date: ${exDate}.`,
            value: divRate ? `Rs ${divRate.toFixed(2)}/share` : undefined,
            impact: 'positive',
          });
        }
      }

      // Earnings / Results event
      const earningsEpoch = quote.earningsTimestamp || quote.earningsTimestampStart;
      if (earningsEpoch) {
        const earningsMs = earningsEpoch * 1000;
        if (earningsMs > now - 3 * 24 * 60 * 60 * 1000 && earningsMs < now + sixtyDaysMs) {
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
  } catch (error) {
    console.error('Yahoo Finance corporate actions error:', error);
  }

  return actions;
}

// 2. Secondary: BSE India via optional proxy
async function fetchBSECorporateActions(): Promise<CorporateAction[]> {
  const proxyUrl = process.env.BSE_PROXY_URL;
  const actions: CorporateAction[] = [];

  try {
    const today = new Date();
    const fromDate = today.toISOString().split('T')[0].split('-').reverse().join('/');
    const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const toDate = futureDate.toISOString().split('T')[0].split('-').reverse().join('/');

    const bseUrl = `https://api.bseindia.com/BseIndiaAPI/api/CorporateAction/w?from=${fromDate}&to=${toDate}&by=ex&Atea=&SFtype=&type=Dividend`;
    const fetchUrl = proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(bseUrl)}` : bseUrl;

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.bseindia.com/',
        'Origin': 'https://www.bseindia.com',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        data.slice(0, 30).forEach((item: any, index: number) => {
          const symbol = item.scrip_code_name || item.SCRIP_CD || '';
          const companyName = item.long_name || item.SLONG_NAME || symbol;
          const purpose = item.Purpose || item.PURPOSE || '';
          const exDate = item.Ex_date || item.EX_DT || '';

          let actionType: CorporateAction['actionType'] = 'dividend';
          let impact: CorporateAction['impact'] = 'positive';
          if (purpose.toLowerCase().includes('bonus')) { actionType = 'bonus'; }
          else if (purpose.toLowerCase().includes('split')) { actionType = 'split'; impact = 'neutral'; }
          else if (purpose.toLowerCase().includes('rights')) { actionType = 'rights'; impact = 'neutral'; }
          else if (purpose.toLowerCase().includes('buyback')) { actionType = 'buyback'; }

          let parsedExDate = '';
          if (exDate) {
            try {
              const d = new Date(exDate);
              if (!isNaN(d.getTime())) parsedExDate = d.toISOString().split('T')[0];
            } catch { parsedExDate = exDate; }
          }

          actions.push({
            id: `bse-${index}`,
            symbol,
            companyName,
            actionType,
            description: purpose.substring(0, 100),
            exDate: parsedExDate || undefined,
            announcementDate: new Date().toISOString().split('T')[0],
            details: purpose,
            value: purpose.match(/Rs\.?\s*[\d.]+|₹[\d.]+/)?.[0],
            impact,
          });
        });
      }
    }
  } catch (error) {
    console.error('BSE corporate actions error:', error);
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
      let actions = actionsCache.actions;
      if (type !== 'all') actions = actions.filter(a => a.actionType === type);
      if (symbol) actions = actions.filter(a => a.symbol.toLowerCase() === symbol.toLowerCase());

      return NextResponse.json({
        success: true, actions, total: actions.length,
        types: ['dividend', 'bonus', 'split', 'rights', 'results', 'agm', 'buyback'],
        source: 'cache', timestamp: new Date(actionsCache.timestamp).toISOString(),
      });
    }

    let source = '';

    // 1. Try Yahoo Finance (works from Railway)
    let actions = await fetchYahooFinanceCorporateActions();
    if (actions.length > 0) source = 'yahoo';

    // 2. Try BSE (direct or via proxy)
    if (actions.length < 3) {
      const bseActions = await fetchBSECorporateActions();
      if (bseActions.length > 0) {
        // Merge, avoid duplicates by symbol+type
        const existing = new Set(actions.map(a => `${a.symbol}-${a.actionType}`));
        for (const bse of bseActions) {
          if (!existing.has(`${bse.symbol}-${bse.actionType}`)) {
            actions.push(bse);
          }
        }
        source = source ? `${source}+bse` : 'bse';
      }
    }

    if (actions.length === 0) source = 'none';

    // Cache
    actionsCache = { actions, timestamp: Date.now() };

    // Apply filters
    if (type !== 'all') actions = actions.filter(a => a.actionType === type);
    if (symbol) actions = actions.filter(a => a.symbol.toLowerCase() === symbol.toLowerCase());
    if (upcoming) {
      const today = new Date().toISOString().split('T')[0];
      actions = actions.filter(a => { const d = a.exDate || a.announcementDate; return d >= today; });
    }

    actions.sort((a, b) => {
      const dateA = a.exDate || a.announcementDate;
      const dateB = b.exDate || b.announcementDate;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    return NextResponse.json({
      success: true, actions, total: actions.length,
      types: ['dividend', 'bonus', 'split', 'rights', 'results', 'agm', 'buyback'],
      source, timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Corporate actions API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch corporate actions', actions: [] }, { status: 500 });
  }
}
