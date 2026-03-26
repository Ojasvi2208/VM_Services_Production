'use client';

import { useState } from 'react';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';

/**
 * ARN Verification page
 *
 * Security policy: Address, phone, email, PIN of distributor are NOT shown.
 * We expose only regulatory-essential fields: name, ARN, EUIN, validity, KYD, city.
 * This prevents misuse of this tool to harvest distributor contact data.
 */

type VerificationResult = {
  status: 'success' | 'error';
  message: string;
  details?: {
    name: string;
    arnNumber: string;
    validFrom: string;
    validUpto: string;
    city: string;
    euin: string;
    kydCompliant: string;
  };
};

export default function VerifyARNPage() {
  const [arnInput, setArnInput] = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<VerificationResult | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch('/api/verify-arn', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ arnNumber: arnInput }),
      });
      const data = await res.json();
      setResult(res.ok ? data : { status: 'error', message: data.message || 'Failed to verify ARN.' });
    } catch {
      setResult({ status: 'error', message: 'Network error. Please try again later.' });
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:border-[#44f593]/50 transition-all font-mono';

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        <header className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Verify ARN
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Verify the AMFI Registration Number of any mutual fund distributor before investing.
          </p>
        </header>

        <div className="max-w-2xl mx-auto space-y-6">

          {/* Search Form */}
          <div className="glass-card rounded-2xl p-8">
            <h2 className="text-base font-display font-bold text-[#dce5df] mb-5">ARN Verification</h2>
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">
                  Enter ARN Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. ARN-317605"
                  value={arnInput}
                  onChange={e => setArnInput(e.target.value)}
                  required
                  className={inputCls}
                />
                <p className="mt-1.5 text-xs text-[#3c4a3e] font-mono">
                  Format: ARN-XXXXXX (numeric digits only)
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] py-4 rounded-xl font-bold text-base hover:scale-[1.01] active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying…
                  </>
                ) : 'Verify ARN'}
              </button>
            </form>
          </div>

          {/* Result */}
          {result && (
            <div className={`glass-card rounded-2xl p-6 ${result.status === 'success' ? 'border-[#44f593]/20 bg-[#44f593]/5' : 'border-[#ffb4ab]/20 bg-[#ffb4ab]/5'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${result.status === 'success' ? 'bg-[#44f593]/15 border border-[#44f593]/25' : 'bg-[#ffb4ab]/15 border border-[#ffb4ab]/25'}`}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={result.status === 'success' ? '#44f593' : '#ffb4ab'} strokeWidth="2">
                    {result.status === 'success'
                      ? <polyline points="20 6 9 17 4 12" />
                      : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                    }
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-bold ${result.status === 'success' ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                    {result.status === 'success' ? 'Verification Successful' : 'Verification Failed'}
                  </p>
                  <p className="text-xs text-[#859586]">{result.message}</p>
                </div>
              </div>

              {result.details && (
                <div className="border-t border-white/5 pt-5 space-y-4">
                  <h3 className="text-sm font-display font-bold text-[#dce5df]">Distributor Details</h3>

                  {/* Registered name — prominently displayed */}
                  <div className="sm:col-span-2 bg-[#44f593]/5 border border-[#44f593]/15 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-mono text-[#859586] uppercase tracking-widest mb-1">Registered Name</p>
                    <p className="text-base font-bold text-[#dce5df]">{result.details.name}</p>
                  </div>

                  {/* Regulatory fields grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'ARN Number',   value: `ARN-${result.details.arnNumber}` },
                      { label: 'EUIN',          value: result.details.euin || 'N/A' },
                      { label: 'Valid From',    value: result.details.validFrom },
                      { label: 'Valid Until',   value: result.details.validUpto },
                      { label: 'KYD Compliant', value: result.details.kydCompliant, accent: result.details.kydCompliant === 'Yes' },
                      { label: 'City',          value: result.details.city },
                    ].map(item => (
                      <div key={item.label} className="bg-[#161d1a]/50 rounded-xl px-4 py-3">
                        <p className="text-[11px] font-mono text-[#859586] uppercase tracking-widest mb-1">{item.label}</p>
                        <p className={`text-sm font-bold font-mono ${item.accent !== undefined ? (item.accent ? 'text-[#44f593]' : 'text-[#ffb4ab]') : 'text-[#dce5df]'}`}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Privacy notice */}
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[#3c4a3e]/20">
                    <svg width="14" height="14" className="mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#859586" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-xs text-[#859586] leading-relaxed">
                      Address, phone, and email of the distributor are not displayed to protect their personal information as per our privacy policy.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="glass-card rounded-2xl p-5 border-[#44f593]/15 bg-[#44f593]/3">
            <p className="text-xs text-[#859586] leading-relaxed">
              <span className="text-[#44f593] font-semibold">Why verify?</span>{' '}
              Always check that your mutual fund distributor holds a valid AMFI Registration Number before entrusting them with your investments. ARN verification ensures regulatory compliance and investor protection. Data sourced directly from AMFI India.
            </p>
          </div>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
