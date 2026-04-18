-- 030_mfdata_schema_down.sql
-- Reverse of 030_mfdata_schema.sql
-- Drops all mfdata-specific tables and columns. DATA LOSS — do not run in production without backup.

BEGIN;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS mfdata_sync_log CASCADE;
DROP TABLE IF EXISTS scheme_allocation CASCADE;
DROP TABLE IF EXISTS mfdata_fund_managers CASCADE;
DROP TABLE IF EXISTS category_benchmarks CASCADE;
DROP TABLE IF EXISTS fund_overlap_cache CASCADE;
DROP TABLE IF EXISTS credit_quality CASCADE;
DROP TABLE IF EXISTS fund_fundamentals CASCADE;

-- Drop fund_top_holdings additions (but keep the table itself — PDF engine owns it)
ALTER TABLE fund_top_holdings DROP COLUMN IF EXISTS source;
ALTER TABLE fund_top_holdings DROP COLUMN IF EXISTS fetched_at;
DROP INDEX IF EXISTS idx_holdings_stock_mfdata;

-- Drop fund_returns additions
ALTER TABLE fund_returns DROP COLUMN IF EXISTS r_squared;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS jensens_alpha;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS treynor_ratio;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS information_ratio;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS capture_up;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS capture_down;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS max_drawdown;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS max_drawdown_date;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rank_1m;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rank_3m;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rank_6m;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rank_1y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rank_3y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rank_5y;
ALTER TABLE fund_returns DROP COLUMN IF EXISTS rank_total;

-- Drop funds additions
ALTER TABLE funds DROP COLUMN IF EXISTS min_lumpsum;
ALTER TABLE funds DROP COLUMN IF EXISTS min_additional;
ALTER TABLE funds DROP COLUMN IF EXISTS morningstar_rating;
ALTER TABLE funds DROP COLUMN IF EXISTS morningstar_sec_id;
ALTER TABLE funds DROP COLUMN IF EXISTS risk_label;
ALTER TABLE funds DROP COLUMN IF EXISTS benchmark_name;
ALTER TABLE funds DROP COLUMN IF EXISTS day_change_pct;
ALTER TABLE funds DROP COLUMN IF EXISTS mfdata_family_id;
ALTER TABLE funds DROP COLUMN IF EXISTS mfdata_amfi_code;
ALTER TABLE funds DROP COLUMN IF EXISTS mfdata_isin;
ALTER TABLE funds DROP COLUMN IF EXISTS mfdata_last_synced_at;

-- Drop fund_families last (referenced by others)
DROP TABLE IF EXISTS fund_families CASCADE;

COMMIT;
