import { cookies, headers } from 'next/headers';
import pool from './postgres-db';
import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'vmfs_session';
const SESSION_DURATION_DAYS = 30;

// Hash password using SHA-256 with salt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Verify password
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Generate session token
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create session in database
export async function createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await pool.query(
    `INSERT INTO user_sessions (user_id, token, expires_at, ip_address, user_agent) 
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, token, expiresAt, ipAddress, userAgent]
  );

  return token;
}

// Get user from session token
export async function getUserFromSession(token: string): Promise<any | null> {
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.created_at, u.email_verified,
            u.is_premium, u.premium_expires_at,
            u.income_range, u.occupation_type, u.tax_regime, u.pan_status
     FROM users u
     JOIN user_sessions s ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = true`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

// Verify JWT token (from verify-otp endpoint, used by mobile app)
function verifyJWT(token: string): { userId: number; email: string } | null {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'vm-financial-secret-key-change-in-production';
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

// Get user from JWT token (mobile app auth)
async function getUserFromJWT(token: string): Promise<any | null> {
  const payload = verifyJWT(token);
  if (!payload) return null;
  const result = await pool.query(
    'SELECT id, email, full_name, phone, created_at, email_verified, is_premium, premium_expires_at, income_range, occupation_type, tax_regime, pan_status FROM users WHERE id = $1 AND is_active = true',
    [payload.userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Get current user from cookies (website) OR Authorization header (mobile app)
export async function getCurrentUser(): Promise<any | null> {
  try {
    // Try cookie first (website)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (sessionCookie?.value) {
      return await getUserFromSession(sessionCookie.value);
    }

    // Try Authorization: Bearer header (mobile app)
    const headerStore = await headers();
    const authHeader = headerStore.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Try as session token first
      const sessionUser = await getUserFromSession(token);
      if (sessionUser) return sessionUser;
      // Try as JWT token (from verify-otp)
      return await getUserFromJWT(token);
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Delete session
export async function deleteSession(token: string): Promise<void> {
  await pool.query('DELETE FROM user_sessions WHERE token = $1', [token]);
}

// Delete all sessions for user
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  await pool.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
}

// User registration
export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  phone?: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return { success: false, error: 'Email already registered' };
    }

    // Hash password and create user
    const passwordHash = hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [email.toLowerCase(), passwordHash, fullName, phone]
    );

    return { success: true, userId: result.rows[0].id };
  } catch (error: any) {
    console.error('Registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

// User login
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, full_name, phone, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid email or password' };
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return { success: false, error: 'Account is deactivated' };
    }

    if (!verifyPassword(password, user.password_hash)) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone
      }
    };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

export { SESSION_COOKIE_NAME };
