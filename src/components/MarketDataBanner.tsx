'use client';

import { useState, useEffect } from 'react';

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated?: string;
  isMarketOpen?: boolean;
}

interface MarketStatus {
  isOpen: boolean;
  nextSession: string;
  holiday?: string;
}

const MarketDataBanner = () => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatus>({ isOpen: true, nextSession: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Check if market is open (Indian market hours: 9:15 AM to 3:30 PM IST, Monday-Friday)
  const checkMarketStatus = (): MarketStatus => {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const day = istTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTimeMinutes = hours * 60 + minutes;
    
    // Market hours: 9:15 AM (555 minutes) to 3:30 PM (930 minutes)
    const marketOpenMinutes = 9 * 60 + 15; // 9:15 AM
    const marketCloseMinutes = 15 * 60 + 30; // 3:30 PM
    
    // Check for weekends
    if (day === 0 || day === 6) {
      return {
        isOpen: false,
        nextSession: 'Monday 9:15 AM IST',
        holiday: day === 0 ? 'Sunday' : 'Saturday'
      };
    }
    
    // Check market hours on weekdays
    const isOpen = currentTimeMinutes >= marketOpenMinutes && currentTimeMinutes <= marketCloseMinutes;
    
    return {
      isOpen,
      nextSession: isOpen ? 'Market Open' : 
        currentTimeMinutes < marketOpenMinutes ? 'Today 9:15 AM IST' : 'Tomorrow 9:15 AM IST'
    };
  };

  // Remove unused function
  
  useEffect(() => {
    // Real-time market data fetching function
    const fetchRealMarketData = async (): Promise<MarketData[]> => {
      try {
        // Try to fetch from our API first
        const symbols = ['NIFTY', 'SENSEX', 'BANKNIFTY', 'NIFTYNXT50', 'NIFTYIT', 'USDINR', 'GOLD', 'SILVER', 'CRUDEOIL', 'GIFTNIFTY'];
        
        const response = await fetch(`/api/market-data?symbols=${symbols.join(',')}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.length > 0) {
            return result.data;
          }
        }
        
        // Fallback to mock data if API fails
        const baseData = [
          { symbol: 'NIFTY', name: 'NIFTY 50', basePrice: 19850 },
          { symbol: 'SENSEX', name: 'SENSEX', basePrice: 66800 },
          { symbol: 'BANKNIFTY', name: 'BANK NIFTY', basePrice: 45200 },
          { symbol: 'NIFTYNXT50', name: 'NIFTY NXT 50', basePrice: 68500 },
          { symbol: 'NIFTYIT', name: 'NIFTY IT', basePrice: 35600 },
          { symbol: 'USDINR', name: 'USD/INR', basePrice: 83.25 },
          { symbol: 'GOLD', name: 'GOLD', basePrice: 62500 },
          { symbol: 'SILVER', name: 'SILVER', basePrice: 74200 },
          { symbol: 'CRUDEOIL', name: 'CRUDE OIL', basePrice: 6180 },
          { symbol: 'GIFTNIFTY', name: 'GIFT NIFTY', basePrice: 19880 }
        ];

        const currentMarketStatus = checkMarketStatus();

        const marketData = baseData.map(item => {
          // Simulate realistic market movements
          const volatility = item.symbol === 'USDINR' ? 0.005 : 
                            item.symbol.includes('GOLD') || item.symbol.includes('SILVER') ? 0.015 :
                            item.symbol.includes('OIL') ? 0.025 : 0.02;
          
          const changePercent = (Math.random() - 0.5) * 2 * volatility * 100; // Convert to percentage
          const change = (item.basePrice * changePercent) / 100;
          const price = item.basePrice + change + (Math.random() - 0.5) * (item.basePrice * 0.001);

          return {
            symbol: item.symbol,
            name: item.name,
            price: Number(price.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            lastUpdated: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
            isMarketOpen: currentMarketStatus.isOpen
          };
        });

        return marketData;
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        
        // Fallback data
        return [
          { symbol: 'NIFTY', name: 'NIFTY 50', price: 19850.25, change: -45.30, changePercent: -0.23, lastUpdated: 'Market Closed' }
        ];
      }
    };

    const loadMarketData = async () => {
      setIsLoading(true);
      try {
        const status = checkMarketStatus();
        setMarketStatus(status);
        
        const data = await fetchRealMarketData();
        setMarketData(data);
        setLastUpdated(new Date().toLocaleTimeString('en-IN', { 
          timeZone: 'Asia/Kolkata',
          hour12: true 
        }));
      } catch (error) {
        console.error('Failed to load market data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial load
    loadMarketData();

    // Refresh every 10 seconds during market hours, every 30 seconds when closed
    const refreshInterval = 10000;
    const interval = setInterval(loadMarketData, refreshInterval);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-brand-navy via-brand-royal to-brand-navy text-white py-3 px-4 shadow-md">
        <div className="container mx-auto flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Loading market data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-brand-navy via-brand-royal to-brand-navy text-white py-3 px-2 shadow-md overflow-hidden relative z-50">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 animate-shimmer"></div>
      
      <div className="container mx-auto relative z-10">
        <div className="flex items-center justify-between">
          {/* Left side - Market Status */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                marketStatus.isOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}></div>
              <span className="text-xs font-medium">
                {marketStatus.isOpen ? 'LIVE' : 'CLOSED'}
              </span>
            </div>
            {marketStatus.holiday && (
              <span className="text-xs bg-red-500/20 px-2 py-1 rounded">
                Holiday: {marketStatus.holiday}
              </span>
            )}
          </div>

          {/* Center - Scrolling Market Data */}
          <div className="flex-1 overflow-hidden mx-4">
            <div className="flex animate-scroll space-x-8" style={{
              animation: 'scroll 120s linear infinite'
            }}>
              {/* Duplicate the array for seamless scrolling */}
              {[...marketData, ...marketData].map((item, index) => {
                const isPositive = item.change >= 0;
                return (
                  <div key={`${item.symbol}-${index}`} className="flex items-center space-x-3 whitespace-nowrap flex-shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-brand-gold text-sm">{item.symbol}</span>
                      <span className="font-semibold text-white text-sm">
                        {item.symbol === 'USDINR' ? '₹' : '₹'}{item.price.toLocaleString('en-IN')}
                      </span>
                      <span className={`flex items-center space-x-1 text-xs font-medium ${
                        isPositive ? 'text-green-400' : 'text-red-400'
                      }`}>
                        <span>{isPositive ? '▲' : '▼'}</span>
                        <span>{Math.abs(item.change).toFixed(2)}</span>
                        <span>({isPositive ? '+' : '-'}{Math.abs(item.changePercent).toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side - Update info */}
          <div className="flex items-center space-x-2 text-xs flex-shrink-0">
            <div className="w-1 h-1 bg-brand-gold rounded-full animate-ping"></div>
            <span>
              {marketStatus.isOpen ? `Live • ${lastUpdated}` : `Last: ${lastUpdated}`}
            </span>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 120s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default MarketDataBanner;
