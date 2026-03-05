// =============================================================================
// DIRECT INPUT P&L ENGINE v2
// File: server/services/direct-input-engine.ts
//
// Computes Year 1 financials from user input assumptions.
// Each asset class defines a FULL Chart of Accounts (COA) — all standard
// revenue and expense lines are always emitted (even at $0) so the UI can
// show them as editable inputs. Custom lines from user are appended.
//
// Formatting: Currency as $0,000,000 | Percentages as 0.00%
// =============================================================================

export type ModelInputMode = 'auto' | 'upload' | 'direct_input' | 'hybrid';

export interface DirectInputFinancials {
  totalRevenue: number;
  totalExpenses: number;
  noi: number;
  revenueLines: FinancialLine[];
  expenseLines: FinancialLine[];
  computedFrom: 'direct_input';
  formulaBreakdowns: Record<string, string>;
  monthlyBreakdown?: MonthlyBreakdown[];
}

export interface FinancialLine {
  label: string;
  amount: number;
  category: 'revenue' | 'expense';
  formula?: string;
  key?: string;         // stable key for persistence (e.g. 'annualPropertyTax')
  isCustom?: boolean;   // user-added line
  isSubtraction?: boolean; // renders as negative (vacancy, concessions)
}


// ---------------------------------------------------------------------------
// Monthly calendar constants
// ---------------------------------------------------------------------------
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_IN_YEAR = 365;

export interface MonthlyBreakdown {
  month: string;           // 'Jan', 'Feb', ...
  days: number;            // 31, 28, ...
  revenue: number;
  expenses: number;
  noi: number;
  occupancy?: number;      // effective occupancy for this month
  isSeason?: 'in' | 'off'; // seasonal tag
}

// ---------------------------------------------------------------------------
// COA Definitions — standard line items per asset class
// ---------------------------------------------------------------------------

interface COALine {
  key: string;
  label: string;
  category: 'revenue' | 'expense';
  inputKeys: string[];          // keys to look up in inputAssumptions
  computeType: 'direct' | 'pct_of_revenue' | 'pct_of_egi' | 'formula' | 'monthly_x12';
  pctKey?: string;              // for pct-based: key for the percentage value
  defaultPct?: number;          // default percentage if using pct compute
  isSubtraction?: boolean;      // vacancy, concessions, COGS
  formulaFn?: (inputs: Record<string, any>, computed: Record<string, number>) => { amount: number; formula: string };
}

// ===== STR =====
const STR_COA: COALine[] = [
  // Revenue
  { key: 'grossRentalIncome', label: 'Gross Rental Income', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i, c) => {
      const rate = num(i.nightlyRate ?? i.averageDailyRate);
      const occ = pct(i.occupancy ?? i.occupancyRate);
      const units = Math.max(1, num(i.numberOfUnits ?? i.units ?? 1));
      const amt = rate * occ * 365 * units;
      return { amount: amt, formula: `$${fmtC(rate)}/night × ${fmtP(occ)} occ × 365 × ${units} unit${units > 1 ? 's' : ''} = $${fmtC(amt)}` };
    }},
  { key: 'cleaningFeeIncome', label: 'Cleaning Fee Income', category: 'revenue', inputKeys: ['annualCleaningFeeIncome', 'cleaningFeeIncome'], computeType: 'direct' },
  { key: 'otherIncome', label: 'Other Income', category: 'revenue', inputKeys: ['annualOtherIncome', 'otherIncome'], computeType: 'direct' },
  // Expenses
  { key: 'platformFees', label: 'Platform Fees (Airbnb/VRBO)', category: 'expense', inputKeys: ['annualPlatformFees'], computeType: 'pct_of_revenue', pctKey: 'platformFeePct', defaultPct: 0.03 },
  { key: 'cleaning', label: 'Cleaning / Turnover', category: 'expense', inputKeys: ['annualCleaning', 'cleaningExpense'], computeType: 'direct' },
  { key: 'propertyManagement', label: 'Property Management', category: 'expense', inputKeys: ['annualPropertyManagement'], computeType: 'pct_of_revenue', pctKey: 'propertyManagementPct', defaultPct: 0 },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'annualHOA', label: 'HOA / Condo Fees', category: 'expense', inputKeys: ['annualHOA', 'hoa'], computeType: 'direct' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', inputKeys: ['annualMaintenance', 'maintenance'], computeType: 'direct' },
  { key: 'supplies', label: 'Supplies & Furnishing', category: 'expense', inputKeys: ['annualSupplies', 'supplies'], computeType: 'direct' },
  { key: 'landscaping', label: 'Landscaping / Lawn Care', category: 'expense', inputKeys: ['annualLandscaping', 'landscaping'], computeType: 'direct' },
  { key: 'internet', label: 'Internet / Cable / Streaming', category: 'expense', inputKeys: ['annualInternet', 'internet'], computeType: 'direct' },
  { key: 'pest', label: 'Pest Control', category: 'expense', inputKeys: ['annualPestControl', 'pestControl'], computeType: 'direct' },
  { key: 'accounting', label: 'Accounting / Bookkeeping', category: 'expense', inputKeys: ['annualAccounting', 'accounting'], computeType: 'direct' },
  { key: 'capEx', label: 'Capital Reserves', category: 'expense', inputKeys: ['annualCapEx', 'capitalReserves'], computeType: 'direct' },
];

// ===== SFR =====
const SFR_COA: COALine[] = [
  { key: 'grossPotentialRent', label: 'Gross Potential Rent', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const rent = num(i.monthlyRent ?? i.rent);
      const amt = rent * 12;
      return { amount: amt, formula: `$${fmtC(rent)}/mo × 12 = $${fmtC(amt)}` };
    }},
  { key: 'vacancy', label: 'Less: Vacancy', category: 'revenue', inputKeys: [], computeType: 'formula', isSubtraction: true,
    formulaFn: (i, c) => {
      const vac = pct(i.vacancyRate ?? i.vacancy ?? 0.05);
      const gpr = c.grossPotentialRent ?? 0;
      const amt = gpr * vac;
      return { amount: amt, formula: `$${fmtC(gpr)} × ${fmtP(vac)} = ($${fmtC(amt)})` };
    }},
  { key: 'otherIncome', label: 'Other Income', category: 'revenue', inputKeys: ['annualOtherIncome', 'otherIncome'], computeType: 'direct' },
  { key: 'propertyManagement', label: 'Property Management', category: 'expense', inputKeys: ['annualPropertyManagement'], computeType: 'pct_of_egi', pctKey: 'propertyManagementPct', defaultPct: 0 },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'annualHOA', label: 'HOA', category: 'expense', inputKeys: ['annualHOA', 'hoa'], computeType: 'direct' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', inputKeys: ['annualMaintenance', 'maintenance'], computeType: 'direct' },
  { key: 'landscaping', label: 'Landscaping', category: 'expense', inputKeys: ['annualLandscaping', 'landscaping'], computeType: 'direct' },
  { key: 'pest', label: 'Pest Control', category: 'expense', inputKeys: ['annualPestControl', 'pestControl'], computeType: 'direct' },
  { key: 'capEx', label: 'Capital Reserves', category: 'expense', inputKeys: ['annualCapEx', 'capitalReserves'], computeType: 'direct' },
];

// ===== Duplex / Triplex / Quad =====
const RESIDENTIAL_MULTI_COA: COALine[] = [
  { key: 'grossPotentialRent', label: 'Gross Potential Rent', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const rent = num(i.monthlyRent ?? i.totalMonthlyRent ?? i.rent);
      const units = num(i.numberOfUnits ?? i.units ?? 2);
      const amt = rent * 12;
      return { amount: amt, formula: `$${fmtC(rent)}/mo × 12 = $${fmtC(amt)} (${units} units)` };
    }},
  { key: 'vacancy', label: 'Less: Vacancy & Credit Loss', category: 'revenue', inputKeys: [], computeType: 'formula', isSubtraction: true,
    formulaFn: (i, c) => {
      const vac = pct(i.vacancyRate ?? i.vacancy ?? 0.05);
      const gpr = c.grossPotentialRent ?? 0;
      const amt = gpr * vac;
      return { amount: amt, formula: `$${fmtC(gpr)} × ${fmtP(vac)} = ($${fmtC(amt)})` };
    }},
  { key: 'laundryIncome', label: 'Laundry Income', category: 'revenue', inputKeys: ['annualLaundryIncome', 'laundryIncome'], computeType: 'direct' },
  { key: 'parkingIncome', label: 'Parking Income', category: 'revenue', inputKeys: ['annualParkingIncome', 'parkingIncome'], computeType: 'direct' },
  { key: 'otherIncome', label: 'Other Income', category: 'revenue', inputKeys: ['annualOtherIncome', 'otherIncome'], computeType: 'direct' },
  { key: 'propertyManagement', label: 'Property Management', category: 'expense', inputKeys: ['annualPropertyManagement'], computeType: 'pct_of_egi', pctKey: 'propertyManagementPct', defaultPct: 0.08 },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', inputKeys: ['annualMaintenance', 'maintenance'], computeType: 'direct' },
  { key: 'landscaping', label: 'Landscaping', category: 'expense', inputKeys: ['annualLandscaping', 'landscaping'], computeType: 'direct' },
  { key: 'trash', label: 'Trash / Waste Removal', category: 'expense', inputKeys: ['annualTrash', 'trash'], computeType: 'direct' },
  { key: 'capEx', label: 'Capital Reserves', category: 'expense', inputKeys: ['annualCapEx', 'capitalReserves'], computeType: 'direct' },
];

// ===== Multifamily =====
const MULTIFAMILY_COA: COALine[] = [
  { key: 'grossPotentialRent', label: 'Gross Potential Rent', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const units = num(i.totalUnits ?? i.numberOfUnits ?? i.units);
      const avgRent = num(i.averageRent ?? i.monthlyRent ?? i.rent);
      const amt = avgRent * 12 * Math.max(1, units);
      return { amount: amt, formula: `$${fmtC(avgRent)}/mo × 12 × ${units} units = $${fmtC(amt)}` };
    }},
  { key: 'vacancy', label: 'Less: Vacancy', category: 'revenue', inputKeys: [], computeType: 'formula', isSubtraction: true,
    formulaFn: (i, c) => { const v = pct(i.vacancyRate ?? i.vacancy ?? 0.05); const g = c.grossPotentialRent ?? 0; const a = g * v; return { amount: a, formula: `$${fmtC(g)} × ${fmtP(v)} = ($${fmtC(a)})` }; }},
  { key: 'concessions', label: 'Less: Concessions', category: 'revenue', inputKeys: [], computeType: 'formula', isSubtraction: true,
    formulaFn: (i, c) => { const v = pct(i.concessionsPct ?? i.concessions ?? 0); const g = c.grossPotentialRent ?? 0; const a = g * v; return { amount: a, formula: `$${fmtC(g)} × ${fmtP(v)} = ($${fmtC(a)})` }; }},
  { key: 'badDebt', label: 'Less: Bad Debt', category: 'revenue', inputKeys: [], computeType: 'formula', isSubtraction: true,
    formulaFn: (i, c) => { const v = pct(i.badDebtPct ?? i.badDebt ?? 0.01); const g = c.grossPotentialRent ?? 0; const a = g * v; return { amount: a, formula: `$${fmtC(g)} × ${fmtP(v)} = ($${fmtC(a)})` }; }},
  { key: 'utilityReimbursements', label: 'Utility Reimbursements', category: 'revenue', inputKeys: ['annualUtilityReimbursements', 'utilityReimbursements'], computeType: 'direct' },
  { key: 'parkingIncome', label: 'Parking Income', category: 'revenue', inputKeys: ['annualParkingIncome', 'parkingIncome'], computeType: 'direct' },
  { key: 'laundryIncome', label: 'Laundry Income', category: 'revenue', inputKeys: ['annualLaundryIncome', 'laundryIncome'], computeType: 'direct' },
  { key: 'petFees', label: 'Pet Fees', category: 'revenue', inputKeys: ['annualPetFees', 'petFees'], computeType: 'direct' },
  { key: 'otherIncome', label: 'Other Income', category: 'revenue', inputKeys: ['annualOtherIncome', 'otherIncome'], computeType: 'direct' },
  { key: 'propertyManagement', label: 'Property Management', category: 'expense', inputKeys: ['annualPropertyManagement'], computeType: 'pct_of_egi', pctKey: 'propertyManagementPct', defaultPct: 0.05 },
  { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', inputKeys: ['annualPayroll', 'payroll'], computeType: 'direct' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', inputKeys: ['annualMaintenance', 'maintenance'], computeType: 'direct' },
  { key: 'admin', label: 'Admin & General', category: 'expense', inputKeys: ['annualAdmin', 'adminExpense'], computeType: 'direct' },
  { key: 'marketing', label: 'Marketing & Advertising', category: 'expense', inputKeys: ['annualMarketing', 'marketing'], computeType: 'direct' },
  { key: 'contractServices', label: 'Contract Services', category: 'expense', inputKeys: ['annualContractServices', 'contractServices'], computeType: 'direct' },
  { key: 'trash', label: 'Trash / Waste Removal', category: 'expense', inputKeys: ['annualTrash', 'trash'], computeType: 'direct' },
  { key: 'pest', label: 'Pest Control', category: 'expense', inputKeys: ['annualPestControl', 'pestControl'], computeType: 'direct' },
  { key: 'capEx', label: 'Capital Reserves', category: 'expense', inputKeys: ['annualCapEx', 'capitalReserves'], computeType: 'direct' },
];

// ===== Hotel =====
const HOTEL_COA: COALine[] = [
  { key: 'roomRevenue', label: 'Room Revenue', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const rooms = num(i.numberOfRooms ?? i.rooms ?? i.totalRooms);
      const adr = num(i.averageDailyRate ?? i.adr ?? i.nightlyRate);
      const occ = pct(i.occupancyRate ?? i.occupancy ?? 0.65);
      const amt = rooms * adr * occ * 365;
      const revPAR = adr * occ;
      return { amount: amt, formula: `${rooms} rooms × $${fmtC(adr)} ADR × ${fmtP(occ)} occ × 365 = $${fmtC(amt)} (RevPAR: $${fmtC(revPAR)})` };
    }},
  { key: 'fbRevenue', label: 'F&B Revenue', category: 'revenue', inputKeys: ['annualFBRevenue', 'foodAndBeverage'], computeType: 'direct' },
  { key: 'meetingRevenue', label: 'Meeting / Event Revenue', category: 'revenue', inputKeys: ['annualMeetingRevenue', 'meetingRevenue'], computeType: 'direct' },
  { key: 'spaRevenue', label: 'Spa Revenue', category: 'revenue', inputKeys: ['annualSpaRevenue', 'spaRevenue'], computeType: 'direct' },
  { key: 'parkingRevenue', label: 'Parking Revenue', category: 'revenue', inputKeys: ['annualParkingRevenue', 'parkingRevenue'], computeType: 'direct' },
  { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', inputKeys: ['annualOtherRevenue', 'otherIncome'], computeType: 'direct' },
  { key: 'departmental', label: 'Departmental Expenses', category: 'expense', inputKeys: ['annualDepartmentalExpenses'], computeType: 'pct_of_revenue', pctKey: 'departmentalExpensePct', defaultPct: 0.35 },
  { key: 'undistributed', label: 'Undistributed Expenses', category: 'expense', inputKeys: ['annualUndistributedExpenses'], computeType: 'pct_of_revenue', pctKey: 'undistributedExpensePct', defaultPct: 0.20 },
  { key: 'mgmtFee', label: 'Management Fee', category: 'expense', inputKeys: ['annualManagementFee'], computeType: 'pct_of_revenue', pctKey: 'managementFeePct', defaultPct: 0.03 },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'ffeReserve', label: 'FF&E Reserve', category: 'expense', inputKeys: ['annualFFEReserve'], computeType: 'pct_of_revenue', pctKey: 'ffAndEReservePct', defaultPct: 0.04 },
];

