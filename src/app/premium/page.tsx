import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';
import { EditorialProse } from '@/components/EditorialProse';

// ─── Features ────────────────────────────────────────────────
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
  'AI-powered goal success probability',
  'Portfolio transition recommendations',
  'AI portfolio rebalancing (CFO Suite)',
  'Priority support',
  'Early access to new features',
];

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
  return (
    <div className="bg-[#060d0a] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[1100px] mx-auto flex-1 w-full">

        {/* Page header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Coming Soon
          </div>
          <h1 className="font-['Space_Grotesk'] font-bold text-4xl md:text-5xl text-[#dce5df] tracking-tight mb-4">
            Pro is on the way
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            We are building something powerful — portfolio overlap, fund scoring, tax tools, advanced analytics, and AI-driven insights. Pro will launch soon.
          </p>
        </div>

        {/* ── Two-Column: Free vs Pro ───────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">

          {/* Free Plan — Active */}
          <div className="rounded-2xl p-6 border border-[#44f593]/30 bg-[#44f593]/5 flex flex-col">
            <p className="text-xs uppercase tracking-widest text-[#44f593] font-bold mb-4">Free</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-mono text-4xl font-bold text-[#dce5df]">&#8377;0</span>
              <span className="text-sm text-[#859586]">forever</span>
            </div>
            <p className="text-xs text-[#859586] mb-6">Essential tracking for every investor.</p>
            <ul className="space-y-2.5 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-[#c0c9c2]">
                  <Tick color="#44f593" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 py-2.5 rounded-xl text-center text-sm font-bold bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20">
              Current Plan
            </div>
          </div>

          {/* Pro Plan — Coming Soon */}
          <div className="relative rounded-2xl p-6 border border-white/10 bg-[#0d1512] flex flex-col opacity-80">
            <span className="absolute -top-3 left-6 px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-amber-500 text-[#001f10] rounded-full">
              COMING SOON
            </span>
            <p className="text-xs uppercase tracking-widest text-[#859586] font-bold mb-4 mt-1">Pro</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-mono text-4xl font-bold text-[#859586]">TBD</span>
            </div>
            <p className="text-xs text-[#859586] mb-6">Full suite for serious wealth builders. Pricing will be announced at launch.</p>
            <ul className="space-y-2.5">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-[#859586]">
                  <Tick color="#3c4a3e" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Notify Me ───────────────────────────────────── */}
        <div className="rounded-2xl p-8 border border-white/10 bg-[#0d1512] text-center mb-10">
          <span className="material-symbols-outlined text-4xl text-amber-400 mb-4 block" style={{ fontVariationSettings: "'FILL' 0" }}>notifications_active</span>
          <h3 className="font-['Space_Grotesk'] font-bold text-xl text-[#dce5df] mb-2">Get notified when Pro launches</h3>
          <p className="text-[#859586] text-sm max-w-md mx-auto mb-6">
            Sign up for a free account and we will notify you the moment Pro is available — with exclusive early-bird pricing for existing users.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block bg-[#44f593] text-[#001f10] px-8 py-3 rounded-xl font-bold hover:bg-[#25e283] transition-colors active:scale-95"
          >
            Create Free Account
          </Link>
        </div>

        {/* Coming Soon — Advisory features */}
        <div className="mb-12 p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">Requires SEBI IA Registration</p>
          <ul className="text-xs text-[#859586] space-y-1.5">
            <li className="flex items-center gap-2"><span className="text-amber-400">&#9702;</span> AI-powered goal success probability (Monte Carlo)</li>
            <li className="flex items-center gap-2"><span className="text-amber-400">&#9702;</span> Portfolio transition recommendations (STP engine)</li>
            <li className="flex items-center gap-2"><span className="text-amber-400">&#9702;</span> LTCG harvest optimization with actionable suggestions</li>
            <li className="flex items-center gap-2"><span className="text-amber-400">&#9702;</span> AI portfolio rebalancing (CFO Suite)</li>
          </ul>
          <p className="text-[10px] text-[#859586] mt-3">These features require SEBI Investment Adviser registration. We are in the process of setting up a separate entity for advisory services.</p>
        </div>

        <ComplianceDisclaimer variant="premium" className="mt-8" />

        <EditorialProse heading="What Pro is, and what it is not">
          <p>
            Pro is ₹50 per year. That price exists for a reason: it is deliberately low
            enough to be obviously not a substitute for real financial advice, and high
            enough to filter casual users who would not engage with the deeper tooling.
            The number will probably rise over time as the product matures, but for
            everyone who joins in FY 2025-26 the lock-in is at ₹50 per year for as long
            as you renew.
          </p>
          <p>
            <strong>What Pro unlocks today:</strong>
          </p>
          <ul>
            <li>
              <strong>LTCG harvest planner.</strong> Every March, the planner tells you
              exactly which units to redeem from which folio to realise ₹1.25 lakh of
              tax-free LTCG under current FY 2025-26 rules. It reads your CAS, computes
              per-tranche cost basis, and generates the redemption amount down to the
              unit.
            </li>
            <li>
              <strong>Goal transition suggestions.</strong> When a goal reaches ≥90%
              completion, we auto-compute a Systematic Transfer Plan from your equity
              exposure into a debt-hybrid sleeve. You see the transition plan inside the
              goal page with exact amounts and timing; approving it is one tap.
            </li>
            <li>
              <strong>CFO Suite (private beta).</strong> Tax-regime optimiser, multi-goal
              rebalancing across the full portfolio, and debt-ladder planning. Currently
              available only to the first 200 Pro subscribers while we validate the Monte
              Carlo engine under stress scenarios.
            </li>
          </ul>
          <p>
            <strong>What Pro is not:</strong>
          </p>
          <ul>
            <li>
              Personalised investment advice. We are a Mutual Fund Distributor
              (ARN-317605), not a SEBI-registered Investment Adviser. Nothing in Pro
              tells you which fund to buy. The tooling computes scenarios against your
              existing holdings; the decision is always yours.
            </li>
            <li>
              Execution. Pro does not place orders. When you act on a suggestion, you
              execute through the fund house&apos;s platform or through your existing
              broker. We do not hold your units, your PAN, or your bank credentials.
            </li>
            <li>
              A newsletter bundle. Every piece of content on{' '}
              <Link href="/blog" className="text-[#44f593] underline">
                our blog
              </Link>{' '}
              and{' '}
              <Link href="/learn" className="text-[#44f593] underline">
                learn section
              </Link>{' '}
              is free for everyone. Pro is tooling, not gated content.
            </li>
          </ul>
          <p>
            <strong>Who Pro is for:</strong> serious retail investors with at least ₹5–10
            lakh of mutual fund holdings who want the tax and rebalancing arithmetic
            automated. Below that corpus size the ₹50/year is a rounding error on the
            tooling&apos;s output; above it, the LTCG-harvest planner alone pays for
            itself thousands of times over every year.
          </p>
        </EditorialProse>
      </main>

      <SiteFooter />
    </div>
  );
}