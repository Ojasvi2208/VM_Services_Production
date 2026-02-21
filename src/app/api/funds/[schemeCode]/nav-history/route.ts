/**
 * NAV History API — Data Sovereign
 * GET /api/funds/[schemeCode]/nav-history
 * Returns historical NAV data from local nav_history table (zero external deps)
 *
 * Query params:
 *   startDate  — YYYY-MM-DD (optional)
 *   endDate    — YYYY-MM-DD (optional)
 *   limit      — max rows (default 365)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function GET(
  request: NextRequest,
  { params }: { params: { schemeCode: string } }
) {
  const { schemeCode } = params;
  const searchParams = request.nextUrl.searchParams;

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') || '365');

  try {
    // Build query with optional date filters
    const conditions: string[] = ['scheme_code = $1'];
    const values: (string | number)[] = [schemeCode];
    let paramIdx = 2;

    if (startDate) {
      conditions.push(`nav_date >= $${paramIdx}::date`);
      values.push(startDate);
      paramIdx++;
    }
    if (endDate) {
      conditions.push(`nav_date <= $${paramIdx}::date`);
      values.push(endDate);
      paramIdx++;
    }

    values.push(limit);

    const query = `
      SELECT nav_date::text AS date, nav_value AS nav
      FROM nav_history
      WHERE ${conditions.join(' AND ')}
      ORDER BY nav_date ASC
      LIMIT $${paramIdx}
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Format: { date: "YYYY-MM-DD", nav: number } — matches Android NavPoint contract
    const data = result.rows.map((row: { date: string; nav: string }) => ({
      date: row.date,
      nav: parseFloat(row.nav)
    }));

    return NextResponse.json(
      { success: true, data, count: data.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800'
        }
      }
    );
  } catch (error: any) {
    console.error('NAV history query error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch NAV history' },
      { status: 500 }
    );
  }
}
