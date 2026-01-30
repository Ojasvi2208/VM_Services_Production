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

    // Get latest returns
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
        return_since_inception as "returnInception",
        cagr_1y as "cagr1y",
        cagr_2y as "cagr2y",
        cagr_3y as "cagr3y",
        cagr_5y as "cagr5y",
        cagr_7y as "cagr7y",
        cagr_10y as "cagr10y",
        cagr_since_inception as "cagrInception",
        volatility_1y as "volatility1y",
        volatility_3y as "volatility3y",
        volatility_5y as "volatility5y",
        sharpe_1y as "sharpe1y",
        sharpe_3y as "sharpe3y",
        sharpe_5y as "sharpe5y"
      FROM fund_returns
      WHERE scheme_code = $1
      ORDER BY calculated_date DESC
      LIMIT 1`,
      [schemeCode]
    );

    const returns = returnsResult.rows[0] || null;

    // Get recent NAV history (last 30 days)
    const navHistoryResult = await client.query(
      `SELECT 
        nav_date as "date",
        nav_value as "nav"
      FROM nav_history
      WHERE scheme_code = $1
      ORDER BY nav_date ASC
      LIMIT 30`,
      [schemeCode]
    );

    const navHistory = navHistoryResult.rows;

    // Get fund managers
    const managersResult = await client.query(
      `SELECT 
        manager_name as "name",
        start_date as "startDate",
        end_date as "endDate",
        is_current as "isCurrent",
        tenure_years as "tenure"
      FROM fund_managers
      WHERE scheme_code = $1
      ORDER BY is_current DESC, start_date DESC`,
      [schemeCode]
    );

    const managers = managersResult.rows;

    // Get expense ratio history
    const expenseHistoryResult = await client.query(
      `SELECT 
        effective_date as "date",
        expense_ratio as "ratio"
      FROM expense_ratio_history
      WHERE scheme_code = $1
      ORDER BY effective_date DESC
      LIMIT 12`,
      [schemeCode]
    );

    const expenseHistory = expenseHistoryResult.rows;

    return NextResponse.json({
      success: true,
      data: {
        fund,
        returns,
        navHistory,
        managers,
        expenseHistory
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
