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
        return_3y as "return3y",
        return_5y as "return5y",
        cagr_1y as "cagr1y",
        cagr_3y as "cagr3y",
        cagr_5y as "cagr5y"
      FROM fund_returns
      WHERE scheme_code = $1`,
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
      ORDER BY nav_date DESC
      LIMIT 30`,
      [schemeCode]
    );

    const navHistory = navHistoryResult.rows;

    // Fund managers and expense history tables don't exist yet
    // Return empty arrays for now
    const managers: any[] = [];
    const expenseHistory: any[] = [];

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
