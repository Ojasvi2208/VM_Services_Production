-- ============================================================
-- Migration 021: scheme_percentile (peer-rank table)
-- Story: DATA-008 Peer-group percentile computation
-- Reversible: see migrations/down/021_scheme_percentile_down.sql
-- ============================================================
-- Additive-only. No existing table touched.
-- Populated nightly by scripts/scheme_pipeline/compute/percentile.py

CREATE TABLE IF NOT EXISTS scheme_percentile (
  id SERIAL PRIMARY KEY,
  scheme_code VARCHAR(20) NOT NULL,
  metric      VARCHAR(24) NOT NULL,      -- return_1y | return_3y | return_5y | sharpe_1y | alpha_3y
  pct_rank    DECIMAL(5, 2) NOT NULL,    -- 0.00 to 100.00 (higher = better)
  peer_count  INTEGER NOT NULL,
  peer_category VARCHAR(80),             -- SEBI category e.g. 'Large Cap', 'ELSS'
  as_of_date  DATE NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_percentile_scheme FOREIGN KEY (scheme_code) REFERENCES funds(scheme_code) ON DELETE CASCADE,
  CONSTRAINT unique_percentile_scheme_metric_date UNIQUE(scheme_code, metric, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_percentile_scheme_metric
  ON scheme_percentile(scheme_code, metric, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_percentile_category_metric
  ON scheme_percentile(peer_category, metric, pct_rank DESC)
  WHERE as_of_date = (SELECT MAX(as_of_date) FROM scheme_percentile);
