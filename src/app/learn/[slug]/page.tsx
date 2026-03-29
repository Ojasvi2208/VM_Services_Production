import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

// ─── Article Content Database ────────────────────────────────
// Each article is a structured object with sections, tables, FAQs.
// All content is 100% original, SEBI MFD compliant, educational only.

interface FAQ { q: string; a: string; }
interface TableRow { [key: string]: string | number; }
interface Section { heading: string; content: string; table?: { headers: string[]; rows: TableRow[] }; }
interface Article {
  slug: string; title: string; description: string; category: string;
  readTime: string; publishedDate: string; updatedDate: string;
  heroIcon: string; heroColor: string;
  introduction: string;
  sections: Section[];
  keyTakeaways: string[];
  faqs: FAQ[];
  relatedLinks: { label: string; href: string }[];
}

const ARTICLES: Record<string, Article> = {
  'best-elss-tax-saving-funds': {
    slug: 'best-elss-tax-saving-funds',
    title: 'Best ELSS Tax Saving Funds 2026-27',
    description: 'Top 10 ELSS funds ranked by 3-year CAGR. Save up to ₹46,800 in taxes under Section 80C with the shortest lock-in of 3 years.',
    category: 'Tax Planning', readTime: '8 min read',
    publishedDate: '2026-03-29', updatedDate: '2026-03-29',
    heroIcon: 'savings', heroColor: '#44f593',
    introduction: 'Equity Linked Savings Scheme (ELSS) is the only mutual fund category that qualifies for tax deduction under Section 80C of the Income Tax Act. With a lock-in period of just 3 years — the shortest among all 80C investments — ELSS offers dual benefits: tax savings of up to ₹46,800 per year (at the highest tax slab) and potential equity market returns. Here we analyse the top ELSS funds based on consistent 3-year and 5-year CAGR performance.',
    sections: [
      {
        heading: 'What is ELSS and How Does It Save Tax?',
        content: 'ELSS funds invest a minimum 80% of their corpus in equity and equity-related instruments. Investments up to ₹1,50,000 per financial year qualify for deduction under Section 80C. At the 30% tax slab + 4% cess, this translates to a maximum tax saving of ₹46,800. Unlike PPF (15 years lock-in) or NSC (5 years), ELSS has only a 3-year lock-in period, making it the most liquid tax-saving instrument.',
      },
      {
        heading: 'Top ELSS Funds by 3-Year CAGR',
        content: 'The following table ranks ELSS funds by their 3-year Compound Annual Growth Rate. All data is sourced from AMFI and is for Direct Growth plans as of March 2026.',
        table: {
          headers: ['Fund Name', '3Y CAGR', '5Y CAGR', 'AUM (Cr)', 'Expense Ratio'],
          rows: [
            { 'Fund Name': 'Quant ELSS Tax Saver Fund', '3Y CAGR': '28.4%', '5Y CAGR': '32.1%', 'AUM (Cr)': '₹9,850', 'Expense Ratio': '0.57%' },
            { 'Fund Name': 'SBI Long Term Equity Fund', '3Y CAGR': '24.2%', '5Y CAGR': '19.8%', 'AUM (Cr)': '₹24,100', 'Expense Ratio': '0.83%' },
            { 'Fund Name': 'Mirae Asset ELSS Tax Saver', '3Y CAGR': '22.8%', '5Y CAGR': '18.5%', 'AUM (Cr)': '₹18,200', 'Expense Ratio': '0.58%' },
            { 'Fund Name': 'Canara Robeco ELSS Tax Saver', '3Y CAGR': '21.5%', '5Y CAGR': '17.9%', 'AUM (Cr)': '₹7,400', 'Expense Ratio': '0.52%' },
            { 'Fund Name': 'HDFC ELSS Tax Saver Fund', '3Y CAGR': '21.1%', '5Y CAGR': '16.2%', 'AUM (Cr)': '₹15,600', 'Expense Ratio': '0.96%' },
            { 'Fund Name': 'Axis ELSS Tax Saver Fund', '3Y CAGR': '20.8%', '5Y CAGR': '15.4%', 'AUM (Cr)': '₹35,200', 'Expense Ratio': '0.62%' },
            { 'Fund Name': 'DSP ELSS Tax Saver Fund', '3Y CAGR': '20.3%', '5Y CAGR': '17.1%', 'AUM (Cr)': '₹12,800', 'Expense Ratio': '0.68%' },
            { 'Fund Name': 'Kotak ELSS Tax Saver Fund', '3Y CAGR': '19.9%', '5Y CAGR': '16.8%', 'AUM (Cr)': '₹4,900', 'Expense Ratio': '0.55%' },
          ],
        },
      },
      {
        heading: 'How to Choose the Right ELSS Fund',
        content: 'When selecting an ELSS fund, consider these factors: (1) Consistency of returns over 3 and 5 years rather than just recent performance. (2) Expense ratio — lower is better, especially for Direct plans. (3) Fund size — very small AUMs (<₹500 Cr) may have liquidity concerns. (4) Portfolio concentration — check if the fund is diversified across sectors or concentrated in a few stocks. (5) Fund manager track record — consistency matters more than one good year.',
      },
      {
        heading: 'ELSS vs Other 80C Investments',
        content: 'Here is how ELSS compares with other popular Section 80C tax-saving instruments in terms of returns, lock-in period, and risk.',
        table: {
          headers: ['Investment', 'Lock-in', 'Expected Returns', 'Risk', 'Tax on Returns'],
          rows: [
            { 'Investment': 'ELSS', 'Lock-in': '3 years', 'Expected Returns': '12-15% (equity)', 'Risk': 'High', 'Tax on Returns': 'LTCG 10% above ₹1.25L' },
            { 'Investment': 'PPF', 'Lock-in': '15 years', 'Expected Returns': '7.1% (fixed)', 'Risk': 'Zero', 'Tax on Returns': 'Exempt' },
            { 'Investment': 'NPS', 'Lock-in': 'Till 60', 'Expected Returns': '8-10% (mixed)', 'Risk': 'Medium', 'Tax on Returns': '60% exempt, 40% annuity taxed' },
            { 'Investment': 'NSC', 'Lock-in': '5 years', 'Expected Returns': '7.7% (fixed)', 'Risk': 'Zero', 'Tax on Returns': 'Fully taxable' },
            { 'Investment': 'Tax Saver FD', 'Lock-in': '5 years', 'Expected Returns': '6.5-7% (fixed)', 'Risk': 'Zero', 'Tax on Returns': 'Fully taxable' },
          ],
        },
      },
      {
        heading: 'SIP in ELSS — The Smart Approach',
        content: 'Instead of investing ₹1.5 lakh in a lump sum in March (which most people do under pressure), start a monthly SIP of ₹12,500. This spreads your investment across market cycles, reduces timing risk, and ensures you don\'t miss the tax-saving deadline. A ₹12,500 SIP for 12 months = ₹1,50,000 — the full Section 80C limit. Each SIP instalment has its own 3-year lock-in, so the first instalment unlocks in April of the 4th year, and the last one unlocks in March of the 4th year.',
      },
    ],
    keyTakeaways: [
      'ELSS has the shortest lock-in (3 years) among all Section 80C investments',
      'Maximum tax saving: ₹46,800/year at the highest slab',
      'Start a ₹12,500/month SIP instead of last-minute lump sum investing',
      'Choose Direct Growth plans for lower expense ratios and higher returns',
      'Past performance is not indicative of future returns — diversify across 2-3 ELSS funds',
    ],
    faqs: [
      { q: 'What is the maximum tax saving with ELSS?', a: 'You can save up to ₹46,800 per year by investing ₹1,50,000 in ELSS under Section 80C (at the 30% tax slab + 4% cess). Under the new tax regime, Section 80C deduction is not available.' },
      { q: 'Can I withdraw ELSS before 3 years?', a: 'No. ELSS has a mandatory 3-year lock-in period. You cannot redeem, switch, or transfer units before 3 years from the date of each investment.' },
      { q: 'Is ELSS better than PPF for tax saving?', a: 'ELSS offers potentially higher returns (12-15%) compared to PPF (7.1%) but carries equity market risk. PPF is risk-free with guaranteed returns. ELSS has a 3-year lock-in vs PPF\'s 15 years. Choose based on your risk tolerance.' },
      { q: 'Are ELSS returns taxable?', a: 'Yes. ELSS returns are treated as Long Term Capital Gains (LTCG). Gains above ₹1.25 lakh per financial year are taxed at 10% without indexation benefit. Gains up to ₹1.25 lakh are tax-free.' },
      { q: 'Should I invest in Direct or Regular ELSS plan?', a: 'Direct plans have lower expense ratios (by 0.5-1%) and therefore deliver higher returns over time. If you are comfortable managing your investments without a distributor, choose Direct plans.' },
    ],
    relatedLinks: [
      { label: 'SIP Calculator', href: '/calculators/sip' },
      { label: 'Explore ELSS Funds', href: '/funds/search' },
      { label: 'LTCG Tax Guide', href: '/learn/ltcg-tax-on-mutual-funds' },
    ],
  },

  'swp-calculator-guide': {
    slug: 'swp-calculator-guide',
    title: 'SWP Calculator — How Long Will Your Corpus Last?',
    description: 'Complete guide to Systematic Withdrawal Plans. Calculate how long your mutual fund corpus will sustain monthly withdrawals.',
    category: 'Calculators', readTime: '6 min read',
    publishedDate: '2026-03-29', updatedDate: '2026-03-29',
    heroIcon: 'trending_down', heroColor: '#f59e0b',
    introduction: 'A Systematic Withdrawal Plan (SWP) allows you to withdraw a fixed amount from your mutual fund investment at regular intervals — monthly, quarterly, or annually. It is the reverse of a SIP: instead of putting money in, you take money out. SWP is ideal for retirees who need regular income from their corpus while keeping the remaining invested to grow. The key question every SWP investor asks: "How long will my money last?" Our SWP calculator answers this precisely.',
    sections: [
      {
        heading: 'How Does SWP Work?',
        content: 'When you set up an SWP, the mutual fund house redeems a fixed number of units from your investment each month to pay you the specified amount. The remaining units continue to stay invested and earn returns. If your fund earns more than your withdrawal rate, your corpus can actually grow even while you withdraw — making the SWP sustainable indefinitely. For example, if you have ₹1 crore invested at 8% annual return and withdraw ₹50,000/month (6% annual withdrawal rate), your corpus will not only last 40+ years but actually grow.',
      },
      {
        heading: 'SWP vs FD Interest — Why SWP Wins',
        content: 'Many retirees park their money in Fixed Deposits and live off the interest. Here is why SWP from a balanced or debt mutual fund is often a better strategy.',
        table: {
          headers: ['Feature', 'SWP (Mutual Fund)', 'FD Interest'],
          rows: [
            { 'Feature': 'Returns', 'SWP (Mutual Fund)': '7-10% (balanced/debt)', 'FD Interest': '6.5-7%' },
            { 'Feature': 'Tax efficiency', 'SWP (Mutual Fund)': 'LTCG after 3 years (debt)', 'FD Interest': 'Fully taxable as income' },
            { 'Feature': 'Flexibility', 'SWP (Mutual Fund)': 'Change amount anytime', 'FD Interest': 'Fixed until maturity' },
            { 'Feature': 'Inflation protection', 'SWP (Mutual Fund)': 'Corpus grows with market', 'FD Interest': 'Erodes purchasing power' },
            { 'Feature': 'Liquidity', 'SWP (Mutual Fund)': 'Withdraw more if needed', 'FD Interest': 'Penalty on premature withdrawal' },
          ],
        },
      },
      {
        heading: 'The 4% Rule — Sustainable Withdrawal Rate',
        content: 'Financial planning literature suggests the "4% Rule" — if you withdraw 4% of your corpus annually (adjusted for inflation), your money should last 30+ years. For Indian markets with higher expected returns (8-10%), a 5-6% withdrawal rate may be sustainable. Our SWP calculator helps you find the exact sustainable withdrawal rate for your corpus and expected return assumptions.',
      },
      {
        heading: 'Try Our Free SWP Calculator',
        content: 'Use our SWP Planner to simulate different scenarios. Adjust your initial investment, monthly withdrawal amount, and expected return rate to see how long your corpus will last and what remains at the end. The calculator runs a month-by-month simulation with compound growth and shows you the exact depletion timeline.',
      },
    ],
    keyTakeaways: [
      'SWP gives regular income from mutual fund investments — ideal for retirees',
      'If withdrawal rate < fund returns, your corpus lasts indefinitely (sustainable SWP)',
      'SWP is more tax-efficient than FD interest for most investors',
      'The 4-6% annual withdrawal rule helps preserve corpus for 30+ years',
      'Start with a balanced or conservative hybrid fund for predictable SWP income',
    ],
    faqs: [
      { q: 'What is a good SWP withdrawal rate?', a: 'A sustainable SWP withdrawal rate is typically 4-6% of your corpus annually. For a ₹1 crore corpus, this means ₹33,000-50,000 per month. If your fund earns more than your withdrawal rate, the corpus will last indefinitely.' },
      { q: 'Is SWP taxable?', a: 'Each SWP withdrawal is technically a partial redemption. The gains portion is taxed as capital gains — LTCG (10% above ₹1.25L) for equity funds held >1 year, or STCG (20%) for equity held <1 year. For debt funds, gains are added to your income and taxed at your slab rate.' },
      { q: 'Which mutual fund is best for SWP?', a: 'Conservative hybrid funds, balanced advantage funds, or debt funds are commonly used for SWP. They offer relatively stable NAVs with moderate returns (7-10%), making withdrawal amounts predictable.' },
    ],
    relatedLinks: [
      { label: 'SWP Calculator', href: '/calculators/swp' },
      { label: 'SIP Calculator', href: '/calculators/sip' },
      { label: 'Direct vs Regular Guide', href: '/learn/direct-vs-regular-mutual-funds' },
    ],
  },

  'direct-vs-regular-mutual-funds': {
    slug: 'direct-vs-regular-mutual-funds',
    title: 'Direct vs Regular Mutual Funds — Complete Guide',
    description: 'Why Direct plans give 0.5-1.5% higher returns than Regular plans. Side-by-side comparison with 20-year impact analysis.',
    category: 'Basics', readTime: '7 min read',
    publishedDate: '2026-03-29', updatedDate: '2026-03-29',
    heroIcon: 'compare_arrows', heroColor: '#06b6d4',
    introduction: 'Every mutual fund scheme in India is available in two variants: Direct Plan and Regular Plan. The only difference is the expense ratio — Regular plans include a distributor commission (trail commission) that Direct plans do not. This seemingly small difference of 0.5-1.5% per year compounds dramatically over long investment horizons. Over 20 years, a ₹10,000 monthly SIP in a Direct plan can accumulate ₹8-15 lakh more than the same SIP in a Regular plan.',
    sections: [
      {
        heading: 'What is the Difference?',
        content: 'Direct plans are purchased directly from the AMC (Asset Management Company) without any intermediary. Regular plans are purchased through distributors, brokers, or platforms that earn a trail commission from the AMC. The NAV of a Direct plan is always higher than the corresponding Regular plan because no commission is deducted. Both plans invest in the exact same portfolio — the fund manager, stock selection, and asset allocation are identical.',
        table: {
          headers: ['Feature', 'Direct Plan', 'Regular Plan'],
          rows: [
            { 'Feature': 'Expense Ratio', 'Direct Plan': '0.3-1.0%', 'Regular Plan': '0.8-2.5%' },
            { 'Feature': 'NAV', 'Direct Plan': 'Higher', 'Regular Plan': 'Lower' },
            { 'Feature': 'Returns', 'Direct Plan': '0.5-1.5% higher/year', 'Regular Plan': 'Lower (commission deducted)' },
            { 'Feature': 'Advice', 'Direct Plan': 'Self-managed', 'Regular Plan': 'Distributor provides guidance' },
            { 'Feature': 'Purchase', 'Direct Plan': 'AMC website, MF Central', 'Regular Plan': 'Through distributor/platform' },
          ],
        },
      },
      {
        heading: '20-Year Impact: ₹10,000 SIP Comparison',
        content: 'Consider a ₹10,000 monthly SIP in a fund that delivers 12% CAGR in the Direct plan and 11% in the Regular plan (1% expense difference). After 20 years, the Direct plan accumulates ₹98.9 lakh while the Regular plan reaches ₹85.8 lakh — a difference of ₹13.1 lakh. That is the cost of the 1% trail commission compounded over 20 years. On a ₹24 lakh total investment, you lose ₹13+ lakh to commissions.',
        table: {
          headers: ['Metric', 'Direct Plan (12%)', 'Regular Plan (11%)', 'Difference'],
          rows: [
            { 'Metric': 'Monthly SIP', 'Direct Plan (12%)': '₹10,000', 'Regular Plan (11%)': '₹10,000', 'Difference': '—' },
            { 'Metric': 'Total Invested', 'Direct Plan (12%)': '₹24,00,000', 'Regular Plan (11%)': '₹24,00,000', 'Difference': '—' },
            { 'Metric': '10-Year Value', 'Direct Plan (12%)': '₹23,23,391', 'Regular Plan (11%)': '₹21,83,468', 'Difference': '₹1,39,923' },
            { 'Metric': '15-Year Value', 'Direct Plan (12%)': '₹50,45,760', 'Regular Plan (11%)': '₹45,63,965', 'Difference': '₹4,81,795' },
            { 'Metric': '20-Year Value', 'Direct Plan (12%)': '₹98,92,554', 'Regular Plan (11%)': '₹85,81,769', 'Difference': '₹13,10,785' },
          ],
        },
      },
      {
        heading: 'When Should You Choose Regular Plans?',
        content: 'Regular plans make sense if: (1) You are a first-time investor who needs hand-holding on which funds to choose. (2) You value the ongoing portfolio review and rebalancing advice from a distributor. (3) You do not want to spend time researching and tracking your mutual fund investments. The commission pays for the distributor\'s time and expertise. However, as your investment knowledge grows, switching to Direct plans is recommended to save on costs.',
      },
      {
        heading: 'How to Switch from Regular to Direct',
        content: 'You can switch from Regular to Direct plan of the same scheme by placing a switch request. Note that a switch is treated as a redemption from Regular and a fresh purchase in Direct — it triggers capital gains tax on any profits in the Regular plan. For equity funds held over 1 year, only LTCG above ₹1.25 lakh is taxed at 10%. Plan the switch strategically to minimise tax impact.',
      },
    ],
    keyTakeaways: [
      'Direct plans save 0.5-1.5% per year in expense ratio vs Regular plans',
      'Over 20 years, a ₹10,000 SIP in Direct plan can grow ₹13+ lakh more than Regular',
      'Both plans have the identical portfolio — only the cost structure differs',
      'Use Direct plans if you can manage your own investments; Regular if you need advisor support',
      'Switching from Regular to Direct triggers capital gains tax — plan strategically',
    ],
    faqs: [
      { q: 'Is Direct plan always better than Regular?', a: 'In terms of returns, yes — Direct plans always deliver higher returns because of lower expense ratios. However, Regular plans include distributor services (advice, portfolio review, rebalancing guidance) which some investors find valuable. The choice depends on whether you need hand-holding or can self-manage.' },
      { q: 'How much more do Direct plans earn?', a: 'Direct plans typically earn 0.5-1.5% more per year than Regular plans. Over 20 years on a ₹10,000 SIP at 12% vs 11%, this difference compounds to ₹13+ lakh.' },
      { q: 'Can I invest in Direct plans through my distributor?', a: 'No. Direct plans are only available directly from the AMC website, MF Central (mfcentral.com), or platforms that explicitly offer Direct plans. If you invest through a distributor, you will get the Regular plan by default.' },
    ],
    relatedLinks: [
      { label: 'SIP Calculator', href: '/calculators/sip' },
      { label: 'Fund Search (Direct Plans)', href: '/funds/search' },
      { label: 'ELSS Tax Saving Guide', href: '/learn/best-elss-tax-saving-funds' },
    ],
  },

  'ltcg-tax-on-mutual-funds': {
    slug: 'ltcg-tax-on-mutual-funds',
    title: 'LTCG Tax on Mutual Funds 2026 — Complete Guide',
    description: 'How Long Term Capital Gains tax works on equity and debt mutual funds. Tax slabs, exemptions, and strategies.',
    category: 'Tax Planning', readTime: '9 min read',
    publishedDate: '2026-03-29', updatedDate: '2026-03-29',
    heroIcon: 'receipt_long', heroColor: '#ec4899',
    introduction: 'Capital gains from mutual fund investments are taxed differently based on the type of fund (equity vs debt) and the holding period (short-term vs long-term). Understanding these rules is crucial for tax-efficient investing. The Union Budget 2024 made significant changes to mutual fund taxation — equity LTCG tax was increased from 10% to 12.5%, and the exemption limit was raised from ₹1 lakh to ₹1.25 lakh. This guide covers the updated tax rules for FY 2025-26 (AY 2026-27).',
    sections: [
      {
        heading: 'Equity Mutual Fund Taxation',
        content: 'Equity mutual funds (where 65%+ of the portfolio is in Indian equities) have the following tax treatment. Short Term Capital Gains (STCG) — gains on units held for less than 12 months — are taxed at 20%. Long Term Capital Gains (LTCG) — gains on units held for 12 months or more — are taxed at 12.5% on gains exceeding ₹1.25 lakh per financial year. Gains up to ₹1.25 lakh are completely tax-free.',
        table: {
          headers: ['Type', 'Holding Period', 'Tax Rate', 'Exemption'],
          rows: [
            { 'Type': 'Equity STCG', 'Holding Period': '< 12 months', 'Tax Rate': '20%', 'Exemption': 'None' },
            { 'Type': 'Equity LTCG', 'Holding Period': '≥ 12 months', 'Tax Rate': '12.5%', 'Exemption': '₹1.25 lakh/year' },
            { 'Type': 'Debt STCG', 'Holding Period': '< 36 months', 'Tax Rate': 'As per income slab', 'Exemption': 'None' },
            { 'Type': 'Debt LTCG', 'Holding Period': '≥ 36 months', 'Tax Rate': 'As per income slab', 'Exemption': 'None (no indexation)' },
          ],
        },
      },
      {
        heading: 'Debt Mutual Fund Taxation (Post 2023)',
        content: 'Since April 2023, all gains from debt mutual funds (where less than 65% is in equities) are taxed at your income tax slab rate, regardless of the holding period. The earlier benefit of indexation for long-term holdings of debt funds has been removed. This means debt fund gains are now treated similarly to FD interest for tax purposes. However, debt funds still have the advantage of tax being deferred until redemption (unlike FD interest which is taxed annually).',
      },
      {
        heading: 'Tax Harvesting Strategy',
        content: 'Tax harvesting is the strategy of booking LTCG up to ₹1.25 lakh every financial year tax-free. If you have equity mutual fund investments with unrealised gains, you can redeem units worth ₹1.25 lakh in gains just before March 31, and immediately reinvest. This resets your purchase price (cost basis) to the current NAV, effectively eliminating future tax on those gains. This is perfectly legal and widely practised.',
      },
      {
        heading: 'Which Mutual Funds Are Most Tax-Efficient?',
        content: 'For holding periods over 1 year, equity mutual funds are the most tax-efficient due to the ₹1.25 lakh LTCG exemption and the lower 12.5% rate. For shorter periods, liquid funds or overnight funds are efficient for parking cash. For debt allocation, consider holding for at least 3+ years in fund-of-funds that qualify as equity-oriented (>65% equity allocation) to benefit from the equity taxation regime.',
      },
    ],
    keyTakeaways: [
      'Equity LTCG: 12.5% on gains above ₹1.25 lakh (holding > 12 months)',
      'Equity STCG: 20% flat (holding < 12 months)',
      'Debt fund gains are taxed at your income slab rate — no indexation benefit',
      'Use tax harvesting: book ₹1.25 lakh LTCG annually tax-free and reinvest',
      'Equity funds are the most tax-efficient for long-term wealth building',
    ],
    faqs: [
      { q: 'How much LTCG from mutual funds is tax-free?', a: 'For equity mutual funds, LTCG up to ₹1.25 lakh per financial year is completely tax-free. Gains above ₹1.25 lakh are taxed at 12.5% without indexation. This exemption applies to the combined LTCG from all equity investments (stocks + equity mutual funds).' },
      { q: 'Is there any tax benefit for holding debt funds long term?', a: 'No — since April 2023, debt fund gains are taxed at your income slab rate regardless of holding period. The earlier indexation benefit for holdings over 3 years has been removed.' },
      { q: 'What is tax harvesting in mutual funds?', a: 'Tax harvesting means redeeming equity mutual fund units to book LTCG up to ₹1.25 lakh (tax-free) before March 31, and immediately reinvesting. This resets your cost basis and eliminates future tax on those gains.' },
      { q: 'How is SIP taxed in mutual funds?', a: 'Each SIP instalment is treated as a separate purchase. When you redeem, the FIFO (First In First Out) method applies — the oldest units are sold first. Each instalment has its own holding period for determining STCG vs LTCG.' },
    ],
    relatedLinks: [
      { label: 'ELSS Tax Saving Funds', href: '/learn/best-elss-tax-saving-funds' },
      { label: 'SIP Calculator', href: '/calculators/sip' },
      { label: 'Fund Search', href: '/funds/search' },
    ],
  },

  'what-is-stp-in-mutual-funds': {
    slug: 'what-is-stp-in-mutual-funds',
    title: 'What is STP in Mutual Funds? Complete Guide',
    description: 'Systematic Transfer Plan explained — how to gradually move money from debt to equity funds. Benefits, taxation, and when to use STP vs SIP.',
    category: 'Basics', readTime: '6 min read',
    publishedDate: '2026-03-29', updatedDate: '2026-03-29',
    heroIcon: 'swap_horiz', heroColor: '#a855f7',
    introduction: 'A Systematic Transfer Plan (STP) allows you to transfer a fixed amount from one mutual fund scheme to another at regular intervals. It is most commonly used to transfer money from a debt/liquid fund to an equity fund over several months. This achieves the benefit of rupee cost averaging (like SIP) while earning returns on the uninvested corpus (unlike SIP where the money sits in a savings account earning 3-4%). STP is ideal when you receive a large lump sum — inheritance, bonus, property sale — and want to deploy it into equity markets gradually.',
    sections: [
      {
        heading: 'How Does STP Work?',
        content: 'When you set up an STP, you invest your lump sum in a source fund (typically a liquid or ultra-short duration debt fund). The AMC then automatically transfers a fixed amount from the source fund to the target fund (typically an equity fund) every month or week. The source fund continues to earn debt fund returns (5-7%) on the uninvested portion, while the target fund benefits from rupee cost averaging as the money enters equity markets in installments.',
      },
      {
        heading: 'STP vs Lump Sum vs SIP',
        content: 'Each deployment strategy has its place. Here is how they compare.',
        table: {
          headers: ['Strategy', 'When to Use', 'Advantage', 'Disadvantage'],
          rows: [
            { 'Strategy': 'STP', 'When to Use': 'Have lump sum, want equity exposure', 'Advantage': 'Uninvested corpus earns returns + rupee cost averaging', 'Disadvantage': 'Each transfer is a taxable event from source fund' },
            { 'Strategy': 'Lump Sum', 'When to Use': 'Markets are corrected/cheap', 'Advantage': 'Maximum returns if timing is right', 'Disadvantage': 'Timing risk — markets may fall further' },
            { 'Strategy': 'SIP', 'When to Use': 'Regular income, no lump sum', 'Advantage': 'Disciplined, automatic', 'Disadvantage': 'Uninvested money earns only savings rate (3-4%)' },
          ],
        },
      },
      {
        heading: 'Taxation of STP',
        content: 'Each STP transfer is treated as a redemption from the source fund and a fresh purchase in the target fund. If the source fund is a debt fund, short-term gains (< 3 years holding) are taxed at your income slab rate. If the source is a liquid fund and transfers happen within days/weeks of investment, the tax impact is minimal because gains are very small. Always consider the tax implications before setting up an STP — the tax cost may offset some of the benefit of earning returns on the uninvested corpus.',
      },
      {
        heading: 'Try Our Free STP Calculator',
        content: 'Use our STP Planner to simulate different transfer scenarios. Adjust your lump sum amount, monthly transfer, source fund return (debt), and target fund return (equity) to see the optimal transfer duration and final portfolio value. The calculator runs a month-by-month simulation showing how your money moves from the source to the target fund.',
      },
    ],
    keyTakeaways: [
      'STP transfers money from a debt fund to an equity fund at regular intervals',
      'Uninvested corpus earns 5-7% in the source fund (vs 3-4% in a savings account with SIP)',
      'Each STP transfer is a taxable event — gains from the source fund are taxed on redemption',
      'STP is best for deploying a lump sum into equity markets over 6-12 months',
      'Use our STP Calculator to find the optimal transfer amount and duration',
    ],
    faqs: [
      { q: 'What is the difference between STP and SIP?', a: 'SIP invests money from your bank account into a fund every month. STP transfers money from one fund (source) to another fund (target). The key advantage of STP is that your uninvested lump sum earns returns in the source fund (5-7%) while waiting to be deployed, whereas with SIP the money sits in a savings account (3-4%).' },
      { q: 'Is STP better than lump sum investing?', a: 'In volatile markets, STP reduces timing risk through rupee cost averaging. However, if markets rise steadily, lump sum investing outperforms STP because the full amount benefits from the uptrend from day one. Historically, lump sum outperforms STP about 65% of the time, but STP provides peace of mind.' },
      { q: 'How long should an STP run?', a: 'Most financial planners recommend running an STP for 6-12 months. Shorter than 6 months provides limited averaging benefit. Longer than 12 months keeps too much money in debt when the goal is equity exposure.' },
    ],
    relatedLinks: [
      { label: 'STP Calculator', href: '/calculators/stp' },
      { label: 'SWP Guide', href: '/learn/swp-calculator-guide' },
      { label: 'Direct vs Regular Guide', href: '/learn/direct-vs-regular-mutual-funds' },
    ],
  },
};

