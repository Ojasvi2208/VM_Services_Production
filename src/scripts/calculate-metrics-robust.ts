import { Pool } from 'pg';
import axios from 'axios';

const RAILWAY_DB_URL = process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Check database space usage and stop if > 90% full
async function checkDatabaseSpace(): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT 
        pg_database_size(current_database()) as used_bytes,
        pg_size_pretty(pg_database_size(current_database())) as used_size
    `);
    
    const usedBytes = parseInt(result.rows[0].used_bytes);
    const usedSize = result.rows[0].used_size;
    
    const limitBytes = 512 * 1024 * 1024; // 512MB
    const usagePercent = (usedBytes / limitBytes) * 100;
    
    console.log(`   💾 Database: ${usedSize} (${usagePercent.toFixed(1)}% of limit)`);
    
    if (usagePercent >= 90) {
      console.error('\n⚠️  DATABASE SPACE CRITICAL: 90% full - STOPPING IMMEDIATELY');
      return false;
    }
    
    if (usagePercent >= 75) {
      console.warn(`   ⚠️  Warning: Database is ${usagePercent.toFixed(1)}% full`);
    }
    
    return true;
  } catch (error) {
    console.warn('   ⚠️  Could not check database space');
    return true;
  }
}

// Convert MFApi date format (DD-MM-YYYY) to Date object
function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-');
  return new Date(`${year}-${month}-${day}`);
}

// Convert MFApi date format (DD-MM-YYYY) to PostgreSQL format (YYYY-MM-DD)
function convertDateToPostgres(dateStr: string): string {
  const [day, month, year] = dateStr.split('-');
  return `${year}-${month}-${day}`;
}

// Calculate return percentage
function calculateReturn(currentNav: number, pastNav: number): number {
  if (!pastNav || pastNav === 0) return 0;
  return ((currentNav - pastNav) / pastNav) * 100;
}

// Calculate CAGR
function calculateCAGR(currentNav: number, pastNav: number, years: number): number {
  if (!pastNav || pastNav === 0 || years === 0) return 0;
  return (Math.pow(currentNav / pastNav, 1 / years) - 1) * 100;
}

// Calculate XIRR (simplified - using CAGR for now)
function calculateXIRR(currentNav: number, pastNav: number, days: number): number {
  if (!pastNav || pastNav === 0 || days === 0) return 0;
  const years = days / 365.25;
  return calculateCAGR(currentNav, pastNav, years);
}

// Calculate standard deviation (volatility)
function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252);
}

// Get NAV at specific date or closest before
function getNavAtDate(navData: any[], targetDate: Date): number | null {
  for (const nav of navData) {
    const navDate = parseDate(nav.date);
    if (navDate <= targetDate) {
      return parseFloat(nav.nav);
    }
  }
  return null;
}

// Calculate rolling returns
function calculateRollingReturns(navData: any[], windowDays: number): number[] {
  const returns: number[] = [];
  for (let i = 0; i < navData.length - windowDays; i++) {
    const currentNav = parseFloat(navData[i].nav);
    const pastNav = parseFloat(navData[i + windowDays].nav);
    if (pastNav > 0) {
      returns.push(calculateReturn(currentNav, pastNav));
    }
  }
  return returns;
}

// Retry logic for API calls
async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, { 
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      return response.data;
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      if (error.response?.status === 404) throw error; // Don't retry 404s
      
      const delay = attempt * 2000; // Exponential backoff
      console.log(`   ⚠️  Retry ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function calculateMetricsForFund(schemeCode: string, schemeName: string) {
  try {
    const data = await fetchWithRetry(`https://api.mfapi.in/mf/${schemeCode}`);

    if (!data?.data || data.data.length === 0) {
      return null;
    }

    const navData = data.data;
    const latestNav = parseFloat(navData[0].nav);
    const latestDate = navData[0].date;
    const inceptionDate = navData[navData.length - 1].date;

    const previousDayNav = navData.length > 1 ? parseFloat(navData[1].nav) : latestNav;
    const dayChange = calculateReturn(latestNav, previousDayNav);

    const today = parseDate(latestDate);
    
    const nav1W = getNavAtDate(navData, new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
    const nav1M = getNavAtDate(navData, new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
    const nav6M = getNavAtDate(navData, new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000));
    const nav1Y = getNavAtDate(navData, new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000));
    const nav2Y = getNavAtDate(navData, new Date(today.getTime() - 730 * 24 * 60 * 60 * 1000));
    const nav3Y = getNavAtDate(navData, new Date(today.getTime() - 1095 * 24 * 60 * 60 * 1000));
    const nav5Y = getNavAtDate(navData, new Date(today.getTime() - 1825 * 24 * 60 * 60 * 1000));
    const nav10Y = getNavAtDate(navData, new Date(today.getTime() - 3650 * 24 * 60 * 60 * 1000));

    const return1W = nav1W ? calculateReturn(latestNav, nav1W) : null;
    const return1M = nav1M ? calculateReturn(latestNav, nav1M) : null;
    const return6M = nav6M ? calculateReturn(latestNav, nav6M) : null;
    const return1Y = nav1Y ? calculateReturn(latestNav, nav1Y) : null;
    const return2Y = nav2Y ? calculateReturn(latestNav, nav2Y) : null;
    const return3Y = nav3Y ? calculateReturn(latestNav, nav3Y) : null;
    const return5Y = nav5Y ? calculateReturn(latestNav, nav5Y) : null;
    const return10Y = nav10Y ? calculateReturn(latestNav, nav10Y) : null;

    const cagr1Y = nav1Y ? calculateCAGR(latestNav, nav1Y, 1) : null;
    const cagr2Y = nav2Y ? calculateCAGR(latestNav, nav2Y, 2) : null;
    const cagr3Y = nav3Y ? calculateCAGR(latestNav, nav3Y, 3) : null;
    const cagr5Y = nav5Y ? calculateCAGR(latestNav, nav5Y, 5) : null;
    const cagr10Y = nav10Y ? calculateCAGR(latestNav, nav10Y, 10) : null;

    const xirr1Y = nav1Y ? calculateXIRR(latestNav, nav1Y, 365) : null;
    const xirr3Y = nav3Y ? calculateXIRR(latestNav, nav3Y, 1095) : null;
    const xirr5Y = nav5Y ? calculateXIRR(latestNav, nav5Y, 1825) : null;

    const dailyReturns: number[] = [];
    for (let i = 0; i < Math.min(navData.length - 1, 252); i++) {
      const currentNav = parseFloat(navData[i].nav);
      const prevNav = parseFloat(navData[i + 1].nav);
      if (prevNav > 0) {
        dailyReturns.push(((currentNav - prevNav) / prevNav) * 100);
      }
    }
    const volatility1Y = calculateVolatility(dailyReturns);

    const rolling1Y = calculateRollingReturns(navData, 252);
    const avgRolling1Y = rolling1Y.length > 0 
      ? rolling1Y.reduce((sum, r) => sum + r, 0) / rolling1Y.length 
      : null;

    return {
      scheme_code: schemeCode,
      latest_nav: latestNav,
      latest_nav_date: latestDate,
      previous_day_nav: previousDayNav,
      day_change_percent: dayChange,
      inception_date: inceptionDate,
      return_1w: return1W,
      return_1m: return1M,
      return_6m: return6M,
      return_1y: return1Y,
      return_2y: return2Y,
      return_3y: return3Y,
      return_5y: return5Y,
      return_10y: return10Y,
      cagr_1y: cagr1Y,
      cagr_2y: cagr2Y,
      cagr_3y: cagr3Y,
      cagr_5y: cagr5Y,
      cagr_10y: cagr10Y,
      xirr_1y: xirr1Y,
      xirr_3y: xirr3Y,
      xirr_5y: xirr5Y,
      volatility_1y: volatility1Y,
      rolling_return_1y_avg: avgRolling1Y
    };

  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function processAllFunds() {
  console.log('🚀 Calculating metrics for all funds (ROBUST version)...\n');

  try {
    const hasSpace = await checkDatabaseSpace();
    if (!hasSpace) {
      console.error('❌ Insufficient database space. Aborting.');
      process.exit(1);
    }
    
    // Get funds that don't have metrics yet
    const fundsResult = await pool.query(`
      SELECT f.scheme_code, f.scheme_name 
      FROM funds f
      LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
      WHERE f.latest_nav IS NULL OR fr.scheme_code IS NULL
      ORDER BY f.scheme_code
    `);
    
    const funds = fundsResult.rows;
    console.log(`📊 Found ${funds.length} funds needing metrics calculation\n`);

    if (funds.length === 0) {
      console.log('✅ All funds already have metrics calculated!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    const batchSize = 25; // Smaller batches for stability
    const totalBatches = Math.ceil(funds.length / batchSize);

    for (let i = 0; i < funds.length; i += batchSize) {
      // Check space every 10 batches
      if (i % 250 === 0 && i > 0) {
        const hasSpace = await checkDatabaseSpace();
        if (!hasSpace) {
          console.error(`\n❌ Database 90% full - stopped at ${successCount}/${funds.length} funds`);
          break;
        }
      }
      
      const batch = funds.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} funds)...`);

      for (const fund of batch) {
        try {
          const metrics = await calculateMetricsForFund(fund.scheme_code, fund.scheme_name);

          if (metrics) {
            await pool.query(`
              UPDATE funds SET
                latest_nav = $1,
                latest_nav_date = $2,
                inception_date = $3,
                updated_at = CURRENT_TIMESTAMP
              WHERE scheme_code = $4
            `, [
              metrics.latest_nav, 
              convertDateToPostgres(metrics.latest_nav_date), 
              convertDateToPostgres(metrics.inception_date), 
              metrics.scheme_code
            ]);

            await pool.query(`
              INSERT INTO fund_returns (
                scheme_code, return_1w, return_1m, return_3m, return_6m, return_1y, return_3y, return_5y,
                cagr_1y, cagr_3y, cagr_5y, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
              ON CONFLICT (scheme_code) DO UPDATE SET
                return_1w = $2, return_1m = $3, return_3m = $4, return_6m = $5,
                return_1y = $6, return_3y = $7, return_5y = $8,
                cagr_1y = $9, cagr_3y = $10, cagr_5y = $11,
                updated_at = CURRENT_TIMESTAMP
            `, [
              metrics.scheme_code, metrics.return_1w, metrics.return_1m, metrics.return_6m, 
              metrics.return_6m, metrics.return_1y, metrics.return_3y, metrics.return_5y,
              metrics.cagr_1y, metrics.cagr_3y, metrics.cagr_5y
            ]);

            successCount++;
            if (successCount % 25 === 0) {
              console.log(`   ✅ ${successCount}/${funds.length} funds processed`);
            }
          } else {
            skipCount++;
          }

          // Slower rate limiting to avoid API issues
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error: any) {
          errorCount++;
          console.error(`   ❌ ${fund.scheme_code}: ${error.message}`);
          
          // If too many errors in a row, pause longer
          if (errorCount % 5 === 0) {
            console.log('   ⏸️  Pausing 10s due to errors...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }

      console.log(`   📊 Batch ${batchNum} complete: ${successCount} successful, ${errorCount} errors, ${skipCount} skipped`);
      
      // Pause between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ METRICS CALCULATION COMPLETE\n');
    console.log(`   ✅ Successfully processed: ${successCount} funds`);
    console.log(`   ⏭️  Skipped (no data): ${skipCount} funds`);
    console.log(`   ❌ Errors: ${errorCount} funds`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

processAllFunds().catch(console.error);
