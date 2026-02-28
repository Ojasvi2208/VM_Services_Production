/**
 * Engagement Dispatch Cron — Top Headlines (2-hour interval)
 *
 * Sends the latest breaking financial headline to all users.
 * Runs every 2 hours during waking hours, interleaved with market-snapshot.
 *
 * Market-snapshot handles: 9:30, 11:30, 13:30, 15:30 IST
 * This cron handles:       10:30, 12:30, 14:30, 16:30, 18:30, 20:30 IST
 *
 * Result: users get ~1 notification per hour during daytime,
 * with 2-hour gaps between same type.
 *
 * Schedule: 0 5,7,9,11,13,15 * * * (UTC → IST 10:30, 12:30, 14:30, 16:30, 18:30, 20:30)
 * Type: ENGAGEMENT (max 4/hr per user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { dispatchBroadcast } from '@/lib/notification-governor';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
  || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://www.vmfinancialservices.com';

const CF_RELAY_URL = process.env.CF_RELAY_URL
  || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

// ─── Cron Auth ──────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

// ─── IST Helpers ────────────────────────────────────────────────────────────

function getISTTime(): { hours: number; minutes: number; day: number } {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return {
    hours: ist.getHours(),
    minutes: ist.getMinutes(),
    day: ist.getDay(),
  };
}

function isWakingHours(): boolean {
  const { hours } = getISTTime();
  return hours >= 7 && hours < 23; // 7:00 AM – 10:59 PM IST
}

// ─── Content Fetchers ───────────────────────────────────────────────────────

async function fetchBreakingHeadline(): Promise<{ title: string; body: string } | null> {
  try {
    const url = `${BASE_URL}/api/news/aggregated?feed=premium&limit=1&category=all`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const data = await resp.json();
    const article = data?.articles?.[0];
    if (!article?.title) return null;

    // Truncate title to 80 chars for notification
    const title = article.title.length > 80
      ? article.title.substring(0, 77) + '...'
      : article.title;

    return {
      title,
      body: article.source ? `From ${article.source}` : 'Breaking financial news',
    };
  } catch {
    return null;
  }
}

async function fetchMarketSnapshotFallback(): Promise<{ title: string; body: string } | null> {
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
    const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    const arrow = changePercent >= 0 ? '↑' : '↓';
    const sign = changePercent >= 0 ? '+' : '';

    return {
      title: `Nifty 50 at ${price.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ${arrow} ${sign}${changePercent.toFixed(1)}%`,
      body: changePercent >= 0
        ? 'Markets are trending positive. Track your portfolio exposure in real-time.'
        : 'Markets are under pressure. Your SIPs are buying at a discount today.',
    };
  } catch {
    return null;
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const start = Date.now();

  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Allow bypass for testing
  const bypass = request.nextUrl.searchParams.get('bypass') === '1';

  if (!bypass && !isWakingHours()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'outside_waking_hours',
      ist: getISTTime(),
    });
  }

  try {
    // Primary: fetch a breaking headline
    let content = await fetchBreakingHeadline();
    let type = 'breaking_headline';
    let deepLink = 'news';

    // Fallback: market snapshot if no headline available
    if (!content) {
      content = await fetchMarketSnapshotFallback();
      type = 'market_snapshot';
      deepLink = 'markets';
    }

    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'No content available',
        duration: Date.now() - start,
      });
    }

    const result = await dispatchBroadcast({
      type,
      title: content.title,
      body: content.body,
      deepLink,
    });

    return NextResponse.json({
      success: true,
      type,
      title: content.title,
      broadcast: result,
      ist: getISTTime(),
      duration: Date.now() - start,
    });
  } catch (error: any) {
    console.error('engagement-dispatch error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      duration: Date.now() - start,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
