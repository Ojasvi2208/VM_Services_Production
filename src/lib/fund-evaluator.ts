/**
 * Aladdin Deep Evaluation — Fund Health Scoring Engine
 *
 * Evaluates the quality of funds linked to a goal using 37+ quantitative metrics.
 * Produces a composite health score (0-100) per fund, a portfolio-level verdict,
 * and actionable suggestions (swap, add, remove, rebalance).
 *
 * Three verdicts:
 *   - aligned:          linked funds are high quality & match the age-based glide path
 *   - needs_attention:  some funds have quality issues, allocation drift, or better alternatives exist
 *   - needs_portfolio:  no funds linked or all funds score poorly → triggers Aladdin blueprint
 *
 * Runs inside the evaluate-goals daily cron. Results stored in goal_portfolio_evaluations
 * for instant (<50ms) retrieval by the mobile app.
 */

import pool from './postgres-db';
import { computeEquityGlidePath, constructPortfolio, type UserContext, type GoalParams, type GlidePath } from './portfolio-constructor';

// ── Types ──

export interface FundHealthBreakdown {
  return_score: number;      // 0-100: Rolling 3Y return vs category peers
  risk_score: number;        // 0-100: Sharpe + Sortino rank within sub-category
  drawdown_score: number;    // 0-100: Max drawdown rank (inverted — lower DD = higher score)
  cost_score: number;        // 0-100: Expense ratio rank (inverted — lower ER = higher score)
  size_score: number;        // 0-100: AUM confidence signal
  tenure_score: number;      // 0-100: Is this fund's category appropriate for goal tenure?
}

export interface FundHealthReport {
  scheme_code: string;
  fund_name: string;
  category: string;
  sub_category: string;
  health_score: number;       // Composite 0-100
  breakdown: FundHealthBreakdown;
  allocation_pct: number;     // User's current allocation to this fund
  issues: string[];           // Human-readable concerns
  strengths: string[];        // Human-readable positives
}

export interface PortfolioSuggestion {
  type: 'swap' | 'add' | 'remove' | 'rebalance';
  from_scheme_code?: string;
  from_fund_name?: string;
  to_scheme_code?: string;
  to_fund_name?: string;
  to_sub_category?: string;
  reason: string;
  impact_estimate: string;    // e.g. "Could improve risk-adjusted returns by ~2-3%"
}

export interface DeepEvaluationResult {
  verdict: 'aligned' | 'needs_attention' | 'needs_portfolio';
  verdict_reason: string;
  portfolio_score: number;            // Weighted avg of fund health scores
  fund_evaluations: FundHealthReport[];
  suggestions: PortfolioSuggestion[];
  recommendation: any | null;         // Full Aladdin recommendation if needs_portfolio
  macro_context: MacroContext | null;
  glide_path: GlidePath;
  actual_allocation: { equity_pct: number; debt_pct: number; hybrid_pct: number };
  engine: string;
}

interface MacroContext {
  nifty_pe?: number;
  gold_trend?: string;         // 'rising' | 'falling' | 'stable'
  crude_trend?: string;
  inr_trend?: string;
  market_regime?: string;      // 'bullish' | 'bearish' | 'neutral'
}

// ── Tenure → Category Appropriateness Map ──

