import pool from '@/lib/postgres-db';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface MFApiResponse {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
  };
  data: any[];
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFundCategory(schemeCode: string): Promise<{
  fundHouse: string;
  schemeType: string;
  schemeCategory: string;
} | null> {
  try {
    const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data: MFApiResponse = await response.json();
    
    if (data.meta) {
      return {
        fundHouse: data.meta.fund_house || '',
        schemeType: data.meta.scheme_type || '',
        schemeCategory: data.meta.scheme_category || ''
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching ${schemeCode}:`, error);
    return null;
  }
}

function extractMainCategory(schemeCategory: string): string {
  if (!schemeCategory) return 'Other';
  
  const category = schemeCategory.toLowerCase();
  
  // Equity categories
  if (category.includes('equity')) {
    if (category.includes('large cap')) return 'Equity - Large Cap';
    if (category.includes('mid cap')) return 'Equity - Mid Cap';
    if (category.includes('small cap')) return 'Equity - Small Cap';
    if (category.includes('multi cap') || category.includes('flexi cap')) return 'Equity - Multi Cap';
    if (category.includes('elss') || category.includes('tax')) return 'Equity - ELSS';
    if (category.includes('sectoral') || category.includes('thematic')) return 'Equity - Sectoral/Thematic';
    if (category.includes('value')) return 'Equity - Value';
    if (category.includes('dividend')) return 'Equity - Dividend Yield';
    if (category.includes('contra')) return 'Equity - Contra';
    if (category.includes('focused')) return 'Equity - Focused';
    return 'Equity - Other';
  }
  
  // Debt categories
  if (category.includes('debt')) {
    if (category.includes('liquid')) return 'Debt - Liquid';
    if (category.includes('overnight')) return 'Debt - Overnight';
    if (category.includes('ultra short')) return 'Debt - Ultra Short Duration';
    if (category.includes('low duration')) return 'Debt - Low Duration';
    if (category.includes('money market')) return 'Debt - Money Market';
    if (category.includes('short duration')) return 'Debt - Short Duration';
    if (category.includes('medium duration')) return 'Debt - Medium Duration';
    if (category.includes('medium to long')) return 'Debt - Medium to Long Duration';
    if (category.includes('long duration')) return 'Debt - Long Duration';
    if (category.includes('dynamic bond')) return 'Debt - Dynamic Bond';
    if (category.includes('corporate bond')) return 'Debt - Corporate Bond';
    if (category.includes('credit risk')) return 'Debt - Credit Risk';
    if (category.includes('banking') || category.includes('psu')) return 'Debt - Banking & PSU';
    if (category.includes('gilt')) return 'Debt - Gilt';
    if (category.includes('floater')) return 'Debt - Floater';
    return 'Debt - Other';
  }
  
  // Hybrid categories
  if (category.includes('hybrid')) {
    if (category.includes('aggressive')) return 'Hybrid - Aggressive';
    if (category.includes('conservative')) return 'Hybrid - Conservative';
    if (category.includes('balanced')) return 'Hybrid - Balanced';
    if (category.includes('arbitrage')) return 'Hybrid - Arbitrage';
    if (category.includes('equity savings')) return 'Hybrid - Equity Savings';
    if (category.includes('multi asset')) return 'Hybrid - Multi Asset Allocation';
    return 'Hybrid - Other';
  }
  
  // Solution Oriented
  if (category.includes('retirement') || category.includes('children')) {
    return 'Solution Oriented';
  }
  
  // Index Funds
  if (category.includes('index')) {
    return 'Index Funds';
  }
  
  // ETF
  if (category.includes('etf') || category.includes('exchange traded')) {
    return 'ETF';
  }
  
  // FoF
  if (category.includes('fund of funds') || category.includes('fof')) {
    return 'Fund of Funds';
  }
  
  return 'Other';
}

function extractSubCategory(schemeCategory: string): string {
  if (!schemeCategory) return '';
  
  // Return the full scheme category as sub-category
  // This preserves the detailed classification from MFApi
  return schemeCategory;
}

async function updateFundCategories() {
  console.log('🔍 Fetching categories from MFApi...\n');
  console.log('═'.repeat(80));
  
  try {
    // Get all funds
    const fundsResult = await pool.query(
      'SELECT scheme_code FROM funds ORDER BY scheme_code'
    );
    
    const totalFunds = fundsResult.rows.length;
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    
    console.log(`\n📊 Total funds to process: ${totalFunds.toLocaleString()}\n`);
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    const delayBetweenRequests = 200; // 200ms delay between requests
    const delayBetweenBatches = 2000; // 2 second delay between batches
    
    for (let i = 0; i < fundsResult.rows.length; i += batchSize) {
      const batch = fundsResult.rows.slice(i, i + batchSize);
      
      // Process batch in parallel
      const promises = batch.map(async (fund) => {
        await sleep(Math.random() * delayBetweenRequests); // Stagger requests
        
        const categoryData = await fetchFundCategory(fund.scheme_code);
        processed++;
        
        if (categoryData) {
          const mainCategory = extractMainCategory(categoryData.schemeCategory);
          const subCategory = extractSubCategory(categoryData.schemeCategory);
          
          try {
            await pool.query(
              `UPDATE funds 
               SET category = $1,
                   sub_category = $2,
                   scheme_type = $3,
                   amc_code = $4,
                   updated_at = NOW()
               WHERE scheme_code = $5`,
              [mainCategory, subCategory, categoryData.schemeType, categoryData.fundHouse, fund.scheme_code]
            );
            successful++;
          } catch (error) {
            console.error(`Failed to update ${fund.scheme_code}:`, error);
            failed++;
          }
        } else {
          failed++;
        }
        
        // Progress update every 100 funds
        if (processed % 100 === 0) {
          const percentage = ((processed / totalFunds) * 100).toFixed(1);
          console.log(`📈 Progress: ${processed}/${totalFunds} (${percentage}%) | Success: ${successful} | Failed: ${failed}`);
        }
      });
      
      await Promise.all(promises);
      
      // Delay between batches
      if (i + batchSize < fundsResult.rows.length) {
        await sleep(delayBetweenBatches);
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n🎉 Category Update Complete!\n');
    console.log(`✅ Successful: ${successful.toLocaleString()}`);
    console.log(`❌ Failed: ${failed.toLocaleString()}`);
    console.log(`⏭️  Skipped: ${skipped.toLocaleString()}`);
    console.log(`📊 Success Rate: ${((successful / totalFunds) * 100).toFixed(1)}%`);
    
    // Show category distribution
    console.log('\n📊 Category Distribution:\n');
    const categoryStats = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM funds
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `);
    
    categoryStats.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} funds`);
    });
    
    console.log('\n✅ Categories updated successfully!');
    console.log('🎯 You can now filter funds by category in the UI!');
    
  } catch (error) {
    console.error('\n❌ Update failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateFundCategories().catch(console.error);
