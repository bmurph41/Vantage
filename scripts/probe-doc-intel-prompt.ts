// Sanity probe — constructs the exact prompt + system message that
// aiCategorizeItems would build for each MVP asset class plus an unregistered
// class (default-CRE fallback). Mirrors the literal template in
// server/services/doc-intel-service.ts:aiCategorizeItems so we can eyeball the
// class-specific output without a live OpenAI round-trip.
//
// Usage: npx tsx scripts/probe-doc-intel-prompt.ts

import { getDocIntelPromptHints } from '@shared/asset-class-model-config';

function constructPrompt(assetClass: string | null, enabledDepartments?: string[]) {
  const hints = getDocIntelPromptHints(assetClass);

  const revenueDeptInstruction = enabledDepartments && enabledDepartments.length > 0
    ? `For revenue/cogs, ONLY use these enabled departments: ${enabledDepartments.join(', ')}. Do NOT use departments not in this list.`
    : `For revenue/cogs use: ${hints.revenueDepts.join('/')}`;
  const expenseDeptInstruction = `For expenses use: ${hints.expenseDepts.join('/')}`;
  const lineItemGuidanceBlock = hints.lineItemGuidance
    ? hints.lineItemGuidance
    : '(none)';

  return {
    systemMessage: hints.systemMessage,
    personaLine: `You are a ${hints.persona}. Categorize these P&L line items.`,
    revenueDeptInstruction,
    expenseDeptInstruction,
    lineItemGuidanceBlock,
  };
}

const cases: Array<{ label: string; assetClass: string | null }> = [
  { label: 'marina', assetClass: 'marina' },
  { label: 'str', assetClass: 'str' },
  { label: 'multifamily', assetClass: 'multifamily' },
  { label: 'self_storage (no hints → CRE default)', assetClass: 'self_storage' },
  { label: '<null> (no project assetClass → CRE default)', assetClass: null },
];

for (const { label, assetClass } of cases) {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`assetClass: ${label}`);
  console.log('═══════════════════════════════════════════════════════');
  const p = constructPrompt(assetClass);
  console.log(`SYSTEM:   ${p.systemMessage}`);
  console.log(`PERSONA:  ${p.personaLine}`);
  console.log(`REVENUE:  ${p.revenueDeptInstruction}`);
  console.log(`EXPENSE:  ${p.expenseDeptInstruction}`);
  console.log(`GUIDANCE: ${p.lineItemGuidanceBlock}`);
  console.log('');
}

// One enabledDepartments-override probe to show the per-upload override still beats the class default
console.log('═══════════════════════════════════════════════════════');
console.log('marina + enabledDepartments=[storage,fuel] override');
console.log('═══════════════════════════════════════════════════════');
const o = constructPrompt('marina', ['storage', 'fuel']);
console.log(`REVENUE:  ${o.revenueDeptInstruction}`);
console.log(`EXPENSE:  ${o.expenseDeptInstruction}  (still from class hints)`);
