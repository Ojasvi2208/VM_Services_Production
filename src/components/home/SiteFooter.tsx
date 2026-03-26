// ─── SiteFooter ──────────────────────────────────────────────
// 4-column grid: Brand+social | Platform | Company | Legal
// Bottom bar: copyright + server status pulse
// Design: Design_Revamp/HomePage.html § Footer
// ─────────────────────────────────────────────────────────────
import Link from 'next/link';

const PLATFORM_LINKS = [
  { label: 'Markets',   href: '/markets',      disabled: false },
  { label: 'Discover',  href: '/funds/search', disabled: false },
  { label: 'Portfolio', href: '/portfolio',    disabled: false },
  { label: 'Goals',     href: '/goals',        disabled: false },
  { label: 'News',      href: '/news',         disabled: false },
  { label: 'Screener',  href: '/screener',     disabled: true  },
];

const COMPANY_LINKS = [
  { label: 'About',        href: '/about' },
  { label: 'Careers',      href: '/careers' },
  { label: 'ARN Verify',   href: '/verify-arn' },
  { label: 'Partner',      href: '/partners' },
  { label: 'Disclosures',  href: '/disclosures' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy',   href: '/disclosures#privacy' },
  { label: 'Terms of Service', href: '/disclosures#terms' },
  { label: 'Risk Disclosure',  href: '/disclosures#risk' },
];

export default function SiteFooter() {
  return (
    <footer className="bg-[#060d0a] w-full border-t border-[#161d1a]" role="contentinfo">

      <div className="max-w-7xl mx-auto px-8 pt-16 pb-8">

        {/* ── 4-column grid ────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">

          {/* Brand column */}
          <div>
            <div className="text-lg font-bold text-[#00d87a] mb-6 font-['Space_Grotesk']">
              Vijay Malik Financial Services
            </div>
            <p className="text-[#c4cfc9] text-sm leading-relaxed mb-6">
              The ultimate repository for institutional-grade wealth management and sovereign risk intelligence.
            </p>
            <div className="flex gap-4">
              <a className="text-[#859586] hover:text-white transition-colors" href="https://vmfinancialservices.com" target="_blank" rel="noopener noreferrer" aria-label="Website">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>public</span>
              </a>
              <a className="text-[#859586] hover:text-white transition-colors" href="mailto:info@vmfinancialservices.com" aria-label="Email">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>alternate_email</span>
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-white font-bold mb-6 text-sm">Platform</h4>
            <ul className="space-y-4 text-sm font-['Inter']">
              {PLATFORM_LINKS.map(({ label, href, disabled }) => (
                <li key={label}>
                  {disabled ? (
                    <span className="flex items-center gap-2 text-[#3c4a3e] cursor-not-allowed">
                      {label}
                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 leading-none">
                        SOON
                      </span>
                    </span>
                  ) : (
                    <Link href={href} className="text-[#859586] hover:text-white transition-colors">
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-bold mb-6 text-sm">Company</h4>
            <ul className="space-y-4 text-sm font-['Inter']">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[#859586] hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div>
            <h4 className="text-white font-bold mb-6 text-sm">Legal &amp; Compliance</h4>
            <ul className="space-y-4 text-sm font-['Inter']">
              {LEGAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[#859586] hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Regulatory disclosure bar ─────────────────────── */}
        <div className="pt-8 border-t border-white/5 mb-6">
          <p className="text-[#3c4a3e] text-xs font-['Inter'] leading-relaxed max-w-5xl">
            <span className="text-[#859586] font-semibold">Regulatory Disclosure: </span>
            Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605).
            We are <strong className="text-[#859586]">NOT</strong> a SEBI-registered Investment Adviser and do not provide personalised investment advice.
            We may earn trail commissions from AMCs on transactions facilitated through our platform.
            All content on this platform — fund data, returns, calculators, and portfolio analytics — is for informational and educational purposes only and does not constitute investment advice.
            Mutual fund investments are subject to market risks. Past performance is not indicative of future returns. Please read all scheme-related documents carefully before investing.
          </p>
        </div>

        {/* ── Bottom bar ───────────────────────────────────── */}
        <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[#c4cfc9] text-xs font-['Inter'] max-w-3xl">
            © {new Date().getFullYear()} Vijay Malik Financial Services. AMFI-registered distributor · ARN-317605 ·
            Mutual fund investments are subject to market risks.
          </p>
        </div>
      </div>

    </footer>
  );
}