// ===== Marina =====
const MARINA_COA: COALine[] = [
  { key: 'wetSlipRevenue', label: 'Wet Slip Revenue', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const slips = num(i.wetSlips ?? i.totalSlips);
      const rate = num(i.avgMonthlySlipRate ?? i.slipRate);
      const occ = pct(i.slipOccupancy ?? i.occupancy ?? 0.85);
      const amt = slips * rate * 12 * occ;
      return { amount: amt, formula: `${slips} slips × $${fmtC(rate)}/mo × 12 × ${fmtP(occ)} occ = $${fmtC(amt)}` };
    }},
  { key: 'dryStorageRevenue', label: 'Dry Storage Revenue', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const spaces = num(i.dryStorageSpaces);
      const rate = num(i.avgMonthlyDryRate ?? i.dryRate);
      const amt = spaces * rate * 12;
      return { amount: amt, formula: `${spaces} spaces × $${fmtC(rate)}/mo × 12 = $${fmtC(amt)}` };
    }},
  { key: 'fuelRevenue', label: 'Fuel Revenue', category: 'revenue', inputKeys: ['annualFuelRevenue', 'fuelRevenue'], computeType: 'direct' },
  { key: 'shipStoreRevenue', label: 'Ship Store Revenue', category: 'revenue', inputKeys: ['annualShipStoreRevenue', 'storeRevenue'], computeType: 'direct' },
  { key: 'serviceRevenue', label: 'Service / Repair Revenue', category: 'revenue', inputKeys: ['annualServiceRevenue', 'serviceRevenue'], computeType: 'direct' },
  { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', inputKeys: ['annualOtherRevenue', 'otherIncome'], computeType: 'direct' },
  { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', inputKeys: ['annualPayroll', 'payroll'], computeType: 'direct' },
  { key: 'fuelCOGS', label: 'Fuel COGS', category: 'expense', inputKeys: ['annualFuelCOGS', 'fuelCOGS'], computeType: 'direct' },
  { key: 'storeCOGS', label: 'Ship Store COGS', category: 'expense', inputKeys: ['annualStoreCOGS', 'storeCOGS'], computeType: 'direct' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', inputKeys: ['annualMaintenance', 'maintenance'], computeType: 'direct' },
  { key: 'dredging', label: 'Dredging', category: 'expense', inputKeys: ['annualDredging', 'dredging'], computeType: 'direct' },
  { key: 'mgmtFee', label: 'Management Fee', category: 'expense', inputKeys: ['annualManagementFee'], computeType: 'pct_of_revenue', pctKey: 'managementFeePct', defaultPct: 0 },
  { key: 'marketing', label: 'Marketing', category: 'expense', inputKeys: ['annualMarketing', 'marketing'], computeType: 'direct' },
  { key: 'admin', label: 'Admin & General', category: 'expense', inputKeys: ['annualAdmin', 'adminExpense'], computeType: 'direct' },
  { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', inputKeys: ['annualOtherExpenses', 'otherExpenses'], computeType: 'direct' },
];

// ===== Self Storage =====
const SELF_STORAGE_COA: COALine[] = [
  { key: 'storageRevenue', label: 'Storage Revenue', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const units = num(i.totalUnits ?? i.numberOfUnits ?? i.units);
      const rate = num(i.averageMonthlyRate ?? i.monthlyRate ?? i.rate);
      const amt = rate * 12 * Math.max(1, units);
      return { amount: amt, formula: `$${fmtC(rate)}/mo × 12 × ${units} units = $${fmtC(amt)}` };
    }},
  { key: 'vacancy', label: 'Less: Vacancy', category: 'revenue', inputKeys: [], computeType: 'formula', isSubtraction: true,
    formulaFn: (i, c) => { const occ = pct(i.occupancyRate ?? i.occupancy ?? 0.88); const g = c.storageRevenue ?? 0; const a = g * (1 - occ); return { amount: a, formula: `$${fmtC(g)} × ${fmtP(1 - occ)} = ($${fmtC(a)})` }; }},
  { key: 'retailIncome', label: 'Retail / Supplies Income', category: 'revenue', inputKeys: ['annualRetailIncome', 'retailIncome'], computeType: 'direct' },
  { key: 'lateFees', label: 'Late Fees / Admin Fees', category: 'revenue', inputKeys: ['annualLateFees', 'lateFees'], computeType: 'direct' },
  { key: 'truckRental', label: 'Truck Rental Income', category: 'revenue', inputKeys: ['annualTruckRental', 'truckRental'], computeType: 'direct' },
  { key: 'otherIncome', label: 'Other Income', category: 'revenue', inputKeys: ['annualOtherIncome', 'otherIncome'], computeType: 'direct' },
  { key: 'propertyManagement', label: 'Management Fee', category: 'expense', inputKeys: ['annualPropertyManagement'], computeType: 'pct_of_egi', pctKey: 'propertyManagementPct', defaultPct: 0.06 },
  { key: 'payroll', label: 'Payroll', category: 'expense', inputKeys: ['annualPayroll', 'payroll'], computeType: 'direct' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'maintenance', label: 'Maintenance', category: 'expense', inputKeys: ['annualMaintenance', 'maintenance'], computeType: 'direct' },
  { key: 'marketing', label: 'Marketing', category: 'expense', inputKeys: ['annualMarketing', 'marketing'], computeType: 'direct' },
  { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', inputKeys: ['annualOtherExpenses', 'otherExpenses'], computeType: 'direct' },
];

// ===== Laundromat =====
const LAUNDROMAT_COA: COALine[] = [
  { key: 'washerRevenue', label: 'Washer Revenue', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const w = num(i.numberOfWashers ?? i.washers); const t = num(i.washerTurnsPerDay ?? i.turnsPerDay ?? 5); const p = num(i.washerVendPrice ?? i.washerPrice ?? 3.5); const d = num(i.daysOpenPerYear ?? 365);
      const a = w * t * p * d; return { amount: a, formula: `${w} washers × ${t} turns × $${fmtC(p)} × ${d} days = $${fmtC(a)}` };
    }},
  { key: 'dryerRevenue', label: 'Dryer Revenue', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const dr = num(i.numberOfDryers ?? i.dryers); const t = num(i.dryerTurnsPerDay ?? i.turnsPerDay ?? 5); const p = num(i.dryerVendPrice ?? i.dryerPrice ?? 2.0); const d = num(i.daysOpenPerYear ?? 365);
      const a = dr * t * p * d; return { amount: a, formula: `${dr} dryers × ${t} turns × $${fmtC(p)} × ${d} days = $${fmtC(a)}` };
    }},
  { key: 'vendingIncome', label: 'Vending Income', category: 'revenue', inputKeys: ['annualVendingIncome', 'vendingIncome'], computeType: 'direct' },
  { key: 'washDryFold', label: 'Wash/Dry/Fold Service', category: 'revenue', inputKeys: ['annualWashDryFold', 'washDryFold'], computeType: 'direct' },
  { key: 'otherIncome', label: 'Other Income', category: 'revenue', inputKeys: ['annualOtherIncome', 'otherIncome'], computeType: 'direct' },
  { key: 'rent', label: 'Rent / Lease', category: 'expense', inputKeys: ['annualRent'], computeType: 'monthly_x12' },
  { key: 'utilities', label: 'Utilities (Water/Gas/Electric)', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'maintenance', label: 'Machine Maintenance & Repairs', category: 'expense', inputKeys: ['annualMaintenance', 'maintenance'], computeType: 'direct' },
  { key: 'payroll', label: 'Payroll / Attendant', category: 'expense', inputKeys: ['annualPayroll', 'payroll'], computeType: 'direct' },
  { key: 'supplies', label: 'Supplies (Soap/Softener)', category: 'expense', inputKeys: ['annualSupplies', 'supplies'], computeType: 'direct' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'trash', label: 'Trash Removal', category: 'expense', inputKeys: ['annualTrash', 'trash'], computeType: 'direct' },
  { key: 'pest', label: 'Pest Control', category: 'expense', inputKeys: ['annualPestControl', 'pestControl'], computeType: 'direct' },
  { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', inputKeys: ['annualOtherExpenses', 'otherExpenses'], computeType: 'direct' },
];

// ===== Commercial Lease (Retail, Office, Industrial, Medical Office) =====
const COMMERCIAL_COA: COALine[] = [
  { key: 'baseRent', label: 'Base Rent', category: 'revenue', inputKeys: [], computeType: 'formula',
    formulaFn: (i) => {
      const sf = num(i.totalSquareFeet ?? i.squareFeet ?? i.sf);
      const rate = num(i.rentPerSF ?? i.ratePSF ?? i.rate);
      const amt = sf * rate;
      return { amount: amt, formula: `${fmtN(sf)} SF × $${fmtC(rate)}/SF/yr = $${fmtC(amt)}` };
    }},
  { key: 'vacancy', label: 'Less: Vacancy', category: 'revenue', inputKeys: [], computeType: 'formula', isSubtraction: true,
    formulaFn: (i, c) => { const occ = pct(i.occupancyRate ?? i.occupancy ?? 0.93); const g = c.baseRent ?? 0; const a = g * (1 - occ); return { amount: a, formula: `$${fmtC(g)} × ${fmtP(1 - occ)} = ($${fmtC(a)})` }; }},
  { key: 'camReimbursements', label: 'CAM Reimbursements', category: 'revenue', inputKeys: ['annualCAMReimbursements', 'camReimbursements'], computeType: 'direct' },
  { key: 'percentageRent', label: 'Percentage Rent', category: 'revenue', inputKeys: ['annualPercentageRent', 'percentageRent'], computeType: 'direct' },
  { key: 'otherIncome', label: 'Other Income', category: 'revenue', inputKeys: ['annualOtherIncome', 'otherIncome'], computeType: 'direct' },
  { key: 'mgmtFee', label: 'Management Fee', category: 'expense', inputKeys: ['annualManagementFee'], computeType: 'pct_of_egi', pctKey: 'propertyManagementPct', defaultPct: 0.04 },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputKeys: ['annualPropertyTax', 'propertyTax'], computeType: 'direct' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'cam', label: 'CAM / Common Area', category: 'expense', inputKeys: ['annualCAM', 'cam'], computeType: 'direct' },
  { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', inputKeys: ['annualMaintenance', 'maintenance'], computeType: 'direct' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'janitorial', label: 'Janitorial', category: 'expense', inputKeys: ['annualJanitorial', 'janitorial'], computeType: 'direct' },
  { key: 'security', label: 'Security', category: 'expense', inputKeys: ['annualSecurity', 'security'], computeType: 'direct' },
  { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', inputKeys: ['annualOtherExpenses', 'otherExpenses'], computeType: 'direct' },
];

// ===== Business =====
const BUSINESS_COA: COALine[] = [
  { key: 'grossRevenue', label: 'Gross Revenue', category: 'revenue', inputKeys: ['annualRevenue', 'grossRevenue', 'totalRevenue'], computeType: 'direct' },
  { key: 'cogs', label: 'Less: Cost of Goods Sold', category: 'revenue', inputKeys: ['costOfGoodsSold', 'cogs'], computeType: 'direct', isSubtraction: true },
  { key: 'otherIncome', label: 'Other Income', category: 'revenue', inputKeys: ['annualOtherIncome', 'otherIncome'], computeType: 'direct' },
  { key: 'payroll', label: 'Payroll', category: 'expense', inputKeys: ['annualPayroll', 'payroll'], computeType: 'direct' },
  { key: 'ownerSalary', label: "Owner's Salary (SDE add-back)", category: 'expense', inputKeys: ['ownerSalary', 'ownerCompensation'], computeType: 'direct' },
  { key: 'rent', label: 'Rent / Lease', category: 'expense', inputKeys: ['annualRent'], computeType: 'monthly_x12' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputKeys: ['annualUtilities'], computeType: 'monthly_x12' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputKeys: ['annualInsurance', 'insurance'], computeType: 'direct' },
  { key: 'marketing', label: 'Marketing & Advertising', category: 'expense', inputKeys: ['annualMarketing', 'marketing'], computeType: 'direct' },
  { key: 'accounting', label: 'Accounting / Legal', category: 'expense', inputKeys: ['annualAccounting', 'accounting'], computeType: 'direct' },
  { key: 'software', label: 'Software / Subscriptions', category: 'expense', inputKeys: ['annualSoftware', 'software'], computeType: 'direct' },
  { key: 'vehicleExpense', label: 'Vehicle / Travel', category: 'expense', inputKeys: ['annualVehicle', 'vehicleExpense'], computeType: 'direct' },
  { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', inputKeys: ['annualOtherExpenses', 'otherExpenses'], computeType: 'direct' },
];

// ---------------------------------------------------------------------------
// COA Registry
// ---------------------------------------------------------------------------

const COA_REGISTRY: Record<string, COALine[]> = {
  str: STR_COA,
  sfr: SFR_COA,
  duplex: RESIDENTIAL_MULTI_COA,
  triplex: RESIDENTIAL_MULTI_COA,
  quad: RESIDENTIAL_MULTI_COA,
  multifamily: MULTIFAMILY_COA,
  hotel: HOTEL_COA,
  marina: MARINA_COA,
  self_storage: SELF_STORAGE_COA,
  laundromat: LAUNDROMAT_COA,
  retail: COMMERCIAL_COA,
  office: COMMERCIAL_COA,
  industrial: COMMERCIAL_COA,
  medical_office: COMMERCIAL_COA,
  mixed_use: COMMERCIAL_COA,
  business: BUSINESS_COA,
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeDirectInputFinancials(
  assetClass: string,
  inputAssumptions: Record<string, any>,
  unitMix?: any[],
): DirectInputFinancials | null {
  const coa = COA_REGISTRY[assetClass];
  if (!coa) return null;

  try {
    return computeFromCOA(coa, inputAssumptions, unitMix);
  } catch (err) {
    console.error(`[DirectInputEngine] Error computing financials for ${assetClass}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Universal COA-driven computation engine
// ---------------------------------------------------------------------------

function computeFromCOA(
  coa: COALine[],
  inputs: Record<string, any>,
  unitMix?: any[],
): DirectInputFinancials | null {
  const computed: Record<string, number> = {};
  const revenueLines: FinancialLine[] = [];
  const expenseLines: FinancialLine[] = [];
  const formulaBreakdowns: Record<string, string> = {};

  // --- Unit mix revenue injection (prepend before COA if available) ---
  if (unitMix && unitMix.length > 0) {
    for (const unit of unitMix) {
      const rent = num(unit.monthlyRent ?? unit.rent ?? unit.nightlyRate ?? unit.rate ?? unit.marketRent);
      const count = num(unit.count ?? unit.quantity ?? unit.units ?? 1);
      const label = unit.label ?? unit.type ?? unit.name ?? unit.size ?? 'Unit';
      const isNightly = !!unit.nightlyRate || !!unit.averageDailyRate;
      let unitAmt: number;
      let formula: string;

      if (isNightly) {
        const occ = pct(unit.occupancy ?? unit.occupancyRate ?? inputs.occupancy ?? 0.65);
        const inSeasonOcc = pct(unit.inSeasonOccupancy ?? inputs.inSeasonOccupancy ?? occ);
        const offSeasonOcc = pct(unit.offSeasonOccupancy ?? inputs.offSeasonOccupancy ?? occ);
        const inSeasonMonths: number[] = inputs.inSeasonMonths ?? [];
        const hasSeasonal = inSeasonMonths.length > 0 && inSeasonMonths.length < 12;
        if (hasSeasonal) {
          // Exact days-per-month with seasonal occupancy
          unitAmt = 0;
          const monthDetails: string[] = [];
          for (let m = 0; m < 12; m++) {
            const isSeason = inSeasonMonths.includes(m + 1);
            const mOcc = isSeason ? inSeasonOcc : offSeasonOcc;
            const mRev = rent * mOcc * DAYS_PER_MONTH[m] * count;
            unitAmt += mRev;
          }
          const inDays = inSeasonMonths.reduce((s, m) => s + DAYS_PER_MONTH[m - 1], 0);
          const offDays = DAYS_IN_YEAR - inDays;
          formula = `$${fmtC(rent)}/night × (${inDays}d@${fmtP(inSeasonOcc)} + ${offDays}d@${fmtP(offSeasonOcc)}) × ${count} = $${fmtC(unitAmt)}`;
        } else {
          unitAmt = rent * occ * DAYS_IN_YEAR * count;
          formula = `$${fmtC(rent)}/night × ${fmtP(occ)} × ${DAYS_IN_YEAR} × ${count} = $${fmtC(unitAmt)}`;
        }
      } else {
        unitAmt = rent * 12 * count;
        formula = `$${fmtC(rent)}/mo × 12 × ${count} = $${fmtC(unitAmt)}`;
      }

      revenueLines.push({ label: `${label} (×${count})`, amount: unitAmt, category: 'revenue', formula, key: `unitMix_${label}` });
      formulaBreakdowns[`${label} (×${count})`] = formula;
    }
  }

  // --- Process COA lines ---
  // First pass: compute all revenue to get totals for pct-based calculations
  let grossRevenue = revenueLines.reduce((s, l) => s + (l.isSubtraction ? -l.amount : l.amount), 0);

  for (const line of coa.filter(l => l.category === 'revenue')) {
    const result = computeLine(line, inputs, computed, grossRevenue, 0);
    computed[line.key] = result.amount;

    // Skip formula-driven revenue lines if unit mix provided the revenue
    if (line.computeType === 'formula' && unitMix && unitMix.length > 0 && revenueLines.length > 0) {
      // Only skip the primary revenue formula (first formula line)
      if (coa.filter(l => l.category === 'revenue' && l.computeType === 'formula').indexOf(line) === 0) {
        continue;
      }
    }

    revenueLines.push({
      label: line.label,
      amount: line.isSubtraction ? -result.amount : result.amount,
      category: 'revenue',
      formula: result.formula,
      key: line.key,
      isSubtraction: line.isSubtraction,
    });
    if (result.formula) formulaBreakdowns[line.label] = result.formula;
  }

  // Calculate EGI for pct_of_egi lines
  let totalRevPositive = 0;
  let totalRevSubtractions = 0;
  for (const rl of revenueLines) {
    if (rl.isSubtraction || rl.amount < 0) {
      totalRevSubtractions += Math.abs(rl.amount);
    } else {
      totalRevPositive += rl.amount;
    }
  }
  const egi = totalRevPositive - totalRevSubtractions;
  grossRevenue = totalRevPositive;

  // Second pass: expenses
  for (const line of coa.filter(l => l.category === 'expense')) {
    const result = computeLine(line, inputs, computed, grossRevenue, egi);
    computed[line.key] = result.amount;

    expenseLines.push({
      label: line.label,
      amount: result.amount,
      category: 'expense',
      formula: result.formula,
      key: line.key,
    });
    if (result.formula) formulaBreakdowns[line.label] = result.formula;
  }

  // --- Append custom user lines ---
  const customRevenue = inputs.customRevenueLines ?? [];
  const customExpenses = inputs.customExpenseLines ?? [];

  for (const custom of customRevenue) {
    const amt = num(custom.amount ?? custom.annualAmount);
    revenueLines.push({
      label: custom.label ?? 'Custom Revenue',
      amount: amt,
      category: 'revenue',
      key: `custom_rev_${custom.id ?? custom.label}`,
      isCustom: true,
    });
  }

  for (const custom of customExpenses) {
    const amt = num(custom.amount ?? custom.annualAmount);
    expenseLines.push({
      label: custom.label ?? 'Custom Expense',
      amount: amt,
      category: 'expense',
      key: `custom_exp_${custom.id ?? custom.label}`,
      isCustom: true,
    });
  }

  // --- Totals ---
  const totalRevenue = revenueLines.reduce((s, l) => s + l.amount, 0);
  const totalExpenses = expenseLines.reduce((s, l) => s + l.amount, 0);

  // --- Monthly breakdown ---
  const _inSeasonMonths: number[] = inputs.inSeasonMonths ?? [];
  const _hasSeasonal = _inSeasonMonths.length > 0 && _inSeasonMonths.length < 12;
  const monthlyBreakdown: MonthlyBreakdown[] = DAYS_PER_MONTH.map((days, m) => {
    const seasonTag = _hasSeasonal ? (_inSeasonMonths.includes(m + 1) ? 'in' as const : 'off' as const) : undefined;
    const dayFraction = days / DAYS_IN_YEAR;
    let monthRevenue = 0;
    for (const line of revenueLines) {
      if (line.key?.startsWith('unitMix_') && unitMix) {
        const unitLabel = line.key.replace('unitMix_', '');
        const unit = unitMix.find((u: any) => (u.label ?? u.type ?? u.name ?? u.size ?? 'Unit') === unitLabel);
        if (unit && (unit.nightlyRate || unit.averageDailyRate) && _hasSeasonal) {
          const rate = num(unit.nightlyRate ?? unit.averageDailyRate ?? 0);
          const cnt = num(unit.count ?? unit.quantity ?? unit.units ?? 1);
          const baseOcc = pct(unit.occupancy ?? unit.occupancyRate ?? inputs.occupancy ?? 0.65);
          const mOcc = seasonTag === 'in'
            ? pct(unit.inSeasonOccupancy ?? inputs.inSeasonOccupancy ?? baseOcc)
            : seasonTag === 'off'
            ? pct(unit.offSeasonOccupancy ?? inputs.offSeasonOccupancy ?? baseOcc)
            : baseOcc;
          monthRevenue += rate * mOcc * days * cnt;
        } else {
          monthRevenue += (line.isSubtraction ? -line.amount : line.amount) * dayFraction;
        }
      } else {
        monthRevenue += (line.isSubtraction ? -line.amount : line.amount) * dayFraction;
      }
    }
    const monthExpenses = totalExpenses * dayFraction;
    return {
      month: MONTH_NAMES[m],
      days,
      revenue: Math.round(monthRevenue * 100) / 100,
      expenses: Math.round(monthExpenses * 100) / 100,
      noi: Math.round((monthRevenue - monthExpenses) * 100) / 100,
      ...(seasonTag ? { isSeason: seasonTag, occupancy: seasonTag === 'in' ? pct(inputs.inSeasonOccupancy ?? 0.85) : pct(inputs.offSeasonOccupancy ?? 0.50) } : {}),
    } as MonthlyBreakdown;
  });

  return {
    totalRevenue,
    totalExpenses,
    noi: totalRevenue - totalExpenses,
    revenueLines,
    expenseLines,
    computedFrom: 'direct_input',
    formulaBreakdowns,
    monthlyBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Compute a single COA line
// ---------------------------------------------------------------------------

function computeLine(
  line: COALine,
  inputs: Record<string, any>,
  computed: Record<string, number>,
  grossRevenue: number,
  egi: number,
): { amount: number; formula?: string } {
  // Formula-driven line
  if (line.computeType === 'formula' && line.formulaFn) {
    return line.formulaFn(inputs, computed);
  }

  // Direct value from inputs
  if (line.computeType === 'direct') {
    for (const key of line.inputKeys) {
      const val = num(inputs[key]);
      if (val > 0) return { amount: val };
    }
    return { amount: 0 };
  }

  // Monthly × 12
  if (line.computeType === 'monthly_x12') {
    // Check annual first
    for (const key of line.inputKeys) {
      const val = num(inputs[key]);
      if (val > 0) return { amount: val };
    }
    // Check monthly variants
    const monthlyKeys = line.inputKeys.map(k => k.replace('annual', 'monthly').replace('Annual', 'Monthly'));
    monthlyKeys.push('monthlyUtilities', 'monthlyRent');
    for (const key of monthlyKeys) {
      const val = num(inputs[key]);
      if (val > 0) {
        const annual = val * 12;
        return { amount: annual, formula: `$${fmtC(val)}/mo × 12 = $${fmtC(annual)}` };
      }
    }
    return { amount: 0 };
  }

  // Percentage of gross revenue
  if (line.computeType === 'pct_of_revenue') {
    // Check if direct amount provided first
    for (const key of line.inputKeys) {
      const val = num(inputs[key]);
      if (val > 0) return { amount: val };
    }
    // Compute from percentage
    const p = pct(inputs[line.pctKey ?? ''] ?? line.defaultPct ?? 0);
    if (p > 0 && grossRevenue > 0) {
      const amt = grossRevenue * p;
      return { amount: amt, formula: `$${fmtC(grossRevenue)} × ${fmtP(p)} = $${fmtC(amt)}` };
    }
    return { amount: 0 };
  }

  // Percentage of EGI
  if (line.computeType === 'pct_of_egi') {
    for (const key of line.inputKeys) {
      const val = num(inputs[key]);
      if (val > 0) return { amount: val };
    }
    const p = pct(inputs[line.pctKey ?? ''] ?? line.defaultPct ?? 0);
    if (p > 0 && egi > 0) {
      const amt = egi * p;
      return { amount: amt, formula: `$${fmtC(egi)} × ${fmtP(p)} = $${fmtC(amt)}` };
    }
    return { amount: 0 };
  }

  return { amount: 0 };
}

// ---------------------------------------------------------------------------
// Formatting helpers — $0,000,000 and 0.00%
// ---------------------------------------------------------------------------

function num(val: any): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === 'string' ? parseFloat(val.replace(/[,$%]/g, '')) : Number(val);
  return isNaN(n) ? 0 : n;
}

function pct(val: any): number {
  const n = num(val);
  return n > 1 ? n / 100 : n;
}

/** Format currency: $1,234,567 */
function fmtC(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Format number with commas */
function fmtN(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format percentage: 5.00% */
function fmtP(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}