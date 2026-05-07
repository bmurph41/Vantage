// Run with: node --import tsx time-pro-forma.mjs <label>
// Times generateProForma against project 6b3a9021. 5 runs, reports per-run + mean.
// First run is warmup (cold cache) — also report mean of runs 2-5.
const label = process.argv[2] || 'pre';

const { proFormaEngineService } = await import('./server/services/pro-forma-engine-service.ts');

const ORG = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
const PROJ = '6b3a9021-f393-489d-9274-321ac76eae08';

console.log(`=== ${label.toUpperCase()}-FIX TIMING — project 6b3a9021 ===`);

const times = [];
for (let i = 1; i <= 5; i++) {
  const t0 = performance.now();
  const pf = await proFormaEngineService.generateProForma(PROJ, ORG, 'base');
  const dt = performance.now() - t0;
  times.push(dt);
  console.log(`  run ${i}: ${dt.toFixed(1)}ms — Y1 NOI=${pf.annualProjections?.[0]?.noi ?? '?'}`);
}
const mean = times.reduce((s, t) => s + t, 0) / times.length;
const meanWarm = times.slice(1).reduce((s, t) => s + t, 0) / (times.length - 1);
console.log(`  mean (5 runs):       ${mean.toFixed(1)}ms`);
console.log(`  mean (runs 2-5):     ${meanWarm.toFixed(1)}ms (warm-cache)`);
process.exit(0);
