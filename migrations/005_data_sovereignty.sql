-- Migration 005: Data Sovereignty — Zero External Dependencies
-- Adds: calc_all_returns(), calc_sharpe(), calc_rolling_returns(), downsample_nav_history()
-- Adds missing columns to fund_returns for full metric coverage.
--
-- Run with: psql $DATABASE_URL -f migrations/005_data_sovereignty.sql

BEGIN;

-- ============================================================
-- PHASE 1: Add missing columns to fund_returns (idempotent)
-- ============================================================

DO $$
BEGIN
  -- return_since_inception
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fund_returns' AND column_name='return_since_inception') THEN
    ALTER TABLE fund_returns ADD COLUMN return_since_inception NUMERIC(10,4);
  END IF;
  -- cagr_since_inception
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fund_returns' AND column_name='cagr_since_inception') THEN
    ALTER TABLE fund_returns ADD COLUMN cagr_since_inception NUMERIC(10,4);
  END IF;
  -- cagr_7y (may already exist via ALTER)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fund_returns' AND column_name='cagr_7y') THEN
    ALTER TABLE fund_returns ADD COLUMN cagr_7y NUMERIC(10,4);
  END IF;
  -- return_7y
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fund_returns' AND column_name='return_7y') THEN
    ALTER TABLE fund_returns ADD COLUMN return_7y NUMERIC(10,4);
  END IF;
  -- volatility_3y
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fund_returns' AND column_name='volatility_3y') THEN
    ALTER TABLE fund_returns ADD COLUMN volatility_3y NUMERIC(10,4);
  END IF;
  -- volatility_5y
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fund_returns' AND column_name='volatility_5y') THEN
    ALTER TABLE fund_returns ADD COLUMN volatility_5y NUMERIC(10,4);
  END IF;
END $$;

-- ============================================================
-- PHASE 2: calc_all_returns() — batch returns + CAGR in one call
-- ============================================================
-- For a given scheme_code, fetches latest NAV and NAVs at standard
-- lookback dates using the PK index (scheme_code, nav_date DESC).
-- Returns one row with all return and CAGR columns.

CREATE OR REPLACE FUNCTION calc_all_returns(p_scheme_code VARCHAR)
RETURNS TABLE (
  latest_nav       NUMERIC,
  latest_date      DATE,
  inception_date   DATE,
  fund_age_years   NUMERIC,
  return_1w        NUMERIC,
  return_1m        NUMERIC,
  return_3m        NUMERIC,
  return_6m        NUMERIC,
  return_1y        NUMERIC,
  return_2y        NUMERIC,
  return_3y        NUMERIC,
  return_5y        NUMERIC,
  return_7y        NUMERIC,
  return_10y       NUMERIC,
  return_since_inception NUMERIC,
  cagr_1y          NUMERIC,
  cagr_2y          NUMERIC,
  cagr_3y          NUMERIC,
  cagr_5y          NUMERIC,
  cagr_7y          NUMERIC,
  cagr_10y         NUMERIC,
  cagr_since_inception NUMERIC
) AS $$
DECLARE
  v_latest_nav     NUMERIC;
  v_latest_date    DATE;
  v_inception_date DATE;
  v_age            NUMERIC;
  v_nav_1w         NUMERIC;
  v_nav_1m         NUMERIC;
  v_nav_3m         NUMERIC;
  v_nav_6m         NUMERIC;
  v_nav_1y         NUMERIC;
  v_nav_2y         NUMERIC;
  v_nav_3y         NUMERIC;
  v_nav_5y         NUMERIC;
  v_nav_7y         NUMERIC;
  v_nav_10y        NUMERIC;
  v_nav_inception  NUMERIC;
