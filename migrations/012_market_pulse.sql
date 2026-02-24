-- Migration 012: Behavioral Market Pulse Engine
-- 1. market_pulse_state: daily dedup sentinel for volatility triggers
-- 2. Partial indexes on notification_ledger for fast pulse/eod_pulse lookups

CREATE TABLE IF NOT EXISTS market_pulse_state (
  id            SERIAL PRIMARY KEY,
  check_date    DATE NOT NULL UNIQUE,
  nifty_change  DECIMAL(6,3) NOT NULL,
  direction     VARCHAR(8) NOT NULL CHECK (direction IN ('positive', 'negative')),
  triggered_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Partial indexes for fast pulse/eod_pulse lookups on notification_ledger
-- (Dedup for market_pulse uses market_pulse_state table; these are for analytics)
CREATE INDEX IF NOT EXISTS idx_notif_ledger_pulse
  ON notification_ledger (type, sent_at DESC)
  WHERE type = 'market_pulse';

CREATE INDEX IF NOT EXISTS idx_notif_ledger_eod
  ON notification_ledger (user_id, type, sent_at DESC)
  WHERE type = 'eod_pulse';
