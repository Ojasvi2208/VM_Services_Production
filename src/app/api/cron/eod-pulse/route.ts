/**
 * EOD Market Pulse — Personalized Sector Push
 *
 * Runs at 3:45 PM IST (10:15 UTC) on weekdays.
 * For each user with equity/hybrid holdings:
 *   1. Identifies their largest holding's fund sub-category
 *   2. Maps sub-category → sector index (e.g. Large Cap → Nifty 50, Banking → Bank Nifty)
 *   3. Fetches today's sector change % via CF relay → Yahoo Finance
 *   4. Dispatches a personalized push: "Your exposure to [sector] helped buffer your returns today."
 *
 * Schedule: 15 10 * * 1-5 (UTC 10:15 = IST 3:45 PM)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { dispatchPush } from '@/lib/notification-governor';

const CF_RELAY_URL = process.env.CF_RELAY_URL
  || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

// ─── Sub-category → Sector Index Mapping ────────────────────────────────────

const SUB_CATEGORY_TO_INDEX: Record<string, { symbol: string; label: string }> = {
  // Broad equity — map to Nifty 50
  'Large Cap Fund':        { symbol: 'NIFTY',            label: 'Large Caps (Nifty 50)' },
  'Large & Mid Cap Fund':  { symbol: 'NIFTY',            label: 'Large & Mid Caps' },
  'Flexi Cap Fund':        { symbol: 'NIFTY',            label: 'Flexi Cap (Nifty 50)' },
  'Multi Cap Fund':        { symbol: 'NIFTY',            label: 'Multi Cap (Nifty 50)' },
  'ELSS':                  { symbol: 'NIFTY',            label: 'ELSS (Nifty 50)' },
  'Focused Fund':          { symbol: 'NIFTY',            label: 'Focused (Nifty 50)' },
  'Value Fund':            { symbol: 'NIFTY',            label: 'Value (Nifty 50)' },
  'Contra Fund':           { symbol: 'NIFTY',            label: 'Contra (Nifty 50)' },
  'Dividend Yield Fund':   { symbol: 'NIFTY',            label: 'Dividend Yield (Nifty 50)' },

  // Mid / Small
  'Mid Cap Fund':          { symbol: 'NIFTYNEXT50',      label: 'Mid Caps' },
  'Small Cap Fund':        { symbol: 'NIFTYSMALLCAP100', label: 'Small Caps' },

  // Sectoral
  'Banking & PSU Fund':    { symbol: 'BANKNIFTY',        label: 'Banking (Bank Nifty)' },

  // Hybrid — use Nifty 50 as equity proxy
  'Aggressive Hybrid Fund':      { symbol: 'NIFTY', label: 'Aggressive Hybrid (equity portion)' },
  'Balanced Hybrid Fund':        { symbol: 'NIFTY', label: 'Balanced Hybrid (equity portion)' },
  'Conservative Hybrid Fund':    { symbol: 'NIFTY', label: 'Conservative Hybrid (equity portion)' },
  'Dynamic Asset Allocation':    { symbol: 'NIFTY', label: 'Dynamic Asset Allocation' },
  'Balanced Advantage Fund':     { symbol: 'NIFTY', label: 'Balanced Advantage' },
  'Multi-Asset Allocation Fund': { symbol: 'NIFTY', label: 'Multi-Asset' },
};

// For sectoral/thematic funds, infer sector from scheme_name keywords
function inferSectoralIndex(schemeName: string): { symbol: string; label: string } {
  const n = schemeName.toLowerCase();
  if (n.includes('bank') || n.includes('financial'))
    return { symbol: 'BANKNIFTY', label: 'Banking (Bank Nifty)' };
  if (n.includes('pharma') || n.includes('health'))
    return { symbol: 'NIFTYPHARMA', label: 'Pharma' };
  if (n.includes('it') || n.includes('technology') || n.includes('tech'))
    return { symbol: 'NIFTYIT', label: 'IT' };
  if (n.includes('auto') || n.includes('automobile'))
    return { symbol: 'NIFTYAUTO', label: 'Auto' };
  if (n.includes('fmcg') || n.includes('consumer'))
    return { symbol: 'NIFTYFMCG', label: 'FMCG' };
  if (n.includes('metal') || n.includes('mining'))
    return { symbol: 'NIFTYMETAL', label: 'Metals' };
  if (n.includes('realty') || n.includes('real estate'))
    return { symbol: 'NIFTYREALTY', label: 'Realty' };
  if (n.includes('infra') || n.includes('infrastructure'))
    return { symbol: 'NIFTYINFRA', label: 'Infrastructure' };
  if (n.includes('energy') || n.includes('power') || n.includes('oil'))
    return { symbol: 'NIFTYENERGY', label: 'Energy' };
  return { symbol: 'NIFTY', label: 'Nifty 50' };
}

// ─── Yahoo Finance Symbol Map (subset for sector fetches) ───────────────────

const YAHOO_MAP: Record<string, string> = {
  NIFTY:            '^NSEI',
  BANKNIFTY:        '^NSEBANK',
  NIFTYIT:          '^CNXIT',
  NIFTYNEXT50:      '^NSMIDCP',
  NIFTYSMALLCAP100: 'NIFTY_SMLCAP_100.NS',
  NIFTYPHARMA:      '^CNXPHARMA',
  NIFTYAUTO:        '^CNXAUTO',
  NIFTYFMCG:        '^CNXFMCG',
  NIFTYMETAL:       '^CNXMETAL',
  NIFTYREALTY:      '^CNXREALTY',
  NIFTYENERGY:      '^CNXENERGY',
  NIFTYINFRA:       '^CNXINFRA',
  NIFTYFINSERVICE:  'NIFTY_FIN_SERVICE.NS',
};

// ─── Fetch Sector Performances ──────────────────────────────────────────────

interface SectorPerf {
  changePercent: number;
}

async function fetchSectorPerformances(symbols: string[]): Promise<Map<string, SectorPerf>> {
  const result = new Map<string, SectorPerf>();
  const unique = [...new Set(symbols)];

  await Promise.all(unique.map(async (sym) => {
    const yahoo = YAHOO_MAP[sym];
    if (!yahoo) return;

    try {
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}`;
      const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const resp = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);

      if (!resp.ok) return;

      const data = await resp.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return;

      const price = meta.regularMarketPrice as number;
      const prev = (meta.previousClose || meta.chartPreviousClose || 0) as number;
      const changePct = prev > 0 ? ((price - prev) / prev) * 100 : 0;

      result.set(sym, { changePercent: Number(changePct.toFixed(2)) });
    } catch { /* skip failed symbols */ }
  }));

  return result;
}

