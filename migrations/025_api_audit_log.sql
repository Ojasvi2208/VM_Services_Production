-- ============================================================
-- Migration 025: api_audit_log (SEBI 7-year retention)
-- Story: BE-006 Audit log for data requests
-- Reversible: see migrations/down/025_api_audit_log_down.sql
-- ============================================================
-- Logs every scheme data request. Must survive 7 years per SEBI.
-- Monthly partition strategy deferred — initial table is a flat table;
-- partitioning story tracked as BE-008 follow-up when row count > 10M.

CREATE TABLE IF NOT EXISTS api_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID,                    -- nullable for anonymous requests
  arn           VARCHAR(20),             -- MFD's ARN when applicable
  request_path  VARCHAR(256) NOT NULL,
  request_method VARCHAR(8) NOT NULL,
  scheme_code   VARCHAR(20),             -- extracted from path when present
  status_code   INTEGER NOT NULL,
  response_hash CHAR(64),                -- SHA-256 of response body (for "what did user see" reconstruction)
  request_ip    INET,
  user_agent    TEXT,
  request_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user_at ON api_audit_log(user_id, request_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_scheme_at ON api_audit_log(scheme_code, request_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_path_at ON api_audit_log(request_path, request_at DESC);
