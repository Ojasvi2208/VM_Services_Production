'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface FundData {
  schemeCode: string;
  schemeName: string;
  currentNav: number;
  returns: {
    [key: string]: {
      value: number;
      cagr?: number;
    };
  };
}

interface ComparisonProps {
  schemeCodes?: string[];
}

export default function FundComparison({ schemeCodes = [] }: ComparisonProps) {
  const [funds, setFunds] = useState<FundData[]>([]);
  const [selectedFunds, setSelectedFunds] = useState<string[]>(schemeCodes);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'returns' | 'cagr'>('returns');

  // Fetch fund data
  const fetchFundData = async (codes: string[]) => {
    if (codes.length === 0) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/returns/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeCodes: codes }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        const fundsData = Object.values(result.data) as FundData[];
        setFunds(fundsData);
      }
    } catch (error) {
      console.error('Error fetching fund data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFunds.length > 0) {
      fetchFundData(selectedFunds);
    }
  }, [selectedFunds]);

  // Add fund to comparison
  const addFund = (schemeCode: string) => {
    if (selectedFunds.length >= 5) {
      alert('Maximum 5 funds can be compared');
      return;
    }
    
    if (!selectedFunds.includes(schemeCode)) {
      setSelectedFunds([...selectedFunds, schemeCode]);
    }
  };

  // Remove fund from comparison
  const removeFund = (schemeCode: string) => {
    setSelectedFunds(selectedFunds.filter(code => code !== schemeCode));
    setFunds(funds.filter(fund => fund.schemeCode !== schemeCode));
  };

  // Prepare chart data
  const prepareChartData = () => {
    const periods = ['1W', '1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y'];
    
    return periods.map(period => {
      const dataPoint: any = { period };
      
      funds.forEach(fund => {
        const returnData = fund.returns[period];
        if (returnData) {
          dataPoint[fund.schemeName.substring(0, 30)] = viewMode === 'cagr' 
            ? returnData.cagr || returnData.value 
            : returnData.value;
        }
      });
      
      return dataPoint;
    });
  };

  const chartData = prepareChartData();
  const colors = ['#2E5984', '#C5A572', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy">Fund Comparison</h2>
          <p className="text-brand-navy/70 mt-1">Compare up to 5 mutual funds side by side</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('returns')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'returns'
                ? 'bg-brand-royal text-white'
                : 'bg-gray-200 text-brand-navy hover:bg-gray-300'
            }`}
          >
            Returns %
          </button>
          <button
            onClick={() => setViewMode('cagr')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'cagr'
                ? 'bg-brand-royal text-white'
                : 'bg-gray-200 text-brand-navy hover:bg-gray-300'
            }`}
          >
            CAGR
          </button>
        </div>
      </div>

      {/* Search and Add Funds */}
      <div className="card-light p-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Enter scheme code to add (e.g., 119551)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
          />
          <button
            onClick={() => {
              if (searchQuery.trim()) {
                addFund(searchQuery.trim());
                setSearchQuery('');
              }
            }}
            className="bg-brand-royal text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-navy transition-all"
          >
            Add Fund
          </button>
        </div>
        
        {selectedFunds.length < 5 && (
          <p className="text-sm text-brand-navy/60 mt-2">
            {5 - selectedFunds.length} more fund{5 - selectedFunds.length !== 1 ? 's' : ''} can be added
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card-light p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-royal border-t-transparent"></div>
          <p className="mt-4 text-brand-navy/70">Loading fund data...</p>
        </div>
      )}

      {/* Comparison Chart */}
      {!loading && funds.length > 0 && (
        <div className="card-light p-6">
          <h3 className="text-xl font-semibold text-brand-navy mb-4">
            {viewMode === 'cagr' ? 'CAGR Comparison' : 'Returns Comparison'}
          </h3>
          
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="period" 
                stroke="#1B365D"
                style={{ fontSize: '14px', fontWeight: 500 }}
              />
              <YAxis 
                stroke="#1B365D"
                style={{ fontSize: '14px', fontWeight: 500 }}
                label={{ value: 'Return %', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '2px solid #2E5984',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
              <Legend />
              
              {funds.map((fund, index) => (
                <Bar
                  key={fund.schemeCode}
                  dataKey={fund.schemeName.substring(0, 30)}
                  fill={colors[index % colors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Comparison Table */}
      {!loading && funds.length > 0 && (
        <div className="card-light p-6 overflow-x-auto">
          <h3 className="text-xl font-semibold text-brand-navy mb-4">Detailed Comparison</h3>
          
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-brand-royal/20">
                <th className="text-left py-3 px-4 font-semibold text-brand-navy">Metric</th>
                {funds.map((fund, index) => (
                  <th key={fund.schemeCode} className="text-left py-3 px-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-brand-navy text-sm">
                        {fund.schemeName.substring(0, 40)}...
                      </span>
                      <button
                        onClick={() => removeFund(fund.schemeCode)}
                        className="ml-2 text-red-500 hover:text-red-700 transition-colors"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-3 px-4 font-medium text-brand-navy">Current NAV</td>
                {funds.map(fund => (
                  <td key={fund.schemeCode} className="py-3 px-4 text-brand-navy/80">
                    ₹{fund.currentNav.toFixed(2)}
                  </td>
                ))}
              </tr>
              
              {['1W', '1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y'].map(period => (
                <tr key={period} className="border-b border-gray-200 hover:bg-brand-pearl/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-brand-navy">{period} Return</td>
                  {funds.map(fund => {
                    const returnData = fund.returns[period];
                    if (!returnData) {
                      return <td key={fund.schemeCode} className="py-3 px-4 text-gray-400">N/A</td>;
                    }
                    
                    const value = returnData.value;
                    const colorClass = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
                    
                    return (
                      <td key={fund.schemeCode} className="py-3 px-4">
                        <div>
                          <span className={`font-semibold ${colorClass}`}>
                            {value > 0 ? '+' : ''}{value.toFixed(2)}%
                          </span>
                          {returnData.cagr && (
                            <span className="text-xs text-brand-navy/60 ml-2">
                              (CAGR: {returnData.cagr.toFixed(2)}%)
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && funds.length === 0 && (
        <div className="card-light p-12 text-center">
          <div className="w-20 h-20 bg-brand-pearl rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-brand-navy mb-2">No Funds Selected</h3>
          <p className="text-brand-navy/70 mb-4">Add funds using scheme codes to start comparing</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => addFund('119551')}
              className="px-4 py-2 bg-brand-pearl text-brand-navy rounded-lg hover:bg-brand-royal hover:text-white transition-all"
            >
              Try: 119551
            </button>
            <button
              onClick={() => addFund('119552')}
              className="px-4 py-2 bg-brand-pearl text-brand-navy rounded-lg hover:bg-brand-royal hover:text-white transition-all"
            >
              Try: 119552
            </button>
            <button
              onClick={() => addFund('120503')}
              className="px-4 py-2 bg-brand-pearl text-brand-navy rounded-lg hover:bg-brand-royal hover:text-white transition-all"
            >
              Try: 120503
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
