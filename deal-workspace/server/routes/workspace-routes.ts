/**
 * Deal Workspace Routes - Express Router
 * 
 * Full implementation: workspace CRUD, DD provisioning with template-based tasks + VDR + CA,
 * team management, agreement execution/gating, VDR operations, milestones, ICS export.
 * 
 * All routes enforce orgId scoping. VDR routes enforce CA gating.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  dealWorkspaces, workspaceMembers, confidentialityAgreements, agreementExecutions,
  ddMilestones, vdrFolders, vdrDocuments, vdrActivityLog, workspaceTasks,
} from '../schema/deal-workspace-schema';
import { eq, and, desc, asc, sql, isNull, ne } from 'drizzle-orm';
import { CHECKLIST_TEMPLATE_DEFAULT, type ChecklistTaskTemplate } from '../templates/dd-templates';
import { VDR_FOLDER_TEMPLATE_DEFAULT, type VdrFolderNode } from '../templates/vdr-folder-templates';
import { DEFAULT_CA_TITLE, DEFAULT_CA_VERSION, DEFAULT_CA_BODY_HTML } from '../templates/ca-template';

export const workspaceRouter = Router();

// ─── Auth helpers ────────────────────────────────────────────────────────────

function getUserId(req: Request): number | null {
  const user = (req as any).user;
  const raw = user?.id || user?.claims?.sub || null;
  return raw ? Number(raw) : null;
}

function getOrgId(req: Request): number | null {
  const raw = (req as any).orgId || (req as any).user?.orgId || null;
  return raw ? Number(raw) : null;
}

function requireAuth(req: Request, res: Response): { userId: number; orgId: number } | null {
  const userId = getUserId(req);
  const orgId = getOrgId(req);
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return null; }
  if (!orgId) { res.status(400).json({ error: 'Organization required' }); return null; }
  return { userId, orgId };
}

// ─── Middleware: load workspace + verify org ─────────────────────────────────

async function loadWorkspace(req: Request, res: Response, orgId: number) {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid workspace ID' }); return null; }
  const [ws] = await db.select().from(dealWorkspaces)
    .where(and(eq(dealWorkspaces.id, id), eq(dealWorkspaces.orgId, orgId))).limit(1);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return null; }
  return ws;
}

// ─── CA gating check ─────────────────────────────────────────────────────────

async function checkCAExecuted(workspaceId: number, userId: number, res: Response): Promise<boolean> {
  // Check if there's an active CA for this workspace
  const [ca] = await db.select().from(confidentialityAgreements)
    .where(and(
      eq(confidentialityAgreements.workspaceId, workspaceId),
      eq(confidentialityAgreements.isActive, true),
    )).limit(1);

  if (!ca) return true; // No CA required

  // Check if user has executed it
  const [execution] = await db.select().from(agreementExecutions)
    .where(and(
      eq(agreementExecutions.agreementId, ca.id),
      eq(agreementExecutions.userId, userId),
    )).limit(1);

  if (!execution) {
    res.status(403).json({
      code: 'CA_REQUIRED',
      message: 'Confidentiality Agreement must be executed to access the Data Room.',
    });
    return false;
  }

  // For manual_approve, check if approved
  if (ca.accessPolicy === 'manual_approve' && execution.status === 'pending_review') {
    res.status(403).json({
      code: 'CA_PENDING_APPROVAL',
      message: 'Your Confidentiality Agreement execution is pending approval.',
    });
    return false;
  }

  if (execution.status === 'rejected') {
    res.status(403).json({
      code: 'CA_REJECTED',
      message: 'Your Confidentiality Agreement execution was rejected.',
    });
    return false;
  }

  return true;
}

// ─── Activity logger ─────────────────────────────────────────────────────────

async function logActivity(params: {
  workspaceId: number; orgId: number; userId?: number; memberId?: number;
  action: any; documentId?: number; folderId?: number; meta?: any; ip?: string;
}) {
  await db.insert(vdrActivityLog).values({
    workspaceId: params.workspaceId,
    orgId: params.orgId,
    userId: params.userId || null,
    memberId: params.memberId || null,
    action: params.action,
    documentId: params.documentId || null,
    folderId: params.folderId || null,
    meta: params.meta || null,
    ipAddress: params.ip || null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/workspaces
workspaceRouter.post('/api/workspaces', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const { userId, orgId } = auth;
  const { name, description, role, status, dealId, propertyId, targetPrice, expectedCloseDate } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  try {
    const [ws] = await db.insert(dealWorkspaces).values({
      orgId,
      name: name.trim(),
      description: description || null,
      role: role || 'buyer',
      status: status || 'active',
      dealId: dealId ? Number(dealId) : null,
      propertyId: propertyId ? Number(propertyId) : null,
      targetPrice: targetPrice || null,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      createdBy: userId,
    }).returning();

    // Auto-add creator as owner_admin member
    await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      orgId,
      userId,
      role: 'owner_admin',
      vdrPermission: 'admin',
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
    let query = db.select().from(dealWorkspaces)
      .where(and(
        eq(dealWorkspaces.orgId, orgId),
        ne(dealWorkspaces.status, 'archived'),
      ))
      .orderBy(desc(dealWorkspaces.updatedAt));

    const results = await query;

    // Apply filters in JS for simplicity (could be SQL too)
    let filtered = results;
    if (status && status !== 'all') filtered = filtered.filter(w => w.status === status);
    if (role && role !== 'all') filtered = filtered.filter(w => w.role === role);

    // Enrich with counts
    const enriched = await Promise.all(filtered.map(async (ws) => {
      const [taskCounts] = await db.select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${workspaceTasks.status} = 'completed')`,
        pending: sql<number>`count(*) filter (where ${workspaceTasks.status} != 'completed' and ${workspaceTasks.status} != 'skipped')`,
      }).from(workspaceTasks).where(eq(workspaceTasks.workspaceId, ws.id));

      const [docCount] = await db.select({ count: sql<number>`count(*)` })
        .from(vdrDocuments)
        .where(and(eq(vdrDocuments.workspaceId, ws.id), eq(vdrDocuments.isDeleted, false)));

      return {
        ...ws,
        totalDdTasks: Number(taskCounts?.total || 0),
        openDdTasks: Number(taskCounts?.pending || 0),
        pendingDocuments: Number(docCount?.count || 0),
      };
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
    // Task stats
    const [taskStats] = await db.select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${workspaceTasks.status} = 'completed')`,
      pending: sql<number>`count(*) filter (where ${workspaceTasks.status} = 'not_started' or ${workspaceTasks.status} = 'in_progress')`,
      overdue: sql<number>`count(*) filter (where ${workspaceTasks.status} != 'completed' and ${workspaceTasks.status} != 'skipped' and ${workspaceTasks.dueDate} < now())`,
    }).from(workspaceTasks).where(eq(workspaceTasks.workspaceId, ws.id));

    // VDR stats
    const [folderCount] = await db.select({ count: sql<number>`count(*)` })
      .from(vdrFolders).where(and(eq(vdrFolders.workspaceId, ws.id), eq(vdrFolders.isDeleted, false)));
    const [docCount] = await db.select({ count: sql<number>`count(*)` })
      .from(vdrDocuments).where(and(eq(vdrDocuments.workspaceId, ws.id), eq(vdrDocuments.isDeleted, false)));

    // Next milestone
    const [nextMilestone] = await db.select().from(ddMilestones)
      .where(and(eq(ddMilestones.workspaceId, ws.id), ne(ddMilestones.status, 'completed')))
      .orderBy(asc(ddMilestones.dueDate)).limit(1);

    // Recent activity
    const recentActivity = await db.select().from(vdrActivityLog)
      .where(eq(vdrActivityLog.workspaceId, ws.id))
      .orderBy(desc(vdrActivityLog.createdAt)).limit(10);

    // Members count
    const [memberCount] = await db.select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), ne(workspaceMembers.inviteStatus, 'revoked')));

    res.json({
      workspace: ws,
      stats: {
        dd: {
          total: Number(taskStats?.total || 0),
          completed: Number(taskStats?.completed || 0),
          pending: Number(taskStats?.pending || 0),
          overdue: Number(taskStats?.overdue || 0),
        },
        vdr: {
          folders: Number(folderCount?.count || 0),
          documents: Number(docCount?.count || 0),
          pendingRequests: 0,
        },
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
  if (dealId !== undefined) updates.dealId = dealId ? Number(dealId) : null;
  if (propertyId !== undefined) updates.propertyId = propertyId ? Number(propertyId) : null;
  if (ddProjectId !== undefined) updates.ddProjectId = ddProjectId ? Number(ddProjectId) : null;
  if (modelingProjectId !== undefined) updates.modelingProjectId = modelingProjectId ? Number(modelingProjectId) : null;

  try {
    const [updated] = await db.update(dealWorkspaces).set(updates)
      .where(eq(dealWorkspaces.id, ws.id)).returning();
    res.json(updated);
  } catch (error) {
    console.error('Error linking entities:', error);
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
    await db.update(dealWorkspaces).set({ status: 'archived', updatedAt: new Date() })
      .where(eq(dealWorkspaces.id, ws.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to archive workspace' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DD PROJECT PROVISIONING
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

  const {
    ddExpirationDate,
    closingDate,
    projectName,
  } = req.body;

  const ddStart = new Date();
  const ddExpiration = ddExpirationDate ? new Date(ddExpirationDate) : null;
  const closingDt = closingDate ? new Date(closingDate) : null;

  try {
    // 1) Update workspace with dates
    await db.update(dealWorkspaces).set({
      ddStartDate: ddStart,
      ddExpirationDate: ddExpiration,
      closingDate: closingDt,
      status: 'active',
      updatedAt: new Date(),
    }).where(eq(dealWorkspaces.id, ws.id));

    // 2) Create milestones
    const milestonesToCreate: any[] = [
      { workspaceId: ws.id, orgId, type: 'dd_start' as const, title: 'DD Start', dueDate: ddStart, status: 'completed' as const },
    ];
    if (ddExpiration) {
      milestonesToCreate.push({ workspaceId: ws.id, orgId, type: 'dd_expiration' as const, title: 'DD Expiration', dueDate: ddExpiration, status: 'upcoming' as const });
    }
    if (closingDt) {
      milestonesToCreate.push({ workspaceId: ws.id, orgId, type: 'closing' as const, title: 'Closing Date', dueDate: closingDt, status: 'upcoming' as const });
    }
    const createdMilestones = await db.insert(ddMilestones).values(milestonesToCreate).returning();

    // 3) Get workspace members for role-based assignment
    const members = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), ne(workspaceMembers.inviteStatus, 'revoked')));

    const findMemberByRole = (role: string) => {
      const match = members.find(m => m.role === role);
      return match?.id || null;
    };

    // 4) Create tasks from template
    function computeDueDate(anchor: string | undefined, offsetDays: number | undefined): Date | null {
      if (offsetDays === undefined) return null;
      let baseDate: Date;
      switch (anchor) {
        case 'dd_expiration':
          if (!ddExpiration) return null;
          baseDate = new Date(ddExpiration);
          break;
        case 'closing':
          if (!closingDt) return null;
          baseDate = new Date(closingDt);
          break;
        case 'dd_start':
        default:
          baseDate = new Date(ddStart);
          break;
      }
      baseDate.setDate(baseDate.getDate() + offsetDays);
      return baseDate;
    }

    // Flatten all tasks with their category
    const allTemplTasks: Array<ChecklistTaskTemplate & { category: string }> = [];
    let sortOrder = 0;
    for (const cat of CHECKLIST_TEMPLATE_DEFAULT.categories) {
      for (const task of cat.tasks) {
        allTemplTasks.push({ ...task, category: cat.title });
      }
    }

    // First pass: insert all tasks (without dependency links)
    const taskKeyToId: Record<string, number> = {};
    const insertedTasks: any[] = [];

    for (const tmpl of allTemplTasks) {
      sortOrder++;
      const dueDate = computeDueDate(tmpl.milestoneAnchor, tmpl.defaultDueOffsetDays);
      const assignedToMemberId = tmpl.defaultOwnerRole ? findMemberByRole(tmpl.defaultOwnerRole) : null;

      const [inserted] = await db.insert(workspaceTasks).values({
        workspaceId: ws.id,
        orgId,
        templateKey: tmpl.key,
        category: tmpl.category,
        title: tmpl.title,
        description: tmpl.description || null,
        status: 'not_started',
        dueDate,
        milestoneAnchor: tmpl.milestoneAnchor || null,
        defaultDueOffsetDays: tmpl.defaultDueOffsetDays ?? null,
        assignedToMemberId,
        required: tmpl.required ?? false,
        tags: tmpl.tags || null,
        sortOrder,
      }).returning();

      taskKeyToId[tmpl.key] = inserted.id;
      insertedTasks.push(inserted);
    }

    // Second pass: wire dependencies (use first dependency only for single FK)
    for (const tmpl of allTemplTasks) {
      if (tmpl.dependencies && tmpl.dependencies.length > 0) {
        const depKey = tmpl.dependencies[0]; // primary dependency
        const depId = taskKeyToId[depKey];
        const taskId = taskKeyToId[tmpl.key];
        if (depId && taskId) {
          await db.update(workspaceTasks).set({ dependencyTaskId: depId })
            .where(eq(workspaceTasks.id, taskId));
        }
      }
    }

    // 5) Create VDR folder tree
    const createdFolders: any[] = [];

    async function insertFoldersRecursive(nodes: VdrFolderNode[], parentId: number | null, order: number) {
      let idx = order;
      for (const node of nodes) {
        idx++;
        const [folder] = await db.insert(vdrFolders).values({
          workspaceId: ws.id,
          orgId,
          parentFolderId: parentId,
          name: node.name,
          templateKey: node.key,
          securityLevel: (node.securityLevel as any) || 'confidential',
          sortOrder: idx,
          createdBy: userId,
        }).returning();
        createdFolders.push(folder);
        if (node.children && node.children.length > 0) {
          idx = await insertFoldersRecursive(node.children, folder.id, idx);
        }
      }
      return idx;
    }

    // Root folder
    const [rootFolder] = await db.insert(vdrFolders).values({
      workspaceId: ws.id,
      orgId,
      parentFolderId: null,
      name: projectName || ws.name || 'Data Room',
      templateKey: 'root',
      securityLevel: 'confidential',
      sortOrder: 0,
      createdBy: userId,
    }).returning();
    createdFolders.push(rootFolder);

    await insertFoldersRecursive(VDR_FOLDER_TEMPLATE_DEFAULT.folders, rootFolder.id, 0);

    // 6) Create default CA
    const [ca] = await db.insert(confidentialityAgreements).values({
      workspaceId: ws.id,
      orgId,
      title: DEFAULT_CA_TITLE,
      version: DEFAULT_CA_VERSION,
      bodyHtml: DEFAULT_CA_BODY_HTML,
      accessPolicy: 'auto_approve',
      isActive: true,
      createdBy: userId,
    }).returning();

    // 7) Auto-execute CA for the creator (owner)
    await db.insert(agreementExecutions).values({
      workspaceId: ws.id,
      agreementId: ca.id,
      userId,
      status: 'executed',
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });

    // 8) Update workspace ddProjectId to reference itself (workspace-centric, no separate projects table needed)
    // We use the workspace ID as the logical "DD project" — or if you need a real projects table row, create one.
    // For this implementation, we mark ddProjectId = ws.id to signal DD is provisioned.
    await db.update(dealWorkspaces).set({
      ddProjectId: ws.id, // self-referencing to indicate DD is provisioned
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      lastActivityType: 'DD Provisioned',
      lastActivityDescription: `Due diligence project provisioned with ${insertedTasks.length} tasks and ${createdFolders.length} VDR folders.`,
    }).where(eq(dealWorkspaces.id, ws.id));

    // Log activity
    await logActivity({
      workspaceId: ws.id, orgId, userId, action: 'create_folder',
      meta: { event: 'dd_provisioned', tasksCount: insertedTasks.length, foldersCount: createdFolders.length },
    });

    res.status(201).json({
      success: true,
      workspaceId: ws.id,
      tasksCreated: insertedTasks.length,
      foldersCreated: createdFolders.length,
      milestonesCreated: createdMilestones.length,
      caCreated: true,
      milestones: createdMilestones,
    });
  } catch (error) {
    console.error('Error provisioning DD project:', error);
    res.status(500).json({ error: 'Failed to provision DD project' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM / MEMBERS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/workspaces/:id/members/invite
workspaceRouter.post('/api/workspaces/:id/members/invite', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { userId: inviteUserId, email, displayName, role, vdrPermission, ddPermission } = req.body;

  if (!inviteUserId && !email) {
    return res.status(400).json({ error: 'userId or email required' });
  }

  try {
    const [member] = await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      orgId: auth.orgId,
      userId: inviteUserId ? Number(inviteUserId) : null,
      email: email || null,
      displayName: displayName || email || null,
      role: role || 'viewer',
      vdrPermission: vdrPermission || 'view',
      ddPermission: ddPermission || 'view',
      inviteStatus: inviteUserId ? 'accepted' : 'pending',
      acceptedAt: inviteUserId ? new Date() : null,
      invitedBy: auth.userId,
    }).returning();

    res.status(201).json(member);
  } catch (error) {
    console.error('Error inviting member:', error);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

// GET /api/workspaces/:id/members
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

// PATCH /api/workspaces/:id/members/:memberId/permissions
workspaceRouter.patch('/api/workspaces/:id/members/:memberId/permissions', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const memberId = Number(req.params.memberId);
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

    await logActivity({ workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId, action: 'update_permissions', meta: { memberId, updates } });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// POST /api/workspaces/:id/members/:memberId/revoke
workspaceRouter.post('/api/workspaces/:id/members/:memberId/revoke', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const memberId = Number(req.params.memberId);
  try {
    const [updated] = await db.update(workspaceMembers)
      .set({ inviteStatus: 'revoked', revokedAt: new Date() })
      .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, ws.id)))
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

// GET /api/workspaces/:id/agreements/current
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

    // Check if current user has executed
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

// POST /api/workspaces/:id/agreements/execute
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

    // Check if already executed
    const [existing] = await db.select().from(agreementExecutions)
      .where(and(eq(agreementExecutions.agreementId, ca.id), eq(agreementExecutions.userId, auth.userId)))
      .limit(1);

    if (existing) return res.json({ execution: existing, alreadyExecuted: true });

    const executionStatus = ca.accessPolicy === 'auto_approve' ? 'executed' : 'pending_review';

    const [execution] = await db.insert(agreementExecutions).values({
      workspaceId: ws.id,
      agreementId: ca.id,
      userId: auth.userId,
      status: executionStatus as any,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
      notes: req.body.notes || null,
    }).returning();

    await logActivity({
      workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId,
      action: 'execute_ca', meta: { agreementId: ca.id, status: executionStatus },
    });

    res.status(201).json({ execution, alreadyExecuted: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute agreement' });
  }
});

// POST /api/workspaces/:id/agreements/:executionId/approve
workspaceRouter.post('/api/workspaces/:id/agreements/:executionId/approve', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const executionId = Number(req.params.executionId);
  const { approved } = req.body; // boolean

  try {
    const [updated] = await db.update(agreementExecutions)
      .set({
        status: approved ? 'executed' : 'rejected',
        reviewedBy: auth.userId,
        reviewedAt: new Date(),
      })
      .where(and(eq(agreementExecutions.id, executionId), eq(agreementExecutions.workspaceId, ws.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Execution not found' });

    await logActivity({
      workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId,
      action: approved ? 'approve_ca' : 'reject_ca', meta: { executionId },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VDR (CA-GATED)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/workspaces/:id/vdr/tree
workspaceRouter.get('/api/workspaces/:id/vdr/tree', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  // CA gating
  const caOk = await checkCAExecuted(ws.id, auth.userId, res);
  if (!caOk) return;

  try {
    const folders = await db.select().from(vdrFolders)
      .where(and(eq(vdrFolders.workspaceId, ws.id), eq(vdrFolders.isDeleted, false)))
      .orderBy(asc(vdrFolders.sortOrder));

    const docs = await db.select().from(vdrDocuments)
      .where(and(eq(vdrDocuments.workspaceId, ws.id), eq(vdrDocuments.isDeleted, false)))
      .orderBy(asc(vdrDocuments.name));

    // Build tree structure
    const folderMap = new Map<number, any>();
    const rootFolders: any[] = [];

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
        rootFolders.push(node);
      }
    }

    await logActivity({
      workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId,
      action: 'view', meta: { target: 'vdr_tree' },
    });

    res.json({ folders: rootFolders, totalFolders: folders.length, totalDocuments: docs.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch VDR tree' });
  }
});

// POST /api/workspaces/:id/vdr/folders
workspaceRouter.post('/api/workspaces/:id/vdr/folders', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  const caOk = await checkCAExecuted(ws.id, auth.userId, res);
  if (!caOk) return;

  const { name, parentFolderId, securityLevel } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Folder name required' });

  try {
    const [folder] = await db.insert(vdrFolders).values({
      workspaceId: ws.id, orgId: auth.orgId,
      parentFolderId: parentFolderId ? Number(parentFolderId) : null,
      name: name.trim(),
      securityLevel: securityLevel || 'confidential',
      createdBy: auth.userId,
    }).returning();

    await logActivity({
      workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId,
      action: 'create_folder', folderId: folder.id, meta: { name: folder.name },
    });

    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// POST /api/workspaces/:id/vdr/upload (metadata only — actual file upload would use multer/S3)
workspaceRouter.post('/api/workspaces/:id/vdr/upload', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  const caOk = await checkCAExecuted(ws.id, auth.userId, res);
  if (!caOk) return;

  const { folderId, name, mimeType, sizeBytes, storagePath } = req.body;
  if (!folderId || !name) return res.status(400).json({ error: 'folderId and name required' });

  try {
    const [doc] = await db.insert(vdrDocuments).values({
      workspaceId: ws.id, orgId: auth.orgId,
      folderId: Number(folderId),
      name, originalName: name,
      mimeType: mimeType || null,
      sizeBytes: sizeBytes || null,
      storagePath: storagePath || null,
      uploadedBy: auth.userId,
    }).returning();

    await logActivity({
      workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId,
      action: 'upload', documentId: doc.id, folderId: Number(folderId),
      meta: { name, mimeType, sizeBytes },
    });

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// POST /api/workspaces/:id/vdr/rename
workspaceRouter.post('/api/workspaces/:id/vdr/rename', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  const caOk = await checkCAExecuted(ws.id, auth.userId, res);
  if (!caOk) return;

  const { documentId, folderId, newName } = req.body;
  if (!newName?.trim()) return res.status(400).json({ error: 'newName required' });

  try {
    if (documentId) {
      await db.update(vdrDocuments).set({ name: newName.trim(), updatedAt: new Date() })
        .where(and(eq(vdrDocuments.id, Number(documentId)), eq(vdrDocuments.workspaceId, ws.id)));
      await logActivity({ workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId, action: 'rename', documentId: Number(documentId), meta: { newName } });
    } else if (folderId) {
      await db.update(vdrFolders).set({ name: newName.trim() })
        .where(and(eq(vdrFolders.id, Number(folderId)), eq(vdrFolders.workspaceId, ws.id)));
      await logActivity({ workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId, action: 'rename', folderId: Number(folderId), meta: { newName } });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename' });
  }
});

// POST /api/workspaces/:id/vdr/move
workspaceRouter.post('/api/workspaces/:id/vdr/move', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  const caOk = await checkCAExecuted(ws.id, auth.userId, res);
  if (!caOk) return;

  const { documentId, targetFolderId } = req.body;
  try {
    await db.update(vdrDocuments).set({ folderId: Number(targetFolderId), updatedAt: new Date() })
      .where(and(eq(vdrDocuments.id, Number(documentId)), eq(vdrDocuments.workspaceId, ws.id)));
    await logActivity({ workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId, action: 'move', documentId: Number(documentId), meta: { targetFolderId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to move document' });
  }
});

// POST /api/workspaces/:id/vdr/delete
workspaceRouter.post('/api/workspaces/:id/vdr/delete', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  const caOk = await checkCAExecuted(ws.id, auth.userId, res);
  if (!caOk) return;

  const { documentId, folderId } = req.body;
  try {
    if (documentId) {
      await db.update(vdrDocuments).set({ isDeleted: true, deletedAt: new Date(), deletedBy: auth.userId })
        .where(and(eq(vdrDocuments.id, Number(documentId)), eq(vdrDocuments.workspaceId, ws.id)));
      await logActivity({ workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId, action: 'delete', documentId: Number(documentId) });
    } else if (folderId) {
      await db.update(vdrFolders).set({ isDeleted: true, deletedAt: new Date(), deletedBy: auth.userId })
        .where(and(eq(vdrFolders.id, Number(folderId)), eq(vdrFolders.workspaceId, ws.id)));
      await logActivity({ workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId, action: 'delete', folderId: Number(folderId) });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// POST /api/workspaces/:id/vdr/restore
workspaceRouter.post('/api/workspaces/:id/vdr/restore', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { documentId, folderId } = req.body;
  try {
    if (documentId) {
      await db.update(vdrDocuments).set({ isDeleted: false, deletedAt: null, deletedBy: null })
        .where(and(eq(vdrDocuments.id, Number(documentId)), eq(vdrDocuments.workspaceId, ws.id)));
      await logActivity({ workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId, action: 'restore', documentId: Number(documentId) });
    } else if (folderId) {
      await db.update(vdrFolders).set({ isDeleted: false, deletedAt: null, deletedBy: null })
        .where(and(eq(vdrFolders.id, Number(folderId)), eq(vdrFolders.workspaceId, ws.id)));
      await logActivity({ workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId, action: 'restore', folderId: Number(folderId) });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore' });
  }
});

// GET /api/workspaces/:id/vdr/toc (Table of Contents export)
workspaceRouter.get('/api/workspaces/:id/vdr/toc', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;
  const caOk = await checkCAExecuted(ws.id, auth.userId, res);
  if (!caOk) return;

  try {
    const folders = await db.select().from(vdrFolders)
      .where(and(eq(vdrFolders.workspaceId, ws.id), eq(vdrFolders.isDeleted, false)))
      .orderBy(asc(vdrFolders.sortOrder));

    const docs = await db.select().from(vdrDocuments)
      .where(and(eq(vdrDocuments.workspaceId, ws.id), eq(vdrDocuments.isDeleted, false)))
      .orderBy(asc(vdrDocuments.name));

    // Build CSV
    const folderMap = new Map<number, string>();
    for (const f of folders) {
      const parentPath = f.parentFolderId ? folderMap.get(f.parentFolderId) || '' : '';
      folderMap.set(f.id, parentPath ? `${parentPath}/${f.name}` : f.name);
    }

    let csv = 'Folder Path,Document Name,Type,Size (bytes),Uploaded At\n';
    for (const doc of docs) {
      const path = folderMap.get(doc.folderId) || 'Unknown';
      csv += `"${path}","${doc.name}","${doc.mimeType || ''}",${doc.sizeBytes || ''},"${doc.createdAt?.toISOString() || ''}"\n`;
    }

    // Also list empty folders
    for (const f of folders) {
      const hasDoc = docs.some(d => d.folderId === f.id);
      if (!hasDoc) {
        const path = folderMap.get(f.id) || f.name;
        csv += `"${path}","(empty folder)","","",""\n`;
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vdr-toc-${ws.id}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate ToC' });
  }
});

// POST /api/workspaces/:id/vdr/document-alert
workspaceRouter.post('/api/workspaces/:id/vdr/document-alert', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const { documentId, message } = req.body;
  // In production, this would send email/notification. For now, log it.
  try {
    await logActivity({
      workspaceId: ws.id, orgId: auth.orgId, userId: auth.userId,
      action: 'view', documentId: documentId ? Number(documentId) : undefined,
      meta: { alert: true, message },
    });
    res.json({ success: true, message: 'Alert logged' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/workspaces/:id/tasks
workspaceRouter.get('/api/workspaces/:id/tasks', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const tasks = await db.select().from(workspaceTasks)
      .where(eq(workspaceTasks.workspaceId, ws.id))
      .orderBy(asc(workspaceTasks.sortOrder));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// PATCH /api/workspaces/:id/tasks/:taskId
workspaceRouter.patch('/api/workspaces/:id/tasks/:taskId', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const taskId = Number(req.params.taskId);
  const { status, assignedToMemberId } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (status) {
    updates.status = status;
    if (status === 'completed') {
      updates.completedAt = new Date();
      updates.completedBy = auth.userId;
    }
  }
  if (assignedToMemberId !== undefined) updates.assignedToMemberId = assignedToMemberId;

  try {
    const [updated] = await db.update(workspaceTasks).set(updates)
      .where(and(eq(workspaceTasks.id, taskId), eq(workspaceTasks.workspaceId, ws.id)))
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

// GET /api/workspaces/:id/milestones
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

// POST /api/workspaces/:id/milestones
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

// POST /api/workspaces/:id/calendar/ics
workspaceRouter.post('/api/workspaces/:id/calendar/ics', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  try {
    const milestones = await db.select().from(ddMilestones)
      .where(eq(ddMilestones.workspaceId, ws.id))
      .orderBy(asc(ddMilestones.dueDate));

    // Generate ICS
    const formatIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const now = formatIcsDate(new Date());

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MarinaMatch//Deal Workspace//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${ws.name} - Milestones`,
    ];

    for (const m of milestones) {
      const dtStart = formatIcsDate(new Date(m.dueDate));
      const dtEnd = formatIcsDate(new Date(new Date(m.dueDate).getTime() + 3600000)); // +1hr
      ics.push(
        'BEGIN:VEVENT',
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `DTSTAMP:${now}`,
        `UID:ws-${ws.id}-milestone-${m.id}@marinamatch`,
        `SUMMARY:${m.title}`,
        `DESCRIPTION:${m.notes || m.type}`,
        `STATUS:${m.status === 'completed' ? 'CANCELLED' : 'CONFIRMED'}`,
        'END:VEVENT',
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
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/workspaces/:id/activity
workspaceRouter.get('/api/workspaces/:id/activity', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const ws = await loadWorkspace(req, res, auth.orgId);
  if (!ws) return;

  const limit = Math.min(Number(req.query.limit) || 50, 200);

  try {
    const activity = await db.select().from(vdrActivityLog)
      .where(eq(vdrActivityLog.workspaceId, ws.id))
      .orderBy(desc(vdrActivityLog.createdAt))
      .limit(limit);
    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});
