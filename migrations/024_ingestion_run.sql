-- ============================================================
-- Migration 024: ingestion_run (ETL audit + observability)
-- Story: BE-007 Health check + data freshness endpoint
-- Reversible: see migrations/down/024_ingestion_run_down.sql
-- ============================================================
-- Written by every Python ETL job in scripts/scheme_pipeline/jobs/
-- Read by GET /api/health/data.

CREATE TABLE IF NOT EXISTS ingestion_run (
  id           SERIAL PRIMARY KEY,
  source       VARCHAR(40) NOT NULL,    -- 'amfi_nav' | 'mfdata_api' | 'nse_tri' | 'amc_factsheet_hdfc' | ...
  job_name     VARCHAR(80) NOT NULL,    -- 'nav_daily' | 'returns_nightly' | 'ratios_nightly' | 'tri_daily'
  started_at   TIMESTAMP NOT NULL,
  ended_at     TIMESTAMP,
  status       VARCHAR(16) NOT NULL,    -- running | success | failed | partial
  row_count    INTEGER DEFAULT 0,
  error_message TEXT,
  metadata     JSONB,                   -- arbitrary per-job context (e.g. {file: "NAVAll.txt", size_bytes: ...})
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingestion_source_started
  ON ingestion_run(source, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_status
  ON ingestion_run(status, started_at DESC) WHERE status IN ('failed', 'partial');
