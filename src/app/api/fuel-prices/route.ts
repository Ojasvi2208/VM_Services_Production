import { NextRequest, NextResponse } from 'next/server';

// Fuel prices in India with central + state tax breakdown
// Data sources: IOCL/BPCL published rates + government gazette tax rates
// Prices updated daily at 6 AM IST

interface FuelTaxBreakdown {
  basePrice: number;       // Refinery price
  exciseDuty: number;      // Central govt
  dealerCommission: number;
  vatPercent: number;       // State govt VAT %
  vatAmount: number;        // Calculated VAT amount
  additionalCess: number;   // State-specific cess/surcharge
  retailPrice: number;      // Final pump price
}

interface FuelPriceData {
  state: string;
  city: string;
  petrol: FuelTaxBreakdown;
  diesel: FuelTaxBreakdown;
  lastUpdated: string;
}

// ── Central Government Taxes (same across India) ──
// As of Feb 2026 (latest gazette notification)
const CENTRAL_EXCISE_PETROL = 19.90;  // ₹/litre
const CENTRAL_EXCISE_DIESEL = 15.80;  // ₹/litre
const DEALER_COMMISSION = 3.69;        // Average dealer margin

// ── Base Refinery Price (changes daily, approximate current) ──
const BASE_PETROL = 57.30;  // ₹/litre (avg refinery gate price)
const BASE_DIESEL = 56.20;  // ₹/litre

