/**
 * Fund Autocomplete API — Strategy Family Level
 * Queries mv_unified_search for grouped results (no duplicates).
 * Returns max 8 suggestions with canonical variant as hero.
 * Falls back to funds table if MV doesn't exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { cachedJson } from '@/lib/api-cache-headers';

let mvExists: boolean | null = null;

async function hasMV(): Promise<boolean> {
  if (mvExists !== null) return mvExists;
  try {
    const r = await pool.query(
      `SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_unified_search' LIMIT 1`
    );
    mvExists = r.rows.length > 0;
  } catch {
    mvExists = false;
  }
  return mvExists;
}

export async function GET(request: NextRequest) {
  try {
    const query = (request.nextUrl.searchParams.get('q') || '').trim();

    if (query.length < 2) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const useMV = await hasMV();
    const pattern = `%${query}%`;

    if (useMV) {
      const result = await pool.query(
        `SELECT
          canonical_scheme_code AS "schemeCode",
          strategy_name         AS "strategyName",
          fund_house            AS "fundHouse",
          sub_category          AS "subCategory",
          canonical_nav         AS "latestNav",
          variant_count         AS "variantCount"
        FROM mv_unified_search
        WHERE search_text ILIKE $1
           OR strategy_name ILIKE $1
           OR canonical_scheme_name ILIKE $1
        ORDER BY
          CASE WHEN strategy_name ILIKE $2 THEN 0 ELSE 1 END,
          strategy_name
        LIMIT 8`,
        [pattern, `${query}%`]
      );

      return cachedJson({
        success: true,
        suggestions: result.rows.map(r => ({
          schemeCode: r.schemeCode,
          schemeName: r.strategyName,
          amcCode: r.fundHouse,
          subCategory: r.subCategory,
          nav: r.latestNav ? parseFloat(r.latestNav) : null,
          variants: r.variantCount,
        }))
      }, 300, 600);
    }

    // Fallback: raw funds table (grouped by name prefix to reduce duplicates)
    const result = await pool.query(
      `SELECT DISTINCT ON (LEFT(scheme_name, 40))
        scheme_code AS "schemeCode",
        scheme_name AS "schemeName",
        amc_code    AS "amcCode",
        (SELECT mf.fund_house FROM master_funds mf WHERE mf.id = funds.master_fund_id) AS "fundHouse"
      FROM funds
      WHERE scheme_name ILIKE $1 OR scheme_code LIKE $2
      ORDER BY LEFT(scheme_name, 40),
        CASE WHEN scheme_name ILIKE $3 THEN 0 ELSE 1 END,
        scheme_name
      LIMIT 8`,
      [pattern, pattern, `${query}%`]
    );

    return cachedJson({
      success: true,
      suggestions: result.rows.map(r => ({
        schemeCode: r.schemeCode,
        schemeName: r.schemeName,
        amcCode: r.fundHouse || r.amcCode,
      }))
    }, 300, 600);

  } catch (error) {
    console.error('[Autocomplete] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ success: false, suggestions: [] }, { status: 500 });
  }
}
