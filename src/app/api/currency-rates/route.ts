import { NextResponse } from 'next/server';

interface CurrencyRate {
  pair: string;
  from: string;
  to: string;
  rate: number;
  change: number;
  changePercent: number;
  flag: string;
  lastUpdated: string;
}

// ── Previous-rate tracking: store last known rates to compute REAL deltas ──
// On first fetch of the day (or after cold start), change = 0 (honest).
// On subsequent fetches, change = current - previous (real movement).
let previousRates: Record<string, number> = {};
let previousRatesDate: string = ''; // YYYY-MM-DD of when previousRates was captured

// Cache for 30 minutes
let ratesCache: { rates: CurrencyRate[]; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  AUD: '🇦🇺',
  CAD: '🇨🇦',
  JPY: '🇯🇵',
  SGD: '🇸🇬',
  AED: '🇦🇪',
  CHF: '🇨🇭',
};

async function fetchCurrencyRates(): Promise<CurrencyRate[]> {
  const rates: CurrencyRate[] = [];
  const targetCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'SGD', 'AED', 'CHF'];

  try {
    // Use open.er-api.com (free, no key needed, 1500 req/month)
    const response = await fetch('https://open.er-api.com/v6/latest/INR', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result === 'success' && data.rates) {
        const today = new Date().toISOString().split('T')[0];
        const currentRates: Record<string, number> = {};

        for (const currency of targetCurrencies) {
          const rateValue = data.rates[currency];
          if (rateValue) {
            const inrPerUnit = Math.round((1 / rateValue) * 100) / 100;
            currentRates[currency] = inrPerUnit;

            // Compute real change from previous fetch
            const prevRate = previousRates[currency];
            const change = prevRate ? Math.round((inrPerUnit - prevRate) * 100) / 100 : 0;
            const changePercent = prevRate ? Math.round((change / prevRate) * 10000) / 100 : 0;

            rates.push({
              pair: `${currency}/INR`,
              from: currency,
              to: 'INR',
              rate: inrPerUnit,
              change,
              changePercent,
              flag: CURRENCY_FLAGS[currency] || '🏳️',
              lastUpdated: data.time_last_update_utc || new Date().toISOString(),
            });
          }
        }

        // Rotate: current rates become "previous" for next comparison
        // Reset daily so first fetch of a new day shows 0 change (honest cold start)
        if (previousRatesDate !== today && Object.keys(previousRates).length > 0) {
          // New day — previous day's final rates are now the baseline
          previousRatesDate = today;
        } else if (Object.keys(previousRates).length === 0) {
          // Very first fetch (cold start) — seed baseline, change = 0 is shown
          previousRatesDate = today;
        }
        previousRates = currentRates;
      }
    }
  } catch (error) {
    console.error('Currency rates fetch error:', error);
  }

  return rates;
}

function getFallbackRates(): CurrencyRate[] {
  return [
    { pair: 'USD/INR', from: 'USD', to: 'INR', rate: 86.45, change: 0.12, changePercent: 0.14, flag: '🇺🇸', lastUpdated: new Date().toISOString() },
    { pair: 'EUR/INR', from: 'EUR', to: 'INR', rate: 89.78, change: -0.23, changePercent: -0.26, flag: '🇪🇺', lastUpdated: new Date().toISOString() },
    { pair: 'GBP/INR', from: 'GBP', to: 'INR', rate: 107.65, change: 0.45, changePercent: 0.42, flag: '🇬🇧', lastUpdated: new Date().toISOString() },
    { pair: 'AUD/INR', from: 'AUD', to: 'INR', rate: 54.32, change: -0.15, changePercent: -0.28, flag: '🇦🇺', lastUpdated: new Date().toISOString() },
    { pair: 'CAD/INR', from: 'CAD', to: 'INR', rate: 60.12, change: 0.08, changePercent: 0.13, flag: '🇨🇦', lastUpdated: new Date().toISOString() },
    { pair: 'JPY/INR', from: 'JPY', to: 'INR', rate: 0.56, change: 0.01, changePercent: 1.82, flag: '🇯🇵', lastUpdated: new Date().toISOString() },
    { pair: 'SGD/INR', from: 'SGD', to: 'INR', rate: 63.89, change: -0.18, changePercent: -0.28, flag: '🇸🇬', lastUpdated: new Date().toISOString() },
    { pair: 'AED/INR', from: 'AED', to: 'INR', rate: 23.54, change: 0.03, changePercent: 0.13, flag: '🇦🇪', lastUpdated: new Date().toISOString() },
  ];
}

export async function GET() {
  try {
    if (ratesCache && Date.now() - ratesCache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        rates: ratesCache.rates,
        source: 'cache',
        timestamp: new Date(ratesCache.timestamp).toISOString(),
      });
    }

    let rates = await fetchCurrencyRates();
    if (rates.length === 0) {
      rates = getFallbackRates();
    }

    ratesCache = { rates, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      rates,
      source: 'live',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Currency rates API error:', error);
    return NextResponse.json({
      success: true,
      rates: getFallbackRates(),
      source: 'fallback',
      timestamp: new Date().toISOString(),
    });
  }
}
