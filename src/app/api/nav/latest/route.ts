/**
 * API Endpoint: Get Latest NAV
 * GET /api/nav/latest?schemeCode=123456
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLatestNav } from '@/lib/amfi-nav-fetcher';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const schemeCode = searchParams.get('schemeCode');
    
    if (!schemeCode) {
      return NextResponse.json(
        { error: 'schemeCode parameter is required' },
        { status: 400 }
      );
    }
    
    const nav = await getLatestNav(schemeCode);
    
    if (!nav) {
      return NextResponse.json(
        { error: 'NAV not found for the given scheme code' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: nav,
    });
  } catch (error: any) {
    console.error('Error fetching latest NAV:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
