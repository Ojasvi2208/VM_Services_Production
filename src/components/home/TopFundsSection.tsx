'use client';
// ─── TopFundsSection (InstitutionalFunds) ────────────────────
// Grid-cols-12: main 8 (2 fund cards) + sidebar 4 (Active NFOs)
// Fetches /api/mutual-fund-data for top 2 funds
// Fetches /api/nfo/live for up to 3 active NFOs
// Design: Design_Revamp/HomePage.html § Institutional Funds
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Fund {
  fundName?: string;
  schemeName?: string;
  category?: string;
  schemeCode?: string;
  returns?: { oneYear?: number; threeYear?: number };
  cagr3Y?: number;
  changePercent?: string;
  isPositive?: boolean;
  fundHouse?: string;
}

interface NFOItem {
  id?: string;
  schemeName: string;
  amcName?: string;
  closeDate?: string;
  daysLeft?: number;
}

function daysLeftCalc(closeDateStr?: string): number | null {
  if (!closeDateStr) return null;
  const diff = new Date(closeDateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
}

function FundCard({
  tag,
  icon,
  name,
  description,
  metricLabel,
  metricValue,
  href,
}: {
  tag: string;
  icon: string;
  name: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-[#0d1512] p-8 rounded-2xl border border-[#3c4a3e]/10 hover:border-[#44f593]/30 transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-8">
        <div className="bg-[#44f593]/5 p-3 rounded-lg">
          <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 0" }}>{icon}</span>
        </div>
        <span className="text-xs font-mono bg-[#242c28] text-[#44f593] px-2 py-1 rounded">
          {tag}
        </span>
      </div>
      <h4 className="text-2xl font-['Space_Grotesk'] font-bold text-[#dce5df] mb-2">{name}</h4>
      <p className="text-[#859586] text-base mb-6">{description}</p>
      <div className="flex justify-between items-end">
        <div>
          <span className="text-[#859586] text-xs uppercase block mb-1">{metricLabel}</span>
          <span className="font-mono text-[#44f593] text-2xl font-bold">{metricValue}</span>
        </div>
        <span
          className="material-symbols-outlined text-[#859586] group-hover:text-[#44f593] transition-colors"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          add_circle
        </span>
      </div>
    </Link>
  );
}

export default function TopFundsSection() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [nfos, setNfos] = useState<NFOItem[]>([]);

  useEffect(() => {
    fetch('/api/mutual-fund-data')
      .then(r => r.json())
      .then(json => {
        const data: Fund[] = json?.data ?? json ?? [];
        setFunds(data.slice(0, 2));
      })
      .catch(() => {});

    fetch('/api/nfo/live?status=all')
      .then(r => r.json())
      .then(json => {
        const data: NFOItem[] = json?.data ?? json?.nfos ?? json ?? [];
        setNfos(data.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  // Build fund card data — use real data if available, fall back to static
  const fund1 = funds[0];
  const fund2 = funds[1];

  return (
    <section className="bg-[#08100d] py-32">
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">

        {/* ── Main: Premier Institutional Funds ── col-span-8 */}
        <div className="lg:col-span-8">
          <h2 className="text-5xl font-['Space_Grotesk'] font-bold text-[#dce5df] mb-12">
            Premier Institutional Funds
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FundCard
              tag="DEBT-ORIENTED"
              icon="account_balance"
              name={fund1?.fundName ?? fund1?.schemeName ?? 'VMFS Liquidity Vault'}
              description="Optimized short-term treasury management with sovereign-backed assets."
              metricLabel="Expected Yield"
              metricValue={
                fund1?.changePercent
                  ? `${fund1.changePercent}%`
                  : '7.82%'
              }
              href={fund1?.schemeCode ? `/funds/${fund1.schemeCode}` : '/funds/search'}
            />
            <FundCard
              tag="EQUITY-ALPHA"
              icon="show_chart"
              name={fund2?.fundName ?? fund2?.schemeName ?? 'Growth Catalyst Fund'}
              description="Aggressive equity exposure focused on mid-cap disruptors with 10x potential."
              metricLabel="3Y CAGR"
              metricValue={
                fund2?.returns?.threeYear
                  ? `${fund2.returns.threeYear.toFixed(2)}%`
                  : fund2?.changePercent
                  ? `${fund2.changePercent}%`
                  : '24.15%'
              }
              href={fund2?.schemeCode ? `/funds/${fund2.schemeCode}` : '/funds/search'}
            />
          </div>
        </div>

        {/* ── Sidebar: Active NFOs ── col-span-4 */}
        <div
          className="lg:col-span-4 rounded-2xl p-8 border border-[#3c4a3e]/5 h-fit"
          style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center gap-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#44f593] animate-ping" aria-hidden="true" />
            <h3 className="text-base font-bold uppercase tracking-widest text-[#dce5df]">Active NFOs</h3>
          </div>

          <div className="space-y-8">
            {nfos.length > 0 ? (
              nfos.map((nfo, i) => {
                const days = nfo.daysLeft ?? daysLeftCalc(nfo.closeDate);
                const urgencyColor =
                  days != null && days <= 2
                    ? 'text-[#ffb4ab]'
                    : days != null && days <= 7
                    ? 'text-[#ffb800]'
                    : 'text-[#44f593]';
                const urgencyText =
                  days != null && days <= 2
                    ? `CLOSING IN ${days} DAYS`
                    : days != null && days <= 7
                    ? `${days} DAYS LEFT`
                    : nfo.closeDate
                    ? `CLOSES ${new Date(nfo.closeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                    : 'OPEN NOW';

                return (
                  <div key={nfo.id ?? i} className="group cursor-pointer">
                    <p className={`font-mono text-xs mb-1 ${urgencyColor}`}>{urgencyText}</p>
                    <h4 className="font-bold text-[#dce5df] group-hover:text-[#44f593] transition-colors line-clamp-2">
                      {nfo.schemeName}
                    </h4>
                    {nfo.closeDate && (
                      <p className="text-[#859586] text-xs mt-1">
                        Close:{' '}
                        {new Date(nfo.closeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              // Static fallback
              <>
                <div className="group cursor-pointer">
                  <p className="text-[#ffb4ab] font-mono text-xs mb-1">CLOSING IN 2 DAYS</p>
                  <h4 className="font-bold text-[#dce5df] group-hover:text-[#44f593] transition-colors">VMFS ESG Leaders Fund</h4>
                  <p className="text-[#859586] text-xs mt-1">NFO Price: ₹10.00</p>
                </div>
                <div className="group cursor-pointer">
                  <p className="text-[#859586] font-mono text-xs mb-1">OPENS MAR 15</p>
                  <h4 className="font-bold text-[#dce5df] group-hover:text-[#44f593] transition-colors">Global REITs Access Vault</h4>
                  <p className="text-[#859586] text-xs mt-1">Minimum: ₹5,00,000</p>
                </div>
                <div className="group cursor-pointer">
                  <p className="text-[#859586] font-mono text-xs mb-1">PRE-IPO STAGE</p>
                  <h4 className="font-bold text-[#dce5df] group-hover:text-[#44f593] transition-colors">Next-Gen FinTech Fund II</h4>
                  <p className="text-[#859586] text-xs mt-1">Exclusive Invite Only</p>
                </div>
              </>
            )}
          </div>

          <Link
            href="/funds/search"
            className="w-full mt-10 py-3 rounded-xl border border-[#3c4a3e] text-[#c4cfc9] font-bold hover:bg-white/5 transition-all block text-center"
          >
            View All Offers
          </Link>
        </div>
      </div>
    </section>
  );
}
