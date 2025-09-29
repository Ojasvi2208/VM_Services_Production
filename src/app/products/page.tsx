'use client';

import { useState } from 'react';
import Link from 'next/link';
import Section from '@/components/Section';
import ComplianceNotice from '@/components/ComplianceNotice';
import ResponsiveContainer from '@/components/ResponsiveContainer';

// Tab component for product selection
const Tab = ({ 
  label, 
  active, 
  onClick 
}: { 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) => {
  return (
    <button
      className={`px-6 py-3 font-medium rounded-t-lg transform transition-all duration-200 ${
        active 
          ? 'bg-gradient-to-r from-brand-royal to-brand-navy text-white shadow-lg scale-105' 
          : 'bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 hover:scale-105'
      }`}
      onClick={onClick}
    >
      <span className="flex items-center">
        {label}
        {active && <div className="ml-2 w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>}
      </span>
    </button>
  );
};

// Product Tab Content
const TabContent = ({ 
  title, 
  description, 
  features, 
  ctaText, 
  ctaLink 
}: {
  title: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
}) => {
  return (
    <div className="p-6 sm:p-8 bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 rounded-b-lg rounded-tr-lg shadow-lg animate-fadeInUp">
      <div className="flex items-center mb-4">
        <div className="w-3 h-3 bg-brand-gold rounded-full animate-pulse mr-3"></div>
        <h3 className="text-2xl font-bold text-brand-navy">{title}</h3>
      </div>
      <p className="text-brand-navy/80 mb-6 leading-relaxed">{description}</p>
      
      <div className="mb-8">
        <h4 className="font-semibold mb-4 text-brand-navy flex items-center">
          <div className="w-2 h-2 bg-brand-royal rounded-full mr-3 animate-pulse"></div>
          Key Features:
        </h4>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start animate-slideInFromLeft" style={{ animationDelay: `${200 + index * 100}ms` }}>
              <div className="w-1.5 h-1.5 bg-brand-gold rounded-full mr-3 mt-2 flex-shrink-0 animate-pulse"></div>
              <span className="text-brand-navy/70 leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <Link 
        href={ctaLink}
        className="bg-gradient-to-r from-brand-royal to-brand-navy text-white px-8 py-4 rounded-lg font-semibold hover:from-brand-navy hover:to-brand-royal transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl inline-flex items-center"
      >
        {ctaText}
        <div className="ml-3 w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
      </Link>
    </div>
  );
};

// Side Panel Component
const SidePanel = () => {
  return (
    <div className="bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 p-6 rounded-lg shadow-lg h-full animate-fadeInUp animation-delay-600">
      <div className="mb-8">
        <div className="flex items-center mb-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3"></div>
          <h3 className="text-lg font-bold text-brand-navy">KYC & Risk Profiling</h3>
        </div>
        <p className="text-brand-navy/70 text-sm mb-4 leading-relaxed">
          Complete these essential steps on our <span className="text-brand-gold font-medium">partner platforms</span> before investing.
        </p>
        <Link href="/partners" className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg font-medium hover:from-green-600 hover:to-green-700 transform hover:scale-105 transition-all duration-200 text-sm inline-flex items-center">
          Proceed to Partner Platforms
          <div className="ml-2 w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
        </Link>
      </div>
      
      <div>
        <div className="flex items-center mb-4">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-3"></div>
          <h3 className="text-lg font-bold text-brand-navy">Key Risks</h3>
        </div>
        <ul className="space-y-4">
          <li className="flex items-start animate-slideInFromLeft animation-delay-700">
            <span className="h-6 w-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center mr-3 mt-0.5 text-xs font-bold flex-shrink-0">!</span>
            <span className="text-sm text-brand-navy/70 leading-relaxed">
              <span className="font-semibold text-brand-navy">Market Volatility:</span> Equity investments fluctuate based on market conditions
            </span>
          </li>
          <li className="flex items-start animate-slideInFromLeft animation-delay-800">
            <span className="h-6 w-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center mr-3 mt-0.5 text-xs font-bold flex-shrink-0">!</span>
            <span className="text-sm text-brand-navy/70 leading-relaxed">
              <span className="font-semibold text-brand-navy">Credit Risk:</span> Bond investments depend on issuer&apos;s ability to pay interest/principal
            </span>
          </li>
          <li className="flex items-start animate-slideInFromLeft animation-delay-900">
            <span className="h-6 w-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center mr-3 mt-0.5 text-xs font-bold flex-shrink-0">!</span>
            <span className="text-sm text-brand-navy/70 leading-relaxed">
              <span className="font-semibold text-brand-navy">Interest Rate Risk:</span> Bond prices generally fall when interest rates rise
            </span>
          </li>
          <li className="flex items-start animate-slideInFromLeft animation-delay-1000">
            <span className="h-6 w-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center mr-3 mt-0.5 text-xs font-bold flex-shrink-0">!</span>
            <span className="text-sm text-charcoal/70">
              <span className="font-medium text-charcoal">Liquidity Risk:</span> Ability to sell investments quickly may be limited in certain market conditions
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState('mutual-funds');
  
  // Product data
  const products = {
    'mutual-funds': {
      title: 'Mutual Funds',
      description: 'Explore mutual funds based on your investment objectives and risk profile. From large cap to ELSS, find options that align with your goals.',
      features: [
        'Professionally managed portfolio of stocks and bonds',
        'Options for growth, income, or tax savings (ELSS)',
        'Regular or lump sum investment options',
        'Variety of risk profiles from conservative to aggressive',
        'Systematic investment plans (SIPs) for disciplined investing'
      ],
      ctaText: 'Explore & Invest via Partner',
      ctaLink: '/partners'
    },
    'etfs': {
      title: 'Exchange Traded Funds (ETFs)',
      description: 'Low-cost market trackers that offer exposure to indices with the liquidity of stocks, subject to market conditions.',
      features: [
        'Lower expense ratios compared to actively managed funds',
        'Trade throughout the day like stocks',
        'Track specific indices like Nifty, Sensex, or gold',
        'Diversification across multiple securities',
        'Transparent holdings and pricing'
      ],
      ctaText: 'See ETFs on Partner Platform',
      ctaLink: '/partners'
    },
    'debt-funds': {
      title: 'Debt Funds',
      description: 'Fixed income securities with options across short, medium, and long duration to match your risk profile and time horizon.',
      features: [
        'Generally lower volatility than equity funds',
        'Regular income potential through dividend options',
        'Options for different time horizons (overnight to long-term)',
        'Tax-efficient compared to bank fixed deposits',
        'Liquidity options for emergency funds'
      ],
      ctaText: 'Explore Debt Options via Partner',
      ctaLink: '/partners'
    },
    'nps': {
      title: 'National Pension System (NPS)',
      description: 'Long-term retirement corpus builder regulated by PFRDA, offering tax benefits and structured retirement planning.',
      features: [
        'Tax benefits under Section 80C and additional deduction under 80CCD(1B)',
        'Choice of fund managers and asset allocation',
        'Low-cost retirement savings vehicle',
        'Option to invest in equity, corporate bonds, and government securities',
        'Partial withdrawal options for specific needs'
      ],
      ctaText: 'Proceed to NPS on Partner',
      ctaLink: '/partners'
    },
  };
  
  return (
    <>
      <div className="pt-24"></div> {/* Spacer for absolute header */}
      <Section background="mist" padding="small">
        <div className="text-center text-charcoal/80 text-sm px-4 py-2 rounded-md">
          <strong>Important:</strong> Product information below is educational. No guaranteed returns. Past performance is not indicative of future results.
        </div>
      </Section>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="text-center mb-12 animate-fadeInUp animation-delay-100">
            <h1 className="text-4xl md:text-5xl font-bold text-brand-navy mb-6">
              Our <span className="bg-gradient-to-r from-brand-gold to-yellow-400 bg-clip-text text-transparent animate-shimmer">Products</span>
            </h1>
            <p className="text-lg text-brand-navy/80 max-w-4xl mx-auto leading-relaxed">
              Explore professionally managed <span className="text-brand-gold font-semibold">investment solutions</span> designed to help you achieve your <span className="text-brand-royal font-semibold">financial goals</span>.
            </p>
            <div className="flex items-center justify-center mt-4 space-x-2">
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-brand-royal rounded-full animate-pulse animation-delay-200"></div>
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse animation-delay-300"></div>
            </div>
          </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Main content - tabs and product info */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1 mb-1 overflow-x-auto pb-1">
              <Tab 
                label="Mutual Funds" 
                active={activeTab === 'mutual-funds'}
                onClick={() => setActiveTab('mutual-funds')} 
              />
              <Tab 
                label="ETFs" 
                active={activeTab === 'etfs'}
                onClick={() => setActiveTab('etfs')} 
              />
              <Tab 
                label="Debt Funds" 
                active={activeTab === 'debt-funds'}
                onClick={() => setActiveTab('debt-funds')} 
              />
              <Tab 
                label="NPS" 
                active={activeTab === 'nps'}
                onClick={() => setActiveTab('nps')} 
              />
            </div>
            
            {/* Tab content */}
            <TabContent {...products[activeTab as keyof typeof products]} />
          </div>
          
          {/* Side panel */}
          <div className="lg:col-span-1 order-1 lg:order-2 mb-6 lg:mb-0">
            <SidePanel />
          </div>
        </div>
        
        {/* Bottom disclaimer */}
        <div className="mt-12 py-4 border-t border-mist">
          <ComplianceNotice type="prominent" />
        </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
