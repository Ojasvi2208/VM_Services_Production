/**
 * POST /api/premium/claim
 * User submits a UPI payment claim for premium activation.
 * Auth: JWT/session (same as portfolio endpoints)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transactionId, upiRef, amount } = body;

    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim().length === 0) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }

    if (amount !== 50) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Already premium?
    if (user.is_premium) {
      return NextResponse.json({ error: 'You are already a premium user' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO premium_claims (user_id, transaction_id, upi_ref, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, claimed_at`,
      [user.id, transactionId.trim(), upiRef?.trim() || null, amount]
    );

    const claim = result.rows[0];

    // Fire-and-forget admin email notification
    sendEmail({
      to: process.env.ADMIN_EMAIL || 'ojasvi.malik@outlook.com',
      subject: `New Premium Claim - ${user.email}`,
      html: `
        <h2>New Premium Payment Claim</h2>
        <p><strong>User:</strong> ${user.full_name} (${user.email})</p>
        <p><strong>Transaction ID:</strong> ${transactionId}</p>
        <p><strong>UPI Ref:</strong> ${upiRef || 'N/A'}</p>
        <p><strong>Amount:</strong> ₹${amount}</p>
        <p><strong>Claim ID:</strong> ${claim.id}</p>
        <p><a href="https://www.vmfinancialservices.com/admin/claims">Review in Admin Dashboard</a></p>
      `,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      claimId: claim.id,
      status: claim.status,
    });
  } catch (error: any) {
    // Duplicate transaction_id (UNIQUE violation)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'This transaction has already been claimed' },
        { status: 409 }
      );
    }
    console.error('Premium claim error:', error);
    return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 });
  }
}
