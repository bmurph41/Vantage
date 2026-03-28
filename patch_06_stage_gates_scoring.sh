#!/bin/bash
# PATCH 06: Stage entry requirements gate + deal score badge + multi-condition automation
# Run from workspace root: bash patch_06_stage_gates_scoring.sh

echo "▶ Patch 06: Stage gates, deal score badge, automation conditions"

cat > /tmp/patch06.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';

// ══════════════════════════════════════════════════════════
// 1. STAGE ENTRY REQUIREMENTS GATE in handleDragEnd
// ══════════════════════════════════════════════════════════
{
  const file = 'client/src/pages/pipeline.tsx';
  let src = readFileSync(file, 'utf8');

  // Add stageRequirements state (loaded from pipeline settings)
  const OLD_SETTINGS_STATE = `const [isSettingsOpen, setIsSettingsOpen] = useState(false);`;
  const REQUIREMENTS_STATE = `const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Stage entry requirements: { [stageId]: string[] } — loaded from stage config
  const stageRequirements: Record<string, string[]> = useMemo(() => {
    if (!stages) return {};
    return Object.fromEntries(
      stages
        .filter(s => (s as any).requiredFields?.length > 0)
        .map(s => [s.id, (s as any).requiredFields as string[]])
    );
  }, [stages]);`;

  if (src.includes(OLD_SETTINGS_STATE) && !src.includes('stageRequirements')) {
    src = src.replace(OLD_SETTINGS_STATE, REQUIREMENTS_STATE);
    console.log('  ✅ [pipeline.tsx] Added stageRequirements computed state');
  }

  // Add field-gate check to handleDragEnd BEFORE calling mutate
  const OLD_DRAG_MUTATE = `    const targetStage = stages.find(s => s.id === targetStageId);
    if (!targetStage) { setActiveId(null); return; }
    updateDealMutation.mutate({ dealId, stageId: targetStageId, stage: targetStage.name, fromStageId: currentStageId });`;

  const NEW_DRAG_MUTATE = `    const targetStage = stages.find(s => s.id === targetStageId);
    if (!targetStage) { setActiveId(null); return; }

    // ── Stage entry requirement gate ──
    const required = stageRequirements[targetStageId] || [];
    if (required.length > 0) {
      const missingFields = required.filter(f => {
        const val = (deal as any)[f];
        return val === null || val === undefined || val === '' || val === 0;
      });
      if (missingFields.length > 0) {
        const labels: Record<string, string> = {
          amount: 'Deal Value', probability: 'Probability', expectedCloseDate: 'Close Date',
          primaryContactId: 'Primary Contact', companyId: 'Company',
          ddExpirationDate: 'DD Expiration', psaSignedDate: 'PSA Date',
        };
        const readable = missingFields.map(f => labels[f] || f).join(', ');
        toast({
          title: "⛔ Stage requirements not met",
          description: \`To move to "\${targetStage.name}", complete: \${readable}\`,
          variant: "destructive",
          duration: 5000,
        });
        setActiveId(null);
        return;
      }
    }

    updateDealMutation.mutate({ dealId, stageId: targetStageId, stage: targetStage.name, fromStageId: currentStageId });`;

  if (src.includes(OLD_DRAG_MUTATE) && !src.includes('Stage entry requirement gate')) {
    src = src.replace(OLD_DRAG_MUTATE, NEW_DRAG_MUTATE);
    console.log('  ✅ [pipeline.tsx] Added stage entry requirement gate in handleDragEnd');
  }

  // Add deal score badge in DealCard — near the priority chip
  const OLD_PRIORITY_CHIP = `const priorityCfg = getPriorityConfig(deal.priority || 'medium');`;
  if (src.includes(OLD_PRIORITY_CHIP) && !src.includes('deal.score')) {
    // Already added via patch 03? Check if score badge was added
    console.log('  ℹ️  [pipeline.tsx] Deal score badge — check if already added in Patch 03');
  }

  // Add score badge near top of DealCard return if not present
  const OLD_DEAL_VALUE_ROW = `{/* Deal Value */}
            <div className="flex items-center justify-between">`;
  const NEW_DEAL_VALUE_ROW = `{/* Deal Value + Score */}
            <div className="flex items-center justify-between">`;

  // Add score indicator to the deal card value section
  const SCORE_BADGE_INJECT = `{(deal as any).score != null && (
                  <div className={\`text-[10px] font-bold px-1.5 py-0.5 rounded ml-1 \${
                    (deal as any).score >= 80 ? 'bg-green-100 text-green-700' :
                    (deal as any).score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-600'
                  }\`} title="Deal Score">
                    {(deal as any).score}
                  </div>
                )}`;

  // Insert score badge after the amount/probability row
  const OLD_PROB_END = `{(deal as any).probability != null && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
                  {(deal as any).probability}% prob
                </Badge>
              )}`;
  if (src.includes(OLD_PROB_END) && !src.includes('deal.score') && !src.includes('deal as any).score')) {
    src = src.replace(OLD_PROB_END, OLD_PROB_END + '\n              ' + SCORE_BADGE_INJECT);
    console.log('  ✅ [pipeline.tsx] Added deal score badge to card');
  }

  writeFileSync(file, src);
}

