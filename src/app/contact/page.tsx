'use client';

import { useState } from 'react';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: 'general', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await new Promise(r => setTimeout(r, 800)); // simulate send
      setSubmitted(true);
    } catch {
      setError('Failed to send. Please try emailing us directly.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:border-[#44f593]/50 transition-all';
  const labelCls = 'text-xs font-mono text-[#859586] uppercase tracking-widest block mb-1.5';

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* Header */}
        <header className="mb-14 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Get in Touch
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Have a question about your portfolio, investments, or our platform? We&apos;re here to help.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left info */}
          <div className="lg:col-span-4 space-y-6">
            {[
              {
                icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
                label: 'Email',
                value: 'info@vmfinancialservices.com',
                href: 'mailto:info@vmfinancialservices.com',
              },
              {
                icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
                label: 'Phone',
                value: '+91 94173 34348',
                href: 'tel:+919417334348',
              },
              {
                icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
                label: 'Office',
                value: 'Motiaz Royal City, Zirakpur, Punjab',
                href: 'https://maps.google.com/?q=Motiaz+Royal+City+Zirakpur+Punjab',
              },
            ].map(item => (
              <div key={item.label} className="glass-card rounded-2xl p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-1">{item.label}</p>
                  <a href={item.href} className="text-sm text-[#dce5df] hover:text-[#44f593] transition-colors">
                    {item.value}
                  </a>
                </div>
              </div>
            ))}

            {/* Compliance */}
            <div className="glass-card rounded-2xl p-5 bg-[#44f593]/5 border-[#44f593]/20">
              <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-3">Regulatory</p>
              <p className="text-xs text-[#c0c9c2] leading-relaxed">
                Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor. ARN-317605.
                We act as an MFD and may receive trail commissions from AMCs.
                We do not provide fee-based investment advice.
              </p>
              <p className="text-xs text-[#859586] mt-3">
                Mutual fund investments are subject to market risks. Read all scheme related documents carefully.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-8">
            <div className="glass-card rounded-3xl p-5 md:p-8">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center mx-auto mb-6">
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-bold text-[#dce5df] mb-2">Message Sent</h3>
                  <p className="text-[#859586] text-sm">We&apos;ll get back to you within 24 hours. Thank you!</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="text-lg font-display font-bold text-[#dce5df] mb-6">Send a Message</h3>

                  {error && (
                    <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] px-4 py-3 rounded-xl text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelCls}>Your Name</label>
                      <input name="name" value={form.name} onChange={handleChange} required placeholder="Rahul Sharma" className={inputCls}/>
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" className={inputCls}/>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelCls}>Phone (optional)</label>
                      <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+91-9999999999" className={inputCls}/>
                    </div>
                    <div>
                      <label className={labelCls}>Subject</label>
                      <select name="subject" value={form.subject} onChange={handleChange} className={inputCls}>
                        <option value="general">General Inquiry</option>
                        <option value="portfolio">Portfolio Question</option>
                        <option value="technical">Technical Support</option>
                        <option value="premium">Premium Subscription</option>
                        <option value="complaint">Complaint / Feedback</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Message</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      placeholder="Tell us how we can help…"
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] py-4 rounded-xl font-bold text-base hover:scale-[1.01] active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Sending…
                      </>
                    ) : (
                      <>
                        Send Message
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
        <ComplianceDisclaimer variant="general" className="mt-8" />
      </main>

      <SiteFooter />
    </div>
  );
}
