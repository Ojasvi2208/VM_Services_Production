import { NextRequest, NextResponse } from 'next/server';
import { registerUser, createSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { deobfuscateFromTransport } from '@/lib/encryption';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password: obfuscatedPassword, fullName, phone } = body;

    // Validation
    if (!email || !obfuscatedPassword || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    // Deobfuscate password
    const password = deobfuscateFromTransport(obfuscatedPassword);

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Phone validation (optional but if provided must be valid)
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        return NextResponse.json(
          { success: false, error: 'Invalid phone number' },
          { status: 400 }
        );
      }
    }

    // Register user
    const result = await registerUser(email, password, fullName, phone);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Create session
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const userAgent = request.headers.get('user-agent') || '';
    const sessionToken = await createSession(result.userId!, ipAddress, userAgent);

    // Send welcome email (async, don't wait for it)
    sendWelcomeEmail(email, fullName).catch((err) => {
      console.error('Failed to send welcome email:', err);
    });

    // Set session cookie + return token for mobile clients
    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully',
      token: sessionToken,
      user: {
        id: result.userId,
        email,
        fullName,
        isPremium: false
      }
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
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
