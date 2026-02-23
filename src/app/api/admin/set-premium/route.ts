/**
 * Admin: Set Premium Status
 * POST /api/admin/set-premium
 * Protected by CRON_SECRET
 *
 * Usage:
 *   curl -X POST "https://www.vmfinancialservices.com/api/admin/set-premium" \
 *     -H "Authorization: Bearer <CRON_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"ojasvi.malik@outlook.com","isPremium":true}'
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function POST(request: NextRequest) {
  try {
    // Auth: CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, isPremium } = body;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const premium = isPremium !== false; // Default true
    const expiresAt = premium ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;

    const result = await pool.query(
      `UPDATE users SET is_premium = $1, premium_expires_at = $2, updated_at = NOW()
       WHERE email = $3 RETURNING id, email, full_name, is_premium, premium_expires_at`,
      [premium, expiresAt, email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found', email }, { status: 404 });
    }

    const user = result.rows[0];
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        isPremium: user.is_premium,
        premiumExpiresAt: user.premium_expires_at,
      },
    });
  } catch (error: any) {
    console.error('Set premium error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
