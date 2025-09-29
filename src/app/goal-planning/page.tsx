'use client';

import { useState } from 'react';
import Link from 'next/link';
import Section from '@/components/Section';
import ComplianceNotice from '@/components/ComplianceNotice';
import ResponsiveContainer from '@/components/ResponsiveContainer';

// Calculator Type Definitions
type SIPCalculatorInputs = {
  goalAmount: number;
  years: number;
  expectedReturn: number;
};

// SIP Calculator Component
const SIPCalculator = () => {
  const [inputs, setInputs] = useState({
    goalAmount: '',
    years: '',
    expectedReturn: '12',
  });
  
  const [result, setResult] = useState<number | null>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };
  
  const calculateSIP = () => {
    const { goalAmount, years, expectedReturn } = inputs;
    
    if (!goalAmount || !years || !expectedReturn) return;
    
    const P = parseFloat(goalAmount);
    const n = parseInt(years) * 12; // months
    const r = parseFloat(expectedReturn) / 100 / 12; // monthly rate
    
    // SIP formula: P = R * [((1+r)^n - 1) / r]
    // R = P * r / ((1+r)^n - 1)
    const R = P * r / (Math.pow(1 + r, n) - 1);
    
    setResult(Math.round(R));
  };
  
  return (
    <div className="bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 rounded-lg p-6 shadow-sm mb-6 transform hover:scale-[1.01] transition-all duration-300 animate-fadeInUp animation-delay-300">
      <div className="flex items-center mb-4">
        <div className="w-3 h-3 bg-brand-gold rounded-full animate-pulse mr-3"></div>
        <h3 className="text-xl font-semibold text-brand-navy">SIP <span className="text-brand-royal">Calculator</span></h3>
      </div>
      <p className="text-brand-navy/70 mb-6 text-sm">
        Calculate your monthly SIP to achieve your <span className="text-brand-gold font-medium">financial goals</span>.
      </p>
      
      <div className="space-y-4 mb-6">
        <div className="transform hover:scale-[1.02] transition-all duration-200">
          <label htmlFor="goalAmount" className="block text-sm font-medium text-brand-navy mb-1">
            Target Amount <span className="text-brand-gold">(₹)</span>
          </label>
          <input
            type="number"
            id="goalAmount"
            name="goalAmount"
            value={inputs.goalAmount}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal transition-all duration-200 hover:border-brand-gold/50"
          />
        </div>
        
        <div className="transform hover:scale-[1.02] transition-all duration-200">
          <label htmlFor="years" className="block text-sm font-medium text-brand-navy mb-1">
            Time Horizon <span className="text-brand-gold">(Years)</span>
          </label>
          <input
            type="number"
            id="years"
            name="years"
            value={inputs.years}
            onChange={handleChange}
            min="1"
            max="40"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal transition-all duration-200 hover:border-brand-gold/50"
          />
        </div>
        
        <div className="transform hover:scale-[1.02] transition-all duration-200">
          <label htmlFor="expectedReturn" className="block text-sm font-medium text-brand-navy mb-1">
            Expected Annual Return <span className="text-brand-gold">(%)</span>
          </label>
          <input
            type="number"
            id="expectedReturn"
            name="expectedReturn"
            value={inputs.expectedReturn}
            onChange={handleChange}
            min="1"
            max="20"
            step="0.5"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal transition-all duration-200 hover:border-brand-gold/50"
          />
        </div>
      </div>
      
      <button
        onClick={calculateSIP}
        className="bg-gradient-to-r from-brand-royal to-brand-navy text-white px-6 py-3 rounded-lg font-medium hover:from-brand-navy hover:to-brand-royal transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl animate-slideInFromLeft animation-delay-500 w-full"
      >
        <span className="flex items-center justify-center">
          Calculate Monthly SIP
          <div className="ml-2 w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
        </span>
      </button>
      
      {result !== null && (
        <div className="mt-6 bg-gradient-to-r from-brand-gold/10 to-yellow-50 border border-brand-gold/20 p-6 rounded-lg animate-fadeInUp">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-brand-gold rounded-full animate-pulse mr-3"></div>
            <p className="font-semibold text-brand-navy">Estimated Monthly SIP: <span className="text-brand-royal text-xl">₹{result.toLocaleString()}</span></p>
          </div>
          <p className="text-xs text-brand-navy/60 mt-3">
            This is an illustrative calculation based on the inputs provided. <span className="text-brand-gold font-medium">Actual results may vary.</span>
          </p>
        </div>
      )}
    </div>
  );
};

