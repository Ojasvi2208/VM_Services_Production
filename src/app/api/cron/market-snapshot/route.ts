/**
 * Market Snapshot Cron — "Sentinel" 2-Hour Pulse
 *
 * Runs every 2 hours during market hours (Mon–Fri, 9:30 AM – 3:30 PM IST).
 * Fetches Nifty 50, Sensex, Midcap, Smallcap and broadcasts a multi-index
 * snapshot to all users.
 *
 * Schedule: 0 4,6,8,10 * * 1-5 (UTC → IST 9:30, 11:30, 13:30, 15:30)
 * Type: ENGAGEMENT (max 4/hr per user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { dispatchBroadcast } from '@/lib/notification-governor';

const CF_RELAY_URL = process.env.CF_RELAY_URL
  || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

// Yahoo Finance symbols for Indian indices
const INDICES = [
  { symbol: '%5ENSEI', name: 'Nifty' },
  { symbol: '%5EBSESN', name: 'Sensex' },
  { symbol: 'NIFTY_MIDCAP_100.NS', name: 'Midcap' },
  { symbol: 'NIFTY_SMLCAP_100.NS', name: 'Smallcap' },
];

interface IndexReading {
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}` || request.headers.get('x-vercel-cron') === '1';
}

function getISTDate(): { day: number; hours: number; minutes: number } {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return { day: ist.getDay(), hours: ist.getHours(), minutes: ist.getMinutes() };
}

function isMarketHours(): boolean {
  const { day, hours, minutes } = getISTDate();
  if (day === 0 || day === 6) return false;
  const mins = hours * 60 + minutes;
  return mins >= 570 && mins <= 930; // 9:30 AM – 3:30 PM IST
}

async function fetchIndex(yahooSymbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
    const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice as number;
    const prevClose = (meta.previousClose || meta.chartPreviousClose || 0) as number;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return { price, change, changePercent };
  } catch {
    return null;
  }
}

function formatPoints(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${Math.abs(val).toFixed(0)}`;
}

function formatPct(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isMarketHours()) {
    return NextResponse.json({ success: true, skipped: true, reason: 'outside_market_hours' });
  }

  try {
    // Fetch all indices in parallel
    const results = await Promise.all(
      INDICES.map(async (idx) => {
        const data = await fetchIndex(idx.symbol);
        return data ? { name: idx.name, price: data.price, change: data.change, changePercent: data.changePercent } as IndexReading : null;
      })
    );

    const readings = results.filter(Boolean) as IndexReading[];
    if (readings.length === 0) {
      return NextResponse.json({ success: false, error: 'No index data available' }, { status: 502 });
    }

    // Build notification body
    const nifty = readings.find(r => r.name === 'Nifty');
    const leader = readings.reduce((a, b) => Math.abs(b.changePercent) > Math.abs(a.changePercent) ? b : a);

    const title = nifty
      ? `Market Pulse: Nifty ${nifty.changePercent >= 0 ? 'UP' : 'DOWN'} ${formatPoints(nifty.change)} pts`
      : `Market Pulse: ${leader.name} ${leader.changePercent >= 0 ? 'UP' : 'DOWN'} ${formatPct(leader.changePercent)}`;

    const lines = readings.map(r =>
      `${r.name}: ${r.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${formatPct(r.changePercent)})`
    );

    // Identify session leader
    const leaderNote = Math.abs(leader.changePercent) > 0.5
      ? ` ${leader.name} ${leader.changePercent > 0 ? 'leading the rally' : 'dragging the market'} today.`
      : '';

    const body = lines.join(' · ') + '.' + leaderNote + ' Tap for details.';

    const broadcastResult = await dispatchBroadcast({
      type: 'market_snapshot',
      title,
      body,
      deepLink: 'markets',
      data: {
        indices: JSON.stringify(readings.map(r => ({ name: r.name, price: r.price, changePct: r.changePercent }))),
      },
    });

    return NextResponse.json({
      success: true,
      readings,
      notification: { title, body },
      broadcast: broadcastResult,
    });
  } catch (error: any) {
    console.error('market-snapshot cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
