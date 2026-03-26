'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter }  from 'next/navigation';
import Link           from 'next/link';
import Image          from 'next/image';
import { obfuscateForTransport } from '@/lib/encryption-client';

type Step = 'email' | 'otp' | 'newPassword' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step,             setStep]            = useState<Step>('email');
  const [email,            setEmail]           = useState('');
  const [maskedEmail,      setMaskedEmail]     = useState('');
  const [otp,              setOtp]             = useState(['', '', '', '', '', '']);
  const [newPassword,      setNewPassword]     = useState('');
  const [confirmPassword,  setConfirmPassword] = useState('');
  const [showPassword,     setShowPassword]    = useState(false);
  const [resetToken,       setResetToken]      = useState('');
  const [isLoading,        setIsLoading]       = useState(false);
  const [error,            setError]           = useState('');
  const [resendTimer,      setResendTimer]     = useState(0);
  const [mounted,          setMounted]         = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── Step 1: email → OTP ────────────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.emailVerified) {
        setMaskedEmail(data.maskedEmail);
        setStep('otp');
        setResendTimer(60);
      } else {
        setError(data.error || 'No account found with this email address.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: OTP → reset token ──────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setError('');
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next   = [...otp];
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    setOtp(next);
    if (digits.length === 6) otpRefs.current[5]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { setError('Please enter the complete 6-digit OTP.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (res.ok && data.resetToken) {
        setResetToken(data.resetToken);
        setStep('newPassword');
      } else {
        setError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    setError('');
    setOtp(['', '', '', '', '', '']);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      if (res.ok) setResendTimer(60);
      else setError('Failed to resend OTP.');
    } catch {
      setError('Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: new password ───────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsLoading(true);
    setError('');
    try {
      // Obfuscate password for transport (matches signup/signin pattern)
      const obfuscated = obfuscateForTransport(newPassword);
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resetToken, newPassword: obfuscated }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('success');
      } else {
        setError(data.error || 'Failed to reset password. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step config ────────────────────────────────────────────────────────────
  const STEPS: { id: Step; title: string; sub: string }[] = [
    { id: 'email',       title: 'Reset Password',    sub: 'Enter your email to receive a one-time code' },
    { id: 'otp',         title: 'Verify Code',       sub: `Code sent to ${maskedEmail}` },
    { id: 'newPassword', title: 'New Password',       sub: 'Create a strong new password' },
    { id: 'success',     title: 'Password Reset',     sub: 'Your password has been successfully updated' },
  ];
  const current = STEPS.find(s => s.id === step)!;
  const stepIndex = STEPS.findIndex(s => s.id === step);

  // ── Input class helper ─────────────────────────────────────────────────────
  const inputCls = 'w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3.5 text-sm text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:border-[#44f593]/60 focus:ring-1 focus:ring-[#44f593]/20 transition-all';

  return (
    <div className="min-h-screen bg-[#060D0A] relative flex flex-col items-center justify-center px-4 py-12 overflow-hidden">

      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-[#44f593]/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-[#00d87a]/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(68,245,147,0.03)_0%,transparent_70%)]" />
      </div>

      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

        {/* Back link */}
        <Link href="/auth/signin"
          className="inline-flex items-center gap-2 text-[#859586] hover:text-[#44f593] text-sm font-medium mb-8 transition-colors group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Sign In
        </Link>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="inline-block group">
            <div className="relative p-3 bg-white rounded-2xl shadow-xl border border-white/10 group-hover:scale-105 transition-transform duration-300">
              <Image
                src="/images/VM_Logo.jpg"
                alt="Vijay Malik Financial Services"
                width={180}
                height={45}
                className="h-10 w-auto object-contain"
              />
            </div>
          </Link>
        </div>

        {/* Progress bar */}
        {step !== 'success' && (
          <div className="flex items-center gap-2 mb-6 px-1">
            {['email', 'otp', 'newPassword'].map((s, i) => (
              <div key={s} className="flex-1 relative">
                <div className={`h-1 rounded-full transition-all duration-500 ${
                  i < stepIndex ? 'bg-[#44f593]' :
                  i === stepIndex ? 'bg-[#44f593]/60' :
                  'bg-[#3c4a3e]'
                }`} />
              </div>
            ))}
          </div>
        )}

        {/* Card */}
        <div className="glass-card rounded-3xl overflow-hidden">

          {/* Card header */}
          <div className="px-8 pt-8 pb-5 border-b border-white/5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${step === 'success' ? 'bg-[#44f593]/15 border border-[#44f593]/25' : 'bg-[#44f593]/10 border border-[#44f593]/20'}`}>
              {step === 'success' ? (
                <svg className="w-6 h-6 text-[#44f593]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : step === 'otp' ? (
                <svg className="w-6 h-6 text-[#44f593]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              ) : step === 'newPassword' ? (
                <svg className="w-6 h-6 text-[#44f593]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-[#44f593]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <h1 className="text-xl font-display font-bold text-[#dce5df]">{current.title}</h1>
            <p className="text-[#859586] text-sm mt-1">{current.sub}</p>
          </div>

          {/* Card body */}
          <div className="p-8">

            {/* Error banner */}
            {error && (
              <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/25 text-[#ffb4ab] px-4 py-3 rounded-xl flex items-center gap-3 mb-5 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* ── Email step ──────────────────────────────────────────────── */}
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div>
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-[#3c4a3e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      required
                      autoFocus
                      placeholder="you@example.com"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] py-4 rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLoading
                    ? <><span className="w-4 h-4 border-2 border-[#001f10]/30 border-t-[#001f10] rounded-full animate-spin" />Sending Code…</>
                    : <>Send OTP<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                  }
                </button>
              </form>
            )}

            {/* ── OTP step ────────────────────────────────────────────────── */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      autoFocus={i === 0}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-2xl font-mono font-bold bg-[#08100d] border border-[#3c4a3e] text-[#dce5df] rounded-xl focus:outline-none focus:border-[#44f593]/60 focus:ring-1 focus:ring-[#44f593]/20 transition-all"
                    />
                  ))}
                </div>

                <div className="text-center">
                  <button type="button" onClick={handleResendOtp}
                    disabled={resendTimer > 0 || isLoading}
                    className="text-xs text-[#859586] hover:text-[#44f593] disabled:text-[#3c4a3e] transition-colors font-mono">
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>

                <button type="submit" disabled={isLoading || otp.join('').length !== 6}
                  className="w-full bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] py-4 rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLoading
                    ? <><span className="w-4 h-4 border-2 border-[#001f10]/30 border-t-[#001f10] rounded-full animate-spin" />Verifying…</>
                    : 'Verify Code'
                  }
                </button>
              </form>
            )}

            {/* ── New password step ───────────────────────────────────────── */}
            {step === 'newPassword' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setError(''); }}
                      required
                      autoFocus
                      placeholder="Min. 8 characters"
                      className={`${inputCls} pr-12`}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#3c4a3e] hover:text-[#859586] transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        {showPassword
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                        }
                      </svg>
                    </button>
                  </div>

                  {/* Password strength hints */}
                  {newPassword.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {[
                        newPassword.length >= 8,
                        /[A-Z]/.test(newPassword),
                        /[0-9]/.test(newPassword),
                        /[^A-Za-z0-9]/.test(newPassword),
                      ].map((met, i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${met ? 'bg-[#44f593]' : 'bg-[#3c4a3e]'}`} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    required
                    placeholder="Re-enter password"
                    className={inputCls}
                  />
                </div>

                <button type="submit" disabled={isLoading}
                  className="w-full bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] py-4 rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                  {isLoading
                    ? <><span className="w-4 h-4 border-2 border-[#001f10]/30 border-t-[#001f10] rounded-full animate-spin" />Resetting…</>
                    : 'Reset Password'
                  }
                </button>
              </form>
            )}

            {/* ── Success step ────────────────────────────────────────────── */}
            {step === 'success' && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-[#44f593]/15 border border-[#44f593]/25 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-[#44f593]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[#859586] text-sm leading-relaxed">
                  Your password has been successfully reset.<br />
                  You can now sign in with your new password.
                </p>
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="w-full bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] py-4 rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-transform flex items-center justify-center gap-2">
                  Sign In Now
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            )}

          </div>

          {/* Card footer */}
          <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5 text-center">
            <p className="text-[#3c4a3e] text-xs">
              Remember your password?{' '}
              <Link href="/auth/signin" className="text-[#859586] hover:text-[#44f593] font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Trust indicators */}
        <div className={`mt-8 flex items-center justify-center gap-6 transition-all duration-700 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-1.5 text-[#3c4a3e] text-[11px] font-mono">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            OTP expires in 10 min
          </div>
          <div className="flex items-center gap-1.5 text-[#3c4a3e] text-[11px] font-mono">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            AES-256 encrypted
          </div>
        </div>

      </div>
    </div>
  );
}
