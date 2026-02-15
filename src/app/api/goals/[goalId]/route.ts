/**
 * Individual Goal API
 * GET    /api/goals/[goalId]          — Get goal detail with projection
 * PUT    /api/goals/[goalId]          — Update goal
 * DELETE /api/goals/[goalId]          — Soft-delete goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { runMonteCarlo } from '@/lib/monte-carlo';

export async function GET(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await pool.connect();
    try {
      const goalResult = await client.query(`
        SELECT g.*,
          COALESCE(json_agg(json_build_object(
            'id', gfl.id, 'schemeCode', gfl.scheme_code, 'allocationPct', gfl.allocation_pct,
            'schemeName', f.scheme_name, 'currentNav', f.latest_nav
          )) FILTER (WHERE gfl.id IS NOT NULL), '[]') as linked_funds,
          COALESCE(SUM(gc.amount), 0) as total_contributed
        FROM goals g
        LEFT JOIN goal_fund_links gfl ON g.id = gfl.goal_id
        LEFT JOIN funds f ON gfl.scheme_code = f.scheme_code
        LEFT JOIN goal_contributions gc ON g.id = gc.goal_id
        WHERE g.id = $1 AND g.user_id = $2
        GROUP BY g.id
      `, [params.goalId, user.id]);

      if (goalResult.rows.length === 0) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }

      const row = goalResult.rows[0];
      const goal = formatGoal(row);

      // Run fresh Monte Carlo projection
      const now = new Date();
      const target = new Date(goal.targetDate);
      const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));

      // Get volatility from linked funds if available
      let volatility = 15;
      if (goal.linkedFunds.length > 0) {
        const codes = goal.linkedFunds.map((f: any) => f.schemeCode);
        const volResult = await client.query(`
          SELECT AVG(volatility_1y) as avg_vol FROM fund_returns WHERE scheme_code = ANY($1) AND volatility_1y IS NOT NULL
        `, [codes]);
        if (volResult.rows[0]?.avg_vol) volatility = parseFloat(volResult.rows[0].avg_vol);
      }

      const mc = runMonteCarlo({
        currentValue: goal.currentValue,
        monthlySip: goal.monthlySip,
        targetAmount: goal.targetAmount,
        monthsLeft,
        expectedReturn: goal.expectedReturn,
        inflationRate: goal.inflationRate,
        volatility
      });

      // Contributions history
      const contribResult = await client.query(`
        SELECT id, amount, contribution_date, source, notes, created_at
        FROM goal_contributions WHERE goal_id = $1 ORDER BY contribution_date DESC LIMIT 50
      `, [params.goalId]);

      // Cached projections for all scenarios
      const projResult = await client.query(`
        SELECT * FROM goal_projections WHERE goal_id = $1 ORDER BY computed_at DESC LIMIT 3
      `, [params.goalId]);

      return NextResponse.json({
        success: true,
        goal: { ...goal, successProbability: mc.successProbability },
        projection: {
          successProbability: mc.successProbability,
          p10: mc.p10, p50: mc.p50, p90: mc.p90,
          mean: mc.mean,
          shortfall: mc.shortfall,
          chartData: mc.chartData
        },
        contributions: contribResult.rows.map(r => ({
          id: r.id, amount: parseFloat(r.amount),
          date: r.contribution_date, source: r.source,
          notes: r.notes, createdAt: r.created_at
        })),
        cachedProjections: projResult.rows
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Goal detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, icon, color, targetAmount, targetDate, criticality, monthlySip, inflationRate, expectedReturn, notes, linkedFunds } = body;

    const client = await pool.connect();
    try {
      // Verify ownership
      const check = await client.query(`SELECT id FROM goals WHERE id = $1 AND user_id = $2`, [params.goalId, user.id]);
      if (check.rows.length === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

      await client.query('BEGIN');

      // Update goal fields
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;

      const addField = (field: string, val: any) => {
        if (val !== undefined) { sets.push(`${field} = $${idx}`); vals.push(val); idx++; }
      };

      addField('name', name);
      addField('icon', icon);
      addField('color', color);
      addField('target_amount', targetAmount);
      addField('target_date', targetDate);
      addField('criticality', criticality);
      addField('monthly_sip', monthlySip);
      addField('inflation_rate', inflationRate);
      addField('expected_return', expectedReturn);
      addField('notes', notes);
      sets.push(`updated_at = NOW()`);

      if (sets.length > 1) {
        vals.push(params.goalId);
        await client.query(`UPDATE goals SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
      }

      // Re-run Monte Carlo
      const now = new Date();
      const tDate = targetDate ? new Date(targetDate) : new Date(check.rows[0].target_date);
      const mLeft = Math.max(1, (tDate.getFullYear() - now.getFullYear()) * 12 + (tDate.getMonth() - now.getMonth()));
      const mc = runMonteCarlo({
        currentValue: 0, monthlySip: monthlySip || 0,
        targetAmount: targetAmount || 0, monthsLeft: mLeft,
        expectedReturn: expectedReturn || 12, inflationRate: inflationRate || 6, volatility: 15
      });

      await client.query(`UPDATE goals SET success_probability = $1, recommended_sip = $2 WHERE id = $3`,
        [mc.successProbability, findRecommendedSip(targetAmount || 0, mLeft, expectedReturn || 12, inflationRate || 6), params.goalId]);

      // Update linked funds if provided
      if (linkedFunds !== undefined) {
        await client.query(`DELETE FROM goal_fund_links WHERE goal_id = $1`, [params.goalId]);
        for (const fund of (linkedFunds || [])) {
          await client.query(
            `INSERT INTO goal_fund_links (goal_id, scheme_code, allocation_pct) VALUES ($1, $2, $3)`,
            [params.goalId, fund.schemeCode, fund.allocationPct || 100]
          );
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({ success: true, message: 'Goal updated' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Update goal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE goals SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
        [params.goalId, user.id]
      );
      if (result.rowCount === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

      return NextResponse.json({ success: true, message: 'Goal deleted' });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Delete goal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatGoal(row: any) {
  const targetAmount = parseFloat(row.target_amount) || 0;
  const currentValue = parseFloat(row.current_value) || 0;
  return {
    id: row.id, name: row.name, icon: row.icon, color: row.color,
    targetAmount, targetDate: row.target_date, criticality: row.criticality,
    monthlySip: parseFloat(row.monthly_sip) || 0,
    recommendedSip: parseFloat(row.recommended_sip) || 0,
    inflationRate: parseFloat(row.inflation_rate) || 6,
    expectedReturn: parseFloat(row.expected_return) || 12,
    currentValue, successProbability: parseFloat(row.success_probability) || 0,
    progressPercent: targetAmount > 0 ? Math.round(currentValue / targetAmount * 1000) / 10 : 0,
    linkedFunds: row.linked_funds || [], totalContributed: parseFloat(row.total_contributed) || 0,
    notes: row.notes, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function findRecommendedSip(targetAmount: number, monthsLeft: number, expectedReturn: number, inflationRate: number): number {
  let lo = 0, hi = targetAmount / Math.max(1, monthsLeft) * 2;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const mc = runMonteCarlo({ currentValue: 0, monthlySip: mid, targetAmount, monthsLeft, expectedReturn, inflationRate, volatility: 15 });
    if (mc.successProbability >= 90) hi = mid; else lo = mid;
  }
  return Math.ceil(hi / 100) * 100;
}
