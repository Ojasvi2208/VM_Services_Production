/**
 * Goal Proximity Guardian — Post-NAV Update Notification
 *
 * Runs after daily-nav-update completes (~5:00 AM IST weekdays).
 * For every user with active goals:
 *   1. Calculates (current_value / target_amount) * 100
 *   2. Computes daily change (current_value - yesterday's value)
 *   3. Dispatches personalized push: "Your 'Child Education' goal is now 64% complete!"
 *
 * Also sends NAV confirmation push to all portfolio holders.
 *
 * Schedule: 30 23 * * 0-4 (UTC 23:30 = IST ~5:00 AM next day)
 * Type: TRANSACTIONAL (goal_proximity, nav_confirmation)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { dispatchPush } from '@/lib/notification-governor';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}` || request.headers.get('x-vercel-cron') === '1';
}

function formatINR(val: number): string {
  if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toFixed(0);
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let goalsSent = 0;
    let goalsSkipped = 0;

    // ─── 1. Goal Proximity Notifications ─────────────────────────────────────

    // Fetch all active goals with their current portfolio value
    const goalsResult = await pool.query(`
      SELECT
        g.id AS goal_id,
        g.user_id,
        g.name AS goal_name,
        g.target_amount,
        g.current_value,
        COALESCE(
          (SELECT ge.gbm_p50
           FROM goal_evaluations ge
           WHERE ge.goal_id = g.id
           ORDER BY ge.evaluated_at DESC LIMIT 1),
          g.current_value
        ) AS latest_projected_value
      FROM goals g
      WHERE g.is_active = true
        AND g.target_amount > 0
        AND g.current_value > 0
    `);

    for (const goal of goalsResult.rows) {
      const completionPct = (goal.current_value / goal.target_amount) * 100;
      const remaining = goal.target_amount - goal.current_value;

      // Only notify if meaningful progress (at least 5%)
      if (completionPct < 5) {
        goalsSkipped++;
        continue;
      }

      // Dedup: one notification per goal per day
      const lastNotif = await pool.query(
        `SELECT 1 FROM notification_ledger
         WHERE user_id = $1 AND type = 'goal_proximity'
           AND deep_link LIKE $2
           AND sent_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [goal.user_id, `%${goal.goal_id}%`]
      );

      if (lastNotif.rows.length > 0) {
        goalsSkipped++;
        continue;
      }

      let title: string;
      let body: string;

      if (completionPct >= 90) {
        title = `Goal Alert: '${goal.goal_name}' is ${completionPct.toFixed(0)}% complete!`;
        body = `You're just ₹${formatINR(remaining)} away from your target of ₹${formatINR(goal.target_amount)}. The finish line is in sight!`;
      } else if (completionPct >= 50) {
        title = `Goal Update: '${goal.goal_name}' crossed ${Math.floor(completionPct / 10) * 10}%`;
        body = `Your goal is now ${completionPct.toFixed(0)}% complete (₹${formatINR(goal.current_value)} of ₹${formatINR(goal.target_amount)}). Great progress!`;
      } else {
        title = `Goal Update: '${goal.goal_name}' is ${completionPct.toFixed(0)}% complete`;
        body = `Current value: ₹${formatINR(goal.current_value)}. Target: ₹${formatINR(goal.target_amount)}. Keep your SIPs running!`;
      }

      await dispatchPush({
        userId: goal.user_id,
        type: 'goal_proximity',
        title,
        body,
        deepLink: `goal_detail/${goal.goal_id}`,
      });
      goalsSent++;
    }

    // ─── 2. Personalized Daily P&L Notification ────────────────────────────

    let navSent = 0;
    let navSkipped = 0;

    // Compute per-user portfolio value (current vs previous day NAV)
    const plResult = await pool.query(`
      SELECT
        ph.user_id,
        SUM(ph.units * COALESCE(f.latest_nav, ph.purchase_nav)) AS current_value,
        SUM(ph.units * COALESCE(
          (SELECT nh.nav_value FROM nav_history nh
           WHERE nh.scheme_code = ph.scheme_code
             AND nh.nav_date < COALESCE(f.latest_nav_date, CURRENT_DATE)
           ORDER BY nh.nav_date DESC LIMIT 1),
          f.latest_nav,
          ph.purchase_nav
        )) AS previous_value
      FROM portfolio_holdings ph
      LEFT JOIN funds f ON f.scheme_code = ph.scheme_code
      GROUP BY ph.user_id
      HAVING SUM(ph.units * COALESCE(f.latest_nav, ph.purchase_nav)) > 0
    `);

    for (const row of plResult.rows) {
      const currentVal = parseFloat(row.current_value) || 0;
      const previousVal = parseFloat(row.previous_value) || 0;
      if (currentVal <= 0 || previousVal <= 0) {
        navSkipped++;
        continue;
      }

      const dailyChange = currentVal - previousVal;
      const dailyChangePct = (dailyChange / previousVal) * 100;

      let navTitle: string;
      let navBody: string;

      if (Math.abs(dailyChangePct) < 0.01) {
        navTitle = 'Portfolio Synced';
        navBody = `Your portfolio is steady at ₹${formatINR(currentVal)}. NAVs are updated.`;
      } else if (dailyChange > 0) {
        navTitle = `Portfolio +${dailyChangePct.toFixed(2)}% today`;
        navBody = `Your portfolio grew to ₹${formatINR(currentVal)} (+₹${formatINR(dailyChange)}). NAVs are updated.`;
      } else {
        navTitle = `Portfolio ${dailyChangePct.toFixed(2)}% today`;
        navBody = `Your portfolio is at ₹${formatINR(currentVal)} (₹${formatINR(Math.abs(dailyChange))} dip). SIPs buy more units at lower NAVs.`;
      }

      await dispatchPush({
        userId: row.user_id,
        type: 'nav_confirmation',
        title: navTitle,
        body: navBody,
        deepLink: 'portfolio',
      });
      navSent++;
    }

    return NextResponse.json({
      success: true,
      goals: {
        processed: goalsResult.rows.length,
        sent: goalsSent,
        skipped: goalsSkipped,
      },
      navConfirmation: {
        sent: navSent,
        skipped: navSkipped,
      },
    });
  } catch (error: any) {
    console.error('goal-proximity cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
