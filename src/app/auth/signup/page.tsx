'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

function SignUpForm() {
  const searchParams = useSearchParams();
  const { signup, isAuthenticated } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) window.location.href = redirectTo;
  }, [isAuthenticated, redirectTo]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const pv = value.replace(/^\+?91-?/, '').replace(/\D/g, '').slice(0, 10);
      setForm(prev => ({ ...prev, phone: pv ? `+91-${pv}` : '' }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validate = (): string | null => {
    if (!form.firstName.trim()) return 'First name is required.';
    if (!form.lastName.trim()) return 'Last name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Valid email required.';
    if (form.phone) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length !== 12) return 'Enter a valid 10-digit Indian phone number.';
    }
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    if (!agreedToTerms) return 'Please agree to the Terms of Service.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setIsLoading(true);
    setError('');
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const result = await signup(form.email, form.password, fullName, form.phone || undefined);
    if (result.success) {
      window.location.href = redirectTo;
    } else {
      setError(result.error ?? 'Sign up failed. Please try again.');
      setIsLoading(false);
    }
  };

  const inputBase =
    'w-full bg-[#0a1510] border rounded-xl px-4 py-3.5 text-base text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none transition-all font-["Inter"]';

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = '#44f593';
      e.currentTarget.style.boxShadow = '0 0 14px rgba(68,245,147,0.15)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = 'rgba(133,149,134,0.2)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  return (
    <div className="bg-[#060D0A] min-h-screen flex items-center justify-center relative overflow-hidden py-14">

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
      <div className="max-w-xl w-full mx-6 relative z-10">
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
              Sign Up
            </h1>
            <p className="text-base text-[#859586] mt-2 font-['Inter']">
              Join — institutional-grade wealth management for everyone
            </p>
          </div>

          {/* Form */}
          <div className="px-10 py-8">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Error */}
              {error && (
                <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] px-4 py-3 rounded-xl text-base flex items-center gap-3 font-['Inter']">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Name row */}
              <div className="grid grid-cols-2 gap-4">
                {(['firstName', 'lastName'] as const).map(field => (
                  <div key={field} className="space-y-2">
                    <label className="text-sm font-['Inter'] font-semibold text-[#9eaaa4] uppercase tracking-wide block">
                      {field === 'firstName' ? 'First Name' : 'Last Name'}
                    </label>
                    <input
                      type="text"
                      name={field}
                      value={form[field]}
                      onChange={handleChange}
                      required
                      placeholder={field === 'firstName' ? 'Rahul' : 'Sharma'}
                      className={inputBase}
                      style={{ borderColor: 'rgba(133,149,134,0.2)' }}
                      {...focusHandlers}
                    />
                  </div>
                ))}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-['Inter'] font-semibold text-[#9eaaa4] uppercase tracking-wide block">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className={inputBase}
                  style={{ borderColor: 'rgba(133,149,134,0.2)' }}
                  {...focusHandlers}
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-['Inter'] font-semibold text-[#9eaaa4] uppercase tracking-wide block">
                  Phone <span className="normal-case tracking-normal text-[#3c4a3e] font-normal">(Optional)</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91-9999999999"
                  className={inputBase}
                  style={{ borderColor: 'rgba(133,149,134,0.2)' }}
                  {...focusHandlers}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-['Inter'] font-semibold text-[#9eaaa4] uppercase tracking-wide">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="text-sm text-[#44f593] hover:underline font-['Inter']"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="Min 8 characters"
                  className={inputBase}
                  style={{ borderColor: 'rgba(133,149,134,0.2)' }}
                  {...focusHandlers}
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-sm font-['Inter'] font-semibold text-[#9eaaa4] uppercase tracking-wide block">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Repeat password"
                  className={inputBase}
                  style={{ borderColor: 'rgba(133,149,134,0.2)' }}
                  {...focusHandlers}
                />
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer group select-none">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={agreedToTerms}
                  onClick={() => setAgreedToTerms(v => !v)}
                  className={[
                    'w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border transition-all duration-200',
                    agreedToTerms
                      ? 'bg-[#44f593] border-[#44f593]'
                      : 'border-[#3c4a3e] bg-transparent group-hover:border-[#44f593]/50',
                  ].join(' ')}
                >
                  {agreedToTerms && (
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#001f10" strokeWidth="3.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
                <span className="text-base text-[#859586] leading-relaxed font-['Inter'] group-hover:text-[#c4cfc9] transition-colors">
                  I agree to the{' '}
                  <Link href="/disclosures" className="text-[#44f593] hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/disclosures" className="text-[#44f593] hover:underline">Privacy Policy</Link>.
                  {' '}Mutual fund investments are subject to market risks.
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-['Space_Grotesk'] font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-1 group"
                style={{ background: 'linear-gradient(to right, #44f593, #00d87a)', color: '#00391c' }}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creating Account…
                  </>
                ) : (
                  <>
                    Create Account
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-10 py-6 bg-white/[0.02] border-t border-white/5 text-center">
            <p className="text-[#859586] text-base font-['Inter']">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-[#44f593] font-semibold hover:underline">
                Sign In
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

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
