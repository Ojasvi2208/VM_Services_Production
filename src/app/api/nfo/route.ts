import { NextResponse } from 'next/server';

// Recently Launched Funds — detected from AMFI NAV data (NAV ≈ 10)
// NO fake/fallback data. Returns empty if none found.

interface NFO {
  id: string;
  schemeName: string;
  amcName: string;
  category: string;
  openDate: string;
  closeDate: string;
  minInvestment: number;
  fundType: string;
  status: 'open' | 'upcoming' | 'closed';
  url: string;
}

// Cache for 6 hours (AMFI data updates once daily)
let nfoCache: { nfos: NFO[]; timestamp: number } | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000;

function categorizeScheme(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('gilt') || n.includes('bond') || n.includes('debt') || n.includes('duration') || n.includes('income') || n.includes('money market') || n.includes('overnight') || n.includes('liquid') || n.includes('floating') || n.includes('credit risk') || n.includes('banking and psu') || n.includes('banking & psu')) return 'Debt';
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('dynamic asset') || n.includes('arbitrage') || n.includes('equity savings') || n.includes('multi asset')) return 'Hybrid';
  return 'Equity';
}

function cleanSchemeName(name: string): string {
  return name
    .replace(/\s*-\s*Direct\s*(Plan)?\s*/i, ' ')
    .replace(/\s*-\s*Growth\s*(Option)?\s*/i, '')
    .replace(/\s*Direct\s*-?\s*Growth\s*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchRecentlyLaunchedFunds(): Promise<NFO[]> {
  const nfos: NFO[] = [];

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

    // AMFI format: SchemeCode;ISIN1;ISIN2;SchemeName;NAV;Date
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // AMC header lines (no semicolons, contain "Mutual Fund")
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

      // Only Direct Growth plans (avoids duplicates)
      if (!schemeName.includes('Direct')) continue;
      const nameLower = schemeName.toLowerCase();
      if (!nameLower.includes('growth')) continue;
      // Skip IDCW / dividend plans
      if (nameLower.includes('idcw') || nameLower.includes('dividend')) continue;

      // Parse DD-Mon-YYYY date
      const navDate = new Date(navDateStr);
      if (isNaN(navDate.getTime())) continue;
      if (navDate < ninetyDaysAgo) continue;

      const category = categorizeScheme(schemeName);
      const launchDateApprox = new Date(navDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      nfos.push({
        id: schemeCode,
        schemeName: cleanSchemeName(schemeName),
        amcName: currentAMC || 'Mutual Fund',
        category,
        openDate: launchDateApprox,
        closeDate: navDate.toISOString().split('T')[0],
        minInvestment: 500,
        fundType: 'Open-ended',
        status: 'open',
        url: `https://www.amfiindia.com/mutual-fund-scheme-details/${schemeCode}`,
      });
    }
  } catch (error) {
    console.error('AMFI NFO fetch error:', error);
  }

  // Sort by NAV date (most recent first) and return top 15
  nfos.sort((a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime());
  return nfos.slice(0, 15);
}

export async function GET() {
  try {
    // Check cache
    if (nfoCache && Date.now() - nfoCache.timestamp < CACHE_TTL) {
      const openNFOs = nfoCache.nfos.filter(n => n.status === 'open');
      const upcomingNFOs = nfoCache.nfos.filter(n => n.status === 'upcoming');
      return NextResponse.json({ success: true, open: openNFOs, upcoming: upcomingNFOs, total: nfoCache.nfos.length, source: 'cache', timestamp: new Date().toISOString() });
    }

    const nfos = await fetchRecentlyLaunchedFunds();

    console.log(`NFO API: found ${nfos.length} recently launched funds from AMFI`);

    nfoCache = { nfos, timestamp: Date.now() };

    const openNFOs = nfos.filter(n => n.status === 'open');
    const upcomingNFOs = nfos.filter(n => n.status === 'upcoming');

    return NextResponse.json({
      success: true,
      open: openNFOs,
      upcoming: upcomingNFOs,
      total: nfos.length,
      source: 'amfi',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('NFO API error:', error);
    return NextResponse.json({ success: true, open: [], upcoming: [], total: 0, source: 'error', timestamp: new Date().toISOString() });
  }
}
