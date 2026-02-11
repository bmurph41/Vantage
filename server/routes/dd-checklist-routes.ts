/**
 * DD Checklist Engine Routes
 * 
 * Provides full checklist management for deal workspaces:
 * - CRUD for checklists, sections, items
 * - Template-based provisioning with merge strategies
 * - File linking to VDR documents
 * - Comments with internal/external visibility
 * - Audit history on every mutation
 * - Deadline sync when workspace milestones change
 * - Excel and PDF exports
 * - Permission enforcement per workspace member role
 */
import { Router, Request, Response } from 'express';
import { eq, and, or, sql, desc, asc, inArray, count } from 'drizzle-orm';

const router = Router();

// ─── Helper: get db + schema lazily ──────────────────────────────────────────

async function getDb() {
  const { db } = await import('../db');
  return db;
}

async function getSchema() {
  return import('@shared/schema');
}

// ─── Helper: resolve member from userId + workspaceId ────────────────────────

async function getMember(db: any, schema: any, userId: string, workspaceId: string) {
  const [member] = await db
    .select()
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.userId, userId),
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        sql`${schema.workspaceMembers.revokedAt} IS NULL`
      )
    )
    .limit(1);
  return member || null;
}

// ─── Helper: enforce checklist permission ────────────────────────────────────

function canView(member: any): boolean {
  if (!member) return false;
  return member.canViewDdChecklist !== false;
}

function canEdit(member: any): boolean {
  if (!member) return false;
  if (member.canEditDdChecklist) return true;
  return ['owner_admin', 'internal_member'].includes(member.role);
}

function canRespond(member: any): boolean {
  if (!member) return false;
  if (member.canRespondToRequests) return true;
  return ['seller', 'broker'].includes(member.role);
}

function isInternal(member: any): boolean {
  return ['owner_admin', 'internal_member', 'buyer'].includes(member.role);
}

// ─── Helper: record history ──────────────────────────────────────────────────

async function recordHistory(
  db: any, schema: any,
  itemId: string, memberId: string | null, userId: string,
  action: string, meta: Record<string, any> = {}
) {
  await db.insert(schema.ddChecklistItemHistory).values({
    itemId,
    actorMemberId: memberId,
    actorUserId: userId,
    action,
    meta,
  });
}

// ─── Helper: compute due date from anchor ────────────────────────────────────

function computeDueDate(
  milestoneAnchor: string | null,
  dueOffsetDays: number | null,
  workspace: any
): string | null {
  if (!milestoneAnchor || dueOffsetDays == null) return null;
  let anchor: Date | null = null;
  if (milestoneAnchor === 'dd_start') anchor = workspace.ddStartDate ? new Date(workspace.ddStartDate) : new Date(workspace.createdAt);
  else if (milestoneAnchor === 'dd_expiration') anchor = workspace.ddExpirationDate ? new Date(workspace.ddExpirationDate) : null;
  else if (milestoneAnchor === 'closing') anchor = workspace.closingDate ? new Date(workspace.closingDate) : null;
  if (!anchor) return null;
  const d = new Date(anchor);
  d.setDate(d.getDate() + dueOffsetDays);
  return d.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLIST CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/workspaces/:id/dd-checklist
router.get('/api/workspaces/:id/dd-checklist', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const workspaceId = req.params.id;
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    const member = await getMember(db, schema, userId, workspaceId);
    if (!canView(member)) return res.status(403).json({ error: 'No checklist access' });

    // Get checklist
    const [checklist] = await db
      .select()
      .from(schema.ddChecklists)
      .where(and(eq(schema.ddChecklists.workspaceId, workspaceId), eq(schema.ddChecklists.status, 'active')))
      .limit(1);

    if (!checklist) return res.json({ checklist: null, sections: [], stats: { total: 0, open: 0, provided: 0, approved: 0 } });

    // Get sections with items
    const sections = await db
      .select()
      .from(schema.ddChecklistSections)
      .where(eq(schema.ddChecklistSections.checklistId, checklist.id))
      .orderBy(asc(schema.ddChecklistSections.sortOrder));

    const items = await db
      .select()
      .from(schema.ddChecklistItems)
      .where(
        inArray(
          schema.ddChecklistItems.sectionId,
          sections.map((s: any) => s.id)
        )
      )
      .orderBy(asc(schema.ddChecklistItems.sortOrder));

    // Get file counts per item
    const fileCounts = await db
      .select({
        itemId: schema.ddChecklistItemFiles.itemId,
        count: count(),
      })
      .from(schema.ddChecklistItemFiles)
      .where(
        inArray(
          schema.ddChecklistItemFiles.itemId,
          items.map((i: any) => i.id)
        )
      )
      .groupBy(schema.ddChecklistItemFiles.itemId);

    const fileCountMap: Record<string, number> = {};
    fileCounts.forEach((fc: any) => { fileCountMap[fc.itemId] = Number(fc.count); });

    // Get comment counts
    const commentCounts = await db
      .select({
        itemId: schema.ddChecklistItemComments.itemId,
        count: count(),
      })
      .from(schema.ddChecklistItemComments)
      .where(
        inArray(
          schema.ddChecklistItemComments.itemId,
          items.map((i: any) => i.id)
        )
      )
      .groupBy(schema.ddChecklistItemComments.itemId);

    const commentCountMap: Record<string, number> = {};
    commentCounts.forEach((cc: any) => { commentCountMap[cc.itemId] = Number(cc.count); });

    // Get periods for all items
    const allPeriods = items.length > 0 ? await db
      .select()
      .from(schema.ddChecklistItemPeriods)
      .where(
        inArray(
          schema.ddChecklistItemPeriods.itemId,
          items.map((i: any) => i.id)
        )
      )
      .orderBy(asc(schema.ddChecklistItemPeriods.periodSort)) : [];

    const periodsMap: Record<string, any[]> = {};
    allPeriods.forEach((p: any) => {
      if (!periodsMap[p.itemId]) periodsMap[p.itemId] = [];
      periodsMap[p.itemId].push(p);
    });

    // Filter internal fields for external users
    const isInternalUser = isInternal(member);
    const enrichedItems = items.map((item: any) => ({
      ...item,
      internalNotes: isInternalUser ? item.internalNotes : null,
      internalStatus: isInternalUser ? item.internalStatus : undefined,
      fileCount: fileCountMap[item.id] || 0,
      commentCount: commentCountMap[item.id] || 0,
      periods: periodsMap[item.id] || [],
    }));

    // Build sections with items
    const sectionsWithItems = sections.map((section: any) => ({
      ...section,
      items: enrichedItems.filter((i: any) => i.sectionId === section.id),
    }));

    // Stats
    const stats = {
      total: items.length,
      open: items.filter((i: any) => i.status === 'open').length,
      requested: items.filter((i: any) => i.status === 'requested').length,
      inProgress: items.filter((i: any) => i.status === 'in_progress').length,
      provided: items.filter((i: any) => i.status === 'provided').length,
      reviewing: items.filter((i: any) => i.status === 'reviewing').length,
      approved: items.filter((i: any) => i.status === 'approved').length,
      rejected: items.filter((i: any) => i.status === 'rejected').length,
      waived: items.filter((i: any) => i.status === 'waived').length,
      blocked: items.filter((i: any) => i.status === 'blocked').length,
      overdue: items.filter((i: any) => i.dueDate && new Date(i.dueDate) < new Date() && !['approved', 'waived'].includes(i.status)).length,
    };

    res.json({ checklist, sections: sectionsWithItems, stats });
  } catch (err: any) {
    console.error('[DD Checklist] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

// POST /api/workspaces/:id/dd-checklist (create empty)
router.post('/api/workspaces/:id/dd-checklist', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const workspaceId = req.params.id;
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    const member = await getMember(db, schema, userId, workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    // Check if active checklist already exists
    const [existing] = await db
      .select()
      .from(schema.ddChecklists)
      .where(and(eq(schema.ddChecklists.workspaceId, workspaceId), eq(schema.ddChecklists.status, 'active')))
      .limit(1);
    if (existing) return res.status(409).json({ error: 'Active checklist already exists', checklistId: existing.id });

    const [checklist] = await db.insert(schema.ddChecklists).values({
      workspaceId,
      orgId,
      name: req.body.name || 'DD Request List',
      createdByUserId: userId,
      ...(req.body.ddProjectId ? { ddProjectId: req.body.ddProjectId } : {}),
    }).returning();

    res.status(201).json(checklist);
  } catch (err: any) {
    console.error('[DD Checklist] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create checklist' });
  }
});

// POST /api/workspaces/:id/dd-checklist/from-template
router.post('/api/workspaces/:id/dd-checklist/from-template', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const workspaceId = req.params.id;
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
    const { templateIds, mergeStrategy = 'replace' } = req.body;
    // templateIds: array of template IDs from dd_checklist_templates OR built-in asset classes

    const member = await getMember(db, schema, userId, workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    // Get workspace for milestone dates
    const [workspace] = await db
      .select()
      .from(schema.dealWorkspaces)
      .where(eq(schema.dealWorkspaces.id, workspaceId))
      .limit(1);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    // Load templates from DB
    const templates = await db
      .select()
      .from(schema.ddChecklistTemplates)
      .where(
        inArray(schema.ddChecklistTemplates.id, Array.isArray(templateIds) ? templateIds : [templateIds])
      );

    if (templates.length === 0) return res.status(400).json({ error: 'No templates found' });

    // Get or create checklist
    let [checklist] = await db
      .select()
      .from(schema.ddChecklists)
      .where(and(eq(schema.ddChecklists.workspaceId, workspaceId), eq(schema.ddChecklists.status, 'active')))
      .limit(1);

    if (mergeStrategy === 'replace' && checklist) {
      // Archive old, create new
      await db.update(schema.ddChecklists)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(schema.ddChecklists.id, checklist.id));
      checklist = null as any;
    }

    if (!checklist) {
      const [newCl] = await db.insert(schema.ddChecklists).values({
        workspaceId,
        orgId,
        ddProjectId: workspace.ddProjectId || null,
        name: 'DD Request List',
        createdByUserId: userId,
      }).returning();
      checklist = newCl;
    }

    // Get existing sections for append/dedupe
    let existingSectionKeys = new Set<string>();
    let existingItemKeys = new Set<string>();
    let maxSortOrder = 0;

    if (mergeStrategy !== 'replace') {
      const existingSections = await db
        .select()
        .from(schema.ddChecklistSections)
        .where(eq(schema.ddChecklistSections.checklistId, checklist.id));
      maxSortOrder = Math.max(0, ...existingSections.map((s: any) => s.sortOrder));

      // For dedupe, we need existing item template keys
      if (mergeStrategy === 'dedupe_by_key') {
        const existingItems = await db
          .select({ templateKey: schema.ddChecklistItems.templateKey })
          .from(schema.ddChecklistItems)
          .where(
            inArray(
              schema.ddChecklistItems.sectionId,
              existingSections.map((s: any) => s.id)
            )
          );
        existingItemKeys = new Set(existingItems.filter((i: any) => i.templateKey).map((i: any) => i.templateKey));
      }
    }

    // Get workspace members for role-based assignment
    const members = await db
      .select()
      .from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspaceId, workspaceId), sql`${schema.workspaceMembers.revokedAt} IS NULL`));

    const memberByRole: Record<string, string> = {};
    for (const m of members) {
      if (!memberByRole[m.role]) memberByRole[m.role] = m.id;
    }

    let totalSections = 0;
    let totalItems = 0;

    // Process each template
    for (const tmpl of templates) {
      const templateData = tmpl.data as any;
      if (!templateData?.sections) continue;

      for (const sectionTmpl of templateData.sections) {
        maxSortOrder++;

        // Create section
        const [section] = await db.insert(schema.ddChecklistSections).values({
          checklistId: checklist.id,
          sortOrder: maxSortOrder,
          title: sectionTmpl.title,
          description: sectionTmpl.description || null,
          isCollapsedByDefault: sectionTmpl.defaultCollapsed || false,
        }).returning();
        totalSections++;

        // Create items
        let itemSort = 0;
        for (const itemTmpl of (sectionTmpl.items || [])) {
          // Dedupe check
          if (mergeStrategy === 'dedupe_by_key' && itemTmpl.key && existingItemKeys.has(itemTmpl.key)) {
            continue;
          }

          itemSort++;
          const dueDate = computeDueDate(itemTmpl.milestoneAnchor || null, itemTmpl.dueOffsetDays ?? null, workspace);

          const [item] = await db.insert(schema.ddChecklistItems).values({
            sectionId: section.id,
            sortOrder: itemSort,
            title: itemTmpl.title,
            requestText: itemTmpl.requestText || null,
            subCategory: itemTmpl.subCategory || null,
            priority: itemTmpl.priority || 2,
            requestType: itemTmpl.requestType || 'document',
            status: 'open',
            internalStatus: 'not_started',
            dueDate: dueDate || null,
            milestoneAnchor: itemTmpl.milestoneAnchor || null,
            dueOffsetDays: itemTmpl.dueOffsetDays ?? null,
            assignedToMemberId: itemTmpl.defaultOwnerRole ? (memberByRole[itemTmpl.defaultOwnerRole] || null) : null,
            tags: itemTmpl.tags || null,
            templateKey: itemTmpl.key || null,
          }).returning();

          await recordHistory(db, schema, item.id, member.id, userId, 'created', { source: 'template', templateName: tmpl.name });
          totalItems++;
        }
      }
    }

    res.status(201).json({
      checklistId: checklist.id,
      sectionsCreated: totalSections,
      itemsCreated: totalItems,
      mergeStrategy,
    });
  } catch (err: any) {
    console.error('[DD Checklist] from-template error:', err.message);
    res.status(500).json({ error: 'Failed to create from template' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/api/dd-checklist/:checklistId/sections', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { checklistId } = req.params;
    const userId = req.user?.id;

    // Get checklist to find workspace
    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, checklistId)).limit(1);
    if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    // Get max sort order
    const [maxSort] = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(schema.ddChecklistSections)
      .where(eq(schema.ddChecklistSections.checklistId, checklistId));

    const [section] = await db.insert(schema.ddChecklistSections).values({
      checklistId,
      sortOrder: (maxSort?.max || 0) + 1,
      title: req.body.title || 'New Section',
      description: req.body.description || null,
      isCollapsedByDefault: req.body.isCollapsedByDefault || false,
    }).returning();

    res.status(201).json(section);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create section' });
  }
});

