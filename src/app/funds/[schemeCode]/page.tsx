'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

// ─── Types ───────────────────────────────────────────────────
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
  returns: {
    return1w?: number;
    return1m?: number;
    return3m?: number;
    return6m?: number;
    return1y?: number;
    return3y?: number;
    return5y?: number;
    cagr1y?: number;
    cagr3y?: number;
    cagr5y?: number;
    volatility1y?: number;
    maxDrawdown?: number;
    sharpeRatio1y?: number;
    sortinoRatio1y?: number;
  } | null;
  navHistory: Array<{ date: string; nav: number }>;
  managers: Array<{ name: string; isCurrent: boolean; tenure?: number }>;
}

interface Holding {
  holding_name: string;
  weight_pct: number;
  sector?: string;
  rank?: number;
}

// ─── Helpers ─────────────────────────────────────────────────
function fmtPct(v?: number | null, decimals = 2): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}
function fmtNum(v?: number | null, d = 2): string {
  if (v == null) return '—';
  return v.toFixed(d);
}
function fmtCr(v?: number | null): string {
  if (v == null) return '—';
  if (v >= 100) return `₹${(v / 100).toFixed(0)} Cr`;
  return `₹${v.toFixed(0)} Cr`;
}
function fmtDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fundAge(inception?: string): string {
  if (!inception) return '—';
  const years = (Date.now() - new Date(inception).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return `${years.toFixed(1)} Yrs`;
}

// ─── Mini SVG Chart ──────────────────────────────────────────
function MiniChart({ history }: { history: Array<{ date: string; nav: number }> }) {
  if (history.length < 2) return null;
  const navs = history.map(h => h.nav);
  const min = Math.min(...navs);
  const max = Math.max(...navs);
  const range = max - min || 1;
  const W = 1000;
  const H = 300;
  const points = navs.map((n, i) => {
    const x = (i / (navs.length - 1)) * W;
    const y = H - ((n - min) / range) * H * 0.85 - H * 0.05;
    return `${x},${y}`;
  }).join(' ');
  const area = `M0,${H} L${points.split(' ').map(p => p).join(' L')} L${W},${H} Z`;
  const line = `M${points.split(' ').join(' L')}`;

  return (
    <div className="relative h-48 md:h-64 w-full overflow-hidden">
      <div className="absolute inset-0 nav-area-gradient" />
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#44f593" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#44f593" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#chartFill)"/>
        <path d={line} fill="none" stroke="#44f593" strokeWidth="2.5"
          style={{ filter: 'drop-shadow(0 0 8px rgba(68,245,147,0.5))' }}/>
      </svg>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function FundDetailPage() {
  const params = useParams();
  const router = useRouter();
  const schemeCode = params?.schemeCode as string;

  const [data, setData] = useState<FundData | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'1D' | '1M' | '6M' | '1Y' | '3Y' | 'SI'>('1Y');
  const [investMode, setInvestMode] = useState<'sip' | 'onetime'>('sip');
  const [amount, setAmount] = useState('5000');
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const isPremium = (user as any)?.is_premium ?? false;

  const RETURN_TABS = ['1D', '1M', '6M', '1Y', '3Y', 'SI'] as const;

  const fetchData = useCallback(async () => {
    if (!schemeCode) return;
    setLoading(true);
    try {
      const [fundRes, holdingsRes] = await Promise.all([
        fetch(`/api/funds/${schemeCode}`),
        fetch(`/api/funds/${schemeCode}/holdings`).catch(() => null),
      ]);
      const fundJson = await fundRes.json();
      if (!fundJson.success) throw new Error(fundJson.error ?? 'Fund not found');
      setData(fundJson.data);

      if (holdingsRes) {
        const hJson = await holdingsRes.json().catch(() => ({}));
        setHoldings(hJson.holdings ?? hJson.data ?? []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [schemeCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter history by tab
  const filteredHistory = (() => {
    if (!data?.navHistory?.length) return [];
    const h = [...data.navHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const now = Date.now();
    const MS: Record<string, number> = {
      '1D': 1,
      '1M': 30,
      '6M': 180,
      '1Y': 365,
      '3Y': 1095,
      'SI': 99999,
    };
    const days = MS[activeTab] ?? 365;
    return h.filter(p => (now - new Date(p.date).getTime()) / 86400000 <= days);
  })();

  const currentReturn = (() => {
    const r = data?.returns;
    if (!r) return null;
    const map: Record<string, number | undefined> = {
      '1D': r.return1w,
      '1M': r.return1m,
      '6M': r.return6m,
      '1Y': r.return1y,
      '3Y': r.return3y,
      'SI': r.return5y,
    };
    return map[activeTab] ?? null;
  })();

  if (loading) {
    return (
      <div className="bg-[#0d1512] min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#3c4a3e] border-t-[#44f593] animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#0d1512] min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-[#ffb4ab] text-lg font-semibold">{error ?? 'Fund not found'}</p>
          <button onClick={() => router.back()} className="text-[#44f593] hover:underline text-sm">
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const { fund, returns: ret } = data;
  const navChange = currentReturn;
  const navPos = (navChange ?? 0) >= 0;

  const METRICS = [
    { label: 'AUM',           value: fmtCr(fund.fundSize) },
    { label: 'Expense Ratio', value: fund.expenseRatio != null ? `${fund.expenseRatio.toFixed(2)}%` : '—' },
    { label: 'Exit Load',     value: fund.exitLoad ?? '—' },
    { label: 'Min SIP',       value: fund.minSip != null ? `₹${fund.minSip}` : '—' },
    { label: 'Alpha',         value: fmtPct(ret?.cagr1y), accent: true },
    { label: 'Sharpe Ratio',  value: fmtNum(ret?.sharpeRatio1y) },
    { label: 'Volatility',    value: fmtPct(ret?.volatility1y) },
    { label: 'Age',           value: fundAge(fund.inceptionDate) },
  ];

  const QUICK_AMOUNTS = investMode === 'sip'
    ? ['1000', '2500', '5000', '10000']
    : ['5000', '10000', '25000', '50000'];

  return (
    <div className="bg-[#0d1512] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-12 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── Left Column (8 cols) ──────────────────────────── */}
          <div className="lg:col-span-8 space-y-6">

            {/* [1] Hero Info Block */}
            <section className="glass-card p-6 md:p-8 rounded-2xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <span className="text-[#44f593] font-mono text-xs tracking-widest uppercase">
                    {fund.amcCode ?? 'AMC'}
                  </span>
                  <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-[#dce5df] leading-tight">
                    {fund.schemeName}
                  </h1>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {fund.planType && (
                      <span className="bg-[#242c28] px-3 py-1 rounded-full text-xs font-medium border border-[#3c4a3e]/20 text-[#c0c9c2]">
                        {fund.planType}
                      </span>
                    )}
                    {fund.optionType && (
                      <span className="bg-[#242c28] px-3 py-1 rounded-full text-xs font-medium border border-[#3c4a3e]/20 text-[#c0c9c2]">
                        {fund.optionType}
                      </span>
                    )}
                    {fund.schemeType && (
                      <span className="bg-[#242c28] px-3 py-1 rounded-full text-xs font-medium border border-[#3c4a3e]/20 text-[#c0c9c2]">
                        {fund.schemeType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[#859586] text-xs block mb-1">Live NAV</span>
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="text-2xl font-mono font-bold text-[#dce5df]">₹{fund.latestNav?.toFixed(4)}</span>
                    {navChange != null && (
                      <span className={`text-sm font-mono ${navPos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                        {fmtPct(navChange)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#859586] font-mono">as of {fmtDate(fund.latestNavDate)}</span>
                </div>
              </div>
            </section>

            {/* [2] Returns Tabs + Chart */}
            <section className="glass-card p-6 rounded-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#3c4a3e]/20 pb-4">
                <div className="flex gap-4">
                  {RETURN_TABS.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={[
                        'pb-4 px-1 text-sm font-medium transition-colors',
                        activeTab === tab
                          ? 'text-[#44f593] border-b-2 border-[#44f593]'
                          : 'text-[#c0c9c2] hover:text-[#dce5df]',
                      ].join(' ')}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#859586]">
                  <span className="w-2 h-2 rounded-full bg-[#44f593]" />
                  Fund NAV
                </div>
              </div>

              <MiniChart history={filteredHistory.length > 0 ? filteredHistory : data.navHistory ?? []} />
            </section>

            {/* [3] Metrics Grid 2×4 */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {METRICS.map(m => (
                <div key={m.label} className="glass-card p-4 rounded-2xl">
                  <p className="text-[#859586] text-xs uppercase tracking-widest mb-1">{m.label}</p>
                  <p className={`text-lg font-mono font-bold ${m.accent ? 'text-[#44f593]' : 'text-[#dce5df]'}`}>
                    {m.value}
                  </p>
                </div>
              ))}
            </section>

            {/* [4] Top Holdings */}
            <section className="glass-card overflow-hidden rounded-2xl">
              <div className="px-6 py-5 border-b border-[#3c4a3e]/20 flex justify-between items-center">
                <h3 className="text-lg font-display font-bold text-[#dce5df]">Portfolio Holdings</h3>
                <span className="text-[#859586] text-xs uppercase tracking-widest">
                  {holdings.length} Assets Total
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#161d1a] text-xs font-mono text-[#859586] uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Security Name</th>
                      <th className="px-6 py-4">Sector</th>
                      <th className="px-6 py-4 text-right">Weightage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3c4a3e]/15">
                    {(holdings.length > 0 ? holdings.slice(0, 5) : []).map((h, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-sm text-[#dce5df]">{h.holding_name}</td>
                        <td className="px-6 py-4 text-sm text-[#859586]">{h.sector ?? '—'}</td>
                        <td className="px-6 py-4 text-right font-mono text-sm text-[#dce5df]">
                          {h.weight_pct?.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                    {holdings.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-sm text-[#859586]">
                          Holdings data not available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Premium Gate — blur after row 5 */}
              {holdings.length > 5 && (
                <div className="relative">
                  <div className="h-28 bg-gradient-to-t from-[#0d1512] to-transparent absolute inset-0 z-10" />
                  <div className="px-6 py-4 blur-sm select-none opacity-40">
                    {holdings.slice(5, 7).map((h, i) => (
                      <div key={i} className="flex justify-between py-2 text-sm text-[#dce5df]">
                        <span>{h.holding_name}</span>
                        <span>{h.sector}</span>
                        <span>{h.weight_pct?.toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 z-20 flex items-center justify-center">
                    <Link href="/auth/signin?redirect=/funds" className="glass-card px-6 py-3 rounded-full border-[#44f593]/30 flex items-center gap-3 hover:border-[#44f593]/50 transition-colors">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                      <span className="text-sm font-bold emerald-gradient-text uppercase tracking-widest">
                        Sign In to Unlock Holdings
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Right Sidebar (4 cols) ───────────────────────── */}
          <aside className="lg:col-span-4 sticky top-24 space-y-5">

            {/* Quick Invest Panel */}
            <div className="glass-card p-6 rounded-2xl border-[#44f593]/20 shadow-lg shadow-[#44f593]/5">
              <h3 className="text-xl font-display font-bold mb-5 text-[#dce5df]">Invest Now</h3>

              {/* SIP / One-time toggle */}
              <div className="flex p-1 bg-[#08100d] rounded-xl mb-5">
                {(['sip', 'onetime'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setInvestMode(mode)}
                    className={[
                      'flex-1 py-2 rounded-lg text-sm font-bold transition-all',
                      investMode === mode
                        ? 'bg-[#44f593] text-[#001f10]'
                        : 'text-[#c0c9c2] hover:text-[#dce5df]',
                    ].join(' ')}
                  >
                    {mode === 'sip' ? 'Monthly SIP' : 'One-time'}
                  </button>
                ))}
              </div>

              {/* Amount input */}
              <div className="space-y-3 mb-5">
                <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block">
                  Investment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-mono text-[#c0c9c2]">₹</span>
                  <input
                    type="text"
                    value={parseInt(amount).toLocaleString('en-IN')}
                    onChange={e => {
                      const v = e.target.value.replace(/,/g, '');
                      if (/^\d*$/.test(v)) setAmount(v || '0');
                    }}
                    className="w-full bg-[#08100d] border border-[#3c4a3e] focus:border-[#44f593]/50 rounded-xl py-3.5 pl-10 pr-4 text-xl font-mono font-bold text-[#dce5df] focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {QUICK_AMOUNTS.map(a => (
                    <button
                      key={a}
                      onClick={() => setAmount(a)}
                      className="bg-[#242c28] px-3 py-1.5 rounded-lg text-xs font-medium text-[#c0c9c2] hover:bg-[#2f3733] transition-colors"
                    >
                      +₹{parseInt(a).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              {investMode === 'sip' && (
                <div className="mb-5">
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">
                    SIP Date
                  </label>
                  <div className="flex items-center justify-between p-3.5 bg-[#08100d] rounded-xl cursor-pointer border border-[#3c4a3e]">
                    <span className="text-sm text-[#dce5df]">15th of every month</span>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                </div>
              )}

              <a
                href="https://eonboard.njindiaonline.com/partner-tiny-url?njBrcode=14688"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-center bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] font-bold py-4 rounded-xl text-base hover:scale-[1.02] transition-transform active:scale-95"
              >
                {investMode === 'sip' ? 'Start Systematic Investment' : 'Invest Now'}
              </a>
              <p className="text-center text-xs text-[#859586] px-4 mt-3">
                Partner: <span className="font-bold text-[#c0c9c2]">Ojasvi Malik</span> (Vijay Malik Financial Services) · You will be redirected to NJ Wealth for transaction.
              </p>
            </div>

            {/* Fund Governance */}
            <div className="glass-card p-5 rounded-2xl space-y-4">
              <h4 className="text-xs font-display font-bold uppercase tracking-widest text-[#44f593]">Fund Governance</h4>

              {data.managers?.filter(m => m.isCurrent).slice(0, 2).map((mgr, i) => (
                <div key={i} className="flex items-center gap-3 group cursor-pointer">
                  <div className="w-9 h-9 rounded-full bg-[#242c28] flex items-center justify-center">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-[#dce5df]">{mgr.name}</p>
                    <p className="text-xs text-[#859586]">Fund Manager{mgr.tenure ? ` · ${mgr.tenure.toFixed(1)} yrs` : ''}</p>
                  </div>
                  <svg className="text-[#859586] group-hover:text-[#44f593] transition-colors" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              ))}

              {data.managers?.length === 0 && (
                <p className="text-xs text-[#859586]">Fund manager data not available.</p>
              )}

              <div className="flex items-center gap-3 opacity-50 cursor-not-allowed">
                <div className="w-9 h-9 rounded-full bg-[#242c28] flex items-center justify-center">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#859586" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-[#859586]">Key Information Memo</p>
                  <p className="text-xs text-[#859586]">SID / KIM Document</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 uppercase tracking-widest">Soon</span>
              </div>
            </div>

            {/* Returns summary */}
            {ret && (
              <div className="glass-card p-5 rounded-2xl">
                <h4 className="text-xs font-display font-bold uppercase tracking-widest text-[#44f593] mb-4">Historical Returns</h4>
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                  <span className="text-[10px] uppercase tracking-widest text-[#859586] font-bold">Period</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-[#859586] font-bold">Return</span>
                    <span className="text-[10px] text-[#859586]">(Absolute / CAGR)</span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: '1 Month',  value: ret.return1m, type: 'Absolute' },
                    { label: '6 Month',  value: ret.return6m, type: 'Absolute' },
                    { label: '1 Year',   value: ret.return1y, type: 'Absolute' },
                    { label: '3 Years',  value: ret.cagr3y,   type: 'CAGR' },
                    { label: '5 Years',  value: ret.cagr5y,   type: 'CAGR' },
                  ].filter(r => r.value != null).map(r => (
                    <div key={r.label} className="flex justify-between items-center">
                      <span className="text-sm text-[#c0c9c2]">{r.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm font-bold ${(r.value ?? 0) >= 0 ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                          {fmtPct(r.value)}
                        </span>
                        <span className="text-[9px] text-[#859586] font-mono w-12 text-right">{r.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Recommended Reads — internal links for SEO juice */}
        <div className="mt-10 max-w-5xl">
          <h3 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#44f593] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
            Recommended Reads
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: 'Direct vs Regular Plans — Why It Matters', href: '/learn/direct-vs-regular-mutual-funds' },
              { title: 'LTCG Tax on Mutual Funds 2026', href: '/learn/ltcg-tax-on-mutual-funds' },
              { title: 'SIP Calculator — Plan Your Investment', href: '/calculators/sip' },
            ].map(r => (
              <Link key={r.href} href={r.href} className="p-3 rounded-xl bg-[#161d1a] border border-white/5 hover:border-[#44f593]/20 transition-colors text-sm text-[#859586] hover:text-[#44f593]">
                {r.title} →
              </Link>
            ))}
          </div>
        </div>

        <ComplianceDisclaimer variant="fund" className="mt-10 max-w-5xl" />
      </main>

      <SiteFooter />
    </div>
  );
}
