'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

function SignInForm() {
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  // If already authenticated, redirect immediately via hard navigation
  // (window.location ensures the cookie is sent with the request)
  useEffect(() => {
    if (isAuthenticated) window.location.href = redirectTo;
  }, [isAuthenticated, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await login(email, password, rememberMe);
    if (result.success) {
      // Force a full page navigation to ensure the session cookie is picked up
      // by the destination page's server/client auth check.
      window.location.href = redirectTo;
    } else {
      setError(result.error ?? 'Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  const inputBase =
    'w-full bg-[#0a1510] border rounded-xl px-4 py-3.5 text-base text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none transition-all font-["Inter"]';

  return (
    <div className="bg-[#060D0A] min-h-screen flex items-center justify-center relative overflow-hidden">

      {/* Ambient blobs */}
      <div className="absolute pointer-events-none"
        style={{ top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'rgba(68,245,147,0.05)', borderRadius: '50%', filter: 'blur(120px)' }}
        aria-hidden="true" />
      <div className="absolute pointer-events-none"
        style={{ bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'rgba(68,245,147,0.05)', borderRadius: '50%', filter: 'blur(120px)' }}
        aria-hidden="true" />

      {/* Back link */}
      <Link href="/markets"
        className="absolute top-6 left-6 flex items-center gap-2 text-[#859586] hover:text-[#44f593] transition-colors text-base font-['Inter']">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        Home
      </Link>

      {/* ── Glass Modal ──────────────────────────────────────────── */}
      <div className="max-w-lg w-full mx-6 relative z-10">
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(68,245,147,0.15)',
          boxShadow: '0 0 60px rgba(0,216,122,0.07)',
          borderRadius: '1.25rem',
        }}>

          {/* Header */}
          <div className="px-10 pt-10 pb-7 text-center border-b border-white/5">
            <Link href="/markets" className="inline-flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-[#44f593] text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>
                shield_with_heart
              </span>
              <span className="text-xl font-['Space_Grotesk'] font-bold text-[#44f593] leading-tight">
                Vijay Malik Financial Services
              </span>
            </Link>
            <h1 className="text-3xl font-['Space_Grotesk'] font-bold text-[#dce5df] mt-2">
              Sign In
            </h1>
            <p className="text-base text-[#859586] mt-2 font-['Inter']">
              Access your institutional digital asset portfolio
            </p>
          </div>

          {/* Form */}
          <div className="px-10 py-8">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Error */}
              {error && (
                <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] px-4 py-3 rounded-xl text-base flex items-center gap-3 font-['Inter']">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-['Inter'] font-semibold text-[#9eaaa4] uppercase tracking-wide block">
                  Email Address
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#859586] text-xl"
                    style={{ fontVariationSettings: "'FILL' 0" }}>
                    alternate_email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    required
                    placeholder="you@example.com"
                    className={`${inputBase} pl-12`}
                    style={{ borderColor: 'rgba(133,149,134,0.2)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#44f593'; e.currentTarget.style.boxShadow = '0 0 14px rgba(68,245,147,0.15)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(133,149,134,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-['Inter'] font-semibold text-[#9eaaa4] uppercase tracking-wide">
                    Password
                  </label>
                  <Link href="/auth/forgot-password"
                    className="text-sm text-[#44f593] font-['Inter'] font-medium hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#859586] text-xl"
                    style={{ fontVariationSettings: "'FILL' 0" }}>
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    required
                    placeholder="Enter your password"
                    className={`${inputBase} pl-12 pr-14`}
                    style={{ borderColor: 'rgba(133,149,134,0.2)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#44f593'; e.currentTarget.style.boxShadow = '0 0 14px rgba(68,245,147,0.15)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(133,149,134,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#859586] hover:text-[#dce5df] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe(v => !v)}
                  className={[
                    'w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-all duration-200',
                    rememberMe
                      ? 'bg-[#44f593] border-[#44f593]'
                      : 'border-[#3c4a3e] bg-transparent group-hover:border-[#44f593]/50',
                  ].join(' ')}
                >
                  {rememberMe && (
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#001f10" strokeWidth="3.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
                <span className="text-base text-[#859586] font-['Inter'] group-hover:text-[#c4cfc9] transition-colors">
                  Remember me on this device
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-['Space_Grotesk'] font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
                style={{ background: 'linear-gradient(to right, #44f593, #00d87a)', color: '#00391c' }}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-10 py-6 bg-white/[0.02] border-t border-white/5 text-center">
            <p className="text-[#859586] text-base font-['Inter']">
              New here?{' '}
              <Link href="/auth/signup" className="text-[#44f593] font-semibold hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Trust bar */}
        <div className="mt-8 flex items-center justify-center gap-6 opacity-60 hover:opacity-100 transition-all">
          <div className="flex items-center gap-2 text-[#859586]">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>lock</span>
            <span className="font-['Inter'] text-xs uppercase tracking-widest">256-Bit AES Encryption</span>
          </div>
          <div className="w-px h-4 bg-[#3c4a3e]" />
          <div className="flex items-center gap-2 text-[#859586]">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>verified_user</span>
            <span className="font-['Inter'] text-xs uppercase tracking-widest">AMFI-Reg Status</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[#859586]/40 font-['Inter']">
          Protected by Vijay Malik Financial Services security protocols.
        </p>
      </div>

      {/* Bottom gradient line */}
      <div className="fixed bottom-0 left-0 w-full h-[1px] pointer-events-none"
        style={{ background: 'linear-gradient(to right, transparent, rgba(68,245,147,0.3), transparent)' }}
        aria-hidden="true" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
