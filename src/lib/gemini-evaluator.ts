/**
 * Gemini State Machine Evaluator
 * 
 * NOT a chatbot. Functions as a deterministic state machine:
 * Input:  GBM Monte Carlo raw output (bell curve data)
 * Output: Structured JSON evaluation with flag (Green/Amber/Red)
 * 
 * Token Budget Management:
 * - Gemini 1.5 Flash free tier: 15 RPM, 1M tokens/day
 * - Batch user evaluations into single prompts
 * - Stale-While-Revalidate: skip if portfolio drift < 0.1%
 * - Weekly flag + Monthly narrative cadence
 */

import pool from './postgres-db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Types ──

export interface GBMOutput {
  goalId: string;
  goalName: string;
  criticality: string;
  targetAmount: number;
  currentValue: number;
  monthlySip: number;
  monthsRemaining: number;
  successProbability: number;
  p10: number;
  p50: number;
  p90: number;
  shortfall: number;
  inflatedTarget: number;
  volatilityUsed: number;
  expectedReturn: number;
  inflationRate: number;
}

export interface EvaluationResult {
  flag: 'green' | 'amber' | 'red';
  flagReason: string;
  suggestedAction: string;
  rebalanceAmount: number | null;
  extensionMonths: number | null;
  topupAmount: number | null;
  confidenceScore: number;
  tokensUsed: number;
}

export interface MonthlyNarrative {
  summary: string;
  goalBreakdown: { goalName: string; flag: string; oneLineSummary: string }[];
  topAction: string;
  outlook: string;
  tokensUsed: number;
}

// ── Rule-Based Fallback (no API call needed) ──

function ruleBasedEvaluation(gbm: GBMOutput): EvaluationResult {
  const { successProbability, shortfall, monthlySip, monthsRemaining, criticality, currentValue, targetAmount } = gbm;

  // Green: on track
  if (successProbability >= 80) {
    return {
      flag: 'green',
      flagReason: `Goal is on track with ${successProbability}% success probability.`,
      suggestedAction: 'No action needed. Continue current SIP.',
      rebalanceAmount: null,
      extensionMonths: null,
      topupAmount: null,
      confidenceScore: 95,
      tokensUsed: 0
    };
  }

  // Red: critical risk
  if (successProbability < 50 || (criticality === 'critical' && successProbability < 70)) {
    const monthlyShortfall = monthsRemaining > 0 ? Math.ceil(shortfall / monthsRemaining / 100) * 100 : 0;
    const extensionNeeded = monthlySip > 0 ? Math.ceil(shortfall / monthlySip) : Math.ceil(monthsRemaining * 0.3);

    return {
      flag: 'red',
      flagReason: `Goal at risk with only ${successProbability}% success probability. Median projection falls short by ₹${Math.round(shortfall).toLocaleString('en-IN')}.`,
      suggestedAction: `Requires ₹${monthlyShortfall.toLocaleString('en-IN')}/mo top-up OR ${extensionNeeded}-month extension.`,
      rebalanceAmount: null,
      extensionMonths: extensionNeeded,
      topupAmount: monthlyShortfall,
      confidenceScore: 85,
      tokensUsed: 0
    };
  }

  // Amber: drift detected
  const progressPct = targetAmount > 0 ? (currentValue / targetAmount) * 100 : 0;
  const expectedProgressPct = monthsRemaining > 0 ? ((1 - monthsRemaining / (monthsRemaining + 12)) * 100) : 100;
  const rebalanceAmt = shortfall > 0 ? Math.ceil(shortfall / Math.max(monthsRemaining, 1) / 100) * 100 : 0;

  return {
    flag: 'amber',
    flagReason: `Portfolio drift detected. Success probability at ${successProbability}%, below target threshold.`,
    suggestedAction: `Suggested rebalance amount: ₹${rebalanceAmt.toLocaleString('en-IN')}/mo increase to reach 80%+ success.`,
    rebalanceAmount: rebalanceAmt,
    extensionMonths: null,
    topupAmount: null,
    confidenceScore: 90,
    tokensUsed: 0
  };
}

