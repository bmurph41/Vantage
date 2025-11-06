import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, or, desc, asc } from "drizzle-orm";
import { resolveRecipient } from "@shared/recipient-utils";
import { AIRiskAnalyzer } from "./ai-risk-analyzer";
import { AINotesEnhancer } from "./ai-notes-enhancer";
import { assigneeSubscriptionManager } from "./assignee-subscription-manager";
import { reconciliationService } from "./reconciliation-service";
import { CSVImportService } from "./csv-import-service";
import { DuplicateDetectionService } from "./duplicate-detection-service";
import { CompanyLinkingService } from "./company-linking-service";
import { CalendarService } from "./calendar-service";
import { ParserService } from "./services/salescomps/parser";
import { CompService } from "./services/salescomps/compService";
import { FilterBuilder } from "./services/salescomps/filterBuilder";
import { RecommendationService } from "./services/salescomps/recommendationService";
import { 
  insertProjectSchema, insertProjectSettingsSchema, insertDDTaskSchema, 
  insertProjectTemplateSchema, insertAuditLogSchema,
  insertTimelineNoteSchema, insertProjectShareSchema, insertRiskSchema,
  insertDDContactSchema, updateDDContactSchema, insertProjectContactSchema, insertNotificationSubscriptionSchema, insertNotificationLogSchema,
  insertCalendarEventSchema, insertDocumentRequirementSchema, insertProjectIntegrationSchema,
  insertTaskDependencySchema, insertTaskFileSchema, insertUserEmailSchema, insertCalendarGuestSchema,
  insertCddDocumentSchema, insertKpiSchema, insertFindingSchema, insertRecommendationSchema,
  insertCrmTaskSchema, insertCrmFileSchema, insertCalendarSettingsSchema,
  crmTasks, crmFiles, crmContacts, crmDeals, crmCompanies, crmPipelines, crmPipelineStages, crmActivities,
  type InsertCrmFile,
  insertScSavedSearchSchema,
  updateScSavedSearchSchema,
  insertScRecommendationFeedbackSchema,
  scProjectProfileSchema,
  scWeightOverridesSchema
} from "@shared/schema";
import { createCalendarEvent, checkCalendarAvailability } from "./lib/google-calendar";
import { 
  salesCompCreateSchema,
  salesCompUpdateSchema,
  bulkUpdateSchema,
  compColumnCreateSchema,
  compColumnUpdateSchema,
  compFiltersSchema,
  projectCreateSchema as scProjectCreateSchema,
  projectUpdateSchema as scProjectUpdateSchema,
  projectCompCreateSchema,
  projectCompUpdateSchema,
  projectCompBulkSchema,
  columnMappingSchema
} from "./utils/salescomps-zod-schemas";
import { PROFIT_CENTERS } from "@shared/salescomps-constants";
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
  app.use("/api/crm", authenticateUser);
  app.use("/api/prospecting", authenticateUser);
  // Apply authentication to CRM route aliases
  app.use("/api/leads", authenticateUser);
  app.use("/api/deals", authenticateUser);
  app.use("/api/contacts", authenticateUser);
  app.use("/api/companies", authenticateUser);
  app.use("/api/pipelines", authenticateUser);
  app.use("/api/stages", authenticateUser);
  app.use("/api/pipeline-stages", authenticateUser);
  app.use("/api/activities", authenticateUser);
  app.use("/api/sales-comps", authenticateUser);
  app.use("/api/comp-columns", authenticateUser);
  app.use("/api/sc-projects", authenticateUser);
  app.use("/api/saved-searches", authenticateUser);
  app.use("/api/profit-centers", authenticateUser);
  app.use("/api/recommendations", authenticateUser);

  // Initialize SalesComps services
  const parserService = new ParserService();
  const compService = new CompService(storage, parserService);
  const filterBuilder = new FilterBuilder();
  const recommendationService = new RecommendationService(storage);

  // Multer configuration for file uploads (SalesComps CSV/Excel imports)
  const uploadSalesComps = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
      }
    }
  });

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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
      const includeArchived = req.query.includeArchived === 'true';
      const tasks = await storage.getTasksForProject(req.params.projectId, includeArchived);
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

      const taskData = insertDDTaskSchema.parse({
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
        orgId: req.user.orgId,
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

  // Poke task owner with email reminder
  app.post("/api/dd/tasks/:id/poke", async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Get project details
      const project = await storage.getProject(task.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Authorize access
      await authorizeProjectAccess(task.projectId, req.user.orgId);

      // Get the user who is doing the poking
      const pokedByUser = await storage.getUser(req.user.id);
      const pokedByName = pokedByUser?.name || 'A team member';

      // Determine recipient email and name
      let recipientEmail: string | null = null;
      let recipientName: string = 'Team Member';

      // Try to get email from task owner first
      if (task.taskOwner) {
        const taskOwner = await storage.getUser(task.taskOwner);
        if (taskOwner?.email) {
          recipientEmail = taskOwner.email;
          recipientName = taskOwner.name;
        }
      }

      // Fallback to task assignee email if available
      if (!recipientEmail && task.assignee) {
        recipientName = task.assignee;
        // Try to find a contact with matching name
        const contacts = await storage.getContacts();
        const matchingContact = contacts.find(c => 
          c.name.toLowerCase() === task.assignee?.toLowerCase()
        );
        if (matchingContact?.email) {
          recipientEmail = matchingContact.email;
        }
      }

      // Fallback to repEmail if available
      if (!recipientEmail && task.repEmail) {
        recipientEmail = task.repEmail;
        recipientName = task.repName || task.assignee || 'Team Member';
      }

      if (!recipientEmail) {
        return res.status(400).json({ 
          error: "No email address found for task owner or assignee",
          message: "Please ensure the task has an assigned owner with an email address."
        });
      }

      // Send the poke email
      const { sendTaskPokeEmail } = await import('./sendgrid-client');
      await sendTaskPokeEmail({
        toEmail: recipientEmail,
        toName: recipientName,
        taskTitle: task.title,
        taskDeadline: task.deadline ? new Date(task.deadline).toLocaleDateString() : undefined,
        projectName: project.name,
        projectId: project.id,
        taskDescription: task.description || undefined,
        pokedBy: pokedByName
      });

      res.json({ 
        success: true,
        message: `Reminder sent to ${recipientName} (${recipientEmail})`
      });
    } catch (error) {
      console.error("Error sending poke email:", error);
      res.status(500).json({ 
        error: "Failed to send reminder",
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
      // Note: date fields (startDate, deadline, etc.) expect strings in YYYY-MM-DD format
      // Only timestamp fields (completedAt) need to be converted to Date objects
      const dateFields = ['startDate', 'deadline', 'dateEngaged', 'orderedAt', 'dateOnSite', 'baselineStart', 'baselineDue'];
      for (const field of dateFields) {
        if (taskPayload[field] === '') {
          taskPayload[field] = null;
        }
      }
      
      // Handle completedAt specially as it's a timestamp field that needs Date objects
      if (taskPayload.completedAt === '') {
        taskPayload.completedAt = null;
      } else if (typeof taskPayload.completedAt === 'string' && taskPayload.completedAt) {
        taskPayload.completedAt = new Date(taskPayload.completedAt);
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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

  // Get AI-powered risk analysis
  app.get("/api/dd/projects/:id/risks/ai-analysis", async (req: any, res) => {
    try {
      const projectId = req.params.id;
      
      // Get project data
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get risks and tasks
      const [risks, tasks] = await Promise.all([
        storage.getRisksForProject(projectId),
        storage.getTasksForProject(projectId)
      ]);

      // Calculate metrics
      const currentDate = new Date();
      const closingDate = project.closingDate ? new Date(project.closingDate) : null;
      const daysRemaining = closingDate ? Math.max(0, Math.ceil((closingDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))) : 30;
      
      const completedTasks = tasks.filter(task => task.status === 'completed').length;
      const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
      
      const overdueTasks = tasks.filter(task => {
        if (task.status === 'completed') return false;
        const deadline = new Date(task.deadline);
        return deadline < currentDate;
      }).length;

      // Initialize AI analyzer
      const aiAnalyzer = new AIRiskAnalyzer();
      
      // Perform AI analysis
      const analysis = await aiAnalyzer.analyzeRisks({
        project,
        risks,
        tasks,
        daysRemaining,
        completionRate,
        overdueTasks
      });

      res.json(analysis);
    } catch (error) {
      console.error("Error performing AI risk analysis:", error);
      res.status(500).json({ error: "Failed to perform AI risk analysis" });
    }
  });

  // === EXECUTIVE NOTES API ===
  
  // Update executive notes for a project
  app.patch("/api/dd/projects/:id/executive-notes", async (req: any, res) => {
    try {
      const { executiveNotes } = req.body;
      const projectId = req.params.id;
      
      // Update the project with new notes
      const updatedProject = await storage.updateProject(projectId, { executiveNotes });
      
      res.json({ success: true, executiveNotes: updatedProject.executiveNotes });
    } catch (error) {
      console.error("Error updating executive notes:", error);
      res.status(500).json({ error: "Failed to update executive notes" });
    }
  });

  // Get AI-enhanced narrative from executive notes
  app.get("/api/dd/projects/:id/executive-notes/ai-enhanced", async (req: any, res) => {
    try {
      const projectId = req.params.id;
      
      // Get project data
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get tasks
      const tasks = await storage.getTasksForProject(projectId);

      // Calculate metrics
      const currentDate = new Date();
      const closingDate = project.closingDate ? new Date(project.closingDate) : null;
      const daysRemaining = closingDate ? Math.max(0, Math.ceil((closingDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))) : 30;
      
      const completedTasks = tasks.filter(task => task.status === 'completed').length;
      const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
      
      const overdueTasks = tasks.filter(task => {
        if (task.status === 'completed') return false;
        if (!task.deadline) return false;
        const deadline = new Date(task.deadline);
        return deadline < currentDate;
      }).length;

      // Initialize AI enhancer
      const aiEnhancer = new AINotesEnhancer();
      
      // Perform AI enhancement
      const enhancement = await aiEnhancer.enhanceNotes({
        project,
        tasks,
        userNotes: project.executiveNotes || '',
        completionRate,
        daysRemaining,
        overdueTasks,
        totalTasks: tasks.length
      });

      res.json(enhancement);
    } catch (error) {
      console.error("Error enhancing executive notes:", error);
      res.status(500).json({ error: "Failed to enhance executive notes" });
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
      const contactData = insertDDContactSchema.parse({
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
        orgId: req.user.orgId,
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
      const updates = updateDDContactSchema.parse(req.body);
      
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

      // Create audit log only if there's a valid projectId
      // Skip audit logging for org-level contacts to avoid null constraint violation
      if (existingContact.projectId) {
        await storage.createAuditLog({
        orgId: req.user.orgId,
          projectId: existingContact.projectId,
          userId: req.user.id,
          entityType: "contact",
          entityId: req.params.id,
          action: "updated",
          before: existingContact,
          after: updatedContact,
        });
      }

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
        orgId: req.user.orgId,
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

  // Project-Contact Association Routes
  app.get("/api/dd/projects/:projectId/contacts", async (req: any, res) => {
    try {
      // Verify project access
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const projectContacts = await storage.getProjectContacts(req.params.projectId);
      res.json(projectContacts);
    } catch (error) {
      console.error("Error fetching project contacts:", error);
      res.status(500).json({ error: "Failed to fetch project contacts" });
    }
  });

  app.post("/api/dd/projects/:projectId/contacts", async (req: any, res) => {
    try {
      // Verify project access
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const projectContactData = insertProjectContactSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
      });

      // Verify contact belongs to same org
      const contact = await storage.getContactById(projectContactData.contactId);
      if (!contact || contact.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Contact not found" });
      }

      const projectContact = await storage.addContactToProject(projectContactData);
      res.json(projectContact);
    } catch (error) {
      console.error("Error adding contact to project:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid project contact data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : "Failed to add contact to project" 
        });
      }
    }
  });

  app.delete("/api/dd/projects/:projectId/contacts/:contactId/:role", async (req: any, res) => {
    try {
      // Verify project access
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      await storage.removeContactFromProject(
        req.params.projectId, 
        req.params.contactId, 
        req.params.role
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing contact from project:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to remove contact from project" 
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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
        orgId: req.user.orgId,
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

  // ====================
  // CDD Copilot Routes
  // ====================

  // CDD Document Upload Configuration
  const cddStorageConfig = multer.diskStorage({
    destination: async (req: any, file: any, cb: any) => {
      const { projectId } = req.params;
      const uploadPath = path.join("server/uploads/cdd", projectId);
      await fs.ensureDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req: any, file: any, cb: any) => {
      const uuid = crypto.randomUUID();
      const ext = path.extname(file.originalname);
      const filename = `${uuid}${ext}`;
      cb(null, filename);
    }
  });

  const cddUpload = multer({
    storage: cddStorageConfig,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max for large OMs and reports
    },
    fileFilter: (req: any, file: any, cb: any) => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, XLS, and CSV files are allowed.'), false);
      }
    }
  });

  // Upload CDD Document
  app.post("/api/dd/projects/:projectId/cdd-documents", cddUpload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      await authorizeProjectAccess(req.params.projectId, req.user.orgId);

      const documentData = insertCddDocumentSchema.parse({
        projectId: req.params.projectId,
        filename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        storagePath: req.file.path,
        uploadedBy: req.user.id,
        docType: req.body.docType || 'other',
        notes: req.body.notes || null,
      });

      const document = await storage.createCddDocument(documentData);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: req.params.projectId,
        userId: req.user.id,
        entityType: "cdd_document",
        entityId: document.id,
        action: "uploaded",
        after: document,
      });

      res.json(document);
    } catch (error: any) {
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
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      
      console.error("Error uploading CDD document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Get all CDD documents for a project
  app.get("/api/dd/projects/:projectId/cdd-documents", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      const documents = await storage.getCddDocumentsForProject(req.params.projectId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching CDD documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get specific CDD document
  app.get("/api/dd/documents/:documentId", async (req: any, res) => {
    try {
      const document = await storage.getCddDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await authorizeProjectAccess(document.projectId, req.user.orgId);
      res.json(document);
    } catch (error) {
      console.error("Error fetching CDD document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Delete CDD document
  app.delete("/api/dd/documents/:documentId", async (req: any, res) => {
    try {
      const document = await storage.getCddDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await authorizeProjectAccess(document.projectId, req.user.orgId);

      // Delete physical file
      if (document.storagePath) {
        try {
          await fs.unlink(document.storagePath);
        } catch (unlinkError) {
          console.error('Failed to delete physical file:', unlinkError);
        }
      }

      await storage.deleteCddDocument(req.params.documentId);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: document.projectId,
        userId: req.user.id,
        entityType: "cdd_document",
        entityId: document.id,
        action: "deleted",
        before: document,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting CDD document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Parse CDD Document
  app.post("/api/dd/documents/:documentId/parse", async (req: any, res) => {
    try {
      const document = await storage.getCddDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await authorizeProjectAccess(document.projectId, req.user.orgId);

      // Update status to parsing
      await storage.updateCddDocument(document.id, { 
        parseStatus: 'parsing',
        parseError: null 
      });

      try {
        // Import parser dynamically
        const { documentParser } = await import('./document-parser');
        
        // Parse the document
        const pages = await documentParser.parseDocument(document);
        
        // Delete existing pages first (in case of re-parse)
        await storage.deleteDocPagesForDocument(document.id);
        
        // Create doc page records
        const docPageRecords = documentParser.createDocPageRecords(document.id, pages);
        await storage.createDocPages(docPageRecords);

        // Update status to parsed
        const updatedDocument = await storage.updateCddDocument(document.id, { 
          parseStatus: 'parsed',
          parsedAt: new Date(),
          parseError: null 
        });

        await storage.createAuditLog({
          orgId: req.user.orgId,
          projectId: document.projectId,
          userId: req.user.id,
          entityType: "cdd_document",
          entityId: document.id,
          action: "parsed",
          after: { parsedPages: pages.length },
        });

        res.json({ 
          success: true, 
          document: updatedDocument,
          pagesCreated: pages.length 
        });
      } catch (parseError: any) {
        // Update status to failed
        await storage.updateCddDocument(document.id, { 
          parseStatus: 'failed',
          parseError: parseError.message || 'Unknown parsing error'
        });
        
        console.error("Document parsing error:", parseError);
        res.status(500).json({ error: parseError.message || "Failed to parse document" });
      }
    } catch (error) {
      console.error("Error triggering document parse:", error);
      res.status(500).json({ error: "Failed to trigger document parsing" });
    }
  });

  // Get document pages
  app.get("/api/dd/documents/:documentId/pages", async (req: any, res) => {
    try {
      const document = await storage.getCddDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await authorizeProjectAccess(document.projectId, req.user.orgId);
      
      const pages = await storage.getDocPagesForDocument(req.params.documentId);
      res.json(pages);
    } catch (error) {
      console.error("Error fetching document pages:", error);
      res.status(500).json({ error: "Failed to fetch document pages" });
    }
  });

  // Generate embeddings for a document
  app.post("/api/dd/documents/:documentId/embeddings", async (req: any, res) => {
    try {
      const document = await storage.getCddDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await authorizeProjectAccess(document.projectId, req.user.orgId);

      // Check if document has been parsed
      if (document.parseStatus !== 'parsed') {
        return res.status(400).json({ 
          error: "Document must be parsed before generating embeddings",
          parseStatus: document.parseStatus 
        });
      }

      // Get all pages for the document
      const pages = await storage.getDocPagesForDocument(document.id);
      
      if (pages.length === 0) {
        return res.status(400).json({ error: "No pages found for document" });
      }

      try {
        // Set status to processing
        await storage.updateCddDocument(document.id, { embeddingsStatus: 'processing' });

        // Import RAG service dynamically
        const { ragService } = await import('./rag-service');
        
        // Process each page and collect all vector chunks (do this BEFORE deleting existing chunks)
        const allVectorChunks = [];
        for (const page of pages) {
          const chunks = await ragService.processDocumentPage(page, document.projectId);
          allVectorChunks.push(...chunks);
        }

        // Only delete existing embeddings after successful generation
        await storage.deleteVectorChunksForDocument(document.id);
        
        // Store all vector chunks
        const createdChunks = await storage.createVectorChunks(allVectorChunks);

        // Set status to completed
        await storage.updateCddDocument(document.id, { embeddingsStatus: 'completed' });

        await storage.createAuditLog({
          orgId: req.user.orgId,
          projectId: document.projectId,
          userId: req.user.id,
          entityType: "cdd_document",
          entityId: document.id,
          action: "embeddings_generated",
          after: { chunksCreated: createdChunks.length, pagesProcessed: pages.length },
        });

        res.json({ 
          success: true, 
          chunksCreated: createdChunks.length,
          pagesProcessed: pages.length
        });
      } catch (embeddingError: any) {
        console.error("Embedding generation error:", embeddingError);
        
        // Set status to failed
        await storage.updateCddDocument(document.id, { 
          embeddingsStatus: 'failed',
          embeddingsError: embeddingError.message 
        });
        
        res.status(500).json({ error: embeddingError.message || "Failed to generate embeddings" });
      }
    } catch (error) {
      console.error("Error triggering embedding generation:", error);
      res.status(500).json({ error: "Failed to trigger embedding generation" });
    }
  });

  // Get vector chunks for a document
  app.get("/api/dd/documents/:documentId/chunks", async (req: any, res) => {
    try {
      const document = await storage.getCddDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await authorizeProjectAccess(document.projectId, req.user.orgId);
      
      const chunks = await storage.getVectorChunksForDocument(req.params.documentId);
      res.json(chunks);
    } catch (error) {
      console.error("Error fetching vector chunks:", error);
      res.status(500).json({ error: "Failed to fetch vector chunks" });
    }
  });

  // RAG Query API - Semantic search with citations
  app.post("/api/dd/projects/:projectId/rag", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      
      const { query, limit = 5 } = req.body;
      
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: "Query is required" });
      }

      try {
        // Import RAG service dynamically
        const { ragService } = await import('./rag-service');
        
        // Generate embedding for the query
        const queryEmbedding = await ragService.generateEmbedding(query.trim());
        
        // Search for relevant chunks
        const searchResults = await storage.searchVectorChunks(
          req.params.projectId, 
          queryEmbedding, 
          Math.min(limit, 20) // Cap at 20 results
        );

        // Enrich results with document and page information
        const enrichedResults = await Promise.all(
          searchResults.map(async (result) => {
            const metadata = result.metadata || {};
            const documentId = metadata.documentId;
            
            let documentName = 'Unknown Document';
            if (documentId) {
              const doc = await storage.getCddDocument(documentId);
              if (doc) {
                documentName = doc.filename;
              }
            }

            return {
              text: result.contentText,
              similarity: parseFloat(result.similarity),
              citation: {
                documentId: documentId || null,
                documentName,
                pageNo: metadata.pageNo || null,
                sourceType: result.sourceType,
                sourceId: result.sourceId,
              },
              metadata: result.metadata,
            };
          })
        );

        // Log RAG query for audit trail
        await storage.createAuditLog({
          orgId: req.user.orgId,
          projectId: req.params.projectId,
          userId: req.user.id,
          entityType: "rag_query",
          entityId: req.params.projectId,
          action: "rag_search",
          after: { 
            query: query.substring(0, 200), // Truncate for logging
            resultsCount: enrichedResults.length 
          },
        });

        res.json({
          query,
          results: enrichedResults,
          count: enrichedResults.length,
        });
      } catch (ragError: any) {
        console.error("RAG query error:", ragError);
        res.status(500).json({ error: ragError.message || "Failed to execute RAG query" });
      }
    } catch (error) {
      console.error("Error processing RAG request:", error);
      res.status(500).json({ error: "Failed to process RAG request" });
    }
  });

  // CDD Advisor Chat API - Conversational AI with function calling
  app.post("/api/dd/projects/:projectId/chat", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      try {
        // Import OpenAI and advisor tools
        const OpenAI = (await import('openai')).default;
        const { advisorTools, executeAdvisorTool } = await import('./advisor-tools');
        
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        // System prompt for CDD Advisor
        const systemPrompt = `You are a Commercial Due Diligence (CDD) Analyst AI assistant helping private equity professionals analyze marina acquisition opportunities.

Your capabilities:
- Search documents using semantic search to find relevant information
- Extract KPIs (Key Performance Indicators) from documents
- Create findings with severity ratings (low, med, high, critical)
- Create actionable recommendations with priority levels

Guidelines:
- Be concise and analytical in your responses
- Always cite sources when referencing document content
- Use proper financial terminology
- When asked about specific documents, use the search_documents tool first
- When asked to extract data, use extract_kpis_from_document
- When identifying issues or risks, create findings with appropriate severity
- When suggesting actions, create recommendations with priority levels

Current context: Project ${req.params.projectId}`;

        // Add system message at the beginning
        const messagesWithSystem = [
          { role: 'system', content: systemPrompt },
          ...messages
        ];

        // Initial API call with tools
        let response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messagesWithSystem,
          tools: advisorTools,
          tool_choice: 'auto',
        });

        let assistantMessage = response.choices[0].message;
        const toolCalls = [];
        const toolResults = [];

        // Handle tool calls if present
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          // Add assistant message with tool calls to conversation
          messagesWithSystem.push(assistantMessage);

          // Execute each tool call
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            console.log(`Executing tool: ${toolName}`, toolArgs);

            // Execute the tool with context
            const toolResult = await executeAdvisorTool(
              toolName,
              toolArgs,
              req.params.projectId,
              req.user.id,
              req.user.orgId
            );

            // Store for response
            toolCalls.push({
              id: toolCall.id,
              name: toolName,
              arguments: toolArgs,
            });

            toolResults.push({
              id: toolCall.id,
              name: toolName,
              result: toolResult,
            });

            // Add tool result to conversation
            messagesWithSystem.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult),
            });
          }

          // Get next response from model
          response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messagesWithSystem,
            tools: advisorTools,
            tool_choice: 'auto',
          });

          assistantMessage = response.choices[0].message;
        }

        // Log chat interaction for audit trail
        await storage.createAuditLog({
          orgId: req.user.orgId,
          projectId: req.params.projectId,
          userId: req.user.id,
          entityType: "cdd_chat",
          entityId: req.params.projectId,
          action: "chat_message",
          after: { 
            messageCount: messages.length,
            toolCallsExecuted: toolCalls.length,
            toolNames: toolCalls.map(t => t.name)
          },
        });

        res.json({
          message: assistantMessage.content || '',
          toolCalls,
          toolResults,
          usage: response.usage,
        });
      } catch (chatError: any) {
        console.error("Chat error:", chatError);
        res.status(500).json({ 
          error: chatError.message || "Failed to process chat request",
          details: chatError.response?.data || null
        });
      }
    } catch (error) {
      console.error("Error processing chat request:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  // KPI Management
  // Get all KPIs for a project
  app.get("/api/dd/projects/:projectId/kpis", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      
      const kpis = await storage.getKpisForProject(req.params.projectId);
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  // Create a KPI
  app.post("/api/dd/projects/:projectId/kpis", async (req: any, res) => {
    try {
      await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      
      const kpi = await storage.createKpi({
        ...req.body,
        projectId: req.params.projectId,
      });

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: req.params.projectId,
        userId: req.user.id,
        entityType: "kpi",
        entityId: kpi.id,
        action: "create",
        after: { name: kpi.name, category: kpi.category },
      });

      res.json(kpi);
    } catch (error) {
      console.error("Error creating KPI:", error);
      res.status(500).json({ error: "Failed to create KPI" });
    }
  });

  // Update a KPI
  app.put("/api/dd/kpis/:id", async (req: any, res) => {
    try {
      const existing = await storage.getKpi(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "KPI not found" });
      }

      await authorizeProjectAccess(existing.projectId, req.user.orgId);

      const updated = await storage.updateKpi(req.params.id, req.body);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: existing.projectId,
        userId: req.user.id,
        entityType: "kpi",
        entityId: updated.id,
        action: "update",
        before: { name: existing.name, valueText: existing.valueText },
        after: { name: updated.name, valueText: updated.valueText },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating KPI:", error);
      res.status(500).json({ error: "Failed to update KPI" });
    }
  });

  // Delete a KPI
  app.delete("/api/dd/kpis/:id", async (req: any, res) => {
    try {
      const existing = await storage.getKpi(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "KPI not found" });
      }

      await authorizeProjectAccess(existing.projectId, req.user.orgId);

      await storage.deleteKpi(req.params.id);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: existing.projectId,
        userId: req.user.id,
        entityType: "kpi",
        entityId: req.params.id,
        action: "delete",
        before: { name: existing.name },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting KPI:", error);
      res.status(500).json({ error: "Failed to delete KPI" });
    }
  });

  // Extract KPIs from a document using AI
  app.post("/api/dd/documents/:documentId/extract-kpis", async (req: any, res) => {
    try {
      const document = await storage.getCddDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      await authorizeProjectAccess(document.projectId, req.user.orgId);

      // Check if document has been parsed
      if (document.parseStatus !== 'parsed') {
        return res.status(400).json({ 
          error: "Document must be parsed before extracting KPIs",
          parseStatus: document.parseStatus 
        });
      }

      try {
        // Import KPI extractor
        const { kpiExtractor } = await import('./kpi-extractor');

        // Get all pages for the document
        const pages = await storage.getDocPagesForDocument(document.id);
        
        if (pages.length === 0) {
          return res.status(400).json({ error: "No pages found for document" });
        }

        // Extract KPIs from all pages
        const extractedKpis = await kpiExtractor.extractKPIsFromPages(
          pages.map(p => ({ pageNo: p.pageNo, contentText: p.contentText })),
          document.filename
        );

        // Save extracted KPIs to database
        const createdKpis = [];
        for (const kpi of extractedKpis) {
          const created = await storage.createKpi({
            projectId: document.projectId,
            name: kpi.name,
            valueText: kpi.valueText || null,
            valueNum: kpi.valueNum || null,
            unit: kpi.unit || null,
            category: kpi.category || null,
            confidence: kpi.confidence,
            sourceDocumentId: document.id,
            pageHint: kpi.pageHint || null,
          });
          createdKpis.push(created);
        }

        await storage.createAuditLog({
          orgId: req.user.orgId,
          projectId: document.projectId,
          userId: req.user.id,
          entityType: "cdd_document",
          entityId: document.id,
          action: "kpis_extracted",
          after: { kpisExtracted: createdKpis.length, documentName: document.filename },
        });

        res.json({ 
          success: true, 
          kpisExtracted: createdKpis.length,
          kpis: createdKpis
        });
      } catch (extractionError: any) {
        console.error("KPI extraction error:", extractionError);
        res.status(500).json({ error: extractionError.message || "Failed to extract KPIs" });
      }
    } catch (error) {
      console.error("Error triggering KPI extraction:", error);
      res.status(500).json({ error: "Failed to trigger KPI extraction" });
    }
  });

  // === FINDINGS MANAGEMENT API ===

  // Get all findings for a project
  app.get("/api/dd/projects/:projectId/findings", async (req: any, res) => {
    try {
      // Authorize project access
      try {
        await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      } catch (authError) {
        return res.status(403).json({ error: "Unauthorized access to project" });
      }
      
      const findings = await storage.getFindingsForProject(req.params.projectId);
      res.json(findings);
    } catch (error) {
      console.error("Error fetching findings:", error);
      res.status(500).json({ error: "Failed to fetch findings" });
    }
  });

  // Get a single finding
  app.get("/api/dd/findings/:id", async (req: any, res) => {
    try {
      const finding = await storage.getFinding(req.params.id);
      if (!finding) {
        return res.status(404).json({ error: "Finding not found" });
      }

      // Authorize project access
      try {
        await authorizeProjectAccess(finding.projectId, req.user.orgId);
      } catch (authError) {
        return res.status(403).json({ error: "Unauthorized access to project" });
      }

      res.json(finding);
    } catch (error) {
      console.error("Error fetching finding:", error);
      res.status(500).json({ error: "Failed to fetch finding" });
    }
  });

  // Create a new finding
  app.post("/api/dd/findings", async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = insertFindingSchema.parse({
        ...req.body,
        createdBy: req.user.id,
      });

      // Authorize project access
      try {
        await authorizeProjectAccess(validatedData.projectId, req.user.orgId);
      } catch (authError) {
        return res.status(403).json({ error: "Unauthorized access to project" });
      }

      const finding = await storage.createFinding(validatedData);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: finding.projectId,
        userId: req.user.id,
        entityType: "finding",
        entityId: finding.id,
        action: "create",
        after: { title: finding.title, severity: finding.severity },
      });

      res.json(finding);
    } catch (error: any) {
      console.error("Error creating finding:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid finding data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create finding" });
    }
  });

  // Update a finding
  app.put("/api/dd/findings/:id", async (req: any, res) => {
    try {
      const existing = await storage.getFinding(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Finding not found" });
      }

      // Authorize project access
      try {
        await authorizeProjectAccess(existing.projectId, req.user.orgId);
      } catch (authError) {
        return res.status(403).json({ error: "Unauthorized access to project" });
      }

      // Prepare update data - strip immutable fields
      const { createdBy, ...updateFields } = req.body;
      
      // Validate update data (partial schema)
      const validatedData = insertFindingSchema.partial().omit({ createdBy: true }).parse(updateFields);
      
      // Prevent projectId reassignment
      if (validatedData.projectId && validatedData.projectId !== existing.projectId) {
        return res.status(400).json({ error: "Cannot change project assignment of a finding" });
      }

      const updated = await storage.updateFinding(req.params.id, validatedData);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: existing.projectId,
        userId: req.user.id,
        entityType: "finding",
        entityId: req.params.id,
        action: "update",
        before: { title: existing.title, severity: existing.severity },
        after: { title: updated.title, severity: updated.severity },
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating finding:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid finding data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update finding" });
    }
  });

  // Delete a finding
  app.delete("/api/dd/findings/:id", async (req: any, res) => {
    try {
      const existing = await storage.getFinding(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Finding not found" });
      }

      // Authorize project access
      try {
        await authorizeProjectAccess(existing.projectId, req.user.orgId);
      } catch (authError) {
        return res.status(403).json({ error: "Unauthorized access to project" });
      }

      await storage.deleteFinding(req.params.id);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: existing.projectId,
        userId: req.user.id,
        entityType: "finding",
        entityId: req.params.id,
        action: "delete",
        before: { title: existing.title },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting finding:", error);
      res.status(500).json({ error: "Failed to delete finding" });
    }
  });

  // CDD Reports Management
  // Get all reports for a project
  app.get("/api/dd/projects/:projectId/reports", async (req: any, res) => {
    try {
      try {
        await authorizeProjectAccess(req.params.projectId, req.user.orgId);
      } catch (authError: any) {
        if (authError.message === "Project not found") {
          return res.status(404).json({ error: "Project not found" });
        }
        return res.status(403).json({ error: "Unauthorized access to project" });
      }
      
      const reports = await storage.getCddReportsForProject(req.params.projectId);
      
      // Audit log for read access
      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: req.params.projectId,
        userId: req.user.id,
        entityType: "cdd_report",
        entityId: req.params.projectId,
        action: "list",
        after: { count: reports.length },
      });
      
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  // Get a single report
  app.get("/api/dd/reports/:id", async (req: any, res) => {
    try {
      const report = await storage.getCddReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      try {
        await authorizeProjectAccess(report.projectId, req.user.orgId);
      } catch (authError: any) {
        if (authError.message === "Project not found") {
          return res.status(404).json({ error: "Project not found" });
        }
        return res.status(403).json({ error: "Unauthorized access to project" });
      }
      
      // Audit log for read access
      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: report.projectId,
        userId: req.user.id,
        entityType: "cdd_report",
        entityId: req.params.id,
        action: "read",
        after: { title: report.title, version: report.version },
      });
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  // Create a new report
  app.post("/api/dd/reports", async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = insertCddReportSchema.parse(req.body);
      
      // Authorize project access
      try {
        await authorizeProjectAccess(validatedData.projectId, req.user.orgId);
      } catch (authError: any) {
        if (authError.message === "Project not found") {
          return res.status(404).json({ error: "Project not found" });
        }
        return res.status(403).json({ error: "Unauthorized access to project" });
      }
      
      const report = await storage.createCddReport({
        ...validatedData,
        createdBy: req.user.id,
      });

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: report.projectId,
        userId: req.user.id,
        entityType: "cdd_report",
        entityId: report.id,
        action: "create",
        after: { title: report.title, version: report.version },
      });

      res.json(report);
    } catch (error: any) {
      console.error("Error creating report:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid report data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  // Update a report
  app.put("/api/dd/reports/:id", async (req: any, res) => {
    try {
      const existing = await storage.getCddReport(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Report not found" });
      }

      // Authorize project access
      try {
        await authorizeProjectAccess(existing.projectId, req.user.orgId);
      } catch (authError: any) {
        if (authError.message === "Project not found") {
          return res.status(404).json({ error: "Project not found" });
        }
        return res.status(403).json({ error: "Unauthorized access to project" });
      }

      // Validate update data (using partial schema)
      const validatedData = insertCddReportSchema.partial().parse(req.body);
      
      // Prevent changing immutable fields
      delete (validatedData as any).projectId;
      delete (validatedData as any).createdBy;

      const updated = await storage.updateCddReport(req.params.id, validatedData);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: existing.projectId,
        userId: req.user.id,
        entityType: "cdd_report",
        entityId: req.params.id,
        action: "update",
        before: { title: existing.title, version: existing.version },
        after: { title: updated.title, version: updated.version },
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating report:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid report data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  // Delete a report
  app.delete("/api/dd/reports/:id", async (req: any, res) => {
    try {
      const existing = await storage.getCddReport(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Report not found" });
      }

      try {
        await authorizeProjectAccess(existing.projectId, req.user.orgId);
      } catch (authError: any) {
        if (authError.message === "Project not found") {
          return res.status(404).json({ error: "Project not found" });
        }
        return res.status(403).json({ error: "Unauthorized access to project" });
      }

      await storage.deleteCddReport(req.params.id);

      await storage.createAuditLog({
        orgId: req.user.orgId,
        projectId: existing.projectId,
        userId: req.user.id,
        entityType: "cdd_report",
        entityId: req.params.id,
        action: "delete",
        before: { title: existing.title },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });


  // Organization-level Audit Logs
  app.get("/api/audit-logs", async (req: any, res) => {
    try {
      const { action, entity: entityType, search, userId, startDate, endDate, limit } = req.query;
      
      const filters: any = {};
      if (action && action !== 'all') filters.action = action;
      if (entityType && entityType !== 'all') filters.entityType = entityType;
      if (userId) filters.userId = userId;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      if (limit) filters.limit = parseInt(limit);
      
      const logs = await storage.getAuditLogsForOrg(req.user.orgId, filters);
      res.json(logs);
    } catch (error) {
      console.error("Failed to get audit logs:", error);
      res.status(500).json({ error: "Failed to retrieve audit logs" });
    }
  });

  // ==================== CRM ROUTES ====================

  // CRM Deals
  app.get("/api/crm/deals", async (req: any, res) => {
    try {
      const deals = await storage.getCrmDealsForOrg(req.user.orgId);
      res.json(deals);
    } catch (error) {
      console.error("Failed to get deals:", error);
      res.status(500).json({ error: "Failed to retrieve deals" });
    }
  });

  app.post("/api/crm/deals", async (req: any, res) => {
    try {
      const deal = await storage.createCrmDeal({ ...req.body, ownerId: req.user.id });
      res.json(deal);
    } catch (error) {
      console.error("Failed to create deal:", error);
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.put("/api/crm/deals/:id", async (req: any, res) => {
    try {
      let updateData = { ...req.body };
      
      // Auto-close deal if stage name is "Closed"
      if (updateData.stageId) {
        const stage = await storage.getCrmStage(updateData.stageId);
        if (stage && stage.name.toLowerCase() === 'closed') {
          updateData.isClosed = true;
          updateData.closedAt = new Date().toISOString();
        }
      }
      
      const deal = await storage.updateCrmDeal(req.params.id, updateData);
      res.json(deal);
    } catch (error) {
      console.error("Failed to update deal:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  app.delete("/api/crm/deals/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmDeal(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // Convert Deal to DD Project
  app.post("/api/deals/convert-to-project", async (req: any, res) => {
    try {
      const {
        dealId,
        projectName,
        includeDescription,
        includeContacts,
        includeFinancials,
        includeLocation,
        ddPeriodDays,
        createDefaultTasks,
        notes
      } = req.body;

      // Get the deal
      const deal = await storage.getCrmDeal(dealId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      // Create the DD project with mapped data from deal
      const projectData: any = {
        name: projectName,
        orgId: req.user.orgId,
        createdBy: req.user.id,
        // Map all DD Deal Details fields from deal to project
        anchorType: deal.anchorType || 'psa',
        ddPeriodDays: deal.ddPeriodDays || ddPeriodDays,
        hasExtensions: deal.hasExtensions || false,
        extensionCount: deal.extensionCount || 0,
        extensionDays: deal.extensionDays || [],
        daysToClosing: deal.daysToClosing || null,
        tz: deal.tz || 'America/New_York',
        psaSignedDate: deal.psaSignedDate || null,
        ddExpirationDate: deal.ddExpirationDate || null,
        closingDate: deal.closingDate || null,
        // Key Contacts
        seller: deal.seller || [],
        ourAttorney: deal.ourAttorney || [],
        titleInsuranceCompany: deal.titleInsuranceCompany || null,
        lender: deal.lender || null,
        // Deposit Information
        firstDepositAmount: deal.firstDepositAmount || null,
        firstDepositDays: deal.firstDepositDays || null,
        firstDepositDueDate: deal.firstDepositDueDate || null,
        secondDepositAmount: deal.secondDepositAmount || null,
        secondDepositDays: deal.secondDepositDays || null,
        secondDepositDueDate: deal.secondDepositDueDate || null,
        customDeadlines: deal.customDeadlines || [],
        // Lease Information
        leases: deal.leases || [],
      };

      // Map description
      if (includeDescription && deal.description) {
        projectData.description = deal.description;
        if (notes) {
          projectData.description = `${deal.description}\n\n--- Conversion Notes ---\n${notes}`;
        }
      } else if (notes) {
        projectData.description = notes;
      }

      // Map location
      if (includeLocation) {
        if (deal.city) projectData.city = deal.city;
        if (deal.state) projectData.state = deal.state;
        // Store marina name and dock location in executive notes or custom field
        const locationNotes = [];
        if (deal.marinaName) locationNotes.push(`Marina: ${deal.marinaName}`);
        if (deal.dockLocation) locationNotes.push(`Dock: ${deal.dockLocation}`);
        if (locationNotes.length > 0) {
          projectData.executiveNotes = locationNotes.join('\n');
        }
      }

      // Map financials
      if (includeFinancials) {
        const dealAmount = deal.amount || deal.value;
        if (dealAmount) {
          projectData.purchasePrice = parseInt(dealAmount.toString().replace(/[^0-9]/g, '')) || 0;
        }
        
        // Map property details if available
        if (deal.propertyDetails) {
          const details = typeof deal.propertyDetails === 'string' 
            ? JSON.parse(deal.propertyDetails) 
            : deal.propertyDetails;
          
          if (details.grossRevenue) {
            projectData.projectedAnnualRevenue = parseInt(details.grossRevenue.toString().replace(/[^0-9]/g, '')) || 0;
          }
        }
      }

      // Create the project
      const project = await storage.createProject(projectData);

      // Create default project settings (map from deal if available)
      await storage.createOrUpdateProjectSettings({
        projectId: project.id,
        useBusinessDays: deal.useBusinessDays !== undefined ? deal.useBusinessDays : true,
        holidayCalendar: (deal.holidayCalendar || 'us_federal') as 'us_federal' | 'none',
        emailReminders: true,
        slackNotifications: false,
        ndaRequired: false
      });

      // Map contacts if requested
      if (includeContacts && deal.primaryContactId) {
        try {
          const contact = await storage.getCrmContact(deal.primaryContactId);
          if (contact) {
            // Create a DD contact from the CRM contact
            await storage.createDDContact({
              projectId: project.id,
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email || '',
              phone: contact.phone || undefined,
              role: 'seller' as const,
              company: contact.company || undefined
            });
          }
        } catch (err) {
          console.error("Failed to map contact:", err);
          // Continue even if contact mapping fails
        }
      }

      // Create default DD tasks if requested
      if (createDefaultTasks) {
        const defaultTasks = [
          {
            name: 'Property Condition Assessment (PCA)',
            description: 'Comprehensive inspection of marina facilities and structures',
            category: 'inspection' as const,
            priority: 'high' as const,
            durationDays: 7
          },
          {
            name: 'Environmental Site Assessment (ESA Phase I)',
            description: 'Environmental assessment for potential contamination',
            category: 'ESA' as const,
            priority: 'high' as const,
            durationDays: 14
          },
          {
            name: 'Boundary Survey',
            description: 'Professional survey of property boundaries and improvements',
            category: 'survey' as const,
            priority: 'high' as const,
            durationDays: 10
          },
          {
            name: 'Title Search & Insurance',
            description: 'Title examination and commitment for title insurance',
            category: 'title' as const,
            priority: 'high' as const,
            durationDays: 7
          },
          {
            name: 'Financial Review',
            description: 'Review of financial statements and operating history',
            category: 'financial' as const,
            priority: 'med' as const,
            durationDays: 5
          },
          {
            name: 'Permits & Zoning Review',
            description: 'Verification of permits and zoning compliance',
            category: 'zoning' as const,
            priority: 'med' as const,
            durationDays: 7
          }
        ];

        for (const task of defaultTasks) {
          await storage.createTask({
            projectId: project.id,
            ...task,
            status: 'not_started' as const,
            assigneeType: 'internal' as const
          });
        }
      }

      // Update the deal to mark it as converted
      await storage.updateCrmDeal(dealId, {
        ...deal,
        ddProjectId: project.id
      });

      res.json({
        success: true,
        projectId: project.id,
        message: "Deal successfully converted to DD project"
      });
    } catch (error) {
      console.error("Failed to convert deal to project:", error);
      res.status(500).json({ error: "Failed to convert deal to project" });
    }
  });

  // CRM Leads
  app.get("/api/crm/leads", async (req: any, res) => {
    try {
      const leads = await storage.getCrmLeadsForOrg(req.user.orgId);
      res.json(leads);
    } catch (error) {
      console.error("Failed to get leads:", error);
      res.status(500).json({ error: "Failed to retrieve leads" });
    }
  });

  app.post("/api/crm/leads", async (req: any, res) => {
    try {
      const lead = await storage.createCrmLead({ ...req.body, assignedToId: req.user.id });
      res.json(lead);
    } catch (error) {
      console.error("Failed to create lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.put("/api/crm/leads/:id", async (req: any, res) => {
    try {
      const lead = await storage.updateCrmLead(req.params.id, req.body);
      res.json(lead);
    } catch (error) {
      console.error("Failed to update lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/crm/leads/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmLead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete lead:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // CRM Contacts
  app.get("/api/crm/contacts", async (req: any, res) => {
    try {
      const contacts = await storage.getCrmContactsForOrg(req.user.orgId);
      res.json(contacts);
    } catch (error) {
      console.error("Failed to get contacts:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });

  app.post("/api/crm/contacts", async (req: any, res) => {
    try {
      const contact = await storage.createCrmContact({ ...req.body, ownerId: req.user.id });
      res.json(contact);
    } catch (error) {
      console.error("Failed to create contact:", error);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.put("/api/crm/contacts/:id", async (req: any, res) => {
    try {
      const contact = await storage.updateCrmContact(req.params.id, req.body);
      res.json(contact);
    } catch (error) {
      console.error("Failed to update contact:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/crm/contacts/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmContact(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete contact:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // CRM Companies
  app.get("/api/crm/companies", async (req: any, res) => {
    try {
      const companies = await storage.getCrmCompaniesForOrg(req.user.orgId);
      res.json(companies);
    } catch (error) {
      console.error("Failed to get companies:", error);
      res.status(500).json({ error: "Failed to retrieve companies" });
    }
  });

  app.post("/api/crm/companies", async (req: any, res) => {
    try {
      const company = await storage.createCrmCompany({ ...req.body, ownerId: req.user.id });
      res.json(company);
    } catch (error) {
      console.error("Failed to create company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.put("/api/crm/companies/:id", async (req: any, res) => {
    try {
      const company = await storage.updateCrmCompany(req.params.id, req.body);
      res.json(company);
    } catch (error) {
      console.error("Failed to update company:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/crm/companies/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmCompany(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  // CRM Pipelines
  app.get("/api/crm/pipelines", async (req: any, res) => {
    try {
      const pipelines = await storage.getCrmPipelinesForOrg(req.user.orgId);
      res.json(pipelines);
    } catch (error) {
      console.error("Failed to get pipelines:", error);
      res.status(500).json({ error: "Failed to retrieve pipelines" });
    }
  });

  app.post("/api/crm/pipelines", async (req: any, res) => {
    try {
      const pipeline = await storage.createCrmPipeline({ ...req.body, ownerId: req.user.id });
      res.json(pipeline);
    } catch (error) {
      console.error("Failed to create pipeline:", error);
      res.status(500).json({ error: "Failed to create pipeline" });
    }
  });

  app.put("/api/crm/pipelines/:id", async (req: any, res) => {
    try {
      const pipeline = await storage.updateCrmPipeline(req.params.id, req.body);
      res.json(pipeline);
    } catch (error) {
      console.error("Failed to update pipeline:", error);
      res.status(500).json({ error: "Failed to update pipeline" });
    }
  });

  app.delete("/api/crm/pipelines/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmPipeline(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete pipeline:", error);
      res.status(500).json({ error: "Failed to delete pipeline" });
    }
  });

  // CRM Pipeline Stages
  app.get("/api/pipeline-stages", async (req: any, res) => {
    try {
      const stages = await storage.getAllCrmPipelineStages(req.user.orgId);
      res.json(stages);
    } catch (error) {
      console.error("Failed to get all pipeline stages:", error);
      res.status(500).json({ error: "Failed to retrieve pipeline stages" });
    }
  });

  app.get("/api/crm/pipelines/:pipelineId/stages", async (req: any, res) => {
    try {
      const stages = await storage.getCrmPipelineStagesByPipeline(req.params.pipelineId);
      res.json(stages);
    } catch (error) {
      console.error("Failed to get pipeline stages:", error);
      res.status(500).json({ error: "Failed to retrieve pipeline stages" });
    }
  });

  app.post("/api/crm/pipeline-stages", async (req: any, res) => {
    try {
      const stage = await storage.createCrmPipelineStage(req.body);
      res.json(stage);
    } catch (error) {
      console.error("Failed to create pipeline stage:", error);
      res.status(500).json({ error: "Failed to create pipeline stage" });
    }
  });

  app.put("/api/crm/pipeline-stages/:id", async (req: any, res) => {
    try {
      const stage = await storage.updateCrmPipelineStage(req.params.id, req.body);
      res.json(stage);
    } catch (error) {
      console.error("Failed to update pipeline stage:", error);
      res.status(500).json({ error: "Failed to update pipeline stage" });
    }
  });

  app.delete("/api/crm/pipeline-stages/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmPipelineStage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete pipeline stage:", error);
      res.status(500).json({ error: "Failed to delete pipeline stage" });
    }
  });

  // CRM Activities
  app.get("/api/crm/activities", async (req: any, res) => {
    try {
      const activities = await storage.getCrmActivitiesForOrg(req.user.id);
      res.json(activities);
    } catch (error) {
      console.error("Failed to get activities:", error);
      res.status(500).json({ error: "Failed to retrieve activities" });
    }
  });

  app.post("/api/crm/activities", async (req: any, res) => {
    try {
      const activity = await storage.createCrmActivity({ ...req.body, userId: req.user.id });
      res.json(activity);
    } catch (error) {
      console.error("Failed to create activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  app.put("/api/crm/activities/:id", async (req: any, res) => {
    try {
      const activity = await storage.updateCrmActivity(req.params.id, req.body);
      res.json(activity);
    } catch (error) {
      console.error("Failed to update activity:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  app.delete("/api/crm/activities/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmActivity(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete activity:", error);
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });

  // CRM Tasks
  app.get("/api/crm/tasks", async (req: any, res) => {
    try {
      const tasks = await db.query.crmTasks.findMany({
        where: eq(crmTasks.assigneeId, req.user.id),
        orderBy: [desc(crmTasks.createdAt)],
      });
      res.json(tasks);
    } catch (error) {
      console.error("Failed to get tasks:", error);
      res.status(500).json({ error: "Failed to retrieve tasks" });
    }
  });

  app.post("/api/crm/tasks", async (req: any, res) => {
    try {
      const taskData = insertCrmTaskSchema.parse({
        ...req.body,
        assigneeId: req.user.id,
      });
      const [task] = await db.insert(crmTasks).values(taskData).returning();
      res.json(task);
    } catch (error) {
      console.error("Failed to create task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.put("/api/crm/tasks/:id", async (req: any, res) => {
    try {
      // First, verify the task exists and belongs to the user
      const existingTask = await db.query.crmTasks.findFirst({
        where: eq(crmTasks.id, req.params.id),
      });

      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (existingTask.assigneeId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized: You can only update your own tasks" });
      }

      // Parse and sanitize updates - prevent changing assigneeId
      const updates = insertCrmTaskSchema.partial().parse(req.body);
      delete (updates as any).assigneeId; // Prevent reassignment

      const [task] = await db
        .update(crmTasks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(crmTasks.id, req.params.id))
        .returning();
      res.json(task);
    } catch (error) {
      console.error("Failed to update task:", error);
      // Return 400 for validation errors, 500 for other errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/crm/tasks/:id", async (req: any, res) => {
    try {
      // First, verify the task exists and belongs to the user
      const existingTask = await db.query.crmTasks.findFirst({
        where: eq(crmTasks.id, req.params.id),
      });

      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (existingTask.assigneeId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized: You can only delete your own tasks" });
      }

      await db.delete(crmTasks).where(eq(crmTasks.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ===================================================================
  // CRM Files API Routes - File attachments for CRM entities
  // ===================================================================

  // Configure multer storage for CRM files
  const crmFileStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadPath = path.join("server/uploads/crm");
      await fs.ensureDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
    }
  });

  const crmFileUpload = multer({
    storage: crmFileStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow common file types
      const allowedMimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'text/plain'
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`));
      }
    }
  });

  // Upload file
  app.post("/api/crm/files", crmFileUpload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(console.error);
        return res.status(400).json({ error: "entityType and entityId are required" });
      }

      // Verify entity exists and belongs to the user
      let entity;
      if (entityType === 'contact') {
        entity = await db.query.crmContacts.findFirst({
          where: and(eq(crmContacts.id, entityId), eq(crmContacts.ownerId, req.user.id)),
        });
      } else if (entityType === 'company') {
        entity = await db.query.crmCompanies.findFirst({
          where: and(eq(crmCompanies.id, entityId), eq(crmCompanies.ownerId, req.user.id)),
        });
      } else if (entityType === 'deal') {
        entity = await db.query.crmDeals.findFirst({
          where: and(eq(crmDeals.id, entityId), eq(crmDeals.ownerId, req.user.id)),
        });
      }

      if (!entity) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(console.error);
        return res.status(404).json({ error: `${entityType} not found or unauthorized` });
      }

      const fileData: InsertCrmFile = {
        name: req.file.originalname,
        fileName: req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: `/uploads/crm/${req.file.filename}`,
        entityType,
        entityId,
        uploadedById: req.user.id,
        ownerId: req.user.id,
      };

      const [file] = await db.insert(crmFiles).values(fileData).returning();
      res.json(file);
    } catch (error) {
      console.error("Error uploading CRM file:", error);
      // Clean up file if database insert failed
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid file data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Get files for an entity
  app.get("/api/crm/files/:entityType/:entityId", async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;

      // Verify entity exists and belongs to the user
      let entity;
      if (entityType === 'contact') {
        entity = await db.query.crmContacts.findFirst({
          where: and(eq(crmContacts.id, entityId), eq(crmContacts.ownerId, req.user.id)),
        });
      } else if (entityType === 'company') {
        entity = await db.query.crmCompanies.findFirst({
          where: and(eq(crmCompanies.id, entityId), eq(crmCompanies.ownerId, req.user.id)),
        });
      } else if (entityType === 'deal') {
        entity = await db.query.crmDeals.findFirst({
          where: and(eq(crmDeals.id, entityId), eq(crmDeals.ownerId, req.user.id)),
        });
      }

      if (!entity) {
        return res.status(404).json({ error: `${entityType} not found or unauthorized` });
      }

      const files = await db.query.crmFiles.findMany({
        where: and(
          eq(crmFiles.entityType, entityType),
          eq(crmFiles.entityId, entityId),
          eq(crmFiles.ownerId, req.user.id)
        ),
        orderBy: [desc(crmFiles.createdAt)],
      });

      res.json(files);
    } catch (error) {
      console.error("Failed to retrieve files:", error);
      res.status(500).json({ error: "Failed to retrieve files" });
    }
  });

  // Download file
  app.get("/api/crm/files/:id/download", async (req: any, res) => {
    try {
      const file = await db.query.crmFiles.findFirst({
        where: and(
          eq(crmFiles.id, req.params.id),
          eq(crmFiles.ownerId, req.user.id)
        ),
      });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Verify the file's entity belongs to the user
      let entity;
      if (file.entityType === 'contact') {
        entity = await db.query.crmContacts.findFirst({
          where: and(eq(crmContacts.id, file.entityId), eq(crmContacts.ownerId, req.user.id)),
        });
      } else if (file.entityType === 'company') {
        entity = await db.query.crmCompanies.findFirst({
          where: and(eq(crmCompanies.id, file.entityId), eq(crmCompanies.ownerId, req.user.id)),
        });
      } else if (file.entityType === 'deal') {
        entity = await db.query.crmDeals.findFirst({
          where: and(eq(crmDeals.id, file.entityId), eq(crmDeals.ownerId, req.user.id)),
        });
      }

      if (!entity) {
        return res.status(403).json({ error: "Unauthorized: Entity not found or not owned by you" });
      }

      const filePath = path.join(process.cwd(), "server/uploads/crm", file.fileName);
      
      // Check if file exists
      const fileExists = await fs.pathExists(filePath);
      if (!fileExists) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.download(filePath, file.name);
    } catch (error) {
      console.error("Failed to download file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Delete file
  app.delete("/api/crm/files/:id", async (req: any, res) => {
    try {
      const file = await db.query.crmFiles.findFirst({
        where: and(
          eq(crmFiles.id, req.params.id),
          eq(crmFiles.ownerId, req.user.id)
        ),
      });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Verify the file's entity belongs to the user
      let entity;
      if (file.entityType === 'contact') {
        entity = await db.query.crmContacts.findFirst({
          where: and(eq(crmContacts.id, file.entityId), eq(crmContacts.ownerId, req.user.id)),
        });
      } else if (file.entityType === 'company') {
        entity = await db.query.crmCompanies.findFirst({
          where: and(eq(crmCompanies.id, file.entityId), eq(crmCompanies.ownerId, req.user.id)),
        });
      } else if (file.entityType === 'deal') {
        entity = await db.query.crmDeals.findFirst({
          where: and(eq(crmDeals.id, file.entityId), eq(crmDeals.ownerId, req.user.id)),
        });
      }

      if (!entity) {
        return res.status(403).json({ error: "Unauthorized: Entity not found or not owned by you" });
      }

      // Delete from database
      await db.delete(crmFiles).where(eq(crmFiles.id, req.params.id));

      // Delete file from filesystem
      const filePath = path.join(process.cwd(), "server/uploads/crm", file.fileName);
      await fs.unlink(filePath).catch((err) => {
        console.error('Failed to delete file from disk:', err);
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // ===================================================================
  // CRM Import System - CSV Import for Contacts
  // ===================================================================

  // Create import job - Upload CSV and auto-detect mappings
  app.post("/api/crm/imports", async (req: any, res) => {
    try {
      const { fileName, csvContent, entityType = 'contacts' } = req.body;

      if (!csvContent || !fileName) {
        return res.status(400).json({ error: "CSV content and file name are required" });
      }

      // Parse CSV
      const parsed = CSVImportService.parseCSV(csvContent);
      
      // Auto-detect field mappings based on entity type
      const fieldMappingsArray = CSVImportService.autoDetectMappings(parsed.headers, entityType);
      
      // Convert array to record for frontend
      const fieldMappingsRecord: Record<string, string> = {};
      for (const mapping of fieldMappingsArray) {
        fieldMappingsRecord[mapping.csvColumn] = mapping.crmField;
      }

      // Create import job
      const importJob = await storage.createImportJob({
        fileName,
        fileSize: csvContent.length,
        totalRows: parsed.totalRows,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        duplicatesFound: 0,
        importType: entityType,
        fieldMappings: fieldMappingsArray,
        duplicateStrategy: 'skip',
        status: 'pending',
        currentStep: 'upload_complete',
        progress: 0,
        errorLog: [],
        validationWarnings: [],
        importSummary: {},
        csvData: parsed.rows,
        originalHeaders: parsed.headers,
        canRollback: true,
        ownerId: req.user.id,
      });

      res.json({
        importJob,
        preview: {
          headers: parsed.headers,
          totalRows: parsed.totalRows,
          mappings: fieldMappingsRecord,
        },
      });
    } catch (error: any) {
      console.error("Failed to create import job:", error);
      res.status(500).json({ error: error.message || "Failed to create import job" });
    }
  });

  // Get import job details
  app.get("/api/crm/imports/:id", async (req: any, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      
      if (!importJob) {
        return res.status(404).json({ error: "Import job not found" });
      }

      if (importJob.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(importJob);
    } catch (error) {
      console.error("Failed to get import job:", error);
      res.status(500).json({ error: "Failed to retrieve import job" });
    }
  });

  // List all import jobs for user
  app.get("/api/crm/imports", async (req: any, res) => {
    try {
      const importJobs = await storage.getImportJobsForOrg(req.user.id);
      res.json(importJobs);
    } catch (error) {
      console.error("Failed to get import jobs:", error);
      res.status(500).json({ error: "Failed to retrieve import jobs" });
    }
  });

  // Generate preview with duplicate detection
  app.post("/api/crm/imports/:id/preview", async (req: any, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      
      if (!importJob) {
        return res.status(404).json({ error: "Import job not found" });
      }

      if (importJob.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { fieldMappings: fieldMappingsFromReq } = req.body;
      
      // Convert field mappings from record to array if provided
      let mappingsArray = importJob.fieldMappings as any[];
      if (fieldMappingsFromReq) {
        mappingsArray = Object.entries(fieldMappingsFromReq).map(([csvColumn, crmField]) => ({
          csvColumn,
          crmField,
        }));
        await storage.updateImportJob(req.params.id, { fieldMappings: mappingsArray });
      }

      const csvData = importJob.csvData as any[];
      const previewRows = csvData.slice(0, 50);

      // Process preview rows with duplicate detection
      const previewResults = await Promise.all(
        previewRows.map(async (row: any, index: number) => {
          const transformedContact = CSVImportService.transformRow(row, mappingsArray);
          const duplicateResult = await DuplicateDetectionService.findDuplicates(
            transformedContact,
            req.user.id
          );

          // Validate row
          const validationIssues = CSVImportService.validateContact(transformedContact);

          return {
            rowNumber: index + 1,
            data: transformedContact,
            duplicateStatus: duplicateResult.isDuplicate
              ? duplicateResult.matches[0].confidence >= 90
                ? 'Exact'
                : 'Possible'
              : 'None',
            duplicateMatch: duplicateResult.isDuplicate ? duplicateResult.matches[0].existingContact : null,
            validationIssues,
            recommendation: duplicateResult.recommendation,
          };
        })
      );

      // Update import job with preview results
      const duplicatesCount = previewResults.filter(r => r.duplicateStatus !== 'None').length;
      const warningsCount = previewResults.filter(r => r.validationIssues.length > 0).length;

      await storage.updateImportJob(req.params.id, {
        currentStep: 'preview',
        validationWarnings: previewResults
          .filter(r => r.validationIssues.length > 0)
          .map(r => ({
            row: r.rowNumber,
            issues: r.validationIssues,
          })),
      });

      res.json({
        preview: previewResults,
        summary: {
          totalRows: previewRows.length,
          duplicates: duplicatesCount,
          warnings: warningsCount,
        },
      });
    } catch (error: any) {
      console.error("Failed to generate preview:", error);
      res.status(500).json({ error: error.message || "Failed to generate preview" });
    }
  });

  // Execute import with progress tracking
  app.post("/api/crm/imports/:id/execute", async (req: any, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      
      if (!importJob) {
        return res.status(404).json({ error: "Import job not found" });
      }

      if (importJob.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { duplicateStrategy } = req.body;

      // Update import job status
      await storage.updateImportJob(req.params.id, {
        status: 'processing',
        currentStep: 'importing',
        progress: 0,
        duplicateStrategy: duplicateStrategy || 'skip',
      });

      // Process import in batches
      const csvData = importJob.csvData as any[];
      const mappings = importJob.fieldMappings as any;
      const batchSize = 100;
      
      let successfulRows = 0;
      let failedRows = 0;
      let duplicatesFound = 0;
      const errors: any[] = [];

      for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        
        for (let j = 0; j < batch.length; j++) {
          const rowIndex = i + j;
          const row = batch[j];
          
          try {
            // Transform row to contact data
            const contactData = CSVImportService.transformRow(row, mappings);
            
            // Check for duplicates
            const duplicateResult = await DuplicateDetectionService.findDuplicates(
              contactData,
              req.user.id
            );

            let action = 'created';
            let recordId = '';
            let wasNew = true;

            if (duplicateResult.isDuplicate) {
              duplicatesFound++;
              
              if (duplicateStrategy === 'skip') {
                // Skip duplicate
                continue;
              } else if (duplicateStrategy === 'update') {
                // Update existing record based on entity type
                const existingRecord = duplicateResult.matches[0].existingContact;
                const mergedData = DuplicateDetectionService.mergeContactData(existingRecord, contactData);
                
                let updated;
                if (importJob.importType === 'companies') {
                  updated = await storage.updateCrmCompany(existingRecord.id, mergedData);
                } else if (importJob.importType === 'properties') {
                  updated = await storage.updateProperty(existingRecord.id, mergedData);
                } else {
                  updated = await storage.updateCrmContact(existingRecord.id, mergedData);
                }
                recordId = updated.id;
                action = 'updated';
                wasNew = false;
              }
            } else {
              // Create new record based on entity type
              if (importJob.importType === 'companies') {
                const company = await storage.createCrmCompany({
                  ...contactData,
                  ownerId: req.user.id,
                });
                recordId = company.id;
              } else if (importJob.importType === 'properties') {
                const property = await storage.createProperty({
                  ...contactData,
                  ownerId: req.user.id,
                });
                recordId = property.id;
              } else {
                // Link company if provided for contacts
                if (contactData.company) {
                  const companyResult = await CompanyLinkingService.linkCompany(
                    contactData.company,
                    req.user.id
                  );
                  if (companyResult.companyId) {
                    contactData.companyId = companyResult.companyId;
                  }
                }

                // Create new contact
                const contact = await storage.createCrmContact({
                  ...contactData,
                  ownerId: req.user.id,
                });
                recordId = contact.id;
              }
            }

            // Record import
            await storage.createImportedRecord({
              importJobId: req.params.id,
              recordType: importJob.importType || 'contact',
              recordId,
              action,
              rowNumber: rowIndex + 1,
              originalData: row,
              wasNew,
              matchedBy: duplicateResult.isDuplicate ? duplicateResult.matches[0].matchedBy : null,
              validationIssues: [],
            });

            successfulRows++;
          } catch (error: any) {
            failedRows++;
            errors.push({
              row: rowIndex + 1,
              error: error.message,
            });
          }
        }

        // Update progress
        const progress = Math.floor(((i + batch.length) / csvData.length) * 100);
        await storage.updateImportJob(req.params.id, {
          progress,
          processedRows: i + batch.length,
          successfulRows,
          failedRows,
          duplicatesFound,
        });
      }

      // Finalize import
      await storage.updateImportJob(req.params.id, {
        status: failedRows === 0 ? 'completed' : 'completed_with_errors',
        currentStep: 'complete',
        progress: 100,
        processedRows: csvData.length,
        successfulRows,
        failedRows,
        duplicatesFound,
        errorLog: errors,
        completedAt: new Date(),
        importSummary: {
          totalRows: csvData.length,
          successful: successfulRows,
          failed: failedRows,
          duplicates: duplicatesFound,
          strategy: duplicateStrategy || 'skip',
        },
      });

      const updatedJob = await storage.getImportJob(req.params.id);
      
      res.json({
        success: true,
        importJob: updatedJob,
        summary: {
          totalRows: csvData.length,
          successful: successfulRows,
          failed: failedRows,
          duplicates: duplicatesFound,
        },
      });
    } catch (error: any) {
      console.error("Failed to execute import:", error);
      
      // Update job status to failed
      try {
        await storage.updateImportJob(req.params.id, {
          status: 'failed',
          errorLog: [{ message: error.message }],
        });
      } catch (updateError) {
        console.error("Failed to update import job status:", updateError);
      }
      
      res.status(500).json({ error: error.message || "Failed to execute import" });
    }
  });

  // Rollback imported records
  app.post("/api/crm/imports/:id/rollback", async (req: any, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      
      if (!importJob) {
        return res.status(404).json({ error: "Import job not found" });
      }

      if (importJob.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!importJob.canRollback) {
        return res.status(400).json({ error: "Import cannot be rolled back" });
      }

      if (importJob.rolledBackAt) {
        return res.status(400).json({ error: "Import has already been rolled back" });
      }

      // Get all imported records
      const importedRecords = await storage.getImportedRecordsByJob(req.params.id);
      
      // Delete records that were created (not updated)
      for (const record of importedRecords) {
        if (record.wasNew && record.recordType === 'contact') {
          try {
            await storage.deleteCrmContact(record.recordId);
          } catch (error) {
            console.error(`Failed to delete contact ${record.recordId}:`, error);
          }
        }
      }

      // Mark import as rolled back
      await storage.updateImportJob(req.params.id, {
        rolledBackAt: new Date(),
        rolledBackBy: req.user.id,
        canRollback: false,
      });

      res.json({
        success: true,
        message: `Rolled back ${importedRecords.filter(r => r.wasNew).length} contacts`,
      });
    } catch (error: any) {
      console.error("Failed to rollback import:", error);
      res.status(500).json({ error: error.message || "Failed to rollback import" });
    }
  });

  // ===================================================================
  // CRM Prospecting - Weekly Activity Tracking
  // ===================================================================

  // Get all prospecting entries for a user (optionally filtered by year)
  app.get("/api/prospecting/entries", async (req: any, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year) : undefined;
      const entries = await storage.getProspectingEntriesForUser(req.user.id, year);
      res.json(entries);
    } catch (error) {
      console.error("Failed to get prospecting entries:", error);
      res.status(500).json({ error: "Failed to retrieve prospecting entries" });
    }
  });

  // Get a specific prospecting entry by week
  app.get("/api/prospecting/entries/:year/:quarter/:weekNumber", async (req: any, res) => {
    try {
      const year = parseInt(req.params.year);
      const quarter = parseInt(req.params.quarter);
      const weekNumber = parseInt(req.params.weekNumber);
      
      const entry = await storage.getProspectingEntryByWeek(req.user.id, year, quarter, weekNumber);
      
      if (!entry) {
        return res.status(404).json({ error: "Prospecting entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      console.error("Failed to get prospecting entry:", error);
      res.status(500).json({ error: "Failed to retrieve prospecting entry" });
    }
  });

  // Create or update a prospecting entry
  app.post("/api/prospecting/entries", async (req: any, res) => {
    try {
      // Import schema for validation
      const { insertProspectingEntrySchema } = await import("@shared/schema");
      
      // Convert date strings to Date objects before validation
      const bodyData = { ...req.body };
      if (bodyData.weekStartDate && typeof bodyData.weekStartDate === 'string') {
        bodyData.weekStartDate = new Date(bodyData.weekStartDate);
      }
      if (bodyData.weekEndDate && typeof bodyData.weekEndDate === 'string') {
        bodyData.weekEndDate = new Date(bodyData.weekEndDate);
      }
      
      // Validate request body
      const validated = insertProspectingEntrySchema.parse(bodyData);
      const { year, quarter, weekNumber, userId, ...entryData } = validated;
      
      // Check if entry already exists for this week
      const existing = await storage.getProspectingEntryByWeek(req.user.id, year, quarter, weekNumber);
      
      let entry;
      if (existing) {
        // Update existing entry (never allow userId to be changed)
        entry = await storage.updateProspectingEntry(existing.id, entryData);
      } else {
        // Create new entry (always use authenticated user's ID)
        entry = await storage.createProspectingEntry({
          ...entryData,
          userId: req.user.id,
          year,
          quarter,
          weekNumber,
        });
      }
      
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid prospecting entry data", details: error.errors });
      }
      console.error("Failed to save prospecting entry:", error);
      res.status(500).json({ error: "Failed to save prospecting entry" });
    }
  });

  // Update a prospecting entry (create if doesn't exist)
  app.put("/api/prospecting/entries/:year/:quarter/:weekNumber", async (req: any, res) => {
    try {
      // Import schema for validation
      const { insertProspectingEntrySchema } = await import("@shared/schema");
      
      const year = parseInt(req.params.year);
      const quarter = parseInt(req.params.quarter);
      const weekNumber = parseInt(req.params.weekNumber);
      
      // Check if entry exists
      const existingEntry = await storage.getProspectingEntryByWeek(req.user.id, year, quarter, weekNumber);
      
      // Convert date strings to Date objects before validation
      const bodyData = { ...req.body };
      if (bodyData.weekStartDate && typeof bodyData.weekStartDate === 'string') {
        bodyData.weekStartDate = new Date(bodyData.weekStartDate);
      }
      if (bodyData.weekEndDate && typeof bodyData.weekEndDate === 'string') {
        bodyData.weekEndDate = new Date(bodyData.weekEndDate);
      }
      
      // Validate request body
      const validated = insertProspectingEntrySchema.partial().parse(bodyData);
      
      // Strip userId to prevent reassignment attacks
      const { userId, ...updateData } = validated;
      
      let result;
      if (existingEntry) {
        // Update existing entry
        result = await storage.updateProspectingEntry(existingEntry.id, updateData);
      } else {
        // Create new entry with all required fields
        result = await storage.createProspectingEntry({
          ...updateData,
          userId: req.user.id,
          year,
          quarter,
          weekNumber,
          weekStartDate: updateData.weekStartDate || new Date(),
          weekEndDate: updateData.weekEndDate || new Date(),
        });
      }
      
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("Validation error details:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Invalid prospecting entry data", details: error.errors });
      }
      console.error("Failed to update prospecting entry:", error);
      res.status(500).json({ error: "Failed to update prospecting entry" });
    }
  });

  // Delete a prospecting entry
  app.delete("/api/prospecting/entries/:id", async (req: any, res) => {
    try {
      // First verify the entry exists and belongs to the user
      const entry = await storage.getProspectingEntry(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Prospecting entry not found" });
      }
      
      // Verify entry belongs to authenticated user
      if (entry.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized to delete this prospecting entry" });
      }
      
      await storage.deleteProspectingEntry(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete prospecting entry:", error);
      res.status(500).json({ error: "Failed to delete prospecting entry" });
    }
  });

  // ===================================================================
  // CRM Route Aliases - Frontend Integration
  // Map /api/* routes to /api/crm/* for frontend compatibility
  // ===================================================================
  
  // Leads aliases
  app.get("/api/leads", async (req: any, res) => {
    try {
      const leads = await storage.getCrmLeadsForOrg(req.user.orgId);
      res.json(leads);
    } catch (error) {
      console.error("Failed to get leads:", error);
      res.status(500).json({ error: "Failed to retrieve leads" });
    }
  });
  app.post("/api/leads", async (req: any, res) => {
    try {
      const lead = await storage.createCrmLead({ ...req.body, assignedToId: req.user.id });
      res.json(lead);
    } catch (error) {
      console.error("Failed to create lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });
  app.put("/api/leads/:id", async (req: any, res) => {
    try {
      const lead = await storage.updateCrmLead(req.params.id, req.body);
      res.json(lead);
    } catch (error) {
      console.error("Failed to update lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });
  app.delete("/api/leads/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmLead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete lead:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });
  
  // Deals aliases
  app.get("/api/deals", async (req: any, res) => {
    try {
      const deals = await storage.getCrmDealsForOrg(req.user.orgId);
      res.json(deals);
    } catch (error) {
      console.error("Failed to get deals:", error);
      res.status(500).json({ error: "Failed to retrieve deals" });
    }
  });
  app.post("/api/deals", async (req: any, res) => {
    try {
      const deal = await storage.createCrmDeal({ ...req.body, ownerId: req.user.id });
      res.json(deal);
    } catch (error) {
      console.error("Failed to create deal:", error);
      res.status(500).json({ error: "Failed to create deal" });
    }
  });
  app.get("/api/deals/:id", async (req: any, res) => {
    try {
      const deal = await storage.getCrmDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      console.error("Failed to get deal:", error);
      res.status(500).json({ error: "Failed to retrieve deal" });
    }
  });
  app.put("/api/deals/:id", async (req: any, res) => {
    try {
      let updateData = { ...req.body };
      
      // Auto-close deal if stage name is "Closed"
      if (updateData.stageId) {
        const stage = await storage.getCrmStage(updateData.stageId);
        if (stage && stage.name.toLowerCase() === 'closed') {
          updateData.isClosed = true;
          updateData.closedAt = new Date().toISOString();
        }
      }
      
      const deal = await storage.updateCrmDeal(req.params.id, updateData);
      res.json(deal);
    } catch (error) {
      console.error("Failed to update deal:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });
  app.delete("/api/deals/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmDeal(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });
  
  // Bulk operations for deals
  app.post("/api/deals/bulk/delete", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid ids array" });
      }
      
      await Promise.all(ids.map(id => storage.deleteCrmDeal(id)));
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      console.error("Failed to bulk delete deals:", error);
      res.status(500).json({ error: "Failed to bulk delete deals" });
    }
  });
  
  // Contacts aliases  
  app.get("/api/contacts", async (req: any, res) => {
    try {
      const contacts = await storage.getCrmContactsForOrg(req.user.orgId);
      res.json(contacts);
    } catch (error) {
      console.error("Failed to get contacts:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });
  app.post("/api/contacts", async (req: any, res) => {
    try {
      const contact = await storage.createCrmContact({ ...req.body, ownerId: req.user.id });
      res.json(contact);
    } catch (error) {
      console.error("Failed to create contact:", error);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });
  app.put("/api/contacts/:id", async (req: any, res) => {
    try {
      const contact = await storage.updateCrmContact(req.params.id, req.body);
      res.json(contact);
    } catch (error) {
      console.error("Failed to update contact:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });
  app.delete("/api/contacts/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmContact(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete contact:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });
  
  // Bulk operations for contacts
  app.post("/api/contacts/bulk/delete", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid ids array" });
      }
      
      await Promise.all(ids.map(id => storage.deleteCrmContact(id)));
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      console.error("Failed to bulk delete contacts:", error);
      res.status(500).json({ error: "Failed to bulk delete contacts" });
    }
  });
  
  // Companies aliases
  app.get("/api/companies", async (req: any, res) => {
    try {
      const companies = await storage.getCrmCompaniesForOrg(req.user.orgId);
      res.json(companies);
    } catch (error) {
      console.error("Failed to get companies:", error);
      res.status(500).json({ error: "Failed to retrieve companies" });
    }
  });
  app.post("/api/companies", async (req: any, res) => {
    try {
      const company = await storage.createCrmCompany({ ...req.body, ownerId: req.user.id });
      res.json(company);
    } catch (error) {
      console.error("Failed to create company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });
  app.put("/api/companies/:id", async (req: any, res) => {
    try {
      const company = await storage.updateCrmCompany(req.params.id, req.body);
      res.json(company);
    } catch (error) {
      console.error("Failed to update company:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });
  app.delete("/api/companies/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmCompany(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });
  
  // Bulk operations for companies
  app.post("/api/companies/bulk/delete", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid ids array" });
      }
      
      await Promise.all(ids.map(id => storage.deleteCrmCompany(id)));
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      console.error("Failed to bulk delete companies:", error);
      res.status(500).json({ error: "Failed to bulk delete companies" });
    }
  });
  
  // Pipelines aliases
  app.get("/api/pipelines", async (req: any, res) => {
    try {
      const pipelines = await storage.getCrmPipelinesForOrg(req.user.orgId);
      res.json(pipelines);
    } catch (error) {
      console.error("Failed to get pipelines:", error);
      res.status(500).json({ error: "Failed to retrieve pipelines" });
    }
  });
  app.post("/api/pipelines", async (req: any, res) => {
    try {
      const pipeline = await storage.createCrmPipeline({ ...req.body, orgId: req.user.orgId });
      res.json(pipeline);
    } catch (error) {
      console.error("Failed to create pipeline:", error);
      res.status(500).json({ error: "Failed to create pipeline" });
    }
  });
  app.put("/api/pipelines/:id", async (req: any, res) => {
    try {
      const pipeline = await storage.updateCrmPipeline(req.params.id, req.body);
      res.json(pipeline);
    } catch (error) {
      console.error("Failed to update pipeline:", error);
      res.status(500).json({ error: "Failed to update pipeline" });
    }
  });
  app.delete("/api/pipelines/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmPipeline(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete pipeline:", error);
      res.status(500).json({ error: "Failed to delete pipeline" });
    }
  });
  app.get("/api/pipelines/:pipelineId/stages", async (req: any, res) => {
    try {
      const stages = await storage.getCrmStagesForPipeline(req.params.pipelineId);
      res.json(stages);
    } catch (error) {
      console.error("Failed to get pipeline stages:", error);
      res.status(500).json({ error: "Failed to retrieve pipeline stages" });
    }
  });
  
  // Pipeline Stages aliases (both /api/stages and /api/pipeline-stages)
  app.get("/api/stages", async (req: any, res) => {
    try {
      const stages = await storage.getAllCrmPipelineStages(req.user.orgId);
      res.json(stages);
    } catch (error) {
      console.error("Failed to get stages:", error);
      res.status(500).json({ error: "Failed to retrieve stages" });
    }
  });
  app.post("/api/stages", async (req: any, res) => {
    try {
      const stage = await storage.createCrmStage(req.body);
      res.json(stage);
    } catch (error) {
      console.error("Failed to create stage:", error);
      res.status(500).json({ error: "Failed to create stage" });
    }
  });
  app.put("/api/stages/:id", async (req: any, res) => {
    try {
      const stage = await storage.updateCrmStage(req.params.id, req.body);
      res.json(stage);
    } catch (error) {
      console.error("Failed to update stage:", error);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });
  app.delete("/api/stages/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmStage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete stage:", error);
      res.status(500).json({ error: "Failed to delete stage" });
    }
  });
  app.get("/api/pipeline-stages", async (req: any, res) => {
    try {
      const stages = await storage.getAllCrmPipelineStages(req.user.orgId);
      res.json(stages);
    } catch (error) {
      console.error("Failed to get stages:", error);
      res.status(500).json({ error: "Failed to retrieve stages" });
    }
  });
  app.post("/api/pipeline-stages", async (req: any, res) => {
    try {
      const stage = await storage.createCrmStage(req.body);
      res.json(stage);
    } catch (error) {
      console.error("Failed to create stage:", error);
      res.status(500).json({ error: "Failed to create stage" });
    }
  });
  app.put("/api/pipeline-stages/:id", async (req: any, res) => {
    try {
      const stage = await storage.updateCrmStage(req.params.id, req.body);
      res.json(stage);
    } catch (error) {
      console.error("Failed to update stage:", error);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });
  app.delete("/api/pipeline-stages/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmStage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete stage:", error);
      res.status(500).json({ error: "Failed to delete stage" });
    }
  });
  
  // Activities aliases
  app.get("/api/activities", async (req: any, res) => {
    try {
      const activities = await storage.getCrmActivitiesForOrg(req.user.id);
      res.json(activities);
    } catch (error) {
      console.error("Failed to get activities:", error);
      res.status(500).json({ error: "Failed to retrieve activities" });
    }
  });
  app.post("/api/activities", async (req: any, res) => {
    try {
      const activity = await storage.createCrmActivity({ ...req.body, userId: req.user.id });
      res.json(activity);
    } catch (error) {
      console.error("Failed to create activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });
  app.put("/api/activities/:id", async (req: any, res) => {
    try {
      const activity = await storage.updateCrmActivity(req.params.id, req.body);
      res.json(activity);
    } catch (error) {
      console.error("Failed to update activity:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });
  app.delete("/api/activities/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmActivity(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete activity:", error);
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });

  // Import aliases
  app.post("/api/imports", (req, res) => req.app.handle(Object.assign(req, { url: '/api/crm/imports' }), res));
  app.get("/api/imports/:id", (req, res) => req.app.handle(Object.assign(req, { url: `/api/crm/imports/${req.params.id}` }), res));
  app.get("/api/imports", (req, res) => req.app.handle(Object.assign(req, { url: '/api/crm/imports' }), res));
  app.post("/api/imports/:id/preview", (req, res) => req.app.handle(Object.assign(req, { url: `/api/crm/imports/${req.params.id}/preview` }), res));
  app.post("/api/imports/:id/execute", (req, res) => req.app.handle(Object.assign(req, { url: `/api/crm/imports/${req.params.id}/execute` }), res));
  app.post("/api/imports/:id/rollback", (req, res) => req.app.handle(Object.assign(req, { url: `/api/crm/imports/${req.params.id}/rollback` }), res));

  // ===================================================================
  // Global Search API - Fuzzy search across all CRM entities
  // ===================================================================
  app.get("/api/search", async (req: any, res) => {
    try {
      const query = req.query.q || req.query.query || "";
      
      if (!query || query.trim().length < 2) {
        return res.json({ results: [] });
      }

      const searchTerm = `%${query.trim().toLowerCase()}%`;
      
      // Search contacts
      const contacts = await db
        .select({
          id: crmContacts.id,
          type: sql<string>`'contact'`,
          title: sql<string>`CONCAT(${crmContacts.firstName}, ' ', ${crmContacts.lastName})`,
          subtitle: crmContacts.email,
          description: crmContacts.title,
          data: crmContacts,
        })
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.orgId, req.user.orgId),
            or(
              sql`LOWER(${crmContacts.firstName}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.lastName}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.email}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.phone}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.title}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Search companies
      const companies = await db
        .select({
          id: crmCompanies.id,
          type: sql<string>`'company'`,
          title: crmCompanies.name,
          subtitle: crmCompanies.domain,
          description: crmCompanies.industry,
          data: crmCompanies,
        })
        .from(crmCompanies)
        .where(
          and(
            eq(crmCompanies.orgId, req.user.orgId),
            or(
              sql`LOWER(${crmCompanies.name}) LIKE ${searchTerm}`,
              sql`LOWER(${crmCompanies.domain}) LIKE ${searchTerm}`,
              sql`LOWER(${crmCompanies.industry}) LIKE ${searchTerm}`,
              sql`LOWER(${crmCompanies.phone}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Search deals
      const deals = await db
        .select({
          id: crmDeals.id,
          type: sql<string>`'deal'`,
          title: crmDeals.name,
          subtitle: sql<string>`CONCAT('$', ${crmDeals.amount})`,
          description: crmDeals.status,
          data: crmDeals,
        })
        .from(crmDeals)
        .where(
          and(
            eq(crmDeals.orgId, req.user.orgId),
            or(
              sql`LOWER(${crmDeals.name}) LIKE ${searchTerm}`,
              sql`LOWER(${crmDeals.status}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Combine and return results
      const results = [
        ...contacts.map(c => ({ ...c, type: 'contact' as const })),
        ...companies.map(c => ({ ...c, type: 'company' as const })),
        ...deals.map(d => ({ ...d, type: 'deal' as const })),
      ];

      res.json({ results, query });
    } catch (error) {
      console.error("Global search failed:", error);
      res.status(500).json({ error: "Search failed", results: [] });
    }
  });

  // Marketing Automation - Email Sequences & Templates
  app.use("/api/email-sequences", authenticateUser);
  app.use("/api/email-templates", authenticateUser);

  // Get all email sequences for a user
  app.get("/api/email-sequences", async (req: any, res) => {
    try {
      const sequences = await storage.getEmailSequencesForUser(req.user.id);
      res.json(sequences);
    } catch (error) {
      console.error("Failed to get email sequences:", error);
      res.status(500).json({ error: "Failed to retrieve email sequences" });
    }
  });

  // Get a specific email sequence with steps
  app.get("/api/email-sequences/:id", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.id);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const steps = await storage.getEmailSequenceStepsBySequence(req.params.id);
      res.json({ ...sequence, steps });
    } catch (error) {
      console.error("Failed to get email sequence:", error);
      res.status(500).json({ error: "Failed to retrieve email sequence" });
    }
  });

  // Create a new email sequence
  app.post("/api/email-sequences", async (req: any, res) => {
    try {
      const { insertEmailSequenceSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceSchema.parse({
        ...req.body,
        createdById: req.user.id,
      });
      
      const sequence = await storage.createEmailSequence(validated);
      res.status(201).json(sequence);
    } catch (error) {
      console.error("Failed to create email sequence:", error);
      res.status(500).json({ error: "Failed to create email sequence" });
    }
  });

  // Update an email sequence
  app.put("/api/email-sequences/:id", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.id);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailSequenceSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceSchema.partial().omit({ createdById: true }).parse(req.body);
      const updated = await storage.updateEmailSequence(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to update email sequence:", error);
      res.status(500).json({ error: "Failed to update email sequence" });
    }
  });

  // Delete an email sequence
  app.delete("/api/email-sequences/:id", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.id);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.deleteEmailSequence(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete email sequence:", error);
      res.status(500).json({ error: "Failed to delete email sequence" });
    }
  });

  // Email Sequence Steps
  app.get("/api/email-sequences/:sequenceId/steps", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.sequenceId);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const steps = await storage.getEmailSequenceStepsBySequence(req.params.sequenceId);
      res.json(steps);
    } catch (error) {
      console.error("Failed to get sequence steps:", error);
      res.status(500).json({ error: "Failed to retrieve sequence steps" });
    }
  });

  app.post("/api/email-sequences/:sequenceId/steps", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.sequenceId);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailSequenceStepSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceStepSchema.parse({
        ...req.body,
        sequenceId: req.params.sequenceId,
      });
      
      const step = await storage.createEmailSequenceStep(validated);
      res.status(201).json(step);
    } catch (error) {
      console.error("Failed to create sequence step:", error);
      res.status(500).json({ error: "Failed to create sequence step" });
    }
  });

  app.put("/api/email-sequence-steps/:id", async (req: any, res) => {
    try {
      const step = await storage.getEmailSequenceStep(req.params.id);
      if (!step) {
        return res.status(404).json({ error: "Sequence step not found" });
      }
      
      const sequence = await storage.getEmailSequence(step.sequenceId);
      if (!sequence || sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailSequenceStepSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceStepSchema.partial().omit({ sequenceId: true }).parse(req.body);
      const updated = await storage.updateEmailSequenceStep(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to update sequence step:", error);
      res.status(500).json({ error: "Failed to update sequence step" });
    }
  });

  app.delete("/api/email-sequence-steps/:id", async (req: any, res) => {
    try {
      const step = await storage.getEmailSequenceStep(req.params.id);
      if (!step) {
        return res.status(404).json({ error: "Sequence step not found" });
      }
      
      const sequence = await storage.getEmailSequence(step.sequenceId);
      if (!sequence || sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.deleteEmailSequenceStep(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete sequence step:", error);
      res.status(500).json({ error: "Failed to delete sequence step" });
    }
  });

  // Email Templates
  app.get("/api/email-templates", async (req: any, res) => {
    try {
      const templates = await storage.getEmailTemplatesForUser(req.user.id);
      res.json(templates);
    } catch (error) {
      console.error("Failed to get email templates:", error);
      res.status(500).json({ error: "Failed to retrieve email templates" });
    }
  });

  app.get("/api/email-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Email template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Failed to get email template:", error);
      res.status(500).json({ error: "Failed to retrieve email template" });
    }
  });

  app.post("/api/email-templates", async (req: any, res) => {
    try {
      const { insertEmailTemplateSchema } = await import("@shared/schema");
      const validated = insertEmailTemplateSchema.parse({
        ...req.body,
        createdById: req.user.id,
      });
      
      const template = await storage.createEmailTemplate(validated);
      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to create email template:", error);
      res.status(500).json({ error: "Failed to create email template" });
    }
  });

  app.put("/api/email-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Email template not found" });
      }
      if (template.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailTemplateSchema } = await import("@shared/schema");
      const validated = insertEmailTemplateSchema.partial().omit({ createdById: true }).parse(req.body);
      const updated = await storage.updateEmailTemplate(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to update email template:", error);
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  app.delete("/api/email-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Email template not found" });
      }
      if (template.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.deleteEmailTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete email template:", error);
      res.status(500).json({ error: "Failed to delete email template" });
    }
  });

  // Email Sequence Enrollments
  app.get("/api/email-sequence-enrollments", async (req: any, res) => {
    try {
      const enrollments = await storage.getEmailSequenceEnrollmentsForUser(req.user.id);
      res.json(enrollments);
    } catch (error) {
      console.error("Failed to get enrollments:", error);
      res.status(500).json({ error: "Failed to retrieve enrollments" });
    }
  });

  app.get("/api/email-sequences/:sequenceId/enrollments", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.sequenceId);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const enrollments = await storage.getEmailSequenceEnrollmentsBySequence(req.params.sequenceId);
      res.json(enrollments);
    } catch (error) {
      console.error("Failed to get enrollments:", error);
      res.status(500).json({ error: "Failed to retrieve enrollments" });
    }
  });

  app.post("/api/email-sequence-enrollments", async (req: any, res) => {
    try {
      const { insertEmailSequenceEnrollmentSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceEnrollmentSchema.parse({
        ...req.body,
        enrolledById: req.user.id,
      });
      
      const enrollment = await storage.createEmailSequenceEnrollment(validated);
      res.status(201).json(enrollment);
    } catch (error) {
      console.error("Failed to create enrollment:", error);
      res.status(500).json({ error: "Failed to create enrollment" });
    }
  });

  app.put("/api/email-sequence-enrollments/:id", async (req: any, res) => {
    try {
      const enrollment = await storage.getEmailSequenceEnrollment(req.params.id);
      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      if (enrollment.enrolledById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailSequenceEnrollmentSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceEnrollmentSchema.partial().omit({ 
        sequenceId: true,
        enrolledById: true,
        entityType: true,
        entityId: true
      }).parse(req.body);
      const updated = await storage.updateEmailSequenceEnrollment(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to update enrollment:", error);
      res.status(500).json({ error: "Failed to update enrollment" });
    }
  });

  // Calendar Settings Routes
  app.get("/api/calendar/settings", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      
      if (!settings) {
        return res.status(404).json({ error: "Calendar settings not found" });
      }

      res.json(settings);
    } catch (error) {
      console.error("Failed to get calendar settings:", error);
      res.status(500).json({ error: "Failed to get calendar settings" });
    }
  });

  app.put("/api/calendar/settings", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const validated = insertCalendarSettingsSchema.partial().omit({ userId: true }).parse(req.body);

      const existingSettings = await storage.getCalendarSettings(req.user.id);
      
      let settings;
      if (existingSettings) {
        settings = await storage.updateCalendarSettings(req.user.id, validated);
      } else {
        settings = await storage.createCalendarSettings({
          ...validated,
          userId: req.user.id,
        });
      }

      res.json(settings);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      console.error("Failed to update calendar settings:", error);
      res.status(500).json({ error: "Failed to update calendar settings" });
    }
  });

  app.get("/api/calendar/status", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const isConnected = await CalendarService.isConnected();
      res.json({ connected: isConnected });
    } catch (error) {
      console.error("Failed to check calendar status:", error);
      res.json({ connected: false });
    }
  });

  // Calendar Sync Routes - Activities
  app.post("/api/calendar/sync/activity/:activityId", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const activity = await storage.getCrmActivity(req.params.activityId);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      if (activity.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized access to activity" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      const calendarId = settings?.defaultCalendarId || 'primary';

      let startDateTime: string;
      let endDateTime: string;

      if (activity.scheduledAt) {
        startDateTime = new Date(activity.scheduledAt).toISOString();
        const duration = activity.duration || 30;
        endDateTime = new Date(new Date(activity.scheduledAt).getTime() + duration * 60000).toISOString();
      } else {
        return res.status(400).json({ error: "Activity must have a scheduled time to sync to calendar" });
      }

      const calendarEvent = {
        summary: activity.subject || `${activity.type} - ${activity.entityType}`,
        description: activity.description || '',
        start: {
          dateTime: startDateTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'UTC',
        },
      };

      const createdEvent = await CalendarService.createEvent(calendarEvent, calendarId);

      await storage.updateCrmActivity(activity.id, {
        calendarEventId: createdEvent.id,
        syncedToCalendar: true,
      });

      res.status(201).json({ 
        success: true, 
        calendarEventId: createdEvent.id,
        eventLink: createdEvent.htmlLink 
      });
    } catch (error) {
      console.error("Failed to sync activity to calendar:", error);
      res.status(500).json({ error: "Failed to sync activity to calendar" });
    }
  });

  app.delete("/api/calendar/sync/activity/:activityId", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const activity = await storage.getCrmActivity(req.params.activityId);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      if (activity.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized access to activity" });
      }

      if (!activity.calendarEventId) {
        return res.status(400).json({ error: "Activity is not synced to calendar" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      const calendarId = settings?.defaultCalendarId || 'primary';

      await CalendarService.deleteEvent(activity.calendarEventId, calendarId);

      await storage.updateCrmActivity(activity.id, {
        calendarEventId: null,
        syncedToCalendar: false,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove activity from calendar:", error);
      res.status(500).json({ error: "Failed to remove activity from calendar" });
    }
  });

  // Calendar Sync Routes - DD Tasks
  app.post("/api/calendar/sync/task/:taskId", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const project = await storage.getProject(task.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Unauthorized access to task" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      const calendarId = settings?.defaultCalendarId || 'primary';

      if (!task.deadline) {
        return res.status(400).json({ error: "Task must have a deadline to sync to calendar" });
      }

      const deadlineDate = new Date(task.deadline);
      const calendarEvent = {
        summary: task.title,
        description: task.description || '',
        start: {
          date: deadlineDate.toISOString().split('T')[0],
        },
        end: {
          date: deadlineDate.toISOString().split('T')[0],
        },
      };

      const createdEvent = await CalendarService.createEvent(calendarEvent, calendarId);

      await storage.updateTask(task.id, {
        calendarEventId: createdEvent.id,
        syncedToCalendar: true,
      });

      res.status(201).json({ 
        success: true, 
        calendarEventId: createdEvent.id,
        eventLink: createdEvent.htmlLink 
      });
    } catch (error) {
      console.error("Failed to sync task to calendar:", error);
      res.status(500).json({ error: "Failed to sync task to calendar" });
    }
  });

  app.delete("/api/calendar/sync/task/:taskId", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const project = await storage.getProject(task.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Unauthorized access to task" });
      }

      if (!task.calendarEventId) {
        return res.status(400).json({ error: "Task is not synced to calendar" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      const calendarId = settings?.defaultCalendarId || 'primary';

      await CalendarService.deleteEvent(task.calendarEventId, calendarId);

      await storage.updateTask(task.id, {
        calendarEventId: null,
        syncedToCalendar: false,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove task from calendar:", error);
      res.status(500).json({ error: "Failed to remove task from calendar" });
    }
  });

  // List available Google calendars
  app.get("/api/calendar/calendars", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const calendars = await CalendarService.getCalendars();
      res.json(calendars);
    } catch (error) {
      console.error("Failed to get calendars:", error);
      res.status(500).json({ error: "Failed to get calendars" });
    }
  });

  // ICS Export Routes
  app.get("/api/calendar/export/activities.ics", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const activities = await db
        .select()
        .from(crmActivities)
        .where(eq(crmActivities.userId, req.user.id));

      const icsContent = generateICS(activities.map(activity => ({
        id: activity.id,
        summary: activity.subject || `${activity.type} - ${activity.entityType}`,
        description: activity.description || '',
        start: activity.scheduledAt,
        end: activity.scheduledAt ? new Date(new Date(activity.scheduledAt).getTime() + (activity.duration || 30) * 60000) : null,
        type: 'activity'
      })));

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename="activities.ics"');
      res.send(icsContent);
    } catch (error) {
      console.error("Failed to export activities:", error);
      res.status(500).json({ error: "Failed to export activities" });
    }
  });

  app.get("/api/calendar/export/tasks.ics", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userProjects = await storage.getProjectsForOrg(req.user.orgId);
      const projectIds = userProjects.map(p => p.id);

      const allTasks = [];
      for (const projectId of projectIds) {
        const projectTasks = await storage.getTasksForProject(projectId);
        allTasks.push(...projectTasks);
      }

      const icsContent = generateICS(allTasks.map(task => ({
        id: task.id,
        summary: task.title,
        description: task.description || '',
        start: task.deadline,
        end: task.deadline,
        type: 'task'
      })));

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename="tasks.ics"');
      res.send(icsContent);
    } catch (error) {
      console.error("Failed to export tasks:", error);
      res.status(500).json({ error: "Failed to export tasks" });
    }
  });

  // ===========================
  // SalesComps Module Routes
  // ===========================

  // Sales Comps CRUD routes
  app.get('/api/sales-comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const filters = compFiltersSchema.parse(req.query);
      const sqlFilters = filterBuilder.buildFilters(filters);
      
      const { comps, total } = await storage.getComps({
        orgId,
        filters: sqlFilters,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page: filters.page,
        pageSize: filters.pageSize,
      });

      res.json({ comps, total, page: filters.page, pageSize: filters.pageSize });
    } catch (error) {
      console.error("Error fetching comps:", error);
      res.status(500).json({ message: "Failed to fetch comps" });
    }
  });

  app.get('/api/sales-comps/ids', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const ids = await storage.getAllCompIds(orgId);
      res.json({ ids });
    } catch (error) {
      console.error('Error getting comp IDs:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/sales-comps/column-values/:column', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { column } = req.params;
      const values = await storage.getColumnUniqueValues(orgId, column);
      res.json({ values });
    } catch (error) {
      console.error('Error getting column values:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/sales-comps/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const comp = await storage.getComp(req.params.id, orgId);
      if (!comp) return res.status(404).json({ message: "Comp not found" });
      res.json(comp);
    } catch (error) {
      console.error("Error fetching comp:", error);
      res.status(500).json({ message: "Failed to fetch comp" });
    }
  });

  app.post('/api/sales-comps', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const compData = salesCompCreateSchema.parse(req.body);
      const comp = await compService.createComp({
        ...compData,
        orgId,
        createdBy: userId,
      }, userId);

      res.status(201).json(comp);
    } catch (error) {
      console.error("Error creating comp:", error);
      res.status(500).json({ message: "Failed to create comp" });
    }
  });

  app.patch('/api/sales-comps/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const updates = salesCompUpdateSchema.parse(req.body);
      const comp = await compService.updateComp(
        req.params.id,
        { ...updates, updatedBy: userId },
        orgId,
        userId
      );

      if (!comp) return res.status(404).json({ message: "Comp not found" });
      res.json(comp);
    } catch (error) {
      console.error("Error updating comp:", error);
      res.status(500).json({ message: "Failed to update comp" });
    }
  });

  app.delete('/api/sales-comps/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const success = await compService.deleteComp(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Comp not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting comp:", error);
      res.status(500).json({ message: "Failed to delete comp" });
    }
  });

  app.post('/api/sales-comps/bulk-update', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { ids, updates } = bulkUpdateSchema.parse(req.body);
      const count = await compService.bulkUpdateComps(ids, updates, orgId, userId);

      res.json({ updated: count });
    } catch (error) {
      console.error("Error bulk updating comps:", error);
      res.status(500).json({ message: "Failed to bulk update comps" });
    }
  });

  app.post('/api/sales-comps/bulk-delete', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      const count = await compService.bulkDeleteComps(ids, orgId, userId);
      res.json({ deleted: count });
    } catch (error) {
      console.error("Error bulk deleting comps:", error);
      res.status(500).json({ message: "Failed to bulk delete comps" });
    }
  });

  // Upload and Import routes
  app.post('/api/sales-comps/upload', uploadSalesComps.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const analysis = await parserService.analyzeFile(req.file);
      const fullData = await parserService.parseFullFile(req.file);
      
      console.log(`Parsed ${fullData.length} rows from file ${req.file.originalname}`);
      
      const importRecord = await storage.createImport({
        orgId,
        createdBy: userId,
        filename: req.file.originalname,
        status: 'mapping',
        parsedData: fullData,
        summary: {
          totalRows: fullData.length,
          successCount: 0,
          errorCount: 0,
          warningCount: 0,
          errors: []
        }
      });

      res.json({
        importId: importRecord.id,
        analysis,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post('/api/sales-comps/import/:importId/detect-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { mapping, normalization } = req.body;
      
      const result = await compService.detectDuplicates(
        req.params.importId,
        orgId,
        mapping,
        normalization
      );

      res.json(result);
    } catch (error) {
      console.error("Error detecting duplicates:", error);
      res.status(500).json({ message: "Failed to detect duplicates" });
    }
  });

  app.post('/api/sales-comps/import/:importId/commit', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { mapping, normalization, excludedRows = [], parentPortfolioId } = req.body;
      
      console.log(`Starting import for ${req.params.importId} with mapping:`, mapping);
      
      const result = await compService.processImport(
        req.params.importId,
        orgId,
        userId,
        mapping,
        normalization,
        excludedRows,
        parentPortfolioId
      );
      
      console.log(`Import completed for ${req.params.importId}:`, result);

      res.json(result);
    } catch (error) {
      console.error("Error processing import:", error);
      res.status(500).json({ message: "Failed to process import" });
    }
  });

  app.get('/api/sales-comps/import/:importId/status', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const importRecord = await storage.getImport(req.params.importId, orgId);
      if (!importRecord) return res.status(404).json({ message: "Import not found" });

      res.json(importRecord);
    } catch (error) {
      console.error("Error fetching import status:", error);
      res.status(500).json({ message: "Failed to fetch import status" });
    }
  });

  // Comp Columns management routes
  app.get('/api/comp-columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const columns = await storage.getCompColumns(orgId);
      res.json(columns);
    } catch (error) {
      console.error("Error fetching columns:", error);
      res.status(500).json({ message: "Failed to fetch columns" });
    }
  });

  app.post('/api/comp-columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const columnData = compColumnCreateSchema.parse(req.body);
      const column = await storage.createCompColumn({
        ...columnData,
        orgId,
      });

      res.status(201).json(column);
    } catch (error) {
      console.error("Error creating column:", error);
      res.status(500).json({ message: "Failed to create column" });
    }
  });

  app.patch('/api/comp-columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const updates = compColumnUpdateSchema.parse(req.body);
      const column = await storage.updateCompColumn(req.params.id, updates, orgId);

      if (!column) return res.status(404).json({ message: "Column not found" });
      res.json(column);
    } catch (error) {
      console.error("Error updating column:", error);
      res.status(500).json({ message: "Failed to update column" });
    }
  });

  app.delete('/api/comp-columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const success = await storage.deleteCompColumn(req.params.id, orgId);
      if (!success) return res.status(404).json({ message: "Column not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting column:", error);
      res.status(500).json({ message: "Failed to delete column" });
    }
  });

  // Custom Storage Types routes
  app.get('/api/sales-comps/custom-storage-types', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const types = await storage.getScCustomStorageTypes(orgId);
      res.json(types);
    } catch (error) {
      console.error("Error fetching custom storage types:", error);
      res.status(500).json({ message: "Failed to fetch custom storage types" });
    }
  });

  app.post('/api/sales-comps/custom-storage-types', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: "Storage type name is required" });
      }

      // Check for duplicates (case-insensitive)
      const existing = await storage.getScCustomStorageTypes(orgId);
      if (existing.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
        return res.status(400).json({ message: "Storage type already exists" });
      }

      const type = await storage.createScCustomStorageType({
        orgId,
        name: name.trim(),
        createdBy: userId,
      });

      res.status(201).json(type);
    } catch (error) {
      console.error("Error creating custom storage type:", error);
      res.status(500).json({ message: "Failed to create custom storage type" });
    }
  });

  app.delete('/api/sales-comps/custom-storage-types/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteScCustomStorageType(req.params.id, orgId);

      if (!success) return res.status(404).json({ message: "Storage type not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom storage type:", error);
      res.status(500).json({ message: "Failed to delete custom storage type" });
    }
  });

  // Saved Searches routes
  app.get('/api/saved-searches', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searches = await storage.getSavedSearches(orgId, userId);
      res.json(searches);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  app.get('/api/saved-searches/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const search = await storage.getSavedSearch(req.params.id, orgId);
      if (!search) return res.status(404).json({ message: "Saved search not found" });

      res.json(search);
    } catch (error) {
      console.error("Error fetching saved search:", error);
      res.status(500).json({ message: "Failed to fetch saved search" });
    }
  });

  app.post('/api/saved-searches', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searchData = insertScSavedSearchSchema.parse(req.body);
      const search = await storage.createSavedSearch({
        ...searchData,
        orgId,
        createdBy: userId,
      } as any);

      res.status(201).json(search);
    } catch (error) {
      console.error("Error creating saved search:", error);
      res.status(500).json({ message: "Failed to create saved search" });
    }
  });

  app.patch('/api/saved-searches/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searchData = updateScSavedSearchSchema.parse(req.body);
      const search = await storage.updateSavedSearch(req.params.id, {
        ...searchData,
        updatedBy: userId,
      }, orgId);

      if (!search) return res.status(404).json({ message: "Saved search not found" });

      res.json(search);
    } catch (error) {
      console.error("Error updating saved search:", error);
      res.status(500).json({ message: "Failed to update saved search" });
    }
  });

  app.delete('/api/saved-searches/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const success = await storage.deleteSavedSearch(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Saved search not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ message: "Failed to delete saved search" });
    }
  });

  app.post('/api/saved-searches/:id/use', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      await storage.incrementSavedSearchUsage(req.params.id, orgId);
      res.status(204).send();
    } catch (error) {
      console.error("Error incrementing saved search usage:", error);
      res.status(500).json({ message: "Failed to update saved search usage" });
    }
  });

  // SC Projects routes
  app.get('/api/sc-projects', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projects = await storage.getScProjects(orgId, userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching SC projects:", error);
      res.status(500).json({ message: "Failed to fetch SC projects" });
    }
  });

  app.get('/api/sc-projects/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      res.json(project);
    } catch (error) {
      console.error("Error fetching SC project:", error);
      res.status(500).json({ message: "Failed to fetch SC project" });
    }
  });

  app.post('/api/sc-projects', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projectData = scProjectCreateSchema.parse(req.body);
      const project = await storage.createScProject({
        ...projectData,
        orgId,
        createdBy: userId,
      });

      await storage.createAuditLog({
        orgId,
        userId,
        entity: 'sc_project',
        entityId: project.id,
        action: 'create',
        after: project,
      });

      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating SC project:", error);
      res.status(500).json({ message: "Failed to create SC project" });
    }
  });

  app.put('/api/sc-projects/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const currentProject = await storage.getScProject(req.params.id, orgId);
      if (!currentProject) return res.status(404).json({ message: "Project not found" });

      const updates = scProjectUpdateSchema.parse(req.body);
      const updatedProject = await storage.updateScProject(req.params.id, {
        ...updates,
        updatedBy: userId,
      }, orgId);

      if (!updatedProject) return res.status(404).json({ message: "Project not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entity: 'sc_project',
        entityId: updatedProject.id,
        action: 'update',
        before: currentProject,
        after: updatedProject,
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating SC project:", error);
      res.status(500).json({ message: "Failed to update SC project" });
    }
  });

  app.delete('/api/sc-projects/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const currentProject = await storage.getScProject(req.params.id, orgId);
      if (!currentProject) return res.status(404).json({ message: "Project not found" });

      const success = await storage.deleteScProject(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Project not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entity: 'sc_project',
        entityId: req.params.id,
        action: 'delete',
        before: currentProject,
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting SC project:", error);
      res.status(500).json({ message: "Failed to delete SC project" });
    }
  });

  // SC Project Comps routes
  app.get('/api/sc-projects/:id/comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const projectComps = await storage.getScProjectComps(req.params.id, orgId);
      res.json(projectComps);
    } catch (error) {
      console.error("Error fetching SC project comps:", error);
      res.status(500).json({ message: "Failed to fetch SC project comps" });
    }
  });

  app.post('/api/sc-projects/:id/comps', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const compData = projectCompCreateSchema.parse(req.body);
      
      try {
        const projectComp = await storage.addCompToScProject(
          req.params.id,
          compData.salesCompId,
          orgId,
          userId
        );

        await storage.createAuditLog({
          orgId,
          userId,
          entity: 'sc_project_comp',
          entityId: projectComp.id,
          action: 'create',
          after: projectComp,
        });

        res.status(201).json(projectComp);
      } catch (error: any) {
        if (error.message.includes('duplicate key value') || error.code === '23505') {
          return res.status(409).json({ message: "Sales comp is already added to this project" });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error adding comp to SC project:", error);
      res.status(500).json({ message: "Failed to add comp to SC project" });
    }
  });

  app.post('/api/sc-projects/:id/comps/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const bulkData = projectCompBulkSchema.parse(req.body);
      const results: { success: any[]; failed: any[] } = { success: [], failed: [] };

      for (const salesCompId of bulkData.salesCompIds) {
        try {
          const projectComp = await storage.addCompToScProject(
            req.params.id,
            salesCompId,
            orgId,
            userId
          );

          await storage.createAuditLog({
            orgId,
            userId,
            entity: 'sc_project_comp',
            entityId: projectComp.id,
            action: 'create',
            after: projectComp,
          });

          results.success.push({ salesCompId, projectComp });
        } catch (error: any) {
          results.failed.push({ 
            salesCompId, 
            error: error.message.includes('duplicate key') ? 'Already in project' : 'Failed to add' 
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error bulk adding comps to SC project:", error);
      res.status(500).json({ message: "Failed to bulk add comps to SC project" });
    }
  });

  app.delete('/api/sc-projects/:id/comps/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { compIds } = req.body;
      if (!Array.isArray(compIds) || compIds.length === 0) {
        return res.status(400).json({ message: "Invalid or empty comp IDs array" });
      }

      let removedCount = 0;
      for (const compId of compIds) {
        try {
          const success = await storage.removeCompFromScProject(
            req.params.id,
            compId,
            orgId
          );
          
          if (success) {
            removedCount++;
            await storage.createAuditLog({
              orgId,
              userId,
              entity: 'sc_project_comp',
              entityId: compId,
              action: 'delete',
              before: { projectId: req.params.id, salesCompId: compId },
            });
          }
        } catch (error) {
          console.error(`Error removing comp ${compId} from SC project:`, error);
        }
      }

      res.json({ removed: removedCount });
    } catch (error) {
      console.error("Error bulk removing comps from SC project:", error);
      res.status(500).json({ message: "Failed to bulk remove comps from SC project" });
    }
  });

  app.delete('/api/sc-projects/:id/comps/:compId', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const success = await storage.removeCompFromScProject(
        req.params.id,
        req.params.compId,
        orgId
      );
      
      if (!success) return res.status(404).json({ message: "Comp not found in project" });

      await storage.createAuditLog({
        orgId,
        userId,
        entity: 'sc_project_comp',
        entityId: req.params.compId,
        action: 'delete',
        before: { projectId: req.params.id, salesCompId: req.params.compId },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error removing comp from SC project:", error);
      res.status(500).json({ message: "Failed to remove comp from SC project" });
    }
  });

  app.patch('/api/sc-projects/:id/comps/:compId', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const updates = projectCompUpdateSchema.parse(req.body);
      const updatedProjectComp = await storage.updateScProjectComp(
        req.params.compId,
        updates,
        orgId
      );

      if (!updatedProjectComp) return res.status(404).json({ message: "Project comp not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entity: 'sc_project_comp',
        entityId: req.params.compId,
        action: 'update',
        after: updatedProjectComp,
      });

      res.json(updatedProjectComp);
    } catch (error) {
      console.error("Error updating SC project comp:", error);
      res.status(500).json({ message: "Failed to update SC project comp" });
    }
  });

  // Recommendations routes
  app.get('/api/profit-centers', async (req: any, res) => {
    try {
      res.json(PROFIT_CENTERS);
    } catch (error) {
      console.error("Error fetching profit centers:", error);
      res.status(500).json({ message: "Failed to fetch profit centers" });
    }
  });

  app.get('/api/sc-projects/:id/recommendations', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getScProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const limit = parseInt(req.query.limit as string) || 50;
      const excludeAssigned = req.query.excludeAssigned === 'true';

      let excludeCompIds: string[] = [];
      if (excludeAssigned) {
        const projectComps = await storage.getScProjectComps(projectId, orgId);
        excludeCompIds = projectComps.map(pc => pc.salesCompId);
      }

      const projectProfile = (project.profile as any) || {};
      const userWeightOverrides = (project.weightOverrides as any) || undefined;

      const recommendations = await recommendationService.getRecommendations({
        orgId,
        projectProfile,
        userWeightOverrides,
        excludeCompIds,
        limit,
      });

      res.json({
        items: recommendations,
        total: recommendations.length,
        projectProfile,
        weights: userWeightOverrides,
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  app.get('/api/sc-projects/:id/preferences', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getScProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      res.json({
        profile: project.profile || {},
        weightOverrides: project.weightOverrides || {},
      });
    } catch (error) {
      console.error("Error fetching SC project preferences:", error);
      res.status(500).json({ message: "Failed to fetch SC project preferences" });
    }
  });

  app.put('/api/sc-projects/:id/preferences', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getScProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { profile, weightOverrides } = req.body;

      let validatedProfile, validatedWeights;
      
      try {
        validatedProfile = profile ? scProjectProfileSchema.parse(profile) : project.profile;
        validatedWeights = weightOverrides ? scWeightOverridesSchema.parse(weightOverrides) : project.weightOverrides;
      } catch (validationError: any) {
        console.error("Validation error in SC project preferences:", validationError);
        return res.status(400).json({ 
          message: "Invalid SC project preferences data", 
          details: validationError?.errors || validationError?.message 
        });
      }

      const updatedProject = await storage.updateScProject(projectId, {
        profile: validatedProfile,
        weightOverrides: validatedWeights,
        updatedBy: userId,
      }, orgId);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json({
        profile: updatedProject.profile,
        weightOverrides: updatedProject.weightOverrides,
      });
    } catch (error) {
      console.error("Error updating SC project preferences:", error);
      res.status(500).json({ message: "Failed to update SC project preferences" });
    }
  });

  app.post('/api/recommendations/feedback', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const feedbackData = insertScRecommendationFeedbackSchema.parse({
        ...req.body,
        orgId,
        userId,
      });

      const feedback = await storage.createRecommendationFeedback(feedbackData);

      if (['selected', 'rejected', 'liked'].includes(feedbackData.action)) {
        const project = await storage.getScProject(feedbackData.projectId, orgId);
        const comp = await storage.getComp(feedbackData.salesCompId, orgId);
        
        if (project && comp) {
          const projectProfile = (project.profile as any) || {};
          
          let scoreBreakdown = req.body.breakdown;
          let currentScore = parseFloat(req.body.scoreAtTime) || 0;
          
          if (!scoreBreakdown) {
            const recommendations = await recommendationService.getRecommendations({
              orgId,
              projectProfile,
              userWeightOverrides: (project.weightOverrides as any) || undefined,
              excludeCompIds: [],
              limit: 1000,
            });

            const matchingRec = recommendations.find(r => r.comp.id === comp.id);
            if (matchingRec) {
              scoreBreakdown = matchingRec.breakdown;
              currentScore = matchingRec.score;
            }
          }
          
          if (scoreBreakdown) {
            await recommendationService.updateLearningWeights({
              orgId,
              projectProfile,
              selectedComp: comp,
              action: feedbackData.action as 'selected' | 'rejected' | 'liked',
              currentScore,
              breakdown: scoreBreakdown,
            });
          }
        }
      }

      res.json(feedback);
    } catch (error) {
      console.error("Error submitting recommendation feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Google Maps API key endpoint
  app.get("/api/config/google-maps-key", (req, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || "" });
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate ICS format
function generateICS(events: Array<{
  id: string;
  summary: string;
  description: string;
  start: Date | string | null;
  end: Date | string | null;
  type: 'activity' | 'task';
}>): string {
  const formatDate = (date: Date | string | null): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const formatDateOnly = (date: Date | string | null): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0].replace(/-/g, '');
  };

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MarinaMatch//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    if (!event.start) continue;

    const isAllDay = event.type === 'task';
    
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${event.id}@marinamatch.com`);
    ics.push(`DTSTAMP:${now}`);
    
    if (isAllDay) {
      ics.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.start)}`);
      ics.push(`DTEND;VALUE=DATE:${formatDateOnly(event.end)}`);
    } else {
      ics.push(`DTSTART:${formatDate(event.start)}`);
      ics.push(`DTEND:${formatDate(event.end)}`);
    }
    
    ics.push(`SUMMARY:${event.summary.replace(/\n/g, '\\n')}`);
    
    if (event.description) {
      ics.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    }
    
    ics.push('STATUS:CONFIRMED');
    ics.push('END:VEVENT');
  }

  ics.push('END:VCALENDAR');

  return ics.join('\r\n');
}
