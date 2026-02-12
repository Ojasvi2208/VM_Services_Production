import { NextRequest, NextResponse } from 'next/server';
import { getFuelCache, setFuelCache, isCacheFresh, type FuelStatePrice, type FuelCacheData } from '@/lib/fuel-cache';

// ── Central Government Taxes (same across India, gazette-notified) ──
const CENTRAL_EXCISE_PETROL = 19.90;  // ₹/litre
const CENTRAL_EXCISE_DIESEL = 15.80;  // ₹/litre
const DEALER_COMMISSION = 3.69;        // Average dealer margin ₹/litre

// ── State-wise VAT rates (% applied on base+excise+dealer) + cess ──
const STATE_VAT: Record<string, { pVat: number; dVat: number; pCess: number; dCess: number }> = {
  'Andaman And Nicobar':      { pVat: 6.0,   dVat: 6.0,   pCess: 0,    dCess: 0 },
  'Andhra Pradesh':           { pVat: 31.0,  dVat: 22.25, pCess: 4.0,  dCess: 4.0 },
  'Arunachal Pradesh':        { pVat: 20.0,  dVat: 12.5,  pCess: 0,    dCess: 0 },
  'Assam':                    { pVat: 32.66, dVat: 23.66, pCess: 0,    dCess: 0 },
  'Bihar':                    { pVat: 30.0,  dVat: 24.0,  pCess: 0,    dCess: 0 },
  'Chandigarh':               { pVat: 17.0,  dVat: 12.25, pCess: 0,    dCess: 0 },
  'Chhattisgarh':             { pVat: 25.0,  dVat: 25.0,  pCess: 2.0,  dCess: 1.0 },
  'Dadra And Nagar Haveli':   { pVat: 15.0,  dVat: 15.0,  pCess: 0,    dCess: 0 },
  'Daman And Diu':            { pVat: 15.0,  dVat: 15.0,  pCess: 0,    dCess: 0 },
  'Delhi':                    { pVat: 19.40, dVat: 16.75, pCess: 0,    dCess: 0 },
  'Goa':                      { pVat: 25.0,  dVat: 22.0,  pCess: 1.0,  dCess: 0.5 },
  'Gujarat':                  { pVat: 20.1,  dVat: 20.2,  pCess: 4.0,  dCess: 4.0 },
  'Haryana':                  { pVat: 25.0,  dVat: 16.40, pCess: 0,    dCess: 0 },
  'Himachal Pradesh':         { pVat: 25.0,  dVat: 14.0,  pCess: 2.0,  dCess: 2.0 },
  'Jammu And Kashmir':        { pVat: 24.0,  dVat: 16.0,  pCess: 0,    dCess: 0 },
  'Jharkhand':                { pVat: 22.0,  dVat: 22.0,  pCess: 1.0,  dCess: 1.0 },
  'Karnataka':                { pVat: 25.92, dVat: 14.34, pCess: 5.18, dCess: 3.02 },
  'Kerala':                   { pVat: 30.08, dVat: 22.76, pCess: 1.0,  dCess: 1.0 },
  'Madhya Pradesh':           { pVat: 29.0,  dVat: 22.0,  pCess: 4.5,  dCess: 3.0 },
  'Maharashtra':              { pVat: 25.0,  dVat: 21.0,  pCess: 5.12, dCess: 3.0 },
  'Manipur':                  { pVat: 24.50, dVat: 14.50, pCess: 0,    dCess: 0 },
  'Meghalaya':                { pVat: 20.0,  dVat: 12.5,  pCess: 2.0,  dCess: 2.0 },
  'Mizoram':                  { pVat: 20.0,  dVat: 12.5,  pCess: 0,    dCess: 0 },
  'Nagaland':                 { pVat: 25.0,  dVat: 16.50, pCess: 2.0,  dCess: 2.0 },
  'Odisha':                   { pVat: 28.0,  dVat: 24.0,  pCess: 0,    dCess: 0 },
  'Pondicherry':              { pVat: 17.78, dVat: 14.03, pCess: 6.0,  dCess: 5.0 },
  'Puducherry':               { pVat: 17.78, dVat: 14.03, pCess: 6.0,  dCess: 5.0 },
  'Punjab':                   { pVat: 27.20, dVat: 16.30, pCess: 0,    dCess: 0 },
  'Rajasthan':                { pVat: 26.0,  dVat: 17.60, pCess: 4.0,  dCess: 2.0 },
  'Sikkim':                   { pVat: 22.25, dVat: 14.25, pCess: 0,    dCess: 0 },
  'Tamil Nadu':               { pVat: 15.0,  dVat: 11.0,  pCess: 13.02, dCess: 9.62 },
  'Telangana':                { pVat: 35.20, dVat: 27.0,  pCess: 0,    dCess: 0 },
  'Tripura':                  { pVat: 20.0,  dVat: 12.5,  pCess: 3.0,  dCess: 2.0 },
  'Uttar Pradesh':            { pVat: 19.36, dVat: 15.10, pCess: 2.0,  dCess: 2.0 },
  'Uttarakhand':              { pVat: 25.0,  dVat: 17.48, pCess: 0,    dCess: 0 },
  'West Bengal':              { pVat: 25.0,  dVat: 17.0,  pCess: 2.0,  dCess: 2.0 },
};

