// WS4-prep — Golden-number regression harness for department inference.
//
// PURPOSE
//   Before WS4 (department-inference consolidation) touches inferDepartment,
//   this harness snapshots the department-driven outputs into a golden baseline
//   so any WS4 change is a CAUGHT DIFF, never a silent number shift.
//
// WHAT IT CAPTURES (per the WS4-prep Phase 0 design)
//   Primary  — the inferred `department` for a fixed input set, across four
//              dispatch modes. If department-per-label is unchanged, every
//              downstream consumer (growth-rate lookup, granular-margin lookup,
//              getOccupancyAdjustment, ...) is unchanged by definition.
//   Secondary— `assumptionKey` (departmentToAssumptionKey — the engine's lookup
//              pivot) and a `syntheticNOI` per asset-class scenario, computed
//              with a fixed synthetic assumption table that mirrors the
//              pro-forma engine's department -> key -> growth-rate arithmetic.
//
// SEAM — pure functions only, no DB, no engine change:
//   • server inferDepartment           (server/utils/department-mapping.ts shim → shared/coa/)
//   • server departmentToAssumptionKey (same file)
//   • client inferDepartment           (client imports @shared/coa/department-mapping — WS4 Piece B)
//
// The four dispatch modes per input:
//   serverNative    — inferDepartment(label, category, <scenario asset class>)
//                     the class the pro-forma engine threads when present.
//   serverUndefined — inferDepartment(label, category, undefined)
//                     the WRITER path: canonical-actuals-loader.ts:293 and
//                     promote-to-actuals.ts:147 pass undefined, so this is what
//                     gets written onto modeling_actuals.department. The bug
//                     surface — non-marina deals run the marina cascade here.
//   serverMarina    — inferDepartment(label, category, 'marina')
//                     explicit marina; confirms marina === undefined identity.
//   client          — inferDepartment(label, category, <scenario asset class>)
//                     post-WS4-Piece-B the client imports the shared inferDepartment
//                     and threads the project's asset class — identical to serverNative.
//                     The drifted marina-only client copy was retired.
//
// The golden captures CURRENT behavior INCLUDING current bugs (the marina
// cascade running on non-marina deals). That is intentional: WS4 fixing that
// bug must produce a VISIBLE, reviewed diff — not a silent change.
//
// USAGE
//   npx tsx tests/department-inference-golden.mjs            # diff vs golden, exit 1 on any diff
//   npx tsx tests/department-inference-golden.mjs --update   # regenerate the golden baseline
//   npm run test:dept-golden

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inferDepartment, departmentToAssumptionKey } from '/home/runner/workspace/server/utils/department-mapping.ts';

const GOLDEN_PATH = '/home/runner/workspace/tests/department-inference-golden.json';
const UPDATE = process.argv.includes('--update');

// ── Scenario -> asset-class string fed to inferDepartment ────────────────────
// marina/multifamily/str have dedicated branches; self_storage/office/retail
// have NO branch and fall through to the marina `default` cascade — exactly the
// WS4 risk (non-marina classes routed by marina taxonomy).
const SCENARIO_ASSET_CLASS = {
  marina: 'marina',
  multifamily: 'multifamily',
  str: 'str',
  self_storage: 'self_storage',
  office: 'office',
  retail: 'retail',
};

// ── Fixed synthetic assumption table ─────────────────────────────────────────
// Distinct growth rate (%/yr) per assumption key, so a department re-route
// produces a visible syntheticNOI delta. Mirrors granularGrowthRates keyed by
// departmentToAssumptionKey() in pro-forma-engine-service.ts. g_and_a is the
// catch-all (departmentToAssumptionKey's `default`).
const SYNTHETIC_GROWTH = {
  storage: 4.0, fuel_dock: 1.5, ship_store: 2.5, service: 3.5,
  boat_sales: 2.0, boat_brokerage: 3.0, rental_boats: 4.5, boat_club: 5.0,
  boat_finance: 2.2, marina_amenities: 3.8, commercial_tenants: 2.8,
  commercial_leases: 2.9, restaurant: 3.3, rv_sites: 4.1, hospitality: 3.6,
  parts: 2.7, misc_revenue: 1.0, payroll: 3.2, g_and_a: 2.6,
};
const PROJECTION_YEARS = 5;
// Fixed base amounts by category — deterministic, no DB.
const BASE_AMOUNT = { revenue: 1_000_000, cogs: 400_000, expense: 300_000 };

