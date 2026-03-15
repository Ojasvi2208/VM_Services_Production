import { NextResponse } from 'next/server';
import { pool } from '@/lib/postgres-db';

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

// In-memory cache for 30 minutes (avoid hitting free API rate limit)
let ratesCache: { rates: CurrencyRate[]; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', AUD: '🇦🇺', CAD: '🇨🇦',
  JPY: '🇯🇵', SGD: '🇸🇬', AED: '🇦🇪', CHF: '🇨🇭',
};

// ── DB-persisted previous rates (survives cold starts) ──
// Table: currency_previous_rates — single row, upserted daily
// Schema: id=1, rates_json JSONB, rate_date DATE, updated_at TIMESTAMPTZ

async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS currency_previous_rates (
        id INT PRIMARY KEY DEFAULT 1,
        rates_json JSONB NOT NULL DEFAULT '{}',
        rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (_) {
    // Table likely already exists
  }
}

async function getPreviousRates(): Promise<{ rates: Record<string, number>; date: string }> {
  try {
    const result = await pool.query(
      `SELECT rates_json, rate_date::text FROM currency_previous_rates WHERE id = 1`
    );
    if (result.rows.length > 0) {
      return {
        rates: result.rows[0].rates_json || {},
        date: result.rows[0].rate_date || '',
      };
    }
  } catch (_) {}
  return { rates: {}, date: '' };
}

async function savePreviousRates(rates: Record<string, number>, date: string) {
  try {
    await pool.query(
      `INSERT INTO currency_previous_rates (id, rates_json, rate_date, updated_at)
       VALUES (1, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET
         rates_json = $1,
         rate_date = $2,
         updated_at = NOW()`,
      [JSON.stringify(rates), date]
    );
  } catch (e) {
    console.error('Failed to save previous rates:', e);
  }
}

async function fetchCurrencyRates(): Promise<CurrencyRate[]> {
  const rates: CurrencyRate[] = [];
  const targetCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'SGD', 'AED', 'CHF'];

  try {
    await ensureTable();

    // Fetch live rates
    const response = await fetch('https://open.er-api.com/v6/latest/INR', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) return rates;

    const data = await response.json();
    if (data.result !== 'success' || !data.rates) return rates;

    const today = new Date().toISOString().split('T')[0];
    const currentRates: Record<string, number> = {};

    // Load yesterday's rates from DB (persists across cold starts)
    const { rates: prevRates, date: prevDate } = await getPreviousRates();

    for (const currency of targetCurrencies) {
      const rateValue = data.rates[currency];
      if (!rateValue) continue;

      const inrPerUnit = Math.round((1 / rateValue) * 100) / 100;
      currentRates[currency] = inrPerUnit;

      // Compute change vs previous day's rate
      const prevRate = prevRates[currency];
      let change = 0;
      let changePercent = 0;

      if (prevRate && prevRate > 0) {
        change = Math.round((inrPerUnit - prevRate) * 100) / 100;
        changePercent = Math.round((change / prevRate) * 10000) / 100;
      }

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

    // Persist today's rates as "previous" for tomorrow
    // Logic: if the stored date is older than today, rotate today's rates in
    // This means: on day N, we compare against day N-1's stored rates
    // At end of day N, today's rates become the new baseline for day N+1
    if (prevDate !== today) {
      // New day detected — save current rates as the new baseline
      // But first: if we had previous rates, those were yesterday's.
      // The current comparison already used them. Now store TODAY's rates
      // so tomorrow's first fetch compares against today.
      await savePreviousRates(currentRates, today);
    }
    // If same day: don't overwrite. The baseline stays as the start-of-day snapshot.

    // Edge case: if no previous rates existed at all (first ever run),
    // seed the DB so next fetch has something to compare against
    if (Object.keys(prevRates).length === 0) {
      await savePreviousRates(currentRates, today);
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
