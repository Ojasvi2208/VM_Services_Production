'use client';

import type { RefObject } from 'react';
import type { AutocompleteItem } from '@/hooks/useFundSearch';

interface Props {
  query: string;
  onQueryChange: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
  suggestions: AutocompleteItem[];
  showSuggestions: boolean;
  onSuggestionClick: (s: AutocompleteItem) => void;
  onHideSuggestions: () => void;
  searchInputRef: RefObject<HTMLInputElement>;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function FundDiscoveryHero({
  query, onQueryChange, onSearch, loading,
  suggestions, showSuggestions, onSuggestionClick, onHideSuggestions, searchInputRef,
}: Props) {
  return (
    <section className="relative pt-28 pb-14 md:pt-36 md:pb-18 overflow-hidden bg-[#060D0A]">
      {/* Ambient emerald glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,216,122,0.07) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="vault-container relative z-10">
        {/* Section label */}
        <p className="label-section text-center mb-5 text-[#3D4F47]">
          Global Asset Database
        </p>

        {/* Headline */}
        <h1
          className="font-display font-bold tracking-[-0.03em] text-center leading-[1.05] mb-4"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
        >
          <span className="text-white">Search </span>
          <span className="text-[#00D87A]">50,000+</span>
          <br />
          <span className="text-white">Mutual Funds</span>
        </h1>

        <p className="text-center text-[#7A8C84] text-[0.9375rem] leading-relaxed mb-10 max-w-[52ch] mx-auto">
          Filter by AMC, category, and performance metrics — powered by
          the VMFS Quant Engine.
        </p>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto relative" data-search-root>
          <div
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}
          >
            <span className="text-[#3D4F47] flex-shrink-0 mt-px">
              <SearchIcon />
            </span>

            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onHideSuggestions();
                  onSearch();
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) {
                  /* suggestions visible on next keystroke */
                }
              }}
              placeholder="Search by fund name, AMC, or scheme code…"
              className="flex-1 bg-transparent outline-none text-[0.9375rem] text-[#C4CFC9] placeholder:text-[#3D4F47] min-w-0"
              aria-label="Search mutual funds"
              autoComplete="off"
              spellCheck={false}
            />

            <button
              onClick={() => { onHideSuggestions(); onSearch(); }}
              disabled={loading}
              className="btn-vault-primary px-5 py-2 text-[0.8125rem] flex-shrink-0 disabled:opacity-50"
              aria-label="Search"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#060C08]/30 border-t-[#060C08] rounded-full animate-spin" />
                  Searching
                </span>
              ) : 'Search'}
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden z-50"
              style={{
                background: '#0E1713',
                border: '1px solid rgba(0,216,122,0.15)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.65)',
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={s.schemeCode}
                  onClick={() => onSuggestionClick(s)}
                  className={`w-full text-left px-4 py-3 hover:bg-[#152518] transition-colors duration-150 flex items-center justify-between gap-3 ${
                    i > 0 ? 'border-t border-[#1F2B24]' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[#C4CFC9] text-[0.875rem] font-medium truncate">
                      {s.schemeName}
                    </p>
                    {s.amcCode && (
                      <p className="text-[#3D4F47] text-[0.6875rem] mt-0.5">
                        {s.amcCode.replace(' Mutual Fund', '')}
                      </p>
                    )}
                  </div>
                  <span className="text-[#3D4F47] flex-shrink-0">
                    <ChevronRightIcon />
                  </span>
                </button>
              ))}
              <div className="px-4 py-2.5 bg-[#0A1410] border-t border-[#1F2B24]">
                <p className="text-[0.6875rem] text-[#3D4F47]">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-[#1F2B24] text-[#7A8C84] font-mono text-[0.625rem]">Enter</kbd> to search all results
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
