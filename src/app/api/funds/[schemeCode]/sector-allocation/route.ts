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

    // scheme_sector_summary has: scheme_code, master_sector_id, total_weight
    // JOIN with master_sectors to get sector_name
    const result = await pool.query(`
      SELECT ms.sector_name, ss.total_weight AS weight_pct
      FROM scheme_sector_summary ss
      JOIN master_sectors ms ON ms.id = ss.master_sector_id
      WHERE ss.scheme_code = $1
      ORDER BY ss.total_weight DESC
    `, [schemeCode]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, sectors: [], message: 'No sector data available' });
    }

    const sectors = result.rows.map((r: any) => ({
      sector: r.sector_name || r.sector || 'Unknown',
      weight: parseFloat(r.weight_pct || r.total_weight) || 0,
      asOfDate: r.as_of_date,
    }));

    return cachedJson({ success: true, sectors, asOfDate: sectors[0]?.asOfDate }, CACHE_TTL.FUND_HOLDINGS);
  } catch (error: any) {
    console.error('Sector allocation error:', error.message);
    return NextResponse.json({ success: false, sectors: [], error: error.message }, { status: 500 });
  }
}
