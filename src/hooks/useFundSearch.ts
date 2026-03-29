'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface FundResult {
  schemeCode: string;
  schemeName: string;
  latestNav?: number;
  latestNavDate?: string;
  amcCode?: string;
  schemeType?: string;
  category?: string;
  subCategory?: string;
  planType?: string;
  optionType?: string;
  return1y?: number;
  return3y?: number;
  return5y?: number;
  cagr3y?: number;
  cagr5y?: number;
  expenseRatio?: number;
  sharpeRatio?: number;
  variants?: Array<{ schemeCode?: string; planType?: string; optionType?: string; nav?: number; cagr3y?: number; cagr5y?: number }>;
}

export type SortMode = 'name' | 'cagr' | 'sharpe' | 'expense';

export const PAGE_SIZE = 12;

const AMC_DISPLAY_MAP: Record<string, string> = {
  'HDFC Mutual Fund':       'HDFC Mutual Fund',
  'SBI Mutual Fund':        'SBI Mutual Fund',
  'ICICI Prudential':       'ICICI Prudential',
  'Axis Asset Management':  'Axis Asset Management',
  'Kotak Mahindra':         'Kotak Mahindra',
  'Mirae Asset':            'Mirae Asset',
  'Nippon India':           'Nippon India',
  'UTI Mutual Fund':        'UTI Mutual Fund',
};

// Map display label → API query value
export const AMC_API_MAP: Record<string, string> = {
  'HDFC Mutual Fund':       'HDFC',
  'SBI Mutual Fund':        'SBI',
  'ICICI Prudential':       'ICICI Prudential',
  'Axis Asset Management':  'Axis',
  'Kotak Mahindra':         'Kotak',
  'Mirae Asset':            'Mirae',
  'Nippon India':           'Nippon',
  'UTI Mutual Fund':        'UTI',
};

export const CATEGORY_API_MAP: Record<string, string> = {
  'Large Cap':    'Large Cap',
  'Flexi Cap':    'Flexi Cap',
  'Debt':         'Debt',
  'Hybrid':       'Hybrid',
  'Small Cap':    'Small Cap',
  'ELSS':         'ELSS',
  'Index':        'Index',
  'Mid Cap':      'Mid Cap',
  'Equity Funds': 'Equity',
  'Debt Funds':   'Debt',
  'Hybrid Funds': 'Hybrid',
  'Index Funds':  'Index',
  'Thematic':     'Thematic',
};

export interface AutocompleteItem {
  schemeCode: string;
  schemeName: string;
  amcCode?: string;
}

export function useFundSearch() {
  const router = useRouter();

  // Search state
  const [query, setQueryState] = useState('');
  const [activeAmc, setActiveAmc] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('name');

  // Results state
  const [results, setResults] = useState<FundResult[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [engine, setEngine] = useState('');

  // Autocomplete
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Core fetch ────────────────────────────────────────────────
  const fetchResults = useCallback(async (
    q: string, amc: string, category: string, page: number
  ) => {
    // All filters cleared → reset to default state
    if (!q && !amc && !category) {
      setResults([]);
      setSearched(false);
      setTotal(0);
      setTotalPages(0);
      return;
    }

    setLoading(true);
    setSearched(true);
    setShowSuggestions(false);

    try {
      const params = new URLSearchParams();
      if (q)        params.set('q', q);
      if (amc)      params.set('amc', AMC_API_MAP[amc] ?? amc);
      if (category) params.set('category', CATEGORY_API_MAP[category] ?? category);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const res = await fetch(`/api/funds/search?${params}`);
      const data = await res.json();

      if (data.success) {
        setResults(data.funds ?? []);
        setTotal(data.total ?? 0);
        setCurrentPage(data.page ?? 1);
        setTotalPages(data.totalPages ?? 0);
        setEngine(data.engine ?? '');
      }
    } catch (e) {
      console.error('Fund search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Query change — 300ms debounce for autocomplete ────────────
  const handleQueryChange = useCallback((value: string) => {
    setQueryState(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (value.length >= 2) {
        try {
          const res = await fetch(`/api/funds/autocomplete?q=${encodeURIComponent(value)}`);
          const data = await res.json();
          if (data.success && data.suggestions?.length > 0) {
            setSuggestions(data.suggestions.slice(0, 7));
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        } catch { /* silent */ }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  }, []);

  // ── Explicit search (Enter / button) ─────────────────────────
  const handleSearch = useCallback((page = 1) => {
    fetchResults(query, activeAmc, activeCategory, page);
  }, [query, activeAmc, activeCategory, fetchResults]);

  // ── AMC pill toggle ───────────────────────────────────────────
  const handleAmcToggle = useCallback((amc: string) => {
    const next = activeAmc === amc ? '' : amc;
    setActiveAmc(next);
    setCurrentPage(1);
    fetchResults(query, next, activeCategory, 1);
  }, [activeAmc, activeCategory, query, fetchResults]);

  // ── Category pill toggle ──────────────────────────────────────
  const handleCategoryToggle = useCallback((cat: string) => {
    const next = activeCategory === cat ? '' : cat;
    setActiveCategory(next);
    setCurrentPage(1);
    fetchResults(query, activeAmc, next, 1);
  }, [activeCategory, activeAmc, query, fetchResults]);

  // ── Autocomplete click → navigate to fund detail ──────────────
  const handleSuggestionClick = useCallback((s: AutocompleteItem) => {
    setShowSuggestions(false);
    router.push(`/funds/${s.schemeCode}`);
  }, [router]);

  // ── Pagination ────────────────────────────────────────────────
  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchResults(query, activeAmc, activeCategory, page);
    window.scrollTo({ top: 520, behavior: 'smooth' });
  }, [query, activeAmc, activeCategory, totalPages, fetchResults]);

  // ── Reset ─────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setQueryState('');
    setActiveAmc('');
    setActiveCategory('');
    setResults([]);
    setSearched(false);
    setTotal(0);
    setTotalPages(0);
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  // ── Click-outside: hide suggestions ──────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.closest('[data-search-root]')?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return {
    query, handleQueryChange,
    activeAmc, handleAmcToggle,
    activeCategory, handleCategoryToggle,
    sortBy, setSortBy,
    results, total, currentPage, totalPages, loading, searched, engine,
    suggestions, showSuggestions, setShowSuggestions,
    searchInputRef,
    handleSearch, handleSuggestionClick,
    goToPage, reset,
  };
}
