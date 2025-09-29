import { NextResponse } from 'next/server';

// Mutual fund data interface
interface MutualFundData {
  fundName: string;
  category: string;
  nav: string;
  change: string;
  changePercent: string;
  rank: number;
  rating: number;
  aum: string;
  isPositive: boolean;
  fundHouse: string;
}

// Top performing mutual funds across categories (based on AMFI and Value Research rankings)
const topMutualFunds: MutualFundData[] = [
  // Small Cap Leaders
  {
    fundName: "SBI Small Cap Fund",
    category: "Small Cap",
    nav: "142.85",
    change: "+2.34",
    changePercent: "+1.67",
    rank: 1,
    rating: 5,
    aum: "₹12,450 Cr",
    isPositive: true,
    fundHouse: "SBI MF"
  },
  {
    fundName: "Nippon India Small Cap",
    category: "Small Cap",
    nav: "87.65",
    change: "+2.89",
    changePercent: "+3.41",
    rank: 2,
    rating: 4,
    aum: "₹16,780 Cr",
    isPositive: true,
    fundHouse: "Nippon India MF"
  },
  // Mid Cap Leaders
  {
    fundName: "Mirae Asset Mid Cap Fund",
    category: "Mid Cap",
    nav: "78.90",
    change: "+1.45",
    changePercent: "+1.87",
    rank: 1,
    rating: 4,
    aum: "₹15,670 Cr",
    isPositive: true,
    fundHouse: "Mirae Asset MF"
  },
  {
    fundName: "Kotak Emerging Equity",
    category: "Mid Cap",
    nav: "134.56",
    change: "+1.78",
    changePercent: "+1.34",
    rank: 2,
    rating: 5,
    aum: "₹21,230 Cr",
    isPositive: true,
    fundHouse: "Kotak MF"
  },
  // Large Cap Leaders
  {
    fundName: "Axis Bluechip Fund",
    category: "Large Cap",
    nav: "65.43",
    change: "+1.12",
    changePercent: "+1.74",
    rank: 1,
    rating: 5,
    aum: "₹23,890 Cr",
    isPositive: true,
    fundHouse: "Axis MF"
  },
  {
    fundName: "Canara Robeco Bluechip",
    category: "Large Cap",
    nav: "89.76",
    change: "+0.98",
    changePercent: "+1.11",
    rank: 2,
    rating: 4,
    aum: "₹19,450 Cr",
    isPositive: true,
    fundHouse: "Canara Robeco MF"
  },
  // Flexi Cap Leaders
  {
    fundName: "Parag Parikh Flexi Cap",
    category: "Flexi Cap",
    nav: "112.34",
    change: "+2.10",
    changePercent: "+1.90",
    rank: 1,
    rating: 5,
    aum: "₹18,900 Cr",
    isPositive: true,
    fundHouse: "PPFAS MF"
  },
  {
    fundName: "HDFC Flexi Cap Fund",
    category: "Flexi Cap",
    nav: "95.67",
    change: "+0.78",
    changePercent: "+0.82",
    rank: 2,
    rating: 5,
    aum: "₹34,560 Cr",
    isPositive: true,
    fundHouse: "HDFC MF"
  },
  // Sectoral Leaders
  {
    fundName: "ICICI Pru Technology Fund",
    category: "Technology",
    nav: "189.76",
    change: "-0.89",
    changePercent: "-0.47",
    rank: 1,
    rating: 4,
    aum: "₹8,230 Cr",
    isPositive: false,
    fundHouse: "ICICI Pru MF"
  },
  {
    fundName: "SBI Healthcare Fund",
    category: "Healthcare",
    nav: "156.43",
    change: "+3.21",
    changePercent: "+2.09",
    rank: 1,
    rating: 5,
    aum: "₹4,560 Cr",
    isPositive: true,
    fundHouse: "SBI MF"
  },
  // Index Fund Leaders
  {
    fundName: "UTI Nifty Index Fund",
    category: "Index Fund",
    nav: "156.78",
    change: "+1.23",
    changePercent: "+0.79",
    rank: 1,
    rating: 4,
    aum: "₹9,450 Cr",
    isPositive: true,
    fundHouse: "UTI MF"
  },
  {
    fundName: "HDFC Index Sensex",
    category: "Index Fund",
    nav: "167.89",
    change: "+1.34",
    changePercent: "+0.81",
    rank: 2,
    rating: 4,
    aum: "₹7,890 Cr",
    isPositive: true,
    fundHouse: "HDFC MF"
  },
  // ELSS Leaders
  {
    fundName: "DSP Tax Saver Fund",
    category: "ELSS",
    nav: "76.54",
    change: "+1.34",
    changePercent: "+1.78",
    rank: 1,
    rating: 4,
    aum: "₹7,890 Cr",
    isPositive: true,
    fundHouse: "DSP MF"
  },
  {
    fundName: "Axis Long Term Equity",
    category: "ELSS",
    nav: "89.67",
    change: "+1.89",
    changePercent: "+2.15",
    rank: 2,
    rating: 5,
    aum: "₹12,340 Cr",
    isPositive: true,
    fundHouse: "Axis MF"
  },
  // Hybrid Leaders
  {
    fundName: "ICICI Pru Balanced Advantage",
    category: "Hybrid",
    nav: "67.89",
    change: "+0.89",
    changePercent: "+1.33",
    rank: 1,
    rating: 4,
    aum: "₹23,450 Cr",
    isPositive: true,
    fundHouse: "ICICI Pru MF"
  }
];

// Function to simulate real-time NAV changes
const addRealisticVariation = (funds: MutualFundData[]): MutualFundData[] => {
  return funds.map(fund => {
    const navValue = parseFloat(fund.nav);
    const variation = (Math.random() - 0.5) * 0.02; // ±2% max variation
    const newNav = navValue * (1 + variation);
    
    const changeValue = newNav - navValue;
    const changePercent = (changeValue / navValue) * 100;
    const isPositive = changeValue >= 0;
    
    return {
      ...fund,
      nav: newNav.toFixed(2),
      change: isPositive ? `+${changeValue.toFixed(2)}` : changeValue.toFixed(2),
      changePercent: isPositive ? `+${changePercent.toFixed(2)}` : changePercent.toFixed(2),
      isPositive
    };
  });
};

// Function to fetch real mutual fund data (you can integrate with AMFI, Value Research, or MorningStar APIs)
const fetchRealMutualFundData = async (): Promise<MutualFundData[]> => {
  try {
    // Example: AMFI API integration (when available)
    // const response = await fetch('https://www.amfiindia.com/spages/NAVAll.txt');
    // const data = await response.text();
    // return parseAMFIData(data);
    
    // For now, return realistic mock data
    return addRealisticVariation(topMutualFunds);
  } catch (error) {
    console.error('Error fetching mutual fund data:', error);
    return addRealisticVariation(topMutualFunds);
  }
};

export async function GET() {
  try {
    const mutualFundData = await fetchRealMutualFundData();
    
    const response = {
      success: true,
      funds: mutualFundData,
      lastUpdated: new Date().toISOString(),
      dataSource: 'AMFI/Value Research (Simulated)',
      disclaimer: 'Mutual fund investments are subject to market risks. Past performance does not guarantee future results.'
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error in mutual fund API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch mutual fund data',
        funds: addRealisticVariation(topMutualFunds.slice(0, 8)) // Fallback data
      }, 
      { status: 500 }
    );
  }
}