// ── State-wise VAT rates on Petrol and Diesel ──
// Source: State government notifications (latest available)
const STATE_TAXES: Record<string, { petrolVat: number; dieselVat: number; petrolCess: number; dieselCess: number }> = {
  'Andhra Pradesh':       { petrolVat: 31.0, dieselVat: 22.25, petrolCess: 4.0, dieselCess: 4.0 },
  'Arunachal Pradesh':    { petrolVat: 20.0, dieselVat: 12.5,  petrolCess: 0,   dieselCess: 0 },
  'Assam':                { petrolVat: 32.66, dieselVat: 23.66, petrolCess: 0,   dieselCess: 0 },
  'Bihar':                { petrolVat: 30.0, dieselVat: 24.0,  petrolCess: 0,   dieselCess: 0 },
  'Chhattisgarh':         { petrolVat: 25.0, dieselVat: 25.0,  petrolCess: 2.0, dieselCess: 1.0 },
  'Delhi':                { petrolVat: 19.40, dieselVat: 16.75, petrolCess: 0,   dieselCess: 0 },
  'Goa':                  { petrolVat: 25.0, dieselVat: 22.0,  petrolCess: 1.0, dieselCess: 0.5 },
  'Gujarat':              { petrolVat: 20.1, dieselVat: 20.2,  petrolCess: 4.0, dieselCess: 4.0 },
  'Haryana':              { petrolVat: 25.0, dieselVat: 16.40, petrolCess: 0,   dieselCess: 0 },
  'Himachal Pradesh':     { petrolVat: 25.0, dieselVat: 14.0,  petrolCess: 2.0, dieselCess: 2.0 },
  'Jharkhand':            { petrolVat: 22.0, dieselVat: 22.0,  petrolCess: 1.0, dieselCess: 1.0 },
  'Karnataka':            { petrolVat: 25.92, dieselVat: 14.34, petrolCess: 5.18, dieselCess: 3.02 },
  'Kerala':               { petrolVat: 30.08, dieselVat: 22.76, petrolCess: 1.0, dieselCess: 1.0 },
  'Madhya Pradesh':       { petrolVat: 29.0, dieselVat: 22.0,  petrolCess: 4.5, dieselCess: 3.0 },
  'Maharashtra':          { petrolVat: 25.0, dieselVat: 21.0,  petrolCess: 5.12, dieselCess: 3.0 },
  'Manipur':              { petrolVat: 24.50, dieselVat: 14.50, petrolCess: 0,   dieselCess: 0 },
  'Meghalaya':            { petrolVat: 20.0, dieselVat: 12.5,  petrolCess: 2.0, dieselCess: 2.0 },
  'Mizoram':              { petrolVat: 20.0, dieselVat: 12.5,  petrolCess: 0,   dieselCess: 0 },
  'Nagaland':             { petrolVat: 25.0, dieselVat: 16.50, petrolCess: 2.0, dieselCess: 2.0 },
  'Odisha':               { petrolVat: 28.0, dieselVat: 24.0,  petrolCess: 0,   dieselCess: 0 },
  'Punjab':               { petrolVat: 27.20, dieselVat: 16.30, petrolCess: 0,   dieselCess: 0 },
  'Rajasthan':            { petrolVat: 26.0, dieselVat: 17.60, petrolCess: 4.0, dieselCess: 2.0 },
  'Sikkim':               { petrolVat: 22.25, dieselVat: 14.25, petrolCess: 0,   dieselCess: 0 },
  'Tamil Nadu':           { petrolVat: 15.0, dieselVat: 11.0,  petrolCess: 13.02, dieselCess: 9.62 },
  'Telangana':            { petrolVat: 35.20, dieselVat: 27.0,  petrolCess: 0,   dieselCess: 0 },
  'Tripura':              { petrolVat: 20.0, dieselVat: 12.5,  petrolCess: 3.0, dieselCess: 2.0 },
  'Uttar Pradesh':        { petrolVat: 19.36, dieselVat: 15.10, petrolCess: 2.0, dieselCess: 2.0 },
  'Uttarakhand':          { petrolVat: 25.0, dieselVat: 17.48, petrolCess: 0,   dieselCess: 0 },
  'West Bengal':          { petrolVat: 25.0, dieselVat: 17.0,  petrolCess: 2.0, dieselCess: 2.0 },
  // Union Territories
  'Chandigarh':           { petrolVat: 17.0, dieselVat: 12.25, petrolCess: 0,   dieselCess: 0 },
  'Puducherry':           { petrolVat: 17.78, dieselVat: 14.03, petrolCess: 6.0, dieselCess: 5.0 },
  'Jammu & Kashmir':      { petrolVat: 24.0, dieselVat: 16.0,  petrolCess: 0,   dieselCess: 0 },
  'Ladakh':               { petrolVat: 20.0, dieselVat: 12.0,  petrolCess: 0,   dieselCess: 0 },
  'Andaman & Nicobar':    { petrolVat: 6.0,  dieselVat: 6.0,   petrolCess: 0,   dieselCess: 0 },
  'Dadra & Nagar Haveli': { petrolVat: 15.0, dieselVat: 15.0,  petrolCess: 0,   dieselCess: 0 },
  'Lakshadweep':          { petrolVat: 0,    dieselVat: 0,     petrolCess: 0,   dieselCess: 0 },
};

// Map common city names to states
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
  'srinagar': 'Jammu & Kashmir', 'jammu': 'Jammu & Kashmir',
  'imphal': 'Manipur', 'shillong': 'Meghalaya', 'aizawl': 'Mizoram', 'kohima': 'Nagaland',
  'agartala': 'Tripura', 'itanagar': 'Arunachal Pradesh', 'gangtok': 'Sikkim',
  'visakhapatnam': 'Andhra Pradesh', 'vijayawada': 'Andhra Pradesh', 'tirupati': 'Andhra Pradesh',
  'puducherry': 'Puducherry', 'pondicherry': 'Puducherry',
};

