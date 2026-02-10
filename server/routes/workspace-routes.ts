/**
 * Deal Workspace Routes v2
 * 
 * Uses existing tables: projects, tasks, vdrFolders, vdrDocuments, vdrAuditLogs
 * Creates real projects row for DD provisioning.
 * All IDs are varchar UUIDs matching existing schema.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  dealWorkspaces, projects, tasks, vdrFolders, vdrDocuments, vdrAuditLogs,
  workspaceMembers, confidentialityAgreements, agreementExecutions, ddMilestones,
  users, organizations, pendingContacts, projectPendingContacts,
  contacts, projectContacts, ddChecklists, ddChecklistSections, ddChecklistItems,
} from '@shared/schema';
import { eq, and, desc, asc, sql, ne, isNull } from 'drizzle-orm';
import { CHECKLIST_TEMPLATE_DEFAULT, type ChecklistTaskTemplate } from '../templates/dd-templates';
import { VDR_FOLDER_TEMPLATE_DEFAULT, type VdrFolderNode } from '../templates/vdr-folder-templates';
import { DEFAULT_CA_TITLE, DEFAULT_CA_VERSION, DEFAULT_CA_BODY_HTML } from '../templates/ca-template';

export const workspaceRouter = Router();

// ─── Auth helpers (string IDs) ───────────────────────────────────────────────

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

function requireAuth(req: Request, res: Response): { userId: string; orgId: string } | null {
  const userId = getUserId(req);
  const orgId = getOrgId(req);
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return null; }
  if (!orgId) { res.status(400).json({ error: 'Organization required' }); return null; }
  return { userId, orgId };
}

// ─── Load workspace + verify org ─────────────────────────────────────────────

async function loadWorkspace(req: Request, res: Response, orgId: string) {
  const id = req.params.id;
  if (!id) { res.status(400).json({ error: 'Invalid workspace ID' }); return null; }
  const [ws] = await db.select().from(dealWorkspaces)
    .where(and(eq(dealWorkspaces.id, id), eq(dealWorkspaces.orgId, orgId))).limit(1);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return null; }
  return ws;
}

// ─── CA gating ───────────────────────────────────────────────────────────────

async function checkCAExecuted(workspaceId: string, userId: string, res: Response): Promise<boolean> {
  const [ca] = await db.select().from(confidentialityAgreements)
    .where(and(
      eq(confidentialityAgreements.workspaceId, workspaceId),
      eq(confidentialityAgreements.isActive, true),
    )).limit(1);

  if (!ca) return true; // No CA = no gate

  const [execution] = await db.select().from(agreementExecutions)
    .where(and(
      eq(agreementExecutions.agreementId, ca.id),
      eq(agreementExecutions.userId, userId),
    )).limit(1);

  if (!execution) {
    res.status(403).json({ code: 'CA_REQUIRED', message: 'Confidentiality Agreement must be executed to access the Data Room.' });
    return false;
  }
  if (ca.accessPolicy === 'manual_approve' && execution.status === 'pending_review') {
    res.status(403).json({ code: 'CA_PENDING_APPROVAL', message: 'Your CA execution is pending approval.' });
    return false;
  }
  if (execution.status === 'rejected') {
    res.status(403).json({ code: 'CA_REJECTED', message: 'Your CA execution was rejected.' });
    return false;
  }
  return true;
}

// ─── Audit logger (uses existing vdrAuditLogs) ──────────────────────────────

async function logAudit(params: {
  documentId?: string; folderId?: string; userId?: string;
  eventType: string; orgId: string; ipAddress?: string; userAgent?: string;
  metadata?: any;
}) {
  try {
    await db.insert(vdrAuditLogs).values({
      documentId: params.documentId || null,
      folderId: params.folderId || null,
      userId: params.userId || null,
      eventType: params.eventType as any,
      orgId: params.orgId,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      metadata: params.metadata || {},
    });
  } catch (e) {
    // Non-blocking audit log
    console.error('Audit log error:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/workspaces
workspaceRouter.post('/api/workspaces', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const { userId, orgId } = auth;
  const { name, description, role, status, dealId, propertyId, targetPrice, expectedCloseDate, ddProjectId } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  try {
    const [ws] = await db.insert(dealWorkspaces).values({
      orgId,
      name: name.trim(),
      description: description || null,
      role: role || 'buyer',
      status: status || 'active',
      dealId: dealId || null,
      propertyId: propertyId || null,
      targetPrice: targetPrice || null,
      expectedCloseDate: expectedCloseDate || null,
      createdBy: userId,
      ddProjectId: ddProjectId || null,
    }).returning();

    // Auto-add creator as owner_admin member
    await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      orgId,
      userId,
      role: 'owner_admin',
      vdrPermission: 'full_access',
      ddPermission: 'admin',
      inviteStatus: 'accepted',
      acceptedAt: new Date(),
      invitedBy: userId,
    });

    res.status(201).json(ws);
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// GET /api/workspaces
workspaceRouter.get('/api/workspaces', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const { orgId } = auth;
  const { status, role } = req.query;

  try {
    const results = await db.select().from(dealWorkspaces)
      .where(and(
        eq(dealWorkspaces.orgId, orgId),
        isNull(dealWorkspaces.archivedAt),
      ))
      .orderBy(desc(dealWorkspaces.updatedAt));

    let filtered = results;
    if (status && status !== 'all') filtered = filtered.filter((w: any) => w.status === status);
    if (role && role !== 'all') filtered = filtered.filter((w: any) => w.role === role);

    // Enrich with live task/doc counts
    const enriched = await Promise.all(filtered.map(async (ws) => {
      let totalDdTasks = 0, openDdTasks = 0, pendingDocuments = 0;

      if (ws.ddProjectId) {
        const [taskCounts] = await db.select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')`,
        }).from(tasks).where(eq(tasks.projectId, ws.ddProjectId));

        totalDdTasks = Number(taskCounts?.total || 0);
        openDdTasks = totalDdTasks - Number(taskCounts?.completed || 0);

        const [docCount] = await db.select({ count: sql<number>`count(*)` })
          .from(vdrDocuments)
          .where(and(eq(vdrDocuments.projectId, ws.ddProjectId), isNull(vdrDocuments.deletedAt)));
        pendingDocuments = Number(docCount?.count || 0);
      }

      return { ...ws, totalDdTasks, openDdTasks, pendingDocuments };
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/workspaces/:id
workspaceRouter.get('/api/workspaces/:id', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  res.json(ws);
});

// GET /api/workspaces/:id/overview
workspaceRouter.get('/api/workspaces/:id/overview', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    let ddStats = { total: 0, completed: 0, pending: 0, overdue: 0 };
    let vdrStats = { folders: 0, documents: 0, pendingRequests: 0 };

    if (ws.ddProjectId) {
      const [tc] = await db.select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')`,
        pending: sql<number>`count(*) filter (where ${tasks.status} != 'completed')`,
        overdue: sql<number>`count(*) filter (where ${tasks.status} != 'completed' and ${tasks.deadline} is not null and ${tasks.deadline}::date < current_date)`,
      }).from(tasks).where(eq(tasks.projectId, ws.ddProjectId));

      ddStats = {
        total: Number(tc?.total || 0),
        completed: Number(tc?.completed || 0),
        pending: Number(tc?.pending || 0),
        overdue: Number(tc?.overdue || 0),
      };

      const [fc] = await db.select({ count: sql<number>`count(*)` })
        .from(vdrFolders).where(and(eq(vdrFolders.projectId, ws.ddProjectId), isNull(vdrFolders.deletedAt)));
      const [dc] = await db.select({ count: sql<number>`count(*)` })
        .from(vdrDocuments).where(and(eq(vdrDocuments.projectId, ws.ddProjectId), isNull(vdrDocuments.deletedAt)));

      vdrStats.folders = Number(fc?.count || 0);
      vdrStats.documents = Number(dc?.count || 0);
    }

    const [memberCount] = await db.select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), ne(workspaceMembers.inviteStatus, 'revoked')));

    const [nextMilestone] = await db.select().from(ddMilestones)
      .where(and(eq(ddMilestones.workspaceId, ws.id), ne(ddMilestones.status, 'completed')))
      .orderBy(asc(ddMilestones.dueDate)).limit(1);

    // Recent audit activity for this project
    let recentActivity: any[] = [];
    if (ws.ddProjectId) {
      recentActivity = await db.select().from(vdrAuditLogs)
        .where(eq(vdrAuditLogs.orgId, auth.orgId))
        .orderBy(desc(vdrAuditLogs.timestamp)).limit(10);
    }

    res.json({
      workspace: ws,
      stats: {
        dd: ddStats,
        vdr: vdrStats,
        modeling: { hasProject: !!ws.modelingProjectId },
        team: { members: Number(memberCount?.count || 0) },
      },
      nextMilestone: nextMilestone || null,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching workspace overview:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// POST /api/workspaces/:id/link
workspaceRouter.post('/api/workspaces/:id/link', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { dealId, propertyId, ddProjectId, modelingProjectId } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (dealId !== undefined) updates.dealId = dealId || null;
  if (propertyId !== undefined) updates.propertyId = propertyId || null;
  if (ddProjectId !== undefined) updates.ddProjectId = ddProjectId || null;
  if (modelingProjectId !== undefined) updates.modelingProjectId = modelingProjectId || null;

  try {
    const [updated] = await db.update(dealWorkspaces).set(updates)
      .where(eq(dealWorkspaces.id, ws.id)).returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to link entities' });
  }
});

// DELETE /api/workspaces/:id (archive)
workspaceRouter.delete('/api/workspaces/:id', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    await db.update(dealWorkspaces).set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(dealWorkspaces.id, ws.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to archive workspace' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DD PROJECT PROVISIONING
// Creates a real `projects` row + tasks + VDR folders + CA + milestones
// ═══════════════════════════════════════════════════════════════════════════════

workspaceRouter.post('/api/workspaces/:id/dd-project', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const { userId, orgId } = auth;
  const ws = await loadWorkspace(req, res, orgId);
  if (!ws) return;

  if (ws.ddProjectId) {
    return res.status(409).json({ error: 'Workspace already has a DD project linked' });
  }

  const { ddExpirationDate, closingDate, projectName } = req.body;
  const ddStart = new Date();
  const ddExpDate = ddExpirationDate || null;
  const closingDt = closingDate || null;

  try {
    // 1) Create real projects row
    const [project] = await db.insert(projects).values({
      orgId,
      name: projectName || ws.name || 'Due Diligence',
      description: `DD project for workspace: ${ws.name}`,
      status: 'active',
      projectType: 'single',
      anchorType: 'psa',
      psaSignedDate: ddStart.toISOString().split('T')[0],
      ddExpirationDate: ddExpDate || null,
      closingDate: closingDt || null,
      tz: 'America/New_York',
    } as any).returning();

    // 2) Link workspace to project + set dates
    await db.update(dealWorkspaces).set({
      ddProjectId: project.id,
      ddStartDate: ddStart,
      ddExpirationDate: ddExpDate ? new Date(ddExpDate) : null,
      closingDate: closingDt ? new Date(closingDt) : null,
      status: 'due_diligence',
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      lastActivityType: 'DD Provisioned',
      lastActivityDescription: 'Due diligence project created with checklist and data room.',
    } as any).where(eq(dealWorkspaces.id, ws.id));

    // 3) Create milestones
    const milestonesToInsert: any[] = [
      { workspaceId: ws.id, orgId, type: 'dd_start', title: 'DD Start', dueDate: ddStart, status: 'completed' },
    ];
    if (ddExpDate) {
      milestonesToInsert.push({ workspaceId: ws.id, orgId, type: 'dd_expiration', title: 'DD Expiration', dueDate: new Date(ddExpDate), status: 'upcoming' });
    }
    if (closingDt) {
      milestonesToInsert.push({ workspaceId: ws.id, orgId, type: 'closing', title: 'Closing Date', dueDate: new Date(closingDt), status: 'upcoming' });
    }
    const createdMilestones = await db.insert(ddMilestones).values(milestonesToInsert).returning();

    // 4) Get members for role-based assignment
    const members = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), ne(workspaceMembers.inviteStatus, 'revoked')));

    const findMemberByRole = (role: string) => {
      const m = members.find(m => m.role === role);
      return m?.userId || null;
    };

    // 5) Create tasks from template into existing tasks table
    function computeDeadline(anchor: string | undefined, offsetDays: number | undefined): string | null {
      if (offsetDays === undefined) return null;
      let baseDate: Date;
      switch (anchor) {
        case 'dd_expiration':
          if (!ddExpDate) return null;
          baseDate = new Date(ddExpDate);
          break;
        case 'closing':
          if (!closingDt) return null;
          baseDate = new Date(closingDt);
          break;
        default: // dd_start
          baseDate = new Date(ddStart);
          break;
      }
      baseDate.setDate(baseDate.getDate() + offsetDays);
      return baseDate.toISOString().split('T')[0]; // date string for tasks.deadline
    }

    const allTemplTasks: Array<ChecklistTaskTemplate & { category: string }> = [];
    for (const cat of CHECKLIST_TEMPLATE_DEFAULT.categories) {
      for (const task of cat.tasks) {
        allTemplTasks.push({ ...task, category: cat.title });
      }
    }

    // First pass: insert tasks (uses existing tasks table)
    const taskKeyToId: Record<string, string> = {};
    let sortOrder = 0;

    for (const tmpl of allTemplTasks) {
      sortOrder++;
      const deadline = computeDeadline(tmpl.milestoneAnchor, tmpl.defaultDueOffsetDays);
      const taskOwner = tmpl.defaultOwnerRole ? findMemberByRole(tmpl.defaultOwnerRole) : null;

      const [inserted] = await db.insert(tasks).values({
        projectId: project.id,
        title: tmpl.title,
        description: tmpl.description || null,
        status: 'not_started',
        priority: tmpl.required ? 'high' : 'med',
        deadline,
        deadlineType: 'days_after_psa',
        deadlineDays: tmpl.defaultDueOffsetDays ?? null,
        taskOwner,
        sortOrder,
        ddCategory: mapTemplCategoryToDdCategory(tmpl.category),
        category: mapTemplCategoryToDdCategory(tmpl.category),
        isGating: tmpl.required ?? false,
        isMilestone: false,
        dependencies: tmpl.dependencies || [],
      } as any).returning();

      taskKeyToId[tmpl.key] = inserted.id;
    }

    // Second pass: wire dependencies (existing tasks uses dependencies varchar[])
    // Dependencies are already set as key arrays. Replace keys with IDs.
    for (const tmpl of allTemplTasks) {
      if (tmpl.dependencies && tmpl.dependencies.length > 0) {
        const depIds = tmpl.dependencies.map(k => taskKeyToId[k]).filter(Boolean);
        if (depIds.length > 0) {
          await db.update(tasks).set({ dependencies: depIds } as any)
            .where(eq(tasks.id, taskKeyToId[tmpl.key]));
        }
      }
    }

    // 6) Create VDR folder tree (uses existing vdrFolders table)
    let foldersCreated = 0;

    async function insertFoldersRecursive(nodes: VdrFolderNode[], parentId: string | null, basePath: string, order: number) {
      let idx = order;
      for (const node of nodes) {
        idx++;
        const path = basePath ? `${basePath}/${node.name}` : node.name;
        const [folder] = await db.insert(vdrFolders).values({
          projectId: project.id,
          parentFolderId: parentId,
          name: node.name,
          path,
          displayOrder: idx,
          orgId,
          createdBy: userId,
      ddProjectId: ddProjectId || null,
          // New columns added by migration:
          workspaceId: ws.id,
          templateKey: node.key,
          securityLevel: (node.securityLevel || 'confidential') as any,
        } as any).returning();
        foldersCreated++;
        if (node.children?.length) {
          idx = await insertFoldersRecursive(node.children, folder.id, path, idx);
        }
      }
      return idx;
    }

    // Root folder
    const rootPath = projectName || ws.name || 'Data Room';
    const [rootFolder] = await db.insert(vdrFolders).values({
      projectId: project.id,
      parentFolderId: null,
      name: rootPath,
      path: rootPath,
      displayOrder: 0,
      orgId,
      createdBy: userId,
      ddProjectId: ddProjectId || null,
      workspaceId: ws.id,
      templateKey: 'root',
      securityLevel: 'confidential' as any,
    } as any).returning();
    foldersCreated++;

    await insertFoldersRecursive(VDR_FOLDER_TEMPLATE_DEFAULT.folders, rootFolder.id, rootPath, 0);

    // 7) Create default CA
    const [ca] = await db.insert(confidentialityAgreements).values({
      workspaceId: ws.id,
      orgId,
      title: DEFAULT_CA_TITLE,
      version: DEFAULT_CA_VERSION,
      bodyHtml: DEFAULT_CA_BODY_HTML,
      accessPolicy: 'auto_approve',
      isActive: true,
      createdBy: userId,
      ddProjectId: ddProjectId || null,
    }).returning();

    // 8) Auto-execute CA for creator
    await db.insert(agreementExecutions).values({
      workspaceId: ws.id,
      agreementId: ca.id,
      userId,
      status: 'executed',
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json({
      success: true,
      workspaceId: ws.id,
      projectId: project.id,
      tasksCreated: Object.keys(taskKeyToId).length,
      foldersCreated,
      milestonesCreated: createdMilestones.length,
      caCreated: true,
    });
  } catch (error) {
    console.error('Error provisioning DD project:', error);
    res.status(500).json({ error: 'Failed to provision DD project' });
  }
});

// Helper: map template category names to existing ddCategory enum values
function mapTemplCategoryToDdCategory(category: string): string | null {
  // Maps template categories to existing ddCategoryEnum values:
  // "title","survey","ESA","appraisal","inspection","permits","zoning","financial","legal","insurance","other"
  const map: Record<string, string> = {
    'Executive / Deal Setup': 'other',
    'Legal': 'legal',
    'Financial': 'financial',
    'Physical / Site': 'inspection',
    'Environmental': 'ESA',
    'Insurance': 'insurance',
    'Lender / Financing': 'appraisal',
    'Closing': 'title',
  };
  return map[category] || 'other';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM / MEMBERS
// ═══════════════════════════════════════════════════════════════════════════════

workspaceRouter.get('/api/workspaces/:id/members', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const members = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), ne(workspaceMembers.inviteStatus, 'revoked')))
      .orderBy(asc(workspaceMembers.createdAt));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

workspaceRouter.post('/api/workspaces/:id/deal-team/quick-add', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const { fullName, role } = req.body;
    if (!fullName?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const assignRole = role || 'other';

    const [newPending] = await db.insert(pendingContacts).values({
      orgId: auth.orgId,
      fullName: fullName.trim(),
      sourceType: 'dd_project',
      sourceId: ws.ddProjectId || ws.id,
      status: 'pending',
      createdBy: auth.userId,
    }).returning();

    if (ws.ddProjectId) {
      await db.insert(projectPendingContacts).values({
        projectId: ws.ddProjectId,
        pendingContactId: newPending.id,
        role: assignRole,
        isPrimary: false,
        createdBy: auth.userId,
      }).onConflictDoNothing();
    }

    const [asMember] = await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      email: null,
      displayName: fullName.trim(),
      role: assignRole,
      inviteStatus: 'pending',
      permissions: { canViewChecklist: true, canUploadFiles: false, canComment: false },
      createdAt: new Date(),
    }).returning();

    res.status(201).json({ pendingContact: newPending, member: asMember });
  } catch (error) {
    console.error('Error quick-adding deal team member:', error);
    res.status(500).json({ error: 'Failed to add deal team member' });
  }
});

workspaceRouter.get('/api/workspaces/:id/deal-team-contacts', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const result: Array<{
      id: string;
      type: 'contact' | 'pending' | 'member';
      displayName: string;
      email: string | null;
      phone: string | null;
      role: string;
      isPrimary: boolean;
      status: string;
    }> = [];

    const seenIds = new Set<string>();

    if (ws.ddProjectId) {
      const projContacts = await db.select()
        .from(projectContacts)
        .leftJoin(contacts, eq(projectContacts.contactId, contacts.id))
        .where(eq(projectContacts.projectId, ws.ddProjectId))
        .orderBy(projectContacts.role);

      for (const row of projContacts) {
        const c = row.contacts;
        if (!c) continue;
        const cId = `contact_${row.project_contacts.contactId}_${row.project_contacts.role}`;
        seenIds.add(cId);
        result.push({
          id: cId,
          type: 'contact',
          displayName: c.name,
          email: c.email || null,
          phone: c.phone || null,
          role: row.project_contacts.role || 'other',
          isPrimary: row.project_contacts.isPrimary || false,
          status: 'confirmed',
        });
      }

      const projPending = await db.select()
        .from(projectPendingContacts)
        .leftJoin(pendingContacts, eq(projectPendingContacts.pendingContactId, pendingContacts.id))
        .where(eq(projectPendingContacts.projectId, ws.ddProjectId))
        .orderBy(projectPendingContacts.role);

      for (const row of projPending) {
        const pc = row.pending_contacts;
        if (!pc) continue;
        const pId = `pending_${pc.id}_${row.project_pending_contacts!.role}`;
        seenIds.add(pId);
        result.push({
          id: pId,
          type: 'pending',
          displayName: pc.fullName || [pc.firstName, pc.lastName].filter(Boolean).join(' ') || 'Unknown',
          email: pc.email || null,
          phone: pc.phone || null,
          role: row.project_pending_contacts!.role || 'other',
          isPrimary: row.project_pending_contacts!.isPrimary || false,
          status: pc.status || 'pending',
        });
      }
    }

    const wsMembers = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), ne(workspaceMembers.inviteStatus, 'revoked')))
      .orderBy(asc(workspaceMembers.createdAt));

    for (const m of wsMembers) {
      if (seenIds.has(m.id)) continue;
      result.push({
        id: m.id,
        type: 'member',
        displayName: m.displayName || m.email || 'Unknown',
        email: m.email || null,
        phone: null,
        role: m.role || 'other',
        isPrimary: false,
        status: m.inviteStatus === 'pending' ? 'pending' : 'confirmed',
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching deal team contacts:', error);
    res.status(500).json({ error: 'Failed to fetch deal team contacts' });
  }
});

workspaceRouter.get('/api/workspaces/:id/deal-team-stats', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const [checklist] = await db.select().from(ddChecklists)
      .where(eq(ddChecklists.workspaceId, ws.id)).limit(1);
    if (!checklist) return res.json([]);

    const sections = await db.select({ id: ddChecklistSections.id })
      .from(ddChecklistSections)
      .where(eq(ddChecklistSections.checklistId, checklist.id));
    if (sections.length === 0) return res.json([]);

    const sectionIds = sections.map(s => s.id);
    const allItems = await db.select({
      id: ddChecklistItems.id,
      status: ddChecklistItems.status,
      assignedTo: ddChecklistItems.assignedToMemberId,
      reviewer: ddChecklistItems.reviewerMemberId,
      requestedFrom: ddChecklistItems.requestedFromMemberId,
      dueDate: ddChecklistItems.dueDate,
    }).from(ddChecklistItems)
      .where(sql`${ddChecklistItems.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);

    const memberMap = new Map<string, {
      id: string;
      assignedCount: number;
      assignedCompleted: number;
      reviewerCount: number;
      reviewerCompleted: number;
      requestedFromCount: number;
      requestedFromCompleted: number;
      overdueCount: number;
    }>();

    const today = new Date().toISOString().slice(0, 10);
    const completedStatuses = new Set(['approved', 'provided', 'waived']);

    for (const item of allItems) {
      const addTo = (memberId: string, role: 'assigned' | 'reviewer' | 'requestedFrom') => {
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            id: memberId,
            assignedCount: 0, assignedCompleted: 0,
            reviewerCount: 0, reviewerCompleted: 0,
            requestedFromCount: 0, requestedFromCompleted: 0,
            overdueCount: 0,
          });
        }
        const entry = memberMap.get(memberId)!;
        const done = completedStatuses.has(item.status);
        if (role === 'assigned') {
          entry.assignedCount++;
          if (done) entry.assignedCompleted++;
          if (!done && item.dueDate && item.dueDate < today) entry.overdueCount++;
        } else if (role === 'reviewer') {
          entry.reviewerCount++;
          if (done) entry.reviewerCompleted++;
        } else {
          entry.requestedFromCount++;
          if (done) entry.requestedFromCompleted++;
        }
      };

      if (item.assignedTo) addTo(item.assignedTo, 'assigned');
      if (item.reviewer) addTo(item.reviewer, 'reviewer');
      if (item.requestedFrom) addTo(item.requestedFrom, 'requestedFrom');
    }

    res.json(Array.from(memberMap.values()));
  } catch (error) {
    console.error('Error fetching deal team stats:', error);
    res.status(500).json({ error: 'Failed to fetch deal team stats' });
  }
});

workspaceRouter.get('/api/workspaces/:id/task-breakdown', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const [checklist] = await db.select().from(ddChecklists)
      .where(eq(ddChecklists.workspaceId, ws.id)).limit(1);
    if (!checklist) return res.json({ byUser: [], unassigned: [] });

    const secs = await db.select({ id: ddChecklistSections.id, title: ddChecklistSections.title })
      .from(ddChecklistSections)
      .where(eq(ddChecklistSections.checklistId, checklist.id));
    if (secs.length === 0) return res.json({ byUser: [], unassigned: [] });

    const secMap = new Map(secs.map(s => [s.id, s.title]));
    const sectionIds = secs.map(s => s.id);
    const allItems = await db.select().from(ddChecklistItems)
      .where(sql`${ddChecklistItems.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);

    const today = new Date().toISOString().slice(0, 10);
    const completedStatuses = new Set(['approved', 'provided', 'waived']);
    const userMap = new Map<string, {
      memberId: string;
      tasks: Array<{ id: string; title: string; status: string; priority: number; dueDate: string | null; section: string; isOverdue: boolean }>;
      totalCount: number;
      completedCount: number;
      overdueCount: number;
    }>();
    const unassigned: Array<{ id: string; title: string; status: string; priority: number; dueDate: string | null; section: string }> = [];

    for (const item of allItems) {
      const taskInfo = {
        id: item.id,
        title: item.title,
        status: item.status,
        priority: item.priority,
        dueDate: item.dueDate,
        section: secMap.get(item.sectionId) || 'Unknown',
      };
      const done = completedStatuses.has(item.status);
      const isOverdue = !done && !!item.dueDate && item.dueDate < today;

      if (!item.assignedToMemberId) {
        unassigned.push(taskInfo);
        continue;
      }

      const mid = item.assignedToMemberId;
      if (!userMap.has(mid)) {
        userMap.set(mid, { memberId: mid, tasks: [], totalCount: 0, completedCount: 0, overdueCount: 0 });
      }
      const entry = userMap.get(mid)!;
      entry.tasks.push({ ...taskInfo, isOverdue });
      entry.totalCount++;
      if (done) entry.completedCount++;
      if (isOverdue) entry.overdueCount++;
    }

    res.json({
      byUser: Array.from(userMap.values()).sort((a, b) => b.totalCount - a.totalCount),
      unassigned,
    });
  } catch (error) {
    console.error('Error fetching task breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch task breakdown' });
  }
});

workspaceRouter.get('/api/org/lifetime-task-stats', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  try {
    const checklists = await db.select({ id: ddChecklists.id, workspaceId: ddChecklists.workspaceId })
      .from(ddChecklists)
      .where(eq(ddChecklists.orgId, auth.orgId));

    if (checklists.length === 0) return res.json({ byUser: [], projectCount: 0 });

    const checklistIds = checklists.map(c => c.id);
    const allSections = await db.select({ id: ddChecklistSections.id, checklistId: ddChecklistSections.checklistId })
      .from(ddChecklistSections)
      .where(sql`${ddChecklistSections.checklistId} IN (${sql.join(checklistIds.map(id => sql`${id}`), sql`, `)})`);

    if (allSections.length === 0) return res.json({ byUser: [], projectCount: checklists.length });

    const sectionIds = allSections.map(s => s.id);
    const sectionToChecklist = new Map(allSections.map(s => [s.id, s.checklistId]));

    const allItems = await db.select({
      id: ddChecklistItems.id,
      sectionId: ddChecklistItems.sectionId,
      status: ddChecklistItems.status,
      assignedTo: ddChecklistItems.assignedToMemberId,
      dueDate: ddChecklistItems.dueDate,
    }).from(ddChecklistItems)
      .where(sql`${ddChecklistItems.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);

    const today = new Date().toISOString().slice(0, 10);
    const completedStatuses = new Set(['approved', 'provided', 'waived']);

    const workspaces = await db.select({ id: dealWorkspaces.id, name: dealWorkspaces.name })
      .from(dealWorkspaces)
      .where(eq(dealWorkspaces.orgId, auth.orgId));
    const wsNameMap = new Map(workspaces.map(w => [w.id, w.name]));
    const checklistToWs = new Map(checklists.map(c => [c.id, c.workspaceId]));

    const userMap = new Map<string, {
      memberId: string;
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
      projectsInvolved: Set<string>;
      projectBreakdown: Map<string, { name: string; total: number; completed: number; overdue: number }>;
    }>();

    for (const item of allItems) {
      if (!item.assignedTo) continue;
      const mid = item.assignedTo;
      if (!userMap.has(mid)) {
        userMap.set(mid, { memberId: mid, totalTasks: 0, completedTasks: 0, overdueTasks: 0, projectsInvolved: new Set(), projectBreakdown: new Map() });
      }
      const entry = userMap.get(mid)!;
      const done = completedStatuses.has(item.status);
      entry.totalTasks++;
      if (done) entry.completedTasks++;
      if (!done && item.dueDate && item.dueDate < today) entry.overdueTasks++;

      const clId = sectionToChecklist.get(item.sectionId) || '';
      const wsId = checklistToWs.get(clId) || '';
      entry.projectsInvolved.add(wsId);

      if (!entry.projectBreakdown.has(wsId)) {
        entry.projectBreakdown.set(wsId, { name: wsNameMap.get(wsId) || 'Unknown', total: 0, completed: 0, overdue: 0 });
      }
      const pb = entry.projectBreakdown.get(wsId)!;
      pb.total++;
      if (done) pb.completed++;
      if (!done && item.dueDate && item.dueDate < today) pb.overdue++;
    }

    const allContactsRaw = await db.select().from(contacts)
      .where(eq(contacts.orgId, auth.orgId));
    const allPendingRaw = await db.select().from(pendingContacts)
      .where(eq(pendingContacts.orgId, auth.orgId));
    const allMembersRaw = await db.select().from(workspaceMembers)
      .where(eq(workspaceMembers.orgId, auth.orgId));

    const nameMap = new Map<string, string>();
    for (const c of allContactsRaw) {
      nameMap.set(c.id, c.name || 'Contact');
    }
    for (const p of allPendingRaw) {
      nameMap.set(p.id, p.fullName || 'Pending');
    }
    for (const m of allMembersRaw) {
      nameMap.set(m.id, m.displayName || 'Member');
    }

    const resolveName = (memberId: string): string => {
      const contactMatch = memberId.match(/^contact_([^_]+)_/);
      if (contactMatch) return nameMap.get(contactMatch[1]) || 'Unknown';
      const pendingMatch = memberId.match(/^pending_([^_]+)_/);
      if (pendingMatch) return nameMap.get(pendingMatch[1]) || 'Unknown';
      return nameMap.get(memberId) || 'Unknown';
    };

    const result = Array.from(userMap.values()).map(u => ({
      memberId: u.memberId,
      displayName: resolveName(u.memberId),
      totalTasks: u.totalTasks,
      completedTasks: u.completedTasks,
      overdueTasks: u.overdueTasks,
      completionRate: u.totalTasks > 0 ? Math.round((u.completedTasks / u.totalTasks) * 100) : 0,
      projectCount: u.projectsInvolved.size,
      projectBreakdown: Array.from(u.projectBreakdown.entries()).map(([wsId, pb]) => ({
        workspaceId: wsId,
        name: pb.name,
        total: pb.total,
        completed: pb.completed,
        overdue: pb.overdue,
      })),
    })).sort((a, b) => b.totalTasks - a.totalTasks);

    res.json({ byUser: result, projectCount: checklists.length });
  } catch (error) {
    console.error('Error fetching lifetime task stats:', error);
    res.status(500).json({ error: 'Failed to fetch lifetime task stats' });
  }
});

workspaceRouter.post('/api/workspaces/:id/members/invite', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { userId: inviteUserId, email, displayName, role, vdrPermission, ddPermission } = req.body;
  if (!inviteUserId && !email) return res.status(400).json({ error: 'userId or email required' });

  try {
    const [member] = await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      orgId: auth.orgId,
      userId: inviteUserId || null,
      email: email || null,
      displayName: displayName || email || null,
      role: role || 'viewer',
      vdrPermission: vdrPermission || 'view_only',
      ddPermission: ddPermission || 'view',
      inviteStatus: inviteUserId ? 'accepted' : 'pending',
      acceptedAt: inviteUserId ? new Date() : null,
      invitedBy: auth.userId,
    }).returning();

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

workspaceRouter.patch('/api/workspaces/:id/members/:memberId/permissions', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { memberId } = req.params;
  const { role, vdrPermission, ddPermission } = req.body;
  const updates: any = {};
  if (role) updates.role = role;
  if (vdrPermission) updates.vdrPermission = vdrPermission;
  if (ddPermission) updates.ddPermission = ddPermission;

  try {
    const [updated] = await db.update(workspaceMembers).set(updates)
      .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, ws.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

workspaceRouter.post('/api/workspaces/:id/members/:memberId/revoke', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const [updated] = await db.update(workspaceMembers)
      .set({ inviteStatus: 'revoked', revokedAt: new Date() })
      .where(and(eq(workspaceMembers.id, req.params.memberId), eq(workspaceMembers.workspaceId, ws.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke member' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AGREEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

workspaceRouter.get('/api/workspaces/:id/agreements/current', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const [ca] = await db.select().from(confidentialityAgreements)
      .where(and(eq(confidentialityAgreements.workspaceId, ws.id), eq(confidentialityAgreements.isActive, true)))
      .limit(1);

    if (!ca) return res.json({ agreement: null, executed: false });

    const [execution] = await db.select().from(agreementExecutions)
      .where(and(eq(agreementExecutions.agreementId, ca.id), eq(agreementExecutions.userId, auth.userId)))
      .limit(1);

    res.json({
      agreement: ca,
      executed: !!execution && execution.status === 'executed',
      executionStatus: execution?.status || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agreement' });
  }
});

workspaceRouter.post('/api/workspaces/:id/agreements/execute', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const [ca] = await db.select().from(confidentialityAgreements)
      .where(and(eq(confidentialityAgreements.workspaceId, ws.id), eq(confidentialityAgreements.isActive, true)))
      .limit(1);
    if (!ca) return res.status(404).json({ error: 'No active agreement found' });

    const [existing] = await db.select().from(agreementExecutions)
      .where(and(eq(agreementExecutions.agreementId, ca.id), eq(agreementExecutions.userId, auth.userId)))
      .limit(1);
    if (existing) return res.json({ execution: existing, alreadyExecuted: true });

    const execStatus = ca.accessPolicy === 'auto_approve' ? 'executed' : 'pending_review';

    const [execution] = await db.insert(agreementExecutions).values({
      workspaceId: ws.id,
      agreementId: ca.id,
      userId: auth.userId,
      status: execStatus as any,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
      notes: req.body.notes || null,
    }).returning();

    res.status(201).json({ execution, alreadyExecuted: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute agreement' });
  }
});

workspaceRouter.post('/api/workspaces/:id/agreements/:executionId/approve', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { approved } = req.body;
  try {
    const [updated] = await db.update(agreementExecutions)
      .set({ status: approved ? 'executed' : 'rejected', reviewedBy: auth.userId, reviewedAt: new Date() })
      .where(and(eq(agreementExecutions.id, req.params.executionId), eq(agreementExecutions.workspaceId, ws.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Execution not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VDR (CA-GATED, uses existing vdrFolders + vdrDocuments)
// ═══════════════════════════════════════════════════════════════════════════════

workspaceRouter.get('/api/workspaces/:id/vdr/tree', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  if (!await checkCAExecuted(ws.id, auth.userId, res)) return;

  if (!ws.ddProjectId) return res.json({ folders: [], totalFolders: 0, totalDocuments: 0 });

  try {
    const folders = await db.select().from(vdrFolders)
      .where(and(eq(vdrFolders.projectId, ws.ddProjectId), isNull(vdrFolders.deletedAt)))
      .orderBy(asc(vdrFolders.displayOrder));

    const docs = await db.select().from(vdrDocuments)
      .where(and(eq(vdrDocuments.projectId, ws.ddProjectId), isNull(vdrDocuments.deletedAt)))
      .orderBy(asc(vdrDocuments.filename));

    // Build tree
    const folderMap = new Map<string, any>();
    const roots: any[] = [];

    for (const f of folders) {
      folderMap.set(f.id, { ...f, children: [], documents: [] });
    }
    for (const doc of docs) {
      const parent = folderMap.get(doc.folderId);
      if (parent) parent.documents.push(doc);
    }
    for (const f of folders) {
      const node = folderMap.get(f.id)!;
      if (f.parentFolderId && folderMap.has(f.parentFolderId)) {
        folderMap.get(f.parentFolderId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json({ folders: roots, totalFolders: folders.length, totalDocuments: docs.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch VDR tree' });
  }
});

workspaceRouter.post('/api/workspaces/:id/vdr/folders', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  if (!await checkCAExecuted(ws.id, auth.userId, res)) return;
  if (!ws.ddProjectId) return res.status(400).json({ error: 'No DD project' });

  const { name, parentFolderId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Folder name required' });

  try {
    const parentPath = parentFolderId
      ? (await db.select({ path: vdrFolders.path }).from(vdrFolders).where(eq(vdrFolders.id, parentFolderId)).limit(1))[0]?.path || ''
      : '';

    const [folder] = await db.insert(vdrFolders).values({
      projectId: ws.ddProjectId,
      parentFolderId: parentFolderId || null,
      name: name.trim(),
      path: parentPath ? `${parentPath}/${name.trim()}` : name.trim(),
      displayOrder: 0,
      orgId: auth.orgId,
      createdBy: auth.userId,
      workspaceId: ws.id,
    } as any).returning();

    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

workspaceRouter.post('/api/workspaces/:id/vdr/upload', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  if (!await checkCAExecuted(ws.id, auth.userId, res)) return;
  if (!ws.ddProjectId) return res.status(400).json({ error: 'No DD project' });

  const { folderId, filename, mimeType, size, storagePath, checksum } = req.body;
  if (!folderId || !filename) return res.status(400).json({ error: 'folderId and filename required' });

  try {
    const [doc] = await db.insert(vdrDocuments).values({
      folderId,
      projectId: ws.ddProjectId,
      filename,
      originalFilename: filename,
      mimeType: mimeType || 'application/octet-stream',
      size: size || 0,
      checksum: checksum || 'pending',
      storagePath: storagePath || '',
      orgId: auth.orgId,
      uploadedBy: auth.userId,
      workspaceId: ws.id,
    } as any).returning();

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload document record' });
  }
});

workspaceRouter.get('/api/workspaces/:id/vdr/toc', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  if (!await checkCAExecuted(ws.id, auth.userId, res)) return;
  if (!ws.ddProjectId) return res.status(400).json({ error: 'No DD project' });

  try {
    const folders = await db.select().from(vdrFolders)
      .where(and(eq(vdrFolders.projectId, ws.ddProjectId), isNull(vdrFolders.deletedAt)))
      .orderBy(asc(vdrFolders.displayOrder));

    const docs = await db.select().from(vdrDocuments)
      .where(and(eq(vdrDocuments.projectId, ws.ddProjectId), isNull(vdrDocuments.deletedAt)))
      .orderBy(asc(vdrDocuments.filename));

    let csv = 'Folder Path,Document Name,Type,Size (bytes),Uploaded At\n';
    const pathMap = new Map<string, string>();
    for (const f of folders) pathMap.set(f.id, f.path || f.name);

    for (const doc of docs) {
      const path = pathMap.get(doc.folderId) || 'Unknown';
      csv += `"${path}","${doc.filename}","${doc.mimeType}",${doc.size},"${doc.createdAt?.toISOString() || ''}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vdr-toc-${ws.id}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate ToC' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS (uses existing tasks table via projectId)
// ═══════════════════════════════════════════════════════════════════════════════

workspaceRouter.get('/api/workspaces/:id/tasks', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  if (!ws.ddProjectId) return res.json([]);

  try {
    const taskList = await db.select().from(tasks)
      .where(eq(tasks.projectId, ws.ddProjectId))
      .orderBy(asc(tasks.sortOrder));
    res.json(taskList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

workspaceRouter.patch('/api/workspaces/:id/tasks/:taskId', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { taskId } = req.params;
  const { status, assignee, taskOwner } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (status) {
    updates.status = status;
    if (status === 'completed') updates.completedAt = new Date();
  }
  if (assignee !== undefined) updates.assignee = assignee;
  if (taskOwner !== undefined) updates.taskOwner = taskOwner;

  try {
    const [updated] = await db.update(tasks).set(updates)
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, ws.ddProjectId!)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONES / CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

workspaceRouter.get('/api/workspaces/:id/milestones', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const milestones = await db.select().from(ddMilestones)
      .where(eq(ddMilestones.workspaceId, ws.id))
      .orderBy(asc(ddMilestones.dueDate));
    res.json(milestones);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

workspaceRouter.post('/api/workspaces/:id/milestones', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { type, title, dueDate, notes } = req.body;
  if (!title || !dueDate) return res.status(400).json({ error: 'title and dueDate required' });

  try {
    const [milestone] = await db.insert(ddMilestones).values({
      workspaceId: ws.id, orgId: auth.orgId,
      type: type || 'custom', title, dueDate: new Date(dueDate), notes: notes || null,
    }).returning();
    res.status(201).json(milestone);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

workspaceRouter.post('/api/workspaces/:id/calendar/ics', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const milestones = await db.select().from(ddMilestones)
      .where(eq(ddMilestones.workspaceId, ws.id))
      .orderBy(asc(ddMilestones.dueDate));

    const fmtDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const now = fmtDate(new Date());

    let ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MarinaMatch//Deal Workspace//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${ws.name} - Milestones`,
    ];

    for (const m of milestones) {
      const dt = fmtDate(new Date(m.dueDate));
      const end = fmtDate(new Date(new Date(m.dueDate).getTime() + 3600000));
      ics.push(
        'BEGIN:VEVENT', `DTSTART:${dt}`, `DTEND:${end}`, `DTSTAMP:${now}`,
        `UID:ws-${ws.id}-ms-${m.id}@marinamatch`, `SUMMARY:${m.title}`,
        `DESCRIPTION:${m.notes || m.type}`,
        `STATUS:${m.status === 'completed' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT',
      );
    }
    ics.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="workspace-${ws.id}-milestones.ics"`);
    res.send(ics.join('\r\n'));
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate ICS' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════════

workspaceRouter.get('/api/workspaces/:id/activity', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const limit = Math.min(Number(req.query.limit) || 50, 200);

  try {
    // Use existing vdrAuditLogs scoped to org
    const activity = await db.select().from(vdrAuditLogs)
      .where(eq(vdrAuditLogs.orgId, auth.orgId))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(limit);
    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});
