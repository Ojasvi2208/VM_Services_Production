import { NextRequest, NextResponse } from 'next/server';
import { dispatchBroadcast } from '@/lib/notification-governor';

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

// Check if it's a weekday
function isWeekday(): boolean {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
}

// Get current IST time
function getISTTime(): { hours: number; minutes: number } {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return {
    hours: istTime.getUTCHours(),
    minutes: istTime.getUTCMinutes(),
  };
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const alerts: string[] = [];
  const { hours, minutes } = getISTTime();

  try {
    // 1. Market Open Alert (9:00 AM IST on weekdays)
    if (isWeekday() && hours === 9 && minutes >= 0 && minutes < 5) {
      const result = await dispatchBroadcast({
        type: 'market_open',
        title: '🔔 Market Opening Soon',
        body: 'Indian markets open in 15 minutes. Check pre-market trends and Gift Nifty.',
        deepLink: 'markets',
      });
      alerts.push(`Market open: sent=${result.sent} skipped=${result.skipped} queued=${result.queued}`);
    }

    // 2. Market Close Alert (3:00 PM IST on weekdays)
    if (isWeekday() && hours === 15 && minutes >= 0 && minutes < 5) {
      const result = await dispatchBroadcast({
        type: 'market_close',
        title: '⏰ Market Closing Soon',
        body: 'Markets close in 30 minutes. Review your positions.',
        deepLink: 'markets',
      });
      alerts.push(`Market close: sent=${result.sent} skipped=${result.skipped} queued=${result.queued}`);
    }

    // 3. Daily Briefing (8:30 AM IST on weekdays)
    if (isWeekday() && hours === 8 && minutes >= 30 && minutes < 35) {
      const result = await dispatchBroadcast({
        type: 'daily_briefing',
        title: '☀️ Good Morning! Your Daily Briefing',
        body: 'Markets outlook, top movers, and news ready for you.',
        deepLink: 'home',
      });
      alerts.push(`Daily briefing: sent=${result.sent} skipped=${result.skipped} queued=${result.queued}`);
    }

    // 4. NFO Closing Reminders (check for NFOs closing tomorrow)
    if (hours === 10 && minutes >= 0 && minutes < 5) {
      // In production, query actual NFO data
      const closingNFOs: any[] = []; // Would be fetched from DB

      if (closingNFOs.length > 0) {
        const result = await dispatchBroadcast({
          type: 'nfo_alert',
          title: '📢 NFO Closing Tomorrow',
          body: `${closingNFOs.length} NFO(s) closing tomorrow. Don't miss out!`,
          deepLink: 'nfo',
        });
        alerts.push(`NFO reminder: sent=${result.sent} skipped=${result.skipped} queued=${result.queued}`);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      istTime: `${hours}:${minutes.toString().padStart(2, '0')}`,
      isWeekday: isWeekday(),
      alertsSent: alerts,
    });

  } catch (error) {
    console.error('Cron alerts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send alerts' },
      { status: 500 }
    );
  }
}

// POST endpoint for manual trigger or breaking news
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { alertType, title, message, data, deepLink } = body;

    if (!alertType || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'alertType, title, and message are required' },
        { status: 400 }
      );
    }

    const result = await dispatchBroadcast({
      type: alertType,
      title,
      body: message,
      deepLink: deepLink || 'home',
      data,
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      skipped: result.skipped,
      queued: result.queued,
    });

  } catch (error) {
    console.error('Manual alert error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send alert' },
      { status: 500 }
    );
  }
}
