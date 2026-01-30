/**
 * Import Latest NAV Data from AMFI
 * Quick import of current NAV data
 */

import pool from '@/lib/postgres-db';
import https from 'https';

interface NAVRecord {
  schemeCode: string;
  schemeName: string;
  navDate: string;
  navValue: number;
}

// Download AMFI NAV file
async function downloadNAVFile(): Promise<string> {
  const url = `https://portal.amfiindia.com/spages/NAVAll.txt`;
  
  console.log('📥 Downloading NAV data from AMFI...');
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          https.get(redirectUrl, (redirectRes) => {
            let data = '';
            redirectRes.on('data', (chunk) => data += chunk);
            redirectRes.on('end', () => {
              console.log(`✅ Downloaded ${data.length} bytes`);
              resolve(data);
            });
            redirectRes.on('error', reject);
          }).on('error', reject);
          return;
        }
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`✅ Downloaded ${data.length} bytes`);
        resolve(data);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Parse AMFI date format (DD-MMM-YYYY) to YYYY-MM-DD
function parseAMFIDate(dateStr: string): string | null {
  try {
    // Format: "17-Nov-2025"
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

// Parse AMFI NAV file
function parseNAVFile(content: string): NAVRecord[] {
  const lines = content.split('\n');
  const records: NAVRecord[] = [];
  
  console.log('📊 Parsing NAV data...');
  
  for (const line of lines) {
    // AMFI format: SchemeCode;ISIN Div;ISIN Growth;Scheme Name;NAV;Date
    const parts = line.split(';');
    if (parts.length >= 6) {
      const schemeCode = parts[0]?.trim();
      const schemeName = parts[3]?.trim();
      const navValue = parseFloat(parts[4]?.trim());
      const navDateStr = parts[5]?.trim();
      
      if (schemeCode && !isNaN(navValue) && navValue > 0 && navDateStr) {
        const navDate = parseAMFIDate(navDateStr);
        if (navDate) {
          records.push({
            schemeCode,
            schemeName,
            navDate,
            navValue
          });
        }
      }
    }
  }
  
  console.log(`✅ Parsed ${records.length.toLocaleString()} NAV records`);
  return records;
}

// Batch insert NAV records
async function batchInsertNAV(records: NAVRecord[], batchSize = 1000) {
  const client = await pool.connect();
  
  console.log('💾 Inserting into database...');
  
  try {
    await client.query('BEGIN');
    
    let inserted = 0;
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
      inserted += batch.length;
      
      process.stdout.write(`\r💾 Inserted: ${inserted.toLocaleString()}/${records.length.toLocaleString()}`);
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ Successfully inserted ${inserted.toLocaleString()} records`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Main import function
export async function importLatestNAV() {
  console.log('🚀 Importing latest NAV data from AMFI...\n');
  
  try {
    // Download
    const content = await downloadNAVFile();
    
    // Parse
    const allRecords = parseNAVFile(content);
    
    if (allRecords.length === 0) {
      throw new Error('No records parsed from AMFI file');
    }
    
    // Get existing scheme codes from database
    console.log('🔍 Checking existing funds in database...');
    const result = await pool.query('SELECT scheme_code FROM funds');
    const existingCodes = new Set(result.rows.map(r => r.scheme_code));
    console.log(`✅ Found ${existingCodes.size.toLocaleString()} funds in database`);
    
    // Filter records to only include existing funds
    const records = allRecords.filter(r => existingCodes.has(r.schemeCode));
    console.log(`📊 Filtered to ${records.length.toLocaleString()} matching records`);
    
    if (records.length === 0) {
      throw new Error('No matching records found');
    }
    
    // Insert
    await batchInsertNAV(records);
    
    // Summary
    console.log('\n🎉 Import Complete!');
    console.log(`📊 Total Records: ${records.length.toLocaleString()}`);
    
    // Show sample
    if (records.length > 0) {
      console.log(`\n📝 Sample Record:`);
      console.log(`   Scheme: ${records[0].schemeCode}`);
      console.log(`   NAV: ₹${records[0].navValue}`);
      console.log(`   Date: ${records[0].navDate}`);
    }
    
    return { totalRecords: records.length };
  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  importLatestNAV()
    .then(() => {
      console.log('\n✅ Import successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}
