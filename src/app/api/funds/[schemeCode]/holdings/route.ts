/**
 * Fund Top Holdings API
 * GET /api/funds/[schemeCode]/holdings
 * Returns top stock holdings for a fund from fund_top_holdings table.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function GET(
  request: NextRequest,
  { params }: { params: { schemeCode: string } }
) {
  const { schemeCode } = params;

  try {
    const result = await pool.query(`
      SELECT
        holding_name as "holdingName",
        holding_isin as "holdingIsin",
        weight_pct as "weightPct",
        sector,
        rank,
        as_of_date as "asOfDate"
      FROM fund_top_holdings
      WHERE scheme_code = $1
        AND as_of_date = (
          SELECT MAX(as_of_date) FROM fund_top_holdings WHERE scheme_code = $1
        )
      ORDER BY rank ASC
      LIMIT 10
    `, [schemeCode]);

    return NextResponse.json({
      success: true,
      schemeCode,
      holdings: result.rows,
      count: result.rows.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
