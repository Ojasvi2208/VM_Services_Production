-- ============================================================
-- Migration 028: seed scheme_benchmark_map from funds.sub_category
-- Story: DATA-004 Benchmark ingestion (seed half)
-- Reversible: see migrations/down/028_scheme_benchmark_seed_down.sql
-- ============================================================
-- Reality: benchmark_data in prod contains NIFTY50 + NIFTYBANK daily
-- price close (not TRI), populated by the existing /api/cron/market-update
-- route. True TRI (CRISIL Total Return indices) is a follow-up when the
-- upstream CSV pipeline lands — tracked under DATA-004 extension.
--
-- For now we map each SEBI sub_category to the closest available series.
-- Fund Detail alpha/beta will use price-return beta (slight bias on
-- dividend-heavy schemes) — acceptable MVP, upgrade when TRI available.

INSERT INTO scheme_benchmark_map (scheme_code, benchmark_name, mapping_source)
SELECT
  f.scheme_code,
  CASE f.sub_category
    -- Equity: bank sector → NIFTYBANK, everything else → NIFTY50 (price proxy)
    WHEN 'Banking & PSU Fund'       THEN 'NIFTYBANK'
    WHEN 'Sectoral/Thematic'        THEN 'NIFTY50'
    WHEN 'Large Cap Fund'           THEN 'NIFTY50'
    WHEN 'Mid Cap Fund'             THEN 'NIFTY50'
    WHEN 'Small Cap Fund'           THEN 'NIFTY50'
    WHEN 'ELSS'                     THEN 'NIFTY50'
    WHEN 'Flexi Cap Fund'           THEN 'NIFTY50'
    WHEN 'Multi Cap Fund'           THEN 'NIFTY50'
    WHEN 'Large & Mid Cap Fund'     THEN 'NIFTY50'
    WHEN 'Value Fund'               THEN 'NIFTY50'
    WHEN 'Focused Fund'             THEN 'NIFTY50'
    WHEN 'Dividend Yield Fund'      THEN 'NIFTY50'
    WHEN 'Contra Fund'              THEN 'NIFTY50'
    WHEN 'Aggressive Hybrid Fund'   THEN 'NIFTY50'
    WHEN 'Balanced Advantage Fund'  THEN 'NIFTY50'
    WHEN 'Equity Savings Fund'      THEN 'NIFTY50'
    WHEN 'Multi-Asset Allocation Fund' THEN 'NIFTY50'
    WHEN 'Arbitrage Fund'           THEN 'NIFTY50'
    -- Debt + Liquid: no benchmark mapped until CRISIL series lands (DATA-004 ext)
    ELSE NULL
  END AS benchmark_name,
  'inferred'
FROM funds f
WHERE f.sub_category IS NOT NULL
  AND f.sub_category <> ''
  AND CASE f.sub_category
    WHEN 'Banking & PSU Fund'       THEN 'NIFTYBANK'
    WHEN 'Sectoral/Thematic'        THEN 'NIFTY50'
    WHEN 'Large Cap Fund'           THEN 'NIFTY50'
    WHEN 'Mid Cap Fund'             THEN 'NIFTY50'
    WHEN 'Small Cap Fund'           THEN 'NIFTY50'
    WHEN 'ELSS'                     THEN 'NIFTY50'
    WHEN 'Flexi Cap Fund'           THEN 'NIFTY50'
    WHEN 'Multi Cap Fund'           THEN 'NIFTY50'
    WHEN 'Large & Mid Cap Fund'     THEN 'NIFTY50'
    WHEN 'Value Fund'               THEN 'NIFTY50'
    WHEN 'Focused Fund'             THEN 'NIFTY50'
    WHEN 'Dividend Yield Fund'      THEN 'NIFTY50'
    WHEN 'Contra Fund'              THEN 'NIFTY50'
    WHEN 'Aggressive Hybrid Fund'   THEN 'NIFTY50'
    WHEN 'Balanced Advantage Fund'  THEN 'NIFTY50'
    WHEN 'Equity Savings Fund'      THEN 'NIFTY50'
    WHEN 'Multi-Asset Allocation Fund' THEN 'NIFTY50'
    WHEN 'Arbitrage Fund'           THEN 'NIFTY50'
    ELSE NULL
  END IS NOT NULL
ON CONFLICT (scheme_code) DO UPDATE
  SET benchmark_name = EXCLUDED.benchmark_name,
      mapping_source = EXCLUDED.mapping_source,
      updated_at     = CURRENT_TIMESTAMP;
