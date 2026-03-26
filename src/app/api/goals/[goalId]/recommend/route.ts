/**
 * Aladdin Portfolio Recommendation — Goal-Linked
 * POST /api/goals/{goalId}/recommend
 *
 * SEBI_COMPLIANCE_HOLD: AI portfolio constructor disabled pending SEBI IA registration.
 * Vijay Malik Financial Services is an MFD (ARN-317605), not a SEBI-registered Investment Adviser.
 * AI-powered portfolio construction using user age, risk tolerance, income, and goal parameters
 * constitutes personalised investment advice under SEBI IA Regulations 2013 Reg 2(l).
 * Re-enable once VM Financial Advisory Pvt. Ltd. receives SEBI IA certificate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SEBI_COMPLIANCE_HOLD: Portfolio recommendations disabled.
    return NextResponse.json({
      success: false,
      error: 'AI portfolio recommendations require SEBI Investment Adviser registration. This feature is coming soon.',
      disclaimer: 'Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605) and is NOT a SEBI-registered Investment Adviser.',
    }, { status: 503 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Aladdin goal-linked error:', errMsg);
    return NextResponse.json(
      { error: 'Failed to generate portfolio recommendation' },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// SEBI_COMPLIANCE_HOLD — Original Aladdin engine logic preserved as reference.
//
// POST handler:
// 1. Fetched goal + user profile (DOB, risk tolerance, income range)
// 2. Computed age from DOB, tenure in months from target date
// 3. Fetched linked funds with returns data (CAGR 3Y, Sharpe 1Y, volatility 1Y)
// 4. Fetched deep eval health scores from goal_portfolio_evaluations
// 5. Called constructPortfolio(userContext, goalParams) — the Aladdin engine
// 6. Returned: AI-constructed portfolio with fund allocations + disclaimer
//
// Dependencies: @/lib/portfolio-constructor (constructPortfolio, UserContext, GoalParams)
// maxDuration: 60s (Vercel escape hatch for Gemini calls)
// -----------------------------------------------------------------------------
