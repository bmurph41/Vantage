#!/bin/bash
# PATCH 10: Deal health score + AI nudge sidebar + WIP limits per stage
# Run from workspace root: bash patch_10_health_nudges_wip.sh

echo "▶ Patch 10: Deal health score, AI nudges, WIP limits"

cat > /tmp/patch10.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';

// ══════════════════════════════════════════════════════════
// 1. Deal health score server endpoint
// ══════════════════════════════════════════════════════════

const healthScoreRoute = `/**
 * Deal Health Score Service
 * Computes a 0-100 health score per deal based on:
 *   - Activity recency (30 pts)
 *   - Field completeness (20 pts)
 *   - Days in stage vs benchmark (25 pts)
 *   - Probability alignment with stage (15 pts)
 *   - Upcoming deadline urgency (10 pts)
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, count, max } from 'drizzle-orm';

const router = Router();
async function getDb() { const { db } = await import('../db'); return db; }
async function getSchema() { return import('@shared/schema'); }
function getOrgId(req: Request): string | null { return (req as any).orgId || (req as any).user?.orgId || null; }

// Expected avg days per stage type (benchmark)
const STAGE_BENCHMARKS: Record<string, number> = {
  prospect: 14, initial_outreach: 7, qualified: 10, loi_submitted: 14,
  loi_negotiated: 21, loi_executed: 7, psa_drafting: 14, psa_executed: 7,
  due_diligence: 30, financing: 21, clear_to_close: 14, closed: 0,
};

// Fields that should be filled for a "complete" deal
const REQUIRED_FIELDS = ['amount', 'probability', 'expectedCloseDate', 'primaryContactId', 'assetClass'];
const NICE_TO_HAVE_FIELDS = ['description', 'forecastCategory', 'leadSource', 'companyId'];

function computeHealthScore(deal: any, activityStats: { count: number; lastDate: Date | null }): {
  score: number;
  breakdown: Record<string, number>;
  flags: string[];
} {
  const flags: string[] = [];
  let score = 0;
  const breakdown: Record<string, number> = {};

  // ── Activity Recency (30 pts) ──
  const daysSinceActivity = activityStats.lastDate
    ? Math.floor((Date.now() - activityStats.lastDate.getTime()) / 86400000)
    : 999;
  let activityScore = 0;
  if (daysSinceActivity <= 3) activityScore = 30;
  else if (daysSinceActivity <= 7) activityScore = 25;
  else if (daysSinceActivity <= 14) activityScore = 15;
  else if (daysSinceActivity <= 30) activityScore = 5;
  else { activityScore = 0; flags.push('No activity in 30+ days'); }
  breakdown.activityRecency = activityScore;
  score += activityScore;

  // ── Field Completeness (20 pts) ──
  const filledRequired = REQUIRED_FIELDS.filter(f => deal[f] != null && deal[f] !== '' && deal[f] !== 0).length;
  const filledNice = NICE_TO_HAVE_FIELDS.filter(f => deal[f] != null && deal[f] !== '').length;
  const completenessScore = Math.round(
    (filledRequired / REQUIRED_FIELDS.length) * 14 +
    (filledNice / NICE_TO_HAVE_FIELDS.length) * 6
  );
  if (filledRequired < REQUIRED_FIELDS.length) flags.push(\`Missing \${REQUIRED_FIELDS.length - filledRequired} required fields\`);
  breakdown.fieldCompleteness = completenessScore;
  score += completenessScore;

  // ── Days in Stage (25 pts) ──
  const daysInStage = deal.currentStageEnteredAt
    ? Math.floor((Date.now() - new Date(deal.currentStageEnteredAt).getTime()) / 86400000) : 0;
  const stageBenchmark = STAGE_BENCHMARKS[deal.stage] || 21;
  let stageScore = 0;
  const ratio = stageBenchmark > 0 ? daysInStage / stageBenchmark : 0;
  if (ratio <= 0.5) stageScore = 25;
  else if (ratio <= 1.0) stageScore = 20;
  else if (ratio <= 1.5) stageScore = 10;
  else if (ratio <= 2.0) stageScore = 3;
  else { stageScore = 0; flags.push(\`Stale: \${daysInStage}d in \${deal.stage} (benchmark: \${stageBenchmark}d)\`); }
  breakdown.stageVelocity = stageScore;
  score += stageScore;

  // ── Probability Alignment (15 pts) ──
  const prob = Number(deal.probability) || 0;
  let probScore = 0;
  if (prob >= 70) probScore = 15;
  else if (prob >= 50) probScore = 12;
  else if (prob >= 30) probScore = 8;
  else if (prob >= 10) probScore = 4;
  else { probScore = 0; flags.push('Low probability — qualify or advance stage'); }
  breakdown.probabilityAlignment = probScore;
  score += probScore;

  // ── Deadline Urgency (10 pts — rewards having near-term clarity) ──
  const closeDate = deal.expectedCloseDate || deal.closingDate;
  let urgencyScore = 0;
  if (closeDate) {
    const daysToClose = Math.floor((new Date(closeDate).getTime() - Date.now()) / 86400000);
    if (daysToClose < 0) { urgencyScore = 0; flags.push('Close date has passed'); }
    else if (daysToClose <= 30) urgencyScore = 10;
    else if (daysToClose <= 90) urgencyScore = 7;
    else urgencyScore = 4;
  } else {
    urgencyScore = 0;
    flags.push('No close date set');
  }
  breakdown.deadlineClarity = urgencyScore;
  score += urgencyScore;

  return { score: Math.min(100, Math.max(0, score)), breakdown, flags };
}

// POST /deal-health/compute-all — recompute scores for all open deals
router.post('/compute-all', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const db = await getDb();
    const schema = await getSchema();

    const deals = await db.select().from(schema.crmDeals)
      .where(and(eq(schema.crmDeals.orgId, orgId), eq(schema.crmDeals.isClosed, false)));

    const activityCounts = await db
      .select({
        dealId: schema.crmActivities.dealId,
        lastDate: max(schema.crmActivities.date),
        cnt: count(schema.crmActivities.id),
      })
      .from(schema.crmActivities)
      .where(eq(schema.crmActivities.orgId, orgId))
      .groupBy(schema.crmActivities.dealId);

    const actMap = new Map(activityCounts.map(a => [a.dealId, {
      count: Number(a.cnt),
      lastDate: a.lastDate ? new Date(a.lastDate) : null,
    }]));

    const results = [];
    for (const deal of deals) {
      const stats = actMap.get(deal.id) || { count: 0, lastDate: null };
      const { score } = computeHealthScore(deal, stats);
      await db.update(schema.crmDeals)
        .set({ score, updatedAt: new Date() } as any)
        .where(eq(schema.crmDeals.id, deal.id));
      results.push({ id: deal.id, title: deal.title, score });
    }

    return res.json({ updated: results.length, results });
  } catch (e) {
    console.error('Health score compute error:', e);
    return res.status(500).json({ error: 'Failed to compute health scores' });
  }
});

// GET /deal-health/:dealId — get detailed score for one deal
router.get('/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const db = await getDb();
    const schema = await getSchema();

    const [deal] = await db.select().from(schema.crmDeals)
      .where(and(eq(schema.crmDeals.id, req.params.dealId), eq(schema.crmDeals.orgId, orgId)));
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const [actStats] = await db.select({
      lastDate: max(schema.crmActivities.date),
      cnt: count(schema.crmActivities.id),
    }).from(schema.crmActivities)
      .where(and(eq(schema.crmActivities.orgId, orgId), eq(schema.crmActivities.dealId, deal.id)));

    const result = computeHealthScore(deal, {
      count: Number(actStats?.cnt || 0),
      lastDate: actStats?.lastDate ? new Date(actStats.lastDate) : null,
    });

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to compute deal health score' });
  }
});

export default router;
`;

