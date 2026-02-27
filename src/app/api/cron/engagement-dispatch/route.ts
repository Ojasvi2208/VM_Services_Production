/**
 * Engagement Dispatch Cron
 *
 * High-frequency content rotation — runs every 15 minutes during waking hours.
 * Rotates between 4 content slots:
 *   A: Market snapshot ("Nifty at 22,450 ↑ 0.8%")
 *   B: Breaking headline from premium news feed
 *   C: Top stock mover ("TCS up 3.2% today")
 *   D: Premium upsell (1x/day max per user)
 *
 * Governor enforces 4/hour ENGAGEMENT rate limit per user.
 * Schedule: */15 1-17 * * * (UTC 1:00–17:59 = ~IST 6:30 AM–11:29 PM)
 */

import { NextRequest, NextResponse } from 'next/server';
import { dispatchBroadcast } from '@/lib/notification-governor';

const CF_RELAY_URL = process.env.CF_RELAY_URL
  || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
  || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://www.vmfinancialservices.com';

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

// ─── Content Slot Resolution ────────────────────────────────────────────────

type ContentSlot = 'market_snapshot' | 'breaking_headline' | 'stock_mover' | 'premium_upsell_rotation';

function resolveContentSlot(): ContentSlot {
  const { hours, minutes } = getISTTime();
  // 4 slots per hour (every 15 min): 0→A, 15→B, 30→C, 45→D
  const slotIndex = Math.floor(minutes / 15) % 4;
  const slots: ContentSlot[] = [
    'market_snapshot',
    'breaking_headline',
    'stock_mover',
    'premium_upsell_rotation',
  ];
  return slots[slotIndex];
}

// ─── Content Fetchers ───────────────────────────────────────────────────────

async function fetchMarketSnapshot(): Promise<{ title: string; body: string } | null> {
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

async function fetchTopStockMover(): Promise<{ title: string; body: string } | null> {
  try {
    const url = `${BASE_URL}/api/stocks/gainers-losers`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const data = await resp.json();
    const gainers = data?.gainers || [];
    const losers = data?.losers || [];

    // Pick the stock with the biggest absolute move
    const topGainer = gainers[0];
    const topLoser = losers[0];

    if (!topGainer && !topLoser) return null;

    // Alternate between gainer and loser based on current minute
    const { minutes } = getISTTime();
    const useGainer = minutes < 30;

    if (useGainer && topGainer) {
      return {
        title: `${topGainer.symbol} up ${Math.abs(topGainer.changePercent).toFixed(1)}% today`,
        body: `Trading at ₹${topGainer.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}. See today's top movers.`,
      };
    } else if (topLoser) {
      return {
        title: `${topLoser.symbol} down ${Math.abs(topLoser.changePercent).toFixed(1)}% today`,
        body: `Trading at ₹${topLoser.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}. Track sector-wide impact.`,
      };
    } else if (topGainer) {
      return {
        title: `${topGainer.symbol} up ${Math.abs(topGainer.changePercent).toFixed(1)}% today`,
        body: `Trading at ₹${topGainer.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}. See today's top movers.`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function getPremiumUpsell(): { title: string; body: string } {
  const variants = [
    {
      title: 'Is your portfolio built to survive this market?',
      body: 'Upgrade to Akshaya Premium for live AI tracking and Monte Carlo-driven predictive analytics. ₹50/year.',
    },
    {
      title: 'Your goals deserve smarter protection',
      body: 'Premium users get automated LTCG harvesting, drift alerts, and Secure the Bag transitions. Just ₹50/year.',
    },
    {
      title: 'See what the market can\'t show you',
      body: 'Akshaya Premium runs 10,000 Monte Carlo simulations on your portfolio every night. Upgrade for ₹50/year.',
    },
  ];
  // Rotate daily
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return variants[dayOfYear % variants.length];
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
    const slot = resolveContentSlot();
    let content: { title: string; body: string } | null = null;
    let deepLink = 'markets';

    switch (slot) {
      case 'market_snapshot':
        content = await fetchMarketSnapshot();
        deepLink = 'markets';
        break;
      case 'breaking_headline':
        content = await fetchBreakingHeadline();
        deepLink = 'news';
        break;
      case 'stock_mover':
        content = await fetchTopStockMover();
        deepLink = 'markets';
        break;
      case 'premium_upsell_rotation':
        content = getPremiumUpsell();
        deepLink = 'premium';
        break;
    }

    if (!content) {
      // Fallback: try market snapshot if primary slot fails
      content = await fetchMarketSnapshot();
      if (!content) {
        return NextResponse.json({
          success: false,
          slot,
          error: 'No content available for any slot',
          duration: Date.now() - start,
        });
      }
    }

    const result = await dispatchBroadcast({
      type: slot,
      title: content.title,
      body: content.body,
      deepLink,
    });

    return NextResponse.json({
      success: true,
      slot,
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
