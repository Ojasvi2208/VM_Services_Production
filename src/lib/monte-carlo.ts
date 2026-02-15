/**
 * Monte Carlo Simulation Engine for Goal Planning
 * Runs N simulations with random market returns to estimate goal success probability
 */

interface MonteCarloParams {
  currentValue: number;
  monthlySip: number;
  targetAmount: number;
  monthsLeft: number;
  expectedReturn: number;   // Annual % (e.g., 12)
  inflationRate: number;    // Annual % (e.g., 6)
  volatility: number;       // Annual % (e.g., 15)
  simulations?: number;     // Default 10000
}

interface MonteCarloResult {
  successProbability: number;
  p10: number;    // 10th percentile (pessimistic)
  p25: number;    // 25th percentile
  p50: number;    // 50th percentile (median)
  p75: number;    // 75th percentile
  p90: number;    // 90th percentile (optimistic)
  mean: number;
  shortfall: number;         // How much P50 falls short of target (0 if on track)
  chartData: { month: number; p10: number; p50: number; p90: number }[];
}

// Box-Muller transform for normal random numbers
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function runMonteCarlo(params: MonteCarloParams): MonteCarloResult {
  const {
    currentValue,
    monthlySip,
    targetAmount,
    monthsLeft,
    expectedReturn,
    inflationRate,
    volatility,
    simulations = 10000
  } = params;

  // Convert annual rates to monthly
  const monthlyReturn = Math.pow(1 + expectedReturn / 100, 1 / 12) - 1;
  const monthlyVol = (volatility / 100) / Math.sqrt(12);
  const monthlyInflation = Math.pow(1 + inflationRate / 100, 1 / 12) - 1;

  // Inflation-adjusted target
  const inflatedTarget = targetAmount * Math.pow(1 + inflationRate / 100, monthsLeft / 12);

  const finalValues: number[] = [];

  // Snapshot months for chart data (every 6 months + final)
  const snapshotMonths = new Set<number>();
  for (let m = 0; m <= monthsLeft; m += Math.max(1, Math.floor(monthsLeft / 20))) {
    snapshotMonths.add(m);
  }
  snapshotMonths.add(monthsLeft);
  const sortedSnapshots = Array.from(snapshotMonths).sort((a, b) => a - b);
  const snapshotValues: Map<number, number[]> = new Map();
  sortedSnapshots.forEach(m => snapshotValues.set(m, []));

  // Run simulations
  for (let sim = 0; sim < simulations; sim++) {
    let portfolio = currentValue;

    for (let month = 1; month <= monthsLeft; month++) {
      // Add SIP contribution
      portfolio += monthlySip;

      // Random monthly return (lognormal)
      const randomReturn = monthlyReturn + monthlyVol * gaussianRandom();
      portfolio *= (1 + randomReturn);

      // Ensure portfolio doesn't go negative
      if (portfolio < 0) portfolio = 0;

      // Record snapshot
      if (snapshotValues.has(month)) {
        snapshotValues.get(month)!.push(portfolio);
      }
    }

    finalValues.push(portfolio);
  }

  // Sort for percentile calculation
  finalValues.sort((a, b) => a - b);

  const percentile = (arr: number[], p: number) => {
    const idx = Math.floor(arr.length * p / 100);
    return Math.round(arr[Math.min(idx, arr.length - 1)] * 100) / 100;
  };

  const p10 = percentile(finalValues, 10);
  const p25 = percentile(finalValues, 25);
  const p50 = percentile(finalValues, 50);
  const p75 = percentile(finalValues, 75);
  const p90 = percentile(finalValues, 90);
  const mean = Math.round(finalValues.reduce((a, b) => a + b, 0) / finalValues.length * 100) / 100;

  // Success = final value >= inflation-adjusted target
  const successCount = finalValues.filter(v => v >= inflatedTarget).length;
  const successProbability = Math.round(successCount / simulations * 1000) / 10;

  const shortfall = Math.max(0, Math.round((inflatedTarget - p50) * 100) / 100);

  // Build chart data from snapshots
  const chartData = sortedSnapshots.map(month => {
    const vals = snapshotValues.get(month) || [];
    if (vals.length === 0) {
      return { month, p10: currentValue, p50: currentValue, p90: currentValue };
    }
    vals.sort((a, b) => a - b);
    return {
      month,
      p10: Math.round(percentile(vals, 10)),
      p50: Math.round(percentile(vals, 50)),
      p90: Math.round(percentile(vals, 90))
    };
  });

  return {
    successProbability,
    p10, p25, p50, p75, p90, mean,
    shortfall,
    chartData
  };
}
