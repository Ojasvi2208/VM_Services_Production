/**
 * Cron Job API Endpoint for NAV Sync
 * This endpoint should be called daily to sync NAV data from AMFI
 * 
 * Setup with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-nav",
 *     "schedule": "0 20 * * *"
 *   }]
 * }
 * 
 * Or use external cron service like:
 * - cron-job.org
 * - EasyCron
 * - AWS EventBridge
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncNavDataToPostgres } from '@/lib/amfi-postgres-sync';

// Secret token for cron job authentication
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-token-here';

/**
 * GET handler for cron job
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('🕐 Cron job triggered: NAV sync');
    
    // Execute NAV sync to PostgreSQL
    const result = await syncNavDataToPostgres();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'NAV data synced successfully to PostgreSQL',
        recordsProcessed: result.recordsProcessed,
        duration: `${(result.duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        duration: `${(result.duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Cron job error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * POST handler (alternative method)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
