'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';

interface PortfolioHolding {
  id: string;
  schemeCode: string;
  schemeName: string;
  units: number;
  avgNav: number;
  currentNav: number;
  investedValue: number;
  currentValue: number;
  returns: number;
  returnsPercent: number;
  amcCode: string;
}

export default function PortfolioPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedFund, setSelectedFund] = useState<any>(null);
  const [units, setUnits] = useState('');
  const [avgNav, setAvgNav] = useState('');

  // Load portfolio from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('portfolio');
    if (saved) {
      const savedHoldings = JSON.parse(saved);
      loadCurrentNavs(savedHoldings);
    }
  }, []);

  // Load current NAVs for all holdings
  const loadCurrentNavs = async (savedHoldings: PortfolioHolding[]) => {
    const updatedHoldings = await Promise.all(
      savedHoldings.map(async (holding) => {
        try {
          const response = await fetch(`/api/funds/${holding.schemeCode}`);
          const data = await response.json();
          if (data.success) {
            const currentNav = parseFloat(data.data.latestNav);
            const currentValue = holding.units * currentNav;
            const returns = currentValue - holding.investedValue;
            const returnsPercent = (returns / holding.investedValue) * 100;
            
            return {
              ...holding,
              currentNav,
              currentValue,
              returns,
              returnsPercent
            };
          }
        } catch (error) {
          console.error('Error loading NAV:', error);
        }
        return holding;
      })
    );
    setHoldings(updatedHoldings);
  };

  // Save portfolio to localStorage
  const savePortfolio = (newHoldings: PortfolioHolding[]) => {
    localStorage.setItem('portfolio', JSON.stringify(newHoldings));
    setHoldings(newHoldings);
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

  // Select fund to add
  const selectFund = async (fund: any) => {
    setSelectedFund(fund);
    setSearchResults([]);
    setSearchQuery('');
    
    // Pre-fill with current NAV
    try {
      const response = await fetch(`/api/funds/${fund.schemeCode}`);
      const data = await response.json();
      if (data.success && data.data && data.data.latestNav) {
        setAvgNav(data.data.latestNav.toString());
      }
    } catch (error) {
      console.error('Error loading fund:', error);
    }
  };

  // Add holding to portfolio
  const addHolding = () => {
    if (!selectedFund || !units || !avgNav) {
      alert('Please fill all fields');
      return;
    }

    const unitsNum = parseFloat(units);
    const avgNavNum = parseFloat(avgNav);
    const investedValue = unitsNum * avgNavNum;

    const newHolding: PortfolioHolding = {
      id: Date.now().toString(),
      schemeCode: selectedFund.schemeCode,
      schemeName: selectedFund.schemeName,
      units: unitsNum,
      avgNav: avgNavNum,
      currentNav: avgNavNum, // Will be updated
      investedValue,
      currentValue: investedValue,
      returns: 0,
      returnsPercent: 0,
      amcCode: selectedFund.amcCode || ''
    };

    const updatedHoldings = [...holdings, newHolding];
    savePortfolio(updatedHoldings);
    loadCurrentNavs(updatedHoldings);

    // Reset form
    setSelectedFund(null);
    setUnits('');
    setAvgNav('');
    setShowAddForm(false);
  };

  // Remove holding
  const removeHolding = (id: string) => {
    if (confirm('Are you sure you want to remove this holding?')) {
      const updated = holdings.filter(h => h.id !== id);
      savePortfolio(updated);
    }
  };

  // Calculate totals
  const totalInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
  const totalCurrent = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalReturns = totalCurrent - totalInvested;
  const totalReturnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  return (
    <>
      <div className="pt-24"></div>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-brand-navy mb-2">
                  My <span className="text-brand-gold">Portfolio</span>
                </h1>
                <p className="text-lg text-brand-navy/70">
                  Track your mutual fund investments and returns
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-brand-royal text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-navy transition-all"
              >
                {showAddForm ? 'Cancel' : '+ Add Holding'}
              </button>
            </div>

            {/* Portfolio Summary */}
            {holdings.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card-light p-6">
                  <div className="text-sm text-brand-navy/70 mb-1">Total Invested</div>
                  <div className="text-2xl font-bold text-brand-navy">
                    ₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="card-light p-6">
                  <div className="text-sm text-brand-navy/70 mb-1">Current Value</div>
                  <div className="text-2xl font-bold text-brand-navy">
                    ₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="card-light p-6">
                  <div className="text-sm text-brand-navy/70 mb-1">Total Returns</div>
                  <div className={`text-2xl font-bold ${totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{totalReturns.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="card-light p-6">
                  <div className="text-sm text-brand-navy/70 mb-1">Returns %</div>
                  <div className={`text-2xl font-bold ${totalReturnsPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalReturnsPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            )}

            {/* Add Holding Form */}
            {showAddForm && (
              <div className="card-light p-6">
                <h3 className="text-xl font-semibold text-brand-navy mb-4">Add New Holding</h3>
                
                {!selectedFund ? (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <input
                        type="text"
                        placeholder="Search fund by name or code..."
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
                            onClick={() => selectFund(fund)}
                            className="w-full text-left p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-brand-royal hover:bg-brand-royal/5 transition-all"
                          >
                            <div className="font-semibold text-brand-navy">{fund.schemeName}</div>
                            <div className="text-sm text-brand-navy/70">
                              Code: {fund.schemeCode} | NAV: ₹{fund.latestNav?.toFixed(4)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-brand-royal/5 rounded-lg">
                      <div className="font-semibold text-brand-navy">{selectedFund.schemeName}</div>
                      <div className="text-sm text-brand-navy/70">Code: {selectedFund.schemeCode}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-brand-navy mb-2">
                          Number of Units
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="e.g., 100.500"
                          value={units}
                          onChange={(e) => setUnits(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-brand-navy mb-2">
                          Average NAV (Purchase Price)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="e.g., 125.5000"
                          value={avgNav}
                          onChange={(e) => setAvgNav(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                        />
                      </div>
                    </div>

                    {units && avgNav && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-900">
                          Invested Amount: ₹{(parseFloat(units) * parseFloat(avgNav)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-4">
                      <button
                        onClick={addHolding}
                        className="flex-1 bg-brand-royal text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-navy transition-all"
                      >
                        Add to Portfolio
                      </button>
                      <button
                        onClick={() => setSelectedFund(null)}
                        className="px-6 py-3 border-2 border-gray-300 text-brand-navy rounded-lg font-semibold hover:bg-gray-50 transition-all"
                      >
                        Change Fund
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Holdings List */}
            {holdings.length > 0 ? (
              <div className="card-light p-6">
                <h3 className="text-xl font-semibold text-brand-navy mb-4">Your Holdings</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-brand-navy">Fund Name</th>
                        <th className="text-right py-3 px-4 font-semibold text-brand-navy">Units</th>
                        <th className="text-right py-3 px-4 font-semibold text-brand-navy">Avg NAV</th>
                        <th className="text-right py-3 px-4 font-semibold text-brand-navy">Current NAV</th>
                        <th className="text-right py-3 px-4 font-semibold text-brand-navy">Invested</th>
                        <th className="text-right py-3 px-4 font-semibold text-brand-navy">Current Value</th>
                        <th className="text-right py-3 px-4 font-semibold text-brand-navy">Returns</th>
                        <th className="text-center py-3 px-4 font-semibold text-brand-navy">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((holding) => (
                        <tr key={holding.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="font-medium text-brand-navy">{holding.schemeName.substring(0, 50)}...</div>
                            <div className="text-xs text-brand-navy/70">Code: {holding.schemeCode}</div>
                          </td>
                          <td className="text-right py-4 px-4 text-brand-navy">{holding.units.toFixed(3)}</td>
                          <td className="text-right py-4 px-4 text-brand-navy">₹{holding.avgNav.toFixed(4)}</td>
                          <td className="text-right py-4 px-4 text-brand-navy">₹{holding.currentNav.toFixed(4)}</td>
                          <td className="text-right py-4 px-4 text-brand-navy">
                            ₹{holding.investedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right py-4 px-4 font-semibold text-brand-navy">
                            ₹{holding.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right py-4 px-4">
                            <div className={`font-semibold ${holding.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ₹{holding.returns.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div className={`text-sm ${holding.returnsPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ({holding.returnsPercent.toFixed(2)}%)
                            </div>
                          </td>
                          <td className="text-center py-4 px-4">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => router.push(`/funds/${holding.schemeCode}`)}
                                className="text-brand-royal hover:text-brand-navy text-sm"
                              >
                                View
                              </button>
                              <button
                                onClick={() => removeHolding(holding.id)}
                                className="text-red-600 hover:text-red-700 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card-light p-12 text-center">
                <div className="w-20 h-20 bg-brand-pearl rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-brand-navy mb-2">No Holdings Yet</h3>
                <p className="text-brand-navy/70 mb-4">
                  Start tracking your mutual fund investments
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-brand-royal text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy transition-all"
                >
                  Add Your First Holding
                </button>
              </div>
            )}

            {/* Info Box */}
            <div className="card-light p-6 bg-blue-50 border-l-4 border-blue-400">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Portfolio Tips</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-blue-800">
                <li>Data is stored locally in your browser (not on server)</li>
                <li>Current NAV is fetched in real-time from our database</li>
                <li>Returns are calculated automatically based on current NAV</li>
                <li>Add multiple purchases of the same fund separately to track accurately</li>
                <li>Click "View" to see detailed fund information and charts</li>
              </ul>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
