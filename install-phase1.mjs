#!/usr/bin/env node
// =============================================================================
// Phase 1 Installer
// Run with: node install-phase1.mjs
// =============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = '/home/runner/workspace';

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log(`  ✓ wrote ${p.replace(ROOT, '')}`);
}

// ─── 1. Copy canonical-seed.ts ───────────────────────────────────────────────
write(
  `${ROOT}/server/services/pnl/canonical-seed.ts`,
  read(path.join(__dirname, '01-canonical-seed.ts'))
);

// ─── 2. Copy project-bridge.ts ───────────────────────────────────────────────
write(
  `${ROOT}/server/services/pnl/project-bridge.ts`,
  read(path.join(__dirname, '02-project-bridge.ts'))
);

// ─── 3. Copy uploads.tsx ─────────────────────────────────────────────────────
write(
  `${ROOT}/client/src/pages/modeling/projects/workspace/uploads.tsx`,
  read(path.join(__dirname, '05-uploads-tsx.tsx'))
);

// ─── 4. Patch server/services/pnl/routes.ts ──────────────────────────────────
const pnlRoutesPath = `${ROOT}/server/services/pnl/routes.ts`;
let pnlRoutes = read(pnlRoutesPath);

const PNL_ROUTES_ADDITIONS = read(path.join(__dirname, '03-pnl-routes-additions.ts'));

// Extract just the route handlers (strip the comment block at top)
const routeHandlers = PNL_ROUTES_ADDITIONS
  .replace(/^\/\/ =+[\s\S]+?^\/\/ =+\n/m, '')
  .replace(/^\/\/ ─+ IMPORT.*$/m, '')
  .replace(/^\/\/ import.*$/mg, '')
  .replace(/^\/\/ ─+$/mg, '')
  .trim();

// Insert before final export or at end of file
if (pnlRoutes.includes('export default router')) {
  pnlRoutes = pnlRoutes.replace(
    'export default router',
    `\n// ─── PHASE 1: Project bridge routes ─────────────────────────────────────────\n${routeHandlers}\n\nexport default router`
  );
} else {
  pnlRoutes += `\n\n// ─── PHASE 1: Project bridge routes ─────────────────────────────────────────\n${routeHandlers}\n`;
}

write(pnlRoutesPath, pnlRoutes);

// ─── 5. Patch server/routes.ts — add 3 endpoints after pnlRouter line ────────
const mainRoutesPath = `${ROOT}/server/routes.ts`;
let mainRoutes = read(mainRoutesPath);

const MAIN_ROUTES_ADDITIONS = read(path.join(__dirname, '04-routes-additions.ts'))
  .replace(/^\/\/ =+[\s\S]+?^\/\/ =+\n/m, '')
  .trim();

// Find insertion point: right after app.use("/api/pnl" ...)
const PNL_USE_PATTERN = /app\.use\("\/api\/pnl",\s*authenticateUser[^;]+;/;
const match = mainRoutes.match(PNL_USE_PATTERN);

if (match) {
  const insertAfter = match[0];
  mainRoutes = mainRoutes.replace(
    insertAfter,
    `${insertAfter}\n\n  // ─── Phase 1: PNL pipeline bridge endpoints ──────────────────────────────\n${MAIN_ROUTES_ADDITIONS}\n`
  );
  write(mainRoutesPath, mainRoutes);
  console.log('  ✓ Patched routes.ts — inserted after /api/pnl registration');
} else {
  // Fallback: append near end of registerRoutes
  const fallbackAnchor = 'app.use(authenticateUser, coaRoutes)';
  if (mainRoutes.includes(fallbackAnchor)) {
    mainRoutes = mainRoutes.replace(
      fallbackAnchor,
      `// ─── Phase 1: PNL pipeline bridge endpoints ──────────────────────────────\n${MAIN_ROUTES_ADDITIONS}\n\n  ${fallbackAnchor}`
    );
    write(mainRoutesPath, mainRoutes);
    console.log('  ✓ Patched routes.ts — inserted before coaRoutes (fallback)');
  } else {
    console.warn('  ⚠️  Could not find insertion point in routes.ts — manually apply 04-routes-additions.ts');
  }
}

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log('\n✅ Phase 1 install complete!\n');
console.log('Next steps:');
console.log('  1. Restart your Replit server');
console.log('  2. Visit any modeling project → Uploads tab');
console.log('  3. Upload a P&L PDF or Excel file');
console.log('  4. Click "Sync to Model" after processing completes');
console.log('  5. Check the green "Financial Model Synced" banner\n');
