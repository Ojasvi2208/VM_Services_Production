'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

// ─── Article Data ───────────────────────────────────────────
interface ArticleItem {
  slug: string; title: string; description: string;
  category: string; icon: string; readTime: string; color: string;
}

const ARTICLES: ArticleItem[] = [
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
  // ── Batch 2: High-Volume Trending (April 2026) ──
  {
    slug: 'new-tax-regime-vs-old-tax-regime',
    title: 'New Tax Regime vs Old Tax Regime — Which Saves More?',
    description: 'Complete FY 2026-27 comparison: slab-by-slab breakdown, deduction eligibility, HRA impact, and break-even analysis by salary level.',
    category: 'Tax Planning',
    icon: 'balance',
    readTime: '11 min read',
    color: '#f59e0b',
  },
  {
    slug: 'how-to-invest-in-mutual-funds-beginners',
    title: 'How to Invest in Mutual Funds — Beginner\'s Guide (2026)',
    description: 'Step-by-step: KYC, Direct vs Regular, SIP setup, choosing fund categories, and 5 beginner mistakes that destroy returns.',
    category: 'Getting Started',
    icon: 'rocket_launch',
    readTime: '12 min read',
    color: '#44f593',
  },
  {
    slug: 'nps-vs-ppf-which-is-better',
    title: 'NPS vs PPF — Which Is Better for Retirement?',
    description: 'Returns, lock-in, taxation, withdrawal rules, and corpus projections. Decision matrix based on age, risk tolerance, and tax bracket.',
    category: 'Retirement',
    icon: 'elderly',
    readTime: '10 min read',
    color: '#8b5cf6',
  },
  {
    slug: 'gold-etf-vs-sovereign-gold-bond',
    title: 'Gold ETF vs Sovereign Gold Bond (SGB)',
    description: 'Compare taxation, liquidity, interest income, and lock-in. SGB offers ZERO capital gains tax on 8-year maturity.',
    category: 'Gold Investment',
    icon: 'diamond',
    readTime: '9 min read',
    color: '#eab308',
  },
  {
    slug: 'best-flexi-cap-funds-india',
    title: 'Best Flexi Cap Funds in India (2026)',
    description: 'Top 8 Flexi Cap funds ranked by Sharpe ratio and rolling returns. Why Flexi Cap is the best single-category equity allocation.',
    category: 'Fund Picks',
    icon: 'auto_awesome',
    readTime: '8 min read',
    color: '#06b6d4',
  },
  {
    slug: 'step-up-sip-calculator-benefits',
    title: 'Step-Up SIP — How 10% Yearly Increase Triples Your Corpus',
    description: 'Corpus projections: regular SIP vs 10% step-up at ₹10,000/month for 10, 15, 20, and 25 years. The most underused wealth strategy.',
    category: 'Investment Strategy',
    icon: 'stacked_line_chart',
    readTime: '8 min read',
    color: '#44f593',
  },
  {
    slug: 'best-debt-mutual-funds-india',
    title: 'Best Debt Mutual Funds in India (2026)',
    description: 'Top debt fund categories: Liquid, Ultra Short, Short Duration, Corporate Bond. Taxation after April 2023 and when FD still wins.',
    category: 'Fixed Income',
    icon: 'account_balance',
    readTime: '9 min read',
    color: '#3b82f6',
  },
  {
    slug: 'what-is-expense-ratio-mutual-fund',
    title: 'What Is Expense Ratio? Why It Matters More Than Returns',
    description: 'How expense ratio silently costs ₹26.5L on a ₹10,000 SIP over 20 years. SEBI limits, Direct vs Regular gap, and the 1% rule.',
    category: 'Fund Basics',
    icon: 'pie_chart',
    readTime: '7 min read',
    color: '#ef4444',
  },
  {
    slug: 'best-hybrid-mutual-funds-india',
    title: 'Best Hybrid Mutual Funds — BAF, Aggressive & Conservative',
    description: 'Top Balanced Advantage, Aggressive Hybrid, and Multi Asset funds. Why BAFs automate buy-low-sell-high and deliver equity-like returns with 40% less drawdown.',
    category: 'Fund Picks',
    icon: 'tune',
    readTime: '8 min read',
    color: '#8b5cf6',
  },
  {
    slug: 'how-to-read-mutual-fund-factsheet',
    title: 'How to Read a Mutual Fund Factsheet — 10 Numbers That Matter',
    description: 'Decode any factsheet in 5 minutes: AUM, Sharpe ratio, expense ratio, portfolio turnover, and 6 more metrics that predict performance.',
    category: 'Fund Basics',
    icon: 'analytics',
    readTime: '9 min read',
    color: '#f97316',
  },
  {
    slug: 'nifty-50-vs-nifty-next-50-vs-nifty-500',
    title: 'Nifty 50 vs Next 50 vs Nifty 500 — Which Index Fund to Pick?',
    description: 'Returns, volatility, overlap, and the 75/25 strategy. Why Nifty 50 alone covers only 60% of India\'s market cap.',
    category: 'Index Investing',
    icon: 'leaderboard',
    readTime: '8 min read',
    color: '#06b6d4',
  },
  // ── Batch 3: Top-ranked search queries (April 2026) ──
  {
    slug: 'how-to-buy-mutual-funds-online',
    title: 'How to Buy Mutual Funds Online in India — Step-by-Step (2026)',
    description: 'Complete walkthrough: KYC, choosing AMC direct vs platforms, first purchase, SIP setup, and avoiding common first-time mistakes.',
    category: 'Getting Started',
    icon: 'shopping_cart_checkout',
    readTime: '10 min read',
    color: '#44f593',
  },
  {
    slug: 'mutual-fund-vs-stock-market',
    title: 'Mutual Fund vs Stock Market — Which Is Better for Indians?',
    description: 'Head-to-head comparison: returns, risk, time commitment, tax treatment. When direct stocks beat funds and when they don\'t.',
    category: 'Basics',
    icon: 'compare',
    readTime: '9 min read',
    color: '#a855f7',
  },
  {
    slug: 'how-much-to-invest-for-1-crore',
    title: 'How Much to Invest to Reach ₹1 Crore — Timelines & Monthly SIP',
    description: 'SIP amount needed for ₹1 Cr in 10/15/20/25 years at different return rates. Step-up SIP tables. Why starting 5 years late costs ₹35L.',
    category: 'Investment Strategy',
    icon: 'flag',
    readTime: '8 min read',
    color: '#f59e0b',
  },
];

