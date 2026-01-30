/**
 * Returns Calculation Functions
 * Calculate absolute returns, CAGR, volatility, and Sharpe ratio
 */

import pool from '@/lib/postgres-db';

interface NAVData {
  navDate: Date;
  navValue: number;
}

interface Returns {
  return1w?: number;
  return1m?: number;
  return3m?: number;
  return6m?: number;
  return1y?: number;
  return2y?: number;
  return3y?: number;
  return5y?: number;
  return7y?: number;
  return10y?: number;
  returnInception?: number;
  cagr1y?: number;
  cagr2y?: number;
  cagr3y?: number;
  cagr5y?: number;
  cagr7y?: number;
  cagr10y?: number;
  cagrInception?: number;
  volatility1y?: number;
  volatility3y?: number;
  volatility5y?: number;
  sharpe1y?: number;
  sharpe3y?: number;
  sharpe5y?: number;
}

// Calculate absolute return
export function calculateAbsoluteReturn(currentNAV: number, pastNAV: number): number | null {
  if (!pastNAV || pastNAV === 0) return null;
  return ((currentNAV - pastNAV) / pastNAV) * 100;
}

// Calculate CAGR (Compound Annual Growth Rate)
export function calculateCAGR(currentNAV: number, pastNAV: number, years: number): number | null {
  if (!pastNAV || pastNAV === 0 || years === 0) return null;
  return (Math.pow(currentNAV / pastNAV, 1 / years) - 1) * 100;
}

// Calculate volatility (standard deviation of returns)
export function calculateVolatility(returns: number[]): number | null {
  if (returns.length < 2) return null;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length;
  
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized
}

// Calculate Sharpe Ratio (assuming risk-free rate of 6%)
export function calculateSharpeRatio(avgReturn: number, volatility: number, riskFreeRate = 6): number | null {
  if (!volatility || volatility === 0) return null;
  return (avgReturn - riskFreeRate) / volatility;
}

// Get NAV for a specific date (or closest previous date)
export async function getNAVForDate(schemeCode: string, targetDate: Date): Promise<number | null> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT nav_value 
       FROM nav_history 
       WHERE scheme_code = $1 AND nav_date <= $2 
       ORDER BY nav_date DESC 
       LIMIT 1`,
      [schemeCode, targetDate]
    );
    
    return result.rows[0]?.nav_value || null;
  } finally {
    client.release();
  }
}

// Get daily returns for a period
export async function getDailyReturns(schemeCode: string, startDate: Date, endDate: Date): Promise<number[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT nav_date, nav_value 
       FROM nav_history 
       WHERE scheme_code = $1 
         AND nav_date BETWEEN $2 AND $3 
       ORDER BY nav_date ASC`,
      [schemeCode, startDate, endDate]
    );
    
    const navData: NAVData[] = result.rows;
    const returns: number[] = [];
    
    for (let i = 1; i < navData.length; i++) {
      const prevNAV = navData[i - 1].navValue;
      const currNAV = navData[i].navValue;
      const dailyReturn = ((currNAV - prevNAV) / prevNAV) * 100;
      returns.push(dailyReturn);
    }
    
    return returns;
  } finally {
    client.release();
  }
}

