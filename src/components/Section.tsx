import React from 'react';
import ResponsiveContainer from './ResponsiveContainer';
import ComplianceNotice from './ComplianceNotice';

type SectionProps = {
  children: React.ReactNode;
  className?: string;
  background?: 'white' | 'offwhite' | 'teal' | 'mist';
  padding?: 'none' | 'small' | 'medium' | 'large';
  containerMaxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showComplianceNotice?: boolean;
  complianceType?: 'standard' | 'minimal' | 'prominent';
  id?: string;
};

export default function Section({
  children,
  className = '',
  background = 'white',
  padding = 'medium',
  containerMaxWidth = 'xl',
  showComplianceNotice = false,
  complianceType = 'standard',
  id
}: SectionProps) {
  
  const backgroundClasses = {
    white: 'bg-white',
    offwhite: 'bg-offwhite',
    teal: 'bg-teal text-white',
    mist: 'bg-mist'
  };
  
  const paddingClasses = {
    none: '',
    small: 'py-6 md:py-8',
    medium: 'py-10 md:py-12',
    large: 'py-14 md:py-20'
  };
  
  return (
    <section 
      id={id}
      className={`
        ${backgroundClasses[background]}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      <ResponsiveContainer maxWidth={containerMaxWidth}>
        {children}
        
        {showComplianceNotice && (
          <div className={`${background === 'white' ? 'mt-8' : 'mt-8 bg-white p-4 rounded-md'}`}>
            <ComplianceNotice type={complianceType} />
          </div>
        )}
      </ResponsiveContainer>
    </section>
  );
}
