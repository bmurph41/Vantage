import { storage } from './storage';
import { notificationService } from './notification-service';
import { resolveRecipient } from '@shared/recipient-utils';
import { db } from './db';
import { type Task, type Project } from '@shared/schema';
import { differenceInCalendarDays, startOfDay, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface DeadlineAlert {
  task: Task;
  project: Project;
  daysUntilDeadline: number;
  alertType: 'upcoming' | 'today' | 'overdue';
  leadOffsetDays: number;
}

export class DeadlineMonitor {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the deadline monitoring service
   * Checks for deadlines every hour during business hours
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Deadline monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting deadline monitoring service...');

    // Run initial check
    this.checkDeadlines().catch(error => {
      console.error('Initial deadline check failed:', error);
    });

    // Schedule periodic checks every hour
    this.intervalId = setInterval(() => {
      this.checkDeadlines().catch(error => {
        console.error('Scheduled deadline check failed:', error);
      });
    }, 60 * 60 * 1000); // 1 hour

    console.log('✅ Deadline monitoring service started');
  }

  /**
   * Stop the deadline monitoring service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('⏹️ Deadline monitoring service stopped');
  }

  /**
   * Get current status of the deadline monitor
   */
  getStatus(): { running: boolean; lastCheck?: Date } {
    return {
      running: this.isRunning,
      lastCheck: new Date(), // In a real implementation, we'd track this
    };
  }

  /**
   * Main deadline checking logic
   */
  private async checkDeadlines(): Promise<void> {
    try {
      console.log('🔍 Checking deadlines...', new Date().toISOString());

      // Get all active projects (in a real implementation, this would be paginated)
      const projects = await this.getAllActiveProjects();
      
      const deadlineAlerts: DeadlineAlert[] = [];

      for (const project of projects) {
        const projectAlerts = await this.checkProjectDeadlines(project);
        deadlineAlerts.push(...projectAlerts);
      }

      console.log(`📧 Found ${deadlineAlerts.length} deadline alerts to process`);

      // Process deadline alerts
      for (const alert of deadlineAlerts) {
        await this.processDeadlineAlert(alert);
      }

      console.log('✅ Deadline check completed');
    } catch (error) {
      console.error('❌ Deadline check failed:', error);
    }
  }

  /**
   * Get all active projects
   * In a production system, this would include pagination and filtering
   */
  private async getAllActiveProjects(): Promise<Project[]> {
    try {
      // Get all projects that have active tasks with deadlines
      const activeProjects = await storage.getAllActiveProjects();
      console.log(`📊 Found ${activeProjects.length} active projects for deadline monitoring`);
      return activeProjects;
    } catch (error) {
      console.error('Failed to get active projects:', error);
      return [];
    }
  }

  /**
   * Check deadlines for a specific project
   */
  private async checkProjectDeadlines(project: Project): Promise<DeadlineAlert[]> {
    const alerts: DeadlineAlert[] = [];

    try {
      // Get all tasks for this project
      const tasks = await storage.getTasksForProject(project.id);
      
      // Use project timezone for accurate calendar-day calculations
      const timezone = project.tz || 'America/New_York';
      const nowInTz = toZonedTime(new Date(), timezone);
      const todayInTz = startOfDay(nowInTz);

      for (const task of tasks) {
        // Skip completed tasks or tasks without deadlines
        if (task.status === 'completed' || !task.deadline) {
          continue;
        }

        // Parse deadline and convert to project timezone
        const deadlineDate = typeof task.deadline === 'string' ? parseISO(task.deadline) : new Date(task.deadline);
        const deadlineInTz = toZonedTime(deadlineDate, timezone);
        const deadlineDayInTz = startOfDay(deadlineInTz);
        
        // Calculate calendar days difference (positive = future, negative = past, 0 = today)
        const daysUntilDeadline = differenceInCalendarDays(deadlineDayInTz, todayInTz);

        // Check different notification thresholds
        const notificationThresholds = [7, 3, 1, 0, -1, -3, -7]; // 7 days before to 7 days after

        for (const threshold of notificationThresholds) {
          if (this.shouldSendNotification(daysUntilDeadline, threshold, nowInTz, timezone)) {
            const alertType = this.getAlertType(daysUntilDeadline);
            
            alerts.push({
              task,
              project,
              daysUntilDeadline,
              alertType,
              leadOffsetDays: threshold,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to check deadlines for project ${project.id}:`, error);
    }

    return alerts;
  }

  /**
   * Determine if a notification should be sent based on days until deadline
   * Uses calendar-day-based threshold detection to avoid hour sensitivity
   */
  private shouldSendNotification(daysUntilDeadline: number, threshold: number, nowInTz: Date, timezone: string): boolean {
    // Use calendar day matching instead of exact equality for robustness
    // This ensures notifications fire correctly regardless of job execution time
    
    // Special handling for "today" notifications (threshold 0)
    if (threshold === 0) {
      // Send "today" notifications if deadline is today (daysUntilDeadline === 0)
      // and we're during reasonable business hours to avoid midnight alerts
      const currentHour = nowInTz.getHours();
      return daysUntilDeadline === 0 && currentHour >= 6 && currentHour <= 22;
    }
    
    // For other thresholds, use exact calendar day matching
    // This works correctly because we're using startOfDay calculations
    return daysUntilDeadline === threshold;
  }

  /**
   * Get the alert type based on days until deadline
   */
  private getAlertType(daysUntilDeadline: number): 'upcoming' | 'today' | 'overdue' {
    if (daysUntilDeadline < 0) {
      return 'overdue';
    } else if (daysUntilDeadline === 0) {
      return 'today';
    } else {
      return 'upcoming';
    }
  }

  /**
   * Process a single deadline alert
   */
  private async processDeadlineAlert(alert: DeadlineAlert): Promise<void> {
    try {
      const { task, project, alertType, leadOffsetDays } = alert;

      // Get notification subscriptions for this task
      const taskSubscriptions = await storage.getSubscriptionsByTask(task.id);
      const projectSubscriptions = await storage.getSubscriptionsByProject(project.id);

      // Combine subscriptions, prioritizing task-specific ones
      const allSubscriptions = [
        ...taskSubscriptions,
        ...projectSubscriptions.filter(ps => !taskSubscriptions.some(ts => 
          ts.recipientType === ps.recipientType && ts.recipientId === ps.recipientId
        ))
      ];

      // Filter for relevant subscriptions
      const relevantEvent = alertType === 'upcoming' ? 'deadline_upcoming' :
                           alertType === 'today' ? 'deadline_today' : 'overdue';

      const relevantSubscriptions = allSubscriptions.filter(subscription => 
        subscription.active &&
        subscription.channels.includes('email') &&
        subscription.events.includes(relevantEvent as any) &&
        subscription.leadTimesDays.includes(leadOffsetDays)
      );

      console.log(`📬 Processing ${relevantSubscriptions.length} subscription(s) for task: ${task.title}`);

      // Send notifications to each subscriber
      for (const subscription of relevantSubscriptions) {
        await this.sendDeadlineNotification(alert, subscription);
      }
    } catch (error) {
      console.error(`Failed to process deadline alert for task ${alert.task.id}:`, error);
    }
  }

  /**
   * Send deadline notification to a specific subscriber
   */
  private async sendDeadlineNotification(
    alert: DeadlineAlert,
    subscription: any
  ): Promise<void> {
    try {
      const { task, project, alertType, leadOffsetDays } = alert;

      // Resolve recipient
      const recipient = await resolveRecipient(
        db,
        subscription.recipientType,
        subscription.recipientId,
        project.orgId
      );

      if (!recipient) {
        console.warn(`Could not resolve recipient: ${subscription.recipientType}:${subscription.recipientId}`);
        return;
      }

      // Check if this notification was already sent
      const isDuplicate = await storage.checkNotificationExists(
        project.id,
        task.id,
        alertType === 'upcoming' ? 'deadline_upcoming' :
        alertType === 'today' ? 'deadline_today' : 'overdue',
        'email',
        subscription.recipientType,
        subscription.recipientId,
        leadOffsetDays
      );

      if (isDuplicate) {
        console.log(`⏭️  Skipping duplicate notification: ${alertType} for ${recipient.email}`);
        return;
      }

      // Check quiet hours and weekend preferences
      if (await this.isQuietTime(project, recipient)) {
        console.log(`🔇 Skipping notification due to quiet hours: ${recipient.email}`);
        return;
      }

      // Send notification
      const notificationType = alertType === 'upcoming' ? 'deadline_upcoming' :
                              alertType === 'today' ? 'deadline_today' : 'overdue';

      const result = await notificationService.sendNotification(
        notificationType as any,
        {
          project,
          task,
          recipient: {
            email: recipient.email,
            name: recipient.name,
            timezone: recipient.timezone || project.tz,
          },
        },
        leadOffsetDays
      );

      if (result.success) {
        console.log(`✅ Sent ${alertType} notification to ${recipient.email} for task: ${task.title}`);
      } else {
        console.error(`❌ Failed to send ${alertType} notification to ${recipient.email}:`, result.error);
      }
    } catch (error) {
      console.error('Failed to send deadline notification:', error);
    }
  }

  /**
   * Check if current time is within quiet hours for a project/recipient
   */
  private async isQuietTime(project: Project, recipient: any): Promise<boolean> {
    try {
      const settings = await storage.getProjectSettings(project.id);
      if (!settings) return false;

      // Use recipient timezone if available, fall back to project timezone
      const timezone = recipient.timezone || project.tz || 'America/New_York';
      const nowInTz = toZonedTime(new Date(), timezone);
      const currentHour = nowInTz.getHours();
      
      // Parse quiet hours (format: "HH:MM")
      const quietStart = settings.quietHoursStart ? parseInt(settings.quietHoursStart.split(':')[0]) : 22;
      const quietEnd = settings.quietHoursEnd ? parseInt(settings.quietHoursEnd.split(':')[0]) : 8;

      // Check if current time is within quiet hours
      if (quietStart > quietEnd) {
        // Quiet hours span midnight (e.g., 22:00 to 08:00)
        return currentHour >= quietStart || currentHour < quietEnd;
      } else {
        // Quiet hours within same day
        return currentHour >= quietStart && currentHour < quietEnd;
      }
    } catch (error) {
      console.error('Failed to check quiet time:', error);
      return false; // Default to sending notifications if we can't determine quiet hours
    }
  }

  /**
   * Manual trigger for deadline checks (useful for testing)
   */
  async triggerDeadlineCheck(): Promise<void> {
    console.log('🔧 Manual deadline check triggered');
    await this.checkDeadlines();
  }

  /**
   * Get upcoming deadlines for monitoring dashboard
   */
  async getUpcomingDeadlines(days: number = 7): Promise<Array<{
    task: Task;
    project: Project;
    daysUntilDeadline: number;
  }>> {
    const results: Array<{ task: Task; project: Project; daysUntilDeadline: number; }> = [];
    
    try {
      // This would be implemented with proper project querying in production
      const projects = await this.getAllActiveProjects();
      
      for (const project of projects) {
        const tasks = await storage.getTasksForProject(project.id);
        
        // Use project timezone for consistent calculations
        const timezone = project.tz || 'America/New_York';
        const nowInTz = toZonedTime(new Date(), timezone);
        const todayInTz = startOfDay(nowInTz);
        
        for (const task of tasks) {
          if (task.status === 'completed' || !task.deadline) continue;

          // Parse deadline and convert to project timezone
          const deadlineDate = typeof task.deadline === 'string' ? parseISO(task.deadline) : new Date(task.deadline);
          const deadlineInTz = toZonedTime(deadlineDate, timezone);
          const deadlineDayInTz = startOfDay(deadlineInTz);
          
          // Calculate calendar days difference using timezone-aware dates
          const daysUntilDeadline = differenceInCalendarDays(deadlineDayInTz, todayInTz);

          if (daysUntilDeadline <= days && daysUntilDeadline >= -7) {
            results.push({
              task,
              project,
              daysUntilDeadline,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to get upcoming deadlines:', error);
    }

    return results.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
  }
}

// Export singleton instance
export const deadlineMonitor = new DeadlineMonitor();

// Auto-start the deadline monitor in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_DEADLINE_MONITOR === 'true') {
  // Delay startup to allow other services to initialize
  setTimeout(() => {
    deadlineMonitor.start();
  }, 5000); // 5 second delay
}