import AdvancedSIPCalculator from '@/components/AdvancedSIPCalculator';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import ComplianceNotice from '@/components/ComplianceNotice';

export const metadata = {
  title: 'Advanced SIP Calculator | Vijay Malik Financial Services',
  description: 'Calculate your SIP returns with step-up options, inflation adjustment, and detailed projections',
};

export default function SIPCalculatorPage() {
  return (
    <>
      <div className="pt-24"></div>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <AdvancedSIPCalculator />
          
          <div className="mt-12">
            <ComplianceNotice type="standard" />
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
