-- ════════════════════════════════════════════════════════════════════
--  Migration 015: Aladdin Portfolio Construction Engine
--
--  1. User profile columns (date_of_birth, risk_tolerance)
--  2. Fund top holdings table (for overlap matrix)
-- ════════════════════════════════════════════════════════════════════

-- ═══ 1. User profile for Aladdin ═══
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_tolerance VARCHAR(20) DEFAULT 'moderate';

COMMENT ON COLUMN users.date_of_birth IS 'For age-based equity glide path (100 - age rule)';
COMMENT ON COLUMN users.risk_tolerance IS 'conservative, moderate, or aggressive';

-- ═══ 2. Fund top holdings (refreshed monthly from external source) ═══
-- Stores top-10 holdings per fund for stock-level overlap detection.
-- Source: MoneyControl / AMFI monthly portfolio disclosure.
CREATE TABLE IF NOT EXISTS fund_top_holdings (
  id SERIAL PRIMARY KEY,
  scheme_code VARCHAR(20) NOT NULL,
  holding_name TEXT NOT NULL,
  holding_isin VARCHAR(12),
  weight_pct DECIMAL(5,2),
  sector TEXT,
  rank INT,
  as_of_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scheme_code, holding_name, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_fth_scheme ON fund_top_holdings(scheme_code);
CREATE INDEX IF NOT EXISTS idx_fth_holding ON fund_top_holdings(holding_name);
CREATE INDEX IF NOT EXISTS idx_fth_isin ON fund_top_holdings(holding_isin) WHERE holding_isin IS NOT NULL;
