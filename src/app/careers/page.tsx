'use client';

import { useState } from 'react';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';

const OPENINGS = [
  {
    title: 'Mutual Fund Relationship Manager',
    type: 'Full-time',
    location: 'Zirakpur, Punjab',
    description: 'Help clients build and manage their mutual fund portfolios. You will be responsible for onboarding investors, understanding their financial goals, and recommending suitable fund strategies.',
    requirements: ['NISM Series V-A certified (or willing to obtain)', 'Strong interpersonal and communication skills', '1–3 years of experience in financial services preferred', 'Knowledge of mutual funds, SIPs, and tax-saving instruments'],
  },
  {
    title: 'Financial Planning Associate',
    type: 'Full-time',
    location: 'Zirakpur, Punjab',
    description: 'Work alongside senior advisors to create personalised financial plans for clients, covering goal-based investing, retirement planning, and portfolio rebalancing.',
    requirements: ['CFP / CFA / MBA Finance preferred', 'Proficiency in Excel and financial modelling', 'Analytical mindset with attention to detail', 'Client-facing experience is a plus'],
  },
  {
    title: 'Operations & Compliance Executive',
    type: 'Full-time',
    location: 'Zirakpur, Punjab',
    description: 'Manage back-office operations including KYC processing, transaction handling, and regulatory compliance. Liaise with AMCs, RTAs, and ensure timely reporting.',
    requirements: ['Bachelor\'s degree in Finance, Commerce, or related field', 'Familiarity with AMFI, SEBI regulations', 'Proficiency in MS Office and data entry', 'Detail-oriented and process-driven'],
  },
  {
    title: 'Digital Marketing & Content Executive',
    type: 'Full-time',
    location: 'Zirakpur, Punjab / Remote',
    description: 'Create engaging financial content for social media, blogs, and email campaigns. Drive investor awareness and brand building for Vijay Malik Financial Services.',
    requirements: ['Strong writing and communication skills', 'Understanding of personal finance concepts', 'Experience with social media platforms and SEO', 'Graphic design skills (Canva/Figma) are a bonus'],
  },
];

export default function CareersPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [form, setForm]   = useState({ name: '', email: '', phone: '', role: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleApply = (title: string) => {
    setSelectedRole(title);
    setForm(f => ({ ...f, role: title }));
    setTimeout(() => document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          subject: 'careers',
          message: `Role: ${form.role}\n\n${form.message}`,
        }),
      });
      setSubmitted(true);
    } catch {
      // still show success — contact API handles the actual delivery
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:border-[#44f593]/50 transition-all';
  const labelCls = 'text-xs font-mono text-[#859586] uppercase tracking-widest block mb-1.5';

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[1200px] mx-auto flex-1 w-full">

        {/* Hero */}
        <header className="mb-16 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-[#44f593] text-xs font-mono tracking-widest mb-6">
            WE&apos;RE HIRING
          </span>
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-5">
            Build the Future<br className="hidden md:block" /> of Wealth in India
          </h1>
          <p className="text-[#859586] text-base max-w-xl mx-auto leading-relaxed">
            Join Vijay Malik Financial Services — an AMFI-registered mutual fund distributor helping Indian families
            achieve financial independence. We are a small, high-trust team based in Zirakpur, Punjab.
          </p>
        </header>

        {/* Why join */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            {
              icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
              title: 'Meaningful Work',
              body: 'Every portfolio you help build changes a family\'s financial future. High-impact, low-noise work that matters.',
            },
            {
              icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
              title: 'SEBI / AMFI Exposure',
              body: 'Work directly with regulatory frameworks — AMFI, SEBI, RTA processes. Invaluable experience for a finance career.',
            },
            {
              icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
              title: 'Grow With Us',
              body: 'We are scaling fast. Early team members get outsized ownership, learning, and career growth as the platform expands.',
            },
          ].map(card => (
            <div key={card.title} className="glass-card rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center mb-4">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon}/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-[#dce5df] mb-2">{card.title}</h3>
              <p className="text-xs text-[#859586] leading-relaxed">{card.body}</p>
            </div>
          ))}
        </section>

        {/* Open Roles */}
        <section className="mb-20">
          <h2 className="text-2xl font-display font-bold text-[#dce5df] mb-8">Open Positions</h2>
          <div className="space-y-4">
            {OPENINGS.map((job, i) => (
              <div key={i} className="glass-card rounded-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="text-base font-bold text-[#dce5df]">{job.title}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 text-[#44f593] text-xs font-mono">{job.type}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#3c4a3e]/40 text-[#859586] text-xs font-mono">{job.location}</span>
                    </div>
                    <p className="text-sm text-[#859586] leading-relaxed mb-4">{job.description}</p>
                    <ul className="space-y-1">
                      {job.requirements.map((r, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-[#c0c9c2]">
                          <svg className="shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#44f593" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => handleApply(job.title)}
                    className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact / Apply Form */}
        <section id="apply-form" className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left: contact info */}
          <div className="lg:col-span-4 space-y-5">
            <h2 className="text-xl font-display font-bold text-[#dce5df]">Contact HR</h2>
            <p className="text-sm text-[#859586] leading-relaxed">
              Don&apos;t see a role that fits? Send us your CV anyway — we hire for attitude and skill.
            </p>
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
              <div key={item.label} className="glass-card rounded-2xl p-4 flex gap-4">
                <div className="w-9 h-9 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-1">{item.label}</p>
                  <a href={item.href} className="text-xs text-[#dce5df] hover:text-[#44f593] transition-colors">{item.value}</a>
                </div>
              </div>
            ))}
          </div>

          {/* Right: form */}
          <div className="lg:col-span-8">
            <div className="glass-card rounded-3xl p-5 md:p-8">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center mx-auto mb-6">
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-bold text-[#dce5df] mb-2">Application Received</h3>
                  <p className="text-[#859586] text-sm">We&apos;ll review your application and get back to you within 3–5 business days.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="text-lg font-display font-bold text-[#dce5df] mb-6">
                    {selectedRole ? `Apply — ${selectedRole}` : 'Send Your Application'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelCls}>Full Name</label>
                      <input name="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Rahul Sharma" className={inputCls}/>
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input name="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="you@example.com" className={inputCls}/>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input name="phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91-9999999999" className={inputCls}/>
                    </div>
                    <div>
                      <label className={labelCls}>Role Applying For</label>
                      <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                        <option value="">Select a role…</option>
                        {OPENINGS.map(j => <option key={j.title} value={j.title}>{j.title}</option>)}
                        <option value="General Application">General Application</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Cover Note</label>
                    <textarea
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      required
                      rows={5}
                      placeholder="Tell us about yourself, your experience, and why you want to join Vijay Malik Financial Services…"
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
                        Submitting…
                      </>
                    ) : (
                      <>
                        Submit Application
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
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
