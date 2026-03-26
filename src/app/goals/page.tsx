'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';
import { useAuth } from '@/context/AuthContext';

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
  totalContributed: number;
  notes?: string;
}

interface GoalSummary {
  totalGoals: number;
  totalTargetValue: number;
  totalCurrentValue: number;
  totalMonthlySip: number;
  overallProgressPercent: number;
  criticalGoalsOnTrack: number;
  criticalGoalsAtRisk: number;
}

// SEBI_COMPLIANCE_HOLD: EvalFlag interface removed — advisory feature
// interface EvalFlag {
//   goalId: string;
//   flag: 'green' | 'amber' | 'red';
//   flagReason: string;
//   suggestedAction: string;
//   successProbability: number;
// }

// SEBI_COMPLIANCE_HOLD: OverallStatus interface removed — advisory feature
// interface OverallStatus {
//   totalGoals: number;
//   green: number;
//   amber: number;
//   red: number;
// }

// ─── Helpers ──────────────────────────────────────────────────

function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function targetDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const years = Math.round((d.getTime() - Date.now()) / (365.25 * 86400000));
  if (years <= 0) return 'Due';
  if (years === 1) return '1 yr left';
  return `${years} yrs left`;
}

// SEBI_COMPLIANCE_HOLD: PULSE_STYLES removed — advisory feature
// const PULSE_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
//   green: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400', label: 'On Track' },
//   amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400', label: 'At Risk' },
//   red:   { bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/30',   dot: 'bg-red-400',   label: 'Off Track' },
// };

const CRITICALITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  important: 'Important',
  normal: 'Normal',
};