router.patch('/api/dd-sections/:sectionId', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { sectionId } = req.params;
    const userId = req.user?.id;

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, sectionId)).limit(1);
    if (!section) return res.status(404).json({ error: 'Section not found' });

    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    const updates: any = { updatedAt: new Date() };
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.isCollapsedByDefault !== undefined) updates.isCollapsedByDefault = req.body.isCollapsedByDefault;

    const [updated] = await db.update(schema.ddChecklistSections).set(updates).where(eq(schema.ddChecklistSections.id, sectionId)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update section' });
  }
});

router.delete('/api/dd-sections/:sectionId', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { sectionId } = req.params;
    const userId = req.user?.id;

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, sectionId)).limit(1);
    if (!section) return res.status(404).json({ error: 'Section not found' });

    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    await db.delete(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, sectionId));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/api/dd-sections/:sectionId/items', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { sectionId } = req.params;
    const userId = req.user?.id;

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, sectionId)).limit(1);
    if (!section) return res.status(404).json({ error: 'Section not found' });

    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    const [maxSort] = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(schema.ddChecklistItems)
      .where(eq(schema.ddChecklistItems.sectionId, sectionId));

    const [item] = await db.insert(schema.ddChecklistItems).values({
      sectionId,
      sortOrder: (maxSort?.max || 0) + 1,
      title: req.body.title || 'New Item',
      requestText: req.body.requestText || null,
      subCategory: req.body.subCategory || null,
      priority: req.body.priority || 2,
      requestType: req.body.requestType || 'document',
      milestoneAnchor: req.body.milestoneAnchor || null,
      dueOffsetDays: req.body.dueOffsetDays ?? null,
      dueDate: req.body.dueDate || null,
      tags: req.body.tags || null,
    }).returning();

    await recordHistory(db, schema, item.id, member.id, userId, 'created', {});
    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.patch('/api/dd-items/:itemId', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { itemId } = req.params;
    const userId = req.user?.id;

    const [item] = await db.select().from(schema.ddChecklistItems).where(eq(schema.ddChecklistItems.id, itemId)).limit(1);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, item.sectionId)).limit(1);
    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);

    // Permission check: editors can update everything, responders can update sellerNotes + limited status
    const isEditor = canEdit(member);
    const isResponder = canRespond(member);
    if (!isEditor && !isResponder) return res.status(403).json({ error: 'No access' });

    const updates: any = { updatedAt: new Date() };
    const historyMeta: any = {};

    // Fields editors can update
    if (isEditor) {
      if (req.body.title !== undefined) { updates.title = req.body.title; historyMeta.title = req.body.title; }
      if (req.body.requestText !== undefined) updates.requestText = req.body.requestText;
      if (req.body.priority !== undefined) updates.priority = req.body.priority;
      if (req.body.requestType !== undefined) updates.requestType = req.body.requestType;
      if (req.body.internalStatus !== undefined) updates.internalStatus = req.body.internalStatus;
      if (req.body.internalNotes !== undefined) updates.internalNotes = req.body.internalNotes;
      if (req.body.assignedToMemberId !== undefined) { updates.assignedToMemberId = req.body.assignedToMemberId; historyMeta.assignedTo = req.body.assignedToMemberId; }
      if (req.body.reviewerMemberId !== undefined) updates.reviewerMemberId = req.body.reviewerMemberId;
      if (req.body.requestedFromMemberId !== undefined) updates.requestedFromMemberId = req.body.requestedFromMemberId;
      if (req.body.milestoneAnchor !== undefined) updates.milestoneAnchor = req.body.milestoneAnchor;
      if (req.body.dueOffsetDays !== undefined) updates.dueOffsetDays = req.body.dueOffsetDays;
      if (req.body.dueDate !== undefined) { updates.dueDate = req.body.dueDate; historyMeta.dueDate = req.body.dueDate; }
      if (req.body.subCategory !== undefined) updates.subCategory = req.body.subCategory;
      if (req.body.tags !== undefined) updates.tags = req.body.tags;
    }

    // Fields responders (seller/broker) can update
    if (req.body.sellerNotes !== undefined && (isEditor || isResponder)) {
      updates.sellerNotes = req.body.sellerNotes;
      historyMeta.sellerNotes = 'updated';
    }

    // Status changes
    if (req.body.status !== undefined) {
      const newStatus = req.body.status;
      const allowedForResponder = ['provided', 'in_progress'];
      if (isEditor || (isResponder && allowedForResponder.includes(newStatus))) {
        historyMeta.oldStatus = item.status;
        historyMeta.newStatus = newStatus;
        updates.status = newStatus;
      }
    }

    const [updated] = await db.update(schema.ddChecklistItems).set(updates).where(eq(schema.ddChecklistItems.id, itemId)).returning();

    // Record history
    const action = historyMeta.oldStatus ? 'status_changed' : (historyMeta.assignedTo ? 'assigned' : (historyMeta.dueDate ? 'deadline_changed' : 'edited'));
    await recordHistory(db, schema, itemId, member?.id || null, userId, action, historyMeta);

    res.json(updated);
  } catch (err: any) {
    console.error('[DD Item] PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/api/dd-items/:itemId', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { itemId } = req.params;
    const userId = req.user?.id;

    const [item] = await db.select().from(schema.ddChecklistItems).where(eq(schema.ddChecklistItems.id, itemId)).limit(1);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, item.sectionId)).limit(1);
    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    await db.delete(schema.ddChecklistItems).where(eq(schema.ddChecklistItems.id, itemId));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// POST /api/dd-items/:itemId/set-status (convenience endpoint)
