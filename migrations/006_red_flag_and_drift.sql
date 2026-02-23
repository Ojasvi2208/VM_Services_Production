-- ════════════════════════════════════════════════════════════════════
--  Migration 006: Red-Flag Evaluator + Goal-Portfolio Drift Tracker
--
--  1. Premium flag on users table
--  2. Materialized view for category average returns
--  3. Goal-holding links table (partial allocation)
--  4. Goal drift log table
-- ════════════════════════════════════════════════════════════════════

-- ═══ 1. Premium flag on users ═══
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- ═══ 2. Category average returns (materialized view) ═══
-- Aggregates CAGR across all active Direct+Growth funds per category/sub_category.
-- Filtered to categories with ≥3 funds to avoid noisy averages.
-- Refreshed concurrently after daily NAV update.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_avg_returns AS
SELECT
  f.category,
  f.sub_category,
  COUNT(DISTINCT f.scheme_code) as fund_count,
  AVG(fr.cagr_1y) as avg_cagr_1y,
  AVG(fr.cagr_3y) as avg_cagr_3y,
  AVG(fr.cagr_5y) as avg_cagr_5y,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY fr.cagr_1y) as p25_cagr_1y,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fr.cagr_1y) as p75_cagr_1y
FROM funds f
JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
WHERE f.is_active = true
  AND f.plan_type = 'Direct'
  AND f.option_type IN ('Growth', 'Reinvestment')
  AND fr.cagr_1y IS NOT NULL
GROUP BY f.category, f.sub_category
HAVING COUNT(DISTINCT f.scheme_code) >= 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_cat_avg_cat_sub
  ON mv_category_avg_returns (category, sub_category);

-- ═══ 3. Goal-Holding links (partial allocation) ═══
-- Maps portfolio_holdings to goals. A single holding can be split across
-- multiple goals (e.g., 60% Retirement, 40% House Down Payment).
-- Constraint: SUM(allocation_pct) per holding across all goals ≤ 100% (enforced in app).
CREATE TABLE IF NOT EXISTS goal_holding_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  holding_id UUID NOT NULL REFERENCES portfolio_holdings(id) ON DELETE CASCADE,
  allocation_pct DECIMAL(5,2) NOT NULL DEFAULT 100.0
    CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, holding_id)
);

CREATE INDEX IF NOT EXISTS idx_ghl_goal ON goal_holding_links(goal_id);
CREATE INDEX IF NOT EXISTS idx_ghl_holding ON goal_holding_links(holding_id);

-- ═══ 4. Goal drift log ═══
-- Daily snapshot of goal drift calculated at 5 AM IST.
-- drift_pct > 0 means behind target, < 0 means ahead.
CREATE TABLE IF NOT EXISTS goal_drift_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  drift_date DATE NOT NULL,
  current_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  projected_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  target_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  drift_pct DECIMAL(7,2) NOT NULL DEFAULT 0,
  portfolio_cagr DECIMAL(7,2),
  years_remaining DECIMAL(5,2),
  suggested_topup_sip DECIMAL(12,2),
  notification_sent BOOLEAN DEFAULT false,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, drift_date)
);

CREATE INDEX IF NOT EXISTS idx_gdl_goal_date ON goal_drift_log(goal_id, drift_date DESC);
CREATE INDEX IF NOT EXISTS idx_gdl_user ON goal_drift_log(user_id);
