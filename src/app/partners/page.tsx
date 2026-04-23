'use client';

import { useState } from 'react';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';
import PartnerRedirectModal from '@/components/PartnerRedirectModal';
import { EditorialProse } from '@/components/EditorialProse';

type Partner = {
  id: string;
  name: string;
  description: string;
  redirectUrl: string;
  partnerCode?: string;
  features: string[];
  category: 'primary' | 'secondary';
};

const partners: Partner[] = [
  {
    id: 'sbi',
    name: 'SBI Mutual Fund',
    description: "One of India's largest asset managers with a wide range of funds across equity, debt, and hybrid categories.",
    redirectUrl: 'https://www.sbimf.com',
    partnerCode: 'VMFS001',
    features: [
      'Direct and regular plans available',
      '100+ schemes across categories',
      'Paperless eKYC process',
      'SIP, lumpsum, and trigger-based investments',
    ],
    category: 'primary',
  },
  {
    id: 'njwealth',
    name: 'NJ Wealth',
    description: 'A comprehensive platform offering mutual funds, stocks, bonds, and insurance products with detailed research.',
    redirectUrl: 'https://www.njindiaonline.in/',
    partnerCode: '',
    features: [
      'Basket of recommended funds',
      'Goals-based investing options',
      'Advanced reporting and tracking',
      'Multi-asset investment platform',
    ],
    category: 'primary',
  },
  {
    id: 'canararobeco',
    name: 'Canara Robeco',
    description: 'Joint venture between Canara Bank and Robeco offering well-managed equity and debt schemes.',
    redirectUrl: 'https://www.canararobeco.com',
    partnerCode: 'VMFS003',
    features: [
      'Award-winning fund management',
      'Focus on consistent performance',
      'Low-cost index funds available',
      'Special retirement solutions',
    ],
    category: 'primary',
  },
];

function PartnerCard({ partner, onSelect }: { partner: Partner; onSelect: (p: Partner) => void }) {
  return (
    <div className="glass-card rounded-2xl p-6 hover:border-[#44f593]/20 transition-all flex flex-col">
      {/* Logo placeholder */}
      <div className="h-10 mb-5 flex items-center">
        <div className="bg-[#44f593]/8 border border-[#44f593]/15 rounded-lg px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#44f593] animate-pulse" />
          <span className="text-xs font-mono text-[#44f593]">{partner.name}</span>
        </div>
      </div>

      <h3 className="text-base font-display font-bold text-[#dce5df] mb-2">{partner.name}</h3>
      <p className="text-sm text-[#859586] leading-relaxed mb-5">{partner.description}</p>

      <div className="mb-6 flex-1">
        <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-3">Features</p>
        <ul className="space-y-2">
          {partner.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-[#c0c9c2]">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2.5" className="flex-shrink-0 mt-0.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => onSelect(partner)}
        className="w-full py-3 bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] rounded-xl font-bold text-sm hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
      >
        Visit Platform
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </button>
    </div>
  );
}

export default function PartnersPage() {
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSelect = (partner: Partner) => {
    setSelectedPartner(partner);
    setModalOpen(true);
  };

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      {selectedPartner && (
        <PartnerRedirectModal
          isOpen={modalOpen}
          closeModal={() => setModalOpen(false)}
          partnerName={selectedPartner.name}
          partnerUrl={selectedPartner.redirectUrl}
          partnerCode={selectedPartner.partnerCode}
        />
      )}

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        <header className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Our Partners
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            We partner with AMFI-registered platforms to deliver institutional-grade mutual fund investing for every Indian family.
          </p>
        </header>

        {/* Partners Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {partners.map(p => (
            <PartnerCard key={p.id} partner={p} onSelect={handleSelect} />
          ))}
        </div>

        {/* Compliance */}
        <div className="glass-card rounded-2xl p-6 max-w-2xl mx-auto border-[#44f593]/15 bg-[#44f593]/3 text-center">
          <p className="text-xs text-[#859586] leading-relaxed">
            Vijay Malik Financial Services acts as an AMFI-registered Mutual Fund Distributor (ARN-317605). When you click a partner link, you will be redirected to their platform where the actual investment transaction occurs. We may receive trail commissions from AMCs. Mutual fund investments are subject to market risks.
          </p>
        </div>

        <ComplianceDisclaimer variant="general" className="mt-8" />

        <EditorialProse heading="How we select execution partners">
          <p>
            We list partners here only if they meet four criteria: SEBI or RBI regulatory
            registration, a track record of at least five years of continuous operation
            in Indian markets, a public grievance-redressal mechanism, and zero involvement
            in the editorial or analytical content on this site. We do not accept paid
            placements. If a partner wants to be featured more prominently than another,
            the answer is that we do not sell that.
          </p>
          <p>
            <strong>What we earn.</strong> When you open an account or place a transaction
            through a partner link, some partners pay us a one-time referral fee or an
            ongoing trail commission. These amounts are typically a fraction of a percent
            of assets placed through them, and are fully disclosed on our{' '}
            <a href="/disclosures" className="text-[#44f593] underline">
              Disclosures
            </a>{' '}
            page. We mention it here because the transparency matters: you should assume
            that any partner link on the internet has some economic relationship behind
            it, and ours is no exception. What is unusual about our arrangement is that
            the commission does not influence which partner appears higher in the list or
            whether we recommend them at all. The order is alphabetical.
          </p>
          <p>
            <strong>Editorial independence.</strong> The research on fund pages, blog
            posts, and calculators is not funded by partners. Fund rankings, alpha
            calculations, and category recommendations are done using the same numerical
            methodology regardless of whether a partner&apos;s platform is the cheapest
            way to buy the recommended fund. If we flag a fund house as underperforming,
            it applies whether or not a partner lists its funds. This is the only way
            financial research can be trustworthy over a long time horizon.
          </p>
          <p>
            <strong>What partners are for.</strong> Execution. If you decide based on our
            research that you want to invest in a specific Direct-plan scheme, a partner
            is a reasonable path to place the order — many of them offer free
            Direct-plan investing with no commission. For Regular plans, you can transact
            through us directly; we are registered to handle that under ARN-317605.
          </p>
          <p>
            Before using any partner, verify their SEBI or RBI registration on the
            regulator&apos;s public register. Do not take our word for it — do not take
            anyone&apos;s word for it online without cross-checking. The partner links
            here will take you to the partner&apos;s platform where you complete KYC,
            verify identity, and execute transactions under their regulated framework,
            not ours.
          </p>
        </EditorialProse>
      </main>

      <SiteFooter />
    </div>
  );
}
