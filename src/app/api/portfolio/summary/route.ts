import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    
    try {
      // Get all holdings with current NAV (try AMFI code first, then ISIN)
      const holdingsResult = await client.query(`
        SELECT 
          ph.id,
          ph.scheme_code,
          ph.units,
          ph.purchase_nav,
          ph.purchase_amount,
          ph.source,
          COALESCE(f.latest_nav, f_isin.latest_nav) as current_nav
        FROM portfolio_holdings ph
        LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
        LEFT JOIN funds f_isin ON (f.scheme_code IS NULL AND (f_isin.isin_growth = ph.scheme_code OR f_isin.isin_div_reinvestment = ph.scheme_code))
        WHERE ph.user_id = $1
      `, [user.id]);

      const holdings = holdingsResult.rows;
      
      let totalInvested = 0;
      let currentValue = 0;

      for (const holding of holdings) {
        const purchaseAmount = parseFloat(holding.purchase_amount) || 0;
        const units = parseFloat(holding.units) || 0;
        const nav = parseFloat(holding.current_nav) || 0;

        totalInvested += purchaseAmount;

        if (nav > 0) {
          currentValue += units * nav;
        } else if (holding.source === 'cas') {
          // CAS import without live NAV: use purchase_amount as approximate current value
          currentValue += purchaseAmount;
        } else {
          currentValue += units * (parseFloat(holding.purchase_nav) || 0);
        }
      }

      const totalReturns = currentValue - totalInvested;
      const returnsPercentage = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

      return NextResponse.json({
        success: true,
        summary: {
          totalInvested: Math.round(totalInvested * 100) / 100,
          currentValue: Math.round(currentValue * 100) / 100,
          totalReturns: Math.round(totalReturns * 100) / 100,
          returnsPercentage: Math.round(returnsPercentage * 100) / 100,
          holdingsCount: holdings.length
        }
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Portfolio summary error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio summary' }, { status: 500 });
  }
}
