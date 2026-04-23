"use client";

import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import EnhancedFundsTable from '@/components/EnhancedFundsTable';
import { EditorialProse } from '@/components/EditorialProse';

const STATS = [
  { value: '5,000+', label: 'Mutual Funds' },
  { value: '45+', label: 'Categories' },
  { value: 'Real-time', label: 'NAV Updates' },
  { value: 'Pro', label: 'Analytics' },
];

const BADGES = [
  { label: 'Real-time NAV', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'Advanced Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { label: 'Detailed Analysis', icon: 'M9 5l7 7-7 7' },
];

const AnalysisPage = () => {
  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1">

        {/* Hero Section */}
        <section className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — Copy */}
            <div className="space-y-8">
              <div className="space-y-5">
                <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight tracking-tight">
                  <span className="gradient-text">Comprehensive</span>
                  <br />
                  <span className="text-[#dce5df]">Fund Analysis</span>
                </h1>
                <div className="h-1 w-20 bg-gradient-to-r from-[#44f593] to-[#00d87a] rounded-full" />
                <p className="text-base md:text-lg text-[#859586] leading-relaxed max-w-xl">
                  Discover, analyze, and compare mutual funds with real-time data, comprehensive insights,
                  and professional-grade tools for informed investment decisions.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {BADGES.map(badge => (
                  <div
                    key={badge.label}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-xs font-mono text-[#44f593]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d={badge.icon} />
                    </svg>
                    {badge.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Stats card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#44f593]/10 to-[#00d87a]/10 rounded-2xl blur-2xl" />
              <div className="glass-card rounded-2xl p-8 relative">
                <div className="grid grid-cols-2 gap-6">
                  {STATS.map(stat => (
                    <div key={stat.label} className="text-center">
                      <p className="text-3xl md:text-4xl font-display font-bold gradient-text mb-1">{stat.value}</p>
                      <p className="text-xs font-mono text-[#859586] uppercase tracking-widest">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <EditorialProse heading="How we analyse mutual funds">
          <p>
            Most fund research you read online stops at a star rating, a one-line return
            number, and a category label. That is enough to sell a product, not enough to
            choose one. Our analysis pages pull four independent data streams on every
            scheme we cover and surface the metrics that actually move long-term outcomes:
            <strong> rolling returns</strong> across every overlapping 3-year and 5-year
            window in the fund&apos;s NAV history, <strong>alpha and beta</strong>{' '}
            against the benchmark the factsheet actually uses (not a convenient one we
            picked), <strong>downside capture</strong> measured during every market
            correction greater than 10%, and <strong>portfolio overlap</strong> with any
            fund you are comparing against.
          </p>
          <p>
            <strong>Returns.</strong> Trailing returns are end-date-sensitive by
            construction. A fund that beat the benchmark by 2% over 5 years might be
            behind by 0.5% over 5.25 years. Rolling returns compute the same CAGR across
            every possible window in the fund&apos;s history and report the median, 10th
            percentile (bad years), and 90th percentile (good years). The median 5-year
            rolling return is the single best proxy for what you should actually expect.
          </p>
          <p>
            <strong>Risk.</strong> Standard deviation, beta, and Sharpe are the basics.
            Downside capture and maximum drawdown are what actually matter if you are
            within 5 years of needing the money. A fund with 85% downside capture against
            the Nifty 50 TRI will lose 25% when the index loses 30%. That number, not
            the headline volatility figure, is what determines whether you panic-sell.
          </p>
          <p>
            <strong>Tax.</strong> Every fund page annotates its classification for tax
            purposes — equity (20% STCG / 12.5% LTCG above ₹1.25 lakh/year), debt
            post-April-2023 (slab rate, no LTCG concession), or equity-hybrid (taxed as
            equity despite 20–35% debt exposure). If you rebalance or harvest, you need
            to know the tax classification before the redemption, not after.
          </p>
          <p>
            <strong>Holdings.</strong> Our PDF factsheet parser ingests monthly holdings
            disclosures from eight major AMCs (HDFC, ICICI, Kotak, Edelweiss, SBI,
            Aditya Birla, Nippon, Invesco). You get the top 10 stocks, sector breakdown,
            and portfolio turnover on every covered scheme. Overlap analysis between two
            funds is one click away on the{' '}
            <a href="/compare">compare tool</a>.
          </p>
          <p>
            All numbers on this site are computed, not re-published from a third-party
            feed. When two sources disagree (the AMC factsheet shows one number, AMFI
            shows another), we flag it rather than silently pick one. This matters when
            you are trying to decide whether a fund has quietly changed its investment
            mandate.
          </p>
        </EditorialProse>

        {/* Funds Table Section */}
        <section className="pb-16 px-6 md:px-8 max-w-[1440px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight gradient-text mb-4">
              Explore Mutual Funds
            </h2>
            <p className="text-[#859586] text-base max-w-2xl mx-auto">
              Browse our comprehensive database with real-time NAV data, detailed categorization, and advanced filtering.
            </p>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <EnhancedFundsTable />
          </div>
        </section>

        {/* CTA Section */}
        <section className="pb-20 px-6 md:px-8 max-w-[1440px] mx-auto">
          <div className="glass-card rounded-2xl p-10 text-center border-[#44f593]/15 bg-[#44f593]/3">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-[#dce5df] mb-4">
              Ready to Start Your Investment Journey?
            </h2>
            <p className="text-[#859586] text-base max-w-2xl mx-auto mb-8">
              Get personalized fund recommendations based on your investment goals and risk profile.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/funds/advanced-search"
                className="px-8 py-3.5 bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] rounded-xl font-bold text-sm hover:scale-[1.01] transition-transform"
              >
                Start Analysis
              </a>
              <a
                href="/goal-planning"
                className="px-8 py-3.5 rounded-xl border border-[#44f593]/30 text-[#44f593] text-sm font-semibold hover:bg-[#44f593]/5 transition-colors"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
};

export default AnalysisPage;