// City → state mapping for location-based lookups
const CITY_STATE_MAP: Record<string, string> = {
  'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra', 'thane': 'Maharashtra',
  'delhi': 'Delhi', 'new delhi': 'Delhi', 'noida': 'Uttar Pradesh', 'gurgaon': 'Haryana', 'gurugram': 'Haryana',
  'bangalore': 'Karnataka', 'bengaluru': 'Karnataka', 'mysore': 'Karnataka',
  'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu',
  'hyderabad': 'Telangana', 'secunderabad': 'Telangana', 'warangal': 'Telangana',
  'kolkata': 'West Bengal', 'howrah': 'West Bengal',
  'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'vadodara': 'Gujarat', 'rajkot': 'Gujarat',
  'jaipur': 'Rajasthan', 'jodhpur': 'Rajasthan', 'udaipur': 'Rajasthan',
  'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh', 'agra': 'Uttar Pradesh', 'varanasi': 'Uttar Pradesh',
  'patna': 'Bihar', 'gaya': 'Bihar',
  'bhopal': 'Madhya Pradesh', 'indore': 'Madhya Pradesh',
  'chandigarh': 'Chandigarh', 'ludhiana': 'Punjab', 'amritsar': 'Punjab',
  'dehradun': 'Uttarakhand', 'haridwar': 'Uttarakhand',
  'bhubaneswar': 'Odisha', 'cuttack': 'Odisha',
  'raipur': 'Chhattisgarh',
  'ranchi': 'Jharkhand', 'jamshedpur': 'Jharkhand',
  'guwahati': 'Assam',
  'thiruvananthapuram': 'Kerala', 'kochi': 'Kerala', 'kozhikode': 'Kerala',
  'panaji': 'Goa', 'margao': 'Goa',
  'shimla': 'Himachal Pradesh', 'manali': 'Himachal Pradesh',
  'srinagar': 'Jammu And Kashmir', 'jammu': 'Jammu And Kashmir',
  'imphal': 'Manipur', 'shillong': 'Meghalaya', 'aizawl': 'Mizoram', 'kohima': 'Nagaland',
  'agartala': 'Tripura', 'itanagar': 'Arunachal Pradesh', 'gangtok': 'Sikkim',
  'visakhapatnam': 'Andhra Pradesh', 'vijayawada': 'Andhra Pradesh', 'tirupati': 'Andhra Pradesh',
  'puducherry': 'Puducherry', 'pondicherry': 'Puducherry',
};

const FUEL_API_BASE = 'https://fuel.indianapi.in/live_fuel_price';
const FUEL_API_KEY = process.env.INDIANAPI_KEY || 'sk-live-Ne03Yxzf71nIfvbXTUrjZ5W1PGqkz75472pJRFTA';

