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
  {
    slug: 'best-mutual-funds-to-invest',
    title: 'Best Mutual Funds to Invest in 2026 — Top Picks Across Categories',
    description: 'Data-driven analysis of the best mutual funds across large cap, mid cap, small cap, and flexi cap categories. Evaluate funds using CAGR, Sharpe ratio, and expense ratio.',
    category: 'Fund Picks',
    icon: 'workspace_premium',
    readTime: '10 min read',
    color: '#44f593',
  },
  {
    slug: 'sip-calculator-guide',
    title: 'SIP Calculator — How Much Will ₹5,000 Grow in 10/15/20 Years?',
    description: 'See exactly how a ₹5,000 monthly SIP compounds at 10%, 12%, and 13% over 5 to 25 years. The power of compounding explained with Indian rupee projections.',
    category: 'Calculators',
    icon: 'calculate',
    readTime: '7 min read',
    color: '#f59e0b',
  },
  {
    slug: 'best-large-cap-funds',
    title: 'Best Large Cap Mutual Funds 2026 — Top 10 Ranked',
    description: 'Top 10 large cap funds ranked by 1Y/3Y/5Y CAGR with Sharpe ratios and expense ratios. Active vs passive debate with Indian data.',
    category: 'Fund Picks',
    icon: 'diamond',
    readTime: '8 min read',
    color: '#44f593',
  },
  {
    slug: 'best-mid-cap-funds',
    title: 'Best Mid Cap Mutual Funds 2026 — High Growth Picks',
    description: 'Top 8 mid cap funds ranked by risk-adjusted performance. Volatility comparison with large caps and optimal allocation framework.',
    category: 'Fund Picks',
    icon: 'trending_up',
    readTime: '8 min read',
    color: '#f59e0b',
  },
  {
    slug: 'best-small-cap-funds',
    title: 'Best Small Cap Mutual Funds 2026 — Maximum Growth Potential',
    description: 'Top 8 small cap funds with drawdown risk analysis. When to invest, position sizing, and the volatility contract you are signing.',
    category: 'Fund Picks',
    icon: 'rocket_launch',
    readTime: '8 min read',
    color: '#ec4899',
  },
  {
    slug: 'why-start-investing-early',
    title: 'Why You Should Start Investing Early — The Power of Compounding',
    description: 'How a ₹5,000 SIP started at 25 vs 35 creates a ₹1 Cr difference. Compounding math with Indian examples, Kautilya, and Warren Buffett.',
    category: 'Basics',
    icon: 'schedule',
    readTime: '6 min read',
    color: '#06b6d4',
  },
  {
    slug: 'best-index-funds-india',
    title: 'Best Index Funds in India 2026 — Nifty 50, Next 50 & More',
    description: 'Top index funds ranked by tracking error and expense ratio. Active vs passive debate with Indian-specific data across categories.',
    category: 'Fund Picks',
    icon: 'bar_chart',
    readTime: '8 min read',
    color: '#a855f7',
  },
  {
    slug: 'mutual-fund-vs-fixed-deposit',
    title: 'Mutual Fund vs Fixed Deposit 2026 — Which is Better?',
    description: 'Side-by-side comparison: returns, tax efficiency, inflation protection, liquidity, and risk. After-tax comparison table with real numbers.',
    category: 'Basics',
    icon: 'balance',
    readTime: '7 min read',
    color: '#06b6d4',
  },
  {
    slug: 'best-sip-plans-5000-per-month',
    title: 'Best SIP Plans for ₹5,000/Month in 2026',
    description: 'Three model portfolios at ₹5,000/month: Conservative, Balanced, and Aggressive. Fund allocation tables with exact SIP splits.',
    category: 'Fund Picks',
    icon: 'account_balance_wallet',
    readTime: '7 min read',
    color: '#44f593',
  },
  {
    slug: 'how-elections-impact-indian-markets',
    title: 'How Indian Elections Impact the Stock Market — Historical Analysis',
    description: 'Nifty returns around every general election since 2004. Pre/post election market behaviour and what investors should actually do.',
    category: 'Market Analysis',
    icon: 'how_to_vote',
    readTime: '9 min read',
    color: '#ec4899',
  },
];

const CATEGORIES = [
  { label: 'All Guides', count: ARTICLES.length },
  { label: 'Fund Picks', count: ARTICLES.filter(a => a.category === 'Fund Picks').length },
  { label: 'Basics', count: ARTICLES.filter(a => a.category === 'Basics').length },
  { label: 'Tax Planning', count: ARTICLES.filter(a => a.category === 'Tax Planning').length },
  { label: 'Calculators', count: ARTICLES.filter(a => a.category === 'Calculators').length },
  { label: 'Market Analysis', count: ARTICLES.filter(a => a.category === 'Market Analysis').length },
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

        <ComplianceDisclaimer variant="general" className="mt-4" />
      </main>

      <SiteFooter />
    </div>
  );
}