// ─── Generate metadata for each article ──────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) return { title: 'Article Not Found' };
  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.publishedDate,
      modifiedTime: article.updatedDate,
    },
  };
}

// ─── Page ────────────────────────────────────────────────────
export default async function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) notFound();

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      {/* FAQ JSON-LD Schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main className="pt-36 pb-20 px-4 md:px-6 lg:px-8 max-w-[900px] mx-auto flex-1 w-full">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#859586] mb-6">
          <Link href="/learn" className="hover:text-[#44f593] transition-colors">Learn</Link>
          <span>/</span>
          <span className="text-[#dce5df] line-clamp-1">{article.title}</span>
        </div>

        {/* Hero */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: article.heroColor }}>{article.category}</span>
            <span className="text-[10px] text-[#859586]">·</span>
            <span className="text-[10px] text-[#859586]">{article.readTime}</span>
            <span className="text-[10px] text-[#859586]">·</span>
            <span className="text-[10px] text-[#859586]">Updated {new Date(article.updatedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <h1 className="font-['Space_Grotesk'] font-bold text-3xl md:text-4xl text-[#dce5df] tracking-tight mb-4">
            {article.title}
          </h1>
          <p className="text-[#859586] text-base leading-relaxed">{article.introduction}</p>
        </header>

        {/* Sections */}
        <div className="space-y-10">
          {article.sections.map((section, i) => (
            <section key={i}>
              <h2 className="font-['Space_Grotesk'] font-bold text-xl md:text-2xl text-[#dce5df] mb-4">{section.heading}</h2>
              <p className="text-[#c0c9c2] leading-relaxed mb-4">{section.content}</p>
              {section.table && (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        {section.table.headers.map(h => (
                          <th key={h} className="py-3 px-4 text-left text-[10px] uppercase tracking-widest text-[#859586] font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row, j) => (
                        <tr key={j} className="border-b border-white/5 hover:bg-white/[0.02]">
                          {section.table!.headers.map(h => (
                            <td key={h} className="py-3 px-4 text-[#dce5df]">{String(row[h] ?? '—')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Key Takeaways */}
        <div className="my-10 p-6 bg-[#44f593]/5 border border-[#44f593]/20 rounded-2xl">
          <h3 className="font-['Space_Grotesk'] font-bold text-lg text-[#44f593] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
            Key Takeaways
          </h3>
          <ul className="space-y-2">
            {article.keyTakeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[#dce5df]">
                <span className="text-[#44f593] shrink-0 mt-0.5">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* FAQs */}
        <div className="mb-10">
          <h2 className="font-['Space_Grotesk'] font-bold text-xl text-[#dce5df] mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {article.faqs.map((faq, i) => (
              <details key={i} className="glass-card-vi rounded-xl overflow-hidden group">
                <summary className="p-5 cursor-pointer text-[#dce5df] font-medium text-sm hover:bg-white/[0.02] transition-colors flex items-center justify-between">
                  {faq.q}
                  <span className="material-symbols-outlined text-[#44f593] text-lg group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <div className="px-5 pb-5 text-sm text-[#859586] leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* Related Links */}
        <div className="flex flex-wrap gap-3 mb-10">
          {article.relatedLinks.map(link => (
            <Link key={link.href} href={link.href}
              className="px-4 py-2 rounded-xl bg-[#161d1a] border border-white/5 text-sm text-[#44f593] font-medium hover:border-[#44f593]/30 transition-colors">
              {link.label} →
            </Link>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-6">
          <p className="text-xs text-amber-400 leading-relaxed">
            <span className="font-bold">Disclaimer:</span> This article is for educational and informational purposes only. It does NOT constitute investment advice. Return data shown is historical and past performance is not indicative of future results. Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605) and is NOT a SEBI-registered Investment Adviser. Please consult a qualified financial advisor before making investment decisions.
          </p>
        </div>

        <ComplianceDisclaimer variant="general" className="mt-4" />
      </main>

      <SiteFooter />
    </div>
  );
}
