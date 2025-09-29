"use client";

import Image from "next/image";
import Link from "next/link";
import ComplianceNotice from "@/components/ComplianceNotice";
import Section from "@/components/Section";
import ResponsiveContainer from "@/components/ResponsiveContainer";
import AnimatedElement from "@/components/ui/AnimatedElement";
import AnimatedBackground from "@/components/AnimatedBackground";

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <AnimatedBackground 
        images={["/images/1.jpg", "/images/2.jpg", "/images/3.jpg", "/images/4.jpg", "/images/5.jpg"]} 
        interval={6000}
        className="min-h-screen pt-32"
      >
        <div className="flex items-center min-h-screen">
          <ResponsiveContainer>
            <div className="max-w-3xl mx-auto text-center md:text-left md:mx-0 text-white pt-20">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 heading-with-accent relative">
                  <span className="inline-block">Invest with </span>
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-brand-gold via-yellow-300 to-brand-gold bg-clip-text text-transparent animate-pulse">trust</span>
                    <span className="absolute -inset-1 bg-brand-gold/20 blur-sm rounded-lg opacity-50 animate-pulse"></span>
                  </span>.{' '}
                  <span className="inline-block">Grow with </span>
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-brand-gold via-yellow-300 to-brand-gold bg-clip-text text-transparent animate-pulse animation-delay-1000">discipline</span>
                    <span className="absolute -inset-1 bg-brand-gold/20 blur-sm rounded-lg opacity-50 animate-pulse animation-delay-1000"></span>
                  </span>.
                </h1>
                          
                <p className="text-lg md:text-xl text-white/90 mb-6">
                  <span className="text-brand-gold font-semibold">AMFI-registered</span>{' '}Mutual Fund Distributor helping families plan and invest with clarity
                  
                </p>
                          
                <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-8">
                  <div className="group bg-white/20 hover:bg-brand-gold/20 text-white px-4 py-2 rounded-full text-sm font-bold border border-white/30 hover:border-brand-gold/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></span>
                      ARN-317605
                    </span>
                  </div>
                  <div className="group bg-white/20 hover:bg-brand-gold/20 text-white px-4 py-2 rounded-full text-sm font-bold border border-white/30 hover:border-brand-gold/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse animation-delay-500"></span>
                      3+ Years
                    </span>
                  </div>
                  <div className="group bg-white/20 hover:bg-brand-gold/20 text-white px-4 py-2 rounded-full text-sm font-bold border border-white/30 hover:border-brand-gold/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse animation-delay-1000"></span>
                      NISM Certified
                    </span>
                  </div>
                </div>
                          
                <div className="flex flex-wrap gap-4 justify-center md:justify-start mb-8">
                  <Link href="/partners" className="group relative btn-gold overflow-hidden">
                    <span className="relative z-10 flex items-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full group-hover:animate-bounce"></span>
                      Start Investing
                      <span className="transform group-hover:translate-x-1 transition-transform duration-300">→</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-brand-gold transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                  </Link>
                  <Link href="/goal-planning" className="group relative btn-secondary overflow-hidden">
                    <span className="relative z-10 flex items-center gap-2">
                      <span className="w-2 h-2 bg-brand-gold rounded-full group-hover:animate-spin"></span>
                      Plan a Goal
                      <span className="transform group-hover:translate-x-1 transition-transform duration-300">→</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-royal to-brand-navy transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                  </Link>
                </div>
            </div>
          </ResponsiveContainer>
        </div>
      </AnimatedBackground>

      {/* Partners Strip */}
      <Section className="bg-white py-12">
        <ResponsiveContainer>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-brand-navy mb-2 heading-with-accent relative">
              <span className="relative z-10">Our </span>
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-brand-navy via-brand-royal to-brand-navy bg-clip-text text-transparent">Trusted</span>
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-brand-gold to-transparent"></span>
              </span>
              <span className="relative z-10"> Partners</span>
            </h2>
            <p className="text-brand-cloud">
              Transactions are executed on{' '}
              <span className="text-brand-navy font-medium underline decoration-brand-gold/50">partner platforms</span>.{' '}
              We do <span className="text-brand-navy font-semibold">not</span> collect or store your payment details.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {/* SBI Mutual Fund */}
            <div className="group card-light flex flex-col items-center justify-center p-6 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-gold/20 to-brand-gold/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border-2 border-brand-gold/20 group-hover:border-brand-gold/50">
                <span className="text-xl font-bold text-brand-navy group-hover:text-brand-gold transition-colors">SBI</span>
              </div>
              <h3 className="font-semibold mb-1 text-brand-navy group-hover:text-brand-royal">SBI Mutual Fund</h3>
              <p className="text-sm text-brand-cloud">Wide range of funds across categories</p>
            </div>

            {/* NJ Wealth */}
            <div className="group card-light flex flex-col items-center justify-center p-6 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-gold/20 to-brand-gold/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border-2 border-brand-gold/20 group-hover:border-brand-gold/50">
                <span className="text-xl font-bold text-brand-navy group-hover:text-brand-gold transition-colors">NJ</span>
              </div>
              <h3 className="font-semibold mb-1 text-brand-navy group-hover:text-brand-royal">NJ Wealth</h3>
              <p className="text-sm text-brand-cloud">Comprehensive investment solutions</p>
            </div>

            {/* Canara Robeco */}
            <div className="card-light flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 bg-brand-gold/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-brand-navy">CR</span>
              </div>
              <h3 className="font-semibold mb-1 text-brand-navy">Canara Robeco</h3>
              <p className="text-sm text-brand-cloud">Focused fund strategies for diverse needs</p>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>

      {/* What We Do */}
      <Section className="bg-brand-pearl py-10 md:py-16">
        <ResponsiveContainer>
          <h2 className="text-3xl font-semibold text-brand-navy mb-12 text-center heading-with-accent">What We Do</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Mutual Funds */}
            <div className="card-light p-6 rounded-2xl transition-shadow">
              <div className="h-12 w-12 bg-brand-navy/10 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-navy" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-brand-navy">Mutual Funds</h3>
              <p className="text-brand-cloud text-sm">
                Equity, Hybrid, Index & ELSS funds tailored to your investment objectives and risk profile.
              </p>
            </div>

            {/* ETFs */}
            <div className="card-light p-6 rounded-2xl transition-shadow">
              <div className="h-12 w-12 bg-brand-navy/10 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-navy" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-brand-navy">ETFs</h3>
              <p className="text-brand-cloud text-sm">
                Core market exposure through low-cost index trackers with liquidity subject to market conditions.
              </p>
            </div>

            {/* Debt Funds */}
            <div className="card-light p-6 rounded-2xl transition-shadow">
              <div className="h-12 w-12 bg-brand-navy/10 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-navy" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-brand-navy">Debt Funds</h3>
              <p className="text-brand-cloud text-sm">
                Emergency funds and predictable cash-flows with short, medium, and long-duration options.
              </p>
            </div>

            {/* Goal Planning */}
            <div className="card-light p-6 rounded-2xl transition-shadow">
              <div className="h-12 w-12 bg-brand-navy/10 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-navy" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-brand-navy">Goal Planning</h3>
              <p className="text-brand-cloud text-sm">
                Education, retirement, and housing plans that align with your personal milestones and timeline.
              </p>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>

      {/* Trust Numbers */}
      <Section className="bg-gradient-premium py-16">
        <ResponsiveContainer>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="transform hover:scale-105 transition-transform duration-300">
              <div className="text-4xl font-bold mb-2 text-brand-gold">200+</div>
              <p className="text-white font-medium">Families Guided</p>
            </div>
            <div className="transform hover:scale-105 transition-transform duration-300">
              <div className="text-4xl font-bold mb-2 text-brand-gold">200+</div>
              <p className="text-white font-medium">SIP Set-ups</p>
            </div>
            <div className="transform hover:scale-105 transition-transform duration-300">
              <div className="text-4xl font-bold mb-2 text-brand-gold">15+</div>
              <p className="text-white font-medium">Cities Served</p>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>

      {/* Compliance Block */}
      <Section className="bg-brand-pearl py-12">
        <ResponsiveContainer>
          <div className="card-light p-6 md:p-8 rounded-2xl">
            <h2 className="text-xl font-semibold mb-4 text-brand-navy">Disclosure</h2>
            <p className="text-brand-cloud mb-4">
              We act as a Mutual Fund Distributor (MFD). We may receive trail commissions from AMCs. We do not offer fee-based investment advice. Investors should read all scheme-related documents carefully and may consult a SEBI-registered Investment Adviser and tax professional as needed.
            </p>
            <ComplianceNotice type="prominent" className="mt-4" />
          </div>
        </ResponsiveContainer>
      </Section>

      {/* Mini CTA */}
      <Section className="bg-white py-12">
        <ResponsiveContainer>
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4 text-brand-navy heading-with-accent">Questions?</h2>
            <p className="mb-6 text-brand-cloud flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-gold" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12.036 5.339c-3.635 0-6.591 2.956-6.593 6.589-.001 1.483.434 2.594 1.164 3.756l-.666 2.432 2.494-.654c1.117.663 2.184 1.061 3.595 1.061 3.632 0 6.591-2.956 6.592-6.59.003-3.641-2.942-6.593-6.586-6.594zm3.876 9.423c-.165.463-.957.885-1.337.942-.341.051-.773.078-1.377-.079-1.214-.32-2.688-1.426-3.646-2.77-.574-.747-.969-1.657-1.115-2.576-.168-1.051.408-1.571.7-1.796.346-.257.691-.183.915-.011l.563.387c.17.115.272.283.302.495.068.48.148 1.188-.018 1.421-.196.273-.163.223.053.48.304.36.661.877 1.132 1.422.722.836 1.28 1.134 1.942 1.588.14.092.28.098.406.005.241-.17.658-.601.932-.802.252-.183.532-.07.726.065l.999.642c.131.094.276.18.347.33.042.088.078.235-.019.446z" clipRule="evenodd" />
              </svg>
              9417334348 — Chandigarh
            </p>
            <div className="inline-block mb-6">
              <Link 
                href="mailto:ojasvi.malik@vmfinancialservices.com" 
                className="text-brand-navy font-medium hover:text-brand-gold hover:underline transition-colors"
              >
                Email: ojasvi.malik@vmfinancialservices.com
              </Link>
            </div>
            <div className="max-w-lg mx-auto">
              <ComplianceNotice type="minimal" className="text-center" />
            </div>
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
