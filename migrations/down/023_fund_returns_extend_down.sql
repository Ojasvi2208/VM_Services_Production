-- Reverses migration 023. Drops only the columns added by the up script.
-- Existing return_1w/1m/.../cagr_*/volatility_*/sharpe_* columns are untouched.

ALTER TABLE fund_returns DROP COLUMN IF EXISTS alpha_1y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS alpha_3y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS alpha_5y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS beta_1y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS beta_3y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS beta_5y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS sortino_1y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS sortino_3y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS sortino_5y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS std_dev_1y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS downside_deviation_1y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS information_ratio_3y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS tracking_error_3y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS r_squared_3y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rolling_3y_mean;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rolling_5y_mean;
