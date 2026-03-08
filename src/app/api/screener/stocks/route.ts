/**
 * GET /api/screener/stocks?q=reliance
 * Autocomplete for "Must Include Stock" search.
 * Searches scheme_stock_index by stock name (trigram) or ISIN.
 * Returns distinct stocks with fund count.
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ success: true, stocks: [] });
  }

  try {
    const result = await pool.query(`
      SELECT
        ssi.isin,
        ssi.stock_name AS "stockName",
        COUNT(DISTINCT ssi.scheme_code) AS "fundCount",
        ROUND(AVG(ssi.weight_pct), 2) AS "avgWeight"
      FROM scheme_stock_index ssi
      WHERE (ssi.stock_name ILIKE $1 OR ssi.isin = $2)
        AND ssi.as_of_date = (SELECT MAX(as_of_date) FROM scheme_stock_index)
      GROUP BY ssi.isin, ssi.stock_name
      ORDER BY COUNT(DISTINCT ssi.scheme_code) DESC
      LIMIT 15
    `, [`%${q}%`, q.toUpperCase()]);

    return NextResponse.json({
      success: true,
      stocks: result.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
