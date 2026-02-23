/**
 * Red-Flag Evaluator API
 *
 * Compares each fund in the user's portfolio against its category average CAGR.
 * Flags underperformers as OFF_TRACK. Premium users get full diagnostic report
 * (peer rank, alternatives, suggested actions). Free users see teaser only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isPremium = user.is_premium &&
      (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());

    const client = await pool.connect();

    try {
      // Core query: user holdings + fund returns + category averages
      const result = await client.query(`
        SELECT
          ph.id as holding_id,
          ph.scheme_code,
          ph.units,
          ph.purchase_amount,
          COALESCE(f.scheme_name, ph.scheme_name) as fund_name,
          f.category,
          f.sub_category,
          f.latest_nav,
          fr.cagr_1y as fund_cagr_1y,
          fr.cagr_3y as fund_cagr_3y,
          mv.avg_cagr_1y as category_avg_1y,
          mv.avg_cagr_3y as category_avg_3y,
          mv.p25_cagr_1y,
          mv.p75_cagr_1y,
          mv.fund_count,
          CASE
            WHEN fr.cagr_1y IS NOT NULL AND mv.avg_cagr_1y IS NOT NULL
              AND fr.cagr_1y < mv.avg_cagr_1y THEN 'OFF_TRACK'
            ELSE 'ON_TRACK'
          END as status
        FROM portfolio_holdings ph
        LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
        LEFT JOIN funds f_isin ON (f.scheme_code IS NULL AND (f_isin.isin_growth = ph.scheme_code OR f_isin.isin_div_reinvestment = ph.scheme_code))
        LEFT JOIN fund_returns fr ON COALESCE(f.scheme_code, f_isin.scheme_code) = fr.scheme_code
        LEFT JOIN mv_category_avg_returns mv ON COALESCE(f.category, f_isin.category) = mv.category
          AND COALESCE(f.sub_category, f_isin.sub_category) = mv.sub_category
        WHERE ph.user_id = $1
        ORDER BY
          CASE WHEN fr.cagr_1y < mv.avg_cagr_1y THEN 0 ELSE 1 END,
          (fr.cagr_1y - mv.avg_cagr_1y) ASC NULLS LAST
      `, [user.id]);

      const flags = result.rows.map((row: any) => {
        const currentValue = row.latest_nav && row.units
          ? parseFloat(row.units) * parseFloat(row.latest_nav)
          : parseFloat(row.purchase_amount) || 0;

        const delta = row.fund_cagr_1y != null && row.category_avg_1y != null
          ? parseFloat(row.fund_cagr_1y) - parseFloat(row.category_avg_1y)
          : null;

        // Peer rank: where does this fund sit within category IQR?
        let peerRankPct: number | null = null;
        if (isPremium && row.fund_cagr_1y != null && row.p25_cagr_1y != null && row.p75_cagr_1y != null) {
          const iqr = parseFloat(row.p75_cagr_1y) - parseFloat(row.p25_cagr_1y);
          if (iqr > 0) {
            peerRankPct = Math.max(0, Math.min(100,
              ((parseFloat(row.fund_cagr_1y) - parseFloat(row.p25_cagr_1y)) / iqr) * 50 + 25
            ));
          }
        }

        const base: any = {
          holdingId: row.holding_id,
          schemeCode: row.scheme_code,
          fundName: row.fund_name || row.scheme_code,
          category: row.category || '',
          subCategory: row.sub_category || '',
          fundCagr1y: row.fund_cagr_1y != null ? parseFloat(row.fund_cagr_1y) : null,
          categoryAvg1y: row.category_avg_1y != null ? parseFloat(row.category_avg_1y) : null,
          delta,
          status: row.status,
          currentValue: Math.round(currentValue * 100) / 100,
          purchaseAmount: parseFloat(row.purchase_amount) || 0,
        };

        // Premium-only diagnostic fields
        if (isPremium) {
          base.peerRankPct = peerRankPct != null ? Math.round(peerRankPct) : null;

          if (row.status === 'OFF_TRACK' && delta != null) {
            base.diagnosticSummary = `This fund's 1Y CAGR (${parseFloat(row.fund_cagr_1y).toFixed(1)}%) is ${Math.abs(delta).toFixed(1)}% below the ${row.category} ${row.sub_category} category average (${parseFloat(row.category_avg_1y).toFixed(1)}%).`;
            base.suggestedAction = Math.abs(delta) > 5
              ? 'Consider switching to a better-performing fund in this category.'
              : 'Monitor for another quarter before taking action.';
          }
        }

        return base;
      });

      const offTrackCount = flags.filter((f: any) => f.status === 'OFF_TRACK').length;

      return NextResponse.json({
        success: true,
        flags,
        isPremium,
        offTrackCount,
        totalHoldings: flags.length,
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Red-flags API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate portfolio' },
      { status: 500 }
    );
  }
}
