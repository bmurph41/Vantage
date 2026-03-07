#!/usr/bin/env node
/**
 * DCF Refactor Installer — All 4 Layers
 * 
 * Usage: node install-dcf-refactor.mjs
 * 
 * Run from your project root (~/workspace).
 * Reads dcf-files.json (same directory) and installs all 16 files.
 * Backs up existing dcf-calculator-service.ts to .OLD before overwriting.
 */
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'dcf-files.json');
if (!fs.existsSync(manifestPath)) {
  console.error('ERROR: dcf-files.json not found in ' + __dirname);
  console.error('Upload both install-dcf-refactor.mjs AND dcf-files.json to your project root.');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log('DCF Refactor Installer');
console.log('======================');
console.log('Installing ' + entries.length + ' files...\n');

let created = 0, backed = 0;
for (const entry of entries) {
  const fullPath = path.resolve(entry.path);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('  mkdir ' + path.relative(process.cwd(), dir));
  }
  if (entry.path.includes('dcf-calculator-service.ts') && fs.existsSync(fullPath)) {
    fs.copyFileSync(fullPath, fullPath + '.OLD');
    console.log('  BACKUP ' + entry.path + ' -> .OLD');
    backed++;
  }
  fs.writeFileSync(fullPath, Buffer.from(entry.b64, 'base64').toString('utf8'));
  console.log('  + ' + entry.path);
  created++;
}

console.log('\nDone! ' + created + ' files created, ' + backed + ' backed up.\n');
console.log('Next steps:');
console.log('  1. Fix import paths: grep -rn "from.*../../shared" server/ | grep -v node_modules | head -20');
console.log('  2. Wire routes into server/routes.ts (see INTEGRATION-GUIDE.md)');
console.log('  3. Run tests: npx vitest run server/__tests__/irr-parity.test.ts');
console.log('  4. Restart server (Run button in Replit)');
