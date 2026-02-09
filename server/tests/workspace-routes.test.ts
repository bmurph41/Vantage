/**
 * Deal Workspace Integration Tests
 * 
 * Tests:
 * 1. DD provisioning creates tasks + VDR folders + CA + milestones
 * 2. CA gating blocks VDR access before execution
 * 3. Cross-org access is denied
 * 
 * Usage: Run with your test runner (vitest/jest) with a test DB.
 * These tests assume Express app is available and DB is seeded with at least one org + user.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app'; // Your Express app export
import { db } from '../db';
import {
  dealWorkspaces, workspaceMembers, workspaceTasks, vdrFolders,
  confidentialityAgreements, agreementExecutions, ddMilestones, vdrActivityLog,
} from '../schema/deal-workspace-schema';
import { eq, and } from 'drizzle-orm';

// ─── Test helpers ────────────────────────────────────────────────────────────

const ORG_A = { orgId: 9001, userId: 1001 };
const ORG_B = { orgId: 9002, userId: 2001 };

/**
 * Simulate authenticated request. In production, replace with actual session/token.
 * This assumes your auth middleware reads from req.user or similar.
 */
function authAgent(agent: request.SuperTest<request.Test>, auth: { orgId: number; userId: number }) {
  // Adapt to your auth mechanism. Common patterns:
  // - Set headers that your auth middleware reads
  // - Use a test session cookie
  return {
    get: (url: string) => agent.get(url).set('X-Test-UserId', String(auth.userId)).set('X-Test-OrgId', String(auth.orgId)),
    post: (url: string) => agent.post(url).set('X-Test-UserId', String(auth.userId)).set('X-Test-OrgId', String(auth.orgId)),
    patch: (url: string) => agent.patch(url).set('X-Test-UserId', String(auth.userId)).set('X-Test-OrgId', String(auth.orgId)),
    delete: (url: string) => agent.delete(url).set('X-Test-UserId', String(auth.userId)).set('X-Test-OrgId', String(auth.orgId)),
  };
}

