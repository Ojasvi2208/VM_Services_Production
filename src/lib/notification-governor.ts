/**
 * Notification Governor
 *
 * Centralized push dispatch with:
 *   - Per-user audit ledger (notification_ledger)
 *   - DND window: 11:30 PM – 6:30 AM IST (queued to notification_queue, flushed at 7:05 AM)
 *   - Rate limiting: MARKETING max 1/48h; ENGAGEMENT max 4/hr; TRANSACTIONAL exempt
 *   - Invalid token cleanup after every send
 *
 * All cron routes MUST call dispatchPush() or dispatchBroadcast() instead of
 * calling sendPushNotificationBatch() directly.
 */

import pool from '@/lib/postgres-db';
import { sendPushNotificationBatch, isFirebaseConfigured } from '@/lib/firebase-admin';

// ─── Category Classification ────────────────────────────────────────────────

type NotifCategory = 'TRANSACTIONAL' | 'MARKETING' | 'ENGAGEMENT';

const CATEGORY_MAP: Record<string, NotifCategory> = {
  // TRANSACTIONAL — exempt from rate limiting
  goal_drift:         'TRANSACTIONAL',
  ltcg_harvest:       'TRANSACTIONAL',
  fuel_alert:         'TRANSACTIONAL',
  nfo_close:          'TRANSACTIONAL',
  price_alert:        'TRANSACTIONAL',
  market_pulse:       'TRANSACTIONAL',  // volatility trigger — own daily dedup in route
  secure_the_bag:     'TRANSACTIONAL',  // goal ≥90% + equity-heavy — protective lock-in alert
  goal_proximity:     'TRANSACTIONAL',  // Goal Proximity Guardian — post-NAV update
  nav_confirmation:   'TRANSACTIONAL',  // "Portfolio Synced" after daily NAV update

  // MARKETING — max 1 per 48 hours per user
  daily_briefing:     'MARKETING',
  market_open:        'MARKETING',
  market_close:       'MARKETING',
  premium_upsell:     'MARKETING',
  feature_promo:      'MARKETING',
  nfo_alert:          'MARKETING',
  eod_pulse:          'MARKETING',      // personalized EOD sector insight
  eod_big_money:      'MARKETING',      // FII/DII EOD institutional report
  ltcg_teaser:        'MARKETING',      // Jan-Mar free-user Pro upsell for tax harvesting
  monthly_champions:  'MARKETING',      // 1st-of-month top performing fund
  holiday_reminder:   'MARKETING',      // Indian national holiday — market closed

  // ENGAGEMENT — max 4 per hour per user (high-frequency rotation)
  market_snapshot:          'ENGAGEMENT',  // 2-hour interval multi-index pulse
  breaking_headline:        'ENGAGEMENT',
  stock_mover:              'ENGAGEMENT',
  premium_upsell_rotation:  'ENGAGEMENT',  // 1x/day max enforced in cron
  morning_quote:            'ENGAGEMENT',  // 08:30 AM quote of the day
};

function resolveCategory(type: string): NotifCategory {
  return CATEGORY_MAP[type] || 'MARKETING';
}

// ─── IST Helpers ────────────────────────────────────────────────────────────

function getISTTime(): { hour: number; minute: number } {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return { hour: ist.getUTCHours(), minute: ist.getUTCMinutes() };
}

function isDNDWindow(): boolean {
  const { hour, minute } = getISTTime();
  // DND: 23:30 – 06:29 IST
  return (hour === 23 && minute >= 30) || hour < 6 || (hour === 6 && minute < 30);
}

// ─── Token helpers ──────────────────────────────────────────────────────────

async function cleanupInvalidTokens(invalidTokens: string[]): Promise<void> {
  if (invalidTokens.length === 0) return;
  const placeholders = invalidTokens.map((_, i) => `$${i + 1}`).join(',');
  await pool.query(
    `DELETE FROM device_tokens WHERE device_token IN (${placeholders})`,
    invalidTokens
  );
}

// ─── dispatchPush ───────────────────────────────────────────────────────────

export interface DispatchPushParams {
  userId: string;            // UUID from users.id
  type: string;              // e.g. "goal_drift", "market_open"
  title: string;
  body: string;
  deepLink: string;          // mandatory — e.g. "goals", "fuel_prices", "premium"
  data?: Record<string, string>;
}

export interface DispatchResult {
  sent: boolean;
  reason?: string;
}

