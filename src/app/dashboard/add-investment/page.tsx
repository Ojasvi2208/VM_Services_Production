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
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/signin');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const searchFunds = async () => {
      if (searchQuery.length < 3) { setSearchResults([]); return; }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/funds/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = await res.json();
        if (data.funds) {
          setSearchResults(data.funds.map((f: Record<string, string>) => ({
            schemeCode: f.scheme_code || f.schemeCode,
            schemeName: f.scheme_name || f.schemeName,
            latestNav: parseFloat(f.latest_nav || f.latestNav) || 0,
          })));
        }
      } catch { /* silent */ } finally { setIsSearching(false); }
    };
    const t = setTimeout(searchFunds, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSelectFund = (fund: FundSearchResult) => {
    setSelectedFund(fund);
    setSearchQuery('');
    setSearchResults([]);
    setFormData(prev => ({ ...prev, purchaseNav: fund.latestNav.toString() }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const calculateAmount = () => {
    const units = parseFloat(formData.units) || 0;
    const nav = parseFloat(formData.purchaseNav) || 0;
    return units * nav;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFund) { setError('Please select a fund'); return; }
    if (!formData.units || parseFloat(formData.units) <= 0) { setError('Please enter valid units'); return; }
    if (!formData.purchaseNav || parseFloat(formData.purchaseNav) <= 0) { setError('Please enter valid purchase NAV'); return; }
    if (!formData.purchaseDate) { setError('Please enter purchase date'); return; }

    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/portfolio/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeCode: selectedFund.schemeCode,
          units: parseFloat(formData.units),
          purchaseNav: parseFloat(formData.purchaseNav),
          purchaseDate: formData.purchaseDate,
          notes: formData.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setError(data.error || 'Failed to add investment');
      }
    } catch { setError('Network error. Please try again.'); } finally { setIsSubmitting(false); }
  };

  const inputCls = 'w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:border-[#44f593]/50 transition-all';
  const labelCls = 'text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#060D0A] flex items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-[#44f593]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (success) {
    return (
      <div className="min-h-screen bg-[#060D0A] flex items-center justify-center px-4">
        <div className="glass-card rounded-3xl p-10 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-[#dce5df] mb-2">Investment Added</h2>
          <p className="text-[#859586] text-sm mb-4">Your investment has been recorded successfully.</p>
          <p className="text-xs text-[#3c4a3e] font-mono">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060D0A]">
      {/* Header */}
      <header className="bg-[#08100d] border-b border-white/8 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-white/5 transition-colors text-[#859586] hover:text-[#dce5df]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-base font-display font-bold text-[#dce5df]">Add Investment</h1>
            <p className="text-xs text-[#859586] font-mono">Record a new mutual fund holding</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass-card rounded-2xl p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {error && (
              <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Fund Search */}
            <div>
              <label className={labelCls}>Select Fund <span className="text-[#ffb4ab]">*</span></label>
              {selectedFund ? (
                <div className="flex items-center justify-between p-4 bg-[#44f593]/5 border border-[#44f593]/20 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-[#dce5df]">{selectedFund.schemeName}</p>
                    <p className="text-xs text-[#859586] font-mono mt-0.5">Code: {selectedFund.schemeCode} · NAV: ₹{selectedFund.latestNav.toFixed(4)}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedFund(null)}
                    className="p-2 text-[#ffb4ab]/60 hover:text-[#ffb4ab] rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search for a mutual fund…"
                    className={inputCls}
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin w-4 h-4 text-[#44f593]" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 glass-card rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      {searchResults.map(fund => (
                        <button key={fund.schemeCode} type="button" onClick={() => handleSelectFund(fund)}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-b-0">
                          <p className="text-sm font-medium text-[#dce5df]">{fund.schemeName}</p>
                          <p className="text-xs text-[#859586] font-mono">NAV: ₹{fund.latestNav.toFixed(4)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Units + NAV */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Units <span className="text-[#ffb4ab]">*</span></label>
                <input type="number" name="units" value={formData.units} onChange={handleChange}
                  step="0.0001" min="0" placeholder="e.g., 100.5432" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Purchase NAV <span className="text-[#ffb4ab]">*</span></label>
                <input type="number" name="purchaseNav" value={formData.purchaseNav} onChange={handleChange}
                  step="0.0001" min="0" placeholder="e.g., 45.6789" className={inputCls} />
              </div>
            </div>

            {/* Purchase Date */}
            <div>
              <label className={labelCls}>Purchase Date <span className="text-[#ffb4ab]">*</span></label>
              <input type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className={`${inputCls} [color-scheme:dark]`} />
            </div>

            {/* Computed amount */}
            {formData.units && formData.purchaseNav && (
              <div className="bg-[#44f593]/5 border border-[#44f593]/15 rounded-xl p-4">
                <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-1">Investment Amount</p>
                <p className="text-2xl font-mono font-bold text-[#44f593]">
                  ₹{calculateAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes (optional)</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3}
                placeholder="e.g., Monthly SIP installment"
                className={`${inputCls} resize-none`} />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Link href="/dashboard"
                className="flex-1 py-3.5 rounded-xl border border-[#3c4a3e] text-[#859586] text-sm font-medium hover:bg-white/5 transition-colors text-center">
                Cancel
              </Link>
              <button type="submit" disabled={isSubmitting}
                className="flex-1 bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] py-3.5 rounded-xl font-bold text-sm hover:scale-[1.01] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Adding…</>
                ) : 'Add Investment'}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}
