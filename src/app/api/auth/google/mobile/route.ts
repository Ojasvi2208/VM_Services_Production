import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { createSession, hashPassword } from '@/lib/auth';

// Mobile Google Sign-In endpoint
// Accepts Google ID token from Flutter google_sign_in package,
// verifies it with Google, creates/links user, returns session token.

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

interface GoogleTokenPayload {
  sub: string;          // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  aud: string;          // Must match our client ID
  iss: string;          // Must be accounts.google.com
  exp: number;
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload | null> {
  try {
    // Use Google's tokeninfo endpoint for server-side verification
    // This is the recommended approach for mobile apps
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!res.ok) return null;

    const payload: GoogleTokenPayload = await res.json();

    // Verify audience matches our client ID(s)
    // Accept both web and iOS client IDs (same GCP project)
    const validAudiences = [
      GOOGLE_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID || '',
    ].filter(Boolean);

    if (!validAudiences.includes(payload.aud)) {
      console.error('Google ID token audience mismatch:', payload.aud);
      return null;
    }

    // Verify issuer
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
      console.error('Google ID token issuer mismatch:', payload.iss);
      return null;
    }

    // Verify not expired
    if (payload.exp * 1000 < Date.now()) {
      console.error('Google ID token expired');
      return null;
    }

    if (!payload.email_verified) {
      console.error('Google email not verified');
      return null;
    }

    return payload;
  } catch (err) {
    console.error('Google token verification error:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: 'Google ID token is required' },
        { status: 400 }
      );
    }

    // Verify the Google ID token
    const googleUser = await verifyGoogleIdToken(idToken);
    if (!googleUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired Google token' },
        { status: 401 }
      );
    }

    const email = googleUser.email.toLowerCase();
    const fullName = googleUser.name || `${googleUser.given_name || ''} ${googleUser.family_name || ''}`.trim() || 'User';

    // Check if user exists
    const existing = await pool.query(
      'SELECT id, email, full_name, phone, is_premium FROM users WHERE email = $1',
      [email]
    );

    let userId: string;
    let isNewUser = false;
    let userRow: any;

    if (existing.rows.length > 0) {
      // Existing user — update last login, mark email verified
      userRow = existing.rows[0];
      userId = userRow.id;
      await pool.query(
        'UPDATE users SET last_login = NOW(), email_verified = true WHERE id = $1',
        [userId]
      );
    } else {
      // New user — create account with random password (Google-only auth)
      const randomPassword = hashPassword(
        crypto.randomUUID() + Date.now().toString()
      );
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, email_verified)
         VALUES ($1, $2, $3, true) RETURNING id, email, full_name, phone, is_premium`,
        [email, randomPassword, fullName]
      );
      userRow = result.rows[0];
      userId = userRow.id;
      isNewUser = true;
    }

    // Create session token (same as mobile-login — usable as Bearer token)
    const ipAddress = request.headers.get('x-forwarded-for') || '';
    const userAgent = request.headers.get('user-agent') || '';
    const sessionToken = await createSession(userId, ipAddress, userAgent);

    return NextResponse.json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      token: sessionToken,
      isNewUser,
      user: {
        id: userRow.id,
        email: userRow.email,
        fullName: userRow.full_name,
        phone: userRow.phone || null,
        isPremium: userRow.is_premium || false,
      },
    });

  } catch (error: any) {
    console.error('Google mobile auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}
