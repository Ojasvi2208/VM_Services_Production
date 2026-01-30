/**
 * AMFI NAV Fetcher Service
 * Fetches daily NAV data from AMFI's official data file
 * AMFI provides a daily NAV file at: https://www.amfiindia.com/spages/NAVAll.txt
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client (works with local DynamoDB)
const clientConfig: any = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fakeAccessKeyId',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fakeSecretAccessKey',
  },
};

// Use local DynamoDB if endpoint is provided
if (process.env.DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client);

// AMFI NAV file URL
const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';

// Table names
const NAV_HISTORY_TABLE = process.env.NAV_HISTORY_TABLE || 'vijaymalik-nav-history';
const FUNDS_TABLE = process.env.FUNDS_TABLE || 'vijaymalik-funds';

/**
 * NAV Record Interface
 */
export interface NAVRecord {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string; // YYYY-MM-DD format
  timestamp: number;
  amcCode?: string;
  schemeType?: string;
}

/**
 * Parse AMFI NAV text file
 * Format:
 * Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
 */
export async function parseAMFINavFile(fileContent: string): Promise<NAVRecord[]> {
  const lines = fileContent.split('\n');
  const records: NAVRecord[] = [];
  
  let currentAMC = '';
  let currentSchemeType = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Check if it's an AMC header (doesn't contain semicolons)
    if (!trimmedLine.includes(';')) {
      currentAMC = trimmedLine;
      continue;
    }
    
    // Check if it's a scheme type header (e.g., "Open Ended Schemes(Equity Scheme - Large Cap Fund)")
    if (trimmedLine.toLowerCase().includes('scheme') && !trimmedLine.split(';')[0].match(/^\d+$/)) {
      currentSchemeType = trimmedLine;
      continue;
    }
    
    // Parse NAV data line
    const parts = line.split(';');
    
    // Valid NAV line should have at least 6 parts
    if (parts.length < 6) continue;
    
    const schemeCode = parts[0].trim();
    const schemeName = parts[3].trim();
    const navValue = parts[4].trim();
    const dateStr = parts[5].trim();
    
    // Skip if scheme code is not numeric
    if (!schemeCode || !schemeCode.match(/^\d+$/)) continue;
    
    // Skip if NAV is not available
    if (!navValue || navValue === 'N.A.' || navValue === '-') continue;
    
    // Parse NAV value
    const nav = parseFloat(navValue);
    if (isNaN(nav)) continue;
    
    // Parse date (format: dd-MMM-yyyy, e.g., 15-Nov-2025)
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
  
  return records;
}

/**
 * Parse AMFI date format (dd-MMM-yyyy) to YYYY-MM-DD
 */
function parseAMFIDate(dateStr: string): string | null {
  try {
    // Format: 15-Nov-2025
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
    console.error('Error parsing date:', dateStr, error);
    return null;
  }
}

/**
 * Fetch NAV data from AMFI
 */
export async function fetchAMFINavData(): Promise<NAVRecord[]> {
  try {
    console.log('Fetching NAV data from AMFI...');
    
    const response = await fetch(AMFI_NAV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch AMFI data: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log(`Fetched ${text.length} characters from AMFI`);
    
    const records = await parseAMFINavFile(text);
    console.log(`Parsed ${records.length} NAV records`);
    
    return records;
  } catch (error) {
    console.error('Error fetching AMFI NAV data:', error);
    throw error;
  }
}

/**
 * Save NAV records to DynamoDB in batches
 */
export async function saveNavRecordsToDB(records: NAVRecord[]): Promise<void> {
  console.log(`Saving ${records.length} NAV records to DynamoDB...`);
  
  const batchSize = 25; // DynamoDB batch write limit
  let savedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    try {
      const putRequests = batch.map(record => ({
        PutRequest: {
          Item: {
            schemeCode: record.schemeCode,
            date: record.date,
            nav: record.nav,
            schemeName: record.schemeName,
            timestamp: record.timestamp,
            amcCode: record.amcCode,
            schemeType: record.schemeType,
            updatedAt: new Date().toISOString(),
          },
        },
      }));
      
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [NAV_HISTORY_TABLE]: putRequests,
        },
      }));
      
      savedCount += batch.length;
      
      if (savedCount % 100 === 0) {
        console.log(`Saved ${savedCount}/${records.length} records...`);
      }
    } catch (error) {
      console.error(`Error saving batch ${i}-${i + batchSize}:`, error);
      errorCount += batch.length;
    }
  }
  
  console.log(`✅ Saved ${savedCount} records successfully`);
  if (errorCount > 0) {
    console.log(`⚠️ Failed to save ${errorCount} records`);
  }
}

