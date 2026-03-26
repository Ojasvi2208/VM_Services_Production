'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';

// ─── Types ────────────────────────────────────────────────────
interface Sector {
  id: string;
  sectorName: string;
  displayName: string;
  colorHex: string;
  fundCount: number;
  maxWeight: number;
}

interface SectorDna {
  sector: string;
  sectorName: string;
  weight: number;
  colorHex: string;
}

interface Fund {
  schemeCode: string;
  schemeName: string;
  category: string;
  subCategory: string;
  nav: number;
  fundSize: number;
  expenseRatio: number;
  exitLoad: number;
  minSip: number;
  inceptionDate: string;
  riskLevel: string;
  cagr1Y: number;
  cagr3Y: number;
  cagr5Y: number;
  sharpeRatio1y: number;
  volatility1y: number;
  sectorDna: SectorDna[] | null;
}

// ─── Category / Sub-category map ──────────────────────────────
const CATEGORY_MAP: Record<string, string[]> = {
  Equity: [
    'Large Cap', 'Mid Cap', 'Small Cap', 'Multi Cap', 'Large & Mid Cap',
    'Flexi Cap', 'ELSS', 'Value', 'Contra', 'Focused',
    'Dividend Yield', 'Sectoral/Thematic',
  ],
  Debt: [
    'Liquid', 'Ultra Short Duration', 'Low Duration', 'Short Duration',
    'Medium Duration', 'Medium to Long Duration', 'Long Duration',
    'Dynamic Bond', 'Corporate Bond', 'Banking and PSU',
    'Gilt', 'Money Market', 'Overnight', 'Credit Risk', 'Floater',
  ],
  Hybrid: [
    'Aggressive Hybrid', 'Conservative Hybrid', 'Balanced Advantage',
    'Multi Asset Allocation', 'Equity Savings', 'Arbitrage',
  ],
  'Solution Oriented': ['Retirement', 'Children'],
  Other: ['Index Funds', 'ETFs', 'Fund of Funds'],
};

