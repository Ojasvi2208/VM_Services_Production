import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// AWS DynamoDB Configuration
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const dynamoDb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'MutualFunds';

interface FundItem {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string | null;
  isinDivReinvestment?: string | null;
  fundHouse: string;
  category: 'equity' | 'debt' | 'hybrid' | 'other';
  subCategory: string;
  planType: 'Regular' | 'Direct';
  optionType: 'Growth' | 'IDCW' | 'Dividend';
  searchTerms: string[];
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const subCategory = searchParams.get('subCategory');
    const search = searchParams.get('search');
    const planType = searchParams.get('planType'); // Regular or Direct
    const optionType = searchParams.get('optionType'); // Growth, IDCW, Dividend
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('Fetching funds with filters:', { category, subCategory, search, planType, optionType, limit, offset });

    let items: FundItem[] = [];
    
    try {
      // If we have specific filters, use scan with filter expressions
      if (category || subCategory || search || planType || optionType) {
        const filterExpressions: string[] = [];
        const expressionAttributeValues: Record<string, string | number> = {};
        const expressionAttributeNames: Record<string, string> = {};

        if (category) {
          filterExpressions.push('#category = :category');
          expressionAttributeNames['#category'] = 'category';
          expressionAttributeValues[':category'] = category;
        }

        if (subCategory) {
          filterExpressions.push('subCategory = :subCategory');
          expressionAttributeValues[':subCategory'] = subCategory;
        }

        if (planType) {
          filterExpressions.push('planType = :planType');
          expressionAttributeValues[':planType'] = planType;
        }

        if (optionType) {
          filterExpressions.push('optionType = :optionType');
          expressionAttributeValues[':optionType'] = optionType;
        }

        if (search) {
          filterExpressions.push('contains(schemeName, :search)');
          expressionAttributeValues[':search'] = search;
        }

        const scanParams = {
          TableName: TABLE_NAME,
          FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(' AND ') : undefined,
          ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
          ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
          Limit: limit
        };

        const result = await dynamoDb.send(new ScanCommand(scanParams));
        items = (result.Items as FundItem[]) || [];

      } else {
        // No filters, get all items with pagination
        const scanParams = {
          TableName: TABLE_NAME,
          Limit: limit
        };

        const result = await dynamoDb.send(new ScanCommand(scanParams));
        items = (result.Items as FundItem[]) || [];
      }

      // Apply client-side pagination if needed
      const paginatedItems = items.slice(offset, offset + limit);

      // Group items by categories for summary
      const categorySummary = items.reduce((acc, item) => {
        const key = item.category;
        if (!acc[key]) acc[key] = {};
        const subKey = item.subCategory;
        acc[key][subKey] = (acc[key][subKey] || 0) + 1;
        return acc;
      }, {} as Record<string, Record<string, number>>);

      return NextResponse.json({
        success: true,
        data: paginatedItems,
        pagination: {
          total: items.length,
          limit,
          offset,
          hasMore: offset + limit < items.length
        },
        categorySummary,
        filters: {
          category,
          subCategory,
          search,
          planType,
          optionType
        },
        timestamp: new Date().toISOString()
      });

    } catch {
      console.log('DynamoDB not available, falling back to JSON file');
      
      // Fallback to reading from JSON file
      const fs = await import('fs');
      const path = await import('path');
      
      const schemaPath = path.join(process.cwd(), 'public', 'Funds_Schema.json');
      const rawData = fs.readFileSync(schemaPath, 'utf8');
      const fundsData = JSON.parse(rawData);
      
      // Apply basic filtering for JSON fallback
      let filteredData = fundsData;
      
      if (search) {
        filteredData = filteredData.filter((fund: FundItem) => 
          fund.schemeName.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (category && category !== 'all') {
        filteredData = filteredData.filter((fund: FundItem) => {
          const name = fund.schemeName.toLowerCase();
          switch (category) {
            case 'equity':
              return name.includes('equity') || name.includes('large') || name.includes('mid') || name.includes('small');
            case 'debt':
              return name.includes('debt') || name.includes('bond') || name.includes('gilt');
            case 'hybrid':
              return name.includes('hybrid') || name.includes('balanced');
            default:
              return true;
          }
        });
      }
      
      // Apply pagination
      const paginatedData = filteredData.slice(offset, offset + limit);
      
      return NextResponse.json({
        success: true,
        data: paginatedData,
        pagination: {
          total: filteredData.length,
          limit,
          offset,
          hasMore: offset + limit < filteredData.length
        },
        source: 'JSON_FALLBACK',
        filters: {
          category,
          subCategory,
          search,
          planType,
          optionType
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch funds data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Handle CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}