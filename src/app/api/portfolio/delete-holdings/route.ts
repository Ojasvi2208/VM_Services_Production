import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete all holdings for this user
      const holdingsResult = await client.query(`
        DELETE FROM portfolio_holdings WHERE user_id = $1
        RETURNING id
      `, [user.id]);
      
      // Delete all transactions for this user
      const transactionsResult = await client.query(`
        DELETE FROM portfolio_transactions WHERE user_id = $1
        RETURNING id
      `, [user.id]);
      
      await client.query('COMMIT');
      
      console.log(`Deleted ${holdingsResult.rowCount} holdings and ${transactionsResult.rowCount} transactions for user ${user.id}`);
      
      return NextResponse.json({
        success: true,
        message: 'All holdings and transactions deleted successfully',
        deleted: {
          holdings: holdingsResult.rowCount,
          transactions: transactionsResult.rowCount
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Delete holdings error:', error);
    return NextResponse.json({ error: 'Failed to delete holdings' }, { status: 500 });
  }
}
