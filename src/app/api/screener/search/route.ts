/**
 * GET /api/screener/search
 * Institutional-grade fund screener.
 *
 * Query params:
 *   sectors        = JSON: { "banking": 15, "it": 10 }  (sector_name → min weight%)
 *   stock          = ISIN — must-include stock filter
 *   plan           = "Direct" | "Regular" (default "Direct")
 *   option         = "Growth" | "IDCW" (default "Growth")
 *   category       = "Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Other"
 *   subCategory    = e.g. "Large Cap"
 *   minAum         = minimum AUM in Cr (e.g. 500)
 *   maxExpenseRatio= maximum expense ratio % (e.g. 1.0)
 *   minReturn1y    = minimum 1Y return % (e.g. 10)
 *   minReturn3y    = minimum 3Y CAGR % (e.g. 12)
 *   minSharpe      = minimum Sharpe ratio (e.g. 0.5)
 *   maxVolatility  = maximum annualised volatility % (e.g. 20)
 *   maxExitLoad    = maximum exit load % — 0 means zero-exit-load only
 *   minFundAge     = minimum fund age in years (e.g. 3)
 *   limit          = max results (default 60)
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;

  const sectorsRaw      = sp.get('sectors');
  const stockIsin       = sp.get('stock');
  const limit           = Math.min(parseInt(sp.get('limit') || '60'), 200);
  const plan            = sp.get('plan')   || 'Direct';
  const option          = sp.get('option') || 'Growth';
  const category        = sp.get('category');
  const subCategory     = sp.get('subCategory');
  const minAum          = sp.get('minAum')           ? parseFloat(sp.get('minAum')!)           : null;
  const maxExpenseRatio = sp.get('maxExpenseRatio')  ? parseFloat(sp.get('maxExpenseRatio')!)  : null;
  const minReturn1y     = sp.get('minReturn1y')      ? parseFloat(sp.get('minReturn1y')!)      : null;
  const minReturn3y     = sp.get('minReturn3y')      ? parseFloat(sp.get('minReturn3y')!)      : null;
  const minSharpe       = sp.get('minSharpe')        ? parseFloat(sp.get('minSharpe')!)        : null;
  const maxVolatility   = sp.get('maxVolatility')    ? parseFloat(sp.get('maxVolatility')!)    : null;
  const maxExitLoad     = sp.get('maxExitLoad')      !== null ? parseFloat(sp.get('maxExitLoad')!) : null;
  const minFundAge      = sp.get('minFundAge')       ? parseFloat(sp.get('minFundAge')!)       : null;

  try {
    const conditions: string[] = [];
    const values: any[]        = [];
    let p = 1;

    // ── Plan / Option (always applied) ────────────────────────────
    conditions.push(`f.plan_type = $${p++}`);   values.push(plan);
    conditions.push(`f.option_type = $${p++}`); values.push(option);
    conditions.push(`f.is_active IS NOT FALSE`);

    // ── Category ──────────────────────────────────────────────────
    if (category) {
      conditions.push(`f.category = $${p++}`);
      values.push(category);
    }

    // ── Sub-category ──────────────────────────────────────────────
    if (subCategory) {
      conditions.push(`f.sub_category = $${p++}`);
      values.push(subCategory);
    }

    // ── AUM (fund_size is stored in Cr) ───────────────────────────
    if (minAum !== null && !isNaN(minAum)) {
      conditions.push(`COALESCE(f.fund_size, 0) >= $${p++}`);
      values.push(minAum);
    }

    // ── Expense ratio ─────────────────────────────────────────────
    if (maxExpenseRatio !== null && !isNaN(maxExpenseRatio)) {
      conditions.push(`COALESCE(f.expense_ratio, 999) <= $${p++}`);
      values.push(maxExpenseRatio);
    }

    // ── Exit load ─────────────────────────────────────────────────
    if (maxExitLoad !== null && !isNaN(maxExitLoad)) {
      conditions.push(`COALESCE(f.exit_load, 0) <= $${p++}`);
      values.push(maxExitLoad);
    }

    // ── Fund age (inception_date) ─────────────────────────────────
    if (minFundAge !== null && !isNaN(minFundAge)) {
      conditions.push(`f.inception_date <= NOW() - INTERVAL '1 year' * $${p++}`);
      values.push(minFundAge);
    }

    // ── Return filters (from fund_returns) ────────────────────────
    if (minReturn1y !== null && !isNaN(minReturn1y)) {
      conditions.push(`COALESCE(fr.cagr_1y, -999) >= $${p++}`);
      values.push(minReturn1y);
    }
    if (minReturn3y !== null && !isNaN(minReturn3y)) {
      conditions.push(`COALESCE(fr.cagr_3y, -999) >= $${p++}`);
      values.push(minReturn3y);
    }

    // ── Risk filters ──────────────────────────────────────────────
    if (minSharpe !== null && !isNaN(minSharpe)) {
      conditions.push(`COALESCE(fr.sharpe_ratio_1y, -999) >= $${p++}`);
      values.push(minSharpe);
    }
    if (maxVolatility !== null && !isNaN(maxVolatility)) {
      conditions.push(`COALESCE(fr.volatility_1y, 999) <= $${p++}`);
      values.push(maxVolatility);
    }

    // ── Sector DNA filters ────────────────────────────────────────
    let sectorFilters: Record<string, number> = {};
    if (sectorsRaw) {
      try { sectorFilters = JSON.parse(sectorsRaw); } catch {
        return NextResponse.json({ success: false, error: 'Invalid sectors JSON' }, { status: 400 });
      }
    }
    for (const sectorName of Object.keys(sectorFilters)) {
      const minWeight = sectorFilters[sectorName];
      conditions.push(`
        EXISTS (
          SELECT 1 FROM scheme_sector_summary sss
          JOIN master_sectors ms ON ms.id = sss.master_sector_id
          WHERE sss.scheme_code = f.scheme_code
            AND ms.sector_name = $${p}
            AND sss.total_weight >= $${p + 1}
            AND sss.as_of_date = (SELECT MAX(as_of_date) FROM scheme_sector_summary)
        )
      `);
      values.push(sectorName, minWeight);
      p += 2;
    }

    // ── Stock ISIN filter ─────────────────────────────────────────
    if (stockIsin) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM scheme_stock_index si
          WHERE si.scheme_code = f.scheme_code
            AND si.isin = $${p++}
            AND si.as_of_date = (SELECT MAX(as_of_date) FROM scheme_stock_index)
        )
      `);
      values.push(stockIsin);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query(`
      SELECT
        f.scheme_code        AS "schemeCode",
        f.scheme_name        AS "schemeName",
        f.category,
        f.sub_category       AS "subCategory",
        f.latest_nav         AS "nav",
        f.fund_size          AS "fundSize",
        f.expense_ratio      AS "expenseRatio",
        f.exit_load          AS "exitLoad",
        f.min_sip            AS "minSip",
        f.inception_date     AS "inceptionDate",
        f.risk_level         AS "riskLevel",
        fr.cagr_1y           AS "cagr1Y",
        fr.cagr_3y           AS "cagr3Y",
        fr.cagr_5y           AS "cagr5Y",
        fr.sharpe_ratio_1y   AS "sharpeRatio1y",
        fr.volatility_1y     AS "volatility1y",
        (
          SELECT json_agg(json_build_object(
            'sector',     ms2.display_name,
            'sectorName', ms2.sector_name,
            'weight',     sss2.total_weight,
            'colorHex',   ms2.color_hex
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
      LIMIT $${p}
    `, [...values, limit]);

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      funds: result.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
