#!/usr/bin/env node
/**
 * fix-department-mapping.mjs
 *
 * Two fixes:
 *  1. department-mapping.ts — add EXPENSE_DEPT_LABELS + REVENUE_COGS_DEPT_LABELS
 *     key→label translation so 'taxes'→'Taxes', 'insurance'→'Insurance', etc.
 *  2. doc-intel-service.ts — translate dept keys to display labels before writing
 *     to modelingActuals.department so Historical P&L and Pro Forma match correctly.
 *
 * Run: node ~/workspace/fix-department-mapping.mjs
 */

import fs from 'fs';

const WS = process.env.HOME + '/workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Patch department-mapping.ts
// ═══════════════════════════════════════════════════════════════════════════════

const DEPT_MAP = `${WS}/server/utils/department-mapping.ts`;
let deptSrc = fs.readFileSync(DEPT_MAP, 'utf8');
const deptOriginal = deptSrc;

// Add the two translation maps and an enhanced normalizeDepartment right before
// the existing normalizeDepartment function

const NORMALIZE_FN = `export function normalizeDepartment(dept: string): string {
  if (!dept) return 'General';
  const trimmed = dept.trim();
  if (VALID_DEPARTMENTS.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (LEGACY_DEPARTMENT_MAP[lower]) return LEGACY_DEPARTMENT_MAP[lower];
  return 'General';
}`;

const NEW_NORMALIZE_FN = `// ─── Expense department key → display label (from EXPENSE_DEPT_LABELS) ─────────
// These are the keys used in the PLReviewGrid (expenseDeptConfirmed field)
export const EXPENSE_DEPT_KEY_TO_LABEL: Record<string, string> = {
  payroll: 'Payroll',
  general_admin: 'General & Administrative',
  advertising: 'Advertising',
  repairs_maintenance: 'Repairs & Maintenance',
  utilities: 'Utilities',
  licenses_permits: 'Licenses & Permits',
  security_contract_services: 'Security & Contract Services',
  bank_cc_fees: 'Bank & Credit Card Fees',
  professional_services: 'Professional Services',
  insurance: 'Insurance',
  taxes: 'Taxes',
  leases: 'Leases',
  fb: 'F&B',
  service: 'Service',
  parts: 'Parts',
  rv_park: 'RV Park',
  hospitality_lodging: 'Hospitality/Lodging',
  miscellaneous: 'Miscellaneous',
};

// Revenue/COGS department key → display label (from REVENUE_COGS_DEPT_LABELS)
export const REVENUE_COGS_DEPT_KEY_TO_LABEL: Record<string, string> = {
  storage: 'Storage',
  fuel: 'Fuel',
  marina_amenities: 'Marina & Amenities',
  ship_store_retail: "Ship's Store",
  service: 'Service',
  parts: 'Parts',
  third_party_leases: 'Third Party Leases',
  commercial_leases: 'Commercial Leases',
  boat_club: 'Boat Club',
  boat_rentals: 'Boat Rentals',
  boat_sales: 'Boat Sales',
  boat_brokerage: 'Boat Brokerage',
  boat_finance: 'Boat Finance',
  fb: 'F&B',
  rv_park: 'RV Park',
  hospitality_lodging: 'Hospitality/Lodging',
  miscellaneous: 'Miscellaneous',
};

/**
 * Translate a dept key (from expenseDeptConfirmed / revenueCogsDeptConfirmed)
 * to its display label for storage in modelingActuals.department.
 *
 * e.g. 'taxes' → 'Taxes', 'repairs_maintenance' → 'Repairs & Maintenance'
 *      'storage' → 'Storage', 'bank_cc_fees' → 'Bank & Credit Card Fees'
 */
export function deptKeyToLabel(key: string, tier?: string): string {
  if (!key) return 'General';
  // Try expense map first (most common for expense items)
  if (EXPENSE_DEPT_KEY_TO_LABEL[key]) return EXPENSE_DEPT_KEY_TO_LABEL[key];
  // Try revenue/cogs map
  if (REVENUE_COGS_DEPT_KEY_TO_LABEL[key]) return REVENUE_COGS_DEPT_KEY_TO_LABEL[key];
  // Already a display label? Pass through
  if (VALID_DEPARTMENTS.has(key)) return key;
  // Titlecase fallback for unknown keys
  return key.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
}

export function normalizeDepartment(dept: string): string {
  if (!dept) return 'General';
  const trimmed = dept.trim();
  // Already a valid display-label department
  if (VALID_DEPARTMENTS.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  // Expense dept key (e.g. 'taxes', 'bank_cc_fees')
  if (EXPENSE_DEPT_KEY_TO_LABEL[lower]) return EXPENSE_DEPT_KEY_TO_LABEL[lower];
  // Revenue/cogs dept key (e.g. 'storage', 'fuel')
  if (REVENUE_COGS_DEPT_KEY_TO_LABEL[lower]) return REVENUE_COGS_DEPT_KEY_TO_LABEL[lower];
  // Legacy map
  if (LEGACY_DEPARTMENT_MAP[lower]) return LEGACY_DEPARTMENT_MAP[lower];
  return 'General';
}`;

