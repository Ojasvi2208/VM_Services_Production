/**
 * API Endpoint: Calculate Returns
 * GET /api/returns/calculate?schemeCode=123456
 * POST /api/returns/calculate (body: { schemeCodes: ["123456", "789012"] })
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateAllReturns, calculateBulkReturns } from '@/lib/returns-calculator';

/**
 * GET: Calculate returns for a single scheme
 */
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
    
    const returns = await calculateAllReturns(schemeCode);
    
    if (!returns) {
      return NextResponse.json(
        { error: 'Unable to calculate returns. NAV data may not be available.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: returns,
    });
  } catch (error: any) {
    console.error('Error calculating returns:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * POST: Calculate returns for multiple schemes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schemeCodes } = body;
    
    if (!schemeCodes || !Array.isArray(schemeCodes) || schemeCodes.length === 0) {
      return NextResponse.json(
        { error: 'schemeCodes array is required' },
        { status: 400 }
      );
    }
    
    if (schemeCodes.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 scheme codes allowed per request' },
        { status: 400 }
      );
    }
    
    const returnsMap = await calculateBulkReturns(schemeCodes);
    
    // Convert Map to object for JSON response
    const returnsObject: { [key: string]: any } = {};
    returnsMap.forEach((value, key) => {
      returnsObject[key] = value;
    });
    
    return NextResponse.json({
      success: true,
      count: returnsMap.size,
      data: returnsObject,
    });
  } catch (error: any) {
    console.error('Error calculating bulk returns:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