// ─── Goal Card ────────────────────────────────────────────────

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="glass-card-vi rounded-2xl p-6 flex flex-col gap-4 hover:border-[#44f593]/30 transition-all duration-300 group relative"
    >
      {/* ── Delete button ── */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirmDelete) {
            onDelete(goal.id);
          } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
          }
        }}
        className={`absolute top-4 right-4 z-10 p-1.5 rounded-lg transition-all ${
          confirmDelete
            ? 'bg-red-500/20 border border-red-500/40 text-red-400'
            : 'opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-red-500/10 text-[#859586] hover:text-red-400'
        }`}
        title={confirmDelete ? 'Click again to confirm delete' : 'Delete goal'}
      >
        {confirmDelete ? (
          <span className="text-[10px] font-bold px-1">Confirm?</span>
        ) : (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        )}
      </button>

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: `${goal.color}18`, border: `1px solid ${goal.color}30` }}
          >
            {goal.icon && /\p{Emoji}/u.test(goal.icon) ? (
              <span>{goal.icon}</span>
            ) : (
              <span
                className="material-symbols-outlined text-xl"
                style={{ color: goal.color || '#44f593', fontVariationSettings: "'FILL' 1" }}
              >
                {goal.icon === 'graduation' ? 'school' : goal.icon || 'flag'}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-['Space_Grotesk'] font-bold text-[#dce5df] group-hover:text-[#44f593] transition-colors line-clamp-1">
              {goal.name}
            </h3>
            <span className="text-xs uppercase tracking-widest text-[#859586]">
              {CRITICALITY_LABEL[goal.criticality] ?? 'Goal'} · {targetDateLabel(goal.targetDate)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-[#859586]">Progress</span>
          <span className="font-['JetBrains_Mono'] text-[#dce5df]">{goal.progressPercent.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-[#1a2420] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, goal.progressPercent)}%`,
              background: goal.progressPercent >= 80 ? '#44f593' : goal.progressPercent >= 40 ? '#f59e0b' : '#ff4757',
            }}
          />
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 gap-4 pt-1">
        <div>
          <p className="text-xs uppercase text-[#859586] tracking-widest mb-0.5">Saved</p>
          <p className="font-['JetBrains_Mono'] text-sm text-[#dce5df]">{formatINR(goal.currentValue)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[#859586] tracking-widest mb-0.5">Target</p>
          <p className="font-['JetBrains_Mono'] text-sm text-[#dce5df]">{formatINR(goal.targetAmount)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[#859586] tracking-widest mb-0.5">Monthly SIP</p>
          <p className="font-['JetBrains_Mono'] text-sm text-[#dce5df]">{formatINR(goal.monthlySip)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-[#859586] tracking-widest mb-0.5">AI Pulse</p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20">SOON</span>
        </div>
      </div>
    </Link>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card-vi rounded-2xl px-6 py-5">
      <p className="text-xs uppercase tracking-widest text-[#859586] mb-2">{label}</p>
      <p className="font-['JetBrains_Mono'] text-2xl font-bold text-[#dce5df]">{value}</p>
      {sub && <p className="text-xs text-[#859586] mt-1">{sub}</p>}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center mb-6">
        <span className="text-4xl">🎯</span>
      </div>
      <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-[#dce5df] mb-3">
        No goals yet
      </h2>
      <p className="text-[#859586] text-sm max-w-xs mb-8">
        Set a financial goal and track your SIP progress toward your target.
      </p>
      <Link
        href="/goals/new"
        className="bg-[#44f593] text-[#001f10] font-bold px-8 py-3 rounded-xl hover:bg-[#25e283] transition-colors"
      >
        Create Your First Goal
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function GoalsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin?redirect=/goals');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetch('/api/goals').then(r => r.json()).then((goalsData) => {
      if (goalsData?.goals) {
        setGoals(goalsData.goals);
        setSummary(goalsData.summary);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleDeleteGoal = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
      if (res.ok) {
        setGoals(prev => prev.filter(g => g.id !== goalId));
        if (summary) {
          setSummary({ ...summary, totalGoals: summary.totalGoals - 1 });
        }
      }
    } catch {}
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="bg-[#060d0a] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* ── Page Header ───────────────────────────────────── */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="font-['Space_Grotesk'] font-bold text-4xl md:text-5xl text-[#dce5df] tracking-tight mb-2">
              Goals
            </h1>
            <p className="text-[#859586] text-sm">
              Track your financial goals · SIP progress · Tax computation
            </p>
          </div>
          <Link
            href="/goals/new"
            className="flex items-center gap-2 bg-[#44f593] text-[#001f10] font-bold px-6 py-3 rounded-xl hover:bg-[#25e283] transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            New Goal
          </Link>
        </div>

        {/* ── Regulatory Notice ────────────────────────── */}
        <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-amber-400 leading-relaxed">
            <span className="font-bold">Regulatory Notice:</span> AI-powered goal probability scores and portfolio transition suggestions are temporarily unavailable while we complete SEBI Investment Adviser registration. Goal tracking, SIP progress, and tax computation remain fully functional.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-[#44f593]/30 border-t-[#44f593] rounded-full animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── KPI Summary Strip ─────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <KPICard
                label="Total Target"
                value={summary ? formatINR(summary.totalTargetValue) : '—'}
                sub={`${summary?.totalGoals ?? 0} goals`}
              />
              <KPICard
                label="Total Saved"
                value={summary ? formatINR(summary.totalCurrentValue) : '—'}
                sub={summary ? `${summary.overallProgressPercent.toFixed(1)}% overall` : undefined}
              />
              <KPICard
                label="Monthly SIP"
                value={summary ? formatINR(summary.totalMonthlySip) : '—'}
                sub="across all goals"
              />
              <KPICard
                label="Critical Goals"
                value={summary ? `${summary.criticalGoalsOnTrack} / ${summary.criticalGoalsOnTrack + summary.criticalGoalsAtRisk}` : '—'}
                sub="on track"
              />
            </div>

            {/* ── Goals Grid ────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {goals.map(goal => (
                <GoalCard key={goal.id} goal={goal} onDelete={handleDeleteGoal} />
              ))}
            </div>
          </>
        )}

        <ComplianceDisclaimer variant="goals" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
