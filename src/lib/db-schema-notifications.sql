-- Notifications Database Schema for Vijay Malik Financial Services

-- Device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id SERIAL PRIMARY KEY,
    device_token VARCHAR(500) UNIQUE NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Location tracking for targeted fuel/weather notifications
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS last_known_state VARCHAR(100);
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS last_known_city VARCHAR(100);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_device_tokens_state ON device_tokens(last_known_state);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    device_token VARCHAR(500) UNIQUE,
    preferences JSONB DEFAULT '{
        "market_open": true,
        "market_close": true,
        "nfo_alert": true,
        "price_alert": true,
        "news_alert": true,
        "portfolio_update": true,
        "daily_briefing": true,
        "fuel_alert": true
    }',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Notification logs for analytics
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    tokens_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);

-- Price alerts set by users
CREATE TABLE IF NOT EXISTS price_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_token VARCHAR(500),
    symbol VARCHAR(50) NOT NULL,
    symbol_type VARCHAR(20) NOT NULL CHECK (symbol_type IN ('stock', 'index', 'fund')),
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('above', 'below', 'change_percent')),
    target_value DECIMAL(15, 4) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for price alert checks
CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON price_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = TRUE;

-- NFO watchlist for reminders
CREATE TABLE IF NOT EXISTS nfo_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_token VARCHAR(500),
    nfo_id VARCHAR(100) NOT NULL,
    scheme_name VARCHAR(255) NOT NULL,
    close_date DATE NOT NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for NFO reminder queries
CREATE INDEX IF NOT EXISTS idx_nfo_watchlist_close_date ON nfo_watchlist(close_date);
