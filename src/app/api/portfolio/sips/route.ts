import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables WHERE table_name = 'cas_sip_info'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        return NextResponse.json({ success: true, sips: [] });
      }

      const result = await client.query(`
        SELECT 
          s.id, s.scheme_code, s.scheme_name, s.sip_amount, s.frequency, s.last_sip_date,
          f.latest_nav, f.scheme_name as db_scheme_name
        FROM cas_sip_info s
        LEFT JOIN funds f ON s.scheme_code = f.scheme_code
        WHERE s.user_id = $1
        ORDER BY s.sip_amount DESC
      `, [user.id]);

      const sips = result.rows.map(row => ({
        id: row.id,
        schemeCode: row.scheme_code,
        schemeName: row.db_scheme_name || row.scheme_name,
        sipAmount: parseFloat(row.sip_amount) || 0,
        frequency: row.frequency || 'Monthly',
        lastSipDate: row.last_sip_date,
        currentNav: row.latest_nav ? parseFloat(row.latest_nav) : null
      }));

      return NextResponse.json({ success: true, sips });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('SIP fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch SIPs' }, { status: 500 });
  }
}
