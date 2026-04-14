ALTER TABLE fund_returns DROP CONSTRAINT IF EXISTS fund_returns_scheme_code_key;
-- NOTE: dedup in the up script is not reversible (rows were intentionally removed).
