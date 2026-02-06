import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Register device token for push notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceToken, platform, userId } = body;

    if (!deviceToken || !platform) {
      return NextResponse.json(
        { success: false, error: 'Device token and platform are required' },
        { status: 400 }
      );
    }

    // Validate platform
    if (!['ios', 'android', 'web'].includes(platform)) {
      return NextResponse.json(
        { success: false, error: 'Invalid platform. Must be ios, android, or web' },
        { status: 400 }
      );
    }

    // Upsert device token
    await pool.query(`
      INSERT INTO device_tokens (device_token, platform, user_id, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (device_token) 
      DO UPDATE SET 
        platform = EXCLUDED.platform,
        user_id = EXCLUDED.user_id,
        updated_at = NOW()
    `, [deviceToken, platform, userId || null]);

    console.log(`Device registered: ${platform} - ${deviceToken.substring(0, 20)}...`);

    return NextResponse.json({
      success: true,
      message: 'Device registered for notifications',
    });

  } catch (error) {
    console.error('Device registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register device' },
      { status: 500 }
    );
  }
}

// Unregister device token
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceToken = searchParams.get('token');

    if (!deviceToken) {
      return NextResponse.json(
        { success: false, error: 'Device token is required' },
        { status: 400 }
      );
    }

    await pool.query(
      'DELETE FROM device_tokens WHERE device_token = $1',
      [deviceToken]
    );

    return NextResponse.json({
      success: true,
      message: 'Device unregistered',
    });

  } catch (error) {
    console.error('Device unregistration error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unregister device' },
      { status: 500 }
    );
  }
}
