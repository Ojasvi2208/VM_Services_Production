import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// One-time migration: add location columns if missing
let migrationRan = false;
async function ensureLocationColumns() {
  if (migrationRan) return;
  try {
    await pool.query(`
      ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS last_known_state VARCHAR(100);
      ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS last_known_city VARCHAR(100);
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_device_tokens_state ON device_tokens(last_known_state)`);
    migrationRan = true;
  } catch (e) {
    // Table may not exist yet — skip silently
    console.log('Migration note:', (e as Error).message);
  }
}

// Register device token for push notifications
export async function POST(request: NextRequest) {
  try {
    await ensureLocationColumns();

    const body = await request.json();
    const { deviceToken, platform, userId, state, city } = body;

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

    // Upsert device token with optional location
    await pool.query(`
      INSERT INTO device_tokens (device_token, platform, user_id, last_known_state, last_known_city, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (device_token)
      DO UPDATE SET
        platform = EXCLUDED.platform,
        user_id = COALESCE(EXCLUDED.user_id, device_tokens.user_id),
        last_known_state = COALESCE(EXCLUDED.last_known_state, device_tokens.last_known_state),
        last_known_city = COALESCE(EXCLUDED.last_known_city, device_tokens.last_known_city),
        updated_at = NOW()
    `, [deviceToken, platform, userId || null, state || null, city || null]);

    console.log(`Device registered: ${platform} - ${deviceToken.substring(0, 20)}... [${state || 'no-state'}/${city || 'no-city'}]`);

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
