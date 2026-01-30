/**
 * Import Historical NAV Data from AMFI
 * Downloads and imports 10 years of NAV data
 */

import pool from '@/lib/postgres-db';
import https from 'https';

interface NAVRecord {
  schemeCode: string;
  navDate: Date;
  navValue: number;
}

// Function to download AMFI NAV file for a specific date
async function downloadNAVFile(date: Date): Promise<string> {
  const dateStr = date.toISOString().split('T')[0];
  const url = `https://www.amfiindia.com/spages/NAVAll.txt?t=${dateStr}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

// Parse AMFI NAV file
function parseNAVFile(content: string, date: Date): NAVRecord[] {
  const lines = content.split('\n');
  const records: NAVRecord[] = [];
  
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length >= 5) {
      const schemeCode = parts[0]?.trim();
      const navValue = parseFloat(parts[4]?.trim());
      
      if (schemeCode && !isNaN(navValue) && navValue > 0) {
        records.push({
          schemeCode,
          navDate: date,
          navValue
        });
      }
    }
  }
  
  return records;
}

// Batch insert NAV records
async function batchInsertNAV(records: NAVRecord[], batchSize = 1000) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const values = batch.map((r, idx) => {
        const base = idx * 3;
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      }).join(',');
      
      const params = batch.flatMap(r => [r.schemeCode, r.navDate, r.navValue]);
      
      const query = `
        INSERT INTO nav_history (scheme_code, nav_date, nav_value)
        VALUES ${values}
        ON CONFLICT (scheme_code, nav_date) DO UPDATE
        SET nav_value = EXCLUDED.nav_value
      `;
      
      await client.query(query, params);
    }
    
    await client.query('COMMIT');
    console.log(`✅ Inserted ${records.length} NAV records`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Main import function
export async function importHistoricalNAV(years = 10) {
  console.log(`🚀 Starting historical NAV import for ${years} years...`);
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - years);
  
  let currentDate = new Date(startDate);
  let totalRecords = 0;
  let successDays = 0;
  let failedDays = 0;
  
  while (currentDate <= endDate) {
    try {
      console.log(`📅 Downloading NAV for ${currentDate.toISOString().split('T')[0]}...`);
      
      const content = await downloadNAVFile(currentDate);
      const records = parseNAVFile(content, currentDate);
      
      if (records.length > 0) {
        await batchInsertNAV(records);
        totalRecords += records.length;
        successDays++;
        console.log(`✅ ${records.length} records for ${currentDate.toISOString().split('T')[0]}`);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Failed for ${currentDate.toISOString().split('T')[0]}:`, error);
      failedDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  console.log(`\n🎉 Import Complete!`);
  console.log(`Total Records: ${totalRecords.toLocaleString()}`);
  console.log(`Success Days: ${successDays}`);
  console.log(`Failed Days: ${failedDays}`);
  
  return { totalRecords, successDays, failedDays };
}

// Run if called directly
if (require.main === module) {
  importHistoricalNAV(10)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}
