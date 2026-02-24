-- Migration 011: Notification Governor
-- Per-user notification audit ledger and DND queue for rate-limited, fatigue-aware push dispatch

-- Append-only audit trail for all sent notifications
CREATE TABLE IF NOT EXISTS notification_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL CHECK (category IN ('TRANSACTIONAL', 'MARKETING')),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  deep_link VARCHAR(255),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_ledger_user_cat ON notification_ledger(user_id, category, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_ledger_sent_at ON notification_ledger(sent_at DESC);

-- DND queue: notifications generated between 11 PM and 6:30 AM IST
CREATE TABLE IF NOT EXISTS notification_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  deep_link VARCHAR(255),
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  flushed BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notif_queue_pending ON notification_queue(flushed) WHERE flushed = false;