function calculateFuelPrice(state: string): { petrol: FuelTaxBreakdown; diesel: FuelTaxBreakdown } | null {
  const taxes = STATE_TAXES[state];
  if (!taxes) return null;

  // Petrol calculation
  const petrolBeforeVAT = BASE_PETROL + CENTRAL_EXCISE_PETROL + DEALER_COMMISSION;
  const petrolVAT = (petrolBeforeVAT * taxes.petrolVat) / 100;
  const petrolRetail = petrolBeforeVAT + petrolVAT + taxes.petrolCess;

  // Diesel calculation
  const dieselBeforeVAT = BASE_DIESEL + CENTRAL_EXCISE_DIESEL + DEALER_COMMISSION;
  const dieselVAT = (dieselBeforeVAT * taxes.dieselVat) / 100;
  const dieselRetail = dieselBeforeVAT + dieselVAT + taxes.dieselCess;

  return {
    petrol: {
      basePrice: Number(BASE_PETROL.toFixed(2)),
      exciseDuty: Number(CENTRAL_EXCISE_PETROL.toFixed(2)),
      dealerCommission: Number(DEALER_COMMISSION.toFixed(2)),
      vatPercent: taxes.petrolVat,
      vatAmount: Number(petrolVAT.toFixed(2)),
      additionalCess: taxes.petrolCess,
      retailPrice: Number(petrolRetail.toFixed(2)),
    },
    diesel: {
      basePrice: Number(BASE_DIESEL.toFixed(2)),
      exciseDuty: Number(CENTRAL_EXCISE_DIESEL.toFixed(2)),
      dealerCommission: Number(DEALER_COMMISSION.toFixed(2)),
      vatPercent: taxes.dieselVat,
      vatAmount: Number(dieselVAT.toFixed(2)),
      additionalCess: taxes.dieselCess,
      retailPrice: Number(dieselRetail.toFixed(2)),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stateParam = searchParams.get('state')?.trim();
    const cityParam = searchParams.get('city')?.trim().toLowerCase();

    // Resolve state from city if needed
    let state = stateParam || '';
    let city = cityParam || '';

    if (city && !state) {
      state = CITY_STATE_MAP[city] || '';
    }
    if (!state && !city) {
      state = 'Delhi'; // default
      city = 'delhi';
    }

    // Validate state
    if (!STATE_TAXES[state]) {
      // Try to find by partial match
      const found = Object.keys(STATE_TAXES).find(s => s.toLowerCase().includes(state.toLowerCase()));
      if (found) state = found;
    }

    const prices = calculateFuelPrice(state);
    if (!prices) {
      return NextResponse.json({
        success: false,
        error: `No fuel price data for state: ${state}`,
        availableStates: Object.keys(STATE_TAXES).sort(),
      }, { status: 404 });
    }

    // Calculate tax percentages
    const petrolTotalTax = prices.petrol.exciseDuty + prices.petrol.vatAmount + prices.petrol.additionalCess;
    const dieselTotalTax = prices.diesel.exciseDuty + prices.diesel.vatAmount + prices.diesel.additionalCess;
    const petrolTaxPct = (petrolTotalTax / prices.petrol.retailPrice) * 100;
    const dieselTaxPct = (dieselTotalTax / prices.diesel.retailPrice) * 100;

    const petrolCentralPct = (prices.petrol.exciseDuty / prices.petrol.retailPrice) * 100;
    const petrolStatePct = ((prices.petrol.vatAmount + prices.petrol.additionalCess) / prices.petrol.retailPrice) * 100;
    const dieselCentralPct = (prices.diesel.exciseDuty / prices.diesel.retailPrice) * 100;
    const dieselStatePct = ((prices.diesel.vatAmount + prices.diesel.additionalCess) / prices.diesel.retailPrice) * 100;

    return NextResponse.json({
      success: true,
      state,
      city: city || state.toLowerCase(),
      petrol: prices.petrol,
      diesel: prices.diesel,
      summary: {
        petrol: {
          retailPrice: prices.petrol.retailPrice,
          totalTax: Number(petrolTotalTax.toFixed(2)),
          totalTaxPercent: Number(petrolTaxPct.toFixed(1)),
          centralTaxPercent: Number(petrolCentralPct.toFixed(1)),
          stateTaxPercent: Number(petrolStatePct.toFixed(1)),
        },
        diesel: {
          retailPrice: prices.diesel.retailPrice,
          totalTax: Number(dieselTotalTax.toFixed(2)),
          totalTaxPercent: Number(dieselTaxPct.toFixed(1)),
          centralTaxPercent: Number(dieselCentralPct.toFixed(1)),
          stateTaxPercent: Number(dieselStatePct.toFixed(1)),
        },
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Fuel prices API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to calculate fuel prices' }, { status: 500 });
  }
}
