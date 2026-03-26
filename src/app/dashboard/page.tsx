'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import CASUploader from '@/components/CASUploader';

// ─── Types ────────────────────────────────────────────────────
interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  returnsPercentage: number;
  holdingsCount: number;
}

interface PortfolioMetrics {
  sharpeRatio1y: number | null;
  volatility1y: number | null;
  cagr1y: number | null;
  cagr3y: number | null;
  cagr5y: number | null;
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
  return1y: number | null;
  cagr3y: number | null;
}

interface IndexData {
  symbol?: string;
  name?: string;
  price?: number;
  changePercent?: number;
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
}

interface NFOItem {
  id: string;
  schemeName: string;
  amcName: string;
  category: string;
  closeDate: string;
  minInvestment: number;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────
function fmtINR(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}
function daysLeft(closeDate: string) {
  const diff = new Date(closeDate).getTime() - Date.now();
  const d = Math.ceil(diff / 86400000);
  return d > 0 ? d : 0;
}

// ─── Mini SVG Sparkline (arc based on real return %) ─────────
function PortfolioSparkline({ pct }: { pct: number }) {
  // Generate a simple upward-trending path influenced by pct
  const isPositive = pct >= 0;
  const clamp = Math.min(Math.abs(pct), 40) / 40; // 0–1
  const midY = isPositive ? 60 - clamp * 40 : 60 + clamp * 20;
  return (
    <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: isPositive ? 'rgba(68,245,147,0.3)' : 'rgba(255,71,87,0.3)' }} />
          <stop offset="100%" style={{ stopColor: 'rgba(0,0,0,0)' }} />
        </linearGradient>
      </defs>
      <path
        d={`M0,80 Q100,${midY + 10} 200,${midY} T400,${midY - 15} L400,100 L0,100 Z`}
        fill="url(#spark-grad)"
      />
      <path
        d={`M0,80 Q100,${midY + 10} 200,${midY} T400,${midY - 15}`}
        fill="none"
        stroke={isPositive ? '#00d87a' : '#ff4757'}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="400" cy={midY - 15} fill={isPositive ? '#44f593' : '#ff4757'} r="4" />
    </svg>
  );
}

