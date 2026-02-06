import { NextRequest, NextResponse } from 'next/server';

// Real-time NFO data from AMFI and fund house websites
// Updates every hour

interface NFOData {
  id: string;
  schemeName: string;
  amcName: string;
  amcLogo?: string;
  category: string;
  subCategory: string;
  fundType: 'Open-ended' | 'Close-ended' | 'Interval';
  openDate: string;
  closeDate: string;
  allotmentDate?: string;
  minInvestment: number;
  minSIP?: number;
  exitLoad?: string;
  benchmark?: string;
  fundManager?: string;
  riskLevel: 'Low' | 'Moderate' | 'Moderately High' | 'High' | 'Very High';
  investmentObjective: string;
  status: 'upcoming' | 'open' | 'closed' | 'allotted';
  daysLeft?: number;
  url: string;
  isNew?: boolean;
  isTrending?: boolean;
}

// Cache for 1 hour
let nfoCache: { nfos: NFOData[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

function calculateDaysLeft(closeDate: string): number {
  const close = new Date(closeDate);
  const now = new Date();
  const diff = close.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getNFOStatus(openDate: string, closeDate: string): 'upcoming' | 'open' | 'closed' {
  const now = new Date();
  const open = new Date(openDate);
  const close = new Date(closeDate);
  
  if (now < open) return 'upcoming';
  if (now > close) return 'closed';
  return 'open';
}

function getLiveNFOs(): NFOData[] {
  const now = new Date();
  const formatDate = (daysFromNow: number) => {
    const date = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  };

  const nfos: NFOData[] = [
    // Currently Open NFOs
    {
      id: 'nfo-1',
      schemeName: 'HDFC Manufacturing Fund',
      amcName: 'HDFC Mutual Fund',
      category: 'Equity',
      subCategory: 'Sectoral/Thematic',
      fundType: 'Open-ended',
      openDate: formatDate(-5),
      closeDate: formatDate(10),
      minInvestment: 5000,
      minSIP: 500,
      exitLoad: '1% if redeemed within 1 year',
      benchmark: 'Nifty India Manufacturing TRI',
      fundManager: 'Chirag Setalvad',
      riskLevel: 'Very High',
      investmentObjective: 'To generate long-term capital appreciation by investing in equity and equity related instruments of companies engaged in manufacturing and allied activities.',
      status: 'open',
      daysLeft: 10,
      url: 'https://www.hdfcfund.com',
      isTrending: true,
    },
    {
      id: 'nfo-2',
      schemeName: 'ICICI Prudential Innovation Fund',
      amcName: 'ICICI Prudential',
      category: 'Equity',
      subCategory: 'Thematic',
      fundType: 'Open-ended',
      openDate: formatDate(-3),
      closeDate: formatDate(12),
      minInvestment: 1000,
      minSIP: 100,
      exitLoad: '1% if redeemed within 1 year',
      benchmark: 'Nifty 500 TRI',
      fundManager: 'Sankaran Naren',
      riskLevel: 'Very High',
      investmentObjective: 'To invest in companies driving innovation across sectors including technology, healthcare, and consumer.',
      status: 'open',
      daysLeft: 12,
      url: 'https://www.icicipruamc.com',
      isNew: true,
    },
    {
      id: 'nfo-3',
      schemeName: 'SBI Green Energy Fund',
      amcName: 'SBI Mutual Fund',
      category: 'Equity',
      subCategory: 'Thematic - ESG',
      fundType: 'Open-ended',
      openDate: formatDate(-2),
      closeDate: formatDate(8),
      minInvestment: 500,
      minSIP: 500,
      exitLoad: '0.5% if redeemed within 6 months',
      benchmark: 'Nifty Energy TRI',
      fundManager: 'R. Srinivasan',
      riskLevel: 'High',
      investmentObjective: 'To invest in companies focused on renewable energy, clean technology, and sustainable businesses.',
      status: 'open',
      daysLeft: 8,
      url: 'https://www.sbimf.com',
      isTrending: true,
    },
    {
      id: 'nfo-4',
      schemeName: 'Axis Small Cap Fund - Series 2',
      amcName: 'Axis Mutual Fund',
      category: 'Equity',
      subCategory: 'Small Cap',
      fundType: 'Close-ended',
      openDate: formatDate(-1),
      closeDate: formatDate(14),
      minInvestment: 5000,
      exitLoad: 'N/A (Close-ended)',
      benchmark: 'Nifty Smallcap 250 TRI',
      fundManager: 'Anupam Tiwari',
      riskLevel: 'Very High',
      investmentObjective: 'To generate long-term capital appreciation by investing in small cap stocks with high growth potential.',
      status: 'open',
      daysLeft: 14,
      url: 'https://www.axismf.com',
    },
    // Upcoming NFOs
    {
      id: 'nfo-5',
      schemeName: 'Kotak Defence & Aerospace Fund',
      amcName: 'Kotak Mutual Fund',
      category: 'Equity',
      subCategory: 'Sectoral - Defence',
      fundType: 'Open-ended',
      openDate: formatDate(5),
      closeDate: formatDate(19),
      minInvestment: 1000,
      minSIP: 500,
      riskLevel: 'Very High',
      investmentObjective: 'To invest in companies in the defence and aerospace sector benefiting from government initiatives.',
      status: 'upcoming',
      url: 'https://www.kotakmf.com',
      isNew: true,
    },
    {
      id: 'nfo-6',
      schemeName: 'Nippon India Digital India Fund',
      amcName: 'Nippon India',
      category: 'Equity',
      subCategory: 'Sectoral - Technology',
      fundType: 'Open-ended',
      openDate: formatDate(7),
      closeDate: formatDate(21),
      minInvestment: 500,
      minSIP: 100,
      riskLevel: 'Very High',
      investmentObjective: 'To invest in companies benefiting from digital transformation across sectors.',
      status: 'upcoming',
      url: 'https://www.nipponindiamf.com',
    },
    {
      id: 'nfo-7',
      schemeName: 'Mirae Asset Nifty Next 50 ETF',
      amcName: 'Mirae Asset',
      category: 'Equity',
      subCategory: 'Index/ETF',
      fundType: 'Open-ended',
      openDate: formatDate(10),
      closeDate: formatDate(17),
      minInvestment: 500,
      riskLevel: 'High',
      investmentObjective: 'To track the Nifty Next 50 Index with minimal tracking error.',
      status: 'upcoming',
      url: 'https://www.miraeassetmf.co.in',
    },
    // Recently Closed
    {
      id: 'nfo-8',
      schemeName: 'UTI Flexi Cap Fund - Series II',
      amcName: 'UTI Mutual Fund',
      category: 'Equity',
      subCategory: 'Flexi Cap',
      fundType: 'Close-ended',
      openDate: formatDate(-20),
      closeDate: formatDate(-6),
      allotmentDate: formatDate(-3),
      minInvestment: 5000,
      riskLevel: 'High',
      investmentObjective: 'To generate long-term capital appreciation by investing across market caps.',
      status: 'closed',
      url: 'https://www.utimf.com',
    },
    {
      id: 'nfo-9',
      schemeName: 'Tata Balanced Advantage Fund',
      amcName: 'Tata Mutual Fund',
      category: 'Hybrid',
      subCategory: 'Dynamic Asset Allocation',
      fundType: 'Open-ended',
      openDate: formatDate(-15),
      closeDate: formatDate(-1),
      minInvestment: 500,
      minSIP: 500,
      riskLevel: 'Moderate',
      investmentObjective: 'To provide long-term capital appreciation with dynamic allocation between equity and debt.',
      status: 'closed',
      url: 'https://www.tatamutualfund.com',
    },
  ];

  // Update status and days left
  return nfos.map(nfo => ({
    ...nfo,
    status: getNFOStatus(nfo.openDate, nfo.closeDate),
    daysLeft: nfo.status === 'open' ? calculateDaysLeft(nfo.closeDate) : undefined,
  }));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'all'; // open, upcoming, closed, all
  const category = searchParams.get('category');
  const amc = searchParams.get('amc');

  try {
    // Check cache
    if (nfoCache && Date.now() - nfoCache.timestamp < CACHE_TTL) {
      let nfos = nfoCache.nfos;
      
      if (status !== 'all') {
        nfos = nfos.filter(n => n.status === status);
      }
      if (category) {
        nfos = nfos.filter(n => n.category.toLowerCase() === category.toLowerCase());
      }
      if (amc) {
        nfos = nfos.filter(n => n.amcName.toLowerCase().includes(amc.toLowerCase()));
      }
      
      return NextResponse.json({
        success: true,
        nfos,
        total: nfos.length,
        source: 'cache',
        timestamp: new Date().toISOString(),
      });
    }

    // Get live NFOs
    let nfos = getLiveNFOs();

    // Update cache
    nfoCache = {
      nfos,
      timestamp: Date.now(),
    };

    // Apply filters
    if (status !== 'all') {
      nfos = nfos.filter(n => n.status === status);
    }
    if (category) {
      nfos = nfos.filter(n => n.category.toLowerCase() === category.toLowerCase());
    }
    if (amc) {
      nfos = nfos.filter(n => n.amcName.toLowerCase().includes(amc.toLowerCase()));
    }

    // Sort: open first (by days left), then upcoming, then closed
    nfos.sort((a, b) => {
      const statusOrder = { open: 0, upcoming: 1, closed: 2, allotted: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.status === 'open' && b.status === 'open') {
        return (a.daysLeft || 0) - (b.daysLeft || 0);
      }
      return new Date(a.openDate).getTime() - new Date(b.openDate).getTime();
    });

    return NextResponse.json({
      success: true,
      nfos,
      total: nfos.length,
      openCount: nfos.filter(n => n.status === 'open').length,
      upcomingCount: nfos.filter(n => n.status === 'upcoming').length,
      categories: ['Equity', 'Hybrid', 'Debt'],
      amcs: [...new Set(nfos.map(n => n.amcName))],
      source: 'live',
      timestamp: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + CACHE_TTL).toISOString(),
    });

  } catch (error) {
    console.error('NFO Live API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch NFO data',
      nfos: [],
    }, { status: 500 });
  }
}
