import { Pool } from 'pg';
import axios from 'axios';

// Railway production database connection
const RAILWAY_DB_URL = 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

interface MFApiResponse {
  meta: {
    scheme_code: string;
    scheme_name: string;
  };
  data: Array<{
    date: string;
    nav: string;
  }>;
}

async function updateLatestNAV() {
  console.log('🚀 Starting Railway database COMPLETE NAV history update...\n');

  try {
    // Get all funds
    console.log('📊 Fetching all funds from Railway database...');
    const fundsResult = await pool.query('SELECT scheme_code, scheme_name FROM funds ORDER BY scheme_code');
    const funds = fundsResult.rows;
    console.log(`✅ Found ${funds.length} funds\n`);

    let successCount = 0;
    let errorCount = 0;
    let totalNavRecords = 0;

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(funds.length / batchSize)} (${batch.length} funds)...`);

      for (const fund of batch) {
        try {
          // Fetch ALL NAV history from MFApi
          const response = await axios.get<MFApiResponse>(
            `https://api.mfapi.in/mf/${fund.scheme_code}`,
            { timeout: 15000 }
          );

          if (response.data && response.data.data && response.data.data.length > 0) {
            const allNavData = response.data.data;
            const latestNav = allNavData[0];
            
            console.log(`   📈 ${fund.scheme_code}: ${allNavData.length} NAV records (latest: ${latestNav.date})`);

            // Batch insert all NAV records
            let insertedCount = 0;
            const batchInsertSize = 1000;
            
            for (let j = 0; j < allNavData.length; j += batchInsertSize) {
              const navBatch = allNavData.slice(j, j + batchInsertSize);
              
              // Build bulk insert query
              const values: any[] = [];
              const placeholders: string[] = [];
              
              navBatch.forEach((nav, idx) => {
                const navValue = parseFloat(nav.nav);
                const navDate = nav.date;
                const baseIdx = idx * 3;
                placeholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3})`);
                values.push(fund.scheme_code, navDate, navValue);
              });

              // Bulk insert with ON CONFLICT to skip duplicates
              await pool.query(
                `INSERT INTO nav_history (scheme_code, nav_date, nav_value) 
                 VALUES ${placeholders.join(', ')}
                 ON CONFLICT (scheme_code, nav_date) DO NOTHING`,
                values
              );

              insertedCount += navBatch.length;
            }

            // Update fund's latest NAV
            const latestNavValue = parseFloat(latestNav.nav);
            await pool.query(
              `UPDATE funds SET nav = $1, nav_date = $2 WHERE scheme_code = $3`,
              [latestNavValue, latestNav.date, fund.scheme_code]
            );

            successCount++;
            totalNavRecords += allNavData.length;
            
            if (successCount % 10 === 0) {
              console.log(`   ✅ Processed ${successCount} funds, ${totalNavRecords} NAV records...`);
            }
          }

          // Rate limiting - 100ms delay between funds
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          errorCount++;
          if (error.response?.status === 404) {
            console.log(`   ⏭️  ${fund.scheme_code}: Not found in MFApi`);
          } else {
            console.error(`   ❌ Error updating ${fund.scheme_code}: ${error.message}`);
          }
        }
      }
    }

    console.log('\n📊 NAV Update Summary:');
    console.log(`   ✅ Successfully updated: ${successCount} funds`);
    console.log(`   📈 Total NAV records processed: ${totalNavRecords.toLocaleString()}`);
    console.log(`   ❌ Errors: ${errorCount} funds`);

    // Now recalculate returns
    console.log('\n🔄 Recalculating returns...');
    await calculateReturns();

    console.log('\n✨ Railway database update complete!');

  } catch (error) {
    console.error('❌ Error updating Railway database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function calculateReturns() {
  try {
    const fundsResult = await pool.query('SELECT scheme_code FROM funds');
    const funds = fundsResult.rows;

    let successCount = 0;

    for (const fund of funds) {
      try {
        // Get NAV history for calculations
        const navHistory = await pool.query(
          `SELECT nav_date, nav_value 
           FROM nav_history 
           WHERE scheme_code = $1 
           ORDER BY nav_date DESC 
           LIMIT 400`,
          [fund.scheme_code]
        );

        if (navHistory.rows.length < 2) continue;

        const navs = navHistory.rows;
        const latestNav = navs[0].nav_value;

        // Calculate returns
        const returns: any = {};

        // Helper function to find NAV closest to target date
        const findNavByDate = (daysAgo: number) => {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() - daysAgo);
          
          let closestNav = null;
          let minDiff = Infinity;
          
          for (const nav of navs) {
            const navDate = new Date(nav.nav_date);
            const diff = Math.abs(navDate.getTime() - targetDate.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closestNav = nav.nav_value;
            }
          }
          return closestNav;
        };

        // Calculate returns for different periods
        const periods = [
          { days: 7, key: 'return_1w' },
          { days: 30, key: 'return_1m' },
          { days: 90, key: 'return_3m' },
          { days: 180, key: 'return_6m' },
          { days: 365, key: 'return_1y' },
          { days: 1095, key: 'return_3y' },
          { days: 1825, key: 'return_5y' }
        ];

        for (const period of periods) {
          const oldNav = findNavByDate(period.days);
          if (oldNav) {
            returns[period.key] = ((latestNav - oldNav) / oldNav) * 100;
          }
        }

        // Calculate CAGR
        if (returns.return_1y) {
          returns.cagr_1y = returns.return_1y;
        }
        if (returns.return_3y) {
          returns.cagr_3y = Math.pow(1 + returns.return_3y / 100, 1 / 3) * 100 - 100;
        }
        if (returns.return_5y) {
          returns.cagr_5y = Math.pow(1 + returns.return_5y / 100, 1 / 5) * 100 - 100;
        }

        // Insert or update returns
        await pool.query(
          `INSERT INTO fund_returns (
            scheme_code, return_1w, return_1m, return_3m, return_6m, return_1y, 
            return_3y, return_5y, cagr_1y, cagr_3y, cagr_5y
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (scheme_code) DO UPDATE SET
            return_1w = $2, return_1m = $3, return_3m = $4, return_6m = $5,
            return_1y = $6, return_3y = $7, return_5y = $8,
            cagr_1y = $9, cagr_3y = $10, cagr_5y = $11`,
          [
            fund.scheme_code,
            returns.return_1w || null,
            returns.return_1m || null,
            returns.return_3m || null,
            returns.return_6m || null,
            returns.return_1y || null,
            returns.return_3y || null,
            returns.return_5y || null,
            returns.cagr_1y || null,
            returns.cagr_3y || null,
            returns.cagr_5y || null
          ]
        );

        successCount++;
        if (successCount % 500 === 0) {
          console.log(`   ✅ Calculated returns for ${successCount} funds...`);
        }

      } catch (error) {
        // Skip errors for individual funds
      }
    }

    console.log(`✅ Returns calculated for ${successCount} funds`);

  } catch (error) {
    console.error('❌ Error calculating returns:', error);
    throw error;
  }
}

// Run the update
updateLatestNAV().catch(console.error);
