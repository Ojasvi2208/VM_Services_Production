/**
 * Aladdin Deep Evaluation — Pre-computed Fund Intelligence
 * GET /api/goals/{goalId}/fund-evaluation
 *
 * Returns the latest pre-computed fund evaluation for a goal.
 * Computed daily by the evaluate-goals cron. Response is instant (<50ms).
 *
 * Three verdicts:
 *   - aligned:          linked funds are high quality & match glide path
 *   - needs_attention:  quality issues, allocation drift, or better alternatives
 *   - needs_portfolio:  no funds linked or all funds poor quality → includes Aladdin blueprint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { deepEvaluateGoal, storeDeepEvaluation } from '@/lib/fund-evaluator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { goalId } = await params;
    if (!goalId) {
      return NextResponse.json({ error: 'goalId is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Try to serve pre-computed evaluation (fast path — <50ms)
      const cached = await client.query(`
        SELECT verdict, verdict_reason, portfolio_score,
               fund_evaluations, suggestions, recommendation,
               macro_context, glide_path, actual_allocation,
               engine, evaluated_at
        FROM goal_portfolio_evaluations
        WHERE goal_id = $1 AND user_id = $2
          AND expires_at > NOW()
        ORDER BY eval_date DESC
        LIMIT 1
      `, [goalId, user.id]);

      if (cached.rows.length > 0) {
        const row = cached.rows[0];
        return NextResponse.json({
          success: true,
          goalId,
          verdict: row.verdict,
          verdictReason: row.verdict_reason,
          portfolioScore: parseFloat(row.portfolio_score) || 0,
          fundEvaluations: row.fund_evaluations,
          suggestions: row.suggestions,
          recommendation: row.recommendation,
          macroContext: row.macro_context,
          glidePath: row.glide_path,
          actualAllocation: row.actual_allocation,
          engine: row.engine,
          evaluatedAt: row.evaluated_at,
          source: 'cached',
        });
      }

      // No cached evaluation — compute on-demand (slower, but only happens once)
      const goalResult = await client.query(`
        SELECT g.id, g.name, g.target_amount, g.target_date,
               g.monthly_sip, g.criticality,
               u.date_of_birth, COALESCE(u.risk_tolerance, 'moderate') as risk_tolerance
        FROM goals g
        JOIN users u ON g.user_id = u.id
        WHERE g.id = $1 AND g.user_id = $2 AND g.is_active = true
      `, [goalId, user.id]);

      if (goalResult.rows.length === 0) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }

      const goal = goalResult.rows[0];
      const now = new Date();
      const targetDate = new Date(goal.target_date);
      const tenureMonths = Math.max(1, Math.round((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));

      let age = 30;
      if (goal.date_of_birth) {
        const dob = new Date(goal.date_of_birth);
        age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
        age = Math.max(18, Math.min(80, age));
      }

      const riskTolerance = (['conservative', 'moderate', 'aggressive'].includes(goal.risk_tolerance)
        ? goal.risk_tolerance
        : 'moderate') as 'conservative' | 'moderate' | 'aggressive';

      const evaluation = await deepEvaluateGoal(
        goal.id, user.id, age, riskTolerance,
        tenureMonths,
        parseFloat(goal.target_amount) || 0,
        parseFloat(goal.monthly_sip) || 5000,
        goal.name,
        goal.criticality || 'important'
      );

      // Store for future requests (fire-and-forget)
      storeDeepEvaluation(goal.id, user.id, evaluation).catch(() => {});

      return NextResponse.json({
        success: true,
        goalId,
        verdict: evaluation.verdict,
        verdictReason: evaluation.verdict_reason,
        portfolioScore: evaluation.portfolio_score,
        fundEvaluations: evaluation.fund_evaluations,
        suggestions: evaluation.suggestions,
        recommendation: evaluation.recommendation,
        macroContext: evaluation.macro_context,
        glidePath: evaluation.glide_path,
        actualAllocation: evaluation.actual_allocation,
        engine: evaluation.engine,
        evaluatedAt: new Date().toISOString(),
        source: 'computed',
      });
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error('Fund evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate portfolio' },
      { status: 500 }
    );
  }
}
