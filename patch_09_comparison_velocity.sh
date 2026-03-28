#!/bin/bash
# PATCH 09: Deal comparison surfaced in pipeline + velocity analytics tab
# Run from workspace root: bash patch_09_comparison_velocity.sh

echo "▶ Patch 09: Deal comparison in pipeline + velocity analytics tab"

cat > /tmp/patch09.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';

// ══════════════════════════════════════════════════════════
// 1. Add Deal Comparison mode to pipeline.tsx
// ══════════════════════════════════════════════════════════
{
  const file = 'client/src/pages/pipeline.tsx';
  let src = readFileSync(file, 'utf8');
  let changed = 0;

  // Add selectedForComparison state
  const OLD_QUICK_LOG_STATE = `const [quickLog, setQuickLog] = useState<{`;
  const COMPARE_STATE = `// Deals selected for comparison (shift+click cards)
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const quickLog_placeholder = null; // placeholder to maintain line
  const [quickLog, setQuickLog] = useState<{`;

  if (src.includes(OLD_QUICK_LOG_STATE) && !src.includes('selectedForComparison')) {
    src = src.replace(OLD_QUICK_LOG_STATE, COMPARE_STATE);
    console.log('  ✅ Added selectedForComparison state');
    changed++;
  }

  // Add Compare button to toolbar (next to the Analytics / Forecast buttons)
  const OLD_FORECAST_BTN = `onClick={() => setViewMode(viewMode === 'forecast' ? 'kanban' : 'forecast')}`;
  const NEW_FORECAST_BTN = `onClick={() => setViewMode(viewMode === 'forecast' ? 'kanban' : 'forecast')}`;

  // Add compare button after forecast button
  const OLD_SETTINGS_BTN = `<Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsSettingsOpen(true)}>`;
  const NEW_SETTINGS_BTN = `{selectedForComparison.size >= 2 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => setShowComparison(true)}
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                Compare {selectedForComparison.size}
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsSettingsOpen(true)}>`;

  if (src.includes(OLD_SETTINGS_BTN) && !src.includes('selectedForComparison.size >= 2')) {
    src = src.replace(OLD_SETTINGS_BTN, NEW_SETTINGS_BTN);
    console.log('  ✅ Added Compare button to toolbar (activates when 2+ cards selected)');
    changed++;
  }

  // Add shift+click selection to DealCard's Card onClick
  // In the pipeline.tsx, cards are clicked via handleDealClick — wire the comparison selection
  // Find onDealClick in the stage column rendering
  const OLD_DEAL_CLICK_RENDER = `onClick={() => handleDealClick(deal)}`;
  const NEW_DEAL_CLICK_RENDER = `onClick={(e) => {
                              if (e.shiftKey) {
                                setSelectedForComparison(prev => {
                                  const next = new Set(prev);
                                  if (next.has(deal.id)) { next.delete(deal.id); } else { next.add(deal.id); }
                                  return next;
                                });
                              } else {
                                handleDealClick(deal);
                              }
                            }}`;

  if (src.includes(OLD_DEAL_CLICK_RENDER) && !src.includes('e.shiftKey')) {
    src = src.replace(OLD_DEAL_CLICK_RENDER, NEW_DEAL_CLICK_RENDER);
    console.log('  ✅ Added shift+click multi-select for comparison');
    changed++;
  }

  // Add visual selection ring on selected-for-comparison deals
  // In DealCard, we need to pass isSelectedForComparison prop
  // First, add it to the DealCard call
  const OLD_DEAL_CARD_RENDER = `<DealCard deal={deal} onClick={() => {}} />`;
  if (src.includes(OLD_DEAL_CARD_RENDER)) {
    src = src.replace(OLD_DEAL_CARD_RENDER,
      `<DealCard deal={deal} onClick={() => {}} isCompareSelected={selectedForComparison.has(deal.id)} />`);
    console.log('  ✅ Passed isCompareSelected to DealCard overlay');
    changed++;
  }

  // Add the deal comparison modal (uses URL navigation to existing comparison page)
  const BEFORE_QUICKLOG_MODAL = `      {/* ── Quick-Log Modal ── */}`;
  const COMPARISON_PANEL = `      {/* ── Deal Comparison Modal ── */}
      {showComparison && selectedForComparison.size >= 2 && (
        <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex flex-col" onClick={() => setShowComparison(false)}>
          <div
            className="bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden mx-auto mt-auto w-full max-w-7xl"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h2 className="font-bold text-gray-900">Deal Comparison</h2>
                <Badge variant="outline">{selectedForComparison.size} deals</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const ids = Array.from(selectedForComparison).join(',');
                    window.open(\`/crm/deals/compare?ids=\${ids}\`, '_blank');
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open full view
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowComparison(false); setSelectedForComparison(new Set()); }}
                >
                  Clear & Close
                </Button>
              </div>
            </div>
            {/* Inline comparison: key metrics side-by-side */}
            <div className="overflow-auto flex-1 p-6">
              <ComparisonGrid dealIds={Array.from(selectedForComparison)} deals={deals} />
            </div>
          </div>
        </div>
      )}

      {/* ── Quick-Log Modal ── */}`;

  if (src.includes(BEFORE_QUICKLOG_MODAL) && !src.includes('Deal Comparison Modal')) {
    src = src.replace(BEFORE_QUICKLOG_MODAL, COMPARISON_PANEL);
    console.log('  ✅ Added deal comparison modal to pipeline');
    changed++;
  }

  // Add ExternalLink to lucide imports
  if (!src.includes('ExternalLink,')) {
    src = src.replace(
      'ArrowRight, Phone, Mail, StickyNote, Activity, Pencil,',
      'ArrowRight, Phone, Mail, StickyNote, Activity, Pencil, ExternalLink,'
    );
    console.log('  ✅ Added ExternalLink to imports');
    changed++;
  }

  writeFileSync(file, src);
  console.log(`  pipeline.tsx: ${changed}/6 changes applied`);
}

