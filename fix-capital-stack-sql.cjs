#!/usr/bin/env node
/**
 * fix-capital-stack-sql.cjs
 * 
 * Fixes capital_stacks queries to use actual columns:
 *   purchase_price, total_equity, total_debt, blended_debt_rate,
 *   hold_period_years, exit_cap_rate, noi_growth_rate
 * 
 * There is NO debt_tranches column — debt is stored as aggregates.
 */

const fs = require('fs');
const path = require('path');
let fixes = 0;

const filesToFix = [
  'server/services/dcf-calculator-service.ts',
  'server/services/dcf-decision-support-service.ts',
  'server/routes/dcf-routes.ts',
];

for (const filePath of filesToFix) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.log('  SKIP (not found): ' + filePath);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // ── Fix capital_stacks SELECT queries ─────────────────────────────────

  // Pattern 1: SELECT with debt_tranches (dcf-calculator-service, dcf-decision-support-service)
  content = content.replace(
    /SELECT hold_period_years, noi_growth_rate, exit_cap_rate,\s*\n\s*total_equity, purchase_price, debt_tranches\s*\n\s*FROM capital_stacks/g,
    `SELECT purchase_price, total_equity, total_debt, blended_debt_rate,
            hold_period_years, exit_cap_rate, noi_growth_rate
     FROM capital_stacks`
  );

  // Pattern 2: shorter version in dcf-routes.ts
  content = content.replace(
    /SELECT purchase_price, debt_tranches, hold_period_years\s*\n\s*FROM capital_stacks/g,
    `SELECT purchase_price, total_equity, total_debt, blended_debt_rate, hold_period_years, exit_cap_rate
     FROM capital_stacks`
  );

  // Pattern 3: single-line version
  content = content.replace(
    /'SELECT purchase_price, debt_tranches, hold_period_years FROM capital_stacks/g,
    "'SELECT purchase_price, total_equity, total_debt, blended_debt_rate, hold_period_years, exit_cap_rate FROM capital_stacks"
  );

  // ── Fix the return objects that reference debt_tranches ────────────────

  // Replace debtTranches parsing with direct totalDebt/blendedRate
  content = content.replace(
    /debtTranches: typeof row\.debt_tranches === 'string' \? JSON\.parse\(row\.debt_tranches\) : row\.debt_tranches \?\? \[\],/g,
    `totalDebt: Number(row.total_debt) || 0,
    blendedDebtRate: Number(row.blended_debt_rate) || 0,`
  );

  // Also catch the simpler pattern
  content = content.replace(
    /debtTranches: typeof row\.debt_tranches === 'string'\s*\?\s*JSON\.parse\(row\.debt_tranches\)\s*:\s*row\.debt_tranches \?\? \[\],/g,
    `totalDebt: Number(row.total_debt) || 0,
    blendedDebtRate: Number(row.blended_debt_rate) || 0,`
  );

  if (content !== original) {
    fs.writeFileSync(fullPath, content);
    fixes++;
    console.log('  ✓ Fixed: ' + filePath);
  } else {
    console.log('  SKIP (no changes needed): ' + filePath);
  }
}

// ── Now fix the code that USES debtTranches ──────────────────────────────

// dcf-calculator-service.ts: Fix where it reads capitalStackData.debtTranches
const dcfFile = path.resolve('server/services/dcf-calculator-service.ts');
if (fs.existsSync(dcfFile)) {
  let content = fs.readFileSync(dcfFile, 'utf8');
  const original = content;

  // Replace debtTranches usage with direct totalDebt/blendedRate
  content = content.replace(
    /const debtTranches = capitalStackData\?\.debtTranches \?\? \[\];[\s\S]*?let annualDebtService[\s\S]*?let debtBalanceAtExit = 0;[\s\S]*?let totalDebtAtClose = 0;[\s\S]*?let blendedRate = 0;[\s\S]*?if \(deps\.generateDebtSchedule && debtTranches\.length > 0\) \{[\s\S]*?try \{[\s\S]*?const schedule = deps\.generateDebtSchedule\(debtTranches, holdPeriod\);[\s\S]*?annualDebtService = schedule\.annualDebtService \?\? annualDebtService;[\s\S]*?debtBalanceAtExit = schedule\.remainingBalanceAtExit \?\? 0;[\s\S]*?totalDebtAtClose = schedule\.totalDebtAtClose \?\? 0;[\s\S]*?blendedRate = schedule\.blendedRate \?\? 0;[\s\S]*?\} catch \{[\s\S]*?\/\/ No debt — unlevered analysis[\s\S]*?\}[\s\S]*?\}/,
    `// Debt from capital stack (already aggregated — no tranches to schedule)
  const totalDebtAtClose = capitalStackData?.totalDebt ?? 0;
  const blendedRate = capitalStackData?.blendedDebtRate ?? 0;
  let annualDebtService: number[] = new Array(holdPeriod).fill(0);
  let debtBalanceAtExit = 0;

  if (totalDebtAtClose > 0 && blendedRate > 0) {
    // Simple annual interest-only debt service approximation
    // Full amortization schedule would come from debt engine when wired
    const annualDS = totalDebtAtClose * blendedRate;
    annualDebtService = new Array(holdPeriod).fill(annualDS);
    debtBalanceAtExit = totalDebtAtClose; // IO assumption — full balance at exit
  }`
  );

  if (content !== original) {
    fs.writeFileSync(dcfFile, content);
    console.log('  ✓ Fixed dcf-calculator-service.ts debt logic');
    fixes++;
  }
}

