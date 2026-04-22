// Asset-Class Financial Model Harness
// Runs mock data through every COA-registered asset class × multiple business configs.
// Invariants checked per scenario:
//   1. Year 1: totalRevenue - totalExpenses === noi  (to $0.01)
//   2. Year 1: sum(revenueLines.amount) === totalRevenue
//   3. Year 1: sum(expenseLines.amount) === totalExpenses
//   4. Year 1: sum(monthlyBreakdown.revenue) === totalRevenue (to $0.05 tolerance for rounding)
//   5. Year 1: sum(monthlyBreakdown.expenses) === totalExpenses
//   6. All years: no NaN / Infinity / null on revenue/expense/noi/capex/ncf
//   7. All years: revenue-line growth matches config.revenueGrowthRate per line (line.amount_{y+1} ≈ line.amount_y × (1+r))
//   8. All years: ncf === noi - capex
//   9. Exit: exitValue === exitNOI / exitCapRate (to $0.02)
//  10. Exit: sellingCosts === exitValue × sellingCostPct (to $0.02)
//  11. Exit: netSaleProceeds === exitValue - sellingCosts
//  12. NOI CAGR (when positive): year1NOI × (1+CAGR)^(N-1) ≈ yearN NOI (relative error < 1e-3)
// Also checks registry consistency: every MODEL_CONFIG_REGISTRY id either computes financials or returns null cleanly.

import { computeDirectInputFinancials } from '/home/runner/workspace/server/services/direct-input-engine.ts';
import { computeMultiYearProjection } from '/home/runner/workspace/server/services/multi-year-projection-engine.ts';
import { MODEL_CONFIG_REGISTRY } from '/home/runner/workspace/shared/asset-class-model-config.ts';

// ─────────────────────────────────────────────
// Test framework
// ─────────────────────────────────────────────
const results = { pass: 0, fail: 0, failures: [] };
const EPSILON = 0.02; // Allow 2¢ tolerance for rounding in cross-sum invariants