router.post('/api/dd-items/:itemId/set-status', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { itemId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    const [item] = await db.select().from(schema.ddChecklistItems).where(eq(schema.ddChecklistItems.id, itemId)).limit(1);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, item.sectionId)).limit(1);
    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);

    if (!canEdit(member) && !canRespond(member)) return res.status(403).json({ error: 'No access' });

    // Responder status restrictions
    if (canRespond(member) && !canEdit(member)) {
      const allowed = checklist.sellerCanChangeStatus ? ['provided', 'in_progress'] : (checklist.sellerCanMarkProvided ? ['provided'] : []);
      if (!allowed.includes(status)) return res.status(403).json({ error: 'Status not allowed for your role' });
    }

    // Reviewer approval flow
    if (status === 'approved' && checklist.requireReviewerApproval && item.reviewerMemberId && member.id !== item.reviewerMemberId) {
      return res.status(403).json({ error: 'Only the assigned reviewer can approve' });
    }

    const [updated] = await db.update(schema.ddChecklistItems)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.ddChecklistItems.id, itemId))
      .returning();

    await recordHistory(db, schema, itemId, member?.id, userId, 'status_changed', { oldStatus: item.status, newStatus: status });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to set status' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REORDER
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/api/dd-sections/reorder', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { orderedIds } = req.body; // array of section IDs in new order
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' });

    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(schema.ddChecklistSections)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(eq(schema.ddChecklistSections.id, orderedIds[i]));
    }
    res.json({ reordered: orderedIds.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reorder sections' });
  }
});

