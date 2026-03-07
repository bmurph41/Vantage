#!/usr/bin/env node
/**
 * wire-dcf-routes.cjs
 * 
 * Surgically edits server/routes.ts to:
 *   1. Comment out old DCF routes (GET/POST dcf, quick-irr, quick-npv, sensitivity)
 *   2. Comment out old Monte Carlo routes (get, run, config, quick)
 *   3. Add new route registration call at end of registerRoutes()
 * 
 * Usage: node wire-dcf-routes.cjs
 * Run from project root (~/workspace)
 * 
 * Creates a backup at server/routes.ts.pre-dcf-refactor before editing.
 */

const fs = require('fs');
const path = require('path');

const ROUTES_FILE = path.resolve('server/routes.ts');

if (!fs.existsSync(ROUTES_FILE)) {
  console.error('ERROR: server/routes.ts not found. Run from project root.');
  process.exit(1);
}

// Backup
const backupPath = ROUTES_FILE + '.pre-dcf-refactor';
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(ROUTES_FILE, backupPath);
  console.log('✓ Backup created: server/routes.ts.pre-dcf-refactor');
} else {
  console.log('  Backup already exists, skipping');
}

let content = fs.readFileSync(ROUTES_FILE, 'utf8');
const lines = content.split('\n');

// ─── Step 1: Find and comment out OLD DCF route blocks ───────────────────────

// Markers we're looking for (approximate line content)
const OLD_ROUTE_MARKERS = [
  // DCF routes
  { start: "app.get('/api/modeling/projects/:projectId/dcf'", label: 'GET /dcf' },
  { start: "app.post('/api/modeling/projects/:projectId/dcf/calculate'", label: 'POST /dcf/calculate' },
  { start: "app.post('/api/dcf/quick-irr'", label: 'POST /dcf/quick-irr' },
  { start: "app.post('/api/dcf/quick-npv'", label: 'POST /dcf/quick-npv' },
  { start: "app.post('/api/dcf/sensitivity'", label: 'POST /dcf/sensitivity' },
  // Monte Carlo routes
  { start: "app.get('/api/modeling/projects/:projectId/monte-carlo'", label: 'GET /monte-carlo' },
  { start: "app.post('/api/modeling/projects/:projectId/monte-carlo/run'", label: 'POST /monte-carlo/run' },
  { start: "app.post('/api/modeling/projects/:projectId/monte-carlo/config'", label: 'POST /monte-carlo/config' },
  { start: "app.get('/api/modeling/projects/:projectId/monte-carlo/quick'", label: 'GET /monte-carlo/quick' },
  // Sensitivity matrix  
  { start: "app.post('/api/modeling/projects/:projectId/sensitivity-matrix'", label: 'POST /sensitivity-matrix' },
];

let commentedCount = 0;

for (const marker of OLD_ROUTE_MARKERS) {
  const startIdx = lines.findIndex(l => l.includes(marker.start));
  if (startIdx === -1) {
    console.log('  SKIP (not found): ' + marker.label);
    continue;
  }

  // Already commented?
  if (lines[startIdx].trimStart().startsWith('//') || lines[startIdx].trimStart().startsWith('/*')) {
    console.log('  SKIP (already commented): ' + marker.label);
    continue;
  }

  // Find the end of this route handler by tracking brace depth
  let depth = 0;
  let endIdx = startIdx;
  let foundOpen = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
    }
    if (foundOpen && depth <= 0) {
      // Check if next line has ");' to close app.get(...
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('});')) {
        endIdx = i + 1;
      } else {
        endIdx = i;
      }
      break;
    }
    // Safety: don't scan more than 60 lines for one handler
    if (i - startIdx > 60) {
      endIdx = i;
      break;
    }
  }

  // Comment out the block
  const commentStart = '  /* === OLD ROUTE (replaced by dcf-routes.ts) === ' + marker.label;
  const commentEnd = '  === END OLD ROUTE === */';

  lines[startIdx] = commentStart + '\n' + lines[startIdx];
  lines[endIdx] = lines[endIdx] + '\n' + commentEnd;

  commentedCount++;
  console.log('  ✓ Commented out: ' + marker.label + ' (lines ' + (startIdx + 1) + '-' + (endIdx + 1) + ')');
}

// Also comment out section headers if present
const sectionHeaders = [
  'DCF CALCULATOR - Real-Time Discounted Cash Flow Analysis',
  'MONTE CARLO SIMULATION - Stochastic Analysis Engine',
];
for (const header of sectionHeaders) {
  const idx = lines.findIndex(l => l.includes(header));
  if (idx !== -1 && !lines[idx].includes('OLD ROUTE')) {
    lines[idx] = '  // [REPLACED] ' + lines[idx].trim();
    console.log('  ✓ Marked section header: ' + header.substring(0, 40) + '...');
  }
}

// ─── Step 2: Add import + registration at end of registerRoutes() ────────────

// Check if already wired
if (content.includes('registerDCFRoutes')) {
  console.log('\n  registerDCFRoutes already present — skipping injection.');
} else {
  // Find a good injection point — just before the last closing brace and return statement
  // Look for the pattern near end: "return createServer(app);" or similar
  // We'll inject right before the final "const server = createServer" or "return"

  // Strategy: find the last occurrence of "return createServer" or "return httpServer" 
  // and inject before it
  let injectionIdx = -1;
  
  // Search backwards from end for the return statement
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('return ') && (
      trimmed.includes('createServer') || 
      trimmed.includes('httpServer') || 
      trimmed.includes('server')
    )) {
      injectionIdx = i;
      break;
    }
  }

  // Fallback: look for last "const server = createServer" or "const httpServer"
  if (injectionIdx === -1) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('createServer(app)')) {
        injectionIdx = i;
        break;
      }
    }
  }

  // Final fallback: inject 5 lines before end of file
  if (injectionIdx === -1) {
    injectionIdx = lines.length - 5;
    console.log('  WARNING: Could not find ideal injection point, using near-end-of-file');
  }

  const injection = `
  // ============================================================================
  // DCF REFACTOR — Layers 1-4 (canonical Pro Forma consumption)
  // ============================================================================
  {
    const { registerDCFRoutes } = await import('./routes/dcf-routes');
    const { computeDirectInputFinancials } = await import('./services/direct-input-engine');
    const { computeMultiYearProjection } = await import('./services/multi-year-projection-engine');
    const { pool } = await import('./db');
    // const { generateDebtSchedule } = await import('../shared/debt/debt-engine'); // wire when ready

    registerDCFRoutes(app, {
      pool,
      authenticateUser,
      computeDirectInputFinancials,
      computeMultiYearProjection,
      generateDebtSchedule: undefined,  // TODO: wire debt engine
    });
    console.log('[DCF] Refactored routes registered (Layers 1-4)');
  }
`;

  lines.splice(injectionIdx, 0, injection);
  console.log('\n  ✓ Injected registerDCFRoutes() call at line ~' + (injectionIdx + 1));
}

// ─── Step 3: Write modified file ─────────────────────────────────────────────

const result = lines.join('\n');
fs.writeFileSync(ROUTES_FILE, result);

console.log('\n=== DONE ===');
console.log('  ' + commentedCount + ' old route blocks commented out');
console.log('  New DCF routes registered');
console.log('\nNext steps:');
console.log('  1. Hit the Run button in Replit to restart the server');
console.log('  2. Run: npx vitest run server/__tests__/irr-parity.test.ts');
console.log('  3. Smoke test: see INTEGRATION-GUIDE.md for curl commands');
console.log('\nTo revert: cp server/routes.ts.pre-dcf-refactor server/routes.ts');
