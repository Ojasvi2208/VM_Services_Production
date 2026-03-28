'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

// ─── Types ───────────────────────────────────────────────────
interface YearRow {
  year: number;
  withdrawn: number;
  balance: number;
}

// ─── Helpers ─────────────────────────────────────────────────
function fmtINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtINRFull(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDuration(months: number, maxMonths: number): string {
  if (months >= maxMonths) return '40+ years (Sustainable)';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
  return `${y} year${y !== 1 ? 's' : ''} ${m} month${m !== 1 ? 's' : ''}`;
}

// ─── SWP Simulation ─────────────────────────────────────────
function simulateSWP(
  initialInvestment: number,
  withdrawal: number,
  ratePA: number,
): { totalWithdrawn: number; remainingBalance: number; months: number; sustainable: boolean; yearlyBreakdown: YearRow[] } {
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

    if (months % 12 === 0) {
      yearlyBreakdown.push({ year: months / 12, withdrawn: totalWithdrawn, balance });
    }
  }

  // Push final partial year if not already captured
  if (months % 12 !== 0) {
    yearlyBreakdown.push({ year: Math.ceil(months / 12), withdrawn: totalWithdrawn, balance });
  }

  return {
    totalWithdrawn,
    remainingBalance: Math.max(balance, 0),
    months,
    sustainable: months >= maxMonths,
    yearlyBreakdown,
  };
}

// ─── Donut Chart ──────────────────────────────────────────────
function DonutChart({ withdrawn, remaining }: { withdrawn: number; remaining: number }) {
  const total = withdrawn + remaining;
  const wPct = total > 0 ? withdrawn / total : 1;
  const rPct = 1 - wPct;
  const R = 40;
  const circ = 2 * Math.PI * R;
  const wDash = wPct * circ;
  const rDash = rPct * circ;

  return (
    <div className="relative w-48 h-48 mx-auto mb-6">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" fill="transparent" r={R} stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
        <circle cx="50" cy="50" fill="transparent" r={R}
          stroke="#44f593"
          strokeDasharray={`${wDash} ${circ - wDash}`}
          strokeLinecap="round"
          strokeWidth="8"
          strokeDashoffset="0"
        />
        <circle cx="50" cy="50" fill="transparent" r={R}
          stroke="#3e4c44"
          strokeDasharray={`${rDash} ${circ - rDash}`}
          strokeLinecap="round"
          strokeWidth="8"
          strokeDashoffset={`-${wDash}`}
          className="opacity-60"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold text-white">{(wPct * 100).toFixed(0)}%</span>
        <span className="text-xs text-[#859586] uppercase tracking-tight font-bold">Withdrawn</span>
      </div>
    </div>
  );
}

