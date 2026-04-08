import type { Metadata } from 'next';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';

export const metadata: Metadata = {
  title: 'Disclosures — Privacy Policy, Terms & Risk Disclosure',
  description: 'Legal disclosures, privacy policy, terms of service, and risk disclosure for Vijay Malik Financial Services.',
};

const SECTIONS = [
  {
    title: 'Mutual Fund Distributor Status',
    items: [
      { label: 'AMFI Registration', text: 'Vijay Malik Financial Services is a registered Mutual Fund Distributor (MFD) with AMFI, holding ARN-317605. Our registration can be verified on the AMFI website.' },
      { label: 'EUIN', text: 'All client interactions are conducted by NISM-certified professionals with valid Employee Unique Identification Numbers (EUIN: E123456). EUIN details are disclosed in all transaction documents.' },
      { label: 'Nature of Service', text: 'As an MFD, we distribute mutual fund products and provide basic investment guidance. We are not a SEBI Registered Investment Adviser (RIA) and do not provide comprehensive financial planning as defined under SEBI (Investment Advisers) Regulations.' },
      { label: 'Advisory Limitations', text: 'Our recommendations are restricted to mutual fund products. For holistic financial planning or advice on other financial products, we recommend consulting a SEBI-registered investment adviser.' },
    ],
  },
  {
    title: 'Commission Disclosure',
    items: [
      { label: 'Commission Structure', text: 'As a mutual fund distributor, we receive commissions from Asset Management Companies (AMCs) for distributing their products. These commissions are part of the expense ratio in regular plans.' },
      { label: 'Commission Rates', text: 'Typical commissions range from 0.5% to 1.5% annually for equity funds and 0.1% to 0.7% for debt funds. Exact rates for specific schemes can be provided upon request.' },
      { label: 'Conflict of Interest', text: 'We acknowledge that commission structures may create potential conflicts of interest. We follow a client-first approach and recommend products based on suitability rather than commission considerations.' },
      { label: 'Direct Plans', text: 'We inform all clients about the availability of direct plans, which have lower expense ratios as they don\'t include distributor commissions. Clients are free to choose between regular and direct plans.' },
    ],
  },
  {
    title: 'Risk Disclosure',
    items: [
      { label: 'Market Risks', text: 'Mutual fund investments are subject to market risks, and their value can fluctuate due to various factors including market conditions, economic changes, and company-specific events.' },
      { label: 'No Guaranteed Returns', text: 'Past performance is not indicative of future results. We do not guarantee or promise any returns on investments. All performance illustrations are for educational purposes only.' },
      { label: 'Risk Assessment', text: 'While we assist clients in understanding their risk profile, the final investment decision rests with the client. We recommend reading all scheme-related documents carefully before investing.' },
      { label: 'Risk Mitigation', text: 'We advocate diversification, goal-based investing, and regular monitoring as strategies to manage investment risks, but these do not eliminate all investment risks.' },
    ],
  },
  {
    title: 'Grievance Handling Procedure',
    items: [
      { label: 'First Level Resolution', text: 'All grievances should first be addressed to our Client Services team via email at grievance@vijaymalik.com or phone at +91 94173 34348. We aim to acknowledge grievances within 24 hours and resolve within 7 working days.' },
      { label: 'Escalation Process', text: 'If the grievance remains unresolved at the first level, clients may escalate to vijay@vijaymalik.com.' },
      { label: 'AMFI Escalation', text: 'If not satisfactorily addressed within 30 days, clients may approach AMFI at complaints@amfiindia.com or through their online grievance portal.' },
      { label: 'Record Maintenance', text: 'We maintain records of all grievances and their resolution for a minimum of 8 years per regulatory requirements. A summary report is submitted to AMFI quarterly.' },
    ],
  },
  {
    title: 'Privacy Policy',
    items: [
      { label: 'Data Collection', text: 'We collect personal information necessary for KYC compliance, investment processing, and client communication — including name, contact details, identification documents, and investment objectives.' },
      { label: 'Data Usage', text: 'Client information is used solely for providing investment-related services, regulatory compliance, and communication regarding investments or market updates with client consent.' },
      { label: 'Data Sharing', text: 'Client information may be shared with AMCs, KYC Registration Agencies, and regulatory bodies as required by law. We do not sell or share client data with third parties for marketing purposes.' },
      { label: 'Data Security', text: 'We employ industry-standard security measures to protect client data. Access to client information is restricted to authorized personnel on a need-to-know basis.' },
      { label: 'Cookies & Advertising', text: 'This website uses cookies to enhance user experience. We use Google AdSense to display advertisements. Google and its advertising partners may use cookies and web beacons to serve ads based on your prior visits to this website and other websites on the internet. You may opt out of personalized advertising by visiting Google Ads Settings at https://adssettings.google.com. For more information on how Google uses data, visit https://policies.google.com/technologies/partner-sites.' },
      { label: 'Analytics', text: 'We use Google Analytics (GA4) to understand how visitors interact with our website. Google Analytics uses cookies to collect anonymized usage data including pages visited, time spent, and referral sources. This data is used solely to improve our website and services. You can opt out by installing the Google Analytics Opt-out Browser Add-on.' },
      { label: 'Third-Party Ad Networks', text: 'Third-party vendors, including Google, use cookies to serve ads based on your browsing history. The use of advertising cookies by Google and its partners enables them to serve ads based on your visit to our site and/or other sites on the internet. You may opt out of the use of cookies for personalized advertising by visiting www.aboutads.info/choices.' },
    ],
  },
  {
    title: 'Website Terms of Use',
    items: [
      { label: 'Content Purpose', text: 'All content on this website is for informational and educational purposes only and should not be construed as investment advice or a recommendation to buy or sell any security.' },
      { label: 'Third-Party Links', text: 'Our website may contain links to third-party websites. We are not responsible for the content or privacy practices of these websites.' },
      { label: 'Intellectual Property', text: 'All content on this website is the property of Vijay Malik Financial Services and is protected by copyright laws. Reproduction without permission is prohibited.' },
      { label: 'Disclaimer', text: 'While we strive to keep information accurate and up-to-date, we make no representations about the completeness, accuracy, or reliability of information on this website.' },
    ],
  },
];

