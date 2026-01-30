"use client";

import React from 'react';
import { ChevronRightIcon, ChartBarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import AnimatedElement from '@/components/ui/AnimatedElement';
import EnhancedFundsTable from '@/components/EnhancedFundsTable';

const AnalysisPage = () => {

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-pearl via-white to-brand-platinum">
      {/* Enhanced Header Section with reduced height */}
      <section className="relative h-[70vh] bg-gradient-to-br from-brand-navy via-brand-royal to-brand-navy overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-navy/90 via-brand-royal/85 to-brand-navy/90"></div>
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:50px_50px]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-l from-brand-gold/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-brand-soft-blue/20 to-transparent rounded-full blur-3xl"></div>
        </div>

        <ResponsiveContainer className="relative z-10 h-full flex items-center">
          <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
            <AnimatedElement
              variant="fadeLeft"
              className="text-white space-y-8"
            >
              <div className="space-y-6">
                <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                  <span className="bg-gradient-to-r from-brand-gold via-yellow-300 to-brand-gold bg-clip-text text-transparent">
                    Comprehensive
                  </span>
                  <br />
                  <span className="text-white">Fund Analysis</span>
                </h1>
                <div className="h-1 w-24 bg-gradient-to-r from-brand-gold to-yellow-400 rounded-full"></div>
                <p className="text-xl md:text-2xl text-brand-pearl leading-relaxed max-w-2xl">
                  Discover, analyze, and compare mutual funds with real-time data, 
                  comprehensive insights, and professional-grade tools for informed investment decisions.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2 bg-brand-gold/20 backdrop-blur-sm px-4 py-2 rounded-full border border-brand-gold/40">
                  <ChartBarIcon className="h-5 w-5 text-brand-gold" />
                  <span className="text-sm font-medium">Real-time NAV</span>
                </div>
                <div className="flex items-center space-x-2 bg-brand-gold/20 backdrop-blur-sm px-4 py-2 rounded-full border border-brand-gold/40">
                  <MagnifyingGlassIcon className="h-5 w-5 text-brand-gold" />
                  <span className="text-sm font-medium">Advanced Search</span>
                </div>
                <div className="flex items-center space-x-2 bg-brand-gold/20 backdrop-blur-sm px-4 py-2 rounded-full border border-brand-gold/40">
                  <ChevronRightIcon className="h-5 w-5 text-brand-gold" />
                  <span className="text-sm font-medium">Detailed Analysis</span>
                </div>
              </div>
            </AnimatedElement>

            <AnimatedElement
              variant="fadeRight"
              className="relative"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/20 to-brand-royal/20 rounded-2xl blur-2xl"></div>
                <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-brand-gold/30">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-3xl md:text-4xl font-bold text-white mb-2">5000+</div>
                      <div className="text-brand-pearl text-sm">Mutual Funds</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl md:text-4xl font-bold text-white mb-2">45+</div>
                      <div className="text-brand-pearl text-sm">Categories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl md:text-4xl font-bold text-white mb-2">Real-time</div>
                      <div className="text-brand-pearl text-sm">NAV Updates</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl md:text-4xl font-bold text-white mb-2">Pro</div>
                      <div className="text-brand-pearl text-sm">Analytics</div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedElement>
          </div>
        </ResponsiveContainer>
      </section>

      {/* Comprehensive Funds Table Section */}
      <section className="py-16 bg-white">
        <ResponsiveContainer>
          <AnimatedElement variant="fadeUp" className="space-y-8">
            <div className="text-center space-y-6">
              <h2 className="text-4xl md:text-6xl font-bold">
                <span className="bg-gradient-to-r from-brand-navy via-brand-royal to-brand-navy bg-clip-text text-transparent">
                  Explore Mutual Funds
                </span>
              </h2>
              <p className="text-xl md:text-2xl text-brand-cloud max-w-4xl mx-auto leading-relaxed">
                Browse through our comprehensive database of mutual funds with real-time NAV data, 
                detailed categorization, and advanced filtering options.
              </p>
            </div>
            
            {/* Comprehensive Funds Table */}
            <div className="relative">
              {/* Premium background with subtle pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand-navy/95 via-brand-royal/90 to-brand-navy/95 rounded-3xl"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(197,165,114,0.15)_0%,transparent_50%)] rounded-3xl"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(139,157,195,0.1)_0%,transparent_50%)] rounded-3xl"></div>
              
              {/* Elegant border */}
              <div className="relative bg-gradient-to-r from-brand-gold/20 via-brand-gold/30 to-brand-gold/20 p-[2px] rounded-3xl">
                <div className="bg-gradient-to-br from-brand-navy/98 to-brand-royal/95 rounded-3xl overflow-hidden backdrop-blur-xl">
                  <EnhancedFundsTable />
                </div>
              </div>
              
              {/* Floating elements for extra premium feel */}
              <div className="absolute -top-6 -left-6 w-12 h-12 bg-gradient-to-br from-brand-gold/30 to-brand-gold/10 rounded-full blur-xl"></div>
              <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-gradient-to-br from-brand-soft-blue/20 to-brand-royal/10 rounded-full blur-xl"></div>
            </div>
          </AnimatedElement>
        </ResponsiveContainer>
      </section>

      {/* Call-to-Action Section */}      {/* Call-to-Action Section */}
      <section className="py-16 bg-gradient-to-r from-brand-navy to-brand-royal">
        <ResponsiveContainer>
          <AnimatedElement variant="fadeUp" className="text-center text-white space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to Start Your Investment Journey?
            </h2>
            <p className="text-xl text-brand-pearl max-w-3xl mx-auto">
              Get personalized fund recommendations based on your investment goals and risk profile.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-4 bg-brand-gold text-brand-navy font-semibold rounded-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105">
                Start Analysis
              </button>
              <button className="px-8 py-4 border-2 border-brand-gold text-brand-gold font-semibold rounded-lg hover:bg-brand-gold hover:text-brand-navy transition-all duration-300">
                Learn More
              </button>
            </div>
          </AnimatedElement>
        </ResponsiveContainer>
      </section>
    </div>
  );
};

export default AnalysisPage;