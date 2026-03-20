/**
 * Institutional Analysis Service
 *
 * Production-grade financial analysis engines for PE/institutional investors:
 * 1. IRR Decomposition & Return Attribution
 * 2. Mark-to-Market Rent Roll Analysis
 * 3. CapEx Budget & Deferred Maintenance Modeling
 * 4. Stabilized vs In-Place NOI
 * 5. Hold Period Cash Flow Summary
 * 6. PE Waterfall (Return of Capital → Pref → Catch-up → Carried Interest)
 * 7. Fund Metrics (MOIC, DPI, RVPI, TVPI)
 * 8. Replacement Cost Analysis
 * 9. Debt Yield & Loan Sizing
 * 10. Macro Stress Tests
 * 11. Benchmark IRR Overlay
 * 12. Portfolio Risk Aggregation
 * 13. Depreciation Schedule
 * 14. Comp Adjustment Grid
 * 15. Operator Benchmarking
 */

import { calculateXIRR, calculateNPV, calculateEquityMultiple, DatedCashFlow } from '../../shared/finance/xirr';

// ============================================================================
// 1. IRR DECOMPOSITION & RETURN ATTRIBUTION
// ============================================================================

export interface ReturnDecomposition {
  // Unlevered
  unleveredIRR: number;
  goingInCapRate: number;
  exitCapRate: number;
  // Levered
  leveredIRR: number;
  // Attribution bridge
  operationsYield: number;      // NOI / equity contribution to return
  leverageEffect: number;       // delta between levered and unlevered (positive = accretive)
  terminalValueContribution: number; // exit proceeds contribution
  capRateCompressionEffect: number;  // going-in vs exit cap rate delta impact
  noiGrowthContribution: number;     // organic NOI growth over hold
  debtPaydownBenefit: number;        // principal amortization creating equity
  // Summary
  totalReturn: number;
  equityMultiple: number;
  cashOnCash: number[];          // annual cash-on-cash yields
  averageCashOnCash: number;
  peakEquityExposure: number;
}

export function computeReturnDecomposition(params: {
  purchasePrice: number;
  equityInvested: number;
  loanAmount: number;
  interestRate: number;          // annual decimal
  amortizationMonths: number;
  holdPeriodYears: number;
  year1NOI: number;
  noiGrowthRate: number;         // annual decimal
  exitCapRate: number;           // decimal
  sellingCostPct: number;        // decimal
  acquisitionDate: string;
}): ReturnDecomposition {
  const p = params;
  const goingInCapRate = p.year1NOI / p.purchasePrice;

  // Build annual NOI schedule
  const annualNOI: number[] = [];
  for (let y = 0; y < p.holdPeriodYears; y++) {
    annualNOI.push(p.year1NOI * Math.pow(1 + p.noiGrowthRate, y));
  }

  // Build debt service schedule
  const monthlyRate = p.interestRate / 12;
  const monthlyPayment = p.amortizationMonths > 0
    ? p.loanAmount * monthlyRate * Math.pow(1 + monthlyRate, p.amortizationMonths) / (Math.pow(1 + monthlyRate, p.amortizationMonths) - 1)
    : p.loanAmount * monthlyRate; // IO
  const annualDebtService = monthlyPayment * 12;

  // Track loan balance
  let loanBalance = p.loanAmount;
  const annualPrincipal: number[] = [];
  const annualInterest: number[] = [];
  for (let y = 0; y < p.holdPeriodYears; y++) {
    let yearPrincipal = 0;
    let yearInterest = 0;
    for (let m = 0; m < 12; m++) {
      const interest = loanBalance * monthlyRate;
      const principal = Math.min(monthlyPayment - interest, loanBalance);
      yearInterest += interest;
      yearPrincipal += principal;
      loanBalance -= principal;
    }
    annualPrincipal.push(yearPrincipal);
    annualInterest.push(yearInterest);
  }

  // Exit value
  const exitNOI = annualNOI[annualNOI.length - 1] * (1 + p.noiGrowthRate);
  const exitValue = exitNOI / p.exitCapRate;
  const sellingCosts = exitValue * p.sellingCostPct;
  const netSaleProceeds = exitValue - sellingCosts - loanBalance;

  // Cash flows
  const cashOnCash: number[] = annualNOI.map((noi, y) => {
    const cfAfterDebt = noi - annualDebtService;
    return cfAfterDebt / p.equityInvested;
  });

  // Unlevered flows (no debt)
  const unleveredFlows: DatedCashFlow[] = [
    { date: p.acquisitionDate, amount: -p.purchasePrice }
  ];
  for (let y = 0; y < p.holdPeriodYears; y++) {
    const d = new Date(p.acquisitionDate);
    d.setFullYear(d.getFullYear() + y + 1);
    const isLast = y === p.holdPeriodYears - 1;
    const exitAmt = isLast ? (exitValue - sellingCosts) : 0;
    unleveredFlows.push({ date: d.toISOString().split('T')[0], amount: annualNOI[y] + exitAmt });
  }

  // Levered flows
  const leveredFlows: DatedCashFlow[] = [
    { date: p.acquisitionDate, amount: -p.equityInvested }
  ];
  for (let y = 0; y < p.holdPeriodYears; y++) {
    const d = new Date(p.acquisitionDate);
    d.setFullYear(d.getFullYear() + y + 1);
    const isLast = y === p.holdPeriodYears - 1;
    const cfAfterDebt = annualNOI[y] - annualDebtService;
    const exitAmt = isLast ? netSaleProceeds : 0;
    leveredFlows.push({ date: d.toISOString().split('T')[0], amount: cfAfterDebt + exitAmt });
  }

  const unleveredResult = calculateXIRR(unleveredFlows);
  const leveredResult = calculateXIRR(leveredFlows);
  const em = calculateEquityMultiple(leveredFlows);

  // Attribution
  const totalPrincipalPaydown = p.loanAmount - loanBalance;
  const noiGrowthTotal = annualNOI.reduce((s, n) => s + n, 0) - p.year1NOI * p.holdPeriodYears;
  const capRateCompression = (goingInCapRate - p.exitCapRate) * exitNOI / (goingInCapRate * p.exitCapRate);

  return {
    unleveredIRR: unleveredResult.irr,
    goingInCapRate: goingInCapRate * 100,
    exitCapRate: p.exitCapRate * 100,
    leveredIRR: leveredResult.irr,
    operationsYield: (annualNOI.reduce((s, n) => s + n, 0) / p.equityInvested) * 100 / p.holdPeriodYears,
    leverageEffect: leveredResult.irr - unleveredResult.irr,
    terminalValueContribution: (netSaleProceeds / p.equityInvested - 1) * 100 / p.holdPeriodYears,
    capRateCompressionEffect: capRateCompression / p.equityInvested * 100,
    noiGrowthContribution: noiGrowthTotal / p.equityInvested * 100,
    debtPaydownBenefit: totalPrincipalPaydown / p.equityInvested * 100,
    totalReturn: (em - 1) * 100,
    equityMultiple: em,
    cashOnCash: cashOnCash.map(c => c * 100),
    averageCashOnCash: cashOnCash.reduce((s, c) => s + c, 0) / cashOnCash.length * 100,
    peakEquityExposure: p.equityInvested,
  };
}

// ============================================================================
// 2. MARK-TO-MARKET RENT ROLL ANALYSIS
// ============================================================================

export interface RentRollUnit {
  unitId: string;
  unitName: string;
  unitType: string;           // wet_slip, dry_rack, mooring, etc.
  size?: string;              // e.g., "40ft"
  currentRent: number;        // monthly
  marketRent: number;          // monthly (from rate comps)
  leaseExpiry?: string;
  occupancyStatus: 'occupied' | 'vacant' | 'pending';
}

export interface MarkToMarketResult {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;

  // Current
  currentGrossRevenue: number;   // annual
  currentEffectiveRevenue: number; // after vacancy

  // Market
  marketGrossRevenue: number;    // annual at market rents

  // Mark-to-Market
  totalLossToLease: number;     // annual $ below market
  totalGainToLease: number;     // annual $ above market
  netMarkToMarket: number;      // net opportunity (loss - gain)
  mtmAsPercentOfRevenue: number;

  // By unit type
  byUnitType: {
    unitType: string;
    count: number;
    avgCurrentRent: number;
    avgMarketRent: number;
    lossToLease: number;
    gainToLease: number;
    netMTM: number;
    mtmPct: number;
  }[];

  // Individual unit detail
  unitDetail: {
    unitId: string;
    unitName: string;
    unitType: string;
    size: string;
    currentRent: number;
    marketRent: number;
    variance: number;       // market - current
    variancePct: number;
    status: 'below_market' | 'at_market' | 'above_market';
    leaseExpiry?: string;
    annualImpact: number;
  }[];

  // Lease expiry schedule (for strategic rent bumps)
  leaseExpirySchedule: {
    period: string;
    expiringUnits: number;
    currentRent: number;
    marketRent: number;
    captureOpportunity: number;
  }[];

  // Stabilized rent projection
  stabilizedRevenue: number;      // if all rents at market
  revenueUplift: number;          // stabilized - current
  revenueUpliftPct: number;
  impliedCapRateImpact: number;   // NOI uplift / purchase price
}

