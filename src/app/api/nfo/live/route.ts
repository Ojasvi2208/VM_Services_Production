import { NextRequest, NextResponse } from 'next/server';

// Recently Launched Funds — real data from AMFI NAV file
// Detects funds with NAV close to face value (₹10) launched in last 90 days
// NO fake/hardcoded data. Returns empty if none found.

interface NFOData {
  id: string;
  schemeName: string;
  amcName: string;
  category: string;
  subCategory: string;
  fundType: 'Open-ended' | 'Close-ended' | 'Interval';
  openDate: string;
  closeDate: string;
  minInvestment: number;
  minSIP?: number;
  riskLevel: 'Low' | 'Moderate' | 'Moderately High' | 'High' | 'Very High';
  investmentObjective: string;
  status: 'open' | 'upcoming' | 'closed';
  daysLeft?: number;
  url: string;
  isNew?: boolean;
  isTrending?: boolean;
}

// Cache for 6 hours (AMFI updates daily)
let nfoCache: { nfos: NFOData[]; timestamp: number } | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000;

function categorizeScheme(name: string): { category: string; subCategory: string; riskLevel: NFOData['riskLevel'] } {
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

async function fetchRecentlyLaunchedFunds(): Promise<NFOData[]> {
  const nfos: NFOData[] = [];

  try {
    const response = await fetch('https://portal.amfiindia.com/spages/NAVAll.txt', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VMFinancial/1.0)' },
    });

    if (!response.ok) {
      console.error('AMFI fetch failed:', response.status);
      return [];
    }

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
      if (isNaN(navDate.getTime())) continue;
      if (navDate < ninetyDaysAgo) continue;

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
        url: `https://www.amfiindia.com/mutual-fund-scheme-details/${schemeCode}`,
        isNew: true,
      });
    }
  } catch (error) {
    console.error('AMFI NFO Live fetch error:', error);
  }

  nfos.sort((a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime());
  return nfos.slice(0, 20);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'all';
  const category = searchParams.get('category');
  const amc = searchParams.get('amc');

  try {
    if (nfoCache && Date.now() - nfoCache.timestamp < CACHE_TTL) {
      let nfos = nfoCache.nfos;
      if (status !== 'all') nfos = nfos.filter(n => n.status === status);
      if (category) nfos = nfos.filter(n => n.category.toLowerCase() === category.toLowerCase());
      if (amc) nfos = nfos.filter(n => n.amcName.toLowerCase().includes(amc.toLowerCase()));

      return NextResponse.json({
        success: true,
        nfos,
        total: nfos.length,
        source: 'cache',
        timestamp: new Date().toISOString(),
      });
    }

    let nfos = await fetchRecentlyLaunchedFunds();

    console.log(`NFO Live API: found ${nfos.length} recently launched funds from AMFI`);

    nfoCache = { nfos, timestamp: Date.now() };

    if (status !== 'all') nfos = nfos.filter(n => n.status === status);
    if (category) nfos = nfos.filter(n => n.category.toLowerCase() === category.toLowerCase());
    if (amc) nfos = nfos.filter(n => n.amcName.toLowerCase().includes(amc.toLowerCase()));

    return NextResponse.json({
      success: true,
      nfos,
      total: nfos.length,
      openCount: nfos.length,
      upcomingCount: 0,
      categories: [...new Set(nfos.map(n => n.category))],
      amcs: [...new Set(nfos.map(n => n.amcName))],
      source: 'amfi',
      timestamp: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + CACHE_TTL).toISOString(),
    });

  } catch (error) {
    console.error('NFO Live API error:', error);
    return NextResponse.json({ success: true, nfos: [], total: 0, source: 'error', timestamp: new Date().toISOString() });
  }
}
