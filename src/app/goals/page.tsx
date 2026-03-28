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

// ─── Helpers ──────────────────────────────────────────────────

function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function targetDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const years = Math.round((d.getTime() - Date.now()) / (365.25 * 86400000));
  if (years <= 0) return 'Due';
  if (years === 1) return '1 yr left';
  return `${years} yrs left`;
}

function targetYear(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString();
}

const CRIT_LABEL: Record<string, string> = { critical: 'Critical', important: 'Important', normal: 'Normal' };

// ─── Progress Ring ───────────────────────────────────────────

function ProgressRing({ percent, color, size = 160 }: { percent: number; color: string; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, percent) / 100);
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a2420" strokeWidth="12" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-1000" />
    </svg>
  );
}

// ─── Goal Sidebar Card ───────────────────────────────────────

function GoalSidebarCard({ goal, isSelected, onClick }: { goal: Goal; isSelected: boolean; onClick: () => void }) {
  const progressColor = goal.progressPercent >= 80 ? '#44f593' : goal.progressPercent >= 40 ? '#f59e0b' : '#ff4757';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 md:p-5 rounded-xl transition-all ${
        isSelected
          ? 'bg-[#2f3733] border-l-4 border-[#44f593]'
          : 'bg-[#161d1a] hover:bg-[#1a2420] border-l-4 border-transparent'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
          style={{ background: `${goal.color}18`, border: `1px solid ${goal.color}30` }}>
          {goal.icon && /\p{Emoji}/u.test(goal.icon) ? (
            <span className="text-base">{goal.icon}</span>
          ) : (
            <span className="material-symbols-outlined text-lg" style={{ color: goal.color || '#44f593', fontVariationSettings: "'FILL' 1" }}>
              {goal.icon === 'graduation' ? 'school' : goal.icon || 'flag'}
            </span>
          )}
        </div>
        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${
          goal.criticality === 'critical' ? 'bg-red-500/10 text-red-400' : 'bg-[#44f593]/10 text-[#44f593]'
        }`}>
          {CRIT_LABEL[goal.criticality] ?? 'Goal'}
        </span>
      </div>
      <h4 className="font-['Space_Grotesk'] font-bold text-[#dce5df] text-base mb-1 line-clamp-1">{goal.name}</h4>
      <p className="text-xs text-[#859586] mb-3">Target: {formatINR(goal.targetAmount)} by {targetYear(goal.targetDate)}</p>
      <div className="w-full bg-[#08100d] h-1.5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, goal.progressPercent)}%`, background: progressColor }} />
      </div>
      <div className="flex justify-between mt-2 font-mono text-[10px]" style={{ color: progressColor }}>
        <span>{goal.progressPercent.toFixed(0)}% REACHED</span>
        <span>{formatINR(goal.currentValue)}</span>
      </div>
    </button>
  );
}

// ─── Goal Detail Panel ───────────────────────────────────────

