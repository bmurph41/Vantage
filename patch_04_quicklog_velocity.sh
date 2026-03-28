#!/bin/bash
# PATCH 04: Quick-log modal + stage column velocity header
# Run from workspace root: bash patch_04_quicklog_velocity.sh

echo "▶ Patch 04: Quick-log modal + stage velocity stats"

cat > /tmp/patch04.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';
const file = 'client/src/pages/pipeline.tsx';
let src = readFileSync(file, 'utf8');
let changed = 0;

// ── 1. Add quickLog state variables (after existing useState declarations) ──
const SETTINGS_STATE = `const [isSettingsOpen, setIsSettingsOpen] = useState(false);`;
const NEW_STATES = `const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quickLog, setQuickLog] = useState<{
    dealId: string; dealTitle: string; type: 'call' | 'email' | 'note';
  } | null>(null);
  const [quickLogText, setQuickLogText] = useState('');`;

if (src.includes(SETTINGS_STATE) && !src.includes('quickLog,')) {
  src = src.replace(SETTINGS_STATE, NEW_STATES);
  console.log('  ✅ Added quickLog state');
  changed++;
}

// ── 2. Add quickLog useEffect + mutation (before return statement) ──
// Find a stable anchor just before the return
const BEFORE_RETURN = `  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">`;

const QUICKLOG_LOGIC = `  // ── Quick-log event listener (fired from card hover buttons) ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { dealId, dealTitle, type } = (e as CustomEvent).detail;
      setQuickLog({ dealId, dealTitle, type });
      setQuickLogText('');
    };
    window.addEventListener('pipeline:quick-log', handler);
    return () => window.removeEventListener('pipeline:quick-log', handler);
  }, []);

  const quickLogMutation = useMutation({
    mutationFn: async (data: { dealId: string; type: string; subject: string }) =>
      apiRequest("POST", "/api/activities", {
        ...data,
        direction: data.type === 'note' ? 'internal' : 'outbound',
        description: data.subject,
        date: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({ title: "Activity logged ✓", description: \`\${quickLog?.type} recorded\` });
      setQuickLog(null);
      setQuickLogText('');
    },
    onError: () => toast({ title: "Failed to log activity", variant: "destructive" }),
  });

`;

if (!src.includes('pipeline:quick-log') && src.includes(BEFORE_RETURN)) {
  src = src.replace(BEFORE_RETURN, QUICKLOG_LOGIC + BEFORE_RETURN);
  console.log('  ✅ Added quickLog useEffect and mutation');
  changed++;
}

// ── 3. Add QuickLog modal inside the main JSX return (before final closing tags) ──
// Find the closing of the main component's outermost div
// A reliable anchor: before the DealFormModal closing tags area
const BEFORE_DEAL_FORM_MODAL = `      {isDealFormOpen && (
        <DealFormModal`;

const QUICK_LOG_MODAL = `      {/* ── Quick-Log Modal ── */}
      {quickLog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setQuickLog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-96 space-y-4 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                quickLog.type === 'call' ? 'bg-green-100' :
                quickLog.type === 'email' ? 'bg-blue-100' : 'bg-yellow-100'
              }`}>
                {quickLog.type === 'call' ? <Phone className="h-4 w-4 text-green-600" /> :
                 quickLog.type === 'email' ? <Mail className="h-4 w-4 text-blue-600" /> :
                 <StickyNote className="h-4 w-4 text-yellow-600" />}
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-900">
                  {quickLog.type === 'call' ? 'Log Call' :
                   quickLog.type === 'email' ? 'Log Email' : 'Add Note'}
                </h3>
                <p className="text-xs text-gray-500 truncate max-w-[240px]">{quickLog.dealTitle}</p>
              </div>
              <button
                className="ml-auto text-gray-400 hover:text-gray-600"
                onClick={() => setQuickLog(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-600">
                {quickLog.type === 'note' ? 'Note' : 'Subject / Outcome'}
              </Label>
              <textarea
                autoFocus
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  quickLog.type === 'call' ? 'e.g. Spoke with owner, interested in LOI...' :
                  quickLog.type === 'email' ? 'e.g. Sent NDA for review...' :
                  'Write your note...'
                }
                value={quickLogText}
                onChange={(e) => setQuickLogText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && quickLogText.trim()) {
                    quickLogMutation.mutate({
                      dealId: quickLog.dealId,
                      type: quickLog.type,
                      subject: quickLogText,
                    });
                  }
                }}
              />
              <p className="text-[10px] text-gray-400">⌘+Enter to save</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setQuickLog(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!quickLogText.trim() || quickLogMutation.isPending}
                className={
                  quickLog.type === 'call' ? 'bg-green-600 hover:bg-green-700' :
                  quickLog.type === 'email' ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-yellow-500 hover:bg-yellow-600'
                }
                onClick={() => quickLogMutation.mutate({
                  dealId: quickLog.dealId,
                  type: quickLog.type,
                  subject: quickLogText,
                })}
              >
                {quickLogMutation.isPending ? 'Saving...' : 'Save Activity'}
              </Button>
            </div>
          </div>
        </div>
      )}

`;

if (!src.includes('Quick-Log Modal') && src.includes(BEFORE_DEAL_FORM_MODAL)) {
  src = src.replace(BEFORE_DEAL_FORM_MODAL, QUICK_LOG_MODAL + BEFORE_DEAL_FORM_MODAL);
  console.log('  ✅ Added QuickLog modal to pipeline JSX');
  changed++;
}

// ── 4. Stage column velocity: add avg-days stat under deal count ──
// Find the deal count + total value display in stage column header
// Look for where stageDeals.length is displayed
const OLD_STAGE_COUNT = `<span className="text-xs font-medium text-gray-500">{stageDeals.length} deals</span>`;
const NEW_STAGE_COUNT = `<span className="text-xs font-medium text-gray-500">{stageDeals.length} deals</span>
                  {stageDeals.length > 0 && (() => {
                    const avgDays = Math.round(
                      stageDeals.reduce((sum, d) => sum + (calculateDaysInStage(d.currentStageEnteredAt) || 0), 0)
                      / stageDeals.length
                    );
                    const threshold = rotThreshold || 30;
                    return (
                      <span className={\`text-[10px] font-medium \${
                        avgDays > threshold ? 'text-red-500' :
                        avgDays > threshold * 0.7 ? 'text-amber-500' :
                        'text-gray-400'
                      }\`}>
                        · avg {avgDays}d
                      </span>
                    );
                  })()}`;

if (src.includes(OLD_STAGE_COUNT)) {
  src = src.replace(OLD_STAGE_COUNT, NEW_STAGE_COUNT);
  console.log('  ✅ Added avg-days velocity stat to stage column header');
  changed++;
}

writeFileSync(file, src);
console.log(`\nPatch 04 complete: ${changed}/4 changes applied to ${file}`);
SCRIPT

node /tmp/patch04.mjs
echo "✅ Patch 04 done"