if (!deptSrc.includes('EXPENSE_DEPT_KEY_TO_LABEL')) {
  deptSrc = deptSrc.replace(NORMALIZE_FN, NEW_NORMALIZE_FN);
  if (deptSrc !== deptOriginal) {
    fs.writeFileSync(DEPT_MAP, deptSrc, 'utf8');
    console.log('✅ department-mapping.ts: added deptKeyToLabel() + enhanced normalizeDepartment()');
  } else {
    console.error('❌ Could not find normalizeDepartment() pattern in department-mapping.ts');
    process.exit(1);
  }
} else {
  console.log('ℹ️  department-mapping.ts already patched');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Patch doc-intel-service.ts — use deptKeyToLabel before writing to actuals
// ═══════════════════════════════════════════════════════════════════════════════

const SERVICE = `${WS}/server/services/doc-intel-service.ts`;
let svc = fs.readFileSync(SERVICE, 'utf8');
const svcOriginal = svc;

// Add deptKeyToLabel to the import from department-mapping
const OLD_DEPT_IMPORT = `const { inferDepartment: inferDeptForActual } = await import('../utils/department-mapping');`;
const NEW_DEPT_IMPORT = `const { inferDepartment: inferDeptForActual, deptKeyToLabel } = await import('../utils/department-mapping');`;

if (!svc.includes('deptKeyToLabel')) {
  svc = svc.replace(OLD_DEPT_IMPORT, NEW_DEPT_IMPORT);
  if (svc === svcOriginal) {
    // Try static import version
    const STATIC_IMPORT = `import { inferDepartment`;
    if (svc.includes(STATIC_IMPORT)) {
      svc = svc.replace(
        /import \{ inferDepartment([^}]*)\} from ['"]\.\.\/utils\/department-mapping['"]/,
        (m) => m.replace('inferDepartment', 'inferDepartment').replace('{', '{ deptKeyToLabel, ')
      );
    }
  }
}

// Patch the confirmed dept resolution block to translate keys to labels
const OLD_DEPT_BLOCK = `      // Check tier-specific confirmed departments first (from PLReviewGrid)
      // Note: plCategory is "Revenue"/"COGS"/"Expenses" but tier fields use lowercase
      const tierLower = plCategory?.toLowerCase() || '';
      if ((tierLower === 'revenue' || tierLower === 'cogs') && item.revenueCogsDeptConfirmed) {
        inferredDept = item.revenueCogsDeptConfirmed;
        deptSource = 'revenueCogsDeptConfirmed';
      } else if ((tierLower === 'expenses' || tierLower === 'expense') && item.expenseDeptConfirmed) {
        inferredDept = item.expenseDeptConfirmed;
        deptSource = 'expenseDeptConfirmed';
      } else if (item.departmentConfirmed) {
        // Legacy confirm path
        inferredDept = item.departmentConfirmed;
        deptSource = 'departmentConfirmed';
      } else {
        // No user confirmation — fall back to heuristic inference
        inferredDept = inferDeptForActual(subcategory, plCategory);
        deptSource = 'inferred';
      }`;

const NEW_DEPT_BLOCK = `      // Check tier-specific confirmed departments first (from PLReviewGrid)
      // Note: plCategory is "Revenue"/"COGS"/"Expenses" but tier fields use lowercase
      // IMPORTANT: dept values are stored as keys (e.g. 'taxes', 'bank_cc_fees') —
      // translate to display labels (e.g. 'Taxes', 'Bank & Credit Card Fees') for
      // modelingActuals so Historical P&L and Pro Forma group correctly.
      const tierLower = plCategory?.toLowerCase() || '';
      if ((tierLower === 'revenue' || tierLower === 'cogs') && item.revenueCogsDeptConfirmed) {
        inferredDept = deptKeyToLabel(item.revenueCogsDeptConfirmed, 'revenue');
        deptSource = 'revenueCogsDeptConfirmed';
      } else if ((tierLower === 'expenses' || tierLower === 'expense') && item.expenseDeptConfirmed) {
        inferredDept = deptKeyToLabel(item.expenseDeptConfirmed, 'expense');
        deptSource = 'expenseDeptConfirmed';
      } else if (item.departmentConfirmed) {
        // Legacy confirm path — also translate in case it's a key
        inferredDept = deptKeyToLabel(item.departmentConfirmed);
        deptSource = 'departmentConfirmed';
      } else {
        // No user confirmation — fall back to heuristic inference
        inferredDept = inferDeptForActual(subcategory, plCategory);
        deptSource = 'inferred';
      }`;

if (!svc.includes('translate to display labels')) {
  if (svc.includes(OLD_DEPT_BLOCK)) {
    svc = svc.replace(OLD_DEPT_BLOCK, NEW_DEPT_BLOCK);
    console.log('✅ doc-intel-service.ts: dept keys now translated to display labels before writing to modelingActuals');
  } else {
    console.error('❌ Could not find dept resolution block in doc-intel-service.ts — may need manual patch');
    console.error('   Look for "revenueCogsDeptConfirmed" in importConfirmedItems()');
    process.exit(1);
  }
}

if (svc !== svcOriginal) {
  fs.writeFileSync(SERVICE, svc, 'utf8');
  console.log('✅ doc-intel-service.ts saved');
} else {
  console.log('ℹ️  doc-intel-service.ts unchanged');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Quick verification — print the key→label mappings for confirmation
// ═══════════════════════════════════════════════════════════════════════════════
console.log('');
console.log('Dept key → label translations now active:');
const expenseKeys = {
  taxes: 'Taxes', insurance: 'Insurance', utilities: 'Utilities',
  repairs_maintenance: 'Repairs & Maintenance', bank_cc_fees: 'Bank & Credit Card Fees',
  professional_services: 'Professional Services', licenses_permits: 'Licenses & Permits',
  payroll: 'Payroll', general_admin: 'General & Administrative',
  advertising: 'Advertising', security_contract_services: 'Security & Contract Services',
  leases: 'Leases', miscellaneous: 'Miscellaneous',
};
for (const [k, v] of Object.entries(expenseKeys)) {
  console.log(`  expense.${k.padEnd(30)} → "${v}"`);
}
console.log('');
console.log('Restart the server, then re-import any already-confirmed documents');
console.log('(click "Refresh Actuals" or re-confirm items) to get correct dept labels.');
