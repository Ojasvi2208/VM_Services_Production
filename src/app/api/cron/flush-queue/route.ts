/**
 * POST /api/cron/flush-queue
 *
 * Flushes the DND notification queue at 7:05 AM IST (01:35 UTC).
 * Notifications generated between 11 PM – 6:30 AM IST are held in
 * notification_queue and dispatched here, respecting rate limits.
 *
 * Schedule: 35 1 * * * (01:35 UTC = 07:05 AM IST)
 * Auth: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { flushDNDQueue } from '@/lib/notification-governor';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await flushDNDQueue();

    // Cleanup: purge processed queue rows older than 7 days
    try {
      const { default: pool } = await import('@/lib/postgres-db');
      const cleanup = await pool.query(
        `DELETE FROM notification_queue WHERE queued_at < NOW() - INTERVAL '7 days'`
      );
      console.log(`[flush-queue] Cleaned up ${cleanup.rowCount} old queue rows`);
    } catch (cleanupErr: any) {
      console.error('[flush-queue] Cleanup error (non-fatal):', cleanupErr.message);
    }

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Flush queue cron error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
