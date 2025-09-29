'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import MobileNav from './MobileNav';
import ComplianceNotice from './ComplianceNotice';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  
  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Close mobile menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);
  
  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };
  
  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'Products' },
    { href: '/goal-planning', label: 'Goal Planning' },
    { href: '/partners', label: 'Partners' },
    { href: '/blog', label: 'Blog' },
    { href: '/about', label: 'About' },
    { href: '/verify-arn', label: 'Verify ARN' },
    { href: '/contact', label: 'Contact' }
  ];

  return (
    <header 
      className={`absolute left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-xl border-b border-brand-platinum/30 top-0' : 'bg-transparent top-12'
      }`}
      style={{ top: scrolled ? '0' : '48px' }}
    >
      <div className="container-padding py-4">
        <div className="flex items-center justify-between h-16 md:h-20 px-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center focus-ring" aria-label="Vijay Malik Financial - Home">
              {/* Logo image */}
              <Image 
                src="/VM_Logo.png" 
                alt="Vijay Malik Financial Services Logo" 
                width={220} 
                height={55} 
                className="h-16 w-auto" 
                priority
              />
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className={`group relative px-4 py-2 text-sm lg:text-base font-bold transition-all duration-300 focus-ring rounded-md shadow-sm overflow-hidden ${
                  isActive(link.href) 
                    ? 'text-white bg-brand-navy shadow-md border border-brand-navy' 
                    : pathname === '/' 
                      ? scrolled
                        ? 'text-black bg-gray-200 hover:text-white hover:bg-brand-navy hover:shadow-md border border-gray-300 hover:border-brand-navy backdrop-blur-sm hover:scale-105'
                        : 'text-white bg-transparent hover:text-white hover:bg-brand-navy hover:shadow-md border border-white/30 hover:border-brand-navy backdrop-blur-sm hover:scale-105'
                      : 'text-black bg-gray-200 hover:text-white hover:bg-brand-navy hover:shadow-md border border-gray-300 hover:border-brand-navy backdrop-blur-sm hover:scale-105'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <span className="relative z-10 flex items-center gap-1">
                  {!isActive(link.href) && (
                    <span className="w-1.5 h-1.5 bg-brand-gold rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:animate-pulse"></span>
                  )}
                  {link.label}
                </span>
                {!isActive(link.href) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-navy to-brand-royal transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 rounded-md"></div>
                )}
              </Link>
            ))}
          </nav>
          
          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-white bg-slate-800 hover:bg-brand-navy focus-ring transition-all duration-200 shadow-md"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <span className="sr-only">Open main menu</span>
            {isMenuOpen ? (
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile Navigation Menu */}
      <MobileNav isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </header>
  );
}
