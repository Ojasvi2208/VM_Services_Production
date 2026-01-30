import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand, 
  ScanCommand,
  BatchWriteCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

// DynamoDB Configuration
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  }
});

export const docClient = DynamoDBDocumentClient.from(client);

// Table Names
export const TABLES = {
  FUNDS: "vijaymalik-funds",
  NAV_HISTORY: "vijaymalik-nav-history",
  NAV_CACHE: "vijaymalik-nav-cache"
} as const;

// Fund Data Interface
export interface FundRecord {
  schemeCode: string;
  schemeName: string;
  category: string;
  subCategory: string;
  fundHouse: string;
  isinGrowth?: string;
  isinDivReinvestment?: string;
  lastUpdated: string;
}

// NAV Data Interface
export interface NAVRecord {
  schemeCode: string;
  date: string; // YYYY-MM-DD format
  nav: number;
  lastFetched: string;
}

// NAV Cache Interface
export interface NAVCacheRecord {
  schemeCode: string;
  nav: number;
  date: string;
  lastFetched: string;
  ttl: number; // TTL for automatic cleanup
}

// DynamoDB Operations Class
export class DynamoDBService {
  
  // Fund Operations
  async insertFund(fund: FundRecord): Promise<boolean> {
    try {
      await docClient.send(new PutCommand({
        TableName: TABLES.FUNDS,
        Item: fund
      }));
      return true;
    } catch (error) {
      console.error('Error inserting fund:', error);
      return false;
    }
  }

