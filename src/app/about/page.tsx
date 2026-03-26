import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import Link from 'next/link';

const VALUES = [
  {
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    title: 'Zero-Storage PII',
    description: 'No PAN, folio numbers or full names stored in plain text. Your financial identity stays private by design.',
  },
  {
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    title: 'Sub-100ms Performance',
    description: 'Every screen is interactive within 100ms using Stale-While-Revalidate cache patterns. Speed is trust.',
  },
  {
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2',
    title: 'AI-Powered Guidance',
    description: 'AI-powered goal evaluation with Monte Carlo simulations — Coming Soon pending SEBI IA registration.',
  },
  {
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    title: 'Family-First Philosophy',
    description: 'Built as a tribute to Vijay Malik — dedicated to serving Indian families with clarity and integrity.',
  },
];

const STATS = [
  { value: '200+', label: 'Families Served' },
  { value: '₹99/yr', label: 'Pro Plan' },
  { value: 'ARN-317605', label: 'AMFI Registered' },
  { value: 'Pan India', label: 'Nationwide Coverage' },
];

export default function AboutPage() {
  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 flex-1">

        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="px-6 md:px-8 max-w-[1440px] mx-auto py-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-[#44f593] text-xs font-semibold mb-8 uppercase tracking-widest">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            AMFI Registered Distributor · ARN-317605
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight gradient-text mb-6">
            Vijay Malik Financial Services
          </h1>
          <p className="text-xl text-[#c0c9c2] max-w-2xl mx-auto leading-relaxed mb-4">
            An autonomous wealth engine built for Indian retail investors.
            A tribute to Vijay Malik — a mission-critical Fintech application
            for high-trust, transparent financial guidance.
          </p>
          <p className="text-sm text-[#859586] max-w-xl mx-auto">
            We believe every Indian family deserves institutional-grade wealth tools —
            without the institutional price tag.
          </p>
        </section>

        {/* ── Stats ────────────────────────────────────────── */}
        <section className="px-6 md:px-8 max-w-[1440px] mx-auto mb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map(s => (
              <div key={s.label} className="glass-card rounded-2xl p-6 text-center">
                <div className="text-2xl md:text-3xl font-display font-black text-[#44f593] mb-2">{s.value}</div>
                <div className="text-xs text-[#859586] uppercase tracking-widest font-semibold">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Story ────────────────────────────────────────── */}
        <section className="px-6 md:px-8 max-w-[1440px] mx-auto mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-display font-bold text-[#dce5df] mb-6 leading-tight">
                Why we built<br />
                <span className="gradient-text">this platform</span>
              </h2>
              <div className="space-y-4 text-[#c0c9c2] leading-relaxed">
                <p>
                  Vijay Malik Financial Services was built as a tribute to Vijay Malik — to carry forward his legacy
                  of clarity, integrity, and trust in financial matters. The goal is simple:
                  give every Indian retail investor access to tools previously reserved for
                  institutional players.
                </p>
                <p>
                  We partner with AMFI-registered platforms to offer direct mutual fund
                  investments, comprehensive portfolio analytics, and AI-powered goal planning.
                  Our advanced analytics engine provides institutional-grade portfolio tracking,
                  XIRR computation, and tax liability calculations. Monte Carlo goal probability
                  simulations are coming soon pending SEBI IA registration.
                </p>
                <p>
                  Our philosophy is Zero-Storage PII — no PANs, no folio numbers, no full
                  names in plain text. Your financial identity is yours. We build for trust.
                </p>
              </div>
            </div>
            <div className="glass-card rounded-3xl p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-[#dce5df]">AMFI Registered</p>
                  <p className="text-xs text-[#859586]">ARN-317605 · NISM Certified</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-[#dce5df]">Serverless-First Architecture</p>
                  <p className="text-xs text-[#859586]">Edge Runtime · Cloudflare · Railway PostgreSQL</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-[#dce5df]">Gemini 1.5 Flash AI Engine</p>
                  <p className="text-xs text-[#859586]">Monte Carlo · Coming Soon (SEBI IA pending)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Values ───────────────────────────────────────── */}
        <section className="px-6 md:px-8 max-w-[1440px] mx-auto mb-20">
          <h2 className="text-3xl font-display font-bold text-[#dce5df] mb-10 text-center">Our Principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VALUES.map(v => (
              <div key={v.title} className="glass-card rounded-2xl p-6 flex gap-5">
                <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d={v.icon}/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-display font-bold text-[#dce5df] mb-2">{v.title}</h3>
                  <p className="text-sm text-[#c0c9c2] leading-relaxed">{v.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="px-6 md:px-8 max-w-[1440px] mx-auto">
          <div className="metallic-emerald rounded-3xl p-12 text-center text-[#001f10] relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-display font-black mb-4 uppercase">
                Start Your Wealth Journey
              </h2>
              <p className="text-[#001f10]/70 mb-8 max-w-lg mx-auto">
                Join 200+ Indian families who trust Vijay Malik Financial Services for clear, honest, and powerful mutual fund guidance.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Link
                  href="/auth/signup"
                  className="bg-[#001f10] text-[#44f593] px-6 py-3 rounded-full font-bold text-sm hover:bg-[#001f10]/90 transition-colors"
                >
                  Create Your Vault
                </Link>
                <Link
                  href="/funds/search"
                  className="bg-white/20 text-[#001f10] px-6 py-3 rounded-full font-bold text-sm hover:bg-white/30 transition-colors"
                >
                  Explore Funds
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