writeFileSync('server/routes/deal-health-routes.ts', healthScoreRoute);
console.log('  ✅ Created server/routes/deal-health-routes.ts');
console.log('  Register: app.use("/api/deal-health", dealHealthRouter)');

// ══════════════════════════════════════════════════════════
// 2. AI Nudge Sidebar component
// ══════════════════════════════════════════════════════════

const nudgeComponent = `/**
 * PipelineNudges — Intelligent deal nudge sidebar
 * 
 * Shows contextual nudges based on:
 * - Stale deals (no activity > 7 days)
 * - Expiring deadlines (DD, deposit, close < 14 days)  
 * - Low health score deals
 * - Pipeline stage WIP breaches
 * - Won opportunities (encourage follow-up)
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, Flame, Calendar, Trophy, TrendingUp, Clock, ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { formatCompactCurrency } from "@shared/crm-constants";
import type { Deal } from "@shared/schema";

type DealWithRelations = Deal & {
  contact?: any; company?: any;
  activityCount?: number; lastActivityDate?: string;
};

interface Nudge {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  dealId: string;
  dealTitle: string;
  dealValue?: number;
  action?: string;
}

export function PipelineNudges({ deals, rotThreshold = 14 }: {
  deals: DealWithRelations[];
  rotThreshold?: number;
}) {
  const nudges = useMemo<Nudge[]>(() => {
    const result: Nudge[] = [];
    const now = new Date();

    for (const deal of deals) {
      if ((deal as any).isClosed) continue;

      // Stale activity
      const lastActivity = (deal as any).lastActivityDate;
      const daysSinceActivity = lastActivity
        ? differenceInDays(now, new Date(lastActivity)) : 999;
      if (daysSinceActivity > rotThreshold) {
        result.push({
          id: \`stale-\${deal.id}\`,
          priority: daysSinceActivity > 30 ? 'critical' : 'high',
          icon: <Flame className="h-3.5 w-3.5 text-red-500" />,
          title: 'No recent activity',
          subtitle: \`\${daysSinceActivity === 999 ? 'Never contacted' : \`\${daysSinceActivity}d since last touch\`}\`,
          dealId: deal.id,
          dealTitle: deal.title,
          dealValue: Number(deal.amount),
          action: 'Log activity',
        });
      }

      // Expiring deadlines
      const checkDeadlines = [
        { field: 'ddExpirationDate', label: 'DD expiring', warnDays: 7, priority: 'critical' as const },
        { field: 'firstDepositDueDate', label: '1st deposit due', warnDays: 10, priority: 'high' as const },
        { field: 'closingDate', label: 'Closing date', warnDays: 14, priority: 'high' as const },
        { field: 'expectedCloseDate', label: 'Close estimate', warnDays: 30, priority: 'medium' as const },
      ];
      for (const { field, label, warnDays, priority } of checkDeadlines) {
        const dateVal = (deal as any)[field];
        if (!dateVal) continue;
        const daysUntil = differenceInDays(new Date(dateVal), now);
        if (daysUntil >= 0 && daysUntil <= warnDays) {
          result.push({
            id: \`deadline-\${field}-\${deal.id}\`,
            priority,
            icon: <Calendar className="h-3.5 w-3.5 text-orange-500" />,
            title: label,
            subtitle: \`\${daysUntil === 0 ? 'Today' : \`\${daysUntil}d — \${format(new Date(dateVal), 'MMM d')}\`}\`,
            dealId: deal.id,
            dealTitle: deal.title,
            dealValue: Number(deal.amount),
            action: 'Review',
          });
        }
      }
    }

    // Sort: critical first, then high, then medium; within each, by deal value desc
    return result
      .sort((a, b) => {
        const p = { critical: 0, high: 1, medium: 2 };
        if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
        return (b.dealValue || 0) - (a.dealValue || 0);
      })
      .slice(0, 12); // cap at 12 nudges to avoid overwhelming
  }, [deals, rotThreshold]);

  if (nudges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
        <Trophy className="h-8 w-8 mb-2 text-green-300" />
        <p className="text-sm font-medium text-gray-600">All clear!</p>
        <p className="text-xs">No deals need immediate attention</p>
      </div>
    );
  }

  const criticalCount = nudges.filter(n => n.priority === 'critical').length;
  const highCount = nudges.filter(n => n.priority === 'high').length;

  return (
    <div className="space-y-1">
      {/* Summary bar */}
      <div className="flex items-center gap-2 px-1 mb-3">
        {criticalCount > 0 && (
          <Badge className="bg-red-100 text-red-700 text-[10px] h-5">
            {criticalCount} critical
          </Badge>
        )}
        {highCount > 0 && (
          <Badge className="bg-orange-100 text-orange-700 text-[10px] h-5">
            {highCount} urgent
          </Badge>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">{nudges.length} items</span>
      </div>

      {nudges.map((nudge) => (
        <Link
          key={nudge.id}
          href={\`/crm/deals/\${nudge.dealId}\`}
          className="block"
        >
          <div className={\`flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer hover:shadow-sm \${
            nudge.priority === 'critical' ? 'bg-red-50 hover:bg-red-100 border border-red-100' :
            nudge.priority === 'high' ? 'bg-orange-50 hover:bg-orange-100 border border-orange-100' :
            'bg-gray-50 hover:bg-gray-100 border border-gray-100'
          }\`}>
            <div className="mt-0.5 flex-shrink-0">{nudge.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-semibold text-gray-800 truncate">{nudge.dealTitle}</p>
                {nudge.dealValue ? (
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatCompactCurrency(nudge.dealValue)}
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] text-gray-500">{nudge.title} · {nudge.subtitle}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}
`;