  async batchInsertFunds(funds: FundRecord[]): Promise<number> {
    let successCount = 0;
    const batchSize = 25; // DynamoDB batch limit

    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      
      try {
        const putRequests = batch.map(fund => ({
          PutRequest: { Item: fund }
        }));

        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [TABLES.FUNDS]: putRequests
          }
        }));

        successCount += batch.length;
        console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}, total: ${successCount}`);
      } catch (error) {
        console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
      }
    }

    return successCount;
  }

  async getFund(schemeCode: string): Promise<FundRecord | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLES.FUNDS,
        Key: { schemeCode }
      }));
      return result.Item as FundRecord || null;
    } catch (error) {
      console.error('Error getting fund:', error);
      return null;
    }
  }

  async queryFundsByCategory(
    filters: { 
      category: string; 
      subCategory?: string; 
      searchTerm?: string 
    }, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<{ funds: FundRecord[]; total: number; hasMore: boolean }> {
    try {
      const scanParams: any = {
        TableName: TABLES.FUNDS,
        FilterExpression: 'category = :category',
        ExpressionAttributeValues: {
          ':category': filters.category
        },
        Limit: limit
      };

      if (filters.subCategory) {
        scanParams.FilterExpression += ' AND subCategory = :subCategory';
        scanParams.ExpressionAttributeValues[':subCategory'] = filters.subCategory;
      }

      if (filters.searchTerm) {
        scanParams.FilterExpression += ' AND contains(schemeName, :searchTerm)';
        scanParams.ExpressionAttributeValues[':searchTerm'] = filters.searchTerm;
      }

      const result = await docClient.send(new ScanCommand(scanParams));
      const funds = result.Items as FundRecord[] || [];
      
      return {
        funds: funds.slice(offset, offset + limit),
        total: funds.length,
        hasMore: funds.length > offset + limit
      };
    } catch (error) {
      console.error('Error querying funds by category:', error);
      return { funds: [], total: 0, hasMore: false };
    }
  }

  async getRandomFunds(count: number): Promise<FundRecord[]> {
    try {
      const result = await docClient.send(new ScanCommand({
        TableName: TABLES.FUNDS,
        Limit: count * 3 // Get more to randomize
      }));
      
      const funds = result.Items as FundRecord[] || [];
      return funds.sort(() => Math.random() - 0.5).slice(0, count);
    } catch (error) {
      console.error('Error getting random funds:', error);
      return [];
    }
  }

  async searchFundsByName(searchTerm: string, limit: number = 20): Promise<FundRecord[]> {
    try {
      const result = await docClient.send(new ScanCommand({
        TableName: TABLES.FUNDS,
        FilterExpression: 'contains(schemeName, :searchTerm)',
        ExpressionAttributeValues: {
          ':searchTerm': searchTerm
        },
        Limit: limit
      }));
      
      return result.Items as FundRecord[] || [];
    } catch (error) {
      console.error('Error searching funds by name:', error);
      return [];
    }
  }

  // NAV Operations
  async updateNAV(schemeCode: string, nav: number, date: string): Promise<boolean> {
    try {
      const navRecord: NAVRecord = {
        schemeCode,
        nav,
        date,
        lastFetched: new Date().toISOString()
      };

      // Update NAV history
      await docClient.send(new PutCommand({
        TableName: TABLES.NAV_HISTORY,
        Item: navRecord
      }));

      // Update cache
      const cacheRecord: NAVCacheRecord = {
        schemeCode,
        nav,
        date,
        lastFetched: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
      };

      await docClient.send(new PutCommand({
        TableName: TABLES.NAV_CACHE,
        Item: cacheRecord
      }));

      return true;
    } catch (error) {
      console.error('Error updating NAV:', error);
      return false;
    }
  }

  async getNAVRecord(schemeCode: string): Promise<NAVCacheRecord | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLES.NAV_CACHE,
        Key: { schemeCode }
      }));
      return result.Item as NAVCacheRecord || null;
    } catch (error) {
      console.error('Error getting NAV record:', error);
      return null;
    }
  }

  async getNAVHistory(schemeCode: string, limit: number = 30): Promise<NAVRecord[]> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLES.NAV_HISTORY,
        KeyConditionExpression: 'schemeCode = :schemeCode',
        ExpressionAttributeValues: {
          ':schemeCode': schemeCode
        },
        ScanIndexForward: false, // Latest first
        Limit: limit
      }));
      return result.Items as NAVRecord[] || [];
    } catch (error) {
      console.error('Error getting NAV history:', error);
      return [];
    }
  }

  async getFundCategorySummary(): Promise<Record<string, { count: number; subCategories: Record<string, number> }>> {
    try {
      const result = await docClient.send(new ScanCommand({
        TableName: TABLES.FUNDS,
        ProjectionExpression: 'category, subCategory'
      }));

      const summary: Record<string, { count: number; subCategories: Record<string, number> }> = {};
      
      for (const item of result.Items || []) {
        const category = item.category as string;
        const subCategory = item.subCategory as string;
        
        if (!summary[category]) {
          summary[category] = { count: 0, subCategories: {} };
        }
        
        summary[category].count++;
        summary[category].subCategories[subCategory] = (summary[category].subCategories[subCategory] || 0) + 1;
      }

      return summary;
    } catch (error) {
      console.error('Error getting category summary:', error);
      return {};
    }
  }

  // Static methods for table creation
  static async createTables() {
    try {
      const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');
      
      // Funds Table
      await client.send(new CreateTableCommand({
        TableName: TABLES.FUNDS,
        KeySchema: [
          { AttributeName: 'schemeCode', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'schemeCode', AttributeType: 'S' },
          { AttributeName: 'category', AttributeType: 'S' },
          { AttributeName: 'subCategory', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        GlobalSecondaryIndexes: [
          {
            IndexName: 'CategoryIndex',
            KeySchema: [
              { AttributeName: 'category', KeyType: 'HASH' },
              { AttributeName: 'subCategory', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' }
          }
        ]
      }));

      // NAV History Table
      await client.send(new CreateTableCommand({
        TableName: TABLES.NAV_HISTORY,
        KeySchema: [
          { AttributeName: 'schemeCode', KeyType: 'HASH' },
          { AttributeName: 'date', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'schemeCode', AttributeType: 'S' },
          { AttributeName: 'date', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      }));

      // NAV Cache Table
      await client.send(new CreateTableCommand({
        TableName: TABLES.NAV_CACHE,
        KeySchema: [
          { AttributeName: 'schemeCode', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'schemeCode', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      }));

      console.log('All tables created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }
}