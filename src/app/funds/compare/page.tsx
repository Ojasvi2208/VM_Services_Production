'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';

// Force dynamic rendering to avoid static generation issues with useSearchParams
export const dynamic = 'force-dynamic';

interface FundData {
  schemeCode: string;
  schemeName: string;
  latestNav: number;
  latestNavDate: string;
  amcCode: string;
  returns: {
    return_1w?: number;
    return_1m?: number;
    return_3m?: number;
    return_6m?: number;
    return_1y?: number;
    return_3y?: number;
    return_5y?: number;
    cagr_1y?: number;
    cagr_3y?: number;
    cagr_5y?: number;
  };
}

function FundCompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [funds, setFunds] = useState<FundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Load funds from URL params on mount
  useEffect(() => {
    const codes = searchParams.get('codes');
    if (codes) {
      const schemeCodes = codes.split(',');
      loadFunds(schemeCodes);
    }
  }, [searchParams]);

  // Load fund data
  const loadFunds = async (schemeCodes: string[]) => {
    setLoading(true);
    try {
      const fundPromises = schemeCodes.map(code =>
        fetch(`/api/funds/${code}`).then(res => res.json())
      );
      const results = await Promise.all(fundPromises);
      const validFunds = results.filter(r => r.success).map(r => r.data);
      setFunds(validFunds);
    } catch (error) {
      console.error('Error loading funds:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search funds
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(`/api/funds/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.funds);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // Add fund to comparison
  const addFund = (schemeCode: string) => {
    if (funds.length >= 5) {
      alert('Maximum 5 funds can be compared');
      return;
    }
    if (funds.some(f => f.schemeCode === schemeCode)) {
      alert('Fund already added');
      return;
    }
    loadFunds([...funds.map(f => f.schemeCode), schemeCode]);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Remove fund from comparison
  const removeFund = (schemeCode: string) => {
    const remaining = funds.filter(f => f.schemeCode !== schemeCode);
    setFunds(remaining);
  };

  // Format return value
  const formatReturn = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  // Get color for return value
  const getReturnColor = (value: number | undefined) => {
    if (value === undefined || value === null) return 'text-gray-500';
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Find best performer for each metric
  const getBestPerformer = (metric: keyof FundData['returns']) => {
    if (funds.length === 0) return null;
    return funds.reduce((best, fund) => {
      const value = fund.returns[metric];
      const bestValue = best.returns[metric];
      if (value === undefined) return best;
      if (bestValue === undefined) return fund;
      return value > bestValue ? fund : best;
    });
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
                Compare <span className="text-brand-gold">Mutual Funds</span>
              </h1>
              <p className="text-lg text-brand-navy/70 max-w-2xl mx-auto">
                Compare returns, NAV, and performance metrics side-by-side (up to 5 funds)
              </p>
            </div>

            {/* Add Fund Button */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowSearch(!showSearch)}
                disabled={funds.length >= 5}
                className="bg-brand-royal text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {showSearch ? 'Close Search' : `+ Add Fund to Compare (${funds.length}/5)`}
              </button>
            </div>

            {/* Search Box */}
            {showSearch && (
              <div className="card-light p-6 max-w-2xl mx-auto">
                <div className="flex gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Search by fund name or scheme code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                  />
                  <button
                    onClick={handleSearch}
                    className="bg-brand-royal text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-navy transition-all"
                  >
                    Search
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.map((fund) => (
                      <button
                        key={fund.schemeCode}
                        onClick={() => addFund(fund.schemeCode)}
                        className="w-full text-left p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-brand-royal hover:bg-brand-royal/5 transition-all"
                      >
                        <div className="font-semibold text-brand-navy">{fund.schemeName}</div>
                        <div className="text-sm text-brand-navy/70">Code: {fund.schemeCode}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comparison Table */}
            {funds.length > 0 ? (
              <div className="card-light p-6 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-4 px-4 font-semibold text-brand-navy">Metric</th>
                      {funds.map((fund) => (
                        <th key={fund.schemeCode} className="text-left py-4 px-4 min-w-[200px]">
                          <div className="space-y-2">
                            <div className="font-semibold text-brand-navy text-sm">
                              {fund.schemeName.substring(0, 40)}...
                            </div>
                            <div className="text-xs text-brand-navy/70">
                              Code: {fund.schemeCode}
                            </div>
                            <button
                              onClick={() => removeFund(fund.schemeCode)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Latest NAV */}
                    <tr className="border-b border-gray-100">
                      <td className="py-4 px-4 font-medium text-brand-navy">Latest NAV</td>
                      {funds.map((fund) => (
                        <td key={fund.schemeCode} className="py-4 px-4">
                          <div className="font-semibold text-brand-navy">
                            ₹{fund.latestNav.toFixed(4)}
                          </div>
                          <div className="text-xs text-brand-navy/70">
                            {new Date(fund.latestNavDate).toLocaleDateString('en-IN')}
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* AMC */}
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="py-4 px-4 font-medium text-brand-navy">AMC</td>
                      {funds.map((fund) => (
                        <td key={fund.schemeCode} className="py-4 px-4 text-brand-navy/70">
                          {fund.amcCode}
                        </td>
                      ))}
                    </tr>

                    {/* Returns Section */}
                    <tr className="bg-brand-royal/5">
                      <td colSpan={funds.length + 1} className="py-3 px-4 font-bold text-brand-navy">
                        Absolute Returns
                      </td>
                    </tr>

                    {[
                      { key: 'return_1w', label: '1 Week' },
                      { key: 'return_1m', label: '1 Month' },
                      { key: 'return_3m', label: '3 Months' },
                      { key: 'return_6m', label: '6 Months' },
                      { key: 'return_1y', label: '1 Year' },
                      { key: 'return_3y', label: '3 Years' },
                      { key: 'return_5y', label: '5 Years' },
                    ].map((metric, idx) => {
                      const best = getBestPerformer(metric.key as keyof FundData['returns']);
                      return (
                        <tr key={metric.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="py-3 px-4 font-medium text-brand-navy">{metric.label}</td>
                          {funds.map((fund) => {
                            const value = fund.returns[metric.key as keyof FundData['returns']];
                            const isBest = best?.schemeCode === fund.schemeCode && value !== undefined;
                            return (
                              <td key={fund.schemeCode} className="py-3 px-4">
                                <span className={`font-semibold ${getReturnColor(value)} ${isBest ? 'text-lg' : ''}`}>
                                  {formatReturn(value)}
                                  {isBest && ' 🏆'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* CAGR Section */}
                    <tr className="bg-brand-gold/10">
                      <td colSpan={funds.length + 1} className="py-3 px-4 font-bold text-brand-navy">
                        CAGR (Annualized)
                      </td>
                    </tr>

                    {[
                      { key: 'cagr_1y', label: '1 Year CAGR' },
                      { key: 'cagr_3y', label: '3 Year CAGR' },
                      { key: 'cagr_5y', label: '5 Year CAGR' },
                    ].map((metric, idx) => {
                      const best = getBestPerformer(metric.key as keyof FundData['returns']);
                      return (
                        <tr key={metric.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="py-3 px-4 font-medium text-brand-navy">{metric.label}</td>
                          {funds.map((fund) => {
                            const value = fund.returns[metric.key as keyof FundData['returns']];
                            const isBest = best?.schemeCode === fund.schemeCode && value !== undefined;
                            return (
                              <td key={fund.schemeCode} className="py-3 px-4">
                                <span className={`font-semibold ${getReturnColor(value)} ${isBest ? 'text-lg' : ''}`}>
                                  {formatReturn(value)}
                                  {isBest && ' 🏆'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* View Details Buttons */}
                <div className="mt-6 flex gap-4 flex-wrap">
                  {funds.map((fund) => (
                    <button
                      key={fund.schemeCode}
                      onClick={() => router.push(`/funds/${fund.schemeCode}`)}
                      className="px-6 py-2 bg-brand-royal text-white rounded-lg font-medium hover:bg-brand-navy transition-all"
                    >
                      View {fund.schemeCode} Details
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card-light p-12 text-center">
                <div className="w-20 h-20 bg-brand-pearl rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-brand-navy mb-2">No Funds Selected</h3>
                <p className="text-brand-navy/70 mb-4">
                  Add funds to start comparing their performance
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="card-light p-6 bg-blue-50 border-l-4 border-blue-400">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Comparison Tips</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-blue-800">
                <li>Compare up to 5 funds side-by-side</li>
                <li>Best performers in each category are marked with 🏆</li>
                <li>Green values indicate positive returns, red indicates negative</li>
                <li>CAGR provides annualized returns for better long-term comparison</li>
                <li>Click "View Details" to see full fund information and charts</li>
              </ul>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}

export default function FundComparePage() {
  return (
    <Suspense fallback={
      <Section className="py-12">
        <ResponsiveContainer>
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold mx-auto mb-4"></div>
            <p className="text-brand-cloud">Loading comparison...</p>
          </div>
        </ResponsiveContainer>
      </Section>
    }>
      <FundCompareContent />
    </Suspense>
  );
}
