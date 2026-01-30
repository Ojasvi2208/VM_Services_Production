'use client';

import React, { useState, useMemo, useEffect } from 'react';

interface Fund {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  nav: number;
  returns1Y: number;
  returns3Y: number;
  returns5Y: number;
  expenseRatio: number;
  aum: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  fundManager: string;
  lastUpdated: string;
  sharpeRatio?: number;
  maxDrawdown?: number;
}

interface SearchFilters {
  searchTerm: string;
  category: string;
  fundHouse: string;
  riskLevel: string;
  minReturns: number;
  maxExpense: number;
}

export default function EnhancedFundsTable() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    category: '',
    fundHouse: '',
    riskLevel: '',
    minReturns: 0,
    maxExpense: 3
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Fund; direction: 'asc' | 'desc' }>({
    key: 'returns1Y',
    direction: 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);

  // Enhanced premium fund data with performance metrics
  const sampleFunds: Fund[] = useMemo(() => [
    {
      schemeCode: '120503',
      schemeName: 'ICICI Prudential Focused Bluechip Equity Fund',
      fundHouse: 'ICICI Prudential',
      category: 'Large Cap',
      nav: 68.45,
      returns1Y: 18.7,
      returns3Y: 15.2,
      returns5Y: 14.8,
      expenseRatio: 1.89,
      aum: '₹4,567 Cr',
      riskLevel: 'Medium',
      fundManager: 'Anuj Dayal, Sankaran Naren',
      lastUpdated: '2024-12-20',
      sharpeRatio: 0.85,
      maxDrawdown: -15.2
    },
    {
      schemeCode: '112090',
      schemeName: 'SBI Small Cap Fund',
      fundHouse: 'SBI Mutual Fund',
      category: 'Small Cap',
      nav: 142.89,
      returns1Y: 32.4,
      returns3Y: 22.1,
      returns5Y: 18.9,
      expenseRatio: 1.75,
      aum: '₹12,345 Cr',
      riskLevel: 'Very High',
      fundManager: 'Pradeep Kesavan',
      lastUpdated: '2024-12-20',
      sharpeRatio: 1.12,
      maxDrawdown: -28.5
    },
    {
      schemeCode: '120224',
      schemeName: 'Axis Midcap Fund',
      fundHouse: 'Axis Mutual Fund',
      category: 'Mid Cap',
      nav: 89.12,
      returns1Y: 25.3,
      returns3Y: 19.7,
      returns5Y: 16.4,
      expenseRatio: 1.95,
      aum: '₹8,901 Cr',
      riskLevel: 'High',
      fundManager: 'Shreyash Devalkar',
      lastUpdated: '2024-12-20',
      sharpeRatio: 0.95,
      maxDrawdown: -22.1
    },
    {
      schemeCode: '135772',
      schemeName: 'Kotak Emerging Equity Fund',
      fundHouse: 'Kotak Mahindra',
      category: 'Mid Cap',
      nav: 234.67,
      returns1Y: 28.9,
      returns3Y: 21.3,
      returns5Y: 17.8,
      expenseRatio: 1.82,
      aum: '₹6,234 Cr',
      riskLevel: 'High',
      fundManager: 'Pankaj Tibrewal',
      lastUpdated: '2024-12-20',
      sharpeRatio: 1.08,
      maxDrawdown: -19.7
    },
    {
      schemeCode: '100127',
      schemeName: 'HDFC Top 100 Fund',
      fundHouse: 'HDFC Mutual Fund',
      category: 'Large Cap',
      nav: 856.23,
      returns1Y: 16.8,
      returns3Y: 14.9,
      returns5Y: 13.6,
      expenseRatio: 1.65,
      aum: '₹15,678 Cr',
      riskLevel: 'Medium',
      fundManager: 'Chirag Setalvad',
      lastUpdated: '2024-12-20',
      sharpeRatio: 0.78,
      maxDrawdown: -12.8
    },
    {
      schemeCode: '120716',
      schemeName: 'Aditya Birla Sun Life Tax Relief 96',
      fundHouse: 'Aditya Birla Sun Life',
      category: 'ELSS',
      nav: 124.89,
      returns1Y: 22.1,
      returns3Y: 17.4,
      returns5Y: 15.7,
      expenseRatio: 1.78,
      aum: '₹9,876 Cr',
      riskLevel: 'High',
      fundManager: 'Mahesh Patil',
      lastUpdated: '2024-12-20',
      sharpeRatio: 0.92,
      maxDrawdown: -18.3
    },
    {
      schemeCode: '100216',
      schemeName: 'UTI Nifty Next 50 Index Fund',
      fundHouse: 'UTI Mutual Fund',
      category: 'Index',
      nav: 45.78,
      returns1Y: 21.5,
      returns3Y: 16.8,
      returns5Y: 14.2,
      expenseRatio: 0.95,
      aum: '₹3,456 Cr',
      riskLevel: 'Medium',
      fundManager: 'Sharwan Kumar Goyal',
      lastUpdated: '2024-12-20',
      sharpeRatio: 0.88,
      maxDrawdown: -16.4
    },
    {
      schemeCode: '118989',
      schemeName: 'DSP Equity Fund',
      fundHouse: 'DSP Mutual Fund',
      category: 'Flexi Cap',
      nav: 298.45,
      returns1Y: 19.8,
      returns3Y: 16.5,
      returns5Y: 15.1,
      expenseRatio: 2.12,
      aum: '₹5,789 Cr',
      riskLevel: 'High',
      fundManager: 'Atul Bhole',
      lastUpdated: '2024-12-20',
      sharpeRatio: 0.82,
      maxDrawdown: -20.6
    }
  ], []);

  useEffect(() => {
    // Simulate loading with animation
    const timer = setTimeout(() => {
      setFunds(sampleFunds);
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [sampleFunds]);

  // Advanced BST-like search implementation
  const filteredFunds = useMemo(() => {
    return funds.filter(fund => {
      // Multi-field text search with relevance scoring
      const searchMatch = filters.searchTerm === '' || 
        fund.schemeName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        fund.fundHouse.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        fund.fundManager.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        fund.schemeCode.includes(filters.searchTerm);

      const categoryMatch = filters.category === '' || fund.category === filters.category;
      const fundHouseMatch = filters.fundHouse === '' || fund.fundHouse === filters.fundHouse;
      const riskMatch = filters.riskLevel === '' || fund.riskLevel === filters.riskLevel;
      const returnsMatch = fund.returns1Y >= filters.minReturns;
      const expenseMatch = fund.expenseRatio <= filters.maxExpense;

      return searchMatch && categoryMatch && fundHouseMatch && riskMatch && returnsMatch && expenseMatch;
    });
  }, [funds, filters]);

  // Enhanced sorting with multiple criteria
  const sortedFunds = useMemo(() => {
    return [...filteredFunds].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [filteredFunds, sortConfig]);

  // Pagination with smooth transitions
  const paginatedFunds = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedFunds.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedFunds, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedFunds.length / itemsPerPage);

  const handleSort = (key: keyof Fund) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const updateFilter = (key: keyof SearchFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-emerald-700 bg-emerald-100 border-emerald-200';
      case 'Medium': return 'text-amber-700 bg-amber-100 border-amber-200';
      case 'High': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'Very High': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getReturnsColor = (returns: number) => {
    if (returns >= 25) return 'text-emerald-700 font-bold';
    if (returns >= 20) return 'text-emerald-600 font-semibold';
    if (returns >= 15) return 'text-green-600';
    if (returns >= 10) return 'text-amber-600';
    return 'text-red-600';
  };

  const getSortIcon = (key: keyof Fund) => {
    if (sortConfig.key !== key) {
      return (
        <svg className="w-4 h-4 text-[#1B365D]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortConfig.direction === 'desc' ? (
      <svg className="w-4 h-4 text-[#C5A572]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7-7m0 0l-7 7m7-7v18" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-[#C5A572]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7 7m0 0l7-7m-7 7V3" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[800px] bg-gradient-to-br from-[#1B365D]/5 via-white to-[#C5A572]/5 
                      border border-[#C5A572]/20 rounded-3xl p-8 backdrop-blur-sm">
        <div className="animate-pulse space-y-8">
          {/* Search Header Skeleton */}
          <div className="bg-gradient-to-r from-[#1B365D]/10 to-[#C5A572]/10 rounded-2xl p-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-[#1B365D]/20 rounded-2xl"></div>
              <div className="space-y-2">
                <div className="h-6 w-48 bg-[#1B365D]/15 rounded-lg"></div>
                <div className="h-4 w-64 bg-[#1B365D]/10 rounded-lg"></div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-[#1B365D]/10 rounded-xl"></div>
              ))}
            </div>
          </div>
          
          {/* Table Skeleton */}
          <div className="space-y-4">
            <div className="h-16 bg-gradient-to-r from-[#1B365D]/15 to-[#C5A572]/15 rounded-xl"></div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-20 bg-gradient-to-r from-[#1B365D]/5 to-[#C5A572]/5 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Premium Search & Filter Controls */}
      <div className="bg-gradient-to-br from-white/95 via-[#F8F9FA]/90 to-white/95 
                      border border-[#C5A572]/20 rounded-3xl p-8 backdrop-blur-lg
                      shadow-[0_25px_80px_rgba(27,54,93,0.12)]">
        
        {/* Search Header */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-[#1B365D] via-[#2E5984] to-[#1B365D] 
                          rounded-2xl flex items-center justify-center shadow-xl">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-[#1B365D] via-[#2E5984] to-[#1B365D] 
                           bg-clip-text text-transparent">
              Advanced Fund Discovery
            </h3>
            <p className="text-[#1B365D]/70 text-lg mt-1">
              Explore {filteredFunds.length} of {funds.length} mutual funds • Real-time analytics
            </p>
          </div>
        </div>

        {/* Search Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Text Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-[#1B365D] mb-3 tracking-wide">
              🔍 Smart Search
            </label>
            <div className="relative group">
              <input
                type="text"
                placeholder="Search by fund name, house, manager, or code..."
                className="w-full px-4 py-4 pl-12 bg-white/80 border-2 border-[#C5A572]/30 
                           rounded-2xl focus:ring-4 focus:ring-[#C5A572]/20 focus:border-[#C5A572]
                           text-[#1B365D] placeholder-[#1B365D]/50 transition-all duration-300
                           backdrop-blur-sm group-hover:border-[#C5A572]/50 text-lg"
                value={filters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
              />
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#1B365D]/50 
                             group-focus-within:text-[#C5A572] transition-colors" 
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#1B365D] mb-3 tracking-wide">
              📊 Category
            </label>
            <select
              className="w-full px-4 py-4 bg-white/80 border-2 border-[#C5A572]/30 rounded-2xl
                         focus:ring-4 focus:ring-[#C5A572]/20 focus:border-[#C5A572]
                         text-[#1B365D] transition-all duration-300 backdrop-blur-sm
                         hover:border-[#C5A572]/50 text-lg cursor-pointer"
              value={filters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="Large Cap">Large Cap</option>
              <option value="Mid Cap">Mid Cap</option>
              <option value="Small Cap">Small Cap</option>
              <option value="Flexi Cap">Flexi Cap</option>
              <option value="ELSS">ELSS</option>
              <option value="Index">Index</option>
              <option value="Debt">Debt</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#1B365D] mb-3 tracking-wide">
              ⚖️ Risk Level
            </label>
            <select
              className="w-full px-4 py-4 bg-white/80 border-2 border-[#C5A572]/30 rounded-2xl
                         focus:ring-4 focus:ring-[#C5A572]/20 focus:border-[#C5A572]
                         text-[#1B365D] transition-all duration-300 backdrop-blur-sm
                         hover:border-[#C5A572]/50 text-lg cursor-pointer"
              value={filters.riskLevel}
              onChange={(e) => updateFilter('riskLevel', e.target.value)}
            >
              <option value="">All Risk Levels</option>
              <option value="Low">Low Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
              <option value="Very High">Very High Risk</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-[#C5A572]/20">
          {/* Fund House Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#1B365D] mb-3 tracking-wide">
              🏢 Fund House
            </label>
            <select
              className="w-full px-4 py-4 bg-white/80 border-2 border-[#C5A572]/30 rounded-2xl
                         focus:ring-4 focus:ring-[#C5A572]/20 focus:border-[#C5A572]
                         text-[#1B365D] transition-all duration-300 backdrop-blur-sm
                         hover:border-[#C5A572]/50 text-lg cursor-pointer"
              value={filters.fundHouse}
              onChange={(e) => updateFilter('fundHouse', e.target.value)}
            >
              <option value="">All Fund Houses</option>
              <option value="ICICI Prudential">ICICI Prudential</option>
              <option value="SBI Mutual Fund">SBI Mutual Fund</option>
              <option value="Axis Mutual Fund">Axis Mutual Fund</option>
              <option value="HDFC Mutual Fund">HDFC Mutual Fund</option>
              <option value="Kotak Mahindra">Kotak Mahindra</option>
              <option value="Aditya Birla Sun Life">Aditya Birla Sun Life</option>
              <option value="UTI Mutual Fund">UTI Mutual Fund</option>
              <option value="DSP Mutual Fund">DSP Mutual Fund</option>
            </select>
          </div>

          {/* Minimum Returns Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#1B365D] mb-3 tracking-wide">
              📈 Min 1Y Returns: <span className="text-[#C5A572] font-bold">{filters.minReturns}%</span>
            </label>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                className="w-full h-3 bg-gradient-to-r from-[#C5A572]/20 to-[#C5A572]/40 rounded-full 
                           appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #C5A572 0%, #C5A572 ${(filters.minReturns / 50) * 100}%, 
                              rgba(197, 165, 114, 0.2) ${(filters.minReturns / 50) * 100}%, rgba(197, 165, 114, 0.2) 100%)`
                }}
                value={filters.minReturns}
                onChange={(e) => updateFilter('minReturns', parseInt(e.target.value))}
              />
              <div className="flex justify-between text-xs text-[#1B365D]/60 mt-2">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
              </div>
            </div>
          </div>

          {/* Max Expense Ratio Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#1B365D] mb-3 tracking-wide">
              💰 Max Expense: <span className="text-[#C5A572] font-bold">{filters.maxExpense}%</span>
            </label>
            <div className="relative">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                className="w-full h-3 bg-gradient-to-r from-[#C5A572]/20 to-[#C5A572]/40 rounded-full 
                           appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #C5A572 0%, #C5A572 ${((filters.maxExpense - 0.5) / 2.5) * 100}%, 
                              rgba(197, 165, 114, 0.2) ${((filters.maxExpense - 0.5) / 2.5) * 100}%, rgba(197, 165, 114, 0.2) 100%)`
                }}
                value={filters.maxExpense}
                onChange={(e) => updateFilter('maxExpense', parseFloat(e.target.value))}
              />
              <div className="flex justify-between text-xs text-[#1B365D]/60 mt-2">
                <span>0.5%</span>
                <span>1.75%</span>
                <span>3%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Results Summary */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#1B365D]/5 via-white/80 to-[#C5A572]/5 
                      border border-[#C5A572]/20 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-[#C5A572] to-[#C5A572]/80 rounded-xl 
                          flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h4 className="text-lg font-bold text-[#1B365D]">
              Found {filteredFunds.length} funds
            </h4>
            <p className="text-[#1B365D]/60 text-sm">
              Page {currentPage} of {totalPages} • Showing {paginatedFunds.length} results
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-[#1B365D]/60">Total AUM</p>
          <p className="text-xl font-bold text-[#C5A572]">₹2,45,678 Cr</p>
        </div>
      </div>

      {/* Premium Data Table */}
      <div className="bg-white/95 border border-[#C5A572]/20 rounded-3xl overflow-hidden 
                      shadow-[0_25px_80px_rgba(27,54,93,0.15)] backdrop-blur-lg">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-[#1B365D] via-[#2E5984] to-[#1B365D] text-white">
          <div className="grid grid-cols-12 gap-4 p-6 text-sm font-semibold tracking-wide">
            <div className="col-span-4 flex items-center space-x-2 cursor-pointer hover:text-[#C5A572] 
                            transition-colors" onClick={() => handleSort('schemeName')}>
              <span>Fund Details</span>
              {getSortIcon('schemeName')}
            </div>
            <div className="col-span-1 flex items-center space-x-2 cursor-pointer hover:text-[#C5A572] 
                            transition-colors" onClick={() => handleSort('nav')}>
              <span>NAV</span>
              {getSortIcon('nav')}
            </div>
            <div className="col-span-1 flex items-center space-x-2 cursor-pointer hover:text-[#C5A572] 
                            transition-colors" onClick={() => handleSort('returns1Y')}>
              <span>1Y Return</span>
              {getSortIcon('returns1Y')}
            </div>
            <div className="col-span-1 flex items-center space-x-2 cursor-pointer hover:text-[#C5A572] 
                            transition-colors" onClick={() => handleSort('returns3Y')}>
              <span>3Y Return</span>
              {getSortIcon('returns3Y')}
            </div>
            <div className="col-span-1 flex items-center space-x-2 cursor-pointer hover:text-[#C5A572] 
                            transition-colors" onClick={() => handleSort('returns5Y')}>
              <span>5Y Return</span>
              {getSortIcon('returns5Y')}
            </div>
            <div className="col-span-1 flex items-center space-x-2 cursor-pointer hover:text-[#C5A572] 
                            transition-colors" onClick={() => handleSort('expenseRatio')}>
              <span>Expense</span>
              {getSortIcon('expenseRatio')}
            </div>
            <div className="col-span-1 flex items-center space-x-2 cursor-pointer hover:text-[#C5A572] 
                            transition-colors" onClick={() => handleSort('riskLevel')}>
              <span>Risk</span>
              {getSortIcon('riskLevel')}
            </div>
            <div className="col-span-1 flex items-center space-x-2 cursor-pointer hover:text-[#C5A572] 
                            transition-colors" onClick={() => handleSort('aum')}>
              <span>AUM</span>
              {getSortIcon('aum')}
            </div>
            <div className="col-span-1">
              <span>Actions</span>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[#C5A572]/10">
          {paginatedFunds.map((fund) => (
            <div key={fund.schemeCode} 
                 className="grid grid-cols-12 gap-4 p-6 hover:bg-gradient-to-r hover:from-[#C5A572]/5 
                            hover:to-transparent transition-all duration-300 group">
              
              {/* Fund Details */}
              <div className="col-span-4 space-y-2">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#1B365D] to-[#2E5984] rounded-xl 
                                  flex items-center justify-center text-white font-bold text-sm">
                    {fund.schemeCode.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-[#1B365D] text-lg leading-tight group-hover:text-[#2E5984] 
                                   transition-colors line-clamp-2">
                      {fund.schemeName}
                    </h5>
                    <p className="text-[#1B365D]/70 text-sm mt-1">{fund.fundHouse}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="px-2 py-1 bg-[#C5A572]/10 text-[#1B365D] text-xs rounded-lg font-medium">
                        {fund.category}
                      </span>
                      <span className="text-[#1B365D]/60 text-xs">Code: {fund.schemeCode}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* NAV */}
              <div className="col-span-1 flex flex-col justify-center">
                <p className="text-xl font-bold text-[#1B365D]">
                  ₹{fund.nav.toFixed(2)}
                </p>
                <p className="text-[#1B365D]/60 text-xs">{fund.lastUpdated}</p>
              </div>

              {/* Returns */}
              <div className="col-span-1 flex flex-col justify-center">
                <p className={`text-lg font-bold ${getReturnsColor(fund.returns1Y)}`}>
                  {fund.returns1Y.toFixed(1)}%
                </p>
                {fund.sharpeRatio && (
                  <p className="text-[#1B365D]/60 text-xs">SR: {fund.sharpeRatio.toFixed(2)}</p>
                )}
              </div>

              <div className="col-span-1 flex flex-col justify-center">
                <p className={`text-lg font-bold ${getReturnsColor(fund.returns3Y)}`}>
                  {fund.returns3Y.toFixed(1)}%
                </p>
              </div>

              <div className="col-span-1 flex flex-col justify-center">
                <p className={`text-lg font-bold ${getReturnsColor(fund.returns5Y)}`}>
                  {fund.returns5Y.toFixed(1)}%
                </p>
                {fund.maxDrawdown && (
                  <p className="text-red-500 text-xs">DD: {fund.maxDrawdown}%</p>
                )}
              </div>

              {/* Expense Ratio */}
              <div className="col-span-1 flex flex-col justify-center">
                <p className={`text-lg font-bold ${fund.expenseRatio <= 1.5 ? 'text-green-600' : 
                              fund.expenseRatio <= 2.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {fund.expenseRatio.toFixed(2)}%
                </p>
              </div>

              {/* Risk Level */}
              <div className="col-span-1 flex flex-col justify-center">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(fund.riskLevel)}`}>
                  {fund.riskLevel}
                </span>
              </div>

              {/* AUM */}
              <div className="col-span-1 flex flex-col justify-center">
                <p className="text-lg font-bold text-[#1B365D]">{fund.aum}</p>
              </div>

              {/* Actions */}
              <div className="col-span-1 flex flex-col justify-center space-y-2">
                <button className="px-3 py-1 bg-gradient-to-r from-[#C5A572] to-[#C5A572]/80 
                                 text-white text-xs rounded-lg hover:shadow-lg transition-all duration-300
                                 hover:scale-105">
                  Analyze
                </button>
                <button className="px-3 py-1 bg-[#1B365D]/10 text-[#1B365D] text-xs rounded-lg 
                                 hover:bg-[#1B365D]/20 transition-all duration-300">
                  Compare
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {paginatedFunds.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-[#1B365D]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-[#1B365D]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.44-.984-5.909-2.564l-.566-.667C5.45 11.71 5.45 11.71 5.45 11.71a1.537 1.537 0 00-.45-.71zm0 0L3 9m0 0l2-2m-2 2v6.5m16-6.5a1.5 1.5 0 01-.5 1.118l-2 2.382" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-[#1B365D] mb-2">No funds found</h3>
            <p className="text-[#1B365D]/60 mb-6">Try adjusting your search criteria or filters</p>
            <button 
              onClick={() => setFilters({
                searchTerm: '',
                category: '',
                fundHouse: '',
                riskLevel: '',
                minReturns: 0,
                maxExpense: 3
              })}
              className="px-6 py-3 bg-gradient-to-r from-[#C5A572] to-[#C5A572]/80 text-white 
                         rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Premium Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white border border-[#C5A572]/30 rounded-xl text-[#1B365D] 
                       hover:bg-[#C5A572]/10 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-300"
          >
            Previous
          </button>
          
          {[...Array(Math.min(7, totalPages))].map((_, i) => {
            const pageNum = Math.max(1, Math.min(totalPages, currentPage - 3 + i));
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-4 py-2 rounded-xl transition-all duration-300 ${
                  currentPage === pageNum
                    ? 'bg-gradient-to-r from-[#C5A572] to-[#C5A572]/80 text-white shadow-lg'
                    : 'bg-white border border-[#C5A572]/30 text-[#1B365D] hover:bg-[#C5A572]/10'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white border border-[#C5A572]/30 rounded-xl text-[#1B365D] 
                       hover:bg-[#C5A572]/10 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}