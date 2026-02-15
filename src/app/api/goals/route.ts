/**
 * Goals API
 * GET  /api/goals        — List all goals + summary
 * POST /api/goals        — Create a new goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { runMonteCarlo } from '@/lib/monte-carlo';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await pool.connect();
    try {
      // Fetch goals with linked funds
      const goalsResult = await client.query(`
        SELECT 
          g.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', gfl.id, 'schemeCode', gfl.scheme_code,
                'allocationPct', gfl.allocation_pct,
                'schemeName', f.scheme_name,
                'currentNav', f.latest_nav
              )
            ) FILTER (WHERE gfl.id IS NOT NULL), '[]'
          ) as linked_funds,
          COALESCE(SUM(gc.amount), 0) as total_contributed
        FROM goals g
        LEFT JOIN goal_fund_links gfl ON g.id = gfl.goal_id
        LEFT JOIN funds f ON gfl.scheme_code = f.scheme_code
        LEFT JOIN goal_contributions gc ON g.id = gc.goal_id
        WHERE g.user_id = $1 AND g.is_active = true
        GROUP BY g.id
        ORDER BY 
          CASE g.criticality 
            WHEN 'critical' THEN 0 
            WHEN 'important' THEN 1 
            ELSE 2 
          END,
          g.target_date ASC
      `, [user.id]);

      const goals = goalsResult.rows.map(row => formatGoal(row));

      // Summary
      const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
      const totalCurrent = goals.reduce((s, g) => s + g.currentValue, 0);
      const totalSip = goals.reduce((s, g) => s + g.monthlySip, 0);
      const criticalOnTrack = goals.filter(g => g.criticality === 'critical' && g.successProbability >= 80).length;
      const criticalAtRisk = goals.filter(g => g.criticality === 'critical' && g.successProbability < 80 && g.successProbability > 0).length;

      return NextResponse.json({
        success: true,
        goals,
        summary: {
          totalGoals: goals.length,
          totalTargetValue: totalTarget,
          totalCurrentValue: totalCurrent,
          totalMonthlySip: totalSip,
          overallProgressPercent: totalTarget > 0 ? Math.round(totalCurrent / totalTarget * 1000) / 10 : 0,
          criticalGoalsOnTrack: criticalOnTrack,
          criticalGoalsAtRisk: criticalAtRisk
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Goals fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, icon, color, targetAmount, targetDate, criticality, monthlySip, inflationRate, expectedReturn, notes, linkedFunds } = body;

    if (!name || !targetAmount || !targetDate) {
      return NextResponse.json({ error: 'Name, target amount, and target date are required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Run Monte Carlo to get recommended SIP and success probability
      const now = new Date();
      const target = new Date(targetDate);
      const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
      const mc = runMonteCarlo({
        currentValue: 0,
        monthlySip: monthlySip || 0,
        targetAmount,
        monthsLeft,
        expectedReturn: expectedReturn || 12,
        inflationRate: inflationRate || 6,
        volatility: 15
      });

      // Find recommended SIP for 90% success
      const recommendedSip = findRecommendedSip({
        currentValue: 0,
        targetAmount,
        monthsLeft,
        expectedReturn: expectedReturn || 12,
        inflationRate: inflationRate || 6,
        volatility: 15
      });

      const result = await client.query(`
        INSERT INTO goals (user_id, name, icon, color, target_amount, target_date, criticality, monthly_sip, recommended_sip, inflation_rate, expected_return, notes, success_probability)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        user.id, name, icon || 'target', color || '#6366F1',
        targetAmount, targetDate, criticality || 'important',
        monthlySip || 0, recommendedSip,
        inflationRate || 6, expectedReturn || 12,
        notes || null, mc.successProbability
      ]);

      const goalId = result.rows[0].id;

      // Link funds if provided
      if (linkedFunds && linkedFunds.length > 0) {
        for (const fund of linkedFunds) {
          await client.query(
            `INSERT INTO goal_fund_links (goal_id, scheme_code, allocation_pct) VALUES ($1, $2, $3)`,
            [goalId, fund.schemeCode, fund.allocationPct || 100]
          );
        }
      }

      // Cache projection
      await client.query(`
        INSERT INTO goal_projections (goal_id, success_probability, projected_value_p10, projected_value_p50, projected_value_p90, shortfall_amount, recommended_sip_increase)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [goalId, mc.successProbability, mc.p10, mc.p50, mc.p90, mc.shortfall, Math.max(0, recommendedSip - (monthlySip || 0))]);

      await client.query('COMMIT');

      // Re-fetch with linked funds
      const goalResult = await client.query(`
        SELECT g.*,
          COALESCE(json_agg(json_build_object('id', gfl.id, 'schemeCode', gfl.scheme_code, 'allocationPct', gfl.allocation_pct, 'schemeName', f.scheme_name, 'currentNav', f.latest_nav)) FILTER (WHERE gfl.id IS NOT NULL), '[]') as linked_funds,
          0 as total_contributed
        FROM goals g
        LEFT JOIN goal_fund_links gfl ON g.id = gfl.goal_id
        LEFT JOIN funds f ON gfl.scheme_code = f.scheme_code
        WHERE g.id = $1
        GROUP BY g.id
      `, [goalId]);

      return NextResponse.json({
        success: true,
        goal: formatGoal(goalResult.rows[0])
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Create goal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatGoal(row: any) {
  const targetAmount = parseFloat(row.target_amount) || 0;
  const currentValue = parseFloat(row.current_value) || 0;
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    targetAmount,
    targetDate: row.target_date,
    criticality: row.criticality,
    monthlySip: parseFloat(row.monthly_sip) || 0,
    recommendedSip: parseFloat(row.recommended_sip) || 0,
    inflationRate: parseFloat(row.inflation_rate) || 6,
    expectedReturn: parseFloat(row.expected_return) || 12,
    currentValue,
    successProbability: parseFloat(row.success_probability) || 0,
    progressPercent: targetAmount > 0 ? Math.round(currentValue / targetAmount * 1000) / 10 : 0,
    linkedFunds: row.linked_funds || [],
    totalContributed: parseFloat(row.total_contributed) || 0,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findRecommendedSip(params: { currentValue: number; targetAmount: number; monthsLeft: number; expectedReturn: number; inflationRate: number; volatility: number }): number {
  // Binary search for SIP that achieves 90% success
  let lo = 0, hi = params.targetAmount / Math.max(1, params.monthsLeft) * 2;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const mc = runMonteCarlo({ ...params, monthlySip: mid });
    if (mc.successProbability >= 90) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 100) * 100; // Round up to nearest 100
}