router.post('/api/dd-items/reorder', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { orderedIds, targetSectionId } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' });

    for (let i = 0; i < orderedIds.length; i++) {
      const updates: any = { sortOrder: i + 1, updatedAt: new Date() };
      if (targetSectionId) updates.sectionId = targetSectionId;
      await db.update(schema.ddChecklistItems)
        .set(updates)
        .where(eq(schema.ddChecklistItems.id, orderedIds[i]));
    }
    res.json({ reordered: orderedIds.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/api/dd-items/:itemId/comments', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { itemId } = req.params;
    const userId = req.user?.id;

    const [item] = await db.select().from(schema.ddChecklistItems).where(eq(schema.ddChecklistItems.id, itemId)).limit(1);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, item.sectionId)).limit(1);
    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canView(member)) return res.status(403).json({ error: 'No access' });

    const comments = await db
      .select()
      .from(schema.ddChecklistItemComments)
      .where(eq(schema.ddChecklistItemComments.itemId, itemId))
      .orderBy(asc(schema.ddChecklistItemComments.createdAt));

    // Filter internal comments for external users
    const filtered = isInternal(member)
      ? comments
      : comments.filter((c: any) => c.visibility !== 'internal');

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/api/dd-items/:itemId/comments', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { itemId } = req.params;
    const userId = req.user?.id;
    const { body, visibility = 'all' } = req.body;

    if (!body?.trim()) return res.status(400).json({ error: 'Comment body required' });

    const [item] = await db.select().from(schema.ddChecklistItems).where(eq(schema.ddChecklistItems.id, itemId)).limit(1);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, item.sectionId)).limit(1);
    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canView(member)) return res.status(403).json({ error: 'No access' });

    // External users can only post 'external' or 'all' comments
    const vis = (!isInternal(member) && visibility === 'internal') ? 'all' : visibility;

    const [comment] = await db.insert(schema.ddChecklistItemComments).values({
      itemId,
      memberId: member?.id || null,
      userId,
      visibility: vis,
      body: body.trim(),
    }).returning();

    await recordHistory(db, schema, itemId, member?.id || null, userId, 'commented', { commentId: comment.id, visibility: vis });
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILE LINKING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/api/dd-items/:itemId/link-file', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { itemId } = req.params;
    const { documentId } = req.body;
    const userId = req.user?.id;

    if (!documentId) return res.status(400).json({ error: 'documentId required' });

    const [item] = await db.select().from(schema.ddChecklistItems).where(eq(schema.ddChecklistItems.id, itemId)).limit(1);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [section] = await db.select().from(schema.ddChecklistSections).where(eq(schema.ddChecklistSections.id, item.sectionId)).limit(1);
    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, section.checklistId)).limit(1);
    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canEdit(member) && !canRespond(member)) return res.status(403).json({ error: 'No access' });

    const [link] = await db.insert(schema.ddChecklistItemFiles).values({
      itemId,
      documentId,
      addedByMemberId: member?.id || null,
    }).returning();

    await recordHistory(db, schema, itemId, member?.id || null, userId, 'file_linked', { documentId });

    // Auto-set status to "provided" if toggle is on
    if (checklist.autoProvidedOnUpload && item.status === 'open') {
      await db.update(schema.ddChecklistItems)
        .set({ status: 'provided', updatedAt: new Date() })
        .where(eq(schema.ddChecklistItems.id, itemId));
      await recordHistory(db, schema, itemId, member?.id || null, userId, 'status_changed', {
        oldStatus: item.status, newStatus: 'provided', trigger: 'auto_file_upload'
      });
    }

    res.status(201).json(link);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to link file' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ITEM HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/api/dd-items/:itemId/history', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { itemId } = req.params;

    const history = await db
      .select()
      .from(schema.ddChecklistItemHistory)
      .where(eq(schema.ddChecklistItemHistory.itemId, itemId))
      .orderBy(desc(schema.ddChecklistItemHistory.createdAt))
      .limit(50);

    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLIST SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.patch('/api/dd-checklist/:checklistId/settings', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { checklistId } = req.params;
    const userId = req.user?.id;

    const [checklist] = await db.select().from(schema.ddChecklists).where(eq(schema.ddChecklists.id, checklistId)).limit(1);
    if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

    const member = await getMember(db, schema, userId, checklist.workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    const allowed = ['sellerCanMarkProvided', 'sellerCanChangeStatus', 'requireReviewerApproval', 'autoProvidedOnUpload', 'autoReminders', 'lockAfterClosing', 'caRequiredForChecklist', 'name'];
    const updates: any = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const [updated] = await db.update(schema.ddChecklists).set(updates).where(eq(schema.ddChecklists.id, checklistId)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEADLINE SYNC (recompute all derived dates)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/api/workspaces/:id/dd-checklist/sync-deadlines', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const workspaceId = req.params.id;
    const userId = req.user?.id;

    const member = await getMember(db, schema, userId, workspaceId);
    if (!canEdit(member)) return res.status(403).json({ error: 'No edit access' });

    const [workspace] = await db.select().from(schema.dealWorkspaces).where(eq(schema.dealWorkspaces.id, workspaceId)).limit(1);

    const [checklist] = await db.select().from(schema.ddChecklists)
      .where(and(eq(schema.ddChecklists.workspaceId, workspaceId), eq(schema.ddChecklists.status, 'active')))
      .limit(1);
    if (!checklist) return res.json({ updated: 0 });

    const sections = await db.select().from(schema.ddChecklistSections)
      .where(eq(schema.ddChecklistSections.checklistId, checklist.id));

    const items = await db.select().from(schema.ddChecklistItems)
      .where(inArray(schema.ddChecklistItems.sectionId, sections.map((s: any) => s.id)));

    let updated = 0;
    for (const item of items) {
      if (item.milestoneAnchor && item.dueOffsetDays != null) {
        const newDue = computeDueDate(item.milestoneAnchor, item.dueOffsetDays, workspace);
        if (newDue && newDue !== item.dueDate) {
          await db.update(schema.ddChecklistItems)
            .set({ dueDate: newDue, updatedAt: new Date() })
            .where(eq(schema.ddChecklistItems.id, item.id));
          await recordHistory(db, schema, item.id, member?.id, userId, 'deadline_changed', {
            oldDate: item.dueDate, newDate: newDue, trigger: 'milestone_sync'
          });
          updated++;
        }
      }
    }

    res.json({ updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to sync deadlines' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/api/dd-checklist-templates', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const orgId = req.user?.orgId;

    const templates = await db.select({
      id: schema.ddChecklistTemplates.id,
      description: schema.ddChecklistTemplates.description,
      data: schema.ddChecklistTemplates.data,
      name: schema.ddChecklistTemplates.name,
      version: schema.ddChecklistTemplates.version,
      assetClass: schema.ddChecklistTemplates.assetClass,
      isBuiltin: schema.ddChecklistTemplates.isBuiltin,
      createdAt: schema.ddChecklistTemplates.createdAt,
    }).from(schema.ddChecklistTemplates)
      .where(
        or(eq(schema.ddChecklistTemplates.isBuiltin, true), eq(schema.ddChecklistTemplates.orgId, orgId))
      )
      .orderBy(asc(schema.ddChecklistTemplates.name));

    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/dd-checklist-templates/seed - Seed built-in templates
router.post('/api/dd-checklist-templates/seed', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { DD_CHECKLIST_TEMPLATES } = await import('../templates/ddTemplates/index');

    let seeded = 0;
    for (const tmpl of DD_CHECKLIST_TEMPLATES) {
      // Check if already seeded
      const [existing] = await db.select().from(schema.ddChecklistTemplates)
        .where(and(
          eq(schema.ddChecklistTemplates.name, tmpl.name),
          eq(schema.ddChecklistTemplates.isBuiltin, true)
        )).limit(1);

      if (!existing) {
        await db.insert(schema.ddChecklistTemplates).values({
          name: tmpl.name,
          version: tmpl.version,
          assetClass: tmpl.assetClass as any,
          data: tmpl,
          isBuiltin: true,
        });
        seeded++;
      }
    }

    res.json({ seeded, total: DD_CHECKLIST_TEMPLATES.length });
  } catch (err: any) {
    console.error('[Seed] Error:', err.message);
    res.status(500).json({ error: 'Failed to seed templates' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS (Excel + PDF)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/api/workspaces/:id/dd-checklist/export/excel', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const workspaceId = req.params.id;

    const [checklist] = await db.select().from(schema.ddChecklists)
      .where(and(eq(schema.ddChecklists.workspaceId, workspaceId), eq(schema.ddChecklists.status, 'active')))
      .limit(1);
    if (!checklist) return res.status(404).json({ error: 'No active checklist' });

    const sections = await db.select().from(schema.ddChecklistSections)
      .where(eq(schema.ddChecklistSections.checklistId, checklist.id))
      .orderBy(asc(schema.ddChecklistSections.sortOrder));

    const allItems = await db.select().from(schema.ddChecklistItems)
      .where(inArray(schema.ddChecklistItems.sectionId, sections.map((s: any) => s.id)))
      .orderBy(asc(schema.ddChecklistItems.sortOrder));

    // Build CSV (Excel-compatible)
    const rows = [['Category', 'Sub Category', 'Priority', 'Data Request List', 'Status', 'Internal Status', 'Notes', 'Seller Notes', 'Due Date', 'Last Updated'].join(',')];

    for (const section of sections) {
      const items = allItems.filter((i: any) => i.sectionId === section.id);
      for (const item of items) {
        const esc = (s: string | null) => s ? `"${s.replace(/"/g, '""')}"` : '';
        rows.push([
          esc(section.title),
          esc(item.subCategory),
          String(item.priority),
          esc(item.title),
          esc(item.status),
          esc(item.internalStatus),
          esc(item.internalNotes),
          esc(item.sellerNotes),
          item.dueDate || '',
          item.updatedAt ? new Date(item.updatedAt).toISOString().split('T')[0] : '',
        ].join(','));
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dd-checklist-${workspaceId}.csv"`);
    res.send(rows.join('\n'));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export' });
  }
});

router.post('/api/workspaces/:id/dd-checklist/export/pdf', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const workspaceId = req.params.id;

    const [checklist] = await db.select().from(schema.ddChecklists)
      .where(and(eq(schema.ddChecklists.workspaceId, workspaceId), eq(schema.ddChecklists.status, 'active')))
      .limit(1);
    if (!checklist) return res.status(404).json({ error: 'No active checklist' });

    const [workspace] = await db.select().from(schema.dealWorkspaces).where(eq(schema.dealWorkspaces.id, workspaceId)).limit(1);

    const sections = await db.select().from(schema.ddChecklistSections)
      .where(eq(schema.ddChecklistSections.checklistId, checklist.id))
      .orderBy(asc(schema.ddChecklistSections.sortOrder));

    const allItems = await db.select().from(schema.ddChecklistItems)
      .where(inArray(schema.ddChecklistItems.sectionId, sections.map((s: any) => s.id)))
      .orderBy(asc(schema.ddChecklistItems.sortOrder));

    // Build simple HTML for PDF (printable)
    let html = `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:40px;}
      h1{font-size:20px;margin-bottom:5px;} h2{font-size:14px;margin:15px 0 5px;color:#333;border-bottom:1px solid #ccc;padding-bottom:3px;}
      table{width:100%;border-collapse:collapse;margin-bottom:15px;} th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;}
      th{background:#f5f5f5;font-weight:600;font-size:11px;} td{font-size:11px;}
      .p1{color:#d32f2f;font-weight:600;} .p2{color:#f57c00;} .p3{color:#757575;}
      .status{display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;}
    </style></head><body>`;
    html += `<h1>${checklist.name}</h1>`;
    html += `<p style="color:#666;">Workspace: ${workspace?.name || workspaceId} | Generated: ${new Date().toLocaleDateString()}</p>`;

    for (const section of sections) {
      const items = allItems.filter((i: any) => i.sectionId === section.id);
      html += `<h2>${section.title} (${items.filter((i: any) => i.status === 'approved').length}/${items.length} approved)</h2>`;
      html += `<table><tr><th>#</th><th>Priority</th><th>Request</th><th>Status</th><th>Due Date</th><th>Seller Notes</th></tr>`;
      items.forEach((item: any, idx: number) => {
        const pClass = item.priority === 1 ? 'p1' : item.priority === 2 ? 'p2' : 'p3';
        html += `<tr><td>${idx + 1}</td><td class="${pClass}">${item.priority === 1 ? 'High' : item.priority === 2 ? 'Med' : 'Low'}</td>`;
        html += `<td><strong>${item.title}</strong>${item.requestText ? '<br/>' + item.requestText : ''}</td>`;
        html += `<td>${item.status.replace(/_/g, ' ')}</td>`;
        html += `<td>${item.dueDate || '-'}</td>`;
        html += `<td>${item.sellerNotes || ''}</td></tr>`;
      });
      html += `</table>`;
    }
    html += `</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="dd-checklist-${workspaceId}.html"`);
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

export { router as ddChecklistRouter };

// GET /api/projects/:projectId/workspace-link - find workspace linked to a DD project
router.get('/api/projects/:projectId/workspace-link', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { projectId } = req.params;

    const [workspace] = await db
      .select({ id: schema.dealWorkspaces.id, name: schema.dealWorkspaces.name })
      .from(schema.dealWorkspaces)
      .where(eq(schema.dealWorkspaces.ddProjectId, projectId))
      .limit(1);

    if (!workspace) return res.status(404).json({ error: 'No workspace linked to this project' });
    res.json(workspace);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to lookup workspace' });
  }
});

// GET /api/projects/:projectId/dd-request-items - Get DD checklist items for dependency linking
router.get('/api/projects/:projectId/dd-request-items', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { projectId } = req.params;

    // Find workspace linked to this project
    const [workspace] = await db
      .select({ id: schema.dealWorkspaces.id })
      .from(schema.dealWorkspaces)
      .where(eq(schema.dealWorkspaces.ddProjectId, projectId))
      .limit(1);
    if (!workspace) return res.json([]);

    // Find active checklist
    const [checklist] = await db
      .select({ id: schema.ddChecklists.id })
      .from(schema.ddChecklists)
      .where(and(eq(schema.ddChecklists.workspaceId, workspace.id), eq(schema.ddChecklists.status, 'active')))
      .limit(1);
    if (!checklist) return res.json([]);

    // Get all sections with items
    const sections = await db
      .select({
        id: schema.ddChecklistSections.id,
        title: schema.ddChecklistSections.title,
      })
      .from(schema.ddChecklistSections)
      .where(eq(schema.ddChecklistSections.checklistId, checklist.id))
      .orderBy(asc(schema.ddChecklistSections.sortOrder));

    if (sections.length === 0) return res.json([]);

    const sectionIds = sections.map(s => s.id);
    const sectionMap = Object.fromEntries(sections.map(s => [s.id, s.title]));

    const items = await db
      .select({
        id: schema.ddChecklistItems.id,
        sectionId: schema.ddChecklistItems.sectionId,
        title: schema.ddChecklistItems.title,
        subCategory: schema.ddChecklistItems.subCategory,
        status: schema.ddChecklistItems.status,
        priority: schema.ddChecklistItems.priority,
      })
      .from(schema.ddChecklistItems)
      .where(inArray(schema.ddChecklistItems.sectionId, sectionIds))
      .orderBy(asc(schema.ddChecklistItems.sortOrder));

    const result = items.map(item => ({
      ...item,
      sectionTitle: sectionMap[item.sectionId] || 'Unknown',
      type: 'dd_request' as const,
    }));

    res.json(result);
  } catch (err: any) {
    console.error('[DD] dd-request-items error:', err.message);
    res.status(500).json({ error: 'Failed to fetch DD request items' });
  }
});

// ─── GET /api/dd-items/:id/periods ───────────────────────────────────────────
// Returns all period slots for a checklist item
router.get('/api/dd-items/:id/periods', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;

    const periods = await db
      .select()
      .from(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.itemId, id))
      .orderBy(asc(schema.ddChecklistItemPeriods.periodSort));

    const total = periods.length;
    const received = periods.filter((p: any) => p.isReceived).length;

    res.json({ 
      periods, 
      progress: { total, received, pct: total > 0 ? Math.round((received / total) * 100) : 0 }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch periods' });
  }
});

// ─── POST /api/dd-items/:id/periods ──────────────────────────────────────────
// Add period slots to an item. Accepts: { type: 'year'|'month'|'trailing', values: string[] }
router.post('/api/dd-items/:id/periods', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;
    const { type, values } = req.body;

    if (!type || !values?.length) {
      return res.status(400).json({ error: 'type and values are required' });
    }

    // Validate type
    if (!['year', 'month', 'trailing'].includes(type)) {
      return res.status(400).json({ error: 'type must be year, month, or trailing' });
    }

    // Get existing periods to avoid duplicates
    const existing = await db
      .select({ label: schema.ddChecklistItemPeriods.periodLabel })
      .from(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.itemId, id));
    
    const existingLabels = new Set(existing.map((e: any) => e.label));

    // Build sort order based on type
    const getSortOrder = (label: string, idx: number) => {
      if (type === 'year') return parseInt(label) || idx;
      if (type === 'month') {
        // Parse "Jan 2024" format
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const parts = label.split(' ');
        const monthIdx = months.indexOf(parts[0]);
        const year = parseInt(parts[1]) || 2024;
        return year * 100 + (monthIdx >= 0 ? monthIdx : idx);
      }
      if (type === 'trailing') {
        // T12 = 12, T24 = 24, T36 = 36
        return parseInt(label.replace(/\D/g, '')) || idx;
      }
      return idx;
    };

    const newValues = values.filter((v: string) => !existingLabels.has(v));
    
    if (newValues.length === 0) {
      return res.json({ added: 0, message: 'All periods already exist' });
    }

    const rows = newValues.map((label: string, idx: number) => ({
      itemId: id,
      periodType: type,
      periodLabel: label,
      periodSort: getSortOrder(label, idx),
      isReceived: false,
    }));

    await db.insert(schema.ddChecklistItemPeriods).values(rows);

    // Update item's period_config and has_periods flag
    await db.update(schema.ddChecklistItems).set({
      hasPeriods: true,
      periodConfig: { type, values: [...existingLabels, ...newValues] },
      updatedAt: new Date(),
    }).where(eq(schema.ddChecklistItems.id, id));

    res.status(201).json({ added: newValues.length, skipped: values.length - newValues.length });
  } catch (err: any) {
    console.error('Error adding periods:', err);
    res.status(500).json({ error: 'Failed to add periods' });
  }
});

