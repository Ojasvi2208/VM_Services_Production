/**
 * Cron Job API - Calculate All Fund Metrics
 * Triggered weekly on Sunday 5pm IST (11:30 UTC) via Railway Cron
 * 
 * Calculates:
 * - Returns: 1W, 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y (based on fund age)
 * - CAGR: 1Y, 2Y, 3Y, 5Y, 7Y, 10Y (based on fund age)
 * - Risk Metrics: Volatility, Max Drawdown, Sharpe Ratio, Sortino Ratio
 * - Rolling Returns: 1Y avg rolling return
 * 
 * Rate limited to 1 request per 1.5 seconds to avoid crashing MFApi
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || 'vmfs2024';

// Rate limit: 1.5 seconds between requests (very gentle on MFApi)
const RATE_LIMIT_MS = 1500;

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-');
  return new Date(`${year}-${month}-${day}`);
}

function convertDateToPostgres(dateStr: string): string {
  const [day, month, year] = dateStr.split('-');
  return `${year}-${month}-${day}`;
}

async function fetchNavData(schemeCode: string): Promise<any[] | null> {
  try {
    const response = await fetch(
      `https://api.mfapi.in/mf/${schemeCode}`,
      { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(30000)
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.data || null;
  } catch (error) {
    return null;
  }
}

function getNavAtDate(navData: any[], targetDate: Date): number | null {
  for (const nav of navData) {
    const navDate = parseDate(nav.date);
    if (navDate <= targetDate) {
      return parseFloat(nav.nav);
    }
  }
  return null;
}

function calculateReturn(currentNav: number, pastNav: number): number | null {
  if (!pastNav || pastNav === 0) return null;
  return Math.round(((currentNav - pastNav) / pastNav) * 100 * 100) / 100;
}

function calculateCAGR(currentNav: number, pastNav: number, years: number): number | null {
  if (!pastNav || pastNav === 0 || years === 0) return null;
  const cagr = (Math.pow(currentNav / pastNav, 1 / years) - 1) * 100;
  return Math.round(cagr * 100) / 100;
}

function calculateAllMetrics(navData: any[]): any {
  if (!navData || navData.length < 10) return null;

  const latestNav = parseFloat(navData[0].nav);
  const latestDate = navData[0].date;
  const inceptionDate = navData[navData.length - 1].date;
  const today = parseDate(latestDate);
  const inception = parseDate(inceptionDate);
  
  // Calculate fund age in years
  const fundAgeMs = today.getTime() - inception.getTime();
  const fundAgeYears = fundAgeMs / (365 * 24 * 60 * 60 * 1000);

  // Get NAV at various dates
  const nav1W = getNavAtDate(navData, new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
  const nav1M = getNavAtDate(navData, new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  const nav3M = getNavAtDate(navData, new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000));
  const nav6M = getNavAtDate(navData, new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000));
  const nav1Y = fundAgeYears >= 1 ? getNavAtDate(navData, new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)) : null;
  const nav2Y = fundAgeYears >= 2 ? getNavAtDate(navData, new Date(today.getTime() - 730 * 24 * 60 * 60 * 1000)) : null;
  const nav3Y = fundAgeYears >= 3 ? getNavAtDate(navData, new Date(today.getTime() - 1095 * 24 * 60 * 60 * 1000)) : null;
  const nav5Y = fundAgeYears >= 5 ? getNavAtDate(navData, new Date(today.getTime() - 1825 * 24 * 60 * 60 * 1000)) : null;
  const nav7Y = fundAgeYears >= 7 ? getNavAtDate(navData, new Date(today.getTime() - 2555 * 24 * 60 * 60 * 1000)) : null;
  const nav10Y = fundAgeYears >= 10 ? getNavAtDate(navData, new Date(today.getTime() - 3650 * 24 * 60 * 60 * 1000)) : null;

  // Calculate returns (only if fund is old enough)
  const returns = {
    return_1w: nav1W ? calculateReturn(latestNav, nav1W) : null,
    return_1m: nav1M ? calculateReturn(latestNav, nav1M) : null,
    return_3m: nav3M ? calculateReturn(latestNav, nav3M) : null,
    return_6m: nav6M ? calculateReturn(latestNav, nav6M) : null,
    return_1y: nav1Y ? calculateReturn(latestNav, nav1Y) : null,
    return_2y: nav2Y ? calculateReturn(latestNav, nav2Y) : null,
    return_3y: nav3Y ? calculateReturn(latestNav, nav3Y) : null,
    return_5y: nav5Y ? calculateReturn(latestNav, nav5Y) : null,
    return_7y: nav7Y ? calculateReturn(latestNav, nav7Y) : null,
    return_10y: nav10Y ? calculateReturn(latestNav, nav10Y) : null,
  };

  // Calculate CAGR (only if fund is old enough)
  const cagr = {
    cagr_1y: nav1Y ? calculateCAGR(latestNav, nav1Y, 1) : null,
    cagr_2y: nav2Y ? calculateCAGR(latestNav, nav2Y, 2) : null,
    cagr_3y: nav3Y ? calculateCAGR(latestNav, nav3Y, 3) : null,
    cagr_5y: nav5Y ? calculateCAGR(latestNav, nav5Y, 5) : null,
    cagr_7y: nav7Y ? calculateCAGR(latestNav, nav7Y, 7) : null,
    cagr_10y: nav10Y ? calculateCAGR(latestNav, nav10Y, 10) : null,
  };

  // Calculate risk metrics (need at least 1 year of data)
  let riskMetrics = {
    volatility_1y: null as number | null,
    max_drawdown: null as number | null,
    sharpe_ratio_1y: null as number | null,
    sortino_ratio_1y: null as number | null,
    rolling_return_1y_avg: null as number | null,
  };

  if (fundAgeYears >= 1 && nav1Y) {
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    const yearData = navData.filter(d => {
      const date = parseDate(d.date);
      return date >= oneYearAgo && date <= today;
    });

    if (yearData.length >= 50) {
      // Daily returns
      const dailyReturns: number[] = [];
      for (let i = 0; i < yearData.length - 1; i++) {
        const currentNav = parseFloat(yearData[i].nav);
        const prevNav = parseFloat(yearData[i + 1].nav);
        if (prevNav > 0) {
          dailyReturns.push((currentNav - prevNav) / prevNav * 100);
        }
      }

      if (dailyReturns.length >= 50) {
        // Volatility
        const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length;
        const dailyVolatility = Math.sqrt(variance);
        const annualizedVolatility = dailyVolatility * Math.sqrt(252);
        riskMetrics.volatility_1y = Math.round(annualizedVolatility * 100) / 100;

        // Max Drawdown
        let peak = parseFloat(yearData[yearData.length - 1].nav);
        let maxDrawdown = 0;
        for (let i = yearData.length - 2; i >= 0; i--) {
          const nav = parseFloat(yearData[i].nav);
          if (nav > peak) peak = nav;
          const drawdown = (peak - nav) / peak * 100;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
        riskMetrics.max_drawdown = Math.round(maxDrawdown * 100) / 100;

        // Sharpe Ratio (risk-free rate = 6% for India)
        const annualizedReturn = returns.return_1y || 0;
        const riskFreeRate = 6;
        if (annualizedVolatility > 0) {
          riskMetrics.sharpe_ratio_1y = Math.round((annualizedReturn - riskFreeRate) / annualizedVolatility * 100) / 100;
        }

        // Sortino Ratio
        const negativeReturns = dailyReturns.filter(r => r < 0);
        if (negativeReturns.length > 0) {
          const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
          const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
          if (downsideDeviation > 0) {
            riskMetrics.sortino_ratio_1y = Math.round((annualizedReturn - riskFreeRate) / downsideDeviation * 100) / 100;
          }
        }

        // Rolling 1Y return average (calculate 1Y return at multiple points)
        if (fundAgeYears >= 2) {
          const rollingReturns: number[] = [];
          for (let monthsBack = 0; monthsBack <= 12; monthsBack += 3) {
            const endDate = new Date(today.getTime() - monthsBack * 30 * 24 * 60 * 60 * 1000);
            const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
            const endNav = getNavAtDate(navData, endDate);
            const startNav = getNavAtDate(navData, startDate);
            if (endNav && startNav) {
              const ret = calculateReturn(endNav, startNav);
              if (ret !== null) rollingReturns.push(ret);
            }
          }
          if (rollingReturns.length > 0) {
            riskMetrics.rolling_return_1y_avg = Math.round(rollingReturns.reduce((a, b) => a + b, 0) / rollingReturns.length * 100) / 100;
          }
        }
      }
    }
  }

  return {
    latest_nav: latestNav,
    latest_nav_date: convertDateToPostgres(latestDate),
    inception_date: convertDateToPostgres(inceptionDate),
    fund_age_years: Math.round(fundAgeYears * 10) / 10,
    ...returns,
    ...cagr,
    ...riskMetrics
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.nextUrl.searchParams.get('secret');
  
  if (authHeader !== `Bearer ${CRON_SECRET}` && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSize = parseInt(request.nextUrl.searchParams.get('batch') || '100');
  
  console.log('🚀 Fund Metrics Cron Job Started:', new Date().toISOString());
  console.log(`📊 Batch size: ${batchSize}, Rate limit: ${RATE_LIMIT_MS}ms`);

  const client = await pool.connect();
  
  try {
    // Get funds that need metrics update (prioritize those without risk metrics)
    const fundsResult = await client.query(`
      SELECT f.scheme_code 
      FROM funds f
      LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
      WHERE fr.volatility_1y IS NULL OR fr.updated_at < NOW() - INTERVAL '7 days'
      ORDER BY 
        CASE WHEN fr.volatility_1y IS NULL THEN 0 ELSE 1 END,
        f.scheme_code
      LIMIT $1
    `, [batchSize]);
    
    const funds = fundsResult.rows;
    console.log(`📊 Processing ${funds.length} funds`);

    if (funds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'All funds are up to date',
        processed: 0 
      });
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < funds.length; i++) {
      const fund = funds[i];
      
      try {
        const navData = await fetchNavData(fund.scheme_code);
        
        if (!navData || navData.length < 10) {
          skipCount++;
          await sleep(500);
          continue;
        }

        const metrics = calculateAllMetrics(navData);

        if (metrics) {
          // Update funds table
          await client.query(`
            UPDATE funds SET
              latest_nav = $1,
              latest_nav_date = $2,
              inception_date = $3,
              updated_at = CURRENT_TIMESTAMP
            WHERE scheme_code = $4
          `, [metrics.latest_nav, metrics.latest_nav_date, metrics.inception_date, fund.scheme_code]);

          // Upsert fund_returns
          await client.query(`
            INSERT INTO fund_returns (
              scheme_code, 
              return_1w, return_1m, return_3m, return_6m, 
              return_1y, return_2y, return_3y, return_5y, return_10y,
              cagr_1y, cagr_2y, cagr_3y, cagr_5y, cagr_10y,
              volatility_1y, max_drawdown, sharpe_ratio_1y, sortino_ratio_1y, rolling_return_1y_avg,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP)
            ON CONFLICT (scheme_code) DO UPDATE SET
              return_1w = $2, return_1m = $3, return_3m = $4, return_6m = $5,
              return_1y = $6, return_2y = $7, return_3y = $8, return_5y = $9, return_10y = $10,
              cagr_1y = $11, cagr_2y = $12, cagr_3y = $13, cagr_5y = $14, cagr_10y = $15,
              volatility_1y = $16, max_drawdown = $17, sharpe_ratio_1y = $18, sortino_ratio_1y = $19, rolling_return_1y_avg = $20,
              updated_at = CURRENT_TIMESTAMP
          `, [
            fund.scheme_code,
            metrics.return_1w, metrics.return_1m, metrics.return_3m, metrics.return_6m,
            metrics.return_1y, metrics.return_2y, metrics.return_3y, metrics.return_5y, metrics.return_10y,
            metrics.cagr_1y, metrics.cagr_2y, metrics.cagr_3y, metrics.cagr_5y, metrics.cagr_10y,
            metrics.volatility_1y, metrics.max_drawdown, metrics.sharpe_ratio_1y, metrics.sortino_ratio_1y, metrics.rolling_return_1y_avg
          ]);

          successCount++;
        } else {
          skipCount++;
        }

        // Progress log every 25 funds
        if ((i + 1) % 25 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          console.log(`   ✅ ${i + 1}/${funds.length} | ${successCount} updated | ${elapsed}min`);
        }

        // Rate limiting - be gentle on MFApi
        await sleep(RATE_LIMIT_MS);

      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ ${fund.scheme_code}: ${error.message}`);
        await sleep(2000); // Extra delay on error
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n✅ Cron Complete: ${successCount} updated, ${skipCount} skipped, ${errorCount} errors in ${totalTime}min`);

    return NextResponse.json({
      success: true,
      message: 'Fund metrics calculation completed',
      processed: successCount,
      skipped: skipCount,
      errors: errorCount,
      duration_minutes: parseFloat(totalTime),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Cron Job Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  } finally {
    client.release();
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
