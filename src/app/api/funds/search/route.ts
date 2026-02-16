/**
 * Fast Fund Search API — Unified Search Engine
 *
 * Queries mv_unified_search (materialized view) for O(k) speed.
 * ~4,000 pre-aggregated family rows with GIN trigram index → sub-50ms.
 *
 * Falls back to legacy funds table scan if mv_unified_search doesn't exist yet
 * (pre-migration compatibility).
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// ── Check if mv_unified_search exists (cached per cold start) ──
let matViewExists: boolean | null = null;

async function checkMatView(): Promise<boolean> {
  if (matViewExists !== null) return matViewExists;
  try {
    const res = await pool.query(
      `SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_unified_search' LIMIT 1`
    );
    matViewExists = res.rows.length > 0;
  } catch {
    matViewExists = false;
  }
  return matViewExists;
}

// ════════════════════════════════════════════════════════════════════
//  GET /api/funds/search?q=hdfc+top&amc=HDFC&category=Equity&page=1
// ════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const query       = sp.get('q') || '';
    const amc         = sp.get('amc') || '';
    const category    = sp.get('category') || '';
    const subCategory = sp.get('subCategory') || '';
    const page        = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize    = Math.min(50, parseInt(sp.get('pageSize') || '10'));

    if (!query && !amc && !category && !subCategory) {
      const stats = await pool.query('SELECT COUNT(*) FROM funds');
      return NextResponse.json({
        success: true, funds: [], total: parseInt(stats.rows[0].count),
        page: 1, pageSize, totalPages: 0, message: 'Apply filters to search funds'
      });
    }

    const useMV = await checkMatView();

    if (useMV) {
      return await searchUnified(query, amc, category, subCategory, page, pageSize);
    } else {
      return await searchLegacy(query, amc, category, page, pageSize);
    }

  } catch (error: any) {
    return NextResponse.json({
      success: false, error: error.message, funds: [],
      total: 0, page: 1, pageSize: 10, totalPages: 0
    }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════════════
//  UNIFIED SEARCH — queries mv_unified_search (O(k), sub-50ms)
// ════════════════════════════════════════════════════════════════════

async function searchUnified(
  query: string, amc: string, category: string, subCategory: string,
  page: number, pageSize: number
) {
  let where = 'WHERE 1=1';
  const params: any[] = [];
  let p = 1;

  // Text search: trigram match on pre-computed search_text column
  if (query) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    for (const word of words) {
      where += ` AND search_text LIKE $${p}`;
      params.push(`%${word}%`);
      p++;
    }
  }

  if (amc) {
    where += ` AND fund_house ILIKE $${p}`;
    params.push(`%${amc}%`);
    p++;
  }

  if (subCategory) {
    where += ` AND sub_category ILIKE $${p}`;
    params.push(`%${subCategory}%`);
    p++;
  } else if (category) {
    where += ` AND (category ILIKE $${p} OR sub_category ILIKE $${p})`;
    params.push(`%${category}%`);
    p++;
  }

  // Count
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM mv_unified_search ${where}`, params
  );
  const total = parseInt(countRes.rows[0].count);
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;

  // Paginated results
  const dataParams = [...params, pageSize, offset];
  const result = await pool.query(
    `SELECT
      master_fund_id    AS "masterFundId",
      strategy_name     AS "strategyName",
      fund_house        AS "fundHouse",
      category,
      sub_category      AS "subCategory",
      variant_count     AS "variantCount",
      canonical_scheme_code AS "schemeCode",
      canonical_scheme_name AS "schemeName",
      canonical_nav         AS "latestNav",
      canonical_nav_date    AS "latestNavDate",
      return_1y         AS "return1y",
      cagr_3y           AS "cagr3y",
      cagr_5y           AS "cagr5y",
      cagr_3y_min       AS "cagr3yMin",
      cagr_3y_max       AS "cagr3yMax",
      cagr_5y_min       AS "cagr5yMin",
      cagr_5y_max       AS "cagr5yMax",
      sharpe_ratio      AS "sharpeRatio",
      variants
    FROM mv_unified_search
    ${where}
    ORDER BY cagr_3y DESC NULLS LAST
    LIMIT $${p} OFFSET $${p + 1}`,
    dataParams
  );

  return NextResponse.json({
    success: true,
    funds: result.rows.map(row => ({
      ...row,
      latestNav: row.latestNav ? parseFloat(row.latestNav) : null,
      return1y: row.return1y ? parseFloat(row.return1y) : null,
      cagr3y: row.cagr3y ? parseFloat(row.cagr3y) : null,
      cagr5y: row.cagr5y ? parseFloat(row.cagr5y) : null,
      cagr3yMin: row.cagr3yMin ? parseFloat(row.cagr3yMin) : null,
      cagr3yMax: row.cagr3yMax ? parseFloat(row.cagr3yMax) : null,
      cagr5yMin: row.cagr5yMin ? parseFloat(row.cagr5yMin) : null,
      cagr5yMax: row.cagr5yMax ? parseFloat(row.cagr5yMax) : null,
      sharpeRatio: row.sharpeRatio ? parseFloat(row.sharpeRatio) : null,
      variants: row.variants || [],
    })),
    total,
    page,
    pageSize,
    totalPages,
    query: query || amc || category || subCategory,
    engine: 'unified'
  });
}

// ════════════════════════════════════════════════════════════════════
//  LEGACY SEARCH — fallback if migration hasn't run yet
// ════════════════════════════════════════════════════════════════════

async function searchLegacy(
  query: string, amc: string, category: string,
  page: number, pageSize: number
) {
  let where = 'WHERE f.scheme_name ILIKE $1 AND f.scheme_name ILIKE $2';
  const params: any[] = ['%Direct%', '%Growth%'];
  let p = 3;

  if (query) {
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    for (const word of words) {
      where += ` AND f.scheme_name ILIKE $${p}`;
      params.push(`%${word}%`);
      p++;
    }
  }

  if (amc) {
    where += ` AND (f.amc_code ILIKE $${p} OR f.scheme_name ILIKE $${p})`;
    params.push(`%${amc}%`);
    p++;
  }

  if (category) {
    where += ` AND (f.scheme_type ILIKE $${p} OR f.scheme_name ILIKE $${p})`;
    params.push(`%${category}%`);
    p++;
  }

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM funds f LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code ${where}`,
    params
  );
  const total = parseInt(countRes.rows[0].count);
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;

  const dataParams = [...params, pageSize, offset];
  const result = await pool.query(
    `SELECT
      f.scheme_code AS "schemeCode", f.scheme_name AS "schemeName",
      f.latest_nav AS nav, f.latest_nav_date AS date,
      f.amc_code AS "amcCode", f.scheme_type AS "schemeType",
      r.return_1y AS "return1y", r.cagr_3y AS "cagr3y", r.cagr_5y AS "cagr5y"
    FROM funds f
    LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code
    ${where}
    ORDER BY r.cagr_3y DESC NULLS LAST
    LIMIT $${p} OFFSET $${p + 1}`,
    dataParams
  );

  return NextResponse.json({
    success: true,
    funds: result.rows.map(fund => ({
      schemeCode: fund.schemeCode,
      schemeName: fund.schemeName,
      latestNav: fund.nav ? parseFloat(fund.nav) : null,
      latestNavDate: fund.date,
      amcCode: fund.amcCode,
      schemeType: fund.schemeType,
      return1y: fund.return1y ? parseFloat(fund.return1y) : null,
      cagr3y: fund.cagr3y ? parseFloat(fund.cagr3y) : null,
      cagr5y: fund.cagr5y ? parseFloat(fund.cagr5y) : null,
    })),
    total, page, pageSize, totalPages,
    query: query || amc || category,
    engine: 'legacy'
  });
}

// ════════════════════════════════════════════════════════════════════
//  POST /api/funds/search — Advanced search (category browser)
// ════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query = '', amc = '', category = '', subCategory = '', limit = 100 } = body;

    if (!query && !amc && !category && !subCategory) {
      const stats = await pool.query('SELECT COUNT(*) FROM funds');
      return NextResponse.json({
        success: true, funds: [], total: parseInt(stats.rows[0].count),
        message: 'Apply filters to search funds'
      });
    }

    const useMV = await checkMatView();

    if (useMV) {
      // Use unified search with limit as pageSize, page 1
      return await searchUnified(query, amc, category, subCategory, 1, Math.min(limit, 200));
    }

    // Legacy fallback
    let where = 'WHERE f.scheme_name ILIKE $1 AND f.scheme_name ILIKE $2';
    const params: any[] = ['%Direct%', '%Growth%'];
    let p = 3;

    if (amc) {
      where += ` AND f.amc_code ILIKE $${p}`;
      params.push(`%${amc}%`);
      p++;
    }

    if (subCategory) {
      where += ` AND (f.scheme_name ILIKE $${p} OR f.scheme_type ILIKE $${p})`;
      params.push(`%${subCategory}%`);
      p++;
    } else if (category) {
      where += ` AND (f.scheme_name ILIKE $${p} OR f.scheme_type ILIKE $${p})`;
      params.push(`%${category}%`);
      p++;
    }

    if (query) {
      const words = query.trim().split(/\s+/).filter((w: string) => w.length > 0);
      for (const word of words) {
        where += ` AND f.scheme_name ILIKE $${p}`;
        params.push(`%${word}%`);
        p++;
      }
    }

    params.push(limit);
    const result = await pool.query(
      `SELECT
        f.scheme_code AS "schemeCode", f.scheme_name AS "schemeName",
        f.latest_nav AS nav, f.latest_nav_date AS date,
        f.amc_code AS "amcCode", f.scheme_type AS "schemeType",
        r.return_1y AS "return1y", r.cagr_3y AS "cagr3y", r.cagr_5y AS "cagr5y"
      FROM funds f
      LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code
      ${where}
      ORDER BY r.cagr_3y DESC NULLS LAST
      LIMIT $${p}`,
      params
    );

    return NextResponse.json({
      success: true,
      funds: result.rows.map(fund => ({
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        latestNav: fund.nav ? parseFloat(fund.nav) : null,
        latestNavDate: fund.date,
        amcCode: fund.amcCode,
        schemeType: fund.schemeType,
        return1y: fund.return1y ? parseFloat(fund.return1y) : null,
        cagr3y: fund.cagr3y ? parseFloat(fund.cagr3y) : null,
        cagr5y: fund.cagr5y ? parseFloat(fund.cagr5y) : null,
      })),
      total: result.rows.length,
      filters: { amc, category, subCategory, query },
      engine: 'legacy'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false, error: error.message, funds: []
    }, { status: 500 });
  }
}
