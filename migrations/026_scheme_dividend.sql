-- ============================================================
-- Migration 026: scheme_dividend (for IDCW total-return NAV reconstruction)
-- Story: DATA-002 Total-return NAV reconstruction for IDCW schemes
-- Reversible: see migrations/down/026_scheme_dividend_down.sql
-- ============================================================
-- Internal-only table (no Flutter exposure).
-- Populated by scripts/scheme_pipeline/adapters/amfi_dividends.py
-- Consumed by scripts/scheme_pipeline/compute/total_return.py
-- Output: tr_nav column on scheme_nav (added here for co-location).

CREATE TABLE IF NOT EXISTS scheme_dividend (
  id                   SERIAL PRIMARY KEY,
  scheme_code          VARCHAR(20) NOT NULL,
  record_date          DATE NOT NULL,
  ex_date              DATE,
  dividend_per_unit    DECIMAL(12, 6) NOT NULL,
  nav_on_record_date   DECIMAL(15, 4),
  source               VARCHAR(16) DEFAULT 'amfi', -- amfi | amc | mfdata
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_div_scheme FOREIGN KEY (scheme_code) REFERENCES funds(scheme_code) ON DELETE CASCADE,
  CONSTRAINT unique_div_scheme_record UNIQUE(scheme_code, record_date)
);

CREATE INDEX IF NOT EXISTS idx_div_scheme_record ON scheme_dividend(scheme_code, record_date DESC);

-- Add tr_nav column to nav_history for dividend-adjusted (total-return) series.
-- For growth plans, tr_nav = nav_value (pass-through).
-- For IDCW plans, compute/total_return.py populates.
ALTER TABLE nav_history ADD COLUMN IF NOT EXISTS tr_nav DECIMAL(15, 4);

CREATE INDEX IF NOT EXISTS idx_nav_tr_scheme_date
  ON nav_history(scheme_code, nav_date DESC) WHERE tr_nav IS NOT NULL;
