/**
 * Get All Unique AMCs and Categories
 * For populating filter dropdowns
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function GET() {
  const client = await pool.connect();
  
  try {
    // Get unique AMCs
    const amcsResult = await client.query(`
      SELECT DISTINCT amc_code as "amcCode"
      FROM funds
      WHERE amc_code IS NOT NULL AND amc_code != ''
      ORDER BY amc_code
    `);

    // Get unique scheme types (categories)
    const categoriesResult = await client.query(`
      SELECT DISTINCT scheme_type as "schemeType"
      FROM funds
      WHERE scheme_type IS NOT NULL AND scheme_type != ''
      ORDER BY scheme_type
    `);

    // Get total count
    const countResult = await client.query('SELECT COUNT(*) as total FROM funds');

    const amcs = amcsResult.rows.map(row => row.amcCode);
    const categories = categoriesResult.rows.map(row => row.schemeType);
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      success: true,
      amcs,
      categories,
      total
    });

  } catch (error: any) {
    console.error('Error fetching AMCs/categories:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