// ─── Helpers ─────────────────────────────────────────────────
function fmtAUM(n: number): string {
  if (!n) return '—';
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(0)}L Cr`;
  if (n >= 100) return `₹${Math.round(n).toLocaleString('en-IN')} Cr`;
  return `₹${n.toFixed(0)} Cr`;
}

function fundAge(inception: string): string {
  if (!inception) return '—';
  const years = (Date.now() - new Date(inception).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) return `${Math.round(years * 12)}m`;
  return `${years.toFixed(1)}y`;
}

// ─── Fund Card ───────────────────────────────────────────────
function FundCard({ fund, onClick }: { fund: Fund; onClick: () => void }) {
  const nav   = fund.nav         != null ? parseFloat(String(fund.nav))         : null;
  const c1y   = fund.cagr1Y      != null ? parseFloat(String(fund.cagr1Y))      : null;
  const c3y   = fund.cagr3Y      != null ? parseFloat(String(fund.cagr3Y))      : null;
  const c5y   = fund.cagr5Y      != null ? parseFloat(String(fund.cagr5Y))      : null;
  const aum   = fund.fundSize    != null ? parseFloat(String(fund.fundSize))    : null;
  const er    = fund.expenseRatio!= null ? parseFloat(String(fund.expenseRatio)): null;
  const sharpe= fund.sharpeRatio1y != null ? parseFloat(String(fund.sharpeRatio1y)) : null;
  const vol   = fund.volatility1y  != null ? parseFloat(String(fund.volatility1y))  : null;
  const age   = fund.inceptionDate ? fundAge(fund.inceptionDate) : '—';

  const pos = (v: number | null) => (v ?? 0) >= 0;
  const topSectors = (fund.sectorDna ?? []).slice(0, 3);

  return (
    <div
      onClick={onClick}
      className="glass-card-vi rounded-2xl p-5 flex flex-col gap-3 hover:border-[#44f593]/30 transition-all duration-300 cursor-pointer group"
    >
      {/* Header */}
      <div>
        <h3 className="font-['Space_Grotesk'] font-bold text-sm text-[#dce5df] group-hover:text-[#44f593] transition-colors line-clamp-2 leading-snug mb-1">
          {fund.schemeName}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {fund.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#44f593]/10 text-[#44f593] font-bold uppercase tracking-widest">
              {fund.category}
            </span>
          )}
          {fund.subCategory && (
            <span className="text-xs text-[#859586] uppercase tracking-widest">{fund.subCategory}</span>
          )}
        </div>
      </div>

      {/* Core returns grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#0d1510] rounded-lg p-2">
          <p className="text-[11px] uppercase text-[#859586] tracking-widest mb-0.5">1Y</p>
          <p className={`font-['JetBrains_Mono'] text-sm font-bold ${c1y != null ? (pos(c1y) ? 'text-[#44f593]' : 'text-[#ffb4ab]') : 'text-[#859586]'}`}>
            {c1y != null && !isNaN(c1y) ? `${pos(c1y) ? '+' : ''}${c1y.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="bg-[#0d1510] rounded-lg p-2">
          <p className="text-[11px] uppercase text-[#859586] tracking-widest mb-0.5">3Y</p>
          <p className={`font-['JetBrains_Mono'] text-sm font-bold ${c3y != null ? (pos(c3y) ? 'text-[#44f593]' : 'text-[#ffb4ab]') : 'text-[#859586]'}`}>
            {c3y != null && !isNaN(c3y) ? `${pos(c3y) ? '+' : ''}${c3y.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="bg-[#0d1510] rounded-lg p-2">
          <p className="text-[11px] uppercase text-[#859586] tracking-widest mb-0.5">5Y</p>
          <p className={`font-['JetBrains_Mono'] text-sm font-bold ${c5y != null ? (pos(c5y) ? 'text-[#44f593]' : 'text-[#ffb4ab]') : 'text-[#859586]'}`}>
            {c5y != null && !isNaN(c5y) ? `${pos(c5y) ? '+' : ''}${c5y.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Risk + cost row */}
      <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-3">
        <div>
          <p className="text-[11px] uppercase text-[#859586] tracking-widest mb-0.5">Sharpe</p>
          <p className="font-['JetBrains_Mono'] text-xs text-[#dce5df]">
            {sharpe != null && !isNaN(sharpe) ? sharpe.toFixed(2) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#859586] tracking-widest mb-0.5">Vol</p>
          <p className="font-['JetBrains_Mono'] text-xs text-[#dce5df]">
            {vol != null && !isNaN(vol) ? `${vol.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#859586] tracking-widest mb-0.5">TER</p>
          <p className="font-['JetBrains_Mono'] text-xs text-[#44f593]">
            {er != null && !isNaN(er) ? `${er.toFixed(2)}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#859586] tracking-widest mb-0.5">Age</p>
          <p className="font-['JetBrains_Mono'] text-xs text-[#dce5df]">{age}</p>
        </div>
      </div>

      {/* AUM + NAV */}
      <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
        <span className="text-[#859586]">AUM <span className="font-['JetBrains_Mono'] text-[#dce5df]">{aum != null ? fmtAUM(aum) : '—'}</span></span>
        <span className="text-[#859586]">NAV <span className="font-['JetBrains_Mono'] text-[#dce5df]">{nav != null && !isNaN(nav) ? `₹${nav.toFixed(2)}` : '—'}</span></span>
      </div>

      {/* Sector DNA pills */}
      {topSectors.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
          {topSectors.map(s => {
            const w = s.weight != null ? parseFloat(String(s.weight)) : 0;
            return (
              <span
                key={s.sectorName}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest"
                style={{
                  background: `${s.colorHex}18`,
                  color: s.colorHex || '#859586',
                  border: `1px solid ${s.colorHex}30`,
                }}
              >
                {s.sector}
                <span className="opacity-70">{isNaN(w) ? '0' : w.toFixed(0)}%</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Slider with label ────────────────────────────────────────
function SliderFilter({
  label, value, min, max, step = 1, unit = '%',
  onChange, formatValue,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  const display = formatValue ? formatValue(value) : `${value}${unit}`;
  return (
    <div>
      <div className="flex justify-between text-xs text-[#859586] mb-1">
        <span>{label}</span>
        <span className="font-['JetBrains_Mono'] text-[#44f593]">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#44f593] h-1.5"
      />
      <div className="flex justify-between text-[11px] text-[#859586]/50 mt-0.5">
        <span>{formatValue ? formatValue(min) : `${min}${unit}`}</span>
        <span>{formatValue ? formatValue(max) : `${max}${unit}`}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function ScreenerPage() {
  const router = useRouter();

  // Basic filters
  const [sectors, setSectors]           = useState<Sector[]>([]);
  const [sectorFilters, setSectorFilters] = useState<Record<string, number>>({});
  const [plan, setPlan]                 = useState<'Direct' | 'Regular'>('Direct');
  const [option, setOption]             = useState<'Growth' | 'IDCW'>('Growth');

  // Category filters
  const [selectedCategory, setSelectedCategory]     = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');

  // Advanced filters
  const [minAum, setMinAum]                   = useState(0);
  const [maxExpenseRatio, setMaxExpenseRatio] = useState(2.5);
  const [minReturn1y, setMinReturn1y]         = useState(0);
  const [minReturn3y, setMinReturn3y]         = useState(0);
  const [minSharpe, setMinSharpe]             = useState(0);
  const [maxVolatility, setMaxVolatility]     = useState(40);
  const [zeroExitLoad, setZeroExitLoad]       = useState(false);
  const [minFundAge, setMinFundAge]           = useState(0);

  // UI state
  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [funds, setFunds]                 = useState<Fund[]>([]);
  const [loading, setLoading]             = useState(false);
  const [initialLoad, setInitialLoad]     = useState(true);
  const [resultCount, setResultCount]     = useState<number | null>(null);

  // Load sectors on mount
  useEffect(() => {
    fetch('/api/screener/sectors')
      .then(r => r.json())
      .then(d => { if (d.success) setSectors(d.sectors); })
      .catch(() => {});
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ plan, option, limit: '60' });

      const activeSectors = Object.fromEntries(
        Object.entries(sectorFilters).filter(([, v]) => v > 0)
      );
      if (Object.keys(activeSectors).length > 0) params.set('sectors', JSON.stringify(activeSectors));
      if (selectedCategory)    params.set('category', selectedCategory);
      if (selectedSubCategory) params.set('subCategory', selectedSubCategory);
      if (minAum > 0)          params.set('minAum', String(minAum));
      if (maxExpenseRatio < 2.5) params.set('maxExpenseRatio', String(maxExpenseRatio));
      if (minReturn1y > 0)     params.set('minReturn1y', String(minReturn1y));
      if (minReturn3y > 0)     params.set('minReturn3y', String(minReturn3y));
      if (minSharpe > 0)       params.set('minSharpe', String(minSharpe));
      if (maxVolatility < 40)  params.set('maxVolatility', String(maxVolatility));
      if (zeroExitLoad)        params.set('maxExitLoad', '0');
      if (minFundAge > 0)      params.set('minFundAge', String(minFundAge));

      const r = await fetch(`/api/screener/search?${params}`);
      const d = await r.json();
      if (d.success) {
        setFunds(d.funds);
        setResultCount(d.count);
      }
    } catch {} finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [sectorFilters, plan, option, selectedCategory, selectedSubCategory,
      minAum, maxExpenseRatio, minReturn1y, minReturn3y, minSharpe,
      maxVolatility, zeroExitLoad, minFundAge]);

  // Run default search on mount
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSector = (sectorName: string) => {
    setSectorFilters(prev => {
      if (prev[sectorName] !== undefined) {
        const next = { ...prev }; delete next[sectorName]; return next;
      }
      return { ...prev, [sectorName]: 10 };
    });
  };

  const clearAllFilters = () => {
    setSectorFilters({});
    setSelectedCategory('');
    setSelectedSubCategory('');
    setMinAum(0);
    setMaxExpenseRatio(2.5);
    setMinReturn1y(0);
    setMinReturn3y(0);
    setMinSharpe(0);
    setMaxVolatility(40);
    setZeroExitLoad(false);
    setMinFundAge(0);
  };

  const activeSectorCount   = Object.values(sectorFilters).filter(v => v > 0).length;
  const subCategories       = selectedCategory ? (CATEGORY_MAP[selectedCategory] ?? []) : [];

  const activeFilterCount = activeSectorCount
    + (selectedCategory ? 1 : 0)
    + (selectedSubCategory ? 1 : 0)
    + (minAum > 0 ? 1 : 0)
    + (maxExpenseRatio < 2.5 ? 1 : 0)
    + (minReturn1y > 0 ? 1 : 0)
    + (minReturn3y > 0 ? 1 : 0)
    + (minSharpe > 0 ? 1 : 0)
    + (maxVolatility < 40 ? 1 : 0)
    + (zeroExitLoad ? 1 : 0)
    + (minFundAge > 0 ? 1 : 0);

  return (
    <div className="bg-[#060d0a] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* Page Header */}
        <div className="mb-10">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-['Space_Grotesk'] font-bold text-4xl md:text-5xl text-[#dce5df] tracking-tight mb-2">
                Fund Screener
              </h1>
              <p className="text-[#859586] text-sm">
                Market Genome engine · 10+ filters · {resultCount != null ? `${resultCount} funds match` : 'All mutual funds'}
              </p>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-[#ffb4ab] hover:underline font-bold flex items-center gap-1"
              >
                <span>Clear all ({activeFilterCount})</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-8 items-start">

          {/* ── Sidebar ──────────────────────────────────────── */}
          <aside className="w-72 shrink-0 flex flex-col gap-4 sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto pr-1 pb-4">

            {/* Plan / Option toggles */}
            <div className="glass-card-vi rounded-2xl p-4 flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-2">Plan Type</p>
                <div className="flex rounded-xl overflow-hidden border border-[#3c4a3e]">
                  {(['Direct', 'Regular'] as const).map(p => (
                    <button key={p} onClick={() => setPlan(p)}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${
                        plan === p ? 'bg-[#44f593] text-[#001f10]' : 'bg-transparent text-[#859586] hover:text-[#dce5df]'
                      }`}
                    >{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-2">Option</p>
                <div className="flex rounded-xl overflow-hidden border border-[#3c4a3e]">
                  {(['Growth', 'IDCW'] as const).map(o => (
                    <button key={o} onClick={() => setOption(o)}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${
                        option === o ? 'bg-[#44f593] text-[#001f10]' : 'bg-transparent text-[#859586] hover:text-[#dce5df]'
                      }`}
                    >{o}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category filter */}
            <div className="glass-card-vi rounded-2xl p-4">
              <p className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-3">Category</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(CATEGORY_MAP).map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(prev => prev === cat ? '' : cat);
                      setSelectedSubCategory('');
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#44f593] text-[#001f10]'
                        : 'bg-[#161d1a] text-[#859586] hover:text-[#dce5df] border border-transparent hover:border-[#3c4a3e]'
                    }`}
                  >{cat}</button>
                ))}
              </div>

              {/* Sub-category */}
              {subCategories.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-2">Sub-category</p>
                  <select
                    value={selectedSubCategory}
                    onChange={e => setSelectedSubCategory(e.target.value)}
                    className="w-full bg-[#161d1a] border border-[#3c4a3e] rounded-lg px-3 py-2 text-xs text-[#dce5df] focus:outline-none focus:border-[#44f593]/40"
                  >
                    <option value="">All sub-categories</option>
                    {subCategories.map(sc => (
                      <option key={sc} value={sc}>{sc}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Returns filter */}
            <div className="glass-card-vi rounded-2xl p-4 flex flex-col gap-4">
              <p className="text-xs uppercase tracking-widest text-[#859586] font-bold">Returns</p>
              <SliderFilter label="Min 1Y CAGR" value={minReturn1y} min={0} max={50} onChange={setMinReturn1y} />
              <SliderFilter label="Min 3Y CAGR" value={minReturn3y} min={0} max={40} onChange={setMinReturn3y} />
            </div>

            {/* Advanced filters */}
            <div className="glass-card-vi rounded-2xl p-4">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-[#859586] font-bold hover:text-[#dce5df] transition-colors"
              >
                <span>Advanced Filters</span>
                <span className="text-base leading-none">{showAdvanced ? '−' : '+'}</span>
              </button>

              {showAdvanced && (
                <div className="mt-4 flex flex-col gap-4">
                  <SliderFilter
                    label="Min AUM (Cr)"
                    value={minAum} min={0} max={50000} step={500}
                    onChange={setMinAum}
                    formatValue={v => v === 0 ? 'Any' : `₹${v.toLocaleString('en-IN')} Cr`}
                  />
                  <SliderFilter
                    label="Max Expense Ratio"
                    value={maxExpenseRatio} min={0} max={2.5} step={0.05}
                    onChange={setMaxExpenseRatio}
                    formatValue={v => v >= 2.5 ? 'Any' : `≤ ${v.toFixed(2)}%`}
                  />
                  <SliderFilter
                    label="Min Sharpe Ratio"
                    value={minSharpe} min={0} max={3} step={0.1} unit=""
                    onChange={setMinSharpe}
                    formatValue={v => v === 0 ? 'Any' : `≥ ${v.toFixed(1)}`}
                  />
                  <SliderFilter
                    label="Max Volatility"
                    value={maxVolatility} min={5} max={40}
                    onChange={setMaxVolatility}
                    formatValue={v => v >= 40 ? 'Any' : `≤ ${v}%`}
                  />
                  <SliderFilter
                    label="Min Fund Age"
                    value={minFundAge} min={0} max={20} unit="y"
                    onChange={setMinFundAge}
                    formatValue={v => v === 0 ? 'Any' : `≥ ${v}y`}
                  />
                  {/* Zero exit load toggle */}
                  <button
                    onClick={() => setZeroExitLoad(v => !v)}
                    className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                      zeroExitLoad
                        ? 'bg-[#44f593]/10 border border-[#44f593]/30 text-[#44f593]'
                        : 'bg-[#161d1a] border border-transparent text-[#859586] hover:text-[#dce5df]'
                    }`}
                  >
                    <span>Zero Exit Load only</span>
                    <span>{zeroExitLoad ? '✓' : '○'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sector DNA Filters */}
            <div className="glass-card-vi rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-[#859586] font-bold">Sector DNA</p>
                {activeSectorCount > 0 && (
                  <button onClick={() => setSectorFilters({})} className="text-xs text-[#ffb4ab] hover:underline font-bold">
                    Clear ({activeSectorCount})
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {sectors.map(sector => {
                  const active = sectorFilters[sector.sectorName] !== undefined;
                  const weight = sectorFilters[sector.sectorName] ?? 0;
                  return (
                    <div key={sector.id}>
                      <button
                        onClick={() => toggleSector(sector.sectorName)}
                        className={`w-full text-left flex items-center justify-between rounded-lg px-3 py-2 transition-all text-xs font-bold ${
                          active
                            ? 'bg-[#44f593]/10 border border-[#44f593]/30 text-[#44f593]'
                            : 'bg-[#161d1a] border border-transparent text-[#859586] hover:text-[#dce5df] hover:bg-[#19211e]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sector.colorHex || '#44f593' }} />
                          {sector.displayName}
                        </span>
                        <span className="text-xs opacity-60">{sector.fundCount}</span>
                      </button>
                      {active && (
                        <div className="px-3 pt-2">
                          <div className="flex justify-between text-xs text-[#859586] mb-1">
                            <span>Min. exposure</span>
                            <span className="font-['JetBrains_Mono'] text-[#44f593]">{weight}%</span>
                          </div>
                          <input
                            type="range" min={0} max={Math.min(50, Math.round(sector.maxWeight))} value={weight}
                            onChange={e => setSectorFilters(prev => ({ ...prev, [sector.sectorName]: parseInt(e.target.value) }))}
                            className="w-full accent-[#44f593] h-1.5"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Apply button */}
            <button
              onClick={search} disabled={loading}
              className="w-full bg-[#44f593] text-[#001f10] font-bold py-3 rounded-xl hover:bg-[#25e283] transition-colors active:scale-95 disabled:opacity-60 sticky bottom-0"
            >
              {loading ? 'Searching…' : `Apply Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
            </button>
          </aside>

          {/* ── Results ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Sort info strip */}
            {resultCount != null && !loading && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-[#859586]">
                  {resultCount} fund{resultCount !== 1 ? 's' : ''} · sorted by 3Y CAGR
                </span>
                <span className="text-xs text-[#859586]/60">Direct · Growth</span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-[#44f593]/30 border-t-[#44f593] rounded-full animate-spin" />
              </div>
            ) : funds.length === 0 && !initialLoad ? (
              <div className="glass-card-vi rounded-2xl p-16 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df] mb-2">No funds match</h3>
                <p className="text-[#859586] text-sm mb-6">
                  Try reducing thresholds or clearing some filters.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="bg-[#44f593] text-[#001f10] px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#25e283] transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {funds.map(fund => (
                  <FundCard
                    key={fund.schemeCode}
                    fund={fund}
                    onClick={() => router.push(`/funds/${fund.schemeCode}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Regulatory footer */}
        <div className="mt-12 p-4 bg-[#19211e]/50 rounded-xl border border-[#3c4a3e]/40">
          <p className="text-xs text-[#859586] leading-relaxed font-mono">
            Mutual funds only · AMFI-registered distributor ARN-317605 · Past performance is not indicative of future returns ·
            Sector data sourced from latest available fund factsheets. Investments are subject to market risks.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
