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
  // Commercial types default to a simplified structure
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