// ══════════════════════════════════════════════════════════
// 2. Add ComparisonGrid inline component to pipeline.tsx
// ══════════════════════════════════════════════════════════
{
  const file = 'client/src/pages/pipeline.tsx';
  let src = readFileSync(file, 'utf8');

  const BEFORE_GET_NEXT_KEY = `// Helper: pick the next most urgent upcoming date for a deal`;
  const COMPARISON_GRID = `// Inline comparison grid — shows key metrics side-by-side for selected deals
function ComparisonGrid({ dealIds, deals }: { dealIds: string[]; deals: DealWithRelations[] }) {
  const selectedDeals = dealIds.map(id => deals.find(d => d.id === id)).filter(Boolean) as DealWithRelations[];

  const rows = [
    { key: 'amount', label: 'Deal Value', format: (v: any) => formatCompactCurrency(Number(v) || 0) },
    { key: 'probability', label: 'Probability', format: (v: any) => \`\${v || 0}%\` },
    { key: 'stage', label: 'Current Stage', format: (v: any) => v || '—' },
    { key: 'expectedCloseDate', label: 'Expected Close', format: (v: any) => v ? format(new Date(v), 'MMM d, yyyy') : '—' },
    { key: 'assetClass', label: 'Asset Class', format: (v: any) => v || '—' },
    { key: 'priority', label: 'Priority', format: (v: any) => v || '—' },
    { key: 'forecastCategory', label: 'Forecast', format: (v: any) => v || '—' },
    { key: 'commissionAmount', label: 'Commission', format: (v: any) => v ? formatCompactCurrency(Number(v)) : '—' },
    { key: 'daysInCurrentStage', label: 'Days in Stage', format: (v: any) => v != null ? \`\${v}d\` : '—' },
    { key: 'leadSource', label: 'Lead Source', format: (v: any) => v || '—' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-6 text-xs font-medium text-gray-500 w-32">Metric</th>
            {selectedDeals.map(d => (
              <th key={d.id} className="text-left py-2 px-3 min-w-[180px]">
                <div className="font-semibold text-gray-900 truncate max-w-[180px]">{d.title}</div>
                <div className="text-xs text-gray-500 font-normal">{d.company?.name || '—'}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const values = selectedDeals.map(d => (d as any)[row.key]);
            const numValues = values.map(Number).filter(n => !isNaN(n) && n > 0);
            const maxVal = numValues.length ? Math.max(...numValues) : null;
            const minVal = numValues.length ? Math.min(...numValues) : null;

            return (
              <tr key={row.key} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-2 pr-6 text-xs text-gray-500 font-medium">{row.label}</td>
                {selectedDeals.map(d => {
                  const val = (d as any)[row.key];
                  const numVal = Number(val);
                  const isBest = maxVal !== null && numVal === maxVal && numValues.length > 1 &&
                    ['amount', 'probability', 'commissionAmount'].includes(row.key);
                  const isWorst = minVal !== null && numVal === minVal && numValues.length > 1 && isBest;
                  return (
                    <td key={d.id} className={\`py-2 px-3 text-sm \${isBest ? 'font-semibold text-green-700' : 'text-gray-800'}\`}>
                      {isBest && <span className="mr-1 text-[10px]">▲</span>}
                      {row.format(val)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Helper: pick the next most urgent upcoming date for a deal`;

  if (!src.includes('ComparisonGrid') && src.includes(BEFORE_GET_NEXT_KEY)) {
    src = src.replace(BEFORE_GET_NEXT_KEY, COMPARISON_GRID);
    console.log('  ✅ Added ComparisonGrid inline component');
    writeFileSync(file, src);
  }
}

