/**
 * GET /api/admin/claims
 * Lists premium payment claims for admin review.
 * Auth: Bearer CRON_SECRET (same pattern as set-premium)
 *
 * Privacy: Only returns auth data (email, full_name, phone) + payment data.
 * Zero portfolio/CAS/funds data.
 *
 * Query params:
 *   ?status=PENDING  (optional filter: PENDING | APPROVED | REJECTED)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let query = `
      SELECT
        pc.id,
        pc.transaction_id,
        pc.upi_ref,
        pc.amount,
        pc.status,
        pc.claimed_at,
        pc.reviewed_at,
        pc.admin_note,
        u.email,
        u.full_name,
        u.phone
      FROM premium_claims pc
      JOIN users u ON u.id = pc.user_id
    `;
    const params: string[] = [];

    if (statusFilter && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusFilter.toUpperCase())) {
      params.push(statusFilter.toUpperCase());
      query += ` WHERE pc.status = $1`;
    }

    query += ` ORDER BY pc.claimed_at DESC`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      claims: result.rows.map((row) => ({
        id: row.id,
        transactionId: row.transaction_id,
        upiRef: row.upi_ref,
        amount: parseFloat(row.amount),
        status: row.status,
        claimedAt: row.claimed_at,
        reviewedAt: row.reviewed_at,
        adminNote: row.admin_note,
        user: {
          email: row.email,
          fullName: row.full_name,
          phone: row.phone,
        },
      })),
      total: result.rows.length,
    });
  } catch (error: any) {
    console.error('Admin claims list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
