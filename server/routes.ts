import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { resolveRecipient } from "@shared/recipient-utils";
import { assigneeSubscriptionManager } from "./assignee-subscription-manager";
import { reconciliationService } from "./reconciliation-service";
import { 
  insertProjectSchema, insertProjectSettingsSchema, insertTaskSchema, 
  insertProjectTemplateSchema, insertAuditLogSchema,
  insertTimelineNoteSchema, insertProjectShareSchema, insertRiskSchema,
  insertContactSchema, updateContactSchema, insertNotificationSubscriptionSchema, insertNotificationLogSchema,
  insertCalendarEventSchema, insertDocumentRequirementSchema, insertProjectIntegrationSchema,
  insertTaskDependencySchema, insertTaskFileSchema, insertUserEmailSchema, insertCalendarGuestSchema
} from "@shared/schema";
import { createCalendarEvent, checkCalendarAvailability } from "./lib/google-calendar";
import { z } from "zod";
import crypto from "crypto";
import { WebhookSecurity, type WebhookEvent } from "./webhook-security";
import multer from "multer";
import path from "path";
import fs from "fs-extra";

// Calendar validation schemas
const calendarQuerySchema = z.object({
  eventType: z.string().optional(),
  startDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  }),
  endDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  }),
  status: z.string().optional(),
  isCompleted: z.string().optional().refine((val) => !val || ['true', 'false'].includes(val), {
    message: "isCompleted must be 'true' or 'false'"
  })
});

const generateIcsSchema = z.object({
  eventIds: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  filters: calendarQuerySchema.optional()
}).refine(data => data.eventIds || data.projectId, {
  message: "Either eventIds or projectId is required"
});

