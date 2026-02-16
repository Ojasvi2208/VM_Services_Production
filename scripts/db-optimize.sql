-- ═══════════════════════════════════════════════════════════════
-- Fund Metrics DB Optimization
-- B-Tree Indexes + Materialized View for O(k) ranking retrieval
-- Run once, then REFRESH MATERIALIZED VIEW after each metrics update
-- ═══════════════════════════════════════════════════════════════

-- ── B-Tree Indexes for sub-millisecond retrieval ──

-- Primary lookup index (already exists as PK, but ensure fund_returns has it)
CREATE INDEX IF NOT EXISTS idx_fund_returns_scheme ON fund_returns(scheme_code);
CREATE INDEX IF NOT EXISTS idx_fund_returns_updated ON fund_returns(updated_at);

-- Partial index for ranking queries (only direct growth funds with valid returns)
CREATE INDEX IF NOT EXISTS idx_fund_returns_1y_rank
  ON fund_returns(return_1y DESC NULLS LAST)
  WHERE return_1y IS NOT NULL AND return_1y > 0 AND return_1y < 100;

-- Composite index for Sharpe-weighted ranking
CREATE INDEX IF NOT EXISTS idx_fund_returns_sharpe_rank
  ON fund_returns(sharpe_ratio_1y DESC NULLS LAST)
  WHERE sharpe_ratio_1y IS NOT NULL;

-- Index on funds table for fast join
CREATE INDEX IF NOT EXISTS idx_funds_updated ON funds(updated_at);
CREATE INDEX IF NOT EXISTS idx_funds_nav_date ON funds(latest_nav_date DESC);

-- Composite index for the WHERE clause in ranking query
CREATE INDEX IF NOT EXISTS idx_funds_direct_growth
  ON funds(scheme_code)
  WHERE scheme_name LIKE '%Direct%' AND scheme_name LIKE '%Growth%'
    AND latest_nav IS NOT NULL AND latest_nav > 5;

-- ── Materialized View: Top Funds with Weighted Ranking ──
-- Weighted Score = 0.6 * normalized_return_1y + 0.4 * normalized_sharpe_ratio
-- This ensures we show "Quality" funds, not just "Lucky" funds

DROP MATERIALIZED VIEW IF EXISTS mv_top_funds;

CREATE MATERIALIZED VIEW mv_top_funds AS
WITH ranked_funds AS (
  SELECT
    f.scheme_code,
    f.scheme_name,
    f.latest_nav,
    f.latest_nav_date,
    f.amc_code,
    fr.return_1y,
    fr.return_3y,
    fr.return_5y,
    fr.sharpe_ratio_1y,
    fr.volatility_1y,
    fr.sortino_ratio_1y,
    fr.rolling_return_1y_avg,
    fr.cagr_3y,
    fr.cagr_5y,
    fr.updated_at AS metrics_updated_at,
    -- Normalize return_1y to 0-1 scale (min-max within the result set)
    CASE WHEN MAX(fr.return_1y) OVER () - MIN(fr.return_1y) OVER () > 0
      THEN (fr.return_1y - MIN(fr.return_1y) OVER ()) / (MAX(fr.return_1y) OVER () - MIN(fr.return_1y) OVER ())
      ELSE 0.5
    END AS norm_return,
    -- Normalize sharpe_ratio to 0-1 scale
    CASE WHEN MAX(fr.sharpe_ratio_1y) OVER () - MIN(fr.sharpe_ratio_1y) OVER () > 0
      THEN (fr.sharpe_ratio_1y - MIN(fr.sharpe_ratio_1y) OVER ()) / (MAX(fr.sharpe_ratio_1y) OVER () - MIN(fr.sharpe_ratio_1y) OVER ())
      ELSE 0.5
    END AS norm_sharpe
  FROM funds f
  INNER JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
  WHERE f.scheme_name LIKE '%Direct%'
    AND f.scheme_name LIKE '%Growth%'
    AND f.latest_nav IS NOT NULL
    AND f.latest_nav > 5
    AND fr.return_1y IS NOT NULL
    AND fr.return_1y > 0
    AND fr.return_1y < 100
    AND fr.sharpe_ratio_1y IS NOT NULL
    -- Exclude junk/international/closed/ETF
    AND f.scheme_name NOT ILIKE '%segregated%'
    AND f.scheme_name NOT ILIKE '%wind up%'
    AND f.scheme_name NOT ILIKE '%interval%'
    AND f.scheme_name NOT ILIKE '%fixed maturity%'
    AND f.scheme_name NOT ILIKE '%FMP%'
    AND f.scheme_name NOT ILIKE '%close ended%'
    AND f.scheme_name NOT ILIKE '%ETF%'
    AND f.scheme_name NOT ILIKE '%Fund of Fund%'
    AND f.scheme_name NOT ILIKE '%FOF%'
    AND f.scheme_name NOT ILIKE '%Gold%'
    AND f.scheme_name NOT ILIKE '%Silver%'
    AND f.scheme_name NOT ILIKE '%Index%'
    AND f.scheme_name NOT ILIKE '%Nifty%'
    AND f.scheme_name NOT ILIKE '%Sensex%'
    AND f.scheme_name NOT ILIKE '%International%'
    AND f.scheme_name NOT ILIKE '%Global%'
    AND f.scheme_name NOT ILIKE '%Overseas%'
    AND f.scheme_name NOT ILIKE '%Series%'
)
SELECT
  scheme_code,
  scheme_name,
  latest_nav,
  latest_nav_date,
  amc_code,
  return_1y,
  return_3y,
  return_5y,
  sharpe_ratio_1y,
  volatility_1y,
  sortino_ratio_1y,
  rolling_return_1y_avg,
  cagr_3y,
  cagr_5y,
  metrics_updated_at,
  -- Weighted quality score: 60% returns + 40% risk-adjusted
  ROUND((0.6 * COALESCE(norm_return, 0) + 0.4 * COALESCE(norm_sharpe, 0))::numeric, 4) AS quality_score,
  -- Rank by quality score
  ROW_NUMBER() OVER (ORDER BY (0.6 * COALESCE(norm_return, 0) + 0.4 * COALESCE(norm_sharpe, 0)) DESC) AS quality_rank