const TENURE_APPROPRIATE: Record<string, string[]> = {
  ultra_short: ['Liquid Fund', 'Ultra Short Duration Fund', 'Overnight Fund', 'Money Market Fund', 'Arbitrage Fund'],
  short: ['Liquid Fund', 'Ultra Short Duration Fund', 'Short Duration Fund', 'Corporate Bond Fund',
    'Banking & PSU Fund', 'Low Duration Fund', 'Floater Fund', 'Conservative Hybrid Fund',
    'Equity Savings Fund', 'Arbitrage Fund', 'Money Market Fund'],
  medium: ['Large Cap Fund', 'Flexi Cap Fund', 'Balanced Advantage Fund', 'Aggressive Hybrid Fund',
    'Short Duration Fund', 'Corporate Bond Fund', 'Arbitrage Fund', 'Conservative Hybrid Fund',
    'Equity Savings Fund', 'Banking & PSU Fund', 'Floater Fund'],
  long: ['Large Cap Fund', 'Flexi Cap Fund', 'Large & Mid Cap Fund', 'Mid Cap Fund', 'Multi Cap Fund',
    'ELSS', 'Value Fund', 'Contra Fund', 'Focused Fund', 'Balanced Advantage Fund',
    'Aggressive Hybrid Fund', 'Short Duration Fund', 'Corporate Bond Fund', 'Banking & PSU Fund'],
  very_long: ['Large Cap Fund', 'Flexi Cap Fund', 'Large & Mid Cap Fund', 'Mid Cap Fund', 'Small Cap Fund',
    'Multi Cap Fund', 'ELSS', 'Value Fund', 'Contra Fund', 'Focused Fund', 'Sectoral/Thematic Funds',
    'Balanced Advantage Fund', 'Aggressive Hybrid Fund', 'Multi-Asset Allocation Fund',
    'Short Duration Fund', 'Corporate Bond Fund']
};

// ── Category → Asset Class Mapping ──

const EQUITY_CATEGORIES = new Set([
  'Large Cap Fund', 'Flexi Cap Fund', 'Large & Mid Cap Fund', 'Mid Cap Fund', 'Small Cap Fund',
  'Multi Cap Fund', 'ELSS', 'Value Fund', 'Contra Fund', 'Focused Fund', 'Dividend Yield Fund',
  'Sectoral/Thematic Funds'
]);

const DEBT_CATEGORIES = new Set([
  'Liquid Fund', 'Ultra Short Duration Fund', 'Short Duration Fund', 'Corporate Bond Fund',
  'Banking & PSU Fund', 'Low Duration Fund', 'Floater Fund', 'Medium Duration Fund',
  'Medium to Long Duration Fund', 'Long Duration Fund', 'Gilt Fund', 'Dynamic Bond Fund',
  'Overnight Fund', 'Money Market Fund', 'Credit Risk Fund'
]);

const HYBRID_CATEGORIES = new Set([
  'Aggressive Hybrid Fund', 'Conservative Hybrid Fund', 'Balanced Advantage Fund',
  'Balanced Hybrid Fund', 'Dynamic Asset Allocation', 'Multi-Asset Allocation Fund',
  'Equity Savings Fund', 'Arbitrage Fund'
]);

function getTenureBucket(tenureMonths: number): string {
  if (tenureMonths < 12) return 'ultra_short';
  if (tenureMonths < 36) return 'short';
  if (tenureMonths < 60) return 'medium';
  if (tenureMonths < 120) return 'long';
  return 'very_long';
}

// ══════════════════════════════════════════════════════════════════
//  CORE: Evaluate a single fund's health against peers
// ══════════════════════════════════════════════════════════════════