export async function dispatchPush(params: DispatchPushParams): Promise<DispatchResult> {
  const { userId, type, title, body, deepLink, data } = params;
  const category = resolveCategory(type);

  // 1. DND check — queue for morning flush
  if (isDNDWindow()) {
    await pool.query(
      `INSERT INTO notification_queue (user_id, category, type, title, body, deep_link)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, category, type, title, body, deepLink]
    );
    return { sent: false, reason: 'queued_dnd' };
  }

  // 2. Rate limit check
  if (category === 'MARKETING') {
    // MARKETING: max 1 per 48h per user
    const recent = await pool.query(
      `SELECT 1 FROM notification_ledger
       WHERE user_id = $1 AND category = 'MARKETING'
         AND sent_at > NOW() - INTERVAL '48 hours'
       LIMIT 1`,
      [userId]
    );
    if (recent.rows.length > 0) {
      return { sent: false, reason: 'rate_limited' };
    }
  } else if (category === 'ENGAGEMENT') {
    // ENGAGEMENT: max 4 per hour per user
    const recent = await pool.query(
      `SELECT COUNT(*) as cnt FROM notification_ledger
       WHERE user_id = $1 AND category = 'ENGAGEMENT'
         AND sent_at > NOW() - INTERVAL '1 hour'`,
      [userId]
    );
    if (parseInt(recent.rows[0]?.cnt || '0') >= 4) {
      return { sent: false, reason: 'rate_limited' };
    }
  }

  // 3. Resolve FCM tokens
  const tokensResult = await pool.query(
    'SELECT device_token FROM device_tokens WHERE user_id = $1',
    [userId]
  );
  if (tokensResult.rows.length === 0) {
    return { sent: false, reason: 'no_tokens' };
  }
  const tokens: string[] = tokensResult.rows.map((r: any) => r.device_token);

  // 4. Send via FCM
  if (!isFirebaseConfigured()) {
    return { sent: false, reason: 'firebase_not_configured' };
  }

  const fcmData = { ...data, action: deepLink, type };
  const result = await sendPushNotificationBatch(tokens, title, body, fcmData);

  // 5. Cleanup invalid tokens
  await cleanupInvalidTokens(result.invalidTokens);

  // 6. Write ledger entry
  if (result.success > 0) {
    await pool.query(
      `INSERT INTO notification_ledger (user_id, category, type, title, body, deep_link)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, category, type, title, body, deepLink]
    );
  }

  return { sent: result.success > 0 };
}

// ─── dispatchBroadcast ──────────────────────────────────────────────────────

export interface DispatchBroadcastParams {
  type: string;
  title: string;
  body: string;
  deepLink: string;
  data?: Record<string, string>;
  filterState?: string;      // optional — for state-targeted sends (fuel)
}

export interface BroadcastResult {
  sent: number;
  skipped: number;
  queued: number;
}

