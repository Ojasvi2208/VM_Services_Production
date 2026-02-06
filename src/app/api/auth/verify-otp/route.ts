import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';
import { sendWelcomeEmail } from '@/lib/email';
import { otpStore } from '@/lib/otp-store';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// JWT secret for token generation
const JWT_SECRET = process.env.JWT_SECRET || 'vm-financial-secret-key-change-in-production';

function generateToken(userId: number, email: string): string {
  const payload = {
    userId,
    email,
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  
  return `${header}.${body}.${signature}`;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, type = 'signin', fullName, password } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Verify OTP
    const verification = otpStore.verify(email, otp);
    
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: verification.error },
        { status: 400 }
      );
    }

    // Handle based on type
    if (type === 'signup') {
      // Create new user
      if (!fullName) {
        return NextResponse.json(
          { success: false, error: 'Full name is required for signup' },
          { status: 400 }
        );
      }

      // Check if user already exists
      const existingResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingResult.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Account already exists. Please sign in.' },
          { status: 400 }
        );
      }

      // Create user (password is optional for OTP-based auth)
      const hashedPassword = password ? hashPassword(password) : null;
      
      const insertResult = await pool.query(
        `INSERT INTO users (email, full_name, password_hash, email_verified, created_at)
         VALUES ($1, $2, $3, true, NOW())
         RETURNING id, email, full_name`,
        [email.toLowerCase(), fullName, hashedPassword]
      );

      const newUser = insertResult.rows[0];
      const token = generateToken(newUser.id, newUser.email);

      // Send welcome email (non-blocking)
      sendWelcomeEmail(newUser.email, newUser.full_name).catch(console.error);

      return NextResponse.json({
        success: true,
        message: 'Account created successfully',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.full_name,
        },
      });

    } else {
      // Sign in existing user
      const userResult = await pool.query(
        'SELECT id, email, full_name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Account not found. Please sign up first.' },
          { status: 404 }
        );
      }

      const user = userResult.rows[0];
      const token = generateToken(user.id, user.email);

      // Update last login
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      return NextResponse.json({
        success: true,
        message: 'Signed in successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
        },
      });
    }

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}

