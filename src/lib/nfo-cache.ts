// Shared NFO cache — written by cron, read by /api/nfo/live
// Persists across warm serverless invocations (module-level singleton)

export interface NFOCacheItem {
  id: string;
  schemeName: string;
  amcName: string;
  category: string;
  subCategory: string;
  fundType: string;
  openDate: string;
  closeDate: string;
  minInvestment: number;
  riskLevel: string;
  investmentObjective: string;
  status: string;
  daysLeft?: number;
  isNew: boolean;
  isTrending: boolean;
  nav?: number;
  launchDate?: string;
  schemeType?: string;
  schemeCategory?: string;
}

export interface NFOCacheData {
  nfos: NFOCacheItem[];
  fetchedAt: string;
  source: string;
}

let cachedData: NFOCacheData | null = null;

export function getNFOCache(): NFOCacheData | null {
  return cachedData;
}

export function setNFOCache(data: NFOCacheData): void {
  cachedData = data;
}

export function isNFOCacheFresh(): boolean {
  if (!cachedData) return false;
  const age = Date.now() - new Date(cachedData.fetchedAt).getTime();
  return age < 25 * 60 * 60 * 1000; // 25 hours
}
