/**
 * Market Update + Volatility Pulse Cron
 *
 * Runs every 5 minutes during market hours (Mon–Fri, 9:00 AM – 4:30 PM IST).
 * 1. Fetches real-time Nifty 50 data via Cloudflare Worker → Yahoo Finance relay
 * 2. If |nifty_change_percent| > 1.2% AND no pulse sent today → dispatches
 *    a behavioral coaching push (rally capture or anti-panic) to all users
 * 3. Dedup via market_pulse_state table (one sentinel row per calendar day)
 *
 * Schedule: every 5 min, UTC 3-10, Mon-Fri (IST ~8:30–15:30)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { dispatchBroadcast } from '@/lib/notification-governor';
import type { BroadcastResult } from '@/lib/notification-governor';

const CF_RELAY_URL = process.env.CF_RELAY_URL
  || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

const VOLATILITY_THRESHOLD = 1.2; // percent

// ─── Types ──────────────────────────────────────────────────────────────────

interface NiftyReading {
  price: number;
  changePercent: number;
  prevClose: number;
  timestamp: string;
}

// ─── Cron Auth ──────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

// ─── IST Helpers ────────────────────────────────────────────────────────────

function getISTDate(): { date: string; day: number; hours: number; minutes: number } {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return {
    date: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), // YYYY-MM-DD
    day: ist.getDay(),
    hours: ist.getHours(),
    minutes: ist.getMinutes(),
  };
}

function isMarketHours(): boolean {
  const { day, hours, minutes } = getISTDate();
  if (day === 0 || day === 6) return false;
  const mins = hours * 60 + minutes;
  return mins >= 555 && mins <= 930; // 9:15 AM – 3:30 PM IST
}

// ─── CF Relay Fetch ─────────────────────────────────────────────────────────

async function fetchNiftyFromCFRelay(): Promise<NiftyReading | null> {
  try {
    const chartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI';
    const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const resp = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price = meta.regularMarketPrice as number;
    const prevClose = (meta.previousClose || meta.chartPreviousClose || 0) as number;
    const changePercent = prevClose > 0
      ? ((price - prevClose) / prevClose) * 100
      : 0;

    return {
      price,
      changePercent: Number(changePercent.toFixed(3)),
      prevClose,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('CF relay fetch failed:', err?.name === 'AbortError' ? 'timeout' : err?.message);
    return null;
  }
}

// ─── Daily Dedup ────────────────────────────────────────────────────────────

async function hasMarketPulseFiredToday(): Promise<boolean> {
  const { date } = getISTDate();
  const result = await pool.query(
    'SELECT 1 FROM market_pulse_state WHERE check_date = $1 LIMIT 1',
    [date]
  );
  return result.rows.length > 0;
}

async function recordMarketPulseFired(niftyChange: number, direction: 'positive' | 'negative'): Promise<void> {
  const { date } = getISTDate();
  await pool.query(
    `INSERT INTO market_pulse_state (check_date, nifty_change, direction)
     VALUES ($1, $2, $3)
     ON CONFLICT (check_date) DO NOTHING`,
    [date, niftyChange, direction]
  );
}

// ─── Volatility Check + Dispatch ────────────────────────────────────────────

async function checkAndDispatchVolatilityPulse(nifty: NiftyReading): Promise<{
  triggered: boolean;
  reason?: string;
  broadcastResult?: BroadcastResult;
}> {
  if (!isMarketHours()) {
    return { triggered: false, reason: 'outside_market_hours' };
  }

  if (Math.abs(nifty.changePercent) <= VOLATILITY_THRESHOLD) {
    return { triggered: false, reason: 'below_threshold' };
  }

  if (await hasMarketPulseFiredToday()) {
    return { triggered: false, reason: 'already_fired_today' };
  }

  const isPositive = nifty.changePercent > 0;
  const absChange = Math.abs(nifty.changePercent).toFixed(2);

  const title = isPositive
    ? 'Markets are rallying today'
    : 'Markets are correcting today';

  const body = isPositive
    ? `Nifty is up ${absChange}% (>${VOLATILITY_THRESHOLD}%). Your portfolio is capturing the upside.`
    : `Nifty is down ${absChange}% (>${VOLATILITY_THRESHOLD}%). Don't panic — your upcoming SIPs will buy units at a discount today.`;

  // Record sentinel BEFORE dispatch to prevent race conditions
  await recordMarketPulseFired(nifty.changePercent, isPositive ? 'positive' : 'negative');

  const broadcastResult = await dispatchBroadcast({
    type: 'market_pulse',
    title,
    body,
    deepLink: 'markets',
    data: {
      niftyChange: String(nifty.changePercent),
      niftyPrice: String(nifty.price),
    },
  });

  return { triggered: true, broadcastResult };
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const nifty = await fetchNiftyFromCFRelay();

    if (!nifty) {
      return NextResponse.json({
        success: false,
        error: 'CF relay unavailable — skipping pulse check',
      }, { status: 502 });
    }

    console.log(`Nifty: ${nifty.price} (${nifty.changePercent}%)`);

    const pulseResult = await checkAndDispatchVolatilityPulse(nifty);

    return NextResponse.json({
      success: true,
      nifty: {
        price: nifty.price,
        changePercent: nifty.changePercent,
        prevClose: nifty.prevClose,
      },
      pulse: pulseResult,
      timestamp: nifty.timestamp,
    });
  } catch (error: any) {
    console.error('market-update cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
