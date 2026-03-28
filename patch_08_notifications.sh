#!/bin/bash
# PATCH 08: In-app notifications system
# - DB table creation via raw SQL script
# - Server route: GET/POST/PATCH /api/notifications
# - Frontend: NotificationBell component
# - Deal-rot scanner: POST /api/notifications/scan-rot
# Run from workspace root: bash patch_08_notifications.sh

echo "▶ Patch 08: Notifications system"

# ── STEP 1: Create notifications table ──────────────────────────────
cat > /tmp/create_notifications_table.sql << 'SQL'
-- crm_notifications: in-app notification storage
CREATE TABLE IF NOT EXISTS crm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL,
  user_id VARCHAR,              -- target user (null = org-wide)
  type TEXT NOT NULL DEFAULT 'automation',
  -- types: automation | deal_rot | task_due | stage_alert | system
  title TEXT NOT NULL,
  body TEXT,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',  -- extra context (ruleId, stageId, etc)
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_notifications_org_user 
  ON crm_notifications(org_id, user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_created 
  ON crm_notifications(org_id, created_at DESC);
SQL

echo "  SQL written to /tmp/create_notifications_table.sql"
echo "  Run in Replit DB console or add to migration file"

# ── STEP 2: Create notifications route file ──────────────────────────
cat > /tmp/notifications_route_to_add.ts << 'ROUTE'
/**
 * Notifications Routes
 * GET  /notifications         — list unread + recent (last 50)
 * POST /notifications         — create one manually
 * PATCH /notifications/:id/read — mark as read
 * POST /notifications/read-all — mark all as read
 * POST /notifications/scan-rot — scan deals for rot and create alerts
 * GET  /notifications/unread-count — fast count for bell badge
 */
import { Router, Request, Response } from 'express';
import { eq, and, isNull, desc, count, lt, sql } from 'drizzle-orm';

const router = Router();

async function getDb() { const { db } = await import('../db'); return db; }
async function getSchema() { return import('@shared/schema'); }
function getUserId(req: Request): string | null { const u = (req as any).user; return u?.id || u?.claims?.sub || null; }
function getOrgId(req: Request): string | null { return (req as any).orgId || (req as any).user?.orgId || null; }

// GET /notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const db = await getDb();
    const schema = await getSchema();

    const notifications = await db
      .select()
      .from(schema.crmNotifications)
      .where(and(
        eq(schema.crmNotifications.orgId, orgId),
        // Show: user's own + org-wide (userId = null)
        sql`(${schema.crmNotifications.userId} = ${userId} OR ${schema.crmNotifications.userId} IS NULL)`
      ))
      .orderBy(desc(schema.crmNotifications.createdAt))
      .limit(50);

    return res.json(notifications);
  } catch (e) {
    console.error('Notifications fetch error:', e);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.json({ count: 0 });
    const db = await getDb();
    const schema = await getSchema();

    const [result] = await db
      .select({ count: count() })
      .from(schema.crmNotifications)
      .where(and(
        eq(schema.crmNotifications.orgId, orgId),
        isNull(schema.crmNotifications.readAt),
        sql`(${schema.crmNotifications.userId} = ${userId} OR ${schema.crmNotifications.userId} IS NULL)`
      ));

    return res.json({ count: Number(result?.count || 0) });
  } catch (e) {
    return res.json({ count: 0 });
  }
});

// POST /notifications
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const { type = 'system', title, body, dealId, targetUserId, metadata = {} } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const db = await getDb();
    const schema = await getSchema();

    const [n] = await db.insert(schema.crmNotifications).values({
      orgId, userId: targetUserId || null, type, title, body: body || null,
      dealId: dealId || null, metadata,
    }).returning();

    return res.status(201).json(n);
  } catch (e) {
    console.error('Notification create error:', e);
    return res.status(500).json({ error: 'Failed to create notification' });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const db = await getDb();
    const schema = await getSchema();

    await db.update(schema.crmNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.crmNotifications.id, req.params.id), eq(schema.crmNotifications.orgId, orgId)));

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// POST /notifications/read-all
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const db = await getDb();
    const schema = await getSchema();

    await db.update(schema.crmNotifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(schema.crmNotifications.orgId, orgId),
        isNull(schema.crmNotifications.readAt),
        sql`(${schema.crmNotifications.userId} = ${userId} OR ${schema.crmNotifications.userId} IS NULL)`
      ));

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// POST /notifications/scan-rot
// Scans all open deals for rot (days in stage > threshold) and creates notifications
router.post('/scan-rot', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const db = await getDb();
    const schema = await getSchema();

    const rotThreshold = Number(req.body.threshold) || 30; // configurable
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - rotThreshold * 86400000);

    // Find deals that have been in their stage too long
    const rottingDeals = await db
      .select({
        id: schema.crmDeals.id,
        title: schema.crmDeals.title,
        ownerId: schema.crmDeals.ownerId,
        currentStageEnteredAt: schema.crmDeals.currentStageEnteredAt,
        stage: schema.crmDeals.stage,
      })
      .from(schema.crmDeals)
      .where(and(
        eq(schema.crmDeals.orgId, orgId),
        lt(schema.crmDeals.currentStageEnteredAt, thresholdDate),
        eq(schema.crmDeals.isClosed, false),
      ));

    let created = 0;
    for (const deal of rottingDeals) {
      const daysInStage = Math.floor((now.getTime() - new Date(deal.currentStageEnteredAt!).getTime()) / 86400000);

      // Check if a rot notification was already sent in the last 7 days to avoid spam
      const [existing] = await db
        .select({ id: schema.crmNotifications.id })
        .from(schema.crmNotifications)
        .where(and(
          eq(schema.crmNotifications.orgId, orgId),
          eq(schema.crmNotifications.dealId, deal.id),
          eq(schema.crmNotifications.type, 'deal_rot'),
          sql`${schema.crmNotifications.createdAt} > NOW() - INTERVAL '7 days'`
        ))
        .limit(1);

      if (!existing) {
        await db.insert(schema.crmNotifications).values({
          orgId,
          userId: deal.ownerId || null,
          type: 'deal_rot',
          title: `🔥 Rotting Deal: ${deal.title}`,
          body: `"${deal.title}" has been in "${deal.stage}" for ${daysInStage} days — action needed.`,
          dealId: deal.id,
          metadata: { daysInStage, stage: deal.stage, threshold: rotThreshold },
        });
        created++;
      }
    }

    return res.json({ scanned: rottingDeals.length, notificationsCreated: created });
  } catch (e) {
    console.error('Rot scan error:', e);
    return res.status(500).json({ error: 'Failed to scan for rotting deals' });
  }
});

