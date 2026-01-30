/**
 * AMFI NAV Sync for PostgreSQL
 * Fetches and stores NAV data in PostgreSQL database
 */

import { saveNavRecords, NAVRecord } from './postgres-db';

// AMFI NAV file URL
const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';

/**
 * Parse AMFI date format (dd-MMM-yyyy) to YYYY-MM-DD
 */
function parseAMFIDate(dateStr: string): string | null {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    
    const day = parts[0].padStart(2, '0');
    const monthStr = parts[1];
    const year = parts[2];
    
    const monthMap: { [key: string]: string } = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const month = monthMap[monthStr];
    if (!month) return null;
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
  }
}

/**
 * Fetch and parse NAV data from AMFI
 */
export async function fetchAMFIData(): Promise<NAVRecord[]> {
  try {
    console.log('📥 Fetching NAV data from AMFI...');
    
    const response = await fetch(AMFI_NAV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch AMFI data: ${response.status}`);
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    const records: NAVRecord[] = [];
    
    let currentAMC = '';
    let currentSchemeType = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if it's an AMC header
      if (!trimmedLine.includes(';')) {
        currentAMC = trimmedLine;
        continue;
      }
      
      // Check if it's a scheme type header
      if (trimmedLine.toLowerCase().includes('scheme') && !trimmedLine.split(';')[0].match(/^\d+$/)) {
        currentSchemeType = trimmedLine;
        continue;
      }
      
      // Parse NAV data line
      const parts = line.split(';');
      if (parts.length < 6) continue;
      
      const schemeCode = parts[0].trim();
      const schemeName = parts[3].trim();
      const navValue = parts[4].trim();
      const dateStr = parts[5].trim();
      
      // Skip if scheme code is not numeric
      if (!schemeCode || !schemeCode.match(/^\d+$/)) continue;
      
      // Skip if NAV is not available
      if (!navValue || navValue === 'N.A.' || navValue === '-') continue;
      
      const nav = parseFloat(navValue);
      if (isNaN(nav)) continue;
      
      const date = parseAMFIDate(dateStr);
      if (!date) continue;
      
      records.push({
        schemeCode,
        schemeName,
        nav,
        date,
        timestamp: new Date(date).getTime(),
        amcCode: currentAMC,
        schemeType: currentSchemeType,
      });
    }
    
    console.log(`✅ Parsed ${records.length} NAV records`);
    return records;
  } catch (error) {
    console.error('❌ Error fetching AMFI data:', error);
    throw error;
  }
}

/**
 * Sync NAV data from AMFI to PostgreSQL
 */
export async function syncNavDataToPostgres(): Promise<{
  success: boolean;
  recordsProcessed: number;
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting NAV data sync to PostgreSQL...');
    
    // Fetch data from AMFI
    const records = await fetchAMFIData();
    
    if (records.length === 0) {
      throw new Error('No NAV records fetched from AMFI');
    }
    
    // Save to PostgreSQL
    console.log('💾 Saving to PostgreSQL database...');
    const result = await saveNavRecords(records);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ NAV sync completed in ${(duration / 1000).toFixed(2)}s`);
    console.log(`   Saved: ${result.saved}, Errors: ${result.errors}`);
    
    return {
      success: true,
      recordsProcessed: result.saved,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ NAV sync failed:', error);
    
    return {
      success: false,
      recordsProcessed: 0,
      duration,
      error: error.message,
    };
  }
}
