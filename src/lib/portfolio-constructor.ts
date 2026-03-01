/**
 * Aladdin Portfolio Construction Engine — "Decoupled Brain" Architecture
 *
 * NOT a chatbot. Functions as a deterministic pipeline:
 * Input:  User profile + Goal parameters + Fund universe + Linked Funds
 * Output: Structured portfolio recommendation (2-5 funds)
 *
 * Pipeline: Filter → Overlap Check → Gemini Chain-of-Thought → Validate → Fallback
 *
 * Key resiliency:
 *   - 8.5s AbortController on Gemini call (Vercel safety net)
 *   - Single immediate retry (no exponential backoff on user-facing requests)
 *   - Deterministic rule-based fallback always returns a valid portfolio
 *   - Dual-path auditor: audits linked funds OR builds from scratch
 */

import pool from './postgres-db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Strict timeout: Vercel free tier kills at 10-15s. We abort at 8.5s to leave
// headroom for rule-based fallback + response serialization.
const GEMINI_TIMEOUT_MS = 8500;

// ── Types ──

export interface UserContext {
  userId: string;
  age: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  incomeRange: string;
}

export interface LinkedFundInfo {
  schemeCode: string;
  fundName: string;
  allocationPct: number;
  category?: string;
  subCategory?: string;
  cagr3y?: number;
  sharpe1y?: number;
  volatility1y?: number;
  healthScore?: number;
}

export interface GoalParams {
  targetAmount: number;
  monthlySip: number;
  tenureMonths: number;
  goalName: string;
  criticality: string;
  linkedFunds?: LinkedFundInfo[];
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

export interface ThinkingProcess {
  macro_micro_evaluation: string;
  fund_manager_and_metrics_audit: string;
}

export interface PortfolioRecommendation {
  thinking_process?: ThinkingProcess;
  action_required: 'KEEP_EXISTING' | 'REBALANCE' | 'BUILD_NEW';
  portfolio_rationale: string;
  asset_allocation: { equity_pct: number; debt_pct: number; hybrid_pct: number };
  funds: RecommendedFund[];
}

export interface RecommendationResult {
  recommendation: PortfolioRecommendation;
  meta: {
    engine: 'gemini' | 'rule_based' | 'cached';
    tokensUsed: number;
    candidatesConsidered: number;
    overlapChecked: boolean;
  };
}

// ══════════════════════════════════════════════════════════════════
//  MARKDOWN SANITIZER
//  Strips ```json / ``` fences from Gemini output before JSON.parse
// ══════════════════════════════════════════════════════════════════

function extractCleanJson(raw: string): string {
  if (!raw || !raw.trim()) return '';
  let cleaned = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?\s*```\s*$/i, '');

  // Also handle cases where there's text before the JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

// ══════════════════════════════════════════════════════════════════
//  O(1) ARCHETYPE CACHE
//  Hash: AgeBucket + RiskProfile + TenureBucket → cache key
// ══════════════════════════════════════════════════════════════════

function computeAgeBucket(age: number): string {
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  return '60s+';
}

function computeTenureBucket(tenureMonths: number): string {
  if (tenureMonths < 12) return 'ultra_short';
  if (tenureMonths < 36) return 'short';
  if (tenureMonths < 60) return 'medium';
  if (tenureMonths < 120) return 'long';
  return 'very_long';
}

function computeArchetypeKey(age: number, riskTolerance: string, tenureMonths: number): string {
  return `${computeAgeBucket(age)}_${riskTolerance}_${computeTenureBucket(tenureMonths)}`;
}

async function lookupArchetypeCache(key: string): Promise<PortfolioRecommendation | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE ai_archetypes
       SET hit_count = hit_count + 1
       WHERE archetype_key = $1 AND expires_at > NOW()
       RETURNING recommendation`,
      [key]
    );
    if (result.rows.length > 0) {
      return result.rows[0].recommendation as PortfolioRecommendation;
    }
    return null;
  } catch (err) {
    console.error('Archetype cache lookup failed:', err);
    return null;
  } finally {
    client.release();
  }
}

