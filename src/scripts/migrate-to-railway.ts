import { Pool } from 'pg';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Local database
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Railway database
const RAILWAY_DB_URL = 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';
const railwayPool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false }
});

interface MFApiResponse {
  meta: { scheme_code: string; scheme_name: string; };
  data: Array<{ date: string; nav: string; }>;
}

async function migrateToRailway() {
  console.log('🚀 Starting complete migration to Railway...\n');

  try {
    // Step 1: Copy funds from local to Railway
    console.log('📊 Step 1: Migrating funds table...');
    const fundsResult = await localPool.query('SELECT * FROM funds ORDER BY scheme_code');
    const funds = fundsResult.rows;
    console.log(`✅ Found ${funds.length} funds in local database\n`);

    let fundsMigrated = 0;
    for (const fund of funds) {
      await railwayPool.query(
        `INSERT INTO funds (scheme_code, scheme_name, amc_code, category, sub_category, scheme_type, nav, nav_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (scheme_code) DO UPDATE SET
           scheme_name = $2, amc_code = $3, category = $4, sub_category = $5,
           scheme_type = $6, nav = $7, nav_date = $8`,
        [fund.scheme_code, fund.scheme_name, fund.amc_code, fund.category, 
         fund.sub_category, fund.scheme_type, fund.nav, fund.nav_date]
      );
      fundsMigrated++;
      if (fundsMigrated % 1000 === 0) {
        console.log(`   ✅ Migrated ${fundsMigrated} funds...`);
      }
    }
    console.log(`✅ Migrated ${fundsMigrated} funds to Railway\n`);

    // Step 2: Fetch and populate NAV data from MFApi
    console.log('📊 Step 2: Fetching complete NAV history from MFApi...');
    let successCount = 0;
    let errorCount = 0;
    let totalNavRecords = 0;

    const batchSize = 50;
    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      console.log(`\n📦 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(funds.length / batchSize)} (${batch.length} funds)...`);

      for (const fund of batch) {
        try {
          const response = await axios.get<MFApiResponse>(
            `https://api.mfapi.in/mf/${fund.scheme_code}`,
            { timeout: 15000 }
          );

          if (response.data?.data?.length > 0) {
            const allNavData = response.data.data;
            const latestNav = allNavData[0];
            
            console.log(`   📈 ${fund.scheme_code}: ${allNavData.length} records (latest: ${latestNav.date})`);

            // Bulk insert NAV records
            const batchInsertSize = 1000;
            for (let j = 0; j < allNavData.length; j += batchInsertSize) {
              const navBatch = allNavData.slice(j, j + batchInsertSize);
              const values: any[] = [];
              const placeholders: string[] = [];
              
              navBatch.forEach((nav: any, idx: number) => {
                const baseIdx = idx * 3;
                placeholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3})`);
                values.push(fund.scheme_code, nav.date, parseFloat(nav.nav));
              });

              await railwayPool.query(
                `INSERT INTO nav_history (scheme_code, nav_date, nav_value) 
                 VALUES ${placeholders.join(', ')}
                 ON CONFLICT (scheme_code, nav_date) DO NOTHING`,
                values
              );
            }

            // Update fund's latest NAV
            await railwayPool.query(
              `UPDATE funds SET nav = $1, nav_date = $2 WHERE scheme_code = $3`,
              [parseFloat(latestNav.nav), latestNav.date, fund.scheme_code]
            );

            successCount++;
            totalNavRecords += allNavData.length;
            
            if (successCount % 10 === 0) {
              console.log(`   ✅ ${successCount} funds, ${totalNavRecords.toLocaleString()} NAV records`);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          errorCount++;
          if (error.response?.status !== 404) {
            console.error(`   ❌ ${fund.scheme_code}: ${error.message}`);
          }
        }
      }
    }

    console.log('\n📊 NAV Data Summary:');
    console.log(`   ✅ Successfully updated: ${successCount} funds`);
    console.log(`   📈 Total NAV records: ${totalNavRecords.toLocaleString()}`);
    console.log(`   ❌ Errors: ${errorCount} funds\n`);

    // Step 3: Calculate returns
    console.log('🔄 Step 3: Calculating returns...');
    await calculateReturns();

    console.log('\n✨ Migration to Railway complete!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await localPool.end();
    await railwayPool.end();
  }
}

async function calculateReturns() {
  const fundsResult = await railwayPool.query('SELECT scheme_code FROM funds');
  let successCount = 0;

  for (const fund of fundsResult.rows) {
    try {
      const navHistory = await railwayPool.query(
        `SELECT nav_date, nav_value FROM nav_history 
         WHERE scheme_code = $1 ORDER BY nav_date DESC LIMIT 400`,
        [fund.scheme_code]
      );

      if (navHistory.rows.length < 2) continue;

      const navs = navHistory.rows;
      const latestNav = navs[0].nav_value;
      const returns: any = {};

      const findNavByDate = (daysAgo: number) => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - daysAgo);
        let closestNav = null;
        let minDiff = Infinity;
        
        for (const nav of navs) {
          const diff = Math.abs(new Date(nav.nav_date).getTime() - targetDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestNav = nav.nav_value;
          }
        }
        return closestNav;
      };

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

      if (returns.return_1y) returns.cagr_1y = returns.return_1y;
      if (returns.return_3y) returns.cagr_3y = Math.pow(1 + returns.return_3y / 100, 1 / 3) * 100 - 100;
      if (returns.return_5y) returns.cagr_5y = Math.pow(1 + returns.return_5y / 100, 1 / 5) * 100 - 100;

      await railwayPool.query(
        `INSERT INTO fund_returns (scheme_code, return_1w, return_1m, return_3m, return_6m, 
         return_1y, return_3y, return_5y, cagr_1y, cagr_3y, cagr_5y)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (scheme_code) DO UPDATE SET
           return_1w = $2, return_1m = $3, return_3m = $4, return_6m = $5,
           return_1y = $6, return_3y = $7, return_5y = $8,
           cagr_1y = $9, cagr_3y = $10, cagr_5y = $11`,
        [fund.scheme_code, returns.return_1w || null, returns.return_1m || null,
         returns.return_3m || null, returns.return_6m || null, returns.return_1y || null,
         returns.return_3y || null, returns.return_5y || null, returns.cagr_1y || null,
         returns.cagr_3y || null, returns.cagr_5y || null]
      );

      successCount++;
      if (successCount % 500 === 0) {
        console.log(`   ✅ ${successCount} funds calculated`);
      }
    } catch (error) {
      // Skip individual errors
    }
  }

  console.log(`✅ Returns calculated for ${successCount} funds`);
}

migrateToRailway().catch(console.error);
