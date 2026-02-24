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

-- Fast "was a market_pulse sent today?" lookup
CREATE INDEX IF NOT EXISTS idx_notif_ledger_pulse_today
  ON notification_ledger (type, (sent_at::date))
  WHERE type = 'market_pulse';

-- Fast per-user eod_pulse dedup
CREATE INDEX IF NOT EXISTS idx_notif_ledger_eod_today
  ON notification_ledger (user_id, type, (sent_at::date))
  WHERE type = 'eod_pulse';
