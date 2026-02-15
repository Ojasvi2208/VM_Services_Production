/**
 * XIRR (Extended Internal Rate of Return) Calculator
 * Uses Newton-Raphson method to find the rate that makes NPV = 0
 * 
 * Cash flows: negative = investment (outflow), positive = redemption/current value (inflow)
 */

interface CashFlow {
  date: Date;
  amount: number; // negative for investment, positive for redemption/current value
}

/**
 * Calculate XIRR from a series of cash flows
 * Returns annualized return as a percentage (e.g., 12.5 for 12.5%)
 */
export function calculateXIRR(cashFlows: CashFlow[], guess: number = 0.1): number | null {
  if (cashFlows.length < 2) return null;

  // Ensure we have at least one negative and one positive flow
  const hasNegative = cashFlows.some(cf => cf.amount < 0);
  const hasPositive = cashFlows.some(cf => cf.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const dates = cashFlows.map(cf => cf.date.getTime());
  const amounts = cashFlows.map(cf => cf.amount);
  const d0 = dates[0];

  // NPV function: sum of amount_i / (1 + rate)^(days_i / 365)
  function npv(rate: number): number {
    let total = 0;
    for (let i = 0; i < amounts.length; i++) {
      const years = (dates[i] - d0) / (365.25 * 24 * 60 * 60 * 1000);
      total += amounts[i] / Math.pow(1 + rate, years);
    }
    return total;
  }

  // Derivative of NPV with respect to rate
  function npvDerivative(rate: number): number {
    let total = 0;
    for (let i = 0; i < amounts.length; i++) {
      const years = (dates[i] - d0) / (365.25 * 24 * 60 * 60 * 1000);
      if (years === 0) continue;
      total -= years * amounts[i] / Math.pow(1 + rate, years + 1);
    }
    return total;
  }

  // Newton-Raphson iteration
  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIterations; i++) {
    const f = npv(rate);
    const fPrime = npvDerivative(rate);

    if (Math.abs(fPrime) < 1e-10) break;

    const newRate = rate - f / fPrime;

    // Clamp to prevent divergence
    if (newRate < -0.99) rate = -0.5;
    else if (newRate > 10) rate = 5;
    else rate = newRate;

    if (Math.abs(f) < tolerance) {
      return Math.round(rate * 10000) / 100; // Return as percentage
    }
  }

  // If Newton-Raphson didn't converge, try bisection
  let lo = -0.99, hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const f = npv(mid);
    if (Math.abs(f) < tolerance) {
      return Math.round(mid * 10000) / 100;
    }
    if (f > 0) lo = mid;
    else hi = mid;
  }

  return Math.round(rate * 10000) / 100;
}

/**
 * Calculate CAGR from start value, end value, and duration in years
 */
export function calculateCAGR(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || endValue <= 0 || years <= 0) return null;
  const cagr = (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  return Math.round(cagr * 100) / 100;
}

/**
 * Build XIRR cash flows from CAS transactions + current valuation
 */
export function buildCashFlowsFromTransactions(
  transactions: { date: string; amount: number; type: string }[],
  currentUnits: number,
  currentNav: number
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const tx of transactions) {
    const date = new Date(tx.date);
    if (isNaN(date.getTime())) continue;

    if (['BUY', 'SIP', 'SWITCH_IN'].includes(tx.type)) {
      flows.push({ date, amount: -Math.abs(tx.amount) }); // outflow
    } else if (['SELL', 'REDEMPTION', 'SWP', 'SWITCH_OUT'].includes(tx.type)) {
      flows.push({ date, amount: Math.abs(tx.amount) }); // inflow
    }
    // DIVIDEND can be reinvested (skip) or payout (inflow) — skip for now
  }

  // Add current valuation as final inflow
  if (currentUnits > 0 && currentNav > 0) {
    flows.push({ date: new Date(), amount: currentUnits * currentNav });
  }

  // Sort by date
  flows.sort((a, b) => a.date.getTime() - b.date.getTime());

  return flows;
}
