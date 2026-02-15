import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== 'vmfs2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(200) NOT NULL,
          icon VARCHAR(50) DEFAULT 'target',
          color VARCHAR(7) DEFAULT '#6366F1',
          target_amount DECIMAL(15,2) NOT NULL,
          target_date DATE NOT NULL,
          criticality VARCHAR(20) NOT NULL DEFAULT 'important',
          monthly_sip DECIMAL(12,2) DEFAULT 0,
          recommended_sip DECIMAL(12,2) DEFAULT 0,
          inflation_rate DECIMAL(5,2) DEFAULT 6.0,
          expected_return DECIMAL(5,2) DEFAULT 12.0,
          current_value DECIMAL(15,2) DEFAULT 0,
          success_probability DECIMAL(5,2) DEFAULT 0,
          notes TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_goals_criticality ON goals(user_id, criticality)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS goal_fund_links (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
          scheme_code VARCHAR(20) NOT NULL,
          allocation_pct DECIMAL(5,2) DEFAULT 100,
          created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_goal_funds ON goal_fund_links(goal_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS goal_contributions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          contribution_date DATE NOT NULL,
          source VARCHAR(50) DEFAULT 'manual',
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_goal ON goal_contributions(goal_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_user ON goal_contributions(user_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS goal_projections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
          success_probability DECIMAL(5,2),
          projected_value_p10 DECIMAL(15,2),
          projected_value_p50 DECIMAL(15,2),
          projected_value_p90 DECIMAL(15,2),
          shortfall_amount DECIMAL(15,2),
          recommended_sip_increase DECIMAL(12,2),
          simulations_run INT DEFAULT 10000,
          inflation_scenario VARCHAR(20) DEFAULT 'base',
          computed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_projections_goal ON goal_projections(goal_id)`);

    // ── Autonomous Evaluation Engine tables ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS goal_evaluations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          gbm_success_probability DECIMAL(5,2),
          gbm_p10 DECIMAL(15,2), gbm_p25 DECIMAL(15,2), gbm_p50 DECIMAL(15,2),
          gbm_p75 DECIMAL(15,2), gbm_p90 DECIMAL(15,2), gbm_mean DECIMAL(15,2),
          gbm_shortfall DECIMAL(15,2), gbm_volatility_used DECIMAL(5,2),
          gbm_simulations INT DEFAULT 10000,
          portfolio_value_at_eval DECIMAL(15,2),
          monthly_sip_at_eval DECIMAL(12,2),
          months_remaining INT,
          portfolio_drift_pct DECIMAL(5,4) DEFAULT 0,
          flag VARCHAR(10) NOT NULL DEFAULT 'green',
          flag_reason TEXT, suggested_action TEXT,
          rebalance_amount DECIMAL(12,2), extension_months INT, topup_amount DECIMAL(12,2),
          confidence_score DECIMAL(5,2),
          disclosure_text TEXT,
          gemini_tokens_used INT DEFAULT 0,
          gemini_skipped BOOLEAN DEFAULT false,
          skip_reason VARCHAR(100),
          evaluated_at TIMESTAMPTZ DEFAULT NOW(),
          nav_date DATE
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eval_goal ON goal_evaluations(goal_id, evaluated_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eval_user ON goal_evaluations(user_id, evaluated_at DESC)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS goal_weekly_flags (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          week_start DATE NOT NULL,
          flag VARCHAR(10) NOT NULL DEFAULT 'green',
          flag_reason TEXT, suggested_action TEXT,
          success_probability DECIMAL(5,2),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(goal_id, week_start)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_weekly_goal ON goal_weekly_flags(goal_id, week_start DESC)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS goal_monthly_narratives (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          month_key VARCHAR(7) NOT NULL,
          narrative_json JSONB,
          summary TEXT,
          goals_evaluated INT DEFAULT 0,
          critical_flags INT DEFAULT 0,
          gemini_tokens_used INT DEFAULT 0,
          disclosure_text TEXT,
          generated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, month_key)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_monthly_user ON goal_monthly_narratives(user_id, month_key DESC)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS gemini_token_budget (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE NOT NULL UNIQUE,
          tokens_used INT DEFAULT 0,
          requests_made INT DEFAULT 0,
          requests_skipped INT DEFAULT 0,
          users_evaluated INT DEFAULT 0,
          goals_evaluated INT DEFAULT 0,
          budget_limit INT DEFAULT 1500000,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    return NextResponse.json({ success: true, message: 'Goal planning + evaluation tables created' });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
