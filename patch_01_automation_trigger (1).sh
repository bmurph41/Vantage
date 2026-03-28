#!/bin/bash
# PATCH 01: Wire automation evaluation on stage-change drag
# Run from workspace root: bash patch_01_automation_trigger.sh

echo "▶ Patch 01: Automation trigger on drag + fromStageId tracking"

cat > /tmp/patch01.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';
const file = 'client/src/pages/pipeline.tsx';
let src = readFileSync(file, 'utf8');
let changed = 0;

// 1. Add fromStageId to mutation type signature
const OLD_TYPE = `mutationFn: async ({ dealId, stageId, stage }: { dealId: string; stageId: string; stage: string }) => {`;
const NEW_TYPE = `mutationFn: async ({ dealId, stageId, stage, fromStageId }: { dealId: string; stageId: string; stage: string; fromStageId?: string }) => {`;
if (src.includes(OLD_TYPE)) {
  src = src.replace(OLD_TYPE, NEW_TYPE);
  console.log('  ✅ Added fromStageId to mutation type');
  changed++;
}

// 2. Pass fromStageId in handleDragEnd mutate call
const OLD_MUTATE = `updateDealMutation.mutate({ dealId, stageId: targetStageId, stage: targetStage.name });`;
const NEW_MUTATE = `updateDealMutation.mutate({ dealId, stageId: targetStageId, stage: targetStage.name, fromStageId: currentStageId });`;
if (src.includes(OLD_MUTATE)) {
  src = src.replace(OLD_MUTATE, NEW_MUTATE);
  console.log('  ✅ Pass fromStageId in handleDragEnd');
  changed++;
}

// 3. Replace the onSuccess callback to trigger automation + log stage change
const OLD_ONSUCCESS = `    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Deal moved successfully" });
    },`;
const NEW_ONSUCCESS = `    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({ title: "Deal moved successfully" });
      // Fire-and-forget: trigger automation rules evaluation for this stage change
      if (vars.fromStageId && vars.stageId) {
        apiRequest("POST", "/api/pipeline/automation/evaluate", {
          dealId: vars.dealId,
          fromStageId: vars.fromStageId,
          toStageId: vars.stageId,
          triggerType: "stage_change",
        }).catch(() => {});
      }
    },`;
if (src.includes(OLD_ONSUCCESS)) {
  src = src.replace(OLD_ONSUCCESS, NEW_ONSUCCESS);
  console.log('  ✅ Added automation evaluate + activity invalidation to onSuccess');
  changed++;
} else {
  console.log('  ⚠️  Could not find exact onSuccess block - check pipeline.tsx manually');
}

writeFileSync(file, src);
console.log(`\nPatch 01 complete: ${changed}/3 changes applied to ${file}`);
SCRIPT

node /tmp/patch01.mjs
echo "✅ Patch 01 done"
