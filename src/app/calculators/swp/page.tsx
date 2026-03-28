'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

// ─── Types ───────────────────────────────────────────────────
interface YearRow { year: number; withdrawn: number; balance: number; }

// ─── Helpers ─────────────────────────────────────────────────
function fmtINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDuration(months: number, maxMonths: number): string {
  if (months >= maxMonths) return '40+ years (Sustainable)';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
  return `${y}y ${m}m`;
}

// ─── SWP Simulation ─────────────────────────────────────────
function simulateSWP(initialInvestment: number, withdrawal: number, ratePA: number) {
  let balance = initialInvestment;
  let totalWithdrawn = 0;
  const monthlyRate = ratePA / 100 / 12;
  const yearlyBreakdown: YearRow[] = [];
  let months = 0;
  const maxMonths = 40 * 12;

  while (balance > 0 && months < maxMonths) {
    balance = balance * (1 + monthlyRate);
    const w = Math.min(withdrawal, balance);
    balance -= w;
    totalWithdrawn += w;
    months++;
    if (months % 12 === 0) yearlyBreakdown.push({ year: months / 12, withdrawn: totalWithdrawn, balance });
  }
  if (months % 12 !== 0) yearlyBreakdown.push({ year: Math.ceil(months / 12), withdrawn: totalWithdrawn, balance });

  return { totalWithdrawn, remainingBalance: Math.max(balance, 0), months, sustainable: months >= maxMonths, yearlyBreakdown };
}

// ─── Donut Chart ─────────────────────────────────────────────
function DonutChart({ withdrawn, remaining }: { withdrawn: number; remaining: number }) {
  const total = withdrawn + remaining;
  const wPct = total > 0 ? withdrawn / total : 1;
  const R = 40, circ = 2 * Math.PI * R, wDash = wPct * circ;
  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" fill="transparent" r={R} stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
        <circle cx="50" cy="50" fill="transparent" r={R} stroke="#44f593" strokeDasharray={`${wDash} ${circ - wDash}`} strokeLinecap="round" strokeWidth="8"/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-bold text-white">{(wPct * 100).toFixed(0)}%</span>
        <span className="text-[10px] text-[#859586] uppercase font-bold">Withdrawn</span>
      </div>
    </div>
  );
}

