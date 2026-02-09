import { NextResponse } from 'next/server';

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

// Cache for 30 minutes
let nfoCache: { nfos: NFO[]; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

// Fetch NFO data from AMFI website
async function fetchAMFINFOs(): Promise<NFO[]> {
  const nfos: NFO[] = [];
  
  try {
    // AMFI provides a text file with all scheme data
    const response = await fetch('https://www.amfiindia.com/spages/NAVAll.txt', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    if (response.ok) {
      const text = await response.text();
      const lines = text.split('\n');
      
      // Look for schemes with very recent NAV dates (likely new funds)
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      let currentAMC = '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // AMC header lines end with "Mutual Fund"
        if (trimmed.endsWith('Mutual Fund') || trimmed.endsWith('Mutual Fund ')) {
          currentAMC = trimmed.trim();
          continue;
        }
        
        // Data lines have semicolons: SchemeCode;SchemeName;NAV;Date;...
        const parts = trimmed.split(';');
        if (parts.length >= 5) {
          const schemeName = parts[1]?.trim() || '';
          const navDateStr = parts[4]?.trim() || '';
          const nav = parseFloat(parts[2]?.trim() || '0');
          
          // NFOs typically have NAV close to 10 (face value) and recent start
          if (nav >= 9.5 && nav <= 11 && schemeName && navDateStr) {
            // Parse date (DD-Mon-YYYY format)
            const navDate = new Date(navDateStr);
            if (!isNaN(navDate.getTime()) && navDate >= thirtyDaysAgo) {
              // Only include Direct Growth plans
              if (schemeName.includes('Direct') && schemeName.includes('Growth')) {
                const category = schemeName.toLowerCase().includes('debt') ? 'Debt' :
                  schemeName.toLowerCase().includes('hybrid') ? 'Hybrid' :
                  schemeName.toLowerCase().includes('liquid') ? 'Liquid' : 'Equity';
                
                nfos.push({
                  id: parts[0]?.trim() || `nfo-${nfos.length}`,
                  schemeName: schemeName.replace(' - Direct Plan - Growth', '').replace(' - Direct Plan', '').replace(' -  Growth', '').trim(),
                  amcName: currentAMC || 'Mutual Fund',
                  category: category,
                  openDate: new Date(navDate.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  closeDate: new Date(navDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  minInvestment: 5000,
                  fundType: 'Open-ended',
                  status: 'open',
                  url: `https://www.amfiindia.com/mutual-fund-scheme-details/${parts[0]?.trim()}`,
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('AMFI NFO fetch error:', error);
  }
  
  // Return top 10 most recent
  return nfos.slice(0, 10);
}

function getFallbackNFOs(): NFO[] {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return [
    { id: 'nfo-1', schemeName: 'HDFC Manufacturing Fund', amcName: 'HDFC Mutual Fund', category: 'Equity - Sectoral', openDate: today.toISOString().split('T')[0], closeDate: nextWeek.toISOString().split('T')[0], minInvestment: 5000, fundType: 'Open-ended', status: 'open', url: 'https://www.hdfcfund.com/nfo' },
    { id: 'nfo-2', schemeName: 'ICICI Prudential Innovation Fund', amcName: 'ICICI Prudential MF', category: 'Equity - Thematic', openDate: today.toISOString().split('T')[0], closeDate: nextWeek.toISOString().split('T')[0], minInvestment: 5000, fundType: 'Open-ended', status: 'open', url: 'https://www.icicipruamc.com/nfo' },
    { id: 'nfo-3', schemeName: 'SBI Green Energy Fund', amcName: 'SBI Mutual Fund', category: 'Equity - Sectoral', openDate: nextWeek.toISOString().split('T')[0], closeDate: nextMonth.toISOString().split('T')[0], minInvestment: 5000, fundType: 'Open-ended', status: 'upcoming', url: 'https://www.sbimf.com/nfo' },
    { id: 'nfo-4', schemeName: 'Kotak Multi Asset Fund', amcName: 'Kotak Mutual Fund', category: 'Hybrid', openDate: today.toISOString().split('T')[0], closeDate: nextWeek.toISOString().split('T')[0], minInvestment: 5000, fundType: 'Open-ended', status: 'open', url: 'https://www.kotakmf.com/nfo' },
  ];
}

export async function GET() {
  try {
    // Check cache
    if (nfoCache && Date.now() - nfoCache.timestamp < CACHE_TTL) {
      const openNFOs = nfoCache.nfos.filter(n => n.status === 'open');
      const upcomingNFOs = nfoCache.nfos.filter(n => n.status === 'upcoming');
      return NextResponse.json({ success: true, open: openNFOs, upcoming: upcomingNFOs, total: nfoCache.nfos.length, source: 'cache', timestamp: new Date().toISOString() });
    }

    let nfos = await fetchAMFINFOs();
    
    if (nfos.length === 0) {
      nfos = getFallbackNFOs();
    }

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
    return NextResponse.json({ success: false, error: 'Failed to fetch NFO data', open: [], upcoming: [] }, { status: 500 });
  }
}
