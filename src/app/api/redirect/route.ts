import { NextRequest, NextResponse } from 'next/server';

/**
 * API route handler that redirects to external URLs without sending the referer header
 * Helps bypass "referer-gate" protections from third-party sites
 */
export async function GET(request: NextRequest) {
  // Get the target URL from the query parameter
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');
  
  // Optional parameters
  const partnerCode = searchParams.get('code');
  
  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing required parameter: url' },
      { status: 400 }
    );
  }

  // Validate URL (basic validation)
  try {
    new URL(targetUrl);
  } catch (e) {
    return NextResponse.json(
      { error: 'Invalid URL provided' },
      { status: 400 }
    );
  }

  // Construct the final URL with any additional parameters
  let finalUrl = targetUrl;
  if (partnerCode) {
    // Add the partner code as a query parameter
    // Check if the URL already has query parameters
    finalUrl += finalUrl.includes('?') ? 
      `&code=${partnerCode}` : 
      `?code=${partnerCode}`;
  }

  // Create a response that redirects to the target URL
  const response = NextResponse.redirect(finalUrl, { status: 307 });
  
  // Set headers to prevent referer information from being sent
  response.headers.set('Referrer-Policy', 'no-referrer');
  
  // Add cache control headers to ensure the response isn't cached
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  
  return response;
}
