-- ═══════════════════════════════════════════════════════════════════════
--  MIGRATION: Master Fund Relational Engine
--  Purpose: Transition from fragmented 37k+ scheme rows to a Parent-Child
--           model where ~4,000 "Strategy Families" each own 2-8 variants.
--
--  Run order:
--    1. This migration (creates master_funds, backfills, adds FK)
--    2. db-optimize.sql (creates mv_unified_search + indexes)
--    3. REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search;
--
--  Rollback: DROP TABLE master_funds CASCADE;
--            ALTER TABLE funds DROP COLUMN IF EXISTS master_fund_id;
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Create master_funds table ──
CREATE TABLE IF NOT EXISTS master_funds (
  id            SERIAL PRIMARY KEY,
  strategy_name TEXT NOT NULL UNIQUE,   -- e.g. "HDFC Top 100 Fund"
  fund_house    TEXT,                   -- e.g. "HDFC"
  category      TEXT,                   -- e.g. "Equity"
  sub_category  TEXT,                   -- e.g. "Large Cap"
  variant_count INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_funds_strategy ON master_funds(strategy_name);
CREATE INDEX IF NOT EXISTS idx_master_funds_house ON master_funds(fund_house);
CREATE INDEX IF NOT EXISTS idx_master_funds_category ON master_funds(category);

-- ── 2. Add master_fund_id FK to funds table ──
ALTER TABLE funds ADD COLUMN IF NOT EXISTS master_fund_id INT REFERENCES master_funds(id);
CREATE INDEX IF NOT EXISTS idx_funds_master_id ON funds(master_fund_id);

-- ── 3. Backfill: Extract strategy names from scheme_name ──
-- Strategy: Strip "Direct Plan", "Regular Plan", "Growth", "IDCW", "Dividend",
--           "Payout", "Reinvestment" suffixes to derive the canonical strategy name.
--
-- Example:
--   "HDFC Top 100 Fund - Direct Plan - Growth"     → "HDFC Top 100 Fund"
--   "HDFC Top 100 Fund - Regular Plan - IDCW"      → "HDFC Top 100 Fund"
--   "HDFC Top 100 Fund - Direct Plan - Growth Option" → "HDFC Top 100 Fund"

INSERT INTO master_funds (strategy_name, fund_house, category, sub_category, variant_count)
SELECT
  clean_name,
  -- Extract fund house from first word(s)
  CASE
    WHEN clean_name ILIKE 'Aditya Birla%'      THEN 'Aditya Birla Sun Life'
    WHEN clean_name ILIKE 'ICICI Prudential%'   THEN 'ICICI Prudential'
    WHEN clean_name ILIKE 'ICICI Prud%'         THEN 'ICICI Prudential'
    WHEN clean_name ILIKE 'Nippon India%'       THEN 'Nippon India'
    WHEN clean_name ILIKE 'Franklin%'           THEN 'Franklin Templeton'
    WHEN clean_name ILIKE 'Kotak%'              THEN 'Kotak Mahindra'
    WHEN clean_name ILIKE 'Tata %'              THEN 'Tata'
    WHEN clean_name ILIKE 'HDFC %'              THEN 'HDFC'
    WHEN clean_name ILIKE 'SBI %'               THEN 'SBI'
    WHEN clean_name ILIKE 'Axis %'              THEN 'Axis'
    WHEN clean_name ILIKE 'UTI %'               THEN 'UTI'
    WHEN clean_name ILIKE 'DSP %'               THEN 'DSP'
    WHEN clean_name ILIKE 'Mirae %'             THEN 'Mirae Asset'
    WHEN clean_name ILIKE 'Sundaram %'          THEN 'Sundaram'
    WHEN clean_name ILIKE 'Invesco %'           THEN 'Invesco'
    WHEN clean_name ILIKE 'Motilal %'           THEN 'Motilal Oswal'
    WHEN clean_name ILIKE 'Quant %'             THEN 'Quant'
    WHEN clean_name ILIKE 'Canara %'            THEN 'Canara Robeco'
    WHEN clean_name ILIKE 'Bandhan %'           THEN 'Bandhan'
    WHEN clean_name ILIKE 'Bajaj %'             THEN 'Bajaj Finserv'
    WHEN clean_name ILIKE 'Edelweiss %'         THEN 'Edelweiss'
    WHEN clean_name ILIKE 'Union %'             THEN 'Union'
    WHEN clean_name ILIKE 'Mahindra %'          THEN 'Mahindra Manulife'
    WHEN clean_name ILIKE 'PPFAS%'              THEN 'PPFAS'
    WHEN clean_name ILIKE 'Parag Parikh%'       THEN 'PPFAS'
    WHEN clean_name ILIKE 'PGIM %'              THEN 'PGIM India'
    WHEN clean_name ILIKE 'Baroda %'            THEN 'Baroda BNP Paribas'
    WHEN clean_name ILIKE 'HSBC %'              THEN 'HSBC'
    WHEN clean_name ILIKE 'ITI %'               THEN 'ITI'
    WHEN clean_name ILIKE 'WhiteOak%'           THEN 'WhiteOak'
    WHEN clean_name ILIKE 'LIC %'               THEN 'LIC'
    WHEN clean_name ILIKE 'JM %'                THEN 'JM Financial'
    WHEN clean_name ILIKE 'Groww %'             THEN 'Groww'
    WHEN clean_name ILIKE '360 ONE%'            THEN '360 ONE'
    WHEN clean_name ILIKE 'NJ %'               THEN 'NJ'
    ELSE SPLIT_PART(clean_name, ' ', 1)
  END AS fund_house,
  -- Derive category from scheme_type of the first matching fund
  (SELECT f2.scheme_type FROM funds f2 WHERE f2.scheme_name ILIKE clean_name || '%' LIMIT 1),
  -- Sub-category extraction
  CASE
    WHEN clean_name ILIKE '%Large Cap%' OR clean_name ILIKE '%Largecap%' THEN 'Large Cap'
    WHEN clean_name ILIKE '%Mid Cap%' OR clean_name ILIKE '%Midcap%' THEN 'Mid Cap'
    WHEN clean_name ILIKE '%Small Cap%' OR clean_name ILIKE '%Smallcap%' THEN 'Small Cap'
    WHEN clean_name ILIKE '%Flexi%' OR clean_name ILIKE '%Multi Cap%' THEN 'Flexi Cap'
    WHEN clean_name ILIKE '%ELSS%' OR clean_name ILIKE '%Tax%' THEN 'ELSS'
    WHEN clean_name ILIKE '%Liquid%' THEN 'Liquid'
    WHEN clean_name ILIKE '%Overnight%' THEN 'Overnight'
    WHEN clean_name ILIKE '%Balanced%' OR clean_name ILIKE '%Hybrid%' THEN 'Hybrid'
    WHEN clean_name ILIKE '%Debt%' OR clean_name ILIKE '%Bond%' THEN 'Debt'
    WHEN clean_name ILIKE '%Index%' OR clean_name ILIKE '%ETF%' THEN 'Index/ETF'
    ELSE NULL
  END,
  COUNT(*)
FROM (
  SELECT DISTINCT
    -- Core cleaning: strip plan type + option type suffixes
    TRIM(BOTH FROM
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(scheme_name,
                      '\s*-?\s*(Direct|Regular)\s*(Plan)?\s*', '', 'gi'),
                    '\s*-?\s*(Growth|IDCW|Dividend)\s*(Option|Plan|Payout|Reinvestment)?\s*', '', 'gi'),
                  '\s*-?\s*Option\s*$', '', 'gi'),
                '\s*-?\s*Plan\s*$', '', 'gi'),
              '\s*\(Erstwhile[^)]*\)', '', 'gi'),
            '\s*\(Formerly[^)]*\)', '', 'gi'),
          '\s*\(Advisor[^)]*\)', '', 'gi'),
        '\s{2,}', ' ', 'g')
    ) AS clean_name
  FROM funds
  WHERE scheme_name IS NOT NULL AND LENGTH(scheme_name) > 5
) derived
GROUP BY clean_name
HAVING COUNT(*) >= 1
ON CONFLICT (strategy_name) DO UPDATE SET
  variant_count = EXCLUDED.variant_count,
  updated_at = NOW();

