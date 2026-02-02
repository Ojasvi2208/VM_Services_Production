'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';

interface AutocompleteSuggestion {
  schemeCode: string;
  schemeName: string;
  amcCode?: string;
}

interface FundSearchResult {
  schemeCode: string;
  schemeName: string;
  latestNav?: number;
  latestNavDate?: string;
  amcCode?: string;
  schemeType?: string;
  category?: string;
}

interface SearchFilters {
  query: string;
  amc: string;
  category: string;
  sortBy: 'name' | 'nav' | 'recent';
  planType: 'Direct' | 'Regular' | 'All';
}

const PAGE_SIZE = 10;

export default function EnhancedFundSearchPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    amc: '',
    category: '',
    sortBy: 'name',
    planType: 'All'
  });
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalFunds, setTotalFunds] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Popular AMCs
  const popularAMCs = [
    'HDFC', 'ICICI Prudential', 'SBI', 'Axis', 'Aditya Birla Sun Life',
    'Kotak', 'Nippon India', 'UTI', 'DSP', 'Franklin Templeton'
  ];

  // Categories (will be populated from database once category fetch completes)
  const categories = [
    'Equity', 'Debt', 'Hybrid', 'Solution Oriented', 'Index', 'ETF', 'FoF'
  ];

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/funds/autocomplete?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.success && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setFilters({ ...filters, query: value });
    
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new debounced fetch
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 200);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    setFilters({ ...filters, query: suggestion.schemeName });
    setShowSuggestions(false);
    setSuggestions([]);
    // Navigate directly to fund details
    router.push(`/funds/${suggestion.schemeCode}`);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search function with pagination
  const handleSearch = async (page: number = 1) => {
    if (!filters.query && !filters.amc && !filters.category) {
      alert('Please enter a search term or select a filter');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams();
      if (filters.query) params.append('q', filters.query);
      if (filters.amc) params.append('amc', filters.amc);
      if (filters.category) params.append('category', filters.category);
      if (filters.planType !== 'All') params.append('planType', filters.planType);
      params.append('page', page.toString());
      params.append('pageSize', PAGE_SIZE.toString());

      const response = await fetch(`/api/funds/search?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        let results = data.funds;

        // Apply sorting (client-side)
        if (filters.sortBy === 'nav') {
          results.sort((a: FundSearchResult, b: FundSearchResult) =>
            (b.latestNav || 0) - (a.latestNav || 0)
          );
        } else if (filters.sortBy === 'recent') {
          results.sort((a: FundSearchResult, b: FundSearchResult) => {
            const dateA = new Date(a.latestNavDate || 0).getTime();
            const dateB = new Date(b.latestNavDate || 0).getTime();
            return dateB - dateA;
          });
        }

        setSearchResults(results);
        setTotalFunds(data.total);
        setCurrentPage(data.page);
        setTotalPages(data.totalPages);
      } else {
        alert('Error searching funds: ' + data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Error searching funds');
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      handleSearch(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      query: '',
      amc: '',
      category: '',
      sortBy: 'name',
      planType: 'All'
    });
    setSearched(false);
    setSearchResults([]);
  };

  // View fund details
  const viewFundDetails = (schemeCode: string) => {
    router.push(`/funds/${schemeCode}`);
  };

  // Quick filter by AMC
  const quickFilterAMC = (amc: string) => {
    setFilters({ ...filters, query: amc, amc: '' });
    setTimeout(() => handleSearch(1), 100);
  };

  return (
    <>
      <div className="pt-24"></div>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center mb-6 md:mb-8 px-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-brand-navy mb-3 md:mb-4">
                Search <span className="text-brand-gold">14,083+ Mutual Funds</span>
              </h1>
              <p className="text-sm md:text-lg text-brand-navy/70 max-w-2xl mx-auto">
                Advanced search with filters, sorting, and real-time results
              </p>
            </div>

            {/* Search Bar */}
            <div className="card-light p-4 md:p-6 max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-4">
                <div className="flex-1 relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search fund name or code..."
                    value={filters.query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        setShowSuggestions(false);
                        handleSearch(1);
                      }
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    className="w-full px-4 py-3 md:py-4 pl-10 md:pl-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal text-base md:text-lg"
                  />
                  <svg className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-brand-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  
                  {/* Autocomplete Suggestions Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div 
                      ref={suggestionsRef}
                      className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto"
                    >
                      {loadingSuggestions && (
                        <div className="px-4 py-3 text-sm text-brand-navy/60 flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-brand-royal border-t-transparent rounded-full"></div>
                          Loading...
                        </div>
                      )}
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.schemeCode}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className={`w-full text-left px-4 py-3 hover:bg-brand-royal/10 transition-colors border-b border-gray-100 last:border-b-0 ${
                            index === 0 ? 'rounded-t-lg' : ''
                          } ${index === suggestions.length - 1 ? 'rounded-b-lg' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm md:text-base font-medium text-brand-navy truncate">
                                {suggestion.schemeName}
                              </p>
                              <p className="text-xs text-brand-navy/60 mt-0.5">
                                Code: {suggestion.schemeCode}
                                {suggestion.amcCode && ` • ${suggestion.amcCode.replace(' Mutual Fund', '')}`}
                              </p>
                            </div>
                            <svg className="w-4 h-4 text-brand-royal flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                      <div className="px-4 py-2 bg-gray-50 text-xs text-brand-navy/50 rounded-b-lg">
                        Click to view fund details or press Enter to search
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 md:gap-4">
                  <button
                    onClick={() => handleSearch(1)}
                    disabled={loading}
                    className="flex-1 md:flex-none bg-brand-royal text-white px-4 md:px-8 py-3 md:py-4 rounded-lg font-semibold hover:bg-brand-navy transition-all disabled:opacity-50 whitespace-nowrap text-sm md:text-base"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="bg-white border-2 border-brand-royal text-brand-royal px-3 md:px-6 py-3 md:py-4 rounded-lg font-semibold hover:bg-brand-royal hover:text-white transition-all whitespace-nowrap"
                  >
                    <svg className="w-5 h-5 inline md:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span className="hidden md:inline">Filters</span>
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="border-t-2 border-gray-200 pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* AMC Filter */}
                    <div>
                      <label className="block text-sm font-medium text-brand-navy mb-2">
                        AMC / Fund House
                      </label>
                      <select
                        value={filters.amc}
                        onChange={(e) => setFilters({ ...filters, amc: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                      >
                        <option value="">All AMCs</option>
                        {popularAMCs.map(amc => (
                          <option key={amc} value={amc}>{amc}</option>
                        ))}
                      </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="block text-sm font-medium text-brand-navy mb-2">
                        Category
                      </label>
                      <select
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                      >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Plan Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-brand-navy mb-2">
                        Plan Type
                      </label>
                      <select
                        value={filters.planType}
                        onChange={(e) => setFilters({ ...filters, planType: e.target.value as any })}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                      >
                        <option value="All">All Plans</option>
                        <option value="Direct">Direct Plan</option>
                        <option value="Regular">Regular Plan</option>
                      </select>
                    </div>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-sm font-medium text-brand-navy mb-2">
                      Sort By
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'name', label: 'Name (A-Z)' },
                        { value: 'nav', label: 'NAV (High to Low)' },
                        { value: 'recent', label: 'Recently Updated' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => setFilters({ ...filters, sortBy: option.value as any })}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            filters.sortBy === option.value
                              ? 'bg-brand-royal text-white'
                              : 'bg-gray-100 text-brand-navy hover:bg-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reset Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={resetFilters}
                      className="text-brand-royal hover:text-brand-navy font-medium"
                    >
                      Reset All Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick AMC Filters */}
            {!searched && (
              <div className="max-w-4xl mx-auto">
                <h3 className="text-xl font-semibold text-brand-navy mb-4 flex items-center">
                  <span className="w-2 h-2 bg-brand-gold rounded-full mr-3 animate-pulse"></span>
                  Popular AMCs
                </h3>
                <div className="flex flex-wrap gap-3">
                  {popularAMCs.map((amc) => (
                    <button
                      key={amc}
                      onClick={() => quickFilterAMC(amc)}
                      className="px-6 py-3 bg-white border-2 border-brand-royal/20 text-brand-navy rounded-lg font-medium hover:border-brand-royal hover:bg-brand-royal hover:text-white transition-all"
                    >
                      {amc}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {searched && !loading && (
              <div className="max-w-4xl mx-auto">
                {searchResults.length > 0 ? (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                      <h3 className="text-lg md:text-xl font-semibold text-brand-navy">
                        Found {totalFunds} fund{totalFunds !== 1 ? 's' : ''} 
                        <span className="text-brand-navy/60 text-sm md:text-base font-normal ml-1 md:ml-2 block md:inline">
                          (Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalFunds)} of {totalFunds})
                        </span>
                      </h3>
                      <div className="text-xs md:text-sm text-brand-navy/70">
                        {filters.amc && <span className="mr-2">AMC: {filters.amc}</span>}
                        {filters.category && <span className="mr-2">Category: {filters.category}</span>}
                        {filters.planType !== 'All' && <span>Plan: {filters.planType}</span>}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {searchResults.map((fund) => (
                        <div
                          key={fund.schemeCode}
                          className="card-light p-4 md:p-6 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => viewFundDetails(fund.schemeCode)}
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="px-2 py-0.5 md:px-3 md:py-1 bg-brand-royal/10 text-brand-royal text-xs md:text-sm font-medium rounded-full">
                                  {fund.schemeCode}
                                </span>
                                {fund.schemeName.toLowerCase().includes('direct') && (
                                  <span className="px-2 py-0.5 md:px-3 md:py-1 bg-green-100 text-green-700 text-xs md:text-sm font-medium rounded-full">
                                    Direct
                                  </span>
                                )}
                              </div>
                              <h4 className="text-base md:text-lg font-semibold text-brand-navy mb-2 group-hover:text-brand-royal transition-colors leading-tight">
                                {fund.schemeName}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-brand-navy/70">
                                {fund.latestNav && (
                                  <span className="font-semibold text-brand-navy">
                                    NAV: ₹{fund.latestNav.toFixed(4)}
                                  </span>
                                )}
                                {fund.latestNavDate && (
                                  <span>
                                    {new Date(fund.latestNavDate).toLocaleDateString('en-IN')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button className="w-full md:w-auto bg-brand-royal text-white px-4 md:px-6 py-2 rounded-lg font-medium hover:bg-brand-navy transition-all md:opacity-0 md:group-hover:opacity-100 text-sm">
                              View Details →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-6 md:mt-8">
                        {/* Previous Button */}
                        <button
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-all text-sm md:text-base ${
                            currentPage === 1
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-white border-2 border-brand-royal text-brand-royal hover:bg-brand-royal hover:text-white'
                          }`}
                        >
                          <span className="hidden md:inline">←</span> Prev
                        </button>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-1">
                          {/* First page */}
                          {currentPage > 3 && (
                            <>
                              <button
                                onClick={() => goToPage(1)}
                                className="w-10 h-10 rounded-lg font-medium bg-white border border-gray-200 text-brand-navy hover:bg-brand-royal hover:text-white transition-all"
                              >
                                1
                              </button>
                              {currentPage > 4 && <span className="px-2 text-brand-navy/50">...</span>}
                            </>
                          )}

                          {/* Pages around current */}
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            if (pageNum < 1 || pageNum > totalPages) return null;
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => goToPage(pageNum)}
                                className={`w-8 h-8 md:w-10 md:h-10 rounded-lg font-medium transition-all text-sm md:text-base ${
                                  currentPage === pageNum
                                    ? 'bg-brand-royal text-white'
                                    : 'bg-white border border-gray-200 text-brand-navy hover:bg-brand-royal hover:text-white'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          {/* Last page */}
                          {currentPage < totalPages - 2 && totalPages > 5 && (
                            <>
                              {currentPage < totalPages - 3 && <span className="px-2 text-brand-navy/50">...</span>}
                              <button
                                onClick={() => goToPage(totalPages)}
                                className="w-10 h-10 rounded-lg font-medium bg-white border border-gray-200 text-brand-navy hover:bg-brand-royal hover:text-white transition-all"
                              >
                                {totalPages}
                              </button>
                            </>
                          )}
                        </div>

                        {/* Next Button */}
                        <button
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-all text-sm md:text-base ${
                            currentPage === totalPages
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-white border-2 border-brand-royal text-brand-royal hover:bg-brand-royal hover:text-white'
                          }`}
                        >
                          Next <span className="hidden md:inline">→</span>
                        </button>
                      </div>
                    )}

                    {/* Page Info */}
                    {totalPages > 1 && (
                      <div className="text-center mt-4 text-sm text-brand-navy/60">
                        Page {currentPage} of {totalPages} • {PAGE_SIZE} funds per page
                      </div>
                    )}
                  </>
                ) : (
                  <div className="card-light p-12 text-center">
                    <div className="w-20 h-20 bg-brand-pearl rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-brand-navy mb-2">No Funds Found</h3>
                    <p className="text-brand-navy/70 mb-4">
                      No funds match your search criteria
                    </p>
                    <button
                      onClick={resetFilters}
                      className="bg-brand-royal text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy transition-all"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="card-light p-12 text-center max-w-2xl mx-auto">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-royal border-t-transparent mb-4"></div>
                <p className="text-brand-navy/70">Searching 14,083+ funds...</p>
              </div>
            )}

            {/* Info Box */}
            <div className="card-light p-6 bg-blue-50 border-l-4 border-blue-400 max-w-4xl mx-auto">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Search Tips</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-blue-800">
                <li>Use filters to narrow down results by AMC, category, or plan type</li>
                <li>Search by fund name, scheme code, or keywords</li>
                <li>Sort results by name, NAV value, or recent updates</li>
                <li>Click on any fund to view detailed information and charts</li>
                <li>Direct plans typically have lower expense ratios</li>
              </ul>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
