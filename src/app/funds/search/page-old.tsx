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
}

// SEBI Fund Categories
const FUND_CATEGORIES = {
  'Equity': [
    'Large Cap Fund',
    'Mid Cap Fund',
    'Small Cap Fund',
    'Multi Cap Fund',
    'Flexi Cap Fund',
    'Large & Mid Cap Fund',
    'Focused Fund',
    'Sectoral/Thematic',
    'Dividend Yield Fund',
    'Value Fund',
    'Contra Fund',
    'ELSS'
  ],
  'Debt': [
    'Liquid Fund',
    'Ultra Short Duration Fund',
    'Low Duration Fund',
    'Money Market Fund',
    'Short Duration Fund',
    'Medium Duration Fund',
    'Medium to Long Duration Fund',
    'Long Duration Fund',
    'Dynamic Bond Fund',
    'Corporate Bond Fund',
    'Credit Risk Fund',
    'Banking and PSU Fund',
    'Gilt Fund',
    'Floater Fund'
  ],
  'Hybrid': [
    'Conservative Hybrid Fund',
    'Balanced Hybrid Fund',
    'Aggressive Hybrid Fund',
    'Dynamic Asset Allocation',
    'Multi Asset Allocation',
    'Arbitrage Fund',
    'Equity Savings'
  ],
  'Solution Oriented': [
    'Retirement Fund',
    'Children\'s Fund'
  ],
  'Other': [
    'Index Fund',
    'ETF',
    'Fund of Funds',
    'Gold ETF',
    'International Fund'
  ]
}

export default function FundSearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Popular funds for quick access
  const popularFunds = [
    { code: '119551', name: 'HDFC Equity Fund - Direct Plan - Growth' },
    { code: '119552', name: 'HDFC Balanced Advantage Fund - Direct Plan - Growth' },
    { code: '120503', name: 'HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth' },
    { code: '118989', name: 'HDFC Top 100 Fund - Direct Plan - Growth' },
    { code: '119597', name: 'HDFC Small Cap Fund - Direct Plan - Growth' },
    { code: '120465', name: 'SBI Bluechip Fund - Direct Plan - Growth' },
    { code: '119226', name: 'ICICI Prudential Bluechip Fund - Direct Plan - Growth' },
    { code: '120716', name: 'Axis Bluechip Fund - Direct Plan - Growth' },
  ];

  // Search function
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a fund name or scheme code');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // For now, we'll use demo data
      // In production, this would call an API endpoint that searches the database
      const demoResults: FundSearchResult[] = popularFunds
        .filter(fund => 
          fund.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          fund.code.includes(searchQuery)
        )
        .map(fund => ({
          schemeCode: fund.code,
          schemeName: fund.name,
          latestNav: Math.random() * 1000 + 100,
          latestNavDate: new Date().toISOString().split('T')[0],
          amcCode: fund.name.split(' ')[0],
          category: 'Equity',
        }));

      setSearchResults(demoResults);
    } catch (error) {
      console.error('Search error:', error);
      alert('Error searching funds');
    } finally {
      setLoading(false);
    }
  };

  // View fund details
  const viewFundDetails = (schemeCode: string) => {
    router.push(`/funds/${schemeCode}`);
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
                Search <span className="text-brand-gold">Mutual Funds</span>
              </h1>
              <p className="text-lg text-brand-navy/70 max-w-2xl mx-auto">
                Search by fund name or scheme code to view detailed information, NAV history, and returns
              </p>
            </div>

            {/* Search Bar */}
            <div className="card-light p-6 max-w-3xl mx-auto">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search by fund name or scheme code (e.g., HDFC Equity or 119551)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
              </div>
            </div>

            {/* Popular Funds */}
            {!searched && (
              <div className="max-w-4xl mx-auto">
                <h3 className="text-xl font-semibold text-brand-navy mb-4 flex items-center">
                  <span className="w-2 h-2 bg-brand-gold rounded-full mr-3 animate-pulse"></span>
                  Popular Funds
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {popularFunds.map((fund) => (
                    <button
                      key={fund.code}
                      onClick={() => viewFundDetails(fund.code)}
                      className="card-light p-4 text-left hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-brand-navy/60 mb-1">Code: {fund.code}</p>
                          <h4 className="font-semibold text-brand-navy group-hover:text-brand-royal transition-colors">
                            {fund.name}
                          </h4>
                        </div>
                        <svg className="w-5 h-5 text-brand-royal opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
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
                    <h3 className="text-xl font-semibold text-brand-navy mb-4">
                      Found {searchResults.length} fund{searchResults.length !== 1 ? 's' : ''}
                    </h3>
                    <div className="space-y-4">
                      {searchResults.map((fund) => (
                        <div
                          key={fund.schemeCode}
                          className="card-light p-6 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => viewFundDetails(fund.schemeCode)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="px-3 py-1 bg-brand-royal/10 text-brand-royal text-sm font-medium rounded-full">
                                  {fund.schemeCode}
                                </span>
                                {fund.category && (
                                  <span className="px-3 py-1 bg-brand-gold/10 text-brand-gold text-sm font-medium rounded-full">
                                    {fund.category}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-lg font-semibold text-brand-navy mb-2 group-hover:text-brand-royal transition-colors">
                                {fund.schemeName}
                              </h4>
                              <div className="flex items-center gap-4 text-sm text-brand-navy/70">
                                {fund.amcCode && (
                                  <span>AMC: {fund.amcCode}</span>
                                )}
                                {fund.latestNav && (
                                  <span>Latest NAV: ₹{fund.latestNav.toFixed(4)}</span>
                                )}
                                {fund.latestNavDate && (
                                  <span>Date: {new Date(fund.latestNavDate).toLocaleDateString('en-IN')}</span>
                                )}
                              </div>
                            </div>
                            <button className="bg-brand-royal text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy transition-all opacity-0 group-hover:opacity-100">
                              View Details
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
                      No funds match your search: "{searchQuery}"
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSearched(false);
                        setSearchResults([]);
                      }}
                      className="bg-brand-royal text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy transition-all"
                    >
                      Try Another Search
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="card-light p-12 text-center max-w-2xl mx-auto">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-royal border-t-transparent mb-4"></div>
                <p className="text-brand-navy/70">Searching funds...</p>
              </div>
            )}

            {/* Info Box */}
            <div className="card-light p-6 bg-blue-50 border-l-4 border-blue-400 max-w-4xl mx-auto">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Search Tips</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-blue-800">
                <li>Search by fund name (e.g., "HDFC Equity")</li>
                <li>Search by scheme code (e.g., "119551")</li>
                <li>Search by AMC name (e.g., "HDFC", "SBI", "ICICI")</li>
                <li>Use partial names for broader results</li>
              </ul>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
