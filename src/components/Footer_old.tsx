import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ComplianceNotice from './ComplianceNotice';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-brand-navy border-t border-brand-royal/30">
      <div className="container-padding py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Logo and About */}
          <div className="space-y-4">
            {/* Logo image */}
            <Image 
              src="/VM_Logo.png" 
              alt="Vijay Malik Financial Services Logo" 
              width={220} 
              height={55} 
              className="h-16 w-auto mb-4" 
              priority
            />
            <p className="text-brand-pearl text-sm">
              Vijay Malik Financial Services is an AMFI registered Mutual Fund distributor providing insights and access to investment opportunities through trusted partners.
            </p>
            <div className="flex space-x-4 pt-2">
              <a href="#" className="text-brand-pearl/70 hover:text-brand-gold transition-colors" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="#" className="text-brand-pearl/70 hover:text-brand-gold transition-colors" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 10.054 10.054 0 01-3.127 1.184 4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
              <a href="#" className="text-brand-pearl/70 hover:text-brand-gold transition-colors" aria-label="YouTube">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>
          
          {/* Column 2: Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-brand-gold">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/products" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  Our Products
                </Link>
              </li>
              <li>
                <Link href="/goal-planning" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  Goal Planning
                </Link>
              </li>
              <li>
                <Link href="/partners" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  Our Partners
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  Blog & Resources
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Column 3: Compliance */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-brand-gold">Compliance</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/verify-arn" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  Verify ARN
                </Link>
              </li>
              <li>
                <Link href="/disclosures" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  Disclosures
                </Link>
              </li>
              <li>
                <Link href="/disclosures#grievance" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  Grievance Policy
                </Link>
              </li>
              <li>
                <a href="https://www.amfiindia.com/locate-your-nearest-mutual-fund-distributor-details" target="_blank" rel="noopener noreferrer" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  AMFI Website
                </a>
              </li>
              <li>
                <a href="https://www.sebi.gov.in" target="_blank" rel="noopener noreferrer" className="text-brand-pearl hover:text-brand-gold text-sm transition-colors">
                  SEBI Website
                </a>
              </li>
            </ul>
          </div>
          
          {/* Column 4: Contact Info */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-brand-gold">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex space-x-3 text-navy text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-olive flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>+91 94173 34348</span>
              </li>
              <li className="flex space-x-3 text-navy text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-olive flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>info@vijaymalik.com</span>
              </li>
              <li className="flex space-x-3 text-navy text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-olive flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Motia Royal City, Zirakpur, 140603, India</span>
              </li>
              <li className="flex space-x-3 text-navy text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-olive flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Mon-Fri: 10:00 AM - 6:00 PM</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Compliance Notice */}
        <div className="mt-12">
          <ComplianceNotice type="standard" />
        </div>
        
        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-brand-royal/30 flex flex-col sm:flex-row justify-between items-center text-sm text-brand-pearl/70">
          <p>© {currentYear} Vijay Malik Financial Services. All rights reserved.</p>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            <Link href="/disclosures#privacy" className="hover:text-brand-gold transition-colors">
              Privacy Policy
            </Link>
            <Link href="/disclosures#terms" className="hover:text-brand-gold transition-colors">
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
