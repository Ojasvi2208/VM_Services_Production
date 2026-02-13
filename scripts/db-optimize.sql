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
