/**
 * Returns Calculator Service
 * Calculates returns for various time periods: 1W, 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, Since Inception
 */

import { getNavHistory, NAVRecord } from './amfi-nav-fetcher';

/**
 * Time period definitions
 */
export enum TimePeriod {
  ONE_WEEK = '1W',
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
  TWO_YEARS = '2Y',
  THREE_YEARS = '3Y',
  FIVE_YEARS = '5Y',
  SEVEN_YEARS = '7Y',
  TEN_YEARS = '10Y',
  SINCE_INCEPTION = 'SI',
}

/**
 * Returns data interface
 */
export interface ReturnsData {
  schemeCode: string;
  schemeName: string;
  currentNav: number;
  currentDate: string;
  returns: {
    [key in TimePeriod]?: {
      value: number; // Percentage return
      absoluteReturn: number; // Absolute return amount
      startNav: number;
      endNav: number;
      startDate: string;
      endDate: string;
      cagr?: number; // Compound Annual Growth Rate (for periods > 1 year)
      xirr?: number; // Extended Internal Rate of Return (for SIP)
    };
  };
  inceptionDate?: string;
  inceptionNav?: number;
}

/**
 * Get date N days ago
 */
function getDateNDaysAgo(days: number, fromDate?: Date): string {
  const date = fromDate ? new Date(fromDate) : new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Get date N months ago
 */
function getDateNMonthsAgo(months: number, fromDate?: Date): string {
  const date = fromDate ? new Date(fromDate) : new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

/**
 * Get date N years ago
 */
function getDateNYearsAgo(years: number, fromDate?: Date): string {
  const date = fromDate ? new Date(fromDate) : new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().split('T')[0];
}

/**
 * Calculate simple return percentage
 */
function calculateReturn(startNav: number, endNav: number): number {
  if (startNav === 0) return 0;
  return ((endNav - startNav) / startNav) * 100;
}

/**
 * Calculate absolute return
 */
function calculateAbsoluteReturn(startNav: number, endNav: number): number {
  return endNav - startNav;
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 */
function calculateCAGR(startNav: number, endNav: number, years: number): number {
  if (startNav === 0 || years === 0) return 0;
  return (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
}

/**
 * Calculate annualized return
 */
function calculateAnnualizedReturn(startNav: number, endNav: number, days: number): number {
  if (startNav === 0 || days === 0) return 0;
  const years = days / 365.25;
  return calculateCAGR(startNav, endNav, years);
}

/**
 * Find closest NAV record to a target date
 */
function findClosestNav(navRecords: NAVRecord[], targetDate: string): NAVRecord | null {
  if (navRecords.length === 0) return null;
  
  const targetTime = new Date(targetDate).getTime();
  
  // Find the closest date (prefer earlier date if exact match not found)
  let closest = navRecords[0];
  let minDiff = Math.abs(new Date(closest.date).getTime() - targetTime);
  
  for (const record of navRecords) {
    const diff = Math.abs(new Date(record.date).getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = record;
    }
  }
  
  // Only return if within 7 days of target
  if (minDiff <= 7 * 24 * 60 * 60 * 1000) {
    return closest;
  }
  
  return null;
}

/**
 * Calculate returns for a specific time period
 */
async function calculatePeriodReturn(
  schemeCode: string,
  currentNav: NAVRecord,
  targetDate: string,
  period: TimePeriod
): Promise<ReturnsData['returns'][TimePeriod] | null> {
  try {
    // Fetch NAV history for the period
    const navHistory = await getNavHistory(schemeCode, targetDate, currentNav.date);
    
    if (navHistory.length === 0) {
      return null;
    }
    
    // Find NAV closest to target date
    const startNavRecord = findClosestNav(navHistory, targetDate);
    
    if (!startNavRecord) {
      return null;
    }
    
    const startNav = startNavRecord.nav;
    const endNav = currentNav.nav;
    
    // Calculate returns
    const simpleReturn = calculateReturn(startNav, endNav);
    const absoluteReturn = calculateAbsoluteReturn(startNav, endNav);
    
    // Calculate days between dates
    const daysDiff = Math.floor(
      (new Date(currentNav.date).getTime() - new Date(startNavRecord.date).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    // Calculate CAGR for periods >= 1 year
    let cagr: number | undefined;
    if (daysDiff >= 365) {
      cagr = calculateAnnualizedReturn(startNav, endNav, daysDiff);
    }
    
    return {
      value: simpleReturn,
      absoluteReturn,
      startNav,
      endNav,
      startDate: startNavRecord.date,
      endDate: currentNav.date,
      cagr,
    };
  } catch (error) {
    console.error(`Error calculating ${period} return:`, error);
    return null;
  }
}

/**
 * Calculate returns for all time periods
 */
export async function calculateAllReturns(schemeCode: string): Promise<ReturnsData | null> {
  try {
    console.log(`Calculating returns for scheme: ${schemeCode}`);
    
    // Get latest NAV
    const navHistory = await getNavHistory(schemeCode);
    
    if (navHistory.length === 0) {
      console.log(`No NAV history found for scheme: ${schemeCode}`);
      return null;
    }
    
    const currentNav = navHistory[0]; // Latest NAV (sorted descending)
    const inceptionNav = navHistory[navHistory.length - 1]; // Oldest NAV
    
    const currentDate = new Date(currentNav.date);
    
    // Calculate target dates for each period
    const periods: { period: TimePeriod; targetDate: string }[] = [
      { period: TimePeriod.ONE_WEEK, targetDate: getDateNDaysAgo(7, currentDate) },
      { period: TimePeriod.ONE_MONTH, targetDate: getDateNMonthsAgo(1, currentDate) },
      { period: TimePeriod.THREE_MONTHS, targetDate: getDateNMonthsAgo(3, currentDate) },
      { period: TimePeriod.SIX_MONTHS, targetDate: getDateNMonthsAgo(6, currentDate) },
      { period: TimePeriod.ONE_YEAR, targetDate: getDateNYearsAgo(1, currentDate) },
      { period: TimePeriod.TWO_YEARS, targetDate: getDateNYearsAgo(2, currentDate) },
      { period: TimePeriod.THREE_YEARS, targetDate: getDateNYearsAgo(3, currentDate) },
      { period: TimePeriod.FIVE_YEARS, targetDate: getDateNYearsAgo(5, currentDate) },
      { period: TimePeriod.SEVEN_YEARS, targetDate: getDateNYearsAgo(7, currentDate) },
      { period: TimePeriod.TEN_YEARS, targetDate: getDateNYearsAgo(10, currentDate) },
    ];
    
    // Calculate returns for each period
    const returns: ReturnsData['returns'] = {};
    
    for (const { period, targetDate } of periods) {
      const periodReturn = await calculatePeriodReturn(
        schemeCode,
        currentNav,
        targetDate,
        period
      );
      
      if (periodReturn) {
        returns[period] = periodReturn;
      }
    }
    
    // Calculate since inception return
    if (inceptionNav && inceptionNav.date !== currentNav.date) {
      const daysSinceInception = Math.floor(
        (new Date(currentNav.date).getTime() - new Date(inceptionNav.date).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      
      returns[TimePeriod.SINCE_INCEPTION] = {
        value: calculateReturn(inceptionNav.nav, currentNav.nav),
        absoluteReturn: calculateAbsoluteReturn(inceptionNav.nav, currentNav.nav),
        startNav: inceptionNav.nav,
        endNav: currentNav.nav,
        startDate: inceptionNav.date,
        endDate: currentNav.date,
        cagr: calculateAnnualizedReturn(inceptionNav.nav, currentNav.nav, daysSinceInception),
      };
    }
    
    return {
      schemeCode,
      schemeName: currentNav.schemeName,
      currentNav: currentNav.nav,
      currentDate: currentNav.date,
      returns,
      inceptionDate: inceptionNav.date,
      inceptionNav: inceptionNav.nav,
    };
  } catch (error) {
    console.error('Error calculating returns:', error);
    return null;
  }
}

/**
 * Calculate returns for multiple schemes
 */
export async function calculateBulkReturns(schemeCodes: string[]): Promise<Map<string, ReturnsData>> {
  console.log(`Calculating returns for ${schemeCodes.length} schemes...`);
  
  const results = new Map<string, ReturnsData>();
  let processedCount = 0;
  
  for (const schemeCode of schemeCodes) {
    try {
      const returns = await calculateAllReturns(schemeCode);
      
      if (returns) {
        results.set(schemeCode, returns);
      }
      
      processedCount++;
      
      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount}/${schemeCodes.length} schemes...`);
      }
    } catch (error) {
      console.error(`Error calculating returns for ${schemeCode}:`, error);
    }
  }
  
  console.log(`✅ Calculated returns for ${results.size} schemes`);
  
  return results;
}

/**
 * Format return value for display
 */
export function formatReturn(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Get return color class based on value
 */
export function getReturnColorClass(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
}

/**
 * Calculate SIP returns (for future implementation)
 * This calculates XIRR for systematic investment plans
 */
export function calculateSIPReturns(
  monthlyInvestment: number,
  navRecords: NAVRecord[],
  startDate: string,
  endDate: string
): number {
  // TODO: Implement XIRR calculation for SIP
  // This requires calculating the internal rate of return for a series of cash flows
  // Formula: NPV = Σ(CFi / (1 + r)^ti) = 0
  // Where CFi is the cash flow at time ti, and r is the XIRR
  
  return 0;
}

/**
 * Calculate lumpsum returns
 */
export function calculateLumpsumReturns(
  investment: number,
  startNav: number,
  endNav: number
): {
  currentValue: number;
  absoluteReturn: number;
  percentageReturn: number;
} {
  const units = investment / startNav;
  const currentValue = units * endNav;
  const absoluteReturn = currentValue - investment;
  const percentageReturn = calculateReturn(investment, currentValue);
  
  return {
    currentValue,
    absoluteReturn,
    percentageReturn,
  };
}
