-- Migration 010: Premium Claims Queue
-- Captures UPI payment claims for admin approval before activating premium

CREATE TABLE IF NOT EXISTS premium_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  upi_ref VARCHAR(100),
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  CONSTRAINT chk_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_premium_claims_user ON premium_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_claims_status ON premium_claims(status);
CREATE INDEX IF NOT EXISTS idx_premium_claims_claimed_at ON premium_claims(claimed_at DESC);
