'use client';
// ─── NFOSection ──────────────────────────────────────────────
// Recently Launched Funds — wired to /api/nfo/live
// Shows daysLeft countdown badge + category + close date.
// No "Open Now" badge (per Android spec).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface NFOItem {
  id: string;
  schemeName: string;
  amcName: string;
  category: string;
  subCategory: string;
  riskLevel: string;
  closeDate?: string;
  minInvestment?: number;
  status?: string;
}

function daysLeft(closeDateStr?: string): number | null {
  if (!closeDateStr) return null;
  const diff = new Date(closeDateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
}

function riskColor(risk: string) {
  if (risk === 'Low') return 'text-[#00D87A] bg-[#00D87A]/10';
  if (risk === 'Moderate' || risk === 'Moderately High') return 'text-[#FFB800] bg-[#FFB800]/10';
  return 'text-[#FF4757] bg-[#FF4757]/10';
}

function NFOCard({ nfo }: { nfo: NFOItem }) {
  const days = daysLeft(nfo.closeDate);
  return (
    <div
      className="glass-card-vi flex flex-col gap-3 p-4 rounded-xl transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.6rem] font-semibold tracking-[0.08em] uppercase text-[#7A8C84] mb-0.5 truncate">{nfo.amcName}</p>
          <h3 className="text-[#C4CFC9] text-[0.875rem] font-semibold leading-snug line-clamp-2">{nfo.schemeName}</h3>
        </div>
        {/* Days left badge */}
        {days !== null && days > 0 && (
          <span className={`flex-shrink-0 px-2 py-1 rounded-lg text-[0.65rem] font-bold tracking-[0.05em] text-center leading-none
            ${days <= 3 ? 'bg-[#FF4757]/15 text-[#FF4757]' : days <= 7 ? 'bg-[#FFB800]/15 text-[#FFB800]' : 'bg-[#00D87A]/10 text-[#00D87A]'}`}>
            {days}d<br/>left
          </span>
        )}
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-[0.06em] bg-[#1A4D2E] text-[#00D87A]">
          {nfo.category}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-[0.06em] ${riskColor(nfo.riskLevel)}`}>
          {nfo.riskLevel} Risk
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] mt-auto">
        <div>
          <p className="text-[0.6875rem] text-[#7A8C84]">Min. Investment</p>
          <p className="numeric font-semibold text-white text-[0.875rem]">₹{(nfo.minInvestment ?? 500).toLocaleString('en-IN')}</p>
        </div>
        {nfo.closeDate && (
          <div className="text-right">
            <p className="text-[0.6875rem] text-[#7A8C84]">Closes</p>
            <p className="text-[0.8125rem] font-medium text-[#C4CFC9]">
              {new Date(nfo.closeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function NFOCardSkeleton() {
  return (
    <div className="rounded-xl p-4 animate-pulse" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="h-3 w-24 bg-white/10 rounded mb-2"/>
      <div className="h-4 w-full bg-white/10 rounded mb-1"/>
      <div className="h-4 w-3/4 bg-white/10 rounded mb-4"/>
      <div className="flex gap-2 mb-4">
        <div className="h-4 w-16 bg-white/10 rounded-full"/>
        <div className="h-4 w-16 bg-white/10 rounded-full"/>
      </div>
      <div className="h-px bg-white/5 mb-3"/>
      <div className="flex justify-between">
        <div className="h-4 w-20 bg-white/10 rounded"/>
        <div className="h-4 w-14 bg-white/10 rounded"/>
      </div>
    </div>
  );
}

export default function NFOSection() {
  const [nfos, setNfos] = useState<NFOItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/nfo/live?status=all')
      .then(r => r.json())
      .then(json => {
        const data: NFOItem[] = json?.data || json?.nfos || json || [];
        setNfos(data.slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && nfos.length === 0) return null;

  return (
    <section className="bg-[#060D0A] py-16 border-t border-[#1F2B24]" aria-labelledby="nfo-heading">
      <div className="vault-container">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 id="nfo-heading" className="font-display font-bold tracking-[-0.025em] text-[clamp(1.5rem,2.5vw,2rem)]">
              <span className="text-white">Recently Launched </span>
              <span className="text-[#00D87A]">Funds</span>
            </h2>
            <p className="text-[#7A8C84] text-[0.875rem] mt-1">New fund offerings — sourced from AMFI daily</p>
          </div>
          <Link href="/funds/search" className="hidden md:flex items-center gap-1.5 text-[0.8125rem] text-[#7A8C84] hover:text-[#00D87A] transition-colors">
            View all NFOs
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <NFOCardSkeleton key={i}/>)
            : nfos.map(nfo => <NFOCard key={nfo.id} nfo={nfo}/>)
          }
        </div>
      </div>
    </section>
  );
}