export function computeMarkToMarket(
  units: RentRollUnit[],
  purchasePrice: number,
  expenseRatio: number = 0.45,
): MarkToMarketResult {
  const occupied = units.filter(u => u.occupancyStatus === 'occupied');
  const vacant = units.filter(u => u.occupancyStatus === 'vacant');

  const totalUnits = units.length;
  const occupiedUnits = occupied.length;
  const vacantUnits = vacant.length;
  const occupancyRate = totalUnits > 0 ? occupiedUnits / totalUnits : 0;

  const currentGrossRevenue = occupied.reduce((s, u) => s + u.currentRent * 12, 0);
  const currentEffectiveRevenue = currentGrossRevenue; // already only occupied
  const marketGrossRevenue = units.reduce((s, u) => s + u.marketRent * 12, 0);

  let totalLossToLease = 0;
  let totalGainToLease = 0;

  const unitDetail = units.map(u => {
    const variance = u.marketRent - u.currentRent;
    const variancePct = u.currentRent > 0 ? variance / u.currentRent : 0;
    const annualImpact = variance * 12;
    const status: 'below_market' | 'at_market' | 'above_market' =
      variancePct > 0.02 ? 'below_market' : variancePct < -0.02 ? 'above_market' : 'at_market';

    if (variance > 0 && u.occupancyStatus === 'occupied') totalLossToLease += annualImpact;
    if (variance < 0 && u.occupancyStatus === 'occupied') totalGainToLease += Math.abs(annualImpact);

    return {
      unitId: u.unitId,
      unitName: u.unitName,
      unitType: u.unitType,
      size: u.size || '',
      currentRent: u.currentRent,
      marketRent: u.marketRent,
      variance,
      variancePct: variancePct * 100,
      status,
      leaseExpiry: u.leaseExpiry,
      annualImpact,
    };
  });

  // Group by unit type
  const typeMap = new Map<string, typeof unitDetail>();
  unitDetail.forEach(u => {
    if (!typeMap.has(u.unitType)) typeMap.set(u.unitType, []);
    typeMap.get(u.unitType)!.push(u);
  });

  const byUnitType = Array.from(typeMap.entries()).map(([unitType, details]) => {
    const count = details.length;
    const avgCurrent = details.reduce((s, d) => s + d.currentRent, 0) / count;
    const avgMarket = details.reduce((s, d) => s + d.marketRent, 0) / count;
    const loss = details.filter(d => d.variance > 0).reduce((s, d) => s + d.annualImpact, 0);
    const gain = details.filter(d => d.variance < 0).reduce((s, d) => s + Math.abs(d.annualImpact), 0);
    return {
      unitType,
      count,
      avgCurrentRent: avgCurrent,
      avgMarketRent: avgMarket,
      lossToLease: loss,
      gainToLease: gain,
      netMTM: loss - gain,
      mtmPct: avgCurrent > 0 ? ((avgMarket - avgCurrent) / avgCurrent) * 100 : 0,
    };
  });

  // Lease expiry schedule
  const expiryMap = new Map<string, typeof unitDetail>();
  unitDetail.forEach(u => {
    if (u.leaseExpiry) {
      const period = u.leaseExpiry.substring(0, 7); // YYYY-MM
      if (!expiryMap.has(period)) expiryMap.set(period, []);
      expiryMap.get(period)!.push(u);
    }
  });

  const leaseExpirySchedule = Array.from(expiryMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, details]) => ({
      period,
      expiringUnits: details.length,
      currentRent: details.reduce((s, d) => s + d.currentRent * 12, 0),
      marketRent: details.reduce((s, d) => s + d.marketRent * 12, 0),
      captureOpportunity: details.filter(d => d.variance > 0).reduce((s, d) => s + d.annualImpact, 0),
    }));

  const netMTM = totalLossToLease - totalGainToLease;
  const stabilizedRevenue = marketGrossRevenue;
  const revenueUplift = stabilizedRevenue - currentGrossRevenue - (vacant.length > 0 ? vacant.reduce((s, u) => s + u.marketRent * 12, 0) : 0);
  const noiUplift = netMTM * (1 - expenseRatio);

  return {
    totalUnits,
    occupiedUnits,
    vacantUnits,
    occupancyRate: occupancyRate * 100,
    currentGrossRevenue,
    currentEffectiveRevenue,
    marketGrossRevenue,
    totalLossToLease,
    totalGainToLease,
    netMarkToMarket: netMTM,
    mtmAsPercentOfRevenue: currentGrossRevenue > 0 ? (netMTM / currentGrossRevenue) * 100 : 0,
    byUnitType,
    unitDetail,
    leaseExpirySchedule,
    stabilizedRevenue,
    revenueUplift,
    revenueUpliftPct: currentGrossRevenue > 0 ? (revenueUplift / currentGrossRevenue) * 100 : 0,
    impliedCapRateImpact: purchasePrice > 0 ? (noiUplift / purchasePrice) * 100 : 0,
  };
}

// ============================================================================
// 3. CAPEX BUDGET & DEFERRED MAINTENANCE
// ============================================================================

export interface CapExItem {
  id: string;
  category: 'deferred_maintenance' | 'value_add' | 'recurring' | 'reserves' | 'environmental';
  name: string;
  description?: string;
  estimatedCost: number;
  yearPlanned: number;          // 0 = at closing, 1-5 = year in hold
  priority: 'critical' | 'high' | 'medium' | 'low';
  noiImpact?: number;           // annual NOI improvement after completion
  completionMonths?: number;    // months to complete
}

export interface CapExBudgetResult {
  totalCapEx: number;
  byYear: {
    year: number;
    label: string;
    items: CapExItem[];
    totalCost: number;
    cumulativeCost: number;
    noiImpact: number;
    cumulativeNOIImpact: number;
  }[];
  byCategory: {
    category: string;
    totalCost: number;
    itemCount: number;
    avgPriority: number;
  }[];
  deferredMaintenanceTotal: number;
  valueAddTotal: number;
  recurringTotal: number;
  reservesTotal: number;
  annualReserveRequirement: number;
  capExPerUnit: number;
  capExAsPctOfValue: number;
  // Impact analysis
  preCapExNOI: number;
  postCapExNOI: number;
  noiUpliftFromCapEx: number;
  impliedValueCreation: number;   // NOI uplift / cap rate
  returnOnCapEx: number;          // NOI uplift / total capex
}

export function computeCapExBudget(
  items: CapExItem[],
  holdPeriodYears: number,
  currentNOI: number,
  purchasePrice: number,
  totalUnits: number,
  exitCapRate: number,
): CapExBudgetResult {
  const sorted = [...items].sort((a, b) => a.yearPlanned - b.yearPlanned);

  // By year
  const byYear: CapExBudgetResult['byYear'] = [];
  let cumulativeCost = 0;
  let cumulativeNOI = 0;

  for (let y = 0; y <= holdPeriodYears; y++) {
    const yearItems = sorted.filter(i => i.yearPlanned === y);
    const yearCost = yearItems.reduce((s, i) => s + i.estimatedCost, 0);
    const yearNOI = yearItems.reduce((s, i) => s + (i.noiImpact || 0), 0);
    cumulativeCost += yearCost;
    cumulativeNOI += yearNOI;

    byYear.push({
      year: y,
      label: y === 0 ? 'At Closing' : `Year ${y}`,
      items: yearItems,
      totalCost: yearCost,
      cumulativeCost,
      noiImpact: yearNOI,
      cumulativeNOIImpact: cumulativeNOI,
    });
  }

  // By category
  const catMap = new Map<string, { cost: number; count: number }>();
  items.forEach(i => {
    const entry = catMap.get(i.category) || { cost: 0, count: 0 };
    entry.cost += i.estimatedCost;
    entry.count++;
    catMap.set(i.category, entry);
  });

  const byCategory = Array.from(catMap.entries()).map(([category, data]) => ({
    category,
    totalCost: data.cost,
    itemCount: data.count,
    avgPriority: 0,
  }));

  const totalCapEx = items.reduce((s, i) => s + i.estimatedCost, 0);
  const totalNOIImpact = items.reduce((s, i) => s + (i.noiImpact || 0), 0);
  const deferred = items.filter(i => i.category === 'deferred_maintenance').reduce((s, i) => s + i.estimatedCost, 0);
  const valueAdd = items.filter(i => i.category === 'value_add').reduce((s, i) => s + i.estimatedCost, 0);
  const recurring = items.filter(i => i.category === 'recurring').reduce((s, i) => s + i.estimatedCost, 0);
  const reserves = items.filter(i => i.category === 'reserves').reduce((s, i) => s + i.estimatedCost, 0);

  return {
    totalCapEx,
    byYear,
    byCategory,
    deferredMaintenanceTotal: deferred,
    valueAddTotal: valueAdd,
    recurringTotal: recurring,
    reservesTotal: reserves,
    annualReserveRequirement: reserves / Math.max(holdPeriodYears, 1),
    capExPerUnit: totalUnits > 0 ? totalCapEx / totalUnits : 0,
    capExAsPctOfValue: purchasePrice > 0 ? (totalCapEx / purchasePrice) * 100 : 0,
    preCapExNOI: currentNOI,
    postCapExNOI: currentNOI + totalNOIImpact,
    noiUpliftFromCapEx: totalNOIImpact,
    impliedValueCreation: exitCapRate > 0 ? totalNOIImpact / exitCapRate : 0,
    returnOnCapEx: totalCapEx > 0 ? (totalNOIImpact / totalCapEx) * 100 : 0,
  };
}

// ============================================================================
// 4. STABILIZED VS IN-PLACE NOI
// ============================================================================

export interface StabilizedNOIResult {
  inPlaceNOI: number;
  stabilizedNOI: number;
  noiDelta: number;
  noiDeltaPct: number;

  adjustments: {
    category: string;
    description: string;
    amount: number;
    timing: string;
  }[];

  inPlaceCapRate: number;
  stabilizedCapRate: number;
  inPlaceValue: number;
  stabilizedValue: number;
  valueDelta: number;

  monthsToStabilize: number;

  // Detailed breakdown
  inPlaceRevenue: number;
  stabilizedRevenue: number;
  inPlaceExpenses: number;
  stabilizedExpenses: number;

  revenueAdjustments: {
    occupancyGain: number;
    rentBumpToMarket: number;
    newRevenueStreams: number;
    otherRevenue: number;
  };

  expenseAdjustments: {
    operationalEfficiencies: number;
    managementFeeChange: number;
    insuranceChange: number;
    otherExpenses: number;
  };
}

export function computeStabilizedNOI(params: {
  currentRevenue: number;
  currentExpenses: number;
  purchasePrice: number;
  // Revenue adjustments
  currentOccupancy: number;     // decimal
  stabilizedOccupancy: number;  // decimal
  lossToLease: number;          // annual $ from MTM
  newRevenueStreams: number;     // annual $ new revenue
  otherRevenueAdj: number;
  // Expense adjustments
  operationalSavings: number;   // annual $
  managementFeeChange: number;
  insuranceChange: number;
  otherExpenseAdj: number;
  // Timing
  monthsToStabilize: number;
  exitCapRate: number;          // decimal
}): StabilizedNOIResult {
  const p = params;
  const inPlaceNOI = p.currentRevenue - p.currentExpenses;

  // Revenue adjustments
  const occupancyGain = p.currentRevenue * (p.stabilizedOccupancy - p.currentOccupancy) / Math.max(p.currentOccupancy, 0.01);
  const rentBumpToMarket = p.lossToLease;
  const newRevenueStreams = p.newRevenueStreams;
  const otherRevenue = p.otherRevenueAdj;

  const stabilizedRevenue = p.currentRevenue + occupancyGain + rentBumpToMarket + newRevenueStreams + otherRevenue;

  // Expense adjustments
  const opSavings = p.operationalSavings;
  const mgmtChange = p.managementFeeChange;
  const insChange = p.insuranceChange;
  const otherExp = p.otherExpenseAdj;

  const stabilizedExpenses = p.currentExpenses - opSavings + mgmtChange + insChange + otherExp;
  const stabilizedNOI = stabilizedRevenue - stabilizedExpenses;

  const adjustments = [
    { category: 'Revenue', description: 'Occupancy gain to stabilized', amount: occupancyGain, timing: `${p.monthsToStabilize} months` },
    { category: 'Revenue', description: 'Mark-to-market rent bump', amount: rentBumpToMarket, timing: 'As leases expire' },
    { category: 'Revenue', description: 'New revenue streams', amount: newRevenueStreams, timing: '6-12 months' },
    { category: 'Revenue', description: 'Other revenue adjustments', amount: otherRevenue, timing: 'Varies' },
    { category: 'Expense', description: 'Operational efficiencies', amount: -opSavings, timing: '3-6 months' },
    { category: 'Expense', description: 'Management fee change', amount: mgmtChange, timing: 'At closing' },
    { category: 'Expense', description: 'Insurance adjustment', amount: insChange, timing: 'At renewal' },
    { category: 'Expense', description: 'Other expense adjustments', amount: otherExp, timing: 'Varies' },
  ].filter(a => Math.abs(a.amount) > 0);

  const inPlaceCapRate = p.purchasePrice > 0 ? (inPlaceNOI / p.purchasePrice) * 100 : 0;
  const stabilizedCapRate = p.purchasePrice > 0 ? (stabilizedNOI / p.purchasePrice) * 100 : 0;
  const inPlaceValue = p.exitCapRate > 0 ? inPlaceNOI / p.exitCapRate : 0;
  const stabilizedValue = p.exitCapRate > 0 ? stabilizedNOI / p.exitCapRate : 0;

  return {
    inPlaceNOI,
    stabilizedNOI,
    noiDelta: stabilizedNOI - inPlaceNOI,
    noiDeltaPct: inPlaceNOI > 0 ? ((stabilizedNOI - inPlaceNOI) / inPlaceNOI) * 100 : 0,
    adjustments,
    inPlaceCapRate,
    stabilizedCapRate,
    inPlaceValue,
    stabilizedValue,
    valueDelta: stabilizedValue - inPlaceValue,
    monthsToStabilize: p.monthsToStabilize,
    inPlaceRevenue: p.currentRevenue,
    stabilizedRevenue,
    inPlaceExpenses: p.currentExpenses,
    stabilizedExpenses,
    revenueAdjustments: { occupancyGain, rentBumpToMarket, newRevenueStreams, otherRevenue },
    expenseAdjustments: { operationalEfficiencies: opSavings, managementFeeChange: mgmtChange, insuranceChange: insChange, otherExpenses: otherExp },
  };
}

// ============================================================================
// 5. HOLD PERIOD CASH FLOW SUMMARY
// ============================================================================

export interface HoldPeriodCFSummary {
  years: {
    year: number;
    label: string;
    noi: number;
    debtService: number;
    cashFlowAfterDebt: number;
    capEx: number;
    cashFlowAfterCapEx: number;
    principalPaydown: number;
    interestExpense: number;
    loanBalance: number;
    dscr: number;
    debtYield: number;
    cashOnCash: number;         // as pct
    cumulativeCashFlow: number;
    distributions: number;
    terminalValue: number;      // only final year
  }[];

  acquisition: {
    purchasePrice: number;
    closingCosts: number;
    totalAcquisitionCost: number;
    equityRequired: number;
    loanProceeds: number;
    ltv: number;
  };

  disposition: {
    exitNOI: number;
    exitCapRate: number;
    grossSalePrice: number;
    sellingCosts: number;
    loanPayoff: number;
    netProceeds: number;
  };

  totals: {
    totalNOI: number;
    totalDebtService: number;
    totalCashFlowAfterDebt: number;
    totalCapEx: number;
    totalDistributions: number;
    totalPrincipalPaydown: number;
    totalInterest: number;
  };

  returnMetrics: {
    leveredIRR: number;
    unleveredIRR: number;
    equityMultiple: number;
    avgCashOnCash: number;
    avgDSCR: number;
    avgDebtYield: number;
    profitOnCost: number;
    netPresentValue: number;
    peakEquity: number;
    paybackPeriod: number;      // years
  };
}

export function computeHoldPeriodCF(params: {
  purchasePrice: number;
  closingCostPct: number;
  equityInvested: number;
  loanAmount: number;
  interestRate: number;
  amortizationMonths: number;
  holdPeriodYears: number;
  year1NOI: number;
  noiGrowthRate: number;
  exitCapRate: number;
  sellingCostPct: number;
  annualCapEx: number[];
  discountRate: number;
  acquisitionDate: string;
}): HoldPeriodCFSummary {
  const p = params;
  const closingCosts = p.purchasePrice * p.closingCostPct;
  const totalAcquisitionCost = p.purchasePrice + closingCosts;
  const ltv = p.purchasePrice > 0 ? (p.loanAmount / p.purchasePrice) * 100 : 0;

  const monthlyRate = p.interestRate / 12;
  const monthlyPayment = p.amortizationMonths > 0
    ? p.loanAmount * monthlyRate * Math.pow(1 + monthlyRate, p.amortizationMonths) / (Math.pow(1 + monthlyRate, p.amortizationMonths) - 1)
    : p.loanAmount * monthlyRate;
  const annualDS = monthlyPayment * 12;

  let loanBalance = p.loanAmount;
  const years: HoldPeriodCFSummary['years'] = [];
  let cumulativeCF = 0;
  let totalNOI = 0, totalDS = 0, totalCFAfterDebt = 0, totalCapEx = 0;
  let totalDist = 0, totalPrincipal = 0, totalInterest = 0;
  let paybackYear = 0;
  let paybackFound = false;

  const leveredFlows: DatedCashFlow[] = [{ date: p.acquisitionDate, amount: -p.equityInvested }];
  const unleveredFlows: DatedCashFlow[] = [{ date: p.acquisitionDate, amount: -totalAcquisitionCost }];

  for (let y = 1; y <= p.holdPeriodYears; y++) {
    const noi = p.year1NOI * Math.pow(1 + p.noiGrowthRate, y - 1);

    // Annual amortization detail
    let yearPrincipal = 0, yearInterest = 0;
    for (let m = 0; m < 12; m++) {
      const interest = loanBalance * monthlyRate;
      const principal = Math.min(monthlyPayment - interest, loanBalance);
      yearInterest += interest;
      yearPrincipal += principal;
      loanBalance = Math.max(0, loanBalance - principal);
    }

    const capEx = p.annualCapEx[y - 1] || 0;
    const cfAfterDebt = noi - annualDS;
    const cfAfterCapEx = cfAfterDebt - capEx;
    cumulativeCF += cfAfterCapEx;

    const isLast = y === p.holdPeriodYears;
    const exitNOI = noi * (1 + p.noiGrowthRate);
    const exitValue = isLast ? exitNOI / p.exitCapRate : 0;
    const sellingCosts = isLast ? exitValue * p.sellingCostPct : 0;
    const netProceeds = isLast ? exitValue - sellingCosts - loanBalance : 0;

    const d = new Date(p.acquisitionDate);
    d.setFullYear(d.getFullYear() + y);
    const dateStr = d.toISOString().split('T')[0];

    leveredFlows.push({ date: dateStr, amount: cfAfterCapEx + (isLast ? netProceeds : 0) });
    unleveredFlows.push({ date: dateStr, amount: noi - capEx + (isLast ? exitValue - sellingCosts : 0) });

    if (!paybackFound && cumulativeCF >= 0) {
      paybackYear = y;
      paybackFound = true;
    }

    totalNOI += noi;
    totalDS += annualDS;
    totalCFAfterDebt += cfAfterDebt;
    totalCapEx += capEx;
    totalDist += cfAfterCapEx;
    totalPrincipal += yearPrincipal;
    totalInterest += yearInterest;

    years.push({
      year: y,
      label: `Year ${y}`,
      noi,
      debtService: annualDS,
      cashFlowAfterDebt: cfAfterDebt,
      capEx,
      cashFlowAfterCapEx: cfAfterCapEx,
      principalPaydown: yearPrincipal,
      interestExpense: yearInterest,
      loanBalance,
      dscr: annualDS > 0 ? noi / annualDS : 0,
      debtYield: p.loanAmount > 0 ? (noi / p.loanAmount) * 100 : 0,
      cashOnCash: p.equityInvested > 0 ? (cfAfterCapEx / p.equityInvested) * 100 : 0,
      cumulativeCashFlow: cumulativeCF,
      distributions: cfAfterCapEx,
      terminalValue: isLast ? netProceeds : 0,
    });
  }

  const lastYear = years[years.length - 1];
  const exitNOI = p.year1NOI * Math.pow(1 + p.noiGrowthRate, p.holdPeriodYears);
  const grossSalePrice = exitNOI / p.exitCapRate;
  const sellingCosts = grossSalePrice * p.sellingCostPct;

  const levResult = calculateXIRR(leveredFlows);
  const unlevResult = calculateXIRR(unleveredFlows);
  const em = calculateEquityMultiple(leveredFlows);
  const npv = calculateNPV(leveredFlows, p.discountRate);

  return {
    years,
    acquisition: {
      purchasePrice: p.purchasePrice,
      closingCosts,
      totalAcquisitionCost,
      equityRequired: p.equityInvested,
      loanProceeds: p.loanAmount,
      ltv,
    },
    disposition: {
      exitNOI,
      exitCapRate: p.exitCapRate * 100,
      grossSalePrice,
      sellingCosts,
      loanPayoff: lastYear?.loanBalance || 0,
      netProceeds: lastYear?.terminalValue || 0,
    },
    totals: {
      totalNOI,
      totalDebtService: totalDS,
      totalCashFlowAfterDebt: totalCFAfterDebt,
      totalCapEx,
      totalDistributions: totalDist,
      totalPrincipalPaydown: totalPrincipal,
      totalInterest,
    },
    returnMetrics: {
      leveredIRR: levResult.irr,
      unleveredIRR: unlevResult.irr,
      equityMultiple: em,
      avgCashOnCash: years.length > 0 ? years.reduce((s, y) => s + y.cashOnCash, 0) / years.length : 0,
      avgDSCR: years.length > 0 ? years.reduce((s, y) => s + y.dscr, 0) / years.length : 0,
      avgDebtYield: years.length > 0 ? years.reduce((s, y) => s + y.debtYield, 0) / years.length : 0,
      profitOnCost: totalAcquisitionCost > 0 ? (exitNOI / totalAcquisitionCost) * 100 : 0,
      netPresentValue: npv,
      peakEquity: p.equityInvested,
      paybackPeriod: paybackFound ? paybackYear : p.holdPeriodYears,
    },
  };
}

