/**
 * Import Historical NAV from MFApi
 * API: https://api.mfapi.in/mf/{scheme_code}
 */

import pool from '@/lib/postgres-db';
import https from 'https';

interface MFApiNAV {
  date: string; // Format: "DD-MM-YYYY"
  nav: string;
}

interface MFApiResponse {
  meta: {
    scheme_code: string;
    scheme_name: string;
  };
  data: MFApiNAV[];
  status: string;
}

// Fetch NAV data from MFApi
async function fetchMFApiData(schemeCode: string): Promise<MFApiResponse | null> {
  const url = `https://api.mfapi.in/mf/${schemeCode}`;
  
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'SUCCESS') {
            resolve(json);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

// Parse MFApi date format (DD-MM-YYYY) to YYYY-MM-DD
function parseMFApiDate(dateStr: string): string | null {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return null;
  } catch {
    return null;
  }
}

// Insert NAV records for a fund
async function insertFundNAV(schemeCode: string, navData: MFApiNAV[]): Promise<number> {
  const client = await pool.connect();
  let inserted = 0;
  
  try {
    await client.query('BEGIN');
    
    for (const nav of navData) {
      const navDate = parseMFApiDate(nav.date);
      const navValue = parseFloat(nav.nav);
      
      if (navDate && !isNaN(navValue) && navValue > 0) {
        await client.query(
          `INSERT INTO nav_history (scheme_code, nav_date, nav_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (scheme_code, nav_date) DO UPDATE
           SET nav_value = EXCLUDED.nav_value`,
          [schemeCode, navDate, navValue]
        );
        inserted++;
      }
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

// Main import function
export async function importMFApiNAV() {
  console.log('🚀 Importing historical NAV from MFApi...\n');
  
  // Get all funds
  const result = await pool.query('SELECT scheme_code FROM funds ORDER BY scheme_code');
  const funds = result.rows;
  
  console.log(`📊 Total funds: ${funds.length.toLocaleString()}\n`);
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  let totalRecords = 0;
  
  for (const fund of funds) {
    processed++;
    
    try {
      const data = await fetchMFApiData(fund.scheme_code);
      
      if (data && data.data && data.data.length > 0) {
        const inserted = await insertFundNAV(fund.scheme_code, data.data);
        totalRecords += inserted;
        successful++;
        
        if (processed % 100 === 0) {
          const progress = ((processed / funds.length) * 100).toFixed(1);
          process.stdout.write(`\r📈 Progress: ${processed}/${funds.length} (${progress}%) | Success: ${successful} | Records: ${totalRecords.toLocaleString()}`);
        }
      } else {
        failed++;
      }
      
      // Rate limiting - 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error: any) {
      failed++;
      if (failed <= 5) {
        console.error(`\n❌ Error for ${fund.scheme_code}:`, error.message);
      }
    }
  }
  
  console.log(`\n\n🎉 Import Complete!`);
  console.log(`✅ Successful: ${successful.toLocaleString()}`);
  console.log(`❌ Failed: ${failed.toLocaleString()}`);
  console.log(`📊 Total NAV Records: ${totalRecords.toLocaleString()}`);
  console.log(`📈 Average Records/Fund: ${Math.round(totalRecords / successful).toLocaleString()}`);
  
  return { successful, failed, totalRecords };
}

// Run if called directly
if (require.main === module) {
  importMFApiNAV()
    .then(() => {
      console.log('\n✅ Import successful! Now run calculate-returns.ts');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}
