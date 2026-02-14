import { NextRequest, NextResponse } from 'next/server';
import { getScrapedFuelCache, setScrapedFuelCache, isScrapedCacheFresh, type ScrapedFuelData, type ScrapedCityPrice } from '@/lib/fuel-cache';

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

// City slug → IndianAPI/scraped slug (resolves app city names to cached data keys)
const CITY_SLUG_MAP: Record<string, string> = {
  'mohali': 'sas-nagar', 'sas nagar': 'sas-nagar', 'sahibzada ajit singh nagar': 'sas-nagar',
  'new delhi': 'new-delhi', 'delhi': 'new-delhi',
  'gurgaon': 'gurgaon', 'gurugram': 'gurgaon',
  'bangalore': 'bangalore', 'bengaluru': 'bangalore',
  'mumbai': 'mumbai', 'kolkata': 'kolkata', 'chennai': 'chennai',
  'pune': 'pune', 'ahmedabad': 'ahmedabad', 'surat': 'surat',
  'indore': 'indore', 'nagpur': 'nagpur', 'noida': 'noida',
  'chandigarh': 'chandigarh', 'hyderabad': 'hyderabad',
  'panchkula': 'panchkula',
  'jaipur': 'jaipur', 'lucknow': 'lucknow', 'patna': 'patna',
  'bhubaneswar': 'bhubaneswar', 'thiruvananthapuram': 'thiruvananthapuram',
  'ludhiana': 'ludhiana', 'amritsar': 'amritsar',
  'kochi': 'kochi', 'coimbatore': 'coimbatore', 'madurai': 'madurai',
  'visakhapatnam': 'visakhapatnam', 'bhopal': 'bhopal',
  'vadodara': 'vadodara', 'raipur': 'raipur', 'ranchi': 'ranchi',
  'dehradun': 'dehradun', 'guwahati': 'guwahati',
  'agra': 'agra', 'varanasi': 'varanasi', 'kanpur': 'kanpur',
  'jodhpur': 'jodhpur', 'udaipur': 'udaipur',
  'mysore': 'mysore', 'mangalore': 'mangalore',
  'shimla': 'shimla',
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

// ── Ensure scraped cache (memory → /tmp). No external API calls — all from scraped cache. ──
async function ensureScrapedCache(): Promise<ScrapedFuelData | null> {
  if (isScrapedCacheFresh()) return getScrapedFuelCache();

  try {
    const fs = await import('fs');
    if (fs.existsSync('/tmp/fuel-scraped-cache.json')) {
      const raw = fs.readFileSync('/tmp/fuel-scraped-cache.json', 'utf-8');
      const data: ScrapedFuelData = JSON.parse(raw);
      const age = Date.now() - new Date(data.fetchedAt).getTime();
      if (age < 25 * 60 * 60 * 1000) {
        setScrapedFuelCache(data);
        return data;
      }
    }
  } catch { /* ignore */ }

  return getScrapedFuelCache(); // return stale if nothing else
}

// ── Find scraped city price by name/slug ──
function findScrapedCity(cityName: string, scraped: ScrapedFuelData): { slug: string; data: ScrapedCityPrice } | null {
  const lower = cityName.toLowerCase().trim();

  // Direct slug match
  if (scraped.cities[lower]) return { slug: lower, data: scraped.cities[lower] };

  // Map through alias
  const mapped = CITY_SLUG_MAP[lower];
  if (mapped && scraped.cities[mapped]) return { slug: mapped, data: scraped.cities[mapped] };

  // Fuzzy: try matching city name field
  for (const [slug, city] of Object.entries(scraped.cities)) {
    if (city.name.toLowerCase() === lower || slug === lower) {
      return { slug, data: city };
    }
  }

  return null;
}

// ── Fallback: find any scraped city in the same state ──
function findCityInSameState(stateName: string, scraped: ScrapedFuelData): ScrapedCityPrice | null {
  const stateKey = stateName.toLowerCase();
  for (const [, city] of Object.entries(scraped.cities)) {
    const cityState = CITY_STATE_MAP[city.name.toLowerCase()];
    if (cityState && cityState.toLowerCase() === stateKey) {
      return city;
    }
  }
  return null;
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

    let scraped = await ensureScrapedCache();

    // ── IndianAPI fetch: state + city level (709 cities) ──
    if (!scraped) {
      try {
        const apiKey = process.env.INDIANAPI_KEY || 'sk-live-Ne03Yxzf71nIfvbXTUrjZ5W1PGqkz75472pJRFTA';
        const headers = { 'x-api-key': apiKey };

        // Fetch state + city level data in parallel (4 calls)
        const [petrolStateResp, dieselStateResp, petrolCityResp, dieselCityResp] = await Promise.all([
          fetch('https://fuel.indianapi.in/live_fuel_price?fuel_type=petrol&location_type=state', { headers }),
          fetch('https://fuel.indianapi.in/live_fuel_price?fuel_type=diesel&location_type=state', { headers }),
          fetch('https://fuel.indianapi.in/live_fuel_price?fuel_type=petrol&location_type=city', { headers }),
          fetch('https://fuel.indianapi.in/live_fuel_price?fuel_type=diesel&location_type=city', { headers }),
        ]);

        const states: Record<string, any> = {};
        const cities: Record<string, any> = {};

        // Parse state-level data
        if (petrolStateResp.ok) {
          const petrolData: any[] = await petrolStateResp.json();
          for (const item of petrolData) {
            const name = item.city || item.state || '';
            if (!name) continue;
            states[name] = { petrol: parseFloat(item.price) || 0, diesel: 0, petrolChange: item.change || '0', dieselChange: '0', cng: null, lpg: null };
          }
        }
        if (dieselStateResp.ok) {
          const dieselData: any[] = await dieselStateResp.json();
          for (const item of dieselData) {
            const name = item.city || item.state || '';
            if (states[name]) {
              states[name].diesel = parseFloat(item.price) || 0;
              states[name].dieselChange = item.change || '0';
            }
          }
        }

        // Parse city-level data (709 cities)
        if (petrolCityResp.ok) {
          const petrolCities: any[] = await petrolCityResp.json();
          for (const item of petrolCities) {
            const cityName = (item.city || '').trim();
            if (!cityName) continue;
            const slug = cityName.toLowerCase().replace(/\s+/g, '-');
            cities[slug] = {
              name: cityName,
              petrol: parseFloat(item.price) || 0,
              diesel: 0,
              petrolChange: item.change || '0',
              dieselChange: '0',
              cng: null,
              lpg: null,
            };
          }
        }
        if (dieselCityResp.ok) {
          const dieselCities: any[] = await dieselCityResp.json();
          for (const item of dieselCities) {
            const cityName = (item.city || '').trim();
            const slug = cityName.toLowerCase().replace(/\s+/g, '-');
            if (cities[slug]) {
              cities[slug].diesel = parseFloat(item.price) || 0;
              cities[slug].dieselChange = item.change || '0';
            }
          }
        }

        console.log(`[fuel] IndianAPI: ${Object.keys(states).length} states, ${Object.keys(cities).length} cities loaded`);

        scraped = { states, cities, fetchedAt: new Date().toISOString(), source: 'IndianAPI' } as ScrapedFuelData;

        try {
          const fs = await import('fs');
          fs.writeFileSync('/tmp/fuel-scraped-cache.json', JSON.stringify(scraped));
        } catch { /* non-critical */ }
        setScrapedFuelCache(scraped);

      } catch (e) {
        console.error('IndianAPI fuel fetch failed:', e);
      }
    }

    if (!scraped) {
      return NextResponse.json({ success: false, error: 'Fuel price data unavailable. All sources exhausted.' }, { status: 503 });
    }

    // ── Return all states ──
    if (allStates) {
      const allData = Object.entries(scraped.states).map(([state, data]) => {
        const vat = STATE_VAT[state];
        return {
          state,
          petrolPrice: data.petrol,
          petrolChange: parseFloat(data.petrolChange) || 0,
          dieselPrice: data.diesel,
          dieselChange: parseFloat(data.dieselChange) || 0,
          cngPrice: data.cng || null,
          lpgPrice: data.lpg || null,
          petrolVatPercent: vat?.pVat ?? null,
          dieselVatPercent: vat?.dVat ?? null,
        };
      });

      return NextResponse.json({
        success: true,
        states: allData,
        lastUpdated: scraped.fetchedAt,
        source: scraped.source,
      });
    }

    // ── Single city/state with full breakdown ──
    // Accept optional app-provided prices for backward compat
    const petrolPriceParam = parseFloat(searchParams.get('petrolPrice') || '0');
    const dieselPriceParam = parseFloat(searchParams.get('dieselPrice') || '0');

    // Resolve state name (fuzzy match against scraped states)
    let resolvedState = stateParam;
    const stateQ = stateParam.toLowerCase();
    for (const s of Object.keys(scraped.states)) {
      if (s.toLowerCase() === stateQ || s.toLowerCase().includes(stateQ) || stateQ.includes(s.toLowerCase())) {
        resolvedState = s;
        break;
      }
    }
    // Also resolve via CITY_STATE_MAP + goodreturns state name matching
    if (cityParam && !resolvedState) {
      resolvedState = CITY_STATE_MAP[cityParam] || 'Delhi';
    }

    const vat = STATE_VAT[resolvedState] || { pVat: 15, dVat: 12, pCess: 0, dCess: 0 };

    // Priority chain: 1) scraped city, 2) app-provided price, 3) nearest city in same state, 4) scraped state
    let petrolRetail = 0;
    let dieselRetail = 0;
    let petrolChange = 0;
    let dieselChange = 0;
    let cngPrice: number | null = null;
    let lpgPrice: number | null = null;
    let resolvedCityName = '';
    let dataSource = scraped.source;

    // Try 1: scraped city match
    let scrapedCity: ScrapedCityPrice | null = null;
    if (cityParam) {
      const found = findScrapedCity(cityParam, scraped);
      if (found) {
        scrapedCity = found.data;
        resolvedCityName = found.data.name;
      }
    }

    if (scrapedCity && scrapedCity.petrol > 0) {
      petrolRetail = scrapedCity.petrol;
      dieselRetail = scrapedCity.diesel;
      petrolChange = parseFloat(scrapedCity.petrolChange) || 0;
      dieselChange = parseFloat(scrapedCity.dieselChange) || 0;
      cngPrice = scrapedCity.cng || null;
      lpgPrice = scrapedCity.lpg || null;
    } else if (petrolPriceParam > 0) {
      // Try 2: app-provided prices (backward compat)
      petrolRetail = petrolPriceParam;
      dieselRetail = dieselPriceParam;
    } else {
      // Try 3: nearest city in same state
      const nearestCity = findCityInSameState(resolvedState, scraped);
      if (nearestCity && nearestCity.petrol > 0) {
        petrolRetail = nearestCity.petrol;
        dieselRetail = nearestCity.diesel;
        petrolChange = parseFloat(nearestCity.petrolChange) || 0;
        dieselChange = parseFloat(nearestCity.dieselChange) || 0;
        cngPrice = nearestCity.cng || null;
        lpgPrice = nearestCity.lpg || null;
        resolvedCityName = nearestCity.name;
      }
    }

    // Try 4: scraped state-level price as final fallback
    if (petrolRetail === 0 && scraped.states[resolvedState]?.petrol > 0) {
      const scrapedState = scraped.states[resolvedState];
      petrolRetail = scrapedState.petrol;
      dieselRetail = scrapedState.diesel;
      petrolChange = parseFloat(scrapedState.petrolChange) || 0;
      dieselChange = parseFloat(scrapedState.dieselChange) || 0;
      if (!cngPrice) cngPrice = scrapedState.cng || null;
      if (!lpgPrice) lpgPrice = scrapedState.lpg || null;
    }

    // Fill CNG/LPG from state if city didn't have it
    if (!cngPrice && scraped.states[resolvedState]?.cng) {
      cngPrice = scraped.states[resolvedState].cng || null;
    }
    if (!lpgPrice && scraped.states[resolvedState]?.lpg) {
      lpgPrice = scraped.states[resolvedState].lpg || null;
    }

    if (petrolRetail === 0 && dieselRetail === 0) {
      return NextResponse.json({
        success: false,
        error: `No fuel price data for: ${stateParam} ${cityParam}`,
        availableStates: Object.keys(scraped.states).sort(),
      }, { status: 404 });
    }

    const petrol = buildBreakdown(petrolRetail, vat.pVat, vat.pCess, CENTRAL_EXCISE_PETROL);
    const diesel = buildBreakdown(dieselRetail, vat.dVat, vat.dCess, CENTRAL_EXCISE_DIESEL);

    const petrolTotalTax = petrol.exciseDuty + petrol.vatAmount + petrol.additionalCess;
    const dieselTotalTax = diesel.exciseDuty + diesel.vatAmount + diesel.additionalCess;

    return NextResponse.json({
      success: true,
      state: resolvedState,
      city: resolvedCityName || cityParam || resolvedState.toLowerCase(),
      petrolPrice: petrolRetail,
      dieselPrice: dieselRetail,
      petrolChange,
      dieselChange,
      cngPrice,
      lpgPrice,
      petrol,
      diesel,
      summary: {
        petrol: {
          retailPrice: petrol.retailPrice,
          totalTax: round2(petrolTotalTax),
          totalTaxPercent: petrolRetail > 0 ? round2((petrolTotalTax / petrol.retailPrice) * 100) : 0,
          centralTaxPercent: petrolRetail > 0 ? round2((petrol.exciseDuty / petrol.retailPrice) * 100) : 0,
          stateTaxPercent: petrolRetail > 0 ? round2(((petrol.vatAmount + petrol.additionalCess) / petrol.retailPrice) * 100) : 0,
        },
        diesel: {
          retailPrice: diesel.retailPrice,
          totalTax: round2(dieselTotalTax),
          totalTaxPercent: dieselRetail > 0 ? round2((dieselTotalTax / diesel.retailPrice) * 100) : 0,
          centralTaxPercent: dieselRetail > 0 ? round2((diesel.exciseDuty / diesel.retailPrice) * 100) : 0,
          stateTaxPercent: dieselRetail > 0 ? round2(((diesel.vatAmount + diesel.additionalCess) / diesel.retailPrice) * 100) : 0,
        },
      },
      lastUpdated: scraped.fetchedAt,
      source: dataSource,
    });
  } catch (error) {
    console.error('Fuel prices API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get fuel prices' }, { status: 500 });
  }
}
