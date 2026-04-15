/**
 * Fund Autocomplete API
 * Returns quick suggestions as user types
 * Optimized for speed - returns max 10 results
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { cachedJson } from '@/lib/api-cache-headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Require at least 2 characters
    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        suggestions: []
      });
    }

    const client = await pool.connect();

    try {
      // Fast query - just get scheme names and codes
      const result = await client.query(
        `SELECT 
          scheme_code as "schemeCode",
          scheme_name as "schemeName",
          amc_code as "amcCode"
        FROM funds
        WHERE scheme_name ILIKE $1 OR scheme_code LIKE $2
        ORDER BY 
          CASE 
            WHEN scheme_name ILIKE $3 THEN 0  -- Exact start match first
            ELSE 1 
          END,
          scheme_name
        LIMIT 10`,
        [`%${query}%`, `%${query}%`, `${query}%`]
      );

      // 5min edge cache — users retype same prefixes in droves.
      return cachedJson({
        success: true,
        suggestions: result.rows.map(row => ({
          schemeCode: row.schemeCode,
          schemeName: row.schemeName,
          amcCode: row.amcCode
        }))
      }, 300, 600);

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Autocomplete error:', error);
    return NextResponse.json({
      success: false,
      suggestions: [],
      error: error.message
    }, { status: 500 });
  }
}
