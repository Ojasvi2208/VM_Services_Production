/**
 * Simple Fund Count API - Test version
 */

import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

interface FundSchemaRecord {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string;
  isinDivReinvestment?: string;
}

export async function GET() {
  try {
    console.log('🚀 Fund count API starting...');
    
    // Load funds data
    const schemaPath = join(process.cwd(), 'public', 'Funds_Schema.json');
    console.log('📂 Loading funds from:', schemaPath);
    
    const schemaData = readFileSync(schemaPath, 'utf-8');
    const funds: FundSchemaRecord[] = JSON.parse(schemaData);
    
    console.log(`📊 Loaded ${funds.length} funds`);
    
    // Basic categorization by scheme name
    const categories = {
      equity: 0,
      debt: 0,
      hybrid: 0,
      others: 0,
      direct: 0,
      regular: 0
    };
    
    const amcCounts: Record<string, number> = {};
    
    funds.forEach(fund => {
      const name = fund.schemeName.toLowerCase();
      
      // Basic categorization
      if (name.includes('equity') || name.includes('growth') || name.includes('cap')) {
        categories.equity++;
      } else if (name.includes('debt') || name.includes('income') || name.includes('bond')) {
        categories.debt++;
      } else if (name.includes('hybrid') || name.includes('balanced')) {
        categories.hybrid++;
      } else {
        categories.others++;
      }
      
      // Plan type
      if (name.includes('direct')) {
        categories.direct++;
      } else {
        categories.regular++;
      }
      
      // AMC counting (basic)
      let amc = 'Others';
      if (name.includes('sbi')) amc = 'SBI Mutual Fund';
      else if (name.includes('hdfc')) amc = 'HDFC Mutual Fund';
      else if (name.includes('icici')) amc = 'ICICI Prudential Mutual Fund';
      else if (name.includes('axis')) amc = 'Axis Mutual Fund';
      else if (name.includes('kotak')) amc = 'Kotak Mahindra Mutual Fund';
      
      amcCounts[amc] = (amcCounts[amc] || 0) + 1;
    });
    
    const result = {
      success: true,
      data: {
        totalFunds: funds.length,
        expectedFunds: 37141,
        dataCompleteness: ((funds.length / 37141) * 100).toFixed(2) + '%',
        basicCategories: categories,
        topAMCs: Object.entries(amcCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}),
        sampleFunds: funds.slice(0, 5).map(f => ({
          schemeCode: f.schemeCode,
          schemeName: f.schemeName.substring(0, 50) + '...'
        }))
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Fund analysis complete');
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Fund count API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Fund count failed',
      details: String(error)
    }, { status: 500 });
  }
}