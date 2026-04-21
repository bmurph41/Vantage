// FM endpoint smoke probe — hits canonical UI-facing endpoints under a fresh
// GP session and reports HTTP status + payload size + key fields.
// Mirrors the diagnostic sweep pattern documented in MARINAMATCH_JOURNAL.md.
//
// Usage:
//   node smoke.mjs                  # uses default test project
//   node smoke.mjs <projectId>      # custom project
//   node smoke.mjs <projectId> <fundId>

const PROJECT_ID = process.argv[2] ?? '6b3a9021-f393-489d-9274-321ac76eae08';
const FUND_ID    = process.argv[3] ?? '5d54f90e-0000-0000-0000-000000000000'; // demo fund placeholder
const BASE       = process.env.BASE_URL ?? 'http://localhost:5000';

const fmRoutes = [
  ['GET', `/api/modeling/projects/${PROJECT_ID}/pro-forma`],
  ['GET', `/api/modeling/projects/${PROJECT_ID}/dcf`],
  ['GET', `/api/modeling/projects/${PROJECT_ID}/exit/scenarios`],
  ['GET', `/api/modeling/projects/${PROJECT_ID}/lp-reporting`],
  ['GET', `/api/modeling/projects/${PROJECT_ID}/config`],
  ['GET', `/api/modeling/projects/${PROJECT_ID}/tax-waterfall/settings`],
  ['GET', `/api/modeling/projects/${PROJECT_ID}/tax-waterfall/partners`],
  ['GET', `/api/modeling/projects/${PROJECT_ID}/tax-waterfall/equity-contributions`],
];

const fundRoutes = [
  ['GET', `/api/funds`],
  ['GET', `/api/funds/${FUND_ID}`],
  ['GET', `/api/funds/${FUND_ID}/metrics`],
  ['GET', `/api/funds/${FUND_ID}/investors`],
  ['GET', `/api/funds/${FUND_ID}/capital-accounts`],
  ['GET', `/api/funds/${FUND_ID}/allocations`],
];

const fundReportingRoutes = [
  ['GET', `/api/fund-management/funds/${FUND_ID}/pme`],
  ['GET', `/api/fund-management/funds/${FUND_ID}/j-curve`],
  ['GET', `/api/fund-management/funds/${FUND_ID}/attribution`],
  ['GET', `/api/fund-management/funds/${FUND_ID}/vintage-cohorts`],
];

const crmRoutes = [
  ['GET', `/api/crm/deals`],
  ['GET', `/api/crm/contacts`],
  ['GET', `/api/crm/companies`],
  ['GET', `/api/crm/leads`],
  ['GET', `/api/crm/tasks`],
  ['GET', `/api/crm/activities`],
  ['GET', `/api/crm/pipelines`],
];

async function probe(method, path) {
  try {
    const res = await fetch(`${BASE}${path}`, { method });
    const body = await res.text();
    const isJson = res.headers.get('content-type')?.includes('application/json');
    let preview = '';
    if (isJson) {
      try {
        const j = JSON.parse(body);
        const keys = Array.isArray(j) ? `array[${j.length}]` : Object.keys(j).slice(0, 5).join(',');
        preview = `json {${keys}}`;
      } catch { preview = `non-json ${body.length}b`; }
    } else {
      preview = `html/text ${body.length}b (likely Vite catchall)`;
    }
    return { status: res.status, ok: res.ok, isJson, preview };
  } catch (e) {
    return { status: 0, ok: false, isJson: false, preview: `ERR ${e.message}` };
  }
}

async function runGroup(label, routes) {
  console.log(`\n=== ${label} ===`);
  let pass = 0, fail = 0;
  for (const [method, path] of routes) {
    const r = await probe(method, path);
    const tag = r.ok && r.isJson ? '✓' : (r.status === 404 ? '·' : '✗');
    console.log(`  ${tag} ${method} ${path}  → ${r.status}  ${r.preview}`);
    if (r.ok && r.isJson) pass++; else fail++;
  }
  return { pass, fail };
}

console.log(`Smoke target: ${BASE}`);
console.log(`Project: ${PROJECT_ID}`);
console.log(`Fund:    ${FUND_ID}`);

const r1 = await runGroup('FM project routes', fmRoutes);
const r2 = await runGroup('Fund management (V1)', fundRoutes);
const r3 = await runGroup('Fund reporting',       fundReportingRoutes);
const r4 = await runGroup('CRM',                  crmRoutes);

const pass = r1.pass + r2.pass + r3.pass + r4.pass;
const fail = r1.fail + r2.fail + r3.fail + r4.fail;
console.log(`\n=== TOTAL ===\nGreen: ${pass}   Non-green: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