// ─── Slider ──────────────────────────────────────────────────
function SliderCard({ label, value, displayValue, min, max, step, minLabel, maxLabel, onChange }: {
  label: string; value: number; displayValue: string; min: number; max: number; step: number; minLabel: string; maxLabel: string; onChange: (v: number) => void;
}) {
  return (
    <div className="glass-card p-4 md:p-5 rounded-2xl">
      <div className="flex justify-between items-center mb-3">
        <label className="font-['Space_Grotesk'] font-bold text-[#dce5df] text-sm">{label}</label>
        <span className="font-mono text-lg text-[#44f593] font-bold">{displayValue}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full mb-2" />
      <div className="flex justify-between text-[10px] text-[#859586]">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

// ─── Left Sidebar Nav ────────────────────────────────────────
const CALC_NAV = [
  { label: 'SIP Planner', href: '/calculators/sip', icon: 'query_stats' },
  { label: 'SWP Planner', href: '/calculators/swp', icon: 'trending_down' },
  { label: 'STP Planner', href: '/calculators/stp', icon: 'swap_horiz' },
];

// ─── Page ─────────────────────────────────────────────────────
export default function SWPCalculatorPage() {
  const [investment, setInvestment] = useState(5000000);
  const [withdrawal, setWithdrawal] = useState(25000);
  const [rate, setRate] = useState(8);
  const [tableOpen, setTableOpen] = useState(false);

  const { totalWithdrawn, remainingBalance, months, sustainable, yearlyBreakdown } = useMemo(
    () => simulateSWP(investment, withdrawal, rate), [investment, withdrawal, rate]
  );

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-12 px-4 md:px-6 lg:px-8 max-w-[1440px] mx-auto flex-1 w-full flex gap-8">

        {/* ── Sidebar ── */}
        <aside className="w-56 flex-shrink-0 hidden lg:flex flex-col gap-2">
          <h2 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-[0.2em] text-[#859586] mb-3 px-4">Financial Planner</h2>
          <nav className="flex flex-col gap-1">
            {CALC_NAV.map(item => (
              <Link key={item.label} href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  item.href === '/calculators/swp' ? 'bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20' : 'text-[#c0c9c2] hover:bg-white/5'
                }`}>
                <span className="material-symbols-outlined text-[1.1rem]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-[#859586] mb-3">
              <Link href="/calculators" className="hover:text-[#44f593] transition-colors">Financial Planner</Link>
              <span>/</span>
              <span className="text-[#dce5df]">SWP Planner</span>
            </div>
            <h1 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold tracking-tight text-[#dce5df] mb-2">SWP Planner</h1>
            <p className="text-[#859586] text-sm max-w-xl">Systematic Withdrawal Plan — simulate regular withdrawals from your mutual fund corpus</p>
          </div>

          {/* ── Sliders Row (3 across on desktop) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <SliderCard label="Initial Investment" value={investment} displayValue={fmtINR(investment)}
              min={100000} max={100000000} step={50000} minLabel="₹1L" maxLabel="₹10Cr" onChange={setInvestment} />
            <SliderCard label="Monthly Withdrawal" value={withdrawal} displayValue={`₹${withdrawal.toLocaleString('en-IN')}`}
              min={5000} max={500000} step={1000} minLabel="₹5,000" maxLabel="₹5,00,000" onChange={setWithdrawal} />
            <SliderCard label="Expected Return (p.a.)" value={rate} displayValue={`${rate}%`}
              min={1} max={13} step={0.5} minLabel="1%" maxLabel="13%" onChange={setRate} />
          </div>

          {/* ── Results Grid (4 columns on desktop) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Donut */}
            <div className="col-span-2 lg:col-span-1 glass-card-vi p-5 rounded-2xl flex flex-col items-center justify-center">
              <DonutChart withdrawn={totalWithdrawn} remaining={remainingBalance} />
              <div className="flex items-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#44f593]" /><span className="text-[#859586]">Withdrawn</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#3e4c44]" /><span className="text-[#859586]">Remaining</span></div>
              </div>
            </div>

            {/* KPI 1 */}
            <div className="bg-[#161d1a] p-5 rounded-2xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-2 font-bold">Total Withdrawn</p>
              <p className="font-mono text-xl md:text-2xl font-bold text-[#44f593]">{fmtINR(Math.round(totalWithdrawn))}</p>
              <p className="text-[10px] text-[#859586] mt-1">{months} months of withdrawals</p>
            </div>

            {/* KPI 2 */}
            <div className="bg-[#161d1a] p-5 rounded-2xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-2 font-bold">Remaining Corpus</p>
              <p className="font-mono text-xl md:text-2xl font-bold text-[#dce5df]">
                {remainingBalance > 0 ? fmtINR(Math.round(remainingBalance)) : 'Depleted'}
              </p>
              <p className="text-[10px] text-[#859586] mt-1">{remainingBalance > 0 ? 'Still growing' : 'Corpus exhausted'}</p>
            </div>

            {/* KPI 3 */}
            <div className="bg-[#161d1a] p-5 rounded-2xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-2 font-bold">Corpus Duration</p>
              <p className="font-mono text-xl md:text-2xl font-bold text-[#dce5df]">{fmtDuration(months, 40 * 12)}</p>
              <p className="text-[10px] mt-1" style={{ color: sustainable ? '#44f593' : '#ffb4ab' }}>
                {sustainable ? 'Returns exceed withdrawals' : 'Will deplete over time'}
              </p>
            </div>
          </div>

          {/* ── Annual Breakdown Table ── */}
          <div className="glass-card-vi rounded-2xl overflow-hidden mb-8">
            <button onClick={() => setTableOpen(v => !v)}
              className="w-full flex justify-between items-center p-5 text-left hover:bg-white/[0.02] transition-all">
              <span className="font-['Space_Grotesk'] font-bold text-[#dce5df]">Annual Withdrawal Projection</span>
              <span className={`material-symbols-outlined text-[#44f593] transition-transform ${tableOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            {tableOpen && (
              <div className="px-5 pb-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[#859586] border-b border-white/5">
                      <th className="py-3 font-medium uppercase tracking-tight text-xs">Year</th>
                      <th className="py-3 font-medium uppercase tracking-tight text-xs text-right">Total Withdrawn</th>
                      <th className="py-3 font-medium uppercase tracking-tight text-xs text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#c0c9c2]">
                    {yearlyBreakdown.map(row => (
                      <tr key={row.year} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-3 text-[#dce5df]">Year {row.year}</td>
                        <td className="py-3 text-right">{fmtINR(row.withdrawn)}</td>
                        <td className="py-3 text-right text-[#44f593]">{fmtINR(Math.round(row.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CTA */}
          <Link href="/funds/search"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#44f593] text-[#001f10] font-bold hover:bg-[#25e283] transition-colors active:scale-95 mb-8">
            Explore Withdrawal Strategies
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>

          <ComplianceDisclaimer variant="calculator" className="mt-4" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
