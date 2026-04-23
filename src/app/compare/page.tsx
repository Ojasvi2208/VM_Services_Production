import type { Metadata } from 'next';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import FundComparison from '@/components/FundComparison';
import { EditorialProse } from '@/components/EditorialProse';

export const metadata: Metadata = {
  title: 'Compare Mutual Funds Side by Side',
  description: 'Compare mutual funds side by side with interactive charts, performance metrics, risk analysis, and holdings overlap. Free tool by Vijay Malik Financial Services.',
  openGraph: {
    title: 'Compare Mutual Funds Side by Side | Vijay Malik Financial Services',
    description: 'Compare mutual funds side by side with interactive charts, performance metrics, risk analysis, and holdings overlap.',
  },
};

export default function ComparePage() {
  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">
        <header className="mb-10 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Compare Funds
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Side-by-side performance, risk metrics, and holdings analysis across any two mutual fund schemes.
          </p>
        </header>

        <FundComparison />

        <EditorialProse heading="How to compare two mutual funds properly">
          <p>
            Most investors compare funds by looking at a single number: the 3-year or 5-year
            return. That is the worst possible way to choose between two schemes. A fund that
            outperforms over a specific 5-year window may be riskier, more expensive, or simply
            lucky on the end date. The six dimensions that actually matter — and that this tool
            computes side by side — are returns consistency, expense ratio, portfolio overlap,
            risk-adjusted return, downside behaviour, and fund-house stability.
          </p>
          <h3>1. Returns consistency, not trailing returns</h3>
          <p>
            Trailing returns are end-date-sensitive. Rolling returns — the same CAGR computed
            across every overlapping 3-year or 5-year window — remove that sensitivity. When
            comparing two funds, look at the <strong>median rolling 5-year return</strong>, the
            10th-percentile return (how bad it got in the worst periods), and how often the
            fund beat its benchmark.
          </p>
          <h3>2. Expense ratio</h3>
          <p>
            In FY 2025-26 benchmarks: a large-cap index fund should charge 0.1–0.2%, an active
            large-cap 0.8–1.0%, flexi-cap 0.8–1.2%, small-cap 0.9–1.3%. A 50-bps difference in
            expense ratio compounds into roughly 12% less terminal wealth over 25 years. This
            is not a small number. The cheaper fund starts with a permanent structural
            advantage that the expensive fund has to overcome through alpha every single year
            — and{' '}
            <a href="/blog/index-vs-active-funds-2026">the empirical data</a> says most of them
            don&apos;t.
          </p>
          <h3>3. Portfolio overlap</h3>
          <p>
            If you own two flexi-cap funds and their top-10 holdings overlap 70%, you are not
            diversified — you are paying two management fees for one exposure. Our overlap
            percentage uses the actual latest factsheet holdings, not category-level
            assumptions. Below 40% overlap = meaningfully different funds; above 60% = you
            should pick one.
          </p>
          <h3>4. Risk-adjusted return (Sharpe, Sortino)</h3>
          <p>
            Fund A at 15% return with 18% volatility looks similar to Fund B at 13% return with
            10% volatility. They are not similar at all. Fund B has a Sharpe roughly 70% higher
            and will deliver far better outcomes if you ever have to redeem during a drawdown.
            For retirees using SWP, the Sortino ratio matters more than Sharpe — it penalises
            only downside volatility, which is the only volatility you actually care about
            when withdrawing.
          </p>
          <h3>5. Downside capture</h3>
          <p>
            How much of a falling market did the fund absorb? A 90% downside capture means the
            fund fell 9% when the index fell 10%. An 80% downside capture means it fell 8%.
            Over a full market cycle, lower downside capture is a strong predictor of
            long-term outperformance because the fund starts the next rally from a higher
            base. Compare this metric between any two candidate funds.
          </p>
          <h3>6. Fund-house stability</h3>
          <p>
            Manager tenure, AUM concentration, parent AMC stability. A brilliant manager at an
            AMC that has had three CEOs in four years is a different risk than the same
            manager at a stable house. The compare tool surfaces manager tenure and AMC AUM
            trend alongside every fund.
          </p>
          <p>
            One more rule: never compare a Direct plan to a Regular plan. The expense ratio
            difference (usually 1–1.3% in the Regular&apos;s favour of the fund house, not
            yours) distorts every return number. Always compare Direct-to-Direct. Our tool
            defaults to Direct plans for this reason.
          </p>
        </EditorialProse>

        <p className="text-center text-xs text-[#3c4a3e] font-mono mt-10 max-w-2xl mx-auto leading-relaxed">
          Mutual fund investments are subject to market risks. Read all scheme related documents carefully.
          Past performance is not indicative of future results. Vijay Malik Financial Services is an AMFI-registered distributor · ARN-317605.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
