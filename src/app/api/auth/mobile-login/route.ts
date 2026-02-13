import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSession } from '@/lib/auth';
import { deobfuscateFromTransport } from '@/lib/encryption';
import pool from '@/lib/postgres-db';

// Mobile login endpoint — returns session token + user info as JSON
// The session token can be used as Bearer token for all authenticated APIs

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password: obfuscatedPassword } = body;

    if (!email || !obfuscatedPassword) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Deobfuscate password
    const password = deobfuscateFromTransport(obfuscatedPassword);

    // Find user
    const result = await pool.query(
      'SELECT id, email, full_name, password_hash, phone FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Verify password
    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create session (same as regular signin, reusable as Bearer token)
    const ipAddress = request.headers.get('x-forwarded-for') || '';
    const userAgent = request.headers.get('user-agent') || '';
    const sessionToken = await createSession(user.id, ipAddress, userAgent);

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
      },
    });

  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
