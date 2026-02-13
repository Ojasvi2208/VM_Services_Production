import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateOTP } from '@/lib/email';
import { otpStore } from '@/lib/otp-store';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, type = 'signin' } = body; // type: 'signin' | 'signup' | 'reset'

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Rate limiting - max 3 OTPs per email per 10 minutes
    if (await otpStore.isRateLimited(email)) {
      return NextResponse.json(
        { success: false, error: 'Too many OTP requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Check if user exists for signin, or doesn't exist for signup
    const result = await pool.query(
      'SELECT id, full_name, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const existingUser = result.rows;

    if (type === 'signup' && existingUser.length > 0) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Please sign in.' },
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP (10 minute expiry)
    await otpStore.set(email, otp, 10);

    // Send OTP email
    const userName = existingUser[0]?.full_name || 'User';
    const emailSent = await sendOTPEmail(email, userName, otp, type);

    if (!emailSent) {
      return NextResponse.json(
        { success: false, error: 'Failed to send OTP. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: 600, // 10 minutes in seconds
      isNewUser: existingUser.length === 0,
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}

async function sendOTPEmail(email: string, userName: string, otp: string, type: string): Promise<boolean> {
  const subject = type === 'signup' 
    ? 'Verify Your Email - VM Financial Services'
    : type === 'reset'
    ? 'Password Reset OTP - VM Financial Services'
    : 'Sign In OTP - VM Financial Services';

  const actionText = type === 'signup'
    ? 'complete your registration'
    : type === 'reset'
    ? 'reset your password'
    : 'sign in to your account';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #18181B 0%, #14B8A6 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                VM Financial Services
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi ${userName},<br><br>
                Use this OTP to ${actionText}:
              </p>
              
              <!-- OTP Box -->
              <div style="text-align: center; margin: 32px 0;">
                <div style="display: inline-block; background: #f8fafc; border: 2px solid #14B8A6; border-radius: 12px; padding: 20px 40px;">
                  <p style="margin: 0; color: #18181B; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">${otp}</p>
                </div>
              </div>
              
              <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                  ⏱ <strong>Expires in 10 minutes</strong><br>
                  Do not share this OTP with anyone.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin: 20px 0 0;">
                If you didn't request this, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                VM Financial Services | ARN 317605
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({ to: email, subject, html });
}