function GoalDetailPanel({ goal, onDelete }: { goal: Goal; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const progressColor = goal.progressPercent >= 80 ? '#44f593' : goal.progressPercent >= 40 ? '#f59e0b' : '#ff4757';
  const remaining = Math.max(0, goal.targetAmount - goal.currentValue);
  const monthsLeft = Math.max(1, Math.round((new Date(goal.targetDate).getTime() - Date.now()) / (30.44 * 86400000)));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="p-6 md:p-8 bg-[#161d1a] rounded-2xl border border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Progress Ring */}
          <div className="flex flex-col items-center text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#859586] font-bold mb-6">Goal Progress</p>
            <div className="relative">
              <ProgressRing percent={goal.progressPercent} color={progressColor} size={180} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-3xl font-bold text-[#dce5df]">{goal.progressPercent.toFixed(0)}%</span>
                <span className="text-[10px] font-bold uppercase mt-1" style={{ color: progressColor }}>
                  {goal.progressPercent >= 80 ? 'On Track' : goal.progressPercent >= 40 ? 'Building' : 'Early Stage'}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-[#859586]">{formatINR(goal.currentValue)} of {formatINR(goal.targetAmount)}</p>
          </div>

          {/* Goal Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#08100d] rounded-xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-1 font-bold">Target Amount</p>
              <p className="font-mono text-lg font-medium text-[#dce5df]">{formatINR(goal.targetAmount)}</p>
            </div>
            <div className="p-4 bg-[#08100d] rounded-xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-1 font-bold">Saved So Far</p>
              <p className="font-mono text-lg font-medium text-[#44f593]">{formatINR(goal.currentValue)}</p>
            </div>
            <div className="p-4 bg-[#08100d] rounded-xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-1 font-bold">Remaining</p>
              <p className="font-mono text-lg font-medium text-[#ffb4ab]">{formatINR(remaining)}</p>
            </div>
            <div className="p-4 bg-[#08100d] rounded-xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-1 font-bold">Monthly SIP</p>
              <p className="font-mono text-lg font-medium text-[#dce5df]">{formatINR(goal.monthlySip)}</p>
            </div>
            <div className="p-4 bg-[#08100d] rounded-xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-1 font-bold">Target Date</p>
              <p className="font-mono text-lg font-medium text-[#dce5df]">{targetYear(goal.targetDate)}</p>
            </div>
            <div className="p-4 bg-[#08100d] rounded-xl border border-white/5">
              <p className="text-[10px] text-[#859586] uppercase tracking-wider mb-1 font-bold">Months Left</p>
              <p className="font-mono text-lg font-medium text-[#dce5df]">{monthsLeft}</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Features — Coming Soon */}
      <div className="p-6 bg-[#161d1a] rounded-2xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Space_Grotesk'] font-bold text-sm uppercase tracking-widest text-[#859586]">AI Intelligence</h3>
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 uppercase tracking-widest">Coming Soon</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: 'analytics', label: 'Monte Carlo Probability', desc: 'Success % from 10k simulations' },
            { icon: 'swap_horiz', label: 'Smart Transitions (STP)', desc: 'Tax-optimized fund transitions' },
            { icon: 'auto_awesome', label: 'AI Portfolio Scoring', desc: 'Fund health & rebalancing' },
          ].map(f => (
            <div key={f.label} className="p-4 bg-[#08100d] rounded-xl border border-white/5 opacity-50">
              <span className="material-symbols-outlined text-[#859586] text-xl mb-2 block" style={{ fontVariationSettings: "'FILL' 0" }}>{f.icon}</span>
              <p className="text-xs font-bold text-[#dce5df] mb-1">{f.label}</p>
              <p className="text-[10px] text-[#859586]">{f.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#859586] mt-3">Requires SEBI Investment Adviser registration. We are in the process of setting up a separate entity.</p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/goals/${goal.id}`}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#44f593] text-[#001f10] font-bold rounded-xl text-sm hover:bg-[#25e283] transition-colors active:scale-95">
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>open_in_new</span>
          View Full Details
        </Link>
        <button
          onClick={() => {
            if (confirmDelete) {
              onDelete(goal.id);
              setConfirmDelete(false);
            } else {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 3000);
            }
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors active:scale-95 ${
            confirmDelete
              ? 'bg-red-500/20 border border-red-500/40 text-red-400'
              : 'border border-white/10 text-[#859586] hover:text-red-400 hover:border-red-400/30'
          }`}
        >
          <span className="material-symbols-outlined text-base">delete</span>
          {confirmDelete ? 'Click to Confirm Delete' : 'Delete Goal'}
        </button>
      </div>
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
      <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-[#dce5df] mb-3">No goals yet</h2>
      <p className="text-[#859586] text-sm max-w-xs mb-8">
        Set a financial goal and track your SIP progress toward your target.
      </p>
      <Link href="/goals/new"
        className="bg-[#44f593] text-[#001f10] font-bold px-8 py-3 rounded-xl hover:bg-[#25e283] transition-colors">
        Create Your First Goal
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function GoalsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin?redirect=/goals');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/goals').then(r => r.json()).then((data) => {
      if (data?.goals) {
        setGoals(data.goals);
        setSummary(data.summary);
        if (data.goals.length > 0 && !selectedGoalId) {
          setSelectedGoalId(data.goals[0].id);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteGoal = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = goals.filter(g => g.id !== goalId);
        setGoals(remaining);
        if (summary) setSummary({ ...summary, totalGoals: summary.totalGoals - 1 });
        if (selectedGoalId === goalId) {
          setSelectedGoalId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch {}
  };

  const selectedGoal = goals.find(g => g.id === selectedGoalId) ?? null;

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="bg-[#060d0a] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-4 md:px-6 lg:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-['Space_Grotesk'] font-bold text-4xl md:text-5xl text-[#dce5df] tracking-tight mb-2">
              Wealth Goals
            </h1>
            <p className="text-[#859586] text-sm">
              Track your financial goals · SIP progress · Tax computation
            </p>
          </div>
          <Link href="/goals/new"
            className="flex items-center gap-2 bg-[#44f593] text-[#001f10] font-bold px-6 py-3 rounded-xl hover:bg-[#25e283] transition-colors active:scale-95 shrink-0">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            New Goal
          </Link>
        </div>

        {/* ── Regulatory Notice ── */}
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
            {/* ── KPI Summary ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
              <div className="bg-[#161d1a] p-4 md:p-6 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#859586] font-bold mb-2">Total Target</p>
                <div className="flex items-end justify-between">
                  <h3 className="font-mono text-lg md:text-2xl font-medium text-[#dce5df]">{summary ? formatINR(summary.totalTargetValue) : '—'}</h3>
                </div>
              </div>
              <div className="bg-[#161d1a] p-4 md:p-6 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#859586] font-bold mb-2">Total Saved</p>
                <div className="flex items-end justify-between">
                  <h3 className="font-mono text-lg md:text-2xl font-medium text-[#44f593]">{summary ? formatINR(summary.totalCurrentValue) : '—'}</h3>
                  <span className="text-[#44f593] text-xs font-bold">{summary ? `${summary.overallProgressPercent.toFixed(1)}%` : ''}</span>
                </div>
              </div>
              <div className="bg-[#161d1a] p-4 md:p-6 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#859586] font-bold mb-2">Monthly SIP</p>
                <h3 className="font-mono text-lg md:text-2xl font-medium text-[#dce5df]">{summary ? formatINR(summary.totalMonthlySip) : '—'}</h3>
              </div>
              <div className="bg-[#161d1a] p-4 md:p-6 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#859586] font-bold mb-2">Time Horizon</p>
                <h3 className="font-mono text-lg md:text-2xl font-medium text-[#dce5df]">
                  {goals.length > 0 ? targetDateLabel(goals.reduce((a, b) => new Date(a.targetDate) > new Date(b.targetDate) ? a : b).targetDate) : '—'}
                </h3>
              </div>
            </div>

            {/* ── Split Layout: Goal List + Detail ── */}
            <div className="flex flex-col lg:flex-row gap-6">

              {/* Left: Goal List Sidebar */}
              <aside className="w-full lg:w-[380px] flex flex-col gap-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-['Space_Grotesk'] font-bold text-sm uppercase tracking-widest text-[#859586]">Your Goals</h2>
                  <span className="text-xs text-[#859586]">{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</span>
                </div>
                {goals.map(goal => (
                  <GoalSidebarCard
                    key={goal.id}
                    goal={goal}
                    isSelected={goal.id === selectedGoalId}
                    onClick={() => setSelectedGoalId(goal.id)}
                  />
                ))}
              </aside>

              {/* Right: Selected Goal Detail */}
              <section className="flex-1 min-w-0">
                {selectedGoal ? (
                  <GoalDetailPanel goal={selectedGoal} onDelete={handleDeleteGoal} />
                ) : (
                  <div className="flex items-center justify-center py-20 text-[#859586] text-sm">
                    Select a goal from the list
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        <ComplianceDisclaimer variant="goals" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
