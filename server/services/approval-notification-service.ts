import { db } from '../db';
import { 
  modelingScenarioVersions,
  modelingAuditLog,
  modelingProjects,
  users,
  organizations
} from '@shared/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { getSendGridClient } from './email-service';

export interface ApprovalRequest {
  id: string;
  scenarioId: string;
  projectId: string;
  projectName: string;
  scenarioName: string;
  scenarioType: string;
  requestedBy: string;
  requestedByEmail?: string;
  requestedAt: Date;
  status: string;
  approvers: string[];
}

export interface ApprovalNotification {
  id: string;
  orgId: string;
  userId: string;
  type: 'approval_requested' | 'approval_granted' | 'approval_rejected' | 'approval_reminder';
  scenarioId: string;
  projectId: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const inMemoryNotifications: ApprovalNotification[] = [];

export class ApprovalNotificationService {
  async getPendingApprovals(orgId: string, userId?: string): Promise<ApprovalRequest[]> {
    const pendingScenarios = await db.select({
      id: modelingScenarioVersions.id,
      scenarioId: modelingScenarioVersions.id,
      projectId: modelingScenarioVersions.modelingProjectId,
      scenarioName: modelingScenarioVersions.name,
      scenarioType: modelingScenarioVersions.scenarioType,
      status: modelingScenarioVersions.status,
      createdBy: modelingScenarioVersions.createdBy,
      updatedAt: modelingScenarioVersions.updatedAt
    })
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.orgId, orgId),
        eq(modelingScenarioVersions.status, 'pending_approval')
      ))
      .orderBy(desc(modelingScenarioVersions.updatedAt));

    const projectIds = [...new Set(pendingScenarios.map(s => s.projectId))];
    const projects = projectIds.length > 0 
      ? await db.select({
          id: modelingProjects.id,
          name: modelingProjects.name
        })
          .from(modelingProjects)
          .where(inArray(modelingProjects.id, projectIds))
      : [];
    
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    return pendingScenarios.map(s => ({
      id: s.id,
      scenarioId: s.scenarioId,
      projectId: s.projectId,
      projectName: projectMap.get(s.projectId) || 'Unknown Project',
      scenarioName: s.scenarioName || 'Unnamed Scenario',
      scenarioType: s.scenarioType,
      requestedBy: s.createdBy || 'Unknown',
      requestedAt: s.updatedAt || new Date(),
      status: s.status || 'pending_approval',
      approvers: []
    }));
  }

  async notifyApprovalRequested(
    scenarioId: string, 
    requesterId: string, 
    approverUserIds: string[]
  ): Promise<void> {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, scenarioId))
      .limit(1);

    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const [project] = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, scenario.modelingProjectId))
      .limit(1);

    const requester = await db.select()
      .from(users)
      .where(eq(users.id, requesterId))
      .limit(1);

    const requesterName = requester[0]?.username || 'A team member';

    for (const approverId of approverUserIds) {
      const notification: ApprovalNotification = {
        id: crypto.randomUUID(),
        orgId: scenario.orgId,
        userId: approverId,
        type: 'approval_requested',
        scenarioId,
        projectId: scenario.modelingProjectId,
        message: `${requesterName} has submitted "${scenario.name}" for approval on project "${project?.name || 'Unknown'}"`,
        isRead: false,
        createdAt: new Date()
      };
      inMemoryNotifications.push(notification);
    }

    if (process.env.SENDGRID_API_KEY && approverUserIds.length > 0) {
      const approvers = await db.select()
        .from(users)
        .where(inArray(users.id, approverUserIds));

      const approverEmails = approvers
        .filter(a => a.email)
        .map(a => a.email!);

      if (approverEmails.length > 0) {
        try {
          await this.sendApprovalRequestEmail({
            to: approverEmails,
            scenarioName: scenario.name || 'Unnamed Scenario',
            scenarioType: scenario.scenarioType,
            projectName: project?.name || 'Unknown Project',
            requesterName,
            scenarioId,
            projectId: scenario.modelingProjectId
          });
        } catch (error) {
          console.error('Failed to send approval request email:', error);
        }
      }
    }
  }

  async notifyApprovalDecision(
    scenarioId: string,
    decision: 'approved' | 'rejected',
    deciderId: string,
    notes?: string
  ): Promise<void> {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, scenarioId))
      .limit(1);

    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const [project] = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, scenario.modelingProjectId))
      .limit(1);

    const decider = await db.select()
      .from(users)
      .where(eq(users.id, deciderId))
      .limit(1);

    const deciderName = decider[0]?.username || 'An approver';
    const requesterId = scenario.createdBy;

    if (requesterId) {
      const notificationType = decision === 'approved' ? 'approval_granted' : 'approval_rejected';
      const message = decision === 'approved'
        ? `${deciderName} has approved "${scenario.name}" on project "${project?.name || 'Unknown'}"`
        : `${deciderName} has rejected "${scenario.name}" on project "${project?.name || 'Unknown'}"${notes ? `: ${notes}` : ''}`;

      const notification: ApprovalNotification = {
        id: crypto.randomUUID(),
        orgId: scenario.orgId,
        userId: requesterId,
        type: notificationType,
        scenarioId,
        projectId: scenario.modelingProjectId,
        message,
        isRead: false,
        createdAt: new Date()
      };
      inMemoryNotifications.push(notification);

      if (process.env.SENDGRID_API_KEY) {
        const requester = await db.select()
          .from(users)
          .where(eq(users.id, requesterId))
          .limit(1);

        if (requester[0]?.email) {
          try {
            await this.sendApprovalDecisionEmail({
              to: requester[0].email,
              scenarioName: scenario.name || 'Unnamed Scenario',
              projectName: project?.name || 'Unknown Project',
              decision,
              deciderName,
              notes,
              scenarioId,
              projectId: scenario.modelingProjectId
            });
          } catch (error) {
            console.error('Failed to send approval decision email:', error);
          }
        }
      }
    }
  }

  async getUserNotifications(orgId: string, userId: string, unreadOnly = false): Promise<ApprovalNotification[]> {
    let notifications = inMemoryNotifications.filter(
      n => n.orgId === orgId && n.userId === userId
    );

    if (unreadOnly) {
      notifications = notifications.filter(n => !n.isRead);
    }

    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    const notification = inMemoryNotifications.find(
      n => n.id === notificationId && n.userId === userId
    );
    if (notification) {
      notification.isRead = true;
    }
  }

  async markAllNotificationsRead(orgId: string, userId: string): Promise<void> {
    inMemoryNotifications
      .filter(n => n.orgId === orgId && n.userId === userId)
      .forEach(n => n.isRead = true);
  }

  async getUnreadCount(orgId: string, userId: string): Promise<number> {
    return inMemoryNotifications.filter(
      n => n.orgId === orgId && n.userId === userId && !n.isRead
    ).length;
  }

  private async sendApprovalRequestEmail(params: {
    to: string[];
    scenarioName: string;
    scenarioType: string;
    projectName: string;
    requesterName: string;
    scenarioId: string;
    projectId: string;
  }): Promise<void> {
    const appUrl = process.env.APP_URL || 'https://your-app.replit.app';
    const reviewUrl = `${appUrl}/modeling/projects/${params.projectId}/workspace/assumptions`;

    const { client, fromEmail } = await getSendGridClient();

    const msg = {
      to: params.to,
      from: { email: fromEmail, name: 'MarinaMatch' },
      subject: `[Action Required] Scenario Approval Request: ${params.scenarioName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">Scenario Approval Requested</h2>
          <p>${params.requesterName} has submitted a scenario for your approval:</p>
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Project:</strong> ${params.projectName}</p>
            <p><strong>Scenario:</strong> ${params.scenarioName}</p>
            <p><strong>Type:</strong> ${params.scenarioType.charAt(0).toUpperCase() + params.scenarioType.slice(1)} Case</p>
          </div>
          <a href="${reviewUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
            Review & Approve
          </a>
          <p style="color: #718096; font-size: 14px; margin-top: 20px;">
            You can approve, reject, or request changes to this scenario from the Modeling Projects workspace.
          </p>
        </div>
      `
    };

    await client.send(msg);
  }

  private async sendApprovalDecisionEmail(params: {
    to: string;
    scenarioName: string;
    projectName: string;
    decision: 'approved' | 'rejected';
    deciderName: string;
    notes?: string;
    scenarioId: string;
    projectId: string;
  }): Promise<void> {
    const appUrl = process.env.APP_URL || 'https://your-app.replit.app';
    const scenarioUrl = `${appUrl}/modeling/projects/${params.projectId}/workspace/assumptions`;

    const statusColor = params.decision === 'approved' ? '#38a169' : '#e53e3e';
    const statusText = params.decision === 'approved' ? 'Approved' : 'Rejected';

    const { client, fromEmail } = await getSendGridClient();

    const msg = {
      to: params.to,
      from: { email: fromEmail, name: 'MarinaMatch' },
      subject: `Scenario ${statusText}: ${params.scenarioName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${statusColor};">Scenario ${statusText}</h2>
          <p>${params.deciderName} has ${params.decision} your scenario:</p>
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Project:</strong> ${params.projectName}</p>
            <p><strong>Scenario:</strong> ${params.scenarioName}</p>
            <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
            ${params.notes ? `<p><strong>Notes:</strong> ${params.notes}</p>` : ''}
          </div>
          <a href="${scenarioUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
            View Scenario
          </a>
        </div>
      `
    };

    await client.send(msg);
  }

  async getApprovalStats(orgId: string): Promise<{
    pending: number;
    approvedThisMonth: number;
    rejectedThisMonth: number;
    averageApprovalTime: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pending = await db.select({ count: sql<number>`count(*)` })
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.orgId, orgId),
        eq(modelingScenarioVersions.status, 'pending_approval')
      ));

    const approved = await db.select({ count: sql<number>`count(*)` })
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.orgId, orgId),
        eq(modelingScenarioVersions.status, 'approved'),
        sql`${modelingScenarioVersions.approvedAt} >= ${startOfMonth.toISOString()}`
      ));

    const rejected = await db.select({ count: sql<number>`count(*)` })
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.orgId, orgId),
        eq(modelingScenarioVersions.status, 'rejected'),
        sql`${modelingScenarioVersions.updatedAt} >= ${startOfMonth.toISOString()}`
      ));

    return {
      pending: Number(pending[0]?.count || 0),
      approvedThisMonth: Number(approved[0]?.count || 0),
      rejectedThisMonth: Number(rejected[0]?.count || 0),
      averageApprovalTime: 48
    };
  }

  async getOrgApprovers(orgId: string): Promise<Array<{ id: string; name: string; email: string }>> {
    const orgUsers = await db.select({
      id: users.id,
      name: users.username,
      email: users.email,
      role: users.role
    })
      .from(users)
      .where(and(
        eq(users.orgId, orgId),
        inArray(users.role, ['owner', 'admin', 'editor'])
      ));

    return orgUsers.map(u => ({
      id: u.id,
      name: u.name || 'Unknown',
      email: u.email || ''
    }));
  }
}

export const approvalNotificationService = new ApprovalNotificationService();