// ============================================================================
// 6. PE WATERFALL (Full institutional)
// ============================================================================

export interface WaterfallTier {
  hurdleRate: number;           // IRR hurdle as percent (e.g., 8)
  gpSplit: number;              // GP share above hurdle (e.g., 0.20)
  lpSplit: number;              // LP share above hurdle (e.g., 0.80)
  catchUp?: boolean;            // is this a catch-up tier?
  catchUpPct?: number;          // catch-up percentage (e.g., 1.0 = 100% to GP)
}

export interface PEWaterfallResult {
  totalDistributable: number;

  tiers: {
    name: string;
    hurdleRate: number;
    lpDistribution: number;
    gpDistribution: number;
    totalDistribution: number;
    cumulativeLP: number;
    cumulativeGP: number;
    remaining: number;
  }[];

  returnOfCapital: {
    lpCapitalReturned: number;
    gpCapitalReturned: number;
    totalCapitalReturned: number;
  };

  preferredReturn: {
    lpPreferred: number;
    gpPreferred: number;
    totalPreferred: number;
    shortfall: number;
  };

  catchUp: {
    gpCatchUp: number;
    catchUpComplete: boolean;
  };

  carriedInterest: {
    gpCarry: number;
    lpResidual: number;
  };

  summary: {
    totalToLP: number;
    totalToGP: number;
    lpIRR: number;
    gpIRR: number;
    lpMultiple: number;
    gpMultiple: number;
    gpPromoteShare: number;       // total promote as % of profits
    effectiveGPShare: number;     // total GP distributions / total distributions
    clawbackRequired: number;     // if interim distributions exceeded final entitlement
  };
}

export function computePEWaterfall(params: {
  lpEquity: number;
  gpEquity: number;
  totalCashFlows: number[];      // annual cash flows (not including initial investment)
  terminalProceeds: number;
  preferredRate: number;          // annual pref as decimal (e.g., 0.08)
  catchUpPct: number;             // GP catch-up percentage (e.g., 1.0 = 100% to GP until caught up)
  carriedInterestPct: number;     // GP carry above catch-up (e.g., 0.20)
  gpCoinvestPct: number;          // GP co-invest as % of total equity
  holdPeriodYears: number;
  interimDistributions?: number[]; // already distributed per year
}): PEWaterfallResult {
  const p = params;
  const totalEquity = p.lpEquity + p.gpEquity;
  const gpShare = totalEquity > 0 ? p.gpEquity / totalEquity : 0;
  const lpShare = 1 - gpShare;

  const totalCashFlowsSum = p.totalCashFlows.reduce((s, c) => s + c, 0);
  const totalDistributable = totalCashFlowsSum + p.terminalProceeds;
  const interimDist = (p.interimDistributions || []).reduce((s, d) => s + d, 0);

  let remaining = totalDistributable;

  // Tier 1: Return of Capital
  const lpCapitalReturned = Math.min(remaining * lpShare, p.lpEquity);
  const gpCapitalReturned = Math.min(remaining * gpShare, p.gpEquity);
  const totalCapitalReturned = Math.min(remaining, totalEquity);
  remaining -= totalCapitalReturned;

  // Tier 2: Preferred Return
  const compoundedLPPref = p.lpEquity * (Math.pow(1 + p.preferredRate, p.holdPeriodYears) - 1);
  const compoundedGPPref = p.gpEquity * (Math.pow(1 + p.preferredRate, p.holdPeriodYears) - 1);
  const totalPrefDue = compoundedLPPref + compoundedGPPref;

  const lpPrefPaid = Math.min(remaining * (compoundedLPPref / Math.max(totalPrefDue, 1)), compoundedLPPref);
  const gpPrefPaid = Math.min(remaining * (compoundedGPPref / Math.max(totalPrefDue, 1)), compoundedGPPref);
  const totalPrefPaid = Math.min(remaining, totalPrefDue);
  remaining -= totalPrefPaid;
  const prefShortfall = totalPrefDue - totalPrefPaid;

  // Tier 3: GP Catch-Up
  // GP catches up to carried interest % of total profits above pref
  const targetGPShareOfProfits = p.carriedInterestPct;
  const totalProfitsSoFar = totalPrefPaid;
  const gpTargetOfProfits = (totalProfitsSoFar + remaining) * targetGPShareOfProfits;
  const gpAlreadyReceived = gpPrefPaid;
  const catchUpNeeded = Math.max(0, gpTargetOfProfits - gpAlreadyReceived);
  const gpCatchUp = Math.min(remaining * p.catchUpPct, catchUpNeeded, remaining);
  remaining -= gpCatchUp;
  const catchUpComplete = gpCatchUp >= catchUpNeeded;

  // Tier 4: Residual Split (80/20 or per carry %)
  const gpCarry = remaining * p.carriedInterestPct;
  const lpResidual = remaining - gpCarry;
  remaining -= (gpCarry + lpResidual);

  // Totals
  const totalToLP = lpCapitalReturned + lpPrefPaid + lpResidual;
  const totalToGP = gpCapitalReturned + gpPrefPaid + gpCatchUp + gpCarry;
  const totalProfit = totalDistributable - totalEquity;
  const gpPromote = gpPrefPaid + gpCatchUp + gpCarry - (totalProfit * gpShare);

  // Clawback: if interim distributions to GP exceeded entitlement
  const gpInterimDist = interimDist * gpShare;
  const clawbackRequired = Math.max(0, gpInterimDist - totalToGP);

  // LP/GP IRR/Multiple (simplified)
  const lpMultiple = p.lpEquity > 0 ? totalToLP / p.lpEquity : 0;
  const gpMultiple = p.gpEquity > 0 ? totalToGP / p.gpEquity : 0;

  // Build LP/GP cash flows for IRR
  const lpFlows: DatedCashFlow[] = [{ date: '2024-01-01', amount: -p.lpEquity }];
  const gpFlows: DatedCashFlow[] = [{ date: '2024-01-01', amount: -p.gpEquity }];

  for (let y = 1; y <= p.holdPeriodYears; y++) {
    const d = new Date('2024-01-01');
    d.setFullYear(d.getFullYear() + y);
    const dateStr = d.toISOString().split('T')[0];
    const isLast = y === p.holdPeriodYears;

    if (isLast) {
      lpFlows.push({ date: dateStr, amount: totalToLP });
      gpFlows.push({ date: dateStr, amount: totalToGP });
    } else {
      const annualLP = (p.totalCashFlows[y - 1] || 0) * lpShare;
      const annualGP = (p.totalCashFlows[y - 1] || 0) * gpShare;
      lpFlows.push({ date: dateStr, amount: annualLP });
      gpFlows.push({ date: dateStr, amount: annualGP });
    }
  }

  const lpIRRResult = calculateXIRR(lpFlows);
  const gpIRRResult = calculateXIRR(gpFlows);

  const tiers = [
    {
      name: 'Return of Capital',
      hurdleRate: 0,
      lpDistribution: lpCapitalReturned,
      gpDistribution: gpCapitalReturned,
      totalDistribution: totalCapitalReturned,
      cumulativeLP: lpCapitalReturned,
      cumulativeGP: gpCapitalReturned,
      remaining: totalDistributable - totalCapitalReturned,
    },
    {
      name: `Preferred Return (${(p.preferredRate * 100).toFixed(1)}%)`,
      hurdleRate: p.preferredRate * 100,
      lpDistribution: lpPrefPaid,
      gpDistribution: gpPrefPaid,
      totalDistribution: totalPrefPaid,
      cumulativeLP: lpCapitalReturned + lpPrefPaid,
      cumulativeGP: gpCapitalReturned + gpPrefPaid,
      remaining: totalDistributable - totalCapitalReturned - totalPrefPaid,
    },
    {
      name: `GP Catch-Up (${(p.catchUpPct * 100).toFixed(0)}%)`,
      hurdleRate: 0,
      lpDistribution: 0,
      gpDistribution: gpCatchUp,
      totalDistribution: gpCatchUp,
      cumulativeLP: lpCapitalReturned + lpPrefPaid,
      cumulativeGP: gpCapitalReturned + gpPrefPaid + gpCatchUp,
      remaining: totalDistributable - totalCapitalReturned - totalPrefPaid - gpCatchUp,
    },
    {
      name: `Carried Interest (${(p.carriedInterestPct * 100).toFixed(0)}/${((1 - p.carriedInterestPct) * 100).toFixed(0)})`,
      hurdleRate: 0,
      lpDistribution: lpResidual,
      gpDistribution: gpCarry,
      totalDistribution: gpCarry + lpResidual,
      cumulativeLP: totalToLP,
      cumulativeGP: totalToGP,
      remaining: 0,
    },
  ];

  return {
    totalDistributable,
    tiers,
    returnOfCapital: { lpCapitalReturned, gpCapitalReturned, totalCapitalReturned },
    preferredReturn: { lpPreferred: lpPrefPaid, gpPreferred: gpPrefPaid, totalPreferred: totalPrefPaid, shortfall: prefShortfall },
    catchUp: { gpCatchUp, catchUpComplete },
    carriedInterest: { gpCarry, lpResidual },
    summary: {
      totalToLP,
      totalToGP,
      lpIRR: lpIRRResult.irr,
      gpIRR: gpIRRResult.irr,
      lpMultiple,
      gpMultiple,
      gpPromoteShare: totalProfit > 0 ? (gpPromote / totalProfit) * 100 : 0,
      effectiveGPShare: totalDistributable > 0 ? (totalToGP / totalDistributable) * 100 : 0,
      clawbackRequired,
    },
  };
}