// ── Gemini API Call ──

async function callGemini(prompt: string): Promise<{ text: string; tokensUsed: number }> {
  if (!GEMINI_API_KEY) {
    return { text: '', tokensUsed: 0 };
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,      // Near-deterministic for structured output
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 800,  // Budget-conscious
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      return { text: '', tokensUsed: 0 };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0);

    return { text, tokensUsed };
  } catch (error) {
    console.error('Gemini call failed:', error);
    return { text: '', tokensUsed: 0 };
  }
}

// ── Single Goal Evaluation (Gemini-enhanced) ──

export async function evaluateGoalWithGemini(gbm: GBMOutput): Promise<EvaluationResult> {
  // Always compute rule-based first (instant, free)
  const ruleBased = ruleBasedEvaluation(gbm);

  // If no API key, return rule-based
  if (!GEMINI_API_KEY) return ruleBased;

  // If green and high confidence, skip Gemini to save tokens
  if (ruleBased.flag === 'green' && gbm.successProbability >= 85) return ruleBased;

  const prompt = `You are a quantitative financial analyst for an Indian mutual fund goal planning engine. Analyze this Monte Carlo GBM simulation output and return a structured JSON evaluation.

INPUT DATA:
- Goal: "${gbm.goalName}" (${gbm.criticality} priority)
- Target: ₹${gbm.targetAmount.toLocaleString('en-IN')} by ${gbm.monthsRemaining} months
- Current Value: ₹${gbm.currentValue.toLocaleString('en-IN')}
- Monthly SIP: ₹${gbm.monthlySip.toLocaleString('en-IN')}
- GBM Results (10,000 simulations):
  - Success Probability: ${gbm.successProbability}%
  - P10 (pessimistic): ₹${gbm.p10.toLocaleString('en-IN')}
  - P50 (median): ₹${gbm.p50.toLocaleString('en-IN')}
  - P90 (optimistic): ₹${gbm.p90.toLocaleString('en-IN')}
  - Shortfall at P50: ₹${gbm.shortfall.toLocaleString('en-IN')}
  - Inflation-adjusted target: ₹${gbm.inflatedTarget.toLocaleString('en-IN')}
  - Volatility used: ${gbm.volatilityUsed}%
  - Expected return: ${gbm.expectedReturn}%

OUTPUT exactly this JSON schema (no markdown, no code blocks):
{
  "flag": "green" | "amber" | "red",
  "flagReason": "one concise sentence",
  "suggestedAction": "one actionable sentence with specific ₹ amounts",
  "rebalanceAmount": number or null,
  "extensionMonths": number or null,
  "topupAmount": number or null,
  "confidenceScore": number between 0-100
}

Rules:
- green: success ≥80% AND on track
- amber: success 50-80% OR drift from expected
- red: success <50% OR critical goal <70%
- For ${gbm.criticality} goals, be ${gbm.criticality === 'critical' ? 'stricter (threshold: 90%)' : gbm.criticality === 'important' ? 'moderate (threshold: 80%)' : 'lenient (threshold: 60%)'}.
- All amounts in INR. Be specific with numbers.`;

  const { text, tokensUsed } = await callGemini(prompt);

  if (!text) return { ...ruleBased, tokensUsed: 0 };

  try {
    const parsed = JSON.parse(text);
    return {
      flag: ['green', 'amber', 'red'].includes(parsed.flag) ? parsed.flag : ruleBased.flag,
      flagReason: parsed.flagReason || ruleBased.flagReason,
      suggestedAction: parsed.suggestedAction || ruleBased.suggestedAction,
      rebalanceAmount: parsed.rebalanceAmount ?? ruleBased.rebalanceAmount,
      extensionMonths: parsed.extensionMonths ?? ruleBased.extensionMonths,
      topupAmount: parsed.topupAmount ?? ruleBased.topupAmount,
      confidenceScore: parsed.confidenceScore ?? ruleBased.confidenceScore,
      tokensUsed
    };
  } catch {
    // JSON parse failed — fall back to rule-based
    return { ...ruleBased, tokensUsed };
  }
}

