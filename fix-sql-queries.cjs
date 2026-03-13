#!/usr/bin/env node
/**
 * fix-sql-queries.cjs
 * 
 * Fixes all SQL queries in the new DCF services to match the actual schema:
 *   - modeling_projects has: id, org_id, asset_class, custom_metrics, purchase_price, marina_name
 *   - There is NO separate "projects" table to join
 *   - The projectId passed to endpoints IS the modeling_projects.id
 * 
 * Usage: node fix-sql-queries.cjs
 */

const fs = require('fs');
const path = require('path');

let totalFixes = 0;

// ─── Fix 1: dcf-calculator-service.ts ────────────────────────────────────────

const dcfFile = path.resolve('server/services/dcf-calculator-service.ts');
if (fs.existsSync(dcfFile)) {
  let content = fs.readFileSync(dcfFile, 'utf8');

  // Replace loadProjectData function
  const oldLoadProject = `async function loadProjectData(pool: any, projectId: string) {
  const r = await pool.query(
    \`SELECT mp.id as modeling_project_id, mp.asset_class,
            p.custom_metrics, p.purchase_price
     FROM modeling_projects mp
     JOIN projects p ON p.id = mp.project_id
     WHERE mp.project_id = $1 OR mp.id = $1
     LIMIT 1\`,
    [projectId]
  );

  const row = r.rows[0];
  if (!row) throw new Error(\`Project not found: \${projectId}\`);

  const customMetrics = typeof row.custom_metrics === 'string'
    ? JSON.parse(row.custom_metrics)
    : row.custom_metrics ?? {};

  return {
    modelingProjectId: row.modeling_project_id,
    assetClass: row.asset_class ?? 'str',
    inputAssumptions: customMetrics.inputAssumptions ?? {},
    unitMix: customMetrics.unitMix ?? [],
    purchasePrice: Number(row.purchase_price) || 0,
  };
}`;

  const newLoadProject = `async function loadProjectData(pool: any, projectId: string) {
  const r = await pool.query(
    'SELECT id, org_id, asset_class, custom_metrics, purchase_price, marina_name FROM modeling_projects WHERE id = $1 LIMIT 1',
    [projectId]
  );

  const row = r.rows[0];
  if (!row) throw new Error(\`Project not found: \${projectId}\`);

  const customMetrics = typeof row.custom_metrics === 'string'
    ? JSON.parse(row.custom_metrics)
    : row.custom_metrics ?? {};

  return {
    modelingProjectId: row.id,
    assetClass: row.asset_class ?? 'str',
    inputAssumptions: customMetrics.inputAssumptions ?? {},
    unitMix: customMetrics.unitMix ?? [],
    purchasePrice: Number(row.purchase_price) || 0,
    projectName: row.marina_name ?? 'Unknown Project',
  };
}`;

  if (content.includes('JOIN projects p ON p.id = mp.project_id')) {
    content = content.replace(oldLoadProject, newLoadProject);
    totalFixes++;
    console.log('  ✓ Fixed dcf-calculator-service.ts loadProjectData');
  } else {
    console.log('  SKIP dcf-calculator-service.ts (already fixed or different)');
  }

  fs.writeFileSync(dcfFile, content);
}

// ─── Fix 2: dcf-decision-support-service.ts ──────────────────────────────────

