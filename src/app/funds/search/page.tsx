'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';

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

  // Popular AMCs
  const popularAMCs = [
    'HDFC', 'ICICI Prudential', 'SBI', 'Axis', 'Aditya Birla Sun Life',
    'Kotak', 'Nippon India', 'UTI', 'DSP', 'Franklin Templeton'
  ];

  // Categories (will be populated from database once category fetch completes)
  const categories = [
    'Equity', 'Debt', 'Hybrid', 'Solution Oriented', 'Index', 'ETF', 'FoF'
  ];

  // Search function
  const handleSearch = async () => {
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
      params.append('limit', '100');

      const response = await fetch(`/api/funds/search?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        let results = data.funds;

        // Apply plan type filter
        if (filters.planType !== 'All') {
          results = results.filter((fund: FundSearchResult) =>
            fund.schemeName.toLowerCase().includes(filters.planType.toLowerCase())
          );
        }

        // Apply sorting
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
    setFilters({ ...filters, amc });
    setTimeout(() => handleSearch(), 100);
  };

  return (
    <>
      <div className="pt-24"></div>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-brand-navy mb-4">
                Search <span className="text-brand-gold">14,083+ Mutual Funds</span>
              </h1>
              <p className="text-lg text-brand-navy/70 max-w-2xl mx-auto">
                Advanced search with filters, sorting, and real-time results from our comprehensive database
              </p>
            </div>

            {/* Search Bar */}
            <div className="card-light p-6 max-w-4xl mx-auto">
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search by fund name, scheme code, or keyword..."
                    value={filters.query}
                    onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal text-lg"
                  />
                  <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-brand-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-brand-royal text-white px-8 py-4 rounded-lg font-semibold hover:bg-brand-navy transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-white border-2 border-brand-royal text-brand-royal px-6 py-4 rounded-lg font-semibold hover:bg-brand-royal hover:text-white transition-all whitespace-nowrap"
                >
                  <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Filters
                </button>
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
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-brand-navy">
                        Found {searchResults.length} fund{searchResults.length !== 1 ? 's' : ''}
                      </h3>
                      <div className="text-sm text-brand-navy/70">
                        {filters.amc && <span className="mr-2">AMC: {filters.amc}</span>}
                        {filters.category && <span className="mr-2">Category: {filters.category}</span>}
                        {filters.planType !== 'All' && <span>Plan: {filters.planType}</span>}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {searchResults.map((fund) => (
                        <div
                          key={fund.schemeCode}
                          className="card-light p-6 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => viewFundDetails(fund.schemeCode)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="px-3 py-1 bg-brand-royal/10 text-brand-royal text-sm font-medium rounded-full">
                                  {fund.schemeCode}
                                </span>
                                {fund.amcCode && (
                                  <span className="px-3 py-1 bg-brand-gold/10 text-brand-gold text-sm font-medium rounded-full">
                                    {fund.amcCode}
                                  </span>
                                )}
                                {fund.schemeName.toLowerCase().includes('direct') && (
                                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                                    Direct Plan
                                  </span>
                                )}
                              </div>
                              <h4 className="text-lg font-semibold text-brand-navy mb-2 group-hover:text-brand-royal transition-colors">
                                {fund.schemeName}
                              </h4>
                              <div className="flex items-center gap-4 text-sm text-brand-navy/70">
                                {fund.latestNav && (
                                  <span className="font-semibold text-brand-navy">
                                    NAV: ₹{fund.latestNav.toFixed(4)}
                                  </span>
                                )}
                                {fund.latestNavDate && (
                                  <span>
                                    Updated: {new Date(fund.latestNavDate).toLocaleDateString('en-IN')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button className="bg-brand-royal text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy transition-all opacity-0 group-hover:opacity-100">
                              View Details →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
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
