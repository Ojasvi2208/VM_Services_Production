/**
 * Tax Calculator — Pure-function tax math engine
 *
 * Finance Act 2024 compliant (effective FY 2024-25 onwards).
 * Supports both New and Old tax regimes.
 * Zero DB dependency — all inputs are passed as parameters.
 *
 * Key rules:
 * - Equity STCG (<12 months): 20% flat
 * - Equity LTCG (≥12 months): 12.5% on gains > ₹1.25L/FY
 * - Debt funds (all gains): Taxed at income slab rate (no LTCG/STCG since Apr 2023)
 * - Hybrid: ≥65% equity → equity taxation, else debt taxation
 * - Surcharge: 10% (50L-1Cr), 15% (1-2Cr), 25% (2-5Cr), 37% (5Cr+)
 * - Health & Education Cess: 4% on tax + surcharge
 */

// ═══ Types ═══

export interface TaxSlab {
  min: number;
  max: number;
  rate: number;  // Percentage (e.g., 20 = 20%)
}

export interface TaxImpactResult {
  gainAmount: number;
  gainType: 'STCG' | 'LTCG';
  taxableGain: number;
  taxAmount: number;
  effectiveRate: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  slabBefore: string;
  slabAfter: string;
  slabPush: boolean;
  ltcgExemptionUsed: number;
  ltcgExemptionRemaining: number;
  recommendation: string;
}

export interface RedemptionTaxParams {
  purchaseDate: Date;
  purchaseNav: number;
  currentNav: number;
  units: number;
  fundType: 'equity' | 'debt';
  userIncome: number;
  taxRegime: 'old' | 'new';
  ltcgUsedThisFY: number;
}

export interface SwapBenefitParams {
  currentFundCagr: number;
  newFundCagr: number;
  currentValue: number;
  taxCost: number;
  projectionYears: number;
}

export interface SwapBenefitResult {
  projectedGainCurrent: number;
  projectedGainNew: number;
  taxCost: number;
  netBenefit: number;
}

export interface STPParams {
  totalUnits: number;
  purchaseNav: number;
  currentNav: number;
  ltcgRemaining: number;
  monthsLeftInFY: number;
}

export interface STPResult {
  monthlyUnits: number;
  monthlyAmount: number;
  months: number;
  totalTaxSaved: number;
}

// ═══ Tax Slab Definitions ═══

const NEW_REGIME_SLABS: TaxSlab[] = [
  { min: 0,       max: 400000,   rate: 0 },
  { min: 400000,  max: 800000,   rate: 5 },
  { min: 800000,  max: 1200000,  rate: 10 },
  { min: 1200000, max: 1600000,  rate: 15 },
  { min: 1600000, max: 2000000,  rate: 20 },
  { min: 2000000, max: 2400000,  rate: 25 },
  { min: 2400000, max: Infinity, rate: 30 },
];

const OLD_REGIME_SLABS: TaxSlab[] = [
  { min: 0,       max: 250000,   rate: 0 },
  { min: 250000,  max: 500000,   rate: 5 },
  { min: 500000,  max: 1000000,  rate: 20 },
  { min: 1000000, max: Infinity,  rate: 30 },
];

const EQUITY_STCG_RATE = 20;       // Flat 20% for equity STCG
const EQUITY_LTCG_RATE = 12.5;     // 12.5% for equity LTCG above exemption
const EQUITY_LTCG_EXEMPTION = 125000;  // ₹1.25L per FY
const CESS_RATE = 4;               // 4% Health & Education Cess

// ═══ Fund Classification ═══

export function classifyFund(
  category: string,
  equityAllocationPct?: number | null
): 'equity' | 'debt' {
  // If explicit allocation is available, use the 65% threshold
  if (equityAllocationPct != null) {
    return equityAllocationPct >= 65 ? 'equity' : 'debt';
  }

  // Heuristic from category name
  const cat = (category || '').toLowerCase();
  if (cat === 'equity') return 'equity';
  if (cat === 'debt' || cat === 'money market') return 'debt';
  if (cat.includes('hybrid')) {
    // Aggressive/Balanced Advantage hybrids are typically ≥65% equity
    if (cat.includes('aggressive') || cat.includes('balanced advantage') || cat.includes('dynamic')) {
      return 'equity';
    }
    return 'debt'; // Conservative hybrids
  }
  if (cat.includes('solution')) return 'equity'; // Retirement/Children funds
  return 'debt'; // Default to debt (safer — higher tax, no under-reporting)
}

