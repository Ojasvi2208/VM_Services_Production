/**
 * Manual Tax Calculator API (Zero-Exit Calculator)
 *
 * Public endpoint — no auth required for basic calculation.
 * Users input fund type, buy/sell details, and get a tax breakdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  classifyGain, calculateRedemptionTax, incomeRangeToMidpoint,
} from '@/lib/tax-calculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fundType, buyDate, buyNav, sellNav, units, incomeRange, taxRegime } = body;

    // Validate required fields
    if (!fundType || !buyDate || !buyNav || !sellNav || !units) {
      return NextResponse.json(
        { success: false, error: 'fundType, buyDate, buyNav, sellNav, and units are required' },
        { status: 400 }
      );
    }

    const validFundTypes = ['equity', 'debt'];
    if (!validFundTypes.includes(fundType)) {
      return NextResponse.json(
        { success: false, error: 'fundType must be "equity" or "debt"' },
        { status: 400 }
      );
    }

    const parsedBuyDate = new Date(buyDate);
    if (isNaN(parsedBuyDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid buyDate format' },
        { status: 400 }
      );
    }

    const regime = taxRegime === 'old' ? 'old' : 'new';
    const income = incomeRangeToMidpoint(incomeRange || '0-4L');

    const impact = calculateRedemptionTax({
      purchaseDate: parsedBuyDate,
      purchaseNav: parseFloat(buyNav),
      currentNav: parseFloat(sellNav),
      units: parseFloat(units),
      fundType: fundType as 'equity' | 'debt',
      userIncome: income,
      taxRegime: regime,
      ltcgUsedThisFY: 0, // Manual calc assumes no prior usage
    });

    return NextResponse.json({
      success: true,
      impact,
    });
  } catch (error: any) {
    console.error('Manual tax calculator error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate tax' },
      { status: 500 }
    );
  }
}
