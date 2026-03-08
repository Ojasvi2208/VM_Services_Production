/**
 * GET /api/screener/search
 * The "Market Genome" search engine.
 * Filters funds by sector exposure thresholds AND/OR must-include stocks.
 *
 * Query params:
 *   sectors = JSON: { "banking": 15, "it": 10 }  (sector_name → min weight%)
 *   stock   = ISIN (e.g., INE002A01018) — must-include stock filter
 *   limit   = max results (default 50)
 *   plan    = "Direct" | "Regular" (default "Direct")
 *   option  = "Growth" | "IDCW" (default "Growth")
 *
 * Architecture: Hits scheme_sector_summary (O(1) index, ~1000 rows)
 * instead of raw holdings (60k+ rows). Sub-50ms guaranteed.
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sectorsRaw = searchParams.get('sectors');
  const stockIsin = searchParams.get('stock');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const plan = searchParams.get('plan') || 'Direct';
  const option = searchParams.get('option') || 'Growth';

  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    // Parse sector filters: { "banking": 15, "it": 10 }
    let sectorFilters: Record<string, number> = {};
    if (sectorsRaw) {
      try {
        sectorFilters = JSON.parse(sectorsRaw);
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid sectors JSON' }, { status: 400 });
      }
    }

    // Build sector filter subqueries
    // Each sector filter: scheme must have >= X% in that sector
    const sectorNames = Object.keys(sectorFilters);
    for (const sectorName of sectorNames) {
      const minWeight = sectorFilters[sectorName];
      conditions.push(`
        EXISTS (
          SELECT 1 FROM scheme_sector_summary sss
          JOIN master_sectors ms ON ms.id = sss.master_sector_id
          WHERE sss.scheme_code = f.scheme_code
            AND ms.sector_name = $${paramIdx}
            AND sss.total_weight >= $${paramIdx + 1}
            AND sss.as_of_date = (SELECT MAX(as_of_date) FROM scheme_sector_summary)
        )
      `);
      values.push(sectorName, minWeight);
      paramIdx += 2;
    }

    // Stock ISIN filter
    if (stockIsin) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM scheme_stock_index si
          WHERE si.scheme_code = f.scheme_code
            AND si.isin = $${paramIdx}
            AND si.as_of_date = (SELECT MAX(as_of_date) FROM scheme_stock_index)
        )
      `);
      values.push(stockIsin);
      paramIdx++;
    }

    // Plan + Option filter
    conditions.push(`f.plan_type = $${paramIdx}`);
    values.push(plan);
    paramIdx++;
    conditions.push(`f.option_type = $${paramIdx}`);
    values.push(option);
    paramIdx++;
    conditions.push(`f.is_active = true`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main query: return matching funds with their sector DNA
    const result = await pool.query(`
      SELECT
        f.scheme_code AS "schemeCode",
        f.scheme_name AS "schemeName",
        f.category,
        f.sub_category AS "subCategory",
        f.latest_nav AS "nav",
        f.fund_size AS "fundSize",
        fr.cagr_3y AS "cagr3Y",
        fr.cagr_1y AS "cagr1Y",
        (
          SELECT json_agg(json_build_object(
            'sector', ms2.display_name,
            'sectorName', ms2.sector_name,
            'weight', sss2.total_weight,
            'colorHex', ms2.color_hex
          ) ORDER BY sss2.total_weight DESC)
          FROM scheme_sector_summary sss2
          JOIN master_sectors ms2 ON ms2.id = sss2.master_sector_id
          WHERE sss2.scheme_code = f.scheme_code
            AND sss2.as_of_date = (SELECT MAX(as_of_date) FROM scheme_sector_summary)
        ) AS "sectorDna"
      FROM funds f
      LEFT JOIN fund_returns fr ON fr.scheme_code = f.scheme_code
      ${whereClause}
      ORDER BY fr.cagr_3y DESC NULLS LAST
      LIMIT $${paramIdx}
    `, [...values, limit]);

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      filters: {
        sectors: sectorFilters,
        stock: stockIsin,
        plan,
        option,
      },
      funds: result.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
