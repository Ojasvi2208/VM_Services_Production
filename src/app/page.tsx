import type { Metadata } from 'next';
import Link from 'next/link';
import HeroSection from '@/components/home/HeroSection';
import MarketStrip from '@/components/home/MarketStrip';
import TopFundsSection from '@/components/home/TopFundsSection';
import NFOSection from '@/components/home/NFOSection';
import StatsBanner from '@/components/home/StatsBanner';
import EcosystemSection from '@/components/home/EcosystemSection';
import VaultIntelligence from '@/components/home/VaultIntelligence';

export const metadata: Metadata = {
  title: 'Vijay Malik Financial Services — Mutual Fund Tracking & Analytics for Indian Investors',
  description:
    'AMFI-registered Mutual Fund Distributor (ARN-317605). Research 50,000+ schemes, track NAVs and XIRR, plan goals, compare funds, and calculate LTCG tax. Built for serious Indian investors.',
  alternates: { canonical: 'https://www.vmfinancialservices.com/' },
  openGraph: {
    title: 'Vijay Malik Financial Services — Mutual Fund Tracking & Analytics',
    description:
      'Research 50,000+ mutual fund schemes with institutional-grade analytics. AMFI ARN-317605.',
    url: 'https://www.vmfinancialservices.com/',
    siteName: 'Vijay Malik Financial Services',
    type: 'website',
  },
};

export const dynamic = 'force-static';
export const revalidate = 3600;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0b0f17] text-neutral-100">
      <HeroSection />
      <MarketStrip />

      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Research before you invest. Analytics after you do.
        </h2>
        <div className="prose prose-invert mt-8 max-w-none text-[1.05rem] leading-relaxed text-neutral-300">
          <p>
            Indian retail investors now have access to more mutual fund schemes than the
            United States, the UK, and Australia combined — over 50,000 when you count
            every Direct, Regular, Growth, and IDCW variant listed on AMFI. That scale is
            both the opportunity and the problem. The opportunity: real choice. The
            problem: pricing, factsheet quality, and historical performance data live in a
            dozen fragmented PDFs, CSVs, and scraped tables that few investors have time
            to reconcile. We built Vijay Malik Financial Services to consolidate that data
            into one research surface, and to keep it current with the same ingestion
            cadence a large AMC uses internally.
          </p>
          <p>
            Every fund page on this site draws from four independent data sources: the
            AMFI NAV feed (21:30 IST daily), the fund house&apos;s own monthly factsheet
            (parsed with a strategy-pattern PDF engine), stock-level holdings from
            disclosures, and index benchmark data used to compute rolling alpha and beta.
            When the numbers disagree — and sometimes they do — we flag it rather than
            silently picking one. This matters when you are deciding whether to keep
            contributing to a scheme that has quietly changed mandate, or whether a
            &ldquo;5-star&rdquo; rating from a rating agency is based on the same universe
            as its three peers.
          </p>
        </div>
      </section>

      <TopFundsSection />

      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          What the analytics do
        </h2>
        <div className="prose prose-invert mt-8 max-w-none text-[1.05rem] leading-relaxed text-neutral-300">
          <p>
            <strong>Returns that match reality.</strong> Point-to-point returns flatter a
            fund when the end-date happens to be a good week. We compute rolling 3-year
            and 5-year returns across every overlapping window in a fund&apos;s history,
            then report the median, the 10th percentile (the bad years), and the 90th
            percentile (the good years). A fund&apos;s median 5-year rolling return is a
            better proxy for what you should expect than any single trailing number.
          </p>
          <p>
            <strong>Risk that you can act on.</strong> Standard deviation tells you the
            fund is volatile. Downside capture tells you how much of the index&apos;s
            loss it actually absorbs when the market corrects. Maximum drawdown tells you
            the worst peak-to-trough period you would have lived through. Sortino ratio
            penalises only the downside volatility — which is the only volatility that
            actually matters when you are withdrawing via SWP in retirement.
          </p>
          <p>
            <strong>Tax that matches the Act.</strong> The LTCG calculator applies the
            current ₹1.25 lakh threshold on equity mutual funds and the 12.5% rate for
            gains above it (post-2024 Budget). For debt funds acquired after 1 April
            2023, every rupee of gain is treated as slab-rate ordinary income — the old
            indexation benefit is gone. We annotate every portfolio row with its correct
            tax treatment so you do not confuse an equity-hybrid fund (taxed as equity)
            with an aggressive-hybrid fund taxed at slab rates.
          </p>
          <p>
            <strong>Goal math that does not lie.</strong> We run 10,000-path Monte Carlo
            simulations using Geometric Brownian Motion on each goal&apos;s asset
            allocation, then report the probability your current SIP reaches the target
            — not a single deterministic projection that assumes a constant 12% return.
          </p>
        </div>
      </section>

      <NFOSection />
      <StatsBanner />

      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Who builds this, and how we get paid
        </h2>
        <div className="prose prose-invert mt-8 max-w-none text-[1.05rem] leading-relaxed text-neutral-300">
          <p>
            Vijay Malik Financial Services is a sole proprietorship owned by Ojasvi
            Malik, an AMFI-registered Mutual Fund Distributor (
            <strong>ARN-317605</strong>). The firm is named in memory of Ojasvi&apos;s
            father, Vijay Malik, whose own investing discipline is the editorial bias
            you&apos;ll recognise across every calculator and fund page: favour costs you
            can control, distrust stories you cannot verify, and never confuse a bull
            market with skill.
          </p>
          <p>
            As an MFD, we earn trail commissions on Regular plan schemes held by our
            clients, disclosed in full on our{' '}
            <Link href="/disclosures" className="text-emerald-400 underline">
              Disclosures page
            </Link>
            . We do not earn anything on Direct plan schemes — yet Direct plans are
            prominently featured throughout this site, because we think the right product
            for a self-directed investor is the one they actually chose, not the one that
            pays us. The firm is not a SEBI-registered Investment Adviser; we do not give
            personalised investment advice or receive any advisory fee. Every fund page
            ends with the same reminder: mutual fund investments are subject to market
            risks, and past performance is never a guarantee of future returns.
          </p>
          <p>
            If you have a grievance, the escalation path is on our{' '}
            <Link href="/contact" className="text-emerald-400 underline">
              Contact page
            </Link>{' '}
            — distributor first, then AMC, then AMFI, then SEBI SCORES. That path is
            prescribed by regulation, not by us.
          </p>
        </div>
      </section>

      <EcosystemSection />
      <VaultIntelligence />
    </main>
  );
}
