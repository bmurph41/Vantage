import type { 
  TransactionClosingSummary,
  ClosingCostLine,
  TransitionCostLine,
  NwcLine
} from "../../shared/schema";

/**
 * Transaction & Closing Costs Calculation Engine
 * 
 * This service computes all derived fields for the Transaction & Closing Costs module,
 * mirroring the Excel logic from Closing Costs.xlsm
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely parse a decimal value (could be string or number)
 */
function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safe division that handles zero divisor
 */
function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// ============================================================================
// CLOSING COSTS CALCULATIONS
// ============================================================================

/**
 * Compute total closing costs from line items
 * Excel: SUM(E6:E13) - sum of all closing cost line amounts
 */
export function computeClosingCostsTotal(closingLines: ClosingCostLine[]): number {
  return closingLines.reduce((sum, line) => {
    return sum + parseDecimal(line.amount);
  }, 0);
}

/**
 * Compute financing fees
 * Excel: E13 = D13 * (E4 * Dashboard!O32)
 * Where:
 *   - D13 = financing fee rate (e.g., 0.01 for 1%)
 *   - E4 = purchase price
 *   - Dashboard!O32 = LTV or debt percentage
 * 
 * @param financingFeeRate - Rate as decimal (e.g., 0.01 for 1%)
 * @param financingBaseAmount - Base amount to apply rate to (e.g., purchasePrice * LTV)
 */
export function computeFinancingFees(
  financingFeeRate: number | string | null | undefined,
  financingBaseAmount: number | string | null | undefined
): number {
  const rate = parseDecimal(financingFeeRate);
  const base = parseDecimal(financingBaseAmount);
  return rate * base;
}

// ============================================================================
// WORKING CAPITAL CALCULATIONS
// ============================================================================

/**
 * Compute working capital required
 * Excel: E17 = (DealSummary!G56 / 12) * D17
 * Where:
 *   - DealSummary!G56 / 12 = monthly expense base (annual opex / 12)
 *   - D17 = number of months of expenses
 * 
 * @param workingCapitalMonths - Number of months of expenses to hold
 * @param workingCapitalMonthlyExpenseBase - Monthly expense amount (annual opex / 12)
 */
export function computeWorkingCapitalRequired(
  workingCapitalMonths: number | null | undefined,
  workingCapitalMonthlyExpenseBase: number | string | null | undefined
): number {
  const months = workingCapitalMonths || 0;
  const monthlyBase = parseDecimal(workingCapitalMonthlyExpenseBase);
  return months * monthlyBase;
}

/**
 * Compute monthly expense base from annual operating expenses
 * @param annualOpex - Annual operating expenses
 */
export function computeMonthlyExpenseBase(
  annualOpex: number | string | null | undefined
): number {
  return parseDecimal(annualOpex) / 12;
}

// ============================================================================
// TRANSITION COSTS CALCULATIONS
// ============================================================================

/**
 * Compute total transition costs from line items
 * Excel: I19 = SUM(I6:I9, I11:I18)
 */
export function computeTransitionCostsTotal(transitionLines: TransitionCostLine[]): number {
  return transitionLines.reduce((sum, line) => {
    return sum + parseDecimal(line.amount);
  }, 0);
}

// ============================================================================
// TOTAL INVESTMENT COST CALCULATION
// ============================================================================

/**
 * Compute total investment cost
 * Excel: E22 = SUM(E4, E15, E17, E18, E19, E20, E21)
 * Where:
 *   - E4 = Purchase Price
 *   - E15 = Total Acquisition/Closing Costs
 *   - E17 = Working Capital
 *   - E18 = Transition Costs
 *   - E19, E20, E21 = CapEx phases 1, 2, 3
 * 
 * @param purchasePrice - Acquisition cost
 * @param totalClosingCosts - Sum of all closing costs
 * @param workingCapitalRequired - Computed working capital need
 * @param transitionCostsTotal - Sum of all transition costs
 * @param capexPhase1 - CapEx phase 1 (from CapEx module or manual)
 * @param capexPhase2 - CapEx phase 2
 * @param capexPhase3 - CapEx phase 3
 */
export function computeTotalInvestmentCost(
  purchasePrice: number | string | null | undefined,
  totalClosingCosts: number | string | null | undefined,
  workingCapitalRequired: number | string | null | undefined,
  transitionCostsTotal: number | string | null | undefined,
  capexPhase1: number | string | null | undefined,
  capexPhase2: number | string | null | undefined,
  capexPhase3: number | string | null | undefined
): number {
  return (
    parseDecimal(purchasePrice) +
    parseDecimal(totalClosingCosts) +
    parseDecimal(workingCapitalRequired) +
    parseDecimal(transitionCostsTotal) +
    parseDecimal(capexPhase1) +
    parseDecimal(capexPhase2) +
    parseDecimal(capexPhase3)
  );
}

// ============================================================================
// NET WORKING CAPITAL CALCULATIONS
// ============================================================================

export interface NwcCalculationResult {
  currentAssetsTotal: number;
  currentLiabilitiesTotal: number;
  nwcAdjustmentsTotal: number;
  currentRatio: number;
  arMinusAp: number;
  workingCapitalBalance: number;
}

/**
 * Compute all net working capital metrics from NWC lines
 * Excel:
 *   - M16 = SUM(M8:M15) - Total Current Assets
 *   - M28 = SUM(M18:M27) - Total Current Liabilities
 *   - M37 = SUM(M31:M36) - NWC Adjustments
 *   - M5 = M16 / M28 - Current Ratio
 *   - AR - AP (computed from specific line items)
 *   - M39 = (M16 - M28) + M37 - Working Capital Balance
 * 
 * @param nwcLines - All NWC line items (assets, liabilities, adjustments)
 */
