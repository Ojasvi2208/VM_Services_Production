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

// ── Scraped city-level cache (from goodreturns.in via GitHub Action) ──

export interface ScrapedCityPrice {
  name: string;
  petrol: number;
  diesel: number;
  petrolChange: string;
  dieselChange: string;
  cng?: number;
}

export interface ScrapedStatePrice {
  petrol: number;
  diesel: number;
  petrolChange: string;
  dieselChange: string;
  cng?: number;
}

export interface ScrapedFuelData {
  cities: Record<string, ScrapedCityPrice>;   // slug → prices
  states: Record<string, ScrapedStatePrice>;
  fetchedAt: string;
  source: string;
}

let scrapedData: ScrapedFuelData | null = null;

export function getScrapedFuelCache(): ScrapedFuelData | null {
  return scrapedData;
}

export function setScrapedFuelCache(data: ScrapedFuelData): void {
  scrapedData = data;
}

export function isScrapedCacheFresh(): boolean {
  if (!scrapedData) return false;
  const age = Date.now() - new Date(scrapedData.fetchedAt).getTime();
  return age < 25 * 60 * 60 * 1000; // 25 hours
}