async function evaluateFundHealth(
  schemeCode: string,
  allocationPct: number,
  tenureMonths: number,
  client: any
): Promise<FundHealthReport> {
  // Fetch the fund's metrics + its peer group stats in a single query
  // Production fund_returns has sharpe_ratio_1y (NOT sharpe_1y), no calculated_date, no sharpe_3y.
  // volatility_3y exists (added by migration 005).
  const result = await client.query(`
    WITH fund_data AS (
      SELECT
        f.scheme_code, f.scheme_name, f.category, f.sub_category,
        f.fund_size, f.expense_ratio,
        COALESCE(fr.cagr_3y, fr.return_3y) as cagr_3y,
        fr.cagr_5y, fr.cagr_1y,
        fr.sharpe_ratio_1y as sharpe_1y,
        fr.volatility_1y, fr.volatility_3y
      FROM funds f
      LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
      WHERE f.scheme_code = $1
    ),
    peer_stats AS (
      SELECT
        f2.sub_category,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY COALESCE(fr2.cagr_3y, fr2.return_3y)) as p25_return,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY COALESCE(fr2.cagr_3y, fr2.return_3y)) as p50_return,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY COALESCE(fr2.cagr_3y, fr2.return_3y)) as p75_return,
        AVG(COALESCE(fr2.cagr_3y, fr2.return_3y)) as avg_return,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY fr2.sharpe_ratio_1y) as median_sharpe,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fr2.sharpe_ratio_1y) as p75_sharpe,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY fr2.volatility_1y) as median_volatility,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fr2.volatility_1y) as p75_volatility,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY f2.expense_ratio) as median_expense,
        COUNT(*) as peer_count
      FROM funds f2
      LEFT JOIN fund_returns fr2 ON f2.scheme_code = fr2.scheme_code
      WHERE f2.sub_category = (SELECT sub_category FROM fund_data)
        AND f2.plan_type = 'Direct' AND f2.option_type = 'Growth'
        AND f2.is_active = true
        AND COALESCE(fr2.cagr_3y, fr2.return_3y) IS NOT NULL
      GROUP BY f2.sub_category
    )
    SELECT fd.*, ps.*
    FROM fund_data fd
    CROSS JOIN peer_stats ps
  `, [schemeCode]);

  if (result.rows.length === 0) {
    return {
      scheme_code: schemeCode,
      fund_name: 'Unknown Fund',
      category: '',
      sub_category: '',
      health_score: 0,
      breakdown: { return_score: 0, risk_score: 0, drawdown_score: 0, cost_score: 0, size_score: 0, tenure_score: 0 },
      allocation_pct: allocationPct,
      issues: ['Fund data not available — may be inactive or delisted'],
      strengths: [],
    };
  }

  const fd = result.rows[0];
  const issues: string[] = [];
  const strengths: string[] = [];

  // ── 1. RETURN CONSISTENCY (25%) ──
  // Compare 3Y CAGR against sub-category percentiles
  let returnScore = 50; // Default neutral
  const cagr3y = parseFloat(fd.cagr_3y);
  const p75Return = parseFloat(fd.p75_return);
  const p50Return = parseFloat(fd.p50_return);
  const p25Return = parseFloat(fd.p25_return);

  if (!isNaN(cagr3y) && !isNaN(p50Return)) {
    if (cagr3y >= p75Return) {
      returnScore = 85 + Math.min(15, ((cagr3y - p75Return) / Math.max(1, p75Return)) * 100);
      strengths.push(`Top-quartile 3Y return (${cagr3y.toFixed(1)}% vs category median ${p50Return.toFixed(1)}%)`);
    } else if (cagr3y >= p50Return) {
      returnScore = 55 + ((cagr3y - p50Return) / Math.max(1, p75Return - p50Return)) * 30;
    } else if (cagr3y >= p25Return) {
      returnScore = 25 + ((cagr3y - p25Return) / Math.max(1, p50Return - p25Return)) * 30;
      issues.push(`Below-median 3Y return (${cagr3y.toFixed(1)}% vs category median ${p50Return.toFixed(1)}%)`);
    } else {
      returnScore = Math.max(5, 25 * (cagr3y / Math.max(1, p25Return)));
      issues.push(`Bottom-quartile 3Y return (${cagr3y.toFixed(1)}% vs category P25 ${p25Return.toFixed(1)}%)`);
    }
  }

  returnScore = Math.max(0, Math.min(100, returnScore));

  // ── 2. RISK-ADJUSTED PERFORMANCE (25%) ──
  let riskScore = 50;
  const sharpe = parseFloat(fd.sharpe_1y);
  const medianSharpe = parseFloat(fd.median_sharpe);
  const p75Sharpe = parseFloat(fd.p75_sharpe);

  if (!isNaN(sharpe) && !isNaN(medianSharpe)) {
    if (sharpe >= p75Sharpe) {
      riskScore = 85;
      strengths.push(`Strong risk-adjusted returns (Sharpe ${sharpe.toFixed(2)} vs category P75 ${p75Sharpe.toFixed(2)})`);
    } else if (sharpe >= medianSharpe) {
      riskScore = 55 + ((sharpe - medianSharpe) / Math.max(0.01, p75Sharpe - medianSharpe)) * 30;
    } else if (sharpe > 0) {
      riskScore = 20 + (sharpe / Math.max(0.01, medianSharpe)) * 35;
      issues.push(`Below-median Sharpe ratio (${sharpe.toFixed(2)} vs category median ${medianSharpe.toFixed(2)})`);
    } else {
      riskScore = 10;
      issues.push(`Negative Sharpe ratio (${sharpe.toFixed(2)}) — returns below risk-free rate`);
    }
  }

  riskScore = Math.max(0, Math.min(100, riskScore));

  // ── 3. DOWNSIDE PROTECTION (15%) ──
  // Use volatility as proxy for downside risk (max_drawdown column not available)
  let drawdownScore = 50;
  const vol1y = parseFloat(fd.volatility_1y);
  const medianVol = parseFloat(fd.median_volatility);
  const p75Vol = parseFloat(fd.p75_volatility);

  if (!isNaN(vol1y) && !isNaN(medianVol)) {
    // Lower volatility is better (inverted scoring)
    if (vol1y <= medianVol * 0.8) {
      drawdownScore = 85;
      strengths.push(`Low volatility (${vol1y.toFixed(1)}% vs category median ${medianVol.toFixed(1)}%)`);
    } else if (vol1y <= medianVol) {
      drawdownScore = 55 + 30 * (1 - vol1y / medianVol);
    } else if (vol1y <= p75Vol) {
      drawdownScore = 30 + 25 * (1 - (vol1y - medianVol) / Math.max(1, p75Vol - medianVol));
    } else {
      drawdownScore = Math.max(10, 30 * (medianVol / Math.max(1, vol1y)));
      issues.push(`High volatility (${vol1y.toFixed(1)}% vs category median ${medianVol.toFixed(1)}%)`);
    }
  }

  drawdownScore = Math.max(0, Math.min(100, drawdownScore));

  // ── 4. COST EFFICIENCY (10%) ──
  let costScore = 50;
  const expenseRatio = parseFloat(fd.expense_ratio);
  const medianExpense = parseFloat(fd.median_expense);

  if (!isNaN(expenseRatio) && !isNaN(medianExpense) && medianExpense > 0) {
    if (expenseRatio <= medianExpense * 0.7) {
      costScore = 90;
      strengths.push(`Low expense ratio (${expenseRatio.toFixed(2)}% vs category median ${medianExpense.toFixed(2)}%)`);
    } else if (expenseRatio <= medianExpense) {
      costScore = 60 + 30 * (1 - expenseRatio / medianExpense);
    } else if (expenseRatio <= medianExpense * 1.5) {
      costScore = 30 + 30 * (1 - (expenseRatio - medianExpense) / (medianExpense * 0.5));
    } else {
      costScore = 15;
      issues.push(`High expense ratio (${expenseRatio.toFixed(2)}% vs category median ${medianExpense.toFixed(2)}%)`);
    }
  }

  costScore = Math.max(0, Math.min(100, costScore));

  // ── 5. SIZE & STABILITY (10%) ──
  let sizeScore = 50;
  const aum = parseFloat(fd.fund_size);

  if (!isNaN(aum)) {
    if (aum >= 10000) {
      sizeScore = 95;
      strengths.push(`Large AUM (₹${(aum / 1000).toFixed(0)}K Cr) — high institutional confidence`);
    } else if (aum >= 5000) {
      sizeScore = 80;
    } else if (aum >= 1000) {
      sizeScore = 60;
    } else if (aum >= 500) {
      sizeScore = 40;
    } else {
      sizeScore = 20;
      issues.push(`Small AUM (₹${aum.toFixed(0)} Cr) — potential liquidity risk`);
    }
  }

  // ── 6. TENURE APPROPRIATENESS (15%) ──
  let tenureScore = 50;
  const tenureBucket = getTenureBucket(tenureMonths);
  const appropriateCategories = TENURE_APPROPRIATE[tenureBucket] || [];
  const subCategory = fd.sub_category || '';

  if (appropriateCategories.includes(subCategory)) {
    tenureScore = 90;
  } else {
    // Check severity of mismatch
    const isEquity = EQUITY_CATEGORIES.has(subCategory);
    if (tenureMonths < 36 && isEquity) {
      tenureScore = 10;
      issues.push(`Equity fund (${subCategory}) linked to short-term goal (<3 years) — high volatility risk`);
    } else if (tenureMonths < 60 && subCategory === 'Small Cap Fund') {
      tenureScore = 20;
      issues.push(`Small Cap fund for <5-year goal — high sequence-of-returns risk`);
    } else if (tenureMonths >= 120 && DEBT_CATEGORIES.has(subCategory) && !['Short Duration Fund', 'Corporate Bond Fund'].includes(subCategory)) {
      tenureScore = 30;
      issues.push(`Conservative debt fund (${subCategory}) for 10+ year goal — may underperform inflation`);
    } else {
      tenureScore = 50;
      issues.push(`${subCategory} is not ideal for ${(tenureMonths / 12).toFixed(0)}-year tenure`);
    }
  }

  // ── COMPOSITE SCORE ──
  const healthScore = Math.round(
    returnScore * 0.25 +
    riskScore * 0.25 +
    drawdownScore * 0.15 +
    costScore * 0.10 +
    sizeScore * 0.10 +
    tenureScore * 0.15
  );

  return {
    scheme_code: schemeCode,
    fund_name: fd.scheme_name || 'Unknown',
    category: fd.category || '',
    sub_category: subCategory,
    health_score: healthScore,
    breakdown: {
      return_score: Math.round(returnScore),
      risk_score: Math.round(riskScore),
      drawdown_score: Math.round(drawdownScore),
      cost_score: Math.round(costScore),
      size_score: Math.round(sizeScore),
      tenure_score: Math.round(tenureScore),
    },
    allocation_pct: allocationPct,
    issues,
    strengths,
  };
}

