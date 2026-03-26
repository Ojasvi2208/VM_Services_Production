/**
 * Goal Drift Calculator Cron
 *
 * Runs daily at 5:00 AM IST (23:30 UTC previous day).
 * For each goal with linked portfolio holdings:
 *   1. Calculates current allocated value from latest NAVs
 *   2. Projects future value using weighted CAGR of linked funds
 *   3. Computes drift % against target amount
 *   4. If drift > 10%: sends FCM push with top-up SIP suggestion
 *   5. Logs drift to goal_drift_log table
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { dispatchPush } from '@/lib/notification-governor';
import {
  classifyFund, calculateRedemptionTax, calculateSwapBenefit,
  calculateTaxOptimizedSTP, incomeRangeToMidpoint, getCurrentFY, getMonthsLeftInFY,
} from '@/lib/tax-calculator';

export async function GET(request: NextRequest) {
  // Auth: Vercel Cron header or Bearer token
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const stats = {
    goalsProcessed: 0,
    goalsSkipped: 0,
    driftingGoals: 0,
    notificationsSent: 0,
    errors: [] as string[],
  };

  const client = await pool.connect();
  const today = new Date().toISOString().split('T')[0];

  try {
    // Get all active goals that have linked holdings
    const goalsResult = await client.query(`
      SELECT DISTINCT
        g.id as goal_id,
        g.user_id,
        g.name as goal_name,
        g.target_amount,
        g.target_date,
        g.monthly_sip
      FROM goals g
      JOIN goal_holding_links ghl ON g.id = ghl.goal_id
      WHERE g.is_active = true
        AND g.target_date > CURRENT_DATE
      ORDER BY g.user_id
    `);

    for (const goal of goalsResult.rows) {
      try {
        // Calculate current value from linked holdings
        const valueResult = await client.query(`
          SELECT
            SUM(ph.units * COALESCE(f.latest_nav, ph.purchase_nav) * ghl.allocation_pct / 100.0) as current_value,
            -- Weighted CAGR: weight by allocated value
            CASE
              WHEN SUM(ph.units * COALESCE(f.latest_nav, ph.purchase_nav) * ghl.allocation_pct / 100.0) > 0
              THEN SUM(
                fr.cagr_1y * ph.units * COALESCE(f.latest_nav, ph.purchase_nav) * ghl.allocation_pct / 100.0
              ) / NULLIF(SUM(
                CASE WHEN fr.cagr_1y IS NOT NULL
                  THEN ph.units * COALESCE(f.latest_nav, ph.purchase_nav) * ghl.allocation_pct / 100.0
                  ELSE 0 END
              ), 0)
              ELSE NULL
            END as weighted_cagr
          FROM goal_holding_links ghl
          JOIN portfolio_holdings ph ON ghl.holding_id = ph.id
          LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
          LEFT JOIN fund_returns fr ON COALESCE(f.scheme_code, ph.scheme_code) = fr.scheme_code
          WHERE ghl.goal_id = $1
        `, [goal.goal_id]);

        const currentValue = parseFloat(valueResult.rows[0]?.current_value || '0');
        const weightedCagr = parseFloat(valueResult.rows[0]?.weighted_cagr || '12');

        if (currentValue <= 0) {
          stats.goalsSkipped++;
          continue;
        }

        // Calculate years remaining
        const targetDate = new Date(goal.target_date);
        const yearsRemaining = Math.max(0, (targetDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000));

        if (yearsRemaining <= 0) {
          stats.goalsSkipped++;
          continue;
        }

        // Project future value: FV = PV * (1 + r)^n + SIP * [((1+r)^n - 1) / r]
        const monthlyRate = (weightedCagr / 100) / 12;
        const monthsRemaining = Math.round(yearsRemaining * 12);
        const monthlySip = parseFloat(goal.monthly_sip || '0');

        let projectedValue: number;
        if (monthlyRate > 0) {
          const compoundedPV = currentValue * Math.pow(1 + monthlyRate, monthsRemaining);
          const sipFV = monthlySip > 0
            ? monthlySip * ((Math.pow(1 + monthlyRate, monthsRemaining) - 1) / monthlyRate)
            : 0;
          projectedValue = compoundedPV + sipFV;
        } else {
          projectedValue = currentValue + monthlySip * monthsRemaining;
        }

        const targetAmount = parseFloat(goal.target_amount);
        const driftPct = targetAmount > 0
          ? ((targetAmount - projectedValue) / targetAmount) * 100
          : 0;

        // Calculate suggested top-up SIP if drifting
        let suggestedTopupSip: number | null = null;
        if (driftPct > 0 && monthlyRate > 0 && monthsRemaining > 0) {
          const shortfall = targetAmount - projectedValue;
          // Extra SIP needed: shortfall / FV annuity factor
          const annuityFactor = (Math.pow(1 + monthlyRate, monthsRemaining) - 1) / monthlyRate;
          suggestedTopupSip = Math.ceil((shortfall / annuityFactor) / 100) * 100; // Round up to nearest ₹100
          if (suggestedTopupSip < 100) suggestedTopupSip = 100;
        }

        // Store drift log
        await client.query(`
          INSERT INTO goal_drift_log
            (goal_id, user_id, drift_date, current_value, projected_value, target_amount,
             drift_pct, portfolio_cagr, years_remaining, suggested_topup_sip, notification_sent)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (goal_id, drift_date)
          DO UPDATE SET
            current_value = EXCLUDED.current_value,
            projected_value = EXCLUDED.projected_value,
            drift_pct = EXCLUDED.drift_pct,
            portfolio_cagr = EXCLUDED.portfolio_cagr,
            suggested_topup_sip = EXCLUDED.suggested_topup_sip,
            notification_sent = EXCLUDED.notification_sent,
            computed_at = NOW()
        `, [
          goal.goal_id, goal.user_id, today,
          Math.round(currentValue * 100) / 100,
          Math.round(projectedValue * 100) / 100,
          targetAmount,
          Math.round(driftPct * 100) / 100,
          Math.round(weightedCagr * 100) / 100,
          Math.round(yearsRemaining * 100) / 100,
          suggestedTopupSip,
          driftPct > 10, // notification_sent flag
        ]);

        stats.goalsProcessed++;

        // Send push notification if drift > 10%
        // SEBI_COMPLIANCE_HOLD: Push body stripped of SIP top-up suggestion.
        // Factual observation only — no actionable amount recommendation.
        if (driftPct > 10) {
          stats.driftingGoals++;

          const pushResult = await dispatchPush({
            userId: goal.user_id,
            type: 'goal_drift',
            title: `🎯 ${goal.goal_name} — ${Math.round(driftPct)}% behind target`,
            body: `Your goal is currently behind its progress milestone. Review your portfolio for details.`,
            deepLink: `goal_detail/${goal.goal_id}`,
            data: { goalId: goal.goal_id },
          });

          if (pushResult.sent) stats.notificationsSent++;
        }

        // ═══ SEBI_COMPLIANCE_HOLD: "Secure the Bag" + "Off-Track Swap" disabled ═══
        // These sections create specific fund transition suggestions (equity→debt STP,
        // underperforming fund swaps) which constitute personalised investment advice
        // under SEBI IA Regulations 2013 Reg 2(l).
        // Re-enable once VM Financial Advisory Pvt. Ltd. receives SEBI IA certificate.
        //
        // Original "Secure the Bag" (lines 183-280): Triggered when goal ≥90% funded.
        // Found equity holdings → calculated tax-optimized STP → inserted secure_the_bag
        // suggestions into goal_transition_suggestions → dispatched push notification.
        //
        // Original "Off-Track Swap" (lines 282-368): Found holdings with CAGR below
        // category average → found best alternative fund → calculated tax impact and
        // swap benefit → inserted off_track_swap suggestions if netBenefit > ₹1000.

      } catch (goalErr: any) {
        stats.errors.push(`Goal ${goal.goal_id}: ${goalErr.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...stats,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Goal drift cron error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      ...stats,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    }, { status: 500 });
  } finally {
    client.release();
  }
}
