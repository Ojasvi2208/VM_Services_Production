// OTP Store using PostgreSQL — survives Vercel serverless cold starts
import pool from './postgres-db';

class OTPStore {

  // Ensure table exists (called once per cold start)
  private initialized = false;
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS otp_store (
          email VARCHAR(255) PRIMARY KEY,
          otp VARCHAR(6) NOT NULL,
          expires_at BIGINT NOT NULL,
          attempts INT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.initialized = true;
    } catch (e) {
      console.error('OTP table init error:', e);
    }
  }

  async set(email: string, otp: string, ttlMinutes: number = 10): Promise<void> {
    await this.ensureTable();
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    await pool.query(`
      INSERT INTO otp_store (email, otp, expires_at, attempts)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (email) DO UPDATE SET
        otp = $2, expires_at = $3, attempts = otp_store.attempts + 1
    `, [email.toLowerCase(), otp, expiresAt]);
  }

  async verify(email: string, otp: string): Promise<{ valid: boolean; error?: string }> {
    await this.ensureTable();
    const result = await pool.query(
      'SELECT otp, expires_at FROM otp_store WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
    }

    const data = result.rows[0];

    if (parseInt(data.expires_at) < Date.now()) {
      await pool.query('DELETE FROM otp_store WHERE email = $1', [email.toLowerCase()]);
      return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }

    if (data.otp !== otp) {
      return { valid: false, error: 'Invalid OTP. Please try again.' };
    }

    // OTP verified — clear it
    await pool.query('DELETE FROM otp_store WHERE email = $1', [email.toLowerCase()]);
    return { valid: true };
  }

  async isRateLimited(email: string): Promise<boolean> {
    await this.ensureTable();
    const result = await pool.query(
      'SELECT attempts, expires_at FROM otp_store WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return false;
    const data = result.rows[0];
    return data.attempts >= 3 && parseInt(data.expires_at) > Date.now();
  }

  async delete(email: string): Promise<void> {
    await this.ensureTable();
    await pool.query('DELETE FROM otp_store WHERE email = $1', [email.toLowerCase()]);
  }
}

// Singleton instance
export const otpStore = new OTPStore();