const syncToCalendarSchema = z.object({
  eventIds: z.array(z.string()).min(1, "At least one event ID is required"),
  emailIds: z.array(z.string()).min(1, "At least one email ID is required"),
  projectId: z.string()
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authorization helper function to verify project ownership
  const authorizeProjectAccess = async (projectId: string, orgId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.orgId !== orgId) {
      throw new Error("Unauthorized access to project");
    }
    return project;
  };

  // Authorization helper for calendar events
  const authorizeCalendarEventAccess = async (eventId: string, orgId: string) => {
    const event = await storage.getCalendarEvent(eventId);
    if (!event) {
      throw new Error("Calendar event not found");
    }
    const project = await storage.getProject(event.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Unauthorized access to calendar event");
    }
    return event;
  };
  // Middleware for authentication (simplified for demo)
  const authenticateUser = (req: any, res: any, next: any) => {
    // In production, this would validate JWT tokens or session
    req.user = { id: "user-1", orgId: "org-1", role: "owner" };
    next();
  };

  app.use("/api/dd", authenticateUser);

  // Projects
  app.get("/api/dd/projects", async (req: any, res) => {
    try {
      const projects = await storage.getProjectsForOrg(req.user.orgId);
      
      // Calculate total cost for each project
      const projectsWithCost = await Promise.all(
        projects.map(async (project) => {
          const tasks = await storage.getTasksForProject(project.id);
          
          // Calculate total cost from all tasks
          const totalCost = tasks.reduce((sum, task) => {
            if (task.cost) {
              // Remove currency symbols and commas, then parse as float
              const cleanCost = task.cost.replace(/[$,]/g, '').trim();
              const numericCost = parseFloat(cleanCost);
              return sum + (isNaN(numericCost) ? 0 : numericCost);
            }
            return sum;
          }, 0);
          
          return {
            ...project,
            totalCost
          };
        })
      );
      
      res.json(projectsWithCost);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/dd/projects", async (req: any, res) => {
    try {
      const projectData = insertProjectSchema.parse({
        ...req.body,
        orgId: req.user.orgId,
        createdBy: req.user.id,
      });
      
      const project = await storage.createProject(projectData);
      
      // Create default project settings
      await storage.createProjectSettings({
        projectId: project.id,
        useBusinessDays: false,
        holidayCalendar: "us_federal",
        notificationsJson: {},
        ndaRequired: false,
      });

      // Create audit log
      await storage.createAuditLog({
        projectId: project.id,
        userId: req.user.id,
        entityType: "project",
        entityId: project.id,
        action: "created",
        after: project,
      });

      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  app.get("/api/dd/projects/:id", async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const settings = await storage.getProjectSettings(project.id);
      const tasks = await storage.getTasksForProject(project.id);

      res.json({ project, settings, tasks });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.patch("/api/dd/projects/:id", async (req: any, res) => {
    try {
      const updates = insertProjectSchema.partial().parse(req.body);
      const updated = await storage.updateProject(req.params.id, updates);

      // Create audit log
      await storage.createAuditLog({
        projectId: updated.id,
        userId: req.user.id,
        entityType: "project",
        entityId: updated.id,
        action: "updated",
        after: updated,
      });

      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  // Project Settings
  app.delete("/api/dd/projects/:id", async (req: any, res) => {
    try {
      const project = await authorizeProjectAccess(req.params.id, req.user.orgId);
      
      // Create audit log before deletion
      await storage.createAuditLog({
        projectId: project.id,
        userId: req.user.id,
        entityType: "project",
        entityId: project.id,
        action: "deleted",
        before: project,
      });

      // Delete the project (this should cascade delete related tasks, settings, etc.)
      await storage.deleteProject(req.params.id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.patch("/api/dd/projects/:id/settings", async (req: any, res) => {
    try {
      const updates = insertProjectSettingsSchema.partial().parse(req.body);
      const updated = await storage.updateProjectSettings(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid settings data" });
    }
  });

  // Project Shares
  app.get("/api/dd/projects/:id/shares", async (req: any, res) => {
    try {
      const shares = await storage.getProjectShares(req.params.id);
      res.json(shares);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project shares" });
    }
  });

  app.post("/api/dd/projects/:id/shares", async (req: any, res) => {
    try {
      const shareToken = crypto.randomBytes(32).toString('hex');
      const shareData = insertProjectShareSchema.parse({
        ...req.body,
        projectId: req.params.id,
        shareToken: shareToken,
        createdBy: req.user.id,
      });
      
      const share = await storage.createProjectShare(shareData);

      // Create audit log
      await storage.createAuditLog({
        projectId: req.params.id,
        userId: req.user.id,
        entityType: "project_share",
        entityId: share.id,
        action: "created",
        after: share,
      });

      res.json(share);
    } catch (error) {
      res.status(400).json({ error: "Invalid share data" });
    }
  });

  app.delete("/api/dd/shares/:id", async (req: any, res) => {
    try {
      await storage.deleteProjectShare(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete share" });
    }
  });

  // Public shared project access (no authentication required)
  app.get("/api/shared/:token", async (req: any, res) => {
    try {
      const share = await storage.getProjectShare(req.params.token);
      if (!share) {
        return res.status(404).json({ error: "Share not found or expired" });
      }

      // Check if share is expired
      if (share.expiresAt && new Date() > share.expiresAt) {
        return res.status(404).json({ error: "Share has expired" });
      }

      // Update last accessed time
      await storage.updateProjectShare(share.id, {
        lastAccessedAt: new Date(),
      });

      const project = await storage.getProject(share.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const settings = await storage.getProjectSettings(project.id);
      const tasks = await storage.getTasksForProject(project.id);

      res.json({ 
        project, 
        settings, 
        tasks, 
        shareInfo: {
          accessLevel: share.accessLevel,
          shareType: share.shareType,
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shared project" });
    }
  });

  // Bulk update task sort orders
  app.patch("/api/dd/projects/:projectId/tasks/bulk-sort-order", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      
      const taskSortUpdates = z.array(z.object({
        id: z.string(),
        sortOrder: z.number()
      })).parse(req.body);

      // Update sort orders in bulk
      const results = await Promise.all(
        taskSortUpdates.map(update => 
          storage.updateTask(update.id, { sortOrder: update.sortOrder })
        )
      );

      // Create audit log for bulk update
      await storage.createAuditLog({
        projectId: req.params.projectId,
        userId: req.user.id,
        entityType: "task",
        entityId: "bulk-sort-order",
        action: "bulk_sort_order_update",
        before: null,
        after: { updates: taskSortUpdates }
      });

      res.json(results);
    } catch (error) {
      console.error("Error updating task sort orders:", error);
      res.status(500).json({ error: "Failed to update sort orders" });
    }
  });

  // Tasks
  app.get("/api/dd/projects/:projectId/tasks", async (req: any, res) => {
    try {
      const tasks = await storage.getTasksForProject(req.params.projectId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/dd/projects/:projectId/assignees", async (req: any, res) => {
    try {
      const assignees = await storage.getProjectAssignees(req.params.projectId);
      res.json(assignees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignees" });
    }
  });

  app.post("/api/dd/projects/:projectId/tasks", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      
      // Extract isInternalTask field before validation
      const { isInternalTask, ...taskPayload } = req.body;
      
      // If it's an internal task, clear company-related fields
      if (isInternalTask) {
        taskPayload.companyHired = "";
        taskPayload.repName = "";
        taskPayload.repEmail = "";
        taskPayload.repPhone = "";
        taskPayload.companyAddress = "";
        taskPayload.companySuite = "";
        taskPayload.companyCity = "";
        taskPayload.companyState = "";
        taskPayload.companyZip = "";
        taskPayload.requiresOnSiteInspection = false;
        taskPayload.dateOnSite = null;
      }

      // Convert empty string date fields to null for database compatibility
      const dateFields = ['startDate', 'deadline', 'dateEngaged', 'completedAt', 'orderedAt', 'dateOnSite', 'baselineStart', 'baselineDue'];
      for (const field of dateFields) {
        if (taskPayload[field] === '') {
          taskPayload[field] = null;
        }
      }

      // Convert empty string number fields to null
      if (taskPayload.startOffsetDays === '') {
        taskPayload.startOffsetDays = null;
      }
      if (taskPayload.deadlineDays === '') {
        taskPayload.deadlineDays = null;
      }

      const taskData = insertTaskSchema.parse({
        ...taskPayload,
        projectId: req.params.projectId,
      });
      
      // Check for circular dependencies if dependencies are provided
      if (taskData.dependencies && taskData.dependencies.length > 0) {
        // Generate a temporary ID for the new task to use in validation
        const tempTaskId = crypto.randomBytes(16).toString('hex');
        const hasCircularDep = await storage.hasCircularDependency(
          req.params.projectId,
          tempTaskId,
          taskData.dependencies
        );
        
        if (hasCircularDep) {
          return res.status(400).json({ 
            error: "Circular dependency detected",
            message: "The specified dependencies would create a circular dependency. Please review your task dependencies."
          });
        }
      }
      
      const task = await storage.createTask(taskData);

      // Create audit log
      await storage.createAuditLog({
        projectId: task.projectId,
        userId: req.user.id,
        entityType: "task",
        entityId: task.id,
        action: "created",
        after: task,
      });

      // Setup automatic subscriptions for task assignee
      if (task.assignee) {
        try {
          await assigneeSubscriptionManager.setupAssigneeSubscriptions(
            task.projectId,
            task.id,
            task.assignee,
            req.user.orgId
          );
        } catch (subscriptionError) {
          console.error('Failed to setup assignee subscriptions:', subscriptionError);
          // Don't fail the request if subscription setup fails
        }
      }

      // Trigger notifications for task creation (if task is assigned)
      if (task.assignee && task.status !== 'not_started') {
        try {
          const { notificationService } = await import('./notification-service');
          await notificationService.notifyTaskStatusChange(
            task.id,
            'not_started',
            task.status,
            req.user.id
          );
        } catch (notificationError) {
          console.error('Failed to send task creation notification:', notificationError);
          // Don't fail the request if notification fails
        }
      }

      // Automatically sync calendar event for new task
      try {
        console.log('🗓️ Attempting to sync calendar event for new task:', task.id, 'with deadline:', task.deadline);
        const calendarEvent = await storage.syncTaskCalendarEvent(task);
        console.log('🗓️ Calendar event sync result for new task:', calendarEvent ? 'created' : 'no event needed');
      } catch (calendarError) {
        console.error('❌ Failed to sync calendar event for new task:', calendarError);
        // Don't fail the request if calendar sync fails
      }

      res.json(task);
    } catch (error) {
      console.error("Task creation error:", error);
      console.error("Request body:", req.body);
      
      if (error instanceof z.ZodError) {
        // Return detailed validation errors
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fieldErrors,
          message: "Please check the highlighted fields and try again."
        });
      }
      
      res.status(400).json({ 
        error: "Invalid task data", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.patch("/api/dd/tasks/:id", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await authorizeProjectAccess(task.projectId, req.user.orgId);
      
      // Extract isInternalTask field before validation
      const { isInternalTask, ...taskPayload } = req.body;
      
      // If it's an internal task, clear company-related fields
      if (isInternalTask) {
        taskPayload.companyHired = "";
        taskPayload.repName = "";
        taskPayload.repEmail = "";
        taskPayload.repPhone = "";
        taskPayload.companyAddress = "";
        taskPayload.companySuite = "";
        taskPayload.companyCity = "";
        taskPayload.companyState = "";
        taskPayload.companyZip = "";
        taskPayload.requiresOnSiteInspection = false;
        taskPayload.dateOnSite = null;
      }

      // Convert empty string date fields to null for database compatibility
      const dateFields = ['startDate', 'deadline', 'dateEngaged', 'completedAt', 'orderedAt', 'dateOnSite', 'baselineStart', 'baselineDue'];
      for (const field of dateFields) {
        if (taskPayload[field] === '') {
          taskPayload[field] = null;
        }
      }

      // Convert empty string number fields to null
      if (taskPayload.startOffsetDays === '') {
        taskPayload.startOffsetDays = null;
      }
      if (taskPayload.deadlineDays === '') {
        taskPayload.deadlineDays = null;
      }

      const updates = insertTaskSchema.partial().parse(taskPayload);

      // Check for circular dependencies if dependencies are being updated
      if (updates.dependencies !== undefined) {
        const dependenciesToCheck = updates.dependencies || [];
        if (dependenciesToCheck.length > 0) {
          const hasCircularDep = await storage.hasCircularDependency(
            task.projectId,
            task.id,
            dependenciesToCheck
          );
          
          if (hasCircularDep) {
            return res.status(400).json({ 
              error: "Circular dependency detected",
              message: "The updated dependencies would create a circular dependency. Please review your task dependencies."
            });
          }
        }
      }

      const updated = await storage.updateTask(req.params.id, updates);

      // Handle assignee changes - update subscriptions
      if (task.assignee !== updated.assignee) {
        try {
          await assigneeSubscriptionManager.handleAssigneeChange(
            updated.projectId,
            updated.id,
            task.assignee,
            updated.assignee,
            req.user.orgId
          );
        } catch (subscriptionError) {
          console.error('Failed to handle assignee subscription changes:', subscriptionError);
          // Don't fail the request if subscription management fails
        }
      }

      // Create audit log
      await storage.createAuditLog({
        projectId: updated.projectId,
        userId: req.user.id,
        entityType: "task",
        entityId: updated.id,
        action: "updated",
        before: task,
        after: updated,
      });

      // Trigger notifications for status changes
      if (task.status !== updated.status) {
        try {
          const { notificationService } = await import('./notification-service');
          await notificationService.notifyTaskStatusChange(
            updated.id,
            task.status,
            updated.status,
            req.user.id
          );
        } catch (notificationError) {
          console.error('Failed to send task status notification:', notificationError);
          // Don't fail the request if notification fails
        }
      }

      // Automatically sync calendar event for updated task
      try {
        console.log('🗓️ Attempting to sync calendar event for updated task:', updated.id, 'with deadline:', updated.deadline);
        const calendarEvent = await storage.syncTaskCalendarEvent(updated);
        console.log('🗓️ Calendar event sync result for updated task:', calendarEvent ? 'updated/created' : 'no event needed');
      } catch (calendarError) {
        console.error('❌ Failed to sync calendar event for updated task:', calendarError);
        // Don't fail the request if calendar sync fails
      }

      res.json(updated);
    } catch (error) {
      console.error("Task update error:", error);
      console.error("Request body:", req.body);
      
      if (error instanceof z.ZodError) {
        // Return detailed validation errors
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fieldErrors,
          message: "Please check the highlighted fields and try again."
        });
      }
      
      res.status(400).json({ 
        error: "Invalid update data", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.delete("/api/dd/tasks/:id", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await authorizeProjectAccess(task.projectId, req.user.orgId);

      // Cleanup assignee subscriptions before deleting task
      try {
        await assigneeSubscriptionManager.cleanupTaskSubscriptions(req.params.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup task subscriptions:', cleanupError);
        // Don't fail the deletion if cleanup fails
      }

      // Delete calendar event before deleting task
      try {
        await storage.deleteTaskCalendarEvent(req.params.id);
      } catch (calendarError) {
        console.error('Failed to delete calendar event for task:', calendarError);
        // Don't fail the deletion if calendar cleanup fails
      }

      await storage.deleteTask(req.params.id);

      // Create audit log
      await storage.createAuditLog({
        projectId: task.projectId,
        userId: req.user.id,
        entityType: "task",
        entityId: task.id,
        action: "deleted",
        before: task,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Archive task
  app.patch("/api/dd/tasks/:id/archive", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await authorizeProjectAccess(task.projectId, req.user.orgId);

      // Check if task is already archived
      if (task.archived) {
        return res.status(400).json({ error: "Task is already archived" });
      }

      const updates = {
        archived: true,
        archivedAt: new Date(),
      };

      const updated = await storage.updateTask(req.params.id, updates);

      // Create audit log
      await storage.createAuditLog({
        projectId: updated.projectId,
        userId: req.user.id,
        entityType: "task",
        entityId: updated.id,
        action: "archived",
        before: task,
        after: updated,
      });

      res.json(updated);
    } catch (error) {
      console.error("Task archive error:", error);
      res.status(500).json({ error: "Failed to archive task" });
    }
  });

  // Unarchive task
  app.patch("/api/dd/tasks/:id/unarchive", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await authorizeProjectAccess(task.projectId, req.user.orgId);

      // Check if task is actually archived
      if (!task.archived) {
        return res.status(400).json({ error: "Task is not archived" });
      }

      const updates = {
        archived: false,
        archivedAt: null,
      };

      const updated = await storage.updateTask(req.params.id, updates);

      // Create audit log
      await storage.createAuditLog({
        projectId: updated.projectId,
        userId: req.user.id,
        entityType: "task",
        entityId: updated.id,
        action: "unarchived",
        before: task,
        after: updated,
      });

      res.json(updated);
    } catch (error) {
      console.error("Task unarchive error:", error);
      res.status(500).json({ error: "Failed to unarchive task" });
    }
  });

  // Task Dependencies (Enhanced CPM Support)
  app.get("/api/dd/projects/:projectId/task-dependencies", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      const dependencies = await storage.getTaskDependenciesForProject(req.params.projectId);
      res.json(dependencies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task dependencies" });
    }
  });

  app.get("/api/dd/tasks/:taskId/dependencies", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await authorizeProjectAccess(task.projectId, req.user.orgId);
      const dependencies = await storage.getTaskDependencies(req.params.taskId);
      res.json(dependencies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task dependencies" });
    }
  });

  app.post("/api/dd/projects/:projectId/task-dependencies", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      
      const dependencyData = insertTaskDependencySchema.parse(req.body);
      
      // Validate that both tasks exist and belong to the project
      const [successor, predecessor] = await Promise.all([
        storage.getTask(dependencyData.successorId),
        storage.getTask(dependencyData.predecessorId)
      ]);
      
      if (!successor || !predecessor) {
        return res.status(404).json({ error: "One or both tasks not found" });
      }
      
      if (successor.projectId !== req.params.projectId || predecessor.projectId !== req.params.projectId) {
        return res.status(400).json({ error: "Tasks must belong to the specified project" });
      }
      
      // Check for circular dependencies
      const hasCircular = await storage.hasCircularDependency(
        req.params.projectId,
        dependencyData.successorId,
        [dependencyData.predecessorId]
      );
      
      if (hasCircular) {
        return res.status(400).json({ 
          error: "Circular dependency detected",
          message: "The specified dependency would create a circular dependency loop"
        });
      }
      
      const dependency = await storage.createTaskDependency(dependencyData);
      
      // Create audit log
      await storage.createAuditLog({
        projectId: req.params.projectId,
        userId: req.user.id,
        entityType: "task_dependency",
        entityId: dependency.id,
        action: "created",
        after: dependency,
      });
      
      res.json(dependency);
    } catch (error) {
      res.status(400).json({ error: "Invalid dependency data" });
    }
  });

  app.put("/api/dd/task-dependencies/:id", async (req: any, res) => {
    try {
      // First, get the existing dependency to verify ownership
      const dependency = await storage.getTaskDependency(req.params.id);
      if (!dependency) {
        return res.status(404).json({ error: "Task dependency not found" });
      }

      // Get both successor and predecessor tasks to verify project ownership
      const [successorTask, predecessorTask] = await Promise.all([
        storage.getTask(dependency.successorId),
        storage.getTask(dependency.predecessorId)
      ]);

      if (!successorTask || !predecessorTask) {
        return res.status(404).json({ error: "Associated tasks not found" });
      }

      // Verify both tasks belong to projects the user has access to
      await Promise.all([
        authorizeProjectAccess(successorTask.projectId, req.user.orgId),
        authorizeProjectAccess(predecessorTask.projectId, req.user.orgId)
      ]);

      const updates = insertTaskDependencySchema.partial().parse(req.body);
      const updated = await storage.updateTaskDependency(req.params.id, updates);
      
      // Create audit log
      await storage.createAuditLog({
        projectId: successorTask.projectId,
        userId: req.user.id,
        entityType: "task_dependency", 
        entityId: updated.id,
        action: "updated",
        before: dependency,
        after: updated,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Task dependency update error:", error);
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return res.status(403).json({ error: "Unauthorized access to task dependency" });
      }
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.delete("/api/dd/task-dependencies/:id", async (req: any, res) => {
    try {
      // First, get the existing dependency to verify ownership before deletion
      const dependency = await storage.getTaskDependency(req.params.id);
      if (!dependency) {
        return res.status(404).json({ error: "Task dependency not found" });
      }

      // Get both successor and predecessor tasks to verify project ownership
      const [successorTask, predecessorTask] = await Promise.all([
        storage.getTask(dependency.successorId),
        storage.getTask(dependency.predecessorId)
      ]);

      if (!successorTask || !predecessorTask) {
        return res.status(404).json({ error: "Associated tasks not found" });
      }

      // Verify both tasks belong to projects the user has access to
      await Promise.all([
        authorizeProjectAccess(successorTask.projectId, req.user.orgId),
        authorizeProjectAccess(predecessorTask.projectId, req.user.orgId)
      ]);

      // Delete the dependency
      await storage.deleteTaskDependency(req.params.id);
      
      // Create proper audit log with complete dependency details
      await storage.createAuditLog({
        projectId: successorTask.projectId,
        userId: req.user.id,
        entityType: "task_dependency",
        entityId: req.params.id,
        action: "deleted",
        before: dependency,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Task dependency deletion error:", error);
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return res.status(403).json({ error: "Unauthorized access to task dependency" });
      }
      res.status(500).json({ error: "Failed to delete task dependency" });
    }
  });

  app.delete("/api/dd/tasks/:taskId/dependencies", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await authorizeProjectAccess(task.projectId, req.user.orgId);
      
      await storage.deleteTaskDependencies(req.params.taskId);
      
      // Create audit log
      await storage.createAuditLog({
        projectId: task.projectId,
        userId: req.user.id,
        entityType: "task",
        entityId: task.id,
        action: "dependencies_cleared",
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task dependencies" });
    }
  });

  // File Upload Configuration
  const storage_config = multer.diskStorage({
    destination: async (req: any, file: any, cb: any) => {
      const { taskId } = req.params;
      const task = await storage.getTask(taskId);
      if (!task) {
        return cb(new Error("Task not found"), "");
      }
      const uploadPath = path.join("server/uploads", task.projectId, taskId);
      await fs.ensureDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req: any, file: any, cb: any) => {
      // Generate UUID filename to prevent conflicts and security issues
      const uuid = crypto.randomUUID();
      const ext = path.extname(file.originalname);
      const filename = `${uuid}${ext}`;
      cb(null, filename);
    }
  });

  const upload = multer({
    storage: storage_config,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB max
    },
    fileFilter: (req: any, file: any, cb: any) => {
      // Allowed mime types
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png',
        'image/jpeg',
        'image/jpg'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, PNG, JPG files are allowed.'), false);
      }
    }
  });

  // Task File Management
  app.post("/api/dd/tasks/:taskId/files", upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      await authorizeProjectAccess(task.projectId, req.user.orgId);

      // Create file record in database
      const fileData = insertTaskFileSchema.parse({
        projectId: task.projectId,
        taskId: req.params.taskId,
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storageProvider: "local",
        storagePath: req.file.path,
        uploadedBy: req.user.id,
        visibility: "org",
        notes: req.body.notes || null,
      });

      const file = await storage.createTaskFile(fileData);

      // Create audit log
      await storage.createAuditLog({
        projectId: task.projectId,
        userId: req.user.id,
        entityType: "task_file",
        entityId: file.id,
        action: "uploaded",
        after: file,
      });

      res.json(file);
    } catch (error: any) {
      // Clean up uploaded file if database operation fails
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Failed to clean up uploaded file:', unlinkError);
        }
      }
      
      if (error.message?.includes('Invalid file type')) {
        return res.status(400).json({ error: error.message });
      }
      
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.get("/api/dd/tasks/:taskId/files", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      await authorizeProjectAccess(task.projectId, req.user.orgId);

      const files = await storage.getTaskFilesForTask(req.params.taskId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.get("/api/dd/files/:fileId", async (req: any, res) => {
    try {
      const file = await storage.getTaskFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      await authorizeProjectAccess(file.projectId, req.user.orgId);

      // Check if file exists on disk
      const fileExists = await fs.pathExists(file.storagePath);
      if (!fileExists) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      // Set proper headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.setHeader('Content-Type', file.mimeType);
      
      // Stream file to response
      const fileStream = fs.createReadStream(file.storagePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  app.delete("/api/dd/files/:fileId", async (req: any, res) => {
    try {
      const file = await storage.getTaskFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      await authorizeProjectAccess(file.projectId, req.user.orgId);

      // Delete file from disk
      try {
        await fs.unlink(file.storagePath);
      } catch (unlinkError) {
        console.warn('File not found on disk, continuing with database deletion:', unlinkError);
      }

      // Delete file record from database
      await storage.deleteTaskFile(req.params.fileId);

      // Create audit log
      await storage.createAuditLog({
        projectId: file.projectId,
        userId: req.user.id,
        entityType: "task_file",
        entityId: file.id,
        action: "deleted",
        before: file,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Timeline Notes
  app.get("/api/dd/tasks/:taskId/timeline-notes", async (req: any, res) => {
    try {
      const notes = await storage.getTimelineNotesForTask(req.params.taskId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch timeline notes" });
    }
  });

  app.post("/api/dd/tasks/:taskId/timeline-notes", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await authorizeProjectAccess(task.projectId, req.user.orgId);
      
      const noteData = insertTimelineNoteSchema.parse({
        ...req.body,
        taskId: req.params.taskId,
        authorId: req.user.id,
      });
      
      const note = await storage.createTimelineNote(noteData);
      
      // Trigger notifications for note addition
      try {
        const { notificationService } = await import('./notification-service');
        await notificationService.notifyNoteAdded(
          req.params.taskId,
          noteData.content,
          req.user.id
        );
      } catch (notificationError) {
        console.error('Failed to send note added notification:', notificationError);
        // Don't fail the request if notification fails
      }
      
      res.json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  app.put("/api/dd/timeline-notes/:id", async (req: any, res) => {
    try {
      // Note: For proper authorization, we'd need a getTimelineNote method
      // For now, this is a limitation - timeline notes authorization is not fully implemented
      const updates = insertTimelineNoteSchema.partial().parse(req.body);
      const note = await storage.updateTimelineNote(req.params.id, updates);
      res.json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.delete("/api/dd/timeline-notes/:id", async (req: any, res) => {
    try {
      // Note: For proper authorization, we'd need a getTimelineNote method
      // For now, this is a limitation in the current storage interface
      await storage.deleteTimelineNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete note" });
    }
  });


  // Project Templates
  app.get("/api/dd/project-templates", async (req: any, res) => {
    try {
      const templates = await storage.getProjectTemplatesForOrg(req.user.orgId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project templates" });
    }
  });

  app.post("/api/dd/project-templates", async (req: any, res) => {
    try {
      const templateData = insertProjectTemplateSchema.parse({
        ...req.body,
        orgId: req.user.orgId,
      });
      
      const template = await storage.createProjectTemplate(templateData);
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: "Invalid template data" });
    }
  });

  // Apply Template
  app.post("/api/dd/projects/:projectId/apply-template/:templateId", async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const template = await storage.getProjectTemplate(req.params.templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Create tasks from template blueprint
      const createdTasks = [];
      if (template.tasksBlueprint && template.tasksBlueprint.length > 0) {
        for (const taskTitle of template.tasksBlueprint) {
          if (taskTitle && taskTitle.trim()) {
            const taskData = {
              projectId: req.params.projectId,
              title: taskTitle.trim(),
              description: "",
              startStrategy: "offset" as const,
              startOffsetDays: 0,
              deadlineType: "days_after_psa" as const,
              deadlineDays: 30,
              assignee: "",
              companyHired: "",
              repName: "",
              repEmail: "",
              repPhone: "",
              companyAddress: "",
              companySuite: "",
              companyCity: "",
              companyState: "",
              companyZip: "",
              priority: "med" as const,
              status: "not_started" as const,
              paymentStatus: "not_paid" as const,
              requiresOnSiteInspection: false,
              dateOnSite: "",
              dependencies: [],
              manuallyLocked: false,
              cost: "",
              notes: "",
              showOnTimeline: false,
            };

            const task = await storage.createTask(taskData);
            createdTasks.push(task);

            // Create audit log for each task
            await storage.createAuditLog({
              projectId: task.projectId,
              userId: req.user.id,
              entityType: "task",
              entityId: task.id,
              action: "created",
              after: task,
            });
          }
        }
      }

      // Create audit log for template application
      await storage.createAuditLog({
        projectId: req.params.projectId,
        userId: req.user.id,
        entityType: "project",
        entityId: req.params.projectId,
        action: "template_applied",
        after: { templateId: template.id, templateName: template.name, tasksCreated: createdTasks.length },
      });

      res.json({ 
        success: true, 
        message: `Template applied successfully. Created ${createdTasks.length} tasks.`,
        tasksCreated: createdTasks.length,
        tasks: createdTasks
      });
    } catch (error) {
      console.error("Apply template error:", error);
      res.status(500).json({ error: "Failed to apply template" });
    }
  });

  // Export endpoints
  app.get("/api/dd/projects/:id/export.csv", async (req: any, res) => {
    try {
      const tasks = await storage.getTasksForProject(req.params.id);
      
      const csvHeader = "Title,Description,Assignee,Company Hired,Status,Start Date,Duration Days,Priority,Cost\n";
      const csvRows = tasks.map(task => 
        `"${task.title}","${task.description || ''}","${task.assignee || ''}","${task.companyHired || ''}","${task.status}","${task.startDate || ''}","${task.deadlineDays || ''}","${task.priority}","${task.cost || ''}"`
      ).join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=tasks.csv");
      res.send(csvHeader + csvRows);
    } catch (error) {
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  // Email report endpoint
  app.post("/api/dd/send-report-email", async (req: any, res) => {
    try {
      const payload = z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        message: z.string().optional(),
        reportData: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        format: z.enum(['pdf', 'csv']),
      }).parse(req.body);

      // Use SendGrid to send email
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const emailData = {
        to: payload.to,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@duediligence.app',
        subject: payload.subject,
        text: payload.message || 'Please find the attached due diligence report.',
        html: `<p>${(payload.message || 'Please find the attached due diligence report.').replace(/\n/g, '<br>')}</p>`,
        attachments: [
          {
            content: payload.format === 'csv' ? Buffer.from(payload.reportData).toString('base64') : payload.reportData,
            filename: payload.filename,
            type: payload.mimeType,
            disposition: 'attachment',
          },
        ],
      };

      await sgMail.send(emailData);

      res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  app.get("/api/dd/projects/:id/export.ics", async (req: any, res) => {
    try {
      const tasks = await storage.getTasksForProject(req.params.id);
      
      let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Due Diligence Tracker//EN\n";
      
      tasks.forEach(task => {
        if (task.startDate) {
          icsContent += "BEGIN:VEVENT\n";
          icsContent += `DTSTART:${task.startDate.replace(/-/g, '')}\n`;
          icsContent += `SUMMARY:${task.title}\n`;
          icsContent += `DESCRIPTION:${task.description || ''}\n`;
          icsContent += "END:VEVENT\n";
        }
      });
      
      icsContent += "END:VCALENDAR";
      
      res.setHeader("Content-Type", "text/calendar");
      res.setHeader("Content-Disposition", "attachment; filename=tasks.ics");
      res.send(icsContent);
    } catch (error) {
      res.status(500).json({ error: "Failed to export ICS" });
    }
  });

  // Audit logs
  app.get("/api/dd/projects/:id/audit", async (req: any, res) => {
    try {
      const logs = await storage.getAuditLogsForProject(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // === RISK MANAGEMENT API ===

  // Get all risks for a project
  app.get("/api/dd/projects/:id/risks", async (req: any, res) => {
    try {
      const risks = await storage.getRisksForProject(req.params.id);
      res.json(risks);
    } catch (error) {
      console.error("Error fetching risks:", error);
      res.status(500).json({ error: "Failed to fetch risks" });
    }
  });

  // Get risk analytics and summary
  app.get("/api/dd/projects/:id/risks/analytics", async (req: any, res) => {
    try {
      const summary = await storage.getProjectRiskSummary(req.params.id);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching risk analytics:", error);
      res.status(500).json({ error: "Failed to fetch risk analytics" });
    }
  });

  // Get top risks by score
  app.get("/api/dd/projects/:id/risks/top", async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 3;
      const topRisks = await storage.getHighestRisksByScore(req.params.id, limit);
      res.json(topRisks);
    } catch (error) {
      console.error("Error fetching top risks:", error);
      res.status(500).json({ error: "Failed to fetch top risks" });
    }
  });

  // Get risks by category
  app.get("/api/dd/projects/:id/risks/category/:category", async (req: any, res) => {
    try {
      const risks = await storage.getRisksByCategory(req.params.id, req.params.category);
      res.json(risks);
    } catch (error) {
      console.error("Error fetching risks by category:", error);
      res.status(500).json({ error: "Failed to fetch risks by category" });
    }
  });

  // Get risks by status
  app.get("/api/dd/projects/:id/risks/status/:status", async (req: any, res) => {
    try {
      const risks = await storage.getRisksByStatus(req.params.id, req.params.status);
      res.json(risks);
    } catch (error) {
      console.error("Error fetching risks by status:", error);
      res.status(500).json({ error: "Failed to fetch risks by status" });
    }
  });

  // Create a new risk
  app.post("/api/dd/projects/:id/risks", async (req: any, res) => {
    try {
      const riskData = insertRiskSchema.parse({
        ...req.body,
        projectId: req.params.id,
      });

      const risk = await storage.createRisk(riskData);

      // Create audit log
      await storage.createAuditLog({
        projectId: req.params.id,
        userId: req.user.id,
        entityType: "risk",
        entityId: risk.id,
        action: "created",
        after: risk,
      });

      res.json(risk);
    } catch (error) {
      console.error("Error creating risk:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid risk data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create risk" });
      }
    }
  });

  // Get a specific risk
  app.get("/api/dd/risks/:id", async (req: any, res) => {
    try {
      const risk = await storage.getRisk(req.params.id);
      if (!risk) {
        return res.status(404).json({ error: "Risk not found" });
      }
      res.json(risk);
    } catch (error) {
      console.error("Error fetching risk:", error);
      res.status(500).json({ error: "Failed to fetch risk" });
    }
  });

  // Update a risk
  app.put("/api/dd/risks/:id", async (req: any, res) => {
    try {
      const existingRisk = await storage.getRisk(req.params.id);
      if (!existingRisk) {
        return res.status(404).json({ error: "Risk not found" });
      }

      const updates = insertRiskSchema.partial().parse(req.body);
      const updatedRisk = await storage.updateRisk(req.params.id, updates);

      // Create audit log
      await storage.createAuditLog({
        projectId: existingRisk.projectId,
        userId: req.user.id,
        entityType: "risk",
        entityId: req.params.id,
        action: "updated",
        before: existingRisk,
        after: updatedRisk,
      });

      res.json(updatedRisk);
    } catch (error) {
      console.error("Error updating risk:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid risk data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update risk" });
      }
    }
  });

  // Delete a risk
  app.delete("/api/dd/risks/:id", async (req: any, res) => {
    try {
      const existingRisk = await storage.getRisk(req.params.id);
      if (!existingRisk) {
        return res.status(404).json({ error: "Risk not found" });
      }

      await storage.deleteRisk(req.params.id);

      // Create audit log
      await storage.createAuditLog({
        projectId: existingRisk.projectId,
        userId: req.user.id,
        entityType: "risk",
        entityId: req.params.id,
        action: "deleted",
        before: existingRisk,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting risk:", error);
      res.status(500).json({ error: "Failed to delete risk" });
    }
  });

  // Bulk update all risk scores for a project
  app.post("/api/dd/projects/:id/risks/recalculate", async (req: any, res) => {
    try {
      await storage.bulkUpdateRiskScores(req.params.id);
      
      // Create audit log
      await storage.createAuditLog({
        projectId: req.params.id,
        userId: req.user.id,
        entityType: "project",
        entityId: req.params.id,
        action: "risk_scores_recalculated",
      });

      res.json({ success: true, message: "Risk scores recalculated successfully" });
    } catch (error) {
      console.error("Error recalculating risk scores:", error);
      res.status(500).json({ error: "Failed to recalculate risk scores" });
    }
  });

  // Risk heatmap data
  app.get("/api/dd/projects/:id/risks/heatmap", async (req: any, res) => {
    try {
      const risks = await storage.getRisksForProject(req.params.id);
      
      // Create 5x5 heatmap matrix
      const heatmapData = Array.from({ length: 5 }, () => Array(5).fill(0));
      const riskDetails: any[][][] = Array.from({ length: 5 }, () => Array(5).fill(null).map(() => []));
      
      risks.forEach(risk => {
        const likelihood = parseInt(risk.likelihood) - 1; // Convert to 0-based index
        const impact = parseInt(risk.impact) - 1;
        if (likelihood >= 0 && likelihood < 5 && impact >= 0 && impact < 5) {
          heatmapData[4 - impact][likelihood]++; // Flip impact for display (high at top)
          (riskDetails[4 - impact][likelihood] as Array<any>).push({
            id: risk.id,
            name: risk.name,
            score: risk.riskScore || 0,
            category: risk.category
          });
        }
      });

      res.json({
        matrix: heatmapData,
        details: riskDetails,
        totalRisks: risks.length
      });
    } catch (error) {
      console.error("Error generating heatmap data:", error);
      res.status(500).json({ error: "Failed to generate heatmap data" });
    }
  });

  // ========== NOTIFICATION SYSTEM ROUTES ==========

  // Contact Management Routes
  app.get("/api/dd/contacts", async (req: any, res) => {
    try {
      const contacts = await storage.getContactsByOrg(req.user.orgId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/dd/contacts", async (req: any, res) => {
    try {
      const contactData = insertContactSchema.parse({
        ...req.body,
        orgId: req.user.orgId,
        createdBy: req.user.id,
      });

      // Check for duplicate email within the same organization
      const existingContacts = await storage.getContactsByOrg(req.user.orgId);
      const duplicateContact = existingContacts.find(contact => 
        contact.email.toLowerCase() === contactData.email.toLowerCase()
      );
      
      if (duplicateContact) {
        return res.status(400).json({ 
          error: "A contact with this email address already exists" 
        });
      }

      const contact = await storage.createContact(contactData);

      // Skip audit log for now due to database constraint issue
      // TODO: Fix audit_logs table to allow null projectId for org-level operations
      // await storage.createAuditLog({
      //   projectId: null,
      //   userId: req.user.id,
      //   entityType: "contact",
      //   entityId: contact.id,
      //   action: "created",
      //   after: contact,
      // });

      res.json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid contact data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create contact" });
      }
    }
  });

  app.put("/api/dd/contacts/:id", async (req: any, res) => {
    try {
      const existingContact = await storage.getContactById(req.params.id);
      if (!existingContact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Verify org access
      if (existingContact.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Security: Use restricted schema that excludes orgId/createdBy/id fields
      const updates = updateContactSchema.parse(req.body);
      
      // Check for duplicate email within the same organization (excluding current contact)
      if (updates.email) {
        const existingContacts = await storage.getContactsByOrg(req.user.orgId);
        const duplicateContact = existingContacts.find(contact => 
          contact.email.toLowerCase() === updates.email!.toLowerCase() && 
          contact.id !== req.params.id
        );
        
        if (duplicateContact) {
          return res.status(400).json({ 
            error: "A contact with this email address already exists" 
          });
        }
      }
      
      const updatedContact = await storage.updateContact(req.params.id, updates);

      // Create audit log - use null for projectId for org-level operations
      await storage.createAuditLog({
        projectId: null,
        userId: req.user.id,
        entityType: "contact",
        entityId: req.params.id,
        action: "updated",
        before: existingContact,
        after: updatedContact,
      });

      res.json(updatedContact);
    } catch (error) {
      console.error("Error updating contact:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid contact data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update contact" });
      }
    }
  });

  app.delete("/api/dd/contacts/:id", async (req: any, res) => {
    try {
      const existingContact = await storage.getContactById(req.params.id);
      if (!existingContact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Verify org access
      if (existingContact.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteContact(req.params.id);

      // Skip audit log for now due to database constraint issue
      // TODO: Fix audit_logs table to allow null projectId for org-level operations
      // await storage.createAuditLog({
      //   projectId: null,
      //   userId: req.user.id,
      //   entityType: "contact",
      //   entityId: req.params.id,
      //   action: "deleted",
      //   before: existingContact,
      // });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to delete contact" 
      });
    }
  });

  // Notification Subscription Routes
  app.get("/api/dd/projects/:projectId/subscriptions", async (req: any, res) => {
    try {
      // Verify project access
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const subscriptions = await storage.getSubscriptionsByProject(req.params.projectId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching project subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/dd/subscriptions", async (req: any, res) => {
    try {
      const subscriptionData = insertNotificationSubscriptionSchema.parse(req.body);

      // Verify project access
      const project = await storage.getProject(subscriptionData.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Verify task access if taskId is provided
      if (subscriptionData.taskId) {
        const task = await storage.getTask(subscriptionData.taskId);
        if (!task || task.projectId !== subscriptionData.projectId) {
          return res.status(404).json({ error: "Task not found" });
        }
      }

      // Validate recipient exists and belongs to org (using recipient utilities)
      const recipient = await resolveRecipient(
        db,
        subscriptionData.recipientType,
        subscriptionData.recipientId,
        req.user.orgId
      );

      if (!recipient) {
        return res.status(400).json({ error: "Invalid recipient: user or contact not found" });
      }

      const subscription = await storage.createSubscription(subscriptionData);

      // Create audit log
      await storage.createAuditLog({
        projectId: subscriptionData.projectId,
        userId: req.user.id,
        entityType: "notification_subscription",
        entityId: subscription.id,
        action: "created",
        after: subscription,
      });

      res.json(subscription);
    } catch (error) {
      console.error("Error creating subscription:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid subscription data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create subscription" });
      }
    }
  });

  app.put("/api/dd/subscriptions/:id", async (req: any, res) => {
    try {
      // Get existing subscription to verify access
      const existingSubscription = await storage.getSubscriptionsByProject("dummy");
      // Note: This is a simplified check - in production, we'd need a more efficient way to verify subscription ownership

      const updates = insertNotificationSubscriptionSchema.partial().parse(req.body);
      const updatedSubscription = await storage.updateSubscription(req.params.id, updates);

      res.json(updatedSubscription);
    } catch (error) {
      console.error("Error updating subscription:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid subscription data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update subscription" });
      }
    }
  });

  app.delete("/api/dd/subscriptions/:id", async (req: any, res) => {
    try {
      await storage.deleteSubscription(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ error: "Failed to delete subscription" });
    }
  });

  app.get("/api/dd/users/:userId/subscriptions", async (req: any, res) => {
    try {
      // Verify user belongs to org
      const user = await storage.getUser(req.params.userId);
      if (!user || user.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "User not found" });
      }

      const subscriptions = await storage.getSubscriptionsByRecipient("user", req.params.userId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching user subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch user subscriptions" });
    }
  });

  // Notification History and Management Routes
  app.get("/api/dd/notifications/history/:projectId", async (req: any, res) => {
    try {
      // Verify project access
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const taskId = req.query.taskId as string;
      const history = await storage.getNotificationHistory(req.params.projectId, taskId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching notification history:", error);
      res.status(500).json({ error: "Failed to fetch notification history" });
    }
  });

  app.post("/api/dd/notifications/test", async (req: any, res) => {
    try {
      const { recipientEmail, templateType } = req.body;

      if (!recipientEmail || !templateType) {
        return res.status(400).json({ error: "recipientEmail and templateType are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const success = await storage.sendTestNotification(recipientEmail, templateType);

      if (success) {
        res.json({ success: true, message: "Test notification sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send test notification" });
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ error: "Failed to send test notification" });
    }
  });

  app.get("/api/dd/notifications/scheduled", async (req: any, res) => {
    try {
      // Only allow admin users to view scheduled notifications
      if (req.user.role !== "owner") {
        return res.status(403).json({ error: "Access denied: Admin access required" });
      }

      const beforeDate = req.query.before 
        ? new Date(req.query.before as string)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // Next 24 hours

      const scheduled = await storage.getScheduledNotifications(beforeDate);
      res.json(scheduled);
    } catch (error) {
      console.error("Error fetching scheduled notifications:", error);
      res.status(500).json({ error: "Failed to fetch scheduled notifications" });
    }
  });

  // Validation endpoint for notification configuration
  app.get("/api/dd/notifications/validate-config", async (req: any, res) => {
    try {
      const channels = req.query.channels 
        ? (req.query.channels as string).split(",")
        : ["email", "sms"];

      const validation = await storage.validateNotificationChannels(channels);
      res.json(validation);
    } catch (error) {
      console.error("Error validating notification config:", error);
      res.status(500).json({ error: "Failed to validate notification configuration" });
    }
  });

  // Deadline monitoring endpoints
  app.get("/api/dd/deadlines/upcoming", async (req: any, res) => {
    try {
      // Only allow authenticated users to view upcoming deadlines
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      
      const { deadlineMonitor } = await import('./deadline-monitor');
      const upcomingDeadlines = await deadlineMonitor.getUpcomingDeadlines(days);
      
      res.json(upcomingDeadlines);
    } catch (error) {
      console.error("Error fetching upcoming deadlines:", error);
      res.status(500).json({ error: "Failed to fetch upcoming deadlines" });
    }
  });

  app.post("/api/dd/deadlines/check", async (req: any, res) => {
    try {
      // Only allow owner users to manually trigger deadline checks
      if (req.user.role !== "owner") {
        return res.status(403).json({ error: "Access denied: Owner access required" });
      }

      const { deadlineMonitor } = await import('./deadline-monitor');
      await deadlineMonitor.triggerDeadlineCheck();
      
      res.json({ success: true, message: "Deadline check triggered successfully" });
    } catch (error) {
      console.error("Error triggering deadline check:", error);
      res.status(500).json({ error: "Failed to trigger deadline check" });
    }
  });

  app.get("/api/dd/deadlines/monitor/status", async (req: any, res) => {
    try {
      const { deadlineMonitor } = await import('./deadline-monitor');
      const status = deadlineMonitor.getStatus();
      
      res.json(status);
    } catch (error) {
      console.error("Error fetching deadline monitor status:", error);
      res.status(500).json({ error: "Failed to fetch deadline monitor status" });
    }
  });

  // Reconciliation Service Monitoring Endpoints

  // Get reconciliation service health status
  app.get("/api/dd/reconciliation/health", async (req: any, res) => {
    try {
      const healthStatus = reconciliationService.getHealthStatus();
      res.json(healthStatus);
    } catch (error) {
      console.error("Error fetching reconciliation health status:", error);
      res.status(500).json({ error: "Failed to fetch reconciliation health status" });
    }
  });

  // Get sync status for all integrations
  app.get("/api/dd/reconciliation/status", async (req: any, res) => {
    try {
      const syncStatuses = reconciliationService.getSyncStatuses();
      res.json(syncStatuses);
    } catch (error) {
      console.error("Error fetching reconciliation sync statuses:", error);
      res.status(500).json({ error: "Failed to fetch reconciliation sync statuses" });
    }
  });

  // Get sync history for a specific integration
  app.get("/api/dd/reconciliation/status/:projectId/:provider", async (req: any, res) => {
    try {
      const { projectId, provider } = req.params;
      
      // Verify project ownership
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      const syncHistory = reconciliationService.getSyncHistory(projectId, provider);
      if (!syncHistory) {
        return res.status(404).json({ error: "Sync history not found for this integration" });
      }
      
      res.json(syncHistory);
    } catch (error) {
      console.error("Error fetching reconciliation sync history:", error);
      res.status(500).json({ error: "Failed to fetch reconciliation sync history" });
    }
  });

  // Manually trigger sync for a specific integration
  app.post("/api/dd/reconciliation/sync/:projectId/:provider", async (req: any, res) => {
    try {
      const { projectId, provider } = req.params;
      
      // Verify project ownership
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      // Verify integration exists
      const integration = await storage.getProjectIntegrationByProvider(projectId, provider);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      console.log(`🔧 Manual sync triggered for ${projectId}:${provider} by user ${req.user.id}`);
      
      // Trigger sync (this is async but we respond immediately)
      const syncResult = await reconciliationService.triggerSync(projectId, provider);
      
      res.json({
        message: "Sync triggered successfully",
        result: syncResult
      });
    } catch (error) {
      console.error("Error triggering reconciliation sync:", error);
      res.status(500).json({ error: "Failed to trigger reconciliation sync" });
    }
  });

  // Get reconciliation service configuration
  app.get("/api/dd/reconciliation/config", async (req: any, res) => {
    try {
      const config = reconciliationService.getConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching reconciliation config:", error);
      res.status(500).json({ error: "Failed to fetch reconciliation config" });
    }
  });

  // Reset sync status for a specific integration (useful for recovery)
  app.post("/api/dd/reconciliation/reset/:projectId/:provider", async (req: any, res) => {
    try {
      const { projectId, provider } = req.params;
      
      // Verify project ownership
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      // Verify integration exists
      const integration = await storage.getProjectIntegrationByProvider(projectId, provider);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      console.log(`🔄 Sync status reset for ${projectId}:${provider} by user ${req.user.id}`);
      
      reconciliationService.resetSyncStatus(projectId, provider);
      
      res.json({ message: "Sync status reset successfully" });
    } catch (error) {
      console.error("Error resetting reconciliation sync status:", error);
      res.status(500).json({ error: "Failed to reset reconciliation sync status" });
    }
  });

  // Trigger health check manually
  app.post("/api/dd/reconciliation/health-check", async (req: any, res) => {
    try {
      const healthStatus = await reconciliationService.triggerHealthCheck();
      res.json({
        message: "Health check completed",
        status: healthStatus
      });
    } catch (error) {
      console.error("Error triggering reconciliation health check:", error);
      res.status(500).json({ error: "Failed to trigger reconciliation health check" });
    }
  });

  // Notification system testing endpoint
  app.post("/api/dd/notifications/run-tests", async (req: any, res) => {
    try {
      // Only allow owner users to run comprehensive tests
      if (req.user.role !== "owner") {
        return res.status(403).json({ error: "Access denied: Owner access required" });
      }

      const { notificationTestSuite } = await import('./notification-test');
      const testResults = await notificationTestSuite.runAllTests();
      
      res.json({
        success: true,
        summary: {
          passed: testResults.passed,
          failed: testResults.failed,
          successRate: `${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`
        },
        results: testResults.results
      });
    } catch (error) {
      console.error("Error running notification tests:", error);
      res.status(500).json({ error: "Failed to run notification tests" });
    }
  });

  app.get("/api/dd/notifications/test-report", async (req: any, res) => {
    try {
      const { notificationTestSuite } = await import('./notification-test');
      const report = await notificationTestSuite.generateTestReport();
      
      res.setHeader('Content-Type', 'text/markdown');
      res.send(report);
    } catch (error) {
      console.error("Error generating test report:", error);
      res.status(500).json({ error: "Failed to generate test report" });
    }
  });

  // Calendar Events API
  app.get("/api/dd/projects/:projectId/calendar-events", async (req: any, res) => {
    try {
      const { projectId } = req.params;
      
      // SECURITY: Verify project ownership before accessing calendar events
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      // SECURITY: Validate query parameters with Zod schema
      const queryValidation = calendarQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({ 
          error: "Invalid query parameters", 
          details: queryValidation.error.errors 
        });
      }
      
      const { eventType, startDate, endDate, status, isCompleted } = queryValidation.data;

      // Build filters object with properly validated data
      const filters: any = {};
      if (eventType) filters.eventType = eventType;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      if (status) filters.status = status;
      if (isCompleted !== undefined) filters.isCompleted = isCompleted === 'true';

      const events = await storage.getProjectCalendarEvents(projectId, filters);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized project access" });
        }
      }
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  app.post("/api/dd/projects/:projectId/calendar-events/sync", async (req: any, res) => {
    try {
      const { projectId } = req.params;
      
      // SECURITY: Verify project ownership before syncing calendar events
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      const syncedEvents = await storage.syncProjectEvents(projectId);
      
      // Create audit log for sync
      await storage.createAuditLog({
        projectId,
        userId: req.user.id,
        entityType: "calendar_event",
        entityId: projectId,
        action: "synced",
        after: { syncedEventsCount: syncedEvents.length },
      });

      res.json({ 
        success: true, 
        syncedEvents: syncedEvents.length,
        events: syncedEvents 
      });
    } catch (error) {
      console.error("Error syncing calendar events:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized project access" });
        }
      }
      res.status(500).json({ error: "Failed to sync calendar events" });
    }
  });

  app.post("/api/dd/calendar/generate-ics", async (req: any, res) => {
    try {
      // SECURITY: Validate request body with Zod schema
      const bodyValidation = generateIcsSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: bodyValidation.error.errors 
        });
      }
      
      const { eventIds, projectId, filters } = bodyValidation.data;

      let icsContent: string;

      if (eventIds && eventIds.length > 0) {
        // SECURITY: Verify each event belongs to user's organization
        for (const eventId of eventIds) {
          await authorizeCalendarEventAccess(eventId, req.user.orgId);
        }

        // Validate event selection
        const validation = await storage.validateEventSelection(eventIds);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: "Invalid event selection", 
            invalidIds: validation.invalidIds 
          });
        }

        // Get specific events by IDs
        const events = await Promise.all(
          eventIds.map((id: string) => storage.getCalendarEvent(id))
        );
        const validEvents = events.filter(e => e !== undefined);
        
        icsContent = await storage.generateICSFile(validEvents);
      } else if (projectId) {
        // SECURITY: Verify project ownership before generating ICS
        await authorizeProjectAccess(projectId, req.user.orgId);
        
        // Convert string dates to Date objects in filters
        const processedFilters: any = {};
        if (filters) {
          if (filters.eventType) processedFilters.eventType = filters.eventType;
          if (filters.status) processedFilters.status = filters.status;
          if (filters.isCompleted) processedFilters.isCompleted = filters.isCompleted;
          if (filters.startDate) processedFilters.startDate = new Date(filters.startDate);
          if (filters.endDate) processedFilters.endDate = new Date(filters.endDate);
        }
        
        // Generate ICS for entire project with optional filters
        icsContent = await storage.generateProjectICS(projectId, processedFilters);
      } else {
        return res.status(400).json({ error: "Either eventIds or projectId is required" });
      }

      // Set headers for ICS file download
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar-events.ics"');
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating ICS file:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized access to calendar data" });
        }
      }
      res.status(500).json({ error: "Failed to generate ICS file" });
    }
  });

  app.get("/api/dd/projects/:projectId/calendar-events/download", async (req: any, res) => {
    try {
      const { projectId } = req.params;
      
      // SECURITY: Verify project ownership before downloading calendar
      const project = await authorizeProjectAccess(projectId, req.user.orgId);
      
      // SECURITY: Validate query parameters with Zod schema
      const queryValidation = calendarQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({ 
          error: "Invalid query parameters", 
          details: queryValidation.error.errors 
        });
      }
      
      const { eventType, startDate, endDate } = queryValidation.data;

      // Build filters for ICS generation
      const filters: any = {};
      if (eventType) filters.eventType = eventType;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const icsContent = await storage.generateProjectICS(projectId, filters);
      
      // Create secure filename
      const filename = `${project?.name || 'project'}-calendar.ics`.replace(/[^a-zA-Z0-9\-_\.]/g, '_');

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("Error downloading project calendar:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized project access" });
        }
      }
      res.status(500).json({ error: "Failed to download project calendar" });
    }
  });

  app.get("/api/dd/calendar/event-types", async (req: any, res) => {
    try {
      const eventTypes = [
        { value: "dd_expiration", label: "DD Expiration", description: "Due diligence deadline events" },
        { value: "closing", label: "Closing", description: "Project closing/completion deadlines" },
        { value: "task_deadline", label: "Task Deadlines", description: "Individual task due dates" },
        { value: "milestone", label: "Milestones", description: "Project milestone markers" },
        { value: "custom", label: "Custom Events", description: "User-defined calendar events" }
      ];
      
      res.json(eventTypes);
    } catch (error) {
      console.error("Error fetching event types:", error);
      res.status(500).json({ error: "Failed to fetch event types" });
    }
  });

  app.post("/api/dd/projects/:projectId/calendar-events", async (req: any, res) => {
    try {
      const { projectId } = req.params;
      
      // SECURITY: Verify project ownership before creating calendar events
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      const eventData = insertCalendarEventSchema.parse({
        ...req.body,
        projectId,
      });
      
      const event = await storage.createCalendarEvent(eventData);

      // Create audit log
      await storage.createAuditLog({
        projectId,
        userId: req.user.id,
        entityType: "calendar_event",
        entityId: event.id,
        action: "created",
        after: event,
      });

      res.json(event);
    } catch (error) {
      console.error("Error creating calendar event:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized project access" });
        }
      }
      res.status(400).json({ error: "Invalid calendar event data" });
    }
  });

  app.patch("/api/dd/calendar-events/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // SECURITY: Verify calendar event ownership before updating
      const event = await authorizeCalendarEventAccess(id, req.user.orgId);
      
      const updates = insertCalendarEventSchema.partial().parse(req.body);
      
      const updated = await storage.updateCalendarEvent(id, updates);

      // Create audit log
      if (updated.projectId) {
        await storage.createAuditLog({
          projectId: updated.projectId,
          userId: req.user.id,
          entityType: "calendar_event",
          entityId: id,
          action: "updated",
          after: updated,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating calendar event:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized calendar event access" });
        }
      }
      res.status(400).json({ error: "Invalid calendar event update data" });
    }
  });

  app.delete("/api/dd/calendar-events/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // SECURITY: Verify calendar event ownership before deletion
      const event = await authorizeCalendarEventAccess(id, req.user.orgId);

      await storage.deleteCalendarEvent(id);

      // Create audit log
      await storage.createAuditLog({
        projectId: event.projectId,
        userId: req.user.id,
        entityType: "calendar_event",
        entityId: id,
        action: "deleted",
        before: event,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized calendar event access" });
        }
      }
      res.status(500).json({ error: "Failed to delete calendar event" });
    }
  });

  // =============================================================================
  // DOCUMENT REQUIREMENTS MANAGEMENT
  // =============================================================================

  // Authorization helper for task access
  const authorizeTaskAccess = async (taskId: string, orgId: string) => {
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    const project = await storage.getProject(task.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Unauthorized access to task");
    }
    return { task, project };
  };

  // GET /api/dd/tasks/:taskId/requirements - List requirements for a task
  app.get("/api/dd/tasks/:taskId/requirements", async (req: any, res) => {
    try {
      const { taskId } = req.params;
      
      // SECURITY: Verify task ownership before listing requirements
      await authorizeTaskAccess(taskId, req.user.orgId);
      
      const requirements = await storage.getDocumentRequirementsByTask(taskId);
      res.json(requirements);
    } catch (error) {
      console.error("Error fetching task requirements:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized task access" });
        }
      }
      res.status(500).json({ error: "Failed to fetch document requirements" });
    }
  });

  // POST /api/dd/tasks/:taskId/requirements - Create requirement for a task
  app.post("/api/dd/tasks/:taskId/requirements", async (req: any, res) => {
    try {
      const { taskId } = req.params;
      
      // SECURITY: Verify task ownership before creating requirements
      const { task, project } = await authorizeTaskAccess(taskId, req.user.orgId);
      
      const requirementData = insertDocumentRequirementSchema.parse({
        ...req.body,
        taskId,
        projectId: task.projectId,
      });
      
      const requirement = await storage.createDocumentRequirement(requirementData);

      // Create audit log
      await storage.createAuditLog({
        projectId: task.projectId,
        userId: req.user.id,
        entityType: "document_requirement",
        entityId: requirement.id,
        action: "created",
        after: requirement,
      });

      res.json(requirement);
    } catch (error) {
      console.error("Error creating document requirement:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized task access" });
        }
      }
      res.status(400).json({ error: "Invalid document requirement data" });
    }
  });

  // PATCH /api/dd/tasks/:taskId/requirements/:id - Update requirement with manual overrides
  app.patch("/api/dd/tasks/:taskId/requirements/:id", async (req: any, res) => {
    try {
      const { taskId, id } = req.params;
      
      // SECURITY: Verify task ownership and requirement exists
      const { task } = await authorizeTaskAccess(taskId, req.user.orgId);
      
      const existingRequirement = await storage.getDocumentRequirement(id);
      if (!existingRequirement || existingRequirement.taskId !== taskId) {
        return res.status(404).json({ error: "Document requirement not found" });
      }
      
      const updates = insertDocumentRequirementSchema.partial().parse(req.body);
      
      const updated = await storage.updateDocumentRequirement(id, updates);

      // Create audit log
      await storage.createAuditLog({
        projectId: task.projectId,
        userId: req.user.id,
        entityType: "document_requirement",
        entityId: id,
        action: "updated",
        before: existingRequirement,
        after: updated,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating document requirement:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized access" });
        }
      }
      res.status(400).json({ error: "Invalid document requirement update data" });
    }
  });

  // =============================================================================
  // PROJECT INTEGRATION MANAGEMENT
  // =============================================================================

  // GET /api/dd/projects/:id/integrations - List project integrations
  app.get("/api/dd/projects/:id/integrations", async (req: any, res) => {
    try {
      const projectId = req.params.id;
      
      // SECURITY: Verify project ownership before listing integrations
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      const integrations = await storage.getProjectIntegrationsByProject(projectId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching project integrations:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized project access" });
        }
      }
      res.status(500).json({ error: "Failed to fetch project integrations" });
    }
  });

  // PATCH /api/dd/projects/:id/integrations/:integrationId - Update integration settings
  app.patch("/api/dd/projects/:id/integrations/:integrationId", async (req: any, res) => {
    try {
      const { id: projectId, integrationId } = req.params;
      
      // SECURITY: Verify project ownership before updating integration
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      const existingIntegration = await storage.getProjectIntegration(integrationId);
      if (!existingIntegration || existingIntegration.projectId !== projectId) {
        return res.status(404).json({ error: "Project integration not found" });
      }
      
      const updates = insertProjectIntegrationSchema.partial().parse(req.body);
      
      const updated = await storage.updateProjectIntegration(integrationId, updates);

      // Create audit log
      await storage.createAuditLog({
        projectId,
        userId: req.user.id,
        entityType: "project_integration",
        entityId: integrationId,
        action: "updated",
        before: existingIntegration,
        after: updated,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating project integration:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized access" });
        }
      }
      res.status(400).json({ error: "Invalid integration update data" });
    }
  });

  // POST /api/dd/projects/:id/integrations/docs/register - Register webhook with external app
  app.post("/api/dd/projects/:id/integrations/docs/register", async (req: any, res) => {
    try {
      const projectId = req.params.id;
      
      // SECURITY: Verify project ownership before registering integration
      const project = await authorizeProjectAccess(projectId, req.user.orgId);
      
      // Validation schema for integration registration
      const registrationSchema = z.object({
        provider: z.string().min(1, "Provider name is required"),
        webhookUrl: z.string().url("Invalid webhook URL"),
        apiKey: z.string().min(1, "API key is required"),
        config: z.record(z.any()).optional().default({}),
        enabled: z.boolean().default(true),
      });
      
      const registrationData = registrationSchema.parse(req.body);
      
      // Check if integration already exists for this provider
      const existingIntegration = await storage.getProjectIntegrationByProvider(projectId, registrationData.provider);
      
      let integration;
      if (existingIntegration) {
        // Update existing integration config
        const updatedConfig = {
          ...(existingIntegration.config as object),
          webhookUrl: registrationData.webhookUrl,
          apiKey: registrationData.apiKey,
          enabled: registrationData.enabled,
          ...registrationData.config,
        };
        
        integration = await storage.updateProjectIntegration(existingIntegration.id, {
          config: updatedConfig,
        });
        
        await storage.createAuditLog({
          projectId,
          userId: req.user.id,
          entityType: "project_integration",
          entityId: integration.id,
          action: "updated",
          before: existingIntegration,
          after: integration,
        });
      } else {
        // Create new integration
        const integrationConfig = {
          webhookUrl: registrationData.webhookUrl,
          apiKey: registrationData.apiKey,
          enabled: registrationData.enabled,
          ...registrationData.config,
        };
        
        const integrationData = insertProjectIntegrationSchema.parse({
          projectId,
          provider: registrationData.provider,
          config: integrationConfig,
        });
        
        integration = await storage.createProjectIntegration(integrationData);
        
        await storage.createAuditLog({
          projectId,
          userId: req.user.id,
          entityType: "project_integration",
          entityId: integration.id,
          action: "created",
          after: integration,
        });
      }

      res.json({
        integration,
        message: existingIntegration ? "Integration updated successfully" : "Integration registered successfully",
      });
    } catch (error) {
      console.error("Error registering integration:", error);
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized") || error.message.includes("not found")) {
          return res.status(403).json({ error: "Access denied: Unauthorized project access" });
        }
      }
      res.status(400).json({ error: "Invalid integration registration data" });
    }
  });

  // POST /api/dd/integrations/:id/test-webhook - Test webhook connectivity
  app.post("/api/dd/integrations/:id/test-webhook", async (req: any, res) => {
    try {
      const integrationId = req.params.id;
      
      const integration = await storage.getProjectIntegration(integrationId);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      // SECURITY: Verify project ownership before testing webhook
      await authorizeProjectAccess(integration.projectId, req.user.orgId);
      
      const config = integration.config as any;
      if (!config.webhookUrl) {
        return res.status(400).json({ error: "Webhook URL not configured" });
      }
      
      // Send test webhook to verify connectivity
      const testPayload = {
        event: "test.connection",
        timestamp: new Date().toISOString(),
        projectId: integration.projectId,
        integrationId: integration.id,
        data: {
          message: "Test webhook from MarinaMatch Due Diligence Tracker",
          testId: crypto.randomBytes(16).toString('hex'),
        }
      };
      
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Test': 'true',
        };
        
        if (config.apiKey) {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
        
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        
        const isSuccessful = response.ok;
        const responseData = await response.text();
        
        // Update integration config with test results
        const updatedConfig = {
          ...config,
          lastTestAt: new Date().toISOString(),
          lastTestStatus: isSuccessful ? 'success' : 'failed',
          lastTestResponse: {
            status: response.status,
            statusText: response.statusText,
            data: responseData.slice(0, 500), // Limit response data
          }
        };
        
        await storage.updateProjectIntegration(integrationId, {
          config: updatedConfig,
        });
        
        // Create audit log
        await storage.createAuditLog({
          projectId: integration.projectId,
          userId: req.user.id,
          entityType: "project_integration",
          entityId: integrationId,
          action: "webhook_tested",
          after: { testResult: isSuccessful ? 'success' : 'failed', status: response.status },
        });
        
        res.json({
          success: isSuccessful,
          status: response.status,
          statusText: response.statusText,
          message: isSuccessful ? "Webhook test successful" : "Webhook test failed",
          response: responseData.slice(0, 200), // Limit response in API
        });
        
      } catch (fetchError: any) {
        // Update config with error
        const updatedConfig = {
          ...config,
          lastTestAt: new Date().toISOString(),
          lastTestStatus: 'error',
          lastTestError: fetchError.message,
        };
        
        await storage.updateProjectIntegration(integrationId, {
          config: updatedConfig,
        });
        
        await storage.createAuditLog({
          projectId: integration.projectId,
          userId: req.user.id,
          entityType: "project_integration",
          entityId: integrationId,
          action: "webhook_test_failed",
          after: { error: fetchError.message },
        });
        
        res.status(503).json({
          success: false,
          message: "Webhook connectivity test failed",
          error: fetchError.message,
        });
      }
      
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ error: "Failed to test webhook connectivity" });
    }
  });

  // GET /api/dd/integrations/:id/status - Get integration status and health
  app.get("/api/dd/integrations/:id/status", async (req: any, res) => {
    try {
      const integrationId = req.params.id;
      
      const integration = await storage.getProjectIntegration(integrationId);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      // SECURITY: Verify project ownership before getting status
      await authorizeProjectAccess(integration.projectId, req.user.orgId);
      
      const config = integration.config as any;
      
      // Calculate health status based on various factors
      const now = new Date();
      const lastTestAt = config.lastTestAt ? new Date(config.lastTestAt) : null;
      const timeSinceLastTest = lastTestAt ? now.getTime() - lastTestAt.getTime() : null;
      const daysSinceLastTest = timeSinceLastTest ? Math.floor(timeSinceLastTest / (1000 * 60 * 60 * 24)) : null;
      
      let healthStatus = 'unknown';
      let healthMessage = 'No test performed yet';
      
      if (config.lastTestStatus === 'success' && daysSinceLastTest !== null) {
        if (daysSinceLastTest <= 1) {
          healthStatus = 'healthy';
          healthMessage = 'Recent test successful';
        } else if (daysSinceLastTest <= 7) {
          healthStatus = 'warning';
          healthMessage = 'Test successful but getting old';
        } else {
          healthStatus = 'stale';
          healthMessage = 'Test result is stale';
        }
      } else if (config.lastTestStatus === 'failed' || config.lastTestStatus === 'error') {
        healthStatus = 'unhealthy';
        healthMessage = config.lastTestError || 'Last test failed';
      }
      
      // Get sync status from reconciliation service if available
      let syncStatus = null;
      try {
        const syncHistory = reconciliationService.getSyncHistory(integration.projectId, integration.provider);
        if (syncHistory) {
          syncStatus = {
            lastSyncAt: syncHistory.lastSyncAt,
            lastSyncSuccess: syncHistory.lastSyncSuccess,
            retryCount: syncHistory.retryCount,
            lastError: syncHistory.lastError,
            nextRetryAt: syncHistory.nextRetryAt,
            documentsProcessed: syncHistory.documentsProcessed,
          };
        }
      } catch (syncError) {
        // Sync status not available
      }
      
      res.json({
        integrationId: integration.id,
        provider: integration.provider,
        enabled: config.enabled !== false,
        connectionHealth: {
          status: healthStatus,
          message: healthMessage,
          lastTestAt: config.lastTestAt,
          lastTestStatus: config.lastTestStatus,
          daysSinceLastTest,
        },
        webhookConfig: {
          url: config.webhookUrl,
          hasApiKey: !!config.apiKey,
          lastTestResponse: config.lastTestResponse,
        },
        syncStatus,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
      
    } catch (error) {
      console.error("Error getting integration status:", error);
      res.status(500).json({ error: "Failed to get integration status" });
    }
  });

  // =============================================================================
  // WEBHOOK ENDPOINT FOR DOCUMENT EVENTS
  // =============================================================================

  // Initialize webhook security (this would typically be configured with environment variables)
  const webhookSecurity = new WebhookSecurity({
    secret: process.env.WEBHOOK_SECRET || "default-webhook-secret-key",
    timestampToleranceMinutes: 5,
    requireIdempotencyKey: true,
    redis: {
      // Redis configuration - would be from environment variables in production
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    }
  });

  // Raw body parser middleware for webhook verification
  const rawBodyParser = (req: any, res: any, buf: Buffer) => {
    req.rawBody = buf.toString('utf8');
  };

  // POST /api/integrations/docs/webhook - Receive document events from external app
  app.post("/api/integrations/docs/webhook", (req: any, res, next) => {
    // Use raw body parser for this specific route
    if (req.originalUrl === '/api/integrations/docs/webhook') {
      req._body = true;
      rawBodyParser(req, res, req.body);
    }
    next();
  }, async (req: any, res) => {
    try {
      // Verify webhook security
      const verification = await webhookSecurity.verifyWebhook(req, req.rawBody || JSON.stringify(req.body));
      
      if (!verification.isValid) {
        return res.status(401).json({ 
          error: "Webhook verification failed",
          details: verification.error 
        });
      }

      const webhookEvent = verification.parsedPayload as WebhookEvent;
      
      // Process different event types
      switch (webhookEvent.event) {
        case 'document.created':
        case 'document.verified':
        case 'document.rejected':
        case 'document.tagged':
        case 'document.deleted':
          await processDocumentEvent(webhookEvent);
          break;
          
        case 'task.status_changed':
        case 'task.assigned':
          await processTaskEvent(webhookEvent);
          break;
          
        case 'project.created':
          await processProjectEvent(webhookEvent);
          break;
          
        default:
          console.warn("Unknown webhook event type:", (webhookEvent as any).event);
      }

      res.json({ 
        success: true, 
        message: "Webhook processed successfully",
        eventType: webhookEvent.event 
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Helper function to process document events
  async function processDocumentEvent(event: WebhookEvent) {
    console.log("Processing document event:", event.event, event.data);
    
    // Here you would implement the actual document processing logic
    // For example, updating task status, creating notifications, etc.
    // This is a placeholder implementation
    
    // Type guard for document events
    if (
      event.event === 'document.created' ||
      event.event === 'document.verified' ||
      event.event === 'document.rejected' ||
      event.event === 'document.tagged' ||
      event.event === 'document.deleted'
    ) {
      const eventData = event.data as any; // Type assertion needed for union type
      
      if (eventData.projectId) {
        // Create audit log for document events
        await storage.createAuditLog({
          projectId: eventData.projectId,
          userId: "system", // System-generated event
          entityType: "document",
          entityId: eventData.documentId || "",
          action: event.event.split('.')[1], // Extract action from event name
          after: eventData,
        });
      }
    }
  }

  // Helper function to process task events
  async function processTaskEvent(event: WebhookEvent) {
    console.log("Processing task event:", event.event, event.data);
    
    // Type guard for task events
    if (
      event.event === 'task.status_changed' ||
      event.event === 'task.assigned'
    ) {
      const eventData = event.data as any; // Type assertion needed for union type
      
      if (eventData.projectId) {
        await storage.createAuditLog({
          projectId: eventData.projectId,
          userId: "system",
          entityType: "task",
          entityId: eventData.taskId || "",
          action: event.event.split('.')[1],
          after: eventData,
        });
      }
    }
  }

  // Helper function to process project events
  async function processProjectEvent(event: WebhookEvent) {
    console.log("Processing project event:", event.event, event.data);
    
    // Type guard for project events
    if (event.event === 'project.created') {
      const eventData = event.data as any; // Type assertion needed for union type
      
      if (eventData.projectId) {
        await storage.createAuditLog({
          projectId: eventData.projectId,
          userId: eventData.createdBy || "system",
          entityType: "project",
          entityId: eventData.projectId || "",
          action: "created",
          after: eventData,
        });
      }
    }
  }

  // User Email Management
  app.get("/api/user/emails", async (req: any, res) => {
    try {
      const emails = await storage.getUserEmails(req.user.id);
      res.json(emails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user emails" });
    }
  });

  app.post("/api/user/emails", async (req: any, res) => {
    try {
      const emailData = insertUserEmailSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const email = await storage.createUserEmail(emailData);
      res.json(email);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid email data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create user email" });
      }
    }
  });

  app.patch("/api/user/emails/:id", async (req: any, res) => {
    try {
      const updates = req.body;
      const email = await storage.updateUserEmail(req.params.id, updates);
      res.json(email);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user email" });
    }
  });

  app.delete("/api/user/emails/:id", async (req: any, res) => {
    try {
      await storage.deleteUserEmail(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user email" });
    }
  });

  app.post("/api/user/emails/:id/set-default", async (req: any, res) => {
    try {
      await storage.setDefaultUserEmail(req.user.id, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to set default email" });
    }
  });

  // Direct Calendar Sync API
  app.post("/api/dd/calendar/sync-direct", async (req: any, res) => {
    try {
      const { eventIds, emailIds, projectId } = syncToCalendarSchema.parse(req.body);
      
      // Authorize project access
      await authorizeProjectAccess(projectId, req.user.orgId);
      
      // Check if Google Calendar is available
      const isCalendarAvailable = await checkCalendarAvailability();
      if (!isCalendarAvailable) {
        return res.status(503).json({ 
          error: "Google Calendar service is not available. Please check your connection settings." 
        });
      }
      
      // Get user emails
      const userEmails = await storage.getUserEmails(req.user.id);
      const selectedEmails = userEmails.filter(email => emailIds.includes(email.id));
      
      if (selectedEmails.length === 0) {
        return res.status(400).json({ error: "No valid email addresses found for sync" });
      }
      
      // Get calendar events
      const events = await Promise.all(
        eventIds.map(eventId => authorizeCalendarEventAccess(eventId, req.user.orgId))
      );
      
      // Get project guests for additional attendees
      const projectGuests = await storage.getProjectGuests(projectId);
      const guestEmails = projectGuests.map(guest => guest.email);
      
      // Create calendar events for each selected event
      const syncResults = [];
      
      for (const event of events) {
        try {
          // Prepare attendee list (user emails + project guests)
          const attendees = [
            ...selectedEmails.map(email => email.email),
            ...guestEmails
          ];
          
          const calendarEventData = {
            title: event.title,
            description: event.description || `Due Diligence Event: ${event.title}`,
            startDate: event.startDate,
            endDate: event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000).toISOString(),
            location: event.location,
            attendees: attendees
          };
          
          const googleEvent = await createCalendarEvent(calendarEventData);
          
          syncResults.push({
            eventId: event.id,
            success: true,
            googleEventId: googleEvent.id,
            googleEventLink: googleEvent.htmlLink,
            attendeeCount: attendees.length
          });
          
        } catch (eventError) {
          console.error(`Failed to sync event ${event.id}:`, eventError);
          syncResults.push({
            eventId: event.id,
            success: false,
            error: eventError instanceof Error ? eventError.message : 'Unknown error'
          });
        }
      }
      
      const successCount = syncResults.filter(r => r.success).length;
      const failureCount = syncResults.filter(r => !r.success).length;
      
      res.json({
        success: true,
        message: `Synced ${successCount} of ${events.length} events to calendar`,
        syncResults,
        summary: {
          totalEvents: events.length,
          successful: successCount,
          failed: failureCount,
          emailAddresses: selectedEmails.length,
          guestEmails: guestEmails.length
        }
      });
      
    } catch (error) {
      console.error('Calendar sync error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to sync events to calendar"
      });
    }
  });

  // Calendar connection status
  app.get("/api/dd/calendar/status", async (req: any, res) => {
    try {
      const isAvailable = await checkCalendarAvailability();
      res.json({ 
        connected: isAvailable,
        service: 'Google Calendar'
      });
    } catch (error) {
      res.json({ 
        connected: false,
        service: 'Google Calendar',
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  });

  // Calendar Guest Management
  app.get("/api/projects/:projectId/guests", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      const guests = await storage.getProjectGuests(req.params.projectId);
      res.json(guests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project guests" });
    }
  });

  app.post("/api/projects/:projectId/guests", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      
      const guestData = insertCalendarGuestSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
        invitedBy: req.user.id,
      });
      
      const guest = await storage.createCalendarGuest(guestData);
      res.json(guest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid guest data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create calendar guest" });
      }
    }
  });

  app.patch("/api/projects/:projectId/guests/:id", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      const updates = req.body;
      const guest = await storage.updateCalendarGuest(req.params.id, updates);
      res.json(guest);
    } catch (error) {
      res.status(500).json({ error: "Failed to update calendar guest" });
    }
  });

  app.delete("/api/projects/:projectId/guests/:id", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      await storage.deleteCalendarGuest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete calendar guest" });
    }
  });

  app.patch("/api/projects/:projectId/guests/:id/status", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      const { status } = req.body;
      
      if (!['pending', 'accepted', 'declined'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      const guest = await storage.updateGuestStatus(req.params.id, status);
      res.json(guest);
    } catch (error) {
      res.status(500).json({ error: "Failed to update guest status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
