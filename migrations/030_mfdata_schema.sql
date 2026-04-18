-- 030_mfdata_schema.sql
-- MFD-001: mfdata.in Mirror Schema Expansion
-- Creates tables and columns needed to mirror mfdata.in data into our Postgres.
-- Idempotent: re-runnable without error.
-- Reversible via /migrations/down/030_mfdata_schema_down.sql.

BEGIN;

-- =====================================================================
-- 1. fund_families — mfdata.in "family_id" concept (parent of variant schemes)
-- =====================================================================
CREATE TABLE IF NOT EXISTS fund_families (
    family_id           INTEGER PRIMARY KEY,
    family_name         TEXT,
    amc_slug            VARCHAR(100),
    amc_name            VARCHAR(100),
    category            VARCHAR(100),
    sub_category        VARCHAR(100),
    benchmark_name      VARCHAR(200),
    has_holdings        BOOLEAN DEFAULT FALSE,
    has_ratios          BOOLEAN DEFAULT FALSE,
    has_risk_detail     BOOLEAN DEFAULT FALSE,
    latest_holdings_month VARCHAR(7),  -- 'YYYY-MM'
    source              VARCHAR(20) DEFAULT 'mfdata',
    fetched_at          TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_families_amc_slug ON fund_families (amc_slug);
CREATE INDEX IF NOT EXISTS idx_fund_families_category ON fund_families (category);

-- =====================================================================
-- 2. Extend funds with mfdata-sourced metadata columns
-- =====================================================================
ALTER TABLE funds ADD COLUMN IF NOT EXISTS min_lumpsum          NUMERIC(12,2);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS min_additional       NUMERIC(12,2);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS morningstar_rating   SMALLINT;
ALTER TABLE funds ADD COLUMN IF NOT EXISTS morningstar_sec_id   VARCHAR(50);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS risk_label           VARCHAR(30);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS benchmark_name       VARCHAR(200);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS day_change_pct       NUMERIC(8,3);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS mfdata_family_id     INTEGER REFERENCES fund_families(family_id) ON DELETE SET NULL;
ALTER TABLE funds ADD COLUMN IF NOT EXISTS mfdata_amfi_code     VARCHAR(20);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS mfdata_isin          VARCHAR(20);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS mfdata_last_synced_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_funds_mfdata_family ON funds (mfdata_family_id);
CREATE INDEX IF NOT EXISTS idx_funds_morningstar    ON funds (morningstar_rating) WHERE morningstar_rating IS NOT NULL;

-- =====================================================================
-- 3. Extend fund_returns with mfdata ratio columns
-- =====================================================================
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS r_squared          NUMERIC(8,4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS jensens_alpha      NUMERIC(8,4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS treynor_ratio      NUMERIC(8,4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS information_ratio  NUMERIC(8,4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS capture_up         NUMERIC(8,4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS capture_down       NUMERIC(8,4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS max_drawdown       NUMERIC(8,4);
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS max_drawdown_date  DATE;

-- Category rank columns (1..N within SEBI category for each period)
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rank_1m     SMALLINT;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rank_3m     SMALLINT;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rank_6m     SMALLINT;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rank_1y     SMALLINT;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rank_3y     SMALLINT;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rank_5y     SMALLINT;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS rank_total  SMALLINT;  -- denominator (N schemes in category)

-- =====================================================================
-- 4. fund_fundamentals — portfolio-weighted PE/PB/ROE from mfdata
-- =====================================================================
CREATE TABLE IF NOT EXISTS fund_fundamentals (
    scheme_code         VARCHAR(20) PRIMARY KEY REFERENCES funds(scheme_code) ON DELETE CASCADE,
    pe_ratio            NUMERIC(8,2),
    pb_ratio            NUMERIC(8,2),
    ps_ratio            NUMERIC(8,2),
    dividend_yield      NUMERIC(6,3),
    roe                 NUMERIC(6,2),
    roa                 NUMERIC(6,2),
    as_of_date          DATE,
    source              VARCHAR(20) DEFAULT 'mfdata',
    fetched_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- =====================================================================
-- 5. Holdings: add source tracking to existing fund_top_holdings
-- =====================================================================
ALTER TABLE fund_top_holdings ADD COLUMN IF NOT EXISTS source     VARCHAR(20) DEFAULT 'pdf';
ALTER TABLE fund_top_holdings ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMP;

-- Partial index: supports "which funds hold stock X" reverse lookup, mfdata source only
CREATE INDEX IF NOT EXISTS idx_holdings_stock_mfdata
    ON fund_top_holdings (holding_name)
    WHERE source = 'mfdata';

-- =====================================================================
-- 6. credit_quality — debt fund credit bucket breakdown
-- =====================================================================
CREATE TABLE IF NOT EXISTS credit_quality (
    family_id       INTEGER NOT NULL REFERENCES fund_families(family_id) ON DELETE CASCADE,
    bucket          VARCHAR(20) NOT NULL,  -- 'AAA', 'AA', 'A', 'BBB', 'Below BBB', 'Not Rated', 'Cash'
    fund_pct        NUMERIC(6,3),
    category_pct    NUMERIC(6,3),
    as_of_date      DATE NOT NULL,
    source          VARCHAR(20) DEFAULT 'mfdata',
    fetched_at      TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (family_id, bucket, as_of_date)
);

-- =====================================================================
-- 7. fund_overlap_cache — precomputed pairwise overlap for fast read
-- =====================================================================
CREATE TABLE IF NOT EXISTS fund_overlap_cache (
    scheme_code_a       VARCHAR(20) NOT NULL,
    scheme_code_b       VARCHAR(20) NOT NULL,
    overlap_percentage  NUMERIC(6,3),
    common_stocks       INTEGER,
    computed_at         TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (scheme_code_a, scheme_code_b),
    CONSTRAINT overlap_canonical_order CHECK (scheme_code_a < scheme_code_b)
);

CREATE INDEX IF NOT EXISTS idx_overlap_scheme_a ON fund_overlap_cache (scheme_code_a);
CREATE INDEX IF NOT EXISTS idx_overlap_scheme_b ON fund_overlap_cache (scheme_code_b);

-- =====================================================================
-- 8. category_benchmarks — SEBI category average metrics (from mfdata)
-- =====================================================================
CREATE TABLE IF NOT EXISTS category_benchmarks (
    category    VARCHAR(100) NOT NULL,
    metric      VARCHAR(50) NOT NULL,   -- 'sharpe', 'beta', 'pe', 'return_1y', etc.
    period      VARCHAR(10) NOT NULL,   -- '1m', '1y', '3y', '5y', 'current'
    value       NUMERIC(10,4),
    as_of_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    source      VARCHAR(20) DEFAULT 'mfdata',
    fetched_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (category, metric, period, as_of_date)
);

-- =====================================================================
-- 9. mfdata_fund_managers — fund manager team info from mfdata /families/{id}/people
-- Note: existing fund_managers table is scheme-keyed (PDF engine / tenure tracking).
-- mfdata version is family-keyed with bio/role — separate table avoids conflict.
-- =====================================================================
CREATE TABLE IF NOT EXISTS mfdata_fund_managers (
    id              SERIAL PRIMARY KEY,
    family_id       INTEGER NOT NULL REFERENCES fund_families(family_id) ON DELETE CASCADE,
    manager_name    VARCHAR(200) NOT NULL,
    since_date      DATE,
    role            VARCHAR(50),  -- 'lead', 'co-manager', 'analyst'
    bio             TEXT,
    source          VARCHAR(20) DEFAULT 'mfdata',
    fetched_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfdata_managers_family ON mfdata_fund_managers (family_id);

-- Dedupe constraint: one row per (family_id, manager_name, role)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mfdata_managers_unique
    ON mfdata_fund_managers (family_id, manager_name, COALESCE(role, 'lead'));

-- =====================================================================
-- 10. scheme_allocation — stock/bond/cash/other % from mfdata /allocation
-- =====================================================================
CREATE TABLE IF NOT EXISTS scheme_allocation (
    family_id       INTEGER NOT NULL REFERENCES fund_families(family_id) ON DELETE CASCADE,
    asset_class     VARCHAR(30) NOT NULL,  -- 'equity', 'debt', 'cash', 'other', 'international'
    fund_pct        NUMERIC(6,3),
    category_pct    NUMERIC(6,3),
    as_of_date      DATE NOT NULL,
    source          VARCHAR(20) DEFAULT 'mfdata',
    fetched_at      TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (family_id, asset_class, as_of_date)
);

-- =====================================================================
-- 11. mfdata_sync_log — audit trail for every sync run
-- =====================================================================
CREATE TABLE IF NOT EXISTS mfdata_sync_log (
    id              SERIAL PRIMARY KEY,
    mode            VARCHAR(50) NOT NULL,   -- 'initial-full', 'daily-metadata', 'weekly-ratios', 'monthly-holdings', 'scheme'
    started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMP,
    status          VARCHAR(20),  -- 'running', 'success', 'partial', 'failed', 'aborted'
    api_calls_made  INTEGER DEFAULT 0,
    rows_written    INTEGER DEFAULT 0,
    schemes_updated INTEGER DEFAULT 0,
    families_updated INTEGER DEFAULT 0,
    error_message   TEXT,
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_mfdata_sync_log_mode_started ON mfdata_sync_log (mode, started_at DESC);

COMMIT;

-- Verification queries (run manually after migration):
--   SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN (
--     'fund_families','fund_fundamentals','credit_quality','fund_overlap_cache',
--     'category_benchmarks','mfdata_fund_managers','scheme_allocation','mfdata_sync_log'
--   );  -- should return 8
--   SELECT column_name FROM information_schema.columns WHERE table_name='funds'
--     AND column_name LIKE 'mfdata%' OR column_name LIKE 'morningstar%' OR column_name='risk_label';