/**
 * Get NAV history for a specific scheme
 */
export async function getNavHistory(
  schemeCode: string,
  startDate?: string,
  endDate?: string
): Promise<NAVRecord[]> {
  try {
    const params: any = {
      TableName: NAV_HISTORY_TABLE,
      KeyConditionExpression: 'schemeCode = :schemeCode',
      ExpressionAttributeValues: {
        ':schemeCode': schemeCode,
      },
      ScanIndexForward: false, // Sort by date descending
    };
    
    // Add date range filter if provided
    if (startDate && endDate) {
      params.KeyConditionExpression += ' AND #date BETWEEN :startDate AND :endDate';
      params.ExpressionAttributeNames = { '#date': 'date' };
      params.ExpressionAttributeValues[':startDate'] = startDate;
      params.ExpressionAttributeValues[':endDate'] = endDate;
    } else if (startDate) {
      params.KeyConditionExpression += ' AND #date >= :startDate';
      params.ExpressionAttributeNames = { '#date': 'date' };
      params.ExpressionAttributeValues[':startDate'] = startDate;
    } else if (endDate) {
      params.KeyConditionExpression += ' AND #date <= :endDate';
      params.ExpressionAttributeNames = { '#date': 'date' };
      params.ExpressionAttributeValues[':endDate'] = endDate;
    }
    
    const result = await docClient.send(new QueryCommand(params));
    
    return (result.Items || []) as NAVRecord[];
  } catch (error) {
    console.error('Error fetching NAV history:', error);
    throw error;
  }
}

/**
 * Get latest NAV for a scheme
 */
export async function getLatestNav(schemeCode: string): Promise<NAVRecord | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: NAV_HISTORY_TABLE,
      KeyConditionExpression: 'schemeCode = :schemeCode',
      ExpressionAttributeValues: {
        ':schemeCode': schemeCode,
      },
      ScanIndexForward: false,
      Limit: 1,
    }));
    
    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as NAVRecord;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching latest NAV:', error);
    return null;
  }
}

/**
 * Update fund metadata with latest NAV
 */
export async function updateFundMetadata(records: NAVRecord[]): Promise<void> {
  console.log('Updating fund metadata with latest NAVs...');
  
  const batchSize = 25;
  let updatedCount = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    try {
      const putRequests = batch.map(record => ({
        PutRequest: {
          Item: {
            schemeCode: record.schemeCode,
            schemeName: record.schemeName,
            latestNav: record.nav,
            latestNavDate: record.date,
            amcCode: record.amcCode,
            schemeType: record.schemeType,
            lastUpdated: new Date().toISOString(),
          },
        },
      }));
      
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [FUNDS_TABLE]: putRequests,
        },
      }));
      
      updatedCount += batch.length;
      
      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount}/${records.length} funds...`);
      }
    } catch (error) {
      console.error(`Error updating batch ${i}-${i + batchSize}:`, error);
    }
  }
  
  console.log(`✅ Updated ${updatedCount} fund records`);
}

/**
 * Main function to fetch and save NAV data
 */
export async function syncNavData(): Promise<{
  success: boolean;
  recordsProcessed: number;
  error?: string;
}> {
  try {
    console.log('🚀 Starting NAV data sync...');
    const startTime = Date.now();
    
    // Fetch data from AMFI
    const records = await fetchAMFINavData();
    
    if (records.length === 0) {
      throw new Error('No NAV records fetched from AMFI');
    }
    
    // Save to DynamoDB
    await saveNavRecordsToDB(records);
    
    // Update fund metadata
    await updateFundMetadata(records);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ NAV sync completed in ${duration}s`);
    
    return {
      success: true,
      recordsProcessed: records.length,
    };
  } catch (error: any) {
    console.error('❌ NAV sync failed:', error);
    return {
      success: false,
      recordsProcessed: 0,
      error: error.message,
    };
  }
}