// ═══ Gain Classification ═══

export function classifyGain(
  purchaseDate: Date,
  sellDate: Date,
  fundType: 'equity' | 'debt'
): 'STCG' | 'LTCG' {
  const msPerDay = 24 * 60 * 60 * 1000;
  const holdingDays = Math.floor((sellDate.getTime() - purchaseDate.getTime()) / msPerDay);

  if (fundType === 'equity') {
    // Equity: ≥365 days (12 months) → LTCG
    return holdingDays >= 365 ? 'LTCG' : 'STCG';
  }

  // Debt funds: All gains taxed at slab rate since Finance Act 2023.
  // We label as 'STCG' since there's no beneficial LTCG treatment.
  return 'STCG';
}

// ═══ Income Range to Midpoint ═══

export function incomeRangeToMidpoint(range: string): number {
  const map: Record<string, number> = {
    '0-4L': 200000,
    '0-5L': 250000,
    '4-8L': 600000,
    '5-10L': 750000,
    '8-12L': 1000000,
    '10-20L': 1500000,
    '12-16L': 1400000,
    '16-20L': 1800000,
    '20-24L': 2200000,
    '20-50L': 3500000,
    '24L+': 3000000,
    '50L-1Cr': 7500000,
    '1Cr+': 15000000,
  };
  return map[range] || 600000; // Default 6L if unknown
}

// ═══ Slab Rate Lookup ═══

export function getSlabRate(
  income: number,
  regime: 'old' | 'new'
): { rate: number; slabLabel: string } {
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  for (const slab of slabs) {
    if (income >= slab.min && income < slab.max) {
      return { rate: slab.rate, slabLabel: `${slab.rate}%` };
    }
  }
  // If income exceeds all slabs, return highest
  const highest = slabs[slabs.length - 1];
  return { rate: highest.rate, slabLabel: `${highest.rate}%` };
}

// ═══ Marginal Tax Calculation (Progressive Slabs) ═══

function calculateSlabTax(income: number, regime: 'old' | 'new'): number {
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  let tax = 0;
  for (const slab of slabs) {
    if (income <= slab.min) break;
    const taxableInSlab = Math.min(income, slab.max) - slab.min;
    tax += taxableInSlab * (slab.rate / 100);
  }
  return tax;
}

// ═══ Surcharge Calculation ═══

export function getSurcharge(totalIncome: number): number {
  if (totalIncome <= 5000000) return 0;
  if (totalIncome <= 10000000) return 10;   // 50L-1Cr
  if (totalIncome <= 20000000) return 15;   // 1Cr-2Cr
  if (totalIncome <= 50000000) return 25;   // 2Cr-5Cr
  return 37;                                 // 5Cr+
}

// ═══ Financial Year Helper ═══

export function getCurrentFY(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  // FY runs April to March
  if (month >= 3) { // April (3) onwards
    return `FY${year}-${(year + 1).toString().slice(2)}`;
  }
  return `FY${year - 1}-${year.toString().slice(2)}`;
}

export function getMonthsLeftInFY(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-indexed
  // FY ends in March (month 2)
  if (month >= 3) {
    return 12 - (month - 3); // April=12, May=11, ..., March=1
  }
  return 3 - month; // Jan=3, Feb=2, March=1
}

// ═══ Core: Calculate Redemption Tax ═══

