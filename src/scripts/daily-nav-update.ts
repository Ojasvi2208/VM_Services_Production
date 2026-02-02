import { Pool } from 'pg';
import axios from 'axios';

const RAILWAY_DB_URL = process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway';

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

async function fetchWithRetry(schemeCode: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(
        `https://api.mfapi.in/mf/${schemeCode}`,
        { 
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      if (attempt === maxRetries) return null;
      await sleep(attempt * 2000);
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
  const today = parseDate(latestDate);

  const nav1W = getNavAtDate(navData, new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
  const nav1M = getNavAtDate(navData, new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  const nav6M = getNavAtDate(navData, new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000));
  const nav1Y = getNavAtDate(navData, new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000));
  const nav3Y = getNavAtDate(navData, new Date(today.getTime() - 1095 * 24 * 60 * 60 * 1000));
  const nav5Y = getNavAtDate(navData, new Date(today.getTime() - 1825 * 24 * 60 * 60 * 1000));

  // Update funds table
  await pool.query(`
    UPDATE funds SET
      latest_nav = $1,
      latest_nav_date = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE scheme_code = $3
  `, [latestNav, convertDateToPostgres(latestDate), schemeCode]);

  // Update fund_returns table
  await pool.query(`
    UPDATE fund_returns SET
      return_1w = $1, return_1m = $2, return_6m = $3, return_1y = $4,
      cagr_1y = $5, cagr_3y = $6, cagr_5y = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE scheme_code = $8
  `, [
    nav1W ? calculateReturn(latestNav, nav1W) : null,
    nav1M ? calculateReturn(latestNav, nav1M) : null,
    nav6M ? calculateReturn(latestNav, nav6M) : null,
    nav1Y ? calculateReturn(latestNav, nav1Y) : null,
    nav1Y ? calculateCAGR(latestNav, nav1Y, 1) : null,
    nav3Y ? calculateCAGR(latestNav, nav3Y, 3) : null,
    nav5Y ? calculateCAGR(latestNav, nav5Y, 5) : null,
    schemeCode
  ]);

  return true;
}

async function runDailyUpdate() {
  console.log('🔄 DAILY NAV UPDATE - Started at', new Date().toISOString());
  
  // Get funds that need updating (NAV older than today)
  const result = await pool.query(`
    SELECT scheme_code FROM funds 
    WHERE latest_nav IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 5000
  `);

  const funds = result.rows;
  console.log(`📊 Updating ${funds.length} funds...`);

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < funds.length; i++) {
    try {
      const success = await updateFundMetrics(funds[i].scheme_code);
      if (success) updated++;
      else errors++;

      if ((i + 1) % 100 === 0) {
        console.log(`   Progress: ${i + 1}/${funds.length} (${updated} updated, ${errors} errors)`);
      }

      await sleep(500); // 2 requests per second
    } catch (error) {
      errors++;
    }
  }

  console.log('✅ DAILY UPDATE COMPLETE');
  console.log(`   Updated: ${updated} funds`);
  console.log(`   Errors: ${errors} funds`);
  console.log(`   Finished at: ${new Date().toISOString()}`);

  await pool.end();
}

runDailyUpdate().catch(console.error);
