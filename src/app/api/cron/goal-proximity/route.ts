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
import { dispatchPush, dispatchBroadcast } from '@/lib/notification-governor';

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

      // Dedup: don't spam daily — only notify at significant milestones
      // or if > 5% change since last notification
      const lastNotif = await pool.query(
        `SELECT body FROM notification_ledger
         WHERE user_id = $1 AND type = 'goal_proximity'
           AND deep_link LIKE $2
           AND sent_at > NOW() - INTERVAL '7 days'
         ORDER BY sent_at DESC LIMIT 1`,
        [goal.user_id, `%${goal.goal_id}%`]
      );

      // If notified within 7 days for same goal, skip unless crossing a 10% milestone
      if (lastNotif.rows.length > 0) {
        const pctStr = lastNotif.rows[0].body?.match(/(\d+)%/)?.[1];
        const lastPct = pctStr ? parseInt(pctStr) : 0;
        const milestonesCrossed = Math.floor(completionPct / 10) > Math.floor(lastPct / 10);
        if (!milestonesCrossed) {
          goalsSkipped++;
          continue;
        }
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

    // ─── 2. NAV Confirmation Broadcast ─────────────────────────────────────

    // Count total users with holdings
    const holdingsCount = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as cnt FROM portfolio_holdings`
    );
    const totalHolders = parseInt(holdingsCount.rows[0]?.cnt || '0');

    let navBroadcast = null;
    if (totalHolders > 0) {
      navBroadcast = await dispatchBroadcast({
        type: 'nav_confirmation',
        title: 'Portfolio Synced',
        body: 'All NAVs are updated. Open Akshaya to see your latest Net Worth.',
        deepLink: 'portfolio',
      });
    }

    return NextResponse.json({
      success: true,
      goals: {
        processed: goalsResult.rows.length,
        sent: goalsSent,
        skipped: goalsSkipped,
      },
      navConfirmation: navBroadcast,
    });
  } catch (error: any) {
    console.error('goal-proximity cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
