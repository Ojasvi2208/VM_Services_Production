/**
 * Fuel Cache Cron — DB-backed daily snapshot
 *
 * Runs once daily at 7:00 AM IST (01:30 UTC).
 * Fetches ALL states (1 RapidAPI call) + top 15 high-population states' cities
 * (15 calls) = 16 calls/day, ~480/month — fits the RapidAPI basic tier.
 *
 * Writes one JSONB row to market_cache (key: fuel_prices_all).
 * ALL user requests for /api/fuel-prices read from this single DB row.
 * Zero RapidAPI calls from user-facing requests regardless of concurrent users.
 *
 * Schedule: 30 1 * * * (7:00 AM IST daily)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

const RAPIDAPI_HOST = 'daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/v1/fuel-prices/today/india`;

// Top 15 states by urban population — covers ~85% of user base
// Each is 1 RapidAPI call. Total: 15 + 1 (states) = 16 calls/day
const STATES_TO_PREFETCH_CITIES = [
  'maharashtra', 'delhi', 'uttar-pradesh', 'karnataka', 'tamil-nadu',
  'west-bengal', 'telangana', 'gujarat', 'rajasthan', 'andhra-pradesh',
  'punjab', 'haryana', 'kerala', 'madhya-pradesh', 'bihar',
];

export interface CityFuelPrice {
  name: string;
  state: string;
  petrol: number;
  diesel: number;
  cng: number | null;
  petrolChange: number;
  dieselChange: number;
}

export interface StateFuelPrice {
  petrol: number;
  diesel: number;
  cng: number | null;
  petrolChange: number;
  dieselChange: number;
}

export interface FuelCachePayload {
  fetchedAt: string;
  states: Record<string, StateFuelPrice>;    // "Maharashtra" → prices
  cities: Record<string, CityFuelPrice>;     // "mumbai" → prices (lowercase slug)
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

// ── RapidAPI helpers ──────────────────────────────────────────────────────────
async function rapidFetch(path: string): Promise<any> {
  const apiKey = process.env.RAPIDAPI_FUEL_KEY || '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${RAPIDAPI_BASE}${path}`, {
      headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': apiKey },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function toNum(v: any): number { return parseFloat(String(v ?? 0)) || 0; }

// ── Fetch all states ──────────────────────────────────────────────────────────
async function fetchAllStates(): Promise<Record<string, StateFuelPrice>> {
  const data = await rapidFetch('/states');
  if (!data?.statePrices) return {};

  const out: Record<string, StateFuelPrice> = {};
  for (const sp of data.statePrices) {
    const name = String(sp.stateName || '').trim();
    if (!name) continue;
    out[name] = {
      petrol:       toNum(sp.fuel?.petrol?.retailPrice),
      diesel:       toNum(sp.fuel?.diesel?.retailPrice),
      cng:          sp.fuel?.cng?.retailPrice ? toNum(sp.fuel.cng.retailPrice) : null,
      petrolChange: toNum(sp.fuel?.petrol?.retailPriceChange),
      dieselChange: toNum(sp.fuel?.diesel?.retailPriceChange),
    };
  }
  return out;
}

// ── Fetch cities for one state slug ──────────────────────────────────────────
async function fetchCitiesForState(
  stateSlug: string,
  stateDisplayName: string
): Promise<Record<string, CityFuelPrice>> {
  const data = await rapidFetch(`/${stateSlug}/cities`);
  if (!data?.cityPrices) return {};

  const out: Record<string, CityFuelPrice> = {};
  for (const cp of data.cityPrices) {
    const rawName = String(cp.cityName || cp.cityId || '').trim();
    const slug = (cp.cityId || rawName).toLowerCase().replace(/\s+/g, '-');
    if (!slug) continue;

    out[slug] = {
      name:         rawName,
      state:        stateDisplayName,
      petrol:       toNum(cp.fuel?.petrol?.retailPrice),
      diesel:       toNum(cp.fuel?.diesel?.retailPrice),
      cng:          cp.fuel?.cng?.retailPrice ? toNum(cp.fuel.cng.retailPrice) : null,
      petrolChange: toNum(cp.fuel?.petrol?.retailPriceChange),
      dieselChange: toNum(cp.fuel?.diesel?.retailPriceChange),
    };
  }
  return out;
}

// ── State slug → display name (reverse of the API slug) ──────────────────────
const SLUG_TO_STATE: Record<string, string> = {
  'maharashtra': 'Maharashtra', 'delhi': 'Delhi',
  'uttar-pradesh': 'Uttar Pradesh', 'karnataka': 'Karnataka',
  'tamil-nadu': 'Tamil Nadu', 'west-bengal': 'West Bengal',
  'telangana': 'Telangana', 'gujarat': 'Gujarat',
  'rajasthan': 'Rajasthan', 'andhra-pradesh': 'Andhra Pradesh',
  'punjab': 'Punjab', 'haryana': 'Haryana',
  'kerala': 'Kerala', 'madhya-pradesh': 'Madhya Pradesh',
  'bihar': 'Bihar',
};

// ── Write to market_cache DB ──────────────────────────────────────────────────
async function writeToCache(payload: FuelCachePayload): Promise<void> {
  await pool.query(
    `INSERT INTO market_cache (cache_key, data, scraped_at, is_stale, source_url, updated_at)
     VALUES ('fuel_prices_all', $1, NOW(), FALSE, 'rapidapi_fuel', NOW())
     ON CONFLICT (cache_key) DO UPDATE SET
       data       = EXCLUDED.data,
       scraped_at = EXCLUDED.scraped_at,
       is_stale   = FALSE,
       updated_at = NOW()`,
    [JSON.stringify(payload)]
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startMs = Date.now();

  try {
    // 1. Fetch all states (1 API call)
    const states = await fetchAllStates();
    if (Object.keys(states).length === 0) {
      return NextResponse.json({ success: false, error: 'RapidAPI states fetch returned empty — key may be missing or quota exhausted' }, { status: 502 });
    }
    console.log(`[cache-fuel] States fetched: ${Object.keys(states).length}`);

    // 2. City prefetch DISABLED — reduced from 16 to 1 API call/day (30/month vs 480/month)
    // City prices are within ±₹0.50 of state prices. State-level is sufficient.
    // Saves 450 RapidAPI calls/month, keeping us well within 500 free tier limit.
    const cities: Record<string, CityFuelPrice> = {};
    const citiesTotal = 0;

    const payload: FuelCachePayload = {
      fetchedAt: new Date().toISOString(),
      states,
      cities,
    };

    await writeToCache(payload);

    const elapsed = Date.now() - startMs;
    console.log(`[cache-fuel] Done: ${Object.keys(states).length} states, ${citiesTotal} cities in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      states: Object.keys(states).length,
      cities: citiesTotal,
      elapsedMs: elapsed,
      timestamp: payload.fetchedAt,
    });

  } catch (error: any) {
    console.error('[cache-fuel] cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
