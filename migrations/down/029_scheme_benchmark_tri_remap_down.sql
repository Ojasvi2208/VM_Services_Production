-- Rollback migration 029: restore migration 028's price-proxy mapping.
-- Only reverts rows that 029 itself changed (mapping_source = 'inferred_tri').

UPDATE scheme_benchmark_map m
SET    benchmark_name = CASE f.sub_category
           WHEN 'Banking & PSU Fund' THEN 'NIFTYBANK'
           ELSE 'NIFTY50'
         END,
       mapping_source = 'inferred'
FROM   funds f
WHERE  m.scheme_code = f.scheme_code
  AND  m.mapping_source = 'inferred_tri';
