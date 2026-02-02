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
