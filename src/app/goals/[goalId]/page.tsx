'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import { useAuth } from '@/context/AuthContext';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

// ─── Types ────────────────────────────────────────────────────

interface Goal {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  targetDate: string;
  criticality: 'critical' | 'important' | 'normal';
  monthlySip: number;
  recommendedSip: number;
  currentValue: number;
  successProbability: number;
  progressPercent: number;
  linkedFunds: any[];
  notes?: string;
}

// SEBI_COMPLIANCE_HOLD: Projection interface disabled pending IA registration
// interface Projection {
//   successProbability: number;
//   p10: number;
//   p50: number;
//   p90: number;
//   mean: number;
//   shortfall: number;
// }

interface Holding {
  id: string;
  fundName: string;
  schemeCode: string;
  currentValue: number;
  allocationPct: number;
  units: number;
  latestNav: number;
}

// SEBI_COMPLIANCE_HOLD: Drift interface disabled — advisory feature
// interface Drift {
//   driftPct: number;
//   currentValue: number;
//   projectedValue: number;
//   targetAmount: number;
//   suggestedTopupSip?: number;
//   yearsRemaining: number;
// }

// SEBI_COMPLIANCE_HOLD: Suggestion interface disabled — advisory feature
// interface Suggestion {
//   id: string;
//   triggerType: string;
//   fromFundName: string;
//   toFundName: string;
//   stpMonthlyAmount?: number;
//   stpMonths?: number;
//   netBenefit: number;
//   status: string;
// }

// ─── Helpers ──────────────────────────────────────────────────

function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function successColor(p: number): string {
  if (p >= 80) return '#44f593';
  if (p >= 50) return '#f59e0b';
  return '#ff4757';
}

function targetDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// SEBI_COMPLIANCE_HOLD: TRIGGER_LABELS disabled — advisory feature
// const TRIGGER_LABELS: Record<string, string> = {
//   secure_the_bag: 'Secure the Bag',
//   off_track_swap: 'Fund Swap',
//   ltcg_harvest: 'LTCG Harvest',
// };

// SEBI_COMPLIANCE_HOLD: ProbabilityGauge component disabled pending IA registration
// function ProbabilityGauge({ probability }: { probability: number }) {
//   const color = successColor(probability);
//   const r = 54;
//   const circ = 2 * Math.PI * r;
//   const dashOffset = circ * (1 - probability / 100);
//
//   return (
//     <div className="flex flex-col items-center gap-3">
//       <div className="relative w-36 h-36">
//         <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
//           <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
//           <circle
//             cx="60" cy="60" r={r} fill="none"
//             stroke={color} strokeWidth="10"
//             strokeDasharray={circ}
//             strokeDashoffset={dashOffset}
//             strokeLinecap="round"
//             style={{ transition: 'stroke-dashoffset 1s ease' }}
//           />
//         </svg>
//         <div className="absolute inset-0 flex flex-col items-center justify-center">
//           <span className="font-mono text-3xl font-bold" style={{ color }}>
//             {probability.toFixed(0)}%
//           </span>
//           <span className="text-xs uppercase tracking-widest text-[#859586]">Success</span>
//         </div>
//       </div>
//       <p className="text-xs text-[#859586] text-center">
//         {probability >= 80 ? 'Goal is well funded' : probability >= 50 ? 'Increase SIP to stay on track' : 'Significant gap — action needed'}
//       </p>
//     </div>
//   );
// }

// SEBI_COMPLIANCE_HOLD: ScenarioCards component disabled pending IA registration
// function ScenarioCards({ projection }: { projection: Projection }) {
//   return (
//     <div className="grid grid-cols-3 gap-3">
//       {[
//         { label: 'Conservative', value: projection.p10, sublabel: '10th percentile', color: '#ff4757' },
//         { label: 'Expected', value: projection.p50, sublabel: '50th percentile', color: '#f59e0b' },
//         { label: 'Optimistic', value: projection.p90, sublabel: '90th percentile', color: '#44f593' },
//       ].map(s => (
//         <div key={s.label} className="glass-card-vi rounded-xl p-4 text-center">
//           <p className="text-xs uppercase tracking-widest mb-2" style={{ color: s.color }}>{s.label}</p>
//           <p className="font-mono text-lg font-bold text-[#dce5df]">{formatINR(s.value)}</p>
//           <p className="text-xs text-[#859586] mt-1">{s.sublabel}</p>
//         </div>
//       ))}
//     </div>
//   );
// }

// ─── Page ─────────────────────────────────────────────────────

