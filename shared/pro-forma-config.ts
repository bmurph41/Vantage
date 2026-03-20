// =============================================================================
// CONFIG-DRIVEN PRO FORMA STRUCTURE
// File: shared/pro-forma-config.ts
//
// Defines per-asset-class pro forma line item structure for multi-year
// projections. Replaces marina-hardcoded P&L structure in pro-forma.tsx.
// =============================================================================

import { getModelConfig } from './asset-class-model-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProFormaLineConfig {
  key: string;
  label: string;
  category: 'revenue' | 'expense' | 'subtotal' | 'total';
  growthType: 'revenue' | 'expense' | 'fixed' | 'custom' | 'none';
  isPercentOfRevenue?: boolean;   // e.g., management fee as % of EGI
  percentKey?: string;            // key for the % value
  bold?: boolean;                 // render bold
  indent?: number;                // indentation level
  sign?: 'positive' | 'negative'; // for display (expenses show as negative)
}

export interface ProFormaConfig {
  lines: ProFormaLineConfig[];
  subtotals: {
    grossRevenue: string[];      // line keys that sum to gross revenue
    effectiveGross: string[];    // line keys for EGI
    totalExpenses: string[];     // line keys for total expenses
  };
}

// ---------------------------------------------------------------------------
// Asset class pro forma structures
// ---------------------------------------------------------------------------

const MARINA_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'wetSlipRevenue', label: 'Wet Slip Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'dryStorageRevenue', label: 'Dry Storage Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'fuelRevenue', label: 'Fuel Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'shipStoreRevenue', label: 'Ship Store Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'serviceRevenue', label: 'Service/Repair Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'fuelCOGS', label: 'Fuel COGS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'storeCOGS', label: 'Ship Store COGS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'managementFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['wetSlipRevenue', 'dryStorageRevenue', 'fuelRevenue', 'shipStoreRevenue', 'serviceRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['payroll', 'fuelCOGS', 'storeCOGS', 'utilities', 'insurance', 'propertyTax', 'maintenance', 'managementFee', 'otherExpenses'],
  },
};

const MULTIFAMILY_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'grossPotentialRent', label: 'Gross Potential Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'concessions', label: 'Less: Concessions', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'badDebt', label: 'Less: Bad Debt', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'effectiveRent', label: 'Effective Rental Income', category: 'subtotal', growthType: 'none', bold: true },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'propertyMgmt', label: 'Property Management', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'payroll', label: 'Payroll', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'admin', label: 'Admin & General', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['grossPotentialRent'],
    effectiveGross: ['effectiveRent', 'otherIncome'],
    totalExpenses: ['propertyMgmt', 'payroll', 'utilities', 'insurance', 'propertyTax', 'maintenance', 'admin', 'marketing', 'capReserves'],
  },
};

const STR_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'grossRentalIncome', label: 'Gross Rental Income', category: 'revenue', growthType: 'revenue' },
    { key: 'cleaningFeeIncome', label: 'Cleaning Fee Income', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'platformFees', label: 'Platform Fees', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'cleaning', label: 'Cleaning', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyMgmt', label: 'Property Management', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'hoa', label: 'HOA / Condo Fees', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'supplies', label: 'Supplies & Furnishing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['grossRentalIncome', 'cleaningFeeIncome', 'otherIncome'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['platformFees', 'cleaning', 'propertyMgmt', 'utilities', 'insurance', 'propertyTax', 'maintenance', 'hoa', 'supplies'],
  },
};

const SFR_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'grossPotentialRent', label: 'Gross Potential Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'effectiveRent', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'propertyMgmt', label: 'Property Management', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'hoa', label: 'HOA', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['grossPotentialRent'],
    effectiveGross: ['effectiveRent'],
    totalExpenses: ['propertyMgmt', 'insurance', 'propertyTax', 'utilities', 'maintenance', 'hoa', 'capReserves'],
  },
};

const HOTEL_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'roomRevenue', label: 'Room Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'fbRevenue', label: 'F&B Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'departmental', label: 'Departmental Expenses', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'undistributed', label: 'Undistributed Expenses', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'ffeReserve', label: 'FF&E Reserve', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['roomRevenue', 'fbRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['departmental', 'undistributed', 'mgmtFee', 'propertyTax', 'insurance', 'ffeReserve'],
  },
};

