'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import PlanTypeToggle from '@/components/PlanTypeToggle';

interface FundResult {
  schemeCode: string;
  schemeName: string;
  latestNav: number;
  latestNavDate: string;
  amcCode: string;
  schemeType: string;
}

// SEBI Fund Categories as per October 2017 guidelines
const FUND_CATEGORIES = {
  'Equity Schemes': {
    'Large Cap': ['Large Cap Fund'],
    'Mid Cap': ['Mid Cap Fund'],
    'Small Cap': ['Small Cap Fund'],
    'Multi/Flexi Cap': ['Multi Cap Fund', 'Flexi Cap Fund'],
    'Large & Mid Cap': ['Large & Mid Cap Fund'],
    'Focused': ['Focused Fund'],
    'Sectoral/Thematic': ['Pharma', 'Banking', 'Technology', 'FMCG', 'Infrastructure', 'PSU', 'MNC'],
    'Value/Contra': ['Value Fund', 'Contra Fund'],
    'Dividend Yield': ['Dividend Yield Fund'],
    'ELSS': ['ELSS', 'Tax Saver']
  },
  'Debt Schemes': {
    'Liquid': ['Liquid Fund'],
    'Ultra Short Duration': ['Ultra Short Duration Fund'],
    'Low Duration': ['Low Duration Fund'],
    'Money Market': ['Money Market Fund'],
    'Short Duration': ['Short Duration Fund'],
    'Medium Duration': ['Medium Duration Fund'],
    'Medium to Long Duration': ['Medium to Long Duration Fund'],
    'Long Duration': ['Long Duration Fund'],
    'Dynamic Bond': ['Dynamic Bond Fund'],
    'Corporate Bond': ['Corporate Bond Fund'],
    'Credit Risk': ['Credit Risk Fund'],
    'Banking & PSU': ['Banking and PSU Fund', 'Banking & PSU'],
    'Gilt': ['Gilt Fund'],
    'Floater': ['Floater Fund', 'Floating Rate']
  },
  'Hybrid Schemes': {
    'Conservative Hybrid': ['Conservative Hybrid Fund'],
    'Balanced Hybrid': ['Balanced Hybrid Fund', 'Balanced Advantage'],
    'Aggressive Hybrid': ['Aggressive Hybrid Fund'],
    'Dynamic Asset Allocation': ['Dynamic Asset Allocation'],
    'Multi Asset Allocation': ['Multi Asset Allocation'],
    'Arbitrage': ['Arbitrage Fund'],
    'Equity Savings': ['Equity Savings']
  },
  'Solution Oriented': {
    'Retirement': ['Retirement Fund'],
    'Children': ['Children Fund', 'Child']
  },
  'Other Schemes': {
    'Index Funds': ['Index Fund', 'Index'],
    'ETF': ['ETF', 'Exchange Traded'],
    'Fund of Funds': ['Fund of Funds', 'FoF'],
    'Gold': ['Gold ETF', 'Gold'],
    'International': ['International Fund', 'Global', 'Overseas']
  }
};


