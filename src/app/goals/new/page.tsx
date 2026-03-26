'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';
import { useAuth } from '@/context/AuthContext';

// ─── Goal Categories ──────────────────────────────────────────

const CATEGORIES = [
  { id: 'house',       icon: '🏠', label: 'House',        color: '#6366f1', defaultReturn: 10, defaultYears: 7  },
  { id: 'education',  icon: '🎓', label: 'Education',    color: '#f59e0b', defaultReturn: 10, defaultYears: 5  },
  { id: 'retirement', icon: '🌅', label: 'Retirement',   color: '#44f593', defaultReturn: 12, defaultYears: 25 },
  { id: 'wedding',    icon: '💍', label: 'Wedding',      color: '#ec4899', defaultReturn: 10, defaultYears: 3  },
  { id: 'travel',     icon: '✈️', label: 'Travel',       color: '#06b6d4', defaultReturn: 8,  defaultYears: 2  },
  { id: 'emergency',  icon: '🛡️', label: 'Emergency',    color: '#f97316', defaultReturn: 7,  defaultYears: 1  },
  { id: 'custom',     icon: '🎯', label: 'Custom',       color: '#a855f7', defaultReturn: 12, defaultYears: 5  },
];

const RISK_PROFILES = [
  {
    id: 'conservative',
    label: 'Conservative',
    sublabel: 'Debt-heavy. Sleep well at night.',
    expectedReturn: 8,
    icon: '🛡️',
    color: '#06b6d4',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    sublabel: 'Balanced equity + debt.',
    expectedReturn: 11,
    icon: '⚖️',
    color: '#f59e0b',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    sublabel: 'Equity-heavy. High volatility.',
    expectedReturn: 14,
    icon: '🚀',
    color: '#44f593',
  },
];

// ─── Helpers ──────────────────────────────────────────────────

