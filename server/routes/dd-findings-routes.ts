/**
 * DD Findings, KPI Dashboard & Unified Deal Team Routes
 *
 * Three enhancements to the Deal Workspace ecosystem:
 *   1. DD FINDINGS — formal capture of due diligence discoveries with severity,
 *      financial impact, recommendations, and resolution tracking
 *   2. DD KPI DASHBOARD — real-time metrics: items by status, avg response time,
 *      category completion heatmap, overdue %, risk exposure
 *   3. UNIFIED DEAL TEAM — merges dealContacts + workspaceMembers into one view
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  ddFindings,
  ddChecklistItems,
  ddChecklistSections,
  ddChecklists,
  dealWorkspaces,
  workspaceMembers,
  dealContacts,
  crmDeals,
  crmContacts,
  users,
} from "@shared/schema";
import { eq, and, desc, sql, count, gte, lte, inArray } from "drizzle-orm";

export const ddFindingsRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════
// 1. DD FINDINGS — CRUD + Analytics
// ═══════════════════════════════════════════════════════════════════════════

// POST /findings — create a finding
ddFindingsRouter.post("/findings", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;

    const {
      workspaceId, projectId, dealId, title, description, category, severity,
      estimatedFinancialImpact, impactType, impactTimeframe,
      recommendation, recommendedAction,
      checklistItemId, documentId, taskId,
      source, sourceDetail, attachments,
    } = req.body;

    if (!title || !category || !severity) {
      return res.status(400).json({ error: "title, category, and severity are required" });
    }

    const [finding] = await db
      .insert(ddFindings)
      .values({
        orgId,
        workspaceId, projectId, dealId,
        title, description, category, severity,
        estimatedFinancialImpact: estimatedFinancialImpact ? String(estimatedFinancialImpact) : null,
        impactType, impactTimeframe,
        recommendation, recommendedAction,
        checklistItemId, documentId, taskId,
        source, sourceDetail, attachments,
        discoveredBy: userId,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(finding);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /findings — list findings (filter by workspace, deal, category, severity, status)
ddFindingsRouter.get("/findings", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { workspaceId, dealId, projectId, category, severity, status } = req.query;

    const conditions = [eq(ddFindings.orgId, orgId)];
    if (workspaceId) conditions.push(eq(ddFindings.workspaceId, workspaceId as string));
    if (dealId) conditions.push(eq(ddFindings.dealId, dealId as string));
    if (projectId) conditions.push(eq(ddFindings.projectId, projectId as string));
    if (category) conditions.push(eq(ddFindings.category, category as string));
    if (severity) conditions.push(eq(ddFindings.severity, severity as string));
    if (status) conditions.push(eq(ddFindings.status, status as string));

    const findings = await db
      .select()
      .from(ddFindings)
      .where(and(...conditions))
      .orderBy(desc(ddFindings.discoveredAt))
      .limit(200);

    res.json(findings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /findings/:id — get single finding
ddFindingsRouter.get("/findings/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [finding] = await db
      .select()
      .from(ddFindings)
      .where(and(eq(ddFindings.id, req.params.id), eq(ddFindings.orgId, orgId)));
    if (!finding) return res.status(404).json({ error: "Finding not found" });
    res.json(finding);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /findings/:id — update a finding
ddFindingsRouter.patch("/findings/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;

    const updateData: Record<string, any> = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.orgId;
    delete updateData.createdBy;
    delete updateData.createdAt;

    // If resolving, track who and when
    if (req.body.status === "resolved" || req.body.status === "mitigated") {
      updateData.resolvedBy = userId;
      updateData.resolvedAt = new Date();
    }

    const [updated] = await db
      .update(ddFindings)
      .set(updateData)
      .where(and(eq(ddFindings.id, req.params.id), eq(ddFindings.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Finding not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /findings/:id
ddFindingsRouter.delete("/findings/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [deleted] = await db
      .delete(ddFindings)
      .where(and(eq(ddFindings.id, req.params.id), eq(ddFindings.orgId, orgId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Finding not found" });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /findings/summary/:workspaceId — findings summary for a workspace
ddFindingsRouter.get("/findings/summary/:workspaceId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { workspaceId } = req.params;

    const [stats] = await db
      .select({
        total: count(),
        critical: sql<number>`count(*) filter (where ${ddFindings.severity} = 'critical')`,
        major: sql<number>`count(*) filter (where ${ddFindings.severity} = 'major')`,
        minor: sql<number>`count(*) filter (where ${ddFindings.severity} = 'minor')`,
        observation: sql<number>`count(*) filter (where ${ddFindings.severity} = 'observation')`,
        positive: sql<number>`count(*) filter (where ${ddFindings.severity} = 'positive')`,
        open: sql<number>`count(*) filter (where ${ddFindings.status} = 'open')`,
        resolved: sql<number>`count(*) filter (where ${ddFindings.status} in ('resolved', 'mitigated'))`,
        escalated: sql<number>`count(*) filter (where ${ddFindings.status} = 'escalated')`,
        totalFinancialImpact: sql<string>`coalesce(sum(${ddFindings.estimatedFinancialImpact}::numeric), 0)`,
        unresolvedImpact: sql<string>`coalesce(sum(case when ${ddFindings.status} not in ('resolved', 'mitigated') then ${ddFindings.estimatedFinancialImpact}::numeric else 0 end), 0)`,
      })
      .from(ddFindings)
      .where(
        and(eq(ddFindings.orgId, orgId), eq(ddFindings.workspaceId, workspaceId)),
      );

    // Category breakdown
    const byCategory = await db
      .select({
        category: ddFindings.category,
        count: count(),
        criticalCount: sql<number>`count(*) filter (where ${ddFindings.severity} = 'critical')`,
        openCount: sql<number>`count(*) filter (where ${ddFindings.status} = 'open')`,
      })
      .from(ddFindings)
      .where(
        and(eq(ddFindings.orgId, orgId), eq(ddFindings.workspaceId, workspaceId)),
      )
      .groupBy(ddFindings.category);

    // Recommendation breakdown
    const byAction = await db
      .select({
        recommendedAction: ddFindings.recommendedAction,
        count: count(),
      })
      .from(ddFindings)
      .where(
        and(
          eq(ddFindings.orgId, orgId),
          eq(ddFindings.workspaceId, workspaceId),
          sql`${ddFindings.recommendedAction} is not null`,
        ),
      )
      .groupBy(ddFindings.recommendedAction);

    // Deal-breaker check
    const dealBreakers = await db
      .select()
      .from(ddFindings)
      .where(
        and(
          eq(ddFindings.orgId, orgId),
          eq(ddFindings.workspaceId, workspaceId),
          eq(ddFindings.severity, "critical"),
          eq(ddFindings.recommendedAction, "walk_away"),
        ),
      );

    res.json({
      workspaceId,
      stats: stats || {},
      byCategory,
      byRecommendedAction: byAction,
      dealBreakers: dealBreakers.length,
      dealBreakerFindings: dealBreakers,
      riskScore: computeFindingsRiskScore(stats),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. DD KPI DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

// GET /kpi/:workspaceId — full KPI dashboard for a workspace's DD
ddFindingsRouter.get("/kpi/:workspaceId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { workspaceId } = req.params;

    // Get the checklist for this workspace
    const [checklist] = await db
      .select()
      .from(ddChecklists)
      .where(
        and(eq(ddChecklists.workspaceId, workspaceId), eq(ddChecklists.orgId, orgId)),
      );

    if (!checklist) {
      return res.json({
        workspaceId,
        hasChecklist: false,
        message: "No DD checklist found for this workspace",
      });
    }

    // Get all sections
    const sections = await db
      .select()
      .from(ddChecklistSections)
      .where(eq(ddChecklistSections.checklistId, checklist.id))
      .orderBy(ddChecklistSections.sortOrder);

    const sectionIds = sections.map((s) => s.id);

    // Get all items
    let items: any[] = [];
    if (sectionIds.length > 0) {
      items = await db
        .select()
        .from(ddChecklistItems)
        .where(inArray(ddChecklistItems.sectionId, sectionIds));
    }

    // === ITEM STATUS BREAKDOWN ===
    const statusCounts: Record<string, number> = {};
    const internalStatusCounts: Record<string, number> = {};
    for (const item of items) {
      statusCounts[item.status || "open"] = (statusCounts[item.status || "open"] || 0) + 1;
      internalStatusCounts[item.internalStatus || "not_started"] =
        (internalStatusCounts[item.internalStatus || "not_started"] || 0) + 1;
    }

    // === COMPLETION METRICS ===
    const totalItems = items.length;
    const completedItems = items.filter((i) =>
      ["approved", "waived"].includes(i.status || ""),
    ).length;
    const providedItems = items.filter((i) =>
      ["provided", "reviewing", "approved", "waived"].includes(i.status || ""),
    ).length;
    const overdueItems = items.filter(
      (i) =>
        i.dueDate &&
        new Date(i.dueDate) < new Date() &&
        !["approved", "waived"].includes(i.status || ""),
    ).length;
    const blockedItems = items.filter((i) => i.status === "blocked").length;

    const completionPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const provisionPct = totalItems > 0 ? Math.round((providedItems / totalItems) * 100) : 0;
    const overduePct = totalItems > 0 ? Math.round((overdueItems / totalItems) * 100) : 0;

    // === CATEGORY HEATMAP ===
    const sectionMap = new Map(sections.map((s) => [s.id, s.title]));
    const categoryStats: Record<string, { total: number; completed: number; overdue: number; provided: number }> = {};

    for (const item of items) {
      const sectionTitle = sectionMap.get(item.sectionId) || "Uncategorized";
      if (!categoryStats[sectionTitle]) {
        categoryStats[sectionTitle] = { total: 0, completed: 0, overdue: 0, provided: 0 };
      }
      categoryStats[sectionTitle].total++;
      if (["approved", "waived"].includes(item.status || "")) categoryStats[sectionTitle].completed++;
      if (["provided", "reviewing", "approved", "waived"].includes(item.status || "")) categoryStats[sectionTitle].provided++;
      if (
        item.dueDate &&
        new Date(item.dueDate) < new Date() &&
        !["approved", "waived"].includes(item.status || "")
      ) {
        categoryStats[sectionTitle].overdue++;
      }
    }

    const categoryHeatmap = Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      total: stats.total,
      completed: stats.completed,
      provided: stats.provided,
      overdue: stats.overdue,
      completionPct: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      provisionPct: stats.total > 0 ? Math.round((stats.provided / stats.total) * 100) : 0,
    }));

    // === PRIORITY BREAKDOWN ===
    const priorityCounts: Record<string, number> = {};
    for (const item of items) {
      const p = item.priority || "medium";
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    }

    // === REQUEST TYPE BREAKDOWN ===
    const typeCounts: Record<string, number> = {};
    for (const item of items) {
      const t = item.requestType || "document";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    // === TIMELINE METRICS ===
    const itemsWithDueDates = items.filter((i) => i.dueDate);
    const upcomingDeadlines = itemsWithDueDates
      .filter(
        (i) =>
          new Date(i.dueDate!) > new Date() &&
          new Date(i.dueDate!) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
          !["approved", "waived"].includes(i.status || ""),
      )
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    // === AVG DAYS IN STATUS (for provided items) ===
    const providedWithDates = items.filter(
      (i) => ["provided", "reviewing", "approved"].includes(i.status || "") && i.createdAt,
    );
    const avgDaysToProvide =
      providedWithDates.length > 0
        ? Math.round(
            providedWithDates.reduce((sum, i) => {
              const created = new Date(i.createdAt!);
              const updated = new Date(i.updatedAt || i.createdAt!);
              return sum + (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
            }, 0) / providedWithDates.length,
          )
        : null;

    // === FINDINGS INTEGRATION ===
    const [findingStats] = await db
      .select({
        totalFindings: count(),
        criticalFindings: sql<number>`count(*) filter (where ${ddFindings.severity} = 'critical')`,
        openFindings: sql<number>`count(*) filter (where ${ddFindings.status} = 'open')`,
        totalImpact: sql<string>`coalesce(sum(${ddFindings.estimatedFinancialImpact}::numeric), 0)`,
      })
      .from(ddFindings)
      .where(
        and(eq(ddFindings.orgId, orgId), eq(ddFindings.workspaceId, workspaceId)),
      );

    res.json({
      workspaceId,
      checklistId: checklist.id,
      // Core metrics
      totalItems,
      completedItems,
      providedItems,
      overdueItems,
      blockedItems,
      completionPct,
      provisionPct,
      overduePct,
      // Breakdowns
      statusBreakdown: statusCounts,
      internalStatusBreakdown: internalStatusCounts,
      priorityBreakdown: priorityCounts,
      requestTypeBreakdown: typeCounts,
      // Heatmap
      categoryHeatmap,
      // Timeline
      avgDaysToProvide,
      upcomingDeadlines: upcomingDeadlines.slice(0, 10).map((i) => ({
        id: i.id,
        title: i.title,
        dueDate: i.dueDate,
        status: i.status,
        priority: i.priority,
        daysUntilDue: Math.ceil(
          (new Date(i.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      })),
      // Findings
      findings: findingStats || { totalFindings: 0, criticalFindings: 0, openFindings: 0, totalImpact: "0" },
      // Health score
      healthScore: computeDdHealthScore({
        completionPct,
        overduePct,
        blockedItems,
        totalItems,
        criticalFindings: findingStats?.criticalFindings || 0,
      }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. UNIFIED DEAL TEAM VIEW
// ═══════════════════════════════════════════════════════════════════════════

// GET /team/:dealId — unified team view merging dealContacts + workspaceMembers
ddFindingsRouter.get("/team/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;

    // 1. Get deal contacts (CRM-facing team)
    const contacts = await db
      .select()
      .from(dealContacts)
      .where(eq(dealContacts.dealId, dealId))
      .orderBy(dealContacts.displayOrder);

    // 2. Get workspace members (workspace-facing team)
    const [workspace] = await db
      .select()
      .from(dealWorkspaces)
      .where(and(eq(dealWorkspaces.dealId, dealId), eq(dealWorkspaces.orgId, orgId)));

    let members: any[] = [];
    if (workspace) {
      members = await db
        .select({
          id: workspaceMembers.id,
          userId: workspaceMembers.userId,
          email: workspaceMembers.email,
          displayName: workspaceMembers.displayName,
          role: workspaceMembers.role,
          vdrPermission: workspaceMembers.vdrPermission,
          ddPermission: workspaceMembers.ddPermission,
          inviteStatus: workspaceMembers.inviteStatus,
          invitedAt: workspaceMembers.invitedAt,
          acceptedAt: workspaceMembers.acceptedAt,
        })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspace.id));
    }

    // 3. Enrich workspace members with user info
    const enrichedMembers = [];
    for (const member of members) {
      let userName = member.displayName || "";
      let userEmail = member.email || "";

      if (member.userId) {
        const [user] = await db
          .select({ name: users.name, email: users.email, phone: users.phone })
          .from(users)
          .where(eq(users.id, member.userId));
        if (user) {
          userName = user.name || userName;
          userEmail = user.email || userEmail;
        }
      }

      enrichedMembers.push({
        source: "workspace",
        memberId: member.id,
        name: userName,
        email: userEmail,
        role: member.role,
        vdrPermission: member.vdrPermission,
        ddPermission: member.ddPermission,
        inviteStatus: member.inviteStatus,
        acceptedAt: member.acceptedAt,
      });
    }

    // 4. Enrich deal contacts with CRM info
    const enrichedContacts = [];
    for (const contact of contacts) {
      let crmContactInfo: any = null;
      if (contact.contactId) {
        const [crm] = await db
          .select({
            id: crmContacts.id,
            firstName: crmContacts.firstName,
            lastName: crmContacts.lastName,
            email: crmContacts.email,
            phone: crmContacts.phone,
            company: crmContacts.company,
            title: crmContacts.title,
          })
          .from(crmContacts)
          .where(eq(crmContacts.id, contact.contactId));
        crmContactInfo = crm;
      }

      enrichedContacts.push({
        source: "deal_contact",
        contactId: contact.id,
        crmContactId: contact.contactId,
        name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || crmContactInfo?.firstName + " " + crmContactInfo?.lastName,
        email: contact.email || crmContactInfo?.email || "",
        phone: contact.phone || crmContactInfo?.phone || "",
        company: contact.company || crmContactInfo?.company || "",
        titleRole: contact.titleRole || crmContactInfo?.title || "",
        contactType: contact.contactType,
        teamType: contact.teamType,
        isPrimary: contact.isPrimary,
      });
    }

    // 5. Merge and deduplicate by email
    const seen = new Set<string>();
    const unifiedTeam: any[] = [];

    // Workspace members first (they have permissions)
    for (const m of enrichedMembers) {
      const key = (m.email || "").toLowerCase();
      if (key) seen.add(key);

      // Find matching deal contact
      const matchingContact = enrichedContacts.find(
        (c) => c.email && c.email.toLowerCase() === key,
      );

      unifiedTeam.push({
        ...m,
        // Merge deal contact info if available
        company: matchingContact?.company || "",
        titleRole: matchingContact?.titleRole || "",
        contactType: matchingContact?.contactType || "",
        teamType: matchingContact?.teamType || m.role,
        isPrimary: matchingContact?.isPrimary || false,
        inWorkspace: true,
        inDealContacts: !!matchingContact,
      });
    }

    // Add deal contacts not in workspace
    for (const c of enrichedContacts) {
      const key = (c.email || "").toLowerCase();
      if (key && seen.has(key)) continue;

      unifiedTeam.push({
        ...c,
        vdrPermission: null,
        ddPermission: null,
        inviteStatus: null,
        inWorkspace: false,
        inDealContacts: true,
      });
    }

    // Group by team type
    const byTeamType: Record<string, any[]> = {};
    for (const member of unifiedTeam) {
      const type = member.teamType || member.role || "other";
      if (!byTeamType[type]) byTeamType[type] = [];
      byTeamType[type].push(member);
    }

    res.json({
      dealId,
      workspaceId: workspace?.id || null,
      totalMembers: unifiedTeam.length,
      inWorkspace: enrichedMembers.length,
      inDealContacts: enrichedContacts.length,
      team: unifiedTeam,
      byTeamType,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /team/:dealId/sync — sync workspace members to deal contacts and vice versa
ddFindingsRouter.post("/team/:dealId/sync", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;
    const { direction = "both" } = req.body; // workspace_to_deal | deal_to_workspace | both

    let synced = 0;

    const [workspace] = await db
      .select()
      .from(dealWorkspaces)
      .where(and(eq(dealWorkspaces.dealId, dealId), eq(dealWorkspaces.orgId, orgId)));

    if (!workspace) {
      return res.status(404).json({ error: "No workspace found for this deal" });
    }

    // Get existing members and contacts
    const wsMembers = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspace.id));

    const dContacts = await db
      .select()
      .from(dealContacts)
      .where(eq(dealContacts.dealId, dealId));

    const wsMemberEmails = new Set(wsMembers.map((m) => (m.email || "").toLowerCase()).filter(Boolean));
    const dcEmails = new Set(dContacts.map((c) => (c.email || "").toLowerCase()).filter(Boolean));

    // Sync workspace → deal contacts
    if (direction === "workspace_to_deal" || direction === "both") {
      for (const member of wsMembers) {
        const email = (member.email || "").toLowerCase();
        if (!email || dcEmails.has(email)) continue;

        let userName = member.displayName || "";
        if (member.userId) {
          const [user] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, member.userId));
          userName = user?.name || userName;
        }

        const [first, ...rest] = userName.split(" ");
        await db.insert(dealContacts).values({
          dealId,
          firstName: first || "",
          lastName: rest.join(" ") || "",
          email: member.email || "",
          teamType: member.role || "internal_member",
        });
        synced++;
      }
    }

    // Sync deal contacts → workspace members
    if (direction === "deal_to_workspace" || direction === "both") {
      for (const contact of dContacts) {
        const email = (contact.email || "").toLowerCase();
        if (!email || wsMemberEmails.has(email)) continue;

        const displayName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
        await db.insert(workspaceMembers).values({
          workspaceId: workspace.id,
          orgId,
          email: contact.email || "",
          displayName: displayName || contact.email || "",
          role: mapContactTypeToRole(contact.teamType || contact.contactType),
          vdrPermission: "view_only",
          ddPermission: "view",
          inviteStatus: "pending",
        });
        synced++;
      }
    }

    res.json({ synced, direction });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function computeFindingsRiskScore(stats: any): { score: number; label: string; color: string } {
  if (!stats) return { score: 0, label: "No Data", color: "gray" };

  const critical = stats.critical || 0;
  const major = stats.major || 0;
  const open = stats.open || 0;
  const escalated = stats.escalated || 0;

  // Higher = more risk
  let risk = 0;
  risk += critical * 30;
  risk += major * 15;
  risk += escalated * 20;
  risk += open * 5;

  const score = Math.min(100, risk);

  if (score >= 70) return { score, label: "High Risk", color: "red" };
  if (score >= 40) return { score, label: "Moderate Risk", color: "orange" };
  if (score >= 15) return { score, label: "Low Risk", color: "yellow" };
  return { score, label: "Minimal Risk", color: "green" };
}

function computeDdHealthScore(params: {
  completionPct: number;
  overduePct: number;
  blockedItems: number;
  totalItems: number;
  criticalFindings: number;
}): { score: number; label: string; color: string } {
  let score = 100;

  // Completion drives health up
  score = params.completionPct;

  // Overdue items reduce health
  score -= params.overduePct * 0.5;

  // Blocked items reduce health
  if (params.totalItems > 0) {
    score -= (params.blockedItems / params.totalItems) * 30;
  }

  // Critical findings are a major drag
  score -= params.criticalFindings * 10;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 80) return { score, label: "On Track", color: "green" };
  if (score >= 60) return { score, label: "Needs Attention", color: "yellow" };
  if (score >= 40) return { score, label: "At Risk", color: "orange" };
  return { score, label: "Critical", color: "red" };
}

function mapContactTypeToRole(contactType: string | null): string {
  const map: Record<string, string> = {
    buyer: "buyer",
    seller: "seller",
    broker: "broker",
    lender: "lender",
    attorney: "attorney",
    accountant: "accountant",
    consultant: "consultant",
    title: "consultant",
    inspector: "consultant",
  };
  return map[(contactType || "").toLowerCase()] || "viewer";
}