export default function GoalDetailPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/signin?redirect=/goals');
  }, [authLoading, isAuthenticated, router]);

  const fetchAll = useCallback(async () => {
    if (!goalId) return;
    try {
      const [detailRes, holdingsRes] = await Promise.all([
        fetch(`/api/goals/${goalId}`),
        fetch(`/api/goals/${goalId}/holdings`).catch(() => null),
      ]);

      if (detailRes.status === 404) { setNotFound(true); return; }

      const detail = await detailRes.json();
      if (!detail.success) { setNotFound(true); return; }

      setGoal(detail.goal);

      if (holdingsRes?.ok) {
        const hData = await holdingsRes.json();
        setHoldings(hData.holdings ?? []);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    if (isAuthenticated) fetchAll();
  }, [isAuthenticated, fetchAll]);

  if (authLoading || !isAuthenticated) return null;

  if (loading) {
    return (
      <div className="bg-[#060d0a] min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center pt-36">
          <div className="w-8 h-8 border-2 border-[#44f593]/30 border-t-[#44f593] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !goal) {
    return (
      <div className="bg-[#060d0a] min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex flex-col items-center justify-center pt-36 text-center px-6">
          <p className="text-5xl mb-6">🎯</p>
          <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-[#dce5df] mb-3">Goal not found</h2>
          <Link href="/goals" className="text-[#44f593] hover:underline text-sm">← Back to Goals</Link>
        </div>
      </div>
    );
  }

  const color = successColor(goal.successProbability);
  const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000);

  return (
    <div className="bg-[#060d0a] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* ── Breadcrumb ────────────────────────────────────── */}
        <div className="mb-8 flex items-center gap-2 text-sm text-[#859586]">
          <Link href="/goals" className="hover:text-[#44f593] transition-colors">Goals</Link>
          <span>/</span>
          <span className="text-[#dce5df]">{goal.name}</span>
        </div>

        {/* ── Goal Header ───────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: `${goal.color}18`, border: `1px solid ${goal.color}30` }}
          >
            {goal.icon && /\p{Emoji}/u.test(goal.icon) ? (
              <span>{goal.icon}</span>
            ) : (
              <span
                className="material-symbols-outlined text-2xl"
                style={{ color: goal.color || '#44f593', fontVariationSettings: "'FILL' 1" }}
              >
                {goal.icon === 'graduation' ? 'school' : goal.icon || 'flag'}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-['Space_Grotesk'] font-bold text-3xl md:text-4xl text-[#dce5df] mb-1">{goal.name}</h1>
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="text-[#859586] capitalize">{goal.criticality}</span>
              <span className="text-[#859586]">·</span>
              <span className="text-[#859586]">Target: {targetDateLabel(goal.targetDate)}</span>
              <span className="text-[#859586]">·</span>
              <span style={{ color }}>{daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}</span>
            </div>
          </div>
        </div>

        {/* ── Regulatory Notice ─────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-amber-400 leading-relaxed">
            <span className="font-bold">Regulatory Notice:</span> AI-powered goal probability scores and portfolio transition suggestions are temporarily unavailable while we complete SEBI Investment Adviser registration. Goal tracking, SIP progress, and tax computation remain fully functional.
          </p>
        </div>

        {/* ── Main Grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Gauge + Projection ──────────────────── */}
          <div className="lg:col-span-1 space-y-6">

            {/* Probability gauge — SEBI compliance hold */}
            <div className="glass-card-vi rounded-2xl p-6 text-center border border-[#44f593]/20">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 uppercase tracking-widest">Coming Soon</span>
              <p className="text-sm text-[#859586] mt-3">Monte Carlo success probability is under regulatory review and will return once SEBI IA registration is complete.</p>
            </div>

            {/* Progress */}
            <div className="glass-card-vi rounded-2xl p-6">
              <p className="text-xs uppercase tracking-widest text-[#859586] mb-4">Progress</p>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#859586]">Saved</span>
                <span className="font-mono text-[#dce5df]">{formatINR(goal.currentValue)}</span>
              </div>
              <div className="h-3 bg-[#1a2420] rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, goal.progressPercent)}%`, background: color }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#859586]">{goal.progressPercent.toFixed(1)}%</span>
                <span className="font-mono text-[#859586]">{formatINR(goal.targetAmount)} target</span>
              </div>
            </div>

            {/* SIP Status */}
            <div className="glass-card-vi rounded-2xl p-6 space-y-4">
              <p className="text-xs uppercase tracking-widest text-[#859586]">SIP Status</p>
              <div className="flex justify-between">
                <span className="text-sm text-[#859586]">Current SIP</span>
                <span className="font-mono text-sm text-[#dce5df]">{formatINR(goal.monthlySip)}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#859586]">Recommended</span>
                <span className="font-mono text-sm" style={{ color: goal.monthlySip >= goal.recommendedSip ? '#44f593' : '#f59e0b' }}>
                  {formatINR(goal.recommendedSip)}/mo
                </span>
              </div>
            </div>

          </div>

          {/* ── Right: Monte Carlo + Holdings + Suggestions ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Monte Carlo Projections — SEBI compliance hold */}
            <div className="glass-card-vi rounded-2xl p-6 text-center border border-[#44f593]/20">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 uppercase tracking-widest">Coming Soon</span>
              <p className="text-sm text-[#859586] mt-3">Monte Carlo success probability is under regulatory review and will return once SEBI IA registration is complete.</p>
            </div>

            {/* Contributing Holdings */}
            {holdings.length > 0 && (
              <div className="glass-card-vi rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <p className="text-xs uppercase tracking-widest text-[#859586]">Contributing Funds</p>
                  <span className="text-xs text-[#859586]">{holdings.length} fund{holdings.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-3">
                  {holdings.map(h => (
                    <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#dce5df] font-medium line-clamp-1">{h.fundName}</p>
                        <p className="text-xs text-[#859586]">{h.units.toFixed(3)} units · NAV {formatINR(h.latestNav)}</p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="font-mono text-sm text-[#dce5df]">{formatINR(h.currentValue)}</p>
                        <p className="text-xs text-[#859586]">{h.allocationPct}% allocated</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Smart Suggestions — SEBI compliance hold */}
            <div className="glass-card-vi rounded-2xl p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-3">Smart Suggestions</p>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 uppercase tracking-widest">Coming Soon</span>
              <p className="text-sm text-[#859586] mt-3">Portfolio transition recommendations (STP, fund-swap, LTCG harvest) require SEBI Investment Adviser registration and are coming soon.</p>
            </div>

            {/* No holdings yet */}
            {holdings.length === 0 && (
              <div className="glass-card-vi rounded-2xl p-8 text-center">
                <p className="text-[#859586] text-sm mb-4">No funds linked to this goal yet.</p>
                <Link
                  href="/funds/search"
                  className="text-[#44f593] text-sm font-bold hover:underline"
                >
                  Browse funds to link →
                </Link>
              </div>
            )}
          </div>
        </div>
        <ComplianceDisclaimer variant="goals_detail" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
