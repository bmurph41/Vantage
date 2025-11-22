import { storage } from "./storage";
import { resolveRecipient } from "@shared/recipient-utils";
import { db } from "./db";
import { type Task } from "@shared/schema";

/**
 * Helper service to manage automatic notification subscriptions for task assignees
 */
export class AssigneeSubscriptionManager {
  
  /**
   * Setup automatic notification subscriptions for a task assignee
   */
  async setupAssigneeSubscriptions(
    projectId: string,
    taskId: string,
    assigneeId: string,
    orgId: string
  ): Promise<void> {
    try {
      // Check if assignee is a user ID or email
      const recipient = await resolveRecipient(db, 'user', assigneeId, orgId);
      
      if (!recipient) {
        return;
      }

      // Check if subscription already exists for this task and recipient
      const existingSubscriptions = await storage.getSubscriptionsByTask(taskId);
      const hasExistingSubscription = existingSubscriptions.some(
        sub => sub.recipientType === 'user' && 
               sub.recipientId === assigneeId && 
               sub.active
      );

      if (hasExistingSubscription) {
        return;
      }

      // Create comprehensive subscription for the assignee
      await storage.createSubscription({
        projectId,
        taskId,
        recipientType: 'user',
        recipientId: assigneeId,
        channels: ['email'], // Default to email, can be expanded
        events: [
          'task_status',    // Task status changes
          'note_added',     // Note additions to the task
          'deadline_upcoming', // Deadline reminders
          'deadline_today', // Due today alerts
          'overdue'         // Overdue alerts
        ],
        leadTimesDays: [7, 3, 1, 0, -1], // Standard lead times for deadline notifications
        active: true,
      });

    } catch (error) {
      console.error(`Failed to setup assignee subscriptions for task ${taskId}:`, error);
      // Don't throw - subscription setup shouldn't block task operations
    }
  }

  /**
   * Handle assignee changes - remove old subscriptions and setup new ones
   */
  async handleAssigneeChange(
    projectId: string,
    taskId: string,
    oldAssigneeId: string | null,
    newAssigneeId: string | null,
    orgId: string
  ): Promise<void> {
    try {
      // Remove subscriptions for old assignee if they exist
      if (oldAssigneeId) {
        await this.removeAssigneeSubscriptions(taskId, oldAssigneeId);
      }

      // Setup subscriptions for new assignee if provided
      if (newAssigneeId) {
        await this.setupAssigneeSubscriptions(projectId, taskId, newAssigneeId, orgId);
      }

    } catch (error) {
      console.error(`Failed to handle assignee change for task ${taskId}:`, error);
      // Don't throw - subscription management shouldn't block task operations
    }
  }

  /**
   * Remove automatic subscriptions for a specific assignee on a task
   */
  async removeAssigneeSubscriptions(
    taskId: string,
    assigneeId: string
  ): Promise<void> {
    try {
      const subscriptions = await storage.getSubscriptionsByTask(taskId);
      
      // Find subscriptions for this specific assignee
      const assigneeSubscriptions = subscriptions.filter(
        sub => sub.recipientType === 'user' && 
               sub.recipientId === assigneeId && 
               sub.active
      );

      // Deactivate each subscription
      for (const subscription of assigneeSubscriptions) {
        await storage.updateSubscription(subscription.id, { active: false });
      }

      if (assigneeSubscriptions.length > 0) {
      }
    } catch (error) {
      console.error(`Failed to remove assignee subscriptions for task ${taskId}:`, error);
      // Don't throw - cleanup failures shouldn't block operations
    }
  }

  /**
   * Cleanup all assignee subscriptions for a task (called when task is deleted)
   */
  async cleanupTaskSubscriptions(taskId: string): Promise<void> {
    try {
      const subscriptions = await storage.getSubscriptionsByTask(taskId);
      
      // Deactivate all task-specific subscriptions
      for (const subscription of subscriptions) {
        await storage.deleteSubscription(subscription.id);
      }

      if (subscriptions.length > 0) {
      }
    } catch (error) {
      console.error(`Failed to cleanup subscriptions for task ${taskId}:`, error);
      // Don't throw - cleanup failures shouldn't block task deletion
    }
  }

  /**
   * Bulk setup subscriptions for multiple assignees (for bulk operations)
   */
  async bulkSetupAssigneeSubscriptions(
    projectId: string,
    taskAssignments: Array<{ taskId: string; assigneeId: string }>,
    orgId: string
  ): Promise<void> {
    try {
      for (const assignment of taskAssignments) {
        await this.setupAssigneeSubscriptions(
          projectId,
          assignment.taskId,
          assignment.assigneeId,
          orgId
        );
      }
      
    } catch (error) {
      console.error('Failed to bulk setup assignee subscriptions:', error);
      // Don't throw - subscription setup shouldn't block bulk operations
    }
  }

  /**
   * Validate and normalize assignee ID (handle email or user ID)
   */
  async validateAssigneeId(assigneeId: string, orgId: string): Promise<string | null> {
    try {
      // Try to resolve as user first
      const recipient = await resolveRecipient(db, 'user', assigneeId, orgId);
      return recipient ? assigneeId : null;
    } catch (error) {
      console.error(`Failed to validate assignee ID ${assigneeId}:`, error);
      return null;
    }
  }

  /**
   * Get assignee subscriptions summary for a task
   */
  async getAssigneeSubscriptionSummary(taskId: string): Promise<{
    assigneeCount: number;
    activeSubscriptions: number;
    subscriptionEvents: string[];
  }> {
    try {
      const subscriptions = await storage.getSubscriptionsByTask(taskId);
      const activeSubscriptions = subscriptions.filter(sub => sub.active);
      
      // Extract unique events across all subscriptions
      const allEvents = activeSubscriptions.flatMap(sub => sub.events);
      const uniqueEvents = Array.from(new Set(allEvents));

      return {
        assigneeCount: activeSubscriptions.length,
        activeSubscriptions: activeSubscriptions.length,
        subscriptionEvents: uniqueEvents,
      };
    } catch (error) {
      console.error(`Failed to get subscription summary for task ${taskId}:`, error);
      return {
        assigneeCount: 0,
        activeSubscriptions: 0,
        subscriptionEvents: [],
      };
    }
  }
}

// Export singleton instance
export const assigneeSubscriptionManager = new AssigneeSubscriptionManager();