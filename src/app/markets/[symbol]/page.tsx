'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

// ─── Types ───────────────────────────────────────────────────
interface IndexData {
  symbol: string; name: string; price: number; change: number;
  changePercent: number; exchange: string; isMarketOpen: boolean;
}
interface Candle { timestamp: number; date: string; open: number; high: number; low: number; close: number; volume: number; }
interface Signal { indicator: string; signal: string; value: string; description: string; }
interface ChartData {
  currentPrice: number; previousClose: number | null;
  dayChange: number | null; dayChangePercent: number | null;
  fiftyTwoWeekHigh: number; fiftyTwoWeekLow: number;
  candles: Candle[];
  technicals: { dma: { dma50: number | null; dma100: number | null; dma200: number | null }; rsi: number | null; macd: { macd: number | null; signal: number | null; histogram: number | null } };
  signals: Signal[];
  outlook: { overall: string; strength: number; summary: string };
}
interface Mover { symbol: string; change_pct: number; weight: number; contribution: number; last_price: number; }
interface FiiDii { fii: { net_value: number }; dii: { net_value: number }; }

// ─── Helpers ─────────────────────────────────────────────────
function fmt(n?: number | null, d = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: d });
}
function fmtPct(n?: number | null): string {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const RANGES = ['1D', '1W', '1M', '3M', '6M', '1Y'] as const;

// ─── SVG Line Chart ──────────────────────────────────────────
function PriceChart({ candles, positive }: { candles: Candle[]; positive: boolean }) {
  if (!candles.length) return <div className="h-full flex items-center justify-center text-[#859586] text-sm">No chart data available</div>;
  const W = 1000, H = 400;
  const prices = candles.map(c => c.close);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((p - min) / range) * H * 0.9 - H * 0.05;
    return `${x},${y}`;
  }).join(' ');
  const color = positive ? '#44f593' : '#ffb4ab';
  return (
    <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${points} ${W},${H}`} fill="url(#areaFill)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Metric Tile ─────────────────────────────────────────────
function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#161d1a] p-4 md:p-5 rounded-2xl border border-white/5">
      <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-2 font-bold">{label}</p>
      <p className={`text-base md:text-lg font-['JetBrains_Mono'] font-medium ${color || 'text-[#dce5df]'}`}>{value}</p>
    </div>
  );
}

// ─── Signal Badge ────────────────────────────────────────────
function Badge({ signal }: { signal: string }) {
  const s = signal.toLowerCase();
  const cls = s.includes('bullish') || s.includes('buy') ? 'bg-[#44f593]/10 text-[#44f593]'
    : s.includes('bearish') || s.includes('sell') ? 'bg-[#ffb4ab]/10 text-[#ffb4ab]'
    : 'bg-[#2f3733] text-[#859586]';
  return <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${cls}`}>{signal}</span>;
}

// ─── Pulse Gauge ─────────────────────────────────────────────
function PulseGauge({ strength, overall }: { strength: number; overall: string }) {
  const bullish = overall.toLowerCase().includes('bullish');
  const color = bullish ? '#44f593' : overall.toLowerCase().includes('bearish') ? '#ffb4ab' : '#859586';
  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="w-28 h-28 rounded-full border-[8px] border-[#2f3733] flex items-center justify-center relative">
        <div className="absolute inset-0 rounded-full border-[8px] border-t-transparent border-l-transparent" style={{ borderColor: `${color} transparent transparent ${color}`, transform: `rotate(${45 + (strength / 100) * 180}deg)` }} />
        <div className="text-center">
          <p className="text-2xl font-['JetBrains_Mono'] font-bold" style={{ color }}>{strength}%</p>
          <p className="text-[9px] text-[#859586] uppercase font-bold">{overall}</p>
        </div>
      </div>
      <div className="flex justify-between w-full text-[9px] font-bold text-[#859586] mt-3 px-2">
        <span>EXTREME FEAR</span>
        <span>GREED</span>
      </div>
    </div>
  );
}

