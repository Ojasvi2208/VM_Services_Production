/**
 * Goal Transition Suggestions API
 *
 * GET: Fetch pending/active transition suggestions for a goal.
 * POST: Accept or dismiss a suggestion.
 *
 * SEBI_COMPLIANCE_HOLD: STP/fund-swap suggestions disabled pending SEBI IA registration.
 * Vijay Malik Financial Services is an MFD (ARN-317605), not a SEBI-registered Investment Adviser.
 * Specific fund transition recommendations (secure_the_bag, off_track_swap, ltcg_harvest)
 * constitute personalised investment advice under SEBI IA Regulations 2013 Reg 2(l).
 * Re-enable once VM Financial Advisory Pvt. Ltd. receives SEBI IA certificate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SEBI_COMPLIANCE_HOLD: Return empty suggestions.
    return NextResponse.json({ success: true, suggestions: [] });
  } catch (error: any) {
    console.error('Goal transitions GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch transitions' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SEBI_COMPLIANCE_HOLD: Suggestion acceptance/dismissal disabled.
    return NextResponse.json({
      success: false,
      error: 'Portfolio transition suggestions are temporarily unavailable while we complete SEBI Investment Adviser registration.',
    }, { status: 503 });
  } catch (error: any) {
    console.error('Goal transitions POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update suggestion' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// SEBI_COMPLIANCE_HOLD — Original transition logic preserved as reference.
//
// GET handler:
// 1. Verified goal ownership via goals table
// 2. Queried goal_transition_suggestions (pending first, then by created_at DESC, limit 20)
// 3. Returned: suggestions[] with triggerType, fromFundName, toFundName, unitsToMove,
//    estimatedGain, taxCost, projectedBenefit3y, netBenefit, stpMonthlyAmount, stpMonths
//
// POST handler:
// 1. Accepted suggestionId + action (accept/dismiss)
// 2. Updated goal_transition_suggestions.status + acted_at
// -----------------------------------------------------------------------------
