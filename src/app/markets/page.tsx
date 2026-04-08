'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import HeroSection from '@/components/home/HeroSection';
import StatsBanner from '@/components/home/StatsBanner';
import VaultIntelligence from '@/components/home/VaultIntelligence';
import TopFundsSection from '@/components/home/TopFundsSection';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';
import { useAuth } from '@/context/AuthContext';
import CASUploader from '@/components/CASUploader';

// ─── Types ───────────────────────────────────────────────────
interface MarketIndex {
  name?: string;
  symbol?: string;
  displayName?: string;
  price?: number;
  lastPrice?: number;
  change?: number;
  changePercent?: number;
  pChange?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
}

interface Commodity {
  name: string;
  price?: number;
  change?: number;
  changePercent?: number;
  unit?: string;
}

// ─── Additional Types ─────────────────────────────────────────
interface FiiDii {
  date: string;
  fii: { buy_value: number; sell_value: number; net_value: number };
  dii: { buy_value: number; sell_value: number; net_value: number };
}
interface IndexMover {
  symbol: string;
  change_pct: number;
  weight: number;
  contribution: number;
  last_price: number;
}
interface IndexMovers {
  as_of: string;
  index_name: string;
  index_value: number;
  top_gainers: IndexMover[];
  top_losers: IndexMover[];
}
interface Constituent {
  symbol: string;
  company: string;
  industry: string;
  weight: number;
}
interface MarketStateData {
  fiiDii: FiiDii | null;
  movers: IndexMovers | null;
  constituents: Constituent[];
  isStale: boolean;
  scrapedAt: string | null;
}
interface MoversData {
  gainers: { symbol: string; name: string; price: number; change: number; changePercent: number }[];
  losers:  { symbol: string; name: string; price: number; change: number; changePercent: number }[];
  isLive: boolean;
  disclaimer?: string;
}

