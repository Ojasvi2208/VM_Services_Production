'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  returnsPercentage: number;
  holdingsCount: number;
}

interface Holding {
  id: string;
  schemeCode: string;
  schemeName: string;
  units: number;
  purchaseNav: number;
  currentNav: number;
  purchaseAmount: number;
  currentValue: number;
  returns: number;
  returnsPercentage: number;
  purchaseDate: string;
}

interface WatchlistItem {
  id: string;
  schemeCode: string;
  schemeName: string;
  currentNav: number;
  return1y: number;
  addedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'transactions' | 'watchlist'>('overview');
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [portfolioRes, holdingsRes, watchlistRes] = await Promise.all([
        fetch('/api/portfolio/summary'),
        fetch('/api/portfolio/holdings'),
        fetch('/api/portfolio/watchlist')
      ]);

      if (portfolioRes.ok) {
        const data = await portfolioRes.json();
        setPortfolio(data.summary);
      }

      if (holdingsRes.ok) {
        const data = await holdingsRes.json();
        setHoldings(data.holdings || []);
      }

      if (watchlistRes.ok) {
        const data = await watchlistRes.json();
        setWatchlist(data.watchlist || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-royal mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <header className="bg-gradient-to-r from-brand-navy via-brand-royal to-brand-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Welcome, {user?.fullName?.split(' ')[0] || 'Investor'}!
              </h1>
              <p className="text-white/70 mt-1">Manage your investment portfolio</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/funds/search"
                className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Funds
              </Link>
              <button
                onClick={handleLogout}
                className="bg-red-500/20 hover:bg-red-500/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-brand-royal">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Invested</p>
                <p className="text-2xl font-bold text-brand-navy mt-1">
                  {portfolio ? formatCurrency(portfolio.totalInvested) : '₹0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-royal/10 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-brand-gold">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Current Value</p>
                <p className="text-2xl font-bold text-brand-navy mt-1">
                  {portfolio ? formatCurrency(portfolio.currentValue) : '₹0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-gold/10 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-2xl shadow-lg p-6 border-l-4 ${portfolio && portfolio.totalReturns >= 0 ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Returns</p>
                <p className={`text-2xl font-bold mt-1 ${portfolio && portfolio.totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {portfolio ? formatCurrency(portfolio.totalReturns) : '₹0'}
                </p>
                {portfolio && (
                  <p className={`text-sm font-medium ${portfolio.returnsPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(portfolio.returnsPercentage)}
                  </p>
                )}
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${portfolio && portfolio.totalReturns >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <svg className={`w-6 h-6 ${portfolio && portfolio.totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={portfolio && portfolio.totalReturns >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Holdings</p>
                <p className="text-2xl font-bold text-brand-navy mt-1">
                  {portfolio?.holdingsCount || holdings.length || 0}
                </p>
                <p className="text-sm text-gray-500">Active Funds</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                { id: 'holdings', label: 'Holdings', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                { id: 'transactions', label: 'Transactions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
                { id: 'watchlist', label: 'Watchlist', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-4 px-4 text-center font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-b-2 border-brand-royal text-brand-royal bg-brand-royal/5'
                      : 'text-gray-500 hover:text-brand-navy hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-royal mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading your portfolio...</p>
              </div>
            ) : activeTab === 'overview' ? (
              <div className="space-y-8">
                {/* Quick Actions */}
                <div>
                  <h3 className="text-lg font-bold text-brand-navy mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link
                      href="/dashboard/add-investment"
                      className="bg-gradient-to-br from-brand-royal to-brand-navy text-white p-4 rounded-xl text-center hover:shadow-lg transition-all hover:scale-105"
                    >
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="font-medium">Add Investment</span>
                    </Link>
                    <Link
                      href="/funds/search"
                      className="bg-gradient-to-br from-brand-gold to-yellow-600 text-white p-4 rounded-xl text-center hover:shadow-lg transition-all hover:scale-105"
                    >
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="font-medium">Explore Funds</span>
                    </Link>
                    <Link
                      href="/funds/compare"
                      className="bg-gradient-to-br from-purple-600 to-purple-800 text-white p-4 rounded-xl text-center hover:shadow-lg transition-all hover:scale-105"
                    >
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="font-medium">Compare Funds</span>
                    </Link>
                    <Link
                      href="/calculators"
                      className="bg-gradient-to-br from-green-600 to-green-800 text-white p-4 rounded-xl text-center hover:shadow-lg transition-all hover:scale-105"
                    >
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">Calculators</span>
                    </Link>
                  </div>
                </div>

                {/* Empty State */}
                {holdings.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">No Investments Yet</h3>
                    <p className="text-gray-500 mb-6">Start building your portfolio by adding your first investment</p>
                    <Link
                      href="/dashboard/add-investment"
                      className="inline-flex items-center gap-2 bg-brand-royal text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-navy transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Your First Investment
                    </Link>
                  </div>
                )}
              </div>
            ) : activeTab === 'holdings' ? (
              <div>
                {holdings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No holdings yet. Add your first investment to get started.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Fund</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Units</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Invested</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Current</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Returns</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((holding) => (
                          <tr key={holding.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-4 px-4">
                              <Link href={`/funds/${holding.schemeCode}`} className="text-brand-royal hover:underline font-medium">
                                {holding.schemeName}
                              </Link>
                            </td>
                            <td className="text-right py-4 px-4">{holding.units.toFixed(3)}</td>
                            <td className="text-right py-4 px-4">{formatCurrency(holding.purchaseAmount)}</td>
                            <td className="text-right py-4 px-4">{formatCurrency(holding.currentValue)}</td>
                            <td className={`text-right py-4 px-4 font-semibold ${holding.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatPercent(holding.returnsPercentage)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeTab === 'transactions' ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Transaction history will appear here once you make investments.</p>
              </div>
            ) : (
              <div>
                {watchlist.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Your watchlist is empty. Add funds to track them here.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {watchlist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                          <Link href={`/funds/${item.schemeCode}`} className="text-brand-royal hover:underline font-medium">
                            {item.schemeName}
                          </Link>
                          <p className="text-sm text-gray-500">NAV: ₹{item.currentNav?.toFixed(2)}</p>
                        </div>
                        <div className={`text-right ${item.return1y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <p className="font-semibold">{formatPercent(item.return1y)}</p>
                          <p className="text-xs text-gray-500">1Y Return</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
