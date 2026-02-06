// Shared OTP Store for authentication
// In production, use Redis for distributed systems

interface OTPData {
  otp: string;
  expiresAt: number;
  attempts: number;
}

class OTPStore {
  private store = new Map<string, OTPData>();

  constructor() {
    // Clean up expired OTPs every minute
    setInterval(() => this.cleanup(), 60000);
  }

  set(email: string, otp: string, ttlMinutes: number = 10): void {
    const existing = this.store.get(email.toLowerCase());
    this.store.set(email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
      attempts: (existing?.attempts || 0) + 1,
    });
  }

  get(email: string): OTPData | undefined {
    return this.store.get(email.toLowerCase());
  }

  verify(email: string, otp: string): { valid: boolean; error?: string } {
    const data = this.store.get(email.toLowerCase());

    if (!data) {
      return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
    }

    if (data.expiresAt < Date.now()) {
      this.store.delete(email.toLowerCase());
      return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }

    if (data.otp !== otp) {
      return { valid: false, error: 'Invalid OTP. Please try again.' };
    }

    // OTP verified - clear it
    this.store.delete(email.toLowerCase());
    return { valid: true };
  }

  isRateLimited(email: string): boolean {
    const data = this.store.get(email.toLowerCase());
    return !!(data && data.attempts >= 3 && data.expiresAt > Date.now());
  }

  delete(email: string): void {
    this.store.delete(email.toLowerCase());
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [email, data] of this.store.entries()) {
      if (data.expiresAt < now) {
        this.store.delete(email);
      }
    }
  }
}

// Singleton instance
export const otpStore = new OTPStore();
