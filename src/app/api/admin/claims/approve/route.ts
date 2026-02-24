/**
 * POST /api/admin/claims/approve
 * Approves a premium claim — atomically updates claim status AND user premium flag.
 * Auth: Bearer CRON_SECRET
 *
 * Body: { claimId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { claimId } = body;

    if (!claimId) {
      return NextResponse.json({ error: 'claimId is required' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Update claim status (only if PENDING — prevents double-approval)
    const claimResult = await client.query(
      `UPDATE premium_claims
       SET status = 'APPROVED', reviewed_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id, user_id, transaction_id, amount, status`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Claim not found or already processed' },
        { status: 404 }
      );
    }

    const claim = claimResult.rows[0];

    // Activate premium on user (365 days)
    const userResult = await client.query(
      `UPDATE users
       SET is_premium = true, premium_expires_at = NOW() + INTERVAL '365 days', updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, full_name, is_premium, premium_expires_at`,
      [claim.user_id]
    );

    await client.query('COMMIT');

    const user = userResult.rows[0];

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        transactionId: claim.transaction_id,
        amount: parseFloat(claim.amount),
        status: claim.status,
      },
      user: {
        email: user.email,
        fullName: user.full_name,
        isPremium: user.is_premium,
        premiumExpiresAt: user.premium_expires_at,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Claim approve error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