BEGIN
  -- Get latest NAV (index scan: O(log N))
  SELECT nh.nav_value, nh.nav_date INTO v_latest_nav, v_latest_date
  FROM nav_history nh
  WHERE nh.scheme_code = p_scheme_code
  ORDER BY nh.nav_date DESC LIMIT 1;

  IF v_latest_nav IS NULL THEN RETURN; END IF;

  -- Get inception (earliest NAV date)
  SELECT nh.nav_date INTO v_inception_date
  FROM nav_history nh
  WHERE nh.scheme_code = p_scheme_code
  ORDER BY nh.nav_date ASC LIMIT 1;

  v_age := (v_latest_date - v_inception_date)::NUMERIC / 365.25;

  -- Fetch NAVs at lookback dates (each is an index-only scan)
  SELECT nav_value INTO v_nav_1w FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '7 days' ORDER BY nav_date DESC LIMIT 1;
  SELECT nav_value INTO v_nav_1m FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '1 month' ORDER BY nav_date DESC LIMIT 1;
  SELECT nav_value INTO v_nav_3m FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '3 months' ORDER BY nav_date DESC LIMIT 1;
  SELECT nav_value INTO v_nav_6m FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '6 months' ORDER BY nav_date DESC LIMIT 1;

  IF v_age >= 1 THEN
    SELECT nav_value INTO v_nav_1y FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '1 year' ORDER BY nav_date DESC LIMIT 1;
  END IF;
  IF v_age >= 2 THEN
    SELECT nav_value INTO v_nav_2y FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '2 years' ORDER BY nav_date DESC LIMIT 1;
  END IF;
  IF v_age >= 3 THEN
    SELECT nav_value INTO v_nav_3y FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '3 years' ORDER BY nav_date DESC LIMIT 1;
  END IF;
  IF v_age >= 5 THEN
    SELECT nav_value INTO v_nav_5y FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '5 years' ORDER BY nav_date DESC LIMIT 1;
  END IF;
  IF v_age >= 7 THEN
    SELECT nav_value INTO v_nav_7y FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '7 years' ORDER BY nav_date DESC LIMIT 1;
  END IF;
  IF v_age >= 10 THEN
    SELECT nav_value INTO v_nav_10y FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_latest_date - INTERVAL '10 years' ORDER BY nav_date DESC LIMIT 1;
  END IF;

  -- Inception NAV
  SELECT nav_value INTO v_nav_inception FROM nav_history WHERE scheme_code = p_scheme_code ORDER BY nav_date ASC LIMIT 1;

  RETURN QUERY SELECT
    v_latest_nav,
    v_latest_date,
    v_inception_date,
    ROUND(v_age, 1),
    -- Absolute returns
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_1w), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_1m), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_3m), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_6m), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_1y), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_2y), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_3y), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_5y), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_7y), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_10y), 2),
    ROUND(calculate_absolute_return(v_latest_nav, v_nav_inception), 2),
    -- CAGR
    ROUND(calculate_cagr(v_latest_nav, v_nav_1y, 1), 2),
    ROUND(calculate_cagr(v_latest_nav, v_nav_2y, 2), 2),
    ROUND(calculate_cagr(v_latest_nav, v_nav_3y, 3), 2),
    ROUND(calculate_cagr(v_latest_nav, v_nav_5y, 5), 2),
    ROUND(calculate_cagr(v_latest_nav, v_nav_7y, 7), 2),
    ROUND(calculate_cagr(v_latest_nav, v_nav_10y, 10), 2),
    ROUND(calculate_cagr(v_latest_nav, v_nav_inception, v_age), 2);
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- PHASE 3: calc_sharpe() — standalone Sharpe ratio
-- ============================================================
-- Sharpe = (annualized_return - risk_free) / annualized_volatility

CREATE OR REPLACE FUNCTION calc_sharpe(
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
      STDDEV(ret) * SQRT(252) * 100 AS ann_vol
    FROM daily_rets
    WHERE ret IS NOT NULL
  )
  SELECT ROUND(
    ((ann_return - p_risk_free) / NULLIF(ann_vol, 0))::NUMERIC,
    4
  )
  FROM stats;
$$ LANGUAGE SQL STABLE;


-- ============================================================
-- PHASE 4: calc_rolling_returns() — rolling return statistics
-- ============================================================
-- Returns avg, min, max, median of rolling CAGR windows.
-- For 1Y rolling: slides monthly over the lookback period.
-- For 3Y rolling: same, but each window is 3 years wide.

CREATE OR REPLACE FUNCTION calc_rolling_returns(
  p_scheme_code     VARCHAR,
  p_period_years    INT,         -- Window width: 1, 3, 5, or 7
  p_lookback_months INT DEFAULT 36  -- How far back to start sliding
) RETURNS TABLE (
  avg_return    NUMERIC,
  min_return    NUMERIC,
  max_return    NUMERIC,
  median_return NUMERIC,
  num_windows   INT
) AS $$
DECLARE
  v_latest_date DATE;
  v_returns     NUMERIC[];
  v_end_date    DATE;
  v_start_date  DATE;
  v_end_nav     NUMERIC;
  v_start_nav   NUMERIC;
  v_cagr        NUMERIC;
  v_month       INT;
  v_sorted      NUMERIC[];
  v_len         INT;