// ─── Per-user Portfolio Query ───────────────────────────────────────────────

interface UserSector {
  userId: string;
  subCategory: string;
  schemeName: string;
  mappedSymbol: string;
  mappedLabel: string;
}

async function getUserPortfolioSectors(): Promise<UserSector[]> {
  const result = await pool.query(`
    SELECT DISTINCT ON (ph.user_id)
      ph.user_id,
      f.sub_category,
      f.scheme_name,
      f.category,
      (ph.units * COALESCE(f.latest_nav, ph.purchase_nav)) AS current_value
    FROM portfolio_holdings ph
    JOIN funds f ON ph.scheme_code = f.scheme_code
    WHERE f.category IN ('Equity', 'Hybrid')
      AND f.sub_category IS NOT NULL
      AND f.is_active = true
      AND ph.units > 0
    ORDER BY ph.user_id, current_value DESC
  `);

  return result.rows.map((row: any) => {
    const subCat = row.sub_category as string;
    const schemeName = row.scheme_name as string;

    let mapped = SUB_CATEGORY_TO_INDEX[subCat];
    if (!mapped || subCat === 'Sectoral/Thematic Funds') {
      mapped = inferSectoralIndex(schemeName);
    }

    return {
      userId: row.user_id as string,
      subCategory: subCat,
      schemeName,
      mappedSymbol: mapped?.symbol ?? 'NIFTY',
      mappedLabel: mapped?.label ?? 'Nifty 50',
    };
  });
}

// ─── Auth ───────────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Time guard: 3:45–3:55 PM IST, weekdays only
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  const mins = ist.getHours() * 60 + ist.getMinutes();
  const isWeekday = day >= 1 && day <= 5;
  const isEODWindow = mins >= 945 && mins < 955; // 3:45–3:55 PM

  const bypassGuard = request.nextUrl?.searchParams.get('bypass') === '1'
    && process.env.NODE_ENV !== 'production';

  if (!isWeekday || (!isEODWindow && !bypassGuard)) {
    return NextResponse.json({
      success: true,
      message: 'Outside EOD window — skipped',
      istTime: `${ist.getHours()}:${String(ist.getMinutes()).padStart(2, '0')}`,
    });
  }

  const startTime = Date.now();
  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  try {
    // Step 1: Get all users with equity/hybrid holdings
    const userSectors = await getUserPortfolioSectors();

    if (userSectors.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible users', ...stats });
    }

    // Step 2: Deduplicate symbols and fetch sector performances
    const symbolsNeeded = [...new Set(userSectors.map(u => u.mappedSymbol))];
    const performances = await fetchSectorPerformances(symbolsNeeded);

    // Step 3: Per-user personalized dispatch
    for (const user of userSectors) {
      try {
        const perf = performances.get(user.mappedSymbol);
        if (!perf) {
          stats.skipped++;
          continue;
        }

        const direction = perf.changePercent >= 0
          ? 'helped buffer'
          : 'absorbed some impact from';
        const changeDisplay = perf.changePercent >= 0
          ? `+${perf.changePercent.toFixed(2)}%`
          : `${perf.changePercent.toFixed(2)}%`;

        const body =
          `Markets closed. Your exposure to ${user.mappedLabel} ` +
          `(${changeDisplay} today) ${direction} your returns.`;

        const result = await dispatchPush({
          userId: user.userId,
          type: 'eod_pulse',
          title: 'Your Market Pulse for Today',
          body,
          deepLink: 'portfolio',
          data: {
            sectorSymbol: user.mappedSymbol,
            sectorLabel: user.mappedLabel,
            changePercent: String(perf.changePercent),
          },
        });

        if (result.sent) stats.sent++;
        else stats.skipped++;

        stats.processed++;
      } catch (userErr: any) {
        console.error(`EOD pulse error for user ${user.userId}:`, userErr.message);
        stats.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('EOD pulse cron error:', err);
    return NextResponse.json({ success: false, error: err.message, ...stats }, { status: 500 });
  }
}
