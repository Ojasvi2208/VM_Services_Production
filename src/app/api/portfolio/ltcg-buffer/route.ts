/**
 * LTCG Buffer Tracker API
 *
 * Tracks the ₹1.25L annual tax-free Equity LTCG exemption.
 * Returns remaining exemption + holdings eligible for tax-free harvest.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { getCurrentFY, classifyFund } from '@/lib/tax-calculator';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const fy = getCurrentFY();

      // 1. Fetch or create LTCG buffer for current FY
      const bufferResult = await client.query(
        `SELECT realized_ltcg, exemption_limit FROM ltcg_buffer WHERE user_id = $1 AND financial_year = $2`,
        [user.id, fy]
      );

      let realizedLtcg = 0;
      const exemptionLimit = 125000;
      if (bufferResult.rows.length > 0) {
        realizedLtcg = parseFloat(bufferResult.rows[0].realized_ltcg);
      }

      const remaining = Math.max(0, exemptionLimit - realizedLtcg);

      // 2. Find equity holdings with unrealized LTCG (held ≥12 months)
      const holdingsResult = await client.query(`
        SELECT
          ph.id as holding_id,
          COALESCE(f.scheme_name, ph.scheme_name) as fund_name,
          ph.scheme_code,
          ph.units,
          ph.purchase_nav,
          ph.purchase_date,
          f.latest_nav,
          f.category,
          f.equity_allocation_pct,
          EXTRACT(DAY FROM NOW() - ph.purchase_date) as holding_days
        FROM portfolio_holdings ph
        LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
        WHERE ph.user_id = $1
          AND ph.purchase_date < NOW() - INTERVAL '365 days'
        ORDER BY (COALESCE(f.latest_nav, ph.purchase_nav) - ph.purchase_nav) * ph.units DESC
      `, [user.id]);

      const harvestableHoldings = holdingsResult.rows
        .filter((row: any) => {
          const fundType = classifyFund(
            row.category || '',
            row.equity_allocation_pct != null ? parseFloat(row.equity_allocation_pct) : null
          );
          return fundType === 'equity'; // Only equity funds have LTCG exemption
        })
        .map((row: any) => {
          const currentNav = parseFloat(row.latest_nav) || parseFloat(row.purchase_nav);
          const purchaseNav = parseFloat(row.purchase_nav);
          const units = parseFloat(row.units);
          const unrealizedLTCG = (currentNav - purchaseNav) * units;
          const holdingDays = parseInt(row.holding_days) || 0;

          return {
            holdingId: row.holding_id,
            fundName: row.fund_name || row.scheme_code,
            unrealizedLTCG: Math.round(unrealizedLTCG * 100) / 100,
            holdingPeriodMonths: Math.floor(holdingDays / 30),
          };
        })
        .filter((h: any) => h.unrealizedLTCG > 0); // Only show profitable holdings

      return NextResponse.json({
        success: true,
        financialYear: fy,
        realizedLtcg: Math.round(realizedLtcg * 100) / 100,
        exemptionLimit,
        remaining: Math.round(remaining * 100) / 100,
        harvestableHoldings,
      });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('LTCG buffer API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch LTCG buffer' }, { status: 500 });
  }
}
