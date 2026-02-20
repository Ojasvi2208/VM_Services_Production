-- Migration 004: AMFI-Direct Time-Series Engine
-- Restructures nav_history for O(log N) time-series queries and adds DB-side metric functions.
--
-- SAFETY: All changes are additive. Existing nav_history is renamed (not dropped).
--         Existing tables (funds, fund_returns, market_cache) are untouched.
--
-- Run with: psql $DATABASE_URL -f migrations/004_time_series_engine.sql

BEGIN;

-- ============================================================
-- PHASE 1: Create optimized nav_history table
-- ============================================================

-- New table: composite PK (scheme_code, nav_date) for O(log N) B+ Tree lookups.
-- Removes wasteful SERIAL PK, denormalized columns (scheme_name, amc_code, etc.),
-- and unused timestamp column. Row size: ~30 bytes (down from ~350 bytes).

-- Rename old table if it exists (preserve for rollback)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nav_history' AND table_schema = 'public') THEN
    -- Check if it has the old schema (SERIAL id column = legacy)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nav_history' AND column_name = 'id') THEN
      ALTER TABLE nav_history RENAME TO nav_history_legacy;
    END IF;
  END IF;
END $$;

-- Create the optimized table (idempotent)
CREATE TABLE IF NOT EXISTS nav_history (
  scheme_code VARCHAR(20) NOT NULL,
  nav_date    DATE        NOT NULL,
  nav_value   NUMERIC(15, 4) NOT NULL,
  source      CHAR(1)     DEFAULT 'A',  -- 'A' = AMFI daily, 'B' = bootstrap, 'M' = mfapi backfill
  PRIMARY KEY (scheme_code, nav_date)
);

-- Migrate data from legacy table if it exists and has rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nav_history_legacy' AND table_schema = 'public') THEN
    INSERT INTO nav_history (scheme_code, nav_date, nav_value, source)
    SELECT DISTINCT ON (scheme_code, nav_date)
      scheme_code, nav_date, nav_value, 'M'
    FROM nav_history_legacy
    WHERE scheme_code IS NOT NULL
      AND nav_date IS NOT NULL
      AND nav_value IS NOT NULL
      AND nav_value > 0
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Migrated data from nav_history_legacy';
  END IF;
END $$;

-- Supporting index for date-only queries (e.g., "all NAVs for a given date")
CREATE INDEX IF NOT EXISTS idx_nav_date_only ON nav_history (nav_date DESC);

-- The PK (scheme_code, nav_date) already serves as the primary B+ Tree for:
--   WHERE scheme_code = $1 AND nav_date <= $2 ORDER BY nav_date DESC LIMIT 1  → O(log N)
--   WHERE scheme_code = $1 AND nav_date BETWEEN $2 AND $3                      → O(log N + K)

-- FK to funds table (deferred — allows bootstrap to insert before funds exist)
-- ALTER TABLE nav_history ADD CONSTRAINT fk_nav_scheme
--   FOREIGN KEY (scheme_code) REFERENCES funds(scheme_code) ON DELETE CASCADE;
-- Note: FK intentionally omitted. nav_history may contain scheme_codes from AMFI
-- that don't exist in funds yet (closed/merged funds). The bootstrap must be
-- lossless — we never discard NAV data.

