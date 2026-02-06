import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Firebase Cloud Messaging configuration
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;
const FCM_API_URL = 'https://fcm.googleapis.com/fcm/send';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  badge?: number;
  sound?: string;
}

interface SendNotificationRequest {
  type: 'single' | 'topic' | 'all';
  userId?: number;
  deviceToken?: string;
  topic?: string;
  notification: NotificationPayload;
}

// Send push notification via FCM
async function sendFCMNotification(
  tokens: string[],
  notification: NotificationPayload
): Promise<{ success: number; failure: number }> {
  if (!FCM_SERVER_KEY) {
    console.log('FCM_SERVER_KEY not configured, skipping push notification');
    return { success: 0, failure: tokens.length };
  }

  let success = 0;
  let failure = 0;

  // Send to each token (batch in production)
  for (const token of tokens) {
    try {
      const response = await fetch(FCM_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `key=${FCM_SERVER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title: notification.title,
            body: notification.body,
            image: notification.imageUrl,
            sound: notification.sound || 'default',
            badge: notification.badge,
          },
          data: notification.data || {},
          priority: 'high',
          content_available: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success === 1) {
          success++;
        } else {
          failure++;
          // Remove invalid tokens
          if (result.results?.[0]?.error === 'NotRegistered') {
            await pool.query('DELETE FROM device_tokens WHERE device_token = $1', [token]);
          }
        }
      } else {
        failure++;
      }
    } catch (error) {
      console.error('FCM send error:', error);
      failure++;
    }
  }

  return { success, failure };
}

// Send notification endpoint
export async function POST(request: NextRequest) {
  try {
    // Verify admin/cron secret for security
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
    
    if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SendNotificationRequest = await request.json();
    const { type, userId, deviceToken, topic, notification } = body;

    if (!notification?.title || !notification?.body) {
      return NextResponse.json(
        { success: false, error: 'Notification title and body are required' },
        { status: 400 }
      );
    }

    let tokens: string[] = [];

    switch (type) {
      case 'single':
        if (deviceToken) {
          tokens = [deviceToken];
        } else if (userId) {
          const result = await pool.query(
            'SELECT device_token FROM device_tokens WHERE user_id = $1',
            [userId]
          );
          tokens = result.rows.map(r => r.device_token);
        }
        break;

      case 'topic':
        // For topic-based notifications, use FCM topics
        // This requires subscribing devices to topics
        if (!topic) {
          return NextResponse.json(
            { success: false, error: 'Topic is required for topic notifications' },
            { status: 400 }
          );
        }
        // Topic notifications are sent differently via FCM
        // For now, we'll fetch all tokens (in production, use FCM topics)
        const topicResult = await pool.query('SELECT device_token FROM device_tokens');
        tokens = topicResult.rows.map(r => r.device_token);
        break;

      case 'all':
        const allResult = await pool.query('SELECT device_token FROM device_tokens');
        tokens = allResult.rows.map(r => r.device_token);
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid notification type' },
          { status: 400 }
        );
    }

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No devices to notify',
        sent: 0,
      });
    }

    // Send notifications
    const result = await sendFCMNotification(tokens, notification);

    // Log notification
    await pool.query(`
      INSERT INTO notification_logs (type, title, body, tokens_count, success_count, failure_count, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [type, notification.title, notification.body, tokens.length, result.success, result.failure]);

    return NextResponse.json({
      success: true,
      message: 'Notifications sent',
      sent: result.success,
      failed: result.failure,
      total: tokens.length,
    });

  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
