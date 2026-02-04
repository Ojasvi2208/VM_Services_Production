import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { sendPasswordResetOTP, generateOTP } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // Find user by email
      const userResult = await client.query(
        'SELECT id, full_name, email FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if email exists or not for security
        return NextResponse.json({ 
          success: true, 
          message: 'If an account exists with this email, you will receive an OTP.' 
        });
      }

      const user = userResult.rows[0];
      
      // Generate 6-digit OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      // Create password_reset_otp table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_reset_otp (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          otp VARCHAR(6) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          attempts INTEGER DEFAULT 0,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Delete any existing OTPs for this user
      await client.query(
        'DELETE FROM password_reset_otp WHERE user_id = $1',
        [user.id]
      );

      // Insert new OTP
      await client.query(
        'INSERT INTO password_reset_otp (user_id, otp, expires_at) VALUES ($1, $2, $3)',
        [user.id, otp, expiresAt]
      );

      // Send OTP email
      const emailSent = await sendPasswordResetOTP(user.email, user.full_name || 'User', otp);
      if (!emailSent) {
        console.error('Failed to send OTP email to:', user.email);
        // Still continue - don't reveal email issues to user for security
      }

      // Mask email for security (e.g., oj***@outlook.com)
      const emailParts = user.email.split('@');
      const localPart = emailParts[0];
      const domain = emailParts[1];
      const maskedLocal = localPart.length > 2 
        ? localPart.substring(0, 2) + '*'.repeat(Math.min(localPart.length - 2, 5))
        : localPart[0] + '*';
      const maskedEmail = `${maskedLocal}@${domain}`;

      return NextResponse.json({ 
        success: true, 
        message: 'OTP sent successfully',
        maskedEmail, // Return masked email for display
        emailVerified: true // Indicates email exists in DB
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: `Failed to process request: ${errorMessage}` 
    }, { status: 500 });
  }
}

// Verify OTP
export async function PUT(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // Find user by email
      const userResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
      }

      const userId = userResult.rows[0].id;

      // Find valid OTP
      const otpResult = await client.query(
        `SELECT id, otp, expires_at, attempts FROM password_reset_otp 
         WHERE user_id = $1 AND used = FALSE 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (otpResult.rows.length === 0) {
        return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
      }

      const otpRecord = otpResult.rows[0];

      // Check if expired
      if (new Date() > new Date(otpRecord.expires_at)) {
        return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
      }

      // Check attempts (max 5)
      if (otpRecord.attempts >= 5) {
        return NextResponse.json({ error: 'Too many attempts. Please request a new OTP.' }, { status: 400 });
      }

      // Verify OTP
      if (otpRecord.otp !== otp) {
        // Increment attempts
        await client.query(
          'UPDATE password_reset_otp SET attempts = attempts + 1 WHERE id = $1',
          [otpRecord.id]
        );
        return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 400 });
      }

      // OTP is valid - generate a reset token for the password change step
      const crypto = await import('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Store reset token temporarily (valid for 5 minutes)
      await client.query(
        `UPDATE password_reset_otp SET used = TRUE WHERE id = $1`,
        [otpRecord.id]
      );

      // Create a temporary token for password reset
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
      await client.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, resetToken, new Date(Date.now() + 5 * 60 * 1000)]
      );

      return NextResponse.json({ 
        success: true, 
        message: 'OTP verified successfully',
        resetToken // Return token for password reset step
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json({ 
      error: 'Failed to verify OTP. Please try again.' 
    }, { status: 500 });
  }
}
