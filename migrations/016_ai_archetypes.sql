-- Migration 016: Aladdin Archetype Cache (O(1) Cache-First AI)
-- Purpose: Cache Gemini portfolio recommendations by user archetype to reduce API calls,
--          handle rate limits, and provide instant responses for common user profiles.

-- The cache key is a hash of: AgeBucket + RiskProfile + TenureBucket
-- This maps ~infinite user combinations to a finite set of archetypes (~45 buckets)

CREATE TABLE IF NOT EXISTS ai_archetypes (
  id            SERIAL PRIMARY KEY,
  archetype_key VARCHAR(64) NOT NULL UNIQUE,  -- e.g. "30s_moderate_medium"
  age_bucket    VARCHAR(10) NOT NULL,          -- "20s", "30s", "40s", "50s", "60s+"
  risk_profile  VARCHAR(20) NOT NULL,          -- "conservative", "moderate", "aggressive"
  tenure_bucket VARCHAR(20) NOT NULL,          -- "ultra_short", "short", "medium", "long", "very_long"
  recommendation JSONB NOT NULL,               -- Full PortfolioRecommendation JSON (percentage-based)
  hit_count     INT DEFAULT 0,                 -- Analytics: how often this archetype is served
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'  -- Monthly refresh cycle
);

-- O(1) lookup by archetype hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_archetype_key ON ai_archetypes(archetype_key);

-- Cleanup index for expired entries
CREATE INDEX IF NOT EXISTS idx_archetype_expires ON ai_archetypes(expires_at);

-- Comment for documentation
COMMENT ON TABLE ai_archetypes IS 'O(1) cache for Aladdin portfolio recommendations. Key = AgeBucket_RiskProfile_TenureBucket. Recommendations stored as percentage allocations, scaled dynamically to user SIP amount at serve time.';
COMMENT ON COLUMN ai_archetypes.archetype_key IS 'Deterministic hash: e.g. 30s_moderate_medium';
COMMENT ON COLUMN ai_archetypes.recommendation IS 'Gemini PortfolioRecommendation JSON with allocation_percentage (not absolute SIP amounts)';
COMMENT ON COLUMN ai_archetypes.hit_count IS 'Incremented on every cache hit for analytics';
