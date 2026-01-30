/**
 * Daily NAV Update Cron Job
 * Runs daily to update only today's NAV data (incremental update)
 * Much faster than full sync - takes ~5 seconds vs 60 seconds
 * 
 * Setup with Vercel Cron:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-update",
 *     "schedule": "0 20 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { dailyNavUpdate } from '@/lib/daily-nav-update';

// Secret token for cron job authentication
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-token-here';

/**
 * GET handler for daily cron job
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
    
    console.log('🕐 Daily cron job triggered: NAV update');
    
    // Execute daily NAV update
    const result = await dailyNavUpdate();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Daily NAV update completed successfully',
        recordsProcessed: result.recordsProcessed,
        duration: `${(result.duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString(),
        type: 'incremental',
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
    console.error('Daily cron job error:', error);
    
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
