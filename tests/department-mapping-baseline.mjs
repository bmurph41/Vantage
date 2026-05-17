// Synthetic regression baseline for server/utils/department-mapping.ts inferDepartment().
// Promoted from /tmp/probe-infer-department.mjs on 2026-05-17 (Phase 1 Task 3 close-out).
//
// Catches silent drift in any of the three inferDepartment helpers
// (inferDepartmentMarina / inferDepartmentSTR / inferDepartmentMultifamily)
// and in the top-level switch dispatch.
//
// Three suites:
//   Suite 1A — Marina dispatch byte-identity (assetClass = marina === undefined === null)
//              MUST PASS. Any identity break means the default dispatch branch
//              has drifted from the marina branch.
//   Suite 1B — Marina routing baseline snapshot (informational; shows what marina
//              actually returns for each input today)
//   Suite 2  — STR routing assertions (26 cases)
//   Suite 3  — Multifamily routing assertions (40 cases)
//
// Intentional misses (Q5 simplification, BETA_MVP_SPEC.md Section 7.B) are
// flagged in their own section — these are by-design, not bugs.
//
//   npm run test:dept-mapping
//   npx tsx tests/department-mapping-baseline.mjs

import { inferDepartment } from '/home/runner/workspace/server/utils/department-mapping.ts';

let failed = 0;
let passed = 0;

