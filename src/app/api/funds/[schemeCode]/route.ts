/**
 * Fund Details API
 * GET /api/funds/[schemeCode]
 * Returns complete fund details including returns, NAV history, managers
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// ── On-the-fly metric computation from raw NAV data ──
// Used when fund_returns table has gaps (cron hasn't processed this fund yet)
function computeMetricsFromNav(navData: any[]): any {
  if (!navData || navData.length < 50) return null;

  function parseDate(s: string): Date {
    const [d, m, y] = s.split('-');
    return new Date(`${y}-${m}-${d}`);
  }
  function getNavAt(data: any[], target: Date): number | null {
    for (const n of data) {
      if (parseDate(n.date) <= target) return parseFloat(n.nav);
    }
    return null;
  }
  function calcRet(cur: number, past: number): number | null {
    return past > 0 ? Math.round(((cur - past) / past) * 10000) / 100 : null;
  }
  function calcCAGR(cur: number, past: number, yrs: number): number | null {
    return (past > 0 && yrs > 0) ? Math.round((Math.pow(cur / past, 1 / yrs) - 1) * 10000) / 100 : null;
  }
  function r2(v: number): number { return Math.round(v * 100) / 100; }

  const latest = parseFloat(navData[0].nav);
  const today = parseDate(navData[0].date);
  const inception = parseDate(navData[navData.length - 1].date);
  const ageYrs = (today.getTime() - inception.getTime()) / (365 * 24 * 60 * 60 * 1000);
  const ms = 24 * 60 * 60 * 1000;

  // Basic returns
  const result: any = {};
  const periods: [string, number, number | null][] = [
    ['return1w', 7 * ms, null], ['return1m', 30 * ms, null], ['return3m', 90 * ms, null],
    ['return6m', 180 * ms, null], ['return1y', 365 * ms, 1], ['return3y', 1095 * ms, 3], ['return5y', 1825 * ms, 5]
  ];
  for (const [key, offset, yrs] of periods) {
    const needed = yrs || (offset / (365 * ms));
    if (ageYrs < needed * 0.9) continue;
    const past = getNavAt(navData, new Date(today.getTime() - offset));
    if (past) {
      result[key] = calcRet(latest, past);
      if (yrs) result[key.replace('return', 'cagr')] = calcCAGR(latest, past, yrs);
    }
  }

  // Risk metrics (need 1Y of data)
  if (ageYrs >= 1) {
    const oneYearAgo = new Date(today.getTime() - 365 * ms);
    const yearData = navData.filter((d: any) => {
      const dt = parseDate(d.date);
      return dt >= oneYearAgo && dt <= today;
    });

    if (yearData.length >= 50) {
      const dailyRet: number[] = [];
      for (let i = 0; i < yearData.length - 1; i++) {
        const c = parseFloat(yearData[i].nav), p = parseFloat(yearData[i + 1].nav);
        if (p > 0) dailyRet.push((c - p) / p * 100);
      }

      if (dailyRet.length >= 50) {
        const mean = dailyRet.reduce((a, b) => a + b, 0) / dailyRet.length;
        const variance = dailyRet.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / dailyRet.length;
        const vol = Math.sqrt(variance) * Math.sqrt(252);
        result.volatility1y = r2(vol);

        // Max drawdown
        let peak = parseFloat(yearData[yearData.length - 1].nav), maxDD = 0;
        for (let i = yearData.length - 2; i >= 0; i--) {
          const n = parseFloat(yearData[i].nav);
          if (n > peak) peak = n;
          const dd = (peak - n) / peak * 100;
          if (dd > maxDD) maxDD = dd;
        }
        result.maxDrawdown = r2(maxDD);

        // Sharpe (risk-free = 6% India)
        const annRet = result.return1y || 0;
        if (vol > 0) result.sharpeRatio1y = r2((annRet - 6) / vol);

        // Sortino
        const negRet = dailyRet.filter(r => r < 0);
        if (negRet.length > 0) {
          const dsVar = negRet.reduce((s, r) => s + r * r, 0) / negRet.length;
          const dsDev = Math.sqrt(dsVar) * Math.sqrt(252);
          if (dsDev > 0) result.sortinoRatio1y = r2((annRet - 6) / dsDev);
        }

        // Rolling 1Y returns
        if (ageYrs >= 2) {
          const maxMB = Math.min(Math.floor((ageYrs - 1) * 12), 36);
          const rolls: number[] = [];
          for (let m = 0; m <= maxMB; m++) {
            const end = new Date(today.getTime() - m * 30 * ms);
            const start = new Date(end.getTime() - 365 * ms);
            const eN = getNavAt(navData, end), sN = getNavAt(navData, start);
            if (eN && sN && sN > 0) { const r = calcRet(eN, sN); if (r !== null) rolls.push(r); }
          }
          if (rolls.length >= 3) {
            const sorted = [...rolls].sort((a, b) => a - b);
            result.rollingReturn1yAvg = r2(rolls.reduce((a, b) => a + b, 0) / rolls.length);
            result.rollingReturn1yMin = r2(sorted[0]);
            result.rollingReturn1yMax = r2(sorted[sorted.length - 1]);
            result.rollingReturn1yMedian = r2(sorted[Math.floor(sorted.length / 2)]);
          }
        }

        // Rolling 3Y returns (need 4+ years)
        if (ageYrs >= 4) {
          const maxMB3 = Math.min(Math.floor((ageYrs - 3) * 12), 24);
          const rolls3: number[] = [];
          for (let m = 0; m <= maxMB3; m++) {
            const end = new Date(today.getTime() - m * 30 * ms);
            const start = new Date(end.getTime() - 3 * 365 * ms);
            const eN = getNavAt(navData, end), sN = getNavAt(navData, start);
            if (eN && sN && sN > 0) { const c = calcCAGR(eN, sN, 3); if (c !== null) rolls3.push(c); }
          }
          if (rolls3.length >= 3) {
            const sorted3 = [...rolls3].sort((a, b) => a - b);
            result.rollingReturn3yAvg = r2(rolls3.reduce((a, b) => a + b, 0) / rolls3.length);
            result.rollingReturn3yMin = r2(sorted3[0]);
            result.rollingReturn3yMax = r2(sorted3[sorted3.length - 1]);
            result.rollingReturn3yMedian = r2(sorted3[Math.floor(sorted3.length / 2)]);
          }
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { schemeCode: string } }
) {
  const { schemeCode } = params;
  const client = await pool.connect();

  try {
    // Get fund details
    const fundResult = await client.query(
      `SELECT 
        scheme_code as "schemeCode",
        scheme_name as "schemeName",
        amc_code as "amcCode",
        scheme_type as "schemeType",
        plan_type as "planType",
        option_type as "optionType",
        category,
        sub_category as "subCategory",
        latest_nav as "latestNav",
        latest_nav_date as "latestNavDate",
        inception_date as "inceptionDate",
        fund_size as "fundSize",
        expense_ratio as "expenseRatio",
        exit_load as "exitLoad",
        min_investment as "minInvestment",
        min_sip as "minSip",
        is_active as "isActive",
        master_fund_id as "masterFundId"
      FROM funds
      WHERE scheme_code = $1`,
      [schemeCode]
    );

    if (fundResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Fund not found' },
        { status: 404 }
      );
    }

    const fund = fundResult.rows[0];

    // Get all returns and metrics
    const returnsResult = await client.query(
      `SELECT 
        return_1w as "return1w",
        return_1m as "return1m",
        return_3m as "return3m",
        return_6m as "return6m",
        return_1y as "return1y",
        return_2y as "return2y",
        return_3y as "return3y",
        return_5y as "return5y",
        return_7y as "return7y",
        return_10y as "return10y",
        cagr_1y as "cagr1y",
        cagr_2y as "cagr2y",
        cagr_3y as "cagr3y",
        cagr_5y as "cagr5y",
        cagr_7y as "cagr7y",
        cagr_10y as "cagr10y",
        volatility_1y as "volatility1y",
        max_drawdown as "maxDrawdown",
        sharpe_ratio_1y as "sharpeRatio1y",
        sortino_ratio_1y as "sortinoRatio1y",
        rolling_return_1y_avg as "rollingReturn1yAvg",
        rolling_return_1y_min as "rollingReturn1yMin",
        rolling_return_1y_max as "rollingReturn1yMax",
        rolling_return_1y_median as "rollingReturn1yMedian",
        rolling_return_3y_avg as "rollingReturn3yAvg",
        rolling_return_3y_min as "rollingReturn3yMin",
        rolling_return_3y_max as "rollingReturn3yMax",
        rolling_return_3y_median as "rollingReturn3yMedian",
        updated_at as "updatedAt"
      FROM fund_returns
      WHERE scheme_code = $1`,
      [schemeCode]
    );

    let returns = returnsResult.rows[0] || null;

    // Calculate since-inception return if inception_date and NAV available
    let returnSinceInception: number | null = null;
    if (fund.inceptionDate && returns?.return10y !== undefined) {
      returnSinceInception = returns.cagr10y ?? returns.cagr7y ?? returns.cagr5y ?? returns.cagr3y ?? null;
    }

    // NAV history from MFApi — return up to 2000 points for 5Y+ charts
    let navHistory: any[] = [];
    let mfApiMeta: any = null;
    let rawNavData: any[] | null = null;
    try {
      const navResponse = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 3600 }
      });
      if (navResponse.ok) {
        const navData = await navResponse.json();
        mfApiMeta = navData?.meta || null;
        rawNavData = navData?.data || null;
        if (rawNavData) {
          navHistory = rawNavData.slice(0, 2000).map((item: any) => ({
            date: item.date,
            nav: parseFloat(item.nav)
          }));
        }
      }
    } catch (navError) {
      console.warn('Could not fetch NAV history from MFApi:', navError);
    }

    // ── On-the-fly metric calculation if DB has gaps ──
    // If volatility/sharpe/rolling returns are missing, compute from NAV history
    const needsOnTheFly = rawNavData && rawNavData.length >= 50 && (
      !returns?.volatility1y || !returns?.sharpeRatio1y || !returns?.rollingReturn1yAvg
    );
    if (needsOnTheFly) {
      try {
        const computed = computeMetricsFromNav(rawNavData!);
        if (computed) {
          returns = {
            ...(returns || {}),
            // Only fill gaps — don't overwrite existing DB values
            return1w: returns?.return1w ?? computed.return1w,
            return1m: returns?.return1m ?? computed.return1m,
            return3m: returns?.return3m ?? computed.return3m,
            return6m: returns?.return6m ?? computed.return6m,
            return1y: returns?.return1y ?? computed.return1y,
            return3y: returns?.return3y ?? computed.return3y,
            return5y: returns?.return5y ?? computed.return5y,
            cagr1y: returns?.cagr1y ?? computed.cagr1y,
            cagr3y: returns?.cagr3y ?? computed.cagr3y,
            cagr5y: returns?.cagr5y ?? computed.cagr5y,
            volatility1y: returns?.volatility1y ?? computed.volatility1y,
            maxDrawdown: returns?.maxDrawdown ?? computed.maxDrawdown,
            sharpeRatio1y: returns?.sharpeRatio1y ?? computed.sharpeRatio1y,
            sortinoRatio1y: returns?.sortinoRatio1y ?? computed.sortinoRatio1y,
            rollingReturn1yAvg: returns?.rollingReturn1yAvg ?? computed.rollingReturn1yAvg,
            rollingReturn1yMin: returns?.rollingReturn1yMin ?? computed.rollingReturn1yMin,
            rollingReturn1yMax: returns?.rollingReturn1yMax ?? computed.rollingReturn1yMax,
            rollingReturn1yMedian: returns?.rollingReturn1yMedian ?? computed.rollingReturn1yMedian,
            rollingReturn3yAvg: returns?.rollingReturn3yAvg ?? computed.rollingReturn3yAvg,
            rollingReturn3yMin: returns?.rollingReturn3yMin ?? computed.rollingReturn3yMin,
            rollingReturn3yMax: returns?.rollingReturn3yMax ?? computed.rollingReturn3yMax,
            rollingReturn3yMedian: returns?.rollingReturn3yMedian ?? computed.rollingReturn3yMedian,
          };
          if (!returnSinceInception) {
            returnSinceInception = computed.cagr5y ?? computed.cagr3y ?? null;
          }
        }
      } catch (e) {
        console.warn('On-the-fly metric computation error:', e);
      }
    }

    // Enrich fund info with MFApi meta
    const fundHouseName = mfApiMeta?.fund_house || null;
    const schemeCategory = mfApiMeta?.scheme_category || null;
    const schemeType = mfApiMeta?.scheme_type || null;

    // Find sibling variants (same fund family, different plan/option types)
    // PRIMARY: Use master_fund_id (authoritative relational grouping)
    // FALLBACK: Name-based matching if master_fund_id is NULL
    let variants: any[] = [];
    try {
      const variantCols = `
        f.scheme_code as "schemeCode",
        f.scheme_name as "schemeName",
        f.latest_nav as "latestNav",
        f.latest_nav_date as "latestNavDate",
        r.cagr_3y as "cagr3y",
        r.cagr_5y as "cagr5y",
        r.return_1y as "return1y"`;
      const variantOrder = `
        ORDER BY
          CASE WHEN f.plan_type = 'Direct' THEN 0 ELSE 1 END,
          CASE WHEN f.option_type = 'Growth' THEN 0 ELSE 1 END,
          f.scheme_name`;

      // Strategy 1: master_fund_id (correct relational grouping)
      if (fund.masterFundId) {
        const variantResult = await client.query(
          `SELECT ${variantCols}
           FROM funds f
           LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code
           WHERE f.master_fund_id = $1
           ${variantOrder}
           LIMIT 20`,
          [fund.masterFundId]
        );
        variants = variantResult.rows.map((v: any) => ({
          schemeCode: v.schemeCode,
          schemeName: v.schemeName,
          latestNav: v.latestNav ? parseFloat(v.latestNav) : null,
          latestNavDate: v.latestNavDate,
          cagr3y: v.cagr3y ? parseFloat(v.cagr3y) : null,
          cagr5y: v.cagr5y ? parseFloat(v.cagr5y) : null,
          return1y: v.return1y ? parseFloat(v.return1y) : null,
        }));
      }

      // Strategy 2: Fallback — clean scheme name (same logic as migration) + exact match
      if (variants.length <= 1) {
        // Strip plan/option suffixes to get the canonical strategy name
        const strategyName = fund.schemeName
          .replace(/\s*-?\s*(Direct|Regular)\s*(Plan)?\s*/gi, '')
          .replace(/\s*-?\s*(Growth|IDCW|Dividend)\s*(Option|Plan|Payout|Reinvestment)?\s*/gi, '')
          .replace(/\s*-?\s*Option\s*$/gi, '')
          .replace(/\s*-?\s*Plan\s*$/gi, '')
          .replace(/\s*\(Erstwhile[^)]*\)/gi, '')
          .replace(/\s*\(Formerly[^)]*\)/gi, '')
          .replace(/\s*\(Advisor[^)]*\)/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (strategyName.length > 5) {
          const fallbackResult = await client.query(
            `SELECT ${variantCols}
             FROM funds f
             LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code
             WHERE f.scheme_name ILIKE $1
             ${variantOrder}
             LIMIT 20`,
            [`${strategyName}%`]
          );
          if (fallbackResult.rows.length > 1) {
            variants = fallbackResult.rows.map((v: any) => ({
              schemeCode: v.schemeCode,
              schemeName: v.schemeName,
              latestNav: v.latestNav ? parseFloat(v.latestNav) : null,
              latestNavDate: v.latestNavDate,
              cagr3y: v.cagr3y ? parseFloat(v.cagr3y) : null,
              cagr5y: v.cagr5y ? parseFloat(v.cagr5y) : null,
              return1y: v.return1y ? parseFloat(v.return1y) : null,
            }));
          }
        }
      }
    } catch (variantError) {
      console.warn('Could not fetch variants:', variantError);
    }

    // Parse DECIMAL strings to numbers for mobile clients
    const parsedFund = fund ? {
      ...fund,
      latestNav: fund.latestNav ? parseFloat(fund.latestNav) : null,
      fundSize: fund.fundSize ? parseFloat(fund.fundSize) : null,
      expenseRatio: fund.expenseRatio ? parseFloat(fund.expenseRatio) : null,
      minInvestment: fund.minInvestment ? parseInt(fund.minInvestment) : null,
      minSip: fund.minSip ? parseInt(fund.minSip) : null,
    } : null;

    const parsedReturns = returns ? Object.fromEntries(
      Object.entries({ ...returns, returnSinceInception }).map(([k, v]) => 
        [k, v !== null && v !== undefined && k !== 'updatedAt' ? parseFloat(v as string) || null : v]
      )
    ) : null;

    return NextResponse.json({
      success: true,
      data: {
        fund: {
          ...parsedFund,
          fundHouse: fundHouseName || parsedFund?.amcCode || null,
          category: schemeCategory || parsedFund?.category || null,
          schemeType: schemeType || parsedFund?.schemeType || null,
        },
        returns: parsedReturns,
        navHistory,
        variants,
      }
    });

  } catch (error: any) {
    console.error('Error fetching fund details:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