const BUSINESS_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'grossRevenue', label: 'Gross Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'cogs', label: 'Less: COGS', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'grossProfit', label: 'Gross Profit', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'payroll', label: 'Payroll', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'ownerSalary', label: "Owner's Salary", category: 'expense', growthType: 'fixed', sign: 'negative' },
    { key: 'rent', label: 'Rent', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'netIncome', label: 'Net Income', category: 'total', growthType: 'none', bold: true },
    { key: 'sde', label: "Seller's Discretionary Earnings", category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['grossRevenue'],
    effectiveGross: ['grossProfit'],
    totalExpenses: ['payroll', 'ownerSalary', 'rent', 'utilities', 'insurance', 'marketing', 'otherExpenses'],
  },
};

// ---------------------------------------------------------------------------
// Office
// ---------------------------------------------------------------------------

const OFFICE_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'baseRent', label: 'Base Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'expenseReimbursements', label: 'Expense Reimbursements', category: 'revenue', growthType: 'revenue' },
    { key: 'parkingIncome', label: 'Parking Income', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'payroll', label: 'Payroll / On-Site Staff', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'janitorial', label: 'Janitorial', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'security', label: 'Security', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'elevator', label: 'Elevator Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'landscaping', label: 'Landscaping', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['baseRent'],
    effectiveGross: ['egi'],
    totalExpenses: ['mgmtFee', 'payroll', 'propertyTax', 'insurance', 'utilities', 'janitorial', 'maintenance', 'security', 'elevator', 'landscaping', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Industrial
// ---------------------------------------------------------------------------

const INDUSTRIAL_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'baseRent', label: 'Base Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'nnnReimbursements', label: 'NNN Reimbursements', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'cam', label: 'CAM / Common Area', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['baseRent'],
    effectiveGross: ['egi'],
    totalExpenses: ['mgmtFee', 'propertyTax', 'insurance', 'cam', 'utilities', 'maintenance', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Medical Office
// ---------------------------------------------------------------------------

const MEDICAL_OFFICE_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'baseRent', label: 'Base Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'expenseReimbursements', label: 'Expense Reimbursements', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'janitorial', label: 'Janitorial / Biohazard', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'hvacMedical', label: 'HVAC / Medical-Grade Systems', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'security', label: 'Security', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'landscaping', label: 'Landscaping', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['baseRent'],
    effectiveGross: ['egi'],
    totalExpenses: ['mgmtFee', 'propertyTax', 'insurance', 'utilities', 'janitorial', 'maintenance', 'hvacMedical', 'security', 'landscaping', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Self Storage
// ---------------------------------------------------------------------------

const SELF_STORAGE_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'grossPotentialRent', label: 'Gross Potential Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'concessions', label: 'Less: Concessions / ECRI', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'insuranceIncome', label: 'Tenant Insurance Income', category: 'revenue', growthType: 'revenue' },
    { key: 'retailIncome', label: 'Retail / Supplies Income', category: 'revenue', growthType: 'revenue' },
    { key: 'truckRentalIncome', label: 'Truck Rental Income', category: 'revenue', growthType: 'revenue' },
    { key: 'lateFees', label: 'Late Fees / Admin Fees', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'payroll', label: 'Payroll', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'software', label: 'Software / Technology', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['grossPotentialRent'],
    effectiveGross: ['egi'],
    totalExpenses: ['mgmtFee', 'payroll', 'propertyTax', 'insurance', 'utilities', 'maintenance', 'marketing', 'software', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Laundromat
// ---------------------------------------------------------------------------

const LAUNDROMAT_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'washerRevenue', label: 'Washer Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'dryerRevenue', label: 'Dryer Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'wdfRevenue', label: 'Wash/Dry/Fold Service Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'vendingRevenue', label: 'Vending Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'supplies', label: 'Supplies (Soap/Chemicals)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'waterSewer', label: 'Water / Sewer', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'rent', label: 'Rent / Lease', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'gasElectric', label: 'Gas / Electric', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'payroll', label: 'Payroll / Attendant', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'equipmentMaint', label: 'Equipment Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'ebitda', label: 'EBITDA', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['washerRevenue', 'dryerRevenue', 'wdfRevenue', 'vendingRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['supplies', 'waterSewer', 'rent', 'gasElectric', 'payroll', 'equipmentMaint', 'insurance', 'propertyTax', 'marketing', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Car Wash
// ---------------------------------------------------------------------------

const CAR_WASH_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'selfServeRevenue', label: 'Self-Serve Bay Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'tunnelRevenue', label: 'Tunnel / Automatic Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'expressRevenue', label: 'Express Wash Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'detailRevenue', label: 'Detail Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'membershipRevenue', label: 'Membership / Subscription Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'vendingRevenue', label: 'Vending / Vacuum Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'chemistry', label: 'Chemistry / Chemicals', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'waterSewer', label: 'Water / Sewer', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'equipmentMaint', label: 'Equipment Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities (Electric/Gas)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'technology', label: 'Technology / POS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'ebitda', label: 'EBITDA', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['selfServeRevenue', 'tunnelRevenue', 'expressRevenue', 'detailRevenue', 'membershipRevenue', 'vendingRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['chemistry', 'waterSewer', 'equipmentMaint', 'payroll', 'utilities', 'insurance', 'propertyTax', 'marketing', 'technology', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Mixed-Use
// ---------------------------------------------------------------------------

const MIXED_USE_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'residentialRent', label: 'Residential Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'commercialRent', label: 'Commercial / Retail Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'camReimbursements', label: 'CAM Reimbursements', category: 'revenue', growthType: 'revenue' },
    { key: 'parkingIncome', label: 'Parking Income', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'payroll', label: 'Payroll', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'janitorial', label: 'Janitorial', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['residentialRent', 'commercialRent'],
    effectiveGross: ['egi'],
    totalExpenses: ['mgmtFee', 'payroll', 'propertyTax', 'insurance', 'utilities', 'maintenance', 'janitorial', 'marketing', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Shopping Center
// ---------------------------------------------------------------------------

const SHOPPING_CENTER_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'baseRent', label: 'Base Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'camRecovery', label: 'CAM Recovery', category: 'revenue', growthType: 'revenue' },
    { key: 'percentageRent', label: 'Percentage Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'outparcelRevenue', label: 'Outparcel / Pad Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'pylonSignRevenue', label: 'Pylon Sign Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'cam', label: 'CAM Expenses', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'security', label: 'Security', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing / Tenant Coordination', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'janitorial', label: 'Janitorial', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['baseRent'],
    effectiveGross: ['egi'],
    totalExpenses: ['mgmtFee', 'propertyTax', 'insurance', 'cam', 'maintenance', 'security', 'marketing', 'janitorial', 'utilities', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Golf Course
// ---------------------------------------------------------------------------

const GOLF_COURSE_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'greenFeeRevenue', label: 'Green Fee Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'membershipRevenue', label: 'Membership Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'cartRevenue', label: 'Cart Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'proShopRevenue', label: 'Pro Shop Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'fbRevenue', label: 'F&B Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'drivingRangeRevenue', label: 'Driving Range Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'tournamentRevenue', label: 'Tournament / Events Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'courseMaintenanceLabor', label: 'Course Maintenance — Labor', category: 'expense', growthType: 'expense', sign: 'negative', indent: 1 },
    { key: 'chemicals', label: 'Chemicals / Fertilizer', category: 'expense', growthType: 'expense', sign: 'negative', indent: 1 },
    { key: 'irrigation', label: 'Irrigation', category: 'expense', growthType: 'expense', sign: 'negative', indent: 1 },
    { key: 'equipmentLease', label: 'Equipment Lease / Maintenance', category: 'expense', growthType: 'expense', sign: 'negative', indent: 1 },
    { key: 'proShopCOGS', label: 'Pro Shop COGS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'fbCOGS', label: 'F&B COGS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'payroll', label: 'Payroll (Admin / Pro Staff)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'ebitda', label: 'EBITDA', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['greenFeeRevenue', 'membershipRevenue', 'cartRevenue', 'proShopRevenue', 'fbRevenue', 'drivingRangeRevenue', 'tournamentRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['courseMaintenanceLabor', 'chemicals', 'irrigation', 'equipmentLease', 'proShopCOGS', 'fbCOGS', 'payroll', 'insurance', 'propertyTax', 'marketing', 'utilities', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// RV Park
// ---------------------------------------------------------------------------

const RV_PARK_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'monthlySiteRevenue', label: 'Monthly / Seasonal Site Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'transientSiteRevenue', label: 'Transient / Nightly Site Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'campStoreRevenue', label: 'Camp Store Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'propaneRevenue', label: 'Propane Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'laundryRevenue', label: 'Laundry Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'activityFees', label: 'Activity / Amenity Fees', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Grounds', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'software', label: 'Software / Reservations', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['monthlySiteRevenue', 'transientSiteRevenue', 'campStoreRevenue', 'propaneRevenue', 'laundryRevenue', 'activityFees', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['mgmtFee', 'payroll', 'propertyTax', 'insurance', 'utilities', 'maintenance', 'marketing', 'software', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Restaurant
// ---------------------------------------------------------------------------

const RESTAURANT_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'foodRevenue', label: 'Food Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'beverageRevenue', label: 'Beverage Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'cateringRevenue', label: 'Catering Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'deliveryRevenue', label: 'Delivery / Takeout Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'foodCost', label: 'Food Cost (COGS)', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'beverageCost', label: 'Beverage Cost (COGS)', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'rent', label: 'Rent / Lease', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'supplies', label: 'Smallwares / Supplies', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'technology', label: 'Technology / POS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'netIncome', label: 'Net Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['foodRevenue', 'beverageRevenue', 'cateringRevenue', 'deliveryRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['foodCost', 'beverageCost', 'payroll', 'rent', 'utilities', 'insurance', 'marketing', 'supplies', 'technology', 'maintenance', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Gym / Fitness Center
// ---------------------------------------------------------------------------

const GYM_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'membershipRevenue', label: 'Membership Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'personalTrainingRevenue', label: 'Personal Training Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'classRevenue', label: 'Class / Group Fitness Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'retailRevenue', label: 'Retail / Pro Shop Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'juiceBarRevenue', label: 'Juice Bar / F&B Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'rent', label: 'Rent / Lease', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'equipmentLease', label: 'Equipment Lease / Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'software', label: 'Software / Member Management', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'cleaning', label: 'Cleaning / Janitorial', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Facility Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'ebitda', label: 'EBITDA', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['membershipRevenue', 'personalTrainingRevenue', 'classRevenue', 'retailRevenue', 'juiceBarRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['payroll', 'rent', 'utilities', 'insurance', 'equipmentLease', 'marketing', 'software', 'cleaning', 'maintenance', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Daycare
// ---------------------------------------------------------------------------

const DAYCARE_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'tuitionRevenue', label: 'Tuition / Enrollment Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'registrationFees', label: 'Registration Fees', category: 'revenue', growthType: 'revenue' },
    { key: 'afterSchoolRevenue', label: 'After-School / Drop-In Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'mealRevenue', label: 'Meal / Snack Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'subsidyRevenue', label: 'Government Subsidy Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'payroll', label: 'Payroll & Benefits (Teachers/Staff)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'rent', label: 'Rent / Lease', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'foodSupplies', label: 'Food & Supplies', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance (Liability/Property)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'curriculum', label: 'Curriculum / Educational Materials', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'licensing', label: 'Licensing / Compliance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'netIncome', label: 'Net Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['tuitionRevenue', 'registrationFees', 'afterSchoolRevenue', 'mealRevenue', 'subsidyRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['payroll', 'rent', 'foodSupplies', 'insurance', 'utilities', 'curriculum', 'licensing', 'marketing', 'maintenance', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Mobile Home Park
// ---------------------------------------------------------------------------

const MOBILE_HOME_PARK_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'lotRent', label: 'Lot Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'utilityReimbursement', label: 'Utility Reimbursement', category: 'revenue', growthType: 'revenue' },
    { key: 'homeSalesRevenue', label: 'Home Sales Revenue (POH)', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'payroll', label: 'Payroll', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities (Common Area)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'waterSewer', label: 'Water / Sewer', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'roadMaint', label: 'Road / Common Area Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['lotRent'],
    effectiveGross: ['egi'],
    totalExpenses: ['mgmtFee', 'payroll', 'propertyTax', 'insurance', 'utilities', 'waterSewer', 'roadMaint', 'marketing', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Parking (Garage / Surface Lot)
// ---------------------------------------------------------------------------

const PARKING_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'monthlyPermitRevenue', label: 'Monthly Permit Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'transientRevenue', label: 'Transient / Hourly Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'eventParkingRevenue', label: 'Event Parking Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'valetRevenue', label: 'Valet Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management / Operator Fee', category: 'expense', growthType: 'expense', isPercentOfRevenue: true, sign: 'negative' },
    { key: 'payroll', label: 'Payroll / Attendants', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities / Lighting', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'technology', label: 'Technology / Access Systems', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['monthlyPermitRevenue', 'transientRevenue', 'eventParkingRevenue', 'valetRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['mgmtFee', 'payroll', 'propertyTax', 'insurance', 'utilities', 'maintenance', 'technology', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Data Center
// ---------------------------------------------------------------------------

const DATA_CENTER_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'colocationRevenue', label: 'Colocation / Rack Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'managedServicesRevenue', label: 'Managed Services Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'interconnectRevenue', label: 'Interconnection / Cross-Connect Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'powerRevenue', label: 'Power Revenue (pass-through)', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'powerCost', label: 'Power / Electricity', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'cooling', label: 'Cooling / HVAC', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'bandwidth', label: 'Bandwidth / Connectivity', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'security', label: 'Security (Physical & Cyber)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'generatorFuel', label: 'Generator / Fuel', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['colocationRevenue', 'managedServicesRevenue', 'interconnectRevenue', 'powerRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['powerCost', 'cooling', 'payroll', 'bandwidth', 'insurance', 'propertyTax', 'security', 'maintenance', 'generatorFuel', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Car Dealership
// ---------------------------------------------------------------------------

const CAR_DEALERSHIP_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'newVehicleSales', label: 'New Vehicle Sales', category: 'revenue', growthType: 'revenue' },
    { key: 'usedVehicleSales', label: 'Used Vehicle Sales', category: 'revenue', growthType: 'revenue' },
    { key: 'financeInsuranceRevenue', label: 'F&I Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'serviceRevenue', label: 'Service Department Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'partsRevenue', label: 'Parts Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'bodyShopRevenue', label: 'Body Shop Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'vehicleCOGS', label: 'Vehicle COGS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'partsCOGS', label: 'Parts / Service COGS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'grossProfit', label: 'Gross Profit', category: 'subtotal', growthType: 'none', bold: true },
    { key: 'payroll', label: 'Payroll & Commissions', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'floorplan', label: 'Floorplan Interest', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'rent', label: 'Rent / Lease', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'advertising', label: 'Advertising', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'technology', label: 'Technology / DMS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Facility Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'netIncome', label: 'Net Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['newVehicleSales', 'usedVehicleSales', 'financeInsuranceRevenue', 'serviceRevenue', 'partsRevenue', 'bodyShopRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['vehicleCOGS', 'partsCOGS', 'payroll', 'floorplan', 'rent', 'advertising', 'insurance', 'utilities', 'technology', 'maintenance', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Gas Station / C-Store
// ---------------------------------------------------------------------------

const GAS_STATION_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'fuelRevenue', label: 'Fuel Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'cStoreRevenue', label: 'C-Store / Inside Sales Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'carWashRevenue', label: 'Car Wash Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'lotteryCommission', label: 'Lottery / ATM Commission', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'fuelCOGS', label: 'Fuel COGS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'merchandiseCOGS', label: 'Merchandise COGS', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'payroll', label: 'Payroll & Benefits', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'rent', label: 'Rent / Lease', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'creditCardFees', label: 'Credit Card Processing Fees', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'environmental', label: 'Environmental / Tank Compliance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance & Repairs', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'capReserves', label: 'Capital Reserves', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'netIncome', label: 'Net Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['fuelRevenue', 'cStoreRevenue', 'carWashRevenue', 'lotteryCommission', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['fuelCOGS', 'merchandiseCOGS', 'payroll', 'rent', 'utilities', 'insurance', 'propertyTax', 'creditCardFees', 'environmental', 'maintenance', 'capReserves'],
  },
};

// ---------------------------------------------------------------------------
// Landscaping Business
// ---------------------------------------------------------------------------

const LANDSCAPING_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'maintenanceContractRevenue', label: 'Maintenance Contract Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'designInstallRevenue', label: 'Design / Install Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'hardscapeRevenue', label: 'Hardscape Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'irrigationRevenue', label: 'Irrigation Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'snowRemovalRevenue', label: 'Snow Removal Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'materials', label: 'Materials / Plants / Supplies', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'payroll', label: 'Payroll & Benefits (Crews)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'vehicleFuel', label: 'Vehicle / Fuel', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'equipmentLease', label: 'Equipment Lease / Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance (GL / Workers Comp)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'rent', label: 'Yard / Office Rent', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'subcontractors', label: 'Subcontractors', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'netIncome', label: 'Net Income', category: 'total', growthType: 'none', bold: true },
    { key: 'sde', label: "Seller's Discretionary Earnings", category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['maintenanceContractRevenue', 'designInstallRevenue', 'hardscapeRevenue', 'irrigationRevenue', 'snowRemovalRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['materials', 'payroll', 'vehicleFuel', 'equipmentLease', 'insurance', 'rent', 'marketing', 'subcontractors', 'otherExpenses'],
  },
};

// ---------------------------------------------------------------------------
// Construction Company
// ---------------------------------------------------------------------------

const CONSTRUCTION_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'contractRevenue', label: 'Contract Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'changeOrderRevenue', label: 'Change Order Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'serviceRevenue', label: 'Service / Warranty Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'materialsCOGS', label: 'Materials / Supplies', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'directLabor', label: 'Direct Labor', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'subcontractors', label: 'Subcontractors', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'equipmentRental', label: 'Equipment Rental / Lease', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'vehicleFuel', label: 'Vehicle / Fuel', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance (GL / Workers Comp / Bonding)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'permits', label: 'Permits / Licensing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'officePayroll', label: 'Office Payroll / Admin', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'rent', label: 'Office / Yard Rent', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'netIncome', label: 'Net Income', category: 'total', growthType: 'none', bold: true },
    { key: 'sde', label: "Seller's Discretionary Earnings", category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['contractRevenue', 'changeOrderRevenue', 'serviceRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['materialsCOGS', 'directLabor', 'subcontractors', 'equipmentRental', 'vehicleFuel', 'insurance', 'permits', 'officePayroll', 'rent', 'marketing', 'otherExpenses'],
  },
};

// ---------------------------------------------------------------------------
// Accounting Firm
// ---------------------------------------------------------------------------

const ACCOUNTING_FIRM_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'taxPrepRevenue', label: 'Tax Preparation Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'bookkeepingRevenue', label: 'Bookkeeping Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'auditRevenue', label: 'Audit / Assurance Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'advisoryRevenue', label: 'Advisory / Consulting Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'payrollServicesRevenue', label: 'Payroll Services Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'otherRevenue', label: 'Other Revenue', category: 'revenue', growthType: 'revenue' },
    { key: 'totalRevenue', label: 'Total Revenue', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'payroll', label: 'Staff Payroll & Benefits', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'ownerComp', label: "Owner's Compensation", category: 'expense', growthType: 'fixed', sign: 'negative' },
    { key: 'rent', label: 'Office Rent', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'software', label: 'Software / Subscriptions', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance (E&O / GL)', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'continuing_ed', label: 'Continuing Education / CPE', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'marketing', label: 'Marketing', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'officeSupplies', label: 'Office Supplies', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'otherExpenses', label: 'Other Expenses', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'netIncome', label: 'Net Income', category: 'total', growthType: 'none', bold: true },
    { key: 'sde', label: "Seller's Discretionary Earnings", category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['taxPrepRevenue', 'bookkeepingRevenue', 'auditRevenue', 'advisoryRevenue', 'payrollServicesRevenue', 'otherRevenue'],
    effectiveGross: ['totalRevenue'],
    totalExpenses: ['payroll', 'ownerComp', 'rent', 'software', 'insurance', 'continuing_ed', 'marketing', 'utilities', 'officeSupplies', 'otherExpenses'],
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PRO_FORMA_REGISTRY: Record<string, ProFormaConfig> = {
  marina: MARINA_PRO_FORMA,
  multifamily: MULTIFAMILY_PRO_FORMA,
  hotel: HOTEL_PRO_FORMA,
  str: STR_PRO_FORMA,
  sfr: SFR_PRO_FORMA,
  duplex: SFR_PRO_FORMA,
  triplex: SFR_PRO_FORMA,
  quad: SFR_PRO_FORMA,
  business: BUSINESS_PRO_FORMA,
  office: OFFICE_PRO_FORMA,
  industrial: INDUSTRIAL_PRO_FORMA,
  medical_office: MEDICAL_OFFICE_PRO_FORMA,
  self_storage: SELF_STORAGE_PRO_FORMA,
  laundromat: LAUNDROMAT_PRO_FORMA,
  car_wash: CAR_WASH_PRO_FORMA,
  mixed_use: MIXED_USE_PRO_FORMA,
  shopping_center: SHOPPING_CENTER_PRO_FORMA,
  golf_course: GOLF_COURSE_PRO_FORMA,
  rv_park: RV_PARK_PRO_FORMA,
  restaurant: RESTAURANT_PRO_FORMA,
  gym: GYM_PRO_FORMA,
  daycare: DAYCARE_PRO_FORMA,
  mobile_home_park: MOBILE_HOME_PARK_PRO_FORMA,
  parking: PARKING_PRO_FORMA,
  data_center: DATA_CENTER_PRO_FORMA,
  car_dealership: CAR_DEALERSHIP_PRO_FORMA,
  gas_station: GAS_STATION_PRO_FORMA,
  landscaping: LANDSCAPING_PRO_FORMA,
  construction: CONSTRUCTION_PRO_FORMA,
  accounting_firm: ACCOUNTING_FIRM_PRO_FORMA,
};

const GENERIC_COMMERCIAL_PRO_FORMA: ProFormaConfig = {
  lines: [
    { key: 'baseRent', label: 'Base Rent', category: 'revenue', growthType: 'revenue' },
    { key: 'vacancyLoss', label: 'Less: Vacancy', category: 'revenue', growthType: 'revenue', sign: 'negative', indent: 1 },
    { key: 'reimbursements', label: 'Expense Reimbursements', category: 'revenue', growthType: 'revenue' },
    { key: 'otherIncome', label: 'Other Income', category: 'revenue', growthType: 'revenue' },
    { key: 'egi', label: 'Effective Gross Income', category: 'subtotal', growthType: 'none', bold: true },

    { key: 'mgmtFee', label: 'Management Fee', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'propertyTax', label: 'Property Tax', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'insurance', label: 'Insurance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'cam', label: 'CAM / Common Area', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'utilities', label: 'Utilities', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'maintenance', label: 'Maintenance', category: 'expense', growthType: 'expense', sign: 'negative' },
    { key: 'totalExpenses', label: 'Total Operating Expenses', category: 'subtotal', growthType: 'none', bold: true, sign: 'negative' },

    { key: 'noi', label: 'Net Operating Income', category: 'total', growthType: 'none', bold: true },
  ],
  subtotals: {
    grossRevenue: ['baseRent'],
    effectiveGross: ['egi'],
    totalExpenses: ['mgmtFee', 'propertyTax', 'insurance', 'cam', 'utilities', 'maintenance'],
  },
};

/**
 * Get the pro forma line config for an asset class.
 */
export function getProFormaConfig(assetClass: string): ProFormaConfig {
  return PRO_FORMA_REGISTRY[assetClass] ?? GENERIC_COMMERCIAL_PRO_FORMA;
}