// ── Live fetch from indianapi.in (only when cache is stale) ──
async function fetchAndCacheLive(): Promise<FuelCacheData | null> {
  try {
    const [petrolRes, dieselRes] = await Promise.all([
      fetch(`${FUEL_API_BASE}?fuel_type=petrol&location_type=state`, {
        headers: { 'x-api-key': FUEL_API_KEY }, cache: 'no-store',
      }),
      fetch(`${FUEL_API_BASE}?fuel_type=diesel&location_type=state`, {
        headers: { 'x-api-key': FUEL_API_KEY }, cache: 'no-store',
      }),
    ]);
    if (!petrolRes.ok || !dieselRes.ok) return null;

    const petrolData: { city: string; price: string; change: string }[] = await petrolRes.json();
    const dieselData: { city: string; price: string; change: string }[] = await dieselRes.json();

    const dieselMap = new Map(dieselData.map(d => [d.city, d]));
    const prices: FuelStatePrice[] = petrolData.map(p => {
      const d = dieselMap.get(p.city);
      return {
        state: p.city,
        petrolPrice: parseFloat(p.price) || 0,
        petrolChange: parseFloat(p.change) || 0,
        dieselPrice: d ? parseFloat(d.price) || 0 : 0,
        dieselChange: d ? parseFloat(d.change) || 0 : 0,
      };
    });

    const cacheData: FuelCacheData = { prices, fetchedAt: new Date().toISOString(), source: 'indianapi.in' };
    setFuelCache(cacheData);

    // Persist to /tmp for cold-start recovery
    try {
      const fs = await import('fs');
      fs.writeFileSync('/tmp/fuel-cache.json', JSON.stringify(cacheData));
    } catch { /* non-critical */ }

    return cacheData;
  } catch (err) {
    console.error('Live fuel fetch failed:', err);
    return null;
  }
}

// ── Ensure we have data (memory → /tmp → live fetch) ──
async function ensureCache(): Promise<FuelCacheData | null> {
  // 1. Memory cache
  if (isCacheFresh()) return getFuelCache();

  // 2. Try /tmp file (survives some cold starts on Vercel)
  try {
    const fs = await import('fs');
    if (fs.existsSync('/tmp/fuel-cache.json')) {
      const raw = fs.readFileSync('/tmp/fuel-cache.json', 'utf-8');
      const data: FuelCacheData = JSON.parse(raw);
      const age = Date.now() - new Date(data.fetchedAt).getTime();
      if (age < 25 * 60 * 60 * 1000) {
        setFuelCache(data);
        return data;
      }
    }
  } catch { /* ignore */ }

  // 3. Live fetch as last resort
  return await fetchAndCacheLive();
}