// ─── PATCH /api/dd-item-periods/:id ──────────────────────────────────────────
// Toggle received status or update notes on a period slot
router.patch('/api/dd-item-periods/:id', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;
    const userId = req.user?.id || req.userId;
    const { isReceived, notes, fileId } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (isReceived !== undefined) {
      updates.isReceived = isReceived;
      updates.receivedAt = isReceived ? new Date() : null;
      updates.receivedBy = isReceived ? userId : null;
    }
    if (notes !== undefined) updates.notes = notes;
    if (fileId !== undefined) updates.fileId = fileId;

    const [updated] = await db
      .update(schema.ddChecklistItemPeriods)
      .set(updates)
      .where(eq(schema.ddChecklistItemPeriods.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Period not found' });

    // Recompute item status based on periods
    const itemId = updated.itemId;
    const allPeriods = await db
      .select()
      .from(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.itemId, itemId));

    const total = allPeriods.length;
    const received = allPeriods.filter((p: any) => p.isReceived).length;

    // Auto-update item status based on period completion
    let newStatus = undefined;
    if (total > 0) {
      if (received === 0) newStatus = 'open';
      else if (received === total) newStatus = 'provided';
      else newStatus = 'in_progress';
    }

    if (newStatus) {
      await db.update(schema.ddChecklistItems).set({
        status: newStatus,
        updatedAt: new Date(),
      }).where(eq(schema.ddChecklistItems.id, itemId));
    }

    res.json({ 
      period: updated, 
      itemProgress: { total, received, pct: total > 0 ? Math.round((received / total) * 100) : 0 },
      autoStatus: newStatus,
    });
  } catch (err: any) {
    console.error('Error updating period:', err);
    res.status(500).json({ error: 'Failed to update period' });
  }
});

