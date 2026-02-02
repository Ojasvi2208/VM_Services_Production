'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import NAVChart from '@/components/NAVChart';

interface FundData {
  fund: {
    schemeCode: string;
    schemeName: string;
    amcCode: string;
    schemeType: string;
    planType: string;
    optionType: string;
    latestNav: number;
    latestNavDate: string;
    inceptionDate?: string;
    fundSize?: number;
    expenseRatio?: number;
    exitLoad?: string;
    minInvestment?: number;
    minSip?: number;
  };
  returns: {
    return1w?: number;
    return1m?: number;
    return3m?: number;
    return6m?: number;
    return1y?: number;
    return2y?: number;
    return3y?: number;
    return5y?: number;
    return10y?: number;
    cagr1y?: number;
    cagr2y?: number;
    cagr3y?: number;
    cagr5y?: number;
    cagr10y?: number;
    volatility1y?: number;
    maxDrawdown?: number;
    sharpeRatio1y?: number;
    sortinoRatio1y?: number;
    rollingReturn1yAvg?: number;
    updatedAt?: string;
  } | null;
  navHistory: Array<{ date: string; nav: number }>;
  managers: Array<{ name: string; isCurrent: boolean; tenure?: number }>;
  expenseHistory: Array<{ date: string; ratio: number }>;
}

const formatPercent = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '-';
  const num = parseFloat(value.toString());
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const formatNumber = (value: number | undefined | null, decimals: number = 2): string => {
  if (value === undefined || value === null) return '-';
  return parseFloat(value.toString()).toFixed(decimals);
};

const getReturnColor = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'text-brand-navy';
  return parseFloat(value.toString()) >= 0 ? 'text-green-600' : 'text-red-600';
};

