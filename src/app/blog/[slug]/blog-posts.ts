// Source-of-truth blog post data. Imported by both the server `page.tsx`
// (for generateMetadata) and the client `BlogPostClient.tsx` (for render).
// All tax/slab/rebate numbers reflect FY 2025-26 (April 2025 – March 2026)
// following the July 2024 Budget and Feb 2025 Finance Bill.

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  authorRole?: string;
  tags?: string[];
  excerpt?: string;
};

export const blogPosts: Record<string, BlogPost> = {
  'understanding-sip-disciplined-investing': {
    id: '1',
    title: 'Understanding SIP: Your Path to Disciplined Investing',
    slug: 'understanding-sip-disciplined-investing',
    excerpt:
      'A Systematic Investment Plan averages your cost across market cycles, enforces discipline, and compounds even modest ₹500 monthly contributions into serious wealth.',
    content: `
      <p>Systematic Investment Plans (SIPs) have revolutionized the way retail investors approach mutual funds in India. A SIP allows investors to invest a fixed amount at regular intervals – be it weekly, monthly, or quarterly – into their chosen mutual fund schemes.</p>

      <h2>Why SIPs Work: The Power of Rupee Cost Averaging</h2>

      <p>The primary advantage of SIPs lies in rupee cost averaging. When you invest a fixed sum regularly, you naturally buy more units when prices are low and fewer when prices are high. Over time, this averages out your purchase cost, potentially leading to better returns while mitigating the impact of market volatility.</p>

      <p>Let's understand this with an example:</p>

      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Investment (₹)</th>
            <th>NAV (₹)</th>
            <th>Units Allotted</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>January</td><td>5,000</td><td>50</td><td>100</td></tr>
          <tr><td>February</td><td>5,000</td><td>45</td><td>111.11</td></tr>
          <tr><td>March</td><td>5,000</td><td>40</td><td>125</td></tr>
          <tr><td>April</td><td>5,000</td><td>55</td><td>90.91</td></tr>
        </tbody>
      </table>

      <p>At the end of April, you've invested ₹20,000 and accumulated 427.02 units. The average cost per unit is ₹46.84, while the current NAV is ₹55. This demonstrates how SIPs can be beneficial even in fluctuating markets.</p>

      <h2>Benefits of SIP Investing</h2>

      <ol>
        <li><strong>Financial Discipline:</strong> Regular investing instills a savings habit without requiring large sums upfront.</li>
        <li><strong>Flexibility:</strong> You can start with as little as ₹500 monthly and increase, pause, or stop as needed.</li>
        <li><strong>Compounding Benefits:</strong> The earlier you start, the more time your money has to grow through compounding.</li>
        <li><strong>Reduced Timing Risk:</strong> Eliminates the need to time the market, which is nearly impossible even for seasoned investors.</li>
        <li><strong>Stress-free Investing:</strong> Automated investments reduce emotional decision-making during market fluctuations.</li>
      </ol>

      <h2>SIP Strategies for Different Goals</h2>

      <p>The beauty of SIPs lies in their versatility. They can be tailored to align with various financial goals:</p>

      <ul>
        <li><strong>Short-term Goals (1-3 years):</strong> Consider debt or conservative hybrid funds with lower volatility.</li>
        <li><strong>Medium-term Goals (3-7 years):</strong> Balanced or aggressive hybrid funds offer a mix of growth and stability.</li>
        <li><strong>Long-term Goals (7+ years):</strong> Equity funds typically have the potential for higher returns over longer horizons.</li>
      </ul>

      <h2>Step-Up SIPs: Accelerating Wealth Creation</h2>

      <p>A step-up SIP allows you to increase your investment amount periodically, often annually. This approach aligns with income growth over your career and significantly boosts your corpus. For instance, increasing your monthly SIP by just 10% annually can potentially grow your final corpus by 30-40% over a 15-20 year period.</p>

      <h2>Things to Remember</h2>

      <ul>
        <li>SIPs don't guarantee profits; they simply offer a disciplined investment approach.</li>
        <li>Fund selection should align with your goals, risk tolerance, and investment horizon.</li>
        <li>Regular review of your SIP investments (semi-annually or annually) is recommended.</li>
        <li>For goal-based investing, consider increasing your SIP amount periodically to counter inflation.</li>
      </ul>

      <p>Mutual Fund investments are subject to market risks. Read all scheme related documents carefully before investing.</p>
    `,
    category: 'Investing Basics',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'August 15, 2023',
    readTime: '5 min read',
    tags: ['SIP', 'Mutual Funds', 'Investing Strategy', 'Wealth Creation'],
  },

  'debt-funds-vs-fixed-deposits': {
    id: '2',
    title: "Debt Funds vs Fixed Deposits in 2026: What's Actually Better After the Tax Overhaul?",
    slug: 'debt-funds-vs-fixed-deposits',
    excerpt:
      'The April 2023 amendment eliminated the LTCG-with-indexation advantage that debt funds held over FDs for two decades. Here is what actually remains in FY 2025-26.',
    content: `
      <p>Until March 2023, debt mutual funds were a near-automatic upgrade over bank fixed deposits for anyone in the 20% or 30% tax slab. The Finance Act 2023 changed that. In this article we walk through what the taxation of debt instruments actually looks like in FY 2025-26 (the year covered by ITRs you will file between April and July 2026), and where debt funds still make sense despite the change.</p>

      <h2>The 2023 amendment, in plain English</h2>

      <p>For units of debt mutual funds <strong>purchased on or after 1 April 2023</strong>, all capital gains are now treated as short-term gains regardless of holding period, and are taxed at your marginal income-tax slab. The concessional 20% LTCG rate with indexation benefit — which used to kick in after three years — is gone for new purchases. The 20%-with-indexation treatment survives only for units you bought on or before 31 March 2023.</p>

      <p>The July 2024 Budget tweaked this one more time: debt-fund units held <strong>before</strong> 1 April 2023 now qualify for LTCG at a flat 12.5% <em>without</em> indexation (after 24 months of holding). That is a worse deal than the pre-2023 regime but better than slab rates for most investors.</p>

      <p>So today's debt-fund tax decision depends entirely on <strong>when you bought the units</strong>:</p>

      <table>
        <thead>
          <tr><th>Purchase date</th><th>Tax treatment on gains</th><th>Holding period threshold</th></tr>
        </thead>
        <tbody>
          <tr><td>On or before 31 Mar 2023</td><td>≥24 months: LTCG at 12.5% flat, no indexation<br/>&lt;24 months: slab rate</td><td>24 months</td></tr>
          <tr><td>On or after 1 Apr 2023</td><td>Always slab rate, no LTCG concession</td><td>Not applicable</td></tr>
        </tbody>
      </table>

      <h2>Fixed deposits: what they actually pay</h2>

      <p>Bank FD rates for 1–3 year tenures sit around 6.75–7.25% across large PSU and private banks as of early 2026. Senior citizens get an additional 0.50% in most cases. Interest is added to your income and taxed at slab, with TDS at 10% above ₹40,000 of interest per bank per year (₹50,000 for seniors). DICGC insurance covers ₹5 lakh per depositor per bank — useful but rarely the deciding factor.</p>

      <h2>A head-to-head for a 30%-slab investor in 2026</h2>

      <p>Assume a 30% marginal slab (plus 4% cess → 31.2% effective) and an investment of ₹10 lakh held for three years:</p>

      <ul>
        <li><strong>FD at 7.0%:</strong> Gross corpus ≈ ₹12.25 lakh. Tax on ₹2.25 lakh interest = ₹70,200. Post-tax corpus ≈ ₹11.55 lakh. Post-tax CAGR ≈ 4.90%.</li>
        <li><strong>Debt fund (post-Apr-2023 purchase) returning 7.5%:</strong> Gross corpus ≈ ₹12.42 lakh. Tax on ₹2.42 lakh gain at slab = ₹75,504. Post-tax corpus ≈ ₹11.67 lakh. Post-tax CAGR ≈ 5.27%.</li>
      </ul>

      <p>The debt fund still wins — but only because of its higher pre-tax yield, not because of tax treatment. The outperformance is marginal (~0.4% CAGR) and disappears if the debt fund underdelivers by even 30 basis points.</p>

      <h2>Where debt funds still clearly beat FDs in 2026</h2>

      <ul>
        <li><strong>Liquidity.</strong> Liquid funds and overnight funds let you redeem in T+1 with no penalty. Breaking an FD always costs 0.5–1.0% of interest.</li>
        <li><strong>Low-slab or zero-slab investors.</strong> In the new regime, taxable income up to ₹12 lakh attracts zero tax (via Section 87A rebate). Debt-fund gains, which stack on that income, can still end up tax-free. FD interest at the same income level is also tax-free — but you give up liquidity and choice.</li>
        <li><strong>Target-maturity funds.</strong> These hold bonds to maturity and behave like laddered FDs with daily liquidity. Useful for 3–5 year goals.</li>
        <li><strong>Systematic Withdrawal Plans (SWP).</strong> You can structure the withdrawal amount, which you cannot with an FD.</li>
        <li><strong>Credit-risk diversification.</strong> A single FD concentrates risk at one bank (beyond ₹5 lakh insurance). A corporate bond fund spreads across 30–80 issuers.</li>
      </ul>

      <h2>Where FDs are now genuinely better</h2>

      <ul>
        <li><strong>Emergency-fund money you cannot afford to mark-to-market.</strong> Short-duration debt funds can drop 1–3% in a single day during a rate shock. An FD cannot.</li>
        <li><strong>Senior citizens with income below the rebate threshold.</strong> The FD rate premium plus simplicity plus the 0.50% senior-citizen uplift outweighs the debt-fund edge.</li>
        <li><strong>Regulatory and inheritance simplicity.</strong> An FD is a single line item. A portfolio of debt funds adds reporting overhead.</li>
      </ul>

      <h2>Our recommendation for FY 2025-26</h2>

      <ol>
        <li>Keep 6 months of expenses in a bank sweep-in FD and/or a liquid fund. Do not try to optimise this bucket.</li>
        <li>For 1–3 year goals, compare the headline yield on offer. If the debt fund's YTM minus expense ratio does not beat the FD rate by at least 0.5%, pick the FD.</li>
        <li>For 3–5 year goals, consider target-maturity debt funds — they lock in a known yield and eliminate reinvestment risk.</li>
        <li>If you hold pre-April-2023 debt-fund units, do not redeem purely for tax reasons. The 12.5% flat rate is still the best concessional treatment available on debt in India.</li>
      </ol>

      <p><em>Mutual Fund investments are subject to market risks. Read all scheme-related documents carefully before investing. Tax information above reflects the law as of the FY 2025-26 assessment year; consult a qualified tax adviser for your specific situation.</em></p>
    `,
    category: 'Tax Planning',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'April 18, 2026',
    readTime: '7 min read',
    tags: ['Debt Funds', 'Fixed Deposits', 'Tax Planning', 'FY2025-26', 'Finance Act 2023'],
  },

  'ltcg-stcg-equity-mutual-funds-2026': {
    id: '3',
    title: 'LTCG and STCG on Equity Mutual Funds in 2026: The Post-Budget Playbook',
    slug: 'ltcg-stcg-equity-mutual-funds-2026',
    excerpt:
      'The July 2024 Budget raised equity STCG to 20% and LTCG to 12.5% above a ₹1.25 lakh exemption. Here is how to size, time, and harvest gains under the new regime.',
    content: `
      <p>Equity mutual fund taxation is the single biggest change investors have had to absorb in this decade. The July 2024 Budget raised the short-term capital gains (STCG) rate on equity funds from 15% to 20% and the long-term capital gains (LTCG) rate from 10% to 12.5%, while also raising the annual LTCG exemption from ₹1 lakh to ₹1.25 lakh. Those new numbers are live for FY 2025-26 and every gain you book before 31 March 2026 gets computed on them. This article is the practical playbook.</p>

      <h2>The rules, stated precisely</h2>

      <ul>
        <li><strong>Equity mutual fund</strong> for tax purposes = scheme with ≥65% equity exposure in Indian listed equities. Includes most large-cap, flexi-cap, ELSS, mid-cap, small-cap, sector, and equity-hybrid funds.</li>
        <li><strong>STCG</strong> = gains on units held for ≤12 months. Taxed at <strong>20%</strong> flat plus 4% cess.</li>
        <li><strong>LTCG</strong> = gains on units held for &gt;12 months. First ₹1.25 lakh of LTCG per financial year is exempt. Gains above that are taxed at <strong>12.5%</strong> flat plus 4% cess. No indexation.</li>
        <li>Surcharge applies on top of the rate for taxable income above ₹50 lakh in the relevant slab.</li>
      </ul>

      <h2>Tax harvesting: the most underused move</h2>

      <p>Every financial year you get a ₹1.25 lakh LTCG exemption on equity MF gains. If you never redeem, you never use it. Tax harvesting is the deliberate act of redeeming just enough of your long-held units to realise ₹1.25 lakh of gain, then re-investing the proceeds on the next business day. The gain becomes tax-free, your cost basis resets upward, and future sales owe tax on less.</p>

      <p><strong>Worked example.</strong> You bought ₹5 lakh of a flexi-cap fund in April 2022 at NAV 120. In March 2026 the NAV is 216 (80% gain). Your units = 5,00,000 / 120 = 4,166.67. Current value = 4,166.67 × 216 = ₹9 lakh. Unrealised gain = ₹4 lakh.</p>

      <p>Redeem ₹2.8125 lakh worth of units (specifically, 2.8125 × 1.25 / 4 = the fraction that yields exactly ₹1.25 lakh of gain). Tax owed: zero. Re-buy the same amount the next business day. Your new weighted-average cost basis is now higher, so when you eventually sell the full holding you will have ₹1.25 lakh less taxable gain.</p>

      <p>Do this every year and over 20 years you shelter ₹25 lakh of gains from tax. At the 12.5% rate, that is ₹3.12 lakh of saved tax with zero change to your investment strategy.</p>

      <h2>When to book STCG deliberately</h2>

      <p>STCG at 20% looks punitive, but there is one situation where booking it is the right call: when you hold an equity fund with a meaningful gain in a year where your taxable income keeps you below the rebate threshold (₹12 lakh in the new regime for FY 2025-26). In that case STCG stacks onto your salary and is still absorbed by the rebate. Most salaried investors above ₹12 lakh income should never book STCG on purpose.</p>

      <h2>ELSS lock-in and tax harvesting</h2>

      <p>ELSS units have a 3-year statutory lock-in. Once a specific tranche's lock-in expires, the tax status is identical to a normal equity fund — you can harvest it. A ₹1.5 lakh ELSS SIP done for 10 years creates a rolling cascade of tranches that each become harvestable 3 years after purchase, which means by year 13 you can harvest ₹1.25 lakh of gain every single year from ELSS alone.</p>

      <h2>Mistakes we see on client CAS statements</h2>

      <ol>
        <li><strong>Harvesting too aggressively.</strong> If you redeem ₹2 lakh of gain, ₹75,000 is above the exemption and gets taxed at 12.5%. Redeem exactly the amount that yields ₹1.25 lakh of gain — no more.</li>
        <li><strong>Forgetting the 12-month rule on re-bought units.</strong> The clock resets. If you harvest and re-buy in March, those new units are short-term for 12 months. Do not touch them until the following March.</li>
        <li><strong>Confusing dividend reinvestment with harvesting.</strong> IDCW payouts are taxed at slab as dividend income, not as capital gains. They do not use your ₹1.25 lakh exemption.</li>
        <li><strong>Booking gains in switch transactions but treating them as neutral.</strong> A switch from Regular to Direct, or from Growth to IDCW, is a redemption followed by a fresh purchase. It triggers capital gains.</li>
      </ol>

      <h2>Equity-hybrid funds: the easy win</h2>

      <p>Equity-hybrid (aggressive-hybrid) funds hold 65–80% equity and 20–35% debt. Because they are classified as equity for tax purposes, the debt portion is effectively taxed at 12.5% LTCG rather than slab. For a 30%-slab investor, this is a ~15 percentage-point tax saving on the debt sleeve relative to holding debt funds directly. If you want a conservative equity exposure with tax-efficient debt built in, equity-hybrids beat a DIY equity-plus-debt-fund portfolio on a post-tax basis.</p>

      <h2>The FIFO rule</h2>

      <p>When you redeem, the oldest units are sold first (First In First Out). Your AMC's CAS statement tracks this automatically — but it matters because it determines whether the sale is LTCG or STCG. Always use a portfolio tracker that shows per-tranche cost basis so you do not accidentally trigger STCG on units you thought were long-term.</p>

      <p><em>Use our <a href="/calculators/ltcg">LTCG calculator</a> to compute the exact sale amount for harvesting, and our <a href="/compare">fund comparison tool</a> to find equity-hybrids with the best post-tax return profile. Information above reflects FY 2025-26 rules; consult a qualified tax adviser for your specific situation. Mutual Fund investments are subject to market risks.</em></p>
    `,
    category: 'Tax Planning',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'April 21, 2026',
    readTime: '9 min read',
    tags: ['LTCG', 'STCG', 'Equity Funds', 'Tax Harvesting', 'FY2025-26', 'Budget 2024'],
  },

  'new-vs-old-tax-regime-fy-2025-26': {
    id: '4',
    title: 'New vs Old Tax Regime for FY 2025-26: The Honest Comparison',
    slug: 'new-vs-old-tax-regime-fy-2025-26',
    excerpt:
      'With the Section 87A rebate expanded to ₹60,000 and new-regime slabs redrawn, the old regime now makes sense for a smaller group of taxpayers than ever. Here is how to decide.',
    content: `
      <p>The new tax regime is no longer the "simple but expensive" option. After the July 2024 tweaks and the February 2025 Finance Bill refinements, the new regime is the default and is better for most salaried taxpayers. The old regime survives as a niche choice for people with large deductions. This article walks through the FY 2025-26 numbers and shows exactly where the break-even sits.</p>

      <h2>Slabs for FY 2025-26</h2>

      <p><strong>New regime (default):</strong></p>

      <table>
        <thead><tr><th>Income slab</th><th>Rate</th></tr></thead>
        <tbody>
          <tr><td>Up to ₹4,00,000</td><td>Nil</td></tr>
          <tr><td>₹4,00,001 – ₹8,00,000</td><td>5%</td></tr>
          <tr><td>₹8,00,001 – ₹12,00,000</td><td>10%</td></tr>
          <tr><td>₹12,00,001 – ₹16,00,000</td><td>15%</td></tr>
          <tr><td>₹16,00,001 – ₹20,00,000</td><td>20%</td></tr>
          <tr><td>₹20,00,001 – ₹24,00,000</td><td>25%</td></tr>
          <tr><td>Above ₹24,00,000</td><td>30%</td></tr>
        </tbody>
      </table>

      <p>Standard deduction: ₹75,000. Section 87A rebate: up to ₹60,000 for income up to ₹12,00,000 (this is what makes income up to ₹12.75 lakh effectively tax-free in the new regime). Employer's NPS contribution up to 14% of basic + DA is deductible.</p>

      <p><strong>Old regime:</strong></p>

      <table>
        <thead><tr><th>Income slab</th><th>Rate</th></tr></thead>
        <tbody>
          <tr><td>Up to ₹2,50,000</td><td>Nil</td></tr>
          <tr><td>₹2,50,001 – ₹5,00,000</td><td>5%</td></tr>
          <tr><td>₹5,00,001 – ₹10,00,000</td><td>20%</td></tr>
          <tr><td>Above ₹10,00,000</td><td>30%</td></tr>
        </tbody>
      </table>

      <p>Standard deduction: ₹50,000. 87A rebate: ₹12,500 up to ₹5 lakh income. All common deductions retained — 80C, 80D, 80CCD(1B), 24(b) home loan interest, HRA, LTA.</p>

      <h2>The break-even, by income level</h2>

      <p>Assumption: salaried, ₹50,000 HRA exemption claimable, married, no home loan. Compare total tax owed under each regime for various gross incomes:</p>

      <table>
        <thead><tr><th>Gross salary</th><th>New regime tax</th><th>Old regime tax (with full 80C+80D+HRA)</th><th>Better regime</th></tr></thead>
        <tbody>
          <tr><td>₹8 lakh</td><td>₹0</td><td>₹26,000</td><td>New</td></tr>
          <tr><td>₹12 lakh</td><td>₹0</td><td>₹72,800</td><td>New</td></tr>
          <tr><td>₹15 lakh</td><td>₹1,05,000</td><td>₹1,45,600</td><td>New</td></tr>
          <tr><td>₹20 lakh</td><td>₹2,35,000</td><td>₹2,32,700</td><td>Old (marginally)</td></tr>
          <tr><td>₹25 lakh</td><td>₹3,85,000</td><td>₹4,10,000</td><td>New</td></tr>
          <tr><td>₹35 lakh</td><td>₹6,85,000</td><td>₹7,10,000</td><td>New</td></tr>
        </tbody>
      </table>

      <p>The break-even where old regime wins is a narrow band around ₹18–22 lakh gross, and only if you are maxing out 80C (₹1.5 lakh), 80D (₹50,000 incl. parents), 80CCD(1B) (₹50,000), HRA, and home-loan interest. Remove any of those and new regime wins.</p>

      <h2>What this means for your mutual fund investing</h2>

      <p>Three practical shifts for FY 2025-26:</p>

      <ol>
        <li><strong>ELSS lost most of its appeal.</strong> ELSS is only tax-deductible in the old regime under 80C. If you are in the new regime, there is no tax reason to buy ELSS over a cheaper flexi-cap or large-cap fund. Choose on merit (track record, expense ratio, AUM stability), not on the lock-in.</li>
        <li><strong>NPS Tier-1 becomes more attractive in the new regime.</strong> Employer NPS contribution up to 14% of basic + DA is now deductible. If your employer offers it, this is almost always a free deduction on top of your regular salary.</li>
        <li><strong>Below ₹12 lakh income = optimise for growth, not deductions.</strong> Your entire equity MF income (via tax harvesting) and capital gains can now be absorbed by the rebate in many cases. Focus on compounding, not tax planning.</li>
      </ol>

      <h2>Switching regimes</h2>

      <p>Salaried individuals can switch every year at the time of filing. Business/professional income earners can switch <strong>once</strong> from new to old, and then back — after that, they are locked.</p>

      <p><em>Run your own numbers with our <a href="/calculators/tax-regime">tax regime comparison calculator</a>. This article is for educational purposes and not investment or tax advice. Consult a qualified Chartered Accountant for decisions specific to your situation.</em></p>
    `,
    category: 'Tax Planning',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'April 20, 2026',
    readTime: '8 min read',
    tags: ['Income Tax', 'New Regime', '87A Rebate', 'FY2025-26', 'Tax Planning'],
  },

  'elss-vs-ppf-vs-nps-80c-fy-2025-26': {
    id: '5',
    title: 'ELSS vs PPF vs NPS for Section 80C in FY 2025-26: Which Actually Wins?',
    slug: 'elss-vs-ppf-vs-nps-80c-fy-2025-26',
    excerpt:
      'If you are still in the old regime, Section 80C is worth ₹1.5 lakh of deduction. ELSS, PPF, and NPS Tier-1 are the three serious contenders. Here is the 25-year math.',
    content: `
      <p>This article is only relevant if you have chosen the old tax regime for FY 2025-26. In the new regime, Section 80C does not exist and this entire comparison is moot — pick your equity allocation on merit alone. For the minority who are better off under the old regime (typically ₹18–22 lakh income with full deductions maxed), the question is: where should that ₹1.5 lakh go?</p>

      <h2>The three serious options</h2>

      <p><strong>ELSS (Equity-Linked Savings Scheme):</strong> A diversified equity mutual fund with a 3-year lock-in. Returns follow the Indian equity market. Historical 15-year CAGR on the median ELSS is around 13–14%. Gains taxed as equity MF (12.5% LTCG above ₹1.25 lakh/year exemption).</p>

      <p><strong>PPF (Public Provident Fund):</strong> A government-backed fixed-income scheme. Current interest rate: 7.1% (reviewed quarterly). 15-year lock-in with partial withdrawal allowed from year 7. Interest is fully tax-free at maturity. Maximum ₹1.5 lakh per financial year.</p>

      <p><strong>NPS Tier-1:</strong> A regulated retirement scheme with market-linked returns. You choose the allocation across equity, corporate debt, G-sec, and alternatives. Lock-in until age 60 with limited partial withdrawal. 60% of corpus at retirement is tax-free; the remaining 40% must buy an annuity (annuity income is taxed at slab). Additional ₹50,000 deduction under 80CCD(1B) on top of 80C.</p>

      <h2>25-year simulation, same ₹1.5 lakh / year input</h2>

      <p>We run each option for a 30-year-old investor contributing ₹1.5 lakh on 1 April every year until age 55 (25 years). Returns are the long-run historical medians:</p>

      <table>
        <thead>
          <tr><th>Instrument</th><th>Assumed CAGR</th><th>Final corpus (nominal)</th><th>Post-tax on withdrawal</th><th>Post-tax CAGR</th></tr>
        </thead>
        <tbody>
          <tr><td>ELSS (with annual harvesting)</td><td>12%</td><td>₹2.00 cr</td><td>~₹1.98 cr</td><td>11.8%</td></tr>
          <tr><td>PPF</td><td>7.1%</td><td>₹87.4 lakh</td><td>₹87.4 lakh (tax-free)</td><td>7.1%</td></tr>
          <tr><td>NPS Tier-1 (75% equity)</td><td>10.5%</td><td>₹1.63 cr</td><td>₹1.50 cr after annuity compulsion</td><td>9.6%</td></tr>
        </tbody>
      </table>

      <p>ELSS wins on absolute return. NPS wins on tax-sheltered compounding but loses on mandatory annuitisation of 40%. PPF is dramatically behind on compounded return but is zero-volatility and zero-effort.</p>

      <h2>The uncomfortable truth about PPF</h2>

      <p>PPF's 7.1% tax-free rate is competitive only against FDs. Compared to equity over a 15+ year horizon, the gap is a 4–5 percentage-point drag on CAGR, which compounds into roughly 50% less terminal wealth. That said: PPF has zero drawdown. During the 2008 crisis, ELSS dropped 55% peak-to-trough. If a 55% drawdown would make you panic-sell, PPF's 5% lower CAGR is worth paying for.</p>

      <h2>NPS: the 80CCD(1B) angle</h2>

      <p>NPS Tier-1 is the <strong>only</strong> instrument that gives you a deduction <em>above</em> the ₹1.5 lakh 80C limit. Section 80CCD(1B) grants an additional ₹50,000 deduction specifically for NPS. If you are in the 30% old-regime slab, that is ₹15,600 of tax saved per year you wouldn't otherwise get. Over 25 years, that alone adds ~₹12 lakh of extra wealth vs ELSS (which does not give the 80CCD(1B) deduction).</p>

      <h2>Our suggested split</h2>

      <p>For an old-regime, 30% slab, ≥15-year horizon investor:</p>

      <ul>
        <li>₹1,50,000 → ELSS (full 80C). Use a proven 5-10 year track record fund, not last year's hottest small-cap.</li>
        <li>₹50,000 → NPS Tier-1 (80CCD(1B)). Choose the Active Choice and allocate 75% equity if you are under 50 years old.</li>
        <li>PPF → only if your risk tolerance genuinely demands a zero-volatility allocation. In that case, fund it from post-tax savings, not from your 80C bucket.</li>
      </ul>

      <h2>Mistakes to avoid</h2>

      <ol>
        <li><strong>Starting a new ELSS SIP in March.</strong> You still get the 80C deduction on lump-sum March purchases, but you lose 11 months of SIP rupee-cost averaging. Start the SIP in April and forget about it.</li>
        <li><strong>Redeeming ELSS units immediately after the 3-year lock-in.</strong> Each SIP tranche has its own 3-year clock. Redeeming early means you only harvest some tranches, not all.</li>
        <li><strong>Confusing NPS Tier-1 and Tier-2.</strong> Tier-2 is a no-lock-in voluntary account with <em>no</em> tax deduction. Only Tier-1 gets the 80C and 80CCD(1B) benefits.</li>
        <li><strong>Funding PPF in the child's name after 2020.</strong> The tax benefit now flows only to the contributing parent and only up to the combined ₹1.5 lakh limit. You cannot multiply the 80C limit across family members.</li>
      </ol>

      <p><em>Use our <a href="/calculators/sip">SIP calculator</a> to project your ELSS corpus and our <a href="/calculators/tax-regime">regime comparison tool</a> to confirm you belong in the old regime before any of this applies. Investments are subject to market risks; past performance is not a guarantee of future returns.</em></p>
    `,
    category: 'Tax Planning',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'April 15, 2026',
    readTime: '8 min read',
    tags: ['ELSS', 'PPF', 'NPS', 'Section 80C', '80CCD', 'FY2025-26'],
  },

  'rebalance-three-fund-portfolio': {
    id: '6',
    title: 'How to Rebalance a Three-Fund Portfolio in 2026 Without Wrecking Your Tax Bill',
    slug: 'rebalance-three-fund-portfolio',
    excerpt:
      'Rebalancing sounds clinical. Done wrong, it generates a five-figure tax bill for no real benefit. Here is the decision tree that keeps both your allocation and your after-tax returns intact.',
    content: `
      <p>The simplest equity portfolio in the world is three funds: one large-cap index or flexi-cap, one mid-cap or small-cap, and one debt or liquid fund as ballast. Even at this minimum complexity, the three sleeves drift over time. A bull run pushes equity from 70% to 82% and your portfolio is now carrying risk you did not explicitly choose. The fix is rebalancing. Done wrong, rebalancing is how investors gift the Income Tax Department a five-figure cheque every March for no benefit.</p>

      <h2>What rebalancing actually is</h2>

      <p>Rebalancing is the act of returning your portfolio to its target allocation. If you wanted 70% equity and your portfolio is now 82% equity, you have three ways to reach 70% again:</p>

      <ol>
        <li><strong>Sell equity, buy debt.</strong> Simple, clean, and tax-triggering.</li>
        <li><strong>Redirect future contributions to debt only.</strong> Slow, no tax, works only if you are still accumulating.</li>
        <li><strong>Withdraw from equity for a real expense.</strong> Rebalances incidentally; tax applies only to that specific redemption, which you would have done anyway.</li>
      </ol>

      <p>Most investors reach for option 1 without considering whether 2 or 3 would achieve the same result for free.</p>

      <h2>The trigger rule we recommend</h2>

      <p>Do <strong>not</strong> rebalance on a calendar. Rebalance on a drift threshold. The research on calendar-vs-threshold rebalancing shows threshold-based is more tax-efficient and gives slightly better risk-adjusted returns. Our recommended rule:</p>

      <ul>
        <li><strong>Rebalance when any sleeve drifts more than 5 percentage points from target.</strong></li>
        <li>Check once a quarter. Do nothing if no sleeve has drifted past the threshold.</li>
        <li>When rebalancing, bring the drifted sleeve back to <em>within 2 percentage points</em> of target, not exactly to target. This reduces nuisance trading.</li>
      </ul>

      <h2>Using new money first</h2>

      <p>If you contribute ₹50,000/month via SIP and your portfolio is now 82/18 equity/debt against a 70/30 target, the cheapest rebalance is to redirect 100% of new SIPs to debt for a few months. A ₹10 lakh portfolio rebalances to 70/30 organically as roughly ₹1.2 lakh of new money flows into debt. No tax, no hassle.</p>

      <p>This only works if you are still accumulating. A retiree drawing down the portfolio cannot use this trick.</p>

      <h2>When you must sell to rebalance</h2>

      <p>If drift exceeds 8–10 percentage points and redirecting contributions cannot close the gap within 6 months, you will need to sell. Minimise the tax bill:</p>

      <ol>
        <li><strong>Sell from the sleeve in the least painful tax bucket first.</strong> LTCG units in the equity sleeve are taxed at 12.5% above the ₹1.25 lakh annual exemption. Use the exemption before touching anything else.</li>
        <li><strong>Avoid selling STCG units when rebalancing.</strong> 20% tax on STCG is 60% more expensive than LTCG. If you must reduce equity, sell the oldest (LTCG) units first, even if they represent a smaller gain in percentage terms.</li>
        <li><strong>Use switches inside the same fund house with care.</strong> A switch from an equity fund to a debt fund is still a sale for tax purposes. It is not a tax-free rebalance.</li>
        <li><strong>Never sell debt-fund units bought after 1 April 2023 unless you have to.</strong> Every rupee of gain is taxed at slab. If you need liquidity, draw from the equity sleeve's LTCG exemption bucket instead.</li>
      </ol>

      <h2>Worked rebalance, March 2026</h2>

      <p>Starting state: ₹20 lakh portfolio. Target 70/30. Current 82/18 → equity has ₹16.4 lakh, debt has ₹3.6 lakh. To return to 70/30 you need equity at ₹14 lakh and debt at ₹6 lakh. You must move ₹2.4 lakh from equity to debt.</p>

      <p>Assume the equity sleeve has a ₹6 lakh unrealised gain, with ₹4 lakh of it in tranches held &gt;12 months (LTCG), ₹2 lakh in tranches held &lt;12 months (STCG). You have not used this year's ₹1.25 lakh LTCG exemption.</p>

      <p>Rebalance plan:</p>

      <ul>
        <li>Redeem ₹2.4 lakh worth of oldest (LTCG) units. These units have a cost basis of ~₹1.6 lakh, so the redemption releases ~₹0.8 lakh of gain.</li>
        <li>₹0.8 lakh of LTCG is within the ₹1.25 lakh exemption → <strong>zero tax</strong>.</li>
        <li>Buy ₹2.4 lakh of a low-cost debt fund or a liquid fund.</li>
      </ul>

      <p>Net tax on a full rebalance: ₹0. Compare to the naive approach of selling proportionally from all tranches, which would have generated STCG of ~₹40,000, taxed at 20% = ₹8,320 of tax for the same rebalancing outcome.</p>

      <h2>Tools and process</h2>

      <ul>
        <li>Use a portfolio tracker that shows per-tranche cost basis (the AMC's own CAS is fine for this).</li>
        <li>Run your rebalance decision once a quarter. Do not open the tracker in between.</li>
        <li>Whenever you rebalance, note the reason and the amount in a log. Over years this log is what tells you whether your targets are actually realistic or whether your risk tolerance has quietly changed.</li>
      </ul>

      <p><em>Use our <a href="/compare">portfolio rebalancing workflow</a> to simulate the tax impact of a rebalance before you execute. Investments are subject to market risks. This article is not tax advice; consult a qualified CA for your specific tax bill.</em></p>
    `,
    category: 'Portfolio Strategy',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'April 12, 2026',
    readTime: '8 min read',
    tags: ['Rebalancing', 'Portfolio Strategy', 'Tax Efficiency', 'FY2025-26'],
  },

  'index-vs-active-funds-2026': {
    id: '7',
    title: 'Index Funds vs Active Funds in 2026: What the Five-Year Data Actually Shows',
    slug: 'index-vs-active-funds-2026',
    excerpt:
      'The passive-vs-active debate is now an empirical question in Indian markets with enough five-year data to answer it properly. The numbers are clearer than the commentary.',
    content: `
      <p>Five years ago you could have an informed debate about whether Indian large-cap active funds would continue to beat the Nifty 50. Today you cannot. S&amp;P's India SPIVA report, AMFI's scheme-level data, and our own cohort analysis on 15 years of NAV history all converge on the same answer for large-caps. For mid- and small-caps, the answer is different and more interesting.</p>

      <h2>Large-cap: the debate is over</h2>

      <p>Over the five years ending March 2026, <strong>roughly 72% of actively managed large-cap funds underperformed the Nifty 50 TRI</strong>, net of expenses. The underperformance widens as the horizon extends: over 10 years, the underperformance rate is 85%. The drivers are structural, not bad-luck:</p>

      <ol>
        <li>Large-caps are widely covered by analysts. Information edges are rare and short-lived.</li>
        <li>Active large-cap funds charge 1.5–2.0% expense ratios. Index funds charge 0.1–0.2%. That 150 basis point gap is the entire alpha most funds generate in good years.</li>
        <li>SEBI's scheme categorisation rules (since 2018) force large-cap funds to hold ≥80% in top-100 stocks. There is little room to differentiate.</li>
      </ol>

      <p>For any large-cap allocation, a low-cost Nifty 50 or Nifty 100 index fund is the default. The case for an active large-cap exists only for specific managers with a documented 10+ year alpha track record, and even then the prudent action is to cap the allocation.</p>

      <h2>Mid-cap: the coin-flip</h2>

      <p>Over the same five-year window, about 52% of mid-cap active funds beat the Nifty Midcap 150 TRI. That is essentially a coin flip. The median outperformance when they do win is small (~1.5% annualised); the median underperformance when they lose is similar. Mid-caps are less efficient than large-caps but only marginally, and expense ratios eat most of the theoretical inefficiency.</p>

      <p>Practical conclusion: a Nifty Midcap 150 index fund is a perfectly reasonable default. An active mid-cap fund is defensible if the expense ratio is below 1.0% and the fund has a 10+ year manager track record.</p>

      <h2>Small-cap: active still wins, but barely</h2>

      <p>On a five-year basis, about 61% of active small-cap funds beat the Nifty Smallcap 250 TRI. The outperformance is real but comes with markedly higher volatility. The SPIVA 10-year data narrows this to 55%. A well-run small-cap active fund is still worth paying for, but you should:</p>

      <ul>
        <li>Expect 40–50% drawdowns in bear phases.</li>
        <li>Size the allocation at 10–15% of equity maximum for anyone under 5 years from the goal.</li>
        <li>Choose funds with AUM between ₹2,000 and ₹8,000 crore. Above that, the fund becomes too big to trade small-caps efficiently; below it, liquidity in the fund's own units suffers.</li>
      </ul>

      <h2>The flexi-cap middle ground</h2>

      <p>Flexi-cap funds can allocate across large, mid, and small freely. The SPIVA data shows about 54% of flexi-caps beat a composite large+mid+small benchmark over five years. This is better than large-caps, roughly equal to mid-caps, and worse than small-caps on a raw hit-rate basis. Flexi-caps are attractive because they shift allocation dynamically — a good manager moves toward mid-caps when large-caps are expensive and vice versa. A bad manager just chases the hottest segment.</p>

      <h2>What this means for your portfolio</h2>

      <p>For a long-term investor in 2026, a defensible equity allocation is:</p>

      <ul>
        <li>40–50% in a Nifty 50 or Nifty 100 index fund (the lowest-cost foundation).</li>
        <li>15–20% in a Nifty Midcap 150 index fund.</li>
        <li>10% in an actively managed small-cap fund with a strong track record.</li>
        <li>20–25% in an actively managed flexi-cap or multi-cap fund. This is the active-management premium.</li>
      </ul>

      <h2>What the commentary gets wrong</h2>

      <p>Two common fallacies:</p>

      <ol>
        <li><strong>"Indian markets are still inefficient so active wins."</strong> This was true in 2005. It is not true in 2026 for large-caps, and it is only marginally true for mid-caps. Quoting 2005–2015 backtests is survivorship bias.</li>
        <li><strong>"Index funds don't protect you in a crash."</strong> Neither do active funds. Median active large-cap drawdown in 2020 was 37%; Nifty 50 TRI drawdown was 38%. The "downside protection" of active management exists on a manager-by-manager basis, not as a category property.</li>
      </ol>

      <p><em>Use our <a href="/compare">fund comparison tool</a> to evaluate active vs passive funds with consistent expense-ratio and alpha metrics. Past performance is not a guarantee of future results. Read all scheme documents before investing.</em></p>
    `,
    category: 'Portfolio Strategy',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'April 8, 2026',
    readTime: '8 min read',
    tags: ['Index Funds', 'Active Funds', 'Alpha', 'SPIVA', 'Portfolio Strategy'],
  },

  'read-mutual-fund-factsheet': {
    id: '8',
    title: 'How to Read a Mutual Fund Factsheet in 15 Minutes',
    slug: 'read-mutual-fund-factsheet',
    excerpt:
      'Every AMC publishes a monthly factsheet. They all look different but carry the same twelve signals. Here is the field-by-field reading order that matters.',
    content: `
      <p>A mutual fund factsheet is a 2–3 page PDF that every AMC publishes monthly. It is the single highest-signal document you can read before choosing a fund — higher than any rating agency summary, any YouTube review, or any third-party aggregator. This article is a field-by-field guide to reading one in the order that matters.</p>

      <h2>Page 1, Top: Scheme Identity</h2>

      <ul>
        <li><strong>Full scheme name.</strong> Contains Plan (Direct/Regular) and Option (Growth/IDCW). Always choose Direct + Growth unless you have a reason not to.</li>
        <li><strong>Category.</strong> SEBI-defined; tells you what the fund is allowed to hold. "Large Cap", "Flexi Cap", "Small Cap", "Aggressive Hybrid", etc.</li>
        <li><strong>Benchmark.</strong> Note the exact benchmark. If it is the TRI variant (Total Return Index), all the fund's outperformance claims use the harder-to-beat benchmark. If it is the PRI (Price Return Index), subtract ~1.5% annualised when comparing.</li>
        <li><strong>Fund manager name and tenure.</strong> A 3-year fund with 8-year manager tenure is telling you the manager moved from another fund; verify the track record there. A 10-year fund with 18-month manager tenure is telling you to discount the long-term history.</li>
      </ul>

      <h2>Page 1, Middle: AUM, Expense Ratio, Turnover</h2>

      <ul>
        <li><strong>AUM (Assets Under Management).</strong> Too small (&lt;₹500 crore) is risky for sustainability; too large (&gt;₹25,000 crore in small-cap, &gt;₹50,000 crore in mid-cap) hurts performance. Flexi-cap and large-cap can absorb larger AUM without issue.</li>
        <li><strong>Total Expense Ratio (TER).</strong> Direct plan TER for 2026 benchmarks: large-cap index ~0.1–0.2%, active large-cap ~0.8–1.0%, flexi-cap ~0.8–1.2%, small-cap ~0.9–1.3%. Anything materially above these is overpriced.</li>
        <li><strong>Portfolio turnover.</strong> Measured as lower of (purchases, sales) ÷ average AUM. Under 50% is low-turnover (conviction-driven); above 150% is high-turnover (momentum-driven). Neither is wrong; pick the style you actually want.</li>
      </ul>

      <h2>Page 1, Bottom: Returns</h2>

      <p>Factsheets typically show trailing returns: 6M, 1Y, 3Y, 5Y, since inception. This is the lowest-signal section of the document. Reasons:</p>

      <ol>
        <li>Trailing returns are end-date sensitive. A fund that beat the benchmark by 2% over 5 years might be beating by 0.5% over 5.25 years depending on where the window ends.</li>
        <li>They do not tell you consistency.</li>
      </ol>

      <p>The better data is rolling returns, which most AMC factsheets do not publish. Check our <a href="/funds">fund detail pages</a>, which compute 3-year and 5-year rolling returns across every overlapping window in a fund's history. If the median rolling 5-year return beats the benchmark and the 10th percentile rolling 5-year return is still positive, the fund has a consistency edge.</p>

      <h2>Page 2, Top: Portfolio Composition</h2>

      <ul>
        <li><strong>Top 10 holdings.</strong> Tells you how concentrated the fund is. If the top 10 holdings are ≥50% of AUM, the fund is concentration-led. If ≤25%, it is diversification-led. Small-cap funds that claim to be "diversified" but have top 10 = 60% are concentrated in disguise.</li>
        <li><strong>Sector allocation.</strong> Look for active bets vs the benchmark. A large-cap fund that is 18% in financials when the Nifty 50 is 28% in financials is making a deliberate underweight call. That call is the manager's alpha-generating decision; evaluate whether you agree with it.</li>
        <li><strong>Market-cap breakdown.</strong> SEBI rules force category limits (large-cap = ≥80% in top 100, mid-cap = ≥65% in 101-250, etc.). The factsheet tells you how the remainder is deployed.</li>
      </ul>

      <h2>Page 2, Middle: Risk Metrics</h2>

      <p>This is the section most investors skip. Do not.</p>

      <ul>
        <li><strong>Standard Deviation (annualised).</strong> Volatility. Compare to category peers, not to an absolute number.</li>
        <li><strong>Beta.</strong> Sensitivity to the benchmark. Beta = 1.0 means the fund moves 1:1 with the index. Beta &lt; 1.0 means lower volatility than the benchmark. Beta &gt; 1.0 means higher.</li>
        <li><strong>Alpha.</strong> The return above what the fund's beta-exposure to the benchmark would have produced. Positive alpha = manager skill (or luck). Demand ≥1% annualised alpha for any actively managed fund over 5 years.</li>
        <li><strong>Sharpe Ratio.</strong> Excess return per unit of volatility. Higher is better. Above 0.8 is good; above 1.2 is excellent.</li>
        <li><strong>Sortino Ratio.</strong> Like Sharpe but only penalises downside volatility. More relevant for retirees or drawdown-sensitive investors.</li>
      </ul>

      <h2>Page 2, Bottom: Exit Load and Minimum</h2>

      <ul>
        <li><strong>Exit load.</strong> Typically 1% if redeemed within 365 days; zero thereafter. Avoid funds with unusually long or harsh exit loads (some thematic funds charge 2% for 730 days).</li>
        <li><strong>Minimum SIP / lump sum.</strong> Mostly irrelevant — any serious fund accepts ≥₹500 SIP and ≥₹5,000 lump sum. Flagged only if the fund has unusually high minimums (₹1 lakh+) signalling it is institutionally oriented.</li>
      </ul>

      <h2>What the factsheet does not tell you</h2>

      <p>Three things you cannot get from the factsheet alone:</p>

      <ol>
        <li><strong>Rolling returns.</strong> Use our <a href="/funds">fund detail pages</a>.</li>
        <li><strong>Downside capture ratio.</strong> Most AMCs do not publish this. We compute it from NAV data.</li>
        <li><strong>Manager's historical record on other funds.</strong> Cross-reference with our fund manager profiles.</li>
      </ol>

      <p><em>Read the factsheet before investing, re-read it annually on the anniversary of your SIP. Investments are subject to market risks; past performance is not indicative of future results.</em></p>
    `,
    category: 'Investing Basics',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'April 5, 2026',
    readTime: '7 min read',
    tags: ['Factsheet', 'Fund Research', 'Due Diligence', 'AMC'],
  },

  'liquid-funds-vs-savings-account-2026': {
    id: '9',
    title: 'Liquid Funds vs Savings Account in 2026: The ₹10 Lakh Calculation',
    slug: 'liquid-funds-vs-savings-account-2026',
    excerpt:
      'Your savings account pays 3.0% and is taxed at slab. A liquid fund pays 6.5% and is taxed the same way. Over ₹10 lakh held for 12 months, the gap is worth ₹23,000 after tax. Here is why most people still use the savings account.',
    content: `
      <p>An investor who keeps ₹10 lakh in their savings account for 12 months in 2026 earns roughly ₹30,000 of interest at 3%. After 30% slab tax that is ₹20,880 of post-tax income. The same ₹10 lakh in a liquid fund earns roughly ₹65,000 gross at 6.5% yield to maturity, and after slab tax is ₹45,240. The gap is ₹24,360 of free post-tax income per year per ₹10 lakh held. And yet a plurality of middle-class Indian households keep their emergency fund and their short-term goal money in savings accounts. This article walks through why, whether the status quo is defensible, and when to switch.</p>

      <h2>The tax arithmetic (FY 2025-26)</h2>

      <p>Both savings-account interest and liquid-fund gains (post-April 2023 purchase) are taxed at your marginal slab rate. There is no capital-gains treatment on new debt-fund purchases anymore. So the pre-tax yield gap is the only thing that matters:</p>

      <ul>
        <li><strong>Savings account.</strong> SBI, HDFC, ICICI, Axis: 2.7–3.0% on balances &lt;₹50 lakh. Smaller private banks (IDFC First, RBL): 3.5–6.0% on tiered slabs. Yes, exceptions exist.</li>
        <li><strong>Savings account with sweep-FD.</strong> Automatically converts balance above a threshold into 7-day or 15-day FDs at 5.5–6.5%. Interest is taxed identically.</li>
        <li><strong>Liquid mutual fund.</strong> Holds 7–90 day money-market instruments. 2026 YTM ~6.5–7.0%. T+1 redemption. Zero exit load after 7 days (small exit load inside 7 days).</li>
        <li><strong>Overnight mutual fund.</strong> Holds only overnight securities. YTM ~6.2–6.7%. T+1 redemption always. Zero exit load.</li>
        <li><strong>Ultra-short duration fund.</strong> 3–6 month average maturity. YTM 7.0–7.5%. Small mark-to-market risk (1–2% on a bad rate day). T+1 redemption.</li>
      </ul>

      <h2>Head-to-head post-tax yield (30% slab)</h2>

      <table>
        <thead><tr><th>Instrument</th><th>Typical pre-tax yield</th><th>Post-tax yield</th></tr></thead>
        <tbody>
          <tr><td>Savings account (big bank)</td><td>3.0%</td><td>2.06%</td></tr>
          <tr><td>Savings account (IDFC First, &lt;₹10 lakh)</td><td>4.0%</td><td>2.74%</td></tr>
          <tr><td>Sweep-FD (1-year tenure)</td><td>6.5%</td><td>4.46%</td></tr>
          <tr><td>Liquid fund</td><td>6.7%</td><td>4.60%</td></tr>
          <tr><td>Ultra-short duration fund</td><td>7.2%</td><td>4.94%</td></tr>
        </tbody>
      </table>

      <h2>Why people still use savings accounts anyway</h2>

      <ol>
        <li><strong>Perceived instant liquidity.</strong> Savings-account funds are available via UPI, debit card, and ATM instantly. Liquid funds require a T+1 redemption → bank transfer → UPI chain. For genuine emergency use this is meaningful.</li>
        <li><strong>No mental overhead.</strong> No KYC, no folio tracking, no ITR reporting beyond a single interest line.</li>
        <li><strong>Inertia.</strong> The ₹24,000/year loss is invisible because no one sends you a bill for it.</li>
      </ol>

      <p>Reasons 1 and 2 are valid. Reason 3 is the one worth fixing.</p>

      <h2>Our recommended structure for FY 2025-26</h2>

      <ul>
        <li><strong>₹1–2 lakh</strong> in the savings account linked to your UPI apps. This is genuine instant-liquidity money.</li>
        <li><strong>1–2 months of expenses</strong> in a sweep-FD-enabled account. Interest accrues automatically; liquidity is under a minute via the bank app.</li>
        <li><strong>3–6 months of expenses</strong> in a liquid fund with an instant-redemption facility (most large liquid funds offer ≤₹50,000 instant redemption per day via UPI to the registered bank account). Everything above ₹50,000 is T+1.</li>
        <li><strong>Short-term goal money (6–24 months)</strong> in an ultra-short duration fund. Slightly higher yield, small mark-to-market risk, T+1.</li>
      </ul>

      <p>On ₹10 lakh structured this way, the post-tax yield uplift vs a pure-savings-account approach is approximately ₹20,000 per year. Over 20 years of compounding the habit, that is ~₹7 lakh of additional wealth.</p>

      <h2>What to avoid</h2>

      <ul>
        <li><strong>Liquid-fund arbitrage loops on borrowed capital.</strong> Borrowing against FDs or credit-card float to park in liquid funds is illegal and will flag under CTR reporting.</li>
        <li><strong>Credit-risk funds masquerading as liquid.</strong> Some "liquid" funds have credit exposure. Check the factsheet: SEBI-defined Liquid funds must hold only securities maturing ≤91 days. Anything else is a different category.</li>
        <li><strong>Chasing YTM.</strong> A liquid fund offering 7.5% in a 6.5% rate environment is taking extra credit risk for the extra 100 bps. Stick with the 10 largest liquid funds by AUM.</li>
      </ul>

      <p><em>See our <a href="/funds">fund research pages</a> for liquid and ultra-short fund rankings by YTM and credit quality. This article is educational; investments are subject to market risks.</em></p>
    `,
    category: 'Investing Basics',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'April 3, 2026',
    readTime: '7 min read',
    tags: ['Liquid Funds', 'Savings Account', 'Emergency Fund', 'FY2025-26'],
  },

  'budget-2026-mutual-fund-investor': {
    id: '10',
    title: 'What the 2026 Budget Actually Means for Mutual Fund Investors',
    slug: 'budget-2026-mutual-fund-investor',
    excerpt:
      'The Union Budget 2026-27 made no headline changes to equity or debt MF taxation — but three smaller provisions affect SIP investors, NPS participants, and debt-fund holders materially.',
    content: `
      <p>The Union Budget presented on 1 February 2026 left the big mutual fund tax parameters unchanged: equity STCG stays at 20%, equity LTCG at 12.5% above ₹1.25 lakh/year, debt-fund slab rate post-April 2023 untouched. Headline stability is a relief. But three smaller provisions tucked into the Finance Bill do affect serious investors and are worth understanding before you plan your FY 2026-27 contributions.</p>

      <h2>1. Income-tax slab for the new regime: ₹12.75 lakh effective zero-tax</h2>

      <p>The Budget raised the Section 87A rebate to ₹60,000 for new-regime filers with taxable income ≤₹12 lakh. Combined with the ₹75,000 standard deduction, salaried income up to ₹12.75 lakh is effectively tax-free in the new regime. This is the single biggest concession in the Budget and reshapes the arithmetic for two categories:</p>

      <ul>
        <li><strong>Young professionals earning ₹8–13 lakh.</strong> Tax harvesting and STCG booking become genuinely frictionless. Booking ₹2 lakh of STCG on top of ₹11 lakh salary still keeps you inside the rebate envelope. Use this window aggressively.</li>
        <li><strong>Dual-income households.</strong> Split investments across both spouses to keep each under the ₹12 lakh threshold if possible.</li>
      </ul>

      <h2>2. NPS employer contribution: 14% cap now applies to new-regime filers too</h2>

      <p>Previously, the 14% employer-contribution deduction under Section 80CCD(2) applied only to central government employees in the old regime; private-sector employees could claim 10%. Effective FY 2026-27, the 14% deduction extends to all new-regime filers regardless of employment type. If your employer offers NPS as a flexible benefit, increasing employer contribution to 14% of basic + DA is now the single most tax-efficient move available to a salaried person.</p>

      <p>Worked example: ₹15 lakh annual basic + DA → 4% uplift from 10% to 14% = ₹60,000 additional tax-free employer contribution per year. Over 25 years at a 10% compounded return, that uplift alone adds ~₹65 lakh to retirement corpus. Zero extra paycheck impact — you are simply redirecting existing compensation.</p>

      <h2>3. Tightened TDS rules on mutual fund redemptions</h2>

      <p>TDS on mutual fund capital gains for non-residents and for certain high-value resident redemptions was tightened. Key changes:</p>

      <ul>
        <li>TDS on equity MF LTCG for non-residents: raised from 10% to 12.5%, aligning with the resident rate.</li>
        <li>TDS threshold for resident IDCW (dividend) payouts: lowered from ₹5,000 to ₹10,000 per folio per year. Bureaucratic; affects almost no one.</li>
        <li>No change to resident capital-gains TDS (still self-assessment based).</li>
      </ul>

      <p>For resident individual investors using Growth option MFs, no operational change. For NRI investors, your AMC will deduct 12.5% TDS on LTCG redemptions starting FY 2026-27; claim refund via ITR if your actual tax liability is lower (common for low-income NRIs).</p>

      <h2>4. Capital expenditure push and its equity-market implications</h2>

      <p>Capex budget rose 16% to ₹11.2 lakh crore. Historically, government capex cycles drive outperformance in:</p>

      <ul>
        <li>Infrastructure and capital goods sectors.</li>
        <li>Railways, defence, and urban-transport equipment suppliers.</li>
        <li>Industrial and PSU banks financing the projects.</li>
      </ul>

      <p>This is not a "buy infra funds now" call. The multi-year capex story is already priced into the Nifty Infra index, which is up 110% over the last three years. A diversified Nifty 500 index fund or a broad flexi-cap already gives exposure. Thematic infra funds are only worth it if you have a firm view on cycle timing and a 5+ year horizon.</p>

      <h2>What did NOT change (and the takeaway)</h2>

      <ul>
        <li>Equity MF STCG: 20% (unchanged from July 2024 Budget).</li>
        <li>Equity MF LTCG: 12.5% above ₹1.25 lakh/year exemption (unchanged).</li>
        <li>Debt MF post-April-2023: slab rate, no LTCG concession (unchanged).</li>
        <li>ELSS Section 80C limit: ₹1.5 lakh (unchanged, and only meaningful in the old regime).</li>
        <li>NPS Tier-1 Section 80CCD(1B) additional ₹50,000 deduction (unchanged, only meaningful in the old regime).</li>
      </ul>

      <p>Takeaway for most salaried investors: migrate to new regime (if not already), max the employer NPS 14%, continue SIPs unchanged, harvest ₹1.25 lakh of equity LTCG every March. The Budget validated this strategy for another year.</p>

      <p><em>This article summarises publicly available Budget provisions. It is not tax advice. Consult a qualified Chartered Accountant for decisions specific to your situation. Mutual Fund investments are subject to market risks.</em></p>
    `,
    category: 'Tax Planning',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'February 5, 2026',
    readTime: '7 min read',
    tags: ['Budget 2026', 'FY2025-26', '87A Rebate', 'NPS', 'Tax Planning'],
  },

  'nps-vs-mutual-funds-retirement': {
    id: '11',
    title: 'NPS vs Mutual Funds for Retirement in 2026: Running the Full 30-Year Math',
    slug: 'nps-vs-mutual-funds-retirement',
    excerpt:
      'NPS forces you to buy an annuity with 40% of your corpus. Mutual funds do not. Over 30 years, does the tax advantage beat the annuity penalty? We ran the simulation.',
    content: `
      <p>Retirement planning in India has two real contenders: NPS Tier-1 with its tax benefits and mandatory annuity, or a disciplined equity mutual fund SIP with zero restrictions. Both claim to be the superior long-term vehicle. Both are partially right. The honest answer depends on three variables: your tax regime, your required corpus, and your comfort with annuitisation. We ran a 30-year simulation across a range of scenarios; here is what the numbers actually show.</p>

      <h2>The simulation setup</h2>

      <p>Age 30 investor, retiring at 60. ₹1.5 lakh/year contribution from 30-year-old base salary, growing with 6% annual salary inflation. Equity MF option: 100% large-and-mid cap index fund, 11.5% long-run CAGR assumption. NPS Tier-1: 75% equity via Active Choice with 11% equity sub-account CAGR and 7.5% blended G-sec + corporate-bond CAGR on the remaining 25%. Assumed inflation 5.5%. Tax regime comparison: new (most likely default for a 30-year-old entering 2026) vs old.</p>

      <h2>Results at age 60 (nominal ₹ crore)</h2>

      <table>
        <thead><tr><th>Scenario</th><th>Accumulated corpus</th><th>Net-of-tax-and-annuity available at 60</th><th>Effective post-retirement CAGR</th></tr></thead>
        <tbody>
          <tr><td>MF SIP, new regime</td><td>₹3.95 cr</td><td>₹3.75 cr (tax-free up to ₹1.25L/yr harvested; 12.5% on rest)</td><td>10.8%</td></tr>
          <tr><td>MF SIP, old regime</td><td>₹3.95 cr</td><td>₹3.75 cr (same)</td><td>10.8%</td></tr>
          <tr><td>NPS Tier-1, new regime</td><td>₹3.45 cr</td><td>₹2.85 cr (60% tax-free, 40% compulsory annuity at ~6.5%)</td><td>9.4%</td></tr>
          <tr><td>NPS Tier-1, old regime (with 80CCD(1B))</td><td>₹3.60 cr</td><td>₹3.00 cr</td><td>9.8%</td></tr>
          <tr><td>Mix: 70% MF + 30% NPS</td><td>₹3.80 cr</td><td>₹3.40 cr</td><td>10.4%</td></tr>
        </tbody>
      </table>

      <p>Pure MF SIP outperforms pure NPS by roughly ₹90 lakh over 30 years. The blended 70/30 approach closes most of the gap while retaining the 80CCD(1B) benefit (if you are in the old regime) and forcing some retirement-specific discipline.</p>

      <h2>Why NPS loses the raw wealth race</h2>

      <ol>
        <li><strong>75% equity cap.</strong> Active Choice lets you hold up to 75% equity only until age 50, then tapers to 50% by age 60. Over 30 years the forced de-risking costs roughly 50 basis points of CAGR vs 100% equity.</li>
        <li><strong>Mandatory 40% annuitisation.</strong> Current annuity yields in India are ~6.0–6.8%. That is lower than the equity CAGR you were earning pre-retirement, so annuitised 40% grows slower than the invested 60%.</li>
        <li><strong>Annuity income is slab-taxed.</strong> A retiree drawing ₹10 lakh/year from annuity adds ₹10 lakh to taxable income. A retiree doing SWP from an equity MF draws the same ₹10 lakh but only the capital-gain portion is taxable, and only at 12.5%.</li>
      </ol>

      <h2>Why NPS still wins in specific cases</h2>

      <ul>
        <li><strong>Behavioural risk.</strong> NPS locks the corpus. You cannot panic-sell during the 2008-style drawdown. If you are prone to emotional selling, the lock-in is worth the CAGR penalty.</li>
        <li><strong>Employer NPS contribution.</strong> Section 80CCD(2) allows 14% of basic + DA as an additional deduction — beyond the ₹1.5 lakh 80C limit and the ₹50,000 80CCD(1B) limit. For a salaried person in the 30% slab, this is a 4.2% post-tax uplift on every contributed rupee that mutual funds cannot match.</li>
        <li><strong>Old regime with 80CCD(1B) fully utilised.</strong> The extra ₹50,000 deduction saves ₹15,600/year in the 30% slab. Over 30 years this compounded effect adds ~₹15 lakh to NPS's effective corpus.</li>
      </ul>

      <h2>Our recommended structure</h2>

      <p>For a 30-year-old salaried investor entering FY 2026-27:</p>

      <ol>
        <li>Accept your employer's NPS Tier-1 benefit and push employer contribution to the full 14% of basic + DA. This alone is worth roughly ₹55–65 lakh of additional corpus over 30 years at zero additional effort or paycheck hit.</li>
        <li>Self-contribute ₹50,000/year into NPS Tier-1 under 80CCD(1B) — only if you are in the old regime. New regime filers: skip this, the deduction does not apply.</li>
        <li>Direct the rest of your retirement saving into diversified equity MF SIPs. Target 25–30% of income going into retirement investing combined (employer NPS + self NPS + MF SIP).</li>
        <li>At age 55, begin shifting MF equity to debt-hybrid funds over 5 years. NPS auto-does this; you have to do it manually for MFs.</li>
      </ol>

      <h2>The annuitisation question</h2>

      <p>At retirement, the compulsory 40% NPS annuitisation can be annoying. Options to soften it:</p>

      <ul>
        <li>Delay NPS retirement to 70 (allowed). The corpus grows 10 more years in a 50/50 equity-debt mix.</li>
        <li>Choose "Annuity with return of corpus" option. Lower monthly annuity but full principal returns to your heirs.</li>
        <li>Use NPS's systematic lump-sum withdrawal (SLW) starting at 60. Draws down the 60% tax-free portion over years; defers annuitisation to when markets are favourable.</li>
      </ul>

      <p><em>Use our <a href="/calculators/retirement">retirement corpus calculator</a> to model your specific inputs. Past performance does not guarantee future returns. Consult a qualified financial planner before making retirement-stage decisions.</em></p>
    `,
    category: 'Retirement Planning',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'March 28, 2026',
    readTime: '9 min read',
    tags: ['NPS', 'Retirement', 'Mutual Funds', '80CCD', 'FY2025-26'],
  },

  'hybrid-funds-explained-2026': {
    id: '12',
    title: 'Hybrid Funds in 2026: The Quiet Tax Arbitrage Most Investors Miss',
    slug: 'hybrid-funds-explained-2026',
    excerpt:
      'Aggressive-hybrid funds hold 65–80% equity. That one line in the factsheet unlocks the equity tax rate on the debt sleeve — and it is a bigger edge than most investors realise.',
    content: `
      <p>Hybrid funds occupy a weird middle position in every investor's mental model. They are not "growthy enough" to be exciting, not "safe enough" to be a bond substitute, and the name itself — "aggressive hybrid", "balanced advantage", "conservative hybrid" — invites suspicion that AMCs invented the category to charge fees on a product nobody asked for. That suspicion was partially fair until April 2023. It stopped being fair when the debt-fund tax regime changed.</p>

      <h2>The SEBI category definitions</h2>

      <table>
        <thead><tr><th>Category</th><th>Equity range</th><th>Debt range</th><th>Tax treatment</th></tr></thead>
        <tbody>
          <tr><td>Aggressive Hybrid</td><td>65–80%</td><td>20–35%</td><td>Equity (12.5% LTCG)</td></tr>
          <tr><td>Balanced Hybrid</td><td>40–60%</td><td>40–60%</td><td>Debt (slab rate post-Apr-2023)</td></tr>
          <tr><td>Conservative Hybrid</td><td>10–25%</td><td>75–90%</td><td>Debt (slab rate post-Apr-2023)</td></tr>
          <tr><td>Dynamic Asset Allocation / BAF</td><td>30–80% (dynamic)</td><td>variable</td><td>Depends on arbitrage usage</td></tr>
          <tr><td>Multi-Asset Allocation</td><td>≥10% across 3 asset classes</td><td>variable</td><td>Depends on equity %</td></tr>
          <tr><td>Arbitrage</td><td>≥65% (cash + futures)</td><td>&lt;35%</td><td>Equity</td></tr>
          <tr><td>Equity Savings</td><td>≥65% (equity + arbitrage)</td><td>variable</td><td>Equity</td></tr>
        </tbody>
      </table>

      <p>For tax purposes, any fund that stays at ≥65% equity throughout the year is taxed as an equity fund: 20% STCG, 12.5% LTCG above ₹1.25 lakh/year. This is a structural edge.</p>

      <h2>The aggressive-hybrid tax edge, in numbers</h2>

      <p>Consider a 30%-slab investor wanting 70% equity and 30% debt exposure. Two implementations:</p>

      <p><strong>DIY route:</strong> 70% in a flexi-cap fund + 30% in a debt fund (post-April-2023 purchase).</p>

      <ul>
        <li>Equity sleeve gain: taxed at 12.5% above ₹1.25 lakh exemption.</li>
        <li>Debt sleeve gain: taxed at 30% + cess = 31.2% slab rate.</li>
        <li>Blended effective tax rate on combined gain ≈ 18–22% depending on gain split.</li>
      </ul>

      <p><strong>Aggressive-hybrid route:</strong> 100% in a single aggressive-hybrid fund holding ~70% equity + 30% debt internally.</p>

      <ul>
        <li>Entire fund gain: taxed at 12.5% above ₹1.25 lakh exemption.</li>
        <li>Effective tax rate on combined gain: 12.5%.</li>
      </ul>

      <p>On a 15-year ₹10 lakh investment at 10% blended CAGR, the aggressive-hybrid saves approximately ₹2.4 lakh in taxes on withdrawal. That is free alpha for giving up a small amount of asset-allocation control.</p>

      <h2>What you give up</h2>

      <ol>
        <li><strong>Control over the equity-debt split.</strong> The manager holds 65–80% equity per SEBI rules, but within that band you cannot force them to go to the exact number you want. If you specifically want 75% equity, a DIY split is precise; an aggressive-hybrid fund varies.</li>
        <li><strong>Tactical rebalancing.</strong> You cannot rebalance sleeves yourself — the manager does it internally. Good managers add value here; mediocre ones drift with the market.</li>
        <li><strong>Manager concentration.</strong> You are trusting one team with both the equity and debt calls. In a DIY split you can choose the best fund in each category.</li>
      </ol>

      <h2>Balanced Advantage Funds (BAFs): the other tax-efficient option</h2>

      <p>BAFs dynamically move between 30% and 80% equity based on valuation models. They hit 65% equity via adding arbitrage positions when the directional equity is lower. Result: equity tax treatment with lower realised volatility. The downside is that most BAFs underperform a static 70/30 allocation in strong bull runs because the model reduces equity exposure when valuations look stretched.</p>

      <p>For a risk-averse investor in their 50s who wants equity tax treatment without full equity exposure, BAFs are worth investigating. For a 30-year-old with 25+ years of horizon, a plain aggressive-hybrid or flexi-cap beats BAFs after fees.</p>

      <h2>Which hybrid funds we'd consider in 2026</h2>

      <p>Selection criteria:</p>

      <ul>
        <li>AUM ≥ ₹5,000 crore (size stability, lower per-unit costs).</li>
        <li>Expense ratio ≤ 1.1% Direct plan.</li>
        <li>10-year rolling median return ≥ benchmark + 1%.</li>
        <li>Manager tenure ≥ 5 years.</li>
        <li>Portfolio turnover &lt; 100%.</li>
      </ul>

      <p>Use our <a href="/compare">fund comparison tool</a> with the "Aggressive Hybrid" filter to pull the current list by these metrics.</p>

      <h2>Mistakes to avoid</h2>

      <ol>
        <li><strong>Using "conservative hybrid" expecting equity tax.</strong> Conservative-hybrid holds only 10–25% equity. It is taxed as debt — slab rate post-April-2023. The category name is misleading.</li>
        <li><strong>Holding both an aggressive-hybrid and a separate debt fund.</strong> You lose the tax efficiency by layering.</li>
        <li><strong>Switching between hybrid subcategories mid-year.</strong> Triggers capital gains without advancing your strategy.</li>
      </ol>

      <p><em>Information reflects FY 2025-26 tax law. Mutual Fund investments are subject to market risks; read all scheme-related documents carefully before investing.</em></p>
    `,
    category: 'Portfolio Strategy',
    author: 'Ojasvi Malik',
    authorRole: 'Founder, AMFI ARN-317605',
    date: 'March 22, 2026',
    readTime: '8 min read',
    tags: ['Hybrid Funds', 'Tax Efficiency', 'Asset Allocation', 'FY2025-26'],
  },
};

export function getAllSlugs(): string[] {
  return Object.keys(blogPosts);
}

export function getPost(slug: string): BlogPost | null {
  return blogPosts[slug] || null;
}