// ── Input set — constructed synthetic P&L labels across asset classes ────────
// { label, category: 'revenue'|'cogs'|'expense', scenario }
const INPUTS = [
  // ─── Marina (the "right" cascade) ───────────────────────────────────────
  ['Wet Slip Rentals', 'revenue', 'marina'],
  ['Dry Storage', 'revenue', 'marina'],
  ['Mooring Fees', 'revenue', 'marina'],
  ['Transient Dockage', 'revenue', 'marina'],
  ['Live Aboard Fees', 'revenue', 'marina'],
  ['Gasoline Sales', 'revenue', 'marina'],
  ['Diesel Revenue', 'revenue', 'marina'],
  ['Ship Store Merchandise', 'revenue', 'marina'],
  ['Chandlery Income', 'revenue', 'marina'],
  ['Service Labor', 'revenue', 'marina'],
  ['Bottom Paint Service', 'revenue', 'marina'],
  ['Boat Brokerage Commission', 'revenue', 'marina'],
  ['New Boat Sales', 'revenue', 'marina'],
  ['Used Boat Sales', 'revenue', 'marina'],
  ['Launch & Haul Fees', 'revenue', 'marina'],
  ['Power Pedestal Income', 'revenue', 'marina'],
  ['Pump Out Fees', 'revenue', 'marina'],
  ['Cost of Gas', 'cogs', 'marina'],
  ['Cost of Diesel', 'cogs', 'marina'],
  ['Store COGS', 'cogs', 'marina'],
  ['Parts Cost', 'cogs', 'marina'],
  ['Boat Sales COGS', 'cogs', 'marina'],
  ['Payroll Wages', 'expense', 'marina'],
  ['Workers Comp', 'expense', 'marina'],
  ['Property Insurance', 'expense', 'marina'],
  ['Property Tax', 'expense', 'marina'],
  ['Electric Expense', 'expense', 'marina'],
  ['Dock Repairs & Maintenance', 'expense', 'marina'],
  ['Advertising', 'expense', 'marina'],
  ['Legal Fees', 'expense', 'marina'],
  ['Bank & Credit Card Fees', 'expense', 'marina'],
  ['Permit Fee', 'expense', 'marina'],
  ['Security Service', 'expense', 'marina'],
  ['Mystery Line Item XYZ', 'expense', 'marina'],

  // ─── Multifamily ────────────────────────────────────────────────────────
  ['Gross Potential Rent', 'revenue', 'multifamily'],
  ['Scheduled Rent', 'revenue', 'multifamily'],
  ['Vacancy Loss', 'revenue', 'multifamily'],
  ['Concessions', 'revenue', 'multifamily'],
  ['Bad Debt', 'revenue', 'multifamily'],
  ['Loss to Lease', 'revenue', 'multifamily'],
  ['Pet Rent', 'revenue', 'multifamily'],
  ['Parking Income', 'revenue', 'multifamily'],
  ['Laundry Revenue', 'revenue', 'multifamily'],
  ['RUBS Income', 'revenue', 'multifamily'],
  ['Utility Reimbursement', 'revenue', 'multifamily'],
  ['Property Management Fee', 'expense', 'multifamily'],
  ['On-site Manager Wages', 'expense', 'multifamily'],
  ['Health Insurance', 'expense', 'multifamily'],
  ['Water/Sewer', 'expense', 'multifamily'],
  ['Electric', 'expense', 'multifamily'],
  ['Trash Removal', 'expense', 'multifamily'],
  ['R&M', 'expense', 'multifamily'],
  ['Make-Ready', 'expense', 'multifamily'],
  ['HVAC Repair', 'expense', 'multifamily'],
  ['Property Tax', 'expense', 'multifamily'],
  ['Insurance', 'expense', 'multifamily'],
  ['Marketing', 'expense', 'multifamily'],
  ['Legal', 'expense', 'multifamily'],

  // ─── STR (short-term rental) ────────────────────────────────────────────
  ['Gross Rental Income', 'revenue', 'str'],
  ['Booking Revenue', 'revenue', 'str'],
  ['Reservation Income', 'revenue', 'str'],
  ['Nightly Rate Revenue', 'revenue', 'str'],
  ['Resort Fee', 'revenue', 'str'],
  ['Cleaning Fee Income', 'revenue', 'str'],
  ['Cleaning Service Cost', 'expense', 'str'],
  ['Housekeeping Expense', 'expense', 'str'],
  ['Airbnb Host Service Fee', 'expense', 'str'],
  ['VRBO Commission', 'expense', 'str'],
  ['Channel Manager Fee', 'expense', 'str'],
  ['Property Management Fee', 'expense', 'str'],
  ['Utilities', 'expense', 'str'],
  ['Property Tax', 'expense', 'str'],
  ['Insurance', 'expense', 'str'],
  ['Supplies', 'expense', 'str'],

  // ─── Self-storage (no dedicated branch -> marina default cascade) ───────
  ['Storage Unit Rent', 'revenue', 'self_storage'],
  ['Climate Controlled Unit Revenue', 'revenue', 'self_storage'],
  ['Tenant Insurance Income', 'revenue', 'self_storage'],
  ['Late Fee Income', 'revenue', 'self_storage'],
  ['Admin Fee', 'revenue', 'self_storage'],
  ['Property Management Fee', 'expense', 'self_storage'],
  ['On-site Manager Wages', 'expense', 'self_storage'],
  ['Property Insurance', 'expense', 'self_storage'],
  ['Property Tax', 'expense', 'self_storage'],
  ['Utilities', 'expense', 'self_storage'],
  ['Repairs & Maintenance', 'expense', 'self_storage'],
  ['Advertising', 'expense', 'self_storage'],

  // ─── Office (no dedicated branch -> marina default cascade) ─────────────
  ['Base Rent', 'revenue', 'office'],
  ['Expense Reimbursements', 'revenue', 'office'],
  ['Parking Income', 'revenue', 'office'],
  ['CAM Recovery', 'revenue', 'office'],
  ['Property Management Fee', 'expense', 'office'],
  ['Janitorial Service', 'expense', 'office'],
  ['Property Insurance', 'expense', 'office'],
  ['Property Tax', 'expense', 'office'],
  ['Utilities', 'expense', 'office'],
  ['Repairs & Maintenance', 'expense', 'office'],
  ['Leasing Commissions', 'expense', 'office'],

  // ─── Retail (no dedicated branch -> marina default cascade) ─────────────
  ['Base Rent', 'revenue', 'retail'],
  ['Percentage Rent', 'revenue', 'retail'],
  ['CAM Recovery', 'revenue', 'retail'],
  ['Pad Site Rent', 'revenue', 'retail'],
  ['Property Management Fee', 'expense', 'retail'],
  ['Property Insurance', 'expense', 'retail'],
  ['Property Tax', 'expense', 'retail'],
  ['Common Area Maintenance', 'expense', 'retail'],
  ['Marketing', 'expense', 'retail'],
  ['Security Service', 'expense', 'retail'],
].map(([label, category, scenario]) => ({ label, category, scenario }));

