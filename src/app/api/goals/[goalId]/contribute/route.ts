/**
 * Goal Contribution API
 * POST /api/goals/[goalId]/contribute — Record a contribution to a goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';

export async function POST(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { amount, date, source, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Verify goal ownership
      const check = await client.query(
        `SELECT id, current_value FROM goals WHERE id = $1 AND user_id = $2`,
        [params.goalId, user.id]
      );
      if (check.rows.length === 0) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }

      await client.query('BEGIN');

      // Insert contribution
      const result = await client.query(`
        INSERT INTO goal_contributions (goal_id, user_id, amount, contribution_date, source, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [params.goalId, user.id, amount, date || new Date().toISOString().split('T')[0], source || 'manual', notes || null]);

      // Update goal's current value
      const newValue = parseFloat(check.rows[0].current_value) + parseFloat(amount);
      await client.query(
        `UPDATE goals SET current_value = $1, updated_at = NOW() WHERE id = $2`,
        [newValue, params.goalId]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        contributionId: result.rows[0].id,
        newCurrentValue: newValue
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Contribution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