export function calculateRedemptionTax(params: RedemptionTaxParams): TaxImpactResult {
  const {
    purchaseDate, purchaseNav, currentNav, units,
    fundType, userIncome, taxRegime, ltcgUsedThisFY
  } = params;

  const sellDate = new Date();
  const gainAmount = (currentNav - purchaseNav) * units;
  const gainType = classifyGain(purchaseDate, sellDate, fundType);

  // Get slab BEFORE this transaction
  const slabBefore = getSlabRate(userIncome, taxRegime);

  let taxableGain = 0;
  let taxAmount = 0;
  let ltcgExemptionUsed = 0;
  let ltcgExemptionRemaining = 0;
  let recommendation = '';

  if (gainAmount <= 0) {
    // Loss — no tax
    recommendation = gainType === 'STCG'
      ? 'This is a short-term capital loss. It can be set off against both STCG and LTCG in this FY, and carried forward for 8 years.'
      : 'This is a long-term capital loss. It can only be set off against LTCG, and carried forward for 8 years.';

    return {
      gainAmount: Math.round(gainAmount * 100) / 100,
      gainType,
      taxableGain: 0,
      taxAmount: 0,
      effectiveRate: 0,
      surcharge: 0,
      cess: 0,
      totalTax: 0,
      slabBefore: slabBefore.slabLabel,
      slabAfter: slabBefore.slabLabel,
      slabPush: false,
      ltcgExemptionUsed: 0,
      ltcgExemptionRemaining: Math.max(0, EQUITY_LTCG_EXEMPTION - ltcgUsedThisFY),
      recommendation,
    };
  }

  if (fundType === 'equity' && gainType === 'STCG') {
    // Equity STCG: Flat 20%
    taxableGain = gainAmount;
    taxAmount = taxableGain * (EQUITY_STCG_RATE / 100);
    ltcgExemptionRemaining = Math.max(0, EQUITY_LTCG_EXEMPTION - ltcgUsedThisFY);
    recommendation = `Short-term equity gain taxed at flat ${EQUITY_STCG_RATE}%. Consider holding for ${Math.ceil(365 - ((sellDate.getTime() - purchaseDate.getTime()) / (24*60*60*1000)))} more days to qualify for LTCG (12.5% with ₹1.25L exemption).`;

  } else if (fundType === 'equity' && gainType === 'LTCG') {
    // Equity LTCG: 12.5% on gains above ₹1.25L exemption
    const exemptionAvailable = Math.max(0, EQUITY_LTCG_EXEMPTION - ltcgUsedThisFY);
    const exemptAmount = Math.min(gainAmount, exemptionAvailable);
    taxableGain = Math.max(0, gainAmount - exemptAmount);
    taxAmount = taxableGain * (EQUITY_LTCG_RATE / 100);
    ltcgExemptionUsed = exemptAmount;
    ltcgExemptionRemaining = Math.max(0, exemptionAvailable - exemptAmount);

    if (exemptAmount > 0 && taxableGain === 0) {
      recommendation = `Entire gain of ₹${Math.round(gainAmount).toLocaleString('en-IN')} falls within your ₹1.25L tax-free LTCG quota. Zero tax!`;
    } else if (ltcgExemptionRemaining > 0) {
      recommendation = `₹${Math.round(exemptAmount).toLocaleString('en-IN')} is tax-free (LTCG exemption). Remaining ₹${Math.round(taxableGain).toLocaleString('en-IN')} taxed at 12.5%.`;
    } else {
      recommendation = `Your ₹1.25L LTCG exemption is fully used this FY. Full gain taxed at 12.5%. Consider deferring partial redemption to next FY.`;
    }

  } else {
    // Debt fund: All gains at slab rate (no STCG/LTCG distinction)
    taxableGain = gainAmount;
    const totalIncome = userIncome + gainAmount;
    // Tax = incremental slab tax
    const taxBefore = calculateSlabTax(userIncome, taxRegime);
    const taxAfter = calculateSlabTax(totalIncome, taxRegime);
    taxAmount = taxAfter - taxBefore;
    ltcgExemptionRemaining = Math.max(0, EQUITY_LTCG_EXEMPTION - ltcgUsedThisFY);
    recommendation = `Debt fund gains are added to your income and taxed at your slab rate. No LTCG benefit available since Apr 2023.`;
  }

  // Surcharge
  const totalIncomeWithGain = userIncome + gainAmount;
  const surchargeRate = getSurcharge(totalIncomeWithGain);
  const surchargeAmount = taxAmount * (surchargeRate / 100);

  // Cess (4% on tax + surcharge)
  const cessAmount = (taxAmount + surchargeAmount) * (CESS_RATE / 100);

  const totalTax = Math.round((taxAmount + surchargeAmount + cessAmount) * 100) / 100;
  const effectiveRate = gainAmount > 0 ? (totalTax / gainAmount) * 100 : 0;

  // Slab push detection
  const slabAfter = getSlabRate(totalIncomeWithGain, taxRegime);
  const slabPush = slabAfter.rate > slabBefore.rate;

  if (slabPush) {
    recommendation += ` Warning: This redemption pushes your marginal tax rate from ${slabBefore.slabLabel} to ${slabAfter.slabLabel}. Consider partial redemption over two financial years.`;
  }

  return {
    gainAmount: Math.round(gainAmount * 100) / 100,
    gainType,
    taxableGain: Math.round(taxableGain * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    surcharge: Math.round(surchargeAmount * 100) / 100,
    cess: Math.round(cessAmount * 100) / 100,
    totalTax,
    slabBefore: slabBefore.slabLabel,
    slabAfter: slabAfter.slabLabel,
    slabPush,
    ltcgExemptionUsed: Math.round(ltcgExemptionUsed * 100) / 100,
    ltcgExemptionRemaining: Math.round(ltcgExemptionRemaining * 100) / 100,
    recommendation,
  };
}

// ═══ Net-of-Tax Fund Swap Comparison ═══

export function calculateSwapBenefit(params: SwapBenefitParams): SwapBenefitResult {
  const { currentFundCagr, newFundCagr, currentValue, taxCost, projectionYears } = params;

  // Projected value staying in current fund
  const projectedCurrent = currentValue * Math.pow(1 + currentFundCagr / 100, projectionYears);
  const projectedGainCurrent = projectedCurrent - currentValue;

  // Projected value after switching (invest post-tax amount)
  const postTaxInvestment = currentValue - taxCost;
  const projectedNew = postTaxInvestment * Math.pow(1 + newFundCagr / 100, projectionYears);
  const projectedGainNew = projectedNew - postTaxInvestment;

  // Net benefit = (new projected - current projected) - tax cost paid upfront
  const netBenefit = (projectedNew - projectedCurrent);

  return {
    projectedGainCurrent: Math.round(projectedGainCurrent * 100) / 100,
    projectedGainNew: Math.round(projectedGainNew * 100) / 100,
    taxCost: Math.round(taxCost * 100) / 100,
    netBenefit: Math.round(netBenefit * 100) / 100,
  };
}

// ═══ Tax-Optimized STP Calculator ═══

export function calculateTaxOptimizedSTP(params: STPParams): STPResult {
  const { totalUnits, purchaseNav, currentNav, ltcgRemaining, monthsLeftInFY } = params;

  if (ltcgRemaining <= 0 || monthsLeftInFY <= 0) {
    return { monthlyUnits: 0, monthlyAmount: 0, months: 0, totalTaxSaved: 0 };
  }

  const gainPerUnit = currentNav - purchaseNav;
  if (gainPerUnit <= 0) {
    // No gain — move everything, no tax
    return {
      monthlyUnits: totalUnits / monthsLeftInFY,
      monthlyAmount: (totalUnits / monthsLeftInFY) * currentNav,
      months: monthsLeftInFY,
      totalTaxSaved: 0,
    };
  }

  // Max units we can redeem within LTCG exemption
  const maxUnitsExempt = ltcgRemaining / gainPerUnit;
  const unitsToMove = Math.min(totalUnits, maxUnitsExempt);

  // Spread across remaining months
  const months = Math.min(monthsLeftInFY, Math.ceil(unitsToMove / (unitsToMove / monthsLeftInFY)));
  const monthlyUnits = unitsToMove / months;
  const monthlyAmount = monthlyUnits * currentNav;

  // Tax saved = what you'd pay at 12.5% on the exempt portion
  const totalTaxSaved = Math.min(unitsToMove * gainPerUnit, ltcgRemaining) * (EQUITY_LTCG_RATE / 100);

  return {
    monthlyUnits: Math.round(monthlyUnits * 10000) / 10000,
    monthlyAmount: Math.round(monthlyAmount * 100) / 100,
    months,
    totalTaxSaved: Math.round(totalTaxSaved * 100) / 100,
  };
}