// ============================================================================
// 7. FUND METRICS (MOIC, DPI, RVPI, TVPI)
// ============================================================================

export interface FundMetricsResult {
  moic: number;                // Multiple on Invested Capital
  dpi: number;                 // Distributions to Paid-In
  rvpi: number;                // Residual Value to Paid-In
  tvpi: number;                // Total Value to Paid-In (= DPI + RVPI)
  grossIRR: number;
  netIRR: number;
  paidInCapital: number;
  distributedCapital: number;
  residualValue: number;       // NAV of unrealized investments
  totalValue: number;
  managementFees: number;
  carriedInterest: number;

  // J-curve data
  jCurve: {
    quarter: string;
    calledCapital: number;
    cumulativeCalled: number;
    distributions: number;
    cumulativeDistributions: number;
    nav: number;
    tvpi: number;
    irr: number;
    netCashPosition: number;   // cumulative distributions - cumulative called
  }[];

  // Vintage year
  vintageYear: number;
  fundAge: number;             // years

  // Quartile benchmarking data
  benchmarks: {
    metric: string;
    fundValue: number;
    topQuartile: number;
    median: number;
    bottomQuartile: number;
    percentileRank: number;
  }[];
}

export function computeFundMetrics(params: {
  vintageYear: number;
  capitalCommitments: number;
  capitalCalls: { date: string; amount: number }[];
  distributions: { date: string; amount: number }[];
  currentNAV: number;
  managementFeePct: number;
  carryPct: number;
  hurdleRate: number;
}): FundMetricsResult {
  const p = params;
  const paidInCapital = p.capitalCalls.reduce((s, c) => s + c.amount, 0);
  const distributedCapital = p.distributions.reduce((s, d) => s + d.amount, 0);
  const residualValue = p.currentNAV;
  const totalValue = distributedCapital + residualValue;
  const managementFees = paidInCapital * p.managementFeePct * ((new Date().getFullYear() - p.vintageYear) || 1);

  const moic = paidInCapital > 0 ? totalValue / paidInCapital : 0;
  const dpi = paidInCapital > 0 ? distributedCapital / paidInCapital : 0;
  const rvpi = paidInCapital > 0 ? residualValue / paidInCapital : 0;
  const tvpi = dpi + rvpi;

  // Gross IRR from all flows
  const allFlows: DatedCashFlow[] = [
    ...p.capitalCalls.map(c => ({ date: c.date, amount: -c.amount })),
    ...p.distributions.map(d => ({ date: d.date, amount: d.amount })),
  ];

  if (residualValue > 0) {
    allFlows.push({ date: new Date().toISOString().split('T')[0], amount: residualValue });
  }
  allFlows.sort((a, b) => a.date.localeCompare(b.date));

  const grossResult = calculateXIRR(allFlows);

  // Net IRR (after fees/carry)
  const carry = Math.max(0, (totalValue - paidInCapital - (paidInCapital * p.hurdleRate * ((new Date().getFullYear() - p.vintageYear) || 1)))) * p.carryPct;
  const netTotalValue = totalValue - managementFees - carry;
  const netFlows = allFlows.map(f => ({ ...f }));
  if (netFlows.length > 0) {
    const lastIdx = netFlows.length - 1;
    if (netFlows[lastIdx].amount > 0) {
      netFlows[lastIdx] = { ...netFlows[lastIdx], amount: netFlows[lastIdx].amount - managementFees - carry };
    }
  }
  const netResult = calculateXIRR(netFlows);

  // J-Curve: quarterly data
  const jCurve: FundMetricsResult['jCurve'] = [];
  const startYear = p.vintageYear;
  const endYear = new Date().getFullYear();
  let cumCalled = 0, cumDist = 0;

  for (let y = startYear; y <= endYear; y++) {
    for (let q = 1; q <= 4; q++) {
      const qEnd = new Date(y, q * 3, 0);
      if (qEnd > new Date()) break;

      const qStart = new Date(y, (q - 1) * 3, 1);
      const qEndStr = qEnd.toISOString().split('T')[0];
      const qStartStr = qStart.toISOString().split('T')[0];

      const qCalls = p.capitalCalls.filter(c => c.date >= qStartStr && c.date <= qEndStr).reduce((s, c) => s + c.amount, 0);
      const qDist = p.distributions.filter(d => d.date >= qStartStr && d.date <= qEndStr).reduce((s, d) => s + d.amount, 0);

      cumCalled += qCalls;
      cumDist += qDist;

      const qNav = y === endYear && q === Math.ceil((new Date().getMonth() + 1) / 3) ? p.currentNAV : cumCalled * (1 + 0.02 * (y - startYear)); // simplified NAV estimation
      const qTVPI = cumCalled > 0 ? (cumDist + qNav) / cumCalled : 0;

      // IRR for this point in time
      const flowsToDate: DatedCashFlow[] = [
        ...p.capitalCalls.filter(c => c.date <= qEndStr).map(c => ({ date: c.date, amount: -c.amount })),
        ...p.distributions.filter(d => d.date <= qEndStr).map(d => ({ date: d.date, amount: d.amount })),
        { date: qEndStr, amount: qNav },
      ];
      const qIRR = calculateXIRR(flowsToDate);

      jCurve.push({
        quarter: `${y} Q${q}`,
        calledCapital: qCalls,
        cumulativeCalled: cumCalled,
        distributions: qDist,
        cumulativeDistributions: cumDist,
        nav: qNav,
        tvpi: qTVPI,
        irr: qIRR.irr,
        netCashPosition: cumDist - cumCalled,
      });
    }
  }

  // Benchmark quartile data (industry averages for marina/infrastructure PE)
  const fundAge = endYear - startYear;
  const benchmarks = [
    { metric: 'Net IRR', fundValue: netResult.irr, topQuartile: 18, median: 12, bottomQuartile: 7, percentileRank: 0 },
    { metric: 'TVPI', fundValue: tvpi, topQuartile: 2.1, median: 1.6, bottomQuartile: 1.2, percentileRank: 0 },
    { metric: 'DPI', fundValue: dpi, topQuartile: 1.5, median: 1.0, bottomQuartile: 0.5, percentileRank: 0 },
    { metric: 'MOIC', fundValue: moic, topQuartile: 2.3, median: 1.7, bottomQuartile: 1.3, percentileRank: 0 },
  ];

  benchmarks.forEach(b => {
    if (b.fundValue >= b.topQuartile) b.percentileRank = 90;
    else if (b.fundValue >= b.median) b.percentileRank = 50 + 40 * (b.fundValue - b.median) / (b.topQuartile - b.median);
    else if (b.fundValue >= b.bottomQuartile) b.percentileRank = 25 + 25 * (b.fundValue - b.bottomQuartile) / (b.median - b.bottomQuartile);
    else b.percentileRank = 25 * b.fundValue / Math.max(b.bottomQuartile, 0.01);
  });

  return {
    moic,
    dpi,
    rvpi,
    tvpi,
    grossIRR: grossResult.irr,
    netIRR: netResult.irr,
    paidInCapital,
    distributedCapital,
    residualValue,
    totalValue,
    managementFees,
    carriedInterest: carry,
    jCurve,
    vintageYear: p.vintageYear,
    fundAge,
    benchmarks,
  };
}

// ============================================================================
// 8. REPLACEMENT COST ANALYSIS
// ============================================================================

