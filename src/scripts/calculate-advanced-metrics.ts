import { Pool } from 'pg';

const RAILWAY_DB_URL = 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Risk-free rate (India 10-year G-Sec yield, approximate)
const RISK_FREE_RATE = 7.0; // 7% annual

interface NAVData {
  nav_date: Date;
  nav_value: number;
}

interface BenchmarkData {
  date: Date;
  value: number;
}

/**
 * Calculate returns from NAV data
 */
function calculateReturns(navData: NAVData[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < navData.length; i++) {
    const currentNav = navData[i].nav_value;
    const previousNav = navData[i - 1].nav_value;
    const dailyReturn = ((currentNav - previousNav) / previousNav) * 100;
    returns.push(dailyReturn);
  }
  return returns;
}

/**
 * Calculate standard deviation (volatility)
 */
function calculateStandardDeviation(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / returns.length;
  
  // Annualize: multiply by sqrt(252) for daily returns
  return Math.sqrt(variance) * Math.sqrt(252);
}

/**
 * Calculate downside deviation (for Sortino ratio)
 */
function calculateDownsideDeviation(returns: number[], targetReturn: number = 0): number {
  const downsideReturns = returns.filter(r => r < targetReturn);
  if (downsideReturns.length === 0) return 0;
  
  const squaredDiffs = downsideReturns.map(r => Math.pow(r - targetReturn, 2));
  const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / returns.length;
  
  // Annualize
  return Math.sqrt(variance) * Math.sqrt(252);
}

/**
 * Calculate Beta (systematic risk)
 * Beta = Covariance(Fund, Benchmark) / Variance(Benchmark)
 */
function calculateBeta(fundReturns: number[], benchmarkReturns: number[]): number {
  if (fundReturns.length !== benchmarkReturns.length || fundReturns.length === 0) return 0;
  
  const fundMean = fundReturns.reduce((sum, r) => sum + r, 0) / fundReturns.length;
  const benchmarkMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
  
  let covariance = 0;
  let benchmarkVariance = 0;
  
  for (let i = 0; i < fundReturns.length; i++) {
    covariance += (fundReturns[i] - fundMean) * (benchmarkReturns[i] - benchmarkMean);
    benchmarkVariance += Math.pow(benchmarkReturns[i] - benchmarkMean, 2);
  }
  
  covariance /= fundReturns.length;
  benchmarkVariance /= benchmarkReturns.length;
  
  return benchmarkVariance === 0 ? 0 : covariance / benchmarkVariance;
}

/**
 * Calculate Alpha (excess return over benchmark)
 * Alpha = Fund Return - (Risk-free Rate + Beta * (Benchmark Return - Risk-free Rate))
 */
function calculateAlpha(
  fundReturn: number,
  benchmarkReturn: number,
  beta: number,
  riskFreeRate: number = RISK_FREE_RATE
): number {
  return fundReturn - (riskFreeRate + beta * (benchmarkReturn - riskFreeRate));
}

/**
 * Calculate Sharpe Ratio
 * Sharpe = (Fund Return - Risk-free Rate) / Standard Deviation
 */
function calculateSharpeRatio(
  fundReturn: number,
  standardDeviation: number,
  riskFreeRate: number = RISK_FREE_RATE
): number {
  return standardDeviation === 0 ? 0 : (fundReturn - riskFreeRate) / standardDeviation;
}

/**
 * Calculate Sortino Ratio
 * Sortino = (Fund Return - Risk-free Rate) / Downside Deviation
 */
function calculateSortinoRatio(
  fundReturn: number,
  downsideDeviation: number,
  riskFreeRate: number = RISK_FREE_RATE
): number {
  return downsideDeviation === 0 ? 0 : (fundReturn - riskFreeRate) / downsideDeviation;
}

/**
 * Calculate Treynor Ratio
 * Treynor = (Fund Return - Risk-free Rate) / Beta
 */
function calculateTreynorRatio(
  fundReturn: number,
  beta: number,
  riskFreeRate: number = RISK_FREE_RATE
): number {
  return beta === 0 ? 0 : (fundReturn - riskFreeRate) / beta;
}

/**
 * Calculate correlation coefficient
 */
