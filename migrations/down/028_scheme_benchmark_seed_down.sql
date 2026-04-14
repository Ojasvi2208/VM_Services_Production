-- Clear only the rows this seed inserted (mapping_source='inferred').
DELETE FROM scheme_benchmark_map WHERE mapping_source = 'inferred';
