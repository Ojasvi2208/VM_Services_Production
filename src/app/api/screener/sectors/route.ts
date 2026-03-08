/**
 * GET /api/screener/sectors
 * Returns master sector list with fund counts.
 * Used to render the "DNA Slider" pills.
 */
import { NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        ms.id,
        ms.sector_name AS "sectorName",
        ms.display_name AS "displayName",
        ms.color_hex AS "colorHex",
        COUNT(DISTINCT sss.scheme_code) AS "fundCount",
        ROUND(AVG(sss.total_weight), 2) AS "avgWeight",
        ROUND(MAX(sss.total_weight), 2) AS "maxWeight"
      FROM master_sectors ms
      LEFT JOIN scheme_sector_summary sss ON sss.master_sector_id = ms.id
        AND sss.as_of_date = (SELECT MAX(as_of_date) FROM scheme_sector_summary)
      GROUP BY ms.id, ms.sector_name, ms.display_name, ms.color_hex
      HAVING COUNT(DISTINCT sss.scheme_code) > 0
      ORDER BY COUNT(DISTINCT sss.scheme_code) DESC
    `);

    return NextResponse.json({
      success: true,
      sectors: result.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