// ══════════════════════════════════════════════════════════
// 3. Add Velocity tab to PipelineInsights.tsx
// ══════════════════════════════════════════════════════════
{
  const file = 'client/src/pages/crm/PipelineInsights.tsx';
  let src = readFileSync(file, 'utf8');

  // Find the tabs section and add a Velocity tab
  const OLD_TABS_LIST = `<TabsList>`;
  if (src.includes(OLD_TABS_LIST) && !src.includes('velocity')) {
    src = src.replace(OLD_TABS_LIST,
      `<TabsList>
          <TabsTrigger value="velocity">Velocity</TabsTrigger>`
    );
    console.log('  ✅ Added Velocity tab trigger to PipelineInsights');
  }

  // Add velocity tab content (using existing analytics data)
  const VELOCITY_TAB_CONTENT = `
    {/* ── Velocity Tab ── */}
    <TabsContent value="velocity">
      <VelocityTabContent />
    </TabsContent>
`;

  // Add before the closing Tabs tag
  const OLD_TABS_CLOSE = `</Tabs>`;
  if (src.includes(OLD_TABS_CLOSE) && !src.includes('VelocityTabContent')) {
    src = src.replace(OLD_TABS_CLOSE, VELOCITY_TAB_CONTENT + `</Tabs>`);
    console.log('  ✅ Added Velocity tab content to PipelineInsights');
  }

  writeFileSync(file, src);
}

// ══════════════════════════════════════════════════════════
// 4. Create VelocityTabContent component
// ══════════════════════════════════════════════════════════
{
  const velocityComponent = `import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Award } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface VelocityStage {
  stage: string;
  deal_count: number;
  avg_days: number;
  total_value: number;
}

export function VelocityTabContent() {
  const { data, isLoading } = useQuery<{ stages: VelocityStage[] }>({
    queryKey: ["/api/crm/analytics/velocity"],
  });

  const stages = data?.stages || [];
  const maxAvgDays = Math.max(...stages.map(s => s.avg_days), 1);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (!stages.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>No velocity data yet — move deals through stages to see metrics here.</p>
      </div>
    );
  }

  const bottlenecks = [...stages].sort((a, b) => b.avg_days - a.avg_days).slice(0, 3);
  const fastest = [...stages].sort((a, b) => a.avg_days - b.avg_days).slice(0, 3);

  const getBarColor = (avgDays: number) => {
    if (avgDays > 45) return "#ef4444";
    if (avgDays > 21) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 bg-gradient-to-br from-red-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-red-700">Biggest Bottleneck</span>
            </div>
            <p className="font-bold text-gray-900">{bottlenecks[0]?.stage || '—'}</p>
            <p className="text-sm text-red-600">{bottlenecks[0]?.avg_days?.toFixed(1)} avg days</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-green-700">Fastest Stage</span>
            </div>
            <p className="font-bold text-gray-900">{fastest[0]?.stage || '—'}</p>
            <p className="text-sm text-green-600">{fastest[0]?.avg_days?.toFixed(1)} avg days</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">Total Tracked Deals</span>
            </div>
            <p className="font-bold text-gray-900">
              {stages.reduce((s, st) => s + st.deal_count, 0)}
            </p>
            <p className="text-sm text-blue-600">across {stages.length} stages</p>
          </CardContent>
        </Card>
      </div>

      {/* Velocity bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Average Days per Stage</CardTitle>
          <p className="text-xs text-gray-500">
            Green = fast (&lt;21d) · Yellow = moderate (21–45d) · Red = bottleneck (&gt;45d)
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stages} layout="vertical" margin={{ left: 100, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => \`\${v}d\`} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={95} />
              <Tooltip
                formatter={(v: any) => [\`\${Number(v).toFixed(1)} days\`, 'Avg Days']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="avg_days" radius={[0, 4, 4, 0]}>
                {stages.map((s, i) => (
                  <Cell key={i} fill={getBarColor(s.avg_days)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stage table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="text-left py-2">Stage</th>
                <th className="text-right py-2">Active Deals</th>
                <th className="text-right py-2">Avg Days</th>
                <th className="text-right py-2">Total Value</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stage} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 font-medium text-gray-900">{s.stage}</td>
                  <td className="py-2 text-right text-gray-600">{s.deal_count}</td>
                  <td className="py-2 text-right font-mono text-sm">
                    <span className={
                      s.avg_days > 45 ? 'text-red-600 font-semibold' :
                      s.avg_days > 21 ? 'text-amber-600' : 'text-green-600'
                    }>
                      {s.avg_days.toFixed(1)}d
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(s.total_value)}</td>
                  <td className="py-2 text-right">
                    <Badge className={\`text-[10px] h-4 px-1.5 \${
                      s.avg_days > 45 ? 'bg-red-100 text-red-700' :
                      s.avg_days > 21 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }\`}>
                      {s.avg_days > 45 ? 'Bottleneck' : s.avg_days > 21 ? 'Moderate' : 'Healthy'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
`;

  writeFileSync('client/src/components/pipeline/VelocityTabContent.tsx', velocityComponent);
  console.log('  ✅ Created VelocityTabContent.tsx at client/src/components/pipeline/');
}

console.log('\n✅ Patch 09 complete');
SCRIPT

node /tmp/patch09.mjs
echo "✅ Patch 09 done"