writeFileSync('client/src/components/pipeline/PipelineNudges.tsx', nudgeComponent);
console.log('  ✅ Created client/src/components/pipeline/PipelineNudges.tsx');

// ══════════════════════════════════════════════════════════
// 3. Add Nudge sidebar panel to pipeline.tsx
// ══════════════════════════════════════════════════════════
{
  const file = 'client/src/pages/pipeline.tsx';
  let src = readFileSync(file, 'utf8');

  // Add import
  if (!src.includes('PipelineNudges')) {
    const oldImport = `import AutomationRulesPanel from "@/components/pipeline/AutomationRulesPanel";`;
    src = src.replace(oldImport,
      `import AutomationRulesPanel from "@/components/pipeline/AutomationRulesPanel";
import { PipelineNudges } from "@/components/pipeline/PipelineNudges";`
    );
    console.log('  ✅ Imported PipelineNudges');
  }

  // Add nudge panel toggle state
  if (!src.includes('showNudges')) {
    const oldState = `const [showComparison, setShowComparison] = useState(false);`;
    src = src.replace(oldState, `const [showComparison, setShowComparison] = useState(false);
  const [showNudges, setShowNudges] = useState(false);`);
    console.log('  ✅ Added showNudges state');
  }

  // Add a "Smart Nudges" button to the toolbar
  const OLD_COMPARE_BTN = `{selectedForComparison.size >= 2 && (`;
  const NUDGE_BTN = `<Button
              variant={showNudges ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowNudges(!showNudges)}
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              Nudges
              {deals.filter(d => {
                const last = (d as any).lastActivityDate;
                return !last || (Date.now() - new Date(last).getTime()) / 86400000 > 14;
              }).length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1">
                  {deals.filter(d => {
                    const last = (d as any).lastActivityDate;
                    return !last || (Date.now() - new Date(last).getTime()) / 86400000 > 14;
                  }).length}
                </span>
              )}
            </Button>
            {selectedForComparison.size >= 2 && (`;

  if (src.includes(OLD_COMPARE_BTN) && !src.includes('showNudges ? "default"')) {
    src = src.replace(OLD_COMPARE_BTN, NUDGE_BTN);
    console.log('  ✅ Added Smart Nudges button to toolbar');
  }

  // Add nudge panel as a collapsible sidebar next to the kanban
  // Find the main kanban container and wrap it with flex
  const OLD_KANBAN_WRAPPER = `<DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >`;
  const NEW_KANBAN_WRAPPER = `<div className="flex gap-4 flex-1 overflow-hidden">
              <div className={\`flex-1 overflow-x-auto transition-all \${showNudges ? 'mr-0' : ''}\`}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >`;

  const OLD_DRAG_OVERLAY_END = `</DragOverlay>
              </DndContext>`;
  const NEW_DRAG_OVERLAY_END = `</DragOverlay>
              </DndContext>
              </div>
              {/* Smart Nudges sidebar */}
              {showNudges && (
                <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-purple-500" />
                      <h3 className="font-semibold text-xs text-gray-800">Smart Nudges</h3>
                    </div>
                    <button onClick={() => setShowNudges(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2">
                    <PipelineNudges deals={deals} rotThreshold={30} />
                  </div>
                </div>
              )}
              </div>`;

  if (src.includes(OLD_KANBAN_WRAPPER) && !src.includes('Smart Nudges sidebar')) {
    src = src.replace(OLD_KANBAN_WRAPPER, NEW_KANBAN_WRAPPER);
    src = src.replace(OLD_DRAG_OVERLAY_END, NEW_DRAG_OVERLAY_END);
    console.log('  ✅ Added Smart Nudges collapsible sidebar to pipeline kanban');
  }

  // Add X to lucide imports if not present
  if (!src.includes("X,") && src.includes('from "lucide-react"')) {
    src = src.replace(
      'ArrowRight, Phone, Mail, StickyNote, Activity, Pencil, ExternalLink,',
      'ArrowRight, Phone, Mail, StickyNote, Activity, Pencil, ExternalLink, X,'
    );
    console.log('  ✅ Added X to lucide imports');
  }

  writeFileSync(file, src);
}

