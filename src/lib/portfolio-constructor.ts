/**
 * Aladdin Portfolio Construction Engine
 *
 * NOT a chatbot. Functions as a deterministic pipeline:
 * Input:  User profile + Goal parameters + Fund universe
 * Output: Structured portfolio recommendation (2-5 funds)
 *
 * Pipeline: Filter → Overlap Check → Gemini Prompt → Validate → Fallback
 */

import pool from './postgres-db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Types ──

export interface UserContext {
  userId: string;
  age: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  incomeRange: string;
}

export interface GoalParams {
  targetAmount: number;
  monthlySip: number;
  tenureMonths: number;
  goalName: string;
  criticality: string;
}

export interface GlidePath {
  equityPct: number;
  debtPct: number;
  hybridPct: number;
}

export interface CandidateFund {
  schemeCode: string;
  fundName: string;
  category: string;
  subCategory: string;
  aumCr: number;
  expenseRatio: number;
  cagr3y: number;
  cagr5y: number | null;
  sharpe1y: number | null;
  volatility1y: number | null;
  qualityScore: number;
}

export interface RecommendedFund {
  scheme_code: string;
  fund_name: string;
  category: string;
  sub_category: string;
  monthly_sip_amount: number;
  allocation_percentage: number;
  why_this_fund: string;
}

export interface PortfolioRecommendation {
  portfolio_rationale: string;
  asset_allocation: { equity_pct: number; debt_pct: number; hybrid_pct: number };
  funds: RecommendedFund[];
}

export interface RecommendationResult {
  recommendation: PortfolioRecommendation;
  meta: {
    engine: 'gemini' | 'rule_based';
    tokensUsed: number;
    candidatesConsidered: number;
    overlapChecked: boolean;
  };
}

// ── Tenure-based category allow-lists ──

const TENURE_CATEGORIES: Record<string, string[]> = {
  ultra_short: [
    'Liquid Fund', 'Ultra Short Duration Fund', 'Overnight Fund',
    'Money Market Fund', 'Arbitrage Fund'
  ],
  short: [
    'Liquid Fund', 'Ultra Short Duration Fund', 'Overnight Fund',
    'Money Market Fund', 'Arbitrage Fund',
    'Short Duration Fund', 'Corporate Bond Fund', 'Banking & PSU Fund',
    'Low Duration Fund', 'Floater Fund',
    'Conservative Hybrid Fund', 'Equity Savings Fund'
  ],
  medium: [
    'Liquid Fund', 'Ultra Short Duration Fund', 'Short Duration Fund',
    'Corporate Bond Fund', 'Banking & PSU Fund', 'Floater Fund',
    'Conservative Hybrid Fund', 'Equity Savings Fund',
    'Arbitrage Fund', 'Money Market Fund',
    'Large Cap Fund', 'Flexi Cap Fund',
    'Balanced Advantage Fund', 'Dynamic Asset Allocation',
    'Aggressive Hybrid Fund', 'Balanced Hybrid Fund'
  ],
  long: [
    'Large Cap Fund', 'Flexi Cap Fund', 'Large & Mid Cap Fund',
    'Mid Cap Fund', 'Multi Cap Fund', 'ELSS',
    'Value Fund', 'Contra Fund', 'Focused Fund', 'Dividend Yield Fund',
    'Balanced Advantage Fund', 'Dynamic Asset Allocation',
    'Aggressive Hybrid Fund', 'Balanced Hybrid Fund',
    'Conservative Hybrid Fund',
    'Short Duration Fund', 'Corporate Bond Fund', 'Banking & PSU Fund',
    'Medium Duration Fund', 'Floater Fund',
    'Arbitrage Fund', 'Equity Savings Fund'
  ],
  very_long: [
    'Large Cap Fund', 'Flexi Cap Fund', 'Large & Mid Cap Fund',
    'Mid Cap Fund', 'Small Cap Fund', 'Multi Cap Fund', 'ELSS',
    'Value Fund', 'Contra Fund', 'Focused Fund', 'Dividend Yield Fund',
    'Sectoral/Thematic Funds',
    'Balanced Advantage Fund', 'Dynamic Asset Allocation',
    'Aggressive Hybrid Fund', 'Balanced Hybrid Fund',
    'Conservative Hybrid Fund', 'Multi-Asset Allocation Fund',
    'Short Duration Fund', 'Corporate Bond Fund', 'Banking & PSU Fund',
    'Medium Duration Fund', 'Floater Fund',
    'Arbitrage Fund', 'Equity Savings Fund'
  ]
};