// ══════════════════════════════════════════════════════════
// 2. AUTOMATION MULTI-CONDITION SUPPORT in AutomationRulesPanel
// ══════════════════════════════════════════════════════════
{
  const file = 'client/src/components/pipeline/AutomationRulesPanel.tsx';
  let src = readFileSync(file, 'utf8');

  // Add condition groups to the form state
  const OLD_FORM_STATE = `const [form, setForm] = useState({
    name: "",
    triggerType: "stage_change",
    triggerConfig: {} as any,
    actionType: "send_notification",
    actionConfig: {} as any,
  });`;
  const NEW_FORM_STATE = `const [form, setForm] = useState({
    name: "",
    triggerType: "stage_change",
    triggerConfig: {} as any,
    actionType: "send_notification",
    actionConfig: {} as any,
    // Conditions: array of { field, operator, value } ANDed together
    conditions: [] as Array<{ field: string; operator: string; value: string }>,
  });`;

  if (src.includes(OLD_FORM_STATE) && !src.includes('conditions: []')) {
    src = src.replace(OLD_FORM_STATE, NEW_FORM_STATE);
    console.log('  ✅ [AutomationRulesPanel.tsx] Added conditions array to form state');
  }

  // Add condition operators + available fields config
  const OLD_ACTION_TYPES_END = `];

function getTriggerDescription`;
  const NEW_CONSTANTS = `];

const CONDITION_FIELDS = [
  { value: "amount", label: "Deal Value" },
  { value: "probability", label: "Probability %" },
  { value: "priority", label: "Priority" },
  { value: "assetClass", label: "Asset Class" },
  { value: "forecastCategory", label: "Forecast Category" },
  { value: "daysInCurrentStage", label: "Days in Stage" },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "contains", label: "contains" },
];

function getTriggerDescription`;

  if (src.includes(OLD_ACTION_TYPES_END) && !src.includes('CONDITION_FIELDS')) {
    src = src.replace(OLD_ACTION_TYPES_END, NEW_CONSTANTS);
    console.log('  ✅ [AutomationRulesPanel.tsx] Added CONDITION_FIELDS and CONDITION_OPERATORS');
  }

  // Add condition UI section to the dialog form
  // Find where actionConfig section ends and add conditions before the dialog footer
  const OLD_DIALOG_FOOTER = `          <DialogFooter>`;
  const CONDITION_UI = `          {/* ── Conditions Section ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-600 font-medium">Run conditions (optional)</Label>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                onClick={() => setForm(f => ({
                  ...f,
                  conditions: [...f.conditions, { field: 'amount', operator: 'greater_than', value: '' }]
                }))}
              >
                <Plus className="h-3 w-3" /> Add condition
              </button>
            </div>
            {form.conditions.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">No conditions — rule fires on all matching deals</p>
            )}
            {form.conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={cond.field}
                  onValueChange={v => {
                    const next = [...form.conditions];
                    next[idx] = { ...next[idx], field: v };
                    setForm(f => ({ ...f, conditions: next }));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={cond.operator}
                  onValueChange={v => {
                    const next = [...form.conditions];
                    next[idx] = { ...next[idx], operator: v };
                    setForm(f => ({ ...f, conditions: next }));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATORS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="value"
                  value={cond.value}
                  onChange={e => {
                    const next = [...form.conditions];
                    next[idx] = { ...next[idx], value: e.target.value };
                    setForm(f => ({ ...f, conditions: next }));
                  }}
                />
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => setForm(f => ({
                    ...f,
                    conditions: f.conditions.filter((_, i) => i !== idx)
                  }))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {form.conditions.length > 1 && (
              <p className="text-[10px] text-gray-400">All conditions must be true (AND logic)</p>
            )}
          </div>

          <DialogFooter>`;

  if (src.includes(OLD_DIALOG_FOOTER) && !src.includes('Run conditions')) {
    // Replace only the first occurrence (in the dialog)
    src = src.replace(OLD_DIALOG_FOOTER, CONDITION_UI);
    console.log('  ✅ [AutomationRulesPanel.tsx] Added conditions UI to automation dialog');
  }

  // Add Trash2 to imports if not present
  if (!src.includes('Trash2') && src.includes('from "lucide-react"')) {
    src = src.replace(
      'Zap, Plus, Pencil, Trash2, Play, Loader2, Settings2,',
      'Zap, Plus, Pencil, Trash2, Play, Loader2, Settings2,'
    );
  } else if (!src.includes('Trash2')) {
    src = src.replace(
      'Zap, Plus, Pencil, Play, Loader2, Settings2,',
      'Zap, Plus, Pencil, Trash2, Play, Loader2, Settings2,'
    );
    console.log('  ✅ [AutomationRulesPanel.tsx] Added Trash2 to imports');
  }

  writeFileSync(file, src);
}

