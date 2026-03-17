#!/bin/bash
# =============================================================
#  PATCH: DD Project Page — Overview Tab + Key Dates + CRM Links
#  Touches 1 file: client/src/pages/project.tsx
#  - Adds "Overview" as default first tab
#  - Key dates countdown banner (DD expiry, PSA, closing)
#  - Task progress by category
#  - Wires in KpisOverview + FindingsManager (already imported, unused)
#  - CRM cross-links to deal/property
# =============================================================
set -e

echo "=== Patching client/src/pages/project.tsx ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/project.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('DDOverviewTab') || src.includes('overview-tab')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add new imports after existing ones
src = src.replace(
  `import { useProject } from "@/hooks/use-project";`,
  `import { useProject } from "@/hooks/use-project";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { differenceInDays, format, parseISO } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar, Clock, AlertTriangle, CheckCircle2, TrendingUp,
  DollarSign, Building2, User, ExternalLink, Target, Shield,
  ChevronRight, Anchor,
} from "lucide-react";`
);

// 2. Add the DDOverviewTab component before the export default
const overviewComponent = `
// ── DD Overview Tab ───────────────────────────────────────────────────
function DDOverviewTab({ project, tasks, settings }: { project: any; tasks: any[]; settings: any }) {
  // Fetch linked deal if any
  const { data: linkedDeal } = useQuery({
    queryKey: ['dd-linked-deal', project.id],
    queryFn: async () => {
      try {
        // Try to find deal linked to this DD project
        const res = await apiRequest('GET', \`/api/deals?ddProjectId=\${project.id}&limit=1\`);
        const data = await res.json();
        return Array.isArray(data) ? data[0] : data?.deals?.[0] || null;
      } catch { return null; }
    },
    retry: false,
  });

  // Task stats
  const totalTasks = tasks.length;
  const completed = tasks.filter((t: any) => t.status === 'completed').length;
  const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
  const overdue = tasks.filter((t: any) => {
    if (t.status === 'completed') return false;
    if (!t.deadline) return false;
    return new Date(t.deadline) < new Date();
  }).length;
  const pct = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

  // Task breakdown by category
  const byCategory = tasks.reduce((acc: any, t: any) => {
    const cat = t.category || 'other';
    if (!acc[cat]) acc[cat] = { total: 0, done: 0 };
    acc[cat].total++;
    if (t.status === 'completed') acc[cat].done++;
    return acc;
  }, {});

  // Key dates
  const now = new Date();
  const dates = [
    { label: 'PSA Signed', date: project.psaSignedDate, icon: Shield, color: 'blue' },
    { label: 'DD Expiration', date: project.ddExpirationDate, icon: AlertTriangle, color: 'amber', urgent: true },
    { label: 'Closing Date', date: project.closingDate, icon: Calendar, color: 'emerald' },
  ].filter(d => d.date);

  const categoryColors: Record<string, string> = {
    title: 'bg-blue-500', survey: 'bg-purple-500', ESA: 'bg-green-500',
    appraisal: 'bg-amber-500', inspection: 'bg-orange-500', permits: 'bg-cyan-500',
    zoning: 'bg-indigo-500', financial: 'bg-emerald-500', legal: 'bg-red-500',
    insurance: 'bg-pink-500', other: 'bg-gray-400',
  };

  return (
    <div className="space-y-6">
      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4">
          <p className="text-xs text-blue-500 mb-1">Total Tasks</p>
          <p className="text-3xl font-bold text-blue-700">{totalTasks}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
          <p className="text-xs text-emerald-500 mb-1">Completed</p>
          <p className="text-3xl font-bold text-emerald-700">{completed}</p>
          <p className="text-xs text-emerald-400 mt-0.5">{pct}%</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4">
          <p className="text-xs text-amber-500 mb-1">In Progress</p>
          <p className="text-3xl font-bold text-amber-700">{inProgress}</p>
        </div>
        <div className={\`rounded-xl p-4 \${overdue > 0 ? 'bg-gradient-to-br from-red-50 to-red-100' : 'bg-gradient-to-br from-gray-50 to-gray-100'}\`}>
          <p className={\`text-xs mb-1 \${overdue > 0 ? 'text-red-500' : 'text-gray-400'}\`}>Overdue</p>
          <p className={\`text-3xl font-bold \${overdue > 0 ? 'text-red-700' : 'text-gray-400'}\`}>{overdue}</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Overall Progress</p>
            <p className="text-sm font-bold text-blue-600">{pct}%</p>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-gray-400 mt-1.5">{completed} of {totalTasks} tasks complete</p>
        </CardContent>
      </Card>

      {/* Key Dates */}
      {dates.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Key Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {dates.map(({ label, date, icon: Icon, color, urgent }) => {
                const d = new Date(date);
                const daysLeft = differenceInDays(d, now);
                const isPast = daysLeft < 0;
                const isSoon = !isPast && daysLeft <= 7;
                return (
                  <div key={label} className={cn(
                    'rounded-xl p-3 border-2 transition-colors',
                    isPast && urgent ? 'border-red-300 bg-red-50' :
                    isSoon && urgent ? 'border-amber-300 bg-amber-50' :
                    \`border-\${color}-200 bg-\${color}-50/50\`
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn('h-3.5 w-3.5', isPast && urgent ? 'text-red-500' : isSoon && urgent ? 'text-amber-500' : \`text-\${color}-500\`)} />
                      <p className="text-xs font-medium text-gray-600">{label}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-800">{format(d, 'MMM d, yyyy')}</p>
                    <p className={cn('text-xs mt-0.5 font-medium',
                      isPast ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-gray-400'
                    )}>
                      {isPast ? \`\${Math.abs(daysLeft)}d ago\` : daysLeft === 0 ? 'Today' : \`\${daysLeft}d remaining\`}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task breakdown by category */}
      {Object.keys(byCategory).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" />
              Progress by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {Object.entries(byCategory)
              .sort((a: any, b: any) => b[1].total - a[1].total)
              .map(([cat, stats]: any) => {
                const catPct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
                const color = categoryColors[cat] || 'bg-gray-400';
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={\`h-2 w-2 rounded-full \${color}\`} />
                        <span className="text-xs font-medium text-gray-700 capitalize">{cat}</span>
                      </div>
                      <span className="text-xs text-gray-500">{stats.done}/{stats.total} · {catPct}%</span>
                    </div>
                    <Progress value={catPct} className="h-1.5" />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* CRM cross-links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {linkedDeal && (
          <Card className="hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => window.location.href = \`/crm/deals/\${linkedDeal.id}\`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2.5 shrink-0">
                  <DollarSign className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Linked Deal</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{linkedDeal.title || linkedDeal.name}</p>
                  {linkedDeal.value && (
                    <p className="text-xs text-emerald-600 font-medium">\${parseFloat(linkedDeal.value || linkedDeal.amount || '0').toLocaleString()}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 shrink-0" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Report link */}
        <Card className="hover:shadow-md cursor-pointer transition-shadow"
          onClick={() => window.location.href = \`/dd/projects/\${project.id}/progress-report\`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2.5 shrink-0">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">Reports</p>
                <p className="text-sm font-semibold text-gray-900">Progress Report</p>
                <p className="text-xs text-gray-400">PDF export · executive summary</p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs extracted from documents */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Extracted KPIs</p>
        <KpisOverview projectId={project.id} />
      </div>

      {/* Findings */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Findings & Issues</p>
        <FindingsManager projectId={project.id} />
      </div>
    </div>
  );
}

`;