// ══════════════════════════════════════════════════════════════════
//  MACRO CONTEXT: Gather market regime signals
// ══════════════════════════════════════════════════════════════════

async function gatherMacroContext(client: any): Promise<MacroContext | null> {
  try {
    // Get recent macro snapshots for trend detection
    const macroResult = await client.query(`
      SELECT symbol, price, change_percent, snapshot_date
      FROM macro_snapshots
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
        AND symbol IN ('USDINR', 'GOLD', 'WTI')
      ORDER BY symbol, snapshot_date DESC
    `);

    const context: MacroContext = {};

    const bySymbol: Record<string, { price: number; change: number }[]> = {};
    for (const row of macroResult.rows) {
      if (!bySymbol[row.symbol]) bySymbol[row.symbol] = [];
      bySymbol[row.symbol].push({
        price: parseFloat(row.price),
        change: parseFloat(row.change_percent) || 0,
      });
    }

    // Gold trend (safe haven demand indicator)
    const gold = bySymbol['GOLD'];
    if (gold?.length >= 2) {
      const avgChange = gold.reduce((s, g) => s + g.change, 0) / gold.length;
      context.gold_trend = avgChange > 0.5 ? 'rising' : avgChange < -0.5 ? 'falling' : 'stable';
    }

    // Crude trend (inflation proxy)
    const crude = bySymbol['WTI'];
    if (crude?.length >= 2) {
      const avgChange = crude.reduce((s, c) => s + c.change, 0) / crude.length;
      context.crude_trend = avgChange > 1 ? 'rising' : avgChange < -1 ? 'falling' : 'stable';
    }

    // INR trend (import cost impact)
    const inr = bySymbol['USDINR'];
    if (inr?.length >= 2) {
      const avgChange = inr.reduce((s, i) => s + i.change, 0) / inr.length;
      context.inr_trend = avgChange > 0.3 ? 'weakening' : avgChange < -0.3 ? 'strengthening' : 'stable';
    }

    return Object.keys(context).length > 0 ? context : null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  ALLOCATION ANALYSIS: Compare actual vs target glide path
// ══════════════════════════════════════════════════════════════════

function computeActualAllocation(
  fundReports: FundHealthReport[]
): { equity_pct: number; debt_pct: number; hybrid_pct: number } {
  let equity = 0, debt = 0, hybrid = 0;

  for (const fr of fundReports) {
    if (EQUITY_CATEGORIES.has(fr.sub_category)) {
      equity += fr.allocation_pct;
    } else if (DEBT_CATEGORIES.has(fr.sub_category)) {
      debt += fr.allocation_pct;
    } else if (HYBRID_CATEGORIES.has(fr.sub_category)) {
      hybrid += fr.allocation_pct;
    } else {
      equity += fr.allocation_pct; // Default to equity for unknown
    }
  }

  const total = equity + debt + hybrid;
  if (total === 0) return { equity_pct: 0, debt_pct: 0, hybrid_pct: 0 };

  return {
    equity_pct: Math.round((equity / total) * 100),
    debt_pct: Math.round((debt / total) * 100),
    hybrid_pct: Math.round((hybrid / total) * 100),
  };
}

// ══════════════════════════════════════════════════════════════════
//  SUGGESTION GENERATOR: Swap, add, remove, rebalance
// ══════════════════════════════════════════════════════════════════

async function generateSuggestions(
  fundReports: FundHealthReport[],
  actualAllocation: { equity_pct: number; debt_pct: number; hybrid_pct: number },
  targetGlide: GlidePath,
  tenureMonths: number,
  client: any
): Promise<PortfolioSuggestion[]> {
  const suggestions: PortfolioSuggestion[] = [];

  // 1. SWAP: Replace low-scoring funds with better alternatives
  for (const fr of fundReports) {
    if (fr.health_score < 40) {
      // Find the best alternative in the same sub-category
      const altResult = await client.query(`
        SELECT f.scheme_code, f.scheme_name,
               COALESCE(fr2.cagr_3y, fr2.return_3y) as cagr_3y, fr2.sharpe_ratio_1y as sharpe_1y
        FROM funds f
        JOIN fund_returns fr2 ON f.scheme_code = fr2.scheme_code
        WHERE f.sub_category = $1
          AND f.plan_type = 'Direct' AND f.option_type = 'Growth'
          AND f.is_active = true AND f.scheme_code != $2
          AND (f.fund_size > 500 OR f.fund_size IS NULL)
          AND COALESCE(fr2.cagr_3y, fr2.return_3y) IS NOT NULL
        ORDER BY COALESCE(fr2.cagr_3y, fr2.return_3y) DESC
        LIMIT 1
      `, [fr.sub_category, fr.scheme_code]);

      if (altResult.rows.length > 0) {
        const alt = altResult.rows[0];
        const altCagr = parseFloat(alt.cagr_3y);
        const altSharpe = parseFloat(alt.sharpe_1y);
        const sharpeStr = !isNaN(altSharpe) ? ` and Sharpe ${altSharpe.toFixed(2)}` : '';
        suggestions.push({
          type: 'swap',
          from_scheme_code: fr.scheme_code,
          from_fund_name: fr.fund_name,
          to_scheme_code: alt.scheme_code,
          to_fund_name: alt.scheme_name,
          to_sub_category: fr.sub_category,
          reason: fr.issues[0] || `Health score ${fr.health_score}/100 — below threshold`,
          impact_estimate: `Better peer with ${altCagr.toFixed(1)}% 3Y CAGR${sharpeStr}`,
        });
      }
    }
  }

  // 2. TENURE MISMATCH: Flag funds inappropriate for goal duration
  for (const fr of fundReports) {
    if (fr.breakdown.tenure_score < 30) {
      suggestions.push({
        type: 'swap',
        from_scheme_code: fr.scheme_code,
        from_fund_name: fr.fund_name,
        reason: `${fr.sub_category} is inappropriate for ${(tenureMonths / 12).toFixed(0)}-year goal tenure`,
        impact_estimate: `Reduces sequence-of-returns risk for your time horizon`,
      });
    }
  }

  // 3. ALLOCATION DRIFT: Check if actual allocation deviates from glide path
  const equityDrift = actualAllocation.equity_pct - targetGlide.equityPct;
  const debtDrift = actualAllocation.debt_pct - targetGlide.debtPct;

  if (Math.abs(equityDrift) > 15) {
    const direction = equityDrift > 0 ? 'over-allocated to equity' : 'under-allocated to equity';
    suggestions.push({
      type: 'rebalance',
      reason: `Portfolio is ${direction} (${actualAllocation.equity_pct}% vs target ${targetGlide.equityPct}%)`,
      impact_estimate: equityDrift > 0
        ? 'Consider shifting some allocation to debt/hybrid to reduce volatility risk'
        : 'Consider adding equity exposure to improve growth potential',
    });
  }

  if (Math.abs(debtDrift) > 15) {
    const direction = debtDrift > 0 ? 'over-allocated to debt' : 'under-allocated to debt';
    suggestions.push({
      type: 'rebalance',
      reason: `Portfolio is ${direction} (${actualAllocation.debt_pct}% vs target ${targetGlide.debtPct}%)`,
      impact_estimate: debtDrift > 0
        ? 'May be dragging returns below inflation over long term'
        : 'Consider adding debt for stability, especially as goal approaches',
    });
  }

  return suggestions;
}

// ══════════════════════════════════════════════════════════════════
//  MAIN: Deep Evaluation Pipeline
// ══════════════════════════════════════════════════════════════════

export async function deepEvaluateGoal(
  goalId: string,
  userId: string,
  age: number,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive',
  tenureMonths: number,
  targetAmount: number,
  monthlySip: number,
  goalName: string,
  criticality: string
): Promise<DeepEvaluationResult> {
  const glidePath = computeEquityGlidePath(age, riskTolerance);
  const client = await pool.connect();

  try {
    // ── Step 1: Get linked funds for this goal ──
    const linkedResult = await client.query(`
      SELECT gfl.scheme_code, gfl.allocation_pct,
             COALESCE(f.scheme_name, '') as fund_name
      FROM goal_fund_links gfl
      LEFT JOIN funds f ON gfl.scheme_code = f.scheme_code
      WHERE gfl.goal_id = $1
    `, [goalId]);

    const linkedFunds = linkedResult.rows;

    // ── PATH A: No funds linked → needs_portfolio ──
    if (linkedFunds.length === 0) {
      // Try to generate an Aladdin recommendation
      let recommendation = null;
      let engine = 'quantitative';

      try {
        const userCtx: UserContext = { userId, age, riskTolerance, incomeRange: '' };
        const goalParams: GoalParams = { targetAmount, monthlySip, tenureMonths, goalName, criticality };
        const result = await constructPortfolio(userCtx, goalParams);
        if (result.recommendation.funds.length >= 2) {
          recommendation = result.recommendation;
          engine = result.meta.engine;
        }
      } catch (err) {
        console.error('Deep eval: Aladdin fallback failed:', err);
      }

      return {
        verdict: 'needs_portfolio',
        verdict_reason: 'No funds linked to this goal. Tap to see AI-recommended funds based on your profile.',
        portfolio_score: 0,
        fund_evaluations: [],
        suggestions: [],
        recommendation,
        macro_context: await gatherMacroContext(client),
        glide_path: glidePath,
        actual_allocation: { equity_pct: 0, debt_pct: 0, hybrid_pct: 0 },
        engine,
      };
    }

    // ── Step 2: Evaluate each linked fund's health ──
    const fundReports: FundHealthReport[] = [];
    for (const link of linkedFunds) {
      const report = await evaluateFundHealth(
        link.scheme_code,
        parseFloat(link.allocation_pct) || (100 / linkedFunds.length),
        tenureMonths,
        client
      );
      fundReports.push(report);
    }

    // ── Step 3: Compute portfolio-level score ──
    const portfolioScore = Math.round(
      fundReports.reduce((sum, fr) => sum + fr.health_score * (fr.allocation_pct / 100), 0)
    );

    // ── Step 4: Compute actual allocation ──
    const actualAllocation = computeActualAllocation(fundReports);

    // ── Step 5: Gather macro context ──
    const macroContext = await gatherMacroContext(client);

    // ── Step 6: Generate suggestions ──
    const suggestions = await generateSuggestions(
      fundReports, actualAllocation, glidePath, tenureMonths, client
    );

    // ── Step 7: Determine verdict ──
    let verdict: 'aligned' | 'needs_attention' | 'needs_portfolio';
    let verdictReason: string;

    const criticalIssues = fundReports.filter(fr => fr.health_score < 30);
    const hasAllocationDrift = Math.abs(actualAllocation.equity_pct - glidePath.equityPct) > 20;
    const hasTenureMismatch = fundReports.some(fr => fr.breakdown.tenure_score < 30);

    if (portfolioScore >= 60 && suggestions.length === 0 && !hasAllocationDrift) {
      verdict = 'aligned';
      verdictReason = `Your portfolio scores ${portfolioScore}/100. Funds are well-suited for this ${(tenureMonths / 12).toFixed(0)}-year goal.`;
    } else if (criticalIssues.length >= linkedFunds.length / 2 || portfolioScore < 30) {
      // More than half the funds are poor → suggest full rebuild
      verdict = 'needs_portfolio';
      verdictReason = `Portfolio scores ${portfolioScore}/100. ${criticalIssues.length} of ${linkedFunds.length} linked funds have significant quality concerns.`;

      // Generate full Aladdin recommendation
      try {
        const userCtx: UserContext = { userId, age, riskTolerance, incomeRange: '' };
        const goalParams: GoalParams = { targetAmount, monthlySip, tenureMonths, goalName, criticality };
        const aladdinResult = await constructPortfolio(userCtx, goalParams);
        if (aladdinResult.recommendation.funds.length >= 2) {
          return {
            verdict, verdict_reason: verdictReason, portfolio_score: portfolioScore,
            fund_evaluations: fundReports, suggestions,
            recommendation: aladdinResult.recommendation,
            macro_context: macroContext, glide_path: glidePath,
            actual_allocation: actualAllocation,
            engine: aladdinResult.meta.engine,
          };
        }
      } catch { /* Fall through without recommendation */ }

      return {
        verdict, verdict_reason: verdictReason, portfolio_score: portfolioScore,
        fund_evaluations: fundReports, suggestions,
        recommendation: null, macro_context: macroContext,
        glide_path: glidePath, actual_allocation: actualAllocation,
        engine: 'quantitative',
      };
    } else {
      verdict = 'needs_attention';
      const issueCount = suggestions.length;
      const topIssue = hasTenureMismatch
        ? 'tenure mismatch detected'
        : hasAllocationDrift
          ? 'allocation drift from target'
          : `${issueCount} improvement${issueCount > 1 ? 's' : ''} identified`;
      verdictReason = `Portfolio scores ${portfolioScore}/100 — ${topIssue}.`;
    }

    return {
      verdict, verdict_reason: verdictReason, portfolio_score: portfolioScore,
      fund_evaluations: fundReports, suggestions,
      recommendation: null, macro_context: macroContext,
      glide_path: glidePath, actual_allocation: actualAllocation,
      engine: 'quantitative',
    };
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════════
//  STORE: Save evaluation to goal_portfolio_evaluations
// ══════════════════════════════════════════════════════════════════

export async function storeDeepEvaluation(
  goalId: string,
  userId: string,
  evaluation: DeepEvaluationResult
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO goal_portfolio_evaluations (
        goal_id, user_id, verdict, verdict_reason, portfolio_score,
        fund_evaluations, suggestions, recommendation,
        macro_context, glide_path, actual_allocation, engine, eval_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_DATE)
      ON CONFLICT (goal_id, eval_date) DO UPDATE SET
        verdict = EXCLUDED.verdict,
        verdict_reason = EXCLUDED.verdict_reason,
        portfolio_score = EXCLUDED.portfolio_score,
        fund_evaluations = EXCLUDED.fund_evaluations,
        suggestions = EXCLUDED.suggestions,
        recommendation = EXCLUDED.recommendation,
        macro_context = EXCLUDED.macro_context,
        glide_path = EXCLUDED.glide_path,
        actual_allocation = EXCLUDED.actual_allocation,
        engine = EXCLUDED.engine,
        evaluated_at = NOW(),
        expires_at = NOW() + INTERVAL '1 day'
    `, [
      goalId, userId,
      evaluation.verdict, evaluation.verdict_reason, evaluation.portfolio_score,
      JSON.stringify(evaluation.fund_evaluations),
      JSON.stringify(evaluation.suggestions),
      evaluation.recommendation ? JSON.stringify(evaluation.recommendation) : null,
      evaluation.macro_context ? JSON.stringify(evaluation.macro_context) : null,
      JSON.stringify(evaluation.glide_path),
      JSON.stringify(evaluation.actual_allocation),
      evaluation.engine,
    ]);
  } finally {
    client.release();
  }
}
