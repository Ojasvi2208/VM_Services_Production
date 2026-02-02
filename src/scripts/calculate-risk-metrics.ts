import { Pool } from 'pg';
import axios from 'axios';

const RAILWAY_DB_URL = 'postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-');
  return new Date(`${year}-${month}-${day}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchNavData(schemeCode: string): Promise<any[] | null> {
  try {
    const response = await axios.get(
      `https://api.mfapi.in/mf/${schemeCode}`,
      { 
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }
    );
    return response.data?.data || null;
  } catch (error) {
    return null;
  }
}

function calculateRiskMetrics(navData: any[]): {
  volatility1y: number | null;
  maxDrawdown: number | null;
  sharpeRatio1y: number | null;
  sortinoRatio1y: number | null;
} {
  // Get last 365 days of data
  const today = parseDate(navData[0].date);
  const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  const yearData = navData.filter(d => {
    const date = parseDate(d.date);
    return date >= oneYearAgo && date <= today;
  });

  if (yearData.length < 50) {
    return { volatility1y: null, maxDrawdown: null, sharpeRatio1y: null, sortinoRatio1y: null };
  }

  // Calculate daily returns
  const dailyReturns: number[] = [];
  for (let i = 0; i < yearData.length - 1; i++) {
    const currentNav = parseFloat(yearData[i].nav);
    const prevNav = parseFloat(yearData[i + 1].nav);
    if (prevNav > 0) {
      dailyReturns.push((currentNav - prevNav) / prevNav * 100);
    }
  }

  if (dailyReturns.length < 50) {
    return { volatility1y: null, maxDrawdown: null, sharpeRatio1y: null, sortinoRatio1y: null };
  }

  // Mean daily return
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  
  // Standard deviation (volatility)
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length;
  const dailyVolatility = Math.sqrt(variance);
  const annualizedVolatility = dailyVolatility * Math.sqrt(252); // 252 trading days

  // Max Drawdown
  let peak = parseFloat(yearData[yearData.length - 1].nav);
  let maxDrawdown = 0;
  for (let i = yearData.length - 2; i >= 0; i--) {
    const nav = parseFloat(yearData[i].nav);
    if (nav > peak) {
      peak = nav;
    }
    const drawdown = (peak - nav) / peak * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Annualized return
  const startNav = parseFloat(yearData[yearData.length - 1].nav);
  const endNav = parseFloat(yearData[0].nav);
  const annualizedReturn = ((endNav - startNav) / startNav) * 100;

  // Risk-free rate (assume 6% for India)
  const riskFreeRate = 6;

  // Sharpe Ratio = (Return - Risk Free Rate) / Volatility
  const sharpeRatio = annualizedVolatility > 0 
    ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
    : null;

  // Sortino Ratio - uses downside deviation
  const negativeReturns = dailyReturns.filter(r => r < 0);
  const downsideVariance = negativeReturns.length > 0
    ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    : 0;
  const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
  const sortinoRatio = downsideDeviation > 0 
    ? (annualizedReturn - riskFreeRate) / downsideDeviation 
    : null;

  return {
    volatility1y: Math.round(annualizedVolatility * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio1y: sharpeRatio ? Math.round(sharpeRatio * 100) / 100 : null,
    sortinoRatio1y: sortinoRatio ? Math.round(sortinoRatio * 100) / 100 : null
  };
}

async function processRiskMetrics() {
  console.log('🚀 Risk Metrics Calculator\n');
  console.log('Calculating Volatility, Max Drawdown, Sharpe & Sortino Ratios\n');

  try {
    // Get funds that have returns but no risk metrics
    const fundsResult = await pool.query(`
      SELECT fr.scheme_code, f.scheme_name 
      FROM fund_returns fr
      JOIN funds f ON f.scheme_code = fr.scheme_code
      WHERE fr.return_1y IS NOT NULL 
        AND fr.volatility_1y IS NULL
      ORDER BY fr.scheme_code
      LIMIT 500
    `);
    
    const funds = fundsResult.rows;
    console.log(`📊 Found ${funds.length} funds to process\n`);

    if (funds.length === 0) {
      console.log('✅ All funds already have risk metrics!');
      await pool.end();
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < funds.length; i++) {
      const fund = funds[i];
      
      try {
        process.stdout.write(`\r   Processing ${i + 1}/${funds.length}: ${fund.scheme_code}...`);
        
        const navData = await fetchNavData(fund.scheme_code);
        
        if (!navData || navData.length < 50) {
          skipCount++;
          await sleep(500);
          continue;
        }

        const metrics = calculateRiskMetrics(navData);

        if (metrics.volatility1y !== null) {
          await pool.query(`
            UPDATE fund_returns SET
              volatility_1y = $1,
              max_drawdown = $2,
              sharpe_ratio_1y = $3,
              sortino_ratio_1y = $4,
              updated_at = CURRENT_TIMESTAMP
            WHERE scheme_code = $5
          `, [
            metrics.volatility1y,
            metrics.maxDrawdown,
            metrics.sharpeRatio1y,
            metrics.sortinoRatio1y,
            fund.scheme_code
          ]);
          successCount++;
        } else {
          skipCount++;
        }

        // Progress update every 50 funds
        if ((i + 1) % 50 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          console.log(`\n   ✅ ${successCount} updated | ${skipCount} skipped | ${elapsed}min elapsed`);
        }

        await sleep(800); // Rate limiting

      } catch (error: any) {
        errorCount++;
        if (errorCount % 10 === 0) {
          console.log(`\n   ⚠️  ${errorCount} errors, pausing...`);
          await sleep(5000);
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n\n' + '='.repeat(50));
    console.log('✨ RISK METRICS CALCULATION COMPLETE\n');
    console.log(`   ⏱️  Total time: ${totalTime} minutes`);
    console.log(`   ✅ Successfully updated: ${successCount} funds`);
    console.log(`   ⏭️  Skipped: ${skipCount} funds`);
    console.log(`   ❌ Errors: ${errorCount} funds`);
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
  } finally {
    await pool.end();
  }
}

processRiskMetrics().catch(console.error);
