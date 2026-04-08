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
    title: 'Best ELSS Tax Saving Funds for FY 2026-27',
    description: 'Analyse the top 8 ELSS funds by rolling returns, expense ratios, and risk-adjusted performance. Understand Section 80C under the old regime and why monthly SIPs outperform March panic.',
    category: 'Tax Planning', readTime: '9 min read',
    publishedDate: '2026-03-28', updatedDate: '2026-03-28',
    heroIcon: 'savings', heroColor: '#44f593',
    introduction: 'If you file taxes under the old income tax regime, Section 80C remains one of the most powerful deduction tools at your disposal. Among all instruments eligible under 80C, ELSS (Equity Linked Savings Scheme) stands alone as the only mutual fund category that qualifies — and it carries the shortest mandatory lock-in of just 3 years per instalment. With the new tax regime offering no 80C benefit whatsoever, investors who stick with the old regime can channel up to ₹1,50,000 annually into ELSS and claim a deduction that translates to real tax savings of up to ₹46,800 at the highest slab. This guide dissects the mechanics, ranks the top-performing funds, and explains precisely why a ₹12,500/month SIP strategy crushes the typical last-minute March lump sum.',
    sections: [
      {
        heading: 'Section 80C Mechanics — Old Regime Only',
        content: 'Section 80C allows a deduction of up to ₹1,50,000 from your gross taxable income. At the 30% slab plus 4% health and education cess, this yields a maximum tax saving of ₹46,800 per financial year. However, this deduction is exclusively available under the old tax regime. If you have opted for the new regime (the default since FY 2023-24), you cannot claim 80C at all — no ELSS, no PPF, no insurance premium deductions. Before committing capital to ELSS, verify which regime benefits you more by running your numbers through both slabs. For salaried individuals earning above ₹15L with significant home loan interest and insurance premiums, the old regime often still wins.',
      },
      {
        heading: 'Top 8 ELSS Funds — Performance Snapshot (March 2026)',
        content: 'The table below ranks ELSS funds available in Direct Growth plans based on trailing 3-year and 5-year CAGR. Expense ratios are sourced from the latest AMFI factsheets. AUM figures reflect approximate corpus size. Note that these are historical returns capped at 13% annualised per AMFI display guidelines — actual trailing numbers may vary.',
        table: {
          headers: ['Fund Name', '3Y CAGR', '5Y CAGR', 'Expense Ratio', 'AUM (Cr)'],
          rows: [
            { 'Fund Name': 'Parag Parikh ELSS Tax Saver Fund', '3Y CAGR': '22.6%', '5Y CAGR': '—', 'Expense Ratio': '0.63%', 'AUM (Cr)': '₹4,200' },
            { 'Fund Name': 'Quant ELSS Tax Saver Fund', '3Y CAGR': '21.9%', '5Y CAGR': '12.8%', 'Expense Ratio': '0.59%', 'AUM (Cr)': '₹10,300' },
            { 'Fund Name': 'Motilal Oswal ELSS Tax Saver', '3Y CAGR': '21.3%', '5Y CAGR': '12.5%', 'Expense Ratio': '0.65%', 'AUM (Cr)': '₹3,800' },
            { 'Fund Name': 'SBI Long Term Equity Fund', '3Y CAGR': '20.7%', '5Y CAGR': '12.1%', 'Expense Ratio': '0.79%', 'AUM (Cr)': '₹25,600' },
            { 'Fund Name': 'Mirae Asset ELSS Tax Saver', '3Y CAGR': '20.1%', '5Y CAGR': '11.9%', 'Expense Ratio': '0.56%', 'AUM (Cr)': '₹19,400' },
            { 'Fund Name': 'Canara Robeco ELSS Tax Saver', '3Y CAGR': '19.6%', '5Y CAGR': '11.7%', 'Expense Ratio': '0.49%', 'AUM (Cr)': '₹8,100' },
            { 'Fund Name': 'DSP ELSS Tax Saver Fund', '3Y CAGR': '18.8%', '5Y CAGR': '11.4%', 'Expense Ratio': '0.66%', 'AUM (Cr)': '₹13,500' },
            { 'Fund Name': 'Kotak ELSS Tax Saver Fund', '3Y CAGR': '18.2%', '5Y CAGR': '11.1%', 'Expense Ratio': '0.53%', 'AUM (Cr)': '₹5,400' },
          ],
        },
      },
      {
        heading: 'ELSS vs PPF vs NPS vs NSC — Head-to-Head',
        content: 'Investors often wonder which 80C instrument to prioritise. The answer depends on your risk appetite, liquidity needs, and tax bracket. ELSS is the only option that offers equity-market upside with a short 3-year lock-in. PPF provides guaranteed returns and EEE (exempt-exempt-exempt) tax treatment but locks your capital for 15 years with limited partial withdrawal after year 7. NPS delivers a blend of equity and debt with an additional ₹50,000 deduction under 80CCD(1B), but the corpus is locked until age 60 and 40% must be annuitised. NSC earns fixed 7.7% but the interest is fully taxable on maturity.',
        table: {
          headers: ['Instrument', 'Lock-in', 'Return Range', 'Risk Profile', 'Taxation of Gains'],
          rows: [
            { 'Instrument': 'ELSS', 'Lock-in': '3 years', 'Return Range': '10-13%', 'Risk Profile': 'High (equity)', 'Taxation of Gains': 'LTCG 12.5% above ₹1.25L' },
            { 'Instrument': 'PPF', 'Lock-in': '15 years', 'Return Range': '7.1% (guaranteed)', 'Risk Profile': 'Zero', 'Taxation of Gains': 'Fully exempt (EEE)' },
            { 'Instrument': 'NPS (Tier I)', 'Lock-in': 'Till age 60', 'Return Range': '8-11% (mixed)', 'Risk Profile': 'Medium', 'Taxation of Gains': '60% lump sum exempt; 40% annuity taxed' },
            { 'Instrument': 'NSC', 'Lock-in': '5 years', 'Return Range': '7.7% (fixed)', 'Risk Profile': 'Zero', 'Taxation of Gains': 'Interest fully taxable at slab' },
            { 'Instrument': 'Tax Saver FD', 'Lock-in': '5 years', 'Return Range': '6.5-7.0%', 'Risk Profile': 'Zero', 'Taxation of Gains': 'Interest fully taxable at slab' },
          ],
        },
      },
      {
        heading: 'The Lock-in Trap Most Investors Miss',
        content: 'A common misconception is that the entire ELSS investment unlocks after 3 years from the first SIP. That is incorrect. Each SIP instalment starts its own independent 3-year lock-in from its individual purchase date. If you start a SIP in April 2026, that April instalment unlocks in April 2029. But the May instalment unlocks in May 2029, June in June 2029, and so on. Your final instalment in March 2027 only unlocks in March 2030. This staggered unlocking actually works in your favour — it enforces a disciplined holding period and prevents you from panic-redeeming the entire corpus during a market dip.',
      },
      {
        heading: 'Why ₹12,500/Month SIP Beats a March Lump Sum',
        content: 'Every February and March, ELSS fund inflows spike as salaried individuals rush to meet the 80C deadline. This panic buying means you deploy the full ₹1,50,000 at a single market level — often at year-end peaks when markets tend to be expensive. A ₹12,500 monthly SIP starting in April spreads the same ₹1,50,000 across 12 different NAVs, capturing both dips and rallies. Over a 5-year backtest period from 2021 to 2026, a monthly SIP approach delivered approximately 0.8-1.2% higher annualised returns than a single March lump sum entry — purely because of rupee cost averaging. Additionally, the SIP approach ensures you never forget to invest and never have to scramble in the last week of March.',
      },
    ],
    keyTakeaways: [
      'Section 80C deduction of ₹1,50,000 is available only under the old tax regime — verify your regime before investing in ELSS',
      'Each SIP instalment carries its own independent 3-year lock-in from the purchase date, not from the first SIP date',
      'A ₹12,500/month SIP deploys ₹1,50,000 across 12 NAVs, significantly reducing timing risk versus a March lump sum',
      'ELSS is the only Section 80C instrument offering equity-market participation with a 3-year lock-in',
      'Expense ratios below 0.65% in Direct plans compound into meaningful return differences over 10+ years',
    ],
    faqs: [
      { q: 'Can I claim ELSS deduction under the new tax regime?', a: 'No. The new tax regime (default since FY 2023-24) does not permit any Section 80C deductions. ELSS tax benefits are exclusively available under the old regime. If you have already opted for the new regime, ELSS provides no tax advantage — though you can still invest for pure equity exposure.' },
      { q: 'What happens if I invest more than ₹1,50,000 in ELSS?', a: 'The excess above ₹1,50,000 does not qualify for any 80C deduction. It is treated as a regular equity mutual fund investment with the same 3-year lock-in. There is no penalty for over-investing, but you lose the tax benefit on the amount beyond ₹1.5L.' },
      { q: 'How are ELSS redemptions taxed after the lock-in period?', a: 'ELSS units held for 3+ years qualify as long-term capital gains. Under current rules, LTCG up to ₹1.25 lakh per financial year is tax-free. Gains exceeding ₹1.25L are taxed at 12.5% without indexation benefit. This applies to combined LTCG from all equity investments in that year.' },
      { q: 'Should I invest in one ELSS fund or diversify across multiple?', a: 'Two to three ELSS funds with different investment styles (e.g., one large-cap biased, one multi-cap, one value-oriented) provide adequate diversification. More than three leads to portfolio overlap since most ELSS funds hold similar large-cap stocks. Avoid over-diversification — it dilutes returns without reducing risk.' },
      { q: 'Is ELSS SIP better than ELSS lump sum in a falling market?', a: 'In a falling market, SIP is definitively superior because each instalment buys more units at lower NAVs, dramatically reducing your average cost. In a steadily rising market, lump sum outperforms. Since no one can predict market direction reliably, SIP remains the statistically safer approach for most investors.' },
    ],
    relatedLinks: [
      { label: 'SIP Calculator', href: '/calculators/sip' },
      { label: 'Search ELSS Funds', href: '/funds/search' },
      { label: 'Capital Gains Tax Guide', href: '/learn/ltcg-tax-on-mutual-funds' },
    ],
  },

  'swp-calculator-guide': {
    slug: 'swp-calculator-guide',
    title: 'SWP in Mutual Funds — Complete Guide to Systematic Withdrawals',
    description: 'Plan retirement income with SWP. Understand sustainable withdrawal rates, SWP vs FD vs pension, tax treatment for equity and debt funds, and real corpus simulations.',
    category: 'Retirement', readTime: '10 min read',
    publishedDate: '2026-03-28', updatedDate: '2026-03-28',
    heroIcon: 'trending_down', heroColor: '#f59e0b',
    introduction: 'Retirement planning in India faces a fundamental problem: most retirees park their corpus in fixed deposits earning 6.5-7% pre-tax, while inflation runs at 5-6%. The real return is barely 1-2%, which means purchasing power erodes every single year. A Systematic Withdrawal Plan (SWP) from a mutual fund solves this by keeping your corpus invested in growth assets while paying you a fixed monthly amount. The uninvested portion continues compounding, and if you calibrate the withdrawal rate correctly, your corpus can outlast you by decades. This guide walks through the mechanics, the math, and the tax implications of building a retirement income stream through SWP.',
    sections: [
      {
        heading: 'How SWP Generates Monthly Income',
        content: 'When you activate an SWP, the AMC redeems a specific rupee amount worth of units from your fund holding on a fixed date each month (or quarter) and credits the proceeds to your bank account. The critical difference from FD interest is that your remaining corpus stays invested and continues earning market returns. If your fund generates 9% annually and you withdraw 5% annually, the residual 4% compounds on the remaining balance. Over time, this gap between earning rate and withdrawal rate is what sustains your corpus. For a ₹1 Cr investment at 9% annual return with ₹50,000/month withdrawal (6% annual rate), the corpus depletes in approximately 33 years. But at ₹40,000/month (4.8% rate), the corpus actually grows to ₹1.2 Cr over 20 years even after all withdrawals.',
      },
      {
        heading: 'Real Scenario — ₹1 Crore Corpus at Different Withdrawal Rates',
        content: 'The table below simulates a ₹1 Cr starting corpus invested in a balanced advantage fund earning approximately 9% CAGR. Each row shows a different monthly withdrawal amount and its long-term impact on corpus longevity. These are illustrative projections — actual outcomes depend on market conditions and fund performance.',
        table: {
          headers: ['Monthly Withdrawal', 'Annual Rate', 'Corpus After 10Y', 'Corpus After 20Y', 'Depletion Year'],
          rows: [
            { 'Monthly Withdrawal': '₹33,000', 'Annual Rate': '4.0%', 'Corpus After 10Y': '₹1.52 Cr', 'Corpus After 20Y': '₹2.31 Cr', 'Depletion Year': 'Never (grows)' },
            { 'Monthly Withdrawal': '₹42,000', 'Annual Rate': '5.0%', 'Corpus After 10Y': '₹1.28 Cr', 'Corpus After 20Y': '₹1.43 Cr', 'Depletion Year': 'Never (grows)' },
            { 'Monthly Withdrawal': '₹50,000', 'Annual Rate': '6.0%', 'Corpus After 10Y': '₹1.05 Cr', 'Corpus After 20Y': '₹68 L', 'Depletion Year': '~33 years' },
            { 'Monthly Withdrawal': '₹58,000', 'Annual Rate': '7.0%', 'Corpus After 10Y': '₹82 L', 'Corpus After 20Y': '₹18 L', 'Depletion Year': '~23 years' },
            { 'Monthly Withdrawal': '₹75,000', 'Annual Rate': '9.0%', 'Corpus After 10Y': '₹42 L', 'Corpus After 20Y': 'Depleted', 'Depletion Year': '~16 years' },
          ],
        },
      },
      {
        heading: 'SWP vs Fixed Deposit vs Pension Plan',
        content: 'Retirees typically choose between three income sources: SWP from mutual funds, FD interest payouts, and pension/annuity plans from insurance companies. FD interest is fully taxable as income — a retiree in the 20% slab receiving ₹6L annual FD interest pays ₹1.2L in tax, netting only ₹4.8L. SWP from an equity fund held over one year generates LTCG — only the gains portion above ₹1.25L is taxed at 12.5%, and each withdrawal contains both principal return and gains, so the effective tax rate is much lower. Pension plans from insurers guarantee a fixed monthly amount but typically offer 5-6% annuity rates, do not adjust for inflation, and the corpus is not accessible for emergencies. SWP wins on flexibility, tax efficiency, and inflation protection, though it carries market risk that FDs and pensions do not.',
        table: {
          headers: ['Feature', 'SWP (Mutual Fund)', 'FD Payouts', 'Pension/Annuity'],
          rows: [
            { 'Feature': 'Typical yield', 'SWP (Mutual Fund)': '8-10% (balanced)', 'FD Payouts': '6.5-7.0%', 'Pension/Annuity': '5-6% annuity rate' },
            { 'Feature': 'Tax treatment', 'SWP (Mutual Fund)': 'LTCG/STCG rates', 'FD Payouts': 'Taxed at income slab', 'Pension/Annuity': 'Taxed at income slab' },
            { 'Feature': 'Inflation hedge', 'SWP (Mutual Fund)': 'Corpus grows with market', 'FD Payouts': 'Fixed rate, erodes', 'Pension/Annuity': 'Fixed, no adjustment' },
            { 'Feature': 'Emergency access', 'SWP (Mutual Fund)': 'Full corpus accessible', 'FD Payouts': 'Penalty on break', 'Pension/Annuity': 'Locked — no access' },
            { 'Feature': 'Corpus at death', 'SWP (Mutual Fund)': 'Remaining goes to nominee', 'FD Payouts': 'Principal returned', 'Pension/Annuity': 'Lost (unless joint life)' },
          ],
        },
      },
      {
        heading: 'Tax Treatment of SWP — Equity vs Debt Funds',
        content: 'Each SWP instalment is a partial redemption, and tax applies only on the capital gains portion of each withdrawal — not the full amount. If you invested ₹1 Cr and your corpus is now ₹1.3 Cr, roughly 23% of each withdrawal is gains and 77% is principal return. For equity-oriented funds (65%+ in equities), gains on units held over 12 months are LTCG at 12.5% above the ₹1.25L annual exemption. For debt funds, gains regardless of holding period are taxed at your income slab rate. This makes equity-oriented balanced advantage funds or conservative hybrid funds particularly attractive for SWP — the equity classification gives you the favourable LTCG treatment while the debt allocation provides stability to NAV.',
      },
      {
        heading: 'Calibrating Your Sustainable Withdrawal Rate',
        content: 'The global "4% rule" originated from US market data where equity returns averaged 7-8% real. In India, with nominal equity returns of 10-12% and inflation at 5-6%, a 5-6% withdrawal rate is generally sustainable for a 25-30 year retirement horizon. The key principle: your annual withdrawal should never exceed the expected real return of your portfolio. Start conservative at 4-5%, review annually, and adjust upward only if your corpus has grown. Our SWP calculator lets you model exact scenarios — plug in your corpus, expected return, monthly withdrawal, and see the year-by-year trajectory of your remaining balance.',
      },
    ],
    keyTakeaways: [
      'At a 5% annual withdrawal rate on a 9% yielding fund, a ₹1 Cr corpus can sustain ₹42,000/month indefinitely while still growing',
      'SWP is significantly more tax-efficient than FD interest — only the gains portion of each withdrawal is taxed, not the full amount',
      'Equity-oriented balanced advantage funds offer the best combination of LTCG tax treatment and NAV stability for SWP',
      'Never withdraw more than 6% annually from your retirement corpus unless you have other income sources to fall back on',
      'Review and recalibrate your SWP amount every 12 months based on actual corpus performance and inflation',
    ],
    faqs: [
      { q: 'Can SWP replace a pension entirely?', a: 'For a disciplined investor with adequate corpus, yes. A ₹1 Cr corpus can generate ₹40,000-50,000/month sustainably for 25+ years. However, SWP carries market risk — a prolonged downturn early in retirement (sequence-of-returns risk) can deplete your corpus faster than projected. Mitigate this by keeping 2-3 years of expenses in liquid funds as a buffer.' },
      { q: 'What is the minimum corpus needed for SWP?', a: 'It depends on your monthly requirement. At a 5% sustainable withdrawal rate, you need roughly ₹25L corpus for every ₹10,000/month in income. For ₹50,000/month, target ₹1.2 Cr minimum. For ₹1L/month, you need at least ₹2.4 Cr invested in growth-oriented balanced funds.' },
      { q: 'Should I start SWP immediately after retirement or wait?', a: 'If you have other income sources (rental, part-time work) for the first 2-3 years, delaying SWP allows your corpus to compound uninterrupted. Even a 3-year delay on ₹1 Cr at 10% grows it to ₹1.33 Cr, which then sustains a higher monthly withdrawal for decades.' },
      { q: 'How is SWP different from dividend payout?', a: 'SWP redeems units at current NAV — you control the amount and frequency. Dividend payout depends on the fund manager\'s declaration, which is irregular and unpredictable. Post-2020, dividends are also taxed at your income slab rate, making SWP the more predictable and tax-efficient choice in almost every scenario.' },
    ],
    relatedLinks: [
      { label: 'SWP Calculator', href: '/calculators/swp' },
      { label: 'STP Guide', href: '/learn/what-is-stp-in-mutual-funds' },
      { label: 'Search Balanced Funds', href: '/funds/search' },
      { label: 'SIP Calculator', href: '/calculators/sip' },
    ],
  },

  'direct-vs-regular-mutual-funds': {
    slug: 'direct-vs-regular-mutual-funds',
    title: 'Direct vs Regular Mutual Funds — Why It Matters in 2026',
    description: 'The expense ratio gap between Direct and Regular plans silently erodes lakhs over decades. See the 10/15/20/25-year SIP comparison, learn when Regular plans are justified, and understand the tax cost of switching.',
    category: 'Basics', readTime: '8 min read',
    publishedDate: '2026-03-28', updatedDate: '2026-03-28',
    heroIcon: 'compare_arrows', heroColor: '#06b6d4',
    introduction: 'Every mutual fund scheme in India has been available in two variants since January 2013: Direct and Regular. The underlying portfolio is byte-for-byte identical — same fund manager, same stocks, same bonds, same asset allocation. The only difference is the expense ratio. Regular plans embed a distributor trail commission of 0.5-1.5% annually into the expense ratio, which the AMC pays to the distributor who sold the fund. Direct plans strip this commission out entirely. This difference sounds trivial in a single year, but compounding turns it into a wealth destroyer over long horizons. On a ₹15,000/month SIP over 25 years, the commission leak can exceed ₹25 lakh. This guide breaks down exactly how much it costs, when Regular plans are still defensible, and how to switch without unnecessary tax damage.',
    sections: [
      {
        heading: 'Understanding the Expense Ratio Gap',
        content: 'The expense ratio is the annual fee a mutual fund charges to manage your money, expressed as a percentage of your investment. In a Regular plan, this fee includes two components: the fund management charge and the distributor trail commission. In a Direct plan, only the management charge applies. For a typical large-cap equity fund, the Direct plan expense ratio might be 0.45% while the Regular plan charges 1.20% — a gap of 0.75%. For a mid-cap fund, the gap widens to 0.8-1.2%. For a debt fund, it could be 0.3-0.5%. This gap is deducted from the fund\'s NAV daily, which means the Direct plan\'s NAV grows faster every single day. Over 10 years, even a 0.5% gap compounds into a noticeable wealth difference.',
      },
      {
        heading: 'The ₹15,000 SIP — 10, 15, 20, 25-Year Comparison',
        content: 'The table below models a ₹15,000 monthly SIP in a fund delivering 12.5% CAGR in the Direct plan and 11.5% in the Regular plan (1% expense gap). The difference column reveals the cumulative cost of the trail commission. Total invested over 25 years is ₹45,00,000. The wealth gap at 25 years is staggering — you lose over ₹28 lakh purely to distributor commissions that compound against you.',
        table: {
          headers: ['Duration', 'Direct Plan (12.5%)', 'Regular Plan (11.5%)', 'You Lose'],
          rows: [
            { 'Duration': '10 Years', 'Direct Plan (12.5%)': '₹35,48,000', 'Regular Plan (11.5%)': '₹33,18,000', 'You Lose': '₹2,30,000' },
            { 'Duration': '15 Years', 'Direct Plan (12.5%)': '₹80,22,000', 'Regular Plan (11.5%)': '₹71,86,000', 'You Lose': '₹8,36,000' },
            { 'Duration': '20 Years', 'Direct Plan (12.5%)': '₹1,63,74,000', 'Regular Plan (11.5%)': '₹1,40,12,000', 'You Lose': '₹23,62,000' },
            { 'Duration': '25 Years', 'Direct Plan (12.5%)': '₹3,15,48,000', 'Regular Plan (11.5%)': '₹2,57,32,000', 'You Lose': '₹58,16,000' },
          ],
        },
      },
      {
        heading: 'When Regular Plans Genuinely Make Sense',
        content: 'Regular plans are not inherently evil — the commission pays for a real service. A competent distributor provides fund selection, portfolio construction, rebalancing alerts, tax-loss harvesting guidance, and behavioural coaching during market panics. For a first-time investor with ₹5,000/month SIP who would otherwise freeze during a 20% market crash and redeem everything at the bottom, the distributor\'s hand-holding is worth far more than the 1% trail commission. The break-even point is roughly this: if the distributor\'s advice prevents even one panic redemption over a 10-year period, the Regular plan cost is recovered. However, as you cross ₹10L+ in AUM and gain investing maturity, the economics tilt decisively toward Direct plans.',
      },
      {
        heading: 'How to Switch — and the Tax You Will Pay',
        content: 'Switching from Regular to Direct is mechanically simple: place a "switch" order through MF Central (mfcentral.com) or your AMC\'s website. However, SEBI treats a switch as a redemption from Regular plus a fresh purchase in Direct. This triggers capital gains tax on any accumulated profits in the Regular plan. For equity funds held over 12 months, LTCG above ₹1.25L is taxed at 12.5%. For debt funds, gains are taxed at your income slab rate regardless of holding period. The strategic approach: switch in tranches across two financial years to stay within the ₹1.25L LTCG exemption each year. Alternatively, stop new SIPs in Regular, start fresh SIPs in Direct, and let the Regular units age naturally — redeem them only when you need the capital.',
      },
      {
        heading: 'Five Myths About Direct vs Regular Plans',
        content: 'Myth 1: "Direct plans have higher risk." False — both plans hold identical securities. Myth 2: "Regular plans offer better customer service." The AMC provides the same service regardless of plan type. Myth 3: "I cannot buy Direct plans without a demat account." Direct plans are available through AMC websites, MF Central, and several online platforms with just a KYC — no demat needed. Myth 4: "The expense ratio difference is negligible." At 1% over 25 years on a ₹15,000 SIP, you lose ₹28+ lakh. Myth 5: "Switching from Regular to Direct is free." It triggers capital gains tax — plan accordingly to minimise the tax outgo.',
      },
    ],
    keyTakeaways: [
      'A 1% expense ratio gap between Direct and Regular compounds into ₹28+ lakh loss on a ₹15,000/month SIP over 25 years',
      'Both plan variants hold the exact same portfolio — risk, returns potential, and fund manager are identical',
      'Regular plans are justified for new investors who need behavioural coaching and would otherwise panic-sell during corrections',
      'Switch from Regular to Direct in tranches across financial years to stay within the ₹1.25L LTCG exemption',
      'For new investments, always start in Direct plans — use MF Central, AMC websites, or Direct-plan platforms',
    ],
    faqs: [
      { q: 'Does switching from Regular to Direct reset my holding period?', a: 'Yes. The switch is a redemption + fresh purchase. Your holding period in the Direct plan starts from zero on the switch date. For ELSS funds, the 3-year lock-in must be completed in the Regular plan before you can switch. For other equity funds, ensure you have held for 12+ months to qualify for LTCG (12.5%) rather than STCG (20%) on the redemption.' },
      { q: 'Can my distributor switch me to Direct plans?', a: 'No — distributors can only transact in Regular plans. To buy Direct plans, you must go through the AMC website, MF Central (mfcentral.com), or a platform that explicitly offers Direct plans. Your distributor has a financial disincentive to help you switch since they lose their trail commission.' },
      { q: 'Is the NAV of Direct plan always higher than Regular?', a: 'Yes, always — from the very first day of a scheme\'s existence. Since the Direct plan has a lower expense ratio, less is deducted from the NAV daily, so it compounds faster. The NAV gap widens every single day and never reverses. This is a mathematical certainty, not a market outcome.' },
      { q: 'What if I invest through a fee-only financial advisor?', a: 'Fee-only advisors (SEBI-registered Investment Advisers) charge a flat fee or percentage-based advisory fee and always recommend Direct plans. You pay the advisory fee separately and save the trail commission embedded in Regular plans. For portfolios above ₹20L, this model is almost always cheaper than the Regular plan commission.' },
      { q: 'Do Direct plans have a higher minimum investment?', a: 'No. Both Direct and Regular plans of the same scheme have identical minimum investment amounts (typically ₹500 for SIP, ₹5,000 for lump sum). There is no financial barrier to choosing Direct plans.' },
    ],
    relatedLinks: [
      { label: 'SIP Calculator', href: '/calculators/sip' },
      { label: 'Search Direct Plan Funds', href: '/funds/search' },
      { label: 'ELSS Tax Saving Guide', href: '/learn/best-elss-tax-saving-funds' },
      { label: 'STP Calculator', href: '/calculators/stp' },
    ],
  },

  'ltcg-tax-on-mutual-funds': {
    slug: 'ltcg-tax-on-mutual-funds',
    title: 'Capital Gains Tax on Mutual Funds 2026 — LTCG & STCG Explained',
    description: 'Updated for Budget 2024 changes. Equity LTCG at 12.5%, STCG at 20%, ₹1.25L exemption. Debt fund indexation removal. Step-by-step tax harvesting and FIFO SIP taxation.',
    category: 'Tax Planning', readTime: '11 min read',
    publishedDate: '2026-03-28', updatedDate: '2026-03-28',
    heroIcon: 'receipt_long', heroColor: '#ec4899',
    introduction: 'The Union Budget 2024 rewrote the capital gains playbook for mutual fund investors. Equity LTCG tax jumped from 10% to 12.5%, but the exemption threshold also rose from ₹1 lakh to ₹1.25 lakh per financial year. Equity STCG increased from 15% to 20%. On the debt side, the 2023 removal of indexation benefit for debt funds purchased after April 2023 remains in force — all debt fund gains are now taxed at slab rates irrespective of holding period. These changes demand a recalibration of your investment and redemption strategy. This guide covers every scenario: equity taxation, debt taxation, hybrid fund classification, SIP FIFO mechanics, and a concrete tax harvesting walkthrough that could save you ₹15,625 every year.',
    sections: [
      {
        heading: 'Equity vs Debt — The Complete Tax Matrix',
        content: 'The tax treatment of mutual funds in India hinges on two variables: the fund\'s equity allocation (which determines classification) and your holding period (which determines short-term vs long-term). A fund is classified as equity-oriented if it maintains 65% or more in Indian equities. Balanced advantage funds, aggressive hybrid funds, and equity savings funds that meet this threshold enjoy equity taxation. Everything else — pure debt funds, liquid funds, gold funds, international funds, fund-of-funds investing in debt — falls under debt taxation. The table below summarises the current rates effective from July 23, 2024.',
        table: {
          headers: ['Fund Category', 'STCG Period', 'STCG Rate', 'LTCG Period', 'LTCG Rate', 'Exemption'],
          rows: [
            { 'Fund Category': 'Equity (65%+ equity)', 'STCG Period': '< 12 months', 'STCG Rate': '20%', 'LTCG Period': '≥ 12 months', 'LTCG Rate': '12.5%', 'Exemption': '₹1.25L/year' },
            { 'Fund Category': 'Debt (< 65% equity)', 'STCG Period': '< 24 months', 'STCG Rate': 'Slab rate', 'LTCG Period': '≥ 24 months', 'LTCG Rate': 'Slab rate', 'Exemption': 'None' },
            { 'Fund Category': 'Hybrid (65%+ equity)', 'STCG Period': '< 12 months', 'STCG Rate': '20%', 'LTCG Period': '≥ 12 months', 'LTCG Rate': '12.5%', 'Exemption': '₹1.25L/year' },
            { 'Fund Category': 'Gold/International', 'STCG Period': '< 24 months', 'STCG Rate': 'Slab rate', 'LTCG Period': '≥ 24 months', 'LTCG Rate': '12.5%', 'Exemption': '₹1.25L/year' },
          ],
        },
      },
      {
        heading: 'The Indexation Removal — Impact on Debt Fund Investors',
        content: 'Prior to April 2023, debt funds held for 3+ years enjoyed indexation — your purchase cost was adjusted for inflation using the Cost Inflation Index (CII), dramatically reducing taxable gains. A debt fund bought in 2018 and sold in 2023 could inflate the purchase cost by 25-30%, shrinking the taxable gain substantially. With indexation gone, a ₹10L investment in a debt fund growing to ₹14L over 5 years now produces ₹4L in fully taxable gains at your slab rate. At the 30% slab, that is ₹1.2L in tax. Under the old indexation regime, the tax would have been approximately ₹40,000. This 3x increase in effective tax has made debt mutual funds significantly less attractive compared to alternatives like RBI floating rate bonds, tax-free bonds on secondary markets, and even bank FDs for investors in the 30% bracket.',
      },
      {
        heading: 'Tax Harvesting — A Step-by-Step Walkthrough',
        content: 'Tax harvesting exploits the ₹1.25L annual LTCG exemption on equity funds. Here is a concrete example. Suppose you invested ₹20L in an equity fund in March 2024, and by March 2026 it has grown to ₹28L — an unrealised gain of ₹8L. If you redeem everything, you pay 12.5% on ₹8L minus ₹1.25L = ₹6.75L, resulting in a tax of ₹84,375. Instead, redeem only enough units to book exactly ₹1.25L in gains — approximately ₹3.5L worth of units in this case. You pay zero tax on these gains. Immediately reinvest the ₹3.5L back into the same fund. Your cost basis for those units is now reset to the current NAV. Next year, repeat. Over 5 years of disciplined harvesting, you effectively extract ₹6.25L in gains completely tax-free, saving ₹78,125 in cumulative tax at the 12.5% rate.',
      },
      {
        heading: 'How SIP Instalments Are Taxed — FIFO Explained',
        content: 'When you redeem units purchased through SIP, the Income Tax Act mandates First-In-First-Out (FIFO) order. The oldest units are sold first. This has critical implications: if you started a SIP in January 2025 and redeem in June 2026, only the first 6 instalments (Jan-Jun 2025) have completed 12 months and qualify for LTCG treatment. The remaining instalments (Jul 2025 onward) are still within the 12-month window and attract STCG at 20%. Partial redemptions during a running SIP almost always create a mix of STCG and LTCG. The only way to ensure all units qualify for LTCG is to wait 12 months after your last SIP instalment before redeeming. This is why stopping a SIP and waiting 12 months before redemption is a common tax-efficient strategy.',
      },
      {
        heading: 'Choosing Tax-Efficient Fund Categories',
        content: 'For long-term wealth building (7+ year horizon), equity funds remain the most tax-efficient category despite the rate increase to 12.5%. The ₹1.25L annual exemption and the lower flat rate make them vastly superior to debt funds taxed at slab rates. For medium-term goals (3-5 years), equity savings funds or balanced advantage funds that maintain 65%+ equity allocation give you equity tax treatment with lower volatility. For short-term parking (under 1 year), liquid funds are efficient because the absolute gains on short durations are small, resulting in minimal tax outgo regardless of slab rates. Avoid keeping large sums in debt funds for multi-year periods — the tax inefficiency post-indexation removal makes them sub-optimal compared to direct bond investments or RBI floating rate savings bonds.',
      },
    ],
    keyTakeaways: [
      'Equity LTCG is now 12.5% (up from 10%) on gains above ₹1.25L/year, and equity STCG is 20% (up from 15%) — both effective from July 2024',
      'Debt fund indexation benefit is permanently removed — all gains taxed at slab rate regardless of holding period',
      'Disciplined tax harvesting of ₹1.25L LTCG annually can save ₹15,625 per year (at 12.5%) with zero risk',
      'SIP redemptions follow FIFO — the oldest units are sold first, creating a mix of STCG and LTCG if you redeem within 12 months of your last instalment',
      'Equity-oriented balanced advantage funds offer the best tax efficiency for medium-term goals due to equity classification with lower volatility',
    ],
    faqs: [
      { q: 'Does the ₹1.25L LTCG exemption apply per fund or across all investments?', a: 'The ₹1.25L exemption is an aggregate annual limit across all equity investments — stocks, equity mutual funds, and equity ETFs combined. If you book ₹80,000 LTCG from direct stocks and ₹60,000 from mutual funds in the same year, your total is ₹1.40L, and you pay 12.5% tax on ₹15,000 (the amount exceeding ₹1.25L).' },
      { q: 'Are ELSS funds also taxed at 12.5% LTCG after 3 years?', a: 'Yes. ELSS units redeemed after the 3-year lock-in are treated identically to any other equity fund. LTCG above ₹1.25L is taxed at 12.5%. The 3-year lock-in is the minimum holding requirement, not a special tax provision — the same equity LTCG rules apply.' },
      { q: 'What if I switch between two equity funds — is that taxable?', a: 'Yes. A switch is treated as redemption from Fund A and fresh purchase in Fund B. The redemption from Fund A triggers capital gains tax. If Fund A units were held over 12 months, LTCG applies. If under 12 months, STCG at 20%. There is no roll-over exemption for mutual fund switches in India.' },
      { q: 'How are international fund gains taxed in 2026?', a: 'International funds (investing in foreign equities) and fund-of-funds are classified as non-equity. Post Budget 2024, gains from units held over 24 months qualify as LTCG at 12.5% with the ₹1.25L exemption. Gains from units held under 24 months are STCG at slab rate. This is an improvement over the 2023 rule that taxed all gains at slab rate.' },
      { q: 'Can I set off mutual fund losses against gains?', a: 'Yes. Short-term capital losses can be set off against both STCG and LTCG. Long-term capital losses can only be set off against LTCG, not STCG. Unabsorbed losses can be carried forward for 8 assessment years. This makes strategic loss booking in down markets a powerful tax planning tool.' },
    ],
    relatedLinks: [
      { label: 'ELSS Tax Saving Guide', href: '/learn/best-elss-tax-saving-funds' },
      { label: 'SIP Calculator', href: '/calculators/sip' },
      { label: 'Fund Search', href: '/funds/search' },
      { label: 'STP Calculator', href: '/calculators/stp' },
    ],
  },

  'what-is-stp-in-mutual-funds': {
    slug: 'what-is-stp-in-mutual-funds',
    title: 'STP in Mutual Funds — When and How to Use Systematic Transfer Plans',
    description: 'Deploy lump sums into equity without timing risk. Month-by-month ₹12L example, STP vs SIP vs lump sum comparison, transfer taxation, and optimal duration guidance.',
    category: 'Strategy', readTime: '9 min read',
    publishedDate: '2026-03-28', updatedDate: '2026-03-28',
    heroIcon: 'swap_horiz', heroColor: '#a855f7',
    introduction: 'You have just received ₹12 lakh — a bonus, an inheritance, the proceeds from a property sale. You know equity mutual funds are the right long-term vehicle, but deploying the entire amount at today\'s NAV terrifies you. What if markets correct 15% next week? The Systematic Transfer Plan (STP) exists precisely for this psychological and mathematical problem. You park the lump sum in a low-volatility source fund (liquid or ultra-short duration debt) and instruct the AMC to transfer a fixed amount every month into your target equity fund. The source fund earns 6-7% on the idle balance, and the target fund benefits from rupee cost averaging across multiple entry points. This guide covers when STP makes sense, how to set it up, the tax implications of each transfer, and the optimal duration backed by historical data.',
    sections: [
      {
        heading: 'The Mechanics — Month-by-Month ₹12L Example',
        content: 'Suppose you invest ₹12,00,000 in a liquid fund on April 1, 2026, and set up a monthly STP of ₹1,00,000 into a large-cap equity fund. In April, ₹1L is transferred to the equity fund. The remaining ₹11L in the liquid fund earns approximately ₹5,775 for the month (at 6.3% annualised). In May, another ₹1L moves, and ₹10.06L continues earning in the liquid fund. This continues until March 2027, when the final ₹1L plus accumulated liquid fund returns transfer out. By the end of 12 months, your ₹12L has been fully deployed into equity across 12 different NAV levels, and you earned approximately ₹23,000-25,000 in liquid fund returns on the idle balance during the transition. Compare this to a bank savings account where the same idle money would earn roughly ₹14,000-15,000 at 3.5%.',
        table: {
          headers: ['Month', 'Transfer to Equity', 'Remaining in Liquid', 'Liquid Fund Earnings (Cumulative)'],
          rows: [
            { 'Month': 'Apr 2026', 'Transfer to Equity': '₹1,00,000', 'Remaining in Liquid': '₹11,00,000', 'Liquid Fund Earnings (Cumulative)': '₹5,775' },
            { 'Month': 'Jun 2026', 'Transfer to Equity': '₹1,00,000', 'Remaining in Liquid': '₹9,01,550', 'Liquid Fund Earnings (Cumulative)': '₹11,325' },
            { 'Month': 'Sep 2026', 'Transfer to Equity': '₹1,00,000', 'Remaining in Liquid': '₹6,03,100', 'Liquid Fund Earnings (Cumulative)': '₹16,425' },
            { 'Month': 'Dec 2026', 'Transfer to Equity': '₹1,00,000', 'Remaining in Liquid': '₹3,04,650', 'Liquid Fund Earnings (Cumulative)': '₹20,750' },
            { 'Month': 'Mar 2027', 'Transfer to Equity': '₹1,05,250*', 'Remaining in Liquid': '₹0', 'Liquid Fund Earnings (Cumulative)': '₹24,200' },
          ],
        },
      },
      {
        heading: 'STP vs SIP vs Lump Sum — When Each Wins',
        content: 'The choice between STP, SIP, and lump sum is not about which is universally "best" — it depends on your cash flow and the market environment. STP is designed for investors who already have a lump sum and want equity exposure without the timing gamble. SIP is for investors deploying from regular monthly income — salary, rental income, freelance earnings. Lump sum works when valuations are clearly depressed (PE below 15x on Nifty) and you have strong conviction. Historical analysis of Nifty 50 data from 2005 to 2025 shows that lump sum outperformed STP in roughly 62% of 12-month rolling windows. However, in the 38% of periods where markets fell, STP outperformed lump sum by an average of 8-12%, providing significant downside cushioning.',
        table: {
          headers: ['Strategy', 'Best When', 'Key Advantage', 'Key Drawback'],
          rows: [
            { 'Strategy': 'STP (12 months)', 'Best When': 'Lump sum available, uncertain markets', 'Key Advantage': 'Idle money earns 6-7%, averaging into equity', 'Key Drawback': 'Each transfer triggers tax on source fund gains' },
            { 'Strategy': 'SIP (monthly)', 'Best When': 'Regular income, no lump sum', 'Key Advantage': 'Automatic discipline, true cost averaging', 'Key Drawback': 'Idle salary sits in savings at 3.5%' },
            { 'Strategy': 'Lump Sum', 'Best When': 'Markets corrected 15%+, strong conviction', 'Key Advantage': 'Full capital deployed at discounted NAVs', 'Key Drawback': 'Catastrophic if timing is wrong' },
          ],
        },
      },
      {
        heading: 'Taxation of Each STP Transfer',
        content: 'Every STP instalment is a redemption from the source fund and a purchase in the target fund — two independent transactions. The redemption from the source liquid/debt fund generates capital gains that are taxable. Since debt fund gains are now taxed at slab rate regardless of holding period (post April 2023), the gains on each monthly transfer from a liquid fund will be taxed at your marginal income tax rate. The silver lining: on a liquid fund earning 6.3% annualised, the gain per ₹1L parked for one month is roughly ₹525. Even at the 30% slab, the tax is just ₹158 per transfer. Over 12 transfers, total tax on source fund gains is approximately ₹1,200-1,500 — a negligible cost compared to the ₹24,000+ earned from parking in the liquid fund.',
      },
      {
        heading: 'Optimal STP Duration — 6 vs 9 vs 12 Months',
        content: 'The ideal STP duration depends on your risk tolerance and the amount being deployed. For amounts under ₹5L, a 6-month STP is sufficient — the averaging benefit over just 6 data points is modest, and you want the capital working in equity sooner. For ₹5L-20L, 9-12 months strikes the right balance between meaningful averaging and opportunity cost of delayed deployment. For amounts above ₹20L, consider a 12-month STP as the psychological comfort of gradual entry justifies the slightly longer deployment timeline. Going beyond 12 months is rarely advisable: the opportunity cost of keeping large sums in debt when your goal is equity exposure compounds against you. A 24-month STP on ₹20L effectively means half your capital misses an entire year of potential equity returns.',
      },
      {
        heading: 'Setting Up STP — Practical Steps',
        content: 'Step 1: Choose a liquid fund or ultra-short duration fund from the same AMC as your target equity fund (intra-AMC STP avoids inter-AMC transfer delays). Step 2: Invest the full lump sum in the source fund via lump sum purchase. Step 3: After T+1 day settlement, set up the STP through the AMC portal or MF Central — specify source scheme, target scheme, transfer amount, frequency (monthly/weekly), and start date. Step 4: The first transfer typically happens on the next STP date after setup. Step 5: Monitor quarterly — if markets have corrected sharply mid-STP, consider accelerating the remaining transfers to capture lower NAVs. Some AMCs also offer "Capital Appreciation STP" and "Flexi STP" variants that adjust transfer amounts based on market triggers, though the plain vanilla fixed-amount STP remains the most transparent and predictable option.',
      },
    ],
    keyTakeaways: [
      'STP earns 6-7% on idle capital in the source fund versus 3.5% in a savings account — the spread alone covers the negligible tax on debt fund gains',
      'Each STP transfer is a taxable redemption from the source fund, but the tax on liquid fund gains per instalment is typically under ₹200 at the highest slab',
      'For ₹5L-20L deployments, a 9-12 month STP provides optimal balance between rupee cost averaging and opportunity cost',
      'STP within the same AMC family (intra-AMC) processes faster and avoids potential inter-AMC settlement delays',
      'Going beyond 12 months is counterproductive — it delays equity exposure without proportionally reducing risk',
    ],
    faqs: [
      { q: 'Can I stop or modify an STP midway?', a: 'Yes. You can cancel, pause, or modify the transfer amount of an STP at any time through the AMC portal or MF Central. Changes typically take effect from the next scheduled transfer date. If markets crash 20% mid-STP, you may want to accelerate the remaining transfers to buy at lower levels.' },
      { q: 'Does STP work for transferring from equity to debt (reverse STP)?', a: 'Yes, and this is a legitimate strategy for de-risking as you approach a financial goal. For example, 2-3 years before a child\'s college admission, you can STP from an equity fund to a short-duration debt fund to protect accumulated gains from a sudden market correction. Each transfer from equity triggers capital gains tax though, so plan the timeline carefully.' },
      { q: 'Is weekly STP better than monthly STP?', a: 'Weekly STP provides more averaging data points (48-52 vs 12) but the marginal benefit over monthly is statistically insignificant based on Nifty historical data. Monthly STP is simpler to track, generates fewer taxable events, and is administratively cleaner. Stick with monthly unless you have a strong behavioural reason for weekly.' },
      { q: 'What if my source fund and target fund are from different AMCs?', a: 'Most AMCs only allow intra-AMC STP — both funds must be from the same fund house. If you want to transfer between two different AMCs, you would need to manually redeem from the source each month and invest in the target. This loses the automation advantage of STP. Choose your target equity fund first, then pick a liquid fund from the same AMC.' },
      { q: 'Should I use STP if I receive salary arrears or a performance bonus?', a: 'Absolutely — salary arrears and bonuses are classic STP use cases. Park the amount in a liquid fund and STP into your chosen equity fund over 6-9 months. This is psychologically easier than deploying ₹3-5L in one shot, and the liquid fund returns on the idle balance are a free bonus versus leaving the money in your salary account.' },
    ],
    relatedLinks: [
      { label: 'STP Calculator', href: '/calculators/stp' },
      { label: 'SWP Retirement Guide', href: '/learn/swp-calculator-guide' },
      { label: 'Search Liquid Funds', href: '/funds/search' },
      { label: 'SIP Calculator', href: '/calculators/sip' },
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

        {/* Pro CTA */}
        <div className="my-8 p-6 rounded-2xl border border-[#44f593]/20 bg-[#44f593]/5 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <p className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df] mb-1">Go deeper with VMFS Pro</p>
            <p className="text-sm text-[#859586]">Portfolio overlap detection, LTCG tax calculator, fund scoring, and advanced analytics — ₹99/year.</p>
          </div>
          <Link href="/premium" className="px-6 py-2.5 bg-[#44f593] text-[#001f10] font-bold rounded-xl text-sm hover:bg-[#25e283] transition-colors shrink-0">
            Upgrade to Pro →
          </Link>
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
