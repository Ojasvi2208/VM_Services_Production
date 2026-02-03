'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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

const menuItems = [
  { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'holdings', label: 'Holdings', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'transactions', label: 'Transactions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: 'watchlist', label: 'Watchlist', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'transactions' | 'watchlist'>('overview');
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-brand-navy transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-white/10">
            <Link href="/" className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-2">
                <Image
                  src="/images/VM_Logo.jpg"
                  alt="VM Financial"
                  width={140}
                  height={35}
                  className="h-8 w-auto"
                />
              </div>
            </Link>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-gold rounded-full flex items-center justify-center text-brand-navy font-bold">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{user?.fullName || 'User'}</p>
                <p className="text-white/60 text-xs">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                  activeTab === item.id
                    ? 'bg-brand-gold text-brand-navy font-semibold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}

            <div className="pt-4 border-t border-white/10 mt-4">
              <Link
                href="/dashboard/add-investment"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-brand-royal text-white hover:bg-brand-royal/80 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Investment
              </Link>
            </div>
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-brand-navy">
                  Welcome, {user?.fullName?.split(' ')[0] || 'Investor'}!
                </h1>
                <p className="text-sm text-gray-500 hidden sm:block">Manage your investment portfolio</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/funds/search"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-brand-royal text-white rounded-lg hover:bg-brand-navy transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Funds
              </Link>
              <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {/* Portfolio Summary Cards - Vertical Stack */}
          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-brand-royal">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Invested</p>
                <p className="text-xl lg:text-2xl font-bold text-brand-navy mt-1">
                  {portfolio ? formatCurrency(portfolio.totalInvested) : '₹0'}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-brand-gold">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Value</p>
                <p className="text-xl lg:text-2xl font-bold text-brand-navy mt-1">
                  {portfolio ? formatCurrency(portfolio.currentValue) : '₹0'}
                </p>
              </div>

              <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${portfolio && portfolio.totalReturns >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Returns</p>
                <p className={`text-xl lg:text-2xl font-bold mt-1 ${portfolio && portfolio.totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {portfolio ? formatCurrency(portfolio.totalReturns) : '₹0'}
                </p>
                {portfolio && (
                  <p className={`text-xs font-medium ${portfolio.returnsPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(portfolio.returnsPercentage)}
                  </p>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-purple-500">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Holdings</p>
                <p className="text-xl lg:text-2xl font-bold text-brand-navy mt-1">
                  {portfolio?.holdingsCount || holdings.length || 0}
                </p>
                <p className="text-xs text-gray-500">Active Funds</p>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-royal mx-auto"></div>
                  <p className="mt-4 text-gray-500">Loading your portfolio...</p>
                </div>
              ) : activeTab === 'overview' ? (
                <div className="space-y-6">
                  {/* Quick Actions - Vertical List */}
                  <div>
                    <h3 className="text-lg font-bold text-brand-navy mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <Link
                        href="/dashboard/add-investment"
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-brand-royal to-brand-navy text-white rounded-xl hover:shadow-lg transition-all"
                      >
                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <div>
                          <span className="font-semibold">Add Investment</span>
                          <p className="text-white/70 text-sm">Record a new mutual fund purchase</p>
                        </div>
                      </Link>
                      
                      <Link
                        href="/funds/search"
                        className="flex items-center gap-4 p-4 bg-gray-50 text-brand-navy rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
                      >
                        <div className="w-12 h-12 bg-brand-gold/20 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <div>
                          <span className="font-semibold">Explore Funds</span>
                          <p className="text-gray-500 text-sm">Search from 37,000+ mutual funds</p>
                        </div>
                      </Link>
                      
                      <Link
                        href="/funds/compare"
                        className="flex items-center gap-4 p-4 bg-gray-50 text-brand-navy rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
                      >
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <span className="font-semibold">Compare Funds</span>
                          <p className="text-gray-500 text-sm">Compare performance of multiple funds</p>
                        </div>
                      </Link>
                      
                      <Link
                        href="/calculators/sip"
                        className="flex items-center gap-4 p-4 bg-gray-50 text-brand-navy rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
                      >
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <span className="font-semibold">SIP Calculator</span>
                          <p className="text-gray-500 text-sm">Plan your systematic investments</p>
                        </div>
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
                    <div className="space-y-3">
                      {holdings.map((holding) => (
                        <div key={holding.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <Link href={`/funds/${holding.schemeCode}`} className="text-brand-royal hover:underline font-semibold">
                                {holding.schemeName}
                              </Link>
                              <p className="text-sm text-gray-500 mt-1">{holding.units.toFixed(3)} units</p>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <div>
                                <p className="text-gray-500">Invested</p>
                                <p className="font-semibold">{formatCurrency(holding.purchaseAmount)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Current</p>
                                <p className="font-semibold">{formatCurrency(holding.currentValue)}</p>
                              </div>
                              <div className={`text-right ${holding.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <p className="text-gray-500">Returns</p>
                                <p className="font-bold">{formatPercent(holding.returnsPercentage)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'transactions' ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500">Transaction history will appear here once you make investments.</p>
                </div>
              ) : (
                <div>
                  {watchlist.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      <p className="text-gray-500">Your watchlist is empty. Add funds to track them here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {watchlist.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div>
                            <Link href={`/funds/${item.schemeCode}`} className="text-brand-royal hover:underline font-semibold">
                              {item.schemeName}
                            </Link>
                            <p className="text-sm text-gray-500">NAV: ₹{item.currentNav?.toFixed(2)}</p>
                          </div>
                          <div className={`text-right ${item.return1y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <p className="font-bold">{formatPercent(item.return1y)}</p>
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
    </div>
  );
}
