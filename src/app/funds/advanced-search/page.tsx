'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';

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

const selectCls = 'w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-3 py-2.5 text-sm text-[#dce5df] focus:outline-none focus:border-[#44f593]/50 transition-all [color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed';
const labelCls = 'text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2';
const inputCls = 'w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-3 py-2.5 text-sm text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:border-[#44f593]/50 transition-all';

export default function AdvancedFundSearchPage() {
  const router = useRouter();

  const [selectedAMC, setSelectedAMC] = useState<string>('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [planType, setPlanType] = useState<'Regular' | 'Direct' | 'All'>('Regular');

  const [filteredFunds, setFilteredFunds] = useState<FundResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalFunds, setTotalFunds] = useState(0);
  const [availableAMCs, setAvailableAMCs] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => { loadMetadata(); }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      searchFunds(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedAMC, selectedMainCategory, selectedSubCategory, searchQuery, planType]);

  const loadMetadata = async () => {
    try {
      const response = await fetch('/api/funds/all');
      const data = await response.json();
      if (data.success) {
        setTotalFunds(data.total);
        setAvailableAMCs(data.amcs || []);
      }
    } catch { /* silent */ }
  };

  const searchFunds = async (page: number = 1) => {
    const hasAnyFilter = selectedAMC || selectedMainCategory || selectedSubCategory || searchQuery || planType !== 'All';
    if (!hasAnyFilter) { setFilteredFunds([]); setTotalResults(0); return; }

    setLoading(true);
    try {
      let categoryToSearch = '';
      if (selectedSubCategory) {
        categoryToSearch = selectedSubCategory;
      } else if (selectedMainCategory) {
        categoryToSearch = selectedMainCategory.replace(' Schemes', '');
      }

      const response = await fetch('/api/funds/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          amc: selectedAMC,
          category: '',
          subCategory: categoryToSearch,
          planType: planType === 'All' ? '' : planType,
          limit: 500,
          offset: 0,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setFilteredFunds(data.funds);
        setTotalResults(data.funds.length);
        setCurrentPage(page);
      }
    } catch { setFilteredFunds([]); setTotalResults(0); } finally { setLoading(false); }
  };

  const resetFilters = () => {
    setSelectedAMC(''); setSelectedMainCategory(''); setSelectedSubCategory('');
    setSearchQuery(''); setPlanType('Regular'); setCurrentPage(1);
    setFilteredFunds([]); setTotalResults(0);
  };

  const getPaginatedFunds = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredFunds.slice(startIndex, startIndex + ITEMS_PER_PAGE);
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

  const planTypes: ('Regular' | 'Direct' | 'All')[] = ['Regular', 'Direct', 'All'];

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Advanced Fund Search
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Filter by AMC, SEBI category, and plan type across {totalFunds.toLocaleString()} schemes.
          </p>
        </header>

        <div className="space-y-6">

          {/* Plan Type Toggle */}
          <div className="flex justify-center">
            <div className="flex gap-1 p-1 bg-[#0d1512] border border-[#3c4a3e] rounded-xl">
              {planTypes.map(pt => (
                <button
                  key={pt}
                  onClick={() => setPlanType(pt)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    planType === pt
                      ? 'bg-[#44f593]/15 text-[#44f593] border border-[#44f593]/30'
                      : 'text-[#859586] hover:text-[#dce5df]'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card rounded-2xl p-5 md:p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
              {/* AMC */}
              <div>
                <label className={labelCls}>1. AMC</label>
                <select value={selectedAMC} onChange={e => setSelectedAMC(e.target.value)} className={selectCls}>
                  <option value="">All AMCs</option>
                  {availableAMCs.map(amc => (
                    <option key={amc} value={amc}>{amc.replace(' Mutual Fund', '')}</option>
                  ))}
                </select>
              </div>

              {/* Main Category */}
              <div>
                <label className={labelCls}>2. Category</label>
                <select
                  value={selectedMainCategory}
                  onChange={e => { setSelectedMainCategory(e.target.value); setSelectedSubCategory(''); }}
                  className={selectCls}
                >
                  <option value="">All Categories</option>
                  {Object.keys(FUND_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Sub-Category */}
              <div>
                <label className={labelCls}>3. Sub-category</label>
                <select
                  value={selectedSubCategory}
                  onChange={e => setSelectedSubCategory(e.target.value)}
                  disabled={!selectedMainCategory}
                  className={selectCls}
                >
                  <option value="">All Sub-categories</option>
                  {getSubCategories().map(subCat => (
                    <option key={subCat} value={subCat}>{subCat}</option>
                  ))}
                </select>
              </div>

              {/* Text Search */}
              <div>
                <label className={labelCls}>4. Search</label>
                <input
                  type="text"
                  placeholder="Name or code"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Filter meta row */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[#859586] font-mono">
                {totalResults > 0 ? (
                  <>
                    <span className="text-[#44f593] font-bold">
                      {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalResults)}
                    </span>
                    {' of '}
                    <span className="text-[#44f593] font-bold">{totalResults}</span>
                    {totalResults > ITEMS_PER_PAGE && ` · Page ${currentPage}/${totalPages}`}
                  </>
                ) : (
                  <><span className="text-[#dce5df] font-bold">{totalFunds.toLocaleString()}</span> funds in database · Apply filters to search</>
                )}
              </p>
              <button
                onClick={resetFilters}
                className="text-xs text-[#859586] hover:text-[#ffb4ab] font-mono transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(selectedAMC || selectedMainCategory || selectedSubCategory || searchQuery) && (
            <div className="flex flex-wrap gap-2">
              {selectedAMC && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20">
                  AMC: {selectedAMC.replace(' Mutual Fund', '')}
                  <button onClick={() => setSelectedAMC('')} className="hover:opacity-60">×</button>
                </span>
              )}
              {selectedMainCategory && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[#dce5df]/8 text-[#dce5df] border border-[#3c4a3e]">
                  {selectedMainCategory}
                  <button onClick={() => setSelectedMainCategory('')} className="hover:opacity-60">×</button>
                </span>
              )}
              {selectedSubCategory && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[#dce5df]/8 text-[#dce5df] border border-[#3c4a3e]">
                  {selectedSubCategory}
                  <button onClick={() => setSelectedSubCategory('')} className="hover:opacity-60">×</button>
                </span>
              )}
              {searchQuery && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-[#dce5df]/8 text-[#dce5df] border border-[#3c4a3e]">
                  &ldquo;{searchQuery}&rdquo;
                  <button onClick={() => setSearchQuery('')} className="hover:opacity-60">×</button>
                </span>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin w-8 h-8 text-[#44f593]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {/* Results */}
          {!loading && totalResults > 0 && (
            <>
              <div className="space-y-3">
                {getPaginatedFunds().map(fund => (
                  <div
                    key={fund.schemeCode}
                    onClick={() => router.push(`/funds/${fund.schemeCode}`)}
                    className="glass-card rounded-xl p-5 hover:border-[#44f593]/20 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20">
                            {fund.schemeCode}
                          </span>
                          {fund.schemeType && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-[#dce5df]/6 text-[#859586] border border-[#3c4a3e]">
                              {fund.schemeType}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-[#dce5df] group-hover:text-[#44f593] transition-colors mb-2 truncate">
                          {fund.schemeName}
                        </p>
                        <div className="flex items-center gap-4 text-xs font-mono text-[#859586]">
                          <span>{fund.amcCode.replace(' Mutual Fund', '')}</span>
                          <span>NAV ₹{fund.latestNav.toFixed(4)}</span>
                          <span>{fund.latestNavDate ? new Date(fund.latestNavDate).toLocaleDateString('en-IN') : '—'}</span>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-[#3c4a3e] group-hover:text-[#44f593] transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-xl border border-[#3c4a3e] text-[#859586] text-sm hover:text-[#44f593] hover:border-[#44f593]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`w-9 h-9 rounded-lg text-sm font-mono transition-all ${
                            currentPage === pageNum
                              ? 'bg-[#44f593]/15 text-[#44f593] border border-[#44f593]/30'
                              : 'text-[#859586] hover:text-[#dce5df] border border-[#3c4a3e]'
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
                    className="px-4 py-2 rounded-xl border border-[#3c4a3e] text-[#859586] text-sm hover:text-[#44f593] hover:border-[#44f593]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}

          {/* Empty / No Results */}
          {!loading && totalResults === 0 && (selectedAMC || selectedMainCategory || selectedSubCategory || searchQuery || planType !== 'All') && (
            <div className="glass-card rounded-2xl p-14 text-center">
              <div className="w-16 h-16 rounded-xl bg-[#44f593]/8 border border-[#44f593]/15 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-[#44f593]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-base font-display font-bold text-[#dce5df] mb-2">No Funds Found</h3>
              <p className="text-[#859586] text-sm mb-5">Try adjusting your filters or search criteria.</p>
              <button
                onClick={resetFilters}
                className="px-6 py-2.5 bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] rounded-xl font-bold text-sm"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* SEBI Category Guide */}
          <div className="glass-card rounded-2xl p-5 border-[#44f593]/15 bg-[#44f593]/3">
            <p className="text-xs font-bold text-[#44f593] mb-4">SEBI Fund Categories (October 2017)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(FUND_CATEGORIES).map(([mainCat, subCats]) => (
                <div key={mainCat}>
                  <p className="text-xs font-mono text-[#dce5df] uppercase tracking-widest mb-2">{mainCat}</p>
                  <ul className="space-y-1">
                    {Object.keys(subCats).slice(0, 5).map(subCat => (
                      <li key={subCat} className="text-xs text-[#859586] flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-[#44f593]/40 flex-shrink-0" />
                        {subCat}
                      </li>
                    ))}
                    {Object.keys(subCats).length > 5 && (
                      <li className="text-xs text-[#44f593]/50 font-mono">+{Object.keys(subCats).length - 5} more</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
