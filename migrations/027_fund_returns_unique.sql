-- ============================================================
-- Migration 027: Ensure fund_returns has UNIQUE(scheme_code)
-- Story: DATA-001 blocker — upsert support for nightly compute
-- Reversible: see migrations/down/027_fund_returns_unique_down.sql
-- ============================================================
-- Prod fund_returns lacks any UNIQUE / PK constraint on scheme_code,
-- so the ETL (scripts/scheme_pipeline/compute/rolling_returns.py) cannot
-- use ON CONFLICT (scheme_code). This migration adds the constraint
-- after de-duping by keeping the most recently updated row per scheme.

BEGIN;

-- Collapse duplicates — keep the row with the most recent updated_at.
DELETE FROM fund_returns a
USING fund_returns b
WHERE a.scheme_code = b.scheme_code
  AND (a.updated_at < b.updated_at
       OR (a.updated_at = b.updated_at AND a.ctid < b.ctid));

-- Add the UNIQUE constraint. Idempotent via DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fund_returns_scheme_code_key'
      AND conrelid = 'fund_returns'::regclass
  ) THEN
    ALTER TABLE fund_returns
      ADD CONSTRAINT fund_returns_scheme_code_key UNIQUE (scheme_code);
  END IF;
END $$;

COMMIT;
