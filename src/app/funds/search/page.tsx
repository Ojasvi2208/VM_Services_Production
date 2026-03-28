'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import { useFundSearch, PAGE_SIZE } from '@/hooks/useFundSearch';
import type { FundResult, SortMode } from '@/hooks/useFundSearch';

// ─────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────
function formatNav(n?: number) {
  if (n == null) return '—';
  return `₹${n.toFixed(2)}`;
}

function formatReturn(r?: number) {
  if (r == null) return null;
  const pos = r >= 0;
  return { label: `${pos ? '+' : ''}${r.toFixed(2)}%`, pos };
}

function amcInitials(name?: string): string {
  if (!name) return 'AM';
  const clean = name.replace(/mutual fund|asset management|mf|india/gi, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

// AMC colour palette (seeded by initials)
const AMC_COLORS = [
  '#00d87a', '#3b82f6', '#f59e0b', '#a855f7',
  '#ff6b35', '#06b6d4', '#ec4899', '#84cc16',
];
function amcColor(name?: string) {
  if (!name) return AMC_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AMC_COLORS[h % AMC_COLORS.length];
}


// ─────────────────────────────────────────────────────────────
// Fund Card — matches discover.html
// ─────────────────────────────────────────────────────────────
function FundCard({ fund }: { fund: FundResult }) {
  const ret = formatReturn(fund.return1y);
  const positive = ret ? ret.pos : true;
  const accentColor = amcColor(fund.amcCode);
  const initials = amcInitials(fund.amcCode);

  return (
    <Link
      href={`/funds/${fund.schemeCode}`}
      className="glass-card-vi group rounded-2xl p-6 flex flex-col h-full transition-all duration-300"
      aria-label={fund.schemeName}
    >
      {/* ── Top row: AMC logo + category badge ── */}
      <div className="flex justify-between items-start mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold font-['Space_Grotesk'] shrink-0"
          style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30`, color: accentColor }}
        >
          {initials}
        </div>
        {fund.category && (
          <span className="bg-[#44f593]/10 text-[#44f593] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-[#44f593]/20">
            {fund.category.length > 18 ? fund.category.slice(0, 18) + '…' : fund.category}
          </span>
        )}
      </div>

      {/* ── Fund name + AMC ── */}
      <h2 className="font-['Space_Grotesk'] font-bold text-[#dce5df] group-hover:text-[#44f593] transition-colors leading-snug mb-1 line-clamp-2 flex-grow">
        {fund.schemeName}
      </h2>
      {fund.amcCode && (
        <p className="text-[11px] text-[#859586] mb-4">
          {fund.amcCode.replace(/ Mutual Fund$/i, '')}
        </p>
      )}

      {/* ── NAV + Return ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs uppercase text-[#859586] tracking-widest mb-1">Current NAV</p>
          <p className="font-mono text-lg text-[#dce5df]">{formatNav(fund.latestNav)}</p>
        </div>
        {ret && (
          <div className="text-right">
            <p className="text-xs uppercase text-[#859586] tracking-widest mb-1">1Y Return</p>
            <span
              className="inline-flex items-center px-2 py-1 rounded font-mono text-sm font-bold"
              style={{
                background: positive ? 'rgba(68,245,147,0.1)' : 'rgba(255,71,87,0.1)',
                color: positive ? '#44f593' : '#ff4757',
              }}
            >
              {ret.label}
            </span>
          </div>
        )}
      </div>

      {/* ── Trend indicator (no fake data) ── */}
      <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs uppercase text-[#859586] tracking-widest">1Y Trend</span>
        <span
          className="material-symbols-outlined text-lg"
          style={{
            fontVariationSettings: "'FILL' 1",
            color: positive ? '#44f593' : '#ff4757',
          }}
        >
          {positive ? 'trending_up' : 'trending_down'}
        </span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="glass-card-vi rounded-2xl p-6 flex flex-col gap-4 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="w-12 h-12 rounded-full bg-[#1a2420]" />
        <div className="h-6 w-28 rounded-full bg-[#1a2420]" />
      </div>
      <div className="space-y-2 flex-grow">
        <div className="h-5 rounded bg-[#1a2420] w-full" />
        <div className="h-5 rounded bg-[#1a2420] w-3/4" />
        <div className="h-3 rounded bg-[#1a2420] w-2/5 mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-10 rounded bg-[#1a2420]" />
        <div className="h-10 rounded bg-[#1a2420]" />
      </div>
      <div className="h-12 rounded bg-[#1a2420] mt-2" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sort options
// ─────────────────────────────────────────────────────────────
function applySort(funds: FundResult[], mode: SortMode): FundResult[] {
  if (mode === 'cagr')    return [...funds].sort((a, b) => (b.return1y ?? -Infinity) - (a.return1y ?? -Infinity));
  if (mode === 'sharpe')  return [...funds].sort((a, b) => (b.sharpeRatio ?? -Infinity) - (a.sharpeRatio ?? -Infinity));
  if (mode === 'expense') return [...funds].sort((a, b) => (a.expenseRatio ?? Infinity) - (b.expenseRatio ?? Infinity));
  return funds;
}

const SORT_LABELS: Record<SortMode, string> = {
  name: 'Name',
  cagr: '1Y Returns',
  sharpe: 'Sharpe Ratio',
  expense: 'Expense Ratio',
};

// ─────────────────────────────────────────────────────────────
// Category + Risk filter data
// ─────────────────────────────────────────────────────────────
const CATEGORIES = ['Equity Funds', 'Debt Funds', 'Hybrid Funds', 'Index Funds', 'ELSS', 'Thematic'];
const AMC_OPTIONS = ['HDFC Mutual Fund', 'ICICI Prudential', 'SBI Mutual Fund', 'Axis Mutual Fund', 'Nippon India', 'Kotak Mahindra', 'Mirae Asset', 'DSP Mutual Fund'];
const RISK_LEVELS = ['Low Risk', 'Moderate', 'High Risk', 'Very High'];

// ─────────────────────────────────────────────────────────────
// Default Fund Grid — 5 categories × 5 funds each
// ─────────────────────────────────────────────────────────────
const DEFAULT_CATS = [
  { label: 'Large Cap', sub: 'Large Cap', icon: 'trending_up', color: '#44f593' },
  { label: 'Mid Cap', sub: 'Mid Cap', icon: 'show_chart', color: '#f59e0b' },
  { label: 'Small Cap', sub: 'Small Cap', icon: 'rocket_launch', color: '#ec4899' },
  { label: 'Liquid', sub: 'Liquid', icon: 'water_drop', color: '#06b6d4' },
  { label: 'Debt', sub: 'Corporate Bond', icon: 'account_balance', color: '#a855f7' },
];

interface TopFund {
  schemeCode: string;
  schemeName: string;
  return1y?: number;
  cagr3y?: number;
}

function DefaultFundGrid() {
  const [catFunds, setCatFunds] = useState<Record<string, TopFund[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const results: Record<string, TopFund[]> = {};
      await Promise.all(
        DEFAULT_CATS.map(async (cat) => {
          try {
            const res = await fetch(`/api/funds/search?q=${encodeURIComponent(cat.sub)}&plan=Direct&option=Growth&limit=5`);
            if (!res.ok) return;
            const data = await res.json();
            results[cat.sub] = (data.funds || []).slice(0, 5).map((f: any) => ({
              schemeCode: f.schemeCode,
              schemeName: f.schemeName || f.canonicalName || '',
              return1y: f.return1y,
              cagr3y: f.cagr3y,
            }));
          } catch {}
        })
      );
      setCatFunds(results);
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#1F2B24] border-t-[#00D87A] animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#859586]">Loading top funds…</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="text-center mb-4">
        <h2 className="font-['Space_Grotesk'] font-bold text-xl text-[#dce5df] mb-2">Top Performing Funds</h2>
        <p className="text-[#859586] text-sm">Direct Growth plans · Ranked by returns · Or search 50,000+ schemes above</p>
      </div>
      {DEFAULT_CATS.map(cat => {
        const funds = catFunds[cat.sub] || [];
        if (funds.length === 0) return null;
        return (
          <div key={cat.sub}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-lg" style={{ color: cat.color, fontVariationSettings: "'FILL' 1" }}>{cat.icon}</span>
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#dce5df]">{cat.label}</h3>
              <div className="flex-1 h-px bg-white/5 ml-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {funds.map(f => (
                <Link
                  key={f.schemeCode}
                  href={`/funds/${f.schemeCode}`}
                  className="glass-card-vi rounded-xl p-4 hover:border-[#44f593]/30 transition-all group"
                >
                  <p className="text-xs text-[#dce5df] font-medium line-clamp-2 mb-3 min-h-[2.5rem] group-hover:text-[#44f593] transition-colors">
                    {f.schemeName.replace(/\s*-?\s*(Direct|Regular)\s*(Plan)?\s*-?\s*(Growth)?\s*/gi, '').trim() || f.schemeName}
                  </p>
                  <div className="flex items-baseline justify-between">
                    {f.cagr3y != null ? (
                      <>
                        <span className="text-[10px] text-[#859586] uppercase">3Y CAGR</span>
                        <span className={`font-mono text-sm font-bold ${(f.cagr3y ?? 0) >= 0 ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                          {f.cagr3y >= 0 ? '+' : ''}{f.cagr3y?.toFixed(1)}%
                        </span>
                      </>
                    ) : f.return1y != null ? (
                      <>
                        <span className="text-[10px] text-[#859586] uppercase">1Y</span>
                        <span className={`font-mono text-sm font-bold ${(f.return1y ?? 0) >= 0 ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                          {f.return1y >= 0 ? '+' : ''}{f.return1y?.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-[#859586]">—</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function FundDiscoveryPage() {
  const {
    query, handleQueryChange,
    activeAmc, handleAmcToggle,
    activeCategory, handleCategoryToggle,
    sortBy, setSortBy,
    results, total, currentPage, totalPages, loading, searched,
    suggestions, showSuggestions, setShowSuggestions,
    searchInputRef,
    handleSearch, handleSuggestionClick,
    goToPage, reset,
  } = useFundSearch();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [planType, setPlanType] = useState<'Direct' | 'Regular'>('Direct');
  const sorted = useMemo(() => {
    let filtered = results;
    if (planType === 'Regular') {
      filtered = results.map((fund: any) => {
        if (!fund.variants?.length) return fund;
        const variant = fund.variants.find((v: any) => v.planType === 'Regular' && (v.optionType === 'Growth' || v.optionType === 'Reinvestment'));
        if (!variant) return fund;
        return { ...fund, schemeCode: variant.schemeCode ?? fund.schemeCode, latestNav: variant.nav ?? fund.latestNav, cagr3y: variant.cagr3y ?? fund.cagr3y, cagr5y: variant.cagr5y ?? fund.cagr5y };
      });
    }
    return applySort(filtered, sortBy);
  }, [results, sortBy, planType]);
  const [sortOpen, setSortOpen] = useState(false);
  const [amcSearch, setAmcSearch] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredAmcs = AMC_OPTIONS.filter(a => a.toLowerCase().includes(amcSearch.toLowerCase()));
  const hasFilters = activeAmc || activeCategory || selectedRisk || planType !== 'Direct';

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">

      <NavBar />

      {/* ── Main layout: sidebar + content ──────────────────────── */}
      <main className="max-w-[1440px] mx-auto px-8 pb-20 flex gap-8 pt-[152px] w-full flex-1">

        {/* ── Left Sidebar: Precision Filters ─────────────────── */}
        <aside className="w-80 flex-shrink-0 sticky top-[152px] h-[calc(100vh-172px)] overflow-y-auto pr-4 hidden lg:block">
          <div className="space-y-8">
            <div>
              <h3 className="font-['Space_Grotesk'] font-bold text-2xl mb-8 text-[#dce5df]">Precision Filters</h3>

              {/* Category */}
              <div className="mb-10">
                <label className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-5 block">
                  Category
                </label>
                <div className="space-y-4">
                  {CATEGORIES.map(cat => (
                    <label key={cat} className="flex items-center group cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeCategory === cat}
                        onChange={() => handleCategoryToggle(activeCategory === cat ? '' : cat)}
                        className="w-5 h-5 rounded border-[#3c4a3e] bg-[#08100d] accent-[#44f593] focus:ring-[#44f593]"
                      />
                      <span className="ml-3 text-base text-[#bacbbb] group-hover:text-[#44f593] transition-colors">
                        {cat}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* AMC */}
              <div className="mb-10">
                <label className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-5 block">
                  Asset Management Co.
                </label>
                <div className="relative mb-4">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#859586]"
                    style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
                  <input
                    type="text"
                    placeholder="Search AMC..."
                    value={amcSearch}
                    onChange={e => setAmcSearch(e.target.value)}
                    className="w-full bg-[#08100d] border border-[#3c4a3e]/40 rounded-lg pl-10 pr-4 py-2.5 text-base text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:ring-1 focus:ring-[#44f593]"
                  />
                </div>
                <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                  {filteredAmcs.map(amc => (
                    <label key={amc} className="flex items-center group cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeAmc === amc}
                        onChange={() => handleAmcToggle(activeAmc === amc ? '' : amc)}
                        className="w-5 h-5 rounded border-[#3c4a3e] bg-[#08100d] accent-[#44f593]"
                      />
                      <span className="ml-3 text-base text-[#bacbbb] group-hover:text-[#44f593] transition-colors">
                        {amc}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Risk Profile */}
              <div>
                <label className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-5 block">
                  Risk Profile
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {RISK_LEVELS.map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRisk(selectedRisk === r ? null : r)}
                      className="py-2.5 px-3 text-sm rounded-lg transition-colors font-medium"
                      style={{
                        background: selectedRisk === r ? 'rgba(68,245,147,0.1)' : 'rgba(36,44,40,1)',
                        border: selectedRisk === r ? '1px solid #44f593' : '1px solid #3c4a3e',
                        color: selectedRisk === r ? '#44f593' : '#bacbbb',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear filters */}
              {hasFilters && (
                <button
                  onClick={() => { reset(); setSelectedRisk(null); setPlanType('Direct'); }}
                  className="mt-7 text-[#44f593] text-sm font-semibold hover:underline w-full text-left"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── Right: Discovery area ────────────────────────────── */}
        <section className="flex-grow min-w-0">

          {/* Header */}
          <div className="flex flex-col gap-6 mb-10">
            <div className="flex items-center justify-between">
              <h1 className="font-['Space_Grotesk'] font-bold text-4xl tracking-tight text-[#dce5df]">
                Fund Discovery
              </h1>
              <div className="flex items-center gap-1 bg-[#161d1a] p-1 rounded-xl border border-[#3c4a3e]/20">
                <button
                  onClick={() => setViewMode('grid')}
                  className="p-2 rounded-lg transition-colors"
                  style={{ background: viewMode === 'grid' ? '#242c28' : 'transparent', color: viewMode === 'grid' ? '#44f593' : '#859586' }}
                  aria-label="Grid view"
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>grid_view</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className="p-2 rounded-lg transition-colors"
                  style={{ background: viewMode === 'list' ? '#242c28' : 'transparent', color: viewMode === 'list' ? '#44f593' : '#859586' }}
                  aria-label="List view"
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>list</span>
                </button>
              </div>
            </div>

            {/* Wide search bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none z-10">
                <span className="material-symbols-outlined text-[#859586]" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(1); }}
                placeholder="Search for funds, sectors, or asset management companies..."
                className="w-full glass-card-vi rounded-2xl py-5 pl-16 pr-20 text-lg focus:ring-2 focus:outline-none placeholder:text-[#859586]/40 text-[#dce5df] bg-white/5 border-white/10"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              />
              <div className="absolute inset-y-0 right-6 flex items-center gap-3">
                {query && (
                  <button
                    onClick={() => { handleQueryChange(''); reset(); }}
                    className="text-[#859586] hover:text-[#dce5df] transition-colors"
                    aria-label="Clear search"
                  >
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>close</span>
                  </button>
                )}
                <kbd className="hidden md:block px-2 py-1 bg-[#242c28] rounded text-xs font-mono text-[#859586]">⌘K</kbd>
              </div>

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                  style={{ background: '#19211e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
                >
                  {suggestions.slice(0, 8).map(s => (
                    <button
                      key={s.schemeCode}
                      onMouseDown={() => handleSuggestionClick(s)}
                      className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: `${amcColor(s.amcCode)}18`, color: amcColor(s.amcCode) }}>
                        {amcInitials(s.amcCode)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-[#dce5df] truncate">{s.schemeName}</p>
                        {s.amcCode && <p className="text-xs text-[#859586]">{s.amcCode}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Direct / Regular toggle */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-[#859586] uppercase tracking-widest font-bold">Plan:</span>
              <div className="flex bg-[#08100d] p-1 rounded-xl">
                <button onClick={() => setPlanType('Direct')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${planType === 'Direct' ? 'text-[#44f593] bg-[#44f593]/10' : 'text-[#859586] hover:text-[#dce5df]'}`}>
                  Direct
                </button>
                <button onClick={() => setPlanType('Regular')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${planType === 'Regular' ? 'text-[#44f593] bg-[#44f593]/10' : 'text-[#859586] hover:text-[#dce5df]'}`}>
                  Regular
                </button>
              </div>
              {planType === 'Regular' && (
                <span className="text-xs text-amber-400 font-['Inter']">Higher expense ratio · Includes distributor commission</span>
              )}
            </div>

            {/* Results bar + sort */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[#859586]">
                {searched ? `Showing ${total.toLocaleString('en-IN')} results` : 'Explore 50,000+ funds'}
              </span>
              {searched && total > 0 && (
                <>
                  <div className="h-4 w-px bg-[#3c4a3e]" />
                  {/* Sort dropdown */}
                  <div className="relative" ref={sortRef}>
                    <span className="text-[#dce5df]">
                      Sorted by:{' '}
                      <button
                        onClick={() => setSortOpen(v => !v)}
                        className="text-[#44f593] font-bold inline-flex items-center gap-1"
                      >
                        {SORT_LABELS[sortBy]}
                        <span className="material-symbols-outlined text-sm align-middle" style={{ fontVariationSettings: "'FILL' 0" }}>
                          {sortOpen ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    </span>
                    {sortOpen && (
                      <div
                        className="absolute top-8 left-0 rounded-xl overflow-hidden z-40 w-48"
                        style={{ background: '#19211e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
                      >
                        {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                          <button
                            key={mode}
                            onClick={() => { setSortBy(mode); setSortOpen(false); }}
                            className="w-full text-left px-4 py-3 text-sm transition-colors"
                            style={{
                              background: sortBy === mode ? 'rgba(68,245,147,0.06)' : 'transparent',
                              color: sortBy === mode ? '#44f593' : '#bacbbb',
                            }}
                          >
                            {SORT_LABELS[mode]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Fund grid / list ── */}
          {loading && (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {!loading && searched && sorted.length > 0 && (
            <>
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}>
                {sorted.map(fund => <FundCard key={fund.schemeCode} fund={fund} />)}
              </div>

              {/* Load More / Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center">
                  {currentPage < totalPages ? (
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      className="px-8 py-3 rounded-xl border border-[#859586]/20 text-[#dce5df] hover:bg-white/5 transition-all font-['Space_Grotesk'] font-bold"
                    >
                      Load More Funds
                    </button>
                  ) : (
                    <p className="text-[#859586] text-sm font-mono">All {total.toLocaleString()} funds loaded</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* No results */}
          {!loading && searched && sorted.length === 0 && (
            <div className="glass-card-vi rounded-2xl p-12 flex flex-col items-center text-center mt-4">
              <div className="w-14 h-14 rounded-xl bg-[#1a2420] border border-[#3c4a3e] flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-2xl text-[#3c4a3e]" style={{ fontVariationSettings: "'FILL' 0" }}>
                  search_off
                </span>
              </div>
              <h3 className="text-[#dce5df] font-['Space_Grotesk'] font-bold text-lg mb-2">No Funds Found</h3>
              <p className="text-[#859586] text-sm mb-6 max-w-[36ch]">
                Try a different keyword, AMC, or category filter.
              </p>
              <button
                onClick={() => { reset(); setSelectedRisk(null); }}
                className="px-6 py-2.5 rounded-xl border border-[#44f593]/30 text-[#44f593] hover:bg-[#44f593]/5 transition-all text-sm font-bold"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Pre-search state — show top funds by category */}
          {!searched && !loading && (
            <DefaultFundGrid />
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
