'use client';

import { useState } from 'react';
import Image from 'next/image';
import PartnerRedirectModal from '@/components/PartnerRedirectModal';

// Partner data type
type Partner = {
  id: string;
  name: string;
  logo: string;
  description: string;
  redirectUrl: string;
  partnerCode?: string;
  features: string[];
  category: 'primary' | 'secondary';
};

// Partner card component
const PartnerCard = ({ 
  partner, 
  onSelect 
}: { 
  partner: Partner; 
  onSelect: (partner: Partner) => void;
}) => {
  return (
    <div className="bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 rounded-lg p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] animate-fadeInUp border border-brand-gold/10">
      <div className="h-12 mb-4 flex items-center">
        {/* Using a placeholder for now - would be replaced with actual logo */}
        <div className="bg-gradient-to-r from-brand-royal/10 to-brand-gold/10 rounded-md h-10 w-32 flex items-center justify-center text-brand-navy/60 text-sm font-medium shadow-inner">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-brand-gold rounded-full mr-2 animate-pulse"></div>
            {partner.name} Logo
          </div>
        </div>
      </div>
      
      <div className="flex items-center mb-3">
        <div className="w-2 h-2 bg-brand-royal rounded-full mr-3 animate-pulse"></div>
        <h3 className="text-lg font-bold text-brand-navy">{partner.name}</h3>
      </div>
      
      <p className="text-brand-navy/70 text-sm mb-6 leading-relaxed">
        {partner.description}
      </p>
      
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-brand-navy mb-3 flex items-center">
          <div className="w-1.5 h-1.5 bg-brand-gold rounded-full mr-2 animate-pulse"></div>
          Features:
        </h4>
        <ul className="text-sm text-brand-navy/70 space-y-2">
          {partner.features.map((feature, index) => (
            <li key={index} className="flex items-start animate-slideInFromLeft" style={{ animationDelay: `${200 + index * 50}ms` }}>
              <span className="text-green-600 mr-2 font-bold text-xs">✓</span>
              <span className="leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <button
        onClick={() => onSelect(partner)}
        className="w-full py-3 px-6 bg-gradient-to-r from-brand-royal to-brand-navy text-white rounded-lg font-semibold hover:from-brand-navy hover:to-brand-royal transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center"
      >
        <span>Redirect to Platform</span>
        <div className="ml-3 w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
      </button>
    </div>
  );
};

// Filter component
const PartnerFilter = ({ 
  activeFilter, 
  setActiveFilter 
}: { 
  activeFilter: string; 
  setActiveFilter: (filter: string) => void;
}) => {
  const filters = [
    { id: 'all', label: 'All Partners' },
    { id: 'direct', label: 'Direct Mutual Funds' },
    { id: 'regular', label: 'Regular Mutual Funds' },
    { id: 'nps', label: 'NPS' },
  ];
  
  return (
    <div className="flex flex-wrap gap-3 mb-8 justify-center animate-fadeInUp animation-delay-300">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => setActiveFilter(filter.id)}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transform transition-all duration-200 ${
            activeFilter === filter.id
              ? 'bg-gradient-to-r from-brand-royal to-brand-navy text-white shadow-lg scale-105'
              : 'bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 hover:scale-105'
          }`}
        >
          <span className="flex items-center">
            {filter.label}
            {activeFilter === filter.id && <div className="ml-2 w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>}
          </span>
          {filter.label}
        </button>
      ))}
    </div>
  );
};

export default function PartnersPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Partner data
  const partners: Partner[] = [
    {
      id: 'sbi',
      name: 'SBI Mutual Fund',
      logo: '/sbi-mf-logo.svg',
      description: 'One of India\'s largest asset managers with a wide range of funds across equity, debt, and hybrid categories.',
      redirectUrl: 'https://www.sbimf.com',
      partnerCode: 'VMFS001',
      features: [
        'Direct and regular plans available',
        '100+ schemes across categories',
        'Paperless eKYC process',
        'SIP, lumpsum, and trigger-based investments'
      ],
      category: 'primary'
    },
    {
      id: 'njwealth',
      name: 'NJ Wealth',
      logo: '/nj-logo.svg',
      description: 'A comprehensive platform offering mutual funds, stocks, bonds, and insurance products with detailed research.',
      redirectUrl: '/api/redirect?url=https://www.njindiaonline.com/etada/partintiate.fin?cmdAction=showMenu&njBrcode=14688',
      partnerCode: '',
      features: [
        'Basket of recommended funds',
        'Goals-based investing options',
        'Advanced reporting and tracking',
        'Multi-asset investment platform'
      ],
      category: 'primary'
    },
    {
      id: 'canararobeco',
      name: 'Canara Robeco',
      logo: '/canara-logo.svg',
      description: 'Joint venture between Canara Bank and Robeco offering well-managed equity and debt schemes.',
      redirectUrl: 'https://www.canararobeco.com',
      partnerCode: 'VMFS003',
      features: [
        'Award-winning fund management',
        'Focus on consistent performance',
        'Low-cost index funds available',
        'Special retirement solutions'
      ],
      category: 'primary'
    },
    {
      id: 'utimf',
      name: 'Kotak Mutual Fund',
      logo: '/uti-logo.svg',
      description: 'One of India\'s oldest and most trusted fund houses with decades of experience in fund management.',
      redirectUrl: 'https://www.utimf.com',
      partnerCode: 'VMFS004',
      features: [
        'Pioneer in Indian mutual funds',
        'Strong debt fund offerings',
        'Retirement and children\'s future plans',
        'Dividend yield and value funds'
      ],
      category: 'secondary'
    },
    {
      id: 'icici',
      name: 'ICICI Prudential',
      logo: '/icici-logo.svg',
      description: 'A leading fund house with innovative products and strong risk management practices.',
      redirectUrl: 'https://www.icicipruamc.com',
      partnerCode: 'VMFS005',
      features: [
        'Well-diversified fund offerings',
        'Multi-cap and focused equity funds',
        'Smart beta and factor-based funds',
        'Easy SIP modification options'
      ],
      category: 'secondary'
    }
    
  ];
  
  // Filter partners based on active filter
  const filteredPartners = partners.filter(partner => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'nps') return partner.id === 'nps';
    if (activeFilter === 'direct') return partner.id !== 'nps';
    if (activeFilter === 'regular') return partner.id !== 'nps';
    return true;
  });
  
  // Handle partner selection
  const handlePartnerSelect = (partner: Partner) => {
    setSelectedPartner(partner);
    setModalOpen(true);
  };
  
  return (
    <>
      <div className="pt-24"></div> {/* Spacer for absolute header */}
      {/* Partner redirect modal */}
      {selectedPartner && (
        <PartnerRedirectModal
          isOpen={modalOpen}
          closeModal={() => setModalOpen(false)}
          partnerName={selectedPartner.name}
          partnerUrl={selectedPartner.redirectUrl}
          partnerCode={selectedPartner.partnerCode}
        />
      )}
      
      <section className="py-12">
        <div className="container-padding">
          <div className="text-center mb-12 animate-fadeInUp animation-delay-100">
            <h1 className="text-4xl md:text-5xl font-bold text-brand-navy mb-6">
              Our <span className="bg-gradient-to-r from-brand-gold to-yellow-400 bg-clip-text text-transparent animate-shimmer">Partners</span>
            </h1>
            <p className="text-lg text-brand-navy/80 max-w-4xl mx-auto leading-relaxed">
              We&apos;ve partnered with leading <span className="text-brand-gold font-semibold">financial institutions</span> to provide you with a wide range of investment options. Select a partner below to be redirected to their platform for <span className="text-brand-royal font-semibold">transactions</span>.
            </p>
            <div className="flex items-center justify-center mt-4 space-x-2">
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-brand-royal rounded-full animate-pulse animation-delay-200"></div>
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse animation-delay-300"></div>
            </div>
          </div>
          
          {/* Filter */}
          <PartnerFilter activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
          
          {/* Partners grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPartners.map(partner => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onSelect={handlePartnerSelect}
              />
            ))}
          </div>
          
          {/* Compliance section */}
          <div className="mt-12 bg-mist/50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-charcoal mb-4">Important Information</h2>
            
            <div className="space-y-4 text-sm text-charcoal/80">
              <p>
                <span className="font-medium">Mutual Fund Distributor:</span> Vijay Malik Financial Services (ARN-317605) acts as a Mutual Fund Distributor (MFD) registered with AMFI. We distribute regular plans of mutual funds.
              </p>
              
              <p>
                <span className="font-medium">Commissions:</span> We receive commissions from fund houses for distributions, which are built into the expense ratio of regular plans. Direct plans have lower expense ratios as they don't include distributor commissions.
              </p>
              
              <p>
                <span className="font-medium">Direct vs. Regular:</span> While we primarily facilitate regular plan investments, we educate clients about both options. You can choose either based on your preference for advice and service.
              </p>
              
              <p>
                <span className="font-medium">Risk Disclosure:</span> Mutual Fund investments are subject to market risks. Read all scheme related documents carefully before investing. Past performance is not indicative of future returns.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
