'use client';

import { useState } from 'react';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

const products = {
  'mutual-funds': {
    title: 'Mutual Funds',
    description: 'Explore mutual funds based on your investment objectives and risk profile. From large cap to ELSS, find options that align with your goals.',
    features: [
      'Professionally managed portfolio of stocks and bonds',
      'Options for growth, income, or tax savings (ELSS)',
      'Regular or lump sum investment options',
      'Variety of risk profiles from conservative to aggressive',
      'Systematic investment plans (SIPs) for disciplined investing',
    ],
    ctaText: 'Explore & Invest via Partner',
    ctaLink: '/partners',
  },
  'etfs': {
    title: 'Exchange Traded Funds (ETFs)',
    description: 'Low-cost market trackers that offer exposure to indices with the liquidity of stocks, subject to market conditions.',
    features: [
      'Lower expense ratios compared to actively managed funds',
      'Trade throughout the day like stocks',
      'Track specific indices like Nifty, Sensex, or gold',
      'Diversification across multiple securities',
      'Transparent holdings and pricing',
    ],
    ctaText: 'See ETFs on Partner Platform',
    ctaLink: '/partners',
  },
  'debt-funds': {
    title: 'Debt Funds',
    description: 'Fixed income securities with options across short, medium, and long duration to match your risk profile and time horizon.',
    features: [
      'Generally lower volatility than equity funds',
      'Regular income potential through dividend options',
      'Options for different time horizons (overnight to long-term)',
      'Tax-efficient compared to bank fixed deposits',
      'Liquidity options for emergency funds',
    ],
    ctaText: 'Explore Debt Options via Partner',
    ctaLink: '/partners',
  },
  'nps': {
    title: 'National Pension System (NPS)',
    description: 'Long-term retirement corpus builder regulated by PFRDA, offering tax benefits and structured retirement planning.',
    features: [
      'Tax benefits under Section 80C and additional deduction under 80CCD(1B)',
      'Choice of fund managers and asset allocation',
      'Low-cost retirement savings vehicle',
      'Option to invest in equity, corporate bonds, and government securities',
      'Partial withdrawal options for specific needs',
    ],
    ctaText: 'Proceed to NPS on Partner',
    ctaLink: '/partners',
  },
};

const TABS = [
  { key: 'mutual-funds', label: 'Mutual Funds' },
  { key: 'etfs', label: 'ETFs' },
  { key: 'debt-funds', label: 'Debt Funds' },
  { key: 'nps', label: 'NPS' },
] as const;

const RISKS = [
  {
    title: 'Market Volatility',
    desc: 'Equity investments fluctuate based on market conditions and sentiment.',
  },
  {
    title: 'Credit Risk',
    desc: "Bond investments depend on issuer's ability to pay interest and principal.",
  },
  {
    title: 'Interest Rate Risk',
    desc: 'Bond prices generally fall when interest rates rise in the economy.',
  },
  {
    title: 'Liquidity Risk',
    desc: 'Ability to sell investments quickly may be limited in certain conditions.',
  },
];

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<keyof typeof products>('mutual-funds');
  const product = products[activeTab];

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Our Products
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Professionally managed investment solutions designed to help you achieve your financial goals.
          </p>
        </header>

        {/* Disclaimer banner */}
        <div className="glass-card rounded-xl px-5 py-3 mb-8 flex items-center gap-3 max-w-3xl mx-auto border-[#ffb4ab]/20 bg-[#ffb4ab]/3">
          <svg className="w-4 h-4 text-[#ffb4ab] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" /><line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" /><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
          </svg>
          <p className="text-xs text-[#859586]">
            <strong className="text-[#ffb4ab]">Important:</strong> Product information below is educational. No guaranteed returns. Past performance is not indicative of future results.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

          {/* Left — Tabs + Product Content */}
          <div className="lg:col-span-2 order-2 lg:order-1">

            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-[#0d1512] border border-[#3c4a3e] rounded-xl mb-1 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 min-w-max px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-[#44f593]/15 text-[#44f593] border border-[#44f593]/30'
                      : 'text-[#859586] hover:text-[#dce5df]'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-[#44f593] animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="glass-card rounded-b-2xl rounded-tr-2xl p-6 md:p-8">
              <h3 className="text-xl font-display font-bold text-[#dce5df] mb-3">{product.title}</h3>
              <p className="text-sm text-[#859586] leading-relaxed mb-6">{product.description}</p>

              <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-4">Key Features</p>
              <ul className="space-y-3 mb-8">
                {product.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#c0c9c2]">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2.5" className="flex-shrink-0 mt-0.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href={product.ctaLink}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] rounded-xl font-bold text-sm hover:scale-[1.01] transition-transform"
              >
                {product.ctaText}
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right — Side Panel */}
          <div className="lg:col-span-1 order-1 lg:order-2 space-y-5">

            {/* KYC */}
            <div className="glass-card rounded-2xl p-5 border-[#44f593]/15 bg-[#44f593]/3">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#44f593] animate-pulse" />
                <h3 className="text-sm font-display font-bold text-[#dce5df]">KYC &amp; Risk Profiling</h3>
              </div>
              <p className="text-xs text-[#859586] leading-relaxed mb-4">
                Complete these essential steps on our partner platforms before investing.
              </p>
              <Link
                href="/partners"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] rounded-xl font-bold text-xs hover:scale-[1.01] transition-transform"
              >
                Proceed to Partner Platforms
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            {/* Key Risks */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#ffb4ab] animate-pulse" />
                <h3 className="text-sm font-display font-bold text-[#dce5df]">Key Risks</h3>
              </div>
              <ul className="space-y-4">
                {RISKS.map((risk, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#ffb4ab] mt-0.5">!</span>
                    <div>
                      <p className="text-xs font-semibold text-[#dce5df] mb-0.5">{risk.title}</p>
                      <p className="text-xs text-[#859586] leading-relaxed">{risk.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* Compliance */}
        <div className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-[#3c4a3e] font-mono max-w-2xl mx-auto leading-relaxed">
            Mutual fund investments are subject to market risks. Read all scheme related documents carefully. Past performance is not indicative of future results. Vijay Malik Financial Services is an AMFI-registered distributor · ARN-317605.
          </p>
        </div>

        <ComplianceDisclaimer variant="general" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