export default function DisclosuresPage() {
  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* Header */}
        <header className="mb-14 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-[#44f593] text-xs font-semibold mb-8 uppercase tracking-widest">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            AMFI-Registered · ARN-317605
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Disclosures
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            In compliance with SEBI and AMFI regulations — transparent information about our services, fees, and grievance procedures.
          </p>
        </header>

        {/* Compliance highlight */}
        <div className="glass-card rounded-2xl p-6 border-[#44f593]/20 bg-[#44f593]/5 mb-12 max-w-3xl mx-auto">
          <p className="text-sm text-[#c0c9c2] leading-relaxed text-center">
            <span className="text-[#44f593] font-bold">Mutual fund investments are subject to market risks.</span>
            {' '}Read all scheme related documents carefully before investing. Past performance is not indicative of future results.
          </p>
        </div>

        {/* Disclosure Sections */}
        <div className="max-w-3xl mx-auto space-y-8">
          {SECTIONS.map((section, si) => (
            <div key={si} className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 bg-[#161d1a]/60">
                <h2 className="text-base font-display font-bold text-[#dce5df] flex items-center gap-3">
                  <span className="text-xs font-mono text-[#44f593] bg-[#44f593]/10 px-2 py-0.5 rounded border border-[#44f593]/20">
                    {String(si + 1).padStart(2, '0')}
                  </span>
                  {section.title}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {section.items.map((item, ii) => (
                  <div key={ii} className="space-y-1">
                    <p className="text-xs font-semibold text-[#44f593] uppercase tracking-wide font-mono">{item.label}</p>
                    <p className="text-sm text-[#c0c9c2] leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Contact Info */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-display font-bold text-[#dce5df] mb-5">Grievance Officer Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Grievance Officer', value: 'Grievance Team' },
                { label: 'Email', value: 'grievance@vijaymalik.com', href: 'mailto:grievance@vijaymalik.com' },
                { label: 'Phone', value: '+91 94173 34348', href: 'tel:+919417334348' },
                { label: 'Address', value: 'Motia Royal City, Zirakpur — 140603' },
                { label: 'Business Hours', value: 'Mon–Fri, 10:00 AM to 6:00 PM' },
              ].map(c => (
                <div key={c.label} className="bg-[#161d1a]/50 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-mono text-[#859586] uppercase tracking-widest mb-1">{c.label}</p>
                  {c.href ? (
                    <a href={c.href} className="text-sm text-[#44f593] hover:underline">{c.value}</a>
                  ) : (
                    <p className="text-sm text-[#dce5df]">{c.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>

      <SiteFooter />
    </div>
  );
}