export function computeNetWorkingCapital(nwcLines: NwcLine[]): NwcCalculationResult {
  // Aggregate by bucket type
  const currentAssetsTotal = nwcLines
    .filter(line => line.bucketType === 'current_asset')
    .reduce((sum, line) => sum + parseDecimal(line.amount), 0);

  const currentLiabilitiesTotal = nwcLines
    .filter(line => line.bucketType === 'current_liability')
    .reduce((sum, line) => sum + parseDecimal(line.amount), 0);

  const nwcAdjustmentsTotal = nwcLines
    .filter(line => line.bucketType === 'nwc_adjustment')
    .reduce((sum, line) => sum + parseDecimal(line.amount), 0);

  // Current Ratio = Current Assets / Current Liabilities
  const currentRatio = safeDivide(currentAssetsTotal, currentLiabilitiesTotal);

  // AR - AP (Accounts Receivable - Accounts Payable)
  // Per Excel logic: (AR base + AR adjustment) - (AP base + AP adjustment)
  const accountsReceivableBase = nwcLines
    .find(line => 
      line.bucketType === 'current_asset' && 
      line.label.toLowerCase().includes('receivable')
    );
  const accountsPayableBase = nwcLines
    .find(line => 
      line.bucketType === 'current_liability' && 
      line.label.toLowerCase().includes('payable')
    );
  const arAdjustment = nwcLines
    .find(line => 
      line.bucketType === 'nwc_adjustment' && 
      line.label.toLowerCase().includes('ar adjustment')
    );
  const apAdjustment = nwcLines
    .find(line => 
      line.bucketType === 'nwc_adjustment' && 
      line.label.toLowerCase().includes('ap adjustment')
    );
  
  // Calculate AR - AP: (base AR + AR adj) - (base AP + AP adj)
  const totalAR = parseDecimal(accountsReceivableBase?.amount) + parseDecimal(arAdjustment?.amount);
  const totalAP = parseDecimal(accountsPayableBase?.amount) + parseDecimal(apAdjustment?.amount);
  const arMinusAp = totalAR - totalAP;

  // Working Capital Balance = (Assets - Liabilities) + Adjustments
  // Excel: M39 = (M16 - M28) + M37
  const workingCapitalBalance = (currentAssetsTotal - currentLiabilitiesTotal) + nwcAdjustmentsTotal;

  return {
    currentAssetsTotal,
    currentLiabilitiesTotal,
    nwcAdjustmentsTotal,
    currentRatio,
    arMinusAp,
    workingCapitalBalance,
  };
}

// ============================================================================
// COMPLETE CALCULATION PIPELINE
// ============================================================================

export interface TransactionClosingData {
  summary: Partial<TransactionClosingSummary>;
  closingCostLines: ClosingCostLine[];
  transitionCostLines: TransitionCostLine[];
  nwcLines: NwcLine[];
}

export interface CalculatedSummary extends Partial<TransactionClosingSummary> {
  // All computed fields will be populated
  totalClosingCosts: string;
  financingFees: string;
  workingCapitalRequired: string;
  transitionCostsTotal: string;
  totalInvestmentCost: string;
  currentAssetsTotal: string;
  currentLiabilitiesTotal: string;
  currentRatio: string;
  arMinusAp: string;
  nwcAdjustmentsTotal: string;
  workingCapitalBalance: string;
}

/**
 * Run all calculations and return computed summary
 * This is the main function that orchestrates all computations
 * 
 * @param data - Input data with summary and line items
 * @returns Fully computed summary object
 */
export function calculateAll(data: TransactionClosingData): CalculatedSummary {
  const { summary, closingCostLines, transitionCostLines, nwcLines } = data;

  // 1. Closing costs
  const totalClosingCosts = computeClosingCostsTotal(closingCostLines);

  // 2. Financing fees
  const financingFees = computeFinancingFees(
    summary.financingFeeRate,
    summary.financingBaseAmount
  );

  // 3. Working capital
  const workingCapitalRequired = computeWorkingCapitalRequired(
    summary.workingCapitalMonths,
    summary.workingCapitalMonthlyExpenseBase
  );

  // 4. Transition costs
  const transitionCostsTotal = computeTransitionCostsTotal(transitionCostLines);

  // 5. Net working capital metrics
  const nwcMetrics = computeNetWorkingCapital(nwcLines);

  // 6. Total investment cost
  const totalInvestmentCost = computeTotalInvestmentCost(
    summary.purchasePrice,
    totalClosingCosts,
    workingCapitalRequired,
    transitionCostsTotal,
    summary.capexPhase1,
    summary.capexPhase2,
    summary.capexPhase3
  );

  // Return computed summary (convert to strings for decimal storage)
  return {
    ...summary,
    totalClosingCosts: totalClosingCosts.toFixed(2),
    financingFees: financingFees.toFixed(2),
    workingCapitalRequired: workingCapitalRequired.toFixed(2),
    transitionCostsTotal: transitionCostsTotal.toFixed(2),
    totalInvestmentCost: totalInvestmentCost.toFixed(2),
    currentAssetsTotal: nwcMetrics.currentAssetsTotal.toFixed(2),
    currentLiabilitiesTotal: nwcMetrics.currentLiabilitiesTotal.toFixed(2),
    currentRatio: nwcMetrics.currentRatio.toFixed(6),
    arMinusAp: nwcMetrics.arMinusAp.toFixed(2),
    nwcAdjustmentsTotal: nwcMetrics.nwcAdjustmentsTotal.toFixed(2),
    workingCapitalBalance: nwcMetrics.workingCapitalBalance.toFixed(2),
  };
}
