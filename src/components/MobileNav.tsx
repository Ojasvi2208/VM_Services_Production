'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type MobileNavProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  
  // Close menu when navigation occurs (only when pathname changes, not when menu opens)
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);
  
  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/funds/search', label: 'Search Funds' },
    { href: '/funds/compare', label: 'Compare' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/calculators/sip', label: 'Calculators' },
    { href: '/partners', label: 'Partners' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' }
  ];
  
  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      
      {/* Mobile Menu Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-brand-navy shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-brand-royal/20">
          <div className="font-semibold text-white">Menu</div>
          <button 
            onClick={onClose}
            className="p-2 rounded-md text-white hover:bg-brand-royal/20 focus:outline-none focus:ring-2 focus:ring-brand-gold"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="px-4 py-6 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block py-3 px-4 rounded-md text-base font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-brand-gold text-brand-navy font-bold'
                  : 'text-white hover:bg-brand-royal/20 hover:text-brand-gold'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        
        <div className="px-6 py-4 mt-4 border-t border-brand-royal/20">
          <h4 className="text-sm font-medium text-white/70 mb-2">Contact</h4>
          <p className="text-sm text-white/90 mb-1 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-gold" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12.036 5.339c-3.635 0-6.591 2.956-6.593 6.589-.001 1.483.434 2.594 1.164 3.756l-.666 2.432 2.494-.654c1.117.663 2.184 1.061 3.595 1.061 3.632 0 6.591-2.956 6.592-6.59.003-3.641-2.942-6.593-6.586-6.594zm3.876 9.423c-.165.463-.957.885-1.337.942-.341.051-.773.078-1.377-.079-1.214-.32-2.688-1.426-3.646-2.77-.574-.747-.969-1.657-1.115-2.576-.168-1.051.408-1.571.7-1.796.346-.257.691-.183.915-.011l.563.387c.17.115.272.283.302.495.068.48.148 1.188-.018 1.421-.196.273-.163.223.053.48.304.36.661.877 1.132 1.422.722.836 1.28 1.134 1.942 1.588.14.092.28.098.406.005.241-.17.658-.601.932-.802.252-.183.532-.07.726.065l.999.642c.131.094.276.18.347.33.042.088.078.235-.019.446z" clipRule="evenodd" />
            </svg>
            9417334348
          </p>
          <p className="text-sm text-white/90">Email: info@vmfinancialservices.com</p>
        </div>
        
        <div className="px-6 py-4 bg-mist/30 mt-auto">
          <p className="text-xs text-brick">
            Mutual Fund investments are subject to market risks, read all scheme related documents carefully.
          </p>
        </div>
      </div>
    </div>
  );
}