function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function addYears(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

function yearsFromNow(dateStr: string): number {
  return Math.max(0, (new Date(dateStr).getTime() - Date.now()) / (365.25 * 86400000));
}

// Simple SIP estimate: FV = P * [((1 + r)^n - 1) / r] * (1 + r)
function estimateSIP(target: number, years: number, returnPct: number): number {
  const months = Math.max(1, Math.round(years * 12));
  const r = returnPct / 100 / 12;
  if (r === 0) return target / months;
  const fv = target;
  const sip = fv * r / (((1 + r) ** months - 1) * (1 + r));
  return Math.ceil(sip / 100) * 100;
}

// ─── Step Indicator ───────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={[
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-["Space_Grotesk"] transition-all',
              i + 1 === current
                ? 'bg-[#44f593] text-[#001f10]'
                : i + 1 < current
                  ? 'bg-[#44f593]/20 text-[#44f593] border border-[#44f593]/30'
                  : 'bg-[#161d1a] text-[#859586] border border-white/10',
            ].join(' ')}
          >
            {i + 1 < current ? (
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
            ) : (
              i + 1
            )}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-10 transition-all ${i + 1 < current ? 'bg-[#44f593]/40' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Category ─────────────────────────────────────────

function Step1({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-[#dce5df] mb-2">What are you saving for?</h2>
      <p className="text-[#859586] text-sm mb-8">Choose the goal category that fits best.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={[
              'glass-card-vi rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-200 border-2',
              selected === cat.id
                ? 'border-[#44f593]/60 bg-[#44f593]/5'
                : 'border-transparent hover:border-white/15',
            ].join(' ')}
          >
            <span className="text-3xl">{cat.icon}</span>
            <span className="text-sm font-bold text-[#dce5df] font-['Space_Grotesk']">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Amount + Date ─────────────────────────────────────

function Step2({
  name, setName, targetAmount, setTargetAmount, targetDate, setTargetDate,
  monthlySip, setMonthlySip, estimatedSip, categoryId,
}: {
  name: string; setName: (v: string) => void;
  targetAmount: number; setTargetAmount: (v: number) => void;
  targetDate: string; setTargetDate: (v: string) => void;
  monthlySip: number; setMonthlySip: (v: number) => void;
  estimatedSip: number;
  categoryId: string;
}) {
  const cat = CATEGORIES.find(c => c.id === categoryId);

  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-[#dce5df] mb-2">Define your target</h2>
      <p className="text-[#859586] text-sm mb-8">Set the amount, timeline, and your monthly SIP.</p>

      <div className="space-y-6 max-w-lg">
        {/* Goal name */}
        <div>
          <label className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-2 block">Goal Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={cat?.label ?? 'My Goal'}
            className="w-full bg-[#161d1a] border border-white/10 rounded-xl px-4 py-3 text-[#dce5df] placeholder:text-[#859586]/50 focus:outline-none focus:border-[#44f593]/40 font-['Inter']"
          />
        </div>

        {/* Target amount */}
        <div>
          <label className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-2 block">Target Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#859586] font-['JetBrains_Mono']">₹</span>
            <input
              type="number"
              value={targetAmount || ''}
              onChange={e => setTargetAmount(Number(e.target.value))}
              placeholder="5000000"
              min={1000}
              className="w-full bg-[#161d1a] border border-white/10 rounded-xl px-4 pl-8 py-3 text-[#dce5df] placeholder:text-[#859586]/50 focus:outline-none focus:border-[#44f593]/40 font-['JetBrains_Mono']"
            />
          </div>
          {targetAmount > 0 && (
            <p className="text-xs text-[#859586] mt-1.5 font-['JetBrains_Mono']">{formatINR(targetAmount)}</p>
          )}
        </div>

        {/* Target date */}
        <div>
          <label className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-2 block">Target Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            min={addYears(0)}
            className="w-full bg-[#161d1a] border border-white/10 rounded-xl px-4 py-3 text-[#dce5df] focus:outline-none focus:border-[#44f593]/40 font-['Inter'] [color-scheme:dark]"
          />
        </div>

        {/* Monthly SIP */}
        <div>
          <label className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-2 flex items-center justify-between">
            <span>Monthly SIP</span>
            {estimatedSip > 0 && (
              <button
                onClick={() => setMonthlySip(estimatedSip)}
                className="text-[#44f593] text-[11px] hover:underline"
              >
                Use estimated: {formatINR(estimatedSip)}/mo
              </button>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#859586] font-['JetBrains_Mono']">₹</span>
            <input
              type="number"
              value={monthlySip || ''}
              onChange={e => setMonthlySip(Number(e.target.value))}
              placeholder={estimatedSip > 0 ? String(estimatedSip) : '10000'}
              min={0}
              className="w-full bg-[#161d1a] border border-white/10 rounded-xl px-4 pl-8 py-3 text-[#dce5df] placeholder:text-[#859586]/50 focus:outline-none focus:border-[#44f593]/40 font-['JetBrains_Mono']"
            />
          </div>
          <p className="text-xs text-[#859586] mt-1.5">Leave empty to get AI-recommended SIP at creation.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Risk Profile ─────────────────────────────────────

function Step3({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-[#dce5df] mb-2">Risk tolerance</h2>
      <p className="text-[#859586] text-sm mb-8">This determines the expected return used in goal progress calculations.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-2xl">
        {RISK_PROFILES.map(rp => (
          <button
            key={rp.id}
            onClick={() => onSelect(rp.id)}
            className={[
              'glass-card-vi rounded-2xl p-6 text-left border-2 transition-all duration-200',
              selected === rp.id ? 'border-[#44f593]/60 bg-[#44f593]/5' : 'border-transparent hover:border-white/15',
            ].join(' ')}
          >
            <span className="text-3xl mb-3 block">{rp.icon}</span>
            <p className="font-['Space_Grotesk'] font-bold text-[#dce5df] mb-1">{rp.label}</p>
            <p className="text-xs text-[#859586] mb-3">{rp.sublabel}</p>
            <p className="font-['JetBrains_Mono'] text-sm font-bold" style={{ color: rp.color }}>
              ~{rp.expectedReturn}% p.a.
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: Confirm ──────────────────────────────────────────

function Step4({
  categoryId, name, targetAmount, targetDate, monthlySip,
  riskProfileId, estimatedSip,
}: {
  categoryId: string; name: string; targetAmount: number;
  targetDate: string; monthlySip: number; riskProfileId: string; estimatedSip: number;
}) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  const rp = RISK_PROFILES.find(r => r.id === riskProfileId);
  const years = yearsFromNow(targetDate);

  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-2xl text-[#dce5df] mb-2">Confirm your goal</h2>
      <p className="text-[#859586] text-sm mb-8">Review and submit. Your goal will be tracked automatically.</p>

      <div className="glass-card-vi rounded-2xl p-6 max-w-lg space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{cat?.icon}</span>
          <div>
            <p className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df]">{name || cat?.label}</p>
            <p className="text-xs text-[#859586] capitalize">{cat?.label} · {rp?.label}</p>
          </div>
        </div>

        {[
          { label: 'Target Amount', value: formatINR(targetAmount) },
          { label: 'Target Date', value: new Date(targetDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) },
          { label: 'Timeline', value: `${years.toFixed(1)} years` },
          { label: 'Monthly SIP', value: monthlySip > 0 ? `${formatINR(monthlySip)}/mo` : 'AI will recommend' },
          { label: 'Expected Return', value: `~${rp?.expectedReturn}% p.a.` },
        ].map(row => (
          <div key={row.label} className="flex justify-between py-2 border-b border-white/5 last:border-0 text-sm">
            <span className="text-[#859586]">{row.label}</span>
            <span className="font-['JetBrains_Mono'] text-[#dce5df]">{row.value}</span>
          </div>
        ))}

        {estimatedSip > 0 && monthlySip === 0 && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            Estimated SIP needed: ~{formatINR(estimatedSip)}/mo to reach target with {rp?.label?.toLowerCase()} profile.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function GoalsNewPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;

  // Step 1
  const [categoryId, setCategoryId] = useState('');
  // Step 2
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState(0);
  const [targetDate, setTargetDate] = useState(addYears(5));
  const [monthlySip, setMonthlySip] = useState(0);
  // Step 3
  const [riskProfileId, setRiskProfileId] = useState('moderate');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/signin?redirect=/goals/new');
  }, [authLoading, isAuthenticated, router]);

  // Update target date when category changes
  useEffect(() => {
    const cat = CATEGORIES.find(c => c.id === categoryId);
    if (cat) setTargetDate(addYears(cat.defaultYears));
  }, [categoryId]);

  const cat = CATEGORIES.find(c => c.id === categoryId);
  const rp = RISK_PROFILES.find(r => r.id === riskProfileId);
  const years = yearsFromNow(targetDate);
  const estimatedSip = targetAmount > 0 && years > 0
    ? estimateSIP(targetAmount, years, rp?.expectedReturn ?? 11)
    : 0;

  const canProceed = () => {
    if (step === 1) return !!categoryId;
    if (step === 2) return !!name.trim() && targetAmount >= 1000 && !!targetDate;
    if (step === 3) return !!riskProfileId;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const rp = RISK_PROFILES.find(r => r.id === riskProfileId);
      const cat = CATEGORIES.find(c => c.id === categoryId);

      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || cat?.label,
          icon: cat?.icon ?? '🎯',
          color: cat?.color ?? '#6366f1',
          targetAmount,
          targetDate,
          criticality: categoryId === 'retirement' || categoryId === 'emergency' ? 'critical' : 'important',
          monthlySip: monthlySip || 0,
          expectedReturn: rp?.expectedReturn ?? 11,
          inflationRate: 6,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to create goal. Please try again.');
        return;
      }

      router.push(`/goals/${data.goal.id}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="bg-[#060d0a] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <Link
              href="/goals"
              className="text-[#859586] hover:text-[#44f593] transition-colors"
              aria-label="Back to goals"
            >
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
            </Link>
            <h1 className="font-['Space_Grotesk'] font-bold text-2xl text-[#dce5df]">Create Goal</h1>
          </div>
        </div>

        {/* ── Step Indicator ────────────────────────────────── */}
        <StepIndicator current={step} total={TOTAL_STEPS} />

        {/* ── Step Content ──────────────────────────────────── */}
        <div className="min-h-[340px]">
          {step === 1 && <Step1 selected={categoryId} onSelect={setCategoryId} />}
          {step === 2 && (
            <Step2
              name={name} setName={setName}
              targetAmount={targetAmount} setTargetAmount={setTargetAmount}
              targetDate={targetDate} setTargetDate={setTargetDate}
              monthlySip={monthlySip} setMonthlySip={setMonthlySip}
              estimatedSip={estimatedSip}
              categoryId={categoryId}
            />
          )}
          {step === 3 && <Step3 selected={riskProfileId} onSelect={setRiskProfileId} />}
          {step === 4 && (
            <Step4
              categoryId={categoryId} name={name} targetAmount={targetAmount}
              targetDate={targetDate} monthlySip={monthlySip}
              riskProfileId={riskProfileId} estimatedSip={estimatedSip}
            />
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────── */}
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mt-6 max-w-lg">
            {error}
          </p>
        )}

        {/* ── Navigation ────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-10 max-w-lg">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-[#859586] hover:text-[#dce5df] transition-colors flex items-center gap-1.5 text-sm font-bold"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
              Back
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={[
                'flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all',
                canProceed()
                  ? 'bg-[#44f593] text-[#001f10] hover:bg-[#25e283] active:scale-95'
                  : 'bg-[#161d1a] text-[#859586] cursor-not-allowed',
              ].join(' ')}
            >
              Continue
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#44f593] text-[#001f10] font-bold px-8 py-3 rounded-xl hover:bg-[#25e283] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#001f10]/30 border-t-[#001f10] rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Create Goal
                </>
              )}
            </button>
          )}
        </div>

        <ComplianceDisclaimer variant="goals" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
