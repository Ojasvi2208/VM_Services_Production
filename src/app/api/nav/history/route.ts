/**
 * API Endpoint: Get NAV History
 * GET /api/nav/history?schemeCode=123456&startDate=2024-01-01&endDate=2024-12-31
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNavHistory } from '@/lib/amfi-nav-fetcher';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const schemeCode = searchParams.get('schemeCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!schemeCode) {
      return NextResponse.json(
        { error: 'schemeCode parameter is required' },
        { status: 400 }
      );
    }
    
    const history = await getNavHistory(schemeCode, startDate || undefined, endDate || undefined);
    
    return NextResponse.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error: any) {
    console.error('Error fetching NAV history:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