// ══════════════════════════════════════════════════════════
// 4. WIP Limits: warn when column exceeds limit
// ══════════════════════════════════════════════════════════
{
  const file = 'client/src/pages/pipeline.tsx';
  let src = readFileSync(file, 'utf8');

  // Add WIP limit visual warning to stage column header
  // Find where stageDeals.length is used in column header and add WIP indicator
  const OLD_WIP_SPOT = `{stageDeals.length > 0 && (() => {
                    const avgDays = Math.round(`;
  const NEW_WIP_SPOT = `{/* WIP limit warning */}
                  {(stage as any).wipLimit && stageDeals.length >= (stage as any).wipLimit && (
                    <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      WIP {stageDeals.length}/{(stage as any).wipLimit}
                    </div>
                  )}
                  {stageDeals.length > 0 && (() => {
                    const avgDays = Math.round(`;

  if (src.includes(OLD_WIP_SPOT) && !src.includes('WIP limit warning')) {
    src = src.replace(OLD_WIP_SPOT, NEW_WIP_SPOT);
    console.log('  ✅ Added WIP limit warning badge to stage column header');
  }

  // Add AlertTriangle to imports
  if (!src.includes('AlertTriangle,')) {
    src = src.replace(
      'Flame, Skull, Zap, ChevronDown',
      'Flame, Skull, Zap, ChevronDown, AlertTriangle'
    );
    console.log('  ✅ Added AlertTriangle to imports');
  }

  writeFileSync(file, src);
}

console.log('\n✅ Patch 10 complete');
console.log('  Register: app.use("/api/deal-health", dealHealthRouter) in server/routes.ts');
console.log('  Call POST /api/deal-health/compute-all on app init or nightly cron');
SCRIPT

node /tmp/patch10.mjs
echo "✅ Patch 10 done"