export default router;
ROUTE

echo "  ✅ Notifications route written to /tmp/notifications_route_to_add.ts"
echo "  Copy to: server/routes/notifications-routes.ts"
echo "  Register in server/routes.ts: app.use('/api/notifications', notificationsRouter)"

cp /tmp/notifications_route_to_add.ts /tmp/pipeline/server/routes/notifications-routes.ts 2>/dev/null || true

# ── STEP 3: Create NotificationBell React component ──────────────────
cat > /tmp/patch08_notification_bell.mjs << 'SCRIPT'
import { writeFileSync } from 'fs';

const bellComponent = `import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, BellDot, Check, CheckCheck, X, AlertTriangle, Zap, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface Notification {
  id: string;
  type: 'automation' | 'deal_rot' | 'task_due' | 'stage_alert' | 'system';
  title: string;
  body?: string;
  dealId?: string;
  readAt?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'deal_rot': return <span className="text-red-500">🔥</span>;
    case 'automation': return <Zap className="h-3.5 w-3.5 text-purple-500" />;
    case 'task_due': return <Clock className="h-3.5 w-3.5 text-orange-500" />;
    case 'stage_alert': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    default: return <Info className="h-3.5 w-3.5 text-blue-500" />;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // poll every 30s
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count || 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", \`/api/notifications/\${id}/read\`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Scan for rot on mount
  useEffect(() => {
    apiRequest("POST", "/api/notifications/scan-rot", { threshold: 30 }).catch(() => {});
  }, []);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative h-8 w-8 p-0"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellDot className="h-4 w-4 text-gray-600" />
        ) : (
          <Bell className="h-4 w-4 text-gray-500" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white text-[9px] h-4 px-1">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                    onClick={() => markAllReadMutation.mutate()}
                  >
                    <CheckCheck className="h-3 w-3" />
                    All read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="ml-2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <ScrollArea className="max-h-[380px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">You're all caught up</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={\`flex gap-3 px-4 py-3 transition-colors cursor-default \${
                        !n.readAt ? "bg-blue-50/60 hover:bg-blue-50" : "hover:bg-gray-50"
                      }\`}
                    >
                      <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={\`text-xs font-medium leading-snug \${!n.readAt ? "text-gray-900" : "text-gray-600"}\`}>
                            {n.title}
                          </p>
                          {!n.readAt && (
                            <button
                              className="flex-shrink-0 text-gray-300 hover:text-blue-500"
                              onClick={() => markReadMutation.mutate(n.id)}
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {n.body && (
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </span>
                          {n.dealId && (
                            <Link
                              href={\`/crm/deals/\${n.dealId}\`}
                              onClick={() => setIsOpen(false)}
                              className="text-[10px] text-blue-500 hover:text-blue-600"
                            >
                              View deal →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-2">
              <Link
                href="/crm/activity"
                onClick={() => setIsOpen(false)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                View all activity →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
`;

writeFileSync('client/src/components/pipeline/NotificationBell.tsx', bellComponent);
console.log('  ✅ NotificationBell.tsx created at client/src/components/pipeline/NotificationBell.tsx');
console.log('  Add <NotificationBell /> to your TopBar/header component');
SCRIPT

node /tmp/patch08_notification_bell.mjs
echo "✅ Patch 08 done"
echo ""
echo "MANUAL STEPS NEEDED:"
echo "  1. Run the SQL in /tmp/create_notifications_table.sql against your DB"
echo "  2. Copy server/routes/notifications-routes.ts and register at /api/notifications in routes.ts"
echo "  3. Add <NotificationBell /> to your TopBar component"
echo "  4. Add crmNotifications to shared/schema.ts drizzle table definition"