FROM ranked_funds
ORDER BY quality_score DESC
LIMIT 50;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_funds_scheme ON mv_top_funds(scheme_code);
CREATE INDEX IF NOT EXISTS idx_mv_top_funds_rank ON mv_top_funds(quality_rank);

-- ═══════════════════════════════════════════════════════════════
-- To refresh after each metrics update:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_funds;
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
--  MATERIALIZED VIEW: mv_unified_search
--  Purpose: One row per fund family (master_fund) with aggregated metrics.
--           Search API queries THIS instead of funds + fund_returns JOIN.
--
--  Performance: ~4,000 rows (vs 37,000+ in funds). GIN trigram index
--               enables sub-50ms ILIKE searches. Pre-computed CAGR ranges
--               eliminate runtime aggregation.
--
--  Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search;
--           (after daily NAV sync + returns recalculation)
-- ═══════════════════════════════════════════════════════════════════════

-- Ensure pg_trgm extension for GIN trigram index
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP MATERIALIZED VIEW IF EXISTS mv_unified_search;

CREATE MATERIALIZED VIEW mv_unified_search AS
SELECT
  mf.id                                     AS master_fund_id,
  mf.strategy_name,
  mf.fund_house,
  mf.category,
  mf.sub_category,
  mf.variant_count,

  -- Canonical variant: Direct + Growth (the "hero" row for display)
  canonical.scheme_code                     AS canonical_scheme_code,
  canonical.scheme_name                     AS canonical_scheme_name,
  canonical.latest_nav                      AS canonical_nav,
  canonical.latest_nav_date                 AS canonical_nav_date,

  -- Aggregated CAGR ranges across all variants
  ROUND(MIN(fr.cagr_3y)::numeric, 2)       AS cagr_3y_min,
  ROUND(MAX(fr.cagr_3y)::numeric, 2)       AS cagr_3y_max,
  ROUND(MIN(fr.cagr_5y)::numeric, 2)       AS cagr_5y_min,
  ROUND(MAX(fr.cagr_5y)::numeric, 2)       AS cagr_5y_max,

  -- Best Direct Plan returns (for hero display)
  ROUND(canonical_r.return_1y::numeric, 2)  AS return_1y,
  ROUND(canonical_r.cagr_3y::numeric, 2)   AS cagr_3y,
  ROUND(canonical_r.cagr_5y::numeric, 2)   AS cagr_5y,
  ROUND(canonical_r.sharpe_ratio_1y::numeric, 4) AS sharpe_ratio,

  -- All variant scheme_codes as JSON array (for detail screen variant switching)
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'schemeCode', f.scheme_code,
      'planType', f.plan_type,
      'optionType', f.option_type,
      'nav', f.latest_nav,
      'cagr3y', fr.cagr_3y,
      'cagr5y', fr.cagr_5y
    ) ORDER BY
      CASE WHEN f.plan_type = 'Direct' THEN 0 ELSE 1 END,
      CASE WHEN f.option_type = 'Growth' THEN 0 ELSE 1 END
  )                                         AS variants,

  -- Searchable text: strategy name + fund house (for trigram matching)
  LOWER(mf.strategy_name || ' ' || COALESCE(mf.fund_house, '')) AS search_text

FROM master_funds mf
-- All child variants
JOIN funds f ON f.master_fund_id = mf.id
LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
-- Canonical variant: prefer Direct + Growth
LEFT JOIN LATERAL (
  SELECT fc.scheme_code, fc.scheme_name, fc.latest_nav, fc.latest_nav_date
  FROM funds fc
  WHERE fc.master_fund_id = mf.id
    AND fc.plan_type = 'Direct'
    AND fc.option_type = 'Growth'
  ORDER BY fc.latest_nav DESC NULLS LAST
  LIMIT 1
) canonical ON TRUE
LEFT JOIN fund_returns canonical_r ON canonical.scheme_code = canonical_r.scheme_code
WHERE mf.variant_count > 0
GROUP BY
  mf.id, mf.strategy_name, mf.fund_house, mf.category, mf.sub_category, mf.variant_count,
  canonical.scheme_code, canonical.scheme_name, canonical.latest_nav, canonical.latest_nav_date,
  canonical_r.return_1y, canonical_r.cagr_3y, canonical_r.cagr_5y, canonical_r.sharpe_ratio_1y;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_unified_search_id ON mv_unified_search(master_fund_id);

-- GIN trigram index for sub-50ms ILIKE/similarity searches
CREATE INDEX IF NOT EXISTS idx_mv_unified_search_trgm ON mv_unified_search USING GIN (search_text gin_trgm_ops);

-- B-Tree indexes for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_mv_unified_search_cagr3y ON mv_unified_search(cagr_3y DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_mv_unified_search_cagr5y ON mv_unified_search(cagr_5y DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_mv_unified_search_house ON mv_unified_search(fund_house);
CREATE INDEX IF NOT EXISTS idx_mv_unified_search_category ON mv_unified_search(sub_category);

-- ═══════════════════════════════════════════════════════════════
-- To refresh after each metrics update:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_funds;
-- ═══════════════════════════════════════════════════════════════
