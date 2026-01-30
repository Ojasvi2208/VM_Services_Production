'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import TabbedReturnsView from '@/components/TabbedReturnsView';
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
  returns: any;
  navHistory: Array<{ date: string; nav: number }>;
  managers: Array<{ name: string; isCurrent: boolean; tenure?: number }>;
  expenseHistory: Array<{ date: string; ratio: number }>;
}

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

  const { fund, returns, navHistory, managers } = fundData;

  return (
    <>
      <div className="pt-24"></div>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="space-y-6">
            
            {/* Fund Header */}
            <div className="card-light p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 bg-brand-royal/10 text-brand-royal text-sm font-medium rounded-full">
                      {fund.schemeCode}
                    </span>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      fund.planType === 'Direct' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {fund.planType} Plan
                    </span>
                    <span className="px-3 py-1 bg-brand-gold/10 text-brand-gold text-sm font-medium rounded-full">
                      {fund.optionType}
                    </span>
                  </div>
                  
                  <h1 className="text-3xl md:text-4xl font-bold text-brand-navy mb-2">
                    {fund.schemeName}
                  </h1>
                  
                  <p className="text-lg text-brand-navy/70">
                    {fund.amcCode} • {fund.schemeType}
                  </p>
                </div>
                
                <button
                  onClick={() => router.push('/funds/advanced-search')}
                  className="text-brand-royal hover:text-brand-navy font-medium"
                >
                  ← Back to Search
                </button>
              </div>

              {/* NAV Display */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-gray-200">
                <div>
                  <p className="text-sm text-brand-navy/60 mb-1">Current NAV</p>
                  <p className="text-3xl font-bold text-brand-royal">
                    ₹{fund.latestNav ? parseFloat(fund.latestNav.toString()).toFixed(4) : 'N/A'}
                  </p>
                  <p className="text-xs text-brand-navy/50 mt-1">
                    As on {fund.latestNavDate ? new Date(fund.latestNavDate).toLocaleDateString('en-IN') : 'N/A'}
                  </p>
                </div>
                
                {fund.fundSize && (
                  <div>
                    <p className="text-sm text-brand-navy/60 mb-1">AUM</p>
                    <p className="text-2xl font-bold text-brand-navy">
                      ₹{parseFloat(fund.fundSize.toString()).toLocaleString()} Cr
                    </p>
                  </div>
                )}
                
                {fund.expenseRatio && (
                  <div>
                    <p className="text-sm text-brand-navy/60 mb-1">Expense Ratio</p>
                    <p className="text-2xl font-bold text-brand-navy">
                      {parseFloat(fund.expenseRatio.toString()).toFixed(2)}%
                    </p>
                  </div>
                )}
                
                {fund.inceptionDate && (
                  <div>
                    <p className="text-sm text-brand-navy/60 mb-1">Inception Date</p>
                    <p className="text-xl font-semibold text-brand-navy">
                      {fund.inceptionDate ? new Date(fund.inceptionDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : 'N/A'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Returns - Tabbed View */}
            <TabbedReturnsView returns={returns} />

            {/* NAV Chart */}
            <NAVChart data={navHistory} fundName={fund.schemeName} />

            {/* Fund Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Investment Details */}
              <div className="card-light p-6">
                <h3 className="text-xl font-bold text-brand-navy mb-4">Investment Details</h3>
                <div className="space-y-3">
                  {fund.minInvestment && (
                    <div className="flex justify-between">
                      <span className="text-brand-navy/70">Minimum Investment</span>
                      <span className="font-semibold text-brand-navy">
                        ₹{parseFloat(fund.minInvestment.toString()).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {fund.minSip && (
                    <div className="flex justify-between">
                      <span className="text-brand-navy/70">Minimum SIP</span>
                      <span className="font-semibold text-brand-navy">
                        ₹{parseFloat(fund.minSip.toString()).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {fund.exitLoad && (
                    <div className="flex justify-between">
                      <span className="text-brand-navy/70">Exit Load</span>
                      <span className="font-semibold text-brand-navy">{fund.exitLoad}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fund Managers */}
              {managers && managers.length > 0 && (
                <div className="card-light p-6">
                  <h3 className="text-xl font-bold text-brand-navy mb-4">Fund Managers</h3>
                  <div className="space-y-3">
                    {managers.map((manager, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-brand-navy">{manager.name}</p>
                          {manager.tenure && (
                            <p className="text-sm text-brand-navy/60">
                              {parseFloat(manager.tenure.toString()).toFixed(1)} years
                            </p>
                          )}
                        </div>
                        {manager.isCurrent && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Current
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card-light p-6">
              <h3 className="text-xl font-bold text-brand-navy mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-4">
                <button className="relative bg-brand-royal text-white px-6 py-3 rounded-lg font-medium opacity-60 cursor-not-allowed">
                  Invest Now
                  <span className="absolute -top-2 -right-2 bg-brand-gold text-brand-navy text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                    Coming Soon
                  </span>
                </button>
                <button className="relative border-2 border-brand-royal text-brand-royal px-6 py-3 rounded-lg font-medium opacity-60 cursor-not-allowed">
                  Start SIP
                  <span className="absolute -top-2 -right-2 bg-brand-gold text-brand-navy text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                    Coming Soon
                  </span>
                </button>
                <button className="relative border-2 border-gray-300 text-brand-navy px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-all opacity-60 cursor-not-allowed">
                  Add to Watchlist
                  <span className="absolute -top-2 -right-2 bg-brand-gold text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                    Coming Soon
                  </span>
                </button>
                <button 
                  onClick={() => router.push('/funds/compare')}
                  className="border-2 border-gray-300 text-brand-navy px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  Compare Funds
                </button>
              </div>
            </div>

          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
