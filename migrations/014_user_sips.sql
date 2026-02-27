-- Migration 014: User SIP Discovery
-- Captures active SIP intent per fund per user.
-- Populated via the SIP Discovery Wizard after CAS import.
-- Idempotent: ON CONFLICT (user_id, fund_scheme_code) → UPDATE.

CREATE TABLE IF NOT EXISTS user_sips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fund_scheme_code  VARCHAR(20) NOT NULL,
  fund_name         TEXT NOT NULL,
  amount            DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  deduction_date    INTEGER NOT NULL CHECK (deduction_date BETWEEN 1 AND 31),
  frequency         VARCHAR(20) NOT NULL DEFAULT 'Monthly',
  start_date        DATE,
  end_date          DATE,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for idempotent upserts (one SIP entry per user per fund)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sips_user_fund
  ON user_sips (user_id, fund_scheme_code);

-- Fast retrieval for Goal Proximity calculations
CREATE INDEX IF NOT EXISTS idx_user_sips_user_active
  ON user_sips (user_id) WHERE is_active = true;

-- Fund-level aggregation
CREATE INDEX IF NOT EXISTS idx_user_sips_fund
  ON user_sips (fund_scheme_code);
