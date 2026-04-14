-- ============================================================
-- Migration 022: scheme_benchmark_map (scheme → TRI benchmark lookup)
-- Story: DATA-004 Benchmark TRI ingestion (prerequisite for ratios)
-- Reversible: see migrations/down/022_scheme_benchmark_map_down.sql
-- ============================================================
-- Additive-only. Reuses existing benchmark_data table (migration 004)
-- for actual TRI series storage. This table maps scheme → benchmark_name.
-- Populated by manual mapping file + AMFI scheme categorization.

CREATE TABLE IF NOT EXISTS scheme_benchmark_map (
  scheme_code     VARCHAR(20) PRIMARY KEY,
  benchmark_name  VARCHAR(50) NOT NULL,  -- e.g. 'NIFTY_50_TRI', 'NIFTY_MIDCAP_150_TRI', 'CRISIL_COMPOSITE_BOND'
  mapping_source  VARCHAR(16) DEFAULT 'manual',  -- manual | amfi | inferred
  effective_from  DATE DEFAULT CURRENT_DATE,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_sbm_scheme FOREIGN KEY (scheme_code) REFERENCES funds(scheme_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sbm_benchmark
  ON scheme_benchmark_map(benchmark_name);
