import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { resetToken, newPassword } = await request.json();

    if (!resetToken || !newPassword) {
      return NextResponse.json({ error: 'Reset token and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // Find valid reset token
      const tokenResult = await client.query(
        `SELECT user_id, expires_at FROM password_reset_tokens 
         WHERE token = $1 AND used = FALSE`,
        [resetToken]
      );

      if (tokenResult.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
      }

      const tokenRecord = tokenResult.rows[0];

      // Check if expired
      if (new Date() > new Date(tokenRecord.expires_at)) {
        return NextResponse.json({ error: 'Reset token has expired. Please start over.' }, { status: 400 });
      }

      // Hash new password using existing auth function
      const hashedPassword = hashPassword(newPassword);

      // Update user password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, tokenRecord.user_id]
      );

      // Mark token as used
      await client.query(
        'UPDATE password_reset_tokens SET used = TRUE WHERE token = $1',
        [resetToken]
      );

      // Clean up old tokens and OTPs for this user
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [tokenRecord.user_id]);
      await client.query('DELETE FROM password_reset_otp WHERE user_id = $1', [tokenRecord.user_id]);

      return NextResponse.json({ 
        success: true, 
        message: 'Password reset successfully. You can now sign in with your new password.'
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ 
      error: 'Failed to reset password. Please try again.' 
    }, { status: 500 });
  }
}
