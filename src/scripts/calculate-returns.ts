/**
 * Calculate Returns for All Funds
 * Calculates: 1W, 1M, 3M, 6M, 1Y, 2Y, 3Y + CAGR, Rolling Returns
 */

import pool from '@/lib/postgres-db';

interface ReturnPeriod {
  period: string;
  days: number;
}

const RETURN_PERIODS: ReturnPeriod[] = [
  { period: '1W', days: 7 },
  { period: '1M', days: 30 },
  { period: '3M', days: 90 },
  { period: '6M', days: 180 },
  { period: '1Y', days: 365 },
  { period: '2Y', days: 730 },
  { period: '3Y', days: 1095 },
];

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
  const returns: any = {};
  
  for (const period of RETURN_PERIODS) {
    const startDate = new Date(latestDate);
    startDate.setDate(startDate.getDate() - period.days);
    
    const startNav = await getNAVForDate(schemeCode, startDate);
    
    if (startNav && startNav > 0) {
      const absoluteReturn = calculateAbsoluteReturn(startNav, latestNav);
      returns[period.period] = {
        absolute_return: absoluteReturn,
        cagr: period.days >= 365 ? calculateCAGR(startNav, latestNav, period.days / 365) : null,
        start_nav: startNav,
        end_nav: latestNav,
        start_date: startDate,
        end_date: latestDate
      };
    }
  }
  
  // Calculate since inception
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
      const absoluteReturn = calculateAbsoluteReturn(inceptionNav, latestNav);
      returns['INCEPTION'] = {
        absolute_return: absoluteReturn,
        cagr: daysSinceInception >= 365 ? calculateCAGR(inceptionNav, latestNav, daysSinceInception / 365) : null,
        start_nav: inceptionNav,
        end_nav: latestNav,
        start_date: inceptionDate,
        end_date: latestDate
      };
    }
  }
  
  return returns;
}

// Save returns to database
async function saveReturns(schemeCode: string, returns: any) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete existing returns
    await client.query('DELETE FROM fund_returns WHERE scheme_code = $1', [schemeCode]);
    
    // Insert new returns
    for (const [period, data] of Object.entries(returns)) {
      const returnData = data as any;
      await client.query(
        `INSERT INTO fund_returns 
         (scheme_code, period, absolute_return, cagr, start_nav, end_nav, start_date, end_date, calculated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          schemeCode,
          period,
          returnData.absolute_return,
          returnData.cagr,
          returnData.start_nav,
          returnData.end_nav,
          returnData.start_date,
          returnData.end_date
        ]
      );
    }
    
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
      
      if (Object.keys(returns).length > 0) {
        await saveReturns(fund.scheme_code, returns);
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