async function saveArchetypeCache(
  key: string,
  age: number,
  riskTolerance: string,
  tenureMonths: number,
  recommendation: PortfolioRecommendation
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO ai_archetypes (archetype_key, age_bucket, risk_profile, tenure_bucket, recommendation, hit_count, updated_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW() + INTERVAL '30 days')
       ON CONFLICT (archetype_key) DO UPDATE
       SET recommendation = $5,
           hit_count = 0,
           updated_at = NOW(),
           expires_at = NOW() + INTERVAL '30 days'`,
      [key, computeAgeBucket(age), riskTolerance, computeTenureBucket(tenureMonths), JSON.stringify(recommendation)]
    );
  } catch (err) {
    console.error('Archetype cache save failed:', err);
  } finally {
    client.release();
  }
}

/**
 * Scale a cached percentage-based recommendation to the user's actual SIP amount.
 */
function scaleRecommendation(
  cached: PortfolioRecommendation,
  actualMonthlySip: number
): PortfolioRecommendation {
  const scaled = { ...cached, funds: cached.funds.map(f => ({ ...f })) };

  scaled.funds.forEach(f => {
    f.monthly_sip_amount = Math.round((f.allocation_percentage / 100) * actualMonthlySip / 100) * 100;
  });

  const sipSum = scaled.funds.reduce((s, f) => s + f.monthly_sip_amount, 0);
  const diff = actualMonthlySip - sipSum;
  if (diff !== 0 && scaled.funds.length > 0) {
    const largest = scaled.funds.reduce((a, b) =>
      b.allocation_percentage > a.allocation_percentage ? b : a
    );
    largest.monthly_sip_amount += diff;
  }

  return scaled;
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
  let equityPct = Math.max(10, Math.min(90, 100 - age));

  switch (riskTolerance) {
    case 'conservative':
      equityPct = Math.round(equityPct * 0.7);
      break;
    case 'aggressive':
      equityPct = Math.min(90, Math.round(equityPct * 1.2));
      break;
  }

  equityPct = Math.max(10, equityPct);
  const debtPct = Math.max(10, 100 - equityPct);
  const actualEquity = 100 - debtPct;

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

    const holdingsMap: Record<string, { name: string; isin: string | null; weight: number }[]> = {};
    for (const row of holdingsResult.rows) {
      if (!holdingsMap[row.scheme_code]) holdingsMap[row.scheme_code] = [];
      holdingsMap[row.scheme_code].push({
        name: row.holding_name.toLowerCase().trim(),
        isin: row.holding_isin,
        weight: parseFloat(row.weight_pct) || 0,
      });
    }

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

        const overlapPct = overlap / 100;
        matrix[a][b] = overlapPct;
        matrix[b][a] = overlapPct;
      }
    }

    // Category heuristic fallback for funds without holdings data
    const fundsWithoutHoldings = fundCodes.filter(c => !holdingsMap[c]?.length);
    if (fundsWithoutHoldings.length > 0 || fundsWithHoldings.length < fundCodes.length) {
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

      for (let i = 0; i < fundCodes.length; i++) {
        for (let j = i + 1; j < fundCodes.length; j++) {
          const a = fundCodes[i];
          const b = fundCodes[j];

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
  existingHoldings: string[]
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
//  4. GEMINI PROMPT BUILDER — Chain-of-Thought + Dual-Path Auditor
// ══════════════════════════════════════════════════════════════════

function buildGeminiPrompt(
  user: UserContext,
  goal: GoalParams,
  glidePath: GlidePath,
  candidates: CandidateFund[],
  overlapMatrix: Record<string, Record<string, number>>,
  existingHoldingNames: string[],
  linkedFunds: LinkedFundInfo[]
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

  // Build linked funds section for dual-path auditor
  let linkedFundsSection: string;
  let dualPathInstructions: string;

  if (linkedFunds.length > 0) {
    const linkedTable = linkedFunds.map(f =>
      `${f.schemeCode} | ${f.fundName} | ${f.category ?? 'N/A'} | ${f.subCategory ?? 'N/A'} | ${f.allocationPct}% | ${f.cagr3y?.toFixed(1) ?? 'N/A'}% | ${f.sharpe1y?.toFixed(2) ?? 'N/A'} | ${f.volatility1y?.toFixed(1) ?? 'N/A'}% | Health: ${f.healthScore?.toFixed(0) ?? 'N/A'}/100`
    ).join('\n');

    linkedFundsSection = `LINKED FUNDS (currently assigned to this goal by user):
scheme_code | fund_name | category | sub_category | allocation_pct | cagr_3y | sharpe_1y | volatility_1y | health_score
${linkedTable}`;

    dualPathInstructions = `DUAL-PATH AUDITOR MODE:
The user has EXISTING linked funds for this goal (listed above).
You MUST act as a ruthless auditor:
1. Evaluate if each linked fund's metrics (returns, Sharpe, volatility, health score) are sufficient to reach the target within the tenure.
2. Check if the linked funds have excessive overlap (>20%) between them.
3. Verify the linked funds' combined asset allocation matches the glide path target.
4. DECISION:
   - If ALL linked funds are high quality (health > 60), have low overlap, and match glide path → set action_required = "KEEP_EXISTING". Return the linked funds as-is with updated SIP amounts.
   - If SOME linked funds are underperforming or overlap is too high → set action_required = "REBALANCE". Keep good funds, swap bad ones from the CANDIDATE FUNDS list.
   - If MOST linked funds are poor quality → set action_required = "BUILD_NEW". Construct entirely from CANDIDATE FUNDS list.`;
  } else {
    linkedFundsSection = 'LINKED FUNDS: None (user has no funds assigned to this goal)';
    dualPathInstructions = `ARCHITECT MODE:
No funds are currently linked to this goal. You MUST set action_required = "BUILD_NEW" and construct a complete portfolio from the CANDIDATE FUNDS list.`;
  }

  return `You are a SEBI-registered Investment Advisor AI for Indian retail mutual fund investors.
You construct diversified SIP portfolios based on goal parameters, risk profiles, and
quantitative fund metrics. You follow Modern Portfolio Theory principles adapted for
Indian mutual fund investors.

IMPORTANT: You must THINK before acting. First analyze the macro/micro conditions and
fund metrics in your thinking_process, THEN decide on an action, THEN output the portfolio.

HARD RULES (violating any = invalid output):
1. Only recommend from the CANDIDATE FUNDS list provided below. Never invent fund names or scheme codes.
2. Sum of allocation_percentage MUST equal exactly 100.
3. No two funds in the portfolio may have overlap > 20% (overlap matrix provided below).
4. Minimum 2 funds, maximum 5 funds in the portfolio.
5. monthly_sip_amount for each fund must be rounded to nearest 100.
6. Sum of all monthly_sip_amount must equal exactly ${goal.monthlySip}.

${dualPathInstructions}

MACRO/MICRO AWARENESS:
- If tenure < 3 years: STRICTLY avoid Small Cap, Mid Cap, Sectoral/Thematic funds. Prioritize: Liquid, Short Duration, Arbitrage, Conservative Hybrid.
- If tenure 3-5 years: Cap Small Cap allocation at 10%. Prefer Large Cap, Flexi Cap.
- If tenure 5-10 years: Allow Mid Cap up to 20%, Small Cap up to 15%.
- If tenure > 10 years: Full spectrum allowed. Small Cap up to 25%.

QUALITY GATE (proxy for CRISIL 4-5 star):
- Only pick funds with Sharpe > 0.5 OR 3Y CAGR in top quartile of their sub-category.
- Prefer funds with AUM > 1,000 Cr (institutional confidence signal).
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
- Target Amount: ${goal.targetAmount.toLocaleString('en-IN')}
- Monthly SIP Budget: ${goal.monthlySip.toLocaleString('en-IN')}
- Tenure: ${goal.tenureMonths} months (${tenureYears} years)
- Current Portfolio Holdings (avoid duplicates): ${existingStr}

${linkedFundsSection}

CANDIDATE FUNDS (pre-filtered for tenure + quality):
scheme_code | fund_name | category | sub_category | aum_cr | expense_ratio | cagr_3y | cagr_5y | sharpe_1y | volatility_1y | quality_score
${candidateTable}

OVERLAP MATRIX (between candidate funds, pairs > 5%):
fund_A | fund_B | overlap_pct
${overlapTable}

OUTPUT exactly this JSON schema (no markdown, no code blocks, no explanation outside JSON):
{
  "thinking_process": {
    "macro_micro_evaluation": "2-3 sentences analyzing: current economic conditions relevant to the tenure, how inflation and market regime affect this specific goal, and what asset classes are favorable right now.",
    "fund_manager_and_metrics_audit": "2-3 sentences evaluating: the quality scores, rolling returns, Sharpe ratios, and drawdown characteristics of the top candidates (or linked funds if auditing). Identify which funds stand out and which are weak."
  },
  "action_required": "KEEP_EXISTING" | "REBALANCE" | "BUILD_NEW",
  "portfolio_rationale": "2-3 sentence plain-English explanation of the strategy and why these specific funds were chosen or retained.",
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
//  5. GEMINI API CALL — Ironclad AbortController (8.5s timeout)
// ══════════════════════════════════════════════════════════════════

async function callGeminiForPortfolio(
  prompt: string
): Promise<{ text: string; tokensUsed: number }> {
  if (!GEMINI_API_KEY) {
    console.warn('Aladdin: No GEMINI_API_KEY — skipping Gemini call');
    return { text: '', tokensUsed: 0 };
  }

  // Single attempt + single retry. No exponential backoff on user-facing requests.
  for (let attempt = 0; attempt <= 1; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.95,
            maxOutputTokens: 2500, // Increased for Chain-of-Thought thinking_process
            responseMimeType: 'application/json',
          },
        }),
      });

      clearTimeout(timeoutId);

      // Rate limit: immediate retry (no sleep)
      if ((response.status === 429 || response.status === 503) && attempt === 0) {
        console.warn(`Gemini ${response.status} — immediate retry (attempt 2/2)`);
        continue;
      }

      if (!response.ok) {
        console.error('Gemini Aladdin API error:', response.status, await response.text());
        return { text: '', tokensUsed: 0 };
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokensUsed =
        (data.usageMetadata?.promptTokenCount || 0) +
        (data.usageMetadata?.candidatesTokenCount || 0);

      const text = extractCleanJson(rawText);
      return { text, tokensUsed };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.warn(`Gemini aborted after ${GEMINI_TIMEOUT_MS}ms (attempt ${attempt + 1}/2) — falling back to rule-based`);
        return { text: '', tokensUsed: 0 };
      }

      if (attempt === 0) {
        console.warn('Gemini network error — immediate retry:', error.message);
        continue;
      }

      console.error('Gemini Aladdin call failed after retry:', error);
      return { text: '', tokensUsed: 0 };
    }
  }

  return { text: '', tokensUsed: 0 };
}

