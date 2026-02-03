'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface FundSearchResult {
  schemeCode: string;
  schemeName: string;
  latestNav: number;
}

export default function AddInvestmentPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    units: '',
    purchaseNav: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const searchFunds = async () => {
      if (searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/funds/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = await response.json();
        
        if (data.funds) {
          setSearchResults(data.funds.map((f: any) => ({
            schemeCode: f.scheme_code || f.schemeCode,
            schemeName: f.scheme_name || f.schemeName,
            latestNav: parseFloat(f.latest_nav || f.latestNav) || 0
          })));
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchFunds, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelectFund = (fund: FundSearchResult) => {
    setSelectedFund(fund);
    setSearchQuery('');
    setSearchResults([]);
    setFormData(prev => ({
      ...prev,
      purchaseNav: fund.latestNav.toString()
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const calculateAmount = () => {
    const units = parseFloat(formData.units) || 0;
    const nav = parseFloat(formData.purchaseNav) || 0;
    return units * nav;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFund) {
      setError('Please select a fund');
      return;
    }

    if (!formData.units || parseFloat(formData.units) <= 0) {
      setError('Please enter valid units');
      return;
    }

    if (!formData.purchaseNav || parseFloat(formData.purchaseNav) <= 0) {
      setError('Please enter valid purchase NAV');
      return;
    }

    if (!formData.purchaseDate) {
      setError('Please enter purchase date');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/portfolio/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeCode: selectedFund.schemeCode,
          units: parseFloat(formData.units),
          purchaseNav: parseFloat(formData.purchaseNav),
          purchaseDate: formData.purchaseDate,
          notes: formData.notes
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setError(data.error || 'Failed to add investment');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-royal"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Investment Added!</h2>
          <p className="text-gray-600 mb-4">Your investment has been recorded successfully.</p>
          <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-brand-navy via-brand-royal to-brand-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Add Investment</h1>
              <p className="text-white/70">Record a new mutual fund investment</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Fund Search */}
            <div>
              <label className="block text-sm font-semibold text-brand-navy mb-2">
                Select Fund <span className="text-red-500">*</span>
              </label>
              
              {selectedFund ? (
                <div className="flex items-center justify-between p-4 bg-brand-royal/5 border-2 border-brand-royal rounded-xl">
                  <div>
                    <p className="font-semibold text-brand-navy">{selectedFund.schemeName}</p>
                    <p className="text-sm text-gray-500">Code: {selectedFund.schemeCode} | NAV: ₹{selectedFund.latestNav.toFixed(4)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFund(null)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a mutual fund..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-royal"></div>
                    </div>
                  )}
                  
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((fund) => (
                        <button
                          key={fund.schemeCode}
                          type="button"
                          onClick={() => handleSelectFund(fund)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="font-medium text-brand-navy text-sm">{fund.schemeName}</p>
                          <p className="text-xs text-gray-500">NAV: ₹{fund.latestNav.toFixed(4)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Units and NAV */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="units" className="block text-sm font-semibold text-brand-navy mb-2">
                  Units <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="units"
                  name="units"
                  value={formData.units}
                  onChange={handleChange}
                  step="0.0001"
                  min="0"
                  placeholder="e.g., 100.5432"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                />
              </div>

              <div>
                <label htmlFor="purchaseNav" className="block text-sm font-semibold text-brand-navy mb-2">
                  Purchase NAV <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="purchaseNav"
                  name="purchaseNav"
                  value={formData.purchaseNav}
                  onChange={handleChange}
                  step="0.0001"
                  min="0"
                  placeholder="e.g., 45.6789"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                />
              </div>
            </div>

            {/* Purchase Date */}
            <div>
              <label htmlFor="purchaseDate" className="block text-sm font-semibold text-brand-navy mb-2">
                Purchase Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="purchaseDate"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
              />
            </div>

            {/* Investment Amount Display */}
            {formData.units && formData.purchaseNav && (
              <div className="bg-gradient-to-r from-brand-royal/10 to-brand-gold/10 rounded-xl p-4">
                <p className="text-sm text-gray-600">Investment Amount</p>
                <p className="text-2xl font-bold text-brand-navy">
                  ₹{calculateAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-semibold text-brand-navy mb-2">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any additional notes about this investment..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedFund}
              className="w-full bg-gradient-to-r from-brand-royal to-brand-navy text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Adding Investment...
                </span>
              ) : (
                'Add Investment'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
