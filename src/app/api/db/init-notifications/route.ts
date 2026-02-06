import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// One-time endpoint to create notification tables
// DELETE THIS FILE AFTER RUNNING ONCE
export async function GET(request: NextRequest) {
  // Simple security - require a secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== 'vmfinancial2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create device_tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id SERIAL PRIMARY KEY,
        device_token VARCHAR(500) UNIQUE NOT NULL,
        platform VARCHAR(20) NOT NULL,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create notification_preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE,
        device_token VARCHAR(500) UNIQUE,
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create notification_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        tokens_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);
      CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);
    `);

    return NextResponse.json({
      success: true,
      message: 'Notification tables created successfully',
      tables: ['device_tokens', 'notification_preferences', 'notification_logs'],
    });

  } catch (error: any) {
    console.error('DB init error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
