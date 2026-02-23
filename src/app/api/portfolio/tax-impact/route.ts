/**
 * Tax Impact Simulation API
 *
 * Pre-sell/switch tax audit. Calculates STCG/LTCG classification,
 * tax amount, slab push detection, and LTCG exemption usage.
 * Premium-gated for full diagnostic; free users see basic gain type + tax.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import {
  classifyFund, calculateRedemptionTax, incomeRangeToMidpoint, getCurrentFY,
} from '@/lib/tax-calculator';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { holdingId, action, units: requestedUnits, targetSchemeCode } = body;

    if (!holdingId || !action) {
      return NextResponse.json({ success: false, error: 'holdingId and action are required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // 1. Fetch holding
      const holdingResult = await client.query(`
        SELECT ph.id, ph.scheme_code, ph.units, ph.purchase_nav, ph.purchase_date, ph.purchase_amount,
               COALESCE(f.scheme_name, ph.scheme_name) as fund_name,
               f.category, f.equity_allocation_pct, f.latest_nav
        FROM portfolio_holdings ph
        LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
        WHERE ph.id = $1 AND ph.user_id = $2
      `, [holdingId, user.id]);

      if (holdingResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Holding not found' }, { status: 404 });
      }

      const holding = holdingResult.rows[0];
      const unitsToSell = requestedUnits || parseFloat(holding.units);
      const currentNav = parseFloat(holding.latest_nav) || parseFloat(holding.purchase_nav);
      const purchaseNav = parseFloat(holding.purchase_nav);

      // 2. Classify fund
      const fundType = classifyFund(
        holding.category || '',
        holding.equity_allocation_pct != null ? parseFloat(holding.equity_allocation_pct) : null
      );

      // 3. Fetch LTCG buffer for current FY
      const fy = getCurrentFY();
      const bufferResult = await client.query(
        `SELECT realized_ltcg FROM ltcg_buffer WHERE user_id = $1 AND financial_year = $2`,
        [user.id, fy]
      );
      const ltcgUsed = bufferResult.rows.length > 0 ? parseFloat(bufferResult.rows[0].realized_ltcg) : 0;

      // 4. Calculate tax impact
      const userIncome = incomeRangeToMidpoint(user.income_range || '0-4L');
      const taxRegime = (user.tax_regime as 'old' | 'new') || 'new';

      const impact = calculateRedemptionTax({
        purchaseDate: new Date(holding.purchase_date),
        purchaseNav,
        currentNav,
        units: unitsToSell,
        fundType,
        userIncome,
        taxRegime,
        ltcgUsedThisFY: ltcgUsed,
      });

      // 5. Log to audit trail
      await client.query(`
        INSERT INTO tax_impact_log (user_id, holding_id, scheme_code, action_type, units,
          estimated_gain, gain_type, tax_amount, effective_rate, slab_before, slab_after, slab_push)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        user.id, holdingId, holding.scheme_code, action, unitsToSell,
        impact.gainAmount, impact.gainType, impact.totalTax, impact.effectiveRate,
        impact.slabBefore, impact.slabAfter, impact.slabPush,
      ]);

      // 6. Build response
      const isPremium = user.is_premium &&
        (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());

      const response: any = {
        success: true,
        impact: isPremium ? impact : {
          gainAmount: impact.gainAmount,
          gainType: impact.gainType,
          totalTax: impact.totalTax,
          effectiveRate: impact.effectiveRate,
          recommendation: impact.gainAmount <= 0 ? impact.recommendation : 'Upgrade to CFO Suite for full tax breakdown and slab analysis.',
        },
        ltcgBuffer: {
          financialYear: fy,
          realizedLtcg: ltcgUsed,
          exemptionLimit: 125000,
          remaining: Math.max(0, 125000 - ltcgUsed),
        },
      };

      if (isPremium && impact.slabPush) {
        response.slabPushWarning = `This redemption pushes your marginal tax rate from ${impact.slabBefore} to ${impact.slabAfter}. Consider partial redemption.`;
      }

      return NextResponse.json(response);

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Tax impact API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to calculate tax impact' }, { status: 500 });
  }
}
