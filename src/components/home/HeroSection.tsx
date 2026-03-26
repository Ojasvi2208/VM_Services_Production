'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// ─── Helpers ─────────────────────────────────────────────────
function fmtINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// ─── HeroSection ─────────────────────────────────────────────
// Two-column hero: left = headline + CTAs, right = net worth card
// Unauthenticated: blur with hardcoded demo values
// Authenticated: live data from /api/portfolio/summary + /api/portfolio/holdings
// ─────────────────────────────────────────────────────────────

interface PortfolioData {
  currentValue: number;
  totalInvested: number;
  totalReturns: number;
  returnsPercentage: number;
  holdingsCount: number;
}

interface CategoryBreakdown {
  label: string;
  value: number;
}

export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      fetch('/api/portfolio/summary').then(r => r.ok ? r.json() : null),
      fetch('/api/portfolio/holdings').then(r => r.ok ? r.json() : null),
    ]).then(([summaryData, holdingsData]) => {
      if (summaryData?.success && summaryData.summary) {
        setPortfolio({
          currentValue: summaryData.summary.currentValue ?? 0,
          totalInvested: summaryData.summary.totalInvested ?? 0,
          totalReturns: summaryData.summary.totalReturns ?? 0,
          returnsPercentage: summaryData.summary.returnsPercentage ?? 0,
          holdingsCount: summaryData.summary.holdingsCount ?? 0,
        });
      }
      if (holdingsData?.success && holdingsData.holdings) {
        // Group by category
        const catMap: Record<string, number> = {};
        for (const h of holdingsData.holdings) {
          const cat = h.category || 'Other';
          catMap[cat] = (catMap[cat] || 0) + (h.currentValue || 0);
        }
        const sorted = Object.entries(catMap)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 3); // Top 3 categories
        setBreakdown(sorted);
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  return (
    <section
      className="max-w-7xl mx-auto px-8 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
      aria-labelledby="hero-headline"
    >
      {/* ── LEFT COLUMN ──────────────────────────────────────── */}
      <div className="space-y-8">

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#242c28] border border-[#3c4a3e]/20">
          <span className="w-2 h-2 rounded-full bg-[#44f593] animate-pulse" aria-hidden="true" />
          <span className="text-sm font-['JetBrains_Mono'] uppercase tracking-widest text-[#44f593]">
            Institutional Grade Engine Active
          </span>
        </div>

        {/* Headline */}
        <h1
          id="hero-headline"
          className="font-['Space_Grotesk'] font-bold leading-[0.9] tracking-tighter text-[#dce5df]"
          style={{ fontSize: 'clamp(3.5rem,6.5vw,5.75rem)' }}
        >
          Your Wealth.<br />
          <span className="text-[#44f593]">Growing Smarter.</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-xl text-[#859586] max-w-lg leading-relaxed">
          Deploying professional-grade risk modeling and algorithmic rebalancing for the next generation of capital.
        </p>

        {/* CTAs — auth-aware */}
        <div className="flex flex-wrap gap-4">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="bg-gradient-to-r from-[#44f593] to-[#00d87a] text-[#00391c] px-8 py-4 rounded-xl font-bold text-xl transition-all active:scale-[0.98]"
              style={{ boxShadow: '0 0 40px -10px rgba(0,216,122,0.4)' }}
            >
              Open Dashboard
            </Link>
          ) : (
            <Link
              href="/auth/signup"
              className="bg-gradient-to-r from-[#44f593] to-[#00d87a] text-[#00391c] px-8 py-4 rounded-xl font-bold text-xl transition-all active:scale-[0.98]"
              style={{ boxShadow: '0 0 40px -10px rgba(0,216,122,0.4)' }}
            >
              Join Us
            </Link>
          )}
          <Link
            href="/markets"
            className="px-8 py-4 rounded-xl border border-[#3c4a3e] text-[#c4cfc9] font-bold text-xl hover:bg-[#242c28] transition-all"
          >
            View Performance
          </Link>
        </div>
      </div>

      {/* ── RIGHT COLUMN — Net Worth Card ───────────────────── */}
      <div className="relative group">
        {/* Ambient glow */}
        <div
          className="absolute -inset-1 rounded-2xl blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000 pointer-events-none"
          style={{ background: 'linear-gradient(to right, rgba(68,245,147,0.2), transparent)' }}
          aria-hidden="true"
        />

        {/* Glass card */}
        <div
          className="relative rounded-2xl p-10 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
          role="region"
          aria-label="Portfolio summary"
        >
          {/* Card content — blurred when not authenticated */}
          <div className={isAuthenticated ? '' : 'select-none'}>
            <div
              className="transition-all duration-500"
              style={isAuthenticated ? {} : { filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none' }}
              aria-hidden={!isAuthenticated}
            >
              {/* Header row */}
              <div className="flex justify-between items-start mb-12">
                <div>
                  <p className="text-[#859586] text-base font-['Inter'] uppercase tracking-widest mb-2">Total Net Worth</p>
                  <h2 className="text-6xl font-['JetBrains_Mono'] font-medium text-[#dce5df] tracking-tighter">
                    {portfolio ? fmtINR(portfolio.currentValue) : '₹—'}
                  </h2>
                </div>
                {portfolio && (
                  <div className={`${portfolio.returnsPercentage >= 0 ? 'bg-[#44f593]/10 text-[#44f593] border-[#44f593]/20' : 'bg-red-500/10 text-red-400 border-red-400/20'} px-3 py-1.5 rounded-lg border flex items-center gap-2`}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {portfolio.returnsPercentage >= 0 ? 'trending_up' : 'trending_down'}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-base font-bold">
                      {portfolio.returnsPercentage >= 0 ? '+' : ''}{portfolio.returnsPercentage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Line items — live category breakdown from holdings */}
              <div className="space-y-6">
                {breakdown.length > 0 ? breakdown.map((cat, i) => (
                  <div key={cat.label} className={`flex justify-between items-end ${i < breakdown.length - 1 ? 'border-b border-white/5 pb-4' : ''}`}>
                    <span className="text-[#859586] text-base">{cat.label}</span>
                    <span className="font-['JetBrains_Mono'] text-[#dce5df]">{fmtINR(cat.value)}</span>
                  </div>
                )) : (
                  <>
                    <div className="flex justify-between items-end border-b border-white/5 pb-4">
                      <span className="text-[#859586] text-base">Invested</span>
                      <span className="font-['JetBrains_Mono'] text-[#dce5df]">{portfolio ? fmtINR(portfolio.totalInvested) : '₹—'}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[#859586] text-base">Returns</span>
                      <span className={`font-['JetBrains_Mono'] ${portfolio && portfolio.totalReturns >= 0 ? 'text-[#44f593]' : 'text-red-400'}`}>
                        {portfolio ? `${portfolio.totalReturns >= 0 ? '+' : ''}${fmtINR(portfolio.totalReturns)}` : '₹—'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sign-in gate overlay — shown only when not authenticated */}
          {!isAuthenticated && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-2xl"
              style={{ background: 'rgba(6,13,10,0.5)', backdropFilter: 'blur(2px)' }}>
              {/* Lock icon */}
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(68,245,147,0.08)', border: '1px solid rgba(68,245,147,0.2)' }}>
                <span className="material-symbols-outlined text-2xl text-[#44f593]"
                  style={{ fontVariationSettings: "'FILL' 0" }}>
                  lock
                </span>
              </div>

              <div className="text-center px-6">
                <p className="font-['Space_Grotesk'] font-bold text-[#dce5df] text-xl mb-1">Your Portfolio Awaits</p>
                <p className="text-[#859586] text-base font-['Inter']">Sign in to import your CAS and see your live portfolio</p>
              </div>

              {/* Primary: sign up (new user acquisition) */}
              <Link
                href="/auth/signup?redirect=/portfolio"
                className="px-7 py-3 rounded-xl font-['Space_Grotesk'] font-bold text-[#00391c] transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #44f593 0%, #00d87a 100%)',
                  boxShadow: '0 0 24px rgba(68,245,147,0.25)',
                }}
              >
                Get Started Free
              </Link>

              {/* Secondary: existing users */}
              <Link
                href="/auth/signin?redirect=/portfolio"
                className="text-[#44f593] text-sm font-['Inter'] hover:underline"
              >
                Already have an account? Sign In →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
