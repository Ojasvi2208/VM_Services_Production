import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { createSession, SESSION_COOKIE_NAME, hashPassword } from '@/lib/auth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://www.vmfinancialservices.com/api/auth/google/callback';

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  if (error) {
    return NextResponse.redirect(new URL('/auth/signin?error=google_denied', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth/signin?error=no_code', request.url));
  }

  // CSRF protection: verify state matches cookie
  const storedState = request.cookies.get('google_oauth_state')?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/auth/signin?error=csrf_failed', request.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(new URL('/auth/signin?error=token_failed', request.url));
    }

    const tokens = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(new URL('/auth/signin?error=userinfo_failed', request.url));
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    const client = await pool.connect();
    
    try {
      // Check if user exists
      const existingUser = await client.query(
        'SELECT id, email, full_name FROM users WHERE email = $1',
        [googleUser.email.toLowerCase()]
      );

      let userId: string;
      let isNewUser = false;

      if (existingUser.rows.length > 0) {
        // User exists - update last login
        userId = existingUser.rows[0].id;
        await client.query(
          'UPDATE users SET last_login = NOW(), email_verified = true WHERE id = $1',
          [userId]
        );
      } else {
        // Create new user with Google data
        const randomPassword = hashPassword(Math.random().toString(36) + Date.now().toString());
        const result = await client.query(
          `INSERT INTO users (email, password_hash, full_name, email_verified) 
           VALUES ($1, $2, $3, true) RETURNING id`,
          [googleUser.email.toLowerCase(), randomPassword, googleUser.name]
        );
        userId = result.rows[0].id;
        isNewUser = true;
      }

      // Create session
      const ipAddress = request.headers.get('x-forwarded-for') || '';
      const userAgent = request.headers.get('user-agent') || '';
      const sessionToken = await createSession(userId, ipAddress, userAgent);

      // Redirect to dashboard with session cookie
      const redirectUrl = new URL('/dashboard', request.url);
      if (isNewUser) {
        redirectUrl.searchParams.set('welcome', 'true');
      }

      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/'
      });
      // Clear OAuth state cookie
      response.cookies.delete('google_oauth_state');

      return response;

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(new URL('/auth/signin?error=oauth_failed', request.url));
  }
}