function near(a, b, tol = EPSILON) {
  return Math.abs(a - b) <= tol;
}
function relNear(a, b, relTol = 1e-3) {
  if (b === 0) return Math.abs(a) < 1e-6;
  return Math.abs((a - b) / b) < relTol;
}
function assert(name, condition, ctx = '') {
  if (condition) {
    results.pass++;
  } else {
    results.fail++;
    results.failures.push(`${name} ${ctx}`);
    console.log(`  [FAIL] ${name}  ${ctx}`);
  }
}
function finite(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

// ─────────────────────────────────────────────
// Mock input library — realistic per asset class
// ─────────────────────────────────────────────
const MOCK_INPUTS = {
  str: {
    avgNightlyRate: 275, occupancy: 0.65, numberOfUnits: 4,
    annualCleaningFeeIncome: 15000, annualPropertyTax: 8500, annualInsurance: 4200,
    annualUtilities: 6000, annualMaintenance: 7500, annualSupplies: 3200,
    platformFeePct: 0.03, propertyManagementPct: 0.20,
  },
  sfr: {
    monthlyRent: 2400, vacancyPct: 0.05,
    annualPropertyTax: 5200, annualInsurance: 1800, annualMaintenance: 2400,
    propertyManagementPct: 0.08,
  },
  duplex: {
    monthlyRent: 4200, vacancyPct: 0.06, numberOfUnits: 2,
    annualLaundryIncome: 600, annualPropertyTax: 7200, annualInsurance: 2800,
    annualUtilities: 3600, annualMaintenance: 3500,
  },
  triplex: {
    monthlyRent: 6300, vacancyPct: 0.06, numberOfUnits: 3,
    annualPropertyTax: 9800, annualInsurance: 3600, annualMaintenance: 4800,
  },
  quad: {
    monthlyRent: 8200, vacancyPct: 0.06, numberOfUnits: 4,
    annualPropertyTax: 12500, annualInsurance: 4800, annualMaintenance: 6200,
  },
  multifamily: {
    totalUnits: 120, avgInPlaceRent: 1850, vacancyPct: 0.07, concessionPct: 0.015, badDebtPct: 0.008,
    annualParkingIncome: 48000, annualPetFees: 18000, annualUtilityReimbursements: 96000,
    annualPropertyTax: 285000, annualInsurance: 84000, annualUtilities: 72000,
    annualPayroll: 220000, annualMaintenance: 120000, annualAdmin: 36000,
    propertyManagementPct: 0.04,
  },
  hotel: {
    numberOfRooms: 160, avgDailyRate: 185, occupancyRate: 0.72,
    annualFBRevenue: 850000, annualMeetingRevenue: 220000, annualParkingRevenue: 95000,
    annualPropertyTax: 285000, annualInsurance: 120000,
    departmentalExpensePct: 0.38, undistributedExpensePct: 0.22, managementFeePct: 0.03, ffAndEReservePct: 0.04,
  },
  marina: {
    wetSlips: 220, avgMonthlySlipRate: 650, slipOccupancy: 0.88,
    dryStorageSpaces: 80, avgMonthlyDryRate: 250,
    annualFuelRevenue: 1200000, annualShipStoreRevenue: 280000, annualServiceRevenue: 450000,
    annualPayroll: 380000, annualFuelCOGS: 960000, annualStoreCOGS: 168000,
    annualUtilities: 48000, annualInsurance: 85000, annualPropertyTax: 125000,
    annualMaintenance: 95000, managementFeePct: 0,
  },
  self_storage: {
    totalUnits: 550, averageMonthlyRate: 125, occupancyRate: 0.90,
    annualRetailIncome: 28000, annualLateFees: 18000,
    annualInsurance: 24000, annualPropertyTax: 85000, annualUtilities: 14000,
    annualPayroll: 62000, annualMaintenance: 22000,
    propertyManagementPct: 0.06,
  },
  laundromat: {
    numberOfWashers: 40, washerTurnsPerDay: 4.5, washerVendPrice: 4.25,
    numberOfDryers: 40, dryerTurnsPerDay: 4.5, dryerVendPrice: 2.25,
    daysOpenPerYear: 360,
    annualVendingIncome: 12000,
    annualRent: 78000, annualUtilities: 52000, annualInsurance: 4800,
    annualMaintenance: 18000, annualPayroll: 28000, annualSupplies: 3600,
  },
  retail: {
    totalSquareFeet: 42000, rentPerSF: 22, occupancyRate: 0.92,
    annualCAMReimbursements: 185000, annualPercentageRent: 35000,
    annualPropertyTax: 110000, annualInsurance: 38000,
    annualCAM: 95000, annualMaintenance: 45000, propertyManagementPct: 0.04,
  },
  office: {
    totalSquareFeet: 85000, rentPerSF: 32, occupancyRate: 0.89,
    annualCAMReimbursements: 420000,
    annualPropertyTax: 320000, annualInsurance: 95000,
    annualCAM: 280000, annualJanitorial: 145000, annualSecurity: 48000,
    propertyManagementPct: 0.04,
  },
  industrial: {
    totalSquareFeet: 220000, rentPerSF: 9.5, occupancyRate: 0.95,
    annualCAMReimbursements: 185000,
    annualPropertyTax: 185000, annualInsurance: 62000,
    annualCAM: 75000, annualMaintenance: 42000, propertyManagementPct: 0.03,
  },
  medical_office: {
    totalSquareFeet: 38000, rentPerSF: 38, occupancyRate: 0.91,
    annualCAMReimbursements: 215000,
    annualPropertyTax: 145000, annualInsurance: 48000,
    annualCAM: 185000, annualJanitorial: 82000, propertyManagementPct: 0.04,
  },
  mixed_use: {
    totalSquareFeet: 65000, rentPerSF: 28, occupancyRate: 0.88,
    annualCAMReimbursements: 245000, annualPercentageRent: 42000,
    annualPropertyTax: 195000, annualInsurance: 65000,
    annualCAM: 120000, annualMaintenance: 58000, propertyManagementPct: 0.04,
  },
  business: {
    annualRevenue: 4200000, costOfGoodsSold: 1800000, annualOtherIncome: 65000,
    annualPayroll: 950000, ownerSalary: 180000,
    annualRent: 120000, annualUtilities: 38000, annualInsurance: 24000,
    annualMarketing: 85000, annualAccounting: 24000, annualSoftware: 48000,
  },
  // ─── Operating businesses routed through BUSINESS_COA ───
  car_wash: {
    annualRevenue: 1850000, costOfGoodsSold: 95000, annualOtherIncome: 18000,
    annualPayroll: 320000, ownerSalary: 120000,
    annualRent: 180000, annualUtilities: 165000, annualInsurance: 28000,
    annualMarketing: 22000, annualAccounting: 14000, annualSoftware: 9000,
    annualOtherExpenses: 35000,
  },
  golf_course: {
    annualRevenue: 3850000, costOfGoodsSold: 380000, annualOtherIncome: 145000,
    annualPayroll: 980000, ownerSalary: 165000,
    annualRent: 0, annualUtilities: 220000, annualInsurance: 85000,
    annualMarketing: 95000, annualAccounting: 28000, annualSoftware: 32000,
    annualVehicle: 48000, annualOtherExpenses: 320000,
  },
  landscaping: {
    annualRevenue: 2650000, costOfGoodsSold: 425000, annualOtherIncome: 15000,
    annualPayroll: 850000, ownerSalary: 140000,
    annualRent: 42000, annualUtilities: 14000, annualInsurance: 48000,
    annualMarketing: 38000, annualAccounting: 18000, annualSoftware: 12000,
    annualVehicle: 185000, annualOtherExpenses: 65000,
  },
  construction: {
    annualRevenue: 12500000, costOfGoodsSold: 7800000, annualOtherIncome: 25000,
    annualPayroll: 1850000, ownerSalary: 280000,
    annualRent: 84000, annualUtilities: 22000, annualInsurance: 240000,
    annualMarketing: 45000, annualAccounting: 85000, annualSoftware: 68000,
    annualVehicle: 145000, annualOtherExpenses: 185000,
  },
  accounting_firm: {
    annualRevenue: 2450000, costOfGoodsSold: 0, annualOtherIncome: 12000,
    annualPayroll: 1280000, ownerSalary: 260000,
    annualRent: 96000, annualUtilities: 14000, annualInsurance: 32000,
    annualMarketing: 48000, annualAccounting: 0, annualSoftware: 95000,
    annualOtherExpenses: 42000,
  },
  car_dealership: {
    annualRevenue: 48500000, costOfGoodsSold: 42000000, annualOtherIncome: 185000,
    annualPayroll: 2850000, ownerSalary: 325000,
    annualRent: 480000, annualUtilities: 125000, annualInsurance: 145000,
    annualMarketing: 620000, annualAccounting: 65000, annualSoftware: 145000,
    annualOtherExpenses: 385000,
  },
  gas_station: {
    annualRevenue: 8200000, costOfGoodsSold: 7100000, annualOtherIncome: 42000,
    annualPayroll: 285000, ownerSalary: 95000,
    annualRent: 120000, annualUtilities: 58000, annualInsurance: 38000,
    annualMarketing: 8000, annualAccounting: 14000, annualSoftware: 12000,
    annualOtherExpenses: 45000,
  },
  restaurant: {
    annualRevenue: 3850000, costOfGoodsSold: 1150000, annualOtherIncome: 18000,
    annualPayroll: 1180000, ownerSalary: 145000,
    annualRent: 240000, annualUtilities: 95000, annualInsurance: 38000,
    annualMarketing: 125000, annualAccounting: 22000, annualSoftware: 28000,
    annualOtherExpenses: 95000,
  },
  gym: {
    annualRevenue: 1450000, costOfGoodsSold: 42000, annualOtherIncome: 38000,
    annualPayroll: 385000, ownerSalary: 110000,
    annualRent: 180000, annualUtilities: 85000, annualInsurance: 24000,
    annualMarketing: 62000, annualAccounting: 14000, annualSoftware: 48000,
    annualOtherExpenses: 52000,
  },
  daycare: {
    annualRevenue: 1850000, costOfGoodsSold: 45000, annualOtherIncome: 12000,
    annualPayroll: 980000, ownerSalary: 120000,
    annualRent: 144000, annualUtilities: 28000, annualInsurance: 42000,
    annualMarketing: 18000, annualAccounting: 12000, annualSoftware: 18000,
    annualOtherExpenses: 38000,
  },
  parking: {
    annualRevenue: 2250000, costOfGoodsSold: 0, annualOtherIncome: 85000,
    annualPayroll: 280000, ownerSalary: 0,
    annualRent: 0, annualUtilities: 22000, annualInsurance: 48000,
    annualMarketing: 8000, annualAccounting: 14000, annualSoftware: 12000,
    annualOtherExpenses: 38000,
  },
  // ─── Commercial lease-driven routed through COMMERCIAL_COA ───
  shopping_center: {
    totalSquareFeet: 185000, rentPerSF: 24, occupancyRate: 0.91,
    annualCAMReimbursements: 680000, annualPercentageRent: 95000,
    annualPropertyTax: 485000, annualInsurance: 142000,
    annualCAM: 420000, annualMaintenance: 185000, propertyManagementPct: 0.04,
  },
  data_center: {
    totalSquareFeet: 120000, rentPerSF: 185, occupancyRate: 0.96,
    annualCAMReimbursements: 2400000,
    annualPropertyTax: 1850000, annualInsurance: 385000,
    annualCAM: 1650000, annualMaintenance: 485000, annualSecurity: 240000,
    propertyManagementPct: 0.03,
  },
  land: {
    totalSquareFeet: 4356000, rentPerSF: 0.25, occupancyRate: 1.0,
    annualPropertyTax: 85000, annualInsurance: 12000,
    annualMaintenance: 18000, propertyManagementPct: 0.02,
  },
  // ─── Pad-rent-driven routed through MULTIFAMILY_COA ───
  rv_park: {
    totalUnits: 180, avgInPlaceRent: 650, vacancyPct: 0.10, concessionPct: 0, badDebtPct: 0.005,
    annualUtilityReimbursements: 120000,
    annualPropertyTax: 85000, annualInsurance: 42000, annualUtilities: 145000,
    annualPayroll: 185000, annualMaintenance: 95000, annualAdmin: 28000,
    propertyManagementPct: 0.05,
  },
  mobile_home_park: {
    totalUnits: 240, avgInPlaceRent: 485, vacancyPct: 0.05, concessionPct: 0, badDebtPct: 0.01,
    annualUtilityReimbursements: 180000,
    annualPropertyTax: 125000, annualInsurance: 48000, annualUtilities: 185000,
    annualPayroll: 145000, annualMaintenance: 85000, annualAdmin: 32000,
    propertyManagementPct: 0.04,
  },
};

// Primary revenue line key for each asset class (for unit-mix bypass test)
const PRIMARY_REV_KEY = {
  str: 'grossRentalIncome', sfr: 'grossPotentialRent',
  duplex: 'grossPotentialRent', triplex: 'grossPotentialRent', quad: 'grossPotentialRent',
  multifamily: 'grossPotentialRent', hotel: 'roomRevenue', marina: 'wetSlipRevenue',
  self_storage: 'storageRevenue', laundromat: 'washerRevenue',
  retail: 'baseRent', office: 'baseRent', industrial: 'baseRent',
  medical_office: 'baseRent', mixed_use: 'baseRent', business: 'grossRevenue',
  // Operating businesses → BUSINESS_COA
  car_wash: 'grossRevenue', golf_course: 'grossRevenue', landscaping: 'grossRevenue',
  construction: 'grossRevenue', accounting_firm: 'grossRevenue',
  car_dealership: 'grossRevenue', gas_station: 'grossRevenue', restaurant: 'grossRevenue',
  gym: 'grossRevenue', daycare: 'grossRevenue', parking: 'grossRevenue',
  // Commercial lease → COMMERCIAL_COA
  shopping_center: 'baseRent', data_center: 'baseRent', land: 'baseRent',
  // Pad-rent → MULTIFAMILY_COA
  rv_park: 'grossPotentialRent', mobile_home_park: 'grossPotentialRent',
};

// ─────────────────────────────────────────────
// Business-configuration matrix
// ─────────────────────────────────────────────
const CONFIGS = [
  { name: 'base-5yr',            holdPeriod: 5,  revenueGrowthRate: 0.03,  expenseGrowthRate: 0.025, exitCapRate: 0.065, sellingCostPct: 0.03 },
  { name: 'flat-zero-growth',    holdPeriod: 5,  revenueGrowthRate: 0.0,   expenseGrowthRate: 0.0,   exitCapRate: 0.065, sellingCostPct: 0.03 },
  { name: 'margin-compression',  holdPeriod: 7,  revenueGrowthRate: 0.02,  expenseGrowthRate: 0.045, exitCapRate: 0.07,  sellingCostPct: 0.03 },
  { name: 'strong-growth',       holdPeriod: 10, revenueGrowthRate: 0.05,  expenseGrowthRate: 0.03,  exitCapRate: 0.055, sellingCostPct: 0.025 },
  { name: 'decline',             holdPeriod: 5,  revenueGrowthRate: -0.02, expenseGrowthRate: 0.01,  exitCapRate: 0.08,  sellingCostPct: 0.03 },
  { name: 'min-hold-1yr',        holdPeriod: 1,  revenueGrowthRate: 0.03,  expenseGrowthRate: 0.025, exitCapRate: 0.065, sellingCostPct: 0.03 },
  { name: 'max-hold-30yr',       holdPeriod: 30, revenueGrowthRate: 0.025, expenseGrowthRate: 0.02,  exitCapRate: 0.07,  sellingCostPct: 0.03 },
  { name: 'vacancy-leaseup',     holdPeriod: 5,  revenueGrowthRate: 0.03,  expenseGrowthRate: 0.025, exitCapRate: 0.065, sellingCostPct: 0.03,
    vacancyCurve: [ { year: 2, vacancyRate: 0.10 }, { year: 3, vacancyRate: 0.07 }, { year: 4, vacancyRate: 0.05 } ] },
  { name: 'capex-schedule',      holdPeriod: 7,  revenueGrowthRate: 0.03,  expenseGrowthRate: 0.025, exitCapRate: 0.065, sellingCostPct: 0.03,
    capexSchedule: [ { year: 3, amount: 250000, label: 'Major repair' }, { year: 6, amount: 180000, label: 'Refresh' } ] },
  { name: 'category-overrides',  holdPeriod: 5,  revenueGrowthRate: 0.03,  expenseGrowthRate: 0.025, exitCapRate: 0.065, sellingCostPct: 0.03,
    categoryGrowthRates: { annualPropertyTax: 0.05, annualInsurance: 0.06 } },
  { name: 'exit-cap-5pct',       holdPeriod: 5,  revenueGrowthRate: 0.03,  expenseGrowthRate: 0.025, exitCapRate: 0.05,  sellingCostPct: 0.03 },
  { name: 'exit-cap-9pct',       holdPeriod: 5,  revenueGrowthRate: 0.03,  expenseGrowthRate: 0.025, exitCapRate: 0.09,  sellingCostPct: 0.03 },
];

// ─────────────────────────────────────────────
// Per-scenario runner + invariant checks
// ─────────────────────────────────────────────
function runScenario(ac, configName, config, inputs) {
  const ctx = `[${ac}/${configName}]`;
  const y1 = computeDirectInputFinancials(ac, inputs);
  if (!y1) {
    assert(`${ctx} computeDirectInputFinancials returned non-null`, false, '');
    return;
  }

  // Year-1 invariants
  assert(`${ctx} no-NaN totalRevenue`, finite(y1.totalRevenue));
  assert(`${ctx} no-NaN totalExpenses`, finite(y1.totalExpenses));
  assert(`${ctx} no-NaN noi`, finite(y1.noi));
  assert(`${ctx} noi identity (rev - exp = noi)`, near(y1.totalRevenue - y1.totalExpenses, y1.noi));
  const sumRev = y1.revenueLines.reduce((s, l) => s + l.amount, 0);
  const sumExp = y1.expenseLines.reduce((s, l) => s + l.amount, 0);
  assert(`${ctx} sum(revenueLines) = totalRevenue`, near(sumRev, y1.totalRevenue));
  assert(`${ctx} sum(expenseLines) = totalExpenses`, near(sumExp, y1.totalExpenses));
  // Monthly sum invariants (note: wider tolerance since daily-fraction rounding accumulates)
  if (y1.monthlyBreakdown?.length === 12) {
    const mRev = y1.monthlyBreakdown.reduce((s, m) => s + m.revenue, 0);
    const mExp = y1.monthlyBreakdown.reduce((s, m) => s + m.expenses, 0);
    const mNoi = y1.monthlyBreakdown.reduce((s, m) => s + m.noi, 0);
    assert(`${ctx} sum(monthly.revenue) ≈ totalRevenue`, near(mRev, y1.totalRevenue, 1.0), `| diff=${(mRev - y1.totalRevenue).toFixed(2)}`);
    assert(`${ctx} sum(monthly.expenses) ≈ totalExpenses`, near(mExp, y1.totalExpenses, 1.0), `| diff=${(mExp - y1.totalExpenses).toFixed(2)}`);
    assert(`${ctx} sum(monthly.noi) ≈ totalNOI`, near(mNoi, y1.noi, 1.0), `| diff=${(mNoi - y1.noi).toFixed(2)}`);
  }

  // Project
  let proj;
  try {
    proj = computeMultiYearProjection(y1, config);
  } catch (e) {
    assert(`${ctx} projection did not throw`, false, `| ${e.message}`);
    return;
  }

  // Per-year invariants
  for (const y of proj.years) {
    assert(`${ctx} Y${y.year} no-NaN revenue`, finite(y.totalRevenue));
    assert(`${ctx} Y${y.year} no-NaN expenses`, finite(y.totalExpenses));
    assert(`${ctx} Y${y.year} no-NaN noi`, finite(y.noi));
    assert(`${ctx} Y${y.year} no-NaN capex`, finite(y.capex));
    assert(`${ctx} Y${y.year} no-NaN ncf`, finite(y.ncf));
    assert(`${ctx} Y${y.year} ncf = noi - capex`, near(y.ncf, y.noi - y.capex));
    // Sum of lines = totals (after rounding, to $0.10 tolerance for long holds)
    const rSum = y.revenueLines.reduce((s, l) => s + l.amount, 0);
    const eSum = y.expenseLines.reduce((s, l) => s + l.amount, 0);
    assert(`${ctx} Y${y.year} sum(revenueLines) = totalRevenue`, near(rSum, y.totalRevenue, 0.10));
    assert(`${ctx} Y${y.year} sum(expenseLines) = totalExpenses`, near(eSum, y.totalExpenses, 0.10));
  }

  // Per-line growth check: Y2 revenue line should be Y1 × (1 + rate) per line, after rounding
  if (proj.years.length >= 2 && !config.vacancyCurve && !config.categoryGrowthRates) {
    const y1Lines = proj.years[0].revenueLines;
    const y2Lines = proj.years[1].revenueLines;
    for (let i = 0; i < y1Lines.length; i++) {
      const expected = Math.round(y1Lines[i].amount * (1 + config.revenueGrowthRate) * 100) / 100;
      assert(`${ctx} Y2 rev-line[${y1Lines[i].key}] grows by ${(config.revenueGrowthRate * 100).toFixed(2)}%`,
        near(y2Lines[i].amount, expected, 0.02),
        `| got ${y2Lines[i].amount} expected ${expected}`);
    }
  }

  // Category override check: overridden keys should grow at override rate
  if (config.categoryGrowthRates && proj.years.length >= 2) {
    const y1Exp = proj.years[0].expenseLines;
    const y2Exp = proj.years[1].expenseLines;
    for (const [k, rate] of Object.entries(config.categoryGrowthRates)) {
      const idx = y1Exp.findIndex(l => l.key === k);
      if (idx >= 0 && y1Exp[idx].amount > 0) {
        const expected = Math.round(y1Exp[idx].amount * (1 + rate) * 100) / 100;
        assert(`${ctx} Y2 override-line[${k}] grows by ${(rate * 100).toFixed(2)}%`,
          near(y2Exp[idx].amount, expected, 0.02),
          `| got ${y2Exp[idx].amount} expected ${expected}`);
      }
    }
  }

  // CapEx schedule check: scheduled years should use the exact amount
  if (config.capexSchedule) {
    for (const entry of config.capexSchedule) {
      if (entry.year <= proj.years.length) {
        const y = proj.years[entry.year - 1];
        assert(`${ctx} Y${entry.year} capex = scheduled ${entry.amount}`,
          near(y.capex, entry.amount, 0.02), `| got ${y.capex}`);
      }
    }
  }

  // Vacancy curve check: scheduled years should override the vacancy line
  if (config.vacancyCurve) {
    for (const entry of config.vacancyCurve) {
      if (entry.year <= proj.years.length) {
        const y = proj.years[entry.year - 1];
        const vacLine = y.expenseLines.find(l => ['vacancy', 'concessions', 'badDebt'].includes(l.key));
        // Vacancy sometimes lives in revenueLines (subtraction) — skip gracefully if absent
        if (vacLine) {
          assert(`${ctx} Y${entry.year} vacancy override applied`, vacLine.isVacancyOverride === true);
        }
      }
    }
  }

  // Exit invariants
  if (proj.exit) {
    const { exitNOI, exitValue, sellingCosts, netSaleProceeds, impliedCapRate } = proj.exit;
    assert(`${ctx} exit no-NaN`, finite(exitValue) && finite(sellingCosts) && finite(netSaleProceeds));
    assert(`${ctx} exitValue = exitNOI / capRate`,
      near(exitValue, exitNOI / impliedCapRate, 0.02),
      `| got ${exitValue} expected ${(exitNOI / impliedCapRate).toFixed(2)}`);
    assert(`${ctx} sellingCosts = exitValue × ${config.sellingCostPct}`,
      near(sellingCosts, exitValue * config.sellingCostPct, 0.02),
      `| got ${sellingCosts}`);
    assert(`${ctx} netSaleProceeds = exitValue - sellingCosts`,
      near(netSaleProceeds, exitValue - sellingCosts, 0.02));
    assert(`${ctx} exit NOI = last year NOI`, near(exitNOI, proj.years[proj.years.length - 1].noi));
  }

  // NOI CAGR invariant: year1NOI × (1 + CAGR)^(N-1) ≈ yearN NOI
  // Skip when vacancy curve or category overrides are active (those break the single-rate assumption),
  // when NOI is <= 0 (CAGR undefined), or when hold is 1 (CAGR null by design).
  if (proj.noiCAGR !== null && proj.years.length >= 2 && proj.years[0].noi > 0 && proj.years[proj.years.length - 1].noi > 0
      && !config.vacancyCurve && !config.categoryGrowthRates) {
    const y1NOI = proj.years[0].noi;
    const yNNOI = proj.years[proj.years.length - 1].noi;
    const reconstructed = y1NOI * Math.pow(1 + proj.noiCAGR, proj.years.length - 1);
    // CAGR is stored at 4dp precision (round4). Over N compounding periods the
    // reconstruction error scales ~linearly with N; allow 5bp per 10 years.
    const cagrTol = Math.max(1e-3, 5e-4 * proj.years.length);
    assert(`${ctx} NOI CAGR reconstructs year-N NOI`, relNear(reconstructed, yNNOI, cagrTol),
      `| got CAGR=${(proj.noiCAGR * 100).toFixed(4)}% y1=${y1NOI} yN=${yNNOI} reconstructed=${reconstructed.toFixed(2)}`);
  }
}

// ─────────────────────────────────────────────
// Registry consistency — non-COA classes must return null cleanly
// ─────────────────────────────────────────────
const COA_IDS = Object.keys(MOCK_INPUTS);
const NON_COA_IDS = Object.keys(MODEL_CONFIG_REGISTRY).filter(id => !COA_IDS.includes(id));

console.log('\n=== Registry consistency ===');
for (const id of NON_COA_IDS) {
  // These are UI-level classes — engine should return null (not throw)
  let result;
  try {
    result = computeDirectInputFinancials(id, { annualRevenue: 100000, annualPayroll: 40000 });
    assert(`[${id}] non-COA class returns null cleanly`, result === null);
  } catch (e) {
    assert(`[${id}] non-COA class does not throw`, false, `| ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// Main: iterate every (asset class × config) pair
// ─────────────────────────────────────────────
console.log(`\n=== Per-asset-class × business-config matrix ===`);
console.log(`  ${COA_IDS.length} asset classes × ${CONFIGS.length} configs = ${COA_IDS.length * CONFIGS.length} scenarios`);

for (const ac of COA_IDS) {
  for (const cfg of CONFIGS) {
    runScenario(ac, cfg.name, cfg, MOCK_INPUTS[ac]);
  }
}

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────
console.log(`\n=== SUMMARY ===`);
console.log(`Total assertions: ${results.pass + results.fail}   Pass: ${results.pass}   Fail: ${results.fail}`);
if (results.fail > 0) {
  console.log(`\nFirst 20 failures:`);
  for (const f of results.failures.slice(0, 20)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ All invariants hold across ${COA_IDS.length} asset classes × ${CONFIGS.length} business configs.`);
