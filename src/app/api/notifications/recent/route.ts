import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { getCurrentUser } from '@/lib/auth';

// Categories we surface in the navbar bell — relevant to goals / portfolio / fuel
const BELL_CATEGORIES = [
  'goal_drift',
  'secure_the_bag',
  'ltcg_harvest',
  'ltcg_teaser',
  'fuel_alert',
  'price_alert',
  'market_pulse',
  'eod_pulse',
  'portfolio_update',
  'nfo_close',
  'nfo_alert',
];

// Mark-as-read: PATCH /api/notifications/recent  { ids: number[] }
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: true });
    }

    await pool.query(
      `UPDATE notification_ledger SET read = TRUE
       WHERE id = ANY($1::int[]) AND user_id = $2`,
      [ids, user.id]
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ notifications: [], unreadCount: 0 });

    // Try with read column first; fall back if column doesn't exist yet
    let rows: any[] = [];
    try {
      const result = await pool.query(
        `SELECT id, category, title, body, created_at,
                COALESCE(read, FALSE) AS read
         FROM notification_ledger
         WHERE user_id = $1
           AND category = ANY($2::text[])
         ORDER BY created_at DESC
         LIMIT 30`,
        [user.id, BELL_CATEGORIES]
      );
      rows = result.rows;
    } catch {
      // `read` column may not exist — run without it
      const result = await pool.query(
        `SELECT id, category, title, body, created_at, FALSE AS read
         FROM notification_ledger
         WHERE user_id = $1
           AND category = ANY($2::text[])
         ORDER BY created_at DESC
         LIMIT 30`,
        [user.id, BELL_CATEGORIES]
      );
      rows = result.rows;
    }

    const notifications = rows.map(r => ({
      id:        r.id,
      category:  r.category,
      title:     r.title,
      body:      r.body,
      createdAt: r.created_at,
      read:      r.read,
    }));

    const unreadCount = notifications.filter(n => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}