export async function dispatchBroadcast(params: DispatchBroadcastParams): Promise<BroadcastResult> {
  const { type, title, body, deepLink, data, filterState } = params;
  const category = resolveCategory(type);
  const result: BroadcastResult = { sent: 0, skipped: 0, queued: 0 };

  // 1. Resolve tokens (optionally filtered by state)
  const tokenQuery = filterState
    ? `SELECT user_id, device_token FROM device_tokens WHERE last_known_state = $1`
    : `SELECT user_id, device_token FROM device_tokens`;
  const tokenParams = filterState ? [filterState] : [];
  const tokensResult = await pool.query(tokenQuery, tokenParams);

  if (tokensResult.rows.length === 0) return result;

  // 2. Group tokens by user_id
  const userTokens = new Map<string, string[]>();
  for (const row of tokensResult.rows) {
    const uid = row.user_id;
    if (!uid) continue; // skip orphan tokens
    const existing = userTokens.get(uid) || [];
    existing.push(row.device_token);
    userTokens.set(uid, existing);
  }

  // 3. DND check — if in DND window, queue all and return
  if (isDNDWindow()) {
    const values: any[] = [];
    let idx = 1;
    const rows: string[] = [];
    for (const userId of userTokens.keys()) {
      rows.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`);
      values.push(userId, category, type, title, body, deepLink);
      idx += 6;
    }
    if (rows.length > 0) {
      await pool.query(
        `INSERT INTO notification_queue (user_id, category, type, title, body, deep_link)
         VALUES ${rows.join(', ')}`,
        values
      );
    }
    result.queued = userTokens.size;
    return result;
  }

  // 4. Per-user rate limit check + send
  if (!isFirebaseConfigured()) return result;

  // Pre-fetch rate-limited users
  const rateLimitedUsers = new Set<string>();
  if ((category === 'MARKETING' || category === 'ENGAGEMENT') && userTokens.size > 0) {
    const userIds = Array.from(userTokens.keys());
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');

    if (category === 'MARKETING') {
      // MARKETING: max 1 per 48h per user
      const rlResult = await pool.query(
        `SELECT DISTINCT user_id FROM notification_ledger
         WHERE user_id IN (${placeholders})
           AND category = 'MARKETING'
           AND sent_at > NOW() - INTERVAL '48 hours'`,
        userIds
      );
      for (const row of rlResult.rows) rateLimitedUsers.add(row.user_id);
    } else {
      // ENGAGEMENT: max 4 per hour per user
      const rlResult = await pool.query(
        `SELECT user_id, COUNT(*) as cnt FROM notification_ledger
         WHERE user_id IN (${placeholders})
           AND category = 'ENGAGEMENT'
           AND sent_at > NOW() - INTERVAL '1 hour'
         GROUP BY user_id
         HAVING COUNT(*) >= 4`,
        userIds
      );
      for (const row of rlResult.rows) rateLimitedUsers.add(row.user_id);
    }
  }

  // Collect eligible users and their tokens for batch send
  const eligibleUsers: { userId: string; tokens: string[] }[] = [];
  for (const [userId, tokens] of userTokens) {
    if (rateLimitedUsers.has(userId)) {
      result.skipped++;
      continue;
    }
    eligibleUsers.push({ userId, tokens });
  }

  if (eligibleUsers.length === 0) return result;

  // Batch send all eligible tokens in one FCM call
  const allTokens = eligibleUsers.flatMap(u => u.tokens);
  const fcmData = { ...data, action: deepLink, type };
  const fcmResult = await sendPushNotificationBatch(allTokens, title, body, fcmData);

  // Cleanup invalid tokens
  await cleanupInvalidTokens(fcmResult.invalidTokens);

  // Build a set of invalid tokens for filtering ledger entries
  const invalidSet = new Set(fcmResult.invalidTokens);

  // Write ledger entries for users who had at least one valid token
  const ledgerValues: any[] = [];
  let ledgerIdx = 1;
  const ledgerRows: string[] = [];
  for (const { userId, tokens } of eligibleUsers) {
    const hasValidToken = tokens.some(t => !invalidSet.has(t));
    if (hasValidToken) {
      ledgerRows.push(`($${ledgerIdx}, $${ledgerIdx + 1}, $${ledgerIdx + 2}, $${ledgerIdx + 3}, $${ledgerIdx + 4}, $${ledgerIdx + 5})`);
      ledgerValues.push(userId, category, type, title, body, deepLink);
      ledgerIdx += 6;
      result.sent++;
    }
  }

  if (ledgerRows.length > 0) {
    await pool.query(
      `INSERT INTO notification_ledger (user_id, category, type, title, body, deep_link)
       VALUES ${ledgerRows.join(', ')}`,
      ledgerValues
    );
  }

  return result;
}

// ─── flushDNDQueue ──────────────────────────────────────────────────────────

export interface FlushResult {
  flushed: number;
  rateLimited: number;
  noTokens: number;
}

export async function flushDNDQueue(): Promise<FlushResult> {
  const result: FlushResult = { flushed: 0, rateLimited: 0, noTokens: 0 };

  const pending = await pool.query(
    `SELECT id, user_id, category, type, title, body, deep_link
     FROM notification_queue
     WHERE flushed = false
     ORDER BY queued_at`
  );

  if (pending.rows.length === 0) return result;

  if (!isFirebaseConfigured()) return result;

  for (const row of pending.rows) {
    // Rate limit check for MARKETING and ENGAGEMENT
    if (row.category === 'MARKETING') {
      const recent = await pool.query(
        `SELECT 1 FROM notification_ledger
         WHERE user_id = $1 AND category = 'MARKETING'
           AND sent_at > NOW() - INTERVAL '48 hours'
         LIMIT 1`,
        [row.user_id]
      );
      if (recent.rows.length > 0) {
        await pool.query('UPDATE notification_queue SET flushed = true WHERE id = $1', [row.id]);
        result.rateLimited++;
        continue;
      }
    } else if (row.category === 'ENGAGEMENT') {
      const recent = await pool.query(
        `SELECT COUNT(*) as cnt FROM notification_ledger
         WHERE user_id = $1 AND category = 'ENGAGEMENT'
           AND sent_at > NOW() - INTERVAL '1 hour'`,
        [row.user_id]
      );
      if (parseInt(recent.rows[0]?.cnt || '0') >= 4) {
        await pool.query('UPDATE notification_queue SET flushed = true WHERE id = $1', [row.id]);
        result.rateLimited++;
        continue;
      }
    }

    // Resolve FCM tokens
    const tokensResult = await pool.query(
      'SELECT device_token FROM device_tokens WHERE user_id = $1',
      [row.user_id]
    );
    if (tokensResult.rows.length === 0) {
      await pool.query('UPDATE notification_queue SET flushed = true WHERE id = $1', [row.id]);
      result.noTokens++;
      continue;
    }

    const tokens: string[] = tokensResult.rows.map((r: any) => r.device_token);
    const fcmData = { action: row.deep_link, type: row.type };
    const fcmResult = await sendPushNotificationBatch(tokens, row.title, row.body, fcmData);

    await cleanupInvalidTokens(fcmResult.invalidTokens);

    // Write ledger entry
    if (fcmResult.success > 0) {
      await pool.query(
        `INSERT INTO notification_ledger (user_id, category, type, title, body, deep_link)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.user_id, row.category, row.type, row.title, row.body, row.deep_link]
      );
    }

    // Mark queued row as flushed
    await pool.query('UPDATE notification_queue SET flushed = true WHERE id = $1', [row.id]);
    result.flushed++;
  }

  return result;
}
