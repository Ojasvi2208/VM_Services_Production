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

    return NextResponse.json({ success: true, message: 'Goal planning tables created' });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
