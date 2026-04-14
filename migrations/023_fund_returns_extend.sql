-- ============================================================
-- Migration 023: Extend fund_returns with full risk ratio suite
-- Story: DATA-005 Ratios computation (BLOCKED by DATA-004)
-- Reversible: see migrations/down/023_fund_returns_extend_down.sql
-- ============================================================
-- Additive-only: all new columns nullable, default NULL.
-- Does NOT modify existing columns. Existing rows remain valid.
-- Populated nightly by scripts/scheme_pipeline/compute/ratios.py
-- once DATA-004 (TRI benchmark ingestion) lands.

ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS alpha_1y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS alpha_3y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS alpha_5y DECIMAL(10, 4);

ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS beta_1y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS beta_3y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS beta_5y DECIMAL(10, 4);

ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS sortino_1y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS sortino_3y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS sortino_5y DECIMAL(10, 4);

ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS std_dev_1y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS downside_deviation_1y DECIMAL(10, 4);

ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS information_ratio_3y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS tracking_error_3y DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS r_squared_3y DECIMAL(10, 4);

-- Rolling mean returns (for percentile computation in DATA-008)
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rolling_3y_mean DECIMAL(10, 4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rolling_5y_mean DECIMAL(10, 4);
