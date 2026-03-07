#!/usr/bin/env node
/**
 * fix-dcf-imports.cjs
 * 
 * Fixes runtime require() calls in dcf-decision-support-service.ts
 * by converting them to use already-imported top-level modules.
 * 
 * Usage: node fix-dcf-imports.cjs
 * Run from project root (~/workspace)
 */

const fs = require('fs');
const path = require('path');

// ─── Fix 1: dcf-decision-support-service.ts — replace require() with imports ─

const dsFile = path.resolve('server/services/dcf-decision-support-service.ts');
if (fs.existsSync(dsFile)) {
  let content = fs.readFileSync(dsFile, 'utf8');
  let changes = 0;

  // Add missing imports at top (after existing imports)
  if (!content.includes("import { DEFAULT_DISTRIBUTIONS }")) {
    content = content.replace(
      "import { sampleDistribution, createSeededRNG, DistributionConfig } from '../../shared/finance/distributions';",
      "import { sampleDistribution, createSeededRNG, DistributionConfig } from '../../shared/finance/distributions';\nimport { DEFAULT_DISTRIBUTIONS } from './dcf-simulation-service';\nimport { calculateXIRR, calculateNPV, DatedCashFlow } from '../../shared/finance/xirr';"
    );
    changes++;
  }

  // Remove the require() calls inside functions
  content = content.replace(
    "  const { DEFAULT_DISTRIBUTIONS } = require('./dcf-simulation-service');",
    "  // DEFAULT_DISTRIBUTIONS imported at top level"
  );
  content = content.replace(
    "  const { calculateXIRR, calculateNPV } = require('../../shared/finance/xirr');",
    "  // calculateXIRR, calculateNPV imported at top level"
  );
  content = content.replace(
    "  const { DatedCashFlow } = require('../../shared/finance/xirr');",
    "  // DatedCashFlow imported at top level"
  );
  changes++;

  fs.writeFileSync(dsFile, content);
  console.log('✓ Fixed dcf-decision-support-service.ts (' + changes + ' changes)');
} else {
  console.log('SKIP: dcf-decision-support-service.ts not found');
}

// ─── Fix 2: Reconcile existing XIRR — add re-export from shared ─────────────

const financialCalcsFile = path.resolve('server/utils/financial-calculations.ts');
if (fs.existsSync(financialCalcsFile)) {
  let content = fs.readFileSync(financialCalcsFile, 'utf8');

  if (!content.includes('shared/finance/xirr')) {
    // Add a re-export comment at the top so both old and new consumers work
    const reexport = `
// ─── Canonical XIRR also available from shared/finance/xirr.ts ───
// New code should import from '../../shared/finance/xirr' directly.
// This file's calculateXIRR is kept for backward compatibility.
`;
    content = reexport + content;
    fs.writeFileSync(financialCalcsFile, content);
    console.log('✓ Added canonical XIRR reference note to financial-calculations.ts');
  } else {
    console.log('  financial-calculations.ts already references shared/finance/xirr');
  }
} else {
  console.log('SKIP: server/utils/financial-calculations.ts not found');
}

// ─── Fix 3: Ensure dcf-routes.ts import paths work ──────────────────────────

const dcfRoutesFile = path.resolve('server/routes/dcf-routes.ts');
if (fs.existsSync(dcfRoutesFile)) {
  let content = fs.readFileSync(dcfRoutesFile, 'utf8');
  let changes = 0;

  // The Express import may need to be a type import to avoid runtime issues
  if (content.includes("import { Express, Request, Response } from 'express';")) {
    content = content.replace(
      "import { Express, Request, Response } from 'express';",
      "import type { Express, Request, Response } from 'express';"
    );
    changes++;
  }

  if (changes > 0) {
    fs.writeFileSync(dcfRoutesFile, content);
    console.log('✓ Fixed dcf-routes.ts Express import (' + changes + ' changes)');
  } else {
    console.log('  dcf-routes.ts imports look ok');
  }
} else {
  console.log('SKIP: server/routes/dcf-routes.ts not found');
}

console.log('\nDone! Now run:');
console.log('  node wire-dcf-routes.cjs');
