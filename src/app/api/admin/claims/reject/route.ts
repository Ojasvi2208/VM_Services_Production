/**
 * POST /api/admin/claims/reject
 * Rejects a premium claim with optional admin note.
 * Auth: Bearer CRON_SECRET
 *
 * Body: { claimId: string, note?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { claimId, note } = body;

    if (!claimId) {
      return NextResponse.json({ error: 'claimId is required' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE premium_claims
       SET status = 'REJECTED', reviewed_at = NOW(), admin_note = $2
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id, transaction_id, amount, status, admin_note`,
      [claimId, note?.trim() || null]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Claim not found or already processed' },
        { status: 404 }
      );
    }

    const claim = result.rows[0];

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        transactionId: claim.transaction_id,
        amount: parseFloat(claim.amount),
        status: claim.status,
        adminNote: claim.admin_note,
      },
    });
  } catch (error: any) {
    console.error('Claim reject error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
