'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

type Step = 'email' | 'otp' | 'newPassword' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.emailVerified) {
        setMaskedEmail(data.maskedEmail);
        setStep('otp');
        setResendTimer(60);
      } else {
        setError(data.error || 'No account found with this email address');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    if (pastedData.length === 6) {
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpString }),
      });

      const data = await response.json();

      if (response.ok && data.resetToken) {
        setResetToken(data.resetToken);
        setStep('newPassword');
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('success');
      } else {
        setError(data.error || 'Failed to reset password');
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
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setResendTimer(60);
      }
    } catch {
      setError('Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'email': return 'Reset Password';
      case 'otp': return 'Enter OTP';
      case 'newPassword': return 'New Password';
      case 'success': return 'Success!';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'email': return 'Enter your email to receive an OTP';
      case 'otp': return `We sent a 6-digit code to ${maskedEmail}`;
      case 'newPassword': return 'Create a new secure password';
      case 'success': return 'Your password has been reset';
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Premium Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Subtle animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-royal/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Back Button */}
        <div className={`absolute top-6 left-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <Link 
            href="/auth/signin" 
            className="group flex items-center gap-2 text-white/50 hover:text-white transition-all duration-300"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back to Sign In</span>
          </Link>
        </div>

        <div className={`w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block group">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:bg-white/30 transition-all duration-500" />
                <div className="relative bg-white rounded-2xl p-4 shadow-2xl shadow-black/20 border border-white/10 group-hover:scale-105 transition-transform duration-300">
                  <Image
                    src="/images/VM_Logo.jpg"
                    alt="VM Financial Services"
                    width={180}
                    height={45}
                    className="h-10 w-auto object-contain"
                  />
                </div>
              </div>
            </Link>
          </div>

          {/* Progress Steps */}
          {step !== 'success' && (
            <div className="flex justify-center gap-2 mb-6">
              {['email', 'otp', 'newPassword'].map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step ? 'w-8 bg-brand-royal' : 
                    ['email', 'otp', 'newPassword'].indexOf(step) > i ? 'w-4 bg-brand-gold' : 'w-4 bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-royal/20 via-brand-gold/10 to-brand-royal/20 rounded-3xl blur-xl opacity-50" />
            
            <div className="relative bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl shadow-black/20 overflow-hidden">
              {/* Header */}
              <div className="px-8 pt-8 pb-4 text-center border-b border-white/5">
                <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${step === 'success' ? 'bg-green-500/20' : 'bg-brand-royal/20'}`}>
                  {step === 'success' ? (
                    <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : step === 'otp' ? (
                    <svg className="w-7 h-7 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  )}
                </div>
                <h1 className="text-xl font-semibold text-white tracking-tight">{getStepTitle()}</h1>
                <p className="text-white/50 mt-1 text-sm">{getStepDescription()}</p>
              </div>

              {/* Form Content */}
              <div className="p-8">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {/* Step: Email */}
                {step === 'email' && (
                  <form onSubmit={handleEmailSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="email" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                        Email Address
                      </label>
                      <div className={`relative rounded-xl transition-all duration-300 ${focusedField === 'email' ? 'ring-2 ring-brand-royal/50' : ''}`}>
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className={`w-5 h-5 transition-colors ${focusedField === 'email' ? 'text-brand-royal' : 'text-white/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          id="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(''); }}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField(null)}
                          required
                          placeholder="you@example.com"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:bg-white/10 transition-all"
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="relative w-full group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-royal to-brand-gold rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
                      <div className="relative bg-gradient-to-r from-brand-royal to-brand-navy text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? (
                          <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><span>Sending OTP...</span></>
                        ) : (
                          <><span>Send OTP</span><svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></>
                        )}
                      </div>
                    </button>
                  </form>
                )}

                {/* Step: OTP */}
                {step === 'otp' && (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { otpRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/20 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-royal/50 focus:bg-white/10 transition-all"
                        />
                      ))}
                    </div>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendTimer > 0 || isLoading}
                        className="text-sm text-white/50 hover:text-white disabled:text-white/30 transition-colors"
                      >
                        {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                      </button>
                    </div>

                    <button type="submit" disabled={isLoading || otp.join('').length !== 6} className="relative w-full group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-royal to-brand-gold rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
                      <div className="relative bg-gradient-to-r from-brand-royal to-brand-navy text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? (
                          <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><span>Verifying...</span></>
                        ) : (
                          <span>Verify OTP</span>
                        )}
                      </div>
                    </button>
                  </form>
                )}

                {/* Step: New Password */}
                {step === 'newPassword' && (
                  <form onSubmit={handleResetPassword} className="space-y-5">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/60 uppercase tracking-wider">New Password</label>
                      <div className={`relative rounded-xl transition-all duration-300 ${focusedField === 'newPassword' ? 'ring-2 ring-brand-royal/50' : ''}`}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                          onFocus={() => setFocusedField('newPassword')}
                          onBlur={() => setFocusedField(null)}
                          required
                          placeholder="Min. 8 characters"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 pr-12 py-3.5 focus:outline-none focus:bg-white/10 transition-all"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/60 uppercase tracking-wider">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        required
                        placeholder="Re-enter password"
                        className={`w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3.5 focus:outline-none focus:bg-white/10 transition-all ${focusedField === 'confirmPassword' ? 'ring-2 ring-brand-royal/50' : ''}`}
                      />
                    </div>

                    <button type="submit" disabled={isLoading} className="relative w-full group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-royal to-brand-gold rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
                      <div className="relative bg-gradient-to-r from-brand-royal to-brand-navy text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? (
                          <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><span>Resetting...</span></>
                        ) : (
                          <span>Reset Password</span>
                        )}
                      </div>
                    </button>
                  </form>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                  <div className="text-center space-y-6">
                    <p className="text-white/70 text-sm">
                      Your password has been successfully reset. You can now sign in with your new password.
                    </p>
                    <button
                      onClick={() => router.push('/auth/signin')}
                      className="relative w-full group"
                    >
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-royal to-brand-gold rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
                      <div className="relative bg-gradient-to-r from-brand-royal to-brand-navy text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2">
                        <span>Sign In Now</span>
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 py-5 bg-white/[0.02] border-t border-white/5 text-center">
                <p className="text-white/40 text-sm">
                  Remember your password?{' '}
                  <Link href="/auth/signin" className="text-white font-medium hover:text-brand-gold transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className={`mt-8 flex items-center justify-center gap-6 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-center gap-2 text-white/30 text-xs">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure OTP verification</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
