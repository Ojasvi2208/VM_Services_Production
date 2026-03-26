/**
 * Fuel Prices API — DB-backed cache
 *
 * Primary path:  reads from market_cache (key: fuel_prices_all) written by
 *                /api/cron/cache-fuel daily at 7:00 AM IST.
 * Haversine:     ?lat=&lng= → nearest city from hardcoded coords map → city price
 * Fallback:      ?state=&city= → traditional name lookup
 * Emergency:     if DB cache is cold/stale, calls RapidAPI for states directly
 *
 * Zero RapidAPI calls from this endpoint as long as cron runs daily.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import type { FuelCachePayload } from '@/app/api/cron/cache-fuel/route';

// ── Tax constants ─────────────────────────────────────────────────────────────
const CENTRAL_EXCISE_PETROL = 19.90;
const CENTRAL_EXCISE_DIESEL = 15.80;
const DEALER_COMMISSION      = 3.69;

// ── State-wise VAT rates ──────────────────────────────────────────────────────
const STATE_VAT: Record<string, { pVat: number; dVat: number; pCess: number; dCess: number }> = {
  'Andaman and Nicobar Islands': { pVat: 6.0,   dVat: 6.0,   pCess: 0,    dCess: 0 },
  'Andhra Pradesh':              { pVat: 31.0,  dVat: 22.25, pCess: 4.0,  dCess: 4.0 },
  'Arunachal Pradesh':           { pVat: 20.0,  dVat: 12.5,  pCess: 0,    dCess: 0 },
  'Assam':                       { pVat: 32.66, dVat: 23.66, pCess: 0,    dCess: 0 },
  'Bihar':                       { pVat: 30.0,  dVat: 24.0,  pCess: 0,    dCess: 0 },
  'Chandigarh':                  { pVat: 17.0,  dVat: 12.25, pCess: 0,    dCess: 0 },
  'Chhattisgarh':                { pVat: 25.0,  dVat: 25.0,  pCess: 2.0,  dCess: 1.0 },
  'Dadra and Nagar Haveli':      { pVat: 15.0,  dVat: 15.0,  pCess: 0,    dCess: 0 },
  'Daman and Diu':               { pVat: 15.0,  dVat: 15.0,  pCess: 0,    dCess: 0 },
  'Delhi':                       { pVat: 19.40, dVat: 16.75, pCess: 0,    dCess: 0 },
  'Goa':                         { pVat: 25.0,  dVat: 22.0,  pCess: 1.0,  dCess: 0.5 },
  'Gujarat':                     { pVat: 20.1,  dVat: 20.2,  pCess: 4.0,  dCess: 4.0 },
  'Haryana':                     { pVat: 25.0,  dVat: 16.40, pCess: 0,    dCess: 0 },
  'Himachal Pradesh':            { pVat: 25.0,  dVat: 14.0,  pCess: 2.0,  dCess: 2.0 },
  'Jammu and Kashmir':           { pVat: 24.0,  dVat: 16.0,  pCess: 0,    dCess: 0 },
  'Jharkhand':                   { pVat: 22.0,  dVat: 22.0,  pCess: 1.0,  dCess: 1.0 },
  'Karnataka':                   { pVat: 25.92, dVat: 14.34, pCess: 5.18, dCess: 3.02 },
  'Kerala':                      { pVat: 30.08, dVat: 22.76, pCess: 1.0,  dCess: 1.0 },
  'Ladakh':                      { pVat: 10.0,  dVat: 10.0,  pCess: 0,    dCess: 0 },
  'Lakshadweep':                 { pVat: 6.0,   dVat: 6.0,   pCess: 0,    dCess: 0 },
  'Madhya Pradesh':              { pVat: 29.0,  dVat: 22.0,  pCess: 4.5,  dCess: 3.0 },
  'Maharashtra':                 { pVat: 25.0,  dVat: 21.0,  pCess: 5.12, dCess: 3.0 },
  'Manipur':                     { pVat: 24.50, dVat: 14.50, pCess: 0,    dCess: 0 },
  'Meghalaya':                   { pVat: 20.0,  dVat: 12.5,  pCess: 2.0,  dCess: 2.0 },
  'Mizoram':                     { pVat: 20.0,  dVat: 12.5,  pCess: 0,    dCess: 0 },
  'Nagaland':                    { pVat: 25.0,  dVat: 16.50, pCess: 2.0,  dCess: 2.0 },
  'Odisha':                      { pVat: 28.0,  dVat: 24.0,  pCess: 0,    dCess: 0 },
  'Puducherry':                  { pVat: 17.78, dVat: 14.03, pCess: 6.0,  dCess: 5.0 },
  'Punjab':                      { pVat: 27.20, dVat: 16.30, pCess: 0,    dCess: 0 },
  'Rajasthan':                   { pVat: 26.0,  dVat: 17.60, pCess: 4.0,  dCess: 2.0 },
  'Sikkim':                      { pVat: 22.25, dVat: 14.25, pCess: 0,    dCess: 0 },
  'Tamil Nadu':                  { pVat: 15.0,  dVat: 11.0,  pCess: 13.02, dCess: 9.62 },
  'Telangana':                   { pVat: 35.20, dVat: 27.0,  pCess: 0,    dCess: 0 },
  'Tripura':                     { pVat: 20.0,  dVat: 12.5,  pCess: 3.0,  dCess: 2.0 },
  'Uttar Pradesh':               { pVat: 19.36, dVat: 15.10, pCess: 2.0,  dCess: 2.0 },
  'Uttarakhand':                 { pVat: 25.0,  dVat: 17.48, pCess: 0,    dCess: 0 },
  'West Bengal':                 { pVat: 25.0,  dVat: 17.0,  pCess: 2.0,  dCess: 2.0 },
};

// ── City coordinates for Haversine nearest-city lookup ───────────────────────
// slug (matches FuelCachePayload.cities keys) → { lat, lng, displayName, state }
const CITY_COORDS: Record<string, { lat: number; lng: number; displayName: string; state: string }> = {
  'mumbai':           { lat: 19.076,  lng: 72.877,  displayName: 'Mumbai',           state: 'Maharashtra' },
  'delhi':            { lat: 28.704,  lng: 77.102,  displayName: 'Delhi',            state: 'Delhi' },
  'new-delhi':        { lat: 28.613,  lng: 77.209,  displayName: 'New Delhi',        state: 'Delhi' },
  'bangalore':        { lat: 12.972,  lng: 77.594,  displayName: 'Bangalore',        state: 'Karnataka' },
  'hyderabad':        { lat: 17.385,  lng: 78.487,  displayName: 'Hyderabad',        state: 'Telangana' },
  'chennai':          { lat: 13.083,  lng: 80.270,  displayName: 'Chennai',          state: 'Tamil Nadu' },
  'kolkata':          { lat: 22.572,  lng: 88.364,  displayName: 'Kolkata',          state: 'West Bengal' },
  'pune':             { lat: 18.520,  lng: 73.855,  displayName: 'Pune',             state: 'Maharashtra' },
  'ahmedabad':        { lat: 23.022,  lng: 72.572,  displayName: 'Ahmedabad',        state: 'Gujarat' },
  'jaipur':           { lat: 26.912,  lng: 75.788,  displayName: 'Jaipur',           state: 'Rajasthan' },
  'lucknow':          { lat: 26.846,  lng: 80.946,  displayName: 'Lucknow',          state: 'Uttar Pradesh' },
  'kanpur':           { lat: 26.460,  lng: 80.331,  displayName: 'Kanpur',           state: 'Uttar Pradesh' },
  'nagpur':           { lat: 21.145,  lng: 79.088,  displayName: 'Nagpur',           state: 'Maharashtra' },
  'visakhapatnam':    { lat: 17.686,  lng: 83.218,  displayName: 'Visakhapatnam',    state: 'Andhra Pradesh' },
  'bhopal':           { lat: 23.259,  lng: 77.413,  displayName: 'Bhopal',           state: 'Madhya Pradesh' },
  'indore':           { lat: 22.719,  lng: 75.858,  displayName: 'Indore',           state: 'Madhya Pradesh' },
  'patna':            { lat: 25.594,  lng: 85.137,  displayName: 'Patna',            state: 'Bihar' },
  'vadodara':         { lat: 22.309,  lng: 73.193,  displayName: 'Vadodara',         state: 'Gujarat' },
  'ludhiana':         { lat: 30.901,  lng: 75.857,  displayName: 'Ludhiana',         state: 'Punjab' },
  'agra':             { lat: 27.177,  lng: 78.008,  displayName: 'Agra',             state: 'Uttar Pradesh' },
  'amritsar':         { lat: 31.634,  lng: 74.872,  displayName: 'Amritsar',         state: 'Punjab' },
  'varanasi':         { lat: 25.317,  lng: 82.974,  displayName: 'Varanasi',         state: 'Uttar Pradesh' },
  'jodhpur':          { lat: 26.295,  lng: 73.017,  displayName: 'Jodhpur',          state: 'Rajasthan' },
  'madurai':          { lat: 9.925,   lng: 78.119,  displayName: 'Madurai',          state: 'Tamil Nadu' },
  'raipur':           { lat: 21.250,  lng: 81.629,  displayName: 'Raipur',           state: 'Chhattisgarh' },
  'kochi':            { lat: 9.931,   lng: 76.267,  displayName: 'Kochi',            state: 'Kerala' },
  'chandigarh':       { lat: 30.734,  lng: 76.779,  displayName: 'Chandigarh',       state: 'Chandigarh' },
  'thiruvananthapuram':{ lat: 8.524,  lng: 76.936,  displayName: 'Thiruvananthapuram', state: 'Kerala' },
  'bhubaneswar':      { lat: 20.296,  lng: 85.825,  displayName: 'Bhubaneswar',      state: 'Odisha' },
  'dehradun':         { lat: 30.316,  lng: 78.032,  displayName: 'Dehradun',         state: 'Uttarakhand' },
  'guwahati':         { lat: 26.144,  lng: 91.736,  displayName: 'Guwahati',         state: 'Assam' },
  'noida':            { lat: 28.535,  lng: 77.391,  displayName: 'Noida',            state: 'Uttar Pradesh' },
  'gurgaon':          { lat: 28.459,  lng: 77.026,  displayName: 'Gurgaon',          state: 'Haryana' },
  'surat':            { lat: 21.170,  lng: 72.831,  displayName: 'Surat',            state: 'Gujarat' },
  'mangalore':        { lat: 12.914,  lng: 74.856,  displayName: 'Mangalore',        state: 'Karnataka' },
  'mysore':           { lat: 12.296,  lng: 76.638,  displayName: 'Mysore',           state: 'Karnataka' },
  'coimbatore':       { lat: 11.017,  lng: 76.955,  displayName: 'Coimbatore',       state: 'Tamil Nadu' },
  'udaipur':          { lat: 24.571,  lng: 73.691,  displayName: 'Udaipur',          state: 'Rajasthan' },
  'ranchi':           { lat: 23.344,  lng: 85.309,  displayName: 'Ranchi',           state: 'Jharkhand' },
  'sas-nagar':        { lat: 30.705,  lng: 76.718,  displayName: 'Mohali',           state: 'Punjab' },
  'panchkula':        { lat: 30.695,  lng: 76.853,  displayName: 'Panchkula',        state: 'Haryana' },
  'shimla':           { lat: 31.104,  lng: 77.167,  displayName: 'Shimla',           state: 'Himachal Pradesh' },
  'vijayawada':       { lat: 16.506,  lng: 80.648,  displayName: 'Vijayawada',       state: 'Andhra Pradesh' },
  'jabalpur':         { lat: 23.182,  lng: 79.987,  displayName: 'Jabalpur',         state: 'Madhya Pradesh' },
  'thane':            { lat: 19.218,  lng: 72.978,  displayName: 'Thane',            state: 'Maharashtra' },
};

// ── Haversine distance in km ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find nearest city from lat/lng using CITY_COORDS (always works, no cache dependency).
// Returns the geographically closest entry so we can derive the correct state even
// when the DB city cache is cold (cron hasn't run yet).
function nearestCity(lat: number, lng: number): {
  slug: string;
  km: number;
  displayName: string;
  state: string;
} | null {
  let best: { slug: string; km: number; displayName: string; state: string } | null = null;
  for (const [slug, coord] of Object.entries(CITY_COORDS)) {
    const km = haversineKm(lat, lng, coord.lat, coord.lng);
    if (!best || km < best.km) {
      best = { slug, km, displayName: coord.displayName, state: coord.state };
    }
  }
  return best;
}

// ── City → state fallback mapping ────────────────────────────────────────────
const CITY_STATE_MAP: Record<string, string> = {
  'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra', 'thane': 'Maharashtra',
  'delhi': 'Delhi', 'new-delhi': 'Delhi', 'noida': 'Uttar Pradesh', 'gurgaon': 'Haryana',
  'bangalore': 'Karnataka', 'mysore': 'Karnataka', 'mangalore': 'Karnataka',
  'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu',
  'hyderabad': 'Telangana',
  'kolkata': 'West Bengal',
  'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'vadodara': 'Gujarat', 'rajkot': 'Gujarat',
  'jaipur': 'Rajasthan', 'jodhpur': 'Rajasthan', 'udaipur': 'Rajasthan',
  'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh', 'agra': 'Uttar Pradesh', 'varanasi': 'Uttar Pradesh', 'noida': 'Uttar Pradesh',
  'patna': 'Bihar',
  'bhopal': 'Madhya Pradesh', 'indore': 'Madhya Pradesh', 'jabalpur': 'Madhya Pradesh',
  'chandigarh': 'Chandigarh', 'sas-nagar': 'Punjab', 'panchkula': 'Haryana',
  'ludhiana': 'Punjab', 'amritsar': 'Punjab',
  'dehradun': 'Uttarakhand',
  'bhubaneswar': 'Odisha',
  'raipur': 'Chhattisgarh',
  'ranchi': 'Jharkhand',
  'guwahati': 'Assam',
  'thiruvananthapuram': 'Kerala', 'kochi': 'Kerala',
  'shimla': 'Himachal Pradesh',
  'visakhapatnam': 'Andhra Pradesh', 'vijayawada': 'Andhra Pradesh',
};

// ── DB read ───────────────────────────────────────────────────────────────────
async function readFromDB(): Promise<FuelCachePayload | null> {
  try {
    const result = await pool.query(
      `SELECT data, scraped_at FROM market_cache WHERE cache_key = 'fuel_prices_all' LIMIT 1`
    );
    if (!result.rows.length) return null;
    const ageMs = Date.now() - new Date(result.rows[0].scraped_at).getTime();
    // Accept up to 26h (cron runs daily; allow one missed day before treating as stale)
    if (ageMs > 26 * 60 * 60 * 1000) return null;
    return result.rows[0].data as FuelCachePayload;
  } catch {
    return null;
  }
}

// ── Emergency RapidAPI fallback (states only, 1 call) ────────────────────────
async function emergencyFetchStates(): Promise<FuelCachePayload | null> {
  const apiKey = process.env.RAPIDAPI_FUEL_KEY;
  if (!apiKey) return null;
  try {
    const host = 'daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com';
    const res = await fetch(`https://${host}/v1/fuel-prices/today/india/states`, {
      headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const states: FuelCachePayload['states'] = {};
    for (const sp of data.statePrices ?? []) {
      const name = String(sp.stateName || '').trim();
      if (!name) continue;
      const toNum = (v: any) => parseFloat(String(v ?? 0)) || 0;
      states[name] = {
        petrol:       toNum(sp.fuel?.petrol?.retailPrice),
        diesel:       toNum(sp.fuel?.diesel?.retailPrice),
        cng:          sp.fuel?.cng?.retailPrice ? toNum(sp.fuel.cng.retailPrice) : null,
        petrolChange: toNum(sp.fuel?.petrol?.retailPriceChange),
        dieselChange: toNum(sp.fuel?.diesel?.retailPriceChange),
      };
    }
    return Object.keys(states).length ? { fetchedAt: new Date().toISOString(), states, cities: {} } : null;
  } catch {
    return null;
  }
}

// ── Tax breakdown ─────────────────────────────────────────────────────────────
function round2(n: number) { return Math.round(n * 100) / 100; }

function buildBreakdown(retailPrice: number, vatPct: number, cess: number, excise: number) {
  const multiplier = 1 + vatPct / 100;
  const beforeVATTotal = (retailPrice - cess) / multiplier;
  const basePrice = Math.max(beforeVATTotal - excise - DEALER_COMMISSION, 0);
  const vatAmount = beforeVATTotal * vatPct / 100;
  return {
    basePrice:        round2(basePrice),
    exciseDuty:       round2(excise),
    dealerCommission: round2(DEALER_COMMISSION),
    vatPercent:       vatPct,
    vatAmount:        round2(vatAmount),
    additionalCess:   cess,
    retailPrice:      round2(retailPrice),
  };
}

function resolveStateVATKey(stateName: string): string {
  if (STATE_VAT[stateName]) return stateName;
  const lower = stateName.toLowerCase();
  for (const key of Object.keys(STATE_VAT)) {
    if (key.toLowerCase() === lower || key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) return key;
  }
  return stateName;
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latParam  = searchParams.get('lat');
    const lngParam  = searchParams.get('lng');
    const stateParam = searchParams.get('state')?.trim() || '';
    const cityParam  = searchParams.get('city')?.trim().toLowerCase().replace(/\s+/g, '-') || '';
    const allStates  = searchParams.get('all') === 'true';

    // ── Load cache (DB-first, emergency fallback) ──────────────────────────
    let cache = await readFromDB();
    let cacheSource = 'db_cache';
    if (!cache) {
      cache = await emergencyFetchStates();
      cacheSource = 'live_fallback';
    }
    if (!cache) {
      return NextResponse.json({ success: false, error: 'Fuel data unavailable — cache cold and RapidAPI unreachable.' }, { status: 503 });
    }

    const cacheKeys = new Set(Object.keys(cache.cities));

    // ── Return all states ──────────────────────────────────────────────────
    if (allStates) {
      const allData = Object.entries(cache.states).map(([state, d]) => {
        const vatKey = resolveStateVATKey(state);
        const vat = STATE_VAT[vatKey];
        return {
          state,
          petrolPrice:      d.petrol,
          petrolChange:     d.petrolChange,
          dieselPrice:      d.diesel,
          dieselChange:     d.dieselChange,
          cngPrice:         d.cng ?? null,
          petrolVatPercent: vat?.pVat ?? null,
          dieselVatPercent: vat?.dVat ?? null,
        };
      });
      return NextResponse.json({ success: true, states: allData, lastUpdated: cache.fetchedAt, source: cacheSource });
    }

    // ── Resolve city and state ─────────────────────────────────────────────
    let resolvedCitySlug = cityParam;
    let resolvedCityName = '';
    let resolvedState    = stateParam;
    let nearestKm: number | null = null;

    // Strategy 1: lat/lng → Haversine nearest city
    // nearestCity() always scans all CITY_COORDS regardless of cache — this
    // guarantees the correct STATE is derived from GPS coordinates even when
    // the daily fuel cron hasn't run yet and cache.cities is empty.
    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);
      if (!isNaN(lat) && !isNaN(lng)) {
        const nearest = nearestCity(lat, lng);
        if (nearest) {
          nearestKm        = Math.round(nearest.km);
          resolvedCityName = nearest.displayName;
          resolvedState    = resolvedState || nearest.state; // ← always set from GPS

          // Use city-level prices only if the cron has pre-fetched this city
          if (cacheKeys.has(nearest.slug)) {
            resolvedCitySlug = nearest.slug;
          }
          // else: fall through to state-level prices below (correct state, not Delhi)
        }
      }
    }

    // Strategy 2: explicit city slug
    if (!resolvedCitySlug && cityParam) {
      resolvedCitySlug = cityParam;
      resolvedState    = resolvedState || CITY_STATE_MAP[cityParam] || '';
    }

    // Default state
    if (!resolvedState) resolvedState = 'Delhi';

    // Fuzzy-match state name against cache keys
    const stateQ = resolvedState.toLowerCase();
    for (const s of Object.keys(cache.states)) {
      if (s.toLowerCase() === stateQ || s.toLowerCase().includes(stateQ) || stateQ.includes(s.toLowerCase())) {
        resolvedState = s;
        break;
      }
    }

    const vatKey = resolveStateVATKey(resolvedState);
    const vat    = STATE_VAT[vatKey] ?? { pVat: 15, dVat: 12, pCess: 0, dCess: 0 };

    // ── Resolve prices ─────────────────────────────────────────────────────
    let petrolRetail = 0, dieselRetail = 0, petrolChange = 0, dieselChange = 0;
    let cngPrice: number | null = null;
    let priceSource = 'state';

    // Try city from cache
    const cityEntry = resolvedCitySlug ? cache.cities[resolvedCitySlug] : null;
    if (cityEntry && cityEntry.petrol > 0) {
      petrolRetail = cityEntry.petrol;
      dieselRetail = cityEntry.diesel;
      petrolChange = cityEntry.petrolChange;
      dieselChange = cityEntry.dieselChange;
      cngPrice     = cityEntry.cng ?? null;
      resolvedCityName = resolvedCityName || cityEntry.name;
      priceSource  = 'city';
    }

    // Fall back to state
    if (petrolRetail === 0) {
      const stateEntry = cache.states[resolvedState];
      if (stateEntry?.petrol > 0) {
        petrolRetail = stateEntry.petrol;
        dieselRetail = stateEntry.diesel;
        petrolChange = stateEntry.petrolChange;
        dieselChange = stateEntry.dieselChange;
        cngPrice     = stateEntry.cng ?? null;
      }
    }

    // Fill CNG from state if city didn't have it
    if (!cngPrice && cache.states[resolvedState]?.cng) {
      cngPrice = cache.states[resolvedState].cng ?? null;
    }

    if (petrolRetail === 0) {
      return NextResponse.json({
        success: false,
        error: `No price data for: ${resolvedState}${resolvedCitySlug ? ` / ${resolvedCitySlug}` : ''}`,
      }, { status: 404 });
    }

    const petrol = buildBreakdown(petrolRetail, vat.pVat, vat.pCess, CENTRAL_EXCISE_PETROL);
    const diesel = buildBreakdown(dieselRetail, vat.dVat, vat.dCess, CENTRAL_EXCISE_DIESEL);

    const petrolTotalTax = petrol.exciseDuty + petrol.vatAmount + petrol.additionalCess;
    const dieselTotalTax = diesel.exciseDuty + diesel.vatAmount + diesel.additionalCess;

    return NextResponse.json({
      success: true,
      state:   resolvedState,
      city:    resolvedCityName || resolvedCitySlug || resolvedState,
      nearestCityKm: nearestKm,
      priceSource,
      petrolPrice:  petrolRetail,
      dieselPrice:  dieselRetail,
      petrolChange,
      dieselChange,
      cngPrice,
      petrol,
      diesel,
      summary: {
        petrol: {
          retailPrice:       petrol.retailPrice,
          totalTax:          round2(petrolTotalTax),
          totalTaxPercent:   petrolRetail > 0 ? round2((petrolTotalTax / petrol.retailPrice) * 100) : 0,
          centralTaxPercent: petrolRetail > 0 ? round2((petrol.exciseDuty / petrol.retailPrice) * 100) : 0,
          stateTaxPercent:   petrolRetail > 0 ? round2(((petrol.vatAmount + petrol.additionalCess) / petrol.retailPrice) * 100) : 0,
        },
        diesel: {
          retailPrice:       diesel.retailPrice,
          totalTax:          round2(dieselTotalTax),
          totalTaxPercent:   dieselRetail > 0 ? round2((dieselTotalTax / diesel.retailPrice) * 100) : 0,
          centralTaxPercent: dieselRetail > 0 ? round2((diesel.exciseDuty / diesel.retailPrice) * 100) : 0,
          stateTaxPercent:   dieselRetail > 0 ? round2(((diesel.vatAmount + diesel.additionalCess) / diesel.retailPrice) * 100) : 0,
        },
      },
      lastUpdated: cache.fetchedAt,
      source: cacheSource,
    });

  } catch (error) {
    console.error('[fuel-prices] error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
