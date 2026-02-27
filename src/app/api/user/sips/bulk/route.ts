import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';

// POST /api/user/sips/bulk
// Idempotent bulk upsert of user SIP declarations from the SIP Discovery Wizard.
// On re-import, existing entries are updated (not duplicated).

interface SIPEntry {
  schemeCode: string;
  fundName: string;
  amount: number;
  deductionDate: number;
  frequency?: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const sips: SIPEntry[] = body.sips;

    if (!Array.isArray(sips) || sips.length === 0) {
      return NextResponse.json({ error: 'sips array is required' }, { status: 400 });
    }

    // Validate each entry
    for (const sip of sips) {
      if (!sip.schemeCode || !sip.fundName || !sip.amount || !sip.deductionDate) {
        return NextResponse.json(
          { error: `Missing required fields for fund: ${sip.fundName || sip.schemeCode}` },
          { status: 400 }
        );
      }
      if (sip.amount <= 0) {
        return NextResponse.json(
          { error: `SIP amount must be positive for ${sip.fundName}` },
          { status: 400 }
        );
      }
      if (sip.deductionDate < 1 || sip.deductionDate > 31) {
        return NextResponse.json(
          { error: `Deduction date must be 1-31 for ${sip.fundName}` },
          { status: 400 }
        );
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let upserted = 0;
      for (const sip of sips) {
        await client.query(`
          INSERT INTO user_sips (user_id, fund_scheme_code, fund_name, amount, deduction_date, frequency, start_date, end_date, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (user_id, fund_scheme_code)
          DO UPDATE SET
            fund_name = EXCLUDED.fund_name,
            amount = EXCLUDED.amount,
            deduction_date = EXCLUDED.deduction_date,
            frequency = EXCLUDED.frequency,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
        `, [
          user.id,
          sip.schemeCode,
          sip.fundName,
          sip.amount,
          sip.deductionDate,
          sip.frequency || 'Monthly',
          sip.startDate || null,
          sip.endDate || null,
          sip.isActive !== false,
        ]);
        upserted++;
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        upserted,
        message: `${upserted} SIP${upserted !== 1 ? 's' : ''} saved successfully`,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('SIP bulk upsert error:', error);
    return NextResponse.json(
      { error: 'Failed to save SIPs', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/user/sips/bulk — retrieve all active user SIPs
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query(`
      SELECT
        s.id, s.fund_scheme_code, s.fund_name, s.amount, s.deduction_date,
        s.frequency, s.start_date, s.end_date, s.is_active,
        f.latest_nav, f.category, f.sub_category
      FROM user_sips s
      LEFT JOIN funds f ON s.fund_scheme_code = f.scheme_code
      WHERE s.user_id = $1
      ORDER BY s.amount DESC
    `, [user.id]);

    const sips = result.rows.map(row => ({
      id: row.id,
      schemeCode: row.fund_scheme_code,
      fundName: row.fund_name,
      amount: parseFloat(row.amount),
      deductionDate: row.deduction_date,
      frequency: row.frequency,
      startDate: row.start_date,
      endDate: row.end_date,
      isActive: row.is_active,
      currentNav: row.latest_nav ? parseFloat(row.latest_nav) : null,
      category: row.category,
      subCategory: row.sub_category,
    }));

    return NextResponse.json({ success: true, sips });
  } catch (error: any) {
    console.error('SIP fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch SIPs' }, { status: 500 });
  }
}
