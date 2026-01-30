/**
 * Calculate Returns for All Funds - V2
 * Matches existing fund_returns schema
 */

import pool from '@/lib/postgres-db';

// Calculate absolute return
function calculateAbsoluteReturn(startNav: number, endNav: number): number {
  return ((endNav - startNav) / startNav) * 100;
}

// Calculate CAGR
function calculateCAGR(startNav: number, endNav: number, years: number): number {
  return (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
}

// Get NAV for a specific date (or closest before)
async function getNAVForDate(schemeCode: string, targetDate: Date): Promise<number | null> {
  const result = await pool.query(
    `SELECT nav_value 
     FROM nav_history 
     WHERE scheme_code = $1 
       AND nav_date <= $2 
     ORDER BY nav_date DESC 
     LIMIT 1`,
    [schemeCode, targetDate]
  );
  
  return result.rows[0]?.nav_value || null;
}

// Calculate returns for a single fund
async function calculateFundReturns(schemeCode: string, latestNav: number, latestDate: Date) {
  const returns: any = {
    scheme_code: schemeCode,
    calculated_date: latestDate,
  };
  
  // 1 Week
  const date1w = new Date(latestDate);
  date1w.setDate(date1w.getDate() - 7);
  const nav1w = await getNAVForDate(schemeCode, date1w);
  if (nav1w) returns.return_1w = calculateAbsoluteReturn(nav1w, latestNav);
  
  // 1 Month
  const date1m = new Date(latestDate);
  date1m.setMonth(date1m.getMonth() - 1);
  const nav1m = await getNAVForDate(schemeCode, date1m);
  if (nav1m) returns.return_1m = calculateAbsoluteReturn(nav1m, latestNav);
  
  // 3 Months
  const date3m = new Date(latestDate);
  date3m.setMonth(date3m.getMonth() - 3);
  const nav3m = await getNAVForDate(schemeCode, date3m);
  if (nav3m) returns.return_3m = calculateAbsoluteReturn(nav3m, latestNav);
  
  // 6 Months
  const date6m = new Date(latestDate);
  date6m.setMonth(date6m.getMonth() - 6);
  const nav6m = await getNAVForDate(schemeCode, date6m);
  if (nav6m) returns.return_6m = calculateAbsoluteReturn(nav6m, latestNav);
  
  // 1 Year
  const date1y = new Date(latestDate);
  date1y.setFullYear(date1y.getFullYear() - 1);
  const nav1y = await getNAVForDate(schemeCode, date1y);
  if (nav1y) {
    returns.return_1y = calculateAbsoluteReturn(nav1y, latestNav);
    returns.cagr_1y = calculateCAGR(nav1y, latestNav, 1);
  }
  
  // 2 Years
  const date2y = new Date(latestDate);
  date2y.setFullYear(date2y.getFullYear() - 2);
  const nav2y = await getNAVForDate(schemeCode, date2y);
  if (nav2y) {
    returns.return_2y = calculateAbsoluteReturn(nav2y, latestNav);
    returns.cagr_2y = calculateCAGR(nav2y, latestNav, 2);
  }
  
  // 3 Years
  const date3y = new Date(latestDate);
  date3y.setFullYear(date3y.getFullYear() - 3);
  const nav3y = await getNAVForDate(schemeCode, date3y);
  if (nav3y) {
    returns.return_3y = calculateAbsoluteReturn(nav3y, latestNav);
    returns.cagr_3y = calculateCAGR(nav3y, latestNav, 3);
  }
  
  // 5 Years
  const date5y = new Date(latestDate);
  date5y.setFullYear(date5y.getFullYear() - 5);
  const nav5y = await getNAVForDate(schemeCode, date5y);
  if (nav5y) {
    returns.return_5y = calculateAbsoluteReturn(nav5y, latestNav);
    returns.cagr_5y = calculateCAGR(nav5y, latestNav, 5);
  }
  
  // 7 Years
  const date7y = new Date(latestDate);
  date7y.setFullYear(date7y.getFullYear() - 7);
  const nav7y = await getNAVForDate(schemeCode, date7y);
  if (nav7y) {
    returns.return_7y = calculateAbsoluteReturn(nav7y, latestNav);
    returns.cagr_7y = calculateCAGR(nav7y, latestNav, 7);
  }
  
  // 10 Years
  const date10y = new Date(latestDate);
  date10y.setFullYear(date10y.getFullYear() - 10);
  const nav10y = await getNAVForDate(schemeCode, date10y);
  if (nav10y) {
    returns.return_10y = calculateAbsoluteReturn(nav10y, latestNav);
    returns.cagr_10y = calculateCAGR(nav10y, latestNav, 10);
  }
  
  // Since Inception
  const inceptionResult = await pool.query(
    `SELECT nav_value, nav_date 
     FROM nav_history 
     WHERE scheme_code = $1 
     ORDER BY nav_date ASC 
     LIMIT 1`,
    [schemeCode]
  );
  
  if (inceptionResult.rows[0]) {
    const inceptionNav = parseFloat(inceptionResult.rows[0].nav_value);
    const inceptionDate = new Date(inceptionResult.rows[0].nav_date);
    const daysSinceInception = Math.floor((latestDate.getTime() - inceptionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceInception > 0) {
      returns.return_since_inception = calculateAbsoluteReturn(inceptionNav, latestNav);
      if (daysSinceInception >= 365) {
        returns.cagr_since_inception = calculateCAGR(inceptionNav, latestNav, daysSinceInception / 365);
      }
    }
  }
  
  return returns;
}

// Save returns to database
async function saveReturns(returns: any) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete existing returns for this date
    await client.query(
      'DELETE FROM fund_returns WHERE scheme_code = $1 AND calculated_date = $2',
      [returns.scheme_code, returns.calculated_date]
    );
    
    // Build insert query dynamically
    const columns = Object.keys(returns).filter(k => returns[k] !== undefined);
    const values = columns.map(k => returns[k]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO fund_returns (${columns.join(', ')})
      VALUES (${placeholders})
    `;
    
    await client.query(query, values);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Calculate returns for all funds
export async function calculateAllReturns() {
  console.log('🚀 Calculating returns for all funds...\n');
  
  // Get all funds with latest NAV
  const fundsResult = await pool.query(
    `SELECT scheme_code, latest_nav, latest_nav_date 
     FROM funds 
     WHERE latest_nav IS NOT NULL 
       AND latest_nav_date IS NOT NULL
     ORDER BY scheme_code`
  );
  
  const totalFunds = fundsResult.rows.length;
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  console.log(`📊 Total funds to process: ${totalFunds.toLocaleString()}\n`);
  
  for (const fund of fundsResult.rows) {
    processed++;
    
    try {
      const latestNav = parseFloat(fund.latest_nav);
      const latestDate = new Date(fund.latest_nav_date);
      
      const returns = await calculateFundReturns(fund.scheme_code, latestNav, latestDate);
      
      // Only save if we have at least some returns
      const hasReturns = Object.keys(returns).some(k => 
        k.startsWith('return_') && returns[k] !== undefined
      );
      
      if (hasReturns) {
        await saveReturns(returns);
        successful++;
      }
      
      // Progress indicator
      if (processed % 100 === 0) {
        const progress = ((processed / totalFunds) * 100).toFixed(1);
        process.stdout.write(`\r📈 Progress: ${processed}/${totalFunds} (${progress}%) | Success: ${successful} | Failed: ${failed}`);
      }
      
    } catch (error: any) {
      failed++;
      if (failed <= 5) {
        console.error(`\n❌ Error for ${fund.scheme_code}:`, error.message);
      }
    }
  }
  
  console.log(`\n\n🎉 Returns Calculation Complete!`);
  console.log(`✅ Successful: ${successful.toLocaleString()}`);
  console.log(`❌ Failed: ${failed.toLocaleString()}`);
  console.log(`📊 Success Rate: ${((successful / totalFunds) * 100).toFixed(1)}%`);
  
  return { totalFunds, successful, failed };
}

// Run if called directly
if (require.main === module) {
  calculateAllReturns()
    .then(() => {
      console.log('\n✅ All returns calculated successfully!');
      console.log('🎯 You can now view returns in the UI!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Calculation failed:', error);
      process.exit(1);
    });
}
