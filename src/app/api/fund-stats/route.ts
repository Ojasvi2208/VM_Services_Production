/**
 * Lightweight Fund Statistics API
 * Provides basic fund counts without loading entire dataset into memory
 */

import { NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { join } from 'path';

interface FundStats {
  totalFunds: number;
  categories: Record<string, number>;
  fundHouses: Record<string, number>;
  plans: Record<string, number>;
  sampleFunds: Array<{
    schemeCode: number;
    schemeName: string;
    detectedCategory: string;
    detectedFundHouse: string;
  }>;
}

export async function GET() {
  try {
    console.log('📊 Starting lightweight fund statistics...');
    
    const stats: FundStats = {
      totalFunds: 0,
      categories: {},
      fundHouses: {},
      plans: { Direct: 0, Regular: 0 },
      sampleFunds: []
    };
    
    const filePath = join(process.cwd(), 'public', 'Funds_Schema.json');
    
    return new Promise<NextResponse>((resolve, reject) => {
      let buffer = '';
      let fundCount = 0;
      let inArray = false;
      let braceCount = 0;
      
      const stream = createReadStream(filePath, { 
        encoding: 'utf8', 
        highWaterMark: 32 * 1024 // 32KB chunks for memory efficiency
      });
      
      stream.on('data', (chunk: string | Buffer) => {
        buffer += chunk.toString();
        
        // Process complete JSON objects in streaming fashion
        while (buffer.length > 0) {
          if (!inArray && buffer.includes('[')) {
            buffer = buffer.substring(buffer.indexOf('[') + 1);
            inArray = true;
            continue;
          }
          
          if (inArray) {
            const openBrace = buffer.indexOf('{');
            if (openBrace === -1) break;
            
            const start = openBrace;
            braceCount = 0;
            let end = start;
            
            // Find complete JSON object
            for (let i = start; i < buffer.length; i++) {
              if (buffer[i] === '{') braceCount++;
              else if (buffer[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  end = i + 1;
                  break;
                }
              }
            }
            
            if (braceCount === 0) {
              const jsonStr = buffer.substring(start, end);
              buffer = buffer.substring(end);
              
              try {
                const fund = JSON.parse(jsonStr);
                processFundForStats(fund, stats);
                fundCount++;
                
                // Log progress every 10000 funds
                if (fundCount % 10000 === 0) {
                  console.log(`📈 Processed ${fundCount} funds...`);
                }
                
                // Early exit if we just need a count estimate (for very large files)
                if (fundCount >= 50000) {
                  console.log('🛑 Reached processing limit for statistics');
                  break;
                }
              } catch {
                // Skip invalid JSON objects
                console.warn('⚠️ Skipping invalid fund record');
              }
            } else {
              break; // Wait for more data
            }
          }
        }
      });
      
      stream.on('end', () => {
        stats.totalFunds = fundCount;
        
        console.log(`✅ Statistics complete! Processed ${fundCount} funds`);
        console.log(`📂 Categories found: ${Object.keys(stats.categories).length}`);
        console.log(`🏢 Fund houses found: ${Object.keys(stats.fundHouses).length}`);
        
        resolve(NextResponse.json({
          success: true,
          data: stats,
          meta: {
            processingTime: new Date().toISOString(),
            memoryEfficient: true,
            streamProcessed: true,
            dataSource: 'Funds_Schema.json'
          },
          timestamp: new Date().toISOString()
        }));
      });
      
      stream.on('error', (error) => {
        console.error('❌ Stream error:', error);
        reject(NextResponse.json({
          success: false,
          error: 'Failed to process fund data',
          details: String(error)
        }, { status: 500 }));
      });
    });
    
  } catch (error) {
    console.error('❌ Fund statistics API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Statistics service unavailable',
      details: String(error)
    }, { status: 500 });
  }
}

function processFundForStats(fund: { schemeCode?: number; schemeName?: string }, stats: FundStats): void {
  if (!fund.schemeCode || !fund.schemeName) return;
  
  const name = fund.schemeName.toLowerCase();
  
  // Detect category
  let category = 'Others';
  if (name.includes('equity') || name.includes('cap') || name.includes('growth')) {
    category = 'Equity';
  } else if (name.includes('debt') || name.includes('income') || name.includes('bond')) {
    category = 'Debt';
  } else if (name.includes('hybrid') || name.includes('balanced')) {
    category = 'Hybrid';
  } else if (name.includes('index') || name.includes('etf')) {
    category = 'Index/ETF';
  }
  
  stats.categories[category] = (stats.categories[category] || 0) + 1;
  
  // Detect fund house
  let fundHouse = 'Others';
  if (name.includes('sbi')) fundHouse = 'SBI';
  else if (name.includes('hdfc')) fundHouse = 'HDFC';
  else if (name.includes('icici')) fundHouse = 'ICICI Prudential';
  else if (name.includes('axis')) fundHouse = 'Axis';
  else if (name.includes('kotak')) fundHouse = 'Kotak Mahindra';
  else if (name.includes('aditya birla') || name.includes('birla')) fundHouse = 'Aditya Birla Sun Life';
  else if (name.includes('nippon')) fundHouse = 'Nippon India';
  else if (name.includes('franklin')) fundHouse = 'Franklin Templeton';
  else if (name.includes('dsp')) fundHouse = 'DSP';
  else if (name.includes('mirae')) fundHouse = 'Mirae Asset';
  
  stats.fundHouses[fundHouse] = (stats.fundHouses[fundHouse] || 0) + 1;
  
  // Detect plan
  const plan = name.includes('direct') ? 'Direct' : 'Regular';
  stats.plans[plan]++;
  
  // Add to sample funds (first 10)
  if (stats.sampleFunds.length < 10) {
    stats.sampleFunds.push({
      schemeCode: fund.schemeCode,
      schemeName: fund.schemeName.substring(0, 50) + (fund.schemeName.length > 50 ? '...' : ''),
      detectedCategory: category,
      detectedFundHouse: fundHouse
    });
  }
}