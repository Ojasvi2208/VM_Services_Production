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

// Fetch NFO data - in production this would come from AMFI or fund house APIs
async function fetchNFOData(): Promise<NFO[]> {
  // For now, return curated NFO data
  // In production, this would fetch from AMFI API or scrape from fund house websites
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return [
    {
      id: 'nfo-1',
      schemeName: 'HDFC Manufacturing Fund',
      amcName: 'HDFC Mutual Fund',
      category: 'Equity - Sectoral',
      openDate: today.toISOString().split('T')[0],
      closeDate: nextWeek.toISOString().split('T')[0],
      minInvestment: 5000,
      fundType: 'Open-ended',
      status: 'open',
      url: 'https://www.hdfcfund.com/nfo'
    },
    {
      id: 'nfo-2',
      schemeName: 'ICICI Prudential Innovation Fund',
      amcName: 'ICICI Prudential Mutual Fund',
      category: 'Equity - Thematic',
      openDate: today.toISOString().split('T')[0],
      closeDate: nextWeek.toISOString().split('T')[0],
      minInvestment: 5000,
      fundType: 'Open-ended',
      status: 'open',
      url: 'https://www.icicipruamc.com/nfo'
    },
    {
      id: 'nfo-3',
      schemeName: 'SBI Green Energy Fund',
      amcName: 'SBI Mutual Fund',
      category: 'Equity - Sectoral',
      openDate: nextWeek.toISOString().split('T')[0],
      closeDate: nextMonth.toISOString().split('T')[0],
      minInvestment: 5000,
      fundType: 'Open-ended',
      status: 'upcoming',
      url: 'https://www.sbimf.com/nfo'
    },
    {
      id: 'nfo-4',
      schemeName: 'Axis Digital India Fund',
      amcName: 'Axis Mutual Fund',
      category: 'Equity - Sectoral',
      openDate: nextWeek.toISOString().split('T')[0],
      closeDate: nextMonth.toISOString().split('T')[0],
      minInvestment: 1000,
      fundType: 'Open-ended',
      status: 'upcoming',
      url: 'https://www.axismf.com/nfo'
    },
    {
      id: 'nfo-5',
      schemeName: 'Kotak Multi Asset Allocation Fund',
      amcName: 'Kotak Mutual Fund',
      category: 'Hybrid - Multi Asset',
      openDate: today.toISOString().split('T')[0],
      closeDate: nextWeek.toISOString().split('T')[0],
      minInvestment: 5000,
      fundType: 'Open-ended',
      status: 'open',
      url: 'https://www.kotakmf.com/nfo'
    },
    {
      id: 'nfo-6',
      schemeName: 'Nippon India Defence Fund',
      amcName: 'Nippon India Mutual Fund',
      category: 'Equity - Sectoral',
      openDate: nextWeek.toISOString().split('T')[0],
      closeDate: nextMonth.toISOString().split('T')[0],
      minInvestment: 5000,
      fundType: 'Open-ended',
      status: 'upcoming',
      url: 'https://www.nipponindiamf.com/nfo'
    }
  ];
}

export async function GET() {
  try {
    const nfos = await fetchNFOData();
    
    // Separate by status
    const openNFOs = nfos.filter(n => n.status === 'open');
    const upcomingNFOs = nfos.filter(n => n.status === 'upcoming');
    
    return NextResponse.json({
      success: true,
      open: openNFOs,
      upcoming: upcomingNFOs,
      total: nfos.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('NFO API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch NFO data',
      open: [],
      upcoming: []
    }, { status: 500 });
  }
}
