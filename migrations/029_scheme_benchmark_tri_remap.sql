-- ============================================================
-- Migration 029: remap scheme_benchmark_map to NSE-TRI benchmarks
-- Story: Path F (DATA-004 real TRI cutover)
-- Reversible: see migrations/down/029_scheme_benchmark_tri_remap_down.sql
-- ============================================================
-- Replaces the NIFTY50/NIFTYBANK price-proxy mapping from migration 028
-- with category-aware TRI indices now available post-nse_index_history:
--   NIFTY50_TRI, NIFTYBANK_TRI, NIFTYMIDCAP150_TRI, NIFTYSMALLCAP250_TRI
--
-- Idempotent: UPDATE by category; safe to re-run.
-- ============================================================

-- Equity broad-market / flexi / focused / ELSS / etc → NIFTY50_TRI
UPDATE scheme_benchmark_map m
SET    benchmark_name = 'NIFTY50_TRI',
       mapping_source = 'inferred_tri'
FROM   funds f
WHERE  m.scheme_code = f.scheme_code
  AND  f.sub_category IN (
        'Sectoral/Thematic', 'Large Cap Fund', 'Large & Mid Cap Fund',
        'ELSS', 'Flexi Cap Fund', 'Multi Cap Fund', 'Value Fund',
        'Focused Fund', 'Dividend Yield Fund', 'Contra Fund',
        'Aggressive Hybrid Fund', 'Balanced Advantage Fund',
        'Equity Savings Fund', 'Multi-Asset Allocation Fund',
        'Arbitrage Fund'
  );

-- Mid Cap → NIFTYMIDCAP150_TRI (proper peer benchmark; R² was 0.22 vs NIFTY50)
UPDATE scheme_benchmark_map m
SET    benchmark_name = 'NIFTYMIDCAP150_TRI',
       mapping_source = 'inferred_tri'
FROM   funds f
WHERE  m.scheme_code = f.scheme_code
  AND  f.sub_category = 'Mid Cap Fund';

-- Small Cap → NIFTYSMALLCAP250_TRI
UPDATE scheme_benchmark_map m
SET    benchmark_name = 'NIFTYSMALLCAP250_TRI',
       mapping_source = 'inferred_tri'
FROM   funds f
WHERE  m.scheme_code = f.scheme_code
  AND  f.sub_category = 'Small Cap Fund';

-- Banking / Financial Services → NIFTYBANK_TRI
UPDATE scheme_benchmark_map m
SET    benchmark_name = 'NIFTYBANK_TRI',
       mapping_source = 'inferred_tri'
FROM   funds f
WHERE  m.scheme_code = f.scheme_code
  AND  f.sub_category = 'Banking & PSU Fund';

-- Debt + Liquid remain NULL (no TRI benchmark ingested yet).
-- mapping_source value 'inferred_tri' lets us distinguish these rows from
-- migration 028's price-proxy 'inferred' stamps for any future audit.
