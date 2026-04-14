DROP INDEX IF EXISTS idx_nav_tr_scheme_date;
ALTER TABLE nav_history DROP COLUMN IF EXISTS tr_nav;
DROP INDEX IF EXISTS idx_div_scheme_record;
DROP TABLE IF EXISTS scheme_dividend;
