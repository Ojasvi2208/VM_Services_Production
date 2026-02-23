-- ============================================================
--  Migration 009: Set premium status for test user
--
--  Sets ojasvi.malik@outlook.com as CFO Suite premium user
--  with 1-year expiration for testing premium features.
-- ============================================================

UPDATE users
SET is_premium = true,
    premium_expires_at = NOW() + INTERVAL '1 year'
WHERE email = 'ojasvi.malik@outlook.com';