-- ============================================================
-- PHASE 1b: Prerequisite functions (from migration 001, may not exist)
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_absolute_return(
  current_nav DECIMAL,
  past_nav DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF past_nav IS NULL OR past_nav = 0 THEN RETURN NULL; END IF;
  RETURN ((current_nav - past_nav) / past_nav) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_cagr(
  current_nav DECIMAL,
  past_nav DECIMAL,
  years DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF past_nav IS NULL OR past_nav = 0 OR years IS NULL OR years = 0 THEN RETURN NULL; END IF;
  RETURN (POWER(current_nav / past_nav, 1.0 / years) - 1) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- PHASE 1c: Ensure benchmark_data table exists
-- ============================================================

CREATE TABLE IF NOT EXISTS benchmark_data (
  id SERIAL PRIMARY KEY,
  benchmark_name VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  value NUMERIC(12, 4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(benchmark_name, date)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_data_name_date ON benchmark_data(benchmark_name, date DESC);

-- ============================================================
-- PHASE 2: DB-side metric functions
-- ============================================================

-- Annualized volatility from daily log-returns
-- Uses LN(NAV_t / NAV_{t-1}) for continuous compounding accuracy
CREATE OR REPLACE FUNCTION calc_volatility(
  p_scheme_code VARCHAR,
  p_start DATE,
  p_end DATE
) RETURNS NUMERIC AS $$
  SELECT ROUND((STDDEV(ln_return) * SQRT(252) * 100)::NUMERIC, 4)
  FROM (
    SELECT LN(nav_value / LAG(nav_value) OVER (ORDER BY nav_date)) AS ln_return
    FROM nav_history
    WHERE scheme_code = p_scheme_code
      AND nav_date BETWEEN p_start AND p_end
  ) sub
  WHERE ln_return IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- Beta: COVAR(fund, benchmark) / VAR(benchmark)
CREATE OR REPLACE FUNCTION calc_beta(
  p_scheme_code VARCHAR,
  p_benchmark   VARCHAR,
  p_start DATE,
  p_end DATE
) RETURNS NUMERIC AS $$
  WITH fund_rets AS (
    SELECT nav_date,
           LN(nav_value / LAG(nav_value) OVER (ORDER BY nav_date)) AS ret
    FROM nav_history
    WHERE scheme_code = p_scheme_code
      AND nav_date BETWEEN p_start AND p_end
  ),
  bench_rets AS (
    SELECT date,
           LN(value / LAG(value) OVER (ORDER BY date)) AS ret
    FROM benchmark_data
    WHERE benchmark_name = p_benchmark
      AND date BETWEEN p_start AND p_end
  ),
  joined AS (
    SELECT f.ret AS fund_ret, b.ret AS bench_ret
    FROM fund_rets f
    JOIN bench_rets b ON f.nav_date = b.date
    WHERE f.ret IS NOT NULL AND b.ret IS NOT NULL
  )
  SELECT ROUND(
    (COVAR_POP(fund_ret, bench_ret) / NULLIF(VAR_POP(bench_ret), 0))::NUMERIC,
    4
  )
  FROM joined;
$$ LANGUAGE SQL STABLE;

-- Jensen's Alpha = fund_return - [risk_free + beta * (benchmark_return - risk_free)]
CREATE OR REPLACE FUNCTION calc_alpha(
  p_scheme_code VARCHAR,
  p_benchmark   VARCHAR,
  p_start DATE,
  p_end DATE,
  p_risk_free   NUMERIC DEFAULT 6.5  -- India 10yr govt bond yield
) RETURNS NUMERIC AS $$
  WITH endpoints AS (
    SELECT
      calc_beta(p_scheme_code, p_benchmark, p_start, p_end) AS beta,
      calculate_cagr(
        (SELECT nav_value FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= p_end ORDER BY nav_date DESC LIMIT 1),
        (SELECT nav_value FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date >= p_start ORDER BY nav_date ASC LIMIT 1),
        EXTRACT(YEAR FROM AGE(p_end, p_start))
      ) AS fund_cagr,
      calculate_cagr(
        (SELECT value FROM benchmark_data WHERE benchmark_name = p_benchmark AND date <= p_end ORDER BY date DESC LIMIT 1),
        (SELECT value FROM benchmark_data WHERE benchmark_name = p_benchmark AND date >= p_start ORDER BY date ASC LIMIT 1),
        EXTRACT(YEAR FROM AGE(p_end, p_start))
      ) AS bench_cagr
  )
  SELECT ROUND(
    (fund_cagr - (p_risk_free + beta * (bench_cagr - p_risk_free)))::NUMERIC,
    4
  )
  FROM endpoints
  WHERE beta IS NOT NULL AND fund_cagr IS NOT NULL AND bench_cagr IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- Tracking Error = annualized STDDEV of excess returns (fund - benchmark)
CREATE OR REPLACE FUNCTION calc_tracking_error(
  p_scheme_code VARCHAR,
  p_benchmark   VARCHAR,
  p_start DATE,
  p_end DATE
) RETURNS NUMERIC AS $$
  WITH fund_rets AS (
    SELECT nav_date,
           LN(nav_value / LAG(nav_value) OVER (ORDER BY nav_date)) AS ret
    FROM nav_history
    WHERE scheme_code = p_scheme_code
      AND nav_date BETWEEN p_start AND p_end
  ),
  bench_rets AS (
    SELECT date,
           LN(value / LAG(value) OVER (ORDER BY date)) AS ret
    FROM benchmark_data
    WHERE benchmark_name = p_benchmark
      AND date BETWEEN p_start AND p_end
  ),
  excess AS (
    SELECT f.ret - b.ret AS diff
    FROM fund_rets f
    JOIN bench_rets b ON f.nav_date = b.date
    WHERE f.ret IS NOT NULL AND b.ret IS NOT NULL
  )
  SELECT ROUND((STDDEV(diff) * SQRT(252) * 100)::NUMERIC, 4)
  FROM excess;
$$ LANGUAGE SQL STABLE;

-- Information Ratio = mean(excess return) / tracking_error
CREATE OR REPLACE FUNCTION calc_information_ratio(
  p_scheme_code VARCHAR,
  p_benchmark   VARCHAR,
  p_start DATE,
  p_end DATE
) RETURNS NUMERIC AS $$
  WITH fund_rets AS (
    SELECT nav_date,
           LN(nav_value / LAG(nav_value) OVER (ORDER BY nav_date)) AS ret
    FROM nav_history
    WHERE scheme_code = p_scheme_code
      AND nav_date BETWEEN p_start AND p_end
  ),
  bench_rets AS (
    SELECT date,
           LN(value / LAG(value) OVER (ORDER BY date)) AS ret
    FROM benchmark_data
    WHERE benchmark_name = p_benchmark
      AND date BETWEEN p_start AND p_end
  ),
  excess AS (
    SELECT f.ret - b.ret AS diff
    FROM fund_rets f
    JOIN bench_rets b ON f.nav_date = b.date
    WHERE f.ret IS NOT NULL AND b.ret IS NOT NULL
  )
  SELECT ROUND(
    ((AVG(diff) * 252) / NULLIF(STDDEV(diff) * SQRT(252), 0))::NUMERIC,
    4
  )
  FROM excess;
$$ LANGUAGE SQL STABLE;

-- Max Drawdown over a period
CREATE OR REPLACE FUNCTION calc_max_drawdown(
  p_scheme_code VARCHAR,
  p_start DATE,
  p_end DATE
) RETURNS NUMERIC AS $$
  WITH navs AS (
    SELECT nav_date, nav_value,
           MAX(nav_value) OVER (ORDER BY nav_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS peak
    FROM nav_history
    WHERE scheme_code = p_scheme_code
      AND nav_date BETWEEN p_start AND p_end
  )
  SELECT ROUND((MIN((nav_value - peak) / NULLIF(peak, 0)) * 100)::NUMERIC, 4)
  FROM navs;
$$ LANGUAGE SQL STABLE;

-- Sortino Ratio: (return - risk_free) / downside_deviation
CREATE OR REPLACE FUNCTION calc_sortino(
  p_scheme_code VARCHAR,
  p_start DATE,
  p_end DATE,
  p_risk_free NUMERIC DEFAULT 6.5
) RETURNS NUMERIC AS $$
  WITH daily_rets AS (
    SELECT LN(nav_value / LAG(nav_value) OVER (ORDER BY nav_date)) AS ret
    FROM nav_history
    WHERE scheme_code = p_scheme_code
      AND nav_date BETWEEN p_start AND p_end
  ),
  stats AS (
    SELECT
      AVG(ret) * 252 * 100 AS ann_return,
      SQRT(AVG(CASE WHEN ret < 0 THEN ret * ret ELSE 0 END) * 252) * 100 AS downside_dev
    FROM daily_rets
    WHERE ret IS NOT NULL
  )
  SELECT ROUND(
    ((ann_return - p_risk_free) / NULLIF(downside_dev, 0))::NUMERIC,
    4
  )
  FROM stats;
$$ LANGUAGE SQL STABLE;

COMMIT;

-- ============================================================
-- POST-MIGRATION NOTES
-- ============================================================
-- 1. After running this migration, the old nav_history is preserved as nav_history_legacy.
--    Drop it after verifying the bootstrap: DROP TABLE IF EXISTS nav_history_legacy;
--
-- 2. The FK constraint on nav_history.scheme_code → funds.scheme_code is intentionally
--    omitted. AMFI history includes closed/merged funds that may not exist in our funds
--    table. We never discard NAV data — correctness over referential purity.
--
-- 3. The metric functions (calc_volatility, calc_beta, etc.) depend on:
--    - nav_history being populated (run bootstrap first)
--    - benchmark_data having NIFTY 50 daily close values (for beta/alpha/tracking error)
--    - The existing calculate_cagr() function from migration 001
