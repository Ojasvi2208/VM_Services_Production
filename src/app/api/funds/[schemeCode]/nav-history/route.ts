/**
 * NAV History API
 * GET /api/funds/[schemeCode]/nav-history
 * Returns historical NAV data with optional date range
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function GET(
  request: NextRequest,
  { params }: { params: { schemeCode: string } }
) {
  const { schemeCode } = params;
  const searchParams = request.nextUrl.searchParams;
  
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') || '365');

  const client = await pool.connect();

  try {
    let query = `
      SELECT 
        nav_date as "date",
        nav_value as "nav"
      FROM nav_history
      WHERE scheme_code = $1
    `;
    
    const params: any[] = [schemeCode];
    let paramCount = 2;

    if (startDate) {
      query += ` AND nav_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND nav_date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY nav_date DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await client.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows.reverse(), // Reverse to show oldest first
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Error fetching NAV history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
