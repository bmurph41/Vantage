import { db } from '../db';
import { 
  modelingApprovalRequests,
  modelingApproverDecisions,
  modelingScenarioVersions,
  modelingProjects,
  modelingAuditLog,
  users
} from '@shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export interface ApprovalRequestInput {
  scenarioVersionId: string;
  title: string;
  description?: string;
  requiredApprovers: string[];
  quorumCount: number;
  deadline?: Date;
}

export interface ApprovalDecisionInput {
  approvalRequestId: string;
  decision: 'approved' | 'rejected';
  comments?: string;
}

export interface ApprovalRequestWithDecisions {
  id: string;
  title: string;
  description?: string;
  status: string;
  scenarioVersionId: string;
  scenarioName?: string;
  projectName?: string;
  requestedBy: string;
  requestedAt: string;
  quorumCount: number;
  deadline?: string;
  completedAt?: string;
  decisions: Array<{
    id: string;
    approverId: string;
    approverName?: string;
    approverEmail?: string;
    decision: string;
    comments?: string;
    decidedAt?: string;
  }>;
  approvalCount: number;
  rejectionCount: number;
  pendingCount: number;
  isQuorumMet: boolean;
}

export class MultiApproverService {
  async createApprovalRequest(
    projectId: string,
    orgId: string,
    userId: string,
    input: ApprovalRequestInput
  ): Promise<string> {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, input.scenarioVersionId))
      .limit(1);

    if (!scenario) {
      throw new Error('Scenario version not found');
    }

    await db.update(modelingScenarioVersions)
      .set({ status: 'pending_approval' })
      .where(eq(modelingScenarioVersions.id, input.scenarioVersionId));

    const [request] = await db.insert(modelingApprovalRequests).values({
      orgId,
      modelingProjectId: projectId,
      scenarioVersionId: input.scenarioVersionId,
      title: input.title,
      description: input.description,
      requestedBy: userId,
      requiredApprovers: input.requiredApprovers,
      quorumCount: input.quorumCount,
      deadline: input.deadline,
      status: 'pending'
    }).returning();

    for (const approverId of input.requiredApprovers) {
      await db.insert(modelingApproverDecisions).values({
        approvalRequestId: request.id,
        approverId,
        decision: 'pending'
      });
    }

    await this.logAuditEvent(projectId, orgId, userId, 'approval_requested', {
      approvalRequestId: request.id,
      scenarioVersionId: input.scenarioVersionId,
      requiredApprovers: input.requiredApprovers,
      quorumCount: input.quorumCount
    });

    return request.id;
  }

  async submitDecision(
    orgId: string,
    userId: string,
    input: ApprovalDecisionInput
  ): Promise<{ requestStatus: string; isComplete: boolean }> {
    const [request] = await db.select()
      .from(modelingApprovalRequests)
      .where(and(
        eq(modelingApprovalRequests.id, input.approvalRequestId),
        eq(modelingApprovalRequests.orgId, orgId)
      ))
      .limit(1);

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot submit decision - request is already ${request.status}`);
    }

    const [existingDecision] = await db.select()
      .from(modelingApproverDecisions)
      .where(and(
        eq(modelingApproverDecisions.approvalRequestId, input.approvalRequestId),
        eq(modelingApproverDecisions.approverId, userId)
      ))
      .limit(1);

    if (!existingDecision) {
      throw new Error('You are not an approver for this request');
    }

    if (existingDecision.decision !== 'pending') {
      throw new Error('You have already submitted a decision');
    }

    await db.update(modelingApproverDecisions)
      .set({
        decision: input.decision,
        comments: input.comments,
        decidedAt: new Date()
      })
      .where(eq(modelingApproverDecisions.id, existingDecision.id));

    const allDecisions = await db.select()
      .from(modelingApproverDecisions)
      .where(eq(modelingApproverDecisions.approvalRequestId, input.approvalRequestId));

    const approvedCount = allDecisions.filter(d => d.decision === 'approved').length;
    const rejectedCount = allDecisions.filter(d => d.decision === 'rejected').length;
    const pendingCount = allDecisions.filter(d => d.decision === 'pending').length;

    let newStatus = 'pending';
    let isComplete = false;

    if (approvedCount >= request.quorumCount) {
      newStatus = 'approved';
      isComplete = true;
      
      await db.update(modelingScenarioVersions)
        .set({ 
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date()
        })
        .where(eq(modelingScenarioVersions.id, request.scenarioVersionId));
    } else if (rejectedCount > (allDecisions.length - request.quorumCount)) {
      newStatus = 'rejected';
      isComplete = true;

      await db.update(modelingScenarioVersions)
        .set({ status: 'rejected' })
        .where(eq(modelingScenarioVersions.id, request.scenarioVersionId));
    }

    if (isComplete) {
      await db.update(modelingApprovalRequests)
        .set({
          status: newStatus,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(modelingApprovalRequests.id, input.approvalRequestId));
    }

    await this.logAuditEvent(request.modelingProjectId, orgId, userId, 'decision_submitted', {
      approvalRequestId: input.approvalRequestId,
      decision: input.decision,
      comments: input.comments,
      resultingStatus: newStatus,
      approvedCount,
      rejectedCount,
      quorumCount: request.quorumCount
    });

    return { requestStatus: newStatus, isComplete };
  }

  async getApprovalRequest(
    requestId: string,
    orgId: string
  ): Promise<ApprovalRequestWithDecisions | null> {
    const [request] = await db.select()
      .from(modelingApprovalRequests)
      .where(and(
        eq(modelingApprovalRequests.id, requestId),
        eq(modelingApprovalRequests.orgId, orgId)
      ))
      .limit(1);

    if (!request) return null;

    const decisions = await db.select({
      id: modelingApproverDecisions.id,
      approverId: modelingApproverDecisions.approverId,
      decision: modelingApproverDecisions.decision,
      comments: modelingApproverDecisions.comments,
      decidedAt: modelingApproverDecisions.decidedAt,
      approverName: users.username,
      approverEmail: users.email
    })
      .from(modelingApproverDecisions)
      .leftJoin(users, eq(modelingApproverDecisions.approverId, users.id))
      .where(eq(modelingApproverDecisions.approvalRequestId, requestId));

    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, request.scenarioVersionId))
      .limit(1);

    const [project] = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, request.modelingProjectId))
      .limit(1);

    const approvalCount = decisions.filter(d => d.decision === 'approved').length;
    const rejectionCount = decisions.filter(d => d.decision === 'rejected').length;
    const pendingCount = decisions.filter(d => d.decision === 'pending').length;

    return {
      id: request.id,
      title: request.title,
      description: request.description || undefined,
      status: request.status,
      scenarioVersionId: request.scenarioVersionId,
      scenarioName: scenario?.name || undefined,
      projectName: project?.marinaName || project?.name || undefined,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt.toISOString(),
      quorumCount: request.quorumCount,
      deadline: request.deadline?.toISOString(),
      completedAt: request.completedAt?.toISOString(),
      decisions: decisions.map(d => ({
        id: d.id,
        approverId: d.approverId,
        approverName: d.approverName || undefined,
        approverEmail: d.approverEmail || undefined,
        decision: d.decision,
        comments: d.comments || undefined,
        decidedAt: d.decidedAt?.toISOString()
      })),
      approvalCount,
      rejectionCount,
      pendingCount,
      isQuorumMet: approvalCount >= request.quorumCount
    };
  }

  async getProjectApprovalRequests(
    projectId: string,
    orgId: string
  ): Promise<ApprovalRequestWithDecisions[]> {
    const requests = await db.select()
      .from(modelingApprovalRequests)
      .where(and(
        eq(modelingApprovalRequests.modelingProjectId, projectId),
        eq(modelingApprovalRequests.orgId, orgId)
      ))
      .orderBy(desc(modelingApprovalRequests.createdAt));

    const results: ApprovalRequestWithDecisions[] = [];
    for (const request of requests) {
      const full = await this.getApprovalRequest(request.id, orgId);
      if (full) results.push(full);
    }

    return results;
  }

  async getPendingApprovalsForUser(
    userId: string,
    orgId: string
  ): Promise<ApprovalRequestWithDecisions[]> {
    const pendingDecisions = await db.select()
      .from(modelingApproverDecisions)
      .where(and(
        eq(modelingApproverDecisions.approverId, userId),
        eq(modelingApproverDecisions.decision, 'pending')
      ));

    if (pendingDecisions.length === 0) return [];

    const requestIds = pendingDecisions.map(d => d.approvalRequestId);
    const requests = await db.select()
      .from(modelingApprovalRequests)
      .where(and(
        inArray(modelingApprovalRequests.id, requestIds),
        eq(modelingApprovalRequests.orgId, orgId),
        eq(modelingApprovalRequests.status, 'pending')
      ))
      .orderBy(desc(modelingApprovalRequests.createdAt));

    const results: ApprovalRequestWithDecisions[] = [];
    for (const request of requests) {
      const full = await this.getApprovalRequest(request.id, orgId);
      if (full) results.push(full);
    }

    return results;
  }

  private async logAuditEvent(
    projectId: string,
    orgId: string,
    userId: string,
    eventType: string,
    details: any
  ): Promise<void> {
    await db.insert(modelingAuditLog).values({
      orgId,
      modelingProjectId: projectId,
      eventType,
      entityType: 'approval',
      entityId: details.approvalRequestId,
      newValue: details,
      userId
    });
  }
}

export const multiApproverService = new MultiApproverService();
