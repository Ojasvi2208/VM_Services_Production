/**
 * Tax Profile API — GET/PUT user tax profile
 *
 * Stores income bracket, occupation type, tax regime preference,
 * and PAN link status. Used by the Tax Guardian for slab calculations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { getSlabRate, incomeRangeToMidpoint, getCurrentFY } from '@/lib/tax-calculator';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const estimatedIncome = incomeRangeToMidpoint(user.income_range || '0-4L');
    const slab = getSlabRate(estimatedIncome, (user.tax_regime as 'old' | 'new') || 'new');

    return NextResponse.json({
      success: true,
      profile: {
        incomeRange: user.income_range || '0-4L',
        occupationType: user.occupation_type || 'salaried',
        taxRegime: user.tax_regime || 'new',
        panStatus: user.pan_status || 'not_linked',
        estimatedSlab: slab.slabLabel,
        currentFY: getCurrentFY(),
      },
    });
  } catch (error: any) {
    console.error('Tax profile GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tax profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { incomeRange, occupationType, taxRegime, panStatus } = body;

    // Validate inputs
    const validRanges = ['0-4L', '4-8L', '8-12L', '12-16L', '16-20L', '20-24L', '24L+'];
    const validOccupations = ['salaried', 'business', 'professional'];
    const validRegimes = ['new', 'old'];
    const validPanStatus = ['linked', 'not_linked', 'exempt'];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (incomeRange && validRanges.includes(incomeRange)) {
      updates.push(`income_range = $${paramIdx++}`);
      values.push(incomeRange);
    }
    if (occupationType && validOccupations.includes(occupationType)) {
      updates.push(`occupation_type = $${paramIdx++}`);
      values.push(occupationType);
    }
    if (taxRegime && validRegimes.includes(taxRegime)) {
      updates.push(`tax_regime = $${paramIdx++}`);
      values.push(taxRegime);
    }
    if (panStatus && validPanStatus.includes(panStatus)) {
      updates.push(`pan_status = $${paramIdx++}`);
      values.push(panStatus);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(user.id);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      values
    );

    return NextResponse.json({ success: true, message: 'Tax profile updated' });
  } catch (error: any) {
    console.error('Tax profile PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update tax profile' }, { status: 500 });
  }
}
