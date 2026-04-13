/**
 * Fast Fund Search API — Hardened Unified Search Engine
 *
 * Queries mv_unified_search (materialized view) for O(k) speed.
 * ~6,000 pre-aggregated family rows with GIN trigram index → sub-50ms.
 *
 * Hardening layers:
 *   1. Case-insensitive (search_text stored lowercase)
 *   2. Space-insensitive ("smallcap" = "small cap")
 *   3. AMC alias expansion ("ABSL" → "Aditya Birla", "PPFAS" → "Parag Parikh")
 *   4. Compound word splitting ("midcap" → "mid cap", "nifty50" → "nifty 50")
 *   5. Typo tolerance via pg_trgm similarity fallback (Levenshtein-like)
 *   6. Progressive relaxation: strict → collapsed → trigram → drop-last-word
 *   7. Empty query → top performers as smart defaults
 *
 * Falls back to legacy funds table scan if mv_unified_search doesn't exist yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cachedJson, CACHE_TTL } from '@/lib/api-cache-headers';
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

// ── AMC Alias Map — Indian MF abbreviations users actually type ──
const AMC_ALIASES: Record<string, string[]> = {
  'absl':     ['aditya birla'],
  'aditya':   ['aditya birla'],
  'birla':    ['aditya birla'],
  'ppfas':    ['parag parikh'],
  'parag':    ['parag parikh'],
  'icici':    ['icici prudential'],
  'nippon':   ['nippon india'],
  'motilal':  ['motilal oswal'],
  'canara':   ['canara robeco'],
  'baroda':   ['baroda bnp'],
  'mahindra': ['mahindra manulife'],
  'pgim':     ['pgim india'],
  'bajaj':    ['bajaj finserv'],
  'franklin': ['franklin templeton', 'franklin india'],
  'mirae':    ['mirae asset'],
  'dsp':      ['dsp'],
  'hdfc':     ['hdfc'],
  'sbi':      ['sbi'],
  'axis':     ['axis'],
  'kotak':    ['kotak'],
  'tata':     ['tata'],
  'uti':      ['uti'],
  'quant':    ['quant'],
  'edelweiss':['edelweiss'],
  'hsbc':     ['hsbc'],
  'sundaram': ['sundaram'],
  'invesco':  ['invesco'],
  'bandhan':  ['bandhan'],
  'whiteoak': ['whiteoak', 'white oak'],
  'jm':       ['jm financial', 'jm '],
  'lic':      ['lic'],
  'groww':    ['groww'],
  '360one':   ['360 one'],
  'nj':       ['nj'],
};

// ── Compound Word Expansions — split common MF jargon ──
// Includes standalone category keywords (e.g. "small" → "small cap")
// so "sbi small" becomes words=['sbi','small','cap'] matching "sbi small cap fund"
const COMPOUND_SPLITS: Record<string, string> = {
  // Standalone category keywords → full category name
  'small':     'small cap',
  'mid':       'mid cap',
  'large':     'large cap',
  'flexi':     'flexi cap',
  'multi':     'multi cap',
  'micro':     'micro cap',
  'blue':      'blue chip',
  // Compound words (no space)
  'smallcap':  'small cap',
  'midcap':    'mid cap',
  'largecap':  'large cap',
  'multicap':  'multi cap',
  'flexicap':  'flexi cap',
  'microcap':  'micro cap',
  'bluechip':  'blue chip',
  'largenmidcap': 'large and mid cap',
  'elss':      'elss',
  'nifty50':   'nifty 50',
  'sensex30':  'sensex 30',
  'nifty100':  'nifty 100',
  'nifty500':  'nifty 500',
  'nifty250':  'nifty 250',
  'next50':    'next 50',
  'midcap150': 'midcap 150',
  'smallcap250': 'smallcap 250',
};

// ── Query Normalizer — expand aliases, split compounds, lowercase ──
function normalizeQuery(raw: string): { words: string[]; collapsed: string; expanded: string[] } {
  const lower = raw.trim().toLowerCase();
  const tokens = lower.split(/\s+/).filter(w => w.length > 0);

  // Expand compounds: "smallcap" → "small cap"
  const expandedTokens: string[] = [];
  for (const t of tokens) {
    if (COMPOUND_SPLITS[t]) {
      expandedTokens.push(...COMPOUND_SPLITS[t].split(' '));
    } else {
      // Split numbers from letters: "nifty50" → "nifty", "50"
      const numSplit = t.match(/^([a-z]+)(\d+)$/);
      if (numSplit) {
        const key = numSplit[1] + numSplit[2];
        if (COMPOUND_SPLITS[key]) {
          expandedTokens.push(...COMPOUND_SPLITS[key].split(' '));
        } else {
          expandedTokens.push(numSplit[1], numSplit[2]);
        }
      } else {
        expandedTokens.push(t);
      }
    }
  }

  // Expand AMC aliases: "absl" → also search "aditya birla"
  const aliasExpansions: string[] = [];
  for (const t of expandedTokens) {
    if (AMC_ALIASES[t]) {
      for (const alias of AMC_ALIASES[t]) {
        aliasExpansions.push(alias);
      }
    }
  }

  return {
    words: expandedTokens,
    collapsed: expandedTokens.join(''),
    expanded: aliasExpansions,
  };
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
    const plan        = sp.get('plan') || '';
    const sort        = sp.get('sort') || '';
    const page        = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize    = Math.min(50, parseInt(sp.get('pageSize') || '10'));

    const useMV = await checkMatView();

    // Empty query → smart defaults: top performers by 3Y CAGR
    if (!query && !amc && !category && !subCategory) {
      if (useMV) {
        return await searchUnified('', '', '', '', 1, pageSize, true, false, plan, sort);
      }
      const stats = await pool.query('SELECT COUNT(*) FROM funds');
      return NextResponse.json({
        success: true, funds: [], total: parseInt(stats.rows[0].count),
        page: 1, pageSize, totalPages: 0, message: 'Apply filters to search funds'
      });
    }

    if (useMV) {
      return await searchUnified(query, amc, category, subCategory, page, pageSize, false, false, plan, sort);
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
//  With progressive relaxation: strict → collapsed → trigram → drop word
// ════════════════════════════════════════════════════════════════════

async function searchUnified(
  query: string, amc: string, category: string, subCategory: string,
  page: number, pageSize: number, topPerformers = false, randomize = false, plan = '', sort = ''
) {
  // ── Build WHERE clause ──
  let where = 'WHERE 1=1';
  const params: any[] = [];
  let p = 1;

  // Note: mv_unified_search groups by master_fund_id (strategy family).
  // plan_type column does not exist in the MV. Plan filtering is done client-side
  // by the web app's variant toggle. Mobile app receives all plans and filters locally.

  if (query) {
    const { words } = normalizeQuery(query);

    // Text search: each word must appear in ANY of the key text columns.
    // search_text is the pre-aggregated, lowercased, trigram-indexed column (migration 004).
    // Fallback columns ensure results even if search_text is sparse.
    const wordConds = words.map(word => {
      const idx = p;
      params.push(`%${word}%`);
      p++;
      return `(search_text ILIKE $${idx} OR strategy_name ILIKE $${idx} OR canonical_scheme_name ILIKE $${idx} OR fund_house ILIKE $${idx})`;
    });

    if (wordConds.length > 0) {
      where += ` AND (${wordConds.join(' AND ')})`;
    }
  }

  if (amc) {
    const { expanded: amcExpanded } = normalizeQuery(amc);
    if (amcExpanded.length > 0) {
      const amcConds = amcExpanded.map(a => {
        params.push(`%${a}%`);
        return `fund_house ILIKE $${p++}`;
      });
      params.push(`%${amc}%`);
      amcConds.push(`fund_house ILIKE $${p++}`);
      where += ` AND (${amcConds.join(' OR ')})`;
    } else {
      where += ` AND fund_house ILIKE $${p}`;
      params.push(`%${amc}%`);
      p++;
    }
  }

  if (subCategory) {
    where += ` AND sub_category ILIKE $${p}`;
    params.push(`%${subCategory}%`);
    p++;
  } else if (category) {
    // "Equity" is a parent category — its sub_categories are Large Cap, Mid Cap, etc.
    // Map parent categories to their constituent sub_categories for proper matching.
    const EQUITY_SUBCATEGORIES = ['Large Cap', 'Mid Cap', 'Small Cap', 'Flexi Cap', 'ELSS'];
    if (category.toLowerCase() === 'equity') {
      const subcatConds = EQUITY_SUBCATEGORIES.map(sc => {
        params.push(sc);
        return `sub_category = $${p++}`;
      });
      // Also match category ILIKE '%Equity%' (from scheme_type) and funds with NULL sub_category
      // that are clearly equity (not debt/hybrid/index/liquid)
      params.push(`%${category}%`);
      const catIdx = p++;
      where += ` AND (${subcatConds.join(' OR ')} OR category ILIKE $${catIdx})`;
    } else {
      where += ` AND (category ILIKE $${p} OR sub_category ILIKE $${p})`;
      params.push(`%${category}%`);
      p++;
    }
  }

  // Only show families with CAGR data for top performers
  if (topPerformers) {
    where += ' AND cagr_3y IS NOT NULL';
  }

  // ── Count ──
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM mv_unified_search ${where}`, params
  );
  let total = parseInt(countRes.rows[0].count);

  // ── Progressive relaxation: if 0 results and we have a query, try trigram similarity ──
  let usedTrigram = false;
  if (total === 0 && query && query.trim().length >= 3) {
    const { words } = normalizeQuery(query);
    const trigramQuery = words.join(' ');
    // Reset for trigram search
    const trigramParams: any[] = [trigramQuery, 0.15, pageSize];
    const trigramResult = await pool.query(
      `SELECT
        master_fund_id AS "masterFundId", strategy_name AS "strategyName",
        fund_house AS "fundHouse", category, sub_category AS "subCategory",
        variant_count AS "variantCount",
        canonical_scheme_code AS "schemeCode", canonical_scheme_name AS "schemeName",
        canonical_nav AS "latestNav", canonical_nav_date AS "latestNavDate",
        return_1y AS "return1y", cagr_3y AS "cagr3y", cagr_5y AS "cagr5y",
        cagr_3y_min AS "cagr3yMin", cagr_3y_max AS "cagr3yMax",
        cagr_5y_min AS "cagr5yMin", cagr_5y_max AS "cagr5yMax",
        sharpe_ratio AS "sharpeRatio", variants,
        similarity(search_text, $1) AS sim
      FROM mv_unified_search
      WHERE similarity(search_text, $1) > $2
      ORDER BY sim DESC
      LIMIT $3`,
      trigramParams
    );

    if (trigramResult.rows.length > 0) {
      usedTrigram = true;
      return NextResponse.json({
        success: true,
        funds: trigramResult.rows.map(formatRow),
        total: trigramResult.rows.length,
        page: 1, pageSize, totalPages: 1,
        query: query, engine: 'unified', hint: 'trigram_fuzzy',
        suggestion: `Showing approximate matches for "${query}"`
      });
    }

    // Levenshtein distance fallback (handles typos: "HFDC" → "HDFC", "Focussed" → "Focused")
    // Requires fuzzystrmatch extension (CREATE EXTENSION IF NOT EXISTS fuzzystrmatch)
    const levenshteinResult = await pool.query(
      `SELECT
        master_fund_id AS "masterFundId", strategy_name AS "strategyName",
        fund_house AS "fundHouse", category, sub_category AS "subCategory",
        variant_count AS "variantCount",
        canonical_scheme_code AS "schemeCode", canonical_scheme_name AS "schemeName",
        canonical_nav AS "latestNav", canonical_nav_date AS "latestNavDate",
        return_1y AS "return1y", cagr_3y AS "cagr3y", cagr_5y AS "cagr5y",
        cagr_3y_min AS "cagr3yMin", cagr_3y_max AS "cagr3yMax",
        cagr_5y_min AS "cagr5yMin", cagr_5y_max AS "cagr5yMax",
        sharpe_ratio AS "sharpeRatio", variants,
        levenshtein(LOWER(LEFT(strategy_name, 50)), LOWER(LEFT($1, 50))) AS edit_dist
      FROM mv_unified_search
      WHERE levenshtein(LOWER(LEFT(strategy_name, 50)), LOWER(LEFT($1, 50))) <= 5
      ORDER BY edit_dist ASC, cagr_3y DESC NULLS LAST
      LIMIT $2`,
      [trigramQuery, pageSize]
    );

    if (levenshteinResult.rows.length > 0) {
      return NextResponse.json({
        success: true,
        funds: levenshteinResult.rows.map(formatRow),
        total: levenshteinResult.rows.length,
        page: 1, pageSize, totalPages: 1,
        query: query, engine: 'unified', hint: 'levenshtein_fuzzy',
        suggestion: `Showing closest matches for "${query}"`
      });
    }

    // Last resort: drop last word and retry (e.g. "sbi small cap fund" → "sbi small cap")
    if (words.length > 1) {
      const shorter = words.slice(0, -1).join(' ');
      return await searchUnified(shorter, amc, category, subCategory, page, pageSize);
    }
  }

  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;

  // ── Sort parameter (TBD-7) ──
  const sortParam = sort;
  const SORT_MAP: Record<string, string> = {
    'return_1y': 'cagr_1y DESC NULLS LAST',
    'return_3y': 'cagr_3y DESC NULLS LAST',
    'return_5y': 'cagr_5y DESC NULLS LAST',
    'sharpe': 'sharpe_ratio_1y DESC NULLS LAST',
    'expense': 'expense_ratio ASC NULLS LAST',
    'aum': 'aum DESC NULLS LAST',
    'name': 'scheme_name ASC',
  };

  let orderBy: string;
  const dataParams = [...params];
  if (randomize) {
    orderBy = 'ORDER BY RANDOM()';
  } else if (sortParam && SORT_MAP[sortParam]) {
    orderBy = `ORDER BY ${SORT_MAP[sortParam]}`;
  } else if (query && !topPerformers) {
    orderBy = 'ORDER BY cagr_3y DESC NULLS LAST';
  } else {
    orderBy = 'ORDER BY cagr_3y DESC NULLS LAST';
  }
  dataParams.push(pageSize, offset);

  // ── Paginated results ──
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
    ${orderBy}
    LIMIT $${p}::int OFFSET $${p + 1}::int`,
    dataParams
  );

  return cachedJson({
    success: true,
    funds: result.rows.map(formatRow),
    total,
    page,
    pageSize,
    totalPages,
    query: query || amc || category || subCategory,
    engine: 'unified',
    ...(randomize ? { hint: 'random_discovery' } : {}),
  }, CACHE_TTL.FUND_LIST);
}

// ── Format a matview row for the API response ──
function formatRow(row: any) {
  const variants = row.variants || [];
  const fallbackCode = variants.length > 0 ? variants[0].schemeCode : null;
  const schemeCode = row.schemeCode || fallbackCode || '';
  const schemeName = row.schemeName || row.strategyName || '';
  return {
    ...row,
    schemeCode,
    schemeName,
    latestNav: row.latestNav ? parseFloat(row.latestNav) : null,
    return1y: row.return1y ? parseFloat(row.return1y) : null,
    cagr3y: row.cagr3y ? parseFloat(row.cagr3y) : null,
    cagr5y: row.cagr5y ? parseFloat(row.cagr5y) : null,
    cagr3yMin: row.cagr3yMin ? parseFloat(row.cagr3yMin) : null,
    cagr3yMax: row.cagr3yMax ? parseFloat(row.cagr3yMax) : null,
    cagr5yMin: row.cagr5yMin ? parseFloat(row.cagr5yMin) : null,
    cagr5yMax: row.cagr5yMax ? parseFloat(row.cagr5yMax) : null,
    sharpeRatio: row.sharpeRatio ? parseFloat(row.sharpeRatio) : null,
    variants,
  };
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

  // Relevance-weighted ORDER BY for legacy search
  let orderBy: string;
  const dataParams = [...params];
  if (query) {
    const phrase = query.trim().toLowerCase();
    dataParams.push(phrase + '%', '%' + phrase + '%');
    const prefixIdx = p++;
    const containsIdx = p++;
    orderBy = `ORDER BY
      CASE WHEN LOWER(f.scheme_name) LIKE $${containsIdx} THEN
        CASE WHEN LOWER(f.scheme_name) LIKE $${prefixIdx} THEN 0 ELSE 1 END
        ELSE 2 END,
      LENGTH(f.scheme_name) ASC,
      r.cagr_3y DESC NULLS LAST`;
  } else {
    orderBy = 'ORDER BY r.cagr_3y DESC NULLS LAST';
  }
  dataParams.push(pageSize, offset);

  const result = await pool.query(
    `SELECT
      f.scheme_code AS "schemeCode", f.scheme_name AS "schemeName",
      f.latest_nav AS nav, f.latest_nav_date AS date,
      f.amc_code AS "amcCode", f.scheme_type AS "schemeType",
      r.return_1y AS "return1y", r.cagr_3y AS "cagr3y", r.cagr_5y AS "cagr5y"
    FROM funds f
    LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code
    ${where}
    ${orderBy}
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

    // "Fresh Discovery" mode: category provided but no query → return 6 random funds
    const isDiscoveryMode = !query && !amc && category && !subCategory;
    const discoveryLimit = isDiscoveryMode ? 6 : Math.min(limit, 200);

    if (useMV) {
      return await searchUnified(query, amc, category, subCategory, 1, discoveryLimit, false, isDiscoveryMode, plan);
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
