import { Pool } from 'pg';
import axios from 'axios';

const RAILWAY_DB_URL = 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Convert MFApi date format (DD-MM-YYYY) to PostgreSQL format (YYYY-MM-DD)
function convertDateFormat(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
}

async function populateNavData() {
  console.log('🚀 Populating NAV data directly from MFApi...\n');

  try {
    // Get all funds from Railway
    const fundsResult = await pool.query('SELECT scheme_code, scheme_name FROM funds ORDER BY scheme_code');
    const funds = fundsResult.rows;
    console.log(`📊 Found ${funds.length} funds in Railway database\n`);

    let successCount = 0;
    let errorCount = 0;
    let totalNavRecords = 0;

    const batchSize = 50;
    const totalBatches = Math.ceil(funds.length / batchSize);

    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} funds)...`);

      for (const fund of batch) {
        try {
          const response = await axios.get(
            `https://api.mfapi.in/mf/${fund.scheme_code}`,
            { timeout: 15000 }
          );

          if (response.data?.data?.length > 0) {
            const allNavData = response.data.data;
            const latestNav = allNavData[0];

            // Bulk insert NAV records in batches of 1000
            const insertBatchSize = 1000;
            for (let j = 0; j < allNavData.length; j += insertBatchSize) {
              const navBatch = allNavData.slice(j, j + insertBatchSize);
              const values: any[] = [];
              const placeholders: string[] = [];

              navBatch.forEach((nav: any, idx: number) => {
                const baseIdx = idx * 3;
                placeholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3})`);
                values.push(fund.scheme_code, convertDateFormat(nav.date), parseFloat(nav.nav));
              });

              await pool.query(
                `INSERT INTO nav_history (scheme_code, nav_date, nav_value) 
                 VALUES ${placeholders.join(', ')}
                 ON CONFLICT (scheme_code, nav_date) DO NOTHING`,
                values
              );
            }

            // Update fund's latest NAV
            await pool.query(
              `UPDATE funds 
               SET nav = $1, nav_date = $2, latest_nav = $1, latest_nav_date = $2, updated_at = CURRENT_TIMESTAMP
               WHERE scheme_code = $3`,
              [parseFloat(latestNav.nav), convertDateFormat(latestNav.date), fund.scheme_code]
            );

            successCount++;
            totalNavRecords += allNavData.length;

            if (successCount % 10 === 0) {
              console.log(`   ✅ ${successCount}/${funds.length} funds, ${totalNavRecords.toLocaleString()} NAV records`);
            }
          }

          // Rate limiting - 100ms delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          errorCount++;
          if (error.response?.status !== 404) {
            console.error(`   ❌ ${fund.scheme_code}: ${error.message}`);
          }
        }
      }

      // Progress update after each batch
      console.log(`   📊 Batch ${batchNum} complete: ${successCount} successful, ${errorCount} errors`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ NAV DATA POPULATION COMPLETE\n');
    console.log(`   ✅ Successfully updated: ${successCount} funds`);
    console.log(`   📈 Total NAV records: ${totalNavRecords.toLocaleString()}`);
    console.log(`   ❌ Errors: ${errorCount} funds`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

populateNavData().catch(console.error);
