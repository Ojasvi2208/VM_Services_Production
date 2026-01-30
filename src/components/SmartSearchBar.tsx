'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchSuggestion {
  type: 'fund' | 'amc' | 'category' | 'recent';
  title: string;
  subtitle?: string;
  schemeCode?: string;
  icon: string;
}

export default function SmartSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('recentSearches');
    if (recent) {
      setRecentSearches(JSON.parse(recent));
    }
  }, []);

  // Generate suggestions based on query
  useEffect(() => {
    if (query.length === 0) {
      // Show recent searches when empty
      const recentSuggestions: SearchSuggestion[] = recentSearches.slice(0, 5).map(search => ({
        type: 'recent',
        title: search,
        icon: '🕐'
      }));
      setSuggestions(recentSuggestions);
      return;
    }

    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Fetch real suggestions from database
    fetchSuggestions(query);
  }, [query, recentSearches]);

  const fetchSuggestions = async (searchQuery: string) => {
    try {
      const response = await fetch(`/api/funds/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
      const data = await response.json();

      if (data.success && data.funds) {
        const fundSuggestions: SearchSuggestion[] = data.funds.slice(0, 8).map((fund: any) => ({
          type: 'fund' as const,
          title: fund.schemeName,
          subtitle: `₹${fund.latestNav?.toFixed(4)} • Code: ${fund.schemeCode}`,
          schemeCode: fund.schemeCode,
          icon: '💼'
        }));
        setSuggestions(fundSuggestions);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // Fallback to static suggestions
      generateStaticSuggestions(searchQuery);
    }
  };

  const generateStaticSuggestions = (searchQuery: string) => {
    const newSuggestions: SearchSuggestion[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    // AMC suggestions
    const amcs = [
      'HDFC Mutual Fund',
      'ICICI Prudential Mutual Fund',
      'SBI Mutual Fund',
      'Aditya Birla Sun Life Mutual Fund',
      'Axis Mutual Fund',
      'Kotak Mahindra Mutual Fund',
      'Nippon India Mutual Fund',
      'UTI Mutual Fund'
    ];

    amcs.forEach(amc => {
      if (amc.toLowerCase().includes(lowerQuery)) {
        newSuggestions.push({
          type: 'amc',
          title: amc.replace(' Mutual Fund', ''),
          subtitle: 'Asset Management Company',
          icon: '🏢'
        });
      }
    });

    // Category suggestions
    const categories = [
      { name: 'Large Cap Fund', desc: 'Top 100 companies' },
      { name: 'Mid Cap Fund', desc: '101-250 companies' },
      { name: 'Small Cap Fund', desc: '251+ companies' },
      { name: 'ELSS', desc: 'Tax saving funds' },
      { name: 'Liquid Fund', desc: 'Short-term debt' },
      { name: 'Balanced Hybrid Fund', desc: 'Equity + Debt mix' }
    ];

    categories.forEach(cat => {
      if (cat.name.toLowerCase().includes(lowerQuery)) {
        newSuggestions.push({
          type: 'category',
          title: cat.name,
          subtitle: cat.desc,
          icon: '📊'
        });
      }
    });

    // Fund name suggestions (demo data)
    const fundNames = [
      { name: 'HDFC Equity Fund', code: '119551', nav: '856.23' },
      { name: 'HDFC Balanced Advantage Fund', code: '119552', nav: '345.67' },
      { name: 'HDFC Mid-Cap Opportunities Fund', code: '120503', nav: '234.89' },
      { name: 'SBI Bluechip Fund', code: '120465', nav: '567.12' },
      { name: 'ICICI Prudential Bluechip Fund', code: '119226', nav: '789.45' },
      { name: 'Axis Bluechip Fund', code: '120716', nav: '432.78' }
    ];

    fundNames.forEach(fund => {
      if (fund.name.toLowerCase().includes(lowerQuery) || fund.code.includes(query)) {
        newSuggestions.push({
          type: 'fund',
          title: fund.name,
          subtitle: `₹${fund.nav} • Code: ${fund.code}`,
          schemeCode: fund.code,
          icon: '💼'
        });
      }
    });

    // Limit to 8 suggestions
    setSuggestions(newSuggestions.slice(0, 8));
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (query) {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    // Save to recent searches
    const updated = [suggestion.title, ...recentSearches.filter(s => s !== suggestion.title)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    // Navigate based on type
    if (suggestion.type === 'fund' && suggestion.schemeCode) {
      router.push(`/funds/${suggestion.schemeCode}`);
    } else if (suggestion.type === 'amc') {
      router.push(`/funds/advanced-search?amc=${encodeURIComponent(suggestion.title)}`);
    } else if (suggestion.type === 'category') {
      router.push(`/funds/advanced-search?category=${encodeURIComponent(suggestion.title)}`);
    } else {
      setQuery(suggestion.title);
      handleSearch();
    }

    setShowSuggestions(false);
    setQuery('');
  };

  // Handle search
  const handleSearch = () => {
    if (!query.trim()) return;

    // Save to recent searches
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    // Navigate to search results
    router.push(`/funds/advanced-search?q=${encodeURIComponent(query)}`);
    setShowSuggestions(false);
    setQuery('');
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search funds, AMCs, or categories... (Try 'HDFC', 'Large Cap', or 'ELSS')"
          className="w-full px-6 py-4 pl-14 pr-32 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal shadow-lg transition-all"
        />
        
        {/* Search Icon */}
        <div className="absolute left-5 top-1/2 transform -translate-y-1/2">
          <svg className="w-6 h-6 text-brand-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-brand-royal text-white px-6 py-2 rounded-xl font-medium hover:bg-brand-navy transition-all"
        >
          Search
        </button>

        {/* Loading Indicator */}
        {query.length > 0 && (
          <div className="absolute right-28 top-1/2 transform -translate-y-1/2">
            <div className="flex items-center gap-2 text-sm text-brand-navy/60">
              <span className="animate-pulse">●</span>
              <span>{suggestions.length} suggestions</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (query.length > 0 || recentSearches.length > 0) && (
        <div
          ref={suggestionsRef}
          className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-96 overflow-y-auto"
        >
          {query.length === 0 && recentSearches.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-brand-navy/60 uppercase tracking-wide">
                Recent Searches
              </span>
            </div>
          )}

          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSelectSuggestion(suggestion)}
                className={`w-full px-6 py-4 flex items-center gap-4 hover:bg-brand-pearl transition-all text-left ${
                  selectedIndex === index ? 'bg-brand-pearl' : ''
                }`}
              >
                {/* Icon */}
                <div className="text-2xl flex-shrink-0">
                  {suggestion.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-brand-navy truncate">
                    {suggestion.title}
                  </div>
                  {suggestion.subtitle && (
                    <div className="text-sm text-brand-navy/60 truncate">
                      {suggestion.subtitle}
                    </div>
                  )}
                </div>

                {/* Type Badge */}
                <div className="flex-shrink-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    suggestion.type === 'fund' ? 'bg-brand-royal/10 text-brand-royal' :
                    suggestion.type === 'amc' ? 'bg-brand-gold/10 text-brand-gold' :
                    suggestion.type === 'category' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {suggestion.type === 'fund' ? 'Fund' :
                     suggestion.type === 'amc' ? 'AMC' :
                     suggestion.type === 'category' ? 'Category' :
                     'Recent'}
                  </span>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))
          ) : query.length > 0 ? (
            <div className="px-6 py-8 text-center text-brand-navy/60">
              <div className="text-4xl mb-2">🔍</div>
              <div className="font-medium">No suggestions found</div>
              <div className="text-sm mt-1">Try searching for a fund name, AMC, or category</div>
            </div>
          ) : null}

          {/* Quick Tips */}
          {query.length === 0 && (
            <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
              <div className="text-xs text-blue-800">
                <span className="font-semibold">💡 Pro tip:</span> Try "HDFC Large Cap", "SBI ELSS", or just "Liquid Fund"
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 right-0 text-xs text-brand-navy/40 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 bg-gray-100 rounded">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 bg-gray-100 rounded">Enter</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 bg-gray-100 rounded">Esc</kbd> Close
          </span>
        </div>
      )}
    </div>
  );
}
