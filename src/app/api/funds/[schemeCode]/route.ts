/**
 * Fund Details API — Data Sovereign
 * GET /api/funds/[schemeCode]
 * Returns complete fund details including returns, NAV history, managers
 *
 * Zero external dependency: all data from local PostgreSQL (nav_history + fund_returns)
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
        plan_type as "planType",
        option_type as "optionType",
        category,
        sub_category as "subCategory",
        -- scheme_type doesn't exist; derive it from category for display
        COALESCE(category, sub_category) as "schemeType",
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

    // Get all returns and metrics (including since-inception from pipeline)
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
        return_since_inception as "returnSinceInception",
        cagr_1y as "cagr1y",
        cagr_2y as "cagr2y",
        cagr_3y as "cagr3y",
        cagr_5y as "cagr5y",
        cagr_7y as "cagr7y",
        cagr_10y as "cagr10y",
        cagr_since_inception as "cagrSinceInception",
        volatility_1y as "volatility1y",
        sharpe_ratio_1y as "sharpeRatio1y",
        rolling_return_1y_avg as "rollingReturn1yAvg",
        rolling_return_1y_min as "rollingReturn1yMin",
        rolling_return_1y_max as "rollingReturn1yMax",
        rolling_return_1y_median as "rollingReturn1yMedian",
        rolling_return_3y_avg as "rollingReturn3yAvg",
        rolling_return_3y_min as "rollingReturn3yMin",
        rolling_return_3y_max as "rollingReturn3yMax",
        rolling_return_3y_median as "rollingReturn3yMedian",
        sortino_ratio_1y as "sortinoRatio1y",
        max_drawdown as "maxDrawdown",
        updated_at as "updatedAt"
      FROM fund_returns
      WHERE scheme_code = $1`,
      [schemeCode]
    );

    let returns = returnsResult.rows[0] || null;

    // NAV history from local nav_history table (Data Sovereign — zero external dependency)
    let navHistory: any[] = [];
    try {
      const navResult = await client.query(
        `SELECT nav_date::text AS date, nav_value AS nav
         FROM nav_history
         WHERE scheme_code = $1
         ORDER BY nav_date DESC
         LIMIT 2000`,
        [schemeCode]
      );
      navHistory = navResult.rows.map((row: any) => ({
        date: row.date,
        nav: parseFloat(row.nav)
      }));
    } catch (navError) {
      console.warn('Could not fetch NAV history:', navError);
    }

    // On-the-fly DB metric calculation if fund_returns has gaps
    // Uses the same SQL functions as compute-fund-metrics.ts pipeline
    const needsOnTheFly = !returns?.volatility1y || !returns?.rollingReturn1yAvg;
    if (needsOnTheFly) {
      try {
        const computedResult = await client.query(
          'SELECT * FROM calc_all_returns($1)', [schemeCode]
        );
        if (computedResult.rows.length > 0) {
          const c = computedResult.rows[0];
          returns = {
            ...(returns || {}),
            return1w: returns?.return1w ?? c.return_1w,
            return1m: returns?.return1m ?? c.return_1m,
            return3m: returns?.return3m ?? c.return_3m,
            return6m: returns?.return6m ?? c.return_6m,
            return1y: returns?.return1y ?? c.return_1y,
            return2y: returns?.return2y ?? c.return_2y,
            return3y: returns?.return3y ?? c.return_3y,
            return5y: returns?.return5y ?? c.return_5y,
            return7y: returns?.return7y ?? c.return_7y,
            return10y: returns?.return10y ?? c.return_10y,
            returnSinceInception: returns?.returnSinceInception ?? c.return_since_inception,
            cagr1y: returns?.cagr1y ?? c.cagr_1y,
            cagr2y: returns?.cagr2y ?? c.cagr_2y,
            cagr3y: returns?.cagr3y ?? c.cagr_3y,
            cagr5y: returns?.cagr5y ?? c.cagr_5y,
            cagr7y: returns?.cagr7y ?? c.cagr_7y,
            cagr10y: returns?.cagr10y ?? c.cagr_10y,
            cagrSinceInception: returns?.cagrSinceInception ?? c.cagr_since_inception,
            updatedAt: returns?.updatedAt ?? null,
          };

          // Risk metrics if fund is 1+ year old
          if (c.fund_age_years >= 1 && c.latest_date && !returns.volatility1y) {
            const startDate = new Date(c.latest_date);
            startDate.setFullYear(startDate.getFullYear() - 1);
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = new Date(c.latest_date).toISOString().split('T')[0];

            const [volRes, sharpeRes, sortinoRes, mddRes] = await Promise.all([
              client.query('SELECT calc_volatility($1, $2::date, $3::date) AS v', [schemeCode, startStr, endStr]),
              client.query('SELECT calc_sharpe($1, $2::date, $3::date, 6.5) AS v', [schemeCode, startStr, endStr]),
              client.query('SELECT calc_sortino($1, $2::date, $3::date, 6.5) AS v', [schemeCode, startStr, endStr]),
              client.query('SELECT calc_max_drawdown($1, $2::date, $3::date) AS v', [schemeCode, startStr, endStr]),
            ]);
            returns.volatility1y = returns.volatility1y ?? volRes.rows[0]?.v;
            returns.sharpeRatio1y = returns.sharpeRatio1y ?? sharpeRes.rows[0]?.v;
            returns.sortinoRatio1y = returns.sortinoRatio1y ?? sortinoRes.rows[0]?.v;
            returns.maxDrawdown = returns.maxDrawdown ?? mddRes.rows[0]?.v;
          }

          // Rolling returns
          if (c.fund_age_years >= 2 && !returns.rollingReturn1yAvg) {
            const r1 = await client.query('SELECT * FROM calc_rolling_returns($1, 1, 36)', [schemeCode]);
            if (r1.rows.length > 0) {
              returns.rollingReturn1yAvg = r1.rows[0].avg_return;
              returns.rollingReturn1yMin = r1.rows[0].min_return;
              returns.rollingReturn1yMax = r1.rows[0].max_return;
              returns.rollingReturn1yMedian = r1.rows[0].median_return;
            }
          }
          if (c.fund_age_years >= 4 && !returns.rollingReturn3yAvg) {
            const r3 = await client.query('SELECT * FROM calc_rolling_returns($1, 3, 60)', [schemeCode]);
            if (r3.rows.length > 0) {
              returns.rollingReturn3yAvg = r3.rows[0].avg_return;
              returns.rollingReturn3yMin = r3.rows[0].min_return;
              returns.rollingReturn3yMax = r3.rows[0].max_return;
              returns.rollingReturn3yMedian = r3.rows[0].median_return;
            }
          }
        }
      } catch (e) {
        console.warn('On-the-fly metric computation error:', e);
      }
    }

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

      // Strategy 2: Fallback — clean scheme name + ILIKE match
      if (variants.length <= 1) {
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
      Object.entries(returns).map(([k, v]) =>
        [k, v !== null && v !== undefined && k !== 'updatedAt' ? parseFloat(v as string) || null : v]
      )
    ) : null;

    return NextResponse.json({
      success: true,
      data: {
        fund: {
          ...parsedFund,
          fundHouse: parsedFund?.amcCode || null,
          category: parsedFund?.category || null,
          // schemeType is now derived from category in the SQL SELECT above
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