// ─── Dashboard Ticker (inline, not the global MarketStrip) ────
function DashboardTicker() {
  const [items, setItems] = useState<{ label: string; price: string; change: string; pos: boolean }[]>([]);

  useEffect(() => {
    fetch('/api/market-data?symbols=NIFTY,SENSEX,BANKNIFTY,NIFTYIT,NIFTYNEXT50,NIFTYMIDCAP150,NIFTYSMALLCAP100,NIFTYPHARMA,NIFTYAUTO,NIFTYFMCG')
      .then(r => r.json())
      .then(json => {
        const data: IndexData[] = json?.data ?? json?.indices ?? [];
        if (!Array.isArray(data) || !data.length) return;
        setItems(data.map(d => ({
          label: d.name ?? d.symbol ?? '—',
          price: (d.price ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
          change: `${(d.changePercent ?? 0) >= 0 ? '+' : ''}${(d.changePercent ?? 0).toFixed(2)}%`,
          pos: (d.changePercent ?? 0) >= 0,
        })));
      })
      .catch(() => {});
  }, []);

  if (!items.length) return null;
  const doubled = [...items, ...items];

  return (
    <div
      className="fixed left-0 right-0 z-40 overflow-hidden hidden md:block"
      style={{ top: 80, height: 44, background: '#060D0A', borderBottom: '1px solid rgba(60,74,62,0.35)' }}
    >
      <style>{`
        @keyframes dash-ticker { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        .dash-ticker { display: inline-flex; white-space: nowrap; animation: dash-ticker 55s linear infinite; }
      `}</style>
      <div className="absolute inset-y-0 left-0 w-12 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #060D0A, transparent)' }} />
      <div className="absolute inset-y-0 right-0 w-12 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, #060D0A, transparent)' }} />
      <div className="dash-ticker flex items-center h-full">
        {doubled.map((e, i) => (
          <div key={i} className="flex items-center gap-2.5 shrink-0 px-6">
            {i !== 0 && <span className="w-1 h-1 rounded-full bg-[#3c4a3e]" />}
            <span className="font-['JetBrains_Mono'] text-[13px] text-[#859586] uppercase tracking-wide">{e.label}</span>
            <span className="font-['JetBrains_Mono'] text-[14px] font-semibold text-[#dce5df]">{e.price}</span>
            <span className="font-['JetBrains_Mono'] text-[13px] font-bold" style={{ color: e.pos ? '#44f593' : '#ff4757' }}>{e.change}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Data
  const [summary, setSummary]     = useState<PortfolioSummary | null>(null);
  const [metrics, setMetrics]     = useState<PortfolioMetrics | null>(null);
  const [holdings, setHoldings]   = useState<Holding[]>([]);
  const [indices, setIndices]     = useState<{ label: string; price: string; change: string; pos: boolean }[]>([]);
  const [news, setNews]           = useState<NewsItem[]>([]);
  const [nfos, setNfos]           = useState<NFOItem[]>([]);

  // Loading
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [showCASUploader, setShowCASUploader]   = useState(false);

  // ── Auth guard ──────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/signin?redirect=/dashboard');
  }, [authLoading, isAuthenticated, router]);

  // ── Close avatar dropdown on outside click ──────────────────
  useEffect(() => {
    function outside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  // ── Fetch all dashboard data in parallel ────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    setLoadingPortfolio(true);

    Promise.all([
      fetch('/api/portfolio/summary').then(r => r.ok ? r.json() : null),
      fetch('/api/portfolio/metrics').then(r => r.ok ? r.json() : null),
      fetch('/api/portfolio/holdings').then(r => r.ok ? r.json() : null),
      fetch('/api/market-data?symbols=NIFTY,SENSEX,BANKNIFTY').then(r => r.ok ? r.json() : null),
      fetch('/api/news/aggregated').then(r => r.ok ? r.json() : null),
      fetch('/api/nfo/live?status=open').then(r => r.ok ? r.json() : null),
    ]).then(([portSummary, portMetrics, portHoldings, marketData, newsData, nfoData]) => {
      if (portSummary?.success)   setSummary(portSummary.summary);
      if (portMetrics?.success)   setMetrics(portMetrics.metrics);
      if (portHoldings?.success)  {
        const sorted = [...(portHoldings.holdings || [])].sort((a: Holding, b: Holding) => b.currentValue - a.currentValue);
        setHoldings(sorted.slice(0, 6));
      }
      if (marketData) {
        const data: IndexData[] = marketData?.data ?? marketData?.indices ?? [];
        setIndices(data.slice(0, 3).map((d: IndexData) => ({
          label: d.name ?? d.symbol ?? '—',
          price: (d.price ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
          change: `${(d.changePercent ?? 0) >= 0 ? '+' : ''}${(d.changePercent ?? 0).toFixed(2)}%`,
          pos: (d.changePercent ?? 0) >= 0,
        })));
      }
      if (newsData?.articles) setNews(newsData.articles.slice(0, 3));
      if (nfoData?.nfos)      setNfos(nfoData.nfos.slice(0, 6));
    }).catch(() => {}).finally(() => setLoadingPortfolio(false));
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) return (
    <div className="bg-[#0d1512] min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[#1F2B24] border-t-[#00D87A] animate-spin" />
    </div>
  );

  const hasCAS       = (summary?.holdingsCount ?? 0) > 0;
  const isPositive   = (summary?.returnsPercentage ?? 0) >= 0;
  const userInitial  = (user as any)?.fullName?.[0]?.toUpperCase() ?? (user as any)?.email?.[0]?.toUpperCase() ?? 'U';
  const userName     = (user as any)?.fullName ?? 'Investor';
  const isPremium    = (user as any)?.is_premium ?? false;

  return (
    <div className="bg-[#0d1512] min-h-screen text-[#dce5df] font-['Inter']">

      {/* ── Fixed Top Header ─────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8"
        style={{ height: 80, background: 'rgba(13,21,18,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Left: Logo + back to markets */}
        <div className="flex items-center gap-6">
          <Link href="/markets" className="flex items-center gap-2 group">
            <span className="material-symbols-outlined text-[#00d87a] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
            <span className="font-['Space_Grotesk'] font-bold text-[#00d87a] text-lg tracking-tighter hidden lg:block">VMFS Vault</span>
          </Link>
          <Link href="/markets" className="hidden md:flex items-center gap-1.5 text-[#859586] hover:text-[#44f593] transition-colors text-sm font-medium">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Markets
          </Link>
        </div>

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center gap-6 font-['Space_Grotesk'] font-bold text-base">
          {[
            { label: 'Markets',   href: '/markets' },
            { label: 'Discover',  href: '/funds/search' },
            { label: 'Portfolio', href: '/portfolio' },
            { label: 'Goals',     href: '/goals' },
            { label: 'News',      href: '/news' },
          ].map(({ label, href }) => (
            <Link key={label} href={href} className="text-[#859586] hover:text-[#00d87a] transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        {/* Right: Search + Bell + Avatar */}
        <div className="flex items-center gap-3">
          <button
            className="hidden lg:flex items-center gap-2 bg-[#161d1a] border border-white/5 rounded-full px-4 py-1.5 text-sm text-[#859586] hover:border-[#44f593]/30 transition-all"
            onClick={() => router.push('/funds/search')}
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
            <span className="font-['Inter'] text-xs">Search funds…</span>
          </button>
          <button
            className="p-2 rounded-full text-[#859586] hover:bg-white/5 transition-all"
            aria-label="Alerts"
            onClick={() => router.push('/alerts')}
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>notifications</span>
          </button>

          {/* Avatar dropdown */}
          <div className="relative" ref={avatarRef}>
            <button
              onClick={() => setAvatarOpen(v => !v)}
              className="flex items-center gap-2 bg-[#00d87a] text-[#00391c] px-3 py-1.5 rounded-xl font-bold text-sm hover:bg-[#25e283] transition-colors active:scale-95"
            >
              <span className="w-5 h-5 rounded-full bg-[#00391c]/20 flex items-center justify-center text-[0.6rem] font-bold">{userInitial}</span>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>expand_more</span>
            </button>
            {avatarOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#0d1512]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 z-50">
                <Link href="/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#c4cfc9] hover:text-white hover:bg-white/5 transition-colors" onClick={() => setAvatarOpen(false)}>
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>person</span>
                  Profile
                </Link>
                <Link href="/portfolio" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#c4cfc9] hover:text-white hover:bg-white/5 transition-colors" onClick={() => setAvatarOpen(false)}>
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>account_balance</span>
                  Portfolio
                </Link>
                <div className="border-t border-white/10 my-1" />
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                  onClick={() => { setAvatarOpen(false); logout(); }}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Market Ticker Strip (directly below header, above sidebar) */}
      <DashboardTicker />

      {/* ── Fixed Left Sidebar ───────────────────────────────── */}
      <aside
        className="fixed left-0 bottom-0 z-30 w-64 flex flex-col hidden md:flex"
        style={{ top: 124, background: '#0a120f', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* User card */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#161d1a]">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-base text-[#00391c] font-['Space_Grotesk'] shrink-0"
              style={{ background: 'linear-gradient(135deg, #44f593, #00d87a)' }}
            >
              {userInitial}
            </div>
            <div className="min-w-0">
              <div className="text-[#44f593] font-bold text-sm truncate">{userName}</div>
              <div className="text-xs text-[#859586] uppercase tracking-widest font-bold">
                {isPremium ? 'VMFS Pro' : 'Free Plan'}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { icon: 'dashboard',        label: 'Dashboard',  href: '/dashboard',  active: true },
            { icon: 'monitoring',       label: 'Analytics',  href: '/portfolio?tab=analytics', active: false },
            { icon: 'account_balance',  label: 'Assets',     href: '/portfolio',  active: false },
            { icon: 'track_changes',    label: 'Goals',      href: '/goals',      active: false },
            { icon: 'newspaper',        label: 'News',       href: '/news',       active: false },
            { icon: 'manage_search',    label: 'Screener',   href: '/screener',   active: false, disabled: true },
          ].map(item => (
            item.disabled ? (
              <span
                key={item.label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#3c4a3e] cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>{item.icon}</span>
                {item.label}
                <span className="ml-auto text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 leading-none">
                  SOON
                </span>
              </span>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={[
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  item.active
                    ? 'bg-[#00d87a]/10 text-[#00d87a] border-r-2 border-[#00d87a]'
                    : 'text-[#859586] hover:bg-[#161d1a] hover:text-[#dce5df]',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          ))}
        </nav>

        {/* Bottom: Premium CTA + support + sign out */}
        <div className="px-4 pb-5 space-y-3 border-t border-white/5 pt-4">
          {!isPremium && (
            <Link
              href="/premium"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm text-[#00391c] transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(to right, #44f593, #00d87a)', boxShadow: '0 0 20px rgba(0,216,122,0.2)' }}
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              Upgrade to Pro
            </Link>
          )}
          {!hasCAS && (
            <button
              onClick={() => setShowCASUploader(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm text-[#44f593] border border-[#44f593]/20 bg-[#44f593]/5 hover:bg-[#44f593]/10 transition-all"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>upload_file</span>
              Import CAS
            </button>
          )}
          <div className="flex gap-2">
            <Link href="/profile" className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-[#859586] hover:text-[#dce5df] transition-colors rounded-lg hover:bg-white/5">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>contact_support</span>
              Support
            </Link>
            <button
              onClick={() => logout()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-[#859586] hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main
        className="min-h-screen px-4 md:px-8 lg:px-12 pb-16 md:ml-64 pt-24 md:pt-36"
      >

        {/* ── Hero: Portfolio Value ─────────────────────────── */}
        <section className="mb-10">
          <div
            className="rounded-3xl p-10 relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.025)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.05)',
              boxShadow: '0 0 60px -10px rgba(0,216,122,0.1)',
            }}
          >
            {/* CAS Gate: blur when no holdings */}
            {!hasCAS && !loadingPortfolio && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl"
                style={{ backdropFilter: 'blur(12px)', background: 'rgba(6,13,10,0.7)' }}>
                <span className="material-symbols-outlined text-5xl text-[#44f593] mb-4" style={{ fontVariationSettings: "'FILL' 0" }}>upload_file</span>
                <h3 className="font-['Space_Grotesk'] font-bold text-xl text-[#dce5df] mb-2">No portfolio data yet</h3>
                <p className="text-[#859586] text-sm mb-5 text-center max-w-xs">Import your Consolidated Account Statement (CAS) from CAMS or KFintech to unlock your full dashboard.</p>
                <button
                  onClick={() => setShowCASUploader(true)}
                  className="px-6 py-3 rounded-xl font-bold text-sm text-[#00391c] transition-all active:scale-95"
                  style={{ background: 'linear-gradient(to right, #44f593, #00d87a)' }}
                >
                  Import CAS Now
                </button>
              </div>
            )}

            <div className="relative z-0 flex flex-col md:flex-row justify-between items-end gap-8">
              <div>
                <span className="text-[#859586] uppercase tracking-[0.2em] font-bold text-xs mb-2 block">Portfolio Value</span>
                {loadingPortfolio ? (
                  <div className="h-16 w-64 bg-white/5 rounded-xl animate-pulse" />
                ) : (
                  <>
                    <h1 className="font-['Space_Grotesk'] font-bold tracking-tighter flex items-baseline gap-2"
                      style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1 }}>
                      <span className="font-['JetBrains_Mono'] text-3xl font-light text-[#44f593]/50">₹</span>
                      <span className="text-[#44f593]">
                        {summary ? fmtINR(summary.currentValue).replace('₹', '') : '—'}
                      </span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <span className={`flex items-center text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${isPositive ? 'bg-[#44f593]/10 text-[#44f593]' : 'bg-red-400/10 text-red-400'}`}>
                        <span className="material-symbols-outlined text-xs mr-1">{isPositive ? 'trending_up' : 'trending_down'}</span>
                        {fmtPct(summary?.returnsPercentage ?? 0)}
                      </span>
                      <span className="text-xs text-[#859586] font-medium font-['JetBrains_Mono']">
                        {isPositive ? '+' : ''}{summary ? fmtINR(summary.totalReturns) : '—'} total returns
                      </span>
                      <span className="text-[#3c4a3e] text-xs">·</span>
                      <span className="text-xs text-[#859586]">Invested: {summary ? fmtINR(summary.totalInvested) : '—'}</span>
                    </div>
                  </>
                )}
              </div>
              {/* Sparkline */}
              <div className="w-full md:w-2/5 h-20 shrink-0">
                {!loadingPortfolio && summary && (
                  <PortfolioSparkline pct={summary.returnsPercentage} />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Bento Grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Left col: Vault Intelligence (7 cols) ─────────── */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                Vault Intelligence
              </h2>
              <Link href="/portfolio?tab=analytics" className="text-xs text-[#44f593] font-bold hover:underline">
                Full Analytics
              </Link>
            </div>

            {/* Risk Metrics + Rolling Returns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Risk Metrics Card */}
              <div
                className="rounded-2xl p-6 border hover:border-[#44f593]/20 transition-all"
                style={{ background: '#161d1a', borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="w-10 h-10 rounded-full bg-[#242c28] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 0" }}>analytics</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#859586] uppercase font-bold tracking-wide">Sharpe Ratio</span>
                    <div className="font-['JetBrains_Mono'] text-xl font-bold text-[#dce5df]">
                      {loadingPortfolio ? '…' : metrics?.sharpeRatio1y != null ? metrics.sharpeRatio1y.toFixed(2) : '—'}
                    </div>
                  </div>
                </div>
                <h3 className="font-['Space_Grotesk'] font-bold text-base mb-1.5">Risk-Adjusted Returns</h3>
                <p className="text-xs text-[#859586] leading-relaxed mb-4">
                  Weighted Sharpe ratio across your mutual fund portfolio, reflecting risk-adjusted performance.
                </p>
                {/* Volatility bar */}
                <div>
                  <div className="flex justify-between text-xs font-mono text-[#859586] mb-1.5">
                    <span>VOLATILITY (1Y)</span>
                    <span>{loadingPortfolio ? '…' : metrics?.volatility1y != null ? `${metrics.volatility1y.toFixed(1)}%` : '—'}</span>
                  </div>
                  <div className="w-full bg-[#0d1512] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: metrics?.volatility1y != null ? `${Math.min(metrics.volatility1y * 5, 100)}%` : '0%',
                        background: 'linear-gradient(to right, #44f593, #00d87a)',
                        transition: 'width 0.8s ease',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Rolling Returns Card */}
              <div
                className="rounded-2xl p-6 border hover:border-[#44f593]/20 transition-all"
                style={{ background: '#161d1a', borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="w-10 h-10 rounded-full bg-[#242c28] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 0" }}>ssid_chart</span>
                  </div>
                  <span className="text-xs text-[#44f593] font-bold uppercase tracking-wide bg-[#44f593]/10 px-2 py-0.5 rounded">CAGR</span>
                </div>
                <h3 className="font-['Space_Grotesk'] font-bold text-base mb-4">Rolling Returns</h3>
                <div className="space-y-3">
                  {[
                    { label: '1Y CAGR', value: metrics?.cagr1y },
                    { label: '3Y CAGR', value: metrics?.cagr3y },
                    { label: '5Y CAGR', value: metrics?.cagr5y },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[#859586] uppercase w-16 shrink-0">{row.label}</span>
                      <div className="flex-1 bg-[#0d1512] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: row.value != null ? `${Math.min(Math.abs(row.value) * 3, 100)}%` : '0%',
                            background: (row.value ?? 0) >= 0 ? 'linear-gradient(to right, #44f593, #00d87a)' : 'linear-gradient(to right, #ff4757, #ff6b6b)',
                            transition: 'width 0.8s ease',
                          }}
                        />
                      </div>
                      <span className={`font-['JetBrains_Mono'] text-sm font-bold w-14 text-right ${(row.value ?? 0) >= 0 ? 'text-[#44f593]' : 'text-red-400'}`}>
                        {loadingPortfolio ? '…' : fmtPct(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Holdings */}
            <div className="rounded-2xl p-6" style={{ background: '#161d1a', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-bold text-[#859586] uppercase tracking-widest">Top Holdings</h3>
                <Link href="/portfolio" className="text-xs text-[#44f593] font-bold hover:underline">View All</Link>
              </div>
              {loadingPortfolio ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : holdings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#859586] text-sm mb-3">No holdings found</p>
                  <button
                    onClick={() => setShowCASUploader(true)}
                    className="text-xs text-[#44f593] font-bold hover:underline"
                  >Import CAS to get started →</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {holdings.map(h => (
                    <Link
                      key={h.id}
                      href={`/funds/${h.schemeCode}`}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/5 hover:bg-[#19211e] hover:border-[#44f593]/15 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#0d1512] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[#44f593] text-base" style={{ fontVariationSettings: "'FILL' 0" }}>account_balance</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-[#dce5df] truncate max-w-[200px] group-hover:text-white">{h.schemeName}</div>
                          <div className="text-[11px] text-[#859586] font-['JetBrains_Mono']">{fmtINR(h.currentValue)}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className={`font-['JetBrains_Mono'] text-sm font-bold ${h.returnsPercentage >= 0 ? 'text-[#44f593]' : 'text-red-400'}`}>
                          {fmtPct(h.returnsPercentage)}
                        </div>
                        {h.return1y != null && (
                          <div className="text-xs text-[#859586] uppercase">1Y: {fmtPct(h.return1y)}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right col: Market Pulse (5 cols) ─────────────── */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 1" }}>pulse_alert</span>
                Market Pulse
              </h2>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#44f593] animate-pulse" />
                <span className="text-xs text-[#44f593] font-bold uppercase tracking-widest">Live</span>
              </div>
            </div>

            <div
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              {/* Live Indices */}
              <div className="p-4 flex justify-around border-b border-white/5 bg-[#242c28]/40">
                {indices.length > 0 ? indices.map((idx, i) => (
                  <div key={i} className="text-center px-2">
                    <div className="text-xs text-[#859586] font-bold uppercase tracking-wide mb-0.5">{idx.label}</div>
                    <div className="font-['JetBrains_Mono'] text-sm font-bold text-[#dce5df]">{idx.price}</div>
                    <div className={`text-xs font-['JetBrains_Mono'] font-bold ${idx.pos ? 'text-[#44f593]' : 'text-red-400'}`}>{idx.change}</div>
                  </div>
                )) : (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="text-center px-4">
                      <div className="h-3 w-16 bg-white/5 rounded animate-pulse mb-1" />
                      <div className="h-4 w-20 bg-white/5 rounded animate-pulse mb-1" />
                      <div className="h-3 w-12 bg-white/5 rounded animate-pulse" />
                    </div>
                  ))
                )}
              </div>

              {/* Goals Summary — factual data only (advisory pulse disabled for SEBI compliance) */}
              <div className="px-4 pt-4">
                <a href="/goals" className="block p-3 rounded-xl bg-[#161d1a] hover:bg-[#1a221e] transition-colors">
                  <div className="text-xs text-[#859586] uppercase font-bold tracking-wide mb-1">Your Goals</div>
                  <div className="text-xs text-[#dce5df] font-medium">Track your financial goals →</div>
                </a>
              </div>

              {/* News Flash */}
              <div className="p-4 flex-1 space-y-3">
                {news.length > 0 ? news.map((n, i) => (
                  <a
                    key={i}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl bg-[#161d1a] border-l-2 hover:bg-[#19211e] transition-colors group"
                    style={{ borderColor: i === 0 ? '#44f593' : '#3c4a3e' }}
                  >
                    <div className="text-xs text-[#44f593] font-bold uppercase tracking-wide mb-1">{n.source}</div>
                    <p className="text-xs text-[#dce5df] font-medium leading-relaxed line-clamp-2 group-hover:text-white">
                      {n.title}
                    </p>
                  </a>
                )) : (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="p-4 bg-[#242c28]/30 border-t border-white/5">
                <Link
                  href="/news"
                  className="w-full py-2.5 rounded-xl border border-[#44f593]/30 text-[#44f593] font-bold text-xs hover:bg-[#44f593]/10 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>open_in_new</span>
                  Full Market News
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── NFO Carousel ─────────────────────────────────────── */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 0" }}>auto_awesome</span>
              Recently Launched Funds
            </h2>
            <Link href="/funds/search" className="text-xs text-[#44f593] font-bold hover:underline">Browse All</Link>
          </div>

          {nfos.length === 0 ? (
            <div className="flex gap-5 overflow-x-auto pb-3">
              {[...Array(3)].map((_, i) => <div key={i} className="min-w-[300px] h-44 bg-[#161d1a] rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <div className="flex gap-5 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
              {nfos.map((nfo, i) => {
                const days = daysLeft(nfo.closeDate);
                return (
                  <Link
                    key={nfo.id || i}
                    href={`/funds/${nfo.id}`}
                    className="min-w-[300px] rounded-2xl p-5 border border-white/5 hover:border-[#44f593]/25 hover:scale-[1.015] transition-all cursor-pointer flex flex-col"
                    style={{ background: '#161d1a' }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs bg-[#44f593]/10 text-[#44f593] px-2 py-0.5 rounded font-bold uppercase">
                        {nfo.category}
                      </span>
                      {days > 0 && (
                        <span className="text-xs text-[#859586] font-bold uppercase">
                          {days}D LEFT
                        </span>
                      )}
                    </div>
                    <h4 className="font-['Space_Grotesk'] font-bold text-base text-[#dce5df] mb-1 line-clamp-2">{nfo.schemeName}</h4>
                    <p className="text-xs text-[#859586] mb-4 flex-1">{nfo.amcName}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <div>
                        <div className="text-xs text-[#859586] uppercase">Min Investment</div>
                        <div className="font-['JetBrains_Mono'] text-sm font-bold text-[#dce5df]">
                          {fmtINR(nfo.minInvestment || 500)}
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-[#242c28] text-[#44f593] text-xs font-bold hover:bg-[#44f593] hover:text-[#001f10] transition-all">
                        View Details
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ── AMFI Disclaimer ──────────────────────────────────── */}
        <p className="text-center text-xs text-[#3c4a3e] font-['Inter'] mt-10 max-w-2xl mx-auto leading-relaxed">
          Mutual fund investments are subject to market risks. Past performance is not indicative of future results.
          Vijay Malik Financial Services — AMFI-Registered Mutual Fund Distributor · ARN-317605
        </p>
      </main>

      {/* ── CAS Uploader Modal ────────────────────────────────── */}
      {showCASUploader && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(6,13,10,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div className="relative w-full max-w-2xl">
            <button
              onClick={() => setShowCASUploader(false)}
              className="absolute -top-4 -right-4 z-10 w-9 h-9 rounded-full bg-[#161d1a] border border-white/10 flex items-center justify-center text-[#859586] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
            <CASUploader
              onImportComplete={() => {
                setShowCASUploader(false);
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Nav (hidden on desktop — sidebar handles it) ── */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-[#0a120f]/95 backdrop-blur-xl border-t border-white/5 flex justify-around py-2 pb-[env(safe-area-inset-bottom,8px)]">
        {[
          { icon: 'dashboard', label: 'Dashboard', href: '/dashboard' },
          { icon: 'account_balance', label: 'Portfolio', href: '/portfolio' },
          { icon: 'track_changes', label: 'Goals', href: '/goals' },
          { icon: 'storefront', label: 'Markets', href: '/markets' },
        ].map(item => (
          <Link key={item.label} href={item.href} className="flex flex-col items-center gap-0.5 text-[#859586] hover:text-[#44f593] transition-colors min-w-[60px]">
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