// ── Batch Monthly Narrative (single Gemini call for all goals) ──

export async function generateMonthlyNarrative(
  evaluations: { goalName: string; flag: string; successProbability: number; shortfall: number; suggestedAction: string }[]
): Promise<MonthlyNarrative> {
  const fallback: MonthlyNarrative = {
    summary: `${evaluations.length} goals evaluated. ${evaluations.filter(e => e.flag === 'red').length} at risk.`,
    goalBreakdown: evaluations.map(e => ({ goalName: e.goalName, flag: e.flag, oneLineSummary: e.suggestedAction })),
    topAction: evaluations.find(e => e.flag === 'red')?.suggestedAction || 'Continue current investment strategy.',
    outlook: 'Review your goals monthly for optimal results.',
    tokensUsed: 0
  };

  if (!GEMINI_API_KEY || evaluations.length === 0) return fallback;

  const goalsText = evaluations.map((e, i) =>
    `${i + 1}. "${e.goalName}" — Flag: ${e.flag.toUpperCase()}, Success: ${e.successProbability}%, Shortfall: ₹${e.shortfall.toLocaleString('en-IN')}`
  ).join('\n');

  const prompt = `You are a wealth advisor AI for Indian retail investors. Generate a monthly strategy narrative for this user's goal portfolio.

GOALS:
${goalsText}

OUTPUT exactly this JSON schema:
{
  "summary": "2-3 sentence executive summary of all goals",
  "goalBreakdown": [{"goalName": "...", "flag": "green|amber|red", "oneLineSummary": "..."}],
  "topAction": "single most important action the user should take this month",
  "outlook": "1 sentence forward-looking market context for Indian equities"
}

Be concise, specific with ₹ amounts, and actionable. Do not use technical jargon.`;

  const { text, tokensUsed } = await callGemini(prompt);

  if (!text) return { ...fallback, tokensUsed };

  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || fallback.summary,
      goalBreakdown: parsed.goalBreakdown || fallback.goalBreakdown,
      topAction: parsed.topAction || fallback.topAction,
      outlook: parsed.outlook || fallback.outlook,
      tokensUsed
    };
  } catch {
    return { ...fallback, tokensUsed };
  }
}

// ── Token Budget Check ──

export async function checkTokenBudget(): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT tokens_used, budget_limit FROM gemini_token_budget WHERE date = $1`,
      [today]
    );
    if (result.rows.length === 0) {
      return { allowed: true, used: 0, limit: 1500000, remaining: 1500000 };
    }
    const { tokens_used, budget_limit } = result.rows[0];
    const used = parseInt(tokens_used);
    const limit = parseInt(budget_limit);
    return { allowed: used < limit * 0.9, used, limit, remaining: limit - used };
  } finally {
    client.release();
  }
}

export async function recordTokenUsage(tokensUsed: number, goalCount: number, userCount: number, skipped: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO gemini_token_budget (date, tokens_used, requests_made, requests_skipped, users_evaluated, goals_evaluated)
      VALUES ($1, $2, 1, $3, $4, $5)
      ON CONFLICT (date) DO UPDATE SET
        tokens_used = gemini_token_budget.tokens_used + $2,
        requests_made = gemini_token_budget.requests_made + 1,
        requests_skipped = gemini_token_budget.requests_skipped + $3,
        users_evaluated = gemini_token_budget.users_evaluated + $4,
        goals_evaluated = gemini_token_budget.goals_evaluated + $5,
        updated_at = NOW()
    `, [today, tokensUsed, skipped, userCount, goalCount]);
  } finally {
    client.release();
  }
}