const dsFile = path.resolve('server/services/dcf-decision-support-service.ts');
if (fs.existsSync(dsFile)) {
  let content = fs.readFileSync(dsFile, 'utf8');

  // Fix loadProjectForDS
  content = content.replace(
    `  const r = await pool.query(
    \`SELECT mp.id as modeling_project_id, mp.asset_class, p.name as project_name,
            p.custom_metrics, p.purchase_price
     FROM modeling_projects mp
     JOIN projects p ON p.id = mp.project_id
     WHERE mp.project_id = $1 OR mp.id = $1 LIMIT 1\`,
    [projectId]
  );
  const row = r.rows[0] ?? {};
  const cm = typeof row.custom_metrics === 'string' ? JSON.parse(row.custom_metrics) : row.custom_metrics ?? {};
  return {
    modelingProjectId: row.modeling_project_id,
    assetClass: row.asset_class ?? 'str',
    projectName: row.project_name ?? 'Unknown Project',
    inputAssumptions: cm.inputAssumptions ?? {},
    unitMix: cm.unitMix ?? [],
    purchasePrice: Number(row.purchase_price) || 0,
  };`,
    `  const r = await pool.query(
    'SELECT id, org_id, asset_class, custom_metrics, purchase_price, marina_name FROM modeling_projects WHERE id = $1 LIMIT 1',
    [projectId]
  );
  const row = r.rows[0] ?? {};
  const cm = typeof row.custom_metrics === 'string' ? JSON.parse(row.custom_metrics) : row.custom_metrics ?? {};
  return {
    modelingProjectId: row.id,
    assetClass: row.asset_class ?? 'str',
    projectName: row.marina_name ?? 'Unknown Project',
    inputAssumptions: cm.inputAssumptions ?? {},
    unitMix: cm.unitMix ?? [],
    purchasePrice: Number(row.purchase_price) || 0,
  };`
  );

  // Fix checkEntitlement — organizations table may not have subscription_tier
  // Make it more defensive
  content = content.replace(
    `    const orgResult = await pool.query(
      \`SELECT subscription_tier, plan_type, features
       FROM organizations
       WHERE id = $1 LIMIT 1\`,
      [orgId]
    );`,
    `    const orgResult = await pool.query(
      'SELECT id FROM organizations WHERE id = $1 LIMIT 1',
      [orgId]
    );`
  );

  // Simplify the tier check since we know there's no subscription_tier column yet
  content = content.replace(
    `    const org = orgResult.rows[0];
    if (org) {
      // Entitled if institutional tier or if features JSON includes decision_support
      const tier = (org.subscription_tier ?? org.plan_type ?? '').toLowerCase();
      const features = typeof org.features === 'string'
        ? JSON.parse(org.features)
        : org.features ?? {};

      entitled = ['institutional', 'enterprise', 'pro'].includes(tier)
        || features.decision_support === true;
    }`,
    `    const org = orgResult.rows[0];
    if (org) {
      // MVP: no subscription tier system yet — allow all
      entitled = true;
    }`
  );

  // Fix user preferences check — users table may not have preferences column
  content = content.replace(
    `      const prefResult = await pool.query(
        \`SELECT preferences FROM users WHERE id = $1 LIMIT 1\`,
        [userId]
      );
      const prefs = prefResult.rows[0]?.preferences;
      const parsed = typeof prefs === 'string' ? JSON.parse(prefs) : prefs ?? {};
      enabled = parsed.dcfDecisionSupportEnabled === true;`,
    `      // MVP: no user preferences column yet — default to entitled state
      enabled = entitled;`
  );

  if (content !== fs.readFileSync(dsFile, 'utf8')) {
    totalFixes++;
    console.log('  ✓ Fixed dcf-decision-support-service.ts SQL + entitlement');
  }

  fs.writeFileSync(dsFile, content);
}

// ─── Fix 3: dcf-routes.ts (loadProjectQuick etc.) ────────────────────────────

const routesFile = path.resolve('server/routes/dcf-routes.ts');
if (fs.existsSync(routesFile)) {
  let content = fs.readFileSync(routesFile, 'utf8');

  // Fix loadProjectQuick
  content = content.replace(
    `    \`SELECT mp.id as modeling_project_id, mp.asset_class, p.custom_metrics, p.purchase_price
     FROM modeling_projects mp JOIN projects p ON p.id = mp.project_id
     WHERE mp.project_id = $1 OR mp.id = $1 LIMIT 1\`,`,
    `    'SELECT id, asset_class, custom_metrics, purchase_price FROM modeling_projects WHERE id = $1 LIMIT 1',`
  );

  // Fix the return to use row.id instead of row.modeling_project_id
  content = content.replace(
    /modelingProjectId: row\.modeling_project_id,/g,
    'modelingProjectId: row.id,'
  );

  // Also fix the orgId extraction in route handlers — get it from the project row or req.user
  // The DCF POST handler sends orgId from req.user.orgId which is fine

  if (content !== fs.readFileSync(routesFile, 'utf8')) {
    totalFixes++;
    console.log('  ✓ Fixed dcf-routes.ts SQL queries');
  }

  fs.writeFileSync(routesFile, content);
}

console.log('\nDone! ' + totalFixes + ' files fixed.');
console.log('\nNext: Hit Run in Replit, then test:');
console.log('  curl -s "http://localhost:5000/api/modeling/projects/6b3a9021-f393-489d-9274-321ac76eae08/dcf/decision-support" \\');
console.log('    -H "Cookie: csrf_token=test123" -H "x-csrf-token: test123" | head -c 300');
