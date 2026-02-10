import { NextRequest, NextResponse } from 'next/server';
import { setFuelCache, type FuelStatePrice } from '@/lib/fuel-cache';

// indianapi.in fuel price API
const FUEL_API_BASE = 'https://fuel.indianapi.in/live_fuel_price';
const FUEL_API_KEY = process.env.INDIANAPI_KEY || 'sk-live-Ne03Yxzf71nIfvbXTUrjZ5W1PGqkz75472pJRFTA';

// Vercel cron secret to prevent unauthorized calls
const CRON_SECRET = process.env.CRON_SECRET || '';

interface IndianApiFuelItem {
  city: string;   // actually state name
  price: string;
  change: string;
}

async function fetchFuelPrices(fuelType: 'petrol' | 'diesel'): Promise<IndianApiFuelItem[]> {
  const url = `${FUEL_API_BASE}?fuel_type=${fuelType}&location_type=state`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': FUEL_API_KEY },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`indianapi.in returned ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret if set (Vercel sends this header)
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Fetch petrol and diesel prices in parallel
    const [petrolData, dieselData] = await Promise.all([
      fetchFuelPrices('petrol'),
      fetchFuelPrices('diesel'),
    ]);

    // Merge into a single state-keyed structure
    const dieselMap = new Map<string, IndianApiFuelItem>();
    for (const d of dieselData) {
      dieselMap.set(d.city, d);
    }

    const prices: FuelStatePrice[] = petrolData.map((p) => {
      const d = dieselMap.get(p.city);
      return {
        state: p.city,
        petrolPrice: parseFloat(p.price) || 0,
        petrolChange: parseFloat(p.change) || 0,
        dieselPrice: d ? parseFloat(d.price) || 0 : 0,
        dieselChange: d ? parseFloat(d.change) || 0 : 0,
      };
    });

    // Store in shared cache
    const cacheData = {
      prices,
      fetchedAt: new Date().toISOString(),
      source: 'indianapi.in',
    };
    setFuelCache(cacheData);

    // Also write to /tmp for cold-start recovery
    try {
      const fs = await import('fs');
      fs.writeFileSync('/tmp/fuel-cache.json', JSON.stringify(cacheData));
    } catch {
      // /tmp write may fail in some environments — non-critical
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed fuel prices for ${prices.length} states`,
      fetchedAt: cacheData.fetchedAt,
      stateCount: prices.length,
    });
  } catch (error: any) {
    console.error('Cron refresh-fuel error:', error?.message);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch fuel prices',
    }, { status: 500 });
  }
}