export interface ReplacementCostResult {
  landValue: number;
  siteworkCost: number;
  marinaCost: number;           // docks, pilings, utilities
  buildingsCost: number;
  softCosts: number;            // permits, engineering, legal
  developerProfit: number;
  totalReplacementCost: number;

  costPerSlip: number;
  costPerSF: number;

  acquisitionPrice: number;
  discountToReplacement: number; // (replacement - acquisition) / replacement
  replacementCostMultiple: number; // acquisition / replacement

  components: {
    item: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    notes?: string;
  }[];
}

export function computeReplacementCost(params: {
  acquisitionPrice: number;
  landValue: number;
  totalSlips: number;
  totalDryRacks: number;
  totalSF: number;
  // Cost inputs (per unit)
  floatingDockCostPerLF: number;      // per linear foot
  fixedDockCostPerLF: number;
  pilingCostEach: number;
  numberOfPilings: number;
  electricalPerSlip: number;
  waterPerSlip: number;
  avgSlipLengthFt: number;
  dryRackCostPerRack: number;
  buildingCostPerSF: number;
  totalBuildingSF: number;
  siteworkPct: number;                // % of hard costs
  softCostPct: number;                // % of hard costs
  developerProfitPct: number;         // % of total
}): ReplacementCostResult {
  const p = params;

  // Hard costs
  const totalDockLF = p.totalSlips * p.avgSlipLengthFt * 2; // finger piers both sides
  const dockCost = totalDockLF * ((p.floatingDockCostPerLF + p.fixedDockCostPerLF) / 2);
  const pilingCost = p.numberOfPilings * p.pilingCostEach;
  const electricalCost = p.totalSlips * p.electricalPerSlip;
  const waterCost = p.totalSlips * p.waterPerSlip;
  const dryRackCost = p.totalDryRacks * p.dryRackCostPerRack;
  const marinaCost = dockCost + pilingCost + electricalCost + waterCost + dryRackCost;

  const buildingsCost = p.totalBuildingSF * p.buildingCostPerSF;
  const hardCosts = marinaCost + buildingsCost;

  const siteworkCost = hardCosts * p.siteworkPct;
  const softCosts = hardCosts * p.softCostPct;
  const subtotal = p.landValue + hardCosts + siteworkCost + softCosts;
  const developerProfit = subtotal * p.developerProfitPct;
  const totalReplacementCost = subtotal + developerProfit;

  const totalUnits = p.totalSlips + p.totalDryRacks;

  const components = [
    { item: 'Land', quantity: 1, unitCost: p.landValue, totalCost: p.landValue },
    { item: 'Floating Docks', quantity: totalDockLF, unitCost: p.floatingDockCostPerLF, totalCost: dockCost, notes: 'Linear feet' },
    { item: 'Pilings', quantity: p.numberOfPilings, unitCost: p.pilingCostEach, totalCost: pilingCost },
    { item: 'Electrical (per slip)', quantity: p.totalSlips, unitCost: p.electricalPerSlip, totalCost: electricalCost },
    { item: 'Water (per slip)', quantity: p.totalSlips, unitCost: p.waterPerSlip, totalCost: waterCost },
    { item: 'Dry Storage Racks', quantity: p.totalDryRacks, unitCost: p.dryRackCostPerRack, totalCost: dryRackCost },
    { item: 'Buildings', quantity: p.totalBuildingSF, unitCost: p.buildingCostPerSF, totalCost: buildingsCost, notes: 'SF' },
    { item: 'Sitework', quantity: 1, unitCost: siteworkCost, totalCost: siteworkCost, notes: `${(p.siteworkPct * 100).toFixed(0)}% of hard costs` },
    { item: 'Soft Costs', quantity: 1, unitCost: softCosts, totalCost: softCosts, notes: `${(p.softCostPct * 100).toFixed(0)}% of hard costs` },
    { item: 'Developer Profit', quantity: 1, unitCost: developerProfit, totalCost: developerProfit, notes: `${(p.developerProfitPct * 100).toFixed(0)}%` },
  ];

  return {
    landValue: p.landValue,
    siteworkCost,
    marinaCost,
    buildingsCost,
    softCosts,
    developerProfit,
    totalReplacementCost,
    costPerSlip: totalUnits > 0 ? totalReplacementCost / totalUnits : 0,
    costPerSF: p.totalSF > 0 ? totalReplacementCost / p.totalSF : 0,
    acquisitionPrice: p.acquisitionPrice,
    discountToReplacement: totalReplacementCost > 0 ? ((totalReplacementCost - p.acquisitionPrice) / totalReplacementCost) * 100 : 0,
    replacementCostMultiple: totalReplacementCost > 0 ? p.acquisitionPrice / totalReplacementCost : 0,
    components,
  };
}

// ============================================================================
// 9. DEBT YIELD & LOAN SIZING
// ============================================================================

export interface LoanSizingResult {
  // Sizing by each constraint
  maxLoanByLTV: number;
  maxLoanByDSCR: number;
  maxLoanByDebtYield: number;

  // Binding constraint
  bindingConstraint: 'ltv' | 'dscr' | 'debt_yield';
  maxLoanAmount: number;

  // Metrics at max loan
  impliedLTV: number;
  impliedDSCR: number;
  impliedDebtYield: number;

  // Annual debt service at max loan
  annualDebtService: number;
  monthlyPayment: number;

  // Equity required
  equityRequired: number;
  equityAsPercentOfValue: number;

  // Sensitivity: loan amount at various constraint levels
  sensitivityTable: {
    constraint: string;
    levels: {
      level: number;
      maxLoan: number;
      ltv: number;
      dscr: number;
      debtYield: number;
    }[];
  }[];
}

export function computeLoanSizing(params: {
  propertyValue: number;
  noi: number;
  interestRate: number;           // annual decimal
  amortizationMonths: number;
  maxLTV: number;                 // decimal (e.g., 0.65)
  minDSCR: number;                // e.g., 1.25
  minDebtYield: number;           // decimal (e.g., 0.08)
}): LoanSizingResult {
  const p = params;
  const monthlyRate = p.interestRate / 12;

  function annualDSForLoan(loanAmt: number): number {
    if (p.amortizationMonths <= 0 || monthlyRate <= 0) return loanAmt * p.interestRate;
    const mp = loanAmt * monthlyRate * Math.pow(1 + monthlyRate, p.amortizationMonths) / (Math.pow(1 + monthlyRate, p.amortizationMonths) - 1);
    return mp * 12;
  }

  // LTV constraint
  const maxLoanByLTV = p.propertyValue * p.maxLTV;

  // DSCR constraint: NOI / DS >= minDSCR -> DS <= NOI / minDSCR -> solve for loan
  const maxDSAllowed = p.noi / p.minDSCR;
  // Reverse: DS = loan * (r(1+r)^n / ((1+r)^n - 1)) * 12
  // loan = DS / (r(1+r)^n / ((1+r)^n - 1)) / 12
  const factor = monthlyRate > 0 && p.amortizationMonths > 0
    ? monthlyRate * Math.pow(1 + monthlyRate, p.amortizationMonths) / (Math.pow(1 + monthlyRate, p.amortizationMonths) - 1)
    : monthlyRate || 0.005;
  const maxLoanByDSCR = factor > 0 ? (maxDSAllowed / 12) / factor : 0;

  // Debt yield constraint: NOI / Loan >= minDebtYield -> Loan <= NOI / minDebtYield
  const maxLoanByDebtYield = p.minDebtYield > 0 ? p.noi / p.minDebtYield : Infinity;

  // Binding constraint = minimum
  const maxLoanAmount = Math.min(maxLoanByLTV, maxLoanByDSCR, maxLoanByDebtYield);
  let bindingConstraint: 'ltv' | 'dscr' | 'debt_yield' = 'ltv';
  if (maxLoanAmount === maxLoanByDSCR) bindingConstraint = 'dscr';
  if (maxLoanAmount === maxLoanByDebtYield) bindingConstraint = 'debt_yield';

  const annualDS = annualDSForLoan(maxLoanAmount);

  // Sensitivity tables
  const ltvLevels = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80];
  const dscrLevels = [1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40];
  const dyLevels = [0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.12];

  const sensitivityTable = [
    {
      constraint: 'LTV',
      levels: ltvLevels.map(level => {
        const loan = p.propertyValue * level;
        const ds = annualDSForLoan(loan);
        return {
          level: level * 100,
          maxLoan: loan,
          ltv: level * 100,
          dscr: ds > 0 ? p.noi / ds : 0,
          debtYield: loan > 0 ? (p.noi / loan) * 100 : 0,
        };
      }),
    },
    {
      constraint: 'DSCR',
      levels: dscrLevels.map(level => {
        const maxDS = p.noi / level;
        const loan = factor > 0 ? (maxDS / 12) / factor : 0;
        return {
          level,
          maxLoan: loan,
          ltv: p.propertyValue > 0 ? (loan / p.propertyValue) * 100 : 0,
          dscr: level,
          debtYield: loan > 0 ? (p.noi / loan) * 100 : 0,
        };
      }),
    },
    {
      constraint: 'Debt Yield',
      levels: dyLevels.map(level => {
        const loan = p.noi / level;
        const ds = annualDSForLoan(loan);
        return {
          level: level * 100,
          maxLoan: loan,
          ltv: p.propertyValue > 0 ? (loan / p.propertyValue) * 100 : 0,
          dscr: ds > 0 ? p.noi / ds : 0,
          debtYield: level * 100,
        };
      }),
    },
  ];

  return {
    maxLoanByLTV,
    maxLoanByDSCR,
    maxLoanByDebtYield,
    bindingConstraint,
    maxLoanAmount,
    impliedLTV: p.propertyValue > 0 ? (maxLoanAmount / p.propertyValue) * 100 : 0,
    impliedDSCR: annualDS > 0 ? p.noi / annualDS : 0,
    impliedDebtYield: maxLoanAmount > 0 ? (p.noi / maxLoanAmount) * 100 : 0,
    annualDebtService: annualDS,
    monthlyPayment: annualDS / 12,
    equityRequired: p.propertyValue - maxLoanAmount,
    equityAsPercentOfValue: p.propertyValue > 0 ? ((p.propertyValue - maxLoanAmount) / p.propertyValue) * 100 : 0,
    sensitivityTable,
  };
}