function getAllowedCategories(tenureMonths: number): string[] {
  if (tenureMonths < 12) return TENURE_CATEGORIES.ultra_short;
  if (tenureMonths < 36) return TENURE_CATEGORIES.short;
  if (tenureMonths < 60) return TENURE_CATEGORIES.medium;
  if (tenureMonths < 120) return TENURE_CATEGORIES.long;
  return TENURE_CATEGORIES.very_long;
}

// ══════════════════════════════════════════════════════════════════
//  1. EQUITY GLIDE PATH
// ══════════════════════════════════════════════════════════════════

export function computeEquityGlidePath(
  age: number,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
): GlidePath {
  // Base: 100 - age rule
  let equityPct = Math.max(10, Math.min(90, 100 - age));

  // Risk tolerance adjustment
  switch (riskTolerance) {
    case 'conservative':
      equityPct = Math.round(equityPct * 0.7);
      break;
    case 'aggressive':
      equityPct = Math.min(90, Math.round(equityPct * 1.2));
      break;
    // moderate: no adjustment
  }

  // Floors
  equityPct = Math.max(10, equityPct);
  const debtPct = Math.max(10, 100 - equityPct);
  const actualEquity = 100 - debtPct;

  // Allocate some to hybrid if there's room (10-20% from equity side)
  let hybridPct = 0;
  if (actualEquity >= 40) {
    hybridPct = Math.min(20, Math.round(actualEquity * 0.2));
  }

  return {
    equityPct: actualEquity - hybridPct,
    debtPct,
    hybridPct,
  };
}

// ══════════════════════════════════════════════════════════════════
//  2. OVERLAP MATRIX
// ══════════════════════════════════════════════════════════════════

// Category-based heuristic fallback overlap estimates
const CATEGORY_OVERLAP: Record<string, number> = {
  'same_sub_same_house': 0.80,
  'same_sub_diff_house': 0.50,
  'same_cat_diff_sub': 0.20,
  'diff_cat': 0.05,
};