let agent: request.SuperTest<request.Test>;
let workspaceA: any;

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  agent = request(app);
});

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Deal Workspace - DD Provisioning', () => {
  let wsId: number;

  it('should create a workspace', async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.post('/api/workspaces')
      .send({ name: 'Test Marina Acquisition', description: 'Test workspace', role: 'buyer', status: 'active' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Marina Acquisition');
    expect(res.body.orgId).toBe(ORG_A.orgId);
    wsId = res.body.id;
    workspaceA = res.body;
  });

  it('should auto-create owner_admin member on workspace creation', async () => {
    const members = await db.select().from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, wsId));
    
    expect(members.length).toBeGreaterThanOrEqual(1);
    const owner = members.find(m => m.role === 'owner_admin');
    expect(owner).toBeDefined();
    expect(owner!.userId).toBe(ORG_A.userId);
    expect(owner!.vdrPermission).toBe('admin');
    expect(owner!.ddPermission).toBe('admin');
    expect(owner!.inviteStatus).toBe('accepted');
  });

  it('should provision DD project with tasks, VDR folders, CA, and milestones', async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.post(`/api/workspaces/${wsId}/dd-project`)
      .send({
        ddExpirationDate: '2025-09-15',
        closingDate: '2025-10-15',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.tasksCreated).toBeGreaterThan(25); // Template has 28 tasks
    expect(res.body.foldersCreated).toBeGreaterThan(30); // Template has 9 root + ~30 children + 1 root
    expect(res.body.milestonesCreated).toBeGreaterThanOrEqual(2); // dd_start + dd_expiration + closing
    expect(res.body.caCreated).toBe(true);
  });

  it('should have created workspace tasks from template', async () => {
    const tasks = await db.select().from(workspaceTasks)
      .where(eq(workspaceTasks.workspaceId, wsId));

    expect(tasks.length).toBeGreaterThan(25);

    // Verify specific tasks exist
    const psaTask = tasks.find(t => t.templateKey === 'exec_confirm_psa');
    expect(psaTask).toBeDefined();
    expect(psaTask!.title).toBe('Confirm PSA execution and key dates');
    expect(psaTask!.status).toBe('not_started');
    expect(psaTask!.category).toBe('Executive / Deal Setup');
    expect(psaTask!.required).toBe(true);

    // Verify due dates are computed
    const titleTask = tasks.find(t => t.templateKey === 'legal_order_title');
    expect(titleTask).toBeDefined();
    expect(titleTask!.dueDate).toBeDefined();

    // Verify dependencies are wired
    const reviewTitle = tasks.find(t => t.templateKey === 'legal_review_title');
    const orderTitle = tasks.find(t => t.templateKey === 'legal_order_title');
    expect(reviewTitle!.dependencyTaskId).toBe(orderTitle!.id);
  });

  it('should have created VDR folder tree from template', async () => {
    const folders = await db.select().from(vdrFolders)
      .where(eq(vdrFolders.workspaceId, wsId));

    expect(folders.length).toBeGreaterThan(30);

    // Root folder
    const root = folders.find(f => f.templateKey === 'root');
    expect(root).toBeDefined();

    // Top-level template folders
    const legalFolder = folders.find(f => f.templateKey === '02_legal');
    expect(legalFolder).toBeDefined();
    expect(legalFolder!.name).toBe('02 Legal');
    expect(legalFolder!.securityLevel).toBe('restricted');
    expect(legalFolder!.parentFolderId).toBe(root!.id);

    // Nested folders
    const psaFolder = folders.find(f => f.templateKey === '02_legal_psa');
    expect(psaFolder).toBeDefined();
    expect(psaFolder!.parentFolderId).toBe(legalFolder!.id);
  });

  it('should have created default CA', async () => {
    const cas = await db.select().from(confidentialityAgreements)
      .where(eq(confidentialityAgreements.workspaceId, wsId));

    expect(cas.length).toBe(1);
    expect(cas[0].title).toBe('Confidentiality Agreement');
    expect(cas[0].isActive).toBe(true);
    expect(cas[0].accessPolicy).toBe('auto_approve');
    expect(cas[0].bodyHtml).toContain('NON-DISCLOSURE');
  });

  it('should have auto-executed CA for workspace creator', async () => {
    const [ca] = await db.select().from(confidentialityAgreements)
      .where(eq(confidentialityAgreements.workspaceId, wsId));

    const executions = await db.select().from(agreementExecutions)
      .where(and(eq(agreementExecutions.agreementId, ca.id), eq(agreementExecutions.userId, ORG_A.userId)));

    expect(executions.length).toBe(1);
    expect(executions[0].status).toBe('executed');
  });

  it('should have created milestones', async () => {
    const milestones = await db.select().from(ddMilestones)
      .where(eq(ddMilestones.workspaceId, wsId));

    expect(milestones.length).toBeGreaterThanOrEqual(3);
    
    const ddStart = milestones.find(m => m.type === 'dd_start');
    expect(ddStart).toBeDefined();
    expect(ddStart!.status).toBe('completed');

    const ddExp = milestones.find(m => m.type === 'dd_expiration');
    expect(ddExp).toBeDefined();
    expect(ddExp!.status).toBe('upcoming');

    const closing = milestones.find(m => m.type === 'closing');
    expect(closing).toBeDefined();
  });

  it('should reject provisioning if DD already exists', async () => {
    const authA = authAgent(agent, ORG_A);
    await authA.post(`/api/workspaces/${wsId}/dd-project`)
      .send({ ddExpirationDate: '2025-09-15' })
      .expect(409);
  });
});

describe('Deal Workspace - CA Gating', () => {
  let wsId: number;
  let newUserId = 3001;

  beforeAll(async () => {
    // Create workspace and provision DD
    const authA = authAgent(agent, ORG_A);
    const wsRes = await authA.post('/api/workspaces')
      .send({ name: 'CA Gating Test', status: 'active' });
    wsId = wsRes.body.id;

    await authA.post(`/api/workspaces/${wsId}/dd-project`)
      .send({ ddExpirationDate: '2025-12-31' });

    // Invite a new member (who hasn't executed CA)
    await authA.post(`/api/workspaces/${wsId}/members/invite`)
      .send({ userId: newUserId, role: 'viewer', vdrPermission: 'view', ddPermission: 'view' });
  });

  it('should allow VDR access for workspace creator (auto-executed CA)', async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.get(`/api/workspaces/${wsId}/vdr/tree`)
      .expect(200);

    expect(res.body.folders).toBeDefined();
    expect(res.body.totalFolders).toBeGreaterThan(0);
  });

  it('should block VDR access for member who has not executed CA', async () => {
    const authNew = authAgent(agent, { orgId: ORG_A.orgId, userId: newUserId });
    const res = await authNew.get(`/api/workspaces/${wsId}/vdr/tree`)
      .expect(403);

    expect(res.body.code).toBe('CA_REQUIRED');
    expect(res.body.message).toContain('Confidentiality Agreement');
  });

  it('should allow VDR access after CA execution', async () => {
    const authNew = authAgent(agent, { orgId: ORG_A.orgId, userId: newUserId });
    
    // Execute CA
    const execRes = await authNew.post(`/api/workspaces/${wsId}/agreements/execute`)
      .expect(201);

    expect(execRes.body.execution.status).toBe('executed'); // auto_approve

    // Now try VDR access
    const vdrRes = await authNew.get(`/api/workspaces/${wsId}/vdr/tree`)
      .expect(200);

    expect(vdrRes.body.folders).toBeDefined();
  });
});

