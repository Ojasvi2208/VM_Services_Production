import { Pool } from 'pg';
import axios from 'axios';

const RAILWAY_DB_URL = process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway';

// Configuration for optimal performance without crashing MFApi
const CONFIG = {
  CONCURRENCY: 3,           // 3 concurrent requests (safe for MFApi)
  DELAY_BETWEEN_BATCHES: 1000, // 1 second between batches
  REQUEST_TIMEOUT: 20000,   // 20 second timeout per request
  MAX_RETRIES: 5,           // 5 retry attempts
  RETRY_BASE_DELAY: 2000,   // 2 second base delay for retries
  BATCH_SIZE: 100,          // Log progress every 100 funds
  ERROR_PAUSE_THRESHOLD: 10, // Pause after 10 consecutive errors
  ERROR_PAUSE_DURATION: 30000, // 30 second pause on too many errors
};

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-');
  return new Date(`${year}-${month}-${day}`);
}

function convertDateToPostgres(dateStr: string): string {
  const [day, month, year] = dateStr.split('-');
  return `${year}-${month}-${day}`;
}

function calculateReturn(currentNav: number, pastNav: number | null): number | null {
  if (!pastNav || pastNav === 0) return null;
  return ((currentNav - pastNav) / pastNav) * 100;
}

function calculateCAGR(currentNav: number, pastNav: number | null, years: number): number | null {
  if (!pastNav || pastNav === 0 || years === 0) return null;
  return (Math.pow(currentNav / pastNav, 1 / years) - 1) * 100;
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

function calculateVolatility(navData: any[], days: number): number | null {
  if (navData.length < days) return null;
  const returns: number[] = [];
  for (let i = 0; i < Math.min(days, navData.length - 1); i++) {
    const currentNav = parseFloat(navData[i].nav);
    const prevNav = parseFloat(navData[i + 1].nav);
    if (prevNav > 0) {
      returns.push((currentNav - prevNav) / prevNav);
    }
  }
  if (returns.length < 10) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility
}

function calculateMaxDrawdown(navData: any[], days: number): number | null {
  if (navData.length < days) return null;
  let maxNav = 0;
  let maxDrawdown = 0;
  for (let i = Math.min(days, navData.length - 1); i >= 0; i--) {
    const nav = parseFloat(navData[i].nav);
    if (nav > maxNav) maxNav = nav;
    const drawdown = (maxNav - nav) / maxNav * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(schemeCode: string): Promise<any> {
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(
        `https://api.mfapi.in/mf/${schemeCode}`,
        { 
          timeout: CONFIG.REQUEST_TIMEOUT,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Connection': 'keep-alive'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      // 404 means fund doesn't exist - don't retry
      if (error.response?.status === 404) return null;
      
      // 429 Too Many Requests - wait longer
      if (error.response?.status === 429) {
        console.log(`   ⚠️ Rate limited on ${schemeCode}, waiting 10s...`);
        await sleep(10000);
        continue;
      }
      
      // 500/502/503 Server errors - retry with backoff
      if (error.response?.status >= 500) {
        const delay = CONFIG.RETRY_BASE_DELAY * attempt;
        if (attempt < CONFIG.MAX_RETRIES) {
          console.log(`   ⚠️ Server error ${error.response?.status} on ${schemeCode}, retry ${attempt}/${CONFIG.MAX_RETRIES} in ${delay/1000}s`);
          await sleep(delay);
          continue;
        }
      }
      
      // Network errors - retry with backoff
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        const delay = CONFIG.RETRY_BASE_DELAY * attempt;
        if (attempt < CONFIG.MAX_RETRIES) {
          console.log(`   ⚠️ Network error on ${schemeCode}, retry ${attempt}/${CONFIG.MAX_RETRIES} in ${delay/1000}s`);
          await sleep(delay);
          continue;
        }
      }
      
      // Last attempt failed
      if (attempt === CONFIG.MAX_RETRIES) {
        return null;
      }
      
      await sleep(CONFIG.RETRY_BASE_DELAY * attempt);
    }
  }
  return null;
}

async function updateFundMetrics(schemeCode: string) {
  const data = await fetchWithRetry(schemeCode);
  if (!data?.data || data.data.length === 0) return false;

  const navData = data.data;
  const latestNav = parseFloat(navData[0].nav);
  const latestDate = navData[0].date;
  const inceptionDate = navData[navData.length - 1].date;
  const today = parseDate(latestDate);

  // Get NAV at different time periods
  const nav1W = getNavAtDate(navData, new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
  const nav1M = getNavAtDate(navData, new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  const nav3M = getNavAtDate(navData, new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000));
  const nav6M = getNavAtDate(navData, new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000));
  const nav1Y = getNavAtDate(navData, new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000));
  const nav2Y = getNavAtDate(navData, new Date(today.getTime() - 730 * 24 * 60 * 60 * 1000));
  const nav3Y = getNavAtDate(navData, new Date(today.getTime() - 1095 * 24 * 60 * 60 * 1000));
  const nav5Y = getNavAtDate(navData, new Date(today.getTime() - 1825 * 24 * 60 * 60 * 1000));
  const nav10Y = getNavAtDate(navData, new Date(today.getTime() - 3650 * 24 * 60 * 60 * 1000));

  // Calculate ALL returns
  const return1W = calculateReturn(latestNav, nav1W);
  const return1M = calculateReturn(latestNav, nav1M);
  const return3M = calculateReturn(latestNav, nav3M);
  const return6M = calculateReturn(latestNav, nav6M);
  const return1Y = calculateReturn(latestNav, nav1Y);
  const return2Y = calculateReturn(latestNav, nav2Y);
  const return3Y = calculateReturn(latestNav, nav3Y);
  const return5Y = calculateReturn(latestNav, nav5Y);
  const return10Y = calculateReturn(latestNav, nav10Y);

  // Calculate ALL CAGR
  const cagr1Y = calculateCAGR(latestNav, nav1Y, 1);
  const cagr2Y = calculateCAGR(latestNav, nav2Y, 2);
  const cagr3Y = calculateCAGR(latestNav, nav3Y, 3);
  const cagr5Y = calculateCAGR(latestNav, nav5Y, 5);
  const cagr10Y = calculateCAGR(latestNav, nav10Y, 10);

  // Calculate risk metrics
  const volatility1Y = calculateVolatility(navData, 252);
  const maxDrawdown = calculateMaxDrawdown(navData, 252);

  // Update funds table
  await pool.query(`
    UPDATE funds SET
      latest_nav = $1,
      latest_nav_date = $2,
      inception_date = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE scheme_code = $4
  `, [latestNav, convertDateToPostgres(latestDate), convertDateToPostgres(inceptionDate), schemeCode]);

  // Update fund_returns table with ALL metrics
  await pool.query(`
    UPDATE fund_returns SET
      return_1w = $1, return_1m = $2, return_3m = $3, return_6m = $4,
      return_1y = $5, return_2y = $6, return_3y = $7, return_5y = $8, return_10y = $9,
      cagr_1y = $10, cagr_2y = $11, cagr_3y = $12, cagr_5y = $13, cagr_10y = $14,
      volatility_1y = $15, max_drawdown = $16,
      updated_at = CURRENT_TIMESTAMP
    WHERE scheme_code = $17
  `, [
    return1W, return1M, return3M, return6M,
    return1Y, return2Y, return3Y, return5Y, return10Y,
    cagr1Y, cagr2Y, cagr3Y, cagr5Y, cagr10Y,
    volatility1Y, maxDrawdown,
    schemeCode
  ]);

  return true;
}

// Process funds in batches with controlled concurrency
async function processBatch(funds: { scheme_code: string }[], startIdx: number): Promise<{ updated: number; errors: number }> {
  const batch = funds.slice(startIdx, startIdx + CONFIG.CONCURRENCY);
  const results = await Promise.allSettled(
    batch.map(fund => updateFundMetrics(fund.scheme_code))
  );
  
  let updated = 0;
  let errors = 0;
  
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value === true) {
      updated++;
    } else {
      errors++;
    }
  });
  
  return { updated, errors };
}

