-- Reverses migration 021
DROP INDEX IF EXISTS idx_percentile_category_metric;
DROP INDEX IF EXISTS idx_percentile_scheme_metric;
DROP TABLE IF EXISTS scheme_percentile;
