import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import ComplianceNotice from '@/components/ComplianceNotice';

export default function DisclosuresPage() {
  return (
    <>
      <div className="pt-24"></div> {/* Spacer for absolute header */}
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="lg">
          <div className="text-center mb-12 animate-fadeInUp animation-delay-100">
            <h1 className="text-4xl md:text-5xl font-bold text-brand-navy mb-6">
              <span className="bg-gradient-to-r from-brand-gold to-yellow-400 bg-clip-text text-transparent animate-shimmer">Disclosures</span> & Grievance Handling
            </h1>
            <p className="text-lg text-brand-navy/80 max-w-4xl mx-auto leading-relaxed">
              In compliance with <span className="text-brand-royal font-semibold">SEBI</span> and <span className="text-brand-gold font-semibold">AMFI</span> regulations, we provide transparent information about our services, fees, and grievance handling procedures.
            </p>
            <div className="flex items-center justify-center mt-4 space-x-2">
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-brand-royal rounded-full animate-pulse animation-delay-200"></div>
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse animation-delay-300"></div>
            </div>
          </div>
            
            {/* MFD Status */}
            <div className="bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 p-6 rounded-lg shadow-lg mb-8 animate-fadeInUp animation-delay-300">
              <div className="flex items-center mb-4">
                <div className="w-3 h-3 bg-brand-royal rounded-full animate-pulse mr-3"></div>
                <h2 className="text-xl font-bold text-brand-navy">Mutual Fund Distributor <span className="text-brand-gold">Status</span></h2>
              </div>
              
              <div className="space-y-4 text-charcoal/80">
                <p>
                  <span className="font-medium">AMFI Registration:</span> Vijay Malik Financial Services is a registered Mutual Fund Distributor (MFD) with AMFI, holding ARN-317605. Our registration can be verified on the <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">AMFI website</a>.
                </p>
                
                <p>
                  <span className="font-medium">EUIN:</span> All client interactions are conducted by NISM-certified professionals with valid Employee Unique Identification Numbers (EUIN: E123456). EUIN details are disclosed in all transaction documents.
                </p>
                
                <p>
                  <span className="font-medium">Nature of Service:</span> As an MFD, we distribute mutual fund products and provide basic investment guidance. We are not a SEBI Registered Investment Adviser (RIA) and do not provide comprehensive financial planning or investment advisory services as defined under SEBI (Investment Advisers) Regulations.
                </p>
                
                <p>
                  <span className="font-medium">Advisory Limitations:</span> Our recommendations are restricted to mutual fund products. For holistic financial planning or advice on other financial products, we recommend consulting a SEBI-registered investment adviser or appropriate specialist.
                </p>
              </div>
            </div>
            
            {/* Commission Disclosure */}
            <div className="bg-gradient-to-br from-white via-brand-pearl to-yellow-50/30 p-6 rounded-lg shadow-lg mb-8 animate-fadeInUp animation-delay-400">
              <div className="flex items-center mb-4">
                <div className="w-3 h-3 bg-brand-gold rounded-full animate-pulse mr-3"></div>
                <h2 className="text-xl font-bold text-brand-navy">Commission <span className="text-brand-royal">Disclosure</span></h2>
              </div>
              
              <div className="space-y-4 text-charcoal/80">
                <p>
                  <span className="font-medium">Commission Structure:</span> As a mutual fund distributor, we receive commissions from Asset Management Companies (AMCs) for distributing their products. These commissions are part of the expense ratio in regular plans of mutual funds.
                </p>
                
                <p>
                  <span className="font-medium">Commission Rates:</span> Typical commissions range from 0.5% to 1.5% annually for equity funds and 0.1% to 0.7% for debt funds, based on the type of fund and AMC policies. Exact commission rates for specific schemes can be provided upon request.
                </p>
                
                <p>
                  <span className="font-medium">Conflict of Interest:</span> We acknowledge that commission structures may create potential conflicts of interest. To mitigate this, we follow a client-first approach and recommend products based on their suitability to client needs rather than commission considerations.
                </p>
                
                <p>
                  <span className="font-medium">Direct Plans:</span> We inform all clients about the availability of direct plans, which have lower expense ratios as they don't include distributor commissions. Clients are free to choose between regular and direct plans based on their preference for service and support.
                </p>
              </div>
            </div>
            
            {/* Risk Disclosure */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
              <h2 className="text-xl font-semibold text-charcoal mb-4">Risk Disclosure</h2>
              
              <div className="space-y-4 text-charcoal/80">
                <p>
                  <span className="font-medium">Market Risks:</span> Mutual fund investments are subject to market risks, and their value can fluctuate due to various factors including market conditions, economic changes, and company-specific events.
                </p>
                
                <p>
                  <span className="font-medium">No Guaranteed Returns:</span> Past performance is not indicative of future results. We do not guarantee or promise any returns on investments. All performance illustrations are for educational purposes only.
                </p>
                
                <p>
                  <span className="font-medium">Risk Assessment:</span> While we assist clients in understanding their risk profile, the final investment decision rests with the client. We recommend reading all scheme-related documents carefully before investing.
                </p>
                
                <p>
                  <span className="font-medium">Risk Mitigation:</span> We advocate diversification, goal-based investing, and regular monitoring as strategies to manage investment risks, but these do not eliminate all investment risks.
                </p>
                
                <div className="bg-brick/10 p-4 rounded-md mt-4">
                  <p className="text-brick font-medium">
                    Mutual Fund investments are subject to market risks, read all scheme related documents carefully.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Grievance Handling */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
              <h2 className="text-xl font-semibold text-charcoal mb-4">Grievance Handling Procedure</h2>
              
              <div className="space-y-4 text-charcoal/80">
                <p>
                  <span className="font-medium">First Level Resolution:</span> All grievances should first be addressed to our Client Services team via email at <a href="mailto:grievance@vmfinancialservices.com" className="text-teal hover:underline">grievance@vijaymalik.com</a> or by phone at +91 98765 43210. We aim to acknowledge all grievances within 24 hours and resolve them within 7 working days.
                </p>
                
                <p>
                  <span className="font-medium">Escalation Process:</span> If the grievance remains unresolved at the first level, clients may escalate the matter to the Partner, Ojasvi Malik, at <a href="mailto:ojasvi.malik@vmfinancialservices.com" className="text-teal hover:underline">vijay@vijaymalik.com</a>.
                </p>
                
                <p>
                  <span className="font-medium">AMFI Escalation:</span> If the grievance is not satisfactorily addressed within 30 days, clients may approach AMFI by emailing <a href="mailto:complaints@amfiindia.com" className="text-teal hover:underline">complaints@amfiindia.com</a> or through their online grievance portal.
                </p>
                
                <p>
                  <span className="font-medium">Record Maintenance:</span> We maintain records of all grievances and their resolution for a minimum period of 8 years as per regulatory requirements. A summary report is submitted to AMFI on a quarterly basis.
                </p>
                
                <div className="mt-6">
                  <h3 className="font-medium text-charcoal mb-2">Contact Information:</h3>
                  <div className="bg-mist/50 p-4 rounded-md">
                    <p><span className="font-medium">Grievance Officer:</span> Ms. Priya Sharma</p>
                    <p><span className="font-medium">Email:</span> <a href="mailto:grievance@vmfinancialservices.com" className="text-teal hover:underline">grievance@vijaymalik.com</a></p>
                    <p><span className="font-medium">Phone:</span> +91 94173 34348</p>
                    <p><span className="font-medium">Address:</span> Motia Royal City, Zirakpur, 140603</p>
                    <p><span className="font-medium">Business Hours:</span> Monday to Friday, 10:00 AM to 6:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Privacy Policy */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
              <h2 className="text-xl font-semibold text-charcoal mb-4">Privacy Policy</h2>
              
              <div className="space-y-4 text-charcoal/80">
                <p>
                  <span className="font-medium">Data Collection:</span> We collect personal information necessary for KYC compliance, investment processing, and client communication. This may include name, contact details, identification documents, bank details, and investment objectives.
                </p>
                
                <p>
                  <span className="font-medium">Data Usage:</span> Client information is used solely for providing investment-related services, regulatory compliance, and communication regarding investments or market updates with client consent.
                </p>
                
                <p>
                  <span className="font-medium">Data Sharing:</span> Client information may be shared with AMCs, KYC Registration Agencies, and regulatory bodies as required by law. We do not sell or share client data with third parties for marketing purposes.
                </p>
                
                <p>
                  <span className="font-medium">Data Security:</span> We employ industry-standard security measures to protect client data. Access to client information is restricted to authorized personnel on a need-to-know basis.
                </p>
                
                <p>
                  <span className="font-medium">Data Retention:</span> Client records are maintained for the period specified by regulatory requirements (minimum 5 years) or as needed for legitimate business purposes.
                </p>
              </div>
            </div>
            
            {/* Terms of Use */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-charcoal mb-4">Website Terms of Use</h2>
              
              <div className="space-y-4 text-charcoal/80">
                <p>
                  <span className="font-medium">Content Purpose:</span> All content on this website is for informational and educational purposes only and should not be construed as investment advice or a recommendation to buy or sell any security.
                </p>
                
                <p>
                  <span className="font-medium">Third-Party Links:</span> Our website may contain links to third-party websites, including partner platforms. We are not responsible for the content or privacy practices of these websites.
                </p>
                
                <p>
                  <span className="font-medium">Intellectual Property:</span> All content on this website is the property of Vijay Malik Financial Services and is protected by copyright laws. Reproduction or distribution without permission is prohibited.
                </p>
                
                <p>
                  <span className="font-medium">Disclaimer:</span> While we strive to keep information on this website accurate and up-to-date, we make no representations or warranties about the completeness, accuracy, reliability, or availability of the website or information, products, services, or related graphics.
                </p>
              </div>
            </div>
          
          {/* Add compliance notice at the bottom */}
          <div className="mt-10">
            <ComplianceNotice type="prominent" />
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
