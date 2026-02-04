'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

export default function SignUpPage() {
  const router = useRouter();
  const { signup, isAuthenticated } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Auto-format phone with +91- prefix
    if (name === 'phone') {
      let phoneValue = value;
      if (!phoneValue.startsWith('+91-') && phoneValue.length > 0) {
        phoneValue = phoneValue.replace(/^\+?91-?/, '');
        phoneValue = '+91-' + phoneValue.replace(/\D/g, '').slice(0, 10);
      } else if (phoneValue.startsWith('+91-')) {
        const afterPrefix = phoneValue.slice(4).replace(/\D/g, '').slice(0, 10);
        phoneValue = '+91-' + afterPrefix;
      }
      setFormData(prev => ({ ...prev, phone: phoneValue }));
      return;
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) {
      return 'First name is required';
    }
    if (!formData.lastName.trim()) {
      return 'Last name is required';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    
    if (formData.phone) {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 12) { // 91 + 10 digits
        return 'Please enter a valid 10-digit phone number';
      }
    }
    
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    
    if (!agreedToTerms) {
      return 'Please agree to the Terms of Service';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setIsLoading(true);
    setError('');

    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
    const result = await signup(
      formData.email,
      formData.password,
      fullName,
      formData.phone || undefined
    );

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Signup failed');
      setIsLoading(false);
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-royal/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Back to Home - Top */}
        <div className={`absolute top-6 left-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <Link 
            href="/" 
            className="group flex items-center gap-2 text-white/50 hover:text-white transition-all duration-300"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Home</span>
          </Link>
        </div>

        <div className={`w-full max-w-lg transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
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

          {/* Card */}
          <div className="relative">
            {/* Card glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-royal/20 via-brand-gold/10 to-brand-royal/20 rounded-3xl blur-xl opacity-50" />
            
            <div className="relative bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl shadow-black/20 overflow-hidden">
              {/* Header */}
              <div className="px-8 pt-8 pb-4 text-center border-b border-white/5">
                <h1 className="text-2xl font-semibold text-white tracking-tight">Create your account</h1>
                <p className="text-white/50 mt-2 text-sm">Start your investment journey today</p>
              </div>

              {/* Form */}
              <div className="p-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="firstName" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                        First Name
                      </label>
                      <div className={`relative rounded-xl transition-all duration-300 ${focusedField === 'firstName' ? 'ring-2 ring-brand-royal/50' : ''}`}>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('firstName')}
                          onBlur={() => setFocusedField(null)}
                          required
                          placeholder="John"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3 focus:outline-none focus:bg-white/10 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="lastName" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                        Last Name
                      </label>
                      <div className={`relative rounded-xl transition-all duration-300 ${focusedField === 'lastName' ? 'ring-2 ring-brand-royal/50' : ''}`}>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('lastName')}
                          onBlur={() => setFocusedField(null)}
                          required
                          placeholder="Doe"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3 focus:outline-none focus:bg-white/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                      Email
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
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        required
                        placeholder="you@example.com"
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-2">
                    <label htmlFor="phone" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                      Phone <span className="text-white/30">(Optional)</span>
                    </label>
                    <div className={`relative rounded-xl transition-all duration-300 ${focusedField === 'phone' ? 'ring-2 ring-brand-royal/50' : ''}`}>
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className={`w-5 h-5 transition-colors ${focusedField === 'phone' ? 'text-brand-royal' : 'text-white/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="+91-9876543210"
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="password" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                        Password
                      </label>
                      <div className={`relative rounded-xl transition-all duration-300 ${focusedField === 'password' ? 'ring-2 ring-brand-royal/50' : ''}`}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          required
                          placeholder="Min. 8 chars"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 pr-10 py-3 focus:outline-none focus:bg-white/10 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        >
                          {showPassword ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="confirmPassword" className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                        Confirm
                      </label>
                      <div className={`relative rounded-xl transition-all duration-300 ${focusedField === 'confirmPassword' ? 'ring-2 ring-brand-royal/50' : ''}`}>
                        <input
                          type="password"
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('confirmPassword')}
                          onBlur={() => setFocusedField(null)}
                          required
                          placeholder="Re-enter"
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3 focus:outline-none focus:bg-white/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-3 pt-2">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="w-4 h-4 bg-white/5 border-white/20 rounded text-brand-royal focus:ring-brand-royal/50 focus:ring-offset-0"
                      />
                    </div>
                    <label htmlFor="terms" className="text-sm text-white/50 leading-tight">
                      I agree to the{' '}
                      <Link href="/terms" className="text-white/70 hover:text-white transition-colors">Terms</Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="text-white/70 hover:text-white transition-colors">Privacy Policy</Link>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative w-full group mt-4"
                  >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-royal to-brand-gold rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
                    <div className="relative bg-gradient-to-r from-brand-royal to-brand-navy text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 group-hover:from-brand-royal group-hover:to-brand-royal transition-all duration-300 disabled:opacity-50">
                      {isLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Account</span>
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </div>
                  </button>
                </form>
              </div>

              {/* Footer */}
              <div className="px-8 py-5 bg-white/[0.02] border-t border-white/5 text-center">
                <p className="text-white/40 text-sm">
                  Already have an account?{' '}
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
              <span>256-bit encryption</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2 text-white/30 text-xs">
              <span>ARN 317605</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
