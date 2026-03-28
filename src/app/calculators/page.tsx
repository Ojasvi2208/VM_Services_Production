import type { Metadata } from 'next';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

export const metadata: Metadata = {
  title: 'Financial Planner — SIP, SWP & STP Calculators',
  description: 'Plan your mutual fund investments with free SIP, SWP, and STP calculators. Institutional-grade projections capped at 13% per AMFI guidelines. AMFI-registered distributor ARN-317605.',
  openGraph: {
    title: 'Financial Planner — SIP, SWP & STP Calculators',
    description: 'Free mutual fund investment calculators for Indian investors.',
  },
};

const CALCULATORS = [
  {
    title: 'SIP Planner',
    href: '/calculators/sip',
    icon: 'query_stats',
    description: 'Calculate how your monthly SIP grows over time with compound returns. See projected maturity value, wealth multiplier, and year-by-year breakdown.',
    accent: '#44f593',
  },
  {
    title: 'SWP Planner',
    href: '/calculators/swp',
    icon: 'trending_down',
    description: 'Plan systematic withdrawals from your mutual fund corpus. Find out how long your investment lasts and what remains after regular withdrawals.',
    accent: '#f59e0b',
  },
  {
    title: 'STP Planner',
    href: '/calculators/stp',
    icon: 'swap_horiz',
    description: 'Simulate systematic transfers from a debt/liquid fund to an equity fund. Optimise your lump sum deployment with rupee cost averaging.',
    accent: '#06b6d4',
  },
];

export default function CalculatorsPage() {
  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-4 md:px-6 lg:px-8 max-w-[1200px] mx-auto flex-1 w-full">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-[#44f593] text-xs font-bold uppercase tracking-widest mb-6">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>calculate</span>
            Financial Planner
          </div>
          <h1 className="font-['Space_Grotesk'] font-bold text-4xl md:text-5xl text-[#dce5df] tracking-tight mb-4">
            Plan Your Investments
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Institutional-grade calculators for Indian mutual fund investors. All projections are educational — return assumptions capped at 13% per AMFI guidelines.
          </p>
        </div>

        {/* Calculator Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {CALCULATORS.map(calc => (
            <Link
              key={calc.href}
              href={calc.href}
              className="glass-card-vi rounded-2xl p-8 flex flex-col hover:border-[#44f593]/30 transition-all duration-300 group"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: `${calc.accent}15`, border: `1px solid ${calc.accent}30` }}
              >
                <span
                  className="material-symbols-outlined text-2xl"
                  style={{ color: calc.accent, fontVariationSettings: "'FILL' 1" }}
                >
                  {calc.icon}
                </span>
              </div>
              <h2 className="font-['Space_Grotesk'] font-bold text-xl text-[#dce5df] group-hover:text-[#44f593] transition-colors mb-3">
                {calc.title}
              </h2>
              <p className="text-sm text-[#859586] leading-relaxed flex-1 mb-6">
                {calc.description}
              </p>
              <div className="flex items-center gap-2 text-[#44f593] text-sm font-bold group-hover:gap-3 transition-all">
                Calculate
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>

        {/* What these calculators are NOT */}
        <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-8">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Important Notice</p>
          <p className="text-xs text-[#859586] leading-relaxed">
            These calculators use hypothetical return assumptions for illustration purposes only. They do NOT constitute investment advice, financial planning, or a recommendation to invest. Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605) and is NOT a SEBI-registered Investment Adviser.
          </p>
        </div>

        <ComplianceDisclaimer variant="calculator" className="mt-4" />
      </main>

      <SiteFooter />
    </div>
  );
}
