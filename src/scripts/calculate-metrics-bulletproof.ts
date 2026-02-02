import { Pool } from 'pg';
import axios from 'axios';

const RAILWAY_DB_URL = process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 2, // Reduced from 5 to 2 for minimal load
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function checkDatabaseSpace(): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT 
        pg_database_size(current_database()) as used_bytes,
        pg_size_pretty(pg_database_size(current_database())) as used_size
    `);
    
    const usedBytes = parseInt(result.rows[0].used_bytes);
    const usedSize = result.rows[0].used_size;
    const limitBytes = 512 * 1024 * 1024;
    const usagePercent = (usedBytes / limitBytes) * 100;
    
    console.log(`   💾 Database: ${usedSize} (${usagePercent.toFixed(1)}% of limit)`);
    
    if (usagePercent >= 90) {
      console.error('\n⚠️  DATABASE SPACE CRITICAL: 90% full - STOPPING');
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('   ⚠️  Could not check database space');
    return true;
  }
}

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-');
  return new Date(`${year}-${month}-${day}`);
}

function convertDateToPostgres(dateStr: string): string {
  const [day, month, year] = dateStr.split('-');
  return `${year}-${month}-${day}`;
}

function calculateReturn(currentNav: number, pastNav: number): number {
  if (!pastNav || pastNav === 0) return 0;
  return ((currentNav - pastNav) / pastNav) * 100;
}

function calculateCAGR(currentNav: number, pastNav: number, years: number): number {
  if (!pastNav || pastNav === 0 || years === 0) return 0;
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

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(schemeCode: string, maxRetries = 5): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(
        `https://api.mfapi.in/mf/${schemeCode}`,
        { 
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      const delay = Math.min(attempt * 3000, 15000);
      console.log(`   ⚠️  Retry ${attempt}/${maxRetries} in ${delay/1000}s...`);
      await sleep(delay);
    }
  }
}

async function calculateMetricsForFund(schemeCode: string) {
  try {
    const data = await fetchWithRetry(schemeCode);
    
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

    return {
      scheme_code: schemeCode,
      latest_nav: latestNav,
      latest_nav_date: latestDate,
      inception_date: inceptionDate,
      return_1w: nav1W ? calculateReturn(latestNav, nav1W) : null,
      return_1m: nav1M ? calculateReturn(latestNav, nav1M) : null,
      return_6m: nav6M ? calculateReturn(latestNav, nav6M) : null,
      return_1y: nav1Y ? calculateReturn(latestNav, nav1Y) : null,
      return_2y: nav2Y ? calculateReturn(latestNav, nav2Y) : null,
      return_3y: nav3Y ? calculateReturn(latestNav, nav3Y) : null,
      return_5y: nav5Y ? calculateReturn(latestNav, nav5Y) : null,
      return_10y: nav10Y ? calculateReturn(latestNav, nav10Y) : null,
      cagr_1y: nav1Y ? calculateCAGR(latestNav, nav1Y, 1) : null,
      cagr_2y: nav2Y ? calculateCAGR(latestNav, nav2Y, 2) : null,
      cagr_3y: nav3Y ? calculateCAGR(latestNav, nav3Y, 3) : null,
      cagr_5y: nav5Y ? calculateCAGR(latestNav, nav5Y, 5) : null,
      cagr_10y: nav10Y ? calculateCAGR(latestNav, nav10Y, 10) : null
    };
  } catch (error: any) {
    throw error;
  }
}

async function processAllFunds() {
  console.log('🚀 BULLETPROOF Metrics Calculator - ULTRA GENTLE on MFApi\n');
  console.log('⏱️  Estimated time: 10-12 hours for all funds (1 fund/second)');
  console.log('🐢 Super slow but 100% reliable - won\'t crash MFApi\n');

  try {
    const hasSpace = await checkDatabaseSpace();
    if (!hasSpace) {
      console.error('❌ Insufficient database space');
      process.exit(1);
    }
    
    const fundsResult = await pool.query(`
      SELECT f.scheme_code, f.scheme_name 
      FROM funds f
      WHERE f.latest_nav IS NULL
      ORDER BY f.scheme_code
    `);
    
    const funds = fundsResult.rows;
    console.log(`📊 Found ${funds.length} funds needing metrics\n`);

    if (funds.length === 0) {
      console.log('✅ All funds already processed!');
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
        const metrics = await calculateMetricsForFund(fund.scheme_code);

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
              scheme_code, return_1w, return_1m, return_3m, return_6m, return_1y, 
              return_2y, return_3y, return_5y, return_10y,
              cagr_1y, cagr_2y, cagr_3y, cagr_5y, cagr_10y, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
            ON CONFLICT (scheme_code) DO UPDATE SET
              return_1w = $2, return_1m = $3, return_3m = $4, return_6m = $5,
              return_1y = $6, return_2y = $7, return_3y = $8, return_5y = $9, return_10y = $10,
              cagr_1y = $11, cagr_2y = $12, cagr_3y = $13, cagr_5y = $14, cagr_10y = $15,
              updated_at = CURRENT_TIMESTAMP
          `, [
            metrics.scheme_code, metrics.return_1w, metrics.return_1m, metrics.return_6m, 
            metrics.return_6m, metrics.return_1y, metrics.return_2y, metrics.return_3y, 
            metrics.return_5y, metrics.return_10y,
            metrics.cagr_1y, metrics.cagr_2y, metrics.cagr_3y, metrics.cagr_5y, metrics.cagr_10y
          ]);

          successCount++;
        } else {
          skipCount++;
        }

        if ((successCount + skipCount) % 50 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          const rate = successCount / (Date.now() - startTime) * 1000 * 60;
          const remaining = (funds.length - i - 1) / rate;
          console.log(`   ✅ ${successCount}/${funds.length} | ${elapsed}min elapsed | ~${remaining.toFixed(0)}min remaining`);
        }

        if ((successCount + skipCount) % 500 === 0) {
          const hasSpace = await checkDatabaseSpace();
          if (!hasSpace) {
            console.error(`\n❌ Database 90% full - stopped at ${successCount}/${funds.length}`);
            break;
          }
        }

        await sleep(1000); // 1 second delay = 1 fund per second (very gentle on MFApi)

      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ ${fund.scheme_code}: ${error.message}`);
        
        if (errorCount % 10 === 0) {
          console.log('   ⏸️  Too many errors, pausing 30s...');
          await sleep(30000);
        } else {
          await sleep(2000);
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ METRICS CALCULATION COMPLETE\n');
    console.log(`   ⏱️  Total time: ${totalTime} minutes`);
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