// ─── Category mapping (groups similar categories under one filter label) ──
const CATEGORY_GROUPS: Record<string, string[]> = {
  'All Guides':          [],
  'Fund Picks':          ['Fund Picks'],
  'Getting Started':     ['Getting Started', 'Basics', 'Fund Basics'],
  'Tax Planning':        ['Tax Planning'],
  'Retirement':          ['Retirement'],
  'Investment Strategy': ['Investment Strategy', 'Index Investing', 'Gold Investment', 'Fixed Income'],
  'Calculators':         ['Calculators'],
  'Market Analysis':     ['Market Analysis'],
};

const PER_PAGE = 9;

// ─── Page ───────────────────────────────────────────────────
export default function LearnPage() {
  const [activeCategory, setActiveCategory] = useState('All Guides');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (activeCategory === 'All Guides') return ARTICLES;
    const cats = CATEGORY_GROUPS[activeCategory] ?? [];
    return ARTICLES.filter(a => cats.includes(a.category));
  }, [activeCategory]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleCategory = (label: string) => {
    setActiveCategory(label);
    setPage(1);
  };

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

        {/* Category pills — clickable */}
        <div className="flex flex-wrap gap-2 mb-10">
          {Object.entries(CATEGORY_GROUPS).map(([label, cats]) => {
            const count = label === 'All Guides'
              ? ARTICLES.length
              : ARTICLES.filter(a => cats.includes(a.category)).length;
            if (count === 0) return null;
            const isActive = activeCategory === label;
            return (
              <button
                key={label}
                onClick={() => handleCategory(label)}
                className={[
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#44f593]/15 border border-[#44f593]/40 text-[#44f593]'
                    : 'bg-[#161d1a] border border-white/5 text-[#859586] hover:border-[#44f593]/20 hover:text-[#c4cfc9]',
                ].join(' ')}
              >
                {label} <span className={isActive ? 'text-[#44f593] ml-1' : 'text-[#44f593]/60 ml-1'}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Articles Grid — paginated */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {paginated.map(article => (
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mb-14">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 rounded-lg border border-white/10 text-sm text-[#859586] hover:text-[#dce5df] hover:border-[#44f593]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base align-middle">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={[
                  'w-10 h-10 rounded-lg text-sm font-bold transition-all duration-200',
                  p === page
                    ? 'bg-[#44f593] text-[#001f10]'
                    : 'border border-white/10 text-[#859586] hover:text-[#dce5df] hover:border-[#44f593]/30',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 rounded-lg border border-white/10 text-sm text-[#859586] hover:text-[#dce5df] hover:border-[#44f593]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base align-middle">chevron_right</span>
            </button>
          </div>
        )}

        {/* Page info */}
        {totalPages > 1 && (
          <p className="text-center text-xs text-[#3c4a3e] font-mono mb-10">
            Page {page} of {totalPages} — showing {paginated.length} of {filtered.length} guides
          </p>
        )}

        <ComplianceDisclaimer variant="general" className="mt-4" />
      </main>

      <SiteFooter />
    </div>
  );
}