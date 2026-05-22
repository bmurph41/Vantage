// WS4-prep — Golden-number regression harness for department inference.
//
// PURPOSE
//   Before WS4 (department-inference consolidation) touches inferDepartment,
//   this harness snapshots the department-driven outputs into a golden baseline
//   so any change to inferDepartment ITSELF is a CAUGHT DIFF, never a silent
//   number shift.
//
// ROLE — pure reference oracle, NOT a behavioral detector (WS4 Piece C1)
//   This harness is a PURE ORACLE: deterministic, DB-free, and it reads no
//   source code. It computes inferDepartment outputs for a fixed input set and
//   publishes them as golden numbers. It catches regressions in inferDepartment
//   — the pure function it calls — and nothing else. It has no false-green
//   failure mode because it makes no judgment about code it does not execute.
//
//   It does NOT, and is not meant to, detect changes in the four actuals-writer
//   CALL SITES (canonical-actuals-loader.ts:293, promote-to-actuals.ts:147,
//   quickbooks-service.ts:609, doc-intel-service.ts:2560). Those call sites
//   currently pass `undefined` as the assetClass argument; WS4 Piece C2 changes
//   them to thread the real asset class. Because this harness neither imports
//   nor observes those call sites, C2 correctly produces ZERO diff here — by
//   design. Detection of C2's behavioral change is RELOCATED to the C2 live
//   re-promotion test (seed a real project, run the writer, assert the
//   persisted modeling_actuals.department label). That live test is the
//   behavioral gate. This harness's only job for C2 is to PUBLISH the two
//   possible writer behaviors as named reference numbers (see WHAT IT CAPTURES)
//   so the live test has an authoritative figure to corroborate against.
//
// WHAT IT CAPTURES (per the WS4-prep Phase 0 design)
//   Primary  — the inferred `department` for a fixed input set, across four
//              dispatch modes. If department-per-label is unchanged, every
//              downstream consumer (growth-rate lookup, granular-margin lookup,
//              getOccupancyAdjustment, ...) is unchanged by definition.
//   Secondary— `assumptionKey` (departmentToAssumptionKey — the engine's lookup
//              pivot) and, per asset-class scenario, a set of `syntheticNOI`
//              reference figures computed with a fixed synthetic assumption
//              table that mirrors the pro-forma engine's
//              department -> key -> growth-rate arithmetic:
//                • syntheticNOI_enginePath           — engine threads the real class
//                • syntheticNOI_writerPath_undefined — actuals-writer TODAY: passes
//                                                      undefined -> marina cascade
//                • syntheticNOI_writerPath_threaded  — actuals-writer POST-C2: threads
//                                                      the real class (== enginePath
//                                                      by construction here)
//                • writerPathGap                     — threaded minus undefined; the
//                                                      first-class measure of the
//                                                      current marina-cascade bug
//
// SEAM — pure functions only, no DB, no engine change, no source-text reading:
//   • server inferDepartment           (server/utils/department-mapping.ts shim → shared/coa/)
//   • server departmentToAssumptionKey (same file)
//   • client inferDepartment           (client imports @shared/coa/department-mapping — WS4 Piece B)
//
// The four dispatch modes per input:
//   serverNative    — inferDepartment(label, category, <scenario asset class>)
//                     the class the pro-forma engine threads when present.
//   serverUndefined — inferDepartment(label, category, undefined)
//                     the WRITER path AS IT IS TODAY: canonical-actuals-loader.ts:293,
//                     promote-to-actuals.ts:147, quickbooks-service.ts:609 and
//                     doc-intel-service.ts:2560 all pass undefined, so this is what
//                     gets written onto modeling_actuals.department. The bug
//                     surface — non-marina deals run the marina cascade here.
//   serverMarina    — inferDepartment(label, category, 'marina')
//                     explicit marina; confirms marina === undefined identity.
//   client          — inferDepartment(label, category, <scenario asset class>)
//                     post-WS4-Piece-B the client imports the shared inferDepartment
//                     and threads the project's asset class — identical to serverNative.
//                     The drifted marina-only client copy was retired.
//
// CURRENT-BEHAVIOR BASELINE
//   The golden captures CURRENT behavior INCLUDING current bugs — the marina
//   cascade running on non-marina deals, visible as syntheticNOI_writerPath_undefined
//   and the non-zero writerPathGap for multifamily and str. Any diff in
//   inferDepartment's OWN output during WS4 must be reviewed. C2's call-site
//   fix, by contrast, leaves this harness GREEN and is verified by the live
//   re-promotion test — see ROLE above.
//
//   syntheticNOI_writerPath_threaded equals syntheticNOI_enginePath by
//   construction (both dispatch inferDepartment with the real assetClass). It is
//   named separately because it is the ACTUALS-WRITER's reference value: the C2
//   live re-promotion test asserts the persisted department LABEL as ground
//   truth and uses this NOI figure only as a CORROBORATING reference — not a
//   strict equality, because the real writer post-processes departments
//   (normalizeDepartment, deptKeyToLabel, correctCategoryForDepartment) and this
//   synthetic oracle does not.
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
  // marina (unchanged)
  storage: 4.0, fuel_dock: 1.5, ship_store: 2.5, service: 3.5,
  boat_sales: 2.0, boat_brokerage: 3.0, rental_boats: 4.5, boat_club: 5.0,
  boat_finance: 2.2, marina_amenities: 3.8, commercial_tenants: 2.8,
  commercial_leases: 2.9, restaurant: 3.3, rv_sites: 4.1, hospitality: 3.6,
  parts: 2.7, misc_revenue: 1.0, payroll: 3.2, g_and_a: 2.6,
  // WS5 Step B — the 3 reused marina keys that EXIST in
  // assumptions.tsx's granularExpenseGrowth defaults today
  // (payroll is already populated above). Distinct rates so the harness
  // surfaces MF-expense differentiation. The new-only keys
  // (residential_rental, other_income, operating_expenses, nightly_rate,
  // cleaning_revenue/cleaning_expense, platform_fees) are deliberately
  // NOT added — they don't exist in production lookup tables until Step
  // C, so they should fall back here too (→ SYNTHETIC_GROWTH.g_and_a),
  // mirroring the engine's flat-fallback behavior post-B/pre-C.
  repairs_maintenance: 7.0, utilities: 7.5, management_fees: 8.0,
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
    // WS5 Step B: departmentToAssumptionKey is now asset-class-aware and the
    // engine passes a `side` derived from the line's category. Revenue lines
    // resolve via `getRevenueGrowthForDept` (side='revenue'); cogs + expense
    // lines via `getExpenseGrowthForCategory` (side='expense'). Disambiguates
    // STR `Cleaning` only.
    const side = category === 'revenue' ? 'revenue' : 'expense';
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
        serverNative: departmentToAssumptionKey(dNative, ac, side),
        // writerPath_undefined: pre-C2 actuals-writer mode — neither inference
        // nor key-map sees the asset class; marina-default both ways.
        serverUndefined: departmentToAssumptionKey(dUndef, undefined, side),
        serverMarina: departmentToAssumptionKey(dMarina, 'marina', side),
        client: departmentToAssumptionKey(dClient, ac, side),
      },
    };
  });

  // Synthetic NOI per scenario — three reference figures (WS4 Piece C1):
  //   enginePath           = serverNative dispatch — the pro-forma engine's
  //                          threaded-class result.
  //   writerPath_undefined = serverUndefined dispatch — the actuals-writer path
  //                          AS IT IS TODAY (all four call sites pass undefined,
  //                          so non-marina deals run the marina cascade). This
  //                          is what actually lands on modeling_actuals now.
  //   writerPath_threaded  = serverNative dispatch — the actuals-writer path
  //                          POST-C2, once the call sites thread the real class.
  //                          Equal to enginePath by construction here; named
  //                          separately as the writer's reference figure for the
  //                          C2 live re-promotion test to corroborate against.
  // writerPathGap = threaded - undefined: the first-class measure of the
  // marina-cascade bug — 0 for marina and for branch-less classes that already
  // fall through to the marina default; non-zero for multifamily and str.
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
    const enginePath = noi('serverNative');
    const writerPathUndefined = noi('serverUndefined');
    const writerPathThreaded = noi('serverNative'); // == enginePath by construction
    syntheticProjections[scenario] = {
      revenueLines: rows.filter(r => r.category === 'revenue').length,
      expenseLines: rows.filter(r => r.category !== 'revenue').length,
      syntheticNOI_enginePath: enginePath,
      syntheticNOI_writerPath_undefined: writerPathUndefined,
      syntheticNOI_writerPath_threaded: writerPathThreaded,
      writerPathGap: writerPathThreaded - writerPathUndefined,
    };
  }

  return {
    _meta: {
      harness: 'tests/department-inference-golden.mjs',
      description: 'WS4-prep golden baseline for department inference — a pure reference oracle. Captures CURRENT behavior (bugs included) plus the post-C2 writerPath_threaded reference and writerPathGap. Regenerate with --update; any inferDepartment diff during WS4 must be reviewed. C2 call-site changes leave this harness GREEN and are verified by the live re-promotion test, not here.',
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
  console.log(
    `  ${scenario.padEnd(13)} engine=${p.syntheticNOI_enginePath}` +
    `  writer[undefined]=${p.syntheticNOI_writerPath_undefined}` +
    `  writer[threaded]=${p.syntheticNOI_writerPath_threaded}` +
    `  gap=${p.writerPathGap}`
  );
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