// ─── Slider ──────────────────────────────────────────────────
function SliderCard({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  onChange,
}: {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="glass-card p-5 rounded-2xl flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <label className="font-display font-bold text-[#dce5df] tracking-tight">{label}</label>
        <span className="font-mono text-lg text-[#44f593]">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs font-mono text-[#859586] uppercase tracking-tight">
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
  const [rate, setRate]             = useState(8);
  const [tableOpen, setTableOpen]   = useState(false);

  const result = useMemo(
    () => simulateSWP(investment, withdrawal, rate),
    [investment, withdrawal, rate],
  );

  const { totalWithdrawn, remainingBalance, months, sustainable, yearlyBreakdown } = result;

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      {/* Ambient gradient blobs */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-[#44f593]/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[300px] h-[300px] bg-[#3e4c44]/10 blur-[100px] rounded-full -z-10 pointer-events-none" />

      <NavBar />

      <main className="pt-36 pb-12 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full flex gap-8">

        {/* ── Left Sidebar ─────────────────────────────────── */}
        <aside className="w-60 flex-shrink-0 hidden lg:flex flex-col gap-2">
          <h2 className="font-display font-bold text-xs uppercase tracking-[0.2em] text-[#859586] mb-3 px-4">
            Financial Engineering
          </h2>
          <nav className="flex flex-col gap-1">
            {CALC_NAV.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className={[
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium',
                  item.href === '/calculators/swp'
                    ? 'bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20'
                    : 'text-[#c0c9c2] hover:bg-white/5',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-[1.1rem]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Sovereign Grade badge */}
          <div className="mt-auto p-5 glass-card rounded-2xl border-[#3c4a3e]">
            <p className="text-xs text-[#859586] leading-relaxed mb-3">
              Institutional grade projections based on historical return assumptions.
            </p>
            <div className="flex items-center gap-2 text-[#44f593]">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="text-xs font-bold uppercase tracking-widest">Sovereign Grade</span>
            </div>
          </div>
        </aside>

        {/* ── 60/40 Content Area ──────────────────────────── */}
        <div className="flex-1 flex flex-col md:flex-row gap-8">

          {/* [Left 60%] Input Section */}
          <section className="flex-[3] space-y-5">
            <header>
              <h1 className="font-display text-4xl font-bold tracking-tight text-glow mb-2 text-[#dce5df]">
                SWP Planner
              </h1>
              <p className="text-[#c0c9c2] max-w-xl text-sm">
                Systematic Withdrawal Plan — simulate regular withdrawals from your mutual fund corpus
              </p>
            </header>

            <div className="space-y-4">
              <SliderCard
                label="Initial Investment"
                value={investment}
                displayValue={`₹ ${investment.toLocaleString('en-IN')}`}
                min={100000}
                max={100000000}
                step={50000}
                minLabel="₹ 1,00,000"
                maxLabel="₹ 10,00,00,000"
                onChange={setInvestment}
              />
              <SliderCard
                label="Monthly Withdrawal"
                value={withdrawal}
                displayValue={`₹ ${withdrawal.toLocaleString('en-IN')}`}
                min={5000}
                max={500000}
                step={1000}
                minLabel="₹ 5,000"
                maxLabel="₹ 5,00,000"
                onChange={setWithdrawal}
              />
              <SliderCard
                label="Expected Return Rate (p.a)"
                value={rate}
                displayValue={`${rate.toFixed(1)}%`}
                min={1}
                max={13}
                step={0.5}
                minLabel="1 %"
                maxLabel="13 %"
                onChange={setRate}
              />
            </div>

            {/* Collapsible Annual Breakdown */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setTableOpen(v => !v)}
                className="w-full flex justify-between items-center p-5 text-left hover:bg-white/[0.02] transition-all"
              >
                <span className="font-display font-bold text-[#dce5df]">Annual Withdrawal Projection</span>
                <svg
                  width="20" height="20" fill="none" viewBox="0 0 24 24"
                  stroke="#44f593" strokeWidth="2"
                  className={`transition-transform ${tableOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {tableOpen && (
                <div className="px-5 pb-5 overflow-x-auto">
                  <table className="w-full text-left font-mono text-sm">
                    <thead>
                      <tr className="text-[#859586] border-b border-white/5">
                        <th className="py-3 font-medium uppercase tracking-tight text-xs">Year</th>
                        <th className="py-3 font-medium uppercase tracking-tight text-xs text-right">Total Withdrawn</th>
                        <th className="py-3 font-medium uppercase tracking-tight text-xs text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#c0c9c2]">
                      {yearlyBreakdown.map(row => (
                        <tr key={row.year} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 text-[#dce5df]">Year {row.year}</td>
                          <td className="py-3 text-right">{fmtINRFull(row.withdrawn)}</td>
                          <td className="py-3 text-right text-[#44f593]">{fmtINRFull(Math.round(row.balance))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* [Right 40%] Output Section */}
          <section className="flex-[2] space-y-5">

            {/* Donut Chart */}
            <div className="glass-card p-6 rounded-2xl flex flex-col items-center">
              <h3 className="font-display font-bold text-center mb-6 uppercase tracking-widest text-xs text-[#859586]">
                Corpus Distribution
              </h3>
              <DonutChart withdrawn={totalWithdrawn} remaining={remainingBalance} />
              <div className="w-full space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#44f593]" />
                    <span className="text-[#c0c9c2]">Total Withdrawn</span>
                  </div>
                  <span className="font-mono text-[#44f593]">{fmtINRFull(Math.round(totalWithdrawn))}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#3e4c44]" />
                    <span className="text-[#c0c9c2]">Remaining Corpus</span>
                  </div>
                  <span className="font-mono text-[#dce5df]">
                    {remainingBalance > 0 ? fmtINRFull(Math.round(remainingBalance)) : 'Depleted'}
                  </span>
                </div>
              </div>
            </div>

            {/* KPI Boxes */}
            <div className="space-y-3">
              <div className="bg-[#161d1a] p-5 rounded-2xl border-l-4 border-[#44f593] shadow-lg">
                <span className="text-xs font-bold uppercase tracking-widest text-[#859586]">
                  Total Withdrawn
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-mono text-3xl font-bold text-white">{fmtINR(Math.round(totalWithdrawn))}</span>
                </div>
              </div>
              <div className="bg-[#161d1a] p-5 rounded-2xl border-l-4 border-[#bacbbf] shadow-lg">
                <span className="text-xs font-bold uppercase tracking-widest text-[#859586]">
                  Remaining Corpus
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-mono text-3xl font-bold text-white">
                    {remainingBalance > 0 ? fmtINR(Math.round(remainingBalance)) : 'Depleted'}
                  </span>
                </div>
              </div>
              <div className="bg-[#161d1a] p-5 rounded-2xl border-l-4 border-[#3c4a3e] shadow-lg">
                <span className="text-xs font-bold uppercase tracking-widest text-[#859586]">
                  Corpus Duration
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-mono text-3xl font-bold text-white">
                    {fmtDuration(months, 40 * 12)}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Link
              href="/funds/search"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#44f593]/80 to-[#00d87a] font-display font-black text-[#001f10] tracking-tight shadow-xl shadow-[#44f593]/10 hover:shadow-[#44f593]/20 transition-all flex items-center justify-center gap-2 group text-base"
            >
              EXPLORE WITHDRAWAL STRATEGIES
              <svg
                width="18" height="18" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth="2.5"
                className="group-hover:translate-x-1 transition-transform"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </Link>

            {/* Disclaimer */}
            <p className="text-xs text-[#859586] leading-relaxed font-mono">
              Projections are for illustrative purposes only. Actual returns may vary. Mutual fund investments are subject to market risks. Return rate capped at 13% per AMFI guidelines.
            </p>
          </section>
        </div>

        <ComplianceDisclaimer variant="calculator" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