export default function AdvancedFundSearchPage() {
  const router = useRouter();
  
  // Filter states
  const [selectedAMC, setSelectedAMC] = useState<string>('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [planType, setPlanType] = useState<'Regular' | 'Direct' | 'All'>('Regular');
  
  // Results
  const [funds, setFunds] = useState<FundResult[]>([]);
  const [filteredFunds, setFilteredFunds] = useState<FundResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalFunds, setTotalFunds] = useState(0);
  
  // Real AMCs from database
  const [availableAMCs, setAvailableAMCs] = useState<string[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const ITEMS_PER_PAGE = 25;

  // Load AMCs and categories on mount
  useEffect(() => {
    loadMetadata();
  }, []);

  // Search funds whenever filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Reset to page 1 when filters change
      searchFunds(1);
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [selectedAMC, selectedMainCategory, selectedSubCategory, searchQuery, planType]);

  const loadMetadata = async () => {
    try {
      const response = await fetch('/api/funds/all');
      const data = await response.json();
      
      if (data.success) {
        setTotalFunds(data.total);
        setAvailableAMCs(data.amcs || []);
        console.log(`✅ Database has ${data.total} funds from ${data.amcs?.length} AMCs`);
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
  };

  const searchFunds = async (page: number = 1) => {
    // Always search with at least plan type filter
    // Don't require other filters if plan type is selected
    if (!selectedAMC && !selectedMainCategory && !selectedSubCategory && !searchQuery && planType === 'All') {
      setFilteredFunds([]);
      setTotalResults(0);
      return;
    }

    setLoading(true);
    try {
      // Build search terms
      // If sub-category is selected, use it (more specific)
      // If only main category is selected, search for all funds in that category
      let categoryToSearch = '';
      
      if (selectedSubCategory) {
        // Use exact sub-category for precise matching
        categoryToSearch = selectedSubCategory;
      } else if (selectedMainCategory) {
        // Use main category - will match any fund in that category
        categoryToSearch = selectedMainCategory.replace(' Schemes', '');
      }
      
      const response = await fetch('/api/funds/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          amc: selectedAMC,
          category: '', // Don't use main category separately
          subCategory: categoryToSearch, // Use the specific filter
          planType: planType === 'All' ? '' : planType, // Filter by plan type
          limit: 500, // Get more results for pagination
          offset: 0
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Store all results
        setFilteredFunds(data.funds);
        setTotalResults(data.funds.length);
        setCurrentPage(page);
        console.log(`✅ Found ${data.funds.length} funds`);
      }
    } catch (error) {
      console.error('Error searching funds:', error);
      setFilteredFunds([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };


  const resetFilters = () => {
    setSelectedAMC('');
    setSelectedMainCategory('');
    setSelectedSubCategory('');
    setSearchQuery('');
    setPlanType('Regular');
    setCurrentPage(1);
    setFilteredFunds([]);
    setTotalResults(0);
  };

  // Get paginated results
  const getPaginatedFunds = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredFunds.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getSubCategories = () => {
    if (!selectedMainCategory) return [];
    return Object.keys(FUND_CATEGORIES[selectedMainCategory as keyof typeof FUND_CATEGORIES] || {});
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
                Advanced <span className="text-brand-gold">Fund Search</span>
              </h1>
              <p className="text-lg text-brand-navy/70 max-w-2xl mx-auto mb-6">
                Search funds by AMC, Category, and Sub-category as per SEBI guidelines
              </p>
              
              {/* Plan Type Toggle */}
              <div className="flex justify-center">
                <PlanTypeToggle value={planType} onChange={setPlanType} />
              </div>
            </div>

            {/* Filters */}
            <div className="card-light p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* AMC Filter */}
                <div>
                  <label className="block text-sm font-semibold text-brand-navy mb-2">
                    1. Select AMC
                  </label>
                  <select
                    value={selectedAMC}
                    onChange={(e) => setSelectedAMC(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                  >
                    <option value="">All AMCs ({availableAMCs.length})</option>
                    {availableAMCs.map(amc => (
                      <option key={amc} value={amc}>{amc.replace(' Mutual Fund', '')}</option>
                    ))}
                  </select>
                </div>

                {/* Main Category Filter */}
                <div>
                  <label className="block text-sm font-semibold text-brand-navy mb-2">
                    2. Select Category
                  </label>
                  <select
                    value={selectedMainCategory}
                    onChange={(e) => {
                      setSelectedMainCategory(e.target.value);
                      setSelectedSubCategory('');
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                  >
                    <option value="">All Categories</option>
                    {Object.keys(FUND_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Sub-Category Filter */}
                <div>
                  <label className="block text-sm font-semibold text-brand-navy mb-2">
                    3. Select Sub-category
                  </label>
                  <select
                    value={selectedSubCategory}
                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                    disabled={!selectedMainCategory}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">All Sub-categories</option>
                    {getSubCategories().map(subCat => (
                      <option key={subCat} value={subCat}>{subCat}</option>
                    ))}
                  </select>
                </div>

                {/* Search Box */}
                <div>
                  <label className="block text-sm font-semibold text-brand-navy mb-2">
                    4. Search by Name/Code
                  </label>
                  <input
                    type="text"
                    placeholder="Fund name or code"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                  />
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-brand-navy/70">
                  {totalResults > 0 ? (
                    <>
                      Showing <span className="font-semibold text-brand-royal">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalResults)}</span> of <span className="font-semibold text-brand-royal">{totalResults}</span> results
                      {totalResults > ITEMS_PER_PAGE && <span className="ml-1">• Page {currentPage} of {totalPages}</span>}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{totalFunds.toLocaleString()}</span> funds in database
                      {!selectedAMC && !selectedMainCategory && !searchQuery && (
                        <span className="ml-1">• Apply filters to search</span>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={resetFilters}
                  className="text-brand-royal hover:text-brand-navy font-medium text-sm"
                >
                  Reset All Filters
                </button>
              </div>
            </div>

            {/* Active Filters */}
            {(selectedAMC || selectedMainCategory || selectedSubCategory || searchQuery) && (
              <div className="flex flex-wrap gap-2">
                {selectedAMC && (
                  <span className="px-4 py-2 bg-brand-royal/10 text-brand-royal rounded-full text-sm font-medium flex items-center gap-2">
                    AMC: {selectedAMC.replace(' Mutual Fund', '')}
                    <button onClick={() => setSelectedAMC('')} className="hover:text-brand-navy">×</button>
                  </span>
                )}
                {selectedMainCategory && (
                  <span className="px-4 py-2 bg-brand-gold/10 text-brand-gold rounded-full text-sm font-medium flex items-center gap-2">
                    {selectedMainCategory}
                    <button onClick={() => setSelectedMainCategory('')} className="hover:text-yellow-700">×</button>
                  </span>
                )}
                {selectedSubCategory && (
                  <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-2">
                    {selectedSubCategory}
                    <button onClick={() => setSelectedSubCategory('')} className="hover:text-green-900">×</button>
                  </span>
                )}
                {searchQuery && (
                  <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                    Search: "{searchQuery}"
                    <button onClick={() => setSearchQuery('')} className="hover:text-blue-900">×</button>
                  </span>
                )}
              </div>
            )}

            {/* Results */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-royal"></div>
              </div>
            ) : totalResults > 0 ? (
              <>
                <div className="grid gap-4">
                  {getPaginatedFunds().map((fund) => (
                  <div
                    key={fund.schemeCode}
                    className="card-light p-6 hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => router.push(`/funds/${fund.schemeCode}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="px-3 py-1 bg-brand-royal/10 text-brand-royal text-sm font-medium rounded-full">
                            {fund.schemeCode}
                          </span>
                          <span className="px-3 py-1 bg-brand-gold/10 text-brand-gold text-sm font-medium rounded-full">
                            {fund.schemeType}
                          </span>
                        </div>
                        <h4 className="text-lg font-semibold text-brand-navy mb-2 group-hover:text-brand-royal transition-colors">
                          {fund.schemeName}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-brand-navy/70">
                          <span>AMC: {fund.amcCode.replace(' Mutual Fund', '')}</span>
                          <span>Latest NAV: ₹{fund.latestNav.toFixed(4)}</span>
                          <span>Date: {new Date(fund.latestNavDate).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                      <button className="bg-brand-royal text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy transition-all opacity-0 group-hover:opacity-100">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg border-2 border-brand-royal text-brand-royal font-medium hover:bg-brand-royal hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>

                  <div className="flex items-center gap-2">
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

                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-brand-royal text-white'
                              : 'border-2 border-gray-200 text-brand-navy hover:border-brand-royal'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg border-2 border-brand-royal text-brand-royal font-medium hover:bg-brand-royal hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
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
                  Try adjusting your filters or search criteria
                </p>
                <button
                  onClick={resetFilters}
                  className="bg-brand-royal text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy transition-all"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* Category Guide */}
            <div className="card-light p-6 bg-blue-50 border-l-4 border-blue-400">
              <h3 className="font-semibold text-blue-900 mb-3">📚 SEBI Fund Categories</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-blue-800">
                {Object.entries(FUND_CATEGORIES).map(([mainCat, subCats]) => (
                  <div key={mainCat}>
                    <p className="font-semibold mb-1">{mainCat}</p>
                    <ul className="list-disc pl-5 space-y-0.5 text-xs">
                      {Object.keys(subCats).slice(0, 5).map(subCat => (
                        <li key={subCat}>{subCat}</li>
                      ))}
                      {Object.keys(subCats).length > 5 && (
                        <li className="text-blue-600">+{Object.keys(subCats).length - 5} more</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