describe('Deal Workspace - Cross-Org Access Control', () => {
  let wsOrgA: number;

  beforeAll(async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.post('/api/workspaces')
      .send({ name: 'Org A Only Workspace', status: 'active' });
    wsOrgA = res.body.id;
  });

  it('should allow Org A user to access Org A workspace', async () => {
    const authA = authAgent(agent, ORG_A);
    await authA.get(`/api/workspaces/${wsOrgA}`).expect(200);
  });

  it('should deny Org B user access to Org A workspace', async () => {
    const authB = authAgent(agent, ORG_B);
    await authB.get(`/api/workspaces/${wsOrgA}`).expect(404); // Not found (org-scoped)
  });

  it('should not list Org A workspaces for Org B user', async () => {
    const authB = authAgent(agent, ORG_B);
    const res = await authB.get('/api/workspaces').expect(200);

    const orgAWorkspaces = res.body.filter((w: any) => w.orgId === ORG_A.orgId);
    expect(orgAWorkspaces.length).toBe(0);
  });

  it('should deny Org B provisioning on Org A workspace', async () => {
    const authB = authAgent(agent, ORG_B);
    await authB.post(`/api/workspaces/${wsOrgA}/dd-project`)
      .send({ ddExpirationDate: '2025-12-31' })
      .expect(404);
  });

  it('should deny Org B member invite on Org A workspace', async () => {
    const authB = authAgent(agent, ORG_B);
    await authB.post(`/api/workspaces/${wsOrgA}/members/invite`)
      .send({ email: 'hacker@evil.com', role: 'admin' })
      .expect(404);
  });

  it('should deny Org B VDR access on Org A workspace', async () => {
    const authB = authAgent(agent, ORG_B);
    await authB.get(`/api/workspaces/${wsOrgA}/vdr/tree`).expect(404);
  });
});

describe('Deal Workspace - Task Management', () => {
  let wsId: number;

  beforeAll(async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.post('/api/workspaces')
      .send({ name: 'Task Test Workspace', status: 'active' });
    wsId = res.body.id;
    await authA.post(`/api/workspaces/${wsId}/dd-project`)
      .send({ ddExpirationDate: '2025-12-31', closingDate: '2026-01-31' });
  });

  it('should list tasks for workspace', async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.get(`/api/workspaces/${wsId}/tasks`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should update task status', async () => {
    const authA = authAgent(agent, ORG_A);
    const tasks = await authA.get(`/api/workspaces/${wsId}/tasks`);
    const taskId = tasks.body[0].id;

    const res = await authA.patch(`/api/workspaces/${wsId}/tasks/${taskId}`)
      .send({ status: 'completed' })
      .expect(200);

    expect(res.body.status).toBe('completed');
    expect(res.body.completedAt).toBeDefined();
  });
});

describe('Deal Workspace - Milestones & Calendar', () => {
  let wsId: number;

  beforeAll(async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.post('/api/workspaces')
      .send({ name: 'Milestone Test', status: 'active' });
    wsId = res.body.id;
    await authA.post(`/api/workspaces/${wsId}/dd-project`)
      .send({ ddExpirationDate: '2025-12-31', closingDate: '2026-01-31' });
  });

  it('should list milestones', async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.get(`/api/workspaces/${wsId}/milestones`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it('should create custom milestone', async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.post(`/api/workspaces/${wsId}/milestones`)
      .send({ type: 'custom', title: 'Inspection Deadline', dueDate: '2025-08-15', notes: 'Internal deadline' })
      .expect(201);

    expect(res.body.title).toBe('Inspection Deadline');
    expect(res.body.type).toBe('custom');
  });

  it('should export ICS calendar', async () => {
    const authA = authAgent(agent, ORG_A);
    const res = await authA.post(`/api/workspaces/${wsId}/calendar/ics`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('BEGIN:VEVENT');
    expect(res.text).toContain('END:VCALENDAR');
  });
});
