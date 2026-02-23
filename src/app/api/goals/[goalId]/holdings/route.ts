/**
 * Goal-Holding Links API
 *
 * GET    /api/goals/[goalId]/holdings — Linked holdings with current values + drift
 * POST   /api/goals/[goalId]/holdings — Link a holding to this goal
 * DELETE /api/goals/[goalId]/holdings — Unlink a holding from this goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';

// ── GET: Linked holdings with current values + latest drift ──
export async function GET(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await pool.connect();
    try {
      // Verify goal ownership
      const goalCheck = await client.query(
        'SELECT id, target_amount, target_date FROM goals WHERE id = $1 AND user_id = $2 AND is_active = true',
        [params.goalId, user.id]
      );
      if (goalCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }

      // Get linked holdings with current market values
      const holdingsResult = await client.query(`
        SELECT
          ghl.id as link_id,
          ghl.holding_id,
          ghl.allocation_pct,
          ph.scheme_code,
          ph.units,
          COALESCE(f.scheme_name, ph.scheme_name) as fund_name,
          COALESCE(f.latest_nav, ph.purchase_nav) as latest_nav,
          ph.units * COALESCE(f.latest_nav, ph.purchase_nav) * ghl.allocation_pct / 100.0 as allocated_value
        FROM goal_holding_links ghl
        JOIN portfolio_holdings ph ON ghl.holding_id = ph.id
        LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
        WHERE ghl.goal_id = $1
        ORDER BY allocated_value DESC
      `, [params.goalId]);

      // Get latest drift entry
      const driftResult = await client.query(`
        SELECT drift_pct, current_value, projected_value, target_amount,
               suggested_topup_sip, portfolio_cagr, years_remaining, drift_date
        FROM goal_drift_log
        WHERE goal_id = $1
        ORDER BY drift_date DESC
        LIMIT 1
      `, [params.goalId]);

      const holdings = holdingsResult.rows.map((row: any) => ({
        id: row.link_id,
        holdingId: row.holding_id,
        allocationPct: parseFloat(row.allocation_pct),
        fundName: row.fund_name || row.scheme_code,
        schemeCode: row.scheme_code,
        currentValue: Math.round(parseFloat(row.allocated_value || 0) * 100) / 100,
        units: parseFloat(row.units),
        latestNav: parseFloat(row.latest_nav || 0),
      }));

      const drift = driftResult.rows.length > 0 ? {
        driftPct: parseFloat(driftResult.rows[0].drift_pct),
        currentValue: parseFloat(driftResult.rows[0].current_value),
        projectedValue: parseFloat(driftResult.rows[0].projected_value),
        targetAmount: parseFloat(driftResult.rows[0].target_amount),
        suggestedTopupSip: driftResult.rows[0].suggested_topup_sip
          ? parseFloat(driftResult.rows[0].suggested_topup_sip) : null,
        portfolioCagr: driftResult.rows[0].portfolio_cagr
          ? parseFloat(driftResult.rows[0].portfolio_cagr) : null,
        yearsRemaining: parseFloat(driftResult.rows[0].years_remaining || 0),
        driftDate: driftResult.rows[0].drift_date,
      } : null;

      return NextResponse.json({ success: true, holdings, drift });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Goal holdings GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch goal holdings' }, { status: 500 });
  }
}

// ── POST: Link a holding to this goal ──
export async function POST(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { holdingId, allocationPct = 100 } = body;

    if (!holdingId) {
      return NextResponse.json({ error: 'holdingId is required' }, { status: 400 });
    }
    if (allocationPct <= 0 || allocationPct > 100) {
      return NextResponse.json({ error: 'allocationPct must be between 1 and 100' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Verify goal ownership
      const goalCheck = await client.query(
        'SELECT id FROM goals WHERE id = $1 AND user_id = $2 AND is_active = true',
        [params.goalId, user.id]
      );
      if (goalCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }

      // Verify holding ownership
      const holdingCheck = await client.query(
        'SELECT id FROM portfolio_holdings WHERE id = $1 AND user_id = $2',
        [holdingId, user.id]
      );
      if (holdingCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
      }

      // Check total allocation for this holding across all goals doesn't exceed 100%
      const allocCheck = await client.query(
        `SELECT COALESCE(SUM(allocation_pct), 0) as total_allocated
         FROM goal_holding_links
         WHERE holding_id = $1 AND goal_id != $2`,
        [holdingId, params.goalId]
      );
      const existingAllocation = parseFloat(allocCheck.rows[0].total_allocated);
      if (existingAllocation + allocationPct > 100) {
        return NextResponse.json({
          error: `Cannot allocate ${allocationPct}%. Already ${existingAllocation}% allocated to other goals. Max available: ${Math.round((100 - existingAllocation) * 100) / 100}%`
        }, { status: 400 });
      }

      // Upsert the link
      await client.query(`
        INSERT INTO goal_holding_links (goal_id, holding_id, allocation_pct)
        VALUES ($1, $2, $3)
        ON CONFLICT (goal_id, holding_id)
        DO UPDATE SET allocation_pct = $3
      `, [params.goalId, holdingId, allocationPct]);

      return NextResponse.json({ success: true, message: 'Holding linked to goal' });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Goal holdings POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to link holding' }, { status: 500 });
  }
}

// ── DELETE: Unlink a holding from this goal ──
export async function DELETE(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { linkId } = body;

    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Verify goal ownership before deleting
      const result = await client.query(`
        DELETE FROM goal_holding_links ghl
        USING goals g
        WHERE ghl.id = $1 AND ghl.goal_id = $2 AND g.id = ghl.goal_id AND g.user_id = $3
        RETURNING ghl.id
      `, [linkId, params.goalId, user.id]);

      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: 'Holding unlinked from goal' });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Goal holdings DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to unlink holding' }, { status: 500 });
  }
}
