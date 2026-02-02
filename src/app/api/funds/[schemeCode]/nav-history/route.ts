/**
 * NAV History API
 * GET /api/funds/[schemeCode]/nav-history
 * Returns historical NAV data fetched from MFApi (not stored in DB to save space)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { schemeCode: string } }
) {
  const { schemeCode } = params;
  const searchParams = request.nextUrl.searchParams;
  
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') || '365');

  try {
    // Fetch NAV history from MFApi (we don't store it in DB to save space)
    const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Fund not found' },
        { status: 404 }
      );
    }

    const data = await response.json();
    
    if (!data?.data || data.data.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      });
    }

    let navData = data.data;

    // Filter by date range if provided
    if (startDate || endDate) {
      navData = navData.filter((item: any) => {
        const [day, month, year] = item.date.split('-');
        const itemDate = new Date(`${year}-${month}-${day}`);
        
        if (startDate && endDate) {
          return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
        } else if (startDate) {
          return itemDate >= new Date(startDate);
        } else if (endDate) {
          return itemDate <= new Date(endDate);
        }
        return true;
      });
    }

    // Apply limit
    navData = navData.slice(0, limit);

    // Format response
    const formattedData = navData.map((item: any) => ({
      date: item.date,
      nav: parseFloat(item.nav)
    }));

    return NextResponse.json({
      success: true,
      data: formattedData.reverse(), // Reverse to show oldest first
      count: formattedData.length
    });

  } catch (error: any) {
    console.error('Error fetching NAV history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