// ─── DELETE /api/dd-item-periods/:id ─────────────────────────────────────────
router.delete('/api/dd-item-periods/:id', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;

    const [deleted] = await db
      .delete(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.id, id))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Period not found' });

    // Check if item still has periods
    const remaining = await db
      .select({ count: sql`count(*)` })
      .from(schema.ddChecklistItemPeriods)
      .where(eq(schema.ddChecklistItemPeriods.itemId, deleted.itemId));

    if (parseInt(remaining[0]?.count) === 0) {
      await db.update(schema.ddChecklistItems).set({
        hasPeriods: false,
        periodConfig: null,
        updatedAt: new Date(),
      }).where(eq(schema.ddChecklistItems.id, deleted.itemId));
    }

    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete period' });
  }
});

// ─── POST /api/dd-items/:id/periods/bulk-toggle ─────────────────────────────
// Mark all periods as received or unreceived
router.post('/api/dd-items/:id/periods/bulk-toggle', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id } = req.params;
    const userId = req.user?.id || req.userId;
    const { isReceived } = req.body;

    await db.update(schema.ddChecklistItemPeriods).set({
      isReceived: !!isReceived,
      receivedAt: isReceived ? new Date() : null,
      receivedBy: isReceived ? userId : null,
      updatedAt: new Date(),
    }).where(eq(schema.ddChecklistItemPeriods.itemId, id));

    // Update item status
    const newStatus = isReceived ? 'provided' : 'open';
    await db.update(schema.ddChecklistItems).set({
      status: newStatus,
      updatedAt: new Date(),
    }).where(eq(schema.ddChecklistItems.id, id));

    res.json({ updated: true, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to bulk toggle' });
  }
});

