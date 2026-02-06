import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { sendPushNotificationBatch, isFirebaseConfigured } from '@/lib/firebase-admin';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

// Send notifications using Firebase Admin SDK
async function sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  if (!isFirebaseConfigured() || tokens.length === 0) {
    return { success: 0, failure: 0 };
  }

  const result = await sendPushNotificationBatch(tokens, title, body, data);
  
  // Clean up invalid tokens
  if (result.invalidTokens.length > 0) {
    for (const token of result.invalidTokens) {
      await pool.query('DELETE FROM device_tokens WHERE device_token = $1', [token]);
    }
  }

  return { success: result.success, failure: result.failure };
}

// Get tokens with specific preference enabled
async function getTokensWithPreference(preferenceKey: string): Promise<string[]> {
  try {
    // Get all device tokens (in production, filter by preference)
    const result = await pool.query('SELECT device_token FROM device_tokens');
    return result.rows.map(r => r.device_token);
  } catch {
    return [];
  }
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
  const timeInMinutes = hours * 60 + minutes;

  try {
    // 1. Market Open Alert (9:00 AM IST on weekdays)
    if (isWeekday() && hours === 9 && minutes >= 0 && minutes < 5) {
      const tokens = await getTokensWithPreference('market_open');
      if (tokens.length > 0) {
        await sendToTokens(
          tokens,
          '🔔 Market Opening Soon',
          'Indian markets open in 15 minutes. Check pre-market trends and Gift Nifty.',
          { screen: 'markets' }
        );
        alerts.push(`Market open alert sent to ${tokens.length} devices`);
      }
    }

    // 2. Market Close Alert (3:00 PM IST on weekdays)
    if (isWeekday() && hours === 15 && minutes >= 0 && minutes < 5) {
      const tokens = await getTokensWithPreference('market_close');
      if (tokens.length > 0) {
        await sendToTokens(
          tokens,
          '⏰ Market Closing Soon',
          'Markets close in 30 minutes. Review your positions.',
          { screen: 'markets' }
        );
        alerts.push(`Market close alert sent to ${tokens.length} devices`);
      }
    }

    // 3. Daily Briefing (8:30 AM IST on weekdays)
    if (isWeekday() && hours === 8 && minutes >= 30 && minutes < 35) {
      const tokens = await getTokensWithPreference('daily_briefing');
      if (tokens.length > 0) {
        await sendToTokens(
          tokens,
          '☀️ Good Morning! Your Daily Briefing',
          'Markets outlook, top movers, and news ready for you.',
          { screen: 'home' }
        );
        alerts.push(`Daily briefing sent to ${tokens.length} devices`);
      }
    }

    // 4. NFO Closing Reminders (check for NFOs closing tomorrow)
    if (hours === 10 && minutes >= 0 && minutes < 5) {
      // In production, query actual NFO data
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Mock: Check if any NFO closes tomorrow
      // In production: SELECT * FROM nfos WHERE close_date = $1
      const closingNFOs = []; // Would be fetched from DB

      if (closingNFOs.length > 0) {
        const tokens = await getTokensWithPreference('nfo_alert');
        if (tokens.length > 0) {
          await sendToTokens(
            tokens,
            '📢 NFO Closing Tomorrow',
            `${closingNFOs.length} NFO(s) closing tomorrow. Don't miss out!`,
            { screen: 'nfo' }
          );
          alerts.push(`NFO reminder sent to ${tokens.length} devices`);
        }
      }
    }

    // 5. Breaking News Alert (triggered by news importance, not time-based)
    // This would be called separately when important news is detected

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
    const { alertType, title, message, data } = body;

    if (!alertType || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'alertType, title, and message are required' },
        { status: 400 }
      );
    }

    const tokens = await getTokensWithPreference(alertType);
    
    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No devices to notify',
        sent: 0,
      });
    }

    const result = await sendToTokens(tokens, title, message, data);

    return NextResponse.json({
      success: true,
      sent: result.success,
      failed: result.failure,
      total: tokens.length,
    });

  } catch (error) {
    console.error('Manual alert error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send alert' },
      { status: 500 }
    );
  }
}
