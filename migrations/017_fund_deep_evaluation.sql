-- Migration 017: Aladdin Deep Evaluation — Proactive Fund Intelligence
-- Purpose: Pre-compute fund quality evaluations and portfolio suggestions during daily cron,
--          so the mobile app can display proactive insights instantly (<50ms) instead of
--          relying on on-demand Gemini calls that fail under rate limits.

-- Three pathways:
--   1. ALIGNED — linked funds are high quality & match glide path
--   2. NEEDS_ATTENTION — linked funds have quality issues or allocation drift
--   3. NEEDS_PORTFOLIO — no funds linked, or all funds score poorly → full Aladdin blueprint

CREATE TABLE IF NOT EXISTS goal_portfolio_evaluations (
  id                SERIAL PRIMARY KEY,
  goal_id           UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,

  -- Pathway verdict
  verdict           VARCHAR(20) NOT NULL,         -- 'aligned', 'needs_attention', 'needs_portfolio'
  verdict_reason    TEXT NOT NULL,                 -- Human-readable explanation

  -- Composite portfolio health score (0-100)
  portfolio_score   DECIMAL(5,2),                 -- Weighted average of linked fund health scores

  -- Fund-level evaluations (JSONB array of per-fund health reports)
  fund_evaluations  JSONB NOT NULL DEFAULT '[]',  -- [{scheme_code, fund_name, health_score, breakdown, issues}]

  -- Suggested changes (if verdict = needs_attention or needs_portfolio)
  suggestions       JSONB NOT NULL DEFAULT '[]',  -- [{type: 'swap'|'add'|'remove'|'rebalance', ...details}]

  -- Aladdin recommendation (if verdict = needs_portfolio)
  recommendation    JSONB,                        -- Full PortfolioRecommendation JSON (same as ai_archetypes)

  -- Context factors used in evaluation
  macro_context     JSONB,                        -- {nifty_pe, fii_flow, gold_trend, crude_trend, inr_trend}
  glide_path        JSONB,                        -- {equity_pct, debt_pct, hybrid_pct}
  actual_allocation JSONB,                        -- {equity_pct, debt_pct, hybrid_pct} — what the user actually has

  -- Metadata
  engine            VARCHAR(20) DEFAULT 'quantitative',  -- 'quantitative', 'gemini_enhanced', 'cached'
  evaluated_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day',  -- Re-evaluate daily

  -- Dedup: one evaluation per goal per day
  eval_date         DATE DEFAULT CURRENT_DATE,
  UNIQUE(goal_id, eval_date)
);

-- Fast lookup by goal (Android app queries this)
CREATE INDEX IF NOT EXISTS idx_gpe_goal ON goal_portfolio_evaluations(goal_id, eval_date DESC);
-- User-level rollup
CREATE INDEX IF NOT EXISTS idx_gpe_user ON goal_portfolio_evaluations(user_id, eval_date DESC);
-- Cleanup
CREATE INDEX IF NOT EXISTS idx_gpe_expires ON goal_portfolio_evaluations(expires_at);

COMMENT ON TABLE goal_portfolio_evaluations IS 'Pre-computed fund quality evaluations. Three verdicts: aligned (portfolio is good), needs_attention (swap/rebalance suggestions), needs_portfolio (full Aladdin blueprint). Computed daily in evaluate-goals cron.';
COMMENT ON COLUMN goal_portfolio_evaluations.fund_evaluations IS 'Array of per-fund health reports: [{scheme_code, fund_name, health_score (0-100), breakdown: {return_score, risk_score, drawdown_score, cost_score, size_score, tenure_score}, issues: [string]}]';
COMMENT ON COLUMN goal_portfolio_evaluations.suggestions IS 'Actionable changes: [{type, from_scheme_code, to_scheme_code, to_fund_name, reason, impact_estimate}]';
