#!/bin/bash
# PATCH 02: Automation evaluate endpoint — implement actual action execution
# Run from workspace root: bash patch_02_automation_execute.sh

echo "▶ Patch 02: Implement action execution in automation evaluate endpoint"

cat > /tmp/patch02.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';
const file = 'server/routes/pipeline-automation-routes.ts';
let src = readFileSync(file, 'utf8');

// Replace the entire /evaluate route with a fully implemented version
const OLD_EVALUATE_START = `// POST /evaluate — evaluate all active rules against current deals`;
const OLD_EVALUATE_END = `    res.status(500).json({ error: 'Failed to evaluate automation rules' });
  }
});`;

const startIdx = src.indexOf(OLD_EVALUATE_START);
const endIdx = src.indexOf(OLD_EVALUATE_END, startIdx) + OLD_EVALUATE_END.length;

if (startIdx === -1) {
  console.log('  ⚠️  Could not find /evaluate route start');
  process.exit(1);
}

const NEW_EVALUATE = `// POST /evaluate — evaluate active rules and EXECUTE matching actions
// Supports both:
//   - Stage-change trigger: { dealId, fromStageId, toStageId, triggerType: 'stage_change' }
//   - Batch scan: { triggerType: 'days_in_stage' } (called by cron/on-load)
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();
    const { dealId, fromStageId, toStageId, triggerType } = req.body;

    // Get active rules
    const rules = await db
      .select()
      .from(schema.pipelineAutomationRules)
      .where(and(
        eq(schema.pipelineAutomationRules.orgId, orgId),
        eq(schema.pipelineAutomationRules.isActive, true),
      ));

    const executed: Array<{ ruleId: string; ruleName: string; dealId: string; action: string; success: boolean }> = [];

    // Helper: execute a single rule action against a deal
    async function executeAction(rule: typeof rules[0], targetDealId: string): Promise<boolean> {
      const actionCfg = rule.actionConfig as any;
      try {
        switch (rule.actionType) {

          case 'create_task': {
            const dueDate = actionCfg.dueDays
              ? new Date(Date.now() + actionCfg.dueDays * 86400000)
              : null;
            await db.insert(schema.crmActivities).values({
              orgId,
              type: 'task',
              direction: 'internal',
              subject: actionCfg.taskTitle || \`Task: \${rule.name}\`,
              description: actionCfg.taskDescription || \`Auto-created by automation rule: \${rule.name}\`,
              dealId: targetDealId,
              userId: actionCfg.assignToUserId || userId,
              date: new Date(),
              ...(dueDate ? { dueDate } : {}),
            });
            break;
          }

          case 'send_notification': {
            // Fetch the deal to get owner
            const [deal] = await db.select({ ownerId: schema.crmDeals.ownerId, title: schema.crmDeals.title })
              .from(schema.crmDeals)
              .where(and(eq(schema.crmDeals.id, targetDealId), eq(schema.crmDeals.orgId, orgId)));
            // Store notification (in-app) — insert into crm_activities as a note for now
            // until crm_notifications table is created
            await db.insert(schema.crmActivities).values({
              orgId,
              type: 'note',
              direction: 'internal',
              subject: actionCfg.notificationTitle || \`🔔 \${rule.name}\`,
              description: actionCfg.notificationTemplate
                || \`Automation rule fired: \${rule.name} on deal: \${deal?.title}\`,
              dealId: targetDealId,
              userId: deal?.ownerId || userId,
              date: new Date(),
            });
            break;
          }

          case 'update_field': {
            if (actionCfg.fieldName && actionCfg.fieldValue !== undefined) {
              const updatePayload: Record<string, any> = {
                [actionCfg.fieldName]: actionCfg.fieldValue,
                updatedAt: new Date(),
              };
              await db.update(schema.crmDeals)
                .set(updatePayload)
                .where(and(eq(schema.crmDeals.id, targetDealId), eq(schema.crmDeals.orgId, orgId)));
            }
            break;
          }

          case 'assign_owner': {
            if (actionCfg.userId) {
              await db.update(schema.crmDeals)
                .set({ ownerId: actionCfg.userId, updatedAt: new Date() })
                .where(and(eq(schema.crmDeals.id, targetDealId), eq(schema.crmDeals.orgId, orgId)));
            }
            break;
          }

          case 'move_stage': {
            // Prevent infinite automation loops with a guard flag
            if (actionCfg.targetStageId && actionCfg.targetStageId !== toStageId) {
              await db.update(schema.crmDeals)
                .set({
                  stageId: actionCfg.targetStageId,
                  currentStageEnteredAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(and(eq(schema.crmDeals.id, targetDealId), eq(schema.crmDeals.orgId, orgId)));
            }
            break;
          }

          default:
            console.warn(\`Unknown automation action type: \${rule.actionType}\`);
        }

        // Update rule execution stats
        await db.update(schema.pipelineAutomationRules)
          .set({
            executionCount: sql\`COALESCE(\${schema.pipelineAutomationRules.executionCount}, 0) + 1\`,
            lastExecutedAt: new Date(),
          })
          .where(eq(schema.pipelineAutomationRules.id, rule.id));

        return true;
      } catch (err) {
        console.error(\`Automation action \${rule.actionType} failed for rule \${rule.id}:\`, err);
        return false;
      }
    }

    // ── Stage-change triggered evaluation ──
    if (triggerType === 'stage_change' && dealId && toStageId) {
      for (const rule of rules) {
        if (rule.triggerType !== 'stage_change') continue;
        const cfg = rule.triggerConfig as any;

        // Match: specific toStage required, or any stage change
        const stageMatches = !cfg.toStageId || cfg.toStageId === toStageId;
        const fromMatches = !cfg.fromStageId || cfg.fromStageId === fromStageId;

        // Also support stage NAME matching (legacy config)
        const [toStageRecord] = await db.select({ name: schema.crmPipelineStages.name })
          .from(schema.crmPipelineStages)
          .where(eq(schema.crmPipelineStages.id, toStageId));
        const stageNameMatches = !cfg.toStage || cfg.toStage === toStageRecord?.name;

        if ((stageMatches || stageNameMatches) && fromMatches) {
          const success = await executeAction(rule, dealId);
          executed.push({ ruleId: rule.id, ruleName: rule.name, dealId, action: rule.actionType, success });
        }
      }
    }

    // ── Days-in-stage batch evaluation ──
    if (triggerType === 'days_in_stage' || (!triggerType && !dealId)) {
      const deals = await db.select().from(schema.crmDeals).where(eq(schema.crmDeals.orgId, orgId));

      for (const rule of rules) {
        if (rule.triggerType !== 'days_in_stage') continue;
        const cfg = rule.triggerConfig as any;
        const threshold = cfg.daysThreshold || 30;

        for (const deal of deals) {
          if (!deal.currentStageEnteredAt) continue;
          const days = Math.floor((Date.now() - new Date(deal.currentStageEnteredAt).getTime()) / 86400000);
          if (days >= threshold) {
            const success = await executeAction(rule, deal.id);
            executed.push({ ruleId: rule.id, ruleName: rule.name, dealId: deal.id, action: rule.actionType, success });
          }
        }
      }
    }

    res.json({
      evaluated: rules.length,
      executed,
      successCount: executed.filter(e => e.success).length,
    });
  } catch (error) {
    console.error('Error evaluating automation rules:', error);
    res.status(500).json({ error: 'Failed to evaluate automation rules' });
  }
});`;

const before = src.slice(0, startIdx);
const after = src.slice(endIdx);
src = before + NEW_EVALUATE + after;

writeFileSync(file, src);
console.log(`  ✅ Replaced /evaluate endpoint with full action execution (5 action types)`);
console.log(`     Actions: create_task | send_notification | update_field | assign_owner | move_stage`);
console.log(`     Triggers: stage_change (per-deal) | days_in_stage (batch scan)`);
SCRIPT

node /tmp/patch02.mjs
echo "✅ Patch 02 done"