// Calculate all returns for a fund
export async function calculateAllReturns(schemeCode: string, asOfDate?: Date): Promise<Returns> {
  const currentDate = asOfDate || new Date();
  const client = await pool.connect();
  
  try {
    // Get current NAV
    const currentNAVResult = await client.query(
      `SELECT nav_value FROM nav_history 
       WHERE scheme_code = $1 AND nav_date <= $2 
       ORDER BY nav_date DESC LIMIT 1`,
      [schemeCode, currentDate]
    );
    
    const currentNAV = currentNAVResult.rows[0]?.nav_value;
    if (!currentNAV) return {};
    
    // Get inception date
    const inceptionResult = await client.query(
      `SELECT nav_date FROM nav_history 
       WHERE scheme_code = $1 
       ORDER BY nav_date ASC LIMIT 1`,
      [schemeCode]
    );
    
    const inceptionDate = inceptionResult.rows[0]?.nav_date;
    
    const returns: Returns = {};
    
    // Calculate returns for different periods
    const periods = [
      { key: '1w', days: 7, years: 7/365 },
      { key: '1m', days: 30, years: 30/365 },
      { key: '3m', days: 90, years: 90/365 },
      { key: '6m', days: 180, years: 180/365 },
      { key: '1y', days: 365, years: 1 },
      { key: '2y', days: 730, years: 2 },
      { key: '3y', days: 1095, years: 3 },
      { key: '5y', days: 1825, years: 5 },
      { key: '7y', days: 2555, years: 7 },
      { key: '10y', days: 3650, years: 10 }
    ];
    
    for (const period of periods) {
      const pastDate = new Date(currentDate);
      pastDate.setDate(pastDate.getDate() - period.days);
      
      const pastNAV = await getNAVForDate(schemeCode, pastDate);
      
      if (pastNAV) {
        const absReturn = calculateAbsoluteReturn(currentNAV, pastNAV);
        const cagr = calculateCAGR(currentNAV, pastNAV, period.years);
        
        returns[`return${period.key}` as keyof Returns] = absReturn ?? undefined;
        if (period.years >= 1) {
          returns[`cagr${period.key}` as keyof Returns] = cagr ?? undefined;
        }
      }
    }
    
    // Calculate inception returns
    if (inceptionDate) {
      const inceptionNAV = await getNAVForDate(schemeCode, inceptionDate);
      if (inceptionNAV) {
        const years = (currentDate.getTime() - inceptionDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        returns.returnInception = calculateAbsoluteReturn(currentNAV, inceptionNAV) ?? undefined;
        returns.cagrInception = calculateCAGR(currentNAV, inceptionNAV, years) ?? undefined;
      }
    }
    
    // Calculate volatility and Sharpe ratio
    const oneYearAgo = new Date(currentDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dailyReturns1y = await getDailyReturns(schemeCode, oneYearAgo, currentDate);
    
    if (dailyReturns1y.length > 0) {
      returns.volatility1y = calculateVolatility(dailyReturns1y) ?? undefined;
      const avgReturn1y = dailyReturns1y.reduce((sum, r) => sum + r, 0) / dailyReturns1y.length * 252;
      if (returns.volatility1y) {
        returns.sharpe1y = calculateSharpeRatio(avgReturn1y, returns.volatility1y) ?? undefined;
      }
    }
    
    // 3-year volatility
    const threeYearsAgo = new Date(currentDate);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const dailyReturns3y = await getDailyReturns(schemeCode, threeYearsAgo, currentDate);
    
    if (dailyReturns3y.length > 0) {
      returns.volatility3y = calculateVolatility(dailyReturns3y) ?? undefined;
      const avgReturn3y = dailyReturns3y.reduce((sum, r) => sum + r, 0) / dailyReturns3y.length * 252;
      if (returns.volatility3y) {
        returns.sharpe3y = calculateSharpeRatio(avgReturn3y, returns.volatility3y) ?? undefined;
      }
    }
    
    // 5-year volatility
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const dailyReturns5y = await getDailyReturns(schemeCode, fiveYearsAgo, currentDate);
    
    if (dailyReturns5y.length > 0) {
      returns.volatility5y = calculateVolatility(dailyReturns5y) ?? undefined;
      const avgReturn5y = dailyReturns5y.length > 0 ? dailyReturns5y.reduce((sum, r) => sum + r, 0) / dailyReturns5y.length * 252 : 0;
      if (returns.volatility5y) {
        returns.sharpe5y = calculateSharpeRatio(avgReturn5y, returns.volatility5y) ?? undefined;
      }
    }
    
    return returns;
    
  } finally {
    client.release();
  }
}

// Save calculated returns to database
export async function saveReturns(schemeCode: string, returns: Returns, calculatedDate: Date) {
  const client = await pool.connect();
  
  try {
    await client.query(
      `INSERT INTO fund_returns (
        scheme_code, calculated_date,
        return_1w, return_1m, return_3m, return_6m, return_1y,
        return_2y, return_3y, return_5y, return_7y, return_10y,
        return_since_inception,
        cagr_1y, cagr_2y, cagr_3y, cagr_5y, cagr_7y, cagr_10y,
        cagr_since_inception,
        volatility_1y, volatility_3y, volatility_5y,
        sharpe_1y, sharpe_3y, sharpe_5y
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
      )
      ON CONFLICT (scheme_code, calculated_date) 
      DO UPDATE SET
        return_1w = EXCLUDED.return_1w,
        return_1m = EXCLUDED.return_1m,
        return_3m = EXCLUDED.return_3m,
        return_6m = EXCLUDED.return_6m,
        return_1y = EXCLUDED.return_1y,
        return_2y = EXCLUDED.return_2y,
        return_3y = EXCLUDED.return_3y,
        return_5y = EXCLUDED.return_5y,
        return_7y = EXCLUDED.return_7y,
        return_10y = EXCLUDED.return_10y,
        return_since_inception = EXCLUDED.return_since_inception,
        cagr_1y = EXCLUDED.cagr_1y,
        cagr_2y = EXCLUDED.cagr_2y,
        cagr_3y = EXCLUDED.cagr_3y,
        cagr_5y = EXCLUDED.cagr_5y,
        cagr_7y = EXCLUDED.cagr_7y,
        cagr_10y = EXCLUDED.cagr_10y,
        cagr_since_inception = EXCLUDED.cagr_since_inception,
        volatility_1y = EXCLUDED.volatility_1y,
        volatility_3y = EXCLUDED.volatility_3y,
        volatility_5y = EXCLUDED.volatility_5y,
        sharpe_1y = EXCLUDED.sharpe_1y,
        sharpe_3y = EXCLUDED.sharpe_3y,
        sharpe_5y = EXCLUDED.sharpe_5y
      `,
      [
        schemeCode, calculatedDate,
        returns.return1w, returns.return1m, returns.return3m, returns.return6m, returns.return1y,
        returns.return2y, returns.return3y, returns.return5y, returns.return7y, returns.return10y,
        returns.returnInception,
        returns.cagr1y, returns.cagr2y, returns.cagr3y, returns.cagr5y, returns.cagr7y, returns.cagr10y,
        returns.cagrInception,
        returns.volatility1y, returns.volatility3y, returns.volatility5y,
        returns.sharpe1y, returns.sharpe3y, returns.sharpe5y
      ]
    );
  } finally {
    client.release();
  }
}

// Calculate returns for all funds
export async function calculateReturnsForAllFunds() {
  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT scheme_code FROM funds WHERE is_active = true');
    const funds = result.rows;
    
    console.log(`🚀 Calculating returns for ${funds.length} funds...`);
    
    let completed = 0;
    const currentDate = new Date();
    
    for (const fund of funds) {
      try {
        const returns = await calculateAllReturns(fund.scheme_code, currentDate);
        await saveReturns(fund.scheme_code, returns, currentDate);
        completed++;
        
        if (completed % 100 === 0) {
          console.log(`✅ Completed ${completed}/${funds.length} funds`);
        }
      } catch (error) {
        console.error(`❌ Error calculating returns for ${fund.scheme_code}:`, error);
      }
    }
    
    console.log(`🎉 Returns calculation complete! ${completed}/${funds.length} funds processed.`);
    
  } finally {
    client.release();
  }
}