// Insert before export default
src = src.replace('export default function ProjectPage()', overviewComponent + 'export default function ProjectPage()');

// 3. Change default tab from 'reports' to 'overview' for non-portfolio projects
src = src.replace(
  `const effectiveActiveTab = activeTab || (isPortfolio ? "portfolio" : "reports");`,
  `const effectiveActiveTab = activeTab || (isPortfolio ? "portfolio" : "overview");`
);

// 4. Add Overview tab to tabs array (first, before 'reports')
src = src.replace(
  `  const baseTabs = [
    { id: "reports", label: "Tasks & Timeline" },`,
  `  const baseTabs = [
    { id: "overview", label: "Overview" },
    { id: "reports", label: "Tasks & Timeline" },`
);

// 5. Add Overview tab content in the tab render block
src = src.replace(
  `          {effectiveActiveTab === "reports" && (`,
  `          {effectiveActiveTab === "overview" && !isPortfolio && (
            <DDOverviewTab project={project} tasks={tasks} settings={settings} />
          )}
          {effectiveActiveTab === "reports" && (`
);

// 6. Fix cn import — add it if not already from @/lib/utils
if (!src.includes("import { cn }") && !src.includes('cn,')) {
  src = src.replace(
    `import { cn } from "@/lib/utils";`,
    `import { cn } from "@/lib/utils";`
  );
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ project.tsx patched');
JS

echo ""
echo "=== Verify ==="
grep -n "DDOverviewTab\|overview.*tab\|id: \"overview\"" client/src/pages/project.tsx | head -10

echo ""
echo "✅ DD project page enhanced."
echo ""
echo "What was added:"
echo "  • Overview tab (new default landing tab)"
echo "    — 4 KPI tiles: Total Tasks, Completed (%), In Progress, Overdue"
echo "    — Overall progress bar"
echo "    — Key Dates countdown: PSA Signed, DD Expiration (urgent if <7d), Closing"
echo "    — Progress by Category (title/ESA/financial/legal/etc) with mini bars"
echo "    — CRM cross-link to linked Deal"
echo "    — Quick link to Progress Report"
echo "    — KpisOverview (AI-extracted KPIs from uploaded docs)"
echo "    — FindingsManager (issues/findings tracker)"
echo ""
echo "  • Tasks & Timeline, Documents, DD Request, etc. all unchanged"
echo ""
echo "Restart: pkill -f 'tsx server' && npm run dev"
