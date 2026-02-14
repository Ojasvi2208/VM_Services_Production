import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== 'vmfs2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE fund_returns 
        ADD COLUMN IF NOT EXISTS rolling_return_1y_min DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS rolling_return_1y_max DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS rolling_return_1y_median DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS rolling_return_3y_avg DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS rolling_return_3y_min DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS rolling_return_3y_max DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS rolling_return_3y_median DECIMAL(10,2);
    `);

    return NextResponse.json({ success: true, message: 'Rolling return columns added' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