// Lead Form Component
const LeadForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    goal: 'retirement',
    message: '',
    consent: false,
  });
  
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
    
    // Clear error when user starts typing
    if (submitError) {
      setSubmitError(null);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.consent) {
      setSubmitError('Please provide consent to contact you.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/customer-inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setFormSubmitted(true);
      } else {
        setSubmitError(result.error || 'Failed to submit form. Please try again.');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (formSubmitted) {
    return (
      <div className="bg-gradient-to-br from-white via-brand-pearl to-green-50/30 rounded-lg p-6 shadow-sm border border-green-200/50 animate-fadeInUp">
        <div className="text-center py-8">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-brand-navy mb-3">Thank <span className="text-brand-gold">You!</span></h3>
          <p className="text-brand-navy/70 mb-6">
            We&apos;ve received your request and will contact you within <span className="text-brand-royal font-semibold">24 hours</span> to schedule your free 20-min call.
          </p>
          <Link href="/" className="text-brand-royal font-medium hover:text-brand-gold transition-colors duration-200 hover:underline">
            Return to Home →
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 rounded-lg p-6 shadow-sm transform hover:scale-[1.01] transition-all duration-300 animate-fadeInUp animation-delay-400">
      <div className="flex items-center mb-4">
        <div className="w-3 h-3 bg-brand-royal rounded-full animate-pulse mr-3"></div>
        <h3 className="text-xl font-semibold text-brand-navy">Get a Free <span className="text-brand-gold">20-min Call</span></h3>
      </div>
      <p className="text-brand-navy/70 mb-6 text-sm">
        Tell us about your <span className="text-brand-gold font-medium">goals</span> and we&apos;ll help structure an investment approach for execution on our partner platforms.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-charcoal mb-1">
              Your Name*
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-1">
              Email Address*
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-charcoal mb-1">
              Phone Number*
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          
          <div>
            <label htmlFor="goal" className="block text-sm font-medium text-charcoal mb-1">
              Primary Financial Goal
            </label>
            <select
              id="goal"
              name="goal"
              value={formData.goal}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value="retirement">Retirement Planning</option>
              <option value="education">Children&apos;s Education</option>
              <option value="house">House Purchase</option>
              <option value="wealth">Wealth Creation</option>
              <option value="tax">Tax Planning</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-charcoal mb-1">
              Brief details about your goal
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              value={formData.message}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                required
                checked={formData.consent}
                onChange={handleChange}
                className="h-4 w-4 text-teal border-gray-300 rounded focus:ring-teal"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="consent" className="text-charcoal/70">
                I consent to being contacted via phone/email regarding my investment needs.
              </label>
            </div>
          </div>
        </div>
        
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
            isSubmitting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-royal to-brand-navy text-white hover:from-brand-navy hover:to-brand-royal hover:shadow-lg transform hover:scale-105'
          }`}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mr-2"></div>
              Submitting...
            </div>
          ) : (
            'Submit Request'
          )}
        </button>
        
        <p className="text-xs text-center text-charcoal/60 mt-4">
          We are an MFD. For detailed advisory, we recommend consulting a SEBI-registered Investment Adviser.
        </p>
      </form>
    </div>
  );
};

export default function GoalPlanningPage() {
  return (
    <>
      <div className="pt-24"></div> {/* Spacer for absolute header */}
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="text-center mb-12 animate-fadeInUp animation-delay-100">
            <h1 className="text-4xl md:text-5xl font-bold text-brand-navy mb-6">
              Goal <span className="bg-gradient-to-r from-brand-gold to-yellow-400 bg-clip-text text-transparent animate-shimmer">Planning</span>
            </h1>
            <p className="text-lg text-brand-navy/80 max-w-4xl mx-auto leading-relaxed">
              <span className="text-brand-gold font-semibold animate-glow">Clarity</span> before commitment. Tell us your goals—timeline and comfort with <span className="text-brand-royal font-semibold">risk</span>—and we&apos;ll help you structure an investment approach for execution on our partner platforms.
            </p>
            <div className="flex items-center justify-center mt-4 space-x-2">
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-brand-royal rounded-full animate-pulse animation-delay-200"></div>
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse animation-delay-300"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Left column: Calculators */}
            <div>
              <SIPCalculator />
              
              <div className="bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 rounded-lg p-6 shadow-sm mb-6 md:mb-0 border border-brand-gold/10 transform hover:scale-[1.02] transition-all duration-300">
                <div className="flex items-center mb-3">
                  <div className="w-3 h-3 bg-brand-gold rounded-full animate-pulse mr-3"></div>
                  <h3 className="text-xl font-semibold text-brand-navy">Education & <span className="text-brand-royal">Retirement</span> Calculators</h3>
                </div>
                <p className="text-brand-navy/70 mb-6 text-sm">
                  More detailed <span className="text-brand-gold font-medium">calculators</span> available during your consultation.
                </p>
                <div className="flex justify-center">
                  <Link 
                    href="#lead-form" 
                    className="bg-gradient-to-r from-brand-royal to-brand-navy text-white px-6 py-3 rounded-lg font-medium hover:from-brand-navy hover:to-brand-royal transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl scroll-smooth inline-flex items-center"
                  >
                    Schedule a call to access detailed calculators
                    <div className="ml-2 w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Right column: Lead form */}
            <div id="lead-form">
              <LeadForm />
            </div>
          </div>
          
          {/* Risk note */}
          <div className="mt-8 md:mt-12">
            <ComplianceNotice type="standard" />
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
