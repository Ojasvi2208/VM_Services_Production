import { NextRequest, NextResponse } from 'next/server';

/**
 * ARN Verification API
 * Uses AMFI's distributor-agent API to fetch real distributor details
 * Note: "Advisor" word is prohibited for MFDs, we use "Distributor" instead
 */

interface AMFIDistributorData {
  ARN: string;
  ARNHolderName: string;
  Address: string;
  ARNValidFrom: string;
  ARNValidTill: string;
  Pin: string;
  City: string;
  KYDCompliant: string;
  EUIN: string;
  TelephoneNumber_O: string;
  TelephoneNumber_R: string;
  Email: string;
}

/**
 * Format date from ISO string to readable format
 */
function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'N/A';
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Parse AMFI API response and extract distributor details
 */
function parseAMFIResponse(data: AMFIDistributorData) {
  return {
    name: data.ARNHolderName || 'N/A',
    arnNumber: data.ARN || 'N/A',
    validFrom: formatDate(data.ARNValidFrom),
    validUpto: formatDate(data.ARNValidTill),
    address: data.Address || 'N/A',
    city: data.City || 'N/A',
    pin: data.Pin || 'N/A',
    phone: data.TelephoneNumber_O || data.TelephoneNumber_R || 'N/A',
    email: data.Email || 'N/A',
    euin: data.EUIN || 'N/A',
    kydCompliant: data.KYDCompliant === 'Y' ? 'Yes' : 'No'
  };
}

/**
 * API route handler for ARN verification
 * Uses AMFI's distributor-agent API endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const { arnNumber } = await request.json();
    
    if (!arnNumber || typeof arnNumber !== 'string') {
      return NextResponse.json(
        { status: 'error', message: 'ARN number is required' },
        { status: 400 }
      );
    }

    // Format the ARN by removing "ARN-" prefix if present
    const formattedARN = arnNumber.replace(/^ARN-/i, '').trim();
    
    // Validate ARN format (should be numeric)
    if (!/^\d+$/.test(formattedARN)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid ARN format. Please enter only the numeric part (e.g., 317605)' },
        { status: 400 }
      );
    }
    
    console.log('Verifying ARN:', formattedARN);
    
    try {
      // Use the AMFI distributor-agent API
      const url = `https://www.amfiindia.com/api/distributor-agent?strOpt=ALL&search=${formattedARN}&page=1&pageSize=10`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          'Referer': 'https://www.amfiindia.com/locate-distributor'
        },
        cache: 'no-store'
      });

      console.log('AMFI API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`AMFI API returned status ${response.status}`);
      }

      const responseData = await response.json();
      
      console.log('AMFI API response:', JSON.stringify(responseData).substring(0, 200));
      
      // Check if we got valid data
      if (!responseData.data || !Array.isArray(responseData.data) || responseData.data.length === 0) {
        return NextResponse.json({
          status: 'error',
          message: 'No distributor found with this ARN number. Please verify and try again.'
        }, { status: 404 });
      }
      
      // Get the first matching record
      const distributorData = responseData.data[0] as AMFIDistributorData;
      
      // Parse and return the details
      const details = parseAMFIResponse(distributorData);
      
      const jsonResponse = NextResponse.json({
        status: 'success',
        message: 'ARN successfully verified',
        details
      });
      
      jsonResponse.headers.set('Cache-Control', 'no-store, max-age=0');
      
      return jsonResponse;
      
    } catch (fetchError: any) {
      console.error('AMFI API fetch error:', fetchError);
      return NextResponse.json({
        status: 'error',
        message: 'Unable to verify ARN at this time. AMFI service may be temporarily unavailable. Please try again later.'
      }, { status: 503 });
    }
    
  } catch (error) {
    console.error('ARN verification error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'An error occurred while verifying ARN. Please try again later.'
      },
      { status: 500 }
    );
  }
}