// ============================================================================
// 10. MACRO STRESS TESTS
// ============================================================================

export interface StressScenario {
  name: string;
  description: string;
  assumptions: {
    capRateShift: number;         // bps change (e.g., +150)
    interestRateShift: number;    // bps change (e.g., +300)
    occupancyDrop: number;        // pct points (e.g., -15)
    revenueDecline: number;       // pct decline (e.g., -10)
    expenseIncrease: number;      // pct increase (e.g., +5)
    noiDecline: number;           // pct decline
  };
}

export interface StressTestResult {
  scenarios: {
    name: string;
    description: string;
    stressedNOI: number;
    stressedValue: number;
    stressedDSCR: number;
    stressedDebtYield: number;
    stressedLTV: number;
    stressedIRR: number;
    stressedEM: number;
    noiDeclinePct: number;
    valueLossPct: number;
    equityLoss: number;
    covenantBreach: boolean;
    ltcExceeds100: boolean;
  }[];
  baseCase: {
    noi: number;
    value: number;
    dscr: number;
    ltv: number;
    irr: number;
    em: number;
  };
}

export const PRESET_STRESS_SCENARIOS: StressScenario[] = [
  {
    name: '2008 GFC Replay',
    description: 'Severe recession with credit crunch, cap rate expansion, and occupancy decline',
    assumptions: { capRateShift: 200, interestRateShift: 0, occupancyDrop: -20, revenueDecline: -15, expenseIncrease: 5, noiDecline: -25 },
  },
  {
    name: 'Rising Rates (+300bps)',
    description: 'Aggressive monetary tightening with rate-driven cap rate expansion',
    assumptions: { capRateShift: 150, interestRateShift: 300, occupancyDrop: -5, revenueDecline: -3, expenseIncrease: 3, noiDecline: -8 },
  },
  {
    name: 'Recession (Mild)',
    description: 'Moderate economic slowdown with modest occupancy and revenue impact',
    assumptions: { capRateShift: 75, interestRateShift: -50, occupancyDrop: -10, revenueDecline: -8, expenseIncrease: 2, noiDecline: -12 },
  },
  {
    name: 'Stagflation',
    description: 'Low growth + high inflation: expenses rise faster than revenue',
    assumptions: { capRateShift: 100, interestRateShift: 200, occupancyDrop: -8, revenueDecline: 2, expenseIncrease: 15, noiDecline: -18 },
  },
  {
    name: 'Natural Disaster (Hurricane)',
    description: 'Major storm damage with extended operational disruption',
    assumptions: { capRateShift: 50, interestRateShift: 0, occupancyDrop: -40, revenueDecline: -35, expenseIncrease: 25, noiDecline: -50 },
  },
  {
    name: 'Regulatory/Environmental',
    description: 'New environmental regulations increase costs and limit expansion',
    assumptions: { capRateShift: 50, interestRateShift: 0, occupancyDrop: -5, revenueDecline: -5, expenseIncrease: 20, noiDecline: -15 },
  },
];

export function computeStressTests(params: {
  baseNOI: number;
  purchasePrice: number;
  loanAmount: number;
  interestRate: number;
  amortizationMonths: number;
  exitCapRate: number;
  equityInvested: number;
  holdPeriodYears: number;
  noiGrowthRate: number;
  acquisitionDate: string;
  scenarios?: StressScenario[];
}): StressTestResult {
  const p = params;
  const scenarios = p.scenarios || PRESET_STRESS_SCENARIOS;

  const monthlyRate = p.interestRate / 12;
  const monthlyPayment = p.amortizationMonths > 0
    ? p.loanAmount * monthlyRate * Math.pow(1 + monthlyRate, p.amortizationMonths) / (Math.pow(1 + monthlyRate, p.amortizationMonths) - 1)
    : p.loanAmount * monthlyRate;
  const annualDS = monthlyPayment * 12;

  const baseValue = p.exitCapRate > 0 ? p.baseNOI / p.exitCapRate : 0;
  const baseDSCR = annualDS > 0 ? p.baseNOI / annualDS : 0;
  const baseLTV = baseValue > 0 ? (p.loanAmount / baseValue) * 100 : 0;

  // Base case IRR
  const baseFlows: DatedCashFlow[] = [{ date: p.acquisitionDate, amount: -p.equityInvested }];
  for (let y = 1; y <= p.holdPeriodYears; y++) {
    const d = new Date(p.acquisitionDate);
    d.setFullYear(d.getFullYear() + y);
    const noi = p.baseNOI * Math.pow(1 + p.noiGrowthRate, y - 1);
    const isLast = y === p.holdPeriodYears;
    const exitVal = isLast ? (noi * (1 + p.noiGrowthRate)) / p.exitCapRate : 0;
    baseFlows.push({ date: d.toISOString().split('T')[0], amount: noi - annualDS + (isLast ? exitVal - p.loanAmount * 0.95 : 0) });
  }
  const baseIRR = calculateXIRR(baseFlows);
  const baseEM = calculateEquityMultiple(baseFlows);

  const results = scenarios.map(scenario => {
    const a = scenario.assumptions;
    const stressedNOI = p.baseNOI * (1 + a.noiDecline / 100);
    const stressedCapRate = p.exitCapRate + a.capRateShift / 10000;
    const stressedRate = p.interestRate + a.interestRateShift / 10000;
    const stressedValue = stressedCapRate > 0 ? stressedNOI / stressedCapRate : 0;

    const stressedMonthlyRate = stressedRate / 12;
    const stressedMP = p.amortizationMonths > 0
      ? p.loanAmount * stressedMonthlyRate * Math.pow(1 + stressedMonthlyRate, p.amortizationMonths) / (Math.pow(1 + stressedMonthlyRate, p.amortizationMonths) - 1)
      : p.loanAmount * stressedMonthlyRate;
    const stressedDS = stressedMP * 12;

    const stressedDSCR = stressedDS > 0 ? stressedNOI / stressedDS : 0;
    const stressedLTV = stressedValue > 0 ? (p.loanAmount / stressedValue) * 100 : 0;
    const stressedDY = p.loanAmount > 0 ? (stressedNOI / p.loanAmount) * 100 : 0;

    // Stressed IRR
    const stressFlows: DatedCashFlow[] = [{ date: p.acquisitionDate, amount: -p.equityInvested }];
    for (let y = 1; y <= p.holdPeriodYears; y++) {
      const d = new Date(p.acquisitionDate);
      d.setFullYear(d.getFullYear() + y);
      const noi = stressedNOI * Math.pow(1 + Math.max(p.noiGrowthRate + a.revenueDecline / 100, -0.1), y - 1);
      const isLast = y === p.holdPeriodYears;
      const exitVal = isLast ? noi / stressedCapRate : 0;
      stressFlows.push({ date: d.toISOString().split('T')[0], amount: noi - stressedDS + (isLast ? exitVal - p.loanAmount * 0.9 : 0) });
    }
    const stressIRR = calculateXIRR(stressFlows);
    const stressEM = calculateEquityMultiple(stressFlows);

    return {
      name: scenario.name,
      description: scenario.description,
      stressedNOI,
      stressedValue,
      stressedDSCR,
      stressedDebtYield: stressedDY,
      stressedLTV,
      stressedIRR: stressIRR.irr,
      stressedEM: stressEM,
      noiDeclinePct: p.baseNOI > 0 ? ((stressedNOI - p.baseNOI) / p.baseNOI) * 100 : 0,
      valueLossPct: baseValue > 0 ? ((stressedValue - baseValue) / baseValue) * 100 : 0,
      equityLoss: Math.max(0, p.equityInvested - (stressedValue - p.loanAmount)),
      covenantBreach: stressedDSCR < 1.0,
      ltcExceeds100: stressedLTV > 100,
    };
  });

  return {
    scenarios: results,
    baseCase: {
      noi: p.baseNOI,
      value: baseValue,
      dscr: baseDSCR,
      ltv: baseLTV,
      irr: baseIRR.irr,
      em: baseEM,
    },
  };
}

// ============================================================================
// 11. DEPRECIATION SCHEDULE
// ============================================================================

export interface DepreciationResult {
  schedules: {
    assetClass: string;
    basisAmount: number;
    method: 'straight_line' | 'macrs';
    lifetimeYears: number;
    annualDepreciation: number[];
    cumulativeDepreciation: number[];
    remainingBasis: number[];
  }[];

  totalBasis: number;
  landValue: number;            // non-depreciable
  depreciableBasis: number;

  annualTotalDepreciation: number[];
  cumulativeTotalDepreciation: number[];

  taxShieldPerYear: number[];   // depreciation * tax rate
  totalTaxShield: number;

  // For 1031
  adjustedBasis: number;        // original basis - accumulated depreciation
  deferredGain: number;         // FMV - adjusted basis
  depreciationRecapture: number;
  capitalGain: number;
}

