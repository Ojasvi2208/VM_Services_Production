import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const secret = request.nextUrl.searchParams.get('secret');
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM funds) as total_funds,
        (SELECT COUNT(*) FROM fund_returns) as funds_with_returns,
        (SELECT COUNT(*) FROM fund_returns WHERE rolling_return_1y_avg IS NOT NULL) as has_rolling_1y,
        (SELECT COUNT(*) FROM fund_returns WHERE rolling_return_3y_avg IS NOT NULL) as has_rolling_3y,
        (SELECT COUNT(*) FROM fund_returns WHERE rolling_return_1y_min IS NOT NULL) as has_rolling_1y_full,
        (SELECT COUNT(*) FROM fund_returns WHERE volatility_1y IS NOT NULL) as has_volatility,
        (SELECT COUNT(*) FROM fund_returns WHERE updated_at > NOW() - INTERVAL '7 days') as updated_last_7d
    `);

    return NextResponse.json({ success: true, stats: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
