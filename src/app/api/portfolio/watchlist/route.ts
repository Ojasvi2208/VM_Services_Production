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
          w.id,
          w.scheme_code,
          w.added_at,
          w.notes,
          f.scheme_name,
          f.latest_nav as current_nav,
          fr.return_1y
        FROM user_watchlist w
        LEFT JOIN funds f ON w.scheme_code = f.scheme_code
        LEFT JOIN fund_returns fr ON w.scheme_code = fr.scheme_code
        WHERE w.user_id = $1
        ORDER BY w.added_at DESC
      `, [user.id]);

      const watchlist = result.rows.map(row => ({
        id: row.id,
        schemeCode: row.scheme_code,
        schemeName: row.scheme_name || `Fund ${row.scheme_code}`,
        currentNav: parseFloat(row.current_nav) || 0,
        return1y: parseFloat(row.return_1y) || 0,
        addedAt: row.added_at,
        notes: row.notes
      }));

      return NextResponse.json({
        success: true,
        watchlist
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Watchlist fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { schemeCode, notes } = body;

    if (!schemeCode) {
      return NextResponse.json({ error: 'Scheme code is required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      await client.query(`
        INSERT INTO user_watchlist (user_id, scheme_code, notes)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, scheme_code) DO UPDATE SET notes = $3
      `, [user.id, schemeCode, notes]);

      return NextResponse.json({
        success: true,
        message: 'Added to watchlist'
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Add to watchlist error:', error);
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schemeCode = searchParams.get('schemeCode');

    if (!schemeCode) {
      return NextResponse.json({ error: 'Scheme code is required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      await client.query(`
        DELETE FROM user_watchlist WHERE user_id = $1 AND scheme_code = $2
      `, [user.id, schemeCode]);

      return NextResponse.json({
        success: true,
        message: 'Removed from watchlist'
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Remove from watchlist error:', error);
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 });
  }
}
