import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

/**
 * Admin API to cleanup fund variants
 * Removes Plan A, Plan B, etc. and keeps only Direct/Regular Growth/Dividend
 * 
 * POST /api/admin/cleanup-funds
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const results: any = {
      before: {},
      deleted: {},
      after: {}
    };

    // Step 1: Get current counts
    const totalBefore = await client.query('SELECT COUNT(*) as count FROM funds');
    results.before.totalFunds = parseInt(totalBefore.rows[0].count);

    const planABBefore = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Plan A%' 
         OR scheme_name ILIKE '%Plan B%'
         OR scheme_name ILIKE '%Plan C%'
    `);
    results.before.planABC = parseInt(planABBefore.rows[0].count);

    const staleBefore = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE latest_nav_date < '2020-01-01'
    `);
    results.before.staleFunds = parseInt(staleBefore.rows[0].count);

    // Step 2: Delete Plan A/B/C variants
    const deletePlanABC = await client.query(`
      DELETE FROM funds 
      WHERE scheme_name ILIKE '%- Plan A -%'
         OR scheme_name ILIKE '%- Plan B -%'
         OR scheme_name ILIKE '%- Plan C -%'
         OR scheme_name ILIKE '% Plan A %'
         OR scheme_name ILIKE '% Plan B %'
         OR scheme_name ILIKE '% Plan C %'
      RETURNING scheme_code
    `);
    results.deleted.planABC = deletePlanABC.rowCount;

    // Step 3: Delete stale funds (before 2020)
    const deleteStale = await client.query(`
      DELETE FROM funds 
      WHERE latest_nav_date < '2020-01-01'
      RETURNING scheme_code
    `);
    results.deleted.staleFunds = deleteStale.rowCount;

    // Step 4: Clean orphaned fund_returns
    const deleteOrphanedReturns = await client.query(`
      DELETE FROM fund_returns 
      WHERE scheme_code NOT IN (SELECT scheme_code FROM funds)
      RETURNING scheme_code
    `);
    results.deleted.orphanedReturns = deleteOrphanedReturns.rowCount;

    // Step 5: Get final counts
    const totalAfter = await client.query('SELECT COUNT(*) as count FROM funds');
    results.after.totalFunds = parseInt(totalAfter.rows[0].count);

    const directGrowth = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Direct%' AND scheme_name ILIKE '%Growth%'
    `);
    results.after.directGrowth = parseInt(directGrowth.rows[0].count);

    const directDividend = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Direct%' 
        AND (scheme_name ILIKE '%Dividend%' OR scheme_name ILIKE '%IDCW%')
    `);
    results.after.directDividend = parseInt(directDividend.rows[0].count);

    const regularGrowth = await client.query(`
      SELECT COUNT(*) as count FROM funds 
      WHERE scheme_name ILIKE '%Regular%' AND scheme_name ILIKE '%Growth%'
    `);
    results.after.regularGrowth = parseInt(regularGrowth.rows[0].count);

    // Sample of remaining funds
    const sample = await client.query(`
      SELECT scheme_code, scheme_name, latest_nav, latest_nav_date
      FROM funds 
      WHERE latest_nav IS NOT NULL
      ORDER BY latest_nav_date DESC
      LIMIT 5
    `);
    results.sample = sample.rows;

    return NextResponse.json({
      success: true,
      message: 'Fund cleanup completed',
      results
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run cleanup',
    description: 'This will remove Plan A/B/C variants and stale funds'
  });
}