// ── Build tax breakdown from real retail price + known VAT rates ──
function buildBreakdown(retailPrice: number, vatPct: number, cess: number, excise: number) {
  // retailPrice = basePrice + excise + dealer + VAT(basePrice+excise+dealer) + cess
  // retailPrice - cess = (base + excise + dealer) * (1 + vatPct/100)
  // base = (retailPrice - cess) / (1 + vatPct/100) - excise - dealer
  const multiplier = 1 + vatPct / 100;
  const beforeVATTotal = (retailPrice - cess) / multiplier;
  const basePrice = Math.max(beforeVATTotal - excise - DEALER_COMMISSION, 0);
  const vatAmount = beforeVATTotal * vatPct / 100;

  return {
    basePrice: round2(basePrice),
    exciseDuty: round2(excise),
    dealerCommission: round2(DEALER_COMMISSION),
    vatPercent: vatPct,
    vatAmount: round2(vatAmount),
    additionalCess: cess,
    retailPrice: round2(retailPrice),
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

// ── Find state entry (fuzzy match) ──
function findState(query: string, prices: FuelStatePrice[]): FuelStatePrice | undefined {
  const q = query.toLowerCase();
  return prices.find(p => p.state.toLowerCase() === q)
    || prices.find(p => p.state.toLowerCase().includes(q))
    || prices.find(p => q.includes(p.state.toLowerCase()));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let stateParam = searchParams.get('state')?.trim() || '';
    const cityParam = searchParams.get('city')?.trim().toLowerCase() || '';
    const allStates = searchParams.get('all') === 'true';

    // Resolve state from city
    if (cityParam && !stateParam) {
      stateParam = CITY_STATE_MAP[cityParam] || '';
    }
    if (!stateParam && !cityParam && !allStates) {
      stateParam = 'Delhi';
    }

    const cache = await ensureCache();
    if (!cache || cache.prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Fuel price data unavailable. Try again later.' }, { status: 503 });
    }

    // ── Return all states ──
    if (allStates) {
      const allData = cache.prices.map(p => {
        const vat = STATE_VAT[p.state];
        return {
          state: p.state,
          petrolPrice: p.petrolPrice,
          petrolChange: p.petrolChange,
          dieselPrice: p.dieselPrice,
          dieselChange: p.dieselChange,
          petrolVatPercent: vat?.pVat ?? null,
          dieselVatPercent: vat?.dVat ?? null,
        };
      });
      return NextResponse.json({
        success: true,
        states: allData,
        lastUpdated: cache.fetchedAt,
        source: cache.source,
      });
    }

    // ── Single state with full breakdown ──
    // Accept actual retail prices from the app (RapidAPI city-level prices)
    // so the breakdown matches exactly what the user sees on the card.
    const petrolPriceParam = parseFloat(searchParams.get('petrolPrice') || '0');
    const dieselPriceParam = parseFloat(searchParams.get('dieselPrice') || '0');

    // Try to find the state in cache for fallback prices and state name resolution
    const entry = findState(stateParam, cache.prices);
    const resolvedState = entry?.state || stateParam;

    const vat = STATE_VAT[resolvedState] || { pVat: 15, dVat: 12, pCess: 0, dCess: 0 };

    // Use app-provided RapidAPI prices if available, otherwise fall back to cache
    const petrolRetail = petrolPriceParam > 0 ? petrolPriceParam : (entry?.petrolPrice || 0);
    const dieselRetail = dieselPriceParam > 0 ? dieselPriceParam : (entry?.dieselPrice || 0);

    if (petrolRetail === 0 && dieselRetail === 0 && !entry) {
      return NextResponse.json({
        success: false,
        error: `No fuel price data for: ${stateParam}`,
        availableStates: cache.prices.map(p => p.state).sort(),
      }, { status: 404 });
    }

    const petrol = buildBreakdown(petrolRetail, vat.pVat, vat.pCess, CENTRAL_EXCISE_PETROL);
    const diesel = buildBreakdown(dieselRetail, vat.dVat, vat.dCess, CENTRAL_EXCISE_DIESEL);

    // Tax summary percentages
    const petrolTotalTax = petrol.exciseDuty + petrol.vatAmount + petrol.additionalCess;
    const dieselTotalTax = diesel.exciseDuty + diesel.vatAmount + diesel.additionalCess;

    return NextResponse.json({
      success: true,
      state: resolvedState,
      city: cityParam || resolvedState.toLowerCase(),
      petrol,
      diesel,
      petrolChange: entry?.petrolChange ?? 0,
      dieselChange: entry?.dieselChange ?? 0,
      summary: {
        petrol: {
          retailPrice: petrol.retailPrice,
          totalTax: round2(petrolTotalTax),
          totalTaxPercent: round2((petrolTotalTax / petrol.retailPrice) * 100),
          centralTaxPercent: round2((petrol.exciseDuty / petrol.retailPrice) * 100),
          stateTaxPercent: round2(((petrol.vatAmount + petrol.additionalCess) / petrol.retailPrice) * 100),
        },
        diesel: {
          retailPrice: diesel.retailPrice,
          totalTax: round2(dieselTotalTax),
          totalTaxPercent: round2((dieselTotalTax / diesel.retailPrice) * 100),
          centralTaxPercent: round2((diesel.exciseDuty / diesel.retailPrice) * 100),
          stateTaxPercent: round2(((diesel.vatAmount + diesel.additionalCess) / diesel.retailPrice) * 100),
        },
      },
      lastUpdated: cache.fetchedAt,
      source: cache.source,
    });
  } catch (error) {
    console.error('Fuel prices API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get fuel prices' }, { status: 500 });
  }
}
