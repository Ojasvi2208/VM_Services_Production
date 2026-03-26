'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';

export const dynamic = 'force-dynamic';

interface FundReturns {
  return1w?: number; return1m?: number; return3m?: number;
  return6m?: number; return1y?: number; return3y?: number; return5y?: number;
  cagr1y?: number; cagr3y?: number; cagr5y?: number;
}

interface FundData {
  schemeCode: string; schemeName: string; latestNav: number;
  latestNavDate: string; amcCode: string; returns: FundReturns;
}

function FundCompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [funds, setFunds] = useState<FundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ schemeCode: string; schemeName: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const codes = searchParams.get('codes');
    if (codes) loadFunds(codes.split(','));
  }, [searchParams]);

  const loadFunds = async (schemeCodes: string[]) => {
    setLoading(true);
    try {
      const results = await Promise.all(schemeCodes.map(code => fetch(`/api/funds/${code}`).then(r => r.json())));
      setFunds(results.filter(r => r.success && r.data?.fund).map(r => ({
        schemeCode: r.data.fund.schemeCode,
        schemeName: r.data.fund.schemeName,
        latestNav: r.data.fund.latestNav || 0,
        latestNavDate: r.data.fund.latestNavDate || '',
        amcCode: r.data.fund.amcCode || '',
        returns: r.data.returns || {},
      })));
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`/api/funds/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
      const data = await res.json();
      if (data.success) setSearchResults(data.funds);
    } catch { /* silent */ }
  };

  const addFund = (schemeCode: string) => {
    if (funds.length >= 5) { alert('Maximum 5 funds can be compared'); return; }
    if (funds.some(f => f.schemeCode === schemeCode)) { alert('Fund already added'); return; }
    loadFunds([...funds.map(f => f.schemeCode), schemeCode]);
    setShowSearch(false); setSearchQuery(''); setSearchResults([]);
  };

  const removeFund = (sc: string) => setFunds(prev => prev.filter(f => f.schemeCode !== sc));

  const fmtReturn = (v?: number) => (v == null ? 'N/A' : `${v.toFixed(2)}%`);
  const retColor = (v?: number) => (v == null ? 'text-[#859586]' : v >= 0 ? 'text-[#44f593]' : 'text-[#ffb4ab]');

  const getBest = (metric: keyof FundReturns) => {
    const f = funds.filter(x => x.returns[metric] != null);
    if (!f.length) return null;
    return f.reduce((b, x) => (x.returns[metric]! > b.returns[metric]! ? x : b));
  };

  const inputCls = 'w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:border-[#44f593]/50 transition-all';

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />
      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        <header className="mb-10 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">Compare Funds</h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Side-by-side returns, NAV, and CAGR analysis for up to 5 funds.
          </p>
        </header>

        <div className="space-y-6">
          {/* Add fund button */}
          <div className="flex justify-center">
            <button onClick={() => setShowSearch(s => !s)} disabled={funds.length >= 5}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#44f593]/10 border border-[#44f593]/30 text-[#44f593] text-sm font-semibold hover:bg-[#44f593]/15 transition-colors disabled:opacity-40">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={showSearch ? 'M6 18L18 6M6 6l12 12' : 'M12 6v6m0 0v6m0-6h6m-6 0H6'} />
              </svg>
              {showSearch ? 'Close Search' : `Add Fund (${funds.length}/5)`}
            </button>
          </div>

          {/* Search */}
          {showSearch && (
            <div className="glass-card rounded-2xl p-6 max-w-2xl mx-auto">
              <div className="flex gap-3 mb-4">
                <input type="text" placeholder="Search by fund name…" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className={`${inputCls} flex-1`} />
                <button onClick={handleSearch}
                  className="px-5 py-3 bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] rounded-xl font-bold text-sm hover:scale-[1.01] transition-transform whitespace-nowrap">
                  Search
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {searchResults.map(fund => (
                    <button key={fund.schemeCode} onClick={() => addFund(fund.schemeCode)}
                      className="w-full text-left p-3 glass-card rounded-xl hover:border-[#44f593]/20 transition-all">
                      <p className="text-sm font-medium text-[#dce5df]">{fund.schemeName}</p>
                      <p className="text-xs text-[#859586] font-mono">Code: {fund.schemeCode}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-10">
              <svg className="animate-spin w-8 h-8 text-[#44f593] mx-auto" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {/* Table */}
          {!loading && funds.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#161d1a]">
                    <tr>
                      <th className="py-4 px-5 text-xs font-mono text-[#859586] uppercase tracking-widest w-40">Metric</th>
                      {funds.map(fund => (
                        <th key={fund.schemeCode} className="py-4 px-5 min-w-[180px]">
                          <p className="text-xs font-semibold text-[#dce5df] line-clamp-2">
                            {fund.schemeName.length > 40 ? fund.schemeName.slice(0, 40) + '…' : fund.schemeName}
                          </p>
                          <p className="text-xs text-[#859586] font-mono mt-1">{fund.schemeCode}</p>
                          <button onClick={() => removeFund(fund.schemeCode)}
                            className="text-xs text-[#ffb4ab] hover:underline mt-1">Remove</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="py-3 px-5 text-xs font-semibold text-[#859586]">Latest NAV</td>
                      {funds.map(f => (
                        <td key={f.schemeCode} className="py-3 px-5">
                          <p className="text-sm font-mono font-bold text-[#dce5df]">₹{f.latestNav?.toFixed(4) ?? 'N/A'}</p>
                          <p className="text-xs text-[#859586] font-mono">{f.latestNavDate ? new Date(f.latestNavDate).toLocaleDateString('en-IN') : '—'}</p>
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-[#161d1a]/40">
                      <td className="py-3 px-5 text-xs font-semibold text-[#859586]">AMC</td>
                      {funds.map(f => (
                        <td key={f.schemeCode} className="py-3 px-5 text-xs text-[#859586] font-mono">{f.amcCode || '—'}</td>
                      ))}
                    </tr>
                    <tr className="bg-[#44f593]/5">
                      <td colSpan={funds.length + 1} className="py-2 px-5 text-xs font-mono text-[#44f593] uppercase tracking-widest font-bold">Absolute Returns</td>
                    </tr>
                    {[
                      { key: 'return1w', label: '1 Week' }, { key: 'return1m', label: '1 Month' },
                      { key: 'return3m', label: '3 Months' }, { key: 'return6m', label: '6 Months' },
                      { key: 'return1y', label: '1 Year' }, { key: 'return3y', label: '3 Years' },
                      { key: 'return5y', label: '5 Years' },
                    ].map((metric, idx) => {
                      const best = getBest(metric.key as keyof FundReturns);
                      return (
                        <tr key={metric.key} className={idx % 2 === 0 ? '' : 'bg-[#161d1a]/30'}>
                          <td className="py-3 px-5 text-xs text-[#859586]">{metric.label}</td>
                          {funds.map(fund => {
                            const val = fund.returns?.[metric.key as keyof FundReturns];
                            const isBest = best?.schemeCode === fund.schemeCode && val != null;
                            return (
                              <td key={fund.schemeCode} className="py-3 px-5">
                                <span className={`text-sm font-mono font-bold ${retColor(val)} ${isBest ? 'text-base' : ''}`}>
                                  {fmtReturn(val)}{isBest ? ' ★' : ''}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr className="bg-[#44f593]/5">
                      <td colSpan={funds.length + 1} className="py-2 px-5 text-xs font-mono text-[#44f593] uppercase tracking-widest font-bold">CAGR (Annualized)</td>
                    </tr>
                    {[
                      { key: 'cagr1y', label: '1 Year CAGR' }, { key: 'cagr3y', label: '3 Year CAGR' },
                      { key: 'cagr5y', label: '5 Year CAGR' },
                    ].map((metric, idx) => {
                      const best = getBest(metric.key as keyof FundReturns);
                      return (
                        <tr key={metric.key} className={idx % 2 === 0 ? '' : 'bg-[#161d1a]/30'}>
                          <td className="py-3 px-5 text-xs text-[#859586]">{metric.label}</td>
                          {funds.map(fund => {
                            const val = fund.returns?.[metric.key as keyof FundReturns];
                            const isBest = best?.schemeCode === fund.schemeCode && val != null;
                            return (
                              <td key={fund.schemeCode} className="py-3 px-5">
                                <span className={`text-sm font-mono font-bold ${retColor(val)} ${isBest ? 'text-base' : ''}`}>
                                  {fmtReturn(val)}{isBest ? ' ★' : ''}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-5 border-t border-white/5 flex flex-wrap gap-3">
                {funds.map(fund => (
                  <button key={fund.schemeCode} onClick={() => router.push(`/funds/${fund.schemeCode}`)}
                    className="px-4 py-2 rounded-xl border border-[#3c4a3e] text-[#859586] text-xs hover:text-[#44f593] hover:border-[#44f593]/30 transition-colors font-mono">
                    View {fund.schemeCode} →
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && funds.length === 0 && (
            <div className="glass-card rounded-2xl p-14 text-center">
              <div className="w-16 h-16 rounded-xl bg-[#44f593]/8 border border-[#44f593]/15 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-[#44f593]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-base font-display font-bold text-[#dce5df] mb-2">No Funds Selected</h3>
              <p className="text-[#859586] text-sm">Add funds above to start comparing their performance side by side.</p>
            </div>
          )}

          {/* Tips */}
          <div className="glass-card rounded-2xl p-5 border-[#44f593]/15 bg-[#44f593]/3">
            <p className="text-xs font-bold text-[#44f593] mb-2">Comparison Tips</p>
            <ul className="text-xs text-[#859586] space-y-1.5">
              <li>Compare up to 5 funds side-by-side</li>
              <li>Best performers in each category are marked with a ★</li>
              <li>Green values = positive returns · Red = negative</li>
              <li>CAGR provides annualized returns for long-term comparison</li>
            </ul>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function FundComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060D0A] flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-[#44f593]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <FundCompareContent />
    </Suspense>
  );
}
