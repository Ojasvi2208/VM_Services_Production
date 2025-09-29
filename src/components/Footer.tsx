import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ComplianceNotice from './ComplianceNotice';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gradient-to-br from-brand-navy via-brand-navy to-brand-royal border-t border-brand-gold/20">
      <div className="container-padding py-8 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Column 1: Logo and About */}
          <div className="space-y-4">
            {/* Logo image */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 inline-block">
              <Image 
                src="/VM_Logo.png" 
                alt="Vijay Malik Financial Services Logo" 
                width={180} 
                height={45} 
                className="h-10 w-auto" 
                priority
              />
            </div>
            <p className="text-brand-pearl/90 text-sm leading-relaxed">
              Empowering <span className="text-brand-gold font-semibold">financial independence</span> through disciplined investing and transparent guidance.
            </p>
            <div className="flex space-x-3">
              <a href="#" className="text-brand-pearl/70 hover:text-brand-gold transition-all duration-300 hover:scale-110" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="#" className="text-brand-pearl/70 hover:text-brand-gold transition-all duration-300 hover:scale-110" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 10.054 10.054 0 01-3.127 1.184 4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
              <a href="#" className="text-brand-pearl/70 hover:text-brand-gold transition-all duration-300 hover:scale-110" aria-label="YouTube">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>
          
          {/* Column 2: Quick Links */}
          <div>
            <h3 className="font-bold text-base mb-4 text-brand-gold border-b border-brand-gold/30 pb-1 relative">
              <span className="relative z-10">Quick Links</span>
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/products" className="group text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-2 block relative overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    <span className="w-2 h-2 bg-brand-gold/50 rounded-full mr-2 group-hover:bg-brand-gold group-hover:animate-pulse transition-all duration-300"></span>
                    Our Products
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                </Link>
              </li>
              <li>
                <Link href="/goal-planning" className="group text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-2 block relative overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    <span className="w-2 h-2 bg-brand-gold/50 rounded-full mr-2 group-hover:bg-brand-gold group-hover:animate-pulse transition-all duration-300"></span>
                    Goal Planning
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                </Link>
              </li>
              <li>
                <Link href="/partners" className="group text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-2 block relative overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    <span className="w-2 h-2 bg-brand-gold/50 rounded-full mr-2 group-hover:bg-brand-gold group-hover:animate-pulse transition-all duration-300"></span>
                    Our Partners
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                </Link>
              </li>
              <li>
                <Link href="/blog" className="group text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-2 block relative overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    <span className="w-2 h-2 bg-brand-gold/50 rounded-full mr-2 group-hover:bg-brand-gold group-hover:animate-pulse transition-all duration-300"></span>
                    Blog & Resources
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                </Link>
              </li>
              <li>
                <Link href="/about" className="group text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-2 block relative overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    <span className="w-2 h-2 bg-brand-gold/50 rounded-full mr-2 group-hover:bg-brand-gold group-hover:animate-pulse transition-all duration-300"></span>
                    About Us
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="group text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-2 block relative overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    <span className="w-2 h-2 bg-brand-gold/50 rounded-full mr-2 group-hover:bg-brand-gold group-hover:animate-pulse transition-all duration-300"></span>
                    Contact Us
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Column 3: Compliance */}
          <div>
            <h3 className="font-bold text-base mb-4 text-brand-gold border-b border-brand-gold/30 pb-1">Compliance</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/verify-arn" className="text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-1 block">
                  → Verify ARN
                </Link>
              </li>
              <li>
                <Link href="/disclosures" className="text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-1 block">
                  → Disclosures
                </Link>
              </li>
              <li>
                <Link href="/disclosures#grievance" className="text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-1 block">
                  → Grievance Policy
                </Link>
              </li>
              <li>
                <a href="https://www.amfiindia.com/locate-your-nearest-mutual-fund-distributor-details" target="_blank" rel="noopener noreferrer" className="text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-1 block">
                  → AMFI Website
                </a>
              </li>
              <li>
                <a href="https://www.sebi.gov.in" target="_blank" rel="noopener noreferrer" className="text-brand-pearl/90 hover:text-brand-gold text-sm transition-all duration-300 hover:translate-x-1 block">
                  → SEBI Website
                </a>
              </li>
            </ul>
          </div>
          
          {/* Column 4: Contact Info */}
          <div>
            <h3 className="font-bold text-base mb-4 text-brand-gold border-b border-brand-gold/30 pb-1">Contact Info</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3 text-brand-pearl/90 text-sm group">
                <div className="bg-brand-gold/20 p-2 rounded-lg mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <span className="group-hover:text-brand-gold transition-colors">+91 94173 34348</span>
              </li>
              <li className="flex items-start space-x-3 text-brand-pearl/90 text-sm group">
                <div className="bg-brand-gold/20 p-2 rounded-lg mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="group-hover:text-brand-gold transition-colors">info@vmfinancialservices.com</span>
              </li>
              <li className="flex items-start space-x-3 text-brand-pearl/90 text-sm group">
                <div className="bg-brand-gold/20 p-2 rounded-lg mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="group-hover:text-brand-gold transition-colors">Motia Royal City, Zirakpur, 140603, India</span>
              </li>
              <li className="flex items-start space-x-3 text-brand-pearl/90 text-sm group">
                <div className="bg-brand-gold/20 p-2 rounded-lg mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="group-hover:text-brand-gold transition-colors">Mon-Fri: 10:00 AM - 6:00 PM</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Compliance Notice */}
        <div className="mt-8 bg-brand-royal/20 rounded-2xl p-4 border border-brand-gold/20">
          <ComplianceNotice type="standard" />
          
          {/* Copyright text at the bottom of compliance section */}
          <div className="mt-4 pt-3 border-t border-brand-gold/20 flex flex-col sm:flex-row justify-between items-center text-xs text-brand-pearl/60">
            <p className="flex items-center space-x-2 mb-2 sm:mb-0">
              <span>© {currentYear} Vijay Malik Financial Services (Sole Proprietorship).</span>
              <span className="hidden sm:inline">|</span>
              <span className="text-brand-gold text-xs font-bold">AMFI REG: ARN-317605</span>
              <span className="hidden sm:inline">|</span>
              <span>All rights reserved.</span>
            </p>
            <div className="flex space-x-4 mt-2 sm:mt-0">
              <Link href="/disclosures#privacy" className="hover:text-brand-gold transition-all duration-300 hover:underline">
                Privacy Policy
              </Link>
              <Link href="/disclosures#terms" className="hover:text-brand-gold transition-all duration-300 hover:underline">
                Terms of Use
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
