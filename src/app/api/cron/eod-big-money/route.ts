/**
 * EOD "Big Money" Report — FII/DII Institutional Flow Notification
 *
 * Runs at 3:30 PM IST (10:00 UTC) on weekdays, immediately after market close.
 * Fetches FII and DII net investment data from the scraper API (market-state),
 * then broadcasts a summary: "FIIs were Net Buyers/Sellers of ₹X Cr today."
 *
 * Schedule: 0 10 * * 1-5 (UTC 10:00 = IST 3:30 PM)
 * Type: MARKETING (eod_big_money)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { dispatchBroadcast } from '@/lib/notification-governor';

const SCRAPER_URL = process.env.SCRAPER_URL || 'https://nse-scraper.up.railway.app';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}` || request.headers.get('x-vercel-cron') === '1';
}

function getISTDate(): { day: number; dateStr: string } {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return {
    day: ist.getDay(),
    dateStr: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  };
}

interface FiiDiiData {
  fii_buy: number;
  fii_sell: number;
  fii_net: number;
  dii_buy: number;
  dii_sell: number;
  dii_net: number;
  date?: string;
}

async function fetchFiiDii(): Promise<FiiDiiData | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(`${SCRAPER_URL}/market-state`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.success || !data.data?.fii_dii) return null;
    return data.data.fii_dii as FiiDiiData;
  } catch {
    return null;
  }
}

function formatCr(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 100) return `${(abs).toFixed(0)} Cr`;
  return `${abs.toFixed(1)} Cr`;
}

async function hasEodBigMoneyFiredToday(): Promise<boolean> {
  const { dateStr } = getISTDate();
  const result = await pool.query(
    `SELECT 1 FROM notification_ledger
     WHERE type = 'eod_big_money' AND sent_at::date = $1::date
     LIMIT 1`,
    [dateStr]
  );
  return result.rows.length > 0;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { day } = getISTDate();
  if (day === 0 || day === 6) {
    return NextResponse.json({ success: true, skipped: true, reason: 'weekend' });
  }

  // Daily dedup
  if (await hasEodBigMoneyFiredToday()) {
    return NextResponse.json({ success: true, skipped: true, reason: 'already_fired_today' });
  }

  try {
    const fiiDii = await fetchFiiDii();
    if (!fiiDii) {
      return NextResponse.json({ success: false, error: 'FII/DII data unavailable' }, { status: 502 });
    }

    const fiiAction = fiiDii.fii_net >= 0 ? 'Buyers' : 'Sellers';
    const diiAction = fiiDii.dii_net >= 0 ? 'Buyers' : 'Sellers';

    const title = `The Institutional Report is in`;

    const body = `FIIs were Net ${fiiAction} of ₹${formatCr(fiiDii.fii_net)} today. `
      + `DIIs were Net ${diiAction} of ₹${formatCr(fiiDii.dii_net)}. `
      + `See how the big money moved.`;

    const broadcastResult = await dispatchBroadcast({
      type: 'eod_big_money',
      title,
      body,
      deepLink: 'markets',
      data: {
        fiiNet: String(fiiDii.fii_net),
        diiNet: String(fiiDii.dii_net),
      },
    });

    return NextResponse.json({
      success: true,
      fiiDii,
      notification: { title, body },
      broadcast: broadcastResult,
    });
  } catch (error: any) {
    console.error('eod-big-money cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
