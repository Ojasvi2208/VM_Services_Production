'use client';

import { useState } from 'react';
import Link from 'next/link';
import Section from '@/components/Section';
import ComplianceNotice from '@/components/ComplianceNotice';
import ResponsiveContainer from '@/components/ResponsiveContainer';

// ARN verification result type
type VerificationResult = {
  status: 'success' | 'error';
  message: string;
  details?: {
    name: string;
    arnNumber: string;
    validUpto: string; // Changed from validUntil to validUpto to match API response
    address: string;
    city: string;
    pin: string;
    state: string;
    phone: string;
    email: string;
    euin: string;
  };
};

export default function VerifyARNPage() {
  const [arnInput, setArnInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  
  // Function to handle verification submission
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    
    try {
      // Call our API endpoint to verify the ARN
      const response = await fetch('/api/verify-arn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arnNumber: arnInput }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setResult({
          status: 'error',
          message: data.message || 'Failed to verify ARN. Please try again.'
        });
      }
    } catch (error) {
      console.error('ARN verification error:', error);
      setResult({
        status: 'error',
        message: 'An error occurred. Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <div className="pt-24"></div> {/* Spacer for absolute header */}
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="lg">
            <h1 className="text-3xl font-bold text-brand-navy mb-4">Verify ARN</h1>
            <p className="text-lg text-brand-navy mb-8">
              Verify the AMFI Registration Number (ARN) of any mutual fund distributor before investing. 
              This ensures you're working with a registered professional.
            </p>
            
            <div className="bg-white p-6 md:p-8 rounded-lg shadow-sm mb-8">
              <h2 className="text-xl font-semibold text-charcoal mb-4">ARN Verification</h2>
              
              <form onSubmit={handleVerify} className="mb-4">
                <div className="mb-6">
                  <label htmlFor="arn" className="block text-sm font-medium text-charcoal mb-2">
                    Enter ARN Number
                  </label>
                  <input
                    type="text"
                    id="arn"
                    placeholder="e.g. ARN-123456"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal"
                    value={arnInput}
                    onChange={(e) => setArnInput(e.target.value)}
                    required
                  />
                  <p className="mt-2 text-xs text-charcoal/60">
                    ARN format: ARN-XXXXXX (where X is a digit)
                  </p>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn-primary w-full ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                      Verifying...
                    </span>
                  ) : (
                    'Verify ARN'
                  )}
                </button>
              </form>
              
              {result && (
                <div className={`mt-6 p-4 rounded-md ${result.status === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h3 className={`text-lg font-medium ${result.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                    {result.status === 'success' ? 'Verification Successful' : 'Verification Failed'}
                  </h3>
                  <p className={`mt-2 text-sm ${result.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                    {result.message}
                  </p>
                  
                  {result.details && (
                    <div className="mt-6 border-t border-green-200 pt-6">
                      <h3 className="text-xl font-bold text-green-800 mb-4">Distributor Details</h3>
                      <div className="bg-white rounded-lg shadow-md p-6 border border-green-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Distributor Name */}
                          <div className="bg-green-50 p-4 rounded-md">
                            <p className="text-sm uppercase tracking-wide font-medium text-green-800 mb-1">Distributor Name</p>
                            <p className="text-xl font-bold text-charcoal">{result.details.name}</p>
                          </div>
                          
                          {/* ARN Number */}
                          <div className="bg-green-50 p-4 rounded-md">
                            <p className="text-sm uppercase tracking-wide font-medium text-green-800 mb-1">ARN Number</p>
                            <p className="text-xl font-bold text-charcoal">{result.details.arnNumber}</p>
                          </div>
                          
                          {/* Valid Until */}
                          <div className="bg-green-50 p-4 rounded-md">
                            <p className="text-sm uppercase tracking-wide font-medium text-green-800 mb-1">Valid Until</p>
                            <p className="text-xl font-bold text-charcoal">{result.details.validUpto}</p>
                          </div>
                          
                          {/* EUIN */}
                          <div className="bg-green-50 p-4 rounded-md">
                            <p className="text-sm uppercase tracking-wide font-medium text-green-800 mb-1">EUIN</p>
                            <p className="text-xl font-bold text-charcoal">{result.details.euin || 'Not Available'}</p>
                          </div>
                          
                          {/* Registered Address - Full Width */}
                          <div className="md:col-span-2 bg-green-50 p-4 rounded-md">
                            <p className="text-sm uppercase tracking-wide font-medium text-green-800 mb-1">Registered Address</p>
                            <p className="text-lg font-bold text-charcoal">
                              {result.details.address}, {result.details.city}, {result.details.state} - {result.details.pin}
                            </p>
                          </div>
                          
                          {/* Contact Information */}
                          <div className="bg-green-50 p-4 rounded-md">
                            <p className="text-sm uppercase tracking-wide font-medium text-green-800 mb-1">Phone</p>
                            <p className="text-lg font-bold text-charcoal">{result.details.phone}</p>
                          </div>
                          
                          <div className="bg-green-50 p-4 rounded-md">
                            <p className="text-sm uppercase tracking-wide font-medium text-green-800 mb-1">Email</p>
                            <p className="text-lg font-bold text-charcoal break-words">{result.details.email}</p>
                          </div>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-green-100">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <p className="font-medium text-green-800">This distributor is registered with AMFI and authorized to sell mutual fund products</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* What is ARN section */}
            <div className="bg-mist/30 p-6 rounded-lg mb-8">
              <h2 className="text-xl font-semibold text-charcoal mb-4">What is an ARN?</h2>
              <p className="text-charcoal/80 mb-4">
                AMFI Registration Number (ARN) is a unique identification number issued by the Association of Mutual Funds in India (AMFI) to individuals or entities who have passed the AMFI certification examination and are registered to sell mutual fund products.
              </p>
              <p className="text-charcoal/80">
                Always verify the ARN of your mutual fund distributor before making investments. This helps ensure you're working with a registered professional who follows regulatory guidelines.
              </p>
            </div>
            
            {/* Direct verification link */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
              <h2 className="text-xl font-semibold text-charcoal mb-4">Verify Directly with AMFI</h2>
              <p className="text-charcoal/80 mb-4">
                You can also verify an ARN directly on the official AMFI website:
              </p>
              <a 
                href="https://www.amfiindia.com/locate-distributors" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-secondary inline-block"
              >
                Visit AMFI Website
              </a>
              <p className="mt-4 text-xs text-charcoal/60">
                External link: This will open in a new tab and take you to the official AMFI website.
              </p>
            </div>
            
            {/* Compliance notice */}
            <div className="mb-6">
              <ComplianceNotice type="minimal" />
            </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