export function computeDepreciation(params: {
  purchasePrice: number;
  landValue: number;
  improvementAllocations: { assetClass: string; amount: number; lifetimeYears: number; method: 'straight_line' | 'macrs' }[];
  holdPeriodYears: number;
  taxRate: number;
  exitValue: number;
}): DepreciationResult {
  const p = params;
  const depreciableBasis = p.purchasePrice - p.landValue;

  const schedules = p.improvementAllocations.map(alloc => {
    const annual: number[] = [];
    const cumulative: number[] = [];
    const remaining: number[] = [];
    let cum = 0;

    for (let y = 1; y <= p.holdPeriodYears; y++) {
      let dep = 0;
      if (alloc.method === 'straight_line') {
        dep = y <= alloc.lifetimeYears ? alloc.amount / alloc.lifetimeYears : 0;
      } else {
        // Simplified MACRS (200% declining balance switching to SL)
        const rate = 2 / alloc.lifetimeYears;
        const remainingBasis = alloc.amount - cum;
        const slRate = remainingBasis / Math.max(alloc.lifetimeYears - y + 1, 1);
        dep = Math.min(Math.max(remainingBasis * rate, slRate), remainingBasis);
      }
      cum += dep;
      annual.push(dep);
      cumulative.push(cum);
      remaining.push(alloc.amount - cum);
    }

    return {
      assetClass: alloc.assetClass,
      basisAmount: alloc.amount,
      method: alloc.method,
      lifetimeYears: alloc.lifetimeYears,
      annualDepreciation: annual,
      cumulativeDepreciation: cumulative,
      remainingBasis: remaining,
    };
  });

  // Totals by year
  const annualTotal: number[] = [];
  const cumulativeTotal: number[] = [];
  const taxShield: number[] = [];

  for (let y = 0; y < p.holdPeriodYears; y++) {
    const yearDep = schedules.reduce((s, sch) => s + (sch.annualDepreciation[y] || 0), 0);
    annualTotal.push(yearDep);
    cumulativeTotal.push((cumulativeTotal[y - 1] || 0) + yearDep);
    taxShield.push(yearDep * p.taxRate);
  }

  const totalAccumDep = cumulativeTotal[cumulativeTotal.length - 1] || 0;
  const adjustedBasis = p.purchasePrice - totalAccumDep;
  const totalGain = p.exitValue - adjustedBasis;
  const depRecapture = Math.min(totalAccumDep, totalGain);
  const capitalGain = Math.max(0, totalGain - depRecapture);

  return {
    schedules,
    totalBasis: p.purchasePrice,
    landValue: p.landValue,
    depreciableBasis,
    annualTotalDepreciation: annualTotal,
    cumulativeTotalDepreciation: cumulativeTotal,
    taxShieldPerYear: taxShield,
    totalTaxShield: taxShield.reduce((s, t) => s + t, 0),
    adjustedBasis,
    deferredGain: totalGain,
    depreciationRecapture: depRecapture,
    capitalGain,
  };
}

// ============================================================================
// 12. COMP ADJUSTMENT GRID
// ============================================================================

export interface CompAdjustment {
  factor: string;               // e.g., "Location", "Size", "Condition"
  adjustmentType: 'dollar' | 'percentage';
  adjustment: number;           // positive = subject superior, negative = subject inferior
  notes?: string;
}

export interface CompAdjustmentGridResult {
  subject: {
    name: string;
    indicators: Record<string, any>;
  };
  comps: {
    compId: string;
    name: string;
    salePrice: number;
    pricePerUnit: number;
    adjustments: CompAdjustment[];
    totalDollarAdj: number;
    totalPctAdj: number;
    adjustedPrice: number;
    adjustedPricePerUnit: number;
    weight: number;
  }[];

  indicatedValue: number;
  indicatedValuePerUnit: number;
  range: { low: number; high: number };
  confidenceLevel: 'high' | 'medium' | 'low';
  totalAdjustmentRange: number;   // max adj - min adj
  avgGrossAdjustment: number;
}

export function computeCompAdjustmentGrid(params: {
  subjectName: string;
  subjectIndicators: Record<string, any>;
  subjectUnits: number;
  comps: {
    compId: string;
    name: string;
    salePrice: number;
    units: number;
    adjustments: CompAdjustment[];
    weight: number;
  }[];
}): CompAdjustmentGridResult {
  const p = params;

  const adjustedComps = p.comps.map(comp => {
    let adjustedPrice = comp.salePrice;
    let totalDollarAdj = 0;
    let totalPctAdj = 0;

    comp.adjustments.forEach(adj => {
      if (adj.adjustmentType === 'dollar') {
        adjustedPrice += adj.adjustment;
        totalDollarAdj += adj.adjustment;
      } else {
        const pctAdj = adjustedPrice * (adj.adjustment / 100);
        adjustedPrice += pctAdj;
        totalPctAdj += adj.adjustment;
      }
    });

    return {
      compId: comp.compId,
      name: comp.name,
      salePrice: comp.salePrice,
      pricePerUnit: comp.units > 0 ? comp.salePrice / comp.units : 0,
      adjustments: comp.adjustments,
      totalDollarAdj,
      totalPctAdj,
      adjustedPrice,
      adjustedPricePerUnit: p.subjectUnits > 0 ? adjustedPrice / p.subjectUnits : 0,
      weight: comp.weight,
    };
  });

  // Weighted indicated value
  const totalWeight = adjustedComps.reduce((s, c) => s + c.weight, 0);
  const indicatedValue = totalWeight > 0
    ? adjustedComps.reduce((s, c) => s + c.adjustedPrice * c.weight, 0) / totalWeight
    : 0;

  const prices = adjustedComps.map(c => c.adjustedPrice);
  const range = { low: Math.min(...prices), high: Math.max(...prices) };

  const avgGross = adjustedComps.reduce((s, c) => s + Math.abs(c.totalDollarAdj) + Math.abs(c.totalPctAdj), 0) / adjustedComps.length;
  const adjRange = range.high - range.low;
  const confidenceLevel = avgGross < 15 ? 'high' : avgGross < 30 ? 'medium' : 'low';

  return {
    subject: { name: p.subjectName, indicators: p.subjectIndicators },
    comps: adjustedComps,
    indicatedValue,
    indicatedValuePerUnit: p.subjectUnits > 0 ? indicatedValue / p.subjectUnits : 0,
    range,
    confidenceLevel,
    totalAdjustmentRange: adjRange,
    avgGrossAdjustment: avgGross,
  };
}

// ============================================================================
// 13. OPERATOR BENCHMARKING
// ============================================================================

export interface OperatorBenchmarkResult {
  subject: {
    name: string;
    metrics: Record<string, number>;
  };
  peerGroup: {
    count: number;
    avgMetrics: Record<string, number>;
    medianMetrics: Record<string, number>;
    topQuartile: Record<string, number>;
    bottomQuartile: Record<string, number>;
  };
  rankings: {
    metric: string;
    subjectValue: number;
    peerAvg: number;
    peerMedian: number;
    percentileRank: number;
    status: 'outperforming' | 'in_line' | 'underperforming';
    opportunityValue: number;    // $ impact if moved to median
  }[];
  totalOpportunity: number;      // total $ if all metrics at median
}

export function computeOperatorBenchmark(params: {
  subjectName: string;
  subjectMetrics: Record<string, number>;
  peerMetrics: Record<string, number>[]; // array of peer operator metrics
  revenue: number;
  higherIsBetter: Record<string, boolean>; // for each metric, true if higher = better
}): OperatorBenchmarkResult {
  const p = params;
  const metricKeys = Object.keys(p.subjectMetrics);

  const avgMetrics: Record<string, number> = {};
  const medianMetrics: Record<string, number> = {};
  const topQ: Record<string, number> = {};
  const bottomQ: Record<string, number> = {};

  metricKeys.forEach(key => {
    const values = p.peerMetrics.map(pm => pm[key] || 0).sort((a, b) => a - b);
    const n = values.length;
    avgMetrics[key] = n > 0 ? values.reduce((s, v) => s + v, 0) / n : 0;
    medianMetrics[key] = n > 0 ? values[Math.floor(n / 2)] : 0;
    topQ[key] = n > 0 ? values[Math.floor(n * 0.75)] : 0;
    bottomQ[key] = n > 0 ? values[Math.floor(n * 0.25)] : 0;
  });

  let totalOpportunity = 0;
  const rankings = metricKeys.map(key => {
    const subjectValue = p.subjectMetrics[key] || 0;
    const values = p.peerMetrics.map(pm => pm[key] || 0).sort((a, b) => a - b);
    const n = values.length;
    const rank = values.filter(v => v <= subjectValue).length;
    let percentileRank = n > 0 ? (rank / n) * 100 : 50;

    const hib = p.higherIsBetter[key] ?? true;
    if (!hib) percentileRank = 100 - percentileRank;

    const status: 'outperforming' | 'in_line' | 'underperforming' =
      percentileRank >= 75 ? 'outperforming' : percentileRank >= 40 ? 'in_line' : 'underperforming';

    // Opportunity: impact of moving to median (as % of revenue applied)
    const delta = hib ? medianMetrics[key] - subjectValue : subjectValue - medianMetrics[key];
    const opportunity = delta > 0 ? delta * p.revenue / 100 : 0;
    totalOpportunity += opportunity;

    return {
      metric: key,
      subjectValue,
      peerAvg: avgMetrics[key],
      peerMedian: medianMetrics[key],
      percentileRank,
      status,
      opportunityValue: opportunity,
    };
  });

  return {
    subject: { name: p.subjectName, metrics: p.subjectMetrics },
    peerGroup: { count: p.peerMetrics.length, avgMetrics, medianMetrics, topQuartile: topQ, bottomQuartile: bottomQ },
    rankings,
    totalOpportunity,
  };
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const institutionalAnalysisService = {
  computeReturnDecomposition,
  computeMarkToMarket,
  computeCapExBudget,
  computeStabilizedNOI,
  computeHoldPeriodCF,
  computePEWaterfall,
  computeFundMetrics,
  computeReplacementCost,
  computeLoanSizing,
  computeStressTests,
  computeDepreciation,
  computeCompAdjustmentGrid,
  computeOperatorBenchmark,
  PRESET_STRESS_SCENARIOS,
};