// ─── GET /api/workspaces/:id/dd-checklist/progress ──────────────────────────
// Returns hierarchical progress: overall → sections → items (with period breakdown)
router.get('/api/workspaces/:id/dd-checklist/progress', async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const { id: workspaceId } = req.params;

    // Get checklist
    const [checklist] = await db
      .select()
      .from(schema.ddChecklists)
      .where(eq(schema.ddChecklists.workspaceId, workspaceId))
      .limit(1);

    if (!checklist) return res.json({ overall: 0, sections: [] });

    // Get all sections with items and their periods
    const sections = await db
      .select()
      .from(schema.ddChecklistSections)
      .where(eq(schema.ddChecklistSections.checklistId, checklist.id))
      .orderBy(asc(schema.ddChecklistSections.sortOrder));

    const sectionProgress = [];

    for (const section of sections) {
      const items = await db
        .select()
        .from(schema.ddChecklistItems)
        .where(eq(schema.ddChecklistItems.sectionId, section.id))
        .orderBy(asc(schema.ddChecklistItems.sortOrder));

      const itemProgress = [];

      for (const item of items) {
        if (item.hasPeriods) {
          // Period-based progress
          const periods = await db
            .select()
            .from(schema.ddChecklistItemPeriods)
            .where(eq(schema.ddChecklistItemPeriods.itemId, item.id));

          const total = periods.length;
          const received = periods.filter((p: any) => p.isReceived).length;
          itemProgress.push({
            id: item.id,
            title: item.title,
            hasPeriods: true,
            pct: total > 0 ? (received / total) * 100 : 0,
            received,
            total,
          });
        } else {
          // Binary: approved/provided = 100%, everything else = 0%
          const done = ['approved', 'provided', 'waived'].includes(item.status);
          itemProgress.push({
            id: item.id,
            title: item.title,
            hasPeriods: false,
            pct: done ? 100 : 0,
          });
        }
      }

      const sectionPct = itemProgress.length > 0
        ? itemProgress.reduce((sum, ip) => sum + ip.pct, 0) / itemProgress.length
        : 0;

      sectionProgress.push({
        id: section.id,
        title: section.title,
        pct: Math.round(sectionPct),
        items: itemProgress,
      });
    }

    const overallPct = sectionProgress.length > 0
      ? Math.round(sectionProgress.reduce((sum, sp) => sum + sp.pct, 0) / sectionProgress.length)
      : 0;

    res.json({
      overall: overallPct,
      sections: sectionProgress,
    });
  } catch (err: any) {
    console.error('Error computing progress:', err);
    res.status(500).json({ error: 'Failed to compute progress' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DD Section Defaults
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/api/dd-section-defaults', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const schema = await getSchema();
    const defaults = await db
      .select()
      .from(schema.ddSectionDefaults)
      .orderBy(asc(schema.ddSectionDefaults.title));
    res.json(defaults);
  } catch (err: any) {
    console.error('Error fetching section defaults:', err);
    res.status(500).json({ error: 'Failed to fetch section defaults' });
  }
});

router.post('/api/dd-section-defaults', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const db = await getDb();
    const schema = await getSchema();
    const existing = await db
      .select()
      .from(schema.ddSectionDefaults)
      .where(eq(schema.ddSectionDefaults.title, title.trim()));
    if (existing.length > 0) {
      return res.json(existing[0]);
    }
    const [created] = await db
      .insert(schema.ddSectionDefaults)
      .values({ title: title.trim(), isBuiltin: false })
      .returning();
    res.json(created);
  } catch (err: any) {
    console.error('Error creating section default:', err);
    res.status(500).json({ error: 'Failed to create section default' });
  }
});