export async function calculateOverlapMatrix(
  fundCodes: string[]
): Promise<Record<string, Record<string, number>>> {
  const matrix: Record<string, Record<string, number>> = {};

  // Initialize matrix
  for (const code of fundCodes) {
    matrix[code] = {};
    for (const other of fundCodes) {
      if (code !== other) matrix[code][other] = 0;
    }
  }

  if (fundCodes.length < 2) return matrix;

  const client = await pool.connect();
  try {
    // Attempt stock-level overlap via fund_top_holdings
    const holdingsResult = await client.query(`
      SELECT DISTINCT ON (scheme_code, holding_name)
        scheme_code, holding_name, holding_isin, weight_pct
      FROM fund_top_holdings
      WHERE scheme_code = ANY($1)
        AND as_of_date = (
          SELECT MAX(as_of_date) FROM fund_top_holdings
          WHERE scheme_code = ANY($1)
        )
      ORDER BY scheme_code, holding_name, fetched_at DESC
    `, [fundCodes]);

    // Group holdings by scheme_code
    const holdingsMap: Record<string, { name: string; isin: string | null; weight: number }[]> = {};
    for (const row of holdingsResult.rows) {
      if (!holdingsMap[row.scheme_code]) holdingsMap[row.scheme_code] = [];
      holdingsMap[row.scheme_code].push({
        name: row.holding_name.toLowerCase().trim(),
        isin: row.holding_isin,
        weight: parseFloat(row.weight_pct) || 0,
      });
    }

    // Funds with holdings data → stock-level overlap
    const fundsWithHoldings = fundCodes.filter(c => holdingsMap[c]?.length > 0);

    for (let i = 0; i < fundsWithHoldings.length; i++) {
      for (let j = i + 1; j < fundsWithHoldings.length; j++) {
        const a = fundsWithHoldings[i];
        const b = fundsWithHoldings[j];
        const holdingsA = holdingsMap[a];
        const holdingsB = holdingsMap[b];

        let overlap = 0;
        for (const ha of holdingsA) {
          const match = holdingsB.find(hb =>
            (ha.isin && hb.isin && ha.isin === hb.isin) ||
            ha.name === hb.name
          );
          if (match) {
            overlap += Math.min(ha.weight, match.weight);
          }
        }

        const overlapPct = overlap / 100; // Convert to 0-1 range
        matrix[a][b] = overlapPct;
        matrix[b][a] = overlapPct;
      }
    }

    // Funds without holdings data → category heuristic fallback
    const fundsWithoutHoldings = fundCodes.filter(c => !holdingsMap[c]?.length);
    if (fundsWithoutHoldings.length > 0 || fundsWithHoldings.length < fundCodes.length) {
      // Fetch category info for fallback
      const fundInfoResult = await client.query(`
        SELECT scheme_code, category, sub_category, amc_code
        FROM funds
        WHERE scheme_code = ANY($1)
      `, [fundCodes]);

      const fundInfo: Record<string, { cat: string; subCat: string; amc: string }> = {};
      for (const row of fundInfoResult.rows) {
        fundInfo[row.scheme_code] = {
          cat: row.category || '',
          subCat: row.sub_category || '',
          amc: row.amc_code || '',
        };
      }

      // Fill in missing pairs with heuristic
      for (let i = 0; i < fundCodes.length; i++) {
        for (let j = i + 1; j < fundCodes.length; j++) {
          const a = fundCodes[i];
          const b = fundCodes[j];

          // Skip if already computed via stock-level overlap
          if (matrix[a][b] > 0) continue;

          const infoA = fundInfo[a];
          const infoB = fundInfo[b];
          if (!infoA || !infoB) continue;

          let heuristic: number;
          if (infoA.subCat === infoB.subCat && infoA.amc === infoB.amc) {
            heuristic = CATEGORY_OVERLAP.same_sub_same_house;
          } else if (infoA.subCat === infoB.subCat) {
            heuristic = CATEGORY_OVERLAP.same_sub_diff_house;
          } else if (infoA.cat === infoB.cat) {
            heuristic = CATEGORY_OVERLAP.same_cat_diff_sub;
          } else {
            heuristic = CATEGORY_OVERLAP.diff_cat;
          }

          matrix[a][b] = heuristic;
          matrix[b][a] = heuristic;
        }
      }
    }
  } finally {
    client.release();
  }

  return matrix;
}

// ══════════════════════════════════════════════════════════════════
//  3. CANDIDATE FUND FILTERING
// ══════════════════════════════════════════════════════════════════

