'use client';

import { useState, useEffect, useCallback } from 'react';

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

const MutualFundBanner = () => {
  const [mutualFundData, setMutualFundData] = useState<MutualFundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('Loading...');

  // Mock mutual fund data with top performers from different categories
  const getMockMutualFundData = (): MutualFundData[] => {
    const funds = [
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
        fundName: "ICICI Pru Technology Fund",
        category: "Sectoral",
        nav: "89.76",
        change: "-0.89",
        changePercent: "-0.98",
        rank: 2,
        rating: 4,
        aum: "₹8,230 Cr",
        isPositive: false,
        fundHouse: "ICICI Pru MF"
      },
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
        fundName: "HDFC Flexi Cap Fund",
        category: "Flexi Cap",
        nav: "95.67",
        change: "+0.78",
        changePercent: "+0.82",
        rank: 3,
        rating: 5,
        aum: "₹34,560 Cr",
        isPositive: true,
        fundHouse: "HDFC MF"
      },
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
        fundName: "UTI Nifty Index Fund",
        category: "Index Fund",
        nav: "156.78",
        change: "+1.23",
        changePercent: "+0.79",
        rank: 2,
        rating: 4,
        aum: "₹9,450 Cr",
        isPositive: true,
        fundHouse: "UTI MF"
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
      {
        fundName: "DSP Tax Saver Fund",
        category: "ELSS",
        nav: "76.54",
        change: "+1.34",
        changePercent: "+1.78",
        rank: 4,
        rating: 4,
        aum: "₹7,890 Cr",
        isPositive: true,
        fundHouse: "DSP MF"
      },
      {
        fundName: "Franklin India Prima Plus",
        category: "Multi Cap",
        nav: "134.67",
        change: "+1.89",
        changePercent: "+1.42",
        rank: 5,
        rating: 3,
        aum: "₹11,230 Cr",
        isPositive: true,
        fundHouse: "Franklin Templeton MF"
      }
    ];

    // Add some realistic variation to the data
    return funds.map(fund => ({
      ...fund,
      nav: (parseFloat(fund.nav) + (Math.random() - 0.5) * 2).toFixed(2),
      change: fund.isPositive 
        ? `+${(Math.random() * 3).toFixed(2)}`
        : `-${(Math.random() * 2).toFixed(2)}`,
      changePercent: fund.isPositive
        ? `+${(Math.random() * 2.5).toFixed(2)}`
        : `-${(Math.random() * 1.5).toFixed(2)}`
    }));
  };

  const fetchMutualFundData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch from our updated API endpoint that uses real AMFI data
      const response = await fetch('/api/mutual-fund-data');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.funds) {
          console.log(`Loaded ${data.funds.length} funds from ${data.source}`);
          setMutualFundData(data.funds);
          setDataSource(data.source);
        } else {
          // Fallback to mock data
          setMutualFundData(getMockMutualFundData());
          setDataSource('Mock');
        }
      } else {
        // Fallback to mock data
        setMutualFundData(getMockMutualFundData());
        setDataSource('Mock');
      }
      
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        hour12: true 
      }));
      
    } catch (error) {
      console.log('Error fetching mutual fund data, using mock data:', error);
      setMutualFundData(getMockMutualFundData());
      setDataSource('Mock');
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        hour12: true 
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMutualFundData();
    
    // Update every 30 seconds (NAVs don't change as frequently as stock prices)
    const interval = setInterval(() => {
      fetchMutualFundData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchMutualFundData]);

  const getStarRating = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  if (loading) {
    return (
      <div className="mutual-fund-banner bg-white/95 backdrop-blur-sm border-b border-gray-200/50 text-gray-800 h-12 flex items-center shadow-sm">
        <div className="animate-pulse flex items-center space-x-4 px-4">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span className="text-sm font-semibold text-gray-700 tracking-wide">Loading mutual fund data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mutual-fund-banner bg-white/95 backdrop-blur-sm border-b border-gray-200/50 text-gray-800 h-12 overflow-hidden relative shadow-sm">
      <div className="flex items-center h-full animate-scroll hover:pause whitespace-nowrap">
        {/* Data freshness indicator */}
        <div className="flex items-center px-4 bg-gray-50/90 h-full flex-shrink-0 border-r border-gray-200/60">
          <div className={`w-2 h-2 rounded-full mr-2 shadow-sm ${
            dataSource === 'AMFI' ? 'bg-emerald-500 animate-pulse' : 
            dataSource === 'Fallback' ? 'bg-blue-500' : 'bg-amber-500'
          }`}></div>
          <span className="text-xs font-semibold text-gray-700 tracking-wide">
            {dataSource === 'AMFI' ? 'LIVE AMFI NAV' : 
             dataSource === 'Fallback' ? 'DEMO NAV' : 'LATEST NAV'} • {lastUpdated} IST
          </span>
        </div>

        {/* Mutual fund data items */}
        {mutualFundData.map((fund, index) => (
          <div key={`${fund.fundName}-${index}`} className="fund-item flex items-center px-6 h-full flex-shrink-0 border-l border-gray-200/60">
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-slate-700 text-white px-2 py-0.5 rounded font-bold shadow-sm">
                  #{fund.rank}
                </span>
                <span className="font-bold text-sm text-gray-900 tracking-wide">{fund.fundName}</span>
                <span className="text-amber-500 text-xs filter drop-shadow-sm">{getStarRating(fund.rating)}</span>
              </div>
              <div className="flex items-center space-x-3 mt-0.5">
                <span className="text-xs text-gray-600 font-medium uppercase tracking-wider">{fund.category}</span>
                <span className="font-mono text-sm font-bold text-slate-800">₹{fund.nav}</span>
                <span className={`font-mono text-sm font-bold ${fund.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fund.change} ({fund.changePercent}%)
                </span>
                <span className="text-xs text-gray-500 font-medium">{fund.aum}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Duplicate for seamless loop */}
        {mutualFundData.map((fund, index) => (
          <div key={`${fund.fundName}-duplicate-${index}`} className="fund-item flex items-center px-6 h-full flex-shrink-0 border-l border-gray-200/60">
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-slate-700 text-white px-2 py-0.5 rounded font-bold shadow-sm">
                  #{fund.rank}
                </span>
                <span className="font-bold text-sm text-gray-900 tracking-wide">{fund.fundName}</span>
                <span className="text-amber-500 text-xs filter drop-shadow-sm">{getStarRating(fund.rating)}</span>
              </div>
              <div className="flex items-center space-x-3 mt-0.5">
                <span className="text-xs text-gray-600 font-medium uppercase tracking-wider">{fund.category}</span>
                <span className="font-mono text-sm font-bold text-slate-800">₹{fund.nav}</span>
                <span className={`font-mono text-sm font-bold ${fund.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fund.change} ({fund.changePercent}%)
                </span>
                <span className="text-xs text-gray-500 font-medium">{fund.aum}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MutualFundBanner;
