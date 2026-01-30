/**
 * Quick Import - Last 3 Years NAV Data
 * Faster import for immediate returns calculation
 */

import pool from '@/lib/postgres-db';
import https from 'https';

interface NAVRecord {
  schemeCode: string;
  navDate: Date;
  navValue: number;
}

// Download AMFI NAV file
async function downloadNAVFile(date: Date): Promise<string> {
  // AMFI URL doesn't need date parameter - always returns latest
  const url = `https://www.amfiindia.com/spages/NAVAll.txt`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
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
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Import last 3 years (enough for all returns)
export async function quickImportNAV() {
  console.log(`🚀 Quick Import: Last 3 years of NAV data...`);
  console.log(`⏱️  Estimated time: 30-45 minutes\n`);
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);
  
  let currentDate = new Date(startDate);
  let totalRecords = 0;
  let successDays = 0;
  let failedDays = 0;
  let dayCount = 0;
  
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  while (currentDate <= endDate) {
    dayCount++;
    const dateStr = currentDate.toISOString().split('T')[0];
    
    try {
      process.stdout.write(`\r📅 Progress: ${dayCount}/${totalDays} days | ${dateStr} | Records: ${totalRecords.toLocaleString()}`);
      
      const content = await downloadNAVFile(currentDate);
      const records = parseNAVFile(content, currentDate);
      
      if (records.length > 0) {
        await batchInsertNAV(records);
        totalRecords += records.length;
        successDays++;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Rate limiting - 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      if (error.message?.includes('ENOTFOUND') || error.message?.includes('timeout')) {
        // Network error - skip and continue
        failedDays++;
      } else {
        console.error(`\n❌ Error for ${dateStr}:`, error.message);
        failedDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  console.log(`\n\n🎉 Quick Import Complete!`);
  console.log(`📊 Total Records: ${totalRecords.toLocaleString()}`);
  console.log(`✅ Success Days: ${successDays}`);
  console.log(`❌ Failed Days: ${failedDays}`);
  console.log(`📈 Average Records/Day: ${Math.round(totalRecords / successDays).toLocaleString()}`);
  
  return { totalRecords, successDays, failedDays };
}

// Run if called directly
if (require.main === module) {
  quickImportNAV()
    .then(() => {
      console.log('\n✅ Import successful! Now run calculate-returns.ts');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}
