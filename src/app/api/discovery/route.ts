/**
 * Wealth Discovery API — Powers the "Discover" tab
 *
 * Single endpoint returning all discovery sections:
 *   1. Trending in [category] — weighted by 1M return + AUM momentum
 *   2. Top Compounders — sorted by 3Y CAGR descending
 *   3. Curated collection counts (for badge display)
 *
 * GET /api/discovery?category=Equity&sort=cagr_3y&limit=10
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/postgres-db";

// ── Equity sub-categories for filtering ──
const EQUITY_SUBCATS = [
  "Large Cap", "Mid Cap", "Small Cap", "Multi Cap", "Large & Mid Cap",
  "Flexi Cap", "ELSS", "Value", "Contra", "Focused", "Dividend Yield",
  "Sectoral/Thematic",
];

const DEBT_SUBCATS = [
  "Liquid", "Ultra Short Duration", "Short Duration", "Medium Duration",
  "Long Duration", "Dynamic Bond", "Corporate Bond", "Banking and PSU",
  "Gilt", "Money Market", "Overnight", "Low Duration", "Medium to Long Duration",
  "Credit Risk", "Floater",
];

const HYBRID_SUBCATS = [
  "Aggressive Hybrid", "Conservative Hybrid", "Balanced Advantage",
  "Multi Asset Allocation", "Equity Savings", "Arbitrage",
];

function subcatsForCategory(cat: string): string[] {
  switch (cat.toLowerCase()) {
    case "equity": return EQUITY_SUBCATS;
    case "debt":   return DEBT_SUBCATS;
    case "hybrid": return HYBRID_SUBCATS;
    default:       return [];
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const category = sp.get("category") || "Equity";
  const sort = sp.get("sort") || "cagr_3y";
  const limit = Math.min(parseInt(sp.get("limit") || "10"), 30);

  const client = await pool.connect();

  try {
    // ── Build category filter ──
    const isIndex = category.toLowerCase() === "index";
    let categoryFilter: string;
    let filterParams: string[];

    if (isIndex) {
      categoryFilter = `AND (u.sub_category ILIKE '%Index%' OR u.canonical_scheme_name ILIKE '%Index Fund%' OR u.canonical_scheme_name ILIKE '%Nifty%' OR u.canonical_scheme_name ILIKE '%Sensex%')`;
      filterParams = [];
    } else {
      const subcats = subcatsForCategory(category);
      if (subcats.length > 0) {
        categoryFilter = `AND u.sub_category = ANY($3)`;
        filterParams = subcats as string[];
      } else {
        categoryFilter = `AND (u.category ILIKE $3 OR u.sub_category ILIKE $3)`;
        filterParams = [`%${category}%`];
      }
    }

    // ═════════════════════════════════════════════════
    // Section 1: Trending — weighted score (60% 1M return + 40% AUM rank)
    // ═════════════════════════════════════════════════
    const trendingQuery = `
      SELECT
        u.master_fund_id AS "masterFundId",
        u.strategy_name AS "strategyName",
        u.fund_house AS "fundHouse",
        u.category,
        u.sub_category AS "subCategory",
        u.canonical_scheme_code AS "schemeCode",
        u.canonical_scheme_name AS "schemeName",
        u.canonical_nav AS "latestNav",
        fr.return_1m AS "return1m",
        fr.cagr_3y AS "cagr3y",
        fr.cagr_5y AS "cagr5y",
        fr.return_1y AS "return1y",
        fr.sharpe_ratio_1y AS "sharpeRatio",
        fr.volatility_1y AS "volatility",
        f.fund_size AS "fundSize",
        f.risk_level AS "riskLevel",
        -- Trending score: heavily weight recent momentum
        COALESCE(fr.return_1m, 0) * 0.6 +
        COALESCE(CASE WHEN f.fund_size > 0 THEN LN(f.fund_size) ELSE 0 END, 0) * 0.4
          AS trending_score
      FROM mv_unified_search u
      JOIN funds f ON f.scheme_code = u.canonical_scheme_code
      LEFT JOIN fund_returns fr ON fr.scheme_code = u.canonical_scheme_code
      WHERE f.plan_type = 'Direct'
        AND f.option_type = 'Growth'
        AND fr.cagr_3y IS NOT NULL
        AND fr.cagr_3y BETWEEN 0 AND 100
        AND COALESCE(f.fund_size, 0) > 100
        ${isIndex ? categoryFilter : categoryFilter}
      ORDER BY trending_score DESC
      LIMIT $1
    `;

    const trendingParams: (string | number | string[])[] = [limit];
    if (!isIndex && filterParams.length > 0) {
      // $1 = limit, $2 = unused placeholder offset, $3 = filter
      // Adjust: we need to restructure params
    }

    // Build params properly
    let trendingSQL: string;
    let trendingP: (string | number | string[])[];

    if (isIndex) {
      trendingSQL = `
        SELECT
          u.master_fund_id AS "masterFundId",
          u.strategy_name AS "strategyName",
          u.fund_house AS "fundHouse",
          u.category,
          u.sub_category AS "subCategory",
          u.canonical_scheme_code AS "schemeCode",
          u.canonical_scheme_name AS "schemeName",
          u.canonical_nav AS "latestNav",
          fr.return_1m AS "return1m",
          fr.cagr_3y AS "cagr3y",
          fr.cagr_5y AS "cagr5y",
          fr.return_1y AS "return1y",
          fr.sharpe_ratio_1y AS "sharpeRatio",
          fr.volatility_1y AS "volatility",
          f.fund_size AS "fundSize",
          f.risk_level AS "riskLevel"
        FROM mv_unified_search u
        JOIN funds f ON f.scheme_code = u.canonical_scheme_code
        LEFT JOIN fund_returns fr ON fr.scheme_code = u.canonical_scheme_code
        WHERE f.plan_type = 'Direct'
          AND f.option_type = 'Growth'
          AND fr.cagr_3y IS NOT NULL
          AND fr.cagr_3y BETWEEN 0 AND 100
          AND COALESCE(f.fund_size, 0) > 100
          AND (u.sub_category ILIKE '%Index%'
               OR u.canonical_scheme_name ILIKE '%Index Fund%'
               OR u.canonical_scheme_name ILIKE '%Nifty%'
               OR u.canonical_scheme_name ILIKE '%Sensex%')
        ORDER BY COALESCE(fr.return_1m, 0) * 0.6 + COALESCE(CASE WHEN f.fund_size > 0 THEN LN(f.fund_size) ELSE 0 END, 0) * 0.4 DESC
        LIMIT $1
      `;
      trendingP = [limit];
    } else {
      const subcats = subcatsForCategory(category);
      if (subcats.length > 0) {
        trendingSQL = `
          SELECT
            u.master_fund_id AS "masterFundId",
            u.strategy_name AS "strategyName",
            u.fund_house AS "fundHouse",
            u.category,
            u.sub_category AS "subCategory",
            u.canonical_scheme_code AS "schemeCode",
            u.canonical_scheme_name AS "schemeName",
            u.canonical_nav AS "latestNav",
            fr.return_1m AS "return1m",
            fr.cagr_3y AS "cagr3y",
            fr.cagr_5y AS "cagr5y",
            fr.return_1y AS "return1y",
            fr.sharpe_ratio_1y AS "sharpeRatio",
            fr.volatility_1y AS "volatility",
            f.fund_size AS "fundSize",
            f.risk_level AS "riskLevel"
          FROM mv_unified_search u
          JOIN funds f ON f.scheme_code = u.canonical_scheme_code
          LEFT JOIN fund_returns fr ON fr.scheme_code = u.canonical_scheme_code
          WHERE f.plan_type = 'Direct'
            AND f.option_type = 'Growth'
            AND fr.cagr_3y IS NOT NULL
            AND fr.cagr_3y BETWEEN 0 AND 100
            AND COALESCE(f.fund_size, 0) > 100
            AND u.sub_category = ANY($2)
          ORDER BY COALESCE(fr.return_1m, 0) * 0.6 + COALESCE(CASE WHEN f.fund_size > 0 THEN LN(f.fund_size) ELSE 0 END, 0) * 0.4 DESC
          LIMIT $1
        `;
        trendingP = [limit, subcats];
      } else {
        trendingSQL = `
          SELECT
            u.master_fund_id AS "masterFundId",
            u.strategy_name AS "strategyName",
            u.fund_house AS "fundHouse",
            u.category,
            u.sub_category AS "subCategory",
            u.canonical_scheme_code AS "schemeCode",
            u.canonical_scheme_name AS "schemeName",
            u.canonical_nav AS "latestNav",
            fr.return_1m AS "return1m",
            fr.cagr_3y AS "cagr3y",
            fr.cagr_5y AS "cagr5y",
            fr.return_1y AS "return1y",
            fr.sharpe_ratio_1y AS "sharpeRatio",
            fr.volatility_1y AS "volatility",
            f.fund_size AS "fundSize",
            f.risk_level AS "riskLevel"
          FROM mv_unified_search u
          JOIN funds f ON f.scheme_code = u.canonical_scheme_code
          LEFT JOIN fund_returns fr ON fr.scheme_code = u.canonical_scheme_code
          WHERE f.plan_type = 'Direct'
            AND f.option_type = 'Growth'
            AND fr.cagr_3y IS NOT NULL
            AND fr.cagr_3y BETWEEN 0 AND 100
            AND COALESCE(f.fund_size, 0) > 100
            AND (u.category ILIKE $2 OR u.sub_category ILIKE $2)
          ORDER BY COALESCE(fr.return_1m, 0) * 0.6 + COALESCE(CASE WHEN f.fund_size > 0 THEN LN(f.fund_size) ELSE 0 END, 0) * 0.4 DESC
          LIMIT $1
        `;
        trendingP = [limit, `%${category}%`];
      }
    }

    // ═════════════════════════════════════════════════
    // Section 2: Top Compounders — pure 3Y CAGR descending
    // ═════════════════════════════════════════════════
    let compoundersSQL: string;
    let compoundersP: (string | number | string[])[];

    const compoundersBase = `
      SELECT
        u.master_fund_id AS "masterFundId",
        u.strategy_name AS "strategyName",
        u.fund_house AS "fundHouse",
        u.category,
        u.sub_category AS "subCategory",
        u.canonical_scheme_code AS "schemeCode",
        u.canonical_scheme_name AS "schemeName",
        u.canonical_nav AS "latestNav",
        fr.cagr_3y AS "cagr3y",
        fr.cagr_5y AS "cagr5y",
        fr.return_1y AS "return1y",
        fr.return_1m AS "return1m",
        fr.sharpe_ratio_1y AS "sharpeRatio",
        fr.volatility_1y AS "volatility",
        f.fund_size AS "fundSize",
        f.risk_level AS "riskLevel"
      FROM mv_unified_search u
      JOIN funds f ON f.scheme_code = u.canonical_scheme_code
      LEFT JOIN fund_returns fr ON fr.scheme_code = u.canonical_scheme_code
      WHERE f.plan_type = 'Direct'
        AND f.option_type = 'Growth'
        AND fr.cagr_3y IS NOT NULL
        AND fr.cagr_3y BETWEEN 0 AND 100
        AND COALESCE(f.fund_size, 0) > 100
    `;

    const sortColumn = sort === "cagr_5y" ? "fr.cagr_5y" : sort === "return_1y" ? "fr.return_1y" : "fr.cagr_3y";

    if (isIndex) {
      compoundersSQL = compoundersBase + `
        AND (u.sub_category ILIKE '%Index%'
             OR u.canonical_scheme_name ILIKE '%Index Fund%'
             OR u.canonical_scheme_name ILIKE '%Nifty%'
             OR u.canonical_scheme_name ILIKE '%Sensex%')
        ORDER BY ${sortColumn} DESC NULLS LAST
        LIMIT $1
      `;
      compoundersP = [limit];
    } else {
      const subcats = subcatsForCategory(category);
      if (subcats.length > 0) {
        compoundersSQL = compoundersBase + `
          AND u.sub_category = ANY($2)
          ORDER BY ${sortColumn} DESC NULLS LAST
          LIMIT $1
        `;
        compoundersP = [limit, subcats];
      } else {
        compoundersSQL = compoundersBase + `
          AND (u.category ILIKE $2 OR u.sub_category ILIKE $2)
          ORDER BY ${sortColumn} DESC NULLS LAST
          LIMIT $1
        `;
        compoundersP = [limit, `%${category}%`];
      }
    }

    // ═════════════════════════════════════════════════
    // Section 3: Curated Collection counts
    // ═════════════════════════════════════════════════
    const collectionsSQL = `
      SELECT
        COUNT(*) FILTER (WHERE u.sub_category = 'ELSS') AS "taxSavers",
        COUNT(*) FILTER (WHERE u.sub_category ILIKE '%Index%'
          OR u.canonical_scheme_name ILIKE '%Index Fund%'
          OR u.canonical_scheme_name ILIKE '%Nifty%'
          OR u.canonical_scheme_name ILIKE '%Sensex%') AS "indexFunds",
        COUNT(*) FILTER (WHERE u.sub_category = 'Dividend Yield') AS "highDividend",
        COUNT(*) FILTER (WHERE u.canonical_scheme_name ILIKE '%International%'
          OR u.canonical_scheme_name ILIKE '%Global%'
          OR u.canonical_scheme_name ILIKE '%US %'
          OR u.canonical_scheme_name ILIKE '%Nasdaq%'
          OR u.canonical_scheme_name ILIKE '%S&P 500%') AS "globalTech"
      FROM mv_unified_search u
      JOIN funds f ON f.scheme_code = u.canonical_scheme_code
      WHERE f.plan_type = 'Direct' AND f.option_type = 'Growth'
    `;

    // Execute all three in parallel
    const [trendingRes, compoundersRes, collectionsRes] = await Promise.all([
      client.query(trendingSQL, trendingP),
      client.query(compoundersSQL, compoundersP),
      client.query(collectionsSQL),
    ]);

    // ── Risk level computation ──
    function computeRisk(row: Record<string, unknown>): string {
      const vol = Number(row.volatility) || 0;
      const subCat = String(row.subCategory || "");
      if (subCat.includes("Small Cap") || vol > 25) return "Very High Risk";
      if (subCat.includes("Mid Cap") || vol > 18) return "High Risk";
      if (subCat.includes("Large Cap") || subCat.includes("Flexi") || subCat.includes("Index")) return "Moderate Risk";
      if (subCat.includes("Hybrid") || subCat.includes("Balanced")) return "Moderate Risk";
      if (subCat.includes("Liquid") || subCat.includes("Overnight")) return "Low Risk";
      if (subCat.includes("Short") || subCat.includes("Ultra")) return "Low to Moderate Risk";
      if (vol > 15) return "High Risk";
      if (vol > 8) return "Moderate Risk";
      return "Low to Moderate Risk";
    }

    function mapFund(row: Record<string, unknown>) {
      return {
        masterFundId: row.masterFundId,
        strategyName: row.strategyName,
        fundHouse: row.fundHouse,
        category: row.category,
        subCategory: row.subCategory,
        schemeCode: row.schemeCode,
        schemeName: row.schemeName,
        latestNav: Number(row.latestNav) || 0,
        return1m: Number(row.return1m) || null,
        return1y: Number(row.return1y) || null,
        cagr3y: Number(row.cagr3y) || null,
        cagr5y: Number(row.cagr5y) || null,
        sharpeRatio: Number(row.sharpeRatio) || null,
        fundSize: Number(row.fundSize) || null,
        riskLevel: computeRisk(row),
      };
    }

    return NextResponse.json({
      success: true,
      category,
      sort,
      trending: trendingRes.rows.map(mapFund),
      compounders: compoundersRes.rows.map(mapFund),
      collections: collectionsRes.rows[0] || { taxSavers: 0, indexFunds: 0, highDividend: 0, globalTech: 0 },
      generatedAt: new Date().toISOString(),
    });

  } catch (e: unknown) {
    console.error("Discovery API error:", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  } finally {
    client.release();
  }
}
