import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        isPremium: user.is_premium || false,
      }
    });

  } catch (error: any) {
    console.error('Session check error:', error);
    return NextResponse.json({
      authenticated: false,
      user: null
    });
  }
}
