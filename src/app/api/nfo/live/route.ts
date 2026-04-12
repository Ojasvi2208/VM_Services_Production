import { NextRequest, NextResponse } from 'next/server';
import { cachedJson, CACHE_TTL } from '@/lib/api-cache-headers';
import { getNFOCache, setNFOCache, type NFOCacheData, type NFOCacheItem } from '@/lib/nfo-cache';

// Cache-first NFO endpoint — cron populates cache, this only reads.
// Fallback chain: module singleton → /tmp file → emergency inline fetch

// ── Emergency fallback: inline AMFI fetch (only on first-ever deploy before cron runs) ──

function categorizeScheme(name: string): { category: string; subCategory: string; riskLevel: string } {
  const n = name.toLowerCase();
  if (n.includes('overnight')) return { category: 'Debt', subCategory: 'Overnight', riskLevel: 'Low' };
  if (n.includes('liquid')) return { category: 'Debt', subCategory: 'Liquid', riskLevel: 'Low' };
  if (n.includes('money market')) return { category: 'Debt', subCategory: 'Money Market', riskLevel: 'Low' };
  if (n.includes('gilt') || n.includes('bond') || n.includes('duration') || n.includes('income') || n.includes('floating') || n.includes('credit risk') || n.includes('banking')) return { category: 'Debt', subCategory: 'Debt', riskLevel: 'Moderate' };
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('dynamic asset') || n.includes('arbitrage') || n.includes('equity savings') || n.includes('multi asset')) return { category: 'Hybrid', subCategory: 'Hybrid', riskLevel: 'Moderately High' };
  if (n.includes('small cap') || n.includes('micro cap')) return { category: 'Equity', subCategory: 'Small Cap', riskLevel: 'Very High' };
  if (n.includes('mid cap')) return { category: 'Equity', subCategory: 'Mid Cap', riskLevel: 'Very High' };
  if (n.includes('large cap') || n.includes('large & mid')) return { category: 'Equity', subCategory: 'Large Cap', riskLevel: 'High' };
  if (n.includes('flexi cap') || n.includes('multi cap')) return { category: 'Equity', subCategory: 'Flexi Cap', riskLevel: 'Very High' };
  if (n.includes('index') || n.includes('etf') || n.includes('nifty') || n.includes('sensex')) return { category: 'Equity', subCategory: 'Index/ETF', riskLevel: 'High' };
  if (n.includes('sectoral') || n.includes('thematic') || n.includes('dividend yield') || n.includes('value') || n.includes('contra') || n.includes('focused') || n.includes('elss')) return { category: 'Equity', subCategory: 'Thematic', riskLevel: 'Very High' };
  return { category: 'Equity', subCategory: 'Equity', riskLevel: 'High' };
}

function cleanSchemeName(name: string): string {
  return name
    .replace(/\s*-\s*Direct\s*(Plan)?\s*/i, ' ')
    .replace(/\s*-\s*Growth\s*(Option)?\s*/i, '')
    .replace(/\s*Direct\s*-?\s*Growth\s*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function emergencyFetchFromAMFI(): Promise<NFOCacheItem[]> {
  const nfos: NFOCacheItem[] = [];
  try {
    const response = await fetch('https://portal.amfiindia.com/spages/NAVAll.txt', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VMFinancial/1.0)' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return [];

    const text = await response.text();
    const lines = text.split('\n');
    const today = new Date();
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    let currentAMC = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!trimmed.includes(';') && (trimmed.endsWith('Mutual Fund') || trimmed.endsWith('Mutual Fund '))) {
        currentAMC = trimmed.trim();
        continue;
      }
      const parts = trimmed.split(';');
      if (parts.length < 6) continue;

      const schemeCode = parts[0]?.trim();
      const schemeName = parts[3]?.trim() || '';
      const navStr = parts[4]?.trim() || '0';
      const navDateStr = parts[5]?.trim() || '';
      if (!schemeName || !navDateStr || !schemeCode) continue;

      const nav = parseFloat(navStr);
      if (isNaN(nav) || nav < 9.0 || nav > 11.5) continue;
      if (!schemeName.includes('Direct')) continue;
      const nameLower = schemeName.toLowerCase();
      if (!nameLower.includes('growth')) continue;
      if (nameLower.includes('idcw') || nameLower.includes('dividend')) continue;

      const navDate = new Date(navDateStr);
      if (isNaN(navDate.getTime()) || navDate < ninetyDaysAgo) continue;

      const { category, subCategory, riskLevel } = categorizeScheme(schemeName);
      nfos.push({
        id: schemeCode,
        schemeName: cleanSchemeName(schemeName),
        amcName: currentAMC || 'Mutual Fund',
        category,
        subCategory,
        fundType: 'Open-ended',
        openDate: new Date(navDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        closeDate: navDate.toISOString().split('T')[0],
        minInvestment: 500,
        riskLevel,
        investmentObjective: `Recently launched ${category.toLowerCase()} fund — ${subCategory}`,
        status: 'open',
        isNew: true,
        isTrending: false,
        nav,
      });
    }
  } catch (error) {
    console.error('Emergency AMFI fetch error:', error);
  }
  nfos.sort((a, b) => (b.closeDate || '').localeCompare(a.closeDate || ''));
  return nfos.slice(0, 20);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'all';
  const category = searchParams.get('category');
  const amc = searchParams.get('amc');

  try {
    // 1. Hot path: module-level cache (<1ms)
    let cache = getNFOCache();

    // 2. Cold start fallback: /tmp file (<5ms)
    if (!cache) {
      try {
        const fs = await import('fs');
        const raw = fs.readFileSync('/tmp/nfo-cache.json', 'utf-8');
        cache = JSON.parse(raw) as NFOCacheData;
        setNFOCache(cache);
      } catch { /* no /tmp file yet */ }
    }

    // 3. Emergency: inline AMFI fetch (first-ever deploy only)
    if (!cache) {
      console.log('NFO Live: no cache — emergency inline AMFI fetch');
      const nfos = await emergencyFetchFromAMFI();
      cache = { nfos, fetchedAt: new Date().toISOString(), source: 'emergency-inline' };
      setNFOCache(cache);
    }

    // 4. Apply query filters
    let nfos = cache.nfos;
    if (status !== 'all') nfos = nfos.filter(n => n.status === status);
    if (category) nfos = nfos.filter(n => n.category.toLowerCase() === category.toLowerCase());
    if (amc) nfos = nfos.filter(n => n.amcName.toLowerCase().includes(amc.toLowerCase()));

    return cachedJson({
      success: true,
      nfos,
      total: nfos.length,
      openCount: nfos.filter(n => n.status === 'open').length,
      upcomingCount: nfos.filter(n => n.status === 'upcoming').length,
      categories: [...new Set(nfos.map(n => n.category))],
      amcs: [...new Set(nfos.map(n => n.amcName))],
      source: cache.source,
      cachedAt: cache.fetchedAt,
      timestamp: new Date().toISOString(),
    }, CACHE_TTL.NFO);

  } catch (error) {
    console.error('NFO Live API error:', error);
    return NextResponse.json({ success: true, nfos: [], total: 0, source: 'error', timestamp: new Date().toISOString() });
  }
}
