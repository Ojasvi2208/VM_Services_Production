/**
 * Corporate Actions Cache Cron
 * Fetches dividends + earnings for top 30 NSE stocks via CF relay → Yahoo Finance.
 * Writes to market_cache (key: corporate_actions).
 * User-facing /api/corporate-actions reads from DB first — zero per-user external calls.
 *
 * Schedule: Twice daily — 0 4,16 * * * (9:30 AM + 9:30 PM IST)
 * Calls: 1 batch Yahoo Finance call via CF relay per run
 * Monthly: ~60 calls (capped, predictable)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

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

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCorporateActions(): Promise<CorporateAction[]> {
  const actions: CorporateAction[] = [];

  try {
    const symbols = TRACKED_STOCKS.map(s => `${s.symbol}.NS`).join(',');
    const url = `${CF_RELAY}/yahoo-quotes?symbols=${encodeURIComponent(symbols)}`;

    console.log('[cache-corporate-actions] Fetching via CF relay...');
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[cache-corporate-actions] CF relay failed:', response.status, errText.substring(0, 200));
      return actions;
    }

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let idx = 0;

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

    console.log(`[cache-corporate-actions] ${actions.length} events from ${quotes.length} stocks`);
  } catch (error: any) {
    console.error('[cache-corporate-actions] fetch error:', error?.name === 'AbortError' ? 'timeout' : error?.message);
  }

  return actions;
}

export async function GET(request: NextRequest) {
  // Auth check: CRON_SECRET or Vercel cron header
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startMs = Date.now();

  try {
    // 1. Fetch corporate actions via CF relay → Yahoo Finance
    const actions = await fetchCorporateActions();

    if (actions.length === 0) {
      // Still write empty array so user-facing route knows cron ran (avoids stale flag confusion)
      console.log('[cache-corporate-actions] No upcoming events found — writing empty cache');
    }

    // 2. Sort by date
    actions.sort((a, b) => {
      const dateA = a.exDate || a.announcementDate;
      const dateB = b.exDate || b.announcementDate;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    // 3. Write to market_cache
    const payload = {
      success: true,
      actions,
      total: actions.length,
      types: ['dividend', 'bonus', 'split', 'rights', 'results', 'agm', 'buyback'],
      timestamp: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO market_cache (cache_key, data, scraped_at, is_stale, source_url, updated_at)
       VALUES ('corporate_actions', $1, NOW(), FALSE, 'yahoo_finance', NOW())
       ON CONFLICT (cache_key) DO UPDATE SET
         data = EXCLUDED.data, scraped_at = EXCLUDED.scraped_at,
         is_stale = FALSE, updated_at = NOW()`,
      [JSON.stringify(payload)]
    );

    const elapsed = Date.now() - startMs;
    console.log(`[cache-corporate-actions] ${actions.length} events cached in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      count: actions.length,
      elapsedMs: elapsed,
    });
  } catch (error: any) {
    console.error('[cache-corporate-actions] error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
