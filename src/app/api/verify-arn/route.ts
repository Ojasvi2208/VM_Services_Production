import { NextRequest, NextResponse } from 'next/server';

/**
 * ARN Verification API
 *
 * Security policy (DPDP Act + distributor privacy):
 * - Address, PIN, phone, and email are NEVER returned to the client.
 *   These are PII of the distributor and must not be exposed to unauthenticated visitors.
 * - Only regulatory-essential fields are returned: name, ARN, EUIN, validity, KYD, city.
 * - Console logging is limited to opaque error codes — no ARN numbers or personal data.
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

function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'N/A';
  try {
    return new Date(isoDate).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

/** Returns only the fields safe to expose publicly — no address/phone/email/PIN */
function parseAMFIResponseSafe(data: AMFIDistributorData) {
  return {
    name:         data.ARNHolderName || 'N/A',
    arnNumber:    data.ARN || 'N/A',
    validFrom:    formatDate(data.ARNValidFrom),
    validUpto:    formatDate(data.ARNValidTill),
    city:         data.City || 'N/A',          // city only, no address/PIN
    euin:         data.EUIN || 'N/A',
    kydCompliant: data.KYDCompliant === 'Y' ? 'Yes' : 'No',
    // address, pin, phone, email intentionally omitted — distributor PII
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const arnNumber: unknown = body?.arnNumber;

    if (!arnNumber || typeof arnNumber !== 'string') {
      return NextResponse.json({ status: 'error', message: 'ARN number is required' }, { status: 400 });
    }

    // Strip prefix and validate digits-only
    const formattedARN = arnNumber.replace(/^ARN-/i, '').trim();
    if (!/^\d{1,10}$/.test(formattedARN)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid ARN format. Please enter the numeric ARN (e.g. ARN-317605)' },
        { status: 400 }
      );
    }

    try {
      const url = `https://www.amfiindia.com/api/distributor-agent?search=${encodeURIComponent(formattedARN)}&page=1&pageSize=10`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; VMFSVerifier/1.0)',
          'Referer': 'https://www.amfiindia.com/locate-distributor',
        },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error('[verify-arn] AMFI API HTTP error:', response.status);
        return NextResponse.json(
          { status: 'error', message: 'AMFI service temporarily unavailable. Please try again later.' },
          { status: 503 }
        );
      }

      const responseData = await response.json();

      if (!responseData.data || !Array.isArray(responseData.data) || responseData.data.length === 0) {
        return NextResponse.json(
          { status: 'error', message: 'No distributor found with this ARN. Please verify the number and try again.' },
          { status: 404 }
        );
      }

      const distributorData = responseData.data[0] as AMFIDistributorData;
      const details = parseAMFIResponseSafe(distributorData);

      return NextResponse.json(
        { status: 'success', message: 'ARN successfully verified', details },
        { headers: { 'Cache-Control': 'no-store' } }
      );

    } catch (fetchError: any) {
      if (fetchError?.name === 'TimeoutError' || fetchError?.name === 'AbortError') {
        return NextResponse.json(
          { status: 'error', message: 'AMFI service timed out. Please try again.' },
          { status: 504 }
        );
      }
      console.error('[verify-arn] fetch error:', fetchError?.message ?? 'unknown');
      return NextResponse.json(
        { status: 'error', message: 'Unable to reach AMFI at this time. Please try again later.' },
        { status: 503 }
      );
    }

  } catch {
    return NextResponse.json(
      { status: 'error', message: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