async function runDailyUpdate() {
  const startTime = Date.now();
  console.log('🔄 DAILY NAV UPDATE - ROBUST VERSION');
  console.log(`⏱️  Started at: ${new Date().toISOString()}`);
  console.log(`⚙️  Config: ${CONFIG.CONCURRENCY} concurrent requests, ${CONFIG.DELAY_BETWEEN_BATCHES}ms delay between batches`);
  console.log('');
  
  // Get ALL funds to update
  const result = await pool.query(`
    SELECT scheme_code FROM funds 
    WHERE latest_nav IS NOT NULL
    ORDER BY scheme_code
  `);

  const funds = result.rows;
  console.log(`📊 Total funds to update: ${funds.length}`);
  console.log(`📦 Batch size: ${CONFIG.CONCURRENCY} | Estimated batches: ${Math.ceil(funds.length / CONFIG.CONCURRENCY)}`);
  console.log('');

  let totalUpdated = 0;
  let totalErrors = 0;
  let consecutiveErrors = 0;

  for (let i = 0; i < funds.length; i += CONFIG.CONCURRENCY) {
    try {
      const { updated, errors } = await processBatch(funds, i);
      totalUpdated += updated;
      totalErrors += errors;
      
      // Track consecutive errors
      if (errors === CONFIG.CONCURRENCY) {
        consecutiveErrors += CONFIG.CONCURRENCY;
      } else {
        consecutiveErrors = 0;
      }
      
      // Pause if too many consecutive errors (MFApi might be overloaded)
      if (consecutiveErrors >= CONFIG.ERROR_PAUSE_THRESHOLD) {
        console.log(`   ⏸️  ${consecutiveErrors} consecutive errors - pausing ${CONFIG.ERROR_PAUSE_DURATION/1000}s to let MFApi recover...`);
        await sleep(CONFIG.ERROR_PAUSE_DURATION);
        consecutiveErrors = 0;
      }

      // Progress logging
      const processed = Math.min(i + CONFIG.CONCURRENCY, funds.length);
      if (processed % CONFIG.BATCH_SIZE === 0 || processed === funds.length) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const rate = totalUpdated / (Date.now() - startTime) * 1000 * 60;
        const remaining = rate > 0 ? ((funds.length - processed) / rate).toFixed(1) : '?';
        const percent = ((processed / funds.length) * 100).toFixed(1);
        
        console.log(`   ✅ ${processed}/${funds.length} (${percent}%) | ${totalUpdated} updated, ${totalErrors} errors | ${elapsed}min elapsed, ~${remaining}min remaining`);
      }

      // Delay between batches to avoid overwhelming MFApi
      await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
      
    } catch (error: any) {
      console.error(`   ❌ Batch error at index ${i}:`, error.message);
      totalErrors += CONFIG.CONCURRENCY;
      await sleep(CONFIG.ERROR_PAUSE_DURATION);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const successRate = ((totalUpdated / funds.length) * 100).toFixed(1);
  
  console.log('');
  console.log('═'.repeat(60));
  console.log('✨ DAILY NAV UPDATE COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   ⏱️  Total time: ${totalTime} minutes`);
  console.log(`   ✅ Successfully updated: ${totalUpdated} funds (${successRate}%)`);
  console.log(`   ❌ Errors/Skipped: ${totalErrors} funds`);
  console.log(`   📊 Rate: ${(totalUpdated / parseFloat(totalTime)).toFixed(1)} funds/minute`);
  console.log(`   🏁 Finished at: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  await pool.end();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, closing database connection...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, closing database connection...');
  await pool.end();
  process.exit(0);
});

runDailyUpdate().catch(async (error) => {
  console.error('❌ Fatal error:', error);
  await pool.end();
  process.exit(1);
});