// ─── Helpers ─────────────────────────────────────────────────
function fmtNum(n?: number, d = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: d });
}
function fmtPct(n?: number): string {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function fmtCr(n?: number): string {
  if (n == null) return '—';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
}

/** Returns true if NSE/BSE market is currently open (9:15–15:30 IST Mon–Fri) */
function isMarketOpen(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 555 && mins <= 930;
}

/** Fetch with a hard timeout — prevents hanging requests from blocking UI */
async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── Index Card ───────────────────────────────────────────────
function IndexCard({ idx }: { idx: MarketIndex }) {
  const price = idx.lastPrice ?? idx.price ?? 0;
  const pct = idx.pChange ?? idx.changePercent ?? 0;
  const chg = idx.change ?? 0;
  const pos = pct >= 0;

  return (
    <Link href={`/markets/${encodeURIComponent((idx.symbol ?? idx.name ?? '').toUpperCase())}`} className="glass-card rounded-xl p-3 sm:p-5 hover:border-[#44f593]/20 transition-all block cursor-pointer group">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-0 mb-2 sm:mb-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-mono text-[#859586] uppercase tracking-wide mb-0.5 sm:mb-1 truncate">
            {idx.symbol ?? idx.name}
          </p>
          <h3 className="font-display font-bold text-[#dce5df] text-xs sm:text-sm leading-tight line-clamp-1">
            {idx.displayName ?? idx.name ?? idx.symbol}
          </h3>
        </div>
        <span className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shrink-0 self-start ${pos ? 'bg-[#44f593]/10 text-[#44f593]' : 'bg-[#ffb4ab]/10 text-[#ffb4ab]'}`}>
          {fmtPct(pct)}
        </span>
      </div>
      <div className="flex items-end gap-1.5 sm:gap-2">
        <span className="text-xl sm:text-2xl font-mono font-bold text-[#dce5df]">{fmtNum(price, 2)}</span>
        <span className={`text-[11px] sm:text-sm font-mono mb-0.5 ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
          {pos ? '+' : ''}{fmtNum(chg, 2)}
        </span>
      </div>
      {(idx.high || idx.low) && (
        <div className="hidden sm:flex gap-4 mt-3 pt-3 border-t border-white/5">
          <div>
            <p className="text-[11px] text-[#859586] uppercase tracking-wide">High</p>
            <p className="text-xs font-mono text-[#dce5df]">{fmtNum(idx.high, 2)}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#859586] uppercase tracking-wide">Low</p>
            <p className="text-xs font-mono text-[#dce5df]">{fmtNum(idx.low, 2)}</p>
          </div>
          {idx.previousClose && (
            <div>
              <p className="text-[11px] text-[#859586] uppercase tracking-wide">Prev Close</p>
              <p className="text-xs font-mono text-[#dce5df]">{fmtNum(idx.previousClose, 2)}</p>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

// ─── Commodity Row ────────────────────────────────────────────
function CommodityRow({ c }: { c: Commodity }) {
  const pos = (c.changePercent ?? c.change ?? 0) >= 0;
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <span className="text-sm font-medium text-[#dce5df]">{c.name}</span>
        {c.unit && <span className="text-xs text-[#859586] ml-2 font-mono">/{c.unit}</span>}
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-bold text-[#dce5df]">${fmtNum(c.price, 2)}</p>
        <p className={`text-xs font-mono ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
          {fmtPct(c.changePercent)}
        </p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-[#19211e] animate-pulse rounded-xl ${className}`} />;
}

// ─── Markets Data Section ─────────────────────────────────────
function MarketsData() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [marketState, setMarketState] = useState<MarketStateData>({
    fiiDii: null, movers: null, constituents: [], isStale: false, scrapedAt: null,
  });
  const [moversData, setMoversData] = useState<MoversData | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(true);
  const [loadingComm, setLoadingComm] = useState(true);
  const [loadingIntel, setLoadingIntel] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [commExpanded, setCommExpanded] = useState(false);
  const COMM_PREVIEW = 4;

  const MARKET_SYMBOLS = 'NIFTY,SENSEX,NIFTYMIDCAP150,NIFTYSMALLCAP100,BANKNIFTY,NIFTYIT,NIFTYNEXT50,NIFTYPHARMA,NIFTYAUTO,NIFTYFMCG,NIFTYMETAL,NIFTYREALTY,NIFTYENERGY';

  // ── Fetch indices ────────────────────────────────────────────
  const fetchIndices = useCallback((showSpinner = false) => {
    if (showSpinner) setLoadingIdx(true);
    fetchWithTimeout(`/api/market-data?symbols=${MARKET_SYMBOLS}`)
      .then(r => r.json())
      .then(mkt => {
        const raw = mkt?.data ?? mkt?.indices ?? [];
        setIndices(Array.isArray(raw) ? raw : []);
        setLastUpdated(new Date().toLocaleTimeString('en-IN'));
      })
      .catch(() => {})
      .finally(() => { if (showSpinner) setLoadingIdx(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshData = useCallback(() => {
    setLoadingIdx(true);
    fetchWithTimeout(`/api/market-data?symbols=${MARKET_SYMBOLS}`)
      .then(r => r.json())
      .then(d => {
        setIndices(d?.data ?? d?.indices ?? []);
        setLastUpdated(new Date().toLocaleTimeString('en-IN'));
      })
      .catch(() => {})
      .finally(() => setLoadingIdx(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Initial full load
    fetchIndices(true);

    // Commodities (once, changes rarely)
    fetchWithTimeout('/api/commodities')
      .then(r => r.json())
      .then(d => {
        const raw = d?.commodities ?? d?.data ?? d ?? [];
        setCommodities(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {})
      .finally(() => setLoadingComm(false));

    // Market Intelligence (FII/DII + movers + constituents — scraper data)
    Promise.allSettled([
      fetchWithTimeout('/api/market-state?key=fii_dii').then(r => r.json()),
      fetchWithTimeout('/api/market-state?key=index_movers_nifty').then(r => r.json()),
      fetchWithTimeout('/api/market-state?key=nifty_constituents').then(r => r.json()),
      fetchWithTimeout('/api/stocks/gainers-losers').then(r => r.json()),
    ]).then(([fiiRes, moversRes, consRes, gainersRes]) => {
      const fiiDii = fiiRes.status === 'fulfilled'
        ? (fiiRes.value?.data?.fii_dii ?? null) : null;
      const movers = moversRes.status === 'fulfilled'
        ? (moversRes.value?.data?.index_movers_nifty ?? null) : null;
      const consData = consRes.status === 'fulfilled'
        ? (consRes.value?.data?.nifty_constituents ?? null) : null;
      const constituents: Constituent[] = consData?.constituents ?? [];
      const staleness = moversRes.status === 'fulfilled'
        ? moversRes.value?.staleness?.index_movers_nifty : null;
      const isStale = !movers || staleness?.is_stale === true;
      const scrapedAt = staleness?.scraped_at ?? null;
      setMarketState({ fiiDii, movers, constituents, isStale, scrapedAt });
      if (gainersRes.status === 'fulfilled') {
        const g = gainersRes.value;
        setMoversData({ gainers: g.gainers ?? [], losers: g.losers ?? [], isLive: g.isLive ?? false, disclaimer: g.disclaimer });
      }
    }).finally(() => setLoadingIntel(false));
  }, [fetchIndices]);

  // Top-4 row: NIFTY 50 | SENSEX | NIFTY MIDCAP 150 | NIFTY SMALLCAP 100
  const KEY_4 = [
    (i: MarketIndex) => /^(nifty\s*50|nifty50|nifty)$/i.test(i.name ?? '') || i.symbol === 'NIFTY',
    (i: MarketIndex) => /^sensex$/i.test(i.name ?? '') || i.symbol === 'SENSEX',
    (i: MarketIndex) => /nifty\s*(mid\s*cap|midcap)/i.test(i.name ?? '') || /MIDCAP150/i.test(i.symbol ?? ''),
    (i: MarketIndex) => /nifty\s*(small\s*cap|smallcap)/i.test(i.name ?? '') || /SMALLCAP/i.test(i.symbol ?? ''),
  ];

  const keyIndices = KEY_4.map(match =>
    indices.find(i => match(i))
  ).filter(Boolean) as MarketIndex[];

  // Remaining indices (not in the key-4 strip)
  const keySet = new Set(keyIndices);
  const mainIndices = indices.filter(i => !keySet.has(i)).slice(0, 8);

  const allIndices = indices.length > 0 ? indices : [];

  return (
    <div className="bg-[#060D0A] pb-16 px-6 md:px-8 max-w-[1440px] mx-auto w-full">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mb-10 pt-8">
        <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-3">
          Markets Today
        </h1>
        <p className="text-[#859586] text-sm mb-4">
          Live Indian market data — indices, commodities, and sector movers
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-xs font-mono text-[#859586]">
              Updated {lastUpdated}
            </span>
          )}
          <button
            onClick={refreshData}
            disabled={loadingIdx}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#3c4a3e] text-[#dce5df] text-xs font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
              className={loadingIdx ? 'animate-spin' : ''}>
              <polyline points="23 4 23 10 17 10"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
          <span className="flex items-center gap-1.5 text-xs font-mono text-[#44f593]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#44f593] animate-pulse" />
            Updates every 15 minutes
          </span>
        </div>
      </header>

      {/* ── Key Indices Strip (NIFTY 50 | SENSEX | MIDCAP | SMALLCAP) ── */}
      <section className="mb-8">
        <h2 className="text-lg font-display font-bold text-[#dce5df] mb-5 flex items-center gap-2">
          <span className="w-1 h-5 bg-[#44f593] rounded-full" />
          Major Indices
        </h2>
        {loadingIdx ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : keyIndices.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {keyIndices.map((idx, i) => <IndexCard key={i} idx={idx} />)}
          </div>
        ) : allIndices.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {allIndices.slice(0, 4).map((idx, i) => <IndexCard key={i} idx={idx} />)}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-8 text-center text-[#859586] text-sm">
            Market data unavailable. Please try refreshing.
          </div>
        )}
      </section>

      {/* ── Sectors & Themes — all non-key indices as cards ── */}
      {!loadingIdx && mainIndices.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-display font-bold text-[#dce5df] mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#44f593] rounded-full" />
            Sectors &amp; Themes
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {indices.filter(i => !new Set(keyIndices).has(i)).map((idx, i) => <IndexCard key={i} idx={idx} />)}
          </div>
        </section>
      )}

      {/* ── Market Intelligence ─────────────────────────── */}
      <section className="mb-12">
        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-bold text-[#dce5df] flex items-center gap-2">
            <span className="w-1 h-5 bg-[#44f593] rounded-full" />
            Market Intelligence
          </h2>
          {marketState.isStale && (
            <span className="flex items-center gap-1.5 text-xs font-mono text-[#ffb800] bg-[#ffb800]/10 border border-[#ffb800]/20 px-2.5 py-1 rounded-full">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Scraper data stale
            </span>
          )}
          {!marketState.isStale && marketState.scrapedAt && (
            <span className="text-xs font-mono text-[#859586]">
              Scraped {new Date(marketState.scrapedAt).toLocaleTimeString('en-IN')}
            </span>
          )}
        </div>

        {loadingIntel ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            {/* ── FII / DII Flow Cards ── */}
            {marketState.fiiDii ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {([
                  { label: 'Foreign Institutional Investors', key: 'fii', abbr: 'FII' },
                  { label: 'Domestic Institutional Investors', key: 'dii', abbr: 'DII' },
                ] as const).map(({ label, key, abbr }) => {
                  const d = marketState.fiiDii![key];
                  const net = d.net_value;
                  const pos = net >= 0;
                  const total = d.buy_value + d.sell_value;
                  const buyPct = total > 0 ? (d.buy_value / total) * 100 : 50;
                  return (
                    <div key={key} className="glass-card rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-1">{abbr}</p>
                          <h3 className="text-sm font-semibold text-[#dce5df]">{label}</h3>
                        </div>
                        <span className={`text-xs font-mono font-bold px-2 py-1 rounded-full ${pos ? 'bg-[#44f593]/10 text-[#44f593]' : 'bg-[#ffb4ab]/10 text-[#ffb4ab]'}`}>
                          {pos ? 'NET BUYER' : 'NET SELLER'}
                        </span>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#44f593] font-mono">Buy {fmtCr(d.buy_value)}</span>
                          <span className="text-[#ffb4ab] font-mono">Sell {fmtCr(d.sell_value)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1e3325] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#44f593] to-[#00c46a] transition-all duration-700"
                            style={{ width: `${buyPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-[#859586] font-mono">
                          <span>{buyPct.toFixed(0)}% buy</span>
                          <span>{(100 - buyPct).toFixed(0)}% sell</span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 pt-3 border-t border-white/5">
                        <span className="text-xs text-[#859586] font-mono uppercase tracking-wide">Net Flow</span>
                        <span className={`text-xl font-mono font-bold ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                          {pos ? '+' : ''}{fmtCr(net)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-6 mb-6 flex items-center gap-3 text-[#859586] text-sm">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Institutional flow data unavailable — scraper may not have run yet.
              </div>
            )}

            {/* ── Nifty 50 Index Movers (weighted by contribution) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {[
                { title: 'Nifty 50 — Top Gainers', items: marketState.movers?.top_gainers?.slice(0, 5) ?? [], positive: true },
                { title: 'Nifty 50 — Top Losers',  items: marketState.movers?.top_losers?.slice(0, 5) ?? [],  positive: false },
              ].map(({ title, items, positive }) => (
                <div key={title} className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#dce5df]">{title}</h3>
                    <span className="text-[11px] font-mono text-[#859586] uppercase tracking-widest">By Contribution</span>
                  </div>
                  {items.length > 0 ? (
                    <div className="space-y-2.5">
                      {items.map((m, i) => {
                        const pct = m.change_pct;
                        const pos = pct >= 0;
                        const contribColor = pos ? 'text-[#44f593]' : 'text-[#ffb4ab]';
                        return (
                          <div key={m.symbol} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                            <span className="text-xs font-mono text-[#3c4a3e] w-4 shrink-0">{i + 1}</span>
                            <span className="text-xs font-mono font-bold text-[#dce5df] w-24 shrink-0">{m.symbol}</span>
                            <div className="flex-1 flex items-center gap-2">
                              <span className={`text-xs font-mono font-bold ${contribColor}`}>
                                {pos ? '+' : ''}{pct.toFixed(2)}%
                              </span>
                              <span className="text-[11px] text-[#859586] font-mono">wt {m.weight.toFixed(2)}%</span>
                            </div>
                            <span className="text-xs font-mono text-[#859586]">
                              {pos ? '+' : ''}{m.contribution.toFixed(4)} pts
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : moversData ? (
                    // Fallback: use gainers-losers API when index_movers unavailable
                    <div className="space-y-2.5">
                      {(positive ? moversData.gainers : moversData.losers).slice(0, 5).map((m, i) => {
                        const pos = m.changePercent >= 0;
                        return (
                          <div key={m.symbol} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                            <span className="text-xs font-mono text-[#3c4a3e] w-4 shrink-0">{i + 1}</span>
                            <span className="text-xs font-mono font-bold text-[#dce5df] w-24 shrink-0">{m.symbol}</span>
                            <span className={`text-xs font-mono font-bold flex-1 ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                              {pos ? '+' : ''}{m.changePercent.toFixed(2)}%
                            </span>
                            <span className="text-xs font-mono text-[#859586]">₹{fmtNum(m.price)}</span>
                          </div>
                        );
                      })}
                      {!moversData.isLive && (
                        <p className="text-[11px] text-[#ffb800] mt-2">⚠ {moversData.disclaimer}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[#859586] text-xs text-center py-4">Data unavailable</p>
                  )}
                </div>
              ))}
            </div>

            {/* ── Nifty 50 Constituent Pills (top 20 movers) ── */}
            {marketState.constituents.length > 0 && marketState.movers && (() => {
              // Build change% map from index movers, then sort all 50 by abs change
              const changeMap = new Map<string, number>();
              [...(marketState.movers!.top_gainers ?? []), ...(marketState.movers!.top_losers ?? [])]
                .forEach(m => changeMap.set(m.symbol, m.change_pct));

              const withChange = marketState.constituents
                .map(c => ({ ...c, changePct: changeMap.get(c.symbol) ?? 0 }))
                .filter(c => changeMap.has(c.symbol))
                .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
                .slice(0, 20);

              if (withChange.length === 0) return null;

              return (
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#dce5df]">Nifty 50 Constituents</h3>
                    <span className="text-[11px] font-mono text-[#859586] uppercase tracking-widest">Top 20 Movers</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {withChange.map(c => {
                      const pos = c.changePct >= 0;
                      return (
                        <span
                          key={c.symbol}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-3 py-1.5 rounded-full border ${
                            pos
                              ? 'bg-[#44f593]/8 border-[#44f593]/20 text-[#44f593]'
                              : 'bg-[#ffb4ab]/8 border-[#ffb4ab]/20 text-[#ffb4ab]'
                          }`}
                        >
                          {c.symbol}
                          <span className="font-normal opacity-80">
                            {pos ? '+' : ''}{c.changePct.toFixed(2)}%
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </section>

      {/* ── Commodities ─────────────────────────────────── */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${commExpanded ? 'items-start' : 'items-stretch'}`}>
        <section className="flex flex-col">
          <h2 className="text-lg font-display font-bold text-[#dce5df] mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#44f593] rounded-full" />
            Global Commodities
          </h2>
          <div className="glass-card rounded-2xl p-5 flex-1 flex flex-col">
            {loadingComm ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : commodities.length > 0 ? (
              <>
                <div className="flex-1">
                  {(commExpanded ? commodities : commodities.slice(0, COMM_PREVIEW)).map((c, i) => (
                    <CommodityRow key={i} c={c} />
                  ))}
                </div>
                {commodities.length > COMM_PREVIEW && (
                  <button
                    onClick={() => setCommExpanded(v => !v)}
                    className="w-full mt-3 p-4 rounded-xl bg-[#44f593]/5 border border-[#44f593]/20 text-[#44f593] text-sm font-bold hover:bg-[#44f593]/10 hover:border-[#44f593]/35 transition-all flex items-center justify-center gap-2"
                  >
                    <span>{commExpanded ? 'Show Less' : `Show More (${commodities.length - COMM_PREVIEW} more)`}</span>
                    <span
                      className="material-symbols-outlined text-base transition-transform duration-300"
                      style={{ transform: commExpanded ? 'rotate(180deg)' : 'rotate(0deg)', fontVariationSettings: "'FILL' 0" }}
                    >
                      expand_more
                    </span>
                  </button>
                )}
              </>
            ) : (
              <p className="text-[#859586] text-sm text-center py-6">Commodity data unavailable.</p>
            )}
          </div>
        </section>

        <section className="flex flex-col">
          <h2 className="text-lg font-display font-bold text-[#dce5df] mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#44f593] rounded-full" />
            Market Status
          </h2>
          <div className="glass-card rounded-2xl p-6 space-y-4 flex-1">
            {[
              { market: 'NSE / BSE', hours: '9:15 AM – 3:30 PM', timezone: 'IST', days: 'Mon–Fri' },
              { market: 'MCX Commodity', hours: '9:00 AM – 11:30 PM', timezone: 'IST', days: 'Mon–Fri' },
              { market: 'Gift Nifty', hours: '6:30 AM – 11:30 PM', timezone: 'IST', days: 'Mon–Fri' },
            ].map(m => (
              <div key={m.market} className="flex items-center justify-between p-4 rounded-xl bg-[#161d1a]/50">
                <div>
                  <p className="font-semibold text-sm text-[#dce5df]">{m.market}</p>
                  <p className="text-xs text-[#859586] mt-0.5">{m.days}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-[#dce5df]">{m.hours}</p>
                  <p className="text-xs text-[#859586]">{m.timezone}</p>
                </div>
              </div>
            ))}
            <div className="p-4 rounded-xl bg-[#44f593]/5 border border-[#44f593]/20 flex items-center gap-3">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <div>
                <p className="text-xs font-bold text-[#44f593]">Data Source</p>
                <p className="text-xs text-[#859586]">NSE · Yahoo Finance · AMFI — via Cloudflare relay</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Fuel Prices Section ──────────────────────────────────────
type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

interface FuelData {
  state: string;
  city: string;
  nearestCityKm: number | null;
  priceSource: string;
  petrolPrice: number;
  dieselPrice: number;
  petrolChange: number;
  dieselChange: number;
  cngPrice: number | null;
  summary: {
    petrol: { retailPrice: number; totalTaxPercent: number; centralTaxPercent: number; stateTaxPercent: number };
    diesel: { retailPrice: number; totalTaxPercent: number; centralTaxPercent: number; stateTaxPercent: number };
  };
  lastUpdated: string;
}

function FuelPriceBar({ label, price, basePercent, centralPercent, statePercent }: {
  label: string; price: number; basePercent: number; centralPercent: number; statePercent: number;
}) {
  const totalTax = centralPercent + statePercent;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-mono text-[#859586] uppercase tracking-widest">{label}</span>
        <span className="text-2xl font-mono font-bold text-[#dce5df]">₹{price.toFixed(1)}/L</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2">
        <div className="bg-[#44f593]/70 rounded-l-full" style={{ width: `${basePercent}%` }} />
        <div className="bg-amber-400/70" style={{ width: `${centralPercent}%` }} />
        <div className="bg-[#ffb4ab]/70 rounded-r-full" style={{ width: `${statePercent}%` }} />
      </div>
      <div className="flex items-center gap-4 text-xs font-mono text-[#859586]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#44f593]/70 inline-block" />Base {(100 - totalTax).toFixed(0)}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400/70 inline-block" />Central {centralPercent.toFixed(0)}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ffb4ab]/70 inline-block" />State {statePercent.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function FuelSection() {
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [fuelData, setFuelData] = useState<FuelData | null>(null);
  const [loadingFuel, setLoadingFuel] = useState(false);
  const [fuelError, setFuelError] = useState('');

  const fetchFuelByCoords = useCallback((lat: number, lng: number) => {
    setLoadingFuel(true);
    setFuelError('');
    fetch(`/api/fuel-prices?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setFuelData(d);
        else setFuelError(d.error ?? 'Could not load fuel prices.');
      })
      .catch(() => setFuelError('Network error loading fuel prices.'))
      .finally(() => setLoadingFuel(false));
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setFuelError('Geolocation not supported by this browser.');
      return;
    }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocationStatus('granted');
        fetchFuelByCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocationStatus('denied');
        // Fall back to Delhi
        fetch('/api/fuel-prices?state=Delhi')
          .then(r => r.json())
          .then(d => { if (d.success) setFuelData(d); })
          .catch(() => {})
          .finally(() => setLoadingFuel(false));
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, [fetchFuelByCoords]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  const chgColor = (v: number) => v > 0 ? 'text-[#ffb4ab]' : v < 0 ? 'text-[#44f593]' : 'text-[#859586]';
  const chgSign  = (v: number) => v > 0 ? `+₹${v.toFixed(2)}` : v < 0 ? `-₹${Math.abs(v).toFixed(2)}` : '0';

  return (
    <section className="px-6 md:px-8 max-w-[1440px] mx-auto w-full mb-12">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-lg font-display font-bold text-[#dce5df] flex items-center gap-2">
          <span className="w-1 h-5 bg-[#44f593] rounded-full" />
          Fuel Prices Today
        </h2>
        {fuelData && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-[#44f593] text-xs font-mono">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {fuelData.city}
            {locationStatus === 'denied' && <span className="text-[#859586]"> · Delhi (default)</span>}
            {fuelData.nearestCityKm != null && fuelData.nearestCityKm > 0 && (
              <span className="text-[#859586]"> · ~{fuelData.nearestCityKm} km</span>
            )}
          </span>
        )}
      </div>

      {/* Location permission prompt */}
      {locationStatus === 'idle' && !fuelData && (
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#44f593" strokeWidth="1.75">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <p className="text-sm text-[#859586] text-center max-w-xs">
            Allow location access to see fuel prices for your nearest city.
          </p>
          <button onClick={requestLocation}
            className="px-5 py-2.5 bg-[#44f593] text-[#001f10] rounded-xl font-bold text-sm hover:bg-[#25e283] transition-colors">
            Allow Location
          </button>
        </div>
      )}

      {/* Loading */}
      {(loadingFuel || locationStatus === 'requesting') && !fuelData && (
        <div className="glass-card rounded-2xl p-8 flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-[#44f593]/30 border-t-[#44f593] rounded-full animate-spin" />
          <span className="text-[#859586] text-sm">Detecting location…</span>
        </div>
      )}

      {/* Error */}
      {fuelError && !fuelData && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-[#859586] text-sm">{fuelError}</p>
        </div>
      )}

      {/* Fuel data */}
      {fuelData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Petrol */}
          <div className="glass-card rounded-2xl p-5 col-span-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-[#859586] uppercase tracking-widest">Petrol</span>
              {fuelData.petrolChange !== 0 && (
                <span className={`text-xs font-mono font-bold ${chgColor(fuelData.petrolChange)}`}>
                  {chgSign(fuelData.petrolChange)} today
                </span>
              )}
            </div>
            <FuelPriceBar
              label=""
              price={fuelData.petrolPrice}
              basePercent={100 - fuelData.summary.petrol.totalTaxPercent}
              centralPercent={fuelData.summary.petrol.centralTaxPercent}
              statePercent={fuelData.summary.petrol.stateTaxPercent}
            />
          </div>

          {/* Diesel */}
          <div className="glass-card rounded-2xl p-5 col-span-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-[#859586] uppercase tracking-widest">Diesel</span>
              {fuelData.dieselChange !== 0 && (
                <span className={`text-xs font-mono font-bold ${chgColor(fuelData.dieselChange)}`}>
                  {chgSign(fuelData.dieselChange)} today
                </span>
              )}
            </div>
            <FuelPriceBar
              label=""
              price={fuelData.dieselPrice}
              basePercent={100 - fuelData.summary.diesel.totalTaxPercent}
              centralPercent={fuelData.summary.diesel.centralTaxPercent}
              statePercent={fuelData.summary.diesel.stateTaxPercent}
            />
          </div>

          {/* CNG + meta */}
          <div className="glass-card rounded-2xl p-5 col-span-1 flex flex-col justify-between">
            {fuelData.cngPrice ? (
              <div>
                <span className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-4">CNG</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold text-[#dce5df]">₹{fuelData.cngPrice.toFixed(1)}</span>
                  <span className="text-xs text-[#859586]">/kg</span>
                </div>
                <p className="text-xs text-[#859586] mt-2">Compressed Natural Gas · {fuelData.state}</p>
              </div>
            ) : (
              <div>
                <span className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-4">CNG</span>
                <p className="text-sm text-[#3c4a3e]">Not available in {fuelData.state}</p>
              </div>
            )}
            <div className="mt-auto pt-4 border-t border-white/5">
              <p className="text-[11px] font-mono text-[#3c4a3e] uppercase tracking-widest">
                {locationStatus === 'denied' ? 'Default location (Delhi)' : `Nearest: ${fuelData.city}`} · Updated {new Date(fuelData.lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </p>
              {locationStatus === 'denied' && (
                <button
                  onClick={requestLocation}
                  className="mt-2 text-xs text-[#44f593]/70 hover:text-[#44f593] transition-colors font-mono"
                >
                  Enable location →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Portfolio CAS Gate (authenticated users) ─────────────────
// Data source: /api/portfolio/summary — same endpoint as dashboard.
// All values here must match the dashboard exactly.
function PortfolioGateSection() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Mirror all fields from /api/portfolio/summary so values match dashboard
  const [holdingsCount,  setHoldingsCount]  = useState<number | null>(null);
  const [currentValue,   setCurrentValue]   = useState<number | null>(null);
  const [totalInvested,  setTotalInvested]  = useState<number | null>(null);
  const [totalReturns,   setTotalReturns]   = useState<number | null>(null);
  const [returnsPct,     setReturnsPct]     = useState<number | null>(null);
  const [oldestNavDate,  setOldestNavDate]  = useState<string | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [showCAS, setShowCAS] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingPortfolio(true);
    fetch('/api/portfolio/summary')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.success) {
          const s = d.summary;
          setHoldingsCount(s.holdingsCount  ?? 0);
          setCurrentValue(s.currentValue    ?? null);
          setTotalInvested(s.totalInvested  ?? null);
          setTotalReturns(s.totalReturns    ?? null);
          setReturnsPct(s.returnsPercentage ?? null);
          setOldestNavDate(s.oldestNavDate  ?? null);
        } else {
          setHoldingsCount(0);
        }
      })
      .catch(() => { setHoldingsCount(0); })
      .finally(() => setLoadingPortfolio(false));
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated || !user) return null;

  const hasCAS   = (holdingsCount ?? 0) > 0;
  const showGate = !loadingPortfolio && holdingsCount === 0;
  const isPos    = (returnsPct ?? 0) >= 0;

  const fmtINR = (n: number) => {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
    if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  };

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-8 mt-6 mb-2">
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ background: '#161d1a', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Loading shimmer */}
        {loadingPortfolio && (
          <div className="flex items-center gap-4 px-6 py-5">
            {[140, 100, 100, 80].map((w, i) => (
              <div key={i} className="h-8 rounded-lg bg-[#19211e] animate-pulse" style={{ width: w }} />
            ))}
          </div>
        )}

        {/* Blur gate — no CAS uploaded */}
        {showGate && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl"
            style={{ backdropFilter: 'blur(10px)', background: 'rgba(6,13,10,0.80)' }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(68,245,147,0.08)', border: '1px solid rgba(68,245,147,0.2)' }}
            >
              <span className="material-symbols-outlined text-2xl text-[#44f593]" style={{ fontVariationSettings: "'FILL' 0" }}>
                upload_file
              </span>
            </div>
            <div className="text-center px-6">
              <p className="font-['Space_Grotesk'] font-bold text-[#dce5df] text-base mb-1">Your portfolio awaits</p>
              <p className="text-[#859586] text-xs max-w-xs">Import your CAS from CAMS or KFintech to see your live portfolio value here.</p>
            </div>
            <button
              onClick={() => setShowCAS(true)}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-[#00391c] transition-all active:scale-95"
              style={{ background: 'linear-gradient(to right, #44f593, #00d87a)', boxShadow: '0 0 20px rgba(68,245,147,0.2)' }}
            >
              Import CAS
            </button>
          </div>
        )}

        {/* Portfolio summary strip — mirrors dashboard exactly */}
        {!loadingPortfolio && (
          <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4 ${hasCAS ? '' : 'opacity-20 pointer-events-none select-none'}`}>

            {/* Net Worth */}
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#44f593] text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>
                account_balance_wallet
              </span>
              <div>
                <p className="text-xs text-[#859586] uppercase tracking-widest">Net Worth</p>
                <p className="font-['Space_Grotesk'] font-bold text-[#dce5df] text-lg leading-tight">
                  {currentValue != null ? fmtINR(currentValue) : '₹—'}
                </p>
              </div>
            </div>

            <div className="w-px h-10 bg-white/5" />

            {/* Invested */}
            <div>
              <p className="text-xs text-[#859586] uppercase tracking-widest">Invested</p>
              <p className="font-['Space_Grotesk'] font-bold text-[#dce5df] text-base leading-tight">
                {totalInvested != null ? fmtINR(totalInvested) : '—'}
              </p>
            </div>

            <div className="w-px h-10 bg-white/5" />

            {/* Total Returns */}
            <div>
              <p className="text-xs text-[#859586] uppercase tracking-widest">Total Returns</p>
              <div className="flex items-baseline gap-2">
                <p className={`font-['Space_Grotesk'] font-bold text-base leading-tight ${isPos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                  {totalReturns != null ? `${isPos ? '+' : ''}${fmtINR(totalReturns)}` : '—'}
                </p>
                {returnsPct != null && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isPos ? 'bg-[#44f593]/10 text-[#44f593]' : 'bg-[#ffb4ab]/10 text-[#ffb4ab]'}`}>
                    {isPos ? '+' : ''}{returnsPct.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            <div className="w-px h-10 bg-white/5" />

            {/* Holdings */}
            <div>
              <p className="text-xs text-[#859586] uppercase tracking-widest">Holdings</p>
              <p className="font-['Space_Grotesk'] font-bold text-[#dce5df] text-base leading-tight">
                {holdingsCount != null ? `${holdingsCount} funds` : '—'}
              </p>
            </div>

            {/* NAV date + Dashboard link */}
            {hasCAS && (
              <>
                <div className="w-px h-10 bg-white/5 hidden lg:block" />
                {oldestNavDate && (
                  <p className="text-xs text-[#3c4a3e] hidden lg:block">
                    NAV as of {oldestNavDate}
                  </p>
                )}
                <a
                  href="/dashboard"
                  className="ml-auto flex items-center gap-1 text-xs font-bold text-[#44f593] hover:underline"
                >
                  Open Dashboard
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_forward</span>
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {/* CAS Uploader Modal */}
      {showCAS && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(6,13,10,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div className="relative w-full max-w-2xl">
            <button
              onClick={() => setShowCAS(false)}
              className="absolute -top-4 -right-4 z-10 w-9 h-9 rounded-full bg-[#161d1a] border border-white/10 flex items-center justify-center text-[#859586] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
            <CASUploader
              onImportComplete={() => {
                setShowCAS(false);
                // Refresh portfolio data without full page reload
                setLoadingPortfolio(true);
                fetch('/api/portfolio/summary')
                  .then(r => r.ok ? r.json() : null)
                  .then(d => {
                    if (d?.success) {
                      setHoldingsCount(d.summary.holdingsCount ?? 0);
                      setPortfolioValue(d.summary.currentValue ?? null);
                      setPortfolioPct(d.summary.returnsPercentage ?? null);
                    }
                  })
                  .catch(() => {})
                  .finally(() => setLoadingPortfolio(false));
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function MarketsPage() {
  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36">
        {/* ① Hero */}
        <HeroSection />

        {/* ② Portfolio gate — authenticated users: shows portfolio strip or CAS import prompt */}
        <PortfolioGateSection />

        {/* ③ Stats banner */}
        <StatsBanner />

        {/* ④ Markets data (indices, intelligence, commodities) */}
        <MarketsData />

        {/* ⑤ Fuel prices — location-aware, DB-cached */}
        <FuelSection />

        {/* ⑦ Institutional Funds + NFO sidebar */}
        <TopFundsSection />

        {/* ⑧ Investment Guides — internal links to /learn */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <h2 className="text-lg font-display font-bold text-[#dce5df] mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#44f593] rounded-full" />
            Investment Guides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Best ELSS Tax Saving Funds 2026-27', href: '/learn/best-elss-tax-saving-funds', tag: 'Tax Planning' },
              { title: 'Direct vs Regular Mutual Funds — Why It Matters', href: '/learn/direct-vs-regular-mutual-funds', tag: 'Basics' },
              { title: 'LTCG Tax on Mutual Funds 2026', href: '/learn/ltcg-tax-on-mutual-funds', tag: 'Tax Planning' },
              { title: 'SWP Calculator — How Long Will Your Corpus Last?', href: '/learn/swp-calculator-guide', tag: 'Calculators' },
              { title: 'What is STP in Mutual Funds?', href: '/learn/what-is-stp-in-mutual-funds', tag: 'Basics' },
              { title: 'View All Guides →', href: '/learn', tag: 'Learn' },
            ].map(g => (
              <Link key={g.href} href={g.href} className="glass-card-vi rounded-xl p-4 hover:border-[#44f593]/30 transition-all group block">
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#44f593] mb-1 block">{g.tag}</span>
                <span className="text-sm text-[#dce5df] font-medium group-hover:text-[#44f593] transition-colors line-clamp-2">{g.title}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ⑨ Strategic Insights bento */}
        <VaultIntelligence />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <ComplianceDisclaimer variant="markets" className="mt-8" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
