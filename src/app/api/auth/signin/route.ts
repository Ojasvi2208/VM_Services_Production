import { NextRequest, NextResponse } from 'next/server';
import { loginUser, createSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { deobfuscateFromTransport } from '@/lib/encryption';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password: obfuscatedPassword } = body;

    // Validation
    if (!email || !obfuscatedPassword) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Deobfuscate password
    const password = deobfuscateFromTransport(obfuscatedPassword);

    // Login user
    const result = await loginUser(email, password);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    // Create session
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const userAgent = request.headers.get('user-agent') || '';
    const sessionToken = await createSession(result.user.id, ipAddress, userAgent);

    // Set session cookie and return token for mobile apps
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: result.user,
      token: sessionToken // For mobile app auth
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    });

    return response;

  } catch (error: any) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during signin' },
      { status: 500 }
    );
  }
}
