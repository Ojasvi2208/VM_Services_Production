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
  { label: 'Learn',     href: '/learn',        disabled: false },
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
              <a className="text-[#859586] hover:text-[#E1306C] transition-colors" href="https://www.instagram.com/vijaymalikfinancialservices/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
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
