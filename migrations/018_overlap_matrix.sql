-- ════════════════════════════════════════════════════════════════════
--  Migration 018: Precomputed Fund Overlap Matrix
--
--  O(1) overlap lookup between any two funds.
--  Populated by scripts/compute-overlap-matrix.ts after holdings ingestion.
--  Convention: fund_a < fund_b (lexicographic) to avoid duplicate pairs.
-- ════════════════════════════════════════════════════════════════════

-- ═══ 1. Normalized holdings ledger (Bifurcated Storage - Pillar 1) ═══
CREATE TABLE IF NOT EXISTS dim_stocks (
  isin VARCHAR(12) PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT
);

-- Fact table for holdings with composite unique
CREATE TABLE IF NOT EXISTS fact_holdings (
  id SERIAL PRIMARY KEY,
  scheme_code VARCHAR(20) NOT NULL REFERENCES funds(scheme_code),
  isin VARCHAR(12) NOT NULL REFERENCES dim_stocks(isin),
  weight_pct DECIMAL(5,2) NOT NULL,
  rank INT,
  as_of_date DATE NOT NULL,
  UNIQUE(scheme_code, isin, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_fh_scheme ON fact_holdings(scheme_code);
CREATE INDEX IF NOT EXISTS idx_fh_isin ON fact_holdings(isin);
CREATE INDEX IF NOT EXISTS idx_fh_date ON fact_holdings(as_of_date);

-- ═══ 2. Precomputed overlap matrix ═══
CREATE TABLE IF NOT EXISTS fund_overlap_pairs (
  fund_a VARCHAR(20) NOT NULL,
  fund_b VARCHAR(20) NOT NULL,
  overlap_pct DECIMAL(5,4) NOT NULL,  -- 0.0000 to 1.0000
  shared_holdings INT DEFAULT 0,
  as_of_date DATE NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (fund_a, fund_b, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_fop_fund_a ON fund_overlap_pairs(fund_a);
CREATE INDEX IF NOT EXISTS idx_fop_fund_b ON fund_overlap_pairs(fund_b);
CREATE INDEX IF NOT EXISTS idx_fop_date ON fund_overlap_pairs(as_of_date);

-- Convenience function: get overlap between any two funds (O(1))
CREATE OR REPLACE FUNCTION get_fund_overlap(
  p_fund_a VARCHAR(20),
  p_fund_b VARCHAR(20),
  p_date DATE DEFAULT NULL
) RETURNS DECIMAL(5,4) AS $$
DECLARE
  v_a VARCHAR(20);
  v_b VARCHAR(20);
  v_overlap DECIMAL(5,4);
  v_date DATE;
BEGIN
  -- Normalize order: fund_a < fund_b
  IF p_fund_a < p_fund_b THEN
    v_a := p_fund_a; v_b := p_fund_b;
  ELSE
    v_a := p_fund_b; v_b := p_fund_a;
  END IF;

  v_date := COALESCE(p_date, (SELECT MAX(as_of_date) FROM fund_overlap_pairs));

  SELECT overlap_pct INTO v_overlap
  FROM fund_overlap_pairs
  WHERE fund_a = v_a AND fund_b = v_b AND as_of_date = v_date;

  RETURN COALESCE(v_overlap, 0.0000);
END;
$$ LANGUAGE plpgsql STABLE;
