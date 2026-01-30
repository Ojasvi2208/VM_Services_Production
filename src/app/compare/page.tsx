import FundComparison from '@/components/FundComparison';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import ComplianceNotice from '@/components/ComplianceNotice';

export const metadata = {
  title: 'Fund Comparison Tool | Vijay Malik Financial Services',
  description: 'Compare mutual funds side by side with interactive charts and detailed performance metrics',
};

export default function ComparePage() {
  return (
    <>
      <div className="pt-24"></div>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <FundComparison />
          
          <div className="mt-12">
            <ComplianceNotice type="standard" />
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