// dcf-decision-support-service.ts: Fix debtTranches usage
const dsFile = path.resolve('server/services/dcf-decision-support-service.ts');
if (fs.existsSync(dsFile)) {
  let content = fs.readFileSync(dsFile, 'utf8');
  const original = content;

  // Replace debtTranches-based debt computation
  content = content.replace(
    /const debtTranches = capitalStack\?\.debtTranches \?\? \[\];[\s\S]*?let annualDebtService[\s\S]*?let debtBalanceAtExit = 0;[\s\S]*?let totalDebt = 0;[\s\S]*?if \(deps\.generateDebtSchedule && debtTranches\.length > 0\) \{[\s\S]*?try \{[\s\S]*?const schedule = deps\.generateDebtSchedule\(debtTranches, holdPeriod\);[\s\S]*?annualDebtService = schedule\.annualDebtService \?\? annualDebtService;[\s\S]*?debtBalanceAtExit = schedule\.remainingBalanceAtExit \?\? 0;[\s\S]*?totalDebt = schedule\.totalDebtAtClose \?\? 0;[\s\S]*?\} catch \{[\s\S]*?\/\* no debt \*\/[\s\S]*?\}[\s\S]*?\}/,
    `// Debt from capital stack (already aggregated)
  const totalDebt = capitalStack?.totalDebt ?? 0;
  const blendedDebtRate = capitalStack?.blendedDebtRate ?? 0;
  let annualDebtService: number[] = new Array(holdPeriod).fill(0);
  let debtBalanceAtExit = 0;

  if (totalDebt > 0 && blendedDebtRate > 0) {
    const annualDS = totalDebt * blendedDebtRate;
    annualDebtService = new Array(holdPeriod).fill(annualDS);
    debtBalanceAtExit = totalDebt;
  }`
  );

  if (content !== original) {
    fs.writeFileSync(dsFile, content);
    console.log('  ✓ Fixed dcf-decision-support-service.ts debt logic');
    fixes++;
  }
}

// dcf-routes.ts: Fix debtTranches usage in Monte Carlo route
const routesFile = path.resolve('server/routes/dcf-routes.ts');
if (fs.existsSync(routesFile)) {
  let content = fs.readFileSync(routesFile, 'utf8');
  const original = content;

  // Replace debtTranches-based logic
  content = content.replace(
    /if \(generateDebtSchedule && capitalStack\?\.debtTranches\?\.length > 0\) \{[\s\S]*?try \{[\s\S]*?const schedule = generateDebtSchedule\(capitalStack\.debtTranches, holdPeriod\);[\s\S]*?annualDS = schedule\.annualDebtService \?\? annualDS;[\s\S]*?debtPayoff = schedule\.remainingBalanceAtExit \?\? 0;[\s\S]*?totalDebt = schedule\.totalDebtAtClose \?\? 0;[\s\S]*?\} catch \{[\s\S]*?\/\* no debt \*\/[\s\S]*?\}[\s\S]*?\}/,
    `// Debt from capital stack (already aggregated)
        const csDebt = capitalStack?.totalDebt ?? 0;
        const csRate = capitalStack?.blendedDebtRate ?? 0;
        if (csDebt > 0 && csRate > 0) {
          annualDS = new Array(holdPeriod).fill(csDebt * csRate);
          debtPayoff = csDebt;
          totalDebt = csDebt;
        }`
  );

  if (content !== original) {
    fs.writeFileSync(routesFile, content);
    console.log('  ✓ Fixed dcf-routes.ts debt logic');
    fixes++;
  }
}

console.log('\nTotal fixes: ' + fixes);
console.log('Hit Run in Replit, then test Decision Support endpoint.');