BEGIN
  SELECT MAX(nav_date) INTO v_latest_date
  FROM nav_history WHERE scheme_code = p_scheme_code;

  IF v_latest_date IS NULL THEN RETURN; END IF;

  v_returns := ARRAY[]::NUMERIC[];

  FOR v_month IN 0..p_lookback_months LOOP
    v_end_date := v_latest_date - (v_month || ' months')::INTERVAL;
    v_start_date := v_end_date - (p_period_years || ' years')::INTERVAL;

    SELECT nav_value INTO v_end_nav
    FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_end_date
    ORDER BY nav_date DESC LIMIT 1;

    SELECT nav_value INTO v_start_nav
    FROM nav_history WHERE scheme_code = p_scheme_code AND nav_date <= v_start_date
    ORDER BY nav_date DESC LIMIT 1;

    IF v_end_nav IS NOT NULL AND v_start_nav IS NOT NULL AND v_start_nav > 0 THEN
      IF p_period_years = 1 THEN
        v_cagr := calculate_absolute_return(v_end_nav, v_start_nav);
      ELSE
        v_cagr := calculate_cagr(v_end_nav, v_start_nav, p_period_years);
      END IF;
      IF v_cagr IS NOT NULL THEN
        v_returns := array_append(v_returns, ROUND(v_cagr, 2));
      END IF;
    END IF;
  END LOOP;

  v_len := array_length(v_returns, 1);
  IF v_len IS NULL OR v_len < 3 THEN RETURN; END IF;

  -- Sort for median
  SELECT ARRAY_AGG(val ORDER BY val) INTO v_sorted FROM unnest(v_returns) AS val;

  RETURN QUERY SELECT
    ROUND((SELECT AVG(val) FROM unnest(v_returns) AS val), 2),
    v_sorted[1],
    v_sorted[v_len],
    v_sorted[(v_len + 1) / 2],
    v_len;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- PHASE 5: downsample_nav_history() — Hybrid Storage Pyramid
-- ============================================================
-- Hot Tier:  Keep ALL daily NAVs for trailing 12 months
-- Warm Tier: Keep only the LAST NAV per calendar month for older data
-- This is irreversible. Run AFTER computing metrics on full-fidelity data.

CREATE OR REPLACE FUNCTION downsample_nav_history()
RETURNS TABLE (deleted_count BIGINT, remaining_count BIGINT) AS $$
DECLARE
  v_before BIGINT;
  v_after  BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_before FROM nav_history;

  -- Delete warm-tier rows that are NOT the last trading day of their month
  DELETE FROM nav_history nh
  WHERE nh.nav_date < CURRENT_DATE - INTERVAL '12 months'
    AND NOT EXISTS (
      -- Keep if this row IS the last row for its scheme+year+month
      SELECT 1 FROM (
        SELECT scheme_code, MAX(nav_date) AS last_day
        FROM nav_history
        WHERE scheme_code = nh.scheme_code
          AND EXTRACT(YEAR FROM nav_date) = EXTRACT(YEAR FROM nh.nav_date)
          AND EXTRACT(MONTH FROM nav_date) = EXTRACT(MONTH FROM nh.nav_date)
        GROUP BY scheme_code
      ) monthly
      WHERE monthly.scheme_code = nh.scheme_code
        AND monthly.last_day = nh.nav_date
    );

  SELECT COUNT(*) INTO v_after FROM nav_history;

  RETURN QUERY SELECT v_before - v_after, v_after;
END;
$$ LANGUAGE plpgsql;


COMMIT;

-- ============================================================
-- POST-MIGRATION NOTES
-- ============================================================
-- 1. Run this migration BEFORE compute-fund-metrics.ts (Step 3).
-- 2. Validate calc_all_returns() against existing fund_returns data.
-- 3. Run downsample_nav_history() ONLY after metrics are validated.
-- 4. After downsampling, run: VACUUM FULL nav_history; REINDEX TABLE nav_history;
