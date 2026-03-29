import type { Metadata } from 'next';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

export const metadata: Metadata = {
  title: 'Learn — Mutual Fund Guides & Investment Education',
  description: 'Free educational guides on mutual funds, SIP, SWP, STP, ELSS tax saving, LTCG tax, and more. Institutional-grade insights from AMFI-registered distributor ARN-317605.',
  openGraph: {
    title: 'Learn — Mutual Fund Guides & Investment Education',
    description: 'Free educational guides on mutual funds for Indian investors.',
  },
};

const ARTICLES = [
  {
    slug: 'best-elss-tax-saving-funds',
    title: 'Best ELSS Tax Saving Funds 2026-27',
    description: 'Top 10 ELSS funds ranked by 3-year CAGR. Save up to ₹46,800 in taxes under Section 80C with the shortest lock-in of 3 years.',
    category: 'Tax Planning',
    icon: 'savings',
    readTime: '8 min read',
    color: '#44f593',
  },
  {
    slug: 'swp-calculator-guide',
    title: 'SWP Calculator — How Long Will Your Corpus Last?',
    description: 'Complete guide to Systematic Withdrawal Plans. Calculate how long your mutual fund corpus will sustain monthly withdrawals with our free SWP calculator.',
    category: 'Calculators',
    icon: 'trending_down',
    readTime: '6 min read',
    color: '#f59e0b',
  },
  {
    slug: 'direct-vs-regular-mutual-funds',
    title: 'Direct vs Regular Mutual Funds — Complete Guide',
    description: 'Why Direct plans give 0.5-1.5% higher returns than Regular plans. Side-by-side comparison with 20-year impact analysis on a ₹10,000 SIP.',
    category: 'Basics',
    icon: 'compare_arrows',
    readTime: '7 min read',
    color: '#06b6d4',
  },
  {
    slug: 'ltcg-tax-on-mutual-funds',
    title: 'LTCG Tax on Mutual Funds 2026 — Complete Guide',
    description: 'How Long Term Capital Gains tax works on equity and debt mutual funds. Tax slabs, exemption limits (₹1.25 lakh), and strategies to minimise tax liability.',
    category: 'Tax Planning',
    icon: 'receipt_long',
    readTime: '9 min read',
    color: '#ec4899',
  },
  {
    slug: 'what-is-stp-in-mutual-funds',
    title: 'What is STP in Mutual Funds? Complete Guide',
    description: 'Systematic Transfer Plan explained — how to gradually move money from debt to equity funds. Benefits, taxation, and when to use STP vs SIP.',
    category: 'Basics',
    icon: 'swap_horiz',
    readTime: '6 min read',
    color: '#a855f7',
  },
];

const CATEGORIES = [
  { label: 'All Guides', count: ARTICLES.length },
  { label: 'Tax Planning', count: ARTICLES.filter(a => a.category === 'Tax Planning').length },
  { label: 'Basics', count: ARTICLES.filter(a => a.category === 'Basics').length },
  { label: 'Calculators', count: ARTICLES.filter(a => a.category === 'Calculators').length },
];

export default function LearnPage() {
  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-4 md:px-6 lg:px-8 max-w-[1200px] mx-auto flex-1 w-full">

        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-[#44f593] text-xs font-bold uppercase tracking-widest mb-6">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            Learn
          </div>
          <h1 className="font-['Space_Grotesk'] font-bold text-4xl md:text-5xl text-[#dce5df] tracking-tight mb-4">
            Investment Guides
          </h1>
          <p className="text-[#859586] text-base max-w-xl">
            Free educational guides on mutual funds, tax planning, and investment strategies. All content is for informational purposes only — not investment advice.
          </p>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map(cat => (
            <span key={cat.label} className="px-4 py-2 rounded-full bg-[#161d1a] border border-white/5 text-sm text-[#859586] font-medium">
              {cat.label} <span className="text-[#44f593] ml-1">{cat.count}</span>
            </span>
          ))}
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {ARTICLES.map(article => (
            <Link
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="glass-card-vi rounded-2xl p-6 flex flex-col hover:border-[#44f593]/30 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${article.color}15`, border: `1px solid ${article.color}30` }}>
                  <span className="material-symbols-outlined text-xl" style={{ color: article.color, fontVariationSettings: "'FILL' 1" }}>
                    {article.icon}
                  </span>
                </div>
                <span className="text-[10px] text-[#859586] font-mono uppercase">{article.readTime}</span>
              </div>

              <span className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: article.color }}>
                {article.category}
              </span>

              <h2 className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df] group-hover:text-[#44f593] transition-colors mb-3 line-clamp-2 flex-1">
                {article.title}
              </h2>

              <p className="text-sm text-[#859586] leading-relaxed line-clamp-3 mb-4">
                {article.description}
              </p>

              <div className="flex items-center gap-2 text-[#44f593] text-sm font-bold group-hover:gap-3 transition-all mt-auto">
                Read Guide
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Upcoming content teaser */}
        <div className="glass-card-vi rounded-2xl p-8 text-center mb-8">
          <span className="material-symbols-outlined text-4xl text-[#44f593]/30 mb-4 block" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
          <h3 className="font-['Space_Grotesk'] font-bold text-xl text-[#dce5df] mb-2">More Guides Coming Soon</h3>
          <p className="text-sm text-[#859586] max-w-md mx-auto">
            Best Large Cap Funds, Mid Cap Funds, Index Funds, SIP for Beginners, and 15+ more educational guides launching weekly.
          </p>
        </div>

        <ComplianceDisclaimer variant="general" className="mt-4" />
      </main>

      <SiteFooter />
    </div>
  );
}
