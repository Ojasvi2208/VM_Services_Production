'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';
import { useAuth } from '@/context/AuthContext';

// ─── Features ────────────────────────────────────────────────
// SEBI_COMPLIANCE_HOLD: Advisory features removed. Only MFD-safe features listed.
const FREE_FEATURES = [
  'Fund search & discovery',
  'Portfolio tracking (XIRR, P&L)',
  'Goal progress tracker',
  'Market data & news feed',
  'NAV change alerts',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Portfolio overlap detection',
  'Fund performance indicators & scoring',
  'LTCG / STCG tax liability calculator',
  'LTCG harvest window tracker (data only)',
  'Advanced analytics (Sharpe, Sortino, vol)',
  'SIP performance per instalment',
  'Capital gains statement PDF export',
  'Sector & AMC allocation heatmaps',
  'Priority support',
  'Early access to new features',
];

// ─── Pricing ─────────────────────────────────────────────────
const PRO_PRICE = 99; // ₹99/year — single price, no cycles, impulse buy territory

// ─── Tick icon ───────────────────────────────────────────────
function Tick({ color = '#44f593' }: { color?: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function PremiumPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [transactionId, setTransactionId] = useState('');
  const [upiRef, setUpiRef]               = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [claimStatus, setClaimStatus]     = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg]           = useState('');

  const isPremium = (user as any)?.is_premium ?? false;

  const handleClaim = async () => {
    if (!isAuthenticated) {
      router.push('/auth/signin?redirect=/premium');
      return;
    }
    if (!transactionId.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const r = await fetch('/api/premium/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transactionId.trim(),
          upiRef: upiRef.trim() || undefined,
          amount: PRO_PRICE,
          plan: 'pro',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to submit claim');
      setClaimStatus('success');
    } catch (e: any) {
      setErrorMsg(e.message);
      setClaimStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#060d0a] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[1100px] mx-auto flex-1 w-full">

        {/* Page header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-[#44f593] text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#44f593]" />
            Upgrade to Pro
          </div>
          <h1 className="font-['Space_Grotesk'] font-bold text-4xl md:text-5xl text-[#dce5df] tracking-tight mb-4">
            Unlock the full<br />wealth engine
          </h1>
          <p className="text-[#859586] text-base max-w-md mx-auto">
            Portfolio overlap, fund scoring, tax tools, and advanced analytics — all for just ₹99/year.
          </p>
        </div>

        {/* ── Two-Column: Free vs Pro ───────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">

          {/* Free Plan */}
          <div className="rounded-2xl p-6 border border-white/5 bg-[#0d1512] flex flex-col">
            <p className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-4">Free</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-mono text-4xl font-bold text-[#dce5df]">₹0</span>
              <span className="text-sm text-[#859586]">forever</span>
            </div>
            <p className="text-xs text-[#859586] mb-6">Essential tracking for every investor.</p>
            <ul className="space-y-2.5 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-[#c0c9c2]">
                  <Tick color="#859586" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 py-2.5 rounded-xl text-center text-sm font-bold bg-white/5 text-[#859586]">
              Current Plan
            </div>
          </div>

          {/* Pro Plan */}
          <div className="relative rounded-2xl p-6 border border-[#44f593]/50 bg-[#44f593]/5 shadow-lg shadow-[#44f593]/5 flex flex-col">
            <span className="absolute -top-3 left-6 px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-[#44f593] text-[#001f10] rounded-full">
              RECOMMENDED
            </span>
            <p className="text-xs uppercase tracking-widest text-[#44f593] font-bold mb-4 mt-1">Pro</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-mono text-4xl font-bold text-[#dce5df]">₹{PRO_PRICE}</span>
              <span className="text-sm text-[#859586]">/year</span>
            </div>
            <p className="text-xs text-[#859586] mb-4">Full suite for serious wealth builders.</p>
            <p className="text-[10px] text-[#44f593]/70 font-mono mb-6">Less than ₹2/week · Less than a cup of tea/month</p>
            <ul className="space-y-2.5">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-[#c0c9c2]">
                  <Tick color="#44f593" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Coming Soon — Advisory features */}
        <div className="mb-12 p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">Coming Soon — Requires SEBI IA Registration</p>
          <ul className="text-xs text-[#859586] space-y-1.5">
            <li className="flex items-center gap-2"><span className="text-amber-400">◦</span> AI-powered goal success probability (Monte Carlo)</li>
            <li className="flex items-center gap-2"><span className="text-amber-400">◦</span> Portfolio transition recommendations (STP engine)</li>
            <li className="flex items-center gap-2"><span className="text-amber-400">◦</span> LTCG harvest optimization with actionable suggestions</li>
            <li className="flex items-center gap-2"><span className="text-amber-400">◦</span> AI portfolio rebalancing (CFO Suite)</li>
          </ul>
          <p className="text-[10px] text-[#859586] mt-3">These features require SEBI Investment Adviser registration. We are in the process of setting up a separate entity for advisory services.</p>
        </div>

        {/* ── Already premium / Claim form ──────────────────────── */}
        {isPremium ? (
          <div className="glass-card-vi rounded-2xl p-8 text-center border border-[#44f593]/30 bg-[#44f593]/5">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="font-['Space_Grotesk'] font-bold text-xl text-[#44f593] mb-2">You&apos;re already on Pro</h3>
            <p className="text-[#859586] text-sm mb-6">All premium features are unlocked on your account.</p>
            <Link
              href="/portfolio"
              className="inline-block bg-[#44f593] text-[#001f10] px-8 py-3 rounded-xl font-bold hover:bg-[#25e283] transition-colors"
            >
              Go to Portfolio
            </Link>
          </div>
        ) : claimStatus === 'success' ? (
          <div className="glass-card-vi rounded-2xl p-8 text-center border border-[#44f593]/30 bg-[#44f593]/5">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="font-['Space_Grotesk'] font-bold text-xl text-[#44f593] mb-2">Claim submitted!</h3>
            <p className="text-[#859586] text-sm max-w-sm mx-auto">
              Your Pro (₹99/year) payment is under review. Access will be activated within 24 hours once verified.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* UPI payment */}
            <div className="glass-card-vi rounded-2xl p-6 flex flex-col gap-5">
              <h3 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df]">
                Step 1 — Pay ₹{PRO_PRICE}
              </h3>
              <p className="text-sm text-[#859586]">
                Send exactly <span className="text-[#44f593] font-bold font-mono">₹{PRO_PRICE}</span> via UPI to:
              </p>
              <div className="flex items-center justify-between p-4 bg-[#161d1a] border border-[#3c4a3e] rounded-xl">
                <span className="font-mono text-lg text-[#dce5df] font-bold">malikojasvi@ybl</span>
                <button
                  onClick={() => navigator.clipboard?.writeText('malikojasvi@ybl')}
                  className="text-xs text-[#44f593] hover:underline font-bold uppercase tracking-widest"
                >
                  Copy
                </button>
              </div>

              <div className="flex flex-col items-center justify-center rounded-xl border border-[#3c4a3e] bg-[#0d1512] p-5">
                <div className="bg-white rounded-lg p-3 mb-3">
                  <img
                    src="/images/Phonepe_qr.png"
                    alt="Scan to pay via UPI — Vijay Malik Financial Services"
                    className="w-44 h-44 object-contain"
                  />
                </div>
                <p className="text-xs text-[#44f593] font-bold font-['Space_Grotesk'] tracking-wide">Vijay Malik Financial Services</p>
                <p className="text-[10px] text-[#859586] font-mono mt-1">₹{PRO_PRICE}/year · UPI: malikojasvi@ybl</p>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <p className="text-[10px] text-amber-400 leading-relaxed">
                  <span className="font-bold">Important:</span> Send exactly ₹{PRO_PRICE} only. The QR is linked to our UPI ID. Your UPI app may show &quot;Ojasvi Malik&quot; as the payee — this is correct.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#161d1a] border border-white/5">
                <p className="text-xs text-[#859586] font-bold mb-1">Selected Plan</p>
                <p className="text-sm text-[#44f593] font-bold">Pro — ₹{PRO_PRICE}/year</p>
              </div>

              <a
                href={`upi://pay?pa=malikojasvi@ybl&pn=Vijay%20Malik%20Financial%20Services&am=${PRO_PRICE}&cu=INR&tn=VMFS%20Pro%20Annual`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#44f593]/30 bg-[#44f593]/5 text-[#44f593] font-bold text-sm hover:bg-[#44f593]/10 transition-colors"
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>phone_android</span>
                Pay ₹{PRO_PRICE} via UPI App
              </a>
              <p className="text-[10px] text-[#859586] font-mono leading-relaxed text-center">
                Opens your UPI app with ₹{PRO_PRICE} pre-filled. Or scan the QR above. Note down UTR / transaction ID after payment.
              </p>
            </div>

            {/* Claim form */}
            <div className="glass-card-vi rounded-2xl p-6 flex flex-col gap-5">
              <h3 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df]">Step 2 — Submit claim</h3>

              {!isAuthenticated && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-xs text-amber-400 font-bold mb-2">Sign in required</p>
                  <p className="text-xs text-[#859586]">You must be signed in to submit a claim.</p>
                  <Link
                    href="/auth/signin?redirect=/premium"
                    className="inline-block mt-3 text-xs font-bold text-[#44f593] hover:underline"
                  >
                    Sign in →
                  </Link>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">
                    UPI Transaction ID <span className="text-[#ffb4ab]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 407890123456"
                    value={transactionId}
                    onChange={e => setTransactionId(e.target.value)}
                    disabled={!isAuthenticated}
                    className="w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#859586] focus:outline-none focus:border-[#44f593]/50 disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">
                    UTR / UPI Ref <span className="text-[#859586]">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="UTR reference if available"
                    value={upiRef}
                    onChange={e => setUpiRef(e.target.value)}
                    disabled={!isAuthenticated}
                    className="w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#859586] focus:outline-none focus:border-[#44f593]/50 disabled:opacity-40"
                  />
                </div>
              </div>

              {claimStatus === 'error' && (
                <p className="text-xs text-[#ffb4ab] font-bold">{errorMsg}</p>
              )}

              <button
                onClick={handleClaim}
                disabled={submitting || !transactionId.trim() || !isAuthenticated}
                className="w-full bg-[#44f593] text-[#001f10] font-bold py-3.5 rounded-xl hover:bg-[#25e283] transition-colors active:scale-95 disabled:opacity-40"
              >
                {submitting ? 'Submitting…' : `Claim Pro — ₹${PRO_PRICE}/year`}
              </button>

              <p className="text-xs text-[#859586] font-mono leading-relaxed">
                Claims are manually verified within 24 hours. Your Pro access will be activated by email once approved.
              </p>
            </div>
          </div>
        )}

        <ComplianceDisclaimer variant="premium" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