// ─── Sector Heatmap ──────────────────────────────────────────
function SectorHeatmap({ sectors }: { sectors: { name: string; change: number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {sectors.map(s => {
        const pos = s.change >= 0;
        return (
          <div key={s.name} className={`${pos ? 'bg-[#44f593]/10 border-[#44f593]/20' : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/20'} border rounded-xl p-3 md:p-4`}>
            <span className="text-xs font-bold text-[#dce5df]">{s.name}</span>
            <p className={`text-lg md:text-xl font-['JetBrains_Mono'] font-bold mt-1 ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
              {pos ? '+' : ''}{s.change.toFixed(1)}%
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────
export default function IndexDetailPage() {
  const params = useParams();
  const symbol = (typeof params.symbol === 'string' ? params.symbol : '').toUpperCase();

  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [fiiDii, setFiiDii] = useState<FiiDii | null>(null);
  const [movers, setMovers] = useState<{ top_gainers: Mover[]; top_losers: Mover[] } | null>(null);
  const [sectorData, setSectorData] = useState<{ name: string; change: number }[]>([]);
  const [range, setRange] = useState<string>('1D');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  // Fetch index data + market state on mount
  useEffect(() => {
    if (!symbol) return;
    Promise.all([
      fetch(`/api/market-data?symbols=${symbol}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/market-data/chart?symbol=${symbol}&range=1D`).then(r => r.ok ? r.json() : null),
      fetch('/api/market-state?key=all').then(r => r.ok ? r.json() : null),
      fetch('/api/market-data?symbols=BANKNIFTY,NIFTYIT,NIFTYMETAL,NIFTYPHARMA,NIFTYENERGY,NIFTYFMCG').then(r => r.ok ? r.json() : null),
    ]).then(([mkt, chartRes, state, sectorRes]) => {
      if (mkt?.data?.[0]) setIndexData(mkt.data[0]);
      if (chartRes?.success) setChart(chartRes);
      if (state?.data) {
        if (state.data.fii_dii) setFiiDii(state.data.fii_dii);
        if (state.data.index_movers_nifty) setMovers(state.data.index_movers_nifty);
      }
      if (sectorRes?.data) {
        setSectorData(sectorRes.data.map((d: any) => ({ name: (d.name || d.symbol || '').replace('NIFTY ', '').replace('NIFTY', ''), change: d.changePercent ?? 0 })).filter((s: any) => s.name));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [symbol]);

  // Fetch chart on range change
  const fetchChart = useCallback((r: string) => {
    setRange(r);
    setChartLoading(true);
    fetch(`/api/market-data/chart?symbol=${symbol}&range=${r}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.success) setChart(data); })
      .catch(() => {})
      .finally(() => setChartLoading(false));
  }, [symbol]);

  if (loading) return (
    <div className="bg-[#060D0A] min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[#1F2B24] border-t-[#00D87A] animate-spin" />
    </div>
  );

  const pos = (indexData?.changePercent ?? 0) >= 0;
  const name = indexData?.name ?? symbol;
  const price = indexData?.price ?? chart?.currentPrice ?? 0;
  const change = indexData?.change ?? chart?.dayChange ?? 0;
  const changePct = indexData?.changePercent ?? chart?.dayChangePercent ?? 0;
  const exchange = indexData?.exchange ?? 'NSE';

  // OHLC from latest candle
  const lastCandle = chart?.candles?.[chart.candles.length - 1];
  const firstCandle = chart?.candles?.[0];

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-28 md:pt-36 pb-20 px-4 md:px-6 lg:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-sm text-[#859586] mb-6">
          <Link href="/markets" className="hover:text-[#44f593] transition-colors">Markets</Link>
          <span>/</span>
          <span className="text-[#dce5df]">{name}</span>
        </div>

        {/* ── Hero ── */}
        <section className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-[#2f3733] px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] tracking-widest text-[#44f593] uppercase">{exchange} Index</span>
                <span className="text-[#859586] text-sm font-medium">INDEX{exchange}: {symbol}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold font-['Space_Grotesk'] text-[#dce5df] tracking-tighter mb-3">{name}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-3xl md:text-5xl font-['JetBrains_Mono'] font-medium text-[#dce5df] tracking-tight">₹{fmt(price, 2)}</span>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${pos ? 'bg-[#44f593]/10 border-[#44f593]/20' : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/20'}`}>
                  <span className="material-symbols-outlined text-lg" style={{ color: pos ? '#44f593' : '#ffb4ab', fontVariationSettings: "'FILL' 1" }}>
                    {pos ? 'arrow_drop_up' : 'arrow_drop_down'}
                  </span>
                  <span className={`font-['JetBrains_Mono'] font-bold text-sm ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                    {pos ? '+' : ''}{fmt(change, 2)} ({fmtPct(changePct)})
                  </span>
                </div>
              </div>
            </div>
            <Link href="/markets" className="flex items-center gap-2 px-4 py-2 bg-[#161d1a] border border-white/10 rounded-xl hover:border-[#44f593]/30 transition-all text-sm font-medium text-[#859586] hover:text-[#44f593]">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to Markets
            </Link>
          </div>

          {/* ── Chart ── */}
          <div className="glass-card-vi rounded-2xl overflow-hidden p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex bg-[#08100d] p-1 rounded-xl">
                {RANGES.map(r => (
                  <button key={r} onClick={() => fetchChart(r)}
                    className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${range === r ? 'text-[#44f593] bg-[#44f593]/10' : 'text-[#859586] hover:text-[#dce5df]'}`}>
                    {r}
                  </button>
                ))}
              </div>
              {chart?.technicals && (
                <div className="flex items-center gap-4 flex-wrap">
                  {chart.technicals.rsi != null && (
                    <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono']">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#44f593]/40" />
                      <span className="text-[#859586]">RSI(14): {chart.technicals.rsi.toFixed(1)}</span>
                    </div>
                  )}
                  {chart.technicals.dma.dma50 != null && (
                    <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono']">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400/40" />
                      <span className="text-[#859586]">EMA(50): {fmt(chart.technicals.dma.dma50, 0)}</span>
                    </div>
                  )}
                  {chart.technicals.dma.dma200 != null && (
                    <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono']">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400/40" />
                      <span className="text-[#859586]">EMA(200): {fmt(chart.technicals.dma.dma200, 0)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative h-64 md:h-96 w-full">
              {chartLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[#1F2B24] border-t-[#00D87A] animate-spin" />
                </div>
              ) : chart?.candles ? (
                <>
                  <PriceChart candles={chart.candles} positive={pos} />
                  {lastCandle && (
                    <div className="absolute top-3 left-3 flex flex-col gap-0.5 pointer-events-none">
                      <span className="text-[11px] font-['JetBrains_Mono'] text-[#859586]">O: {fmt(firstCandle?.open ?? lastCandle.open, 2)}</span>
                      <span className="text-[11px] font-['JetBrains_Mono'] text-[#44f593]">H: {fmt(Math.max(...chart.candles.map(c => c.high)), 2)}</span>
                      <span className="text-[11px] font-['JetBrains_Mono'] text-[#ffb4ab]">L: {fmt(Math.min(...chart.candles.map(c => c.low)), 2)}</span>
                      <span className="text-[11px] font-['JetBrains_Mono'] text-[#859586]">C: {fmt(lastCandle.close, 2)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[#859586] text-sm">Chart data unavailable</div>
              )}
            </div>
            <p className="text-[10px] text-[#859586] mt-3 text-center">Data is for informational purposes only. Not investment advice.</p>
          </div>
        </section>

        {/* ── Bento Metrics Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
          {/* 8 metric tiles in 2×4 */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            <Tile label="Open" value={fmt(lastCandle?.open ?? firstCandle?.open, 2)} />
            <Tile label="Prev. Close" value={fmt(chart?.previousClose, 2)} />
            <Tile label="Day High" value={fmt(lastCandle ? Math.max(...chart!.candles.map(c => c.high)) : null, 2)} color="text-[#44f593]" />
            <Tile label="Day Low" value={fmt(lastCandle ? Math.min(...chart!.candles.map(c => c.low)) : null, 2)} color="text-[#ffb4ab]" />
            <Tile label="52W High" value={fmt(chart?.fiftyTwoWeekHigh, 2)} />
            <Tile label="52W Low" value={fmt(chart?.fiftyTwoWeekLow, 2)} />
            <Tile label="PE Ratio" value="—" />
            <Tile label="PB Ratio" value="—" />
          </div>

          {/* Market Pulse */}
          <div className="bg-[#161d1a] p-4 md:p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div>
              <h3 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Market Pulse</h3>
              <p className="text-xs text-[#859586] mb-4">Aggregate sentiment analysis</p>
            </div>
            {chart?.outlook ? (
              <PulseGauge strength={chart.outlook.strength} overall={chart.outlook.overall} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#859586] text-sm">—</div>
            )}
          </div>

          {/* Constituent Power */}
          <div className="bg-[#161d1a] p-4 md:p-6 rounded-2xl border border-white/5">
            <h3 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Constituent Power</h3>
            {movers?.top_gainers?.length ? (
              <div className="space-y-4">
                {[...movers.top_gainers.slice(0, 2), ...movers.top_losers?.slice(0, 1) ?? []].map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#2f3733] flex items-center justify-center text-[10px] font-bold">
                        {m.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#dce5df]">{m.symbol}</p>
                        <p className="text-[10px] text-[#859586]">Weight: {m.weight?.toFixed(1)}%</p>
                      </div>
                    </div>
                    <p className={`text-sm font-['JetBrains_Mono'] ${m.change_pct >= 0 ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                      {m.change_pct >= 0 ? '+' : ''}{m.change_pct?.toFixed(2)}%
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#859586]">Constituent data available for Nifty 50 only.</p>
            )}
          </div>
        </div>

        {/* ── Institutional Analytics + Sector Heatmap ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 mb-8">
          {/* Technical Signals + FII/DII */}
          <div className="xl:col-span-2 glass-card-vi rounded-2xl p-4 md:p-6">
            <h3 className="font-['Space_Grotesk'] font-bold text-xl mb-6">Institutional Analytics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              {/* Trend Indicators */}
              <div>
                <h4 className="text-xs text-[#859586] font-bold uppercase tracking-widest mb-5">Trend Indicators</h4>
                <div className="space-y-5">
                  {(chart?.signals ?? []).slice(0, 4).map((s, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#dce5df]">{s.indicator}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-['JetBrains_Mono'] text-[#859586]">{s.value}</span>
                        <Badge signal={s.signal} />
                      </div>
                    </div>
                  ))}
                  {(!chart?.signals || chart.signals.length === 0) && (
                    <p className="text-sm text-[#859586]">Technical signals unavailable for this range.</p>
                  )}
                </div>
              </div>

              {/* FII/DII + Verdict */}
              <div>
                <h4 className="text-xs text-[#859586] font-bold uppercase tracking-widest mb-5">
                  FII / DII Net Activity <span className="ml-2 text-[10px] normal-case font-normal">(Cr.)</span>
                </h4>
                {fiiDii ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[#dce5df]">Foreign Institutional (FII)</span>
                        <span className={`font-['JetBrains_Mono'] ${fiiDii.fii.net_value >= 0 ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                          {fiiDii.fii.net_value >= 0 ? '+' : ''}{fmt(fiiDii.fii.net_value, 2)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#2f3733] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${fiiDii.fii.net_value >= 0 ? 'bg-[#44f593]' : 'bg-[#ffb4ab]'}`}
                          style={{ width: `${Math.min(100, Math.abs(fiiDii.fii.net_value) / 30)}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[#dce5df]">Domestic Institutional (DII)</span>
                        <span className={`font-['JetBrains_Mono'] ${fiiDii.dii.net_value >= 0 ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                          {fiiDii.dii.net_value >= 0 ? '+' : ''}{fmt(fiiDii.dii.net_value, 2)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#2f3733] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${fiiDii.dii.net_value >= 0 ? 'bg-[#44f593]' : 'bg-[#ffb4ab]'}`}
                          style={{ width: `${Math.min(100, Math.abs(fiiDii.dii.net_value) / 30)}%` }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#859586]">FII/DII data unavailable.</p>
                )}

                {/* Analyst Verdict */}
                {chart?.outlook?.summary && (
                  <div className="mt-6 p-4 bg-[#08100d] rounded-xl border border-white/5">
                    <p className="text-[10px] text-[#859586] mb-1 uppercase font-bold">Analyst Verdict</p>
                    <p className="text-sm font-medium text-[#dce5df] leading-relaxed">{chart.outlook.summary}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sector Heatmap */}
          <div className="bg-[#161d1a] rounded-2xl p-4 md:p-6 border border-white/5">
            <h3 className="font-['Space_Grotesk'] font-bold text-xl mb-6">Sector Heatmap</h3>
            {sectorData.length > 0 ? (
              <SectorHeatmap sectors={sectorData} />
            ) : (
              <p className="text-sm text-[#859586]">Sector data loading...</p>
            )}
          </div>
        </div>

        <ComplianceDisclaimer variant="markets" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
