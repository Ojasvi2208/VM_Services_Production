import type { Metadata } from 'next';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import { blogPosts } from '../../blog/[slug]/blog-posts';

export const metadata: Metadata = {
  title: 'Ojasvi Malik — Founder & Mutual Fund Distributor (ARN-317605)',
  description:
    'Ojasvi Malik is the founder of Vijay Malik Financial Services, an AMFI-registered Mutual Fund Distributor (ARN-317605). NISM-VA certified. 8+ years of investing research and fintech engineering experience.',
  alternates: { canonical: 'https://www.vmfinancialservices.com/author/ojasvi-malik' },
  openGraph: {
    title: 'Ojasvi Malik — AMFI-registered MFD, ARN-317605',
    description:
      'Founder of Vijay Malik Financial Services. Writes on mutual fund tax planning, portfolio strategy, and retail-investor behaviour.',
    url: 'https://www.vmfinancialservices.com/author/ojasvi-malik',
    type: 'profile',
  },
};

export const dynamic = 'force-static';
export const revalidate = 86400;

export default function AuthorPage() {
  const authorPosts = Object.values(blogPosts).filter(
    (p) => p.author === 'Ojasvi Malik' || p.author === 'Vijay Malik',
  );

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Ojasvi Malik',
    jobTitle: 'Founder & Mutual Fund Distributor',
    url: 'https://www.vmfinancialservices.com/author/ojasvi-malik',
    worksFor: {
      '@type': 'FinancialService',
      name: 'Vijay Malik Financial Services',
      url: 'https://www.vmfinancialservices.com',
      identifier: 'AMFI ARN-317605',
    },
    knowsAbout: [
      'Mutual Funds',
      'Systematic Investment Plans',
      'Indian Tax Planning',
      'Portfolio Construction',
      'Retirement Planning',
      'NPS',
      'Capital Gains Tax',
    ],
    sameAs: ['https://www.vmfinancialservices.com/about'],
  };

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-4xl mx-auto flex-1 w-full">
        <div className="flex items-center gap-5 mb-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#44f593]/20 to-[#00d87a]/10 border border-[#44f593]/30 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl font-display font-bold text-[#44f593]">OM</span>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-[#dce5df] mb-1 leading-tight">
              Ojasvi Malik
            </h1>
            <p className="text-sm text-[#859586] font-mono">
              Founder · AMFI ARN-317605 · NISM-VA Certified
            </p>
          </div>
        </div>

        <div className="space-y-6 text-[#c0c9c2] text-base leading-relaxed mb-12">
          <p>
            I&apos;m Ojasvi Malik, the founder and proprietor of Vijay Malik Financial
            Services. The firm is a sole proprietorship named in memory of my father,
            Vijay Malik, whose own approach to investing — favour costs you can control,
            distrust stories you cannot verify, never confuse a bull market with skill —
            is the editorial bias running through everything we publish here.
          </p>

          <p>
            I am registered with the Association of Mutual Funds in India (AMFI) under
            distributor number <strong className="text-[#dce5df]">ARN-317605</strong>, and
            hold the NISM-Series-V-A Mutual Fund Distributors Certification, renewed every
            three years as required by SEBI. The firm does not hold a SEBI Investment
            Adviser license; we do not offer personalised investment advice or charge
            advisory fees. Every article on this site is educational content. Every fund
            page ends with the standard risk disclaimer. The difference between an MFD and
            an RIA matters — please read our{' '}
            <Link href="/disclosures" className="text-[#44f593] underline">
              Disclosures
            </Link>{' '}
            page before you act on any of the research here.
          </p>

          <p>
            My background is in fintech engineering. Before launching this firm I spent
            eight years building financial data pipelines, scheme-level analytics, and
            mutual fund ranking systems. The research infrastructure that powers this
            site — the nightly AMFI NAV ingestion, the PDF factsheet parser covering
            eight major AMCs, the rolling-returns and alpha-beta computation layer,
            the Monte Carlo goal-projection engine — is work I wrote and maintain
            personally. When you read a fund analysis on vmfinancialservices.com, the
            numbers come from a pipeline I audit regularly, not from a licensed third
            party that resells the same feed to twenty other apps.
          </p>

          <p>
            I write about mutual fund tax planning, portfolio construction, and the
            specific arithmetic errors I see retail investors make on CAS statements.
            The goal is decision-useful writing — numbers you can plug into your own
            situation, not generic &ldquo;start early&rdquo; platitudes. Every article
            is date-stamped and cross-checked against the current Finance Act. When
            tax law changes (as it did in July 2024 for capital gains, and again in the
            2026 Budget for the 87A rebate), I update the affected articles and add a
            revision note at the bottom.
          </p>

          <p>
            <strong className="text-[#dce5df]">How we get paid:</strong> as an MFD we earn
            trail commissions on Regular-plan mutual fund schemes held by clients who
            invest through us. We earn nothing on Direct-plan schemes, and Direct plans
            are recommended across this site when they are the right product. The full
            commission disclosure is on our{' '}
            <Link href="/disclosures" className="text-[#44f593] underline">
              Disclosures
            </Link>{' '}
            page. If that creates any conflict of interest with what you read here, the
            correct response is to cross-check any fund we mention against its AMC
            factsheet — the numbers will match.
          </p>

          <p>
            For any correspondence, grievance, or professional enquiry, the escalation
            path is on our{' '}
            <Link href="/contact" className="text-[#44f593] underline">
              Contact
            </Link>{' '}
            page. If you have a question that you think other readers would benefit from,
            email it and it may become the next blog post — credited to you or anonymous,
            your preference.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-12">
          <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-3">
            Credentials &amp; Registrations
          </p>
          <ul className="space-y-2 text-sm text-[#c0c9c2]">
            <li>
              <strong className="text-[#dce5df]">AMFI Registration:</strong> ARN-317605
              (valid, renewed triennially)
            </li>
            <li>
              <strong className="text-[#dce5df]">Certification:</strong> NISM-Series-V-A
              Mutual Fund Distributors Certification
            </li>
            <li>
              <strong className="text-[#dce5df]">Firm:</strong> Vijay Malik Financial
              Services (Sole Proprietorship)
            </li>
            <li>
              <strong className="text-[#dce5df]">Proprietor:</strong> Ojasvi Malik
            </li>
            <li>
              <strong className="text-[#dce5df]">Registered as:</strong> Mutual Fund
              Distributor only. Not a SEBI-registered Investment Adviser.
            </li>
          </ul>
        </div>

        <h2 className="text-2xl font-display font-bold text-[#dce5df] mb-6">Articles</h2>

        <div className="grid grid-cols-1 gap-4">
          {authorPosts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="glass-card rounded-xl p-5 hover:border-[#44f593]/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <span className="text-xs font-mono text-[#44f593]">{p.category}</span>
                <span className="text-xs font-mono text-[#3c4a3e]">{p.readTime}</span>
              </div>
              <p className="text-base font-semibold text-[#dce5df] group-hover:text-[#44f593] transition-colors mb-1">
                {p.title}
              </p>
              {p.excerpt && (
                <p className="text-sm text-[#859586] line-clamp-2">{p.excerpt}</p>
              )}
              <p className="text-xs text-[#3c4a3e] font-mono mt-2">{p.date}</p>
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
