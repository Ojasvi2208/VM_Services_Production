import { NextResponse } from 'next/server';

interface MFAPIHistoricalResponse {
  meta: {
    scheme_code: string;
    scheme_name: string;
    scheme_category: string;
    scheme_type: string;
    scheme_start_date: {
      date: string;
      timezone_type: number;
      timezone: string;
    };
    fund_house: string;
  };
  data: Array<{
    date: string;
    nav: string;
  }>;
  status: string;
}

interface MFAPILatestResponse {
  meta: {
    scheme_code: string;
    scheme_name: string;
    scheme_category: string;
    scheme_type: string;
    fund_house: string;
  };
  data: Array<{
    date: string;
    nav: string;
  }>;
  status: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const schemeCode = searchParams.get('code');
    const type = searchParams.get('type') || 'latest'; // 'latest' or 'historical'

    if (!schemeCode) {
      return NextResponse.json(
        { error: 'Scheme code is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching ${type} NAV data for scheme: ${schemeCode}`);

    let apiUrl: string;
    if (type === 'historical') {
      apiUrl = `https://api.mfapi.in/mf/${schemeCode}`;
    } else {
      apiUrl = `https://api.mfapi.in/mf/${schemeCode}/latest`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VijayMalikFinancial/1.0)',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`MF API returned status ${response.status}`);
    }

    const data: MFAPIHistoricalResponse | MFAPILatestResponse = await response.json();

    if (data.status !== 'SUCCESS') {
      throw new Error('MF API returned unsuccessful status');
    }

    // Format the response
    const formattedResponse: {
      success: boolean;
      schemeCode: string;
      schemeName: string;
      schemeCategory: string;
      schemeType: string;
      fundHouse: string;
      data: Array<{
        date: string;
        nav: number;
        navString: string;
      }>;
      dataType: string;
      lastUpdated: string;
      totalRecords: number;
      metrics?: {
        latestNav: number;
        previousNav: number;
        dayChange: number;
        dayChangePercent: number;
        monthlyReturn: number | null;
        yearlyReturn: number | null;
        minNav: number;
        maxNav: number;
      };
    } = {
      success: true,
      schemeCode: data.meta.scheme_code,
      schemeName: data.meta.scheme_name,
      schemeCategory: data.meta.scheme_category,
      schemeType: data.meta.scheme_type,
      fundHouse: data.meta.fund_house,
      data: data.data.map(entry => ({
        date: entry.date,
        nav: parseFloat(entry.nav),
        navString: entry.nav
      })),
      dataType: type,
      lastUpdated: new Date().toISOString(),
      totalRecords: data.data.length
    };

    // Calculate additional metrics for historical data
    if (type === 'historical' && data.data.length > 1) {
      const latest = parseFloat(data.data[0].nav);
      const previous = parseFloat(data.data[1].nav);
      const change = latest - previous;
      const changePercent = (change / previous) * 100;

      // Calculate 1-month return (if enough data)
      let monthlyReturn = null;
      if (data.data.length >= 30) {
        const monthAgo = parseFloat(data.data[29].nav);
        monthlyReturn = ((latest - monthAgo) / monthAgo) * 100;
      }

      // Calculate 1-year return (if enough data)
      let yearlyReturn = null;
      if (data.data.length >= 365) {
        const yearAgo = parseFloat(data.data[364].nav);
        yearlyReturn = ((latest - yearAgo) / yearAgo) * 100;
      }

      formattedResponse.metrics = {
        latestNav: latest,
        previousNav: previous,
        dayChange: change,
        dayChangePercent: changePercent,
        monthlyReturn,
        yearlyReturn,
        minNav: Math.min(...data.data.map(d => parseFloat(d.nav))),
        maxNav: Math.max(...data.data.map(d => parseFloat(d.nav)))
      };
    }

    return NextResponse.json(formattedResponse);

  } catch (error) {
    console.error('MF API error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Request timeout - MF API is taking too long to respond',
          errorType: 'TIMEOUT'
        },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch NAV data',
        errorType: 'API_ERROR'
      },
      { status: 500 }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}