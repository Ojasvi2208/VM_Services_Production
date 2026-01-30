/**
 * Daily NAV Update Script
 * Run this daily via cron to:
 * 1. Import latest NAV data
 * 2. Recalculate returns for all funds
 */

import pool from '@/lib/postgres-db';
import https from 'https';

interface NAVRecord {
  schemeCode: string;
  navDate: string;
  navValue: number;
}

// Parse AMFI date format (DD-MMM-YYYY) to YYYY-MM-DD
function parseAMFIDate(dateStr: string): string | null {
  try {
    const months: {[key: string]: string} = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = months[parts[1]];
      const year = parts[2];
      
      if (month && year) {
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Download AMFI NAV file
async function downloadNAVFile(): Promise<string> {
  const url = `https://portal.amfiindia.com/spages/NAVAll.txt`;
  
  console.log('📥 Downloading latest NAV data from AMFI...');
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          https.get(redirectUrl, (redirectRes) => {
            let data = '';
            redirectRes.on('data', (chunk) => data += chunk);
            redirectRes.on('end', () => resolve(data));
            redirectRes.on('error', reject);
          }).on('error', reject);
          return;
        }
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Parse AMFI NAV file
function parseNAVFile(content: string): NAVRecord[] {
  const lines = content.split('\n');
  const records: NAVRecord[] = [];
  
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length >= 6) {
      const schemeCode = parts[0]?.trim();
      const navValue = parseFloat(parts[4]?.trim());
      const navDateStr = parts[5]?.trim();
      
      if (schemeCode && !isNaN(navValue) && navValue > 0 && navDateStr) {
        const navDate = parseAMFIDate(navDateStr);
        if (navDate) {
          records.push({
            schemeCode,
            navDate,
            navValue
          });
        }
      }
    }
  }
  
  return records;
}

// Get existing scheme codes from database
async function getExistingSchemeCodes(): Promise<Set<string>> {
  const result = await pool.query('SELECT scheme_code FROM funds');
  return new Set(result.rows.map(r => r.scheme_code));
}

// Get the latest NAV date in database
async function getLatestNAVDate(): Promise<string | null> {
  const result = await pool.query(
    'SELECT MAX(nav_date) as latest_date FROM nav_history'
  );
  return result.rows[0]?.latest_date || null;
}

// Insert NAV records
async function insertNAVRecords(records: NAVRecord[]): Promise<number> {
  const client = await pool.connect();
  let inserted = 0;
  
  try {
    await client.query('BEGIN');
    
    for (const record of records) {
      await client.query(
        `INSERT INTO nav_history (scheme_code, nav_date, nav_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (scheme_code, nav_date) DO UPDATE
         SET nav_value = EXCLUDED.nav_value`,
        [record.schemeCode, record.navDate, record.navValue]
      );
      inserted++;
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  return inserted;
}

// Calculate returns for a single fund
async function calculateFundReturns(schemeCode: string, latestNav: number, latestDate: Date) {
  const returns: any = {
    scheme_code: schemeCode,
    calculated_date: latestDate,
  };
  
  // Helper to get NAV for a date
  const getNAV = async (targetDate: Date): Promise<number | null> => {
    const result = await pool.query(
      `SELECT nav_value FROM nav_history 
       WHERE scheme_code = $1 AND nav_date <= $2 
       ORDER BY nav_date DESC LIMIT 1`,
      [schemeCode, targetDate]
    );
    return result.rows[0]?.nav_value || null;
  };
  
  // Calculate return
  const calcReturn = (startNav: number, endNav: number) => 
    ((endNav - startNav) / startNav) * 100;
  
  // Calculate CAGR
  const calcCAGR = (startNav: number, endNav: number, years: number) => 
    (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
  
  // Calculate all periods
  const periods = [
    { key: 'return_1w', days: 7 },
    { key: 'return_1m', days: 30 },
    { key: 'return_3m', days: 90 },
    { key: 'return_6m', days: 180 },
    { key: 'return_1y', days: 365, cagrKey: 'cagr_1y' },
    { key: 'return_2y', days: 730, cagrKey: 'cagr_2y' },
    { key: 'return_3y', days: 1095, cagrKey: 'cagr_3y' },
    { key: 'return_5y', days: 1825, cagrKey: 'cagr_5y' },
    { key: 'return_7y', days: 2555, cagrKey: 'cagr_7y' },
    { key: 'return_10y', days: 3650, cagrKey: 'cagr_10y' },
  ];
  
  for (const period of periods) {
    const startDate = new Date(latestDate);
    startDate.setDate(startDate.getDate() - period.days);
    
    const startNav = await getNAV(startDate);
    if (startNav && startNav > 0) {
      returns[period.key] = calcReturn(startNav, latestNav);
      if (period.cagrKey) {
        returns[period.cagrKey] = calcCAGR(startNav, latestNav, period.days / 365);
      }
    }
  }
  
  // Since inception
  const inceptionResult = await pool.query(
    `SELECT nav_value, nav_date FROM nav_history 
     WHERE scheme_code = $1 ORDER BY nav_date ASC LIMIT 1`,
    [schemeCode]
  );
  
  if (inceptionResult.rows[0]) {
    const inceptionNav = parseFloat(inceptionResult.rows[0].nav_value);
    const inceptionDate = new Date(inceptionResult.rows[0].nav_date);
    const daysSince = Math.floor((latestDate.getTime() - inceptionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince > 0) {
      returns.return_since_inception = calcReturn(inceptionNav, latestNav);
      if (daysSince >= 365) {
        returns.cagr_since_inception = calcCAGR(inceptionNav, latestNav, daysSince / 365);
      }
    }
  }
  
  return returns;
}

// Save returns to database
async function saveReturns(returns: any) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query(
      'DELETE FROM fund_returns WHERE scheme_code = $1 AND calculated_date = $2',
      [returns.scheme_code, returns.calculated_date]
    );
    
    const columns = Object.keys(returns).filter(k => returns[k] !== undefined);
    const values = columns.map(k => returns[k]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO fund_returns (${columns.join(', ')})
      VALUES (${placeholders})
    `;
    
    await client.query(query, values);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Recalculate returns for all funds
async function recalculateReturns() {
  console.log('\n📊 Recalculating returns...');
  
  const fundsResult = await pool.query(
    `SELECT scheme_code, latest_nav, latest_nav_date 
     FROM funds 
     WHERE latest_nav IS NOT NULL AND latest_nav_date IS NOT NULL`
  );
  
  let successful = 0;
  let failed = 0;
  
  for (const fund of fundsResult.rows) {
    try {
      const latestNav = parseFloat(fund.latest_nav);
      const latestDate = new Date(fund.latest_nav_date);
      
      const returns = await calculateFundReturns(fund.scheme_code, latestNav, latestDate);
      
      const hasReturns = Object.keys(returns).some(k => 
        k.startsWith('return_') && returns[k] !== undefined
      );
      
      if (hasReturns) {
        await saveReturns(returns);
        successful++;
      }
    } catch (error) {
      failed++;
    }
  }
  
  console.log(`✅ Returns calculated: ${successful} funds`);
  console.log(`❌ Failed: ${failed} funds`);
}

// Main daily update function
export async function dailyUpdate() {
  const startTime = Date.now();
  console.log('🚀 Starting daily NAV update...');
  console.log(`📅 Date: ${new Date().toISOString()}\n`);
  
  try {
    // Step 1: Get latest NAV date in database
    const latestDate = await getLatestNAVDate();
    console.log(`📊 Latest NAV in database: ${latestDate || 'None'}`);
    
    // Step 2: Download latest NAV data
    const content = await downloadNAVFile();
    console.log(`✅ Downloaded ${content.length} bytes`);
    
    // Step 3: Parse NAV data
    const allRecords = parseNAVFile(content);
    console.log(`📊 Parsed ${allRecords.length.toLocaleString()} NAV records`);
    
    if (allRecords.length === 0) {
      throw new Error('No NAV records parsed');
    }
    
    // Step 4: Filter to existing funds
    const existingCodes = await getExistingSchemeCodes();
    const records = allRecords.filter(r => existingCodes.has(r.schemeCode));
    console.log(`📊 Filtered to ${records.length.toLocaleString()} matching funds`);
    
    // Step 5: Insert NAV records
    console.log('\n💾 Inserting NAV data...');
    const inserted = await insertNAVRecords(records);
    console.log(`✅ Inserted/Updated ${inserted.toLocaleString()} NAV records`);
    
    // Step 6: Recalculate returns
    await recalculateReturns();
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Daily update complete!`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 NAV Records: ${inserted.toLocaleString()}`);
    
    return { success: true, inserted, duration };
  } catch (error: any) {
    console.error('\n❌ Daily update failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  dailyUpdate()
    .then(() => {
      console.log('\n✅ Daily update successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Daily update failed:', error);
      process.exit(1);
    });
}
