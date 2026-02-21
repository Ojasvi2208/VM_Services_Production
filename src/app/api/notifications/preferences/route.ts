import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// Notification preference types
const NOTIFICATION_TYPES = [
  'market_open',
  'market_close',
  'nfo_alert',
  'price_alert',
  'news_alert',
  'portfolio_update',
  'daily_briefing',
];

// Get user notification preferences
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const deviceToken = searchParams.get('deviceToken');

    if (!userId && !deviceToken) {
      return NextResponse.json(
        { success: false, error: 'userId or deviceToken is required' },
        { status: 400 }
      );
    }

    let result;
    if (userId) {
      result = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );
    } else {
      result = await pool.query(
        'SELECT * FROM notification_preferences WHERE device_token = $1',
        [deviceToken]
      );
    }

    if (result.rows.length === 0) {
      // Return default preferences
      return NextResponse.json({
        success: true,
        preferences: {
          market_open: true,
          market_close: true,
          nfo_alert: true,
          price_alert: true,
          news_alert: true,
          portfolio_update: true,
          daily_briefing: true,
        },
        isDefault: true,
      });
    }

    return NextResponse.json({
      success: true,
      preferences: result.rows[0].preferences,
      isDefault: false,
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get preferences' },
      { status: 500 }
    );
  }
}

// Update user notification preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, deviceToken, preferences } = body;

    if (!userId && !deviceToken) {
      return NextResponse.json(
        { success: false, error: 'userId or deviceToken is required' },
        { status: 400 }
      );
    }

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Preferences object is required' },
        { status: 400 }
      );
    }

    // Validate preference keys
    const validPreferences: Record<string, boolean> = {};
    for (const type of NOTIFICATION_TYPES) {
      validPreferences[type] = preferences[type] !== false; // Default to true
    }

    // Upsert preferences
    if (userId) {
      await pool.query(`
        INSERT INTO notification_preferences (user_id, preferences, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET preferences = $2, updated_at = NOW()
      `, [userId, JSON.stringify(validPreferences)]);
    } else {
      await pool.query(`
        INSERT INTO notification_preferences (device_token, preferences, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (device_token) 
        DO UPDATE SET preferences = $2, updated_at = NOW()
      `, [deviceToken, JSON.stringify(validPreferences)]);
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences updated',
      preferences: validPreferences,
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