function calculateCorrelation(fundReturns: number[], benchmarkReturns: number[]): number {
  if (fundReturns.length !== benchmarkReturns.length || fundReturns.length === 0) return 0;
  
  const fundMean = fundReturns.reduce((sum, r) => sum + r, 0) / fundReturns.length;
  const benchmarkMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
  
  let numerator = 0;
  let fundSumSq = 0;
  let benchmarkSumSq = 0;
  
  for (let i = 0; i < fundReturns.length; i++) {
    const fundDiff = fundReturns[i] - fundMean;
    const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
    numerator += fundDiff * benchmarkDiff;
    fundSumSq += fundDiff * fundDiff;
    benchmarkSumSq += benchmarkDiff * benchmarkDiff;
  }
  
  const denominator = Math.sqrt(fundSumSq * benchmarkSumSq);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate R-squared
 */
function calculateRSquared(correlation: number): number {
  return Math.pow(correlation, 2);
}

/**
 * Calculate Tracking Error
 * Tracking Error = Standard Deviation of (Fund Returns - Benchmark Returns)
 */
function calculateTrackingError(fundReturns: number[], benchmarkReturns: number[]): number {
  if (fundReturns.length !== benchmarkReturns.length || fundReturns.length === 0) return 0;
  
  const differences = fundReturns.map((fr, i) => fr - benchmarkReturns[i]);
  return calculateStandardDeviation(differences);
}

/**
 * Calculate Information Ratio
 * Information Ratio = (Fund Return - Benchmark Return) / Tracking Error
 */
function calculateInformationRatio(
  fundReturn: number,
  benchmarkReturn: number,
  trackingError: number
): number {
  return trackingError === 0 ? 0 : (fundReturn - benchmarkReturn) / trackingError;
}

/**
 * Calculate Maximum Drawdown
 */
function calculateMaxDrawdown(navData: NAVData[]): number {
  if (navData.length === 0) return 0;
  
  let maxDrawdown = 0;
  let peak = navData[0].nav_value;
  
  for (const data of navData) {
    if (data.nav_value > peak) {
      peak = data.nav_value;
    }
    const drawdown = ((peak - data.nav_value) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

/**
 * Calculate annualized return
 */
function calculateAnnualizedReturn(navData: NAVData[]): number {
  if (navData.length < 2) return 0;
  
  const startNav = navData[navData.length - 1].nav_value;
  const endNav = navData[0].nav_value;
  const startDate = new Date(navData[navData.length - 1].nav_date);
  const endDate = new Date(navData[0].nav_date);
  
  const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  
  if (years === 0) return 0;
  
  return (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
}

/**
 * Get NAV data for a specific period
 */
async function getNAVDataForPeriod(schemeCode: string, years: number): Promise<NAVData[]> {
  const result = await pool.query(
    `SELECT nav_date, nav_value 
     FROM nav_history 
     WHERE scheme_code = $1 
       AND nav_date >= CURRENT_DATE - INTERVAL '${years} years'
     ORDER BY nav_date DESC`,
    [schemeCode]
  );
  
  return result.rows;
}

/**
 * Get benchmark data for a specific period
 */
async function getBenchmarkDataForPeriod(years: number): Promise<BenchmarkData[]> {
  const result = await pool.query(
    `SELECT date, value 
     FROM benchmark_data 
     WHERE benchmark_name = 'NIFTY50'
       AND date >= CURRENT_DATE - INTERVAL '${years} years'
     ORDER BY date DESC`
  );
  
  return result.rows;
}

/**
 * Calculate all metrics for a fund
 */
async function calculateMetricsForFund(schemeCode: string): Promise<any> {
  const metrics: any = { scheme_code: schemeCode };
  
  for (const period of [1, 3, 5]) {
    try {
      const navData = await getNAVDataForPeriod(schemeCode, period);
      const benchmarkData = await getBenchmarkDataForPeriod(period);
      
      if (navData.length < 30) continue; // Need at least 30 data points
      
      // Convert benchmark data to NAV format for calculations
      const benchmarkAsNav: NAVData[] = benchmarkData.map(b => ({
        nav_date: b.date,
        nav_value: b.value
      }));
      
      const fundReturns = calculateReturns(navData);
      const benchmarkReturns = calculateReturns(benchmarkAsNav);
      
      // Align returns (same dates)
      const alignedReturns = alignReturnsByDate(navData, navData, fundReturns, benchmarkReturns);
      
      const annualizedReturn = calculateAnnualizedReturn(navData);
      const benchmarkAnnualizedReturn = calculateAnnualizedReturn(benchmarkAsNav);
      const standardDeviation = calculateStandardDeviation(alignedReturns.fund);
      const downsideDeviation = calculateDownsideDeviation(alignedReturns.fund);
      const beta = calculateBeta(alignedReturns.fund, alignedReturns.benchmark);
      const alpha = calculateAlpha(annualizedReturn, benchmarkAnnualizedReturn, beta);
      const sharpe = calculateSharpeRatio(annualizedReturn, standardDeviation);
      const sortino = calculateSortinoRatio(annualizedReturn, downsideDeviation);
      const treynor = calculateTreynorRatio(annualizedReturn, beta);
      const correlation = calculateCorrelation(alignedReturns.fund, alignedReturns.benchmark);
      const rSquared = calculateRSquared(correlation);
      const trackingError = calculateTrackingError(alignedReturns.fund, alignedReturns.benchmark);
      const informationRatio = calculateInformationRatio(annualizedReturn, benchmarkAnnualizedReturn, trackingError);
      const maxDrawdown = calculateMaxDrawdown(navData);
      
      const suffix = `_${period}y`;
      metrics[`standard_deviation${suffix}`] = standardDeviation;
      metrics[`beta${suffix}`] = beta;
      metrics[`alpha${suffix}`] = alpha;
      metrics[`sharpe_ratio${suffix}`] = sharpe;
      metrics[`sortino_ratio${suffix}`] = sortino;
      metrics[`treynor_ratio${suffix}`] = treynor;
      metrics[`downside_deviation${suffix}`] = downsideDeviation;
      metrics[`max_drawdown${suffix}`] = maxDrawdown;
      metrics[`correlation${suffix}`] = correlation;
      metrics[`r_squared${suffix}`] = rSquared;
      metrics[`information_ratio${suffix}`] = informationRatio;
      metrics[`tracking_error${suffix}`] = trackingError;
      
    } catch (error) {
      console.error(`Error calculating ${period}y metrics for ${schemeCode}:`, error);
    }
  }
  
  return metrics;
}

/**
 * Align returns by matching dates
 */
function alignReturnsByDate(
  fundNav: NAVData[],
  benchmarkNav: NAVData[],
  fundReturns: number[],
  benchmarkReturns: number[]
): { fund: number[], benchmark: number[] } {
  // For simplicity, take minimum length
  const minLength = Math.min(fundReturns.length, benchmarkReturns.length);
  return {
    fund: fundReturns.slice(0, minLength),
    benchmark: benchmarkReturns.slice(0, minLength)
  };
}

/**
 * Save metrics to database
 */
async function saveMetrics(metrics: any): Promise<void> {
  const columns = Object.keys(metrics).filter(k => k !== 'scheme_code');
  const values = columns.map(c => metrics[c]);
  
  const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');
  const updates = columns.map((c, i) => `${c} = $${i + 2}`).join(', ');
  
  await pool.query(
    `INSERT INTO fund_advanced_metrics (scheme_code, ${columns.join(', ')})
     VALUES ($1, ${placeholders})
     ON CONFLICT (scheme_code) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP`,
    [metrics.scheme_code, ...values]
  );
}

/**
 * Main execution
 */
async function calculateAllAdvancedMetrics() {
  console.log('🚀 Calculating advanced metrics for all funds...\n');
  
  try {
    // Get all funds with sufficient NAV data
    const fundsResult = await pool.query(
      `SELECT DISTINCT f.scheme_code, f.scheme_name
       FROM funds f
       INNER JOIN nav_history nh ON f.scheme_code = nh.scheme_code
       GROUP BY f.scheme_code, f.scheme_name
       HAVING COUNT(nh.nav_date) >= 30
       ORDER BY f.scheme_code`
    );
    
    console.log(`📊 Found ${fundsResult.rows.length} funds with sufficient data\n`);
    
    let processed = 0;
    let successful = 0;
    
    for (const fund of fundsResult.rows) {
      try {
        const metrics = await calculateMetricsForFund(fund.scheme_code);
        
        if (Object.keys(metrics).length > 1) {
          await saveMetrics(metrics);
          successful++;
        }
        
        processed++;
        
        if (processed % 100 === 0) {
          console.log(`   ✅ Processed ${processed}/${fundsResult.rows.length} funds (${successful} successful)`);
        }
        
      } catch (error: any) {
        console.error(`   ❌ Error processing ${fund.scheme_code}:`, error.message);
      }
    }
    
    console.log(`\n✨ Advanced metrics calculation complete!`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Successful: ${successful}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

calculateAllAdvancedMetrics().catch(console.error);
