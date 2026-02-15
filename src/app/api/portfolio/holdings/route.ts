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
      const result = await client.query(`
        SELECT 
          ph.id,
          ph.scheme_code,
          ph.units,
          ph.purchase_nav,
          ph.purchase_date,
          ph.purchase_amount,
          ph.notes,
          f.scheme_name,
          f.latest_nav as current_nav,
          fr.return_1y,
          fr.cagr_3y,
          fr.cagr_5y
        FROM portfolio_holdings ph
        LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
        LEFT JOIN fund_returns fr ON ph.scheme_code = fr.scheme_code
        WHERE ph.user_id = $1
        ORDER BY ph.created_at DESC
      `, [user.id]);

      const holdings = result.rows.map(row => {
        const units = parseFloat(row.units) || 0;
        const purchaseNav = parseFloat(row.purchase_nav) || 0;
        const currentNav = parseFloat(row.current_nav) || purchaseNav;
        const purchaseAmount = parseFloat(row.purchase_amount) || 0;
        const currentValue = units * currentNav;
        const returns = currentValue - purchaseAmount;
        const returnsPercentage = purchaseAmount > 0 ? (returns / purchaseAmount) * 100 : 0;

        return {
          id: row.id,
          schemeCode: row.scheme_code,
          schemeName: row.scheme_name || `Fund ${row.scheme_code}`,
          units,
          purchaseNav,
          currentNav,
          purchaseAmount,
          currentValue: Math.round(currentValue * 100) / 100,
          returns: Math.round(returns * 100) / 100,
          returnsPercentage: Math.round(returnsPercentage * 100) / 100,
          purchaseDate: row.purchase_date,
          notes: row.notes,
          return1y: row.return_1y ? parseFloat(row.return_1y) : null,
          cagr3y: row.cagr_3y ? parseFloat(row.cagr_3y) : null,
          cagr5y: row.cagr_5y ? parseFloat(row.cagr_5y) : null
        };
      });

      return NextResponse.json({
        success: true,
        holdings
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Holdings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { schemeCode, units, purchaseNav, purchaseDate, notes } = body;

    if (!schemeCode || !units || !purchaseNav || !purchaseDate) {
      return NextResponse.json(
        { error: 'Scheme code, units, purchase NAV, and purchase date are required' },
        { status: 400 }
      );
    }

    const purchaseAmount = parseFloat(units) * parseFloat(purchaseNav);

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO portfolio_holdings (user_id, scheme_code, units, purchase_nav, purchase_date, purchase_amount, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [user.id, schemeCode, units, purchaseNav, purchaseDate, purchaseAmount, notes]);

      // Also add transaction record
      await client.query(`
        INSERT INTO portfolio_transactions (user_id, holding_id, scheme_code, transaction_type, units, nav, amount, transaction_date, notes)
        VALUES ($1, $2, $3, 'BUY', $4, $5, $6, $7, $8)
      `, [user.id, result.rows[0].id, schemeCode, units, purchaseNav, purchaseAmount, purchaseDate, notes]);

      return NextResponse.json({
        success: true,
        message: 'Investment added successfully',
        holdingId: result.rows[0].id
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Add holding error:', error);
    return NextResponse.json({ error: 'Failed to add investment' }, { status: 500 });
  }
}
