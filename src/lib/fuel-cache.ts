// Shared fuel price cache — written by cron, read by /api/fuel-prices
// Persists across warm Vercel function invocations (module-level singleton)

export interface FuelStatePrice {
  state: string;
  petrolPrice: number;
  petrolChange: number;
  dieselPrice: number;
  dieselChange: number;
}

export interface FuelCacheData {
  prices: FuelStatePrice[];
  fetchedAt: string;   // ISO timestamp
  source: string;
}

let cachedData: FuelCacheData | null = null;

export function getFuelCache(): FuelCacheData | null {
  return cachedData;
}

export function setFuelCache(data: FuelCacheData): void {
  cachedData = data;
}

export function isCacheFresh(): boolean {
  if (!cachedData) return false;
  const age = Date.now() - new Date(cachedData.fetchedAt).getTime();
  return age < 25 * 60 * 60 * 1000; // 25 hours
}
