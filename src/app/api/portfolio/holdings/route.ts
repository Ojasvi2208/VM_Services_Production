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
      // Primary: JOIN on scheme_code (AMFI numeric code)
      // Fallback: JOIN on ISIN columns (for NSDL CAS imports that store ISIN as scheme_code)
      const result = await client.query(`
        SELECT 
          ph.id,
          ph.scheme_code,
          ph.units,
          ph.purchase_nav,
          ph.purchase_date,
          ph.purchase_amount,
          ph.notes,
          ph.source,
          COALESCE(f.scheme_name, f_isin.scheme_name, ph.scheme_name) as resolved_name,
          COALESCE(f.latest_nav, f_isin.latest_nav) as current_nav,
          COALESCE(f.scheme_code, f_isin.scheme_code) as resolved_scheme_code,
          COALESCE(fr.return_1y, fr_isin.return_1y) as return_1y,
          COALESCE(fr.cagr_3y, fr_isin.cagr_3y) as cagr_3y,
          COALESCE(fr.cagr_5y, fr_isin.cagr_5y) as cagr_5y
        FROM portfolio_holdings ph
        LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
        LEFT JOIN funds f_isin ON (f.scheme_code IS NULL AND (f_isin.isin_growth = ph.scheme_code OR f_isin.isin_div_reinvestment = ph.scheme_code))
        LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
        LEFT JOIN fund_returns fr_isin ON (f.scheme_code IS NULL AND f_isin.scheme_code = fr_isin.scheme_code)
        WHERE ph.user_id = $1
        ORDER BY ph.created_at DESC
      `, [user.id]);

      // Deduplicate: same fund can appear under AMFI code AND UNMATCHED: key
      const rawRows = result.rows;
      const seenFunds = new Map<string, typeof rawRows[0]>();
      const uniqueRows: typeof rawRows = [];

      for (const row of rawRows) {
        const resolvedCode = row.resolved_scheme_code;
        const rawCode = row.scheme_code as string;

        if (resolvedCode) {
          const existing = seenFunds.get(resolvedCode);
          if (existing) {
            const existingIsUnmatched = (existing.scheme_code as string).startsWith('UNMATCHED:');
            const currentIsUnmatched = rawCode.startsWith('UNMATCHED:');
            if (existingIsUnmatched && !currentIsUnmatched) {
              uniqueRows[uniqueRows.indexOf(existing)] = row;
              seenFunds.set(resolvedCode, row);
            }
            continue;
          }
          seenFunds.set(resolvedCode, row);
        }
        uniqueRows.push(row);
      }

      const holdings = uniqueRows.map(row => {
        const units = parseFloat(row.units) || 0;
        const purchaseNav = parseFloat(row.purchase_nav) || 0;
        const currentNav = parseFloat(row.current_nav) || 0;
        const purchaseAmount = parseFloat(row.purchase_amount) || 0;

        let currentValue: number;
        if (currentNav > 0) {
          currentValue = units * currentNav;
        } else if (row.source === 'cas') {
          currentValue = purchaseAmount;
        } else {
          currentValue = units * purchaseNav;
        }

        const returns = currentValue - purchaseAmount;
        const returnsPercentage = purchaseAmount > 0 ? (returns / purchaseAmount) * 100 : 0;

        // Name resolution chain: funds DB → ph.scheme_name → notes parsing → UNMATCHED: extraction → fallback
        let schemeName = row.resolved_name;
        if (!schemeName && row.notes) {
          const notesMatch = row.notes.match(/^CAS Import - (?:.*? - )?(.+)$/);
          if (notesMatch) schemeName = notesMatch[1].trim();
        }
        if (!schemeName) {
          const rawCode = row.scheme_code as string;
          if (rawCode.startsWith('UNMATCHED:')) {
            schemeName = rawCode.substring('UNMATCHED:'.length).trim();
          } else {
            schemeName = `Fund ${rawCode}`;
          }
        }

        return {
          id: row.id,
          schemeCode: row.resolved_scheme_code || row.scheme_code,
          schemeName,
          units,
          purchaseNav,
          currentNav: currentNav || purchaseNav,
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

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const holdingId = searchParams.get('id');

    if (!holdingId) {
      return NextResponse.json({ error: 'Holding ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Delete associated transactions first
      await client.query(
        `DELETE FROM portfolio_transactions WHERE holding_id = $1 AND user_id = $2`,
        [holdingId, user.id]
      );

      // Delete the holding (only if owned by this user)
      const result = await client.query(
        `DELETE FROM portfolio_holdings WHERE id = $1 AND user_id = $2 RETURNING id, scheme_code`,
        [holdingId, user.id]
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Holding deleted successfully',
        deleted: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Delete holding error:', error);
    return NextResponse.json({ error: 'Failed to delete holding' }, { status: 500 });
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
