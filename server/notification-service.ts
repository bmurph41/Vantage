import { MailService } from '@sendgrid/mail';
import { 
  type Task, type Project, type User, type Contact, type NotificationLog,
  type CalendarEvent 
} from '@shared/schema';
import { storage } from './storage';
import { resolveRecipient } from '@shared/recipient-utils';
import { db } from './db';

// Initialize SendGrid client
const sgMail = new MailService();
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface NotificationContext {
  project: Project;
  task?: Task;
  recipient: { email: string; name: string; timezone?: string };
  triggerUser?: { name: string; email: string };
  note?: string;
  previousStatus?: string;
  newStatus?: string;
}

export class NotificationService {
  private readonly defaultFromEmail = 'noreply@duesoon.com';
  private readonly defaultFromName = 'DueSoon Due Diligence';

  /**
   * Generate professional HTML email template
   */
  private generateEmailTemplate(
    type: 'task_status' | 'note_added' | 'deadline_upcoming' | 'deadline_today' | 'overdue',
    context: NotificationContext
  ): EmailTemplate {
    const { project, task, recipient, triggerUser } = context;
    
    const baseStyles = `
      <style>
        .email-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #ffffff; }
        .task-card { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .status-not_started { background: #e9ecef; color: #6c757d; }
        .status-engaged { background: #fff3cd; color: #856404; }
        .status-in_progress { background: #d1ecf1; color: #0c5460; }
        .status-completed { background: #d4edda; color: #155724; }
        .urgent { color: #dc3545; font-weight: bold; }
        .action-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        .project-info { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0; }
      </style>
    `;

    switch (type) {
      case 'task_status':
        return {
          subject: `Task Status Update: ${task?.title} - ${project.name}`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header">
                <h2>🔄 Task Status Update</h2>
                <p>Due Diligence Progress Notification</p>
              </div>
              <div class="content">
                <p>Hello ${recipient.name},</p>
                <p>A task assigned to you has been updated by ${triggerUser?.name || 'a team member'}.</p>
                
                <div class="task-card">
                  <h3>${task?.title}</h3>
                  <p><strong>Status Change:</strong> 
                    <span class="status-badge status-${context.previousStatus}">${context.previousStatus?.replace('_', ' ')}</span>
                    → 
                    <span class="status-badge status-${context.newStatus}">${context.newStatus?.replace('_', ' ')}</span>
                  </p>
                  ${task?.deadline ? `<p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` : ''}
                  ${task?.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
                </div>

                <div class="project-info">
                  <h4>📋 Project: ${project.name}</h4>
                  ${project.ddExpirationDate ? `<p><strong>DD Expires:</strong> ${new Date(project.ddExpirationDate).toLocaleDateString()}</p>` : ''}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}" class="action-button">View Task Details</a>
                </div>
              </div>
              <div class="footer">
                <p>This notification was sent from your Due Diligence management system.</p>
                <p>If you no longer wish to receive these notifications, please contact your project administrator.</p>
              </div>
            </div>
          `,
          text: `Task Status Update: ${task?.title}

Hello ${recipient.name},

A task assigned to you has been updated by ${triggerUser?.name || 'a team member'}.

Task: ${task?.title}
Status Change: ${context.previousStatus} → ${context.newStatus}
${task?.deadline ? `Deadline: ${new Date(task.deadline).toLocaleDateString()}` : ''}
Project: ${project.name}

View task details: ${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}

This notification was sent from your Due Diligence management system.`
        };

      case 'note_added':
        return {
          subject: `New Note Added: ${task?.title} - ${project.name}`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header">
                <h2>📝 New Note Added</h2>
                <p>Due Diligence Communication</p>
              </div>
              <div class="content">
                <p>Hello ${recipient.name},</p>
                <p>${triggerUser?.name || 'A team member'} added a note to a task you're involved with.</p>
                
                <div class="task-card">
                  <h3>${task?.title}</h3>
                  <div style="background: white; padding: 15px; border-radius: 4px; margin: 10px 0;">
                    <strong>New Note:</strong>
                    <p style="margin-top: 10px;">${context.note || 'Note content not available'}</p>
                  </div>
                  ${task?.status ? `<p><strong>Current Status:</strong> <span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span></p>` : ''}
                </div>

                <div class="project-info">
                  <h4>📋 Project: ${project.name}</h4>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}" class="action-button">View Full Conversation</a>
                </div>
              </div>
              <div class="footer">
                <p>This notification was sent from your Due Diligence management system.</p>
              </div>
            </div>
          `,
          text: `New Note Added: ${task?.title}

Hello ${recipient.name},

${triggerUser?.name || 'A team member'} added a note to a task you're involved with.

Task: ${task?.title}
Project: ${project.name}

New Note: ${context.note || 'Note content not available'}

View full conversation: ${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}

This notification was sent from your Due Diligence management system.`
        };

      case 'deadline_upcoming':
        const daysUntilDeadline = task?.deadline ? Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          subject: `⏰ Deadline Alert: ${task?.title} due in ${daysUntilDeadline} days`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header">
                <h2>⏰ Deadline Alert</h2>
                <p>Upcoming Task Deadline</p>
              </div>
              <div class="content">
                <p>Hello ${recipient.name},</p>
                <p class="urgent">You have a task deadline approaching in ${daysUntilDeadline} days.</p>
                
                <div class="task-card">
                  <h3>${task?.title}</h3>
                  <p class="urgent"><strong>Due Date:</strong> ${task?.deadline ? new Date(task.deadline).toLocaleDateString() : 'Not set'}</p>
                  <p><strong>Current Status:</strong> <span class="status-badge status-${task?.status}">${task?.status?.replace('_', ' ')}</span></p>
                  ${task?.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
                  ${task?.assignee ? `<p><strong>Assignee:</strong> ${task.assignee}</p>` : ''}
                </div>

                <div class="project-info">
                  <h4>📋 Project: ${project.name}</h4>
                  ${project.ddExpirationDate ? `<p><strong>DD Expires:</strong> ${new Date(project.ddExpirationDate).toLocaleDateString()}</p>` : ''}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}" class="action-button">Update Task Status</a>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated deadline reminder from your Due Diligence management system.</p>
              </div>
            </div>
          `,
          text: `Deadline Alert: ${task?.title}

Hello ${recipient.name},

You have a task deadline approaching in ${daysUntilDeadline} days.

Task: ${task?.title}
Due Date: ${task?.deadline ? new Date(task.deadline).toLocaleDateString() : 'Not set'}
Current Status: ${task?.status?.replace('_', ' ')}
Project: ${project.name}

Please update the task status: ${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}

This is an automated deadline reminder from your Due Diligence management system.`
        };

      case 'deadline_today':
        return {
          subject: `🚨 URGENT: ${task?.title} is due TODAY`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);">
                <h2>🚨 URGENT DEADLINE</h2>
                <p>Task Due Today</p>
              </div>
              <div class="content">
                <p>Hello ${recipient.name},</p>
                <p class="urgent" style="font-size: 18px;">A task assigned to you is due TODAY.</p>
                
                <div class="task-card" style="border-left-color: #dc3545;">
                  <h3>${task?.title}</h3>
                  <p class="urgent" style="font-size: 16px;"><strong>⏰ Due: TODAY (${task?.deadline ? new Date(task.deadline).toLocaleDateString() : ''})</strong></p>
                  <p><strong>Current Status:</strong> <span class="status-badge status-${task?.status}">${task?.status?.replace('_', ' ')}</span></p>
                  ${task?.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
                </div>

                <div class="project-info">
                  <h4>📋 Project: ${project.name}</h4>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}" class="action-button" style="background: #dc3545;">TAKE ACTION NOW</a>
                </div>
              </div>
              <div class="footer">
                <p><strong>This is a critical deadline notification.</strong></p>
              </div>
            </div>
          `,
          text: `🚨 URGENT: ${task?.title} is due TODAY

Hello ${recipient.name},

A task assigned to you is due TODAY.

Task: ${task?.title}
Due Date: TODAY (${task?.deadline ? new Date(task.deadline).toLocaleDateString() : ''})
Current Status: ${task?.status?.replace('_', ' ')}
Project: ${project.name}

TAKE ACTION NOW: ${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}

This is a critical deadline notification.`
        };

      case 'overdue':
        const daysOverdue = task?.deadline ? Math.ceil((new Date().getTime() - new Date(task.deadline).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          subject: `🔴 OVERDUE: ${task?.title} - ${daysOverdue} days past deadline`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header" style="background: linear-gradient(135deg, #dc3545 0%, #721c24 100%);">
                <h2>🔴 OVERDUE TASK</h2>
                <p>Immediate Action Required</p>
              </div>
              <div class="content">
                <p>Hello ${recipient.name},</p>
                <p class="urgent" style="font-size: 18px; background: #f8d7da; padding: 15px; border-radius: 4px;">
                  This task is now ${daysOverdue} days overdue and requires immediate attention.
                </p>
                
                <div class="task-card" style="border-left-color: #dc3545; background: #fff5f5;">
                  <h3>${task?.title}</h3>
                  <p class="urgent" style="font-size: 16px;"><strong>🔴 ${daysOverdue} DAYS OVERDUE</strong></p>
                  <p><strong>Original Due Date:</strong> ${task?.deadline ? new Date(task.deadline).toLocaleDateString() : 'Not set'}</p>
                  <p><strong>Current Status:</strong> <span class="status-badge status-${task?.status}">${task?.status?.replace('_', ' ')}</span></p>
                  ${task?.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
                </div>

                <div class="project-info">
                  <h4>📋 Project: ${project.name}</h4>
                  ${project.ddExpirationDate ? `<p><strong>DD Expires:</strong> ${new Date(project.ddExpirationDate).toLocaleDateString()}</p>` : ''}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}" class="action-button" style="background: #dc3545; font-size: 16px;">URGENT: UPDATE STATUS</a>
                </div>
              </div>
              <div class="footer">
                <p><strong>This task is critically overdue and may impact project deadlines.</strong></p>
              </div>
            </div>
          `,
          text: `🔴 OVERDUE: ${task?.title} - ${daysOverdue} days past deadline

Hello ${recipient.name},

This task is now ${daysOverdue} days overdue and requires immediate attention.

Task: ${task?.title}
Original Due Date: ${task?.deadline ? new Date(task.deadline).toLocaleDateString() : 'Not set'}
Current Status: ${task?.status?.replace('_', ' ')}
Project: ${project.name}

URGENT ACTION REQUIRED: ${process.env.APP_URL || 'http://localhost:5000'}/project/${project.id}

This task is critically overdue and may impact project deadlines.`
        };

      default:
        throw new Error(`Unknown email template type: ${type}`);
    }
  }

  /**
   * Send notification email using SendGrid
   */
  async sendNotification(
    type: 'task_status' | 'note_added' | 'deadline_upcoming' | 'deadline_today' | 'overdue',
    context: NotificationContext,
    leadOffsetDays: number = 0
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Check if SendGrid is configured
      if (!process.env.SENDGRID_API_KEY) {
        return { success: false, error: 'SendGrid not configured' };
      }

      // Check for duplicate notification
      if (context.task) {
        const isDuplicate = await storage.checkNotificationExists(
          context.project.id,
          context.task.id,
          type,
          'email',
          'user', // Assuming user recipient for now
          context.recipient.email, // Using email as recipient ID for now
          leadOffsetDays
        );

        if (isDuplicate) {
          return { success: false, error: 'Duplicate notification' };
        }
      }

      // Generate email content
      const template = this.generateEmailTemplate(type, context);

      // Send email via SendGrid
      const message = {
        to: context.recipient.email,
        from: {
          email: this.defaultFromEmail,
          name: this.defaultFromName,
        },
        subject: template.subject,
        text: template.text,
        html: template.html,
        // Add tracking and analytics
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
        customArgs: {
          projectId: context.project.id,
          taskId: context.task?.id || '',
          notificationType: type,
        },
      };

      const response = await sgMail.send(message);
      const messageId = response[0]?.headers?.['x-message-id'] || 'unknown';

      // Log successful notification
      if (context.task) {
        await storage.createNotificationLog({
          projectId: context.project.id,
          taskId: context.task.id,
          event: type as any,
          channel: 'email',
          recipientType: 'user', // TODO: Determine based on context
          recipientId: context.recipient.email, // TODO: Use proper recipient ID
          recipientEmail: context.recipient.email,
          leadOffsetDays,
          scheduledFor: new Date(),
          sentAt: new Date(),
          providerMessageId: messageId,
          status: 'sent',
          metadata: { sendgridResponse: response },
        });
      }

      return { success: true, messageId };

    } catch (error) {
      console.error('SendGrid notification error:', error);
      
      // Log failed notification
      if (context.task) {
        await storage.createNotificationLog({
          projectId: context.project.id,
          taskId: context.task.id,
          event: type as any,
          channel: 'email',
          recipientType: 'user',
          recipientId: context.recipient.email,
          recipientEmail: context.recipient.email,
          leadOffsetDays,
          scheduledFor: new Date(),
          status: 'failed',
          metadata: { error: error instanceof Error ? error.message : String(error) },
        });
      }

      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Send task status change notification
   */
  async notifyTaskStatusChange(
    taskId: string,
    previousStatus: string,
    newStatus: string,
    triggeredByUserId: string
  ): Promise<void> {
    try {
      const task = await storage.getTask(taskId);
      if (!task) return;

      const project = await storage.getProject(task.projectId);
      if (!project) return;

      const triggerUser = await storage.getUser(triggeredByUserId);
      
      // Get notification subscriptions for this task/project
      const subscriptions = await storage.getSubscriptionsByTask(taskId);
      const projectSubscriptions = await storage.getSubscriptionsByProject(task.projectId);
      
      const allSubscriptions = [...subscriptions, ...projectSubscriptions.filter(s => !s.taskId)];
      const relevantSubscriptions = allSubscriptions.filter(s => 
        s.active && s.channels.includes('email') && s.events.includes('task_status')
      );

      // Send notification to each subscriber
      for (const subscription of relevantSubscriptions) {
        const recipient = await resolveRecipient(
          db,
          subscription.recipientType,
          subscription.recipientId,
          project.orgId
        );

        if (recipient) {
          await this.sendNotification('task_status', {
            project,
            task,
            recipient: {
              email: recipient.email,
              name: recipient.name,
              timezone: recipient.timezone || project.tz,
            },
            triggerUser: triggerUser ? {
              name: triggerUser.name,
              email: triggerUser.email,
            } : undefined,
            previousStatus,
            newStatus,
          });
        }
      }
    } catch (error) {
      console.error('Error sending task status change notifications:', error);
    }
  }

  /**
   * Send note added notification
   */
  async notifyNoteAdded(
    taskId: string,
    noteContent: string,
    authorUserId: string
  ): Promise<void> {
    try {
      const task = await storage.getTask(taskId);
      if (!task) return;

      const project = await storage.getProject(task.projectId);
      if (!project) return;

      const author = await storage.getUser(authorUserId);
      
      // Get relevant subscriptions
      const subscriptions = await storage.getSubscriptionsByTask(taskId);
      const projectSubscriptions = await storage.getSubscriptionsByProject(task.projectId);
      
      const allSubscriptions = [...subscriptions, ...projectSubscriptions.filter(s => !s.taskId)];
      const relevantSubscriptions = allSubscriptions.filter(s => 
        s.active && s.channels.includes('email') && s.events.includes('note_added')
      );

      // Send notification to each subscriber
      for (const subscription of relevantSubscriptions) {
        const recipient = await resolveRecipient(
          db,
          subscription.recipientType,
          subscription.recipientId,
          project.orgId
        );

        if (recipient) {
          await this.sendNotification('note_added', {
            project,
            task,
            recipient: {
              email: recipient.email,
              name: recipient.name,
              timezone: recipient.timezone || project.tz,
            },
            triggerUser: author ? {
              name: author.name,
              email: author.email,
            } : undefined,
            note: noteContent,
          });
        }
      }
    } catch (error) {
      console.error('Error sending note added notifications:', error);
    }
  }

  /**
   * Monitor and send deadline notifications
   */
  async processDeadlineNotifications(): Promise<void> {
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Get all tasks with upcoming deadlines
      // Note: This would typically be more efficient with database queries
      // For now, we'll implement a basic version
      
      // TODO: Implement more sophisticated deadline monitoring
      // This would typically run as a scheduled job
      
    } catch (error) {
      console.error('Error processing deadline notifications:', error);
    }
  }

  /**
   * Test notification functionality
   */
  async sendTestNotification(
    recipientEmail: string, 
    templateType: string = 'task_status'
  ): Promise<boolean> {
    try {
      // Create a mock context for testing
      const mockContext: NotificationContext = {
        project: {
          id: 'test-project',
          name: 'Test Due Diligence Project',
          description: 'A comprehensive test project for notification system validation',
          orgId: 'test-org',
          createdBy: 'test-user',
          createdAt: new Date(),
          anchorType: 'psa',
          psaSignedDate: '2025-08-01',
          ddExpirationDate: '2025-10-01',
          closingDate: '2025-11-01',
          ddPeriodDays: 60,
          hasExtensions: false,
          extensionCount: 0,
          extensionDays: [],
          daysToClosing: 30,
          seller: [],
          ourAttorney: [],
          titleInsuranceCompany: 'Test Title Insurance Co.',
          lender: 'Test Lender Bank',
          tz: 'America/New_York',
        } as Project,
        task: {
          id: 'test-task',
          projectId: 'test-project',
          title: 'Test Due Diligence Task',
          description: 'This is a test notification from your due diligence system',
          startStrategy: 'offset',
          startDate: null,
          startOffsetDays: 5,
          deadlineType: 'days_after_psa',
          deadlineDays: 30,
          deadline: '2025-09-25',
          assignee: 'Test Assignee',
          companyHired: null,
          repName: null,
          repEmail: null,
          repPhone: null,
          companyAddress: null,
          companySuite: null,
          companyCity: null,
          companyState: null,
          companyZip: null,
          priority: 'med',
          status: 'in_progress',
          dateEngaged: null,
          paymentStatus: 'not_paid',
          completedAt: null,
          dateOnSite: null,
          requiresOnSiteInspection: false,
          orderedAt: null,
          dependencies: [],
          baselineStart: null,
          baselineDue: null,
          manuallyLocked: false,
          cost: null,
          notes: null,
          showOnTimeline: true,
          sortOrder: null,
          taskOwner: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Task,
        recipient: {
          email: recipientEmail,
          name: 'Test Recipient',
          timezone: 'America/New_York',
        },
        triggerUser: {
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      const result = await this.sendNotification(templateType as any, mockContext);
      return result.success;
    } catch (error) {
      console.error('Test notification error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();