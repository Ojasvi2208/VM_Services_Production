import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';

// GET /api/portfolio/metrics
// Returns portfolio-level weighted-average risk metrics:
//   sharpeRatio1y, volatility1y, cagr1y, cagr3y, cagr5y
// Computed by weighting each holding's fund_returns metrics by current value.
// Only includes holdings that have a matched fund in fund_returns.

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT
          ph.scheme_code,
          ph.units,
          ph.purchase_nav,
          ph.purchase_amount,
          COALESCE(f.latest_nav, f_isin.latest_nav) AS current_nav,
          COALESCE(fr.sharpe_ratio_1y, fr_isin.sharpe_ratio_1y) AS sharpe_ratio_1y,
          COALESCE(fr.volatility_1y,   fr_isin.volatility_1y)   AS volatility_1y,
          COALESCE(fr.cagr_1y,         fr_isin.cagr_1y)         AS cagr_1y,
          COALESCE(fr.cagr_3y,         fr_isin.cagr_3y)         AS cagr_3y,
          COALESCE(fr.cagr_5y,         fr_isin.cagr_5y)         AS cagr_5y
        FROM portfolio_holdings ph
        LEFT JOIN funds f
          ON ph.scheme_code = f.scheme_code
        LEFT JOIN funds f_isin
          ON (f.scheme_code IS NULL AND (
            f_isin.isin_growth = ph.scheme_code OR
            f_isin.isin_div_reinvestment = ph.scheme_code
          ))
        LEFT JOIN fund_returns fr
          ON f.scheme_code = fr.scheme_code
        LEFT JOIN fund_returns fr_isin
          ON (f.scheme_code IS NULL AND f_isin.scheme_code = fr_isin.scheme_code)
        WHERE ph.user_id = $1
      `, [user.id]);

      const rows = result.rows;

      // Build weighted averages weighted by current portfolio value
      let totalWeight = 0;
      let wSharpe = 0;
      let wVolatility = 0;
      let wCagr1y = 0;
      let wCagr3y = 0;
      let wCagr5y = 0;

      // Counts for partial availability
      let sharpeCount = 0;
      let volatilityCount = 0;
      let cagr1yCount = 0;
      let cagr3yCount = 0;
      let cagr5yCount = 0;

      for (const row of rows) {
        const units = parseFloat(row.units) || 0;
        const currentNav = parseFloat(row.current_nav) || 0;
        const purchaseNav = parseFloat(row.purchase_nav) || 0;
        const effectiveNav = currentNav > 0 ? currentNav : purchaseNav;
        const currentValue = units * effectiveNav;
        if (currentValue <= 0) continue;

        totalWeight += currentValue;

        const sharpe = row.sharpe_ratio_1y != null ? parseFloat(row.sharpe_ratio_1y) : null;
        const vol    = row.volatility_1y   != null ? parseFloat(row.volatility_1y)   : null;
        const c1y    = row.cagr_1y         != null ? parseFloat(row.cagr_1y)         : null;
        const c3y    = row.cagr_3y         != null ? parseFloat(row.cagr_3y)         : null;
        const c5y    = row.cagr_5y         != null ? parseFloat(row.cagr_5y)         : null;

        if (sharpe !== null) { wSharpe     += sharpe * currentValue; sharpeCount++; }
        if (vol    !== null) { wVolatility += vol    * currentValue; volatilityCount++; }
        if (c1y    !== null) { wCagr1y     += c1y    * currentValue; cagr1yCount++; }
        if (c3y    !== null) { wCagr3y     += c3y    * currentValue; cagr3yCount++; }
        if (c5y    !== null) { wCagr5y     += c5y    * currentValue; cagr5yCount++; }
      }

      const round2 = (v: number) => Math.round(v * 100) / 100;

      return NextResponse.json({
        success: true,
        metrics: {
          sharpeRatio1y: totalWeight > 0 && sharpeCount > 0
            ? round2(wSharpe / totalWeight) : null,
          volatility1y: totalWeight > 0 && volatilityCount > 0
            ? round2(wVolatility / totalWeight) : null,
          cagr1y: totalWeight > 0 && cagr1yCount > 0
            ? round2(wCagr1y / totalWeight) : null,
          cagr3y: totalWeight > 0 && cagr3yCount > 0
            ? round2(wCagr3y / totalWeight) : null,
          cagr5y: totalWeight > 0 && cagr5yCount > 0
            ? round2(wCagr5y / totalWeight) : null,
        },
        coverage: {
          holdingsTotal: rows.length,
          sharpeCount,
          volatilityCount,
          cagr1yCount,
          cagr3yCount,
          cagr5yCount,
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Portfolio metrics error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio metrics' }, { status: 500 });
  }
}