// ── Compute the current snapshot ─────────────────────────────────────────────
function computeSnapshot() {
  const inferences = INPUTS.map(({ label, category, scenario }) => {
    const ac = SCENARIO_ASSET_CLASS[scenario];
    const dNative = inferDepartment(label, category, ac);
    const dUndef = inferDepartment(label, category, undefined);
    const dMarina = inferDepartment(label, category, 'marina');
    const dClient = inferDepartment(label, category, ac); // WS4 Piece B — client now uses shared inferDepartment(ac)
    return {
      label, category, scenario,
      department: {
        serverNative: dNative,
        serverUndefined: dUndef,
        serverMarina: dMarina,
        client: dClient,
      },
      assumptionKey: {
        serverNative: departmentToAssumptionKey(dNative),
        serverUndefined: departmentToAssumptionKey(dUndef),
        serverMarina: departmentToAssumptionKey(dMarina),
        client: departmentToAssumptionKey(dClient),
      },
    };
  });

  // Synthetic NOI per scenario — two paths:
  //   enginePath = serverNative dispatch (pro-forma engine's threaded class)
  //   writerPath = serverUndefined dispatch (the actuals-writer path; this is
  //               what actually lands on modeling_actuals today). For marina
  //               the two are identical; for non-marina the gap quantifies the
  //               marina-cascade bug's effect on projected NOI.
  const projectLine = (rec, mode) => {
    const key = rec.assumptionKey[mode];
    const rate = (SYNTHETIC_GROWTH[key] ?? SYNTHETIC_GROWTH.g_and_a) / 100;
    const base = BASE_AMOUNT[rec.category];
    return Math.round(base * Math.pow(1 + rate, PROJECTION_YEARS));
  };
  const syntheticProjections = {};
  for (const scenario of Object.keys(SCENARIO_ASSET_CLASS)) {
    const rows = inferences.filter(r => r.scenario === scenario);
    const noi = (mode) => rows.reduce((sum, r) => {
      const projected = projectLine(r, mode);
      return sum + (r.category === 'revenue' ? projected : -projected);
    }, 0);
    syntheticProjections[scenario] = {
      revenueLines: rows.filter(r => r.category === 'revenue').length,
      expenseLines: rows.filter(r => r.category !== 'revenue').length,
      syntheticNOI_enginePath: noi('serverNative'),
      syntheticNOI_writerPath: noi('serverUndefined'),
    };
  }

  return {
    _meta: {
      harness: 'tests/department-inference-golden.mjs',
      description: 'WS4-prep golden baseline for department inference. Captures CURRENT behavior (bugs included). Regenerate with --update; any non-empty diff during WS4 must be reviewed.',
      inputCount: INPUTS.length,
      projectionYears: PROJECTION_YEARS,
    },
    inferences,
    syntheticProjections,
  };
}

