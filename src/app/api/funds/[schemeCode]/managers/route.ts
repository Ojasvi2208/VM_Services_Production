/**
 * GET /api/funds/{schemeCode}/managers
 * Returns fund manager data from fund_managers table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cachedJson, CACHE_TTL } from '@/lib/api-cache-headers';
import pool from '@/lib/postgres-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schemeCode: string }> }
) {
  try {
    const { schemeCode } = await params;

    const result = await pool.query(`
      SELECT manager_name, start_date, end_date, is_current, tenure_years
      FROM fund_managers
      WHERE scheme_code = $1
      ORDER BY is_current DESC, start_date DESC
    `, [schemeCode]);

    const managers = result.rows.map((r: any) => {
      let tenure = r.tenure_years;
      if (!tenure && r.start_date) {
        const start = new Date(r.start_date);
        const end = r.end_date ? new Date(r.end_date) : new Date();
        tenure = ((end.getTime() - start.getTime()) / (365.25 * 86400000)).toFixed(1);
      }
      return {
        name: r.manager_name,
        startDate: r.start_date,
        endDate: r.end_date,
        isCurrent: r.is_current,
        tenure: parseFloat(tenure) || 0,
      };
    });

    return cachedJson({ success: true, managers }, CACHE_TTL.FUND_MANAGERS);
  } catch (error: any) {
    console.error('Fund managers error:', error.message);
    return NextResponse.json({ success: false, managers: [], error: error.message }, { status: 500 });
  }
}
