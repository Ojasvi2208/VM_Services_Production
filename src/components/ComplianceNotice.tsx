import React from 'react';

type ComplianceNoticeProps = {
  type?: 'standard' | 'minimal' | 'prominent';
  className?: string;
};

export default function ComplianceNotice({ type = 'standard', className = '' }: ComplianceNoticeProps) {
  switch (type) {
    case 'minimal':
      return (
        <p className={`text-sm text-brand-cloud font-medium hover:text-brand-navy transition-colors duration-300 ${className}`}>
          <span className="text-brand-gold">*</span> Mutual Fund investments are subject to market risks, read all scheme related documents carefully.
        </p>
      );
    
    case 'prominent':
      return (
        <div className={`group bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 border border-brand-gold/20 p-4 rounded-lg hover:shadow-lg transition-all duration-300 ${className}`}>
          <p className="text-brand-navy font-medium">
            <span className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></span>
              <strong className="text-brand-royal">Risk Disclosure:</strong>
            </span>
            <span className="text-brand-navy">
              Mutual Fund investments are subject to{' '}
              <span className="text-brand-gold font-semibold">market risks</span>, read all scheme related documents carefully.{' '}
              Past performance is{' '}
              <span className="text-brand-royal font-semibold underline decoration-brand-royal/50">not indicative</span>{' '}of future returns.
            </span>
          </p>
        </div>
      );
    
    // standard (default)
    default:
      return (
        <div className={`group border-t border-brand-gold/20 py-4 bg-brand-pearl/50 transition-colors duration-300 ${className}`}>
          <p className="text-brand-cloud text-sm group-hover:text-brand-navy transition-colors duration-300">
            <span className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-brand-gold rounded-full mt-2 flex-shrink-0 animate-pulse"></span>
              <span>
                <span className="font-semibold text-brand-navy">Vijay Malik Financial Services</span>{' '}is a{' '}
                <span className="text-brand-gold font-medium">AMFI Registered</span>{' '}Mutual Fund Distributor{' '}
                <span className="bg-brand-gold/10 px-1 py-0.5 rounded text-brand-navy font-mono text-xs">(ARN-317605)</span>.{' '}
                All mutual fund investments are subject to{' '}
                <span className="text-brand-royal font-medium">market risks</span>, read all scheme related documents carefully before investing.
              </span>
            </span>
          </p>
        </div>
      );
  }
}
