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
        if (driftPct > 10) {
          stats.driftingGoals++;

          const topupDisplay = suggestedTopupSip
            ? `A top-up SIP of ₹${suggestedTopupSip.toLocaleString('en-IN')}/mo can get you back on track.`
            : 'Review your goal allocation.';

          const pushResult = await dispatchPush({
            userId: goal.user_id,
            type: 'goal_drift',
            title: `🎯 ${goal.goal_name} — ${Math.round(driftPct)}% behind target`,
            body: topupDisplay,
            deepLink: `goal_detail/${goal.goal_id}`,
            data: { goalId: goal.goal_id },
          });

          if (pushResult.sent) stats.notificationsSent++;
        }

        // ═══ Goal Transition: "Secure the Bag" (≥90% progress) ═══
        const progressPct = targetAmount > 0 ? (currentValue / targetAmount) * 100 : 0;
        if (progressPct >= 90) {
          try {
            // Find equity holdings linked to this goal
            const equityHoldings = await client.query(`
              SELECT ghl.holding_id, ph.scheme_code, ph.units, ph.purchase_nav, ph.purchase_date,
                     COALESCE(f.scheme_name, ph.scheme_name) as fund_name,
                     f.category, f.equity_allocation_pct, f.latest_nav
              FROM goal_holding_links ghl
              JOIN portfolio_holdings ph ON ghl.holding_id = ph.id
              LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
              WHERE ghl.goal_id = $1
                AND (f.category = 'Equity' OR COALESCE(f.equity_allocation_pct, 0) >= 65)
            `, [goal.goal_id]);

            let newSuggestionsCreated = 0;

            for (const eh of equityHoldings.rows) {
              // Check if suggestion already exists
              const existing = await client.query(
                `SELECT id FROM goal_transition_suggestions
                 WHERE goal_id = $1 AND from_scheme_code = $2 AND trigger_type = 'secure_the_bag' AND status = 'pending'`,
                [goal.goal_id, eh.scheme_code]
              );
              if (existing.rows.length > 0) continue;

              const ehNav = parseFloat(eh.latest_nav) || parseFloat(eh.purchase_nav);
              const ehUnits = parseFloat(eh.units);
              const ehGain = (ehNav - parseFloat(eh.purchase_nav)) * ehUnits;

              // Get user's LTCG buffer
              const fy = getCurrentFY();
              const bufferResult = await client.query(
                `SELECT realized_ltcg FROM ltcg_buffer WHERE user_id = $1 AND financial_year = $2`,
                [goal.user_id, fy]
              );
              const ltcgUsed = bufferResult.rows.length > 0 ? parseFloat(bufferResult.rows[0].realized_ltcg) : 0;
              const ltcgRemaining = Math.max(0, 125000 - ltcgUsed);

              // Calculate tax-optimized STP
              const stp = calculateTaxOptimizedSTP({
                totalUnits: ehUnits,
                purchaseNav: parseFloat(eh.purchase_nav),
                currentNav: ehNav,
                ltcgRemaining,
                monthsLeftInFY: getMonthsLeftInFY(),
              });

              // Tax cost estimate
              const taxImpact = calculateRedemptionTax({
                purchaseDate: new Date(eh.purchase_date),
                purchaseNav: parseFloat(eh.purchase_nav),
                currentNav: ehNav,
                units: ehUnits,
                fundType: 'equity',
                userIncome: 600000, // default; will be refined in API calls
                taxRegime: 'new',
                ltcgUsedThisFY: ltcgUsed,
              });

              await client.query(`
                INSERT INTO goal_transition_suggestions
                  (goal_id, user_id, trigger_type, from_scheme_code, from_fund_name,
                   to_fund_name, units_to_move, estimated_gain, tax_cost, net_benefit,
                   stp_monthly_amount, stp_months)
                VALUES ($1, $2, 'secure_the_bag', $3, $4, 'Arbitrage/Liquid Fund', $5, $6, $7, $8, $9, $10)
              `, [
                goal.goal_id, goal.user_id, eh.scheme_code, eh.fund_name || eh.scheme_code,
                ehUnits, Math.round(ehGain * 100) / 100, Math.round(taxImpact.totalTax * 100) / 100,
                Math.round((ehGain - taxImpact.totalTax) * 100) / 100,
                stp.monthlyAmount > 0 ? stp.monthlyAmount : null,
                stp.months > 0 ? stp.months : null,
              ]);
              newSuggestionsCreated++;
            }

            // Dispatch "Secure the Bag" push if new transition suggestions were created
            if (newSuggestionsCreated > 0 && equityHoldings.rows.length > 0) {
              const progressDisplay = Math.round(progressPct);
              const pushResult = await dispatchPush({
                userId: goal.user_id,
                type: 'secure_the_bag',
                title: `${goal.goal_name} is ${progressDisplay}% funded`,
                body: `You're almost there — but still in aggressive equity. Lock in your gains with a tax-smart transition to safety.`,
                deepLink: `goal_detail/${goal.goal_id}`,
                data: {
                  goalId: goal.goal_id,
                  progressPct: String(progressDisplay),
                  equityHoldings: String(equityHoldings.rows.length),
                },
              });
              if (pushResult.sent) stats.notificationsSent++;
            }
          } catch (transErr: any) {
            stats.errors.push(`Transition for goal ${goal.goal_id}: ${transErr.message}`);
          }
        }

        // ═══ Goal Transition: "Off-Track Swap" (red-flagged funds) ═══
        try {
          const offTrackResult = await client.query(`
            SELECT ghl.holding_id, ph.scheme_code, ph.units, ph.purchase_nav, ph.purchase_date,
                   COALESCE(f.scheme_name, ph.scheme_name) as fund_name,
                   f.category, f.sub_category, f.equity_allocation_pct, f.latest_nav,
                   fr.cagr_1y as fund_cagr_1y,
                   mv.avg_cagr_1y as category_avg_1y
            FROM goal_holding_links ghl
            JOIN portfolio_holdings ph ON ghl.holding_id = ph.id
            LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
            LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
            LEFT JOIN mv_category_avg_returns mv ON f.category = mv.category AND f.sub_category = mv.sub_category
            WHERE ghl.goal_id = $1
              AND fr.cagr_1y IS NOT NULL AND mv.avg_cagr_1y IS NOT NULL
              AND fr.cagr_1y < mv.avg_cagr_1y
          `, [goal.goal_id]);

          for (const ot of offTrackResult.rows) {
            // Check if suggestion already exists
            const existing = await client.query(
              `SELECT id FROM goal_transition_suggestions
               WHERE goal_id = $1 AND from_scheme_code = $2 AND trigger_type = 'off_track_swap' AND status = 'pending'`,
              [goal.goal_id, ot.scheme_code]
            );
            if (existing.rows.length > 0) continue;

            // Find best alternative fund in same category
            const altResult = await client.query(`
              SELECT f.scheme_code, f.scheme_name, fr.cagr_1y
              FROM funds f
              JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
              WHERE f.category = $1 AND f.sub_category = $2
                AND f.plan_type = 'Direct' AND f.option_type IN ('Growth', 'Reinvestment')
                AND f.is_active = true AND f.scheme_code != $3
              ORDER BY fr.cagr_1y DESC NULLS LAST
              LIMIT 1
            `, [ot.category, ot.sub_category, ot.scheme_code]);

            if (altResult.rows.length === 0) continue;

            const alt = altResult.rows[0];
            const currentNav = parseFloat(ot.latest_nav) || parseFloat(ot.purchase_nav);
            const currentValue = parseFloat(ot.units) * currentNav;
            const fundType = classifyFund(ot.category || '', ot.equity_allocation_pct != null ? parseFloat(ot.equity_allocation_pct) : null);

            const taxImpact = calculateRedemptionTax({
              purchaseDate: new Date(ot.purchase_date),
              purchaseNav: parseFloat(ot.purchase_nav),
              currentNav,
              units: parseFloat(ot.units),
              fundType,
              userIncome: 600000,
              taxRegime: 'new',
              ltcgUsedThisFY: 0,
            });

            const swapBenefit = calculateSwapBenefit({
              currentFundCagr: parseFloat(ot.fund_cagr_1y),
              newFundCagr: parseFloat(alt.cagr_1y),
              currentValue,
              taxCost: taxImpact.totalTax,
              projectionYears: 3,
            });

            // Only suggest if net benefit > ₹1000
            if (swapBenefit.netBenefit > 1000) {
              await client.query(`
                INSERT INTO goal_transition_suggestions
                  (goal_id, user_id, trigger_type, from_scheme_code, to_scheme_code,
                   from_fund_name, to_fund_name, units_to_move, estimated_gain, tax_cost,
                   projected_benefit_3y, net_benefit)
                VALUES ($1, $2, 'off_track_swap', $3, $4, $5, $6, $7, $8, $9, $10, $11)
              `, [
                goal.goal_id, goal.user_id, ot.scheme_code, alt.scheme_code,
                ot.fund_name || ot.scheme_code, alt.scheme_name,
                parseFloat(ot.units),
                Math.round(taxImpact.gainAmount * 100) / 100,
                Math.round(taxImpact.totalTax * 100) / 100,
                Math.round(swapBenefit.projectedGainNew * 100) / 100,
                Math.round(swapBenefit.netBenefit * 100) / 100,
              ]);
            }
          }
        } catch (swapErr: any) {
          stats.errors.push(`Swap check for goal ${goal.goal_id}: ${swapErr.message}`);
        }

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
