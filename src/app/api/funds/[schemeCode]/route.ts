/**
 * Fund Details API
 * GET /api/funds/[schemeCode]
 * Returns complete fund details including returns, NAV history, managers
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

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
        is_active as "isActive"
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
        updated_at as "updatedAt"
      FROM fund_returns
      WHERE scheme_code = $1`,
      [schemeCode]
    );

    const returns = returnsResult.rows[0] || null;

    // Calculate since-inception return if inception_date and NAV available
    let returnSinceInception: number | null = null;
    if (fund.inceptionDate && returns?.return10y !== undefined) {
      // Use longest available CAGR as proxy for since-inception
      returnSinceInception = returns.cagr10y ?? returns.cagr7y ?? returns.cagr5y ?? returns.cagr3y ?? null;
    }

    // NAV history from MFApi — return up to 2000 points for 5Y+ charts
    let navHistory: any[] = [];
    let mfApiMeta: any = null;
    try {
      const navResponse = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 3600 }
      });
      if (navResponse.ok) {
        const navData = await navResponse.json();
        mfApiMeta = navData?.meta || null;
        if (navData?.data) {
          navHistory = navData.data.slice(0, 2000).map((item: any) => ({
            date: item.date,
            nav: parseFloat(item.nav)
          }));
        }
      }
    } catch (navError) {
      console.warn('Could not fetch NAV history from MFApi:', navError);
    }

    // Enrich fund info with MFApi meta
    const fundHouseName = mfApiMeta?.fund_house || null;
    const schemeCategory = mfApiMeta?.scheme_category || null;
    const schemeType = mfApiMeta?.scheme_type || null;

    // Find sibling variants (same fund, different plan/option types)
    const STRIP_WORDS = new Set([
      // Plan/option keywords
      'direct', 'regular', 'plan', 'growth', 'idcw', 'dividend', 'payout', 'reinvestment', 'option', 'monthly', 'quarterly', 'annual', 'weekly',
      // Common AMC name words (not fund-specific)
      'aditya', 'birla', 'sun', 'life', 'icici', 'prudential', 'nippon', 'india', 'franklin', 'templeton',
      'kotak', 'mahindra', 'tata', 'hdfc', 'sbi', 'axis', 'uti', 'dsp', 'mirae', 'asset',
      'sundaram', 'invesco', 'motilal', 'oswal', 'quant', 'canara', 'robeco', 'bandhan',
      'bajaj', 'finserv', 'edelweiss', 'union', 'manulife', 'ppfas', 'parag', 'parikh',
      'pgim', 'baroda', 'bnp', 'paribas', 'hsbc', 'iti', 'fund', 'scheme', 'mutual',
      'the', 'and', 'of', 'for'
    ]);
    const baseWords = fund.schemeName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 1 && !STRIP_WORDS.has(w));

    let variants: any[] = [];
    try {
      if (baseWords.length >= 1) {
        const variantParams: string[] = [];
        let vp = 1;

        // AMC prefix: use fundHouse name or first word of scheme name to scope to same AMC
        const amcPrefix = (fundHouseName || fund.schemeName || '').split(/\s/)[0].replace(/[^a-zA-Z0-9]/g, '');
        variantParams.push(`${amcPrefix}%`);
        const prefixCond = `f.scheme_name ILIKE $${vp++}`;

        const conditions = baseWords.slice(0, 6).map((word: string) => {
          variantParams.push(`%${word}%`);
          return `f.scheme_name ILIKE $${vp++}`;
        });

        // Use AMC code filter if available, otherwise prefix
        let amcFilter = '';
        if (fund.amcCode) {
          variantParams.push(fund.amcCode);
          amcFilter = ` AND f.amc_code = $${vp++}`;
        }

        const variantResult = await client.query(
          `SELECT 
            f.scheme_code as "schemeCode",
            f.scheme_name as "schemeName",
            f.latest_nav as "latestNav",
            f.latest_nav_date as "latestNavDate",
            r.cagr_3y as "cagr3y",
            r.cagr_5y as "cagr5y",
            r.return_1y as "return1y"
          FROM funds f
          LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code
          WHERE ${prefixCond} AND ${conditions.join(' AND ')}${amcFilter}
          ORDER BY f.scheme_name
          LIMIT 20`,
          variantParams
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