export async function filterCandidateFunds(
  tenureMonths: number,
  existingHoldings: string[] // scheme_codes to exclude
): Promise<CandidateFund[]> {
  const allowedSubCategories = getAllowedCategories(tenureMonths);

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        f.scheme_code,
        f.scheme_name as fund_name,
        f.category,
        f.sub_category,
        COALESCE(f.fund_size, 0) as aum_cr,
        COALESCE(f.expense_ratio, 0) as expense_ratio,
        COALESCE(fr.cagr_3y, fr.return_3y) as cagr_3y,
        fr.cagr_5y,
        fr.sharpe_1y,
        fr.volatility_1y,
        -- Quality score: 60% return + 40% sharpe (normalized within sub_category)
        COALESCE(
          0.6 * PERCENT_RANK() OVER (
            PARTITION BY f.sub_category ORDER BY COALESCE(fr.cagr_3y, fr.return_3y)
          ) +
          0.4 * PERCENT_RANK() OVER (
            PARTITION BY f.sub_category ORDER BY fr.sharpe_1y
          ),
          0
        ) as quality_score
      FROM funds f
      LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
        AND fr.calculated_date = (SELECT MAX(calculated_date) FROM fund_returns)
      WHERE f.plan_type = 'Direct'
        AND f.option_type = 'Growth'
        AND f.is_active = true
        AND f.sub_category = ANY($1)
        AND COALESCE(f.fund_size, 0) > 500
        AND COALESCE(fr.cagr_3y, fr.return_3y) IS NOT NULL
        AND (fr.sharpe_1y > 0.3 OR fr.sharpe_3y > 0.3 OR fr.sharpe_1y IS NULL)
        AND f.scheme_code != ALL($2)
        AND f.scheme_name NOT ILIKE '%index%'
        AND f.scheme_name NOT ILIKE '%etf%'
        AND f.scheme_name NOT ILIKE '%fund of funds%'
        AND f.scheme_name NOT ILIKE '%fof%'
      ORDER BY quality_score DESC
    `, [allowedSubCategories, existingHoldings]);

    // Limit: top 5 per sub_category
    const perCategory: Record<string, number> = {};
    const filtered: CandidateFund[] = [];

    for (const row of result.rows) {
      const sub = row.sub_category || 'Other';
      perCategory[sub] = (perCategory[sub] || 0) + 1;
      if (perCategory[sub] > 5) continue;

      filtered.push({
        schemeCode: row.scheme_code,
        fundName: row.fund_name,
        category: row.category,
        subCategory: row.sub_category,
        aumCr: parseFloat(row.aum_cr) || 0,
        expenseRatio: parseFloat(row.expense_ratio) || 0,
        cagr3y: parseFloat(row.cagr_3y) || 0,
        cagr5y: row.cagr_5y ? parseFloat(row.cagr_5y) : null,
        sharpe1y: row.sharpe_1y ? parseFloat(row.sharpe_1y) : null,
        volatility1y: row.volatility_1y ? parseFloat(row.volatility_1y) : null,
        qualityScore: parseFloat(row.quality_score) || 0,
      });
    }

    return filtered;
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════════
//  4. GEMINI PROMPT BUILDER
// ══════════════════════════════════════════════════════════════════

function buildGeminiPrompt(
  user: UserContext,
  goal: GoalParams,
  glidePath: GlidePath,
  candidates: CandidateFund[],
  overlapMatrix: Record<string, Record<string, number>>,
  existingHoldingNames: string[]
): string {
  const tenureYears = (goal.tenureMonths / 12).toFixed(1);

  // Build candidate funds table
  const candidateTable = candidates.map(f =>
    `${f.schemeCode} | ${f.fundName} | ${f.category} | ${f.subCategory} | ${f.aumCr.toFixed(0)} | ${f.expenseRatio.toFixed(2)}% | ${f.cagr3y.toFixed(1)}% | ${f.cagr5y?.toFixed(1) ?? 'N/A'}% | ${f.sharpe1y?.toFixed(2) ?? 'N/A'} | ${f.volatility1y?.toFixed(1) ?? 'N/A'}% | ${f.qualityScore.toFixed(3)}`
  ).join('\n');

  // Build overlap matrix table (only pairs > 5%)
  const overlapPairs: string[] = [];
  const codes = Object.keys(overlapMatrix);
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const overlap = overlapMatrix[codes[i]][codes[j]];
      if (overlap > 0.05) {
        overlapPairs.push(`${codes[i]} | ${codes[j]} | ${(overlap * 100).toFixed(1)}%`);
      }
    }
  }
  const overlapTable = overlapPairs.length > 0
    ? overlapPairs.join('\n')
    : 'No significant overlaps detected between candidates.';

  const existingStr = existingHoldingNames.length > 0
    ? existingHoldingNames.join(', ')
    : 'None';

  return `You are a SEBI-registered Investment Advisor AI for Indian retail mutual fund investors.
You construct diversified SIP portfolios based on goal parameters, risk profiles, and
quantitative fund metrics. You follow Modern Portfolio Theory principles adapted for
Indian mutual fund investors.

HARD RULES (violating any = invalid output):
1. Only recommend from the CANDIDATE FUNDS list provided below. Never invent fund names.
2. Sum of allocation_percentage MUST equal exactly 100.
3. No two funds in the portfolio may have overlap > 20% (overlap matrix provided below).
4. Minimum 2 funds, maximum 5 funds in the portfolio.
5. monthly_sip_amount for each fund must be rounded to nearest ₹100.
6. Sum of all monthly_sip_amount must equal exactly ₹${goal.monthlySip}.

MACRO/MICRO AWARENESS:
- If tenure < 3 years: STRICTLY avoid Small Cap, Mid Cap, Sectoral/Thematic funds. Prioritize: Liquid, Short Duration, Arbitrage, Conservative Hybrid.
- If tenure 3-5 years: Cap Small Cap allocation at 10%. Prefer Large Cap, Flexi Cap.
- If tenure 5-10 years: Allow Mid Cap up to 20%, Small Cap up to 15%.
- If tenure > 10 years: Full spectrum allowed. Small Cap up to 25%.

QUALITY GATE (proxy for CRISIL 4-5 star):
- Only pick funds with Sharpe > 0.5 OR 3Y CAGR in top quartile of their sub-category.
- Prefer funds with AUM > ₹1,000 Cr (institutional confidence signal).
- Prefer funds with lower expense ratio within same sub-category.

AGE-BASED GLIDE PATH:
- Target equity allocation: ${glidePath.equityPct}%
- Target debt allocation: ${glidePath.debtPct}%
- Target hybrid allocation: ${glidePath.hybridPct}%
- Hybrid funds count as 60% equity + 40% debt for allocation math.

INPUT DATA:
- User Age: ${user.age}
- Risk Tolerance: ${user.riskTolerance}
- Goal: ${goal.goalName} (${goal.criticality} priority)
- Target Amount: ₹${goal.targetAmount.toLocaleString('en-IN')}
- Monthly SIP Budget: ₹${goal.monthlySip.toLocaleString('en-IN')}
- Tenure: ${goal.tenureMonths} months (${tenureYears} years)
- Current Portfolio Holdings (avoid duplicates): ${existingStr}

CANDIDATE FUNDS (pre-filtered for tenure + quality):
scheme_code | fund_name | category | sub_category | aum_cr | expense_ratio | cagr_3y | cagr_5y | sharpe_1y | volatility_1y | quality_score
${candidateTable}

OVERLAP MATRIX (between candidate funds, pairs > 5%):
fund_A | fund_B | overlap_pct
${overlapTable}

OUTPUT exactly this JSON schema (no markdown, no code blocks, no explanation outside JSON):
{
  "portfolio_rationale": "2-3 sentence plain-English explanation of the strategy and why these specific funds were chosen.",
  "asset_allocation": {
    "equity_pct": number,
    "debt_pct": number,
    "hybrid_pct": number
  },
  "funds": [
    {
      "scheme_code": "string",
      "fund_name": "string",
      "category": "string",
      "sub_category": "string",
      "monthly_sip_amount": number,
      "allocation_percentage": number,
      "why_this_fund": "1 sentence explaining why this specific fund over alternatives in same category"
    }
  ]
}`;
}

// ══════════════════════════════════════════════════════════════════
//  5. GEMINI API CALL (portfolio-specific, higher token budget)
// ══════════════════════════════════════════════════════════════════

async function callGeminiForPortfolio(prompt: string): Promise<{ text: string; tokensUsed: number }> {
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
          temperature: 0.1,
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 1500,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      console.error('Gemini Aladdin API error:', response.status, await response.text());
      return { text: '', tokensUsed: 0 };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed =
      (data.usageMetadata?.promptTokenCount || 0) +
      (data.usageMetadata?.candidatesTokenCount || 0);

    return { text, tokensUsed };
  } catch (error) {
    console.error('Gemini Aladdin call failed:', error);
    return { text: '', tokensUsed: 0 };
  }
}

// ══════════════════════════════════════════════════════════════════
//  6. VALIDATION
// ══════════════════════════════════════════════════════════════════

function validateRecommendation(
  rec: PortfolioRecommendation,
  candidates: CandidateFund[],
  overlapMatrix: Record<string, Record<string, number>>,
  monthlySip: number
): string | null {
  // Check fund count
  if (!rec.funds || rec.funds.length < 2 || rec.funds.length > 5) {
    return `Fund count must be 2-5, got ${rec.funds?.length ?? 0}`;
  }

  // Check all funds are from candidates
  const candidateCodes = new Set(candidates.map(c => c.schemeCode));
  for (const f of rec.funds) {
    if (!candidateCodes.has(f.scheme_code)) {
      return `Fund ${f.scheme_code} not in candidate list`;
    }
  }

  // Check allocation sums to 100
  const allocSum = rec.funds.reduce((s, f) => s + f.allocation_percentage, 0);
  if (Math.abs(allocSum - 100) > 1) {
    return `Allocation sums to ${allocSum}%, expected 100%`;
  }

  // Check SIP sums to budget
  const sipSum = rec.funds.reduce((s, f) => s + f.monthly_sip_amount, 0);
  if (Math.abs(sipSum - monthlySip) > 100) {
    return `SIP sums to ₹${sipSum}, expected ₹${monthlySip}`;
  }

  // Check overlap constraint
  for (let i = 0; i < rec.funds.length; i++) {
    for (let j = i + 1; j < rec.funds.length; j++) {
      const a = rec.funds[i].scheme_code;
      const b = rec.funds[j].scheme_code;
      const overlap = overlapMatrix[a]?.[b] ?? 0;
      if (overlap > 0.20) {
        return `Overlap between ${a} and ${b} is ${(overlap * 100).toFixed(1)}% (max 20%)`;
      }
    }
  }

  return null; // Valid
}

// ══════════════════════════════════════════════════════════════════
//  7. RULE-BASED FALLBACK
// ══════════════════════════════════════════════════════════════════

function ruleBasedPortfolio(
  candidates: CandidateFund[],
  glidePath: GlidePath,
  monthlySip: number,
  tenureMonths: number
): PortfolioRecommendation {
  // Define allocation templates by tenure
  type AllocSlot = { subCategories: string[]; pctOfTotal: number };
  let template: AllocSlot[];

  if (tenureMonths < 12) {
    template = [
      { subCategories: ['Liquid Fund', 'Ultra Short Duration Fund', 'Overnight Fund'], pctOfTotal: 100 },
    ];
  } else if (tenureMonths < 36) {
    template = [
      { subCategories: ['Short Duration Fund', 'Corporate Bond Fund', 'Banking & PSU Fund', 'Low Duration Fund'], pctOfTotal: 60 },
      { subCategories: ['Arbitrage Fund', 'Equity Savings Fund'], pctOfTotal: 40 },
    ];
  } else if (tenureMonths < 60) {
    template = [
      { subCategories: ['Large Cap Fund', 'Flexi Cap Fund'], pctOfTotal: 50 },
      { subCategories: ['Short Duration Fund', 'Corporate Bond Fund'], pctOfTotal: 30 },
      { subCategories: ['Aggressive Hybrid Fund', 'Balanced Advantage Fund'], pctOfTotal: 20 },
    ];
  } else if (tenureMonths < 120) {
    template = [
      { subCategories: ['Flexi Cap Fund', 'Large Cap Fund'], pctOfTotal: 40 },
      { subCategories: ['Mid Cap Fund', 'Large & Mid Cap Fund'], pctOfTotal: 25 },
      { subCategories: ['Short Duration Fund', 'Corporate Bond Fund'], pctOfTotal: 20 },
      { subCategories: ['ELSS', 'Value Fund'], pctOfTotal: 15 },
    ];
  } else {
    template = [
      { subCategories: ['Flexi Cap Fund', 'Large Cap Fund'], pctOfTotal: 35 },
      { subCategories: ['Mid Cap Fund', 'Large & Mid Cap Fund'], pctOfTotal: 25 },
      { subCategories: ['Small Cap Fund'], pctOfTotal: 20 },
      { subCategories: ['Short Duration Fund', 'Corporate Bond Fund'], pctOfTotal: 20 },
    ];
  }

  // Adjust for glide path: scale equity slots down if conservative
  const equityRatio = glidePath.equityPct / 70; // 70% is the "moderate" baseline
  const debtRatio = glidePath.debtPct / 30;

  const funds: RecommendedFund[] = [];
  const usedAMCs = new Set<string>();

  for (const slot of template) {
    const isEquitySlot = slot.subCategories.some(sc =>
      ['Large Cap Fund', 'Flexi Cap Fund', 'Mid Cap Fund', 'Small Cap Fund',
       'Large & Mid Cap Fund', 'Multi Cap Fund', 'ELSS', 'Value Fund',
       'Contra Fund', 'Focused Fund', 'Dividend Yield Fund'].includes(sc)
    );
    const isHybridSlot = slot.subCategories.some(sc =>
      ['Aggressive Hybrid Fund', 'Balanced Advantage Fund', 'Dynamic Asset Allocation',
       'Balanced Hybrid Fund', 'Conservative Hybrid Fund', 'Arbitrage Fund',
       'Equity Savings Fund', 'Multi-Asset Allocation Fund'].includes(sc)
    );

    // Adjust allocation based on glide path
    let adjustedPct = slot.pctOfTotal;
    if (isEquitySlot) adjustedPct = Math.round(adjustedPct * Math.min(equityRatio, 1.3));
    else if (!isHybridSlot) adjustedPct = Math.round(adjustedPct * Math.min(debtRatio, 1.3));

    // Pick best candidate from allowed sub-categories
    const match = candidates.find(c =>
      slot.subCategories.includes(c.subCategory) && !usedAMCs.has(c.fundName.split(' ')[0])
    );

    if (match) {
      const sipAmount = Math.round((adjustedPct / 100) * monthlySip / 100) * 100;
      if (sipAmount >= 100) {
        funds.push({
          scheme_code: match.schemeCode,
          fund_name: match.fundName,
          category: match.category,
          sub_category: match.subCategory,
          monthly_sip_amount: sipAmount,
          allocation_percentage: adjustedPct,
          why_this_fund: `Top-ranked in ${match.subCategory} by quality score (${match.qualityScore.toFixed(2)}).`,
        });
        usedAMCs.add(match.fundName.split(' ')[0]);
      }
    }
  }

  // Normalize allocations to exactly 100% and SIP to exact budget
  if (funds.length > 0) {
    const allocTotal = funds.reduce((s, f) => s + f.allocation_percentage, 0);
    const sipTotal = funds.reduce((s, f) => s + f.monthly_sip_amount, 0);

    // Normalize allocation
    funds.forEach(f => {
      f.allocation_percentage = Math.round((f.allocation_percentage / allocTotal) * 100);
    });
    // Fix rounding — give remainder to largest fund
    const allocDiff = 100 - funds.reduce((s, f) => s + f.allocation_percentage, 0);
    funds[0].allocation_percentage += allocDiff;

    // Normalize SIP
    funds.forEach(f => {
      f.monthly_sip_amount = Math.round((f.allocation_percentage / 100) * monthlySip / 100) * 100;
    });
    const sipDiff = monthlySip - funds.reduce((s, f) => s + f.monthly_sip_amount, 0);
    funds[0].monthly_sip_amount += sipDiff;
  }

  return {
    portfolio_rationale: `Rule-based portfolio allocation for a ${(tenureMonths / 12).toFixed(0)}-year goal. Equity ${glidePath.equityPct}%, Debt ${glidePath.debtPct}%, Hybrid ${glidePath.hybridPct}% based on age and risk tolerance.`,
    asset_allocation: glidePath,
    funds,
  };
}

// ══════════════════════════════════════════════════════════════════
//  8. MAIN PIPELINE — constructPortfolio()
// ══════════════════════════════════════════════════════════════════

export async function constructPortfolio(
  user: UserContext,
  goal: GoalParams
): Promise<RecommendationResult> {
  // 1. Compute glide path
  const glidePath = computeEquityGlidePath(user.age, user.riskTolerance);

  // 2. Get user's existing holdings (to avoid duplicates)
  const client = await pool.connect();
  let existingHoldings: string[] = [];
  let existingHoldingNames: string[] = [];
  try {
    const holdingsResult = await client.query(
      `SELECT DISTINCT ph.scheme_code, f.scheme_name
       FROM portfolio_holdings ph
       LEFT JOIN funds f ON ph.scheme_code = f.scheme_code
       WHERE ph.user_id = $1`,
      [user.userId]
    );
    existingHoldings = holdingsResult.rows.map(r => r.scheme_code);
    existingHoldingNames = holdingsResult.rows
      .filter(r => r.scheme_name)
      .map(r => r.scheme_name);
  } finally {
    client.release();
  }

  // 3. Filter candidate funds
  const candidates = await filterCandidateFunds(goal.tenureMonths, existingHoldings);

  if (candidates.length === 0) {
    // No candidates found — widen filter by reducing AUM threshold
    const widened = await filterCandidateFunds(goal.tenureMonths, []);
    if (widened.length === 0) {
      return {
        recommendation: {
          portfolio_rationale: 'Unable to find suitable funds matching your criteria. Please try adjusting your tenure or SIP amount.',
          asset_allocation: glidePath,
          funds: [],
        },
        meta: { engine: 'rule_based', tokensUsed: 0, candidatesConsidered: 0, overlapChecked: false },
      };
    }
    // Fall through with widened candidates
    candidates.push(...widened.slice(0, 30));
  }

  // 4. Calculate overlap matrix (only for top candidates — limit to 30 for performance)
  const topCandidates = candidates.slice(0, 30);
  const candidateCodes = topCandidates.map(c => c.schemeCode);
  const overlapMatrix = await calculateOverlapMatrix(candidateCodes);

  // 5. Build Gemini prompt
  const prompt = buildGeminiPrompt(user, goal, glidePath, topCandidates, overlapMatrix, existingHoldingNames);

  // 6. Call Gemini
  const { text, tokensUsed } = await callGeminiForPortfolio(prompt);

  if (text) {
    try {
      const parsed: PortfolioRecommendation = JSON.parse(text);
      const validationError = validateRecommendation(parsed, topCandidates, overlapMatrix, goal.monthlySip);

      if (!validationError) {
        // Log token usage
        try {
          const logClient = await pool.connect();
          try {
            await logClient.query(`
              INSERT INTO gemini_token_budget (budget_date, tokens_used, requests_made)
              VALUES (CURRENT_DATE, $1, 1)
              ON CONFLICT (budget_date) DO UPDATE
              SET tokens_used = gemini_token_budget.tokens_used + $1,
                  requests_made = gemini_token_budget.requests_made + 1
            `, [tokensUsed]);
          } finally {
            logClient.release();
          }
        } catch (_) { /* non-critical */ }

        return {
          recommendation: parsed,
          meta: {
            engine: 'gemini',
            tokensUsed,
            candidatesConsidered: topCandidates.length,
            overlapChecked: true,
          },
        };
      }

      // Validation failed — retry once with error context
      console.warn('Aladdin validation failed:', validationError, '— retrying with feedback');
      const retryPrompt = prompt + `\n\nPREVIOUS ATTEMPT FAILED VALIDATION: ${validationError}\nPlease fix this issue and return corrected JSON.`;
      const retry = await callGeminiForPortfolio(retryPrompt);
      if (retry.text) {
        try {
          const retryParsed: PortfolioRecommendation = JSON.parse(retry.text);
          const retryError = validateRecommendation(retryParsed, topCandidates, overlapMatrix, goal.monthlySip);
          if (!retryError) {
            return {
              recommendation: retryParsed,
              meta: {
                engine: 'gemini',
                tokensUsed: tokensUsed + retry.tokensUsed,
                candidatesConsidered: topCandidates.length,
                overlapChecked: true,
              },
            };
          }
        } catch (_) { /* fall through to rule-based */ }
      }
    } catch (parseError) {
      console.error('Aladdin: Failed to parse Gemini JSON:', parseError);
    }
  }

  // 7. Fallback to rule-based
  console.log('Aladdin: Falling back to rule-based portfolio');
  const fallback = ruleBasedPortfolio(topCandidates, glidePath, goal.monthlySip, goal.tenureMonths);

  return {
    recommendation: fallback,
    meta: {
      engine: 'rule_based',
      tokensUsed: 0,
      candidatesConsidered: topCandidates.length,
      overlapChecked: false,
    },
  };
}
