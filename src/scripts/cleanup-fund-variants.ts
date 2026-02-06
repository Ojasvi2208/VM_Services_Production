import { Pool } from 'pg';

const RAILWAY_DB_URL = 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
});

/**
 * Cleanup Fund Variants Script
 * 
 * This script removes Plan A, Plan B and other unwanted fund variants.
 * Keeps only:
 * - Direct Plan - Growth
 * - Direct Plan - Dividend (IDCW)
 * - Regular Plan - Growth
 * - Regular Plan - Dividend (IDCW)
 */

async function cleanupFundVariants() {
  console.log('🧹 FUND DATABASE CLEANUP SCRIPT');
  console.log('================================\n');

  const client = await pool.connect();

  try {
    // Step 1: Check current state
    console.log('📊 Step 1: Analyzing current fund data...');
    
    const totalFunds = await client.query('SELECT COUNT(*) as count FROM funds');
    console.log(`   Total funds in DB: ${totalFunds.rows[0].count}`);

    // Count Plan A, Plan B variants
    const planAB = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Plan A%' 
         OR scheme_name ILIKE '%Plan B%'
         OR scheme_name ILIKE '%Plan C%'
         OR scheme_name ILIKE '%Plan D%'
         OR scheme_name ILIKE '%Plan E%'
    `);
    console.log(`   Plan A/B/C/D/E variants: ${planAB.rows[0].count}`);

    // Count funds with stale data (NAV date before 2024)
    const staleFunds = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE latest_nav_date < '2024-01-01'
    `);
    console.log(`   Funds with stale NAV (before 2024): ${staleFunds.rows[0].count}`);

    // Step 2: Delete Plan A, Plan B, etc. variants
    console.log('\n🗑️  Step 2: Removing Plan A/B/C/D/E variants...');
    
    const deleteResult = await client.query(`
      DELETE FROM funds 
      WHERE scheme_name ILIKE '%- Plan A -%'
         OR scheme_name ILIKE '%- Plan B -%'
         OR scheme_name ILIKE '%- Plan C -%'
         OR scheme_name ILIKE '%- Plan D -%'
         OR scheme_name ILIKE '%- Plan E -%'
         OR scheme_name ILIKE '% Plan A %'
         OR scheme_name ILIKE '% Plan B %'
         OR scheme_name ILIKE '% Plan C %'
      RETURNING scheme_code
    `);
    console.log(`   Deleted ${deleteResult.rowCount} Plan A/B/C/D/E variants`);

    // Step 3: Delete corresponding fund_returns entries
    console.log('\n🗑️  Step 3: Cleaning up orphaned fund_returns...');
    
    const deleteReturns = await client.query(`
      DELETE FROM fund_returns 
      WHERE scheme_code NOT IN (SELECT scheme_code FROM funds)
      RETURNING scheme_code
    `);
    console.log(`   Deleted ${deleteReturns.rowCount} orphaned fund_returns entries`);

    // Step 4: Delete funds with very stale data (before 2020)
    console.log('\n🗑️  Step 4: Removing funds with very stale NAV data (before 2020)...');
    
    const deleteStale = await client.query(`
      DELETE FROM funds 
      WHERE latest_nav_date < '2020-01-01'
      RETURNING scheme_code
    `);
    console.log(`   Deleted ${deleteStale.rowCount} funds with stale data`);

    // Clean up orphaned returns again
    await client.query(`
      DELETE FROM fund_returns 
      WHERE scheme_code NOT IN (SELECT scheme_code FROM funds)
    `);

    // Step 5: Show remaining fund breakdown
    console.log('\n📊 Step 5: Remaining fund breakdown...');
    
    const directGrowth = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Direct%' AND scheme_name ILIKE '%Growth%'
    `);
    console.log(`   Direct Growth funds: ${directGrowth.rows[0].count}`);

    const directDividend = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Direct%' 
        AND (scheme_name ILIKE '%Dividend%' OR scheme_name ILIKE '%IDCW%')
    `);
    console.log(`   Direct Dividend/IDCW funds: ${directDividend.rows[0].count}`);

    const regularGrowth = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Regular%' AND scheme_name ILIKE '%Growth%'
    `);
    console.log(`   Regular Growth funds: ${regularGrowth.rows[0].count}`);

    const regularDividend = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Regular%' 
        AND (scheme_name ILIKE '%Dividend%' OR scheme_name ILIKE '%IDCW%')
    `);
    console.log(`   Regular Dividend/IDCW funds: ${regularDividend.rows[0].count}`);

    // Final count
    const finalCount = await client.query('SELECT COUNT(*) as count FROM funds');
    console.log(`\n✅ Final fund count: ${finalCount.rows[0].count}`);

    // Step 6: Show sample of cleaned funds
    console.log('\n📋 Sample of remaining funds:');
    const sample = await client.query(`
      SELECT scheme_code, scheme_name, latest_nav, latest_nav_date
      FROM funds 
      WHERE latest_nav IS NOT NULL
      ORDER BY latest_nav_date DESC
      LIMIT 10
    `);
    
    sample.rows.forEach(row => {
      const date = row.latest_nav_date ? new Date(row.latest_nav_date).toISOString().split('T')[0] : 'N/A';
      console.log(`   ${row.scheme_code}: ${row.scheme_name.substring(0, 50)}... (NAV: ${row.latest_nav}, Date: ${date})`);
    });

    console.log('\n✅ Cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupFundVariants().catch(console.error);