// ══════════════════════════════════════════════════════════════════
//  6. VALIDATION
// ══════════════════════════════════════════════════════════════════

function validateRecommendation(
  rec: PortfolioRecommendation,
  candidates: CandidateFund[],
  overlapMatrix: Record<string, Record<string, number>>,
  monthlySip: number,
  linkedFunds: LinkedFundInfo[]
): string | null {
  if (!rec.funds || rec.funds.length < 2 || rec.funds.length > 5) {
    return `Fund count must be 2-5, got ${rec.funds?.length ?? 0}`;
  }

  // Build valid codes: candidates + linked fund codes
  const validCodes = new Set(candidates.map(c => c.schemeCode));
  for (const lf of linkedFunds) validCodes.add(lf.schemeCode);

  for (const f of rec.funds) {
    if (!validCodes.has(f.scheme_code)) {
      return `Fund ${f.scheme_code} not in candidate or linked fund list`;
    }
  }

  const allocSum = rec.funds.reduce((s, f) => s + f.allocation_percentage, 0);
  if (Math.abs(allocSum - 100) > 1) {
    return `Allocation sums to ${allocSum}%, expected 100%`;
  }

  const sipSum = rec.funds.reduce((s, f) => s + f.monthly_sip_amount, 0);
  if (Math.abs(sipSum - monthlySip) > 100) {
    return `SIP sums to ${sipSum}, expected ${monthlySip}`;
  }

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

  // Validate action_required field
  const validActions = ['KEEP_EXISTING', 'REBALANCE', 'BUILD_NEW'];
  if (!validActions.includes(rec.action_required)) {
    return `action_required must be one of ${validActions.join(', ')}, got "${rec.action_required}"`;
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════
//  7. RULE-BASED FALLBACK — Always returns a valid portfolio
// ══════════════════════════════════════════════════════════════════

function ruleBasedPortfolio(
  candidates: CandidateFund[],
  glidePath: GlidePath,
  monthlySip: number,
  tenureMonths: number
): PortfolioRecommendation {
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

  const equityRatio = glidePath.equityPct / 70;
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

    let adjustedPct = slot.pctOfTotal;
    if (isEquitySlot) adjustedPct = Math.round(adjustedPct * Math.min(equityRatio, 1.3));
    else if (!isHybridSlot) adjustedPct = Math.round(adjustedPct * Math.min(debtRatio, 1.3));

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

  if (funds.length > 0) {
    const allocTotal = funds.reduce((s, f) => s + f.allocation_percentage, 0);

    funds.forEach(f => {
      f.allocation_percentage = Math.round((f.allocation_percentage / allocTotal) * 100);
    });
    const allocDiff = 100 - funds.reduce((s, f) => s + f.allocation_percentage, 0);
    funds[0].allocation_percentage += allocDiff;

    funds.forEach(f => {
      f.monthly_sip_amount = Math.round((f.allocation_percentage / 100) * monthlySip / 100) * 100;
    });
    const sipDiff = monthlySip - funds.reduce((s, f) => s + f.monthly_sip_amount, 0);
    funds[0].monthly_sip_amount += sipDiff;
  }

  return {
    action_required: 'BUILD_NEW',
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
  const glidePath = computeEquityGlidePath(user.age, user.riskTolerance);
  const linkedFunds = goal.linkedFunds || [];

  // ── Archetype Cache (skip if user has linked funds — needs personalized audit) ──
  if (linkedFunds.length === 0) {
    const archetypeKey = computeArchetypeKey(user.age, user.riskTolerance, goal.tenureMonths);
    const cached = await lookupArchetypeCache(archetypeKey);
    if (cached && cached.funds?.length >= 2) {
      console.log(`Aladdin: Cache HIT for archetype "${archetypeKey}" — scaling to ${goal.monthlySip}/mo`);
      const scaled = scaleRecommendation(cached, goal.monthlySip);
      return {
        recommendation: scaled,
        meta: {
          engine: 'cached',
          tokensUsed: 0,
          candidatesConsidered: 0,
          overlapChecked: true,
        },
      };
    }
  }

  // Get user's existing holdings (to avoid duplicates)
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

  // Filter candidate funds
  const candidates = await filterCandidateFunds(goal.tenureMonths, existingHoldings);

  if (candidates.length === 0) {
    const widened = await filterCandidateFunds(goal.tenureMonths, []);
    if (widened.length === 0) {
      return {
        recommendation: {
          action_required: 'BUILD_NEW',
          portfolio_rationale: 'Unable to find suitable funds matching your criteria. Please try adjusting your tenure or SIP amount.',
          asset_allocation: glidePath,
          funds: [],
        },
        meta: { engine: 'rule_based', tokensUsed: 0, candidatesConsidered: 0, overlapChecked: false },
      };
    }
    candidates.push(...widened.slice(0, 30));
  }

  // Calculate overlap matrix (limit to 30 candidates for performance)
  const topCandidates = candidates.slice(0, 30);
  const candidateCodes = topCandidates.map(c => c.schemeCode);

  // Include linked fund codes in overlap matrix
  const linkedCodes = linkedFunds.map(f => f.schemeCode).filter(c => !candidateCodes.includes(c));
  const allCodesForOverlap = [...candidateCodes, ...linkedCodes];
  const overlapMatrix = await calculateOverlapMatrix(allCodesForOverlap);

  // Build prompt with linked funds for dual-path auditor
  const prompt = buildGeminiPrompt(user, goal, glidePath, topCandidates, overlapMatrix, existingHoldingNames, linkedFunds);

  // Call Gemini with ironclad timeout
  const { text, tokensUsed } = await callGeminiForPortfolio(prompt);

  if (text) {
    try {
      const parsed: PortfolioRecommendation = JSON.parse(text);

      // Ensure action_required has a default if Gemini omits it
      if (!parsed.action_required) {
        parsed.action_required = linkedFunds.length > 0 ? 'REBALANCE' : 'BUILD_NEW';
      }

      const validationError = validateRecommendation(parsed, topCandidates, overlapMatrix, goal.monthlySip, linkedFunds);

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

        // Save to archetype cache only for BUILD_NEW (personalized audits shouldn't be cached)
        if (parsed.action_required === 'BUILD_NEW' && linkedFunds.length === 0) {
          const archetypeKey = computeArchetypeKey(user.age, user.riskTolerance, goal.tenureMonths);
          saveArchetypeCache(archetypeKey, user.age, user.riskTolerance, goal.tenureMonths, parsed)
            .catch(err => console.error('Archetype cache save failed (non-blocking):', err));
        }

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

      // Validation failed — single retry with error feedback
      console.warn('Aladdin validation failed:', validationError, '— retrying with feedback');
      const retryPrompt = prompt + `\n\nPREVIOUS ATTEMPT FAILED VALIDATION: ${validationError}\nPlease fix this issue and return corrected JSON.`;
      const retry = await callGeminiForPortfolio(retryPrompt);
      if (retry.text) {
        try {
          const retryParsed: PortfolioRecommendation = JSON.parse(retry.text);
          if (!retryParsed.action_required) {
            retryParsed.action_required = linkedFunds.length > 0 ? 'REBALANCE' : 'BUILD_NEW';
          }
          const retryError = validateRecommendation(retryParsed, topCandidates, overlapMatrix, goal.monthlySip, linkedFunds);
          if (!retryError) {
            if (retryParsed.action_required === 'BUILD_NEW' && linkedFunds.length === 0) {
              const archetypeKey = computeArchetypeKey(user.age, user.riskTolerance, goal.tenureMonths);
              saveArchetypeCache(archetypeKey, user.age, user.riskTolerance, goal.tenureMonths, retryParsed)
                .catch(err => console.error('Archetype cache save failed (non-blocking):', err));
            }

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

  // Fallback to rule-based — always returns a valid portfolio
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
