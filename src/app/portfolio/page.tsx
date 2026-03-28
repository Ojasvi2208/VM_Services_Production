'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';
import { useAuth } from '@/context/AuthContext';

// ─── Types ───────────────────────────────────────────────────
interface PortfolioHolding {
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
  navDate: string;
  notes?: string;
  return1y?: number;
  cagr3y?: number;
  cagr5y?: number;
}

interface WatchlistItem {
  id: string;
  schemeCode: string;
  schemeName: string;
  currentNav: number;
  return1y: number;
  cagr3y: number | null;
  cagr5y: number | null;
  addedAt: string;
  notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────────
function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${fmt(n)}`;
}

// ─── Donut Chart (SVG) ────────────────────────────────────────
function DonutChart({ invested, current }: { invested: number; current: number }) {
  const r = 15.915;
  const ratio = current > 0 && invested > 0 ? Math.min(current / (current + invested * 0.3), 1) : 0.6;
  const dashArr = `${ratio * 100} ${100 - ratio * 100}`;

  return (
    <div className="relative w-36 h-36 md:w-44 md:h-44 mx-auto mb-6">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" fill="transparent" r={r} stroke="rgba(255,255,255,0.05)" strokeWidth="3"/>
        <circle cx="18" cy="18" fill="transparent" r={r} stroke="#44f593" strokeDasharray={dashArr} strokeDashoffset="0" strokeWidth="3"/>
        <circle cx="18" cy="18" fill="transparent" r={r} stroke="#00d87a" strokeDasharray={`${(1 - ratio) * 60} 100`} strokeDashoffset={`-${ratio * 100}`} strokeWidth="3"/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-[#859586] font-mono uppercase">TOTAL</span>
        <span className="font-mono font-bold text-base text-[#dce5df]">
          {current > 0 ? formatINR(current) : '—'}
        </span>
      </div>
    </div>
  );
}

// ─── Add Holding Panel ────────────────────────────────────────
function AddHoldingPanel({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [units, setUnits] = useState('');
  const [purchaseNav, setPurchaseNav] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    const r = await fetch(`/api/funds/search?q=${encodeURIComponent(query)}&limit=15`);
    const d = await r.json();
    if (d.success) setResults(d.funds);
  };

  const selectFund = async (fund: any) => {
    setSelected(fund);
    setResults([]);
    setQuery('');
    try {
      const r = await fetch(`/api/funds/${fund.schemeCode}`);
      const d = await r.json();
      if (d.success && d.data?.latestNav) setPurchaseNav(String(d.data.latestNav));
    } catch {}
  };

  const handleAdd = async () => {
    if (!selected || !units || !purchaseNav || !purchaseDate) return;
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/portfolio/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeCode: selected.schemeCode,
          units: parseFloat(units),
          purchaseNav: parseFloat(purchaseNav),
          purchaseDate,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to add holding');
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-display font-bold text-[#dce5df]">Add New Holding</h3>

      {!selected ? (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search fund by name or code…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#859586] focus:outline-none focus:border-[#44f593]/50"
            />
            <button
              onClick={handleSearch}
              className="bg-[#44f593] text-[#001f10] px-5 py-3 rounded-xl font-bold text-sm hover:bg-[#5effa3] transition-colors"
            >
              Search
            </button>
          </div>
          {results.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {results.map(f => (
                <button
                  key={f.schemeCode}
                  onClick={() => selectFund(f)}
                  className="w-full text-left p-4 bg-[#161d1a] border border-[#3c4a3e] rounded-xl hover:border-[#44f593]/30 hover:bg-[#19211e] transition-all"
                >
                  <div className="font-semibold text-sm text-[#dce5df]">{f.schemeName}</div>
                  <div className="text-xs text-[#859586] mt-0.5">Code: {f.schemeCode} · NAV: ₹{f.latestNav?.toFixed(2)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-[#44f593]/5 border border-[#44f593]/20 rounded-xl">
            <div className="font-semibold text-sm text-[#dce5df]">{selected.schemeName}</div>
            <div className="text-xs text-[#859586]">Code: {selected.schemeCode}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">Units</label>
              <input
                type="number"
                step="0.001"
                placeholder="e.g. 100.500"
                value={units}
                onChange={e => setUnits(e.target.value)}
                className="w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] focus:outline-none focus:border-[#44f593]/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">Purchase NAV (₹)</label>
              <input
                type="number"
                step="0.0001"
                placeholder="e.g. 125.5"
                value={purchaseNav}
                onChange={e => setPurchaseNav(e.target.value)}
                className="w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] focus:outline-none focus:border-[#44f593]/50"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] focus:outline-none focus:border-[#44f593]/50"
              />
            </div>
          </div>
          {units && purchaseNav && (
            <div className="text-xs text-[#859586] font-mono">
              Invested Amount: ₹{fmt(parseFloat(units) * parseFloat(purchaseNav), 2)}
            </div>
          )}
          {error && <p className="text-xs text-[#ffb4ab]">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 bg-[#44f593] text-[#001f10] py-3 rounded-xl font-bold text-sm hover:bg-[#5effa3] transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add to Portfolio'}
            </button>
            <button
              onClick={() => setSelected(null)}
              className="px-4 py-3 border border-[#3c4a3e] text-[#dce5df] rounded-xl text-sm hover:bg-white/5 transition-colors"
            >
              Change
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-3 border border-[#3c4a3e] text-[#859586] rounded-xl text-sm hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Holdings Table ───────────────────────────────────────────
function HoldingsTable({
  holdings,
  onRemove,
  onView,
}: {
  holdings: PortfolioHolding[];
  onRemove: (id: string) => void;
  onView: (code: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const filtered = holdings.filter(h =>
    h.schemeName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
        <h3 className="font-display text-lg font-bold text-[#dce5df]">Portfolio Holdings</h3>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#859586]" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Filter assets…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-[#08100d] border border-[#3c4a3e] rounded-lg pl-9 pr-4 py-2 text-xs text-[#dce5df] placeholder:text-[#859586] focus:outline-none focus:border-[#44f593]/40 w-44"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#161d1a] text-[#859586] text-xs uppercase tracking-widest font-bold">
              <th className="px-6 py-4">Asset Name</th>
              <th className="px-6 py-4 text-right">Units</th>
              <th className="px-6 py-4 text-right">Buy NAV</th>
              <th className="px-6 py-4 text-right">CMP</th>
              <th className="px-6 py-4 text-right">Market Value</th>
              <th className="px-6 py-4 text-right">P&amp;L</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map(h => {
              const pos = h.returns >= 0;
              return (
                <tr key={h.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#19211e] border border-[#44f593]/20 flex items-center justify-center text-[#44f593] text-xs font-bold">
                        {h.schemeName?.[0] ?? 'F'}
                      </div>
                      <div>
                        <div className="font-display text-sm font-bold text-[#dce5df] line-clamp-1 max-w-[200px]">
                          {h.schemeName}
                        </div>
                        <div className="text-xs text-[#859586] font-mono">{h.schemeCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-mono text-sm text-[#dce5df]">{h.units.toFixed(3)}</td>
                  <td className="px-6 py-5 text-right font-mono text-sm text-[#859586]">₹{h.purchaseNav.toFixed(2)}</td>
                  <td className="px-6 py-5 text-right font-mono text-sm text-[#dce5df]">₹{h.currentNav.toFixed(2)}</td>
                  <td className="px-6 py-5 text-right font-mono text-sm font-bold text-[#dce5df]">
                    ₹{fmt(h.currentValue)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`font-mono text-sm font-bold ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                        {pos ? '+' : ''}₹{fmt(h.returns)}
                      </span>
                      <span className={`text-xs font-bold ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                        {pos ? '+' : ''}{h.returnsPercentage.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onView(h.schemeCode)}
                        className="text-xs text-[#44f593] hover:underline font-semibold"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onRemove(h.id)}
                        className="text-xs text-[#ffb4ab] hover:underline font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-[#161d1a]/50 flex items-center justify-center border-t border-white/5">
        <span className="text-xs text-[#859586]">{filtered.length} holdings</span>
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────
function AnalyticsTab({ holdings, totalInvested, totalCurrent, totalReturns, totalRetPct }: {
  holdings: PortfolioHolding[];
  totalInvested: number;
  totalCurrent: number;
  totalReturns: number;
  totalRetPct: number;
}) {
  const pos = totalReturns >= 0;

  // Compute weighted-average returns across all holdings
  const withData = holdings.filter(h => h.currentValue > 0);
  const totalWeight = withData.reduce((s, h) => s + h.currentValue, 0);
  const wavg = (key: 'return1y' | 'cagr3y' | 'cagr5y') => {
    const valid = withData.filter(h => h[key] != null);
    if (!valid.length) return null;
    const w = valid.reduce((s, h) => s + h.currentValue, 0);
    return valid.reduce((s, h) => s + (h[key] as number) * h.currentValue, 0) / w;
  };

  const ret1y  = wavg('return1y');
  const ret3y  = wavg('cagr3y');
  const ret5y  = wavg('cagr5y');

  const BARS = [
    { label: '1Y Return',  value: ret1y,  max: 40 },
    { label: '3Y CAGR',   value: ret3y,  max: 30 },
    { label: '5Y CAGR',   value: ret5y,  max: 25 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: allocation */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-base font-bold mb-6 text-[#44f593]">Portfolio Value</h3>
          <DonutChart invested={totalInvested} current={totalCurrent} />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#44f593]" />
                <span className="text-sm text-[#dce5df]">Current Value</span>
              </div>
              <span className="font-mono text-sm text-[#dce5df]">₹{fmt(totalCurrent)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00d87a]" />
                <span className="text-sm text-[#dce5df]">Invested Amount</span>
              </div>
              <span className="font-mono text-sm text-[#dce5df]">₹{fmt(totalInvested)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#3c4a3e]" />
                <span className="text-sm text-[#dce5df]">Unrealized P&L</span>
              </div>
              <span className={`font-mono text-sm font-bold ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                {pos ? '+' : ''}₹{fmt(totalReturns)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: returns */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-base font-bold mb-6 text-[#44f593]">Portfolio Returns</h3>

          {/* Overall returns KPI */}
          <div className="mb-6 p-4 bg-[#44f593]/5 border border-[#44f593]/20 rounded-xl">
            <p className="text-xs uppercase tracking-widest text-[#859586] mb-1">Overall Absolute Return</p>
            <p className={`font-mono text-3xl font-bold ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
              {pos ? '+' : ''}{totalRetPct.toFixed(2)}%
            </p>
          </div>

          {/* Horizon returns bars */}
          <div className="space-y-5">
            {BARS.map(bar => {
              if (bar.value == null) return (
                <div key={bar.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#859586]">{bar.label}</span>
                    <span className="text-[#3c4a3e] font-mono">No data</span>
                  </div>
                  <div className="h-2 bg-[#1a2420] rounded-full" />
                </div>
              );
              const pct = Math.min(100, Math.abs(bar.value) / bar.max * 100);
              const isPos = bar.value >= 0;
              return (
                <div key={bar.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#859586]">{bar.label}</span>
                    <span className={`font-mono font-bold ${isPos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                      {isPos ? '+' : ''}{bar.value.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#1a2420] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: isPos ? '#44f593' : '#ff4757' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-[#859586] mt-4">
            Horizon returns are weighted averages across {holdings.length} holding{holdings.length !== 1 ? 's' : ''} by current value.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Watchlist Tab ────────────────────────────────────────────
function WatchlistTab() {
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/portfolio/watchlist');
      const d = await r.json();
      if (d.success) setItems(d.watchlist);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (schemeCode: string) => {
    if (!confirm('Remove from watchlist?')) return;
    await fetch(`/api/portfolio/watchlist?schemeCode=${schemeCode}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.schemeCode !== schemeCode));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#44f593]/30 border-t-[#44f593] rounded-full animate-spin" />
    </div>
  );

  if (items.length === 0) return (
    <div className="glass-card rounded-2xl p-12 text-center">
      <div className="text-4xl mb-4">👀</div>
      <h3 className="font-display font-bold text-lg text-[#dce5df] mb-2">Watchlist is empty</h3>
      <p className="text-[#859586] text-sm mb-6">Add funds to your watchlist from their detail page.</p>
      <Link
        href="/funds/search"
        className="inline-block bg-[#44f593] text-[#001f10] px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#25e283] transition-colors"
      >
        Browse Funds
      </Link>
    </div>
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
        <h3 className="font-display text-lg font-bold text-[#dce5df]">Watchlist</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#161d1a] text-[#859586] text-xs uppercase tracking-widest font-bold">
              <th className="px-6 py-4">Fund</th>
              <th className="px-6 py-4 text-right">NAV</th>
              <th className="px-6 py-4 text-right">1Y Return</th>
              <th className="px-6 py-4 text-right">3Y CAGR</th>
              <th className="px-6 py-4 text-right">5Y CAGR</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map(item => {
              const r1p = item.return1y >= 0;
              return (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="font-display text-sm font-bold text-[#dce5df] line-clamp-1 max-w-[260px]">
                      {item.schemeName}
                    </div>
                    <div className="text-xs text-[#859586] font-mono">{item.schemeCode}</div>
                  </td>
                  <td className="px-6 py-5 text-right font-mono text-sm text-[#dce5df]">
                    ₹{item.currentNav.toFixed(2)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className={`font-mono text-sm font-bold ${r1p ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                      {r1p ? '+' : ''}{item.return1y.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right font-mono text-sm text-[#dce5df]">
                    {item.cagr3y != null ? `${item.cagr3y >= 0 ? '+' : ''}${item.cagr3y.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-6 py-5 text-right font-mono text-sm text-[#dce5df]">
                    {item.cagr5y != null ? `${item.cagr5y >= 0 ? '+' : ''}${item.cagr5y.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => router.push(`/funds/${item.schemeCode}`)}
                        className="text-xs text-[#44f593] hover:underline font-semibold"
                      >
                        View
                      </button>
                      <button
                        onClick={() => remove(item.schemeCode)}
                        className="text-xs text-[#ffb4ab] hover:underline font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-[#161d1a]/50 flex items-center justify-center border-t border-white/5">
        <span className="text-xs text-[#859586]">{items.length} funds watching</span>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass-card rounded-2xl p-16 text-center">
      <div className="w-20 h-20 rounded-full bg-[#19211e] border border-[#3c4a3e] flex items-center justify-center mx-auto mb-6">
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.25">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </div>
      <h3 className="text-xl font-display font-bold text-[#dce5df] mb-2">No Holdings Yet</h3>
      <p className="text-[#859586] text-sm mb-6 max-w-xs mx-auto">
        Start tracking your mutual fund investments and watch your wealth grow.
      </p>
      <button
        onClick={onAdd}
        className="bg-[#44f593] text-[#001f10] px-6 py-3 rounded-full font-bold text-sm hover:bg-[#5effa3] transition-colors"
      >
        Add Your First Holding
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function PortfolioPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'Holdings' | 'Analytics' | 'Watchlist' | 'Tax Reports'>('Holdings');
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin?redirect=/portfolio');
    }
  }, [authLoading, isAuthenticated, router]);

  const loadHoldings = useCallback(async () => {
    try {
      const r = await fetch('/api/portfolio/holdings');
      if (!r.ok) return;
      const d = await r.json();
      if (d.holdings) setHoldings(d.holdings);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadHoldings();
  }, [isAuthenticated, loadHoldings]);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmRemoveHolding = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/portfolio/holdings?id=${deleteTarget.id}`, { method: 'DELETE' });
      setHoldings(prev => prev.filter(h => h.id !== deleteTarget.id));
    } catch {} finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const removeHolding = (id: string) => {
    const h = holdings.find(h => h.id === id);
    setDeleteTarget({ id, name: h?.schemeName || 'this holding' });
  };

  // Totals
  const totalInvested = holdings.reduce((s, h) => s + h.purchaseAmount, 0);
  const totalCurrent  = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalReturns  = totalCurrent - totalInvested;
  const totalRetPct   = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;
  const pos = totalReturns >= 0;

  const TABS = ['Holdings', 'Analytics', 'Watchlist', 'Tax Reports'] as const;

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#060D0A]">
      <div className="w-10 h-10 rounded-full border-2 border-[#1F2B24] border-t-[#00D87A] animate-spin" />
    </div>
  );
  if (!isAuthenticated) return null; // useEffect redirect handles navigation

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-12 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* ── Sticky Summary Bar ─────────────────────────────── */}
        {!loading && holdings.length > 0 && (
          <section className="sticky top-20 z-40 mb-8">
            <div className="glass-card emerald-glow rounded-xl p-5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-6">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-widest text-[#859586] mb-1 font-medium">Total Invested</span>
                <span className="font-mono text-xl font-bold text-[#dce5df]">₹{fmt(totalInvested)}</span>
              </div>
              <div className="w-px h-8 bg-white/10 hidden lg:block" />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-widest text-[#859586] mb-1 font-medium">Current Value</span>
                <span className="font-mono text-xl font-bold text-[#44f593]">₹{fmt(totalCurrent)}</span>
              </div>
              <div className="w-px h-8 bg-white/10 hidden lg:block" />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-widest text-[#859586] mb-1 font-medium">Total Returns</span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xl font-bold ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                    {pos ? '+' : ''}₹{fmt(totalReturns)}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pos ? 'bg-[#44f593]/10 text-[#44f593]' : 'bg-[#ffb4ab]/10 text-[#ffb4ab]'}`}>
                    {pos ? '+' : ''}{totalRetPct.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-white/10 hidden lg:block" />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-widest text-[#859586] mb-1 font-medium">Holdings</span>
                <span className="font-mono text-xl font-bold text-[#dce5df]">{holdings.length}</span>
              </div>
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="ml-auto bg-[#44f593] text-[#001f10] px-4 py-2 rounded-full font-bold text-sm hover:bg-[#5effa3] transition-colors shrink-0"
              >
                {showAddForm ? 'Cancel' : '+ Add Holding'}
              </button>
            </div>
          </section>
        )}

        {/* Header when no holdings or loading */}
        {(loading || holdings.length === 0) && (
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-display font-bold text-[#dce5df] mb-1">My Portfolio</h1>
              <p className="text-[#859586] text-sm">Track your mutual fund investments and returns</p>
            </div>
            {!loading && (
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="bg-[#44f593] text-[#001f10] px-5 py-2.5 rounded-full font-bold text-sm hover:bg-[#5effa3] transition-colors"
              >
                {showAddForm ? 'Cancel' : '+ Add Holding'}
              </button>
            )}
          </div>
        )}

        {/* ── Loading ────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-[#44f593]/30 border-t-[#44f593] rounded-full animate-spin" />
          </div>
        )}

        {/* ── Add Form ──────────────────────────────────────── */}
        {!loading && showAddForm && (
          <div className="mb-8">
            <AddHoldingPanel
              onSuccess={() => { setShowAddForm(false); loadHoldings(); }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {/* ── Tab Row ───────────────────────────────────────── */}
        {!loading && (
          <div className="flex items-center gap-8 border-b border-white/5 mb-8">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'pb-4 text-sm font-medium tracking-wide transition-colors',
                  activeTab === tab
                    ? 'text-[#44f593] border-b-2 border-[#44f593] font-bold'
                    : 'text-[#859586] hover:text-[#dce5df]',
                ].join(' ')}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* ── Holdings Tab ──────────────────────────────────── */}
        {!loading && holdings.length > 0 && activeTab === 'Holdings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Donut + Vault Insight */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="glass-card rounded-xl p-6">
                <h3 className="font-display text-base font-bold mb-6 text-[#44f593]">Asset Allocation</h3>
                <DonutChart invested={totalInvested} current={totalCurrent} />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#44f593]" />
                      <span className="text-sm text-[#dce5df]">Current Value</span>
                    </div>
                    <span className="font-mono text-sm text-[#dce5df]">₹{fmt(totalCurrent)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00d87a]" />
                      <span className="text-sm text-[#dce5df]">Invested Amount</span>
                    </div>
                    <span className="font-mono text-sm text-[#dce5df]">₹{fmt(totalInvested)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#3c4a3e]" />
                      <span className="text-sm text-[#dce5df]">Unrealized P&L</span>
                    </div>
                    <span className={`font-mono text-sm font-bold ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                      {pos ? '+' : ''}₹{fmt(totalReturns)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vault Insight */}
              <div className="glass-card rounded-xl p-6 bg-[#44f593]/5 border-[#44f593]/20">
                <div className="flex items-center gap-3 mb-4">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                  <h4 className="font-display font-bold text-[#44f593] text-sm">Vault Insight</h4>
                </div>
                <p className="text-sm leading-relaxed text-[#c0c9c2]">
                  {totalRetPct > 0
                    ? `Your portfolio is up ${totalRetPct.toFixed(1)}%. Consider reviewing your allocation to maintain your target risk profile.`
                    : 'Upload your CAS statement to unlock AI-powered portfolio insights and rebalancing suggestions.'}
                </p>
              </div>
            </div>

            {/* Right: Holdings Table */}
            <div className="lg:col-span-8">
              <HoldingsTable
                holdings={holdings}
                onRemove={removeHolding}
                onView={code => router.push(`/funds/${code}`)}
              />
            </div>
          </div>
        )}

        {/* ── Analytics Tab ─────────────────────────────────── */}
        {!loading && holdings.length > 0 && activeTab === 'Analytics' && (
          <AnalyticsTab
            holdings={holdings}
            totalInvested={totalInvested}
            totalCurrent={totalCurrent}
            totalReturns={totalReturns}
            totalRetPct={totalRetPct}
          />
        )}

        {/* ── Watchlist Tab ─────────────────────────────────── */}
        {!loading && activeTab === 'Watchlist' && (
          <WatchlistTab />
        )}

        {/* ── Tax Reports placeholder ────────────────────────── */}
        {!loading && holdings.length > 0 && activeTab === 'Tax Reports' && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <p className="text-[#859586] text-sm">Tax Reports — coming soon.</p>
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────── */}
        {!loading && holdings.length === 0 && !showAddForm && activeTab !== 'Watchlist' && (
          <EmptyState onAdd={() => setShowAddForm(true)} />
        )}

        {/* Regulatory disclaimer — investments only */}
        <div className="mt-8 p-4 bg-[#19211e]/50 rounded-xl border border-[#3c4a3e]/40">
          <p className="text-xs text-[#859586] leading-relaxed font-mono">
            NAVs sourced from AMFI and updated daily. Past performance is not indicative of future returns.
            Investments in mutual funds are subject to market risks. Please read all scheme-related documents carefully.
          </p>
        </div>

        <ComplianceDisclaimer variant="portfolio" className="mt-6" />
      </main>

      <SiteFooter />

      {/* ── Delete Confirmation Modal ───────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div
            className="glass-card-vi rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>delete</span>
              </div>
              <h3 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df]">Remove Holding</h3>
            </div>
            <p className="text-sm text-[#859586] mb-6 leading-relaxed">
              Are you sure you want to remove <span className="text-[#dce5df] font-medium">{deleteTarget.name}</span> from your portfolio? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-bold text-[#859586] hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveHolding}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-bold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
