'use client';

// ─── MarketStrip ─────────────────────────────────────────────
// Fixed strip directly below NavBar. Fetches live data from
// /api/market-data (Cloudflare relay → Yahoo Finance).
// Auto-refreshes every 5 minutes. 48px height, 14px mono text.
// Covers: NIFTY 50, SENSEX, BANKNIFTY, NIFTY IT, NIFTY NEXT 50,
//   NIFTY MIDCAP 150, NIFTY SMALLCAP 100, NIFTY PHARMA, NIFTY AUTO,
//   NIFTY FMCG, NIFTY METAL, NIFTY REALTY, NIFTY ENERGY,
//   NIFTY INFRA, NIFTY FIN SERVICE, BSE 500, BSE MIDCAP,
//   BSE SMALLCAP, NIFTY PSE, NIFTY PVT BANK
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';

interface TickerEntry {
  label: string;
  price: string;
  change: string;
  isPositive: boolean;
}

// All symbols to request — covers every index in the API's SYMBOL_MAP
const ALL_SYMBOLS =
  'NIFTY,SENSEX,BANKNIFTY,NIFTYIT,NIFTYNEXT50,NIFTYMIDCAP150,NIFTYSMALLCAP100,' +
  'NIFTYPHARMA,NIFTYAUTO,NIFTYFMCG,NIFTYMETAL,NIFTYREALTY,NIFTYENERGY,' +
  'NIFTYINFRA,NIFTYFINSERVICE,NIFTYPVTBANK,NIFTYPSE,BSE500,BSEMIDCAP,BSESMALLCAP';

const FALLBACK: TickerEntry[] = [
  { label: 'NIFTY 50',         price: '22,123.45', change: '+0.45%', isPositive: true  },
  { label: 'SENSEX',           price: '73,142.10', change: '+0.32%', isPositive: true  },
  { label: 'BANK NIFTY',       price: '47,890.20', change: '-0.18%', isPositive: false },
  { label: 'NIFTY IT',         price: '34,521.75', change: '+1.12%', isPositive: true  },
  { label: 'NIFTY NEXT 50',    price: '61,204.30', change: '+0.67%', isPositive: true  },
  { label: 'NIFTY MIDCAP 150', price: '18,345.60', change: '+0.89%', isPositive: true  },
  { label: 'NIFTY SMALLCAP',   price: '12,780.40', change: '+1.23%', isPositive: true  },
  { label: 'NIFTY PHARMA',     price: '19,432.15', change: '-0.34%', isPositive: false },
  { label: 'NIFTY AUTO',       price: '22,876.90', change: '+0.78%', isPositive: true  },
  { label: 'NIFTY FMCG',       price: '54,321.80', change: '+0.15%', isPositive: true  },
  { label: 'NIFTY METAL',      price: '8,943.25',  change: '-0.52%', isPositive: false },
  { label: 'NIFTY REALTY',     price: '952.40',    change: '+1.45%', isPositive: true  },
  { label: 'BSE 500',          price: '33,201.70', change: '+0.41%', isPositive: true  },
  { label: 'BSE MIDCAP',       price: '45,678.90', change: '+0.93%', isPositive: true  },
];

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export default function MarketStrip() {
  const [tickers, setTickers] = useState<TickerEntry[]>(FALLBACK);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData() {
    try {
      const r = await fetch(`/api/market-data?symbols=${ALL_SYMBOLS}`, { cache: 'no-store' });
      const json = await r.json();
      const data: Array<{ symbol?: string; name?: string; price?: number; changePercent?: number }> =
        json?.data ?? json?.indices ?? [];

      if (!Array.isArray(data) || data.length === 0) return;

      const mapped: TickerEntry[] = data.map(item => ({
        label: item.name ?? item.symbol ?? '—',
        price: (item.price ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
        change: `${(item.changePercent ?? 0) >= 0 ? '+' : ''}${(item.changePercent ?? 0).toFixed(2)}%`,
        isPositive: (item.changePercent ?? 0) >= 0,
      }));

      if (mapped.length > 0) {
        setTickers(mapped);
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch {
      // silently keep existing data
    }
  }

  useEffect(() => {
    loadData();
    timerRef.current = setInterval(loadData, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Duplicate for seamless infinite scroll
  const doubled = [...tickers, ...tickers];

  return (
    <div
      className="fixed left-0 right-0 z-40 overflow-hidden"
      style={{
        top: '80px', // below NavBar (h-20)
        height: '64px',
        background: '#060D0A',
        borderBottom: '1px solid rgba(60,74,62,0.4)',
      }}
      aria-label="Live market ticker"
    >
      <style>{`
        @keyframes ticker-run {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-run {
          display: inline-flex;
          white-space: nowrap;
          animation: ticker-run 63s linear infinite;
        }
      `}</style>

      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #060D0A, transparent)' }} />
      <div className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, #060D0A, transparent)' }} />

      <div className="ticker-run flex items-center h-full">
        {doubled.map((entry, i) => (
          <div key={i} className="flex items-center gap-3 shrink-0" style={{ padding: '0 28px' }}>
            {/* Dot separator */}
            {i !== 0 && (
              <span className="w-1 h-1 rounded-full bg-[#3c4a3e] shrink-0 mr-1" aria-hidden="true" />
            )}
            <span className="font-['JetBrains_Mono'] text-[15px] font-medium text-[#859586] whitespace-nowrap uppercase tracking-wide">
              {entry.label}
            </span>
            <span className="font-['JetBrains_Mono'] text-[16px] font-semibold text-[#dce5df] whitespace-nowrap">
              {entry.price}
            </span>
            <span
              className="font-['JetBrains_Mono'] text-[15px] font-bold whitespace-nowrap"
              style={{ color: entry.isPositive ? '#44f593' : '#ff4757' }}
            >
              {entry.change}
            </span>
          </div>
        ))}
      </div>

      {/* Last updated timestamp — far right, above the fade */}
      {lastUpdated && (
        <div className="absolute right-20 top-1/2 -translate-y-1/2 z-20">
          <span className="font-['JetBrains_Mono'] text-xs text-[#3c4a3e] uppercase tracking-widest">
            {lastUpdated}
          </span>
        </div>
      )}
    </div>
  );
}