// ══════════════════════════════════════════════════════════
// 3. SERVER: Evaluate conditions before executing actions
// ══════════════════════════════════════════════════════════
{
  const file = 'server/routes/pipeline-automation-routes.ts';
  let src = readFileSync(file, 'utf8');

  // Add condition evaluation helper before the execute action helper
  const BEFORE_EXECUTE_ACTION = `    // Helper: execute a single rule action against a deal`;
  const CONDITION_EVALUATOR = `    // Helper: evaluate conditions array against a deal record
    function evaluateConditions(rule: typeof rules[0], deal: Record<string, any>): boolean {
      const conditions = (rule as any).conditions as Array<{
        field: string; operator: string; value: string;
      }> | undefined;
      if (!conditions || conditions.length === 0) return true; // no conditions = always run

      return conditions.every(cond => {
        const actual = deal[cond.field];
        const expected = cond.value;
        switch (cond.operator) {
          case 'equals': return String(actual) === expected;
          case 'not_equals': return String(actual) !== expected;
          case 'greater_than': return Number(actual) > Number(expected);
          case 'less_than': return Number(actual) < Number(expected);
          case 'contains': return String(actual || '').toLowerCase().includes(expected.toLowerCase());
          default: return true;
        }
      });
    }

    // Helper: execute a single rule action against a deal`;

  if (src.includes(BEFORE_EXECUTE_ACTION) && !src.includes('evaluateConditions')) {
    src = src.replace(BEFORE_EXECUTE_ACTION, CONDITION_EVALUATOR);
    console.log('  ✅ [pipeline-automation-routes.ts] Added evaluateConditions helper');
  }

  // Gate the stage-change execution with condition check
  const OLD_STAGE_EXECUTE = `        if ((stageMatches || stageNameMatches) && fromMatches) {
          const success = await executeAction(rule, dealId);`;

  // Fetch the deal for condition evaluation
  const NEW_STAGE_EXECUTE = `        if ((stageMatches || stageNameMatches) && fromMatches) {
          // Fetch deal record to evaluate conditions
          const [dealRecord] = await db.select().from(schema.crmDeals)
            .where(and(eq(schema.crmDeals.id, dealId), eq(schema.crmDeals.orgId, orgId)));
          if (dealRecord && !evaluateConditions(rule, dealRecord)) continue;
          const success = await executeAction(rule, dealId);`;

  if (src.includes(OLD_STAGE_EXECUTE) && !src.includes('evaluateConditions(rule, dealRecord)')) {
    src = src.replace(OLD_STAGE_EXECUTE, NEW_STAGE_EXECUTE);
    console.log('  ✅ [pipeline-automation-routes.ts] Gated action execution with condition evaluation');
  }

  writeFileSync(file, src);
}

console.log('\n✅ Patch 06 complete');
SCRIPT

node /tmp/patch06.mjs
echo "✅ Patch 06 done"
