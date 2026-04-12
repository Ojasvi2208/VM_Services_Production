/**
 * GET /api/funds/{schemeCode}/sector-allocation
 * Returns sector allocation breakdown from scheme_sector_summary table.
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
      SELECT sector_name, weight_pct, as_of_date
      FROM scheme_sector_summary
      WHERE scheme_code = $1
      ORDER BY weight_pct DESC
    `, [schemeCode]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, sectors: [], message: 'No sector data available' });
    }

    const sectors = result.rows.map((r: any) => ({
      sector: r.sector_name,
      weight: parseFloat(r.weight_pct) || 0,
      asOfDate: r.as_of_date,
    }));

    return cachedJson({ success: true, sectors, asOfDate: sectors[0]?.asOfDate }, CACHE_TTL.FUND_HOLDINGS);
  } catch (error: any) {
    console.error('Sector allocation error:', error.message);
    return NextResponse.json({ success: false, sectors: [], error: error.message }, { status: 500 });
  }
}