-- ── 4. Link funds → master_funds via cleaned name matching ──
UPDATE funds f
SET master_fund_id = mf.id
FROM master_funds mf
WHERE mf.strategy_name = TRIM(BOTH FROM
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(f.scheme_name,
                  '\s*-?\s*(Direct|Regular)\s*(Plan)?\s*', '', 'gi'),
                '\s*-?\s*(Growth|IDCW|Dividend)\s*(Option|Plan|Payout|Reinvestment)?\s*', '', 'gi'),
              '\s*-?\s*Option\s*$', '', 'gi'),
            '\s*-?\s*Plan\s*$', '', 'gi'),
          '\s*\(Erstwhile[^)]*\)', '', 'gi'),
        '\s*\(Formerly[^)]*\)', '', 'gi'),
      '\s*\(Advisor[^)]*\)', '', 'gi'),
    '\s{2,}', ' ', 'g')
);

-- ── 5. Add plan_type and option_type columns to funds for fast filtering ──
ALTER TABLE funds ADD COLUMN IF NOT EXISTS plan_type TEXT;
ALTER TABLE funds ADD COLUMN IF NOT EXISTS option_type TEXT;

UPDATE funds SET
  plan_type = CASE
    WHEN scheme_name ILIKE '%Direct%' THEN 'Direct'
    WHEN scheme_name ILIKE '%Regular%' THEN 'Regular'
    ELSE 'Unknown'
  END,
  option_type = CASE
    WHEN scheme_name ILIKE '%Growth%' THEN 'Growth'
    WHEN scheme_name ILIKE '%IDCW%' OR scheme_name ILIKE '%Dividend%' THEN 'IDCW'
    ELSE 'Unknown'
  END
WHERE plan_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_funds_plan_type ON funds(plan_type);
CREATE INDEX IF NOT EXISTS idx_funds_option_type ON funds(option_type);

-- ── 6. Verify ──
-- SELECT COUNT(*) AS master_fund_families FROM master_funds;
-- SELECT COUNT(*) AS linked_schemes FROM funds WHERE master_fund_id IS NOT NULL;
-- SELECT mf.strategy_name, COUNT(f.scheme_code) AS variants
--   FROM master_funds mf JOIN funds f ON f.master_fund_id = mf.id
--   GROUP BY mf.strategy_name ORDER BY variants DESC LIMIT 20;

COMMIT;