// ── Deep diff (ignores _meta) ────────────────────────────────────────────────
function diff(golden, current, path, out) {
  if (typeof golden !== 'object' || golden === null ||
      typeof current !== 'object' || current === null) {
    if (golden !== current) out.push(`  ${path}: ${JSON.stringify(golden)} -> ${JSON.stringify(current)}`);
    return;
  }
  const keys = new Set([...Object.keys(golden), ...Object.keys(current)]);
  for (const k of keys) {
    if (!(k in golden)) { out.push(`  ${path}/${k}: (absent) -> ${JSON.stringify(current[k])}`); continue; }
    if (!(k in current)) { out.push(`  ${path}/${k}: ${JSON.stringify(golden[k])} -> (absent)`); continue; }
    diff(golden[k], current[k], `${path}/${k}`, out);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const snapshot = computeSnapshot();

if (UPDATE) {
  writeFileSync(GOLDEN_PATH, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`✓ Golden baseline written — ${snapshot.inferences.length} inputs, ${Object.keys(snapshot.syntheticProjections).length} scenarios`);
  console.log(`  ${GOLDEN_PATH}`);
  process.exit(0);
}

if (!existsSync(GOLDEN_PATH)) {
  console.error(`✗ No golden baseline at ${GOLDEN_PATH}`);
  console.error(`  Run with --update to create it.`);
  process.exit(1);
}

const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
const out = [];
diff(golden.inferences, snapshot.inferences, 'inferences', out);
diff(golden.syntheticProjections, snapshot.syntheticProjections, 'syntheticProjections', out);

console.log(`=== Department-inference golden harness ===`);
console.log(`Inputs: ${snapshot.inferences.length}  ·  Scenarios: ${Object.keys(snapshot.syntheticProjections).length}`);
for (const [scenario, p] of Object.entries(snapshot.syntheticProjections)) {
  const gap = p.syntheticNOI_enginePath - p.syntheticNOI_writerPath;
  console.log(`  ${scenario.padEnd(13)} syntheticNOI engine=${p.syntheticNOI_enginePath}  writer=${p.syntheticNOI_writerPath}  gap=${gap}`);
}

if (out.length === 0) {
  console.log(`\n✓ GREEN — zero diff vs golden baseline. Department-driven behavior preserved.`);
  process.exit(0);
} else {
  console.log(`\n✗ DIFF vs golden baseline (${out.length} field(s)) — review before accepting:`);
  out.forEach(line => console.log(line));
  console.log(`\nIf this diff is an intended WS4 change, regenerate with --update and commit the new golden.`);
  process.exit(1);
}
