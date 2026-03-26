'use client';

import type { SortMode } from '@/hooks/useFundSearch';

interface Props {
  sortBy: SortMode;
  onSortChange: (s: SortMode) => void;
}

// ── SVG Icons (no font ligatures) ────────────────────────────

function CagrIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00D87A' : '#3D4F47'}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function SharpeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00D87A' : '#3D4F47'}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ExpenseIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#00D87A' : '#3D4F47'}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="16" x2="16" y2="8" />
      <circle cx="9.5" cy="9.5" r="0.5" fill={active ? '#00D87A' : '#3D4F47'} />
      <circle cx="14.5" cy="14.5" r="0.5" fill={active ? '#00D87A' : '#3D4F47'} />
    </svg>
  );
}

// ── Card data ─────────────────────────────────────────────────

const CARDS: {
  id: SortMode;
  label: string;
  description: string;
  Icon: React.ComponentType<{ active: boolean }>;
}[] = [
  {
    id: 'cagr',
    label: 'Sort by CAGR',
    description: 'Highest compounded annual growth rate',
    Icon: CagrIcon,
  },
  {
    id: 'sharpe',
    label: 'Sort by Sharpe',
    description: 'Best risk-adjusted return profile',
    Icon: SharpeIcon,
  },
  {
    id: 'expense',
    label: 'Lowest Expense',
    description: 'Minimum cost, maximum take-home gains',
    Icon: ExpenseIcon,
  },
];

export default function VaultIntelligenceGrid({ sortBy, onSortChange }: Props) {
  return (
    <div className="vault-container py-8">
      <p className="label-section text-[#3D4F47] mb-4">Quick Sort</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CARDS.map(card => {
          const active = sortBy === card.id;
          return (
            <button
              key={card.id}
              onClick={() => onSortChange(active ? 'name' : card.id)}
              aria-pressed={active}
              className="glass-card-vi text-left p-4 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D87A]/50"
              style={{
                background: active ? 'rgba(0,216,122,0.08)' : 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                border: active
                  ? '1px solid rgba(0,216,122,0.30)'
                  : '1px solid rgba(255,255,255,0.10)',
                boxShadow: active
                  ? '0 0 24px rgba(0,216,122,0.12), 0 4px 24px rgba(0,0,0,0.4)'
                  : '0 4px 24px rgba(0,0,0,0.4)',
              }}
            >
              <div className="mb-2.5">
                <card.Icon active={active} />
              </div>
              <p className={`text-[0.9rem] font-semibold font-display tracking-[-0.01em] ${
                active ? 'text-[#00D87A]' : 'text-[#C4CFC9]'
              }`}>
                {card.label}
              </p>
              <p className="text-[0.75rem] text-[#7A8C84] mt-0.5 leading-snug">
                {card.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
