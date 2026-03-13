#!/usr/bin/env node
const fs = require('fs');
let c = fs.readFileSync('server/routes.ts', 'utf8');

if (c.includes('catch (dcfErr')) {
  console.log('Already wrapped in try-catch');
  process.exit(0);
}

if (!c.includes('registerDCFRoutes')) {
  console.log('ERROR: registerDCFRoutes not found in routes.ts');
  process.exit(1);
}

// Replace the opening brace-block with try {
c = c.replace(
  /  \{[\s]*\n([\s]*const \{ registerDCFRoutes \})/,
  '  try {\n$1'
);

// Replace the closing of the block after the console.log
c = c.replace(
  "console.log('[DCF] Refactored routes registered (Layers 1-4)');\n  }",
  "console.log('[DCF] Refactored routes registered (Layers 1-4)');\n  } catch (dcfErr: any) {\n    console.error('[DCF] ROUTE REGISTRATION FAILED:', dcfErr.message);\n    console.error(dcfErr.stack);\n  }"
);

fs.writeFileSync('server/routes.ts', c);
console.log('OK: Wrapped DCF block in try-catch');