export default function FundDetailsPageNew() {
  const params = useParams();
  const router = useRouter();
  const schemeCode = params.schemeCode as string;
  
  const [fundData, setFundData] = useState<FundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (schemeCode) {
      fetchFundData();
    }
  }, [schemeCode]);

  const fetchFundData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/funds/${schemeCode}`);
      const result = await response.json();
      
      if (result.success) {
        setFundData(result.data);
      } else {
        setError(result.error || 'Failed to load fund details');
      }
    } catch (err: any) {
      console.error('Error fetching fund data:', err);
      setError('Failed to load fund details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="pt-24"></div>
        <Section background="offwhite" padding="large">
          <ResponsiveContainer maxWidth="xl">
            <div className="card-light p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-royal border-t-transparent mb-4"></div>
              <p className="text-brand-navy/70">Loading fund details...</p>
            </div>
          </ResponsiveContainer>
        </Section>
      </>
    );
  }

  if (error || !fundData) {
    return (
      <>
        <div className="pt-24"></div>
        <Section background="offwhite" padding="large">
          <ResponsiveContainer maxWidth="xl">
            <div className="card-light p-12 text-center">
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-brand-navy mb-2">Fund Not Found</h2>
              <p className="text-brand-navy/70 mb-6">{error || 'The requested fund could not be found'}</p>
              <button
                onClick={() => router.push('/funds/advanced-search')}
                className="bg-brand-royal text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-navy transition-all"
              >
                Back to Search
              </button>
            </div>
          </ResponsiveContainer>
        </Section>
      </>
    );
  }

  const { fund, returns, navHistory } = fundData;

  // Detect plan type from scheme name
  const isDirectPlan = fund.schemeName.toLowerCase().includes('direct');

  return (
    <>
      <div className="pt-24"></div>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="space-y-8">
            
            {/* Fund Header - Premium Card */}
            <div className="bg-gradient-to-br from-brand-navy via-brand-royal to-brand-navy rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 text-white shadow-xl">
              <div className="flex items-start justify-between mb-4 md:mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4 flex-wrap">
                    <span className="px-2 py-1 md:px-4 md:py-1.5 bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm font-semibold rounded-full border border-white/30">
                      {fund.schemeCode}
                    </span>
                    <span className={`px-2 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-semibold rounded-full ${
                      isDirectPlan 
                        ? 'bg-green-500/90 text-white' 
                        : 'bg-blue-400/90 text-white'
                    }`}>
                      {isDirectPlan ? '✓ Direct' : 'Regular'}
                    </span>
                    {fund.schemeType && (
                      <span className="px-2 py-1 md:px-4 md:py-1.5 bg-brand-gold/90 text-brand-navy text-xs md:text-sm font-semibold rounded-full">
                        {fund.schemeType}
                      </span>
                    )}
                  </div>
                  
                  <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-2 md:mb-3 leading-tight">
                    {fund.schemeName}
                  </h1>
                  
                  <p className="text-sm md:text-lg text-white/80">
                    {fund.amcCode}
                  </p>
                </div>
                
                <button
                  onClick={() => router.push('/funds/search')}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-all border border-white/20 text-sm"
                >
                  ← Back
                </button>
              </div>

              {/* NAV Display - Premium */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 pt-4 md:pt-6 border-t border-white/20">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4">
                  <p className="text-xs md:text-sm text-white/70 mb-1">Current NAV</p>
                  <p className="text-lg md:text-2xl lg:text-3xl font-bold text-brand-gold">
                    ₹{fund.latestNav ? parseFloat(fund.latestNav.toString()).toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/60 mt-1">
                    {fund.latestNavDate ? new Date(fund.latestNavDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}
                  </p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4">
                  <p className="text-xs md:text-sm text-white/70 mb-1">1Y Return</p>
                  <p className={`text-lg md:text-2xl lg:text-3xl font-bold ${returns?.return1y && returns.return1y >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(returns?.return1y)}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/60 mt-1">Absolute</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4">
                  <p className="text-xs md:text-sm text-white/70 mb-1">3Y CAGR</p>
                  <p className={`text-lg md:text-2xl lg:text-3xl font-bold ${returns?.cagr3y && returns.cagr3y >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(returns?.cagr3y)}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/60 mt-1">Annualized</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4">
                  <p className="text-xs md:text-sm text-white/70 mb-1">5Y CAGR</p>
                  <p className={`text-lg md:text-2xl lg:text-3xl font-bold ${returns?.cagr5y && returns.cagr5y >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(returns?.cagr5y)}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/60 mt-1">Annualized</p>
                </div>
              </div>

              {/* Mobile Back Button */}
              <button
                onClick={() => router.push('/funds/search')}
                className="md:hidden w-full mt-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-all border border-white/20 text-sm"
              >
                ← Back to Search
              </button>
            </div>

            {/* Returns Section */}
            {returns && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Absolute Returns Card */}
                <div className="card-light p-4 md:p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-brand-royal/10 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h3 className="text-base md:text-xl font-bold text-brand-navy">Absolute Returns</h3>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {[
                      { label: '1W', value: returns.return1w },
                      { label: '1M', value: returns.return1m },
                      { label: '3M', value: returns.return3m },
                      { label: '6M', value: returns.return6m },
                      { label: '1Y', value: returns.return1y },
                      { label: '2Y', value: returns.return2y },
                      { label: '3Y', value: returns.return3y },
                      { label: '5Y', value: returns.return5y },
                      { label: '10Y', value: returns.return10y },
                    ].map((item) => (
                      <div key={item.label} className="text-center p-2 md:p-3 bg-gray-50 rounded-lg">
                        <p className="text-[10px] md:text-xs text-brand-navy/60 mb-1">{item.label}</p>
                        <p className={`text-sm md:text-lg font-bold ${getReturnColor(item.value)}`}>
                          {formatPercent(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CAGR Returns Card */}
                <div className="card-light p-4 md:p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-base md:text-xl font-bold text-brand-navy">CAGR (Annualized)</h3>
                  </div>
                  
                  <div className="space-y-2 md:space-y-4">
                    {[
                      { label: '1 Year', value: returns.cagr1y },
                      { label: '2 Year', value: returns.cagr2y },
                      { label: '3 Year', value: returns.cagr3y },
                      { label: '5 Year', value: returns.cagr5y },
                      { label: '10 Year', value: returns.cagr10y },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm md:text-base text-brand-navy/70 font-medium">{item.label}</span>
                        <span className={`text-base md:text-xl font-bold ${getReturnColor(item.value)}`}>
                          {formatPercent(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Risk Metrics Section */}
            {returns && (returns.volatility1y || returns.maxDrawdown || returns.sharpeRatio1y || returns.sortinoRatio1y) && (
              <div className="card-light p-4 md:p-6 rounded-xl shadow-md">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-base md:text-xl font-bold text-brand-navy">Risk Metrics</h3>
                  <span className="text-xs md:text-sm text-brand-navy/50">(1Y)</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                  <div className="text-center p-3 md:p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg md:rounded-xl border border-orange-200">
                    <p className="text-xs md:text-sm text-orange-700 font-medium mb-1 md:mb-2">Volatility</p>
                    <p className="text-lg md:text-2xl font-bold text-orange-600">
                      {formatNumber(returns.volatility1y)}%
                    </p>
                    <p className="text-[10px] md:text-xs text-orange-600/70 mt-1">Std Dev</p>
                  </div>
                  
                  <div className="text-center p-3 md:p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg md:rounded-xl border border-red-200">
                    <p className="text-xs md:text-sm text-red-700 font-medium mb-1 md:mb-2">Max DD</p>
                    <p className="text-lg md:text-2xl font-bold text-red-600">
                      {returns.maxDrawdown ? `-${formatNumber(Math.abs(returns.maxDrawdown))}%` : '-'}
                    </p>
                    <p className="text-[10px] md:text-xs text-red-600/70 mt-1">Peak-Trough</p>
                  </div>
                  
                  <div className="text-center p-3 md:p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg md:rounded-xl border border-blue-200">
                    <p className="text-xs md:text-sm text-blue-700 font-medium mb-1 md:mb-2">Sharpe</p>
                    <p className="text-lg md:text-2xl font-bold text-blue-600">
                      {formatNumber(returns.sharpeRatio1y)}
                    </p>
                    <p className="text-[10px] md:text-xs text-blue-600/70 mt-1">Risk-Adj</p>
                  </div>
                  
                  <div className="text-center p-3 md:p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg md:rounded-xl border border-purple-200">
                    <p className="text-xs md:text-sm text-purple-700 font-medium mb-1 md:mb-2">Sortino</p>
                    <p className="text-lg md:text-2xl font-bold text-purple-600">
                      {formatNumber(returns.sortinoRatio1y)}
                    </p>
                    <p className="text-[10px] md:text-xs text-purple-600/70 mt-1">Downside</p>
                  </div>
                </div>
              </div>
            )}

            {/* NAV Chart */}
            {navHistory && navHistory.length > 0 && (
              <NAVChart data={navHistory} fundName={fund.schemeName} />
            )}

            {/* Quick Actions */}
            <div className="card-light p-4 md:p-6 rounded-xl shadow-md">
              <h3 className="text-base md:text-xl font-bold text-brand-navy mb-3 md:mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-4">
                <button className="relative bg-gradient-to-r from-brand-royal to-brand-navy text-white px-4 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl font-semibold opacity-70 cursor-not-allowed shadow-lg text-sm md:text-base">
                  💰 Invest
                  <span className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-brand-gold text-brand-navy text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full shadow-md">
                    Soon
                  </span>
                </button>
                <button className="relative bg-gradient-to-r from-green-500 to-green-600 text-white px-4 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl font-semibold opacity-70 cursor-not-allowed shadow-lg text-sm md:text-base">
                  📈 SIP
                  <span className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-brand-gold text-brand-navy text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full shadow-md">
                    Soon
                  </span>
                </button>
                <button 
                  onClick={() => router.push('/funds/compare')}
                  className="bg-white border-2 border-brand-royal text-brand-royal px-4 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl font-semibold hover:bg-brand-royal hover:text-white transition-all shadow-md text-sm md:text-base"
                >
                  ⚖️ Compare
                </button>
                <button 
                  onClick={() => router.push('/funds/search')}
                  className="bg-gray-100 text-brand-navy px-4 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl font-semibold hover:bg-gray-200 transition-all text-sm md:text-base"
                >
                  🔍 Search
                </button>
              </div>
            </div>

            {/* Data Update Info */}
            {returns?.updatedAt && (
              <div className="text-center text-sm text-brand-navy/50">
                Data last updated: {new Date(returns.updatedAt).toLocaleDateString('en-IN', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}

          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