function assertRoute(input, expected, ac) {
  const actual = inferDepartment(input, undefined, ac);
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ [${ac || 'default'}] "${input}" → got "${actual}", expected "${expected}"`);
  }
}

// ============================================
// SUITE 1A: Marina byte-identity across dispatch (marina === undefined === null)
// This is the MUST-PASS test for spec compliance.
// ============================================
console.log('=== Suite 1A: Marina dispatch byte-identity (marina === undefined === null) ===');

const MARINA_INPUTS = [
  'Wet Slip Rentals', 'Wet Slip 30ft', 'Dry Stack Indoor', 'Mooring Fees', 'Berth Annual',
  'Land Storage', 'Winter Storage', 'Fuel Sales', 'Diesel Revenue', 'Ship Store Revenue',
  'Merchandise Sales', 'Chandlery Income', 'Service Labor', 'Mechanic Hours', 'Bottom Paint Service',
  'Shrink Wrap Service', 'Boat Brokerage', 'New Boat Sales', 'Used Boat Purchase',
  'Payroll', 'Wages', 'Workers Comp', 'Medicare', 'Launch Service', 'Power Pedestal Income',
  'Amenity Income', 'Commercial Tenant Lease', 'Property Insurance', 'Property Tax',
  'Utilities Expense', 'Bank Fees', 'Legal Fees', 'Permit Fee', 'Security Service',
  'Advertising', 'Mystery Line Item XYZ',
];

let identityBreaks = 0;
const baselineSnapshot = [];
for (const input of MARINA_INPUTS) {
  const r1 = inferDepartment(input, undefined, 'marina');
  const r2 = inferDepartment(input, undefined, undefined);
  const r3 = inferDepartment(input, undefined, null);
  if (r1 !== r2 || r1 !== r3) {
    identityBreaks++;
    console.log(`  ✗ Identity break "${input}": marina=${r1}, undefined=${r2}, null=${r3}`);
  }
  baselineSnapshot.push([input, r1]);
}
console.log(`Suite 1A: ${MARINA_INPUTS.length} inputs × 3 dispatches; identity-breaks=${identityBreaks}`);
if (identityBreaks === 0) {
  console.log(`  ✓ All ${MARINA_INPUTS.length} inputs route identically across marina / undefined / null`);
}

// ============================================
// SUITE 1B: Marina baseline snapshot (informational — shows what marina actually returns)
// ============================================
console.log('\n=== Suite 1B: Marina dispatch baseline snapshot ===');
for (const [input, dept] of baselineSnapshot) {
  console.log(`  [marina] "${input}" → "${dept}"`);
}

// ============================================
// SUITE 2: STR routing assertions
// ============================================
console.log('\n=== Suite 2: STR routing ===');
const before2 = { p: passed, f: failed };

const STR_SAMPLES = [
  ['Gross Rental Income', 'Rental'],
  ['Rental Income', 'Rental'],
  ['Nightly Rate Revenue', 'Rental'],
  ['Booking Revenue', 'Rental'],
  ['Reservation Income', 'Rental'],
  ['Long Stay Revenue', 'Rental'],
  ['Resort Fee', 'Rental'],
  ['Amenity Fee', 'Rental'],
  ['Destination Fee', 'Rental'],
  ['Cleaning Fee Income', 'Cleaning'],
  ['Cleaning Service Cost', 'Cleaning'],
  ['Housekeeping Expense', 'Cleaning'],
  ['Turnover Cost', 'Cleaning'],
  ['Cleaning Service Fee', 'Cleaning'],
  ['Airbnb Host Service Fee', 'Platform Fees'],
  ['VRBO Commission', 'Platform Fees'],
  ['Booking.com Service Fee', 'Platform Fees'],
  ['Channel Manager Fee', 'Platform Fees'],
  ['Property Tax', 'Operating'],
  ['Utilities', 'Operating'],
  ['HOA Dues', 'Operating'],
  ['Internet Service', 'Operating'],
  ['Property Management Fee', 'Operating'],
  ['Repairs and Maintenance', 'Operating'],
  ['Supplies', 'Operating'],
  ['Insurance', 'Operating'],
];

for (const [input, expected] of STR_SAMPLES) {
  assertRoute(input, expected, 'str');
}
console.log(`Suite 2 (STR): ${STR_SAMPLES.length} samples. delta passed=${passed - before2.p} failed=${failed - before2.f}`);

// ============================================
// SUITE 3: Multifamily routing assertions
// ============================================
console.log('\n=== Suite 3: Multifamily routing ===');
const before3 = { p: passed, f: failed };

const MF_SAMPLES = [
  ['Gross Potential Rent', 'Rental'],
  ['GPR', 'Rental'],
  ['Scheduled Rent', 'Rental'],
  ['Rental Income', 'Rental'],
  ['Vacancy', 'Rental'],
  ['Concessions', 'Rental'],
  ['Bad Debt', 'Rental'],
  ['Loss to Lease', 'Rental'],
  ['Apartment Rent Revenue', 'Rental'],
  ['Rent Expense', 'Operating'],
  ['Lease Expense', 'Operating'],
  ['Ground Lease', 'Operating'],
  ['Equipment Rental', 'Operating'],
  ['Pet Rent', 'Other Income'],
  ['Storage Rent', 'Other Income'],
  ['Parking Income', 'Other Income'],
  ['Laundry Revenue', 'Other Income'],
  ['Vending Revenue', 'Other Income'],
  ['Utility Reimbursement', 'Other Income'],
  ['RUBS', 'Other Income'],
  ['Property Management Fee', 'Mgmt Fee'],
  ['PM Fee', 'Mgmt Fee'],
  ['Asset Management', 'Mgmt Fee'],
  ['Payroll', 'Payroll'],
  ['On-site Manager Wages', 'Payroll'],
  ['Workers Comp', 'Payroll'],
  ['Health Insurance', 'Payroll'],
  ['Water/Sewer', 'Utilities'],
  ['Electric', 'Utilities'],
  ['Gas', 'Utilities'],
  ['Trash Removal', 'Utilities'],
  ['Telephone', 'Utilities'],
  ['R&M', 'R&M'],
  ['Repairs and Maintenance', 'R&M'],
  ['Make-Ready', 'R&M'],
  ['HVAC Repair', 'R&M'],
  ['Plumbing', 'R&M'],
  ['Property Tax', 'Operating'],
  ['Insurance', 'Operating'],
  ['Marketing', 'Operating'],
];

for (const [input, expected] of MF_SAMPLES) {
  assertRoute(input, expected, 'multifamily');
}
console.log(`Suite 3 (MF): ${MF_SAMPLES.length} samples. delta passed=${passed - before3.p} failed=${failed - before3.f}`);

// ============================================
// INTENTIONAL MISSES (Q5 simplification, BETA_MVP_SPEC.md Section 7.B / 3.5)
// These route to Operating/Utilities by design; not failures. Revisit post-MVP
// when real friendly P&L data shows whether this is common enough to fix.
// ============================================
console.log('\n=== INTENTIONAL MISSES (by design, NOT failures) ===');
const INTENTIONAL = [
  ['Late Fee', 'Operating', 'multifamily', 'Q5: dropped from Other Income (ambiguous vs bank/CC late fee)'],
  ['Application Fee', 'Operating', 'multifamily', 'Q5: dropped (rare keyword)'],
  ['Pest Control Fee', 'Operating', 'multifamily', 'Q5: dropped to avoid cat-conditional logic'],
  ['Natural Gas Reimbursement', 'Utilities', 'multifamily', 'Q5: Other Income only matches exact "utility reimbursement"; "natural gas reimbursement" falls to Utilities via "gas" keyword. See BETA_MVP_SPEC Section 3.5 "Reimbursement routing for Multifamily".'],
];
for (const [input, expected, ac, why] of INTENTIONAL) {
  const got = inferDepartment(input, undefined, ac);
  const mark = got === expected ? 'matches Q5 intent' : 'unexpected — surface for review';
  console.log(`  [${ac}] "${input}" → "${got}" (${mark}). ${why}`);
}

// ============================================
// SUMMARY
// ============================================
console.log(`\n=== TOTAL ===`);
console.log(`Suite 2+3 explicit asserts: passed=${passed} failed=${failed}`);
console.log(`Suite 1A identity-breaks: ${identityBreaks}`);
console.log(`${failed === 0 && identityBreaks === 0 ? '✓ ALL PASS' : '✗ FAILURES'}`);
process.exit(failed === 0 && identityBreaks === 0 ? 0 : 1);
