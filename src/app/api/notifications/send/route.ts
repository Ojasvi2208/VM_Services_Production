import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { sendPushNotificationBatch, isFirebaseConfigured } from '@/lib/firebase-admin';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface SendNotificationRequest {
  type: 'single' | 'topic' | 'all';
  userId?: number;
  deviceToken?: string;
  topic?: string;
  notification: NotificationPayload;
}

// Send push notifications using Firebase Admin SDK
async function sendFCMNotification(
  tokens: string[],
  notification: NotificationPayload
): Promise<{ success: number; failure: number }> {
  if (!isFirebaseConfigured()) {
    console.log('Firebase not configured, skipping push notification');
    return { success: 0, failure: tokens.length };
  }

  const result = await sendPushNotificationBatch(
    tokens,
    notification.title,
    notification.body,
    notification.data
  );

  // Remove invalid tokens from database
  if (result.invalidTokens.length > 0) {
    for (const token of result.invalidTokens) {
      await pool.query('DELETE FROM device_tokens WHERE device_token = $1', [token]);
    }
    console.log(`Removed ${result.invalidTokens.length} invalid tokens`);
  }

  return { success: result.success, failure: result.failure };
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
