import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, or, desc, asc, gte, lte } from "drizzle-orm";
import { resolveRecipient } from "@shared/recipient-utils";
import { AIRiskAnalyzer } from "./ai-risk-analyzer";
import { AINotesEnhancer } from "./ai-notes-enhancer";
import { assigneeSubscriptionManager } from "./assignee-subscription-manager";
import { reconciliationService } from "./reconciliation-service";
import { CSVImportService } from "./csv-import-service";
import { DuplicateDetectionService } from "./duplicate-detection-service";
import { CompanyLinkingService } from "./company-linking-service";
import { CalendarService } from "./calendar-service";
import { FuelSyncService } from "./services/fuel/fuel-sync-service";
import { findAllPotentialDuplicates, getDuplicateExplanation } from "./services/duplicate-finder";
import { requirePermission, requireRole } from "./middleware/rbac";
import { AuditService } from "./services/audit-service";
import { setTenantContext, clearTenantContext } from "./middleware/tenant-context";
import vdrRouter from "./vdr-routes";
import shipStoreRouter from "./ship-store-router";
import { customerAnalyticsService } from "./services/customer-analytics-service";
import { rentRollService } from "./services/rent-roll-service";
import { marketingService } from "./services/marketing-service";
import { personaService } from "./services/persona-service";
import { dashboardService } from "./services/dashboard-service";
import { ownedAssetsService } from "./services/owned-assets-service";
import { debtScenarioService } from "./debt-scenario-service";
import { docIntelService } from "./services/doc-intel-service";
import { calculateAll, type TransactionClosingData } from "./services/transactionClosingEngine";
import { ParserService } from "./services/salescomps/parser";
import { CompService } from "./services/salescomps/compService";
import { FilterBuilder } from "./services/salescomps/filterBuilder";
import { RecommendationService } from "./services/salescomps/recommendationService";
import { AICompMatchingService } from "./services/salescomps/aiCompMatchingService";
import { calculateMetrics, generateInsights, calculateCorrelationData, calculateValuationModels, getMatchedComps, type AnalyticsFilters } from "./services/salescomps/analyticsService";
import { generateAIInsights } from "./services/salescomps/aiInsightsService";
import { geocodingService } from "./services/geocodingService";
import { ParserService as RcParserService } from "./services/ratecomps/parser";
import { CompService as RcCompService } from "./services/ratecomps/compService";
import { FilterBuilder as RcFilterBuilder } from "./services/ratecomps/filterBuilder";
import { RecommendationService as RcRecommendationService } from "./services/ratecomps/recommendationService";
import { calculateMetrics as rcCalculateMetrics, generateInsights as rcGenerateInsights, type AnalyticsFilters as RcAnalyticsFilters } from "./services/ratecomps/analyticsService";
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
  insertScAnalyticsFilterPresetSchema,
  updateScAnalyticsFilterPresetSchema,
  insertScRecommendationFeedbackSchema,
  scProjectProfileSchema,
  scWeightOverridesSchema,
  scPortfolios,
  scPortfolioComps,
  projects,
  fuelSales,
  insertFuelSaleSchema,
  updateFuelSaleSchema,
  fuelTypes,
  insertFuelTypeSchema,
  updateFuelTypeSchema,
  fuelInventory,
  insertFuelInventorySchema,
  updateFuelInventorySchema,
  fuelDeliveries,
  insertFuelDeliverySchema,
  updateFuelDeliverySchema,
  fuelFinancialProjections,
  insertFuelProjectionSchema,
  updateFuelProjectionSchema,
  fuelImportLogs,
  insertFuelImportLogSchema,
  fuelIntegrations,
  insertFuelIntegrationSchema,
  updateFuelIntegrationSchema,
  debtScenarios,
  insertDebtScenarioSchema,
  updateDebtScenarioSchema,
  rentRolls,
  rentRollEntries,
  insertRentRollSchema,
  updateRentRollSchema,
  insertRentRollEntrySchema,
  updateRentRollEntrySchema,
  marketingCampaigns,
  marketingExpenses,
  leadAttribution,
  emailCampaigns,
  insertMarketingCampaignSchema,
  updateMarketingCampaignSchema,
  insertMarketingExpenseSchema,
  updateMarketingExpenseSchema,
  insertLeadAttributionSchema,
  insertEmailCampaignSchema,
  insertUserPersonaAssignmentSchema,
  updateUserPersonaAssignmentSchema,
  insertDashboardWidgetSchema,
  updateDashboardWidgetSchema,
  insertUserDashboardLayoutSchema,
  updateUserDashboardLayoutSchema,
  insertOwnedAssetSchema,
  updateOwnedAssetSchema,
  insertAssetPerformanceSnapshotSchema,
  modelingProjects,
  insertModelingProjectSchema,
  updateModelingProjectSchema,
  insertModelingRegionSchema,
  updateModelingRegionSchema,
  transactionClosingSummary,
  closingCostLines,
  transitionCostLines,
  nwcLines,
  insertTransactionClosingSummarySchema,
  insertClosingCostLineSchema,
  insertTransitionCostLineSchema,
  insertNwcLineSchema
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
  columnMappingSchema,
  bulkPortfolioCreateSchema
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
  // CRITICAL: Query database directly to avoid storage.getProject() interception issue with approved projects
  const authorizeProjectAccess = async (projectId: string, orgId: string) => {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
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
  const authenticateUser = async (req: any, res: any, next: any) => {
    try {
      // In production, this would validate JWT tokens or session
      req.user = { id: "user-1", orgId: "org-1", role: "owner", email: "demo@marinamatch.com" };
      
      // Set tenant context for RLS
      if (req.user?.orgId) {
        await setTenantContext(req.user.orgId);
        
        // Clear tenant context when response finishes
        res.on('finish', () => {
          clearTenantContext().catch(err => {
            console.error('Error clearing tenant context:', err);
          });
        });
      }
      
      next();
    } catch (error) {
      console.error('Authentication/tenant context error:', error);
      next(error);
    }
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
  app.use("/api/pending-properties", authenticateUser);
  app.use("/api/pending-contacts", authenticateUser);
  app.use("/api/pending-companies", authenticateUser);
  app.use("/api/rate-comps", authenticateUser);
  app.use("/api/rc-columns", authenticateUser);
  app.use("/api/rc-projects", authenticateUser);
  app.use("/api/rc-saved-searches", authenticateUser);
  app.use("/api/rc-recommendations", authenticateUser);
  app.use("/api/rc-pending-properties", authenticateUser);
  app.use("/api/debt-scenarios", authenticateUser);
  app.use("/api/docktalk", authenticateUser);
  app.use("/api/vdr", authenticateUser, vdrRouter);
  app.use("/api/ship-store", authenticateUser, shipStoreRouter);

  // Auth endpoints
  app.get("/api/auth/me", authenticateUser, (req: any, res) => {
    res.json({
      id: req.user.id,
      orgId: req.user.orgId,
      role: req.user.role
    });
  });

  // Organization features endpoint
  app.get("/api/organization/features", authenticateUser, async (req: any, res) => {
    try {
      const features = await storage.getOrganizationFeatures(req.user.orgId);
      res.json(features);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization features" });
    }
  });

  // Initialize SalesComps services
  const parserService = new ParserService();
  const compService = new CompService(storage, parserService);
  const filterBuilder = new FilterBuilder();
  const recommendationService = new RecommendationService(storage);
  const aiCompMatchingService = new AICompMatchingService();

  // Initialize RateComps services
  const rcParserService = new RcParserService();
  const rcCompService = new RcCompService(storage, rcParserService);
  const rcFilterBuilder = new RcFilterBuilder();
  const rcRecommendationService = new RcRecommendationService(storage);

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

  // Multer configuration for file uploads (RateComps CSV/Excel imports)
  const uploadRateComps = multer({ 
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
      // Query database directly (bypassing storage method which has interception issue)
      const { db } = await import("./db");
      const { projects } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [project] = await db.select().from(projects).where(eq(projects.id, req.params.id));
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const settings = await storage.getProjectSettings(project.id);
      const tasks = await storage.getTasksForProject(project.id);

      res.json({ project, settings, tasks });
    } catch (error) {
      console.error("Error fetching project:", error);
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

  // Accept Project (Mark DD as accepted/completed)
  app.post("/api/dd/projects/:id/accept", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Query database directly (bypassing storage method which has interception issue)
      const { db } = await import("./db");
      const { projects } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [project] = await db.select().from(projects).where(eq(projects.id, req.params.id));
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Verify org access
      if (project.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Update project status to 'accepted'
      const [updated] = await db
        .update(projects)
        .set({ status: 'accepted' })
        .where(eq(projects.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error accepting project:", error);
      res.status(500).json({ error: "Failed to accept project" });
    }
  });

  // Unaccept Project (Undo DD approval - for mistakes, extensions, etc.)
  app.post("/api/dd/projects/:id/unaccept", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Query database directly (bypassing storage method which has interception issue)
      const { db } = await import("./db");
      const { projects } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [project] = await db.select().from(projects).where(eq(projects.id, req.params.id));
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Verify org access
      if (project.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Update project status back to 'active'
      const [updated] = await db
        .update(projects)
        .set({ status: 'active' })
        .where(eq(projects.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error unaccepting project:", error);
      res.status(500).json({ error: "Failed to undo DD approval" });
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
        const calendarEvent = await storage.syncTaskCalendarEvent(task);
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
        const calendarEvent = await storage.syncTaskCalendarEvent(updated);
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
        for (const taskBlueprint of template.tasksBlueprint) {
          if (taskBlueprint && taskBlueprint.trim()) {
            // Parse title and description from blueprint (format: "Title||Description")
            const parts = taskBlueprint.split('||');
            const title = parts[0]?.trim() || taskBlueprint.trim();
            const description = parts[1]?.trim() || "";
            
            const taskData = {
              projectId: req.params.projectId,
              title: title,
              description: description,
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

  // Project-Pending-Contact Association Routes
  app.get("/api/dd/projects/:projectId/pending-contacts", async (req: any, res) => {
    try {
      // Verify project access
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const projectPendingContacts = await storage.getProjectPendingContacts(req.params.projectId);
      res.json(projectPendingContacts);
    } catch (error) {
      console.error("Error fetching project pending contacts:", error);
      res.status(500).json({ error: "Failed to fetch project pending contacts" });
    }
  });

  app.post("/api/dd/projects/:projectId/pending-contacts/quick-add", async (req: any, res) => {
    try {
      // Verify project access
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const { fullName, role, customRole, projectNotes, isPrimary } = req.body;
      
      if (!fullName || !role) {
        return res.status(400).json({ error: "Full name and role are required" });
      }

      // Create pending contact
      const pendingContact = await storage.createPendingContact({
        orgId: req.user.orgId,
        fullName,
        sourceType: 'dd_project',
        sourceId: req.params.projectId,
        status: 'pending',
        createdBy: req.user.id,
      });

      // Link to project
      const projectPendingContact = await storage.addPendingContactToProject({
        projectId: req.params.projectId,
        pendingContactId: pendingContact.id,
        role,
        customRole: customRole || null,
        projectNotes: projectNotes || null,
        isPrimary: isPrimary || false,
        createdBy: req.user.id,
      });

      res.json({ pendingContact, projectPendingContact });
    } catch (error) {
      console.error("Error quick-adding pending contact to project:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to quick-add contact" 
      });
    }
  });

  app.delete("/api/dd/projects/:projectId/pending-contacts/:pendingContactId/:role", async (req: any, res) => {
    try {
      // Verify project access
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(404).json({ error: "Project not found" });
      }

      await storage.removePendingContactFromProject(
        req.params.projectId, 
        req.params.pendingContactId, 
        req.params.role
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing pending contact from project:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to remove pending contact from project" 
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

  // Initialize webhook security (uses in-memory storage for idempotency)
  const webhookSecurity = new WebhookSecurity({
    secret: process.env.WEBHOOK_SECRET || "default-webhook-secret-key",
    timestampToleranceMinutes: 5,
    requireIdempotencyKey: true,
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

  // CRM Pending Contacts
  app.get("/api/crm/pending-contacts", async (req: any, res) => {
    try {
      const pendingContacts = await storage.getPendingContactsForOrg(req.user.orgId);
      res.json(pendingContacts);
    } catch (error) {
      console.error("Failed to get pending contacts:", error);
      res.status(500).json({ error: "Failed to retrieve pending contacts" });
    }
  });

  app.get("/api/crm/pending-contacts/:id", async (req: any, res) => {
    try {
      const pendingContact = await storage.getPendingContact(req.params.id);
      if (!pendingContact) {
        return res.status(404).json({ error: "Pending contact not found" });
      }
      res.json(pendingContact);
    } catch (error) {
      console.error("Failed to get pending contact:", error);
      res.status(500).json({ error: "Failed to retrieve pending contact" });
    }
  });

  app.post("/api/crm/pending-contacts/:id/accept", async (req: any, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      const contact = await storage.acceptPendingContact(req.params.id, req.user.id, mode);
      res.json(contact);
    } catch (error) {
      console.error("Failed to accept pending contact:", error);
      res.status(500).json({ error: "Failed to accept pending contact" });
    }
  });

  app.post("/api/crm/pending-contacts/:id/reject", async (req: any, res) => {
    try {
      await storage.rejectPendingContact(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to reject pending contact:", error);
      res.status(500).json({ error: "Failed to reject pending contact" });
    }
  });

  // CRM Pending Companies
  app.get("/api/crm/pending-companies", async (req: any, res) => {
    try {
      const pendingCompanies = await storage.getPendingCompaniesForOrg(req.user.orgId);
      res.json(pendingCompanies);
    } catch (error) {
      console.error("Failed to get pending companies:", error);
      res.status(500).json({ error: "Failed to retrieve pending companies" });
    }
  });

  app.get("/api/crm/pending-companies/:id", async (req: any, res) => {
    try {
      const pendingCompany = await storage.getPendingCompany(req.params.id);
      if (!pendingCompany) {
        return res.status(404).json({ error: "Pending company not found" });
      }
      res.json(pendingCompany);
    } catch (error) {
      console.error("Failed to get pending company:", error);
      res.status(500).json({ error: "Failed to retrieve pending company" });
    }
  });

  app.post("/api/crm/pending-companies/:id/accept", async (req: any, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      const company = await storage.acceptPendingCompany(req.params.id, req.user.id, mode);
      res.json(company);
    } catch (error) {
      console.error("Failed to accept pending company:", error);
      res.status(500).json({ error: "Failed to accept pending company" });
    }
  });

  app.post("/api/crm/pending-companies/:id/reject", async (req: any, res) => {
    try {
      await storage.rejectPendingCompany(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to reject pending company:", error);
      res.status(500).json({ error: "Failed to reject pending company" });
    }
  });

  // CRM Pending Properties
  app.get("/api/crm/pending-properties", async (req: any, res) => {
    try {
      const pendingProperties = await storage.getPendingProperties(req.user.orgId, 'pending');
      res.json(pendingProperties);
    } catch (error) {
      console.error("Failed to get pending properties:", error);
      res.status(500).json({ error: "Failed to retrieve pending properties" });
    }
  });

  app.get("/api/crm/pending-properties/:id", async (req: any, res) => {
    try {
      const pendingProperty = await storage.getPendingProperty(req.params.id);
      if (!pendingProperty) {
        return res.status(404).json({ error: "Pending property not found" });
      }
      res.json(pendingProperty);
    } catch (error) {
      console.error("Failed to get pending property:", error);
      res.status(500).json({ error: "Failed to retrieve pending property" });
    }
  });

  app.post("/api/crm/pending-properties/:id/accept", async (req: any, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      const property = await storage.acceptPendingProperty(req.params.id, req.user.id, mode);
      res.json(property);
    } catch (error) {
      console.error("Failed to accept pending property:", error);
      res.status(500).json({ error: "Failed to accept pending property" });
    }
  });

  app.post("/api/crm/pending-properties/:id/reject", async (req: any, res) => {
    try {
      await storage.rejectPendingProperty(req.params.id, req.user.orgId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to reject pending property:", error);
      res.status(500).json({ error: "Failed to reject pending property" });
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
  // CRM Prospecting Settings
  // ===================================================================

  // Get user prospecting settings (create default if doesn't exist)
  app.get("/api/prospecting/settings", async (req: any, res) => {
    try {
      let settings = await storage.getProspectingUserSettings(req.user.id);
      
      // Create default settings if they don't exist
      if (!settings) {
        settings = await storage.createProspectingUserSettings({
          userId: req.user.id,
          orgId: req.user.orgId,
          weekStartDay: 'monday'
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Failed to get prospecting settings:", error);
      res.status(500).json({ error: "Failed to retrieve prospecting settings" });
    }
  });

  // Update user prospecting settings
  app.put("/api/prospecting/settings", async (req: any, res) => {
    try {
      const { insertCrmProspectingUserSettingsSchema } = await import("@shared/schema");
      const validated = insertCrmProspectingUserSettingsSchema.partial().parse(req.body);
      
      // Check if settings exist
      const existing = await storage.getProspectingUserSettings(req.user.id);
      
      let settings;
      if (existing) {
        settings = await storage.updateProspectingUserSettings(req.user.id, validated);
      } else {
        settings = await storage.createProspectingUserSettings({
          ...validated,
          userId: req.user.id,
          orgId: req.user.orgId
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      console.error("Failed to update prospecting settings:", error);
      res.status(500).json({ error: "Failed to update prospecting settings" });
    }
  });

  // ===================================================================
  // CRM Prospecting Goal Templates
  // ===================================================================

  // Get all goal templates for user
  app.get("/api/prospecting/goal-templates", async (req: any, res) => {
    try {
      const templates = await storage.getProspectingGoalTemplates(req.user.id);
      res.json(templates);
    } catch (error) {
      console.error("Failed to get goal templates:", error);
      res.status(500).json({ error: "Failed to retrieve goal templates" });
    }
  });

  // Create a new goal template
  app.post("/api/prospecting/goal-templates", async (req: any, res) => {
    try {
      const { insertCrmProspectingGoalTemplateSchema } = await import("@shared/schema");
      const validated = insertCrmProspectingGoalTemplateSchema.parse({
        ...req.body,
        userId: req.user.id,
        orgId: req.user.orgId
      });
      
      const template = await storage.createProspectingGoalTemplate(validated);
      res.json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid goal template data", details: error.errors });
      }
      console.error("Failed to create goal template:", error);
      res.status(500).json({ error: "Failed to create goal template" });
    }
  });

  // Update a goal template
  app.put("/api/prospecting/goal-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getProspectingGoalTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: "Goal template not found" });
      }
      
      if (template.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized to update this goal template" });
      }
      
      const { insertCrmProspectingGoalTemplateSchema } = await import("@shared/schema");
      const validated = insertCrmProspectingGoalTemplateSchema.partial().parse(req.body);
      
      const updated = await storage.updateProspectingGoalTemplate(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid goal template data", details: error.errors });
      }
      console.error("Failed to update goal template:", error);
      res.status(500).json({ error: "Failed to update goal template" });
    }
  });

  // Delete a goal template
  app.delete("/api/prospecting/goal-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getProspectingGoalTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: "Goal template not found" });
      }
      
      if (template.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized to delete this goal template" });
      }
      
      await storage.deleteProspectingGoalTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete goal template:", error);
      res.status(500).json({ error: "Failed to delete goal template" });
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
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const search = req.query.search as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      if (page !== undefined || limit !== undefined) {
        const validatedPage = (page && page > 0 && Number.isInteger(page)) ? page : 1;
        const validatedLimit = (limit && limit > 0 && limit <= 1000 && Number.isInteger(limit)) ? limit : 50;

        if ((page !== undefined && (isNaN(page) || page < 1 || !Number.isInteger(page))) ||
            (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 1000 || !Number.isInteger(limit)))) {
          return res.status(400).json({ 
            error: "Invalid pagination parameters. Page must be a positive integer, limit must be between 1 and 1000." 
          });
        }

        const result = await storage.getCrmContactsForOrgPaginated(req.user.orgId, {
          page: validatedPage,
          limit: validatedLimit,
          search,
          sortBy,
          sortOrder
        });
        res.json(result);
      } else {
        const contacts = await storage.getCrmContactsForOrg(req.user.orgId);
        res.json(contacts);
      }
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

  // Custom Storage Types routes (must be before /:id route)
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

  // Custom Column Management routes (must be before /:id route)
  app.get('/api/sales-comps/columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const columns = await storage.getCompColumns(orgId);
      res.json(columns);
    } catch (error) {
      console.error("Error fetching custom columns:", error);
      res.status(500).json({ message: "Failed to fetch custom columns" });
    }
  });

  app.post('/api/sales-comps/columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { key, label, type, options, required, visible, orderIndex } = req.body;

      if (!key || !label || !type) {
        return res.status(400).json({ message: "Field key, label, and type are required" });
      }

      // Check for duplicate key
      const existing = await storage.getCompColumns(orgId);
      if (existing.some(c => c.key === key)) {
        return res.status(400).json({ message: "Column with this key already exists" });
      }

      const column = await storage.createCompColumn({
        orgId,
        key,
        label,
        type,
        options: options || null,
        required: required || false,
        visible: visible !== false,
        orderIndex: orderIndex || 0,
      });

      res.status(201).json(column);
    } catch (error) {
      console.error("Error creating custom column:", error);
      res.status(500).json({ message: "Failed to create custom column" });
    }
  });

  app.delete('/api/sales-comps/columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteCompColumn(req.params.id, orgId);

      if (!success) return res.status(404).json({ message: "Column not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom column:", error);
      res.status(500).json({ message: "Failed to delete custom column" });
    }
  });

  // Pending Property Profiles routes (must be before /:id route)
  app.get('/api/sales-comps/pending-property-profiles', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const status = req.query.status as string | undefined;
      const profiles = await storage.getPendingPropertyProfiles(orgId, status);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching pending property profiles:", error);
      res.status(500).json({ message: "Failed to fetch pending property profiles" });
    }
  });

  app.post('/api/sales-comps/pending-property-profiles', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { compId, status } = req.body;

      if (!compId) {
        return res.status(400).json({ message: "compId is required" });
      }

      const profile = await storage.createPendingPropertyProfile({
        compId,
        orgId,
        status: status || 'pending',
      });

      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating pending property profile:", error);
      res.status(500).json({ message: "Failed to create pending property profile" });
    }
  });

  app.patch('/api/sales-comps/pending-property-profiles/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.body;
      
      // Verify ownership before updating
      const existing = await storage.getPendingPropertyProfiles(orgId);
      const profile = existing.find(p => p.id === req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Pending property profile not found" });
      }
      
      const updated = await storage.updatePendingPropertyProfile(req.params.id, { status });
      res.json(updated);
    } catch (error) {
      console.error("Error updating pending property profile:", error);
      res.status(500).json({ message: "Failed to update pending property profile" });
    }
  });

  app.delete('/api/sales-comps/pending-property-profiles/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Verify ownership before deleting
      const existing = await storage.getPendingPropertyProfiles(orgId);
      const profile = existing.find(p => p.id === req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Pending property profile not found" });
      }
      
      const success = await storage.deletePendingPropertyProfile(req.params.id);
      if (!success) return res.status(404).json({ message: "Pending property profile not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pending property profile:", error);
      res.status(500).json({ message: "Failed to delete pending property profile" });
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

  app.post('/api/sales-comps/backfill-properties', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      
      
      const result = await storage.getComps({ orgId, pageSize: 10000 });
      const comps = result.comps;
      const compsWithoutProperty = comps.filter(comp => !comp.propertyId && comp.marina);
      
      
      let created = 0;
      let matched = 0;
      let failed = 0;
      
      for (const comp of compsWithoutProperty) {
        try {
          let propertyId = null;
          
          const matchedProperty = await storage.findPropertyByLocation(
            orgId,
            comp.marina!,
            comp.city || undefined,
            comp.state || undefined
          );
          
          if (matchedProperty) {
            propertyId = matchedProperty.id;
            matched++;
          } else {
            const address = [
              comp.address,
              comp.city && comp.state ? `${comp.city}, ${comp.state}` : comp.city || comp.state
            ].filter(Boolean).join(', ');
            
            const newProperty = await storage.createCrmProperty({
              title: comp.marina!,
              type: 'marina',
              status: 'available',
              address: address || undefined,
              ownerId: orgId,
              listingPrice: comp.salePrice ? String(comp.salePrice) : undefined,
              description: `Auto-created from sales comp backfill`,
            });
            
            propertyId = newProperty.id;
            created++;
          }
          
          if (propertyId) {
            await storage.updateComp(comp.id, { propertyId }, orgId);
          }
        } catch (error) {
          failed++;
          console.error(`❌ Failed to process comp ${comp.id}:`, error);
        }
      }
      
      const summary = {
        total: compsWithoutProperty.length,
        propertiesCreated: created,
        propertiesMatched: matched,
        failed,
      };
      
      
      res.json(summary);
    } catch (error) {
      console.error("Error during property backfill:", error);
      res.status(500).json({ message: "Failed to backfill properties" });
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

      // Auto-create pending company if buyerCompany was provided
      if (compData.buyerCompany) {
        try {
          const companyResult = await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: comp.id,
            orgId,
            userId,
            buyerCompany: compData.buyerCompany,
            city: compData.city,
            state: compData.state,
          });
          if (companyResult.created) {
          }
        } catch (companyError) {
          console.error('Error auto-creating pending company:', companyError);
        }
      }

      // Auto-create pending contact if agent info was provided
      if (compData.agentFirstName || compData.agentLastName) {
        try {
          const contactResult = await storage.autoCreatePendingContactFromSalesComp({
            salesCompId: comp.id,
            orgId,
            userId,
            agentFirstName: compData.agentFirstName,
            agentLastName: compData.agentLastName,
            brokerage: compData.brokerage,
          });
          if (contactResult.created) {
          }
        } catch (contactError) {
          console.error('Error auto-creating pending contact:', contactError);
        }
      }

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

      // Auto-create pending company if buyerCompany was provided
      if (updates.buyerCompany) {
        try {
          const companyResult = await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: req.params.id,
            orgId,
            userId,
            buyerCompany: updates.buyerCompany,
            city: updates.city,
            state: updates.state,
          });
          if (companyResult.created) {
          } else {
          }
        } catch (companyError) {
          console.error('Error auto-creating pending company:', companyError);
        }
      }

      // Auto-create pending contact if agent info was provided
      if (updates.agentFirstName || updates.agentLastName) {
        try {
          const contactResult = await storage.autoCreatePendingContactFromSalesComp({
            salesCompId: req.params.id,
            orgId,
            userId,
            agentFirstName: updates.agentFirstName,
            agentLastName: updates.agentLastName,
            brokerage: updates.brokerage,
          });
          if (contactResult.created) {
          } else {
          }
        } catch (contactError) {
          console.error('Error auto-creating pending contact:', contactError);
        }
      }

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

  app.post('/api/sales-comps/:id/duplicate', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const originalComp = await storage.getCompById(id, orgId);
      if (!originalComp) {
        return res.status(404).json({ message: "Comp not found" });
      }

      const duplicatedComp = await compService.duplicateComp(id, orgId, userId);
      res.status(201).json(duplicatedComp);
    } catch (error) {
      console.error("Error duplicating comp:", error);
      res.status(500).json({ message: "Failed to duplicate comp" });
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

  // Geocoding endpoint
  app.post('/api/sales-comps/:id/geocode', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const comp = await storage.getCompById(id, orgId);
      if (!comp) {
        return res.status(404).json({ message: "Comp not found" });
      }

      const addressString = geocodingService.buildAddressString({
        marina: comp.marina,
        address: comp.address || undefined,
        city: comp.city || undefined,
        state: comp.state || undefined,
        zip: comp.zip || undefined,
      });

      if (!addressString) {
        return res.status(400).json({ message: "No address information available to geocode" });
      }

      const result = await geocodingService.geocodeAddress(addressString);

      if ('error' in result) {
        return res.status(400).json(result);
      }

      await compService.updateComp(
        id,
        { 
          lat: result.lat.toString(),
          lng: result.lng.toString(),
          updatedBy: userId 
        },
        orgId,
        userId
      );

      res.json(result);
    } catch (error) {
      console.error("Error geocoding comp:", error);
      res.status(500).json({ message: "Failed to geocode comp" });
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

  app.post('/api/sales-comps/import/:importId/preview', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { mapping, normalization, importMode = 'upsert', updateBlankValues = false } = req.body;
      
      const result = await compService.previewImport(
        req.params.importId,
        orgId,
        mapping,
        normalization,
        importMode,
        updateBlankValues
      );

      res.json(result);
    } catch (error) {
      console.error("Error previewing import:", error);
      res.status(500).json({ message: "Failed to preview import" });
    }
  });

  app.post('/api/sales-comps/import/:importId/commit', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { mapping, normalization, excludedRows = [], parentPortfolioId, importMode = 'upsert', updateBlankValues = false } = req.body;
      
      
      const result = await compService.processImport(
        req.params.importId,
        orgId,
        userId,
        mapping,
        normalization,
        excludedRows,
        parentPortfolioId,
        importMode,
        updateBlankValues
      );
      

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

  // Analytics endpoint
  app.post('/api/sales-comps/analytics', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body;

      const metrics = await calculateMetrics(orgId, filters);
      
      // Use AI-powered insights with fallback to basic insights
      let insights;
      try {
        insights = await generateAIInsights(metrics, filters);
      } catch (aiError) {
        console.error("AI insights failed, using fallback:", aiError);
        const basicInsights = await generateInsights(metrics, filters);
        // Convert basic string insights to AIInsight format
        insights = basicInsights.map(text => ({
          category: 'trend',
          title: text.substring(0, 50),
          description: text,
          confidence: 'medium',
          priority: 3,
        }));
      }

      res.json({ metrics, insights });
    } catch (error) {
      console.error("Error calculating analytics:", error);
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  // Correlation analysis endpoint
  app.post('/api/sales-comps/analytics/correlation', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body;

      const correlationData = await calculateCorrelationData(orgId, filters);
      res.json(correlationData);
    } catch (error) {
      console.error("Error calculating correlation data:", error);
      res.status(500).json({ message: "Failed to calculate correlation data" });
    }
  });

  // Valuation models endpoint
  app.post('/api/sales-comps/analytics/valuation', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body;

      const valuationModels = await calculateValuationModels(orgId, filters);
      res.json(valuationModels);
    } catch (error) {
      console.error("Error calculating valuation models:", error);
      res.status(500).json({ message: "Failed to calculate valuation models" });
    }
  });

  // Matched comps endpoint
  app.post('/api/sales-comps/analytics/matched-comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body;

      const result = await getMatchedComps(orgId, filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching matched comps:", error);
      res.status(500).json({ message: "Failed to fetch matched comps" });
    }
  });

  // Analytics Filter Presets routes
  app.get('/api/sales-comps/analytics/filter-presets', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const presets = await storage.getAnalyticsFilterPresets(orgId, userId);
      res.json(presets);
    } catch (error) {
      console.error("Error fetching analytics filter presets:", error);
      res.status(500).json({ message: "Failed to fetch analytics filter presets" });
    }
  });

  app.post('/api/sales-comps/analytics/filter-presets', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const presetData = insertScAnalyticsFilterPresetSchema.parse(req.body);
      const preset = await storage.createAnalyticsFilterPreset({
        ...presetData,
        orgId,
        userId,
      });

      res.status(201).json(preset);
    } catch (error) {
      console.error("Error creating analytics filter preset:", error);
      res.status(500).json({ message: "Failed to create analytics filter preset" });
    }
  });

  app.patch('/api/sales-comps/analytics/filter-presets/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const presetData = updateScAnalyticsFilterPresetSchema.parse(req.body);
      const preset = await storage.updateAnalyticsFilterPreset(req.params.id, presetData, orgId, userId);

      if (!preset) return res.status(404).json({ message: "Analytics filter preset not found" });

      res.json(preset);
    } catch (error) {
      console.error("Error updating analytics filter preset:", error);
      res.status(500).json({ message: "Failed to update analytics filter preset" });
    }
  });

  app.delete('/api/sales-comps/analytics/filter-presets/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;

      const success = await storage.deleteAnalyticsFilterPreset(req.params.id, orgId, userId);

      if (!success) return res.status(404).json({ message: "Analytics filter preset not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting analytics filter preset:", error);
      res.status(500).json({ message: "Failed to delete analytics filter preset" });
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

  // Pending Properties routes - Review queue for properties created from comps
  app.get('/api/pending-properties', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.query;

      const pendingProps = await storage.getPendingProperties(orgId, status);
      res.json(pendingProps);
    } catch (error) {
      console.error("Error fetching pending properties:", error);
      res.status(500).json({ message: "Failed to fetch pending properties" });
    }
  });

  // Find all potential duplicates for a pending property with similarity scores
  app.get('/api/pending-properties/:id/all-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;

      // Get the pending property
      const pending = await storage.getPendingProperty(id, orgId);
      if (!pending) {
        return res.status(404).json({ message: "Pending property not found" });
      }

      // Get all properties for this organization
      const allProperties = await storage.getPropertiesForOrg(orgId);

      // Helper function to parse currency strings
      const parseCurrency = (value: string | number | null | undefined): number | null => {
        if (!value) return null;
        if (typeof value === 'number') return value;
        // Remove currency symbols, commas, and whitespace
        const cleaned = value.replace(/[$,\s]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      };

      // Normalize properties with parsed prices
      const normalizedProperties = allProperties.map(prop => ({
        ...prop,
        listingPrice: parseCurrency(prop.listingPrice)?.toString() || null
      }));

      // Find all potential duplicates with similarity scoring
      const duplicateMatches = findAllPotentialDuplicates(
        pending.marinaName,
        pending.city,
        pending.state,
        pending.salePrice,
        normalizedProperties as any,
        30 // Minimum 30% similarity threshold
      );

      // Format the response with explanations
      const enhancedMatches = duplicateMatches.map(match => ({
        ...match,
        explanation: getDuplicateExplanation(match)
      }));

      res.json({
        pendingProperty: pending,
        totalMatches: enhancedMatches.length,
        matches: enhancedMatches
      });
    } catch (error) {
      console.error("Error finding duplicate properties:", error);
      res.status(500).json({ message: "Failed to find duplicate properties" });
    }
  });

  app.post('/api/pending-properties/:id/accept', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const property = await storage.acceptPendingProperty(id, orgId, userId);
      if (!property) {
        return res.status(404).json({ message: "Pending property not found or already processed" });
      }

      res.json(property);
    } catch (error) {
      console.error("Error accepting pending property:", error);
      res.status(500).json({ message: "Failed to accept pending property" });
    }
  });

  app.post('/api/pending-properties/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const success = await storage.rejectPendingProperty(id, orgId, userId);
      if (!success) {
        return res.status(404).json({ message: "Pending property not found or already processed" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error rejecting pending property:", error);
      res.status(500).json({ message: "Failed to reject pending property" });
    }
  });

  app.patch('/api/pending-properties/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const updates = req.body;

      const updated = await storage.updatePendingProperty(id, orgId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Pending property not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating pending property:", error);
      res.status(500).json({ message: "Failed to update pending property" });
    }
  });

  app.post('/api/pending-properties/:id/merge', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { propertyId } = req.body;

      if (!propertyId) {
        return res.status(400).json({ message: "Property ID is required" });
      }

      const result = await storage.mergePendingPropertyWithExisting(id, propertyId, orgId, userId);
      if (!result) {
        return res.status(404).json({ message: "Pending property or target property not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error merging pending property:", error);
      res.status(500).json({ message: "Failed to merge pending property" });
    }
  });

  // Pending Contacts routes - Review queue for contacts created from comps or DD projects
  app.get('/api/pending-contacts', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.query;

      const pendingContacts = await storage.getPendingContacts(orgId, status);
      res.json(pendingContacts);
    } catch (error) {
      console.error("Error fetching pending contacts:", error);
      res.status(500).json({ message: "Failed to fetch pending contacts" });
    }
  });

  app.get('/api/pending-contacts/:id/all-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;

      const pending = await storage.getPendingContact(id, orgId);
      if (!pending) {
        return res.status(404).json({ message: "Pending contact not found" });
      }

      const allContacts = await storage.getContactsForOrg(orgId);

      const similarityScores = allContacts.map(contact => {
        let score = 0;
        const pendingFullName = pending.fullName || `${pending.firstName || ''} ${pending.lastName || ''}`.trim();
        const contactFullName = contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

        if (pendingFullName && contactFullName) {
          const normalizedPending = pendingFullName.toLowerCase().trim();
          const normalizedContact = contactFullName.toLowerCase().trim();
          if (normalizedPending === normalizedContact) score += 100;
          else if (normalizedPending.includes(normalizedContact) || normalizedContact.includes(normalizedPending)) score += 70;
        }

        if (pending.email && contact.email && pending.email.toLowerCase() === contact.email.toLowerCase()) {
          score += 80;
        }

        if (pending.phone && contact.phone) {
          const normalizedPendingPhone = pending.phone.replace(/\D/g, '');
          const normalizedContactPhone = contact.phone.replace(/\D/g, '');
          if (normalizedPendingPhone === normalizedContactPhone) score += 60;
        }

        return { contact, score };
      }).filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      res.json(similarityScores);
    } catch (error) {
      console.error("Error finding duplicate contacts:", error);
      res.status(500).json({ message: "Failed to find duplicate contacts" });
    }
  });

  app.post('/api/pending-contacts/:id/accept', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const contact = await storage.acceptPendingContact(id, orgId, userId);
      if (!contact) {
        return res.status(404).json({ message: "Pending contact not found or already processed" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Error accepting pending contact:", error);
      res.status(500).json({ message: "Failed to accept pending contact" });
    }
  });

  app.post('/api/pending-contacts/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const success = await storage.rejectPendingContact(id, orgId, userId);
      if (!success) {
        return res.status(404).json({ message: "Pending contact not found or already processed" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error rejecting pending contact:", error);
      res.status(500).json({ message: "Failed to reject pending contact" });
    }
  });

  app.patch('/api/pending-contacts/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const updates = req.body;

      const updated = await storage.updatePendingContact(id, orgId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Pending contact not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating pending contact:", error);
      res.status(500).json({ message: "Failed to update pending contact" });
    }
  });

  app.post('/api/pending-contacts/:id/merge', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { contactId } = req.body;

      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const result = await storage.mergePendingContactWithExisting(id, contactId, orgId, userId);
      if (!result) {
        return res.status(404).json({ message: "Pending contact or target contact not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error merging pending contact:", error);
      res.status(500).json({ message: "Failed to merge pending contact" });
    }
  });

  // Pending Companies routes - Review queue for companies created from comps or DD projects
  app.get('/api/pending-companies', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.query;

      const pendingCompanies = await storage.getPendingCompanies(orgId, status);
      res.json(pendingCompanies);
    } catch (error) {
      console.error("Error fetching pending companies:", error);
      res.status(500).json({ message: "Failed to fetch pending companies" });
    }
  });

  app.get('/api/pending-companies/:id/all-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;

      const pending = await storage.getPendingCompany(id, orgId);
      if (!pending) {
        return res.status(404).json({ message: "Pending company not found" });
      }

      const allCompanies = await storage.getCompaniesForOrg(orgId);

      const similarityScores = allCompanies.map(company => {
        let score = 0;

        if (pending.name && company.name) {
          const normalizedPending = pending.name.toLowerCase().trim();
          const normalizedCompany = company.name.toLowerCase().trim();
          if (normalizedPending === normalizedCompany) score += 100;
          else if (normalizedPending.includes(normalizedCompany) || normalizedCompany.includes(normalizedPending)) score += 70;
        }

        if (pending.website && company.website && pending.website.toLowerCase() === company.website.toLowerCase()) {
          score += 60;
        }

        if (pending.phone && company.phone) {
          const normalizedPendingPhone = pending.phone.replace(/\D/g, '');
          const normalizedCompanyPhone = company.phone.replace(/\D/g, '');
          if (normalizedPendingPhone === normalizedCompanyPhone) score += 50;
        }

        if (pending.city && company.city && pending.state && company.state) {
          if (pending.city.toLowerCase() === company.city.toLowerCase() && 
              pending.state.toLowerCase() === company.state.toLowerCase()) {
            score += 30;
          }
        }

        return { company, score };
      }).filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      res.json(similarityScores);
    } catch (error) {
      console.error("Error finding duplicate companies:", error);
      res.status(500).json({ message: "Failed to find duplicate companies" });
    }
  });

  app.post('/api/pending-companies/:id/accept', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const company = await storage.acceptPendingCompany(id, orgId, userId);
      if (!company) {
        return res.status(404).json({ message: "Pending company not found or already processed" });
      }

      res.json(company);
    } catch (error) {
      console.error("Error accepting pending company:", error);
      res.status(500).json({ message: "Failed to accept pending company" });
    }
  });

  app.post('/api/pending-companies/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const success = await storage.rejectPendingCompany(id, orgId, userId);
      if (!success) {
        return res.status(404).json({ message: "Pending company not found or already processed" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error rejecting pending company:", error);
      res.status(500).json({ message: "Failed to reject pending company" });
    }
  });

  app.patch('/api/pending-companies/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const updates = req.body;

      const updated = await storage.updatePendingCompany(id, orgId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Pending company not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating pending company:", error);
      res.status(500).json({ message: "Failed to update pending company" });
    }
  });

  app.post('/api/pending-companies/:id/merge', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }

      const result = await storage.mergePendingCompanyWithExisting(id, companyId, orgId, userId);
      if (!result) {
        return res.status(404).json({ message: "Pending company or target company not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error merging pending company:", error);
      res.status(500).json({ message: "Failed to merge pending company" });
    }
  });

  // Analytics/Metrics routes
  app.post('/api/analytics/calculate', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body.filters || {};

      const analysis = await calculateMetrics(orgId, filters);
      const insights = await generateInsights(analysis, filters);

      res.json({
        analysis,
        insights,
      });
    } catch (error) {
      console.error("Error calculating analytics:", error);
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  app.post('/api/analytics/insights', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body.filters || {};

      const analysis = await calculateMetrics(orgId, filters);
      const insights = await generateInsights(analysis, filters);

      res.json({ insights });
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // ========================================
  // CUSTOMER ANALYTICS ENDPOINTS
  // ========================================
  
  // Get customer analytics overview
  app.get('/api/analytics/customers/overview', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const overview = await customerAnalyticsService.getOverview(orgId);
      res.json(overview);
    } catch (error) {
      console.error('Failed to fetch customer analytics overview:', error);
      res.status(500).json({ error: 'Failed to fetch customer analytics overview' });
    }
  });

  // Get top customers by LTV
  app.get('/api/analytics/customers/top', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'Limit must be between 1 and 100' });
      }
      
      const topCustomers = await customerAnalyticsService.getTopCustomers(orgId, limit);
      res.json(topCustomers);
    } catch (error) {
      console.error('Failed to fetch top customers:', error);
      res.status(500).json({ error: 'Failed to fetch top customers' });
    }
  });

  // Get customer segments
  app.get('/api/analytics/customers/segments', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const segments = await customerAnalyticsService.getCustomerSegments(orgId);
      res.json(segments);
    } catch (error) {
      console.error('Failed to fetch customer segments:', error);
      res.status(500).json({ error: 'Failed to fetch customer segments' });
    }
  });

  // Get customers at churn risk
  app.get('/api/analytics/customers/churn-risk', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const churnRisk = await customerAnalyticsService.getChurnRiskCustomers(orgId);
      res.json(churnRisk);
    } catch (error) {
      console.error('Failed to fetch churn risk customers:', error);
      res.status(500).json({ error: 'Failed to fetch churn risk customers' });
    }
  });

  // Get LTV distribution
  app.get('/api/analytics/customers/ltv-distribution', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const distribution = await customerAnalyticsService.getLtvDistribution(orgId);
      res.json(distribution);
    } catch (error) {
      console.error('Failed to fetch LTV distribution:', error);
      res.status(500).json({ error: 'Failed to fetch LTV distribution' });
    }
  });

  // ========================================
  // RENT ROLL ENDPOINTS
  // ========================================

  // Get all rent rolls
  app.get('/api/operations/rent-rolls', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const context = req.query.context as 'operational' | 'valuation' | undefined;
      const rolls = await rentRollService.getRentRolls(orgId, context);
      res.json(rolls);
    } catch (error) {
      console.error('Failed to fetch rent rolls:', error);
      res.status(500).json({ error: 'Failed to fetch rent rolls' });
    }
  });

  // Get a single rent roll
  app.get('/api/operations/rent-rolls/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const roll = await rentRollService.getRentRollById(req.params.id, orgId);
      
      if (!roll) {
        return res.status(404).json({ error: 'Rent roll not found' });
      }
      
      res.json(roll);
    } catch (error) {
      console.error('Failed to fetch rent roll:', error);
      res.status(500).json({ error: 'Failed to fetch rent roll' });
    }
  });

  // Create a new rent roll
  app.post('/api/operations/rent-rolls', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertRentRollSchema.parse(req.body);
      const roll = await rentRollService.createRentRoll(orgId, data);
      res.status(201).json(roll);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create rent roll:', error);
      res.status(500).json({ error: 'Failed to create rent roll' });
    }
  });

  // Update a rent roll
  app.patch('/api/operations/rent-rolls/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateRentRollSchema.parse(req.body);
      const roll = await rentRollService.updateRentRoll(req.params.id, orgId, data);
      
      if (!roll) {
        return res.status(404).json({ error: 'Rent roll not found' });
      }
      
      res.json(roll);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update rent roll:', error);
      res.status(500).json({ error: 'Failed to update rent roll' });
    }
  });

  // Delete a rent roll
  app.delete('/api/operations/rent-rolls/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await rentRollService.deleteRentRoll(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Rent roll not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete rent roll:', error);
      res.status(500).json({ error: 'Failed to delete rent roll' });
    }
  });

  // Get rent roll entries
  app.get('/api/operations/rent-rolls/:rentRollId/entries', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const entries = await rentRollService.getRentRollEntries(req.params.rentRollId, orgId);
      res.json(entries);
    } catch (error) {
      console.error('Failed to fetch rent roll entries:', error);
      res.status(500).json({ error: 'Failed to fetch rent roll entries' });
    }
  });

  // Create a rent roll entry
  app.post('/api/operations/rent-rolls/:rentRollId/entries', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertRentRollEntrySchema.parse({
        ...req.body,
        rentRollId: req.params.rentRollId,
      });
      const entry = await rentRollService.createRentRollEntry(orgId, data);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create rent roll entry:', error);
      res.status(500).json({ error: 'Failed to create rent roll entry' });
    }
  });

  // Update a rent roll entry
  app.patch('/api/operations/rent-roll-entries/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateRentRollEntrySchema.parse(req.body);
      const entry = await rentRollService.updateRentRollEntry(req.params.id, orgId, data);
      
      if (!entry) {
        return res.status(404).json({ error: 'Rent roll entry not found' });
      }
      
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update rent roll entry:', error);
      res.status(500).json({ error: 'Failed to update rent roll entry' });
    }
  });

  // Delete a rent roll entry
  app.delete('/api/operations/rent-roll-entries/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await rentRollService.deleteRentRollEntry(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Rent roll entry not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete rent roll entry:', error);
      res.status(500).json({ error: 'Failed to delete rent roll entry' });
    }
  });

  // Get rent roll summary statistics
  app.get('/api/operations/rent-rolls/:rentRollId/summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const summary = await rentRollService.getRentRollSummary(req.params.rentRollId, orgId);
      res.json(summary);
    } catch (error) {
      console.error('Failed to fetch rent roll summary:', error);
      res.status(500).json({ error: 'Failed to fetch rent roll summary' });
    }
  });

  // ========================================================================
  // MARKETING OPERATIONS ROUTES
  // ========================================================================

  // Marketing Campaigns
  app.get('/api/marketing/campaigns', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        status: req.query.status,
        channel: req.query.channel,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };
      const campaigns = await marketingService.getCampaigns(orgId, filters);
      res.json(campaigns);
    } catch (error) {
      console.error('Failed to fetch marketing campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch marketing campaigns' });
    }
  });

  app.get('/api/marketing/campaigns/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const campaign = await marketingService.getCampaignById(req.params.id, orgId);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error('Failed to fetch marketing campaign:', error);
      res.status(500).json({ error: 'Failed to fetch marketing campaign' });
    }
  });

  app.post('/api/marketing/campaigns', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertMarketingCampaignSchema.parse(req.body);
      const campaign = await marketingService.createCampaign(orgId, data);
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create marketing campaign:', error);
      res.status(500).json({ error: 'Failed to create marketing campaign' });
    }
  });

  app.patch('/api/marketing/campaigns/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateMarketingCampaignSchema.parse(req.body);
      const campaign = await marketingService.updateCampaign(req.params.id, orgId, data);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update marketing campaign:', error);
      res.status(500).json({ error: 'Failed to update marketing campaign' });
    }
  });

  app.delete('/api/marketing/campaigns/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await marketingService.deleteCampaign(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete marketing campaign:', error);
      res.status(500).json({ error: 'Failed to delete marketing campaign' });
    }
  });

  // Marketing Expenses
  app.get('/api/marketing/expenses', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        campaignId: req.query.campaignId,
        status: req.query.status,
        category: req.query.category,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };
      const expenses = await marketingService.getExpenses(orgId, filters);
      res.json(expenses);
    } catch (error) {
      console.error('Failed to fetch marketing expenses:', error);
      res.status(500).json({ error: 'Failed to fetch marketing expenses' });
    }
  });

  app.get('/api/marketing/expenses/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const expense = await marketingService.getExpenseById(req.params.id, orgId);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    } catch (error) {
      console.error('Failed to fetch marketing expense:', error);
      res.status(500).json({ error: 'Failed to fetch marketing expense' });
    }
  });

  app.post('/api/marketing/expenses', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const data = insertMarketingExpenseSchema.parse(req.body);
      const expense = await marketingService.createExpense(orgId, userId, data);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create marketing expense:', error);
      res.status(500).json({ error: 'Failed to create marketing expense' });
    }
  });

  app.patch('/api/marketing/expenses/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateMarketingExpenseSchema.parse(req.body);
      const expense = await marketingService.updateExpense(req.params.id, orgId, data);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update marketing expense:', error);
      res.status(500).json({ error: 'Failed to update marketing expense' });
    }
  });

  app.post('/api/marketing/expenses/:id/approve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const expense = await marketingService.approveExpense(req.params.id, orgId, userId);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    } catch (error) {
      console.error('Failed to approve marketing expense:', error);
      res.status(500).json({ error: 'Failed to approve marketing expense' });
    }
  });

  app.post('/api/marketing/expenses/:id/mark-paid', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { paidDate } = req.body;
      
      if (!paidDate) {
        return res.status(400).json({ error: 'paidDate is required' });
      }
      
      const expense = await marketingService.markExpensePaid(req.params.id, orgId, paidDate);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    } catch (error) {
      console.error('Failed to mark expense as paid:', error);
      res.status(500).json({ error: 'Failed to mark expense as paid' });
    }
  });

  app.delete('/api/marketing/expenses/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await marketingService.deleteExpense(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete marketing expense:', error);
      res.status(500).json({ error: 'Failed to delete marketing expense' });
    }
  });

  // Lead Attribution
  app.get('/api/marketing/attribution', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        campaignId: req.query.campaignId,
        attributionType: req.query.attributionType,
      };
      const attributions = await marketingService.getAttributions(orgId, filters);
      res.json(attributions);
    } catch (error) {
      console.error('Failed to fetch lead attributions:', error);
      res.status(500).json({ error: 'Failed to fetch lead attributions' });
    }
  });

  app.post('/api/marketing/attribution', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertLeadAttributionSchema.parse(req.body);
      const attribution = await marketingService.createAttribution(orgId, data);
      res.status(201).json(attribution);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create lead attribution:', error);
      res.status(500).json({ error: 'Failed to create lead attribution' });
    }
  });

  app.delete('/api/marketing/attribution/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await marketingService.deleteAttribution(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Attribution not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete lead attribution:', error);
      res.status(500).json({ error: 'Failed to delete lead attribution' });
    }
  });

  // Marketing Analytics
  app.get('/api/marketing/campaigns/:id/metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const metrics = await marketingService.getCampaignMetrics(req.params.id, orgId);
      res.json(metrics);
    } catch (error) {
      console.error('Failed to fetch campaign metrics:', error);
      res.status(500).json({ error: 'Failed to fetch campaign metrics' });
    }
  });

  app.get('/api/marketing/metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const metrics = await marketingService.getOrganizationMetrics(orgId);
      res.json(metrics);
    } catch (error) {
      console.error('Failed to fetch organization metrics:', error);
      res.status(500).json({ error: 'Failed to fetch organization metrics' });
    }
  });

  // Email Campaigns
  app.get('/api/marketing/email-campaigns', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        campaignId: req.query.campaignId,
        platform: req.query.platform,
      };
      const campaigns = await marketingService.getEmailCampaigns(orgId, filters);
      res.json(campaigns);
    } catch (error) {
      console.error('Failed to fetch email campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch email campaigns' });
    }
  });

  app.post('/api/marketing/email-campaigns/sync', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertEmailCampaignSchema.parse(req.body);
      const campaign = await marketingService.upsertEmailCampaign(orgId, data);
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to sync email campaign:', error);
      res.status(500).json({ error: 'Failed to sync email campaign' });
    }
  });

  // ============================================================================
  // MODELING PROJECTS - Valuation & Financial Modeling Tracking
  // ============================================================================

  // Modeling Regions - Organization-specific customizable regions
  app.get('/api/modeling/regions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const regions = await storage.getModelingRegions(orgId);
      res.json(regions);
    } catch (error) {
      console.error('Failed to fetch modeling regions:', error);
      res.status(500).json({ error: 'Failed to fetch modeling regions' });
    }
  });

  app.post('/api/modeling/regions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertModelingRegionSchema.parse(req.body);
      const region = await storage.createModelingRegion({ ...data, orgId });
      res.status(201).json(region);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create modeling region:', error);
      res.status(500).json({ error: 'Failed to create modeling region' });
    }
  });

  app.patch('/api/modeling/regions/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateModelingRegionSchema.parse(req.body);
      const region = await storage.updateModelingRegion(req.params.id, data, orgId);
      
      if (!region) {
        return res.status(404).json({ error: 'Modeling region not found' });
      }
      
      res.json(region);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update modeling region:', error);
      res.status(500).json({ error: 'Failed to update modeling region' });
    }
  });

  app.delete('/api/modeling/regions/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const deleted = await storage.deleteModelingRegion(req.params.id, orgId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Modeling region not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete modeling region:', error);
      res.status(500).json({ error: 'Failed to delete modeling region' });
    }
  });

  // Search brokers - searches CRM contacts and companies together
  app.get('/api/modeling/broker-search', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const query = (req.query.q || req.query.query || '').trim();
      
      if (!query || query.length < 2) {
        return res.json({ contacts: [], companies: [] });
      }
      
      const searchTerm = `%${query.toLowerCase()}%`;
      
      // Search contacts (brokers)
      const contacts = await db
        .select({
          id: crmContacts.id,
          firstName: crmContacts.firstName,
          lastName: crmContacts.lastName,
          email: crmContacts.email,
          phone: crmContacts.phone,
          title: crmContacts.title,
          companyId: crmContacts.companyId,
        })
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.orgId, orgId),
            or(
              sql`LOWER(${crmContacts.firstName}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.lastName}) LIKE ${searchTerm}`,
              sql`LOWER(CONCAT(${crmContacts.firstName}, ' ', ${crmContacts.lastName})) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.email}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);
      
      // Search companies (broker companies)
      const companies = await db
        .select({
          id: crmCompanies.id,
          name: crmCompanies.name,
          domain: crmCompanies.domain,
          phone: crmCompanies.phone,
        })
        .from(crmCompanies)
        .where(
          and(
            eq(crmCompanies.orgId, orgId),
            sql`LOWER(${crmCompanies.name}) LIKE ${searchTerm}`
          )
        )
        .limit(10);
      
      // Get company names for contacts
      const contactsWithCompany = await Promise.all(
        contacts.map(async (contact) => {
          if (contact.companyId) {
            const company = await db
              .select({ name: crmCompanies.name })
              .from(crmCompanies)
              .where(eq(crmCompanies.id, contact.companyId))
              .limit(1);
            return {
              ...contact,
              companyName: company[0]?.name || null,
            };
          }
          return { ...contact, companyName: null };
        })
      );
      
      res.json({ contacts: contactsWithCompany, companies });
    } catch (error) {
      console.error('Failed to search brokers:', error);
      res.status(500).json({ error: 'Failed to search brokers' });
    }
  });

  // Get all modeling projects for organization
  app.get('/api/modeling/projects', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projects = await storage.getModelingProjects(orgId);
      res.json(projects);
    } catch (error) {
      console.error('Failed to fetch modeling projects:', error);
      res.status(500).json({ error: 'Failed to fetch modeling projects' });
    }
  });

  // Get single modeling project by ID
  app.get('/api/modeling/projects/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const project = await storage.getModelingProject(req.params.id, orgId);
      
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      res.json(project);
    } catch (error) {
      console.error('Failed to fetch modeling project:', error);
      res.status(500).json({ error: 'Failed to fetch modeling project' });
    }
  });

  // Get modeling projects by broker
  app.get('/api/modeling/projects/broker/:brokerId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projects = await storage.getModelingProjectsByBroker(req.params.brokerId, orgId);
      res.json(projects);
    } catch (error) {
      console.error('Failed to fetch modeling projects by broker:', error);
      res.status(500).json({ error: 'Failed to fetch modeling projects by broker' });
    }
  });

  // Create new modeling project
  app.post('/api/modeling/projects', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const data = insertModelingProjectSchema.parse(req.body);
      
      // Use database transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Fetch default pipeline and stage for the organization
        const pipelines = await storage.getCrmPipelinesForOrg(orgId);
        const defaultPipeline = pipelines[0]; // Get first pipeline as default
        
        let pipelineId: string | undefined;
        let stageId: string | undefined;
        
        if (defaultPipeline) {
          pipelineId = defaultPipeline.id;
          // Get first stage of the pipeline
          const stages = await storage.getCrmPipelineStagesForPipeline(pipelineId);
          if (stages && stages.length > 0) {
            stageId = stages[0].id;
          }
        }
        
        // Create a corresponding CRM deal for this modeling project
        // Only include pipelineId/stageId if they exist (omit undefined fields)
        const [deal] = await tx.insert(crmDeals).values({
          title: data.marinaName,
          type: 'marina_acquisition',
          marinaName: data.marinaName,
          city: data.city,
          state: data.state,
          stage: 'modeling',
          ...(pipelineId && { pipelineId }),
          ...(stageId && { stageId }),
          ownerId: userId,
        }).returning();
        
        // Create the modeling project and link it to the deal
        const [project] = await tx.insert(modelingProjects).values({ 
          ...data as any, 
          orgId, 
          createdBy: userId,
          dealId: deal.id 
        }).returning();
        
        return project;
      });
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create modeling project:', error);
      res.status(500).json({ error: 'Failed to create modeling project' });
    }
  });

  // Update modeling project
  app.patch('/api/modeling/projects/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const data = updateModelingProjectSchema.parse(req.body);
      const project = await storage.updateModelingProject(req.params.id, { ...data, updatedBy: userId }, orgId);
      
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update modeling project:', error);
      res.status(500).json({ error: 'Failed to update modeling project' });
    }
  });

  // Delete modeling project
  app.delete('/api/modeling/projects/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteModelingProject(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete modeling project:', error);
      res.status(500).json({ error: 'Failed to delete modeling project' });
    }
  });

  // Project Workspace - Configuration
  app.get('/api/modeling/projects/:projectId/config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Return config from customMetrics or defaults
      const config = (project.customMetrics as any)?.config || {
        holdPeriod: 5,
        startDate: '2026-01-31',
        seasonMonths: [4, 5, 6, 7, 8, 9, 10],
        departments: {}
      };
      
      res.json(config);
    } catch (error) {
      console.error('Failed to fetch project config:', error);
      res.status(500).json({ error: 'Failed to fetch project config' });
    }
  });

  app.post('/api/modeling/projects/:projectId/config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const existingMetrics = (project.customMetrics as any) || {};
      const updatedMetrics = {
        ...existingMetrics,
        config: req.body
      };
      
      const updated = await storage.updateModelingProject(
        projectId,
        { customMetrics: updatedMetrics, updatedBy: userId },
        orgId
      );
      
      res.json(req.body);
    } catch (error) {
      console.error('Failed to save project config:', error);
      res.status(500).json({ error: 'Failed to save project config' });
    }
  });

  // Project Workspace - Assumptions
  app.get('/api/modeling/projects/:projectId/assumptions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const assumptions = (project.customMetrics as any)?.assumptions || null;
      res.json(assumptions);
    } catch (error) {
      console.error('Failed to fetch project assumptions:', error);
      res.status(500).json({ error: 'Failed to fetch project assumptions' });
    }
  });

  app.post('/api/modeling/projects/:projectId/assumptions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const existingMetrics = (project.customMetrics as any) || {};
      const updatedMetrics = {
        ...existingMetrics,
        assumptions: req.body
      };
      
      const updated = await storage.updateModelingProject(
        projectId,
        { customMetrics: updatedMetrics, updatedBy: userId },
        orgId
      );
      
      res.json(req.body);
    } catch (error) {
      console.error('Failed to save project assumptions:', error);
      res.status(500).json({ error: 'Failed to save project assumptions' });
    }
  });

  // Project Workspace - Historical P&L with data binding
  app.get('/api/modeling/projects/:projectId/historical-pl/:year', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, year } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { proFormaEngineService } = await import('./services/pro-forma-engine-service');
      const historicalData = await proFormaEngineService.getHistoricalPL(
        projectId, 
        orgId, 
        year ? parseInt(year) : undefined
      );
      res.json(historicalData);
    } catch (error) {
      console.error('Failed to fetch historical P&L:', error);
      res.status(500).json({ error: 'Failed to fetch historical P&L' });
    }
  });

  // Project Workspace - Pro Forma with real-time calculations
  app.get('/api/modeling/projects/:projectId/pro-forma', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const scenarioType = (req.query.scenario as string) || 'base';
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { proFormaEngineService } = await import('./services/pro-forma-engine-service');
      const proFormaData = await proFormaEngineService.generateProForma(projectId, orgId, scenarioType);
      res.json(proFormaData);
    } catch (error) {
      console.error('Failed to fetch pro forma:', error);
      res.status(500).json({ error: 'Failed to fetch pro forma' });
    }
  });

  // Project Workspace - Executive Summary with real-time calculations
  app.get('/api/modeling/projects/:projectId/executive-summary/:scenario', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenario } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { proFormaEngineService } = await import('./services/pro-forma-engine-service');
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, scenario);
      
      const summaryData = {
        scenario,
        projectName: project.marinaName || project.name,
        purchasePrice: proForma.metrics.purchasePrice,
        totalUnits: project.totalUnits,
        acreage: project.acreage,
        metrics: {
          goingInCapRate: proForma.metrics.goingInCapRate,
          exitCapRate: proForma.metrics.exitCapRate,
          irr: proForma.metrics.irr,
          equityMultiple: proForma.metrics.equityMultiple,
          totalReturn: proForma.metrics.totalReturn
        },
        yearOne: {
          revenue: proForma.revenue.totals[0],
          expenses: proForma.expenses.totals[0],
          noi: proForma.noi[0]
        },
        exitYear: {
          revenue: proForma.revenue.totals[proForma.revenue.totals.length - 1],
          expenses: proForma.expenses.totals[proForma.expenses.totals.length - 1],
          noi: proForma.noi[proForma.noi.length - 1],
          exitValue: proForma.metrics.exitValue
        },
        growthRates: {
          revenue: proForma.metrics.revenueGrowthRate,
          expenses: proForma.metrics.expenseGrowthRate
        },
        projectionYears: proForma.years,
        noiByyear: proForma.noi
      };
      
      res.json(summaryData);
    } catch (error) {
      console.error('Failed to fetch executive summary:', error);
      res.status(500).json({ error: 'Failed to fetch executive summary' });
    }
  });

  // ============================================================================
  // OPERATIONS DATA SYNC - Sync Rent Roll, Fuel Sales, Ship Store to Modeling
  // ============================================================================

  // Trigger operations data sync for a modeling project
  app.post('/api/modeling/projects/:projectId/sync-operations', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { dataSources, dateRangeStart, dateRangeEnd, syncType } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('./services/operations-data-sync-service');
      
      const result = await operationsDataSyncService.syncOperationsData({
        projectId,
        orgId,
        userId,
        dataSources: dataSources || ['rent_roll', 'fuel_sales', 'ship_store'],
        dateRangeStart: dateRangeStart ? new Date(dateRangeStart) : undefined,
        dateRangeEnd: dateRangeEnd ? new Date(dateRangeEnd) : undefined,
        syncType: syncType || 'manual'
      });

      res.json(result);
    } catch (error) {
      console.error('Failed to sync operations data:', error);
      res.status(500).json({ error: 'Failed to sync operations data' });
    }
  });

  // Get actuals data for a modeling project
  app.get('/api/modeling/projects/:projectId/actuals', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { year } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('./services/operations-data-sync-service');
      
      const actuals = await operationsDataSyncService.getActualsForProject(
        projectId, 
        year ? parseInt(year as string) : undefined
      );

      // Group by category and subcategory for P&L display
      const grouped = actuals.reduce((acc: any, item) => {
        const key = `${item.category}-${item.subcategory}`;
        if (!acc[key]) {
          acc[key] = {
            category: item.category,
            subcategory: item.subcategory,
            monthlyData: {},
            annualTotal: 0
          };
        }
        const monthKey = new Date(item.year, item.month - 1).toLocaleString('default', { month: 'short' });
        const amount = parseFloat(item.amount);
        acc[key].monthlyData[monthKey] = (acc[key].monthlyData[monthKey] || 0) + amount;
        acc[key].annualTotal += amount;
        return acc;
      }, {});

      res.json({
        raw: actuals,
        grouped: Object.values(grouped),
        year: year ? parseInt(year as string) : null
      });
    } catch (error) {
      console.error('Failed to fetch actuals:', error);
      res.status(500).json({ error: 'Failed to fetch actuals' });
    }
  });

  // Get sync job history for a project
  app.get('/api/modeling/projects/:projectId/sync-history', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('./services/operations-data-sync-service');
      const history = await operationsDataSyncService.getSyncJobHistory(projectId);

      res.json(history);
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
      res.status(500).json({ error: 'Failed to fetch sync history' });
    }
  });

  // Get data source summary for a project
  app.get('/api/modeling/projects/:projectId/data-sources', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('./services/operations-data-sync-service');
      const summary = await operationsDataSyncService.getDataSourceSummary(projectId);

      res.json(summary);
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
      res.status(500).json({ error: 'Failed to fetch data sources' });
    }
  });

  // ============================================================================
  // SCENARIO VERSIONING - Institutional-grade scenario management with history
  // ============================================================================

  // Get all current scenarios for a project
  app.get('/api/modeling/projects/:projectId/scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const scenarios = await scenarioVersioningService.getCurrentScenarios(projectId);

      res.json(scenarios);
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
      res.status(500).json({ error: 'Failed to fetch scenarios' });
    }
  });

  // Initialize default scenarios for a project
  app.post('/api/modeling/projects/:projectId/scenarios/init', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const scenarios = await scenarioVersioningService.initializeDefaultScenarios(projectId, orgId, userId);

      res.json(scenarios);
    } catch (error) {
      console.error('Failed to initialize scenarios:', error);
      res.status(500).json({ error: 'Failed to initialize scenarios' });
    }
  });

  // Create a new scenario
  app.post('/api/modeling/projects/:projectId/scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scenarioType, name, description, revenueGrowthRate, expenseGrowthRate, exitCapRate, assumptions } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.createScenario({
        orgId,
        projectId,
        userId,
        scenarioType,
        name,
        description,
        revenueGrowthRate,
        expenseGrowthRate,
        exitCapRate,
        assumptions
      });

      res.json(scenario);
    } catch (error) {
      console.error('Failed to create scenario:', error);
      res.status(500).json({ error: 'Failed to create scenario' });
    }
  });

  // Get a specific scenario by ID
  app.get('/api/modeling/projects/:projectId/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.getScenarioById(scenarioId);

      if (!scenario) {
        return res.status(404).json({ error: 'Scenario not found' });
      }

      res.json(scenario);
    } catch (error) {
      console.error('Failed to fetch scenario:', error);
      res.status(500).json({ error: 'Failed to fetch scenario' });
    }
  });

  // Update a scenario (optionally create new version)
  app.patch('/api/modeling/projects/:projectId/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { name, description, revenueGrowthRate, expenseGrowthRate, exitCapRate, assumptions, createNewVersion } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.updateScenario({
        scenarioId,
        userId,
        name,
        description,
        revenueGrowthRate,
        expenseGrowthRate,
        exitCapRate,
        assumptions,
        createNewVersion
      });

      res.json(scenario);
    } catch (error) {
      console.error('Failed to update scenario:', error);
      res.status(500).json({ error: 'Failed to update scenario' });
    }
  });

  // Get version history for a scenario type
  app.get('/api/modeling/projects/:projectId/scenarios/:scenarioType/history', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioType } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const history = await scenarioVersioningService.getScenarioVersionHistory(projectId, scenarioType as any, limit);

      res.json(history);
    } catch (error) {
      console.error('Failed to fetch scenario history:', error);
      res.status(500).json({ error: 'Failed to fetch scenario history' });
    }
  });

  // Restore a previous scenario version
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/restore', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const restored = await scenarioVersioningService.restoreVersion(scenarioId, userId);

      res.json(restored);
    } catch (error) {
      console.error('Failed to restore scenario:', error);
      res.status(500).json({ error: 'Failed to restore scenario' });
    }
  });

  // Submit scenario for approval
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/submit', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.submitForApproval(scenarioId, userId);

      res.json(scenario);
    } catch (error) {
      console.error('Failed to submit scenario:', error);
      res.status(500).json({ error: 'Failed to submit scenario' });
    }
  });

  // Approve a scenario
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/approve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { notes } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.approveScenario(scenarioId, userId, notes);

      res.json(scenario);
    } catch (error) {
      console.error('Failed to approve scenario:', error);
      res.status(500).json({ error: 'Failed to approve scenario' });
    }
  });

  // Reject a scenario
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/reject', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { notes } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.rejectScenario(scenarioId, userId, notes);

      res.json(scenario);
    } catch (error) {
      console.error('Failed to reject scenario:', error);
      res.status(500).json({ error: 'Failed to reject scenario' });
    }
  });

  // Get audit history for a project
  app.get('/api/modeling/projects/:projectId/audit', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { limit, entityType } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const history = await scenarioVersioningService.getAuditHistory(projectId, {
        limit: limit ? parseInt(limit as string) : undefined,
        entityType: entityType as string
      });

      res.json(history);
    } catch (error) {
      console.error('Failed to fetch audit history:', error);
      res.status(500).json({ error: 'Failed to fetch audit history' });
    }
  });

  // Compare multiple scenarios
  app.post('/api/modeling/projects/:projectId/scenarios/compare', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioIds } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const comparison = await scenarioVersioningService.compareScenarios(projectId, scenarioIds);

      res.json(comparison);
    } catch (error) {
      console.error('Failed to compare scenarios:', error);
      res.status(500).json({ error: 'Failed to compare scenarios' });
    }
  });

  // Generate IC Memo for a project
  app.get('/api/modeling/projects/:projectId/ic-memo', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const format = (req.query.format as string) || 'json';
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { icMemoService } = await import('./services/ic-memo-service');
      const memoData = await icMemoService.generateMemoData(projectId, orgId, userId);

      if (format === 'text') {
        const memoText = icMemoService.formatMemoAsText(memoData);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="IC_Memo_${project.marinaName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Project'}_${new Date().toISOString().split('T')[0]}.txt"`);
        return res.send(memoText);
      }

      res.json(memoData);
    } catch (error) {
      console.error('Failed to generate IC memo:', error);
      res.status(500).json({ error: 'Failed to generate IC memo' });
    }
  });

  // Get audit trail for a project
  app.get('/api/modeling/projects/:projectId/audit-log', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const entityType = req.query.entityType as string | undefined;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const auditLog = await scenarioVersioningService.getAuditHistory(projectId, { 
        limit, 
        entityType 
      });

      res.json(auditLog);
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  });

  // ==================== SENSITIVITY MATRIX ROUTES ====================
  
  // Generate sensitivity matrix for a project
  app.post('/api/modeling/projects/:projectId/sensitivity-matrix', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioType = 'base', config, save, name, description } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { sensitivityMatrixService } = await import('./services/sensitivity-matrix-service');
      const result = await sensitivityMatrixService.generateMatrix(projectId, orgId, scenarioType, config);

      if (save) {
        const userId = req.user.id;
        const savedId = await sensitivityMatrixService.saveMatrix(projectId, orgId, userId, result, name, description);
        result.id = savedId;
      }

      res.json(result);
    } catch (error) {
      console.error('Failed to generate sensitivity matrix:', error);
      res.status(500).json({ error: 'Failed to generate sensitivity matrix' });
    }
  });

  // Get saved sensitivity matrices for a project
  app.get('/api/modeling/projects/:projectId/sensitivity-matrices', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { sensitivityMatrixService } = await import('./services/sensitivity-matrix-service');
      const matrices = await sensitivityMatrixService.getMatrices(projectId, orgId);

      res.json(matrices);
    } catch (error) {
      console.error('Failed to fetch sensitivity matrices:', error);
      res.status(500).json({ error: 'Failed to fetch sensitivity matrices' });
    }
  });

  // ==================== BENCHMARK COMPARISON ROUTES ====================

  // Compare project metrics against sales comps benchmarks
  app.get('/api/modeling/projects/:projectId/benchmarks', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { region, state, yearStart, yearEnd, priceMin, priceMax } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { benchmarkComparisonService } = await import('./services/benchmark-comparison-service');
      const benchmarks = await benchmarkComparisonService.compareToBenchmarks(projectId, orgId, {
        region: region as string,
        state: state as string,
        yearRange: yearStart && yearEnd ? { 
          start: parseInt(yearStart as string), 
          end: parseInt(yearEnd as string) 
        } : undefined,
        priceRange: priceMin && priceMax ? { 
          min: parseFloat(priceMin as string), 
          max: parseFloat(priceMax as string) 
        } : undefined
      });

      res.json(benchmarks);
    } catch (error) {
      console.error('Failed to get benchmark comparison:', error);
      res.status(500).json({ error: 'Failed to get benchmark comparison' });
    }
  });

  // Get portfolio risk metrics
  app.get('/api/modeling/portfolio/risk-metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      const { benchmarkComparisonService } = await import('./services/benchmark-comparison-service');
      const riskMetrics = await benchmarkComparisonService.getPortfolioRiskMetrics(orgId);

      res.json(riskMetrics);
    } catch (error) {
      console.error('Failed to get portfolio risk metrics:', error);
      res.status(500).json({ error: 'Failed to get portfolio risk metrics' });
    }
  });

  // ==================== MULTI-APPROVER WORKFLOW ROUTES ====================

  // Create approval request for a scenario
  app.post('/api/modeling/projects/:projectId/approval-requests', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scenarioVersionId, title, description, requiredApprovers, quorumCount, deadline } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { multiApproverService } = await import('./services/multi-approver-service');
      const requestId = await multiApproverService.createApprovalRequest(projectId, orgId, userId, {
        scenarioVersionId,
        title,
        description,
        requiredApprovers,
        quorumCount: quorumCount || 1,
        deadline: deadline ? new Date(deadline) : undefined
      });

      res.json({ id: requestId, message: 'Approval request created successfully' });
    } catch (error) {
      console.error('Failed to create approval request:', error);
      res.status(500).json({ error: 'Failed to create approval request' });
    }
  });

  // Get approval requests for a project
  app.get('/api/modeling/projects/:projectId/approval-requests', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { multiApproverService } = await import('./services/multi-approver-service');
      const requests = await multiApproverService.getProjectApprovalRequests(projectId, orgId);

      res.json(requests);
    } catch (error) {
      console.error('Failed to get approval requests:', error);
      res.status(500).json({ error: 'Failed to get approval requests' });
    }
  });

  // Get pending approvals for current user
  app.get('/api/modeling/pending-approvals', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const { multiApproverService } = await import('./services/multi-approver-service');
      const pendingApprovals = await multiApproverService.getPendingApprovalsForUser(userId, orgId);

      res.json(pendingApprovals);
    } catch (error) {
      console.error('Failed to get pending approvals:', error);
      res.status(500).json({ error: 'Failed to get pending approvals' });
    }
  });

  // Submit approval decision
  app.post('/api/modeling/approval-requests/:requestId/decide', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { requestId } = req.params;
      const { decision, comments } = req.body;
      
      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Decision must be "approved" or "rejected"' });
      }

      const { multiApproverService } = await import('./services/multi-approver-service');
      const result = await multiApproverService.submitDecision(orgId, userId, {
        approvalRequestId: requestId,
        decision,
        comments
      });

      res.json({ 
        message: `Decision submitted: ${decision}`,
        requestStatus: result.requestStatus,
        isComplete: result.isComplete
      });
    } catch (error: any) {
      console.error('Failed to submit decision:', error);
      res.status(400).json({ error: error.message || 'Failed to submit decision' });
    }
  });

  // Get single approval request details
  app.get('/api/modeling/approval-requests/:requestId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { requestId } = req.params;
      
      const { multiApproverService } = await import('./services/multi-approver-service');
      const request = await multiApproverService.getApprovalRequest(requestId, orgId);

      if (!request) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      res.json(request);
    } catch (error) {
      console.error('Failed to get approval request:', error);
      res.status(500).json({ error: 'Failed to get approval request' });
    }
  });

  // ==================== COMMENT THREADS ROUTES ====================

  // Create a comment thread
  app.post('/api/modeling/projects/:projectId/threads', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scenarioVersionId, targetType, targetId, targetLabel, initialComment } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!targetType || !initialComment) {
        return res.status(400).json({ error: 'targetType and initialComment are required' });
      }

      const { commentThreadsService } = await import('./services/comment-threads-service');
      const threadId = await commentThreadsService.createThread(projectId, orgId, userId, {
        scenarioVersionId,
        targetType,
        targetId,
        targetLabel,
        initialComment
      });

      res.json({ id: threadId, message: 'Thread created successfully' });
    } catch (error) {
      console.error('Failed to create comment thread:', error);
      res.status(500).json({ error: 'Failed to create comment thread' });
    }
  });

  // Get all threads for a project
  app.get('/api/modeling/projects/:projectId/threads', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioVersionId, status, targetType } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { commentThreadsService } = await import('./services/comment-threads-service');
      const threads = await commentThreadsService.getProjectThreads(projectId, orgId, {
        scenarioVersionId: scenarioVersionId as string,
        status: status as 'open' | 'resolved' | 'archived',
        targetType: targetType as string
      });

      res.json(threads);
    } catch (error) {
      console.error('Failed to get comment threads:', error);
      res.status(500).json({ error: 'Failed to get comment threads' });
    }
  });

  // Get unresolved thread count for a project
  app.get('/api/modeling/projects/:projectId/threads/unresolved-count', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      const count = await commentThreadsService.getUnresolvedCount(projectId, orgId);

      res.json(count);
    } catch (error) {
      console.error('Failed to get unresolved count:', error);
      res.status(500).json({ error: 'Failed to get unresolved count' });
    }
  });

  // Get single thread with comments
  app.get('/api/modeling/threads/:threadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { threadId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      const thread = await commentThreadsService.getThread(threadId, orgId);

      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json(thread);
    } catch (error) {
      console.error('Failed to get thread:', error);
      res.status(500).json({ error: 'Failed to get thread' });
    }
  });

  // Add comment to thread
  app.post('/api/modeling/threads/:threadId/comments', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { threadId } = req.params;
      const { content, mentions } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const { commentThreadsService } = await import('./services/comment-threads-service');
      const commentId = await commentThreadsService.addComment(orgId, userId, {
        threadId,
        content,
        mentions
      });

      res.json({ id: commentId, message: 'Comment added successfully' });
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      res.status(400).json({ error: error.message || 'Failed to add comment' });
    }
  });

  // Edit comment
  app.patch('/api/modeling/comments/:commentId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { commentId } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const { commentThreadsService } = await import('./services/comment-threads-service');
      await commentThreadsService.editComment(commentId, orgId, userId, content);

      res.json({ message: 'Comment updated successfully' });
    } catch (error: any) {
      console.error('Failed to edit comment:', error);
      res.status(400).json({ error: error.message || 'Failed to edit comment' });
    }
  });

  // Resolve thread
  app.post('/api/modeling/threads/:threadId/resolve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { threadId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      await commentThreadsService.resolveThread(threadId, orgId, userId);

      res.json({ message: 'Thread resolved successfully' });
    } catch (error: any) {
      console.error('Failed to resolve thread:', error);
      res.status(400).json({ error: error.message || 'Failed to resolve thread' });
    }
  });

  // Reopen thread
  app.post('/api/modeling/threads/:threadId/reopen', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { threadId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      await commentThreadsService.reopenThread(threadId, orgId, userId);

      res.json({ message: 'Thread reopened successfully' });
    } catch (error: any) {
      console.error('Failed to reopen thread:', error);
      res.status(400).json({ error: error.message || 'Failed to reopen thread' });
    }
  });

  // Archive thread
  app.post('/api/modeling/threads/:threadId/archive', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { threadId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      await commentThreadsService.archiveThread(threadId, orgId, userId);

      res.json({ message: 'Thread archived successfully' });
    } catch (error: any) {
      console.error('Failed to archive thread:', error);
      res.status(400).json({ error: error.message || 'Failed to archive thread' });
    }
  });

  // ==================== VDR INTEGRATION ROUTES ====================

  // Export modeling outputs to VDR
  app.post('/api/modeling/projects/:projectId/export-to-vdr', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { includeICMemo, includeProForma, includeScenarioComparison, includeSensitivityAnalysis, scenarioVersionIds } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { vdrModelingIntegrationService } = await import('./services/vdr-modeling-integration-service');
      const result = await vdrModelingIntegrationService.exportToVDR(projectId, orgId, userId, {
        includeICMemo,
        includeProForma,
        includeScenarioComparison,
        includeSensitivityAnalysis,
        scenarioVersionIds
      });

      res.json({
        message: `Successfully exported ${result.documents.length} documents to VDR`,
        ...result
      });
    } catch (error: any) {
      console.error('Failed to export to VDR:', error);
      res.status(400).json({ error: error.message || 'Failed to export to VDR' });
    }
  });

  // Get VDR export history for a project
  app.get('/api/modeling/projects/:projectId/vdr-exports', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { vdrModelingIntegrationService } = await import('./services/vdr-modeling-integration-service');
      const history = await vdrModelingIntegrationService.getVDRExportHistory(projectId, orgId);

      res.json(history);
    } catch (error) {
      console.error('Failed to get VDR export history:', error);
      res.status(500).json({ error: 'Failed to get VDR export history' });
    }
  });

  // ==================== DEBT SENSITIVITY ROUTES ====================

  // Analyze debt sensitivity across lender structures
  app.post('/api/modeling/projects/:projectId/debt-sensitivity', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scenarioVersionId, purchasePrice, lenderStructures, rateShifts } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!scenarioVersionId || !purchasePrice) {
        return res.status(400).json({ error: 'scenarioVersionId and purchasePrice are required' });
      }

      const { debtSensitivityService } = await import('./services/debt-sensitivity-service');
      
      let structures = lenderStructures;
      if (!structures || structures.length === 0) {
        structures = await debtSensitivityService.getStandardLenderStructures(purchasePrice);
      }

      const shifts = rateShifts || [-1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0];

      const analysis = await debtSensitivityService.analyzeDebtSensitivity(projectId, orgId, userId, {
        scenarioVersionId,
        purchasePrice,
        lenderStructures: structures,
        rateShifts: shifts
      });

      res.json(analysis);
    } catch (error: any) {
      console.error('Failed to analyze debt sensitivity:', error);
      res.status(400).json({ error: error.message || 'Failed to analyze debt sensitivity' });
    }
  });

  // Get standard lender structures
  app.get('/api/modeling/debt-sensitivity/lender-templates', authenticateUser, async (req: any, res) => {
    try {
      const { purchasePrice } = req.query;
      const price = parseFloat(purchasePrice as string) || 10000000;

      const { debtSensitivityService } = await import('./services/debt-sensitivity-service');
      const structures = await debtSensitivityService.getStandardLenderStructures(price);

      res.json(structures);
    } catch (error) {
      console.error('Failed to get lender templates:', error);
      res.status(500).json({ error: 'Failed to get lender templates' });
    }
  });

  // Compare multiple lenders and get recommendations
  app.post('/api/modeling/projects/:projectId/lender-comparison', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioVersionId, purchasePrice, targetDSCR } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { debtSensitivityService } = await import('./services/debt-sensitivity-service');
      const comparison = await debtSensitivityService.compareMultipleLenders(
        projectId,
        orgId,
        scenarioVersionId,
        purchasePrice,
        targetDSCR || 1.25
      );

      res.json(comparison);
    } catch (error: any) {
      console.error('Failed to compare lenders:', error);
      res.status(400).json({ error: error.message || 'Failed to compare lenders' });
    }
  });

  // ==================== WATERFALL CUSTOMIZATION ROUTES ====================

  // Calculate waterfall distribution
  app.post('/api/modeling/projects/:projectId/waterfall', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const input = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!input.scenarioVersionId || !input.totalInvestment) {
        return res.status(400).json({ error: 'scenarioVersionId and totalInvestment are required' });
      }

      const { waterfallService } = await import('./services/waterfall-service');
      const result = await waterfallService.calculateWaterfall(projectId, orgId, userId, input);

      res.json(result);
    } catch (error: any) {
      console.error('Failed to calculate waterfall:', error);
      res.status(400).json({ error: error.message || 'Failed to calculate waterfall' });
    }
  });

  // Get standard waterfall configurations
  app.get('/api/modeling/waterfall/templates', authenticateUser, async (req: any, res) => {
    try {
      const { waterfallService } = await import('./services/waterfall-service');
      const configs = await waterfallService.getStandardWaterfallConfigs();

      res.json(configs);
    } catch (error) {
      console.error('Failed to get waterfall templates:', error);
      res.status(500).json({ error: 'Failed to get waterfall templates' });
    }
  });

  // Compare multiple waterfall structures
  app.post('/api/modeling/projects/:projectId/waterfall/compare', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { baseInput, configs } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { waterfallService } = await import('./services/waterfall-service');
      const comparison = await waterfallService.compareWaterfallStructures(
        projectId,
        orgId,
        baseInput,
        configs
      );

      res.json(comparison);
    } catch (error: any) {
      console.error('Failed to compare waterfall structures:', error);
      res.status(400).json({ error: error.message || 'Failed to compare waterfall structures' });
    }
  });

  // ==================== EXTERNAL API ROUTES ====================

  // Export single project data
  app.get('/api/modeling/export/project/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { format } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { externalAPIService } = await import('./services/external-api-service');
      const exportData = await externalAPIService.exportProject(
        projectId, 
        orgId, 
        userId, 
        (format as 'json' | 'csv' | 'xml') || 'json'
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="project_${projectId}.csv"`);
        res.send(exportData);
      } else if (format === 'xml') {
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="project_${projectId}.xml"`);
        res.send(exportData);
      } else {
        res.json(exportData);
      }
    } catch (error: any) {
      console.error('Failed to export project:', error);
      res.status(400).json({ error: error.message || 'Failed to export project' });
    }
  });

  // Export portfolio data
  app.get('/api/modeling/export/portfolio', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { status, region, outcome, minValue, maxValue } = req.query;

      const { externalAPIService } = await import('./services/external-api-service');
      const exportData = await externalAPIService.exportPortfolio(orgId, userId, {
        status: status as string,
        region: region as string,
        outcome: outcome as string,
        minValue: minValue ? parseFloat(minValue as string) : undefined,
        maxValue: maxValue ? parseFloat(maxValue as string) : undefined
      });

      res.json(exportData);
    } catch (error: any) {
      console.error('Failed to export portfolio:', error);
      res.status(400).json({ error: error.message || 'Failed to export portfolio' });
    }
  });

  // Get webhook payload preview
  app.get('/api/modeling/webhook/preview/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { eventType } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { externalAPIService } = await import('./services/external-api-service');
      const payload = await externalAPIService.getWebhookPayload(
        projectId,
        orgId,
        (eventType as 'scenario_approved' | 'project_updated' | 'analysis_completed') || 'project_updated'
      );

      res.json(payload);
    } catch (error: any) {
      console.error('Failed to get webhook payload:', error);
      res.status(400).json({ error: error.message || 'Failed to get webhook payload' });
    }
  });

  // Generate API documentation
  app.get('/api/modeling/api-docs', authenticateUser, async (req: any, res) => {
    try {
      const docs = {
        version: '1.0.0',
        endpoints: [
          {
            method: 'GET',
            path: '/api/modeling/export/project/:projectId',
            description: 'Export project data in JSON, CSV, or XML format',
            params: { format: 'json | csv | xml' }
          },
          {
            method: 'GET',
            path: '/api/modeling/export/portfolio',
            description: 'Export portfolio data with optional filters',
            params: { status: 'string', region: 'string', outcome: 'string', minValue: 'number', maxValue: 'number' }
          },
          {
            method: 'GET',
            path: '/api/modeling/webhook/preview/:projectId',
            description: 'Preview webhook payload for integration testing',
            params: { eventType: 'scenario_approved | project_updated | analysis_completed' }
          },
          {
            method: 'POST',
            path: '/api/modeling/projects/:projectId/pro-forma',
            description: 'Generate pro forma projections from actuals'
          },
          {
            method: 'POST',
            path: '/api/modeling/projects/:projectId/sensitivity-matrix',
            description: 'Generate sensitivity analysis matrix'
          },
          {
            method: 'GET',
            path: '/api/modeling/projects/:projectId/benchmarks',
            description: 'Compare project metrics against sales comps'
          },
          {
            method: 'POST',
            path: '/api/modeling/projects/:projectId/debt-sensitivity',
            description: 'Analyze debt sensitivity across lender structures'
          },
          {
            method: 'POST',
            path: '/api/modeling/projects/:projectId/waterfall',
            description: 'Calculate LP/GP waterfall distributions'
          }
        ],
        authentication: 'Bearer token or session cookie required',
        rateLimit: '100 requests per minute'
      };

      res.json(docs);
    } catch (error) {
      console.error('Failed to get API docs:', error);
      res.status(500).json({ error: 'Failed to get API docs' });
    }
  });

  // Get modeling analytics and metrics
  app.get('/api/modeling/analytics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Parse filter parameters
      const filters: any = {};
      if (req.query.region) filters.region = req.query.region;
      if (req.query.state) filters.state = req.query.state;
      if (req.query.dealOutcome) filters.dealOutcome = req.query.dealOutcome;
      if (req.query.brokerId) filters.brokerId = req.query.brokerId;
      if (req.query.minPrice) filters.minPrice = parseFloat(req.query.minPrice as string);
      if (req.query.maxPrice) filters.maxPrice = parseFloat(req.query.maxPrice as string);
      if (req.query.minSize) filters.minSize = parseInt(req.query.minSize as string);
      if (req.query.maxSize) filters.maxSize = parseInt(req.query.maxSize as string);
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      
      const analytics = await storage.getModelingAnalytics(orgId, filters);
      res.json(analytics);
    } catch (error) {
      console.error('Failed to fetch modeling analytics:', error);
      res.status(500).json({ error: 'Failed to fetch modeling analytics' });
    }
  });

  // ============================================================================
  // APPROVAL NOTIFICATIONS - Email and In-App Notifications for Scenario Approvals
  // ============================================================================

  // Get pending approvals for the organization
  app.get('/api/approvals/pending', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const pendingApprovals = await approvalNotificationService.getPendingApprovals(orgId);
      res.json(pendingApprovals);
    } catch (error) {
      console.error('Failed to get pending approvals:', error);
      res.status(500).json({ error: 'Failed to get pending approvals' });
    }
  });

  // Get approval statistics
  app.get('/api/approvals/stats', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const stats = await approvalNotificationService.getApprovalStats(orgId);
      res.json(stats);
    } catch (error) {
      console.error('Failed to get approval stats:', error);
      res.status(500).json({ error: 'Failed to get approval statistics' });
    }
  });

  // Get available approvers for the organization
  app.get('/api/approvals/approvers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const approvers = await approvalNotificationService.getOrgApprovers(orgId);
      res.json(approvers);
    } catch (error) {
      console.error('Failed to get approvers:', error);
      res.status(500).json({ error: 'Failed to get approvers' });
    }
  });

  // Get user notifications
  app.get('/api/notifications', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const notifications = await approvalNotificationService.getUserNotifications(orgId, userId, unreadOnly);
      res.json(notifications);
    } catch (error) {
      console.error('Failed to get notifications:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  // Get unread notification count
  app.get('/api/notifications/unread-count', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const count = await approvalNotificationService.getUnreadCount(orgId, userId);
      res.json({ count });
    } catch (error) {
      console.error('Failed to get unread count:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  });

  // Mark notification as read
  app.post('/api/notifications/:notificationId/read', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      await approvalNotificationService.markNotificationRead(notificationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read
  app.post('/api/notifications/mark-all-read', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      await approvalNotificationService.markAllNotificationsRead(orgId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // Submit scenario for approval with specific approvers
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/submit-for-approval', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { approverIds } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      
      const updated = await scenarioVersioningService.submitForApproval(scenarioId, userId);

      if (approverIds && approverIds.length > 0) {
        await approvalNotificationService.notifyApprovalRequested(scenarioId, userId, approverIds);
      } else {
        const orgApprovers = await approvalNotificationService.getOrgApprovers(orgId);
        const approverUserIds = orgApprovers.map(a => a.id).filter(id => id !== userId);
        if (approverUserIds.length > 0) {
          await approvalNotificationService.notifyApprovalRequested(scenarioId, userId, approverUserIds);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Failed to submit for approval:', error);
      res.status(500).json({ error: 'Failed to submit for approval' });
    }
  });

  // Approve scenario with notifications
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/approve-with-notification', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { notes } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      
      const updated = await scenarioVersioningService.approveScenario(scenarioId, userId, notes);
      await approvalNotificationService.notifyApprovalDecision(scenarioId, 'approved', userId, notes);

      res.json(updated);
    } catch (error) {
      console.error('Failed to approve scenario:', error);
      res.status(500).json({ error: 'Failed to approve scenario' });
    }
  });

  // Reject scenario with notifications
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/reject-with-notification', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { notes } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      
      const updated = await scenarioVersioningService.rejectScenario(scenarioId, userId, notes);
      await approvalNotificationService.notifyApprovalDecision(scenarioId, 'rejected', userId, notes);

      res.json(updated);
    } catch (error) {
      console.error('Failed to reject scenario:', error);
      res.status(500).json({ error: 'Failed to reject scenario' });
    }
  });

  // ============================================================================
  // QUICKBOOKS INTEGRATION - OAuth2 Connection and P&L Sync
  // ============================================================================

  // Get QuickBooks connection status
  app.get('/api/quickbooks/status', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const status = await quickBooksService.getConnectionStatus(orgId);
      res.json(status);
    } catch (error) {
      console.error('Failed to get QuickBooks status:', error);
      res.status(500).json({ error: 'Failed to get connection status' });
    }
  });

  // Get QuickBooks authorization URL
  app.get('/api/quickbooks/auth-url', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const authUrl = quickBooksService.getAuthorizationUrl(orgId);
      res.json({ authUrl });
    } catch (error) {
      console.error('Failed to generate auth URL:', error);
      res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
  });

  // QuickBooks OAuth callback
  app.get('/api/quickbooks/callback', async (req, res) => {
    try {
      const { code, realmId, state, error: oauthError } = req.query;
      
      if (oauthError) {
        console.error('QuickBooks OAuth error:', oauthError);
        return res.redirect('/settings/integrations?qb_error=authorization_denied');
      }

      if (!code || !realmId || !state) {
        return res.redirect('/settings/integrations?qb_error=missing_params');
      }

      const { quickBooksService } = await import('./services/quickbooks-service');
      await quickBooksService.handleCallback(
        code as string,
        realmId as string,
        state as string
      );

      res.redirect('/settings/integrations?qb_connected=true');
    } catch (error) {
      console.error('Failed to handle QuickBooks callback:', error);
      res.redirect('/settings/integrations?qb_error=connection_failed');
    }
  });

  // Disconnect QuickBooks
  app.post('/api/quickbooks/disconnect', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      await quickBooksService.disconnect(orgId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to disconnect QuickBooks:', error);
      res.status(500).json({ error: 'Failed to disconnect' });
    }
  });

  // Get QuickBooks company info
  app.get('/api/quickbooks/company', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const companyInfo = await quickBooksService.getCompanyInfo(orgId);
      res.json(companyInfo);
    } catch (error) {
      console.error('Failed to get company info:', error);
      res.status(500).json({ error: 'Failed to get company information' });
    }
  });

  // Get QuickBooks chart of accounts
  app.get('/api/quickbooks/accounts', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const accounts = await quickBooksService.getChartOfAccounts(orgId);
      res.json(accounts);
    } catch (error) {
      console.error('Failed to get chart of accounts:', error);
      res.status(500).json({ error: 'Failed to get chart of accounts' });
    }
  });

  // Get QuickBooks P&L report
  app.get('/api/quickbooks/profit-and-loss', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const { quickBooksService } = await import('./services/quickbooks-service');
      const report = await quickBooksService.getProfitAndLoss(
        orgId,
        startDate as string,
        endDate as string
      );
      res.json(report);
    } catch (error) {
      console.error('Failed to get P&L report:', error);
      res.status(500).json({ error: 'Failed to get Profit & Loss report' });
    }
  });

  // Sync QuickBooks P&L to modeling actuals
  app.post('/api/quickbooks/sync/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { startDate, endDate } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const { quickBooksService } = await import('./services/quickbooks-service');
      const result = await quickBooksService.syncProfitAndLossToActuals(
        orgId,
        projectId,
        startDate,
        endDate
      );
      res.json(result);
    } catch (error) {
      console.error('Failed to sync QuickBooks data:', error);
      res.status(500).json({ error: 'Failed to sync QuickBooks data' });
    }
  });

  // Get QuickBooks sync history
  app.get('/api/quickbooks/sync-history', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const limit = parseInt(req.query.limit as string) || 20;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const history = await quickBooksService.getSyncHistory(orgId, limit);
      res.json(history);
    } catch (error) {
      console.error('Failed to get sync history:', error);
      res.status(500).json({ error: 'Failed to get sync history' });
    }
  });

  // Update account mapping
  app.post('/api/quickbooks/account-mapping', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { mapping } = req.body;
      
      if (!mapping) {
        return res.status(400).json({ error: 'Mapping data is required' });
      }

      const { quickBooksService } = await import('./services/quickbooks-service');
      await quickBooksService.updateAccountMapping(orgId, mapping);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to update account mapping:', error);
      res.status(500).json({ error: 'Failed to update account mapping' });
    }
  });

  // ============================================================================
  // PORTFOLIO ROLL-UPS - Aggregate Views Across Modeling Projects
  // ============================================================================

  // Get portfolio summary
  app.get('/api/portfolio/summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projectIds = req.query.projectIds ? (req.query.projectIds as string).split(',') : undefined;
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const summary = await portfolioRollupService.getPortfolioSummary(orgId, projectIds);
      res.json(summary);
    } catch (error) {
      console.error('Failed to get portfolio summary:', error);
      res.status(500).json({ error: 'Failed to get portfolio summary' });
    }
  });

  // Get project rollups with filters
  app.get('/api/portfolio/projects', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: any = {};
      if (req.query.region) filters.region = req.query.region as string;
      if (req.query.state) filters.state = req.query.state as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.minValue) filters.minValue = parseFloat(req.query.minValue as string);
      if (req.query.maxValue) filters.maxValue = parseFloat(req.query.maxValue as string);
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const projects = await portfolioRollupService.getProjectRollups(orgId, filters);
      res.json(projects);
    } catch (error) {
      console.error('Failed to get project rollups:', error);
      res.status(500).json({ error: 'Failed to get project rollups' });
    }
  });

  // Get portfolio breakdown by region, state, status, and year
  app.get('/api/portfolio/breakdown', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const breakdown = await portfolioRollupService.getPortfolioBreakdown(orgId);
      res.json(breakdown);
    } catch (error) {
      console.error('Failed to get portfolio breakdown:', error);
      res.status(500).json({ error: 'Failed to get portfolio breakdown' });
    }
  });

  // Get portfolio projections for all scenarios
  app.get('/api/portfolio/projections', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projectIds = req.query.projectIds ? (req.query.projectIds as string).split(',') : undefined;
      const yearsToProject = parseInt(req.query.years as string) || 5;
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const projections = await portfolioRollupService.getPortfolioProjections(orgId, projectIds, yearsToProject);
      res.json(projections);
    } catch (error) {
      console.error('Failed to get portfolio projections:', error);
      res.status(500).json({ error: 'Failed to get portfolio projections' });
    }
  });

  // Get top performing projects
  app.get('/api/portfolio/top-performers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const topPerformers = await portfolioRollupService.getTopPerformingProjects(orgId, limit);
      res.json(topPerformers);
    } catch (error) {
      console.error('Failed to get top performers:', error);
      res.status(500).json({ error: 'Failed to get top performing projects' });
    }
  });

  // Get underperforming projects
  app.get('/api/portfolio/underperformers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const occupancyThreshold = parseFloat(req.query.threshold as string) || 70;
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const underperformers = await portfolioRollupService.getUnderperformingProjects(orgId, occupancyThreshold);
      res.json(underperformers);
    } catch (error) {
      console.error('Failed to get underperformers:', error);
      res.status(500).json({ error: 'Failed to get underperforming projects' });
    }
  });

  // Export full portfolio report
  app.get('/api/portfolio/export', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const report = await portfolioRollupService.exportPortfolioReport(orgId);
      res.json(report);
    } catch (error) {
      console.error('Failed to export portfolio report:', error);
      res.status(500).json({ error: 'Failed to export portfolio report' });
    }
  });

  // ============================================================================
  // DOCUMENT INTELLIGENCE - AI-Powered Financial Document Parsing
  // ============================================================================

  // Configure multer for document uploads
  const docIntelUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'server', 'uploads', 'doc-intel');
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${crypto.randomBytes(8).toString('hex')}${ext}`);
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for financial docs
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.ms-excel', // xls
        'text/csv',
        'application/pdf'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only Excel, CSV, and PDF files are allowed.'));
      }
    }
  });

  // Initialize organization with default categories and patterns
  app.post('/api/modeling/doc-intel/init', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const result = await docIntelService.initializeOrganization(orgId);
      res.json(result);
    } catch (error) {
      console.error('Failed to initialize document intelligence:', error);
      res.status(500).json({ error: 'Failed to initialize document intelligence' });
    }
  });

  // --- P&L CATEGORIES ---
  
  // Get all categories for organization (hierarchical)
  app.get('/api/modeling/doc-intel/categories', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const hierarchical = req.query.hierarchical === 'true';
      
      if (hierarchical) {
        const categories = await docIntelService.getCategoriesHierarchical(orgId);
        res.json(categories);
      } else {
        const categories = await docIntelService.getCategories(orgId);
        res.json(categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Create category
  app.post('/api/modeling/doc-intel/categories', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const category = await docIntelService.createCategory(orgId, req.body);
      res.status(201).json(category);
    } catch (error) {
      console.error('Failed to create category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  // Update category
  app.patch('/api/modeling/doc-intel/categories/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const category = await docIntelService.updateCategory(orgId, req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json(category);
    } catch (error) {
      console.error('Failed to update category:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  // Delete category (soft delete)
  app.delete('/api/modeling/doc-intel/categories/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      await docIntelService.deleteCategory(orgId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete category:', error);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // --- DOCUMENT UPLOADS ---
  
  // Get all uploads for a project
  app.get('/api/modeling/projects/:projectId/documents', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const uploads = await docIntelService.getProjectUploads(orgId, projectId);
      res.json(uploads);
    } catch (error) {
      console.error('Failed to fetch document uploads:', error);
      res.status(500).json({ error: 'Failed to fetch document uploads' });
    }
  });

  // Upload new document for processing
  app.post('/api/modeling/projects/:projectId/documents', authenticateUser, docIntelUpload.single('file'), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const upload = await docIntelService.createUpload(orgId, {
        modelingProjectId: projectId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        storagePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        docType: req.body.docType || null,
        year: req.body.year ? parseInt(req.body.year) : null,
        uploadedBy: userId,
        status: 'uploaded'
      });
      
      res.status(201).json(upload);
    } catch (error) {
      console.error('Failed to upload document:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });

  // Get single upload with stats
  app.get('/api/modeling/projects/:projectId/documents/:uploadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const stats = await docIntelService.getUploadStats(orgId, uploadId);
      res.json({ ...upload, stats });
    } catch (error) {
      console.error('Failed to fetch document:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  // Update upload metadata (doc type, year, wizard step)
  app.patch('/api/modeling/projects/:projectId/documents/:uploadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.updateUpload(orgId, uploadId, req.body);
      if (!upload) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      res.json(upload);
    } catch (error) {
      console.error('Failed to update document:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
  });

  // Delete upload and associated items
  app.delete('/api/modeling/projects/:projectId/documents/:uploadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { uploadId } = req.params;
      
      await docIntelService.deleteUpload(orgId, uploadId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  // --- PARSING & EXTRACTION ---
  
  // Parse document and extract line items
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/parse', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const items = await docIntelService.parseAndExtract(orgId, uploadId);
      res.json({ items, count: items.length });
    } catch (error) {
      console.error('Failed to parse document:', error);
      res.status(500).json({ error: 'Failed to parse document' });
    }
  });

  // Categorize extracted items using rules
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/categorize', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const items = await docIntelService.categorizeItems(orgId, uploadId);
      
      // Update upload to reviewing status
      await docIntelService.updateUpload(orgId, uploadId, { 
        status: 'reviewing',
        reviewStartedAt: new Date(),
        wizardStep: 2
      });
      
      res.json({ items, count: items.length });
    } catch (error) {
      console.error('Failed to categorize items:', error);
      res.status(500).json({ error: 'Failed to categorize items' });
    }
  });

  // --- EXTRACTED ITEMS ---
  
  // Get all extracted items for an upload
  app.get('/api/modeling/projects/:projectId/documents/:uploadId/items', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const withCategories = req.query.withCategories === 'true';
      const items = withCategories 
        ? await docIntelService.getExtractedItemsWithCategories(orgId, uploadId)
        : await docIntelService.getExtractedItems(orgId, uploadId);
      
      res.json(items);
    } catch (error) {
      console.error('Failed to fetch extracted items:', error);
      res.status(500).json({ error: 'Failed to fetch extracted items' });
    }
  });

  // Confirm an extracted item (assign category)
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/items/:itemId/confirm', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { itemId } = req.params;
      const { categoryId, amount } = req.body;
      
      if (!categoryId) {
        return res.status(400).json({ error: 'categoryId is required' });
      }
      
      const item = await docIntelService.confirmItem(orgId, itemId, categoryId, userId, amount);
      res.json(item);
    } catch (error) {
      console.error('Failed to confirm item:', error);
      res.status(500).json({ error: 'Failed to confirm item' });
    }
  });

  // Reject an extracted item
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/items/:itemId/reject', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { itemId } = req.params;
      
      const item = await docIntelService.rejectItem(orgId, itemId);
      res.json(item);
    } catch (error) {
      console.error('Failed to reject item:', error);
      res.status(500).json({ error: 'Failed to reject item' });
    }
  });

  // Auto-confirm high confidence items
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/items/confirm-high-confidence', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { uploadId } = req.params;
      const threshold = parseFloat(req.body.threshold) || 0.9;
      
      const count = await docIntelService.confirmAllHighConfidence(orgId, uploadId, userId, threshold);
      res.json({ confirmed: count });
    } catch (error) {
      console.error('Failed to auto-confirm items:', error);
      res.status(500).json({ error: 'Failed to auto-confirm items' });
    }
  });

  // --- IMPORT TO P&L ---
  
  // Import confirmed items to P&L Lines
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/import', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, uploadId } = req.params;
      const { fiscalYear } = req.body;
      
      const lines = await docIntelService.importConfirmedItems(orgId, uploadId, projectId, userId, fiscalYear);
      res.json({ imported: lines.length, lines });
    } catch (error) {
      console.error('Failed to import items:', error);
      res.status(500).json({ error: 'Failed to import items' });
    }
  });

  // Get P&L Lines for a project
  app.get('/api/modeling/projects/:projectId/pnl-lines', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const lines = await docIntelService.getProjectPnlLines(orgId, projectId);
      res.json(lines);
    } catch (error) {
      console.error('Failed to fetch P&L lines:', error);
      res.status(500).json({ error: 'Failed to fetch P&L lines' });
    }
  });

  // --- CATEGORY MAPPINGS & RULES ---
  
  // Get category mappings for organization
  app.get('/api/modeling/doc-intel/mappings', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projectId = req.query.projectId as string | undefined;
      
      const mappings = await docIntelService.getCategoryMappings(orgId, projectId);
      res.json(mappings);
    } catch (error) {
      console.error('Failed to fetch category mappings:', error);
      res.status(500).json({ error: 'Failed to fetch category mappings' });
    }
  });

  // Create learning rule from user feedback
  app.post('/api/modeling/doc-intel/rules', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { name, keywords, categoryId } = req.body;
      
      if (!name || !keywords || !categoryId) {
        return res.status(400).json({ error: 'name, keywords, and categoryId are required' });
      }
      
      const rule = await docIntelService.createLearningRule(orgId, name, keywords, categoryId, userId);
      res.status(201).json(rule);
    } catch (error) {
      console.error('Failed to create learning rule:', error);
      res.status(500).json({ error: 'Failed to create learning rule' });
    }
  });

  // ============================================================================
  // EXIT STRATEGY SUITE
  // ============================================================================

  // --- EXIT SCENARIOS ---
  
  // Get all exit scenarios for a modeling project
  app.get('/api/modeling/projects/:projectId/exit/scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      // Verify project exists and belongs to organization
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenarios = await storage.getExitScenarios(projectId, orgId);
      res.json(scenarios);
    } catch (error) {
      console.error('Failed to fetch exit scenarios:', error);
      res.status(500).json({ error: 'Failed to fetch exit scenarios' });
    }
  });

  // Get single exit scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario || scenario.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      res.json(scenario);
    } catch (error) {
      console.error('Failed to fetch exit scenario:', error);
      res.status(500).json({ error: 'Failed to fetch exit scenario' });
    }
  });

  // Create exit scenario
  app.post('/api/modeling/projects/:projectId/exit/scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenario = await storage.createExitScenario({
        ...req.body,
        modelingProjectId: projectId,
        orgId,
        createdBy: userId
      });
      
      // Log activity
      await storage.createExitActivity({
        modelingProjectId: projectId,
        exitScenarioId: scenario.id,
        activityType: 'scenario_created',
        description: `Created exit scenario: ${scenario.name}`,
        userId,
        orgId
      });
      
      res.status(201).json(scenario);
    } catch (error) {
      console.error('Failed to create exit scenario:', error);
      res.status(500).json({ error: 'Failed to create exit scenario' });
    }
  });

  // Update exit scenario
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenario = await storage.updateExitScenario(scenarioId, {
        ...req.body,
        updatedBy: userId
      }, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      res.json(scenario);
    } catch (error) {
      console.error('Failed to update exit scenario:', error);
      res.status(500).json({ error: 'Failed to update exit scenario' });
    }
  });

  // Delete exit scenario
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const success = await storage.deleteExitScenario(scenarioId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete exit scenario:', error);
      res.status(500).json({ error: 'Failed to delete exit scenario' });
    }
  });

  // --- TAX CALCULATIONS ---

  // Get tax calculations for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/tax', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const taxCalcs = await storage.getExitTaxCalculations(scenarioId, orgId);
      res.json(taxCalcs);
    } catch (error) {
      console.error('Failed to fetch tax calculations:', error);
      res.status(500).json({ error: 'Failed to fetch tax calculations' });
    }
  });

  // Create tax calculation
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/tax', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const taxCalc = await storage.createExitTaxCalculation({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(taxCalc);
    } catch (error) {
      console.error('Failed to create tax calculation:', error);
      res.status(500).json({ error: 'Failed to create tax calculation' });
    }
  });

  // Update tax calculation
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/tax/:taxId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { taxId } = req.params;
      
      const taxCalc = await storage.updateExitTaxCalculation(taxId, req.body, orgId);
      if (!taxCalc) {
        return res.status(404).json({ error: 'Tax calculation not found' });
      }
      
      res.json(taxCalc);
    } catch (error) {
      console.error('Failed to update tax calculation:', error);
      res.status(500).json({ error: 'Failed to update tax calculation' });
    }
  });

  // Delete tax calculation
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/tax/:taxId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { taxId } = req.params;
      
      const success = await storage.deleteExitTaxCalculation(taxId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Tax calculation not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete tax calculation:', error);
      res.status(500).json({ error: 'Failed to delete tax calculation' });
    }
  });

  // --- SELLER FINANCING ---

  // Get seller financing for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/seller-financing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const sellerFinancing = await storage.getExitSellerFinancing(scenarioId, orgId);
      res.json(sellerFinancing);
    } catch (error) {
      console.error('Failed to fetch seller financing:', error);
      res.status(500).json({ error: 'Failed to fetch seller financing' });
    }
  });

  // Create seller financing
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/seller-financing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const sellerFinancing = await storage.createExitSellerFinancing({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(sellerFinancing);
    } catch (error) {
      console.error('Failed to create seller financing:', error);
      res.status(500).json({ error: 'Failed to create seller financing' });
    }
  });

  // Update seller financing
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/seller-financing/:sfId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { sfId } = req.params;
      
      const sellerFinancing = await storage.updateExitSellerFinancing(sfId, req.body, orgId);
      if (!sellerFinancing) {
        return res.status(404).json({ error: 'Seller financing not found' });
      }
      
      res.json(sellerFinancing);
    } catch (error) {
      console.error('Failed to update seller financing:', error);
      res.status(500).json({ error: 'Failed to update seller financing' });
    }
  });

  // Delete seller financing
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/seller-financing/:sfId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { sfId } = req.params;
      
      const success = await storage.deleteExitSellerFinancing(sfId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Seller financing not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete seller financing:', error);
      res.status(500).json({ error: 'Failed to delete seller financing' });
    }
  });

  // --- EARNOUTS ---

  // Get earnouts for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/earnouts', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const earnouts = await storage.getExitEarnouts(scenarioId, orgId);
      res.json(earnouts);
    } catch (error) {
      console.error('Failed to fetch earnouts:', error);
      res.status(500).json({ error: 'Failed to fetch earnouts' });
    }
  });

  // Create earnout
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/earnouts', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const earnout = await storage.createExitEarnout({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(earnout);
    } catch (error) {
      console.error('Failed to create earnout:', error);
      res.status(500).json({ error: 'Failed to create earnout' });
    }
  });

  // Update earnout
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/earnouts/:earnoutId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { earnoutId } = req.params;
      
      const earnout = await storage.updateExitEarnout(earnoutId, req.body, orgId);
      if (!earnout) {
        return res.status(404).json({ error: 'Earnout not found' });
      }
      
      res.json(earnout);
    } catch (error) {
      console.error('Failed to update earnout:', error);
      res.status(500).json({ error: 'Failed to update earnout' });
    }
  });

  // Delete earnout
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/earnouts/:earnoutId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { earnoutId } = req.params;
      
      const success = await storage.deleteExitEarnout(earnoutId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Earnout not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete earnout:', error);
      res.status(500).json({ error: 'Failed to delete earnout' });
    }
  });

  // --- 1031 EXCHANGES ---

  // Get 1031 exchanges for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/1031', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const exchanges = await storage.getExit1031Exchanges(scenarioId, orgId);
      res.json(exchanges);
    } catch (error) {
      console.error('Failed to fetch 1031 exchanges:', error);
      res.status(500).json({ error: 'Failed to fetch 1031 exchanges' });
    }
  });

  // Create 1031 exchange
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/1031', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const exchange = await storage.createExit1031Exchange({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(exchange);
    } catch (error) {
      console.error('Failed to create 1031 exchange:', error);
      res.status(500).json({ error: 'Failed to create 1031 exchange' });
    }
  });

  // Update 1031 exchange
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/1031/:exchangeId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { exchangeId } = req.params;
      
      const exchange = await storage.updateExit1031Exchange(exchangeId, req.body, orgId);
      if (!exchange) {
        return res.status(404).json({ error: '1031 exchange not found' });
      }
      
      res.json(exchange);
    } catch (error) {
      console.error('Failed to update 1031 exchange:', error);
      res.status(500).json({ error: 'Failed to update 1031 exchange' });
    }
  });

  // Delete 1031 exchange
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/1031/:exchangeId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { exchangeId } = req.params;
      
      const success = await storage.deleteExit1031Exchange(exchangeId, orgId);
      if (!success) {
        return res.status(404).json({ error: '1031 exchange not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete 1031 exchange:', error);
      res.status(500).json({ error: 'Failed to delete 1031 exchange' });
    }
  });

  // --- DST ANALYSES ---

  // Get DST analyses for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/dst', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const dstAnalyses = await storage.getExitDstAnalyses(scenarioId, orgId);
      res.json(dstAnalyses);
    } catch (error) {
      console.error('Failed to fetch DST analyses:', error);
      res.status(500).json({ error: 'Failed to fetch DST analyses' });
    }
  });

  // Create DST analysis
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/dst', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const dstAnalysis = await storage.createExitDstAnalysis({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(dstAnalysis);
    } catch (error) {
      console.error('Failed to create DST analysis:', error);
      res.status(500).json({ error: 'Failed to create DST analysis' });
    }
  });

  // Update DST analysis
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/dst/:dstId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dstId } = req.params;
      
      const dstAnalysis = await storage.updateExitDstAnalysis(dstId, req.body, orgId);
      if (!dstAnalysis) {
        return res.status(404).json({ error: 'DST analysis not found' });
      }
      
      res.json(dstAnalysis);
    } catch (error) {
      console.error('Failed to update DST analysis:', error);
      res.status(500).json({ error: 'Failed to update DST analysis' });
    }
  });

  // Delete DST analysis
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/dst/:dstId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dstId } = req.params;
      
      const success = await storage.deleteExitDstAnalysis(dstId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'DST analysis not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete DST analysis:', error);
      res.status(500).json({ error: 'Failed to delete DST analysis' });
    }
  });

  // --- FUNDS ---

  // Get all funds for organization
  app.get('/api/exit/funds', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const funds = await storage.getExitFunds(orgId);
      res.json(funds);
    } catch (error) {
      console.error('Failed to fetch funds:', error);
      res.status(500).json({ error: 'Failed to fetch funds' });
    }
  });

  // Get single fund
  app.get('/api/exit/funds/:fundId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const fund = await storage.getExitFund(fundId, orgId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      res.json(fund);
    } catch (error) {
      console.error('Failed to fetch fund:', error);
      res.status(500).json({ error: 'Failed to fetch fund' });
    }
  });

  // Create fund
  app.post('/api/exit/funds', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      const fund = await storage.createExitFund({
        ...req.body,
        orgId
      });
      
      res.status(201).json(fund);
    } catch (error) {
      console.error('Failed to create fund:', error);
      res.status(500).json({ error: 'Failed to create fund' });
    }
  });

  // Update fund
  app.patch('/api/exit/funds/:fundId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const fund = await storage.updateExitFund(fundId, req.body, orgId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      res.json(fund);
    } catch (error) {
      console.error('Failed to update fund:', error);
      res.status(500).json({ error: 'Failed to update fund' });
    }
  });

  // Delete fund
  app.delete('/api/exit/funds/:fundId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const success = await storage.deleteExitFund(fundId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete fund:', error);
      res.status(500).json({ error: 'Failed to delete fund' });
    }
  });

  // --- WATERFALL STRUCTURES ---

  // Get waterfall structures for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/waterfall', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const waterfalls = await storage.getExitWaterfallStructures(scenarioId, orgId);
      res.json(waterfalls);
    } catch (error) {
      console.error('Failed to fetch waterfall structures:', error);
      res.status(500).json({ error: 'Failed to fetch waterfall structures' });
    }
  });

  // Create waterfall structure
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/waterfall', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const waterfall = await storage.createExitWaterfallStructure({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(waterfall);
    } catch (error) {
      console.error('Failed to create waterfall structure:', error);
      res.status(500).json({ error: 'Failed to create waterfall structure' });
    }
  });

  // Update waterfall structure
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/waterfall/:waterfallId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { waterfallId } = req.params;
      
      const waterfall = await storage.updateExitWaterfallStructure(waterfallId, req.body, orgId);
      if (!waterfall) {
        return res.status(404).json({ error: 'Waterfall structure not found' });
      }
      
      res.json(waterfall);
    } catch (error) {
      console.error('Failed to update waterfall structure:', error);
      res.status(500).json({ error: 'Failed to update waterfall structure' });
    }
  });

  // Delete waterfall structure
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/waterfall/:waterfallId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { waterfallId } = req.params;
      
      const success = await storage.deleteExitWaterfallStructure(waterfallId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Waterfall structure not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete waterfall structure:', error);
      res.status(500).json({ error: 'Failed to delete waterfall structure' });
    }
  });

  // --- INVESTORS ---

  // Get investors for a fund
  app.get('/api/exit/funds/:fundId/investors', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const fund = await storage.getExitFund(fundId, orgId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      const investors = await storage.getExitInvestors(fundId, orgId);
      res.json(investors);
    } catch (error) {
      console.error('Failed to fetch investors:', error);
      res.status(500).json({ error: 'Failed to fetch investors' });
    }
  });

  // Create investor
  app.post('/api/exit/funds/:fundId/investors', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const fund = await storage.getExitFund(fundId, orgId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      const investor = await storage.createExitInvestor({
        ...req.body,
        fundId,
        orgId
      });
      
      res.status(201).json(investor);
    } catch (error) {
      console.error('Failed to create investor:', error);
      res.status(500).json({ error: 'Failed to create investor' });
    }
  });

  // Update investor
  app.patch('/api/exit/funds/:fundId/investors/:investorId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { investorId } = req.params;
      
      const investor = await storage.updateExitInvestor(investorId, req.body, orgId);
      if (!investor) {
        return res.status(404).json({ error: 'Investor not found' });
      }
      
      res.json(investor);
    } catch (error) {
      console.error('Failed to update investor:', error);
      res.status(500).json({ error: 'Failed to update investor' });
    }
  });

  // Delete investor
  app.delete('/api/exit/funds/:fundId/investors/:investorId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { investorId } = req.params;
      
      const success = await storage.deleteExitInvestor(investorId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Investor not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete investor:', error);
      res.status(500).json({ error: 'Failed to delete investor' });
    }
  });

  // --- CASH FLOWS ---

  // Get cash flows for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/cash-flows', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const cashFlows = await storage.getExitCashFlows(scenarioId, orgId);
      res.json(cashFlows);
    } catch (error) {
      console.error('Failed to fetch cash flows:', error);
      res.status(500).json({ error: 'Failed to fetch cash flows' });
    }
  });

  // Save cash flows for a scenario (replaces existing)
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/cash-flows', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      const { cashFlows } = req.body;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      // Delete existing cash flows
      await storage.deleteExitCashFlows(scenarioId, orgId);
      
      // Create new cash flows
      const createdFlows = [];
      for (const cf of cashFlows) {
        const created = await storage.createExitCashFlow({
          ...cf,
          exitScenarioId: scenarioId,
          orgId
        });
        createdFlows.push(created);
      }
      
      res.status(201).json(createdFlows);
    } catch (error) {
      console.error('Failed to save cash flows:', error);
      res.status(500).json({ error: 'Failed to save cash flows' });
    }
  });

  // --- ACTIVITIES / AUDIT LOG ---

  // Get activities for a scenario or project
  app.get('/api/modeling/projects/:projectId/exit/activities', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioId } = req.query;
      
      const activities = await storage.getExitActivities(
        scenarioId as string || null,
        projectId,
        orgId
      );
      res.json(activities);
    } catch (error) {
      console.error('Failed to fetch exit activities:', error);
      res.status(500).json({ error: 'Failed to fetch exit activities' });
    }
  });

  // ============================================================================
  // TRANSACTION & CLOSING COSTS
  // ============================================================================

  // Get transaction closing data for a modeling project
  app.get('/api/modeling/projects/:projectId/transaction-closing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      // Verify project exists and belongs to organization
      const [project] = await db.select().from(modelingProjects)
        .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
      
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      // Get summary (1:1 relationship)
      const [summary] = await db.select().from(transactionClosingSummary)
        .where(eq(transactionClosingSummary.modelingProjectId, projectId));
      
      // Get line items
      const closingLines = await db.select().from(closingCostLines)
        .where(eq(closingCostLines.modelingProjectId, projectId))
        .orderBy(asc(closingCostLines.sortOrder));
      
      const transitionLines = await db.select().from(transitionCostLines)
        .where(eq(transitionCostLines.modelingProjectId, projectId))
        .orderBy(asc(transitionCostLines.sortOrder));
      
      const nwcLinesData = await db.select().from(nwcLines)
        .where(eq(nwcLines.modelingProjectId, projectId))
        .orderBy(asc(nwcLines.sortOrder));
      
      res.json({
        summary: summary || null,
        closingCostLines: closingLines,
        transitionCostLines: transitionLines,
        nwcLines: nwcLinesData,
      });
    } catch (error) {
      console.error('Failed to fetch transaction closing data:', error);
      res.status(500).json({ error: 'Failed to fetch transaction closing data' });
    }
  });

  // Save transaction closing data for a modeling project
  app.post('/api/modeling/projects/:projectId/transaction-closing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      // Verify project exists and belongs to organization
      const [project] = await db.select().from(modelingProjects)
        .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
      
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      // Parse and validate request body
      const { summary, closingCostLines: closingLines, transitionCostLines: transitionLines, nwcLines: nwcLinesData } = req.body;
      
      // Run calculations
      const calculatedSummary = calculateAll({
        summary: summary || {},
        closingCostLines: closingLines || [],
        transitionCostLines: transitionLines || [],
        nwcLines: nwcLinesData || [],
      });
      
      // Merge user-entered fields with computed fields
      const summaryToSave = {
        ...summary, // User-entered fields (purchasePrice, financingFeeRate, etc.)
        ...calculatedSummary, // Computed fields (override with calculated values)
      };
      
      // Begin transaction - save everything atomically
      await db.transaction(async (tx) => {
        // Upsert summary
        const [existingSummary] = await tx.select().from(transactionClosingSummary)
          .where(eq(transactionClosingSummary.modelingProjectId, projectId));
        
        if (existingSummary) {
          // Update existing
          await tx.update(transactionClosingSummary)
            .set({
              ...summaryToSave,
              modelingProjectId: projectId,
              orgId,
              updatedAt: new Date(),
            })
            .where(eq(transactionClosingSummary.id, existingSummary.id));
        } else {
          // Insert new
          await tx.insert(transactionClosingSummary).values({
            ...summaryToSave,
            modelingProjectId: projectId,
            orgId,
          });
        }
        
        // Delete existing line items and re-insert (simpler than upsert logic)
        await tx.delete(closingCostLines).where(eq(closingCostLines.modelingProjectId, projectId));
        await tx.delete(transitionCostLines).where(eq(transitionCostLines.modelingProjectId, projectId));
        await tx.delete(nwcLines).where(eq(nwcLines.modelingProjectId, projectId));
        
        // Insert closing cost lines
        if (closingLines && closingLines.length > 0) {
          await tx.insert(closingCostLines).values(
            closingLines.map((line: any, index: number) => ({
              ...line,
              modelingProjectId: projectId,
              orgId,
              sortOrder: line.sortOrder ?? index,
            }))
          );
        }
        
        // Insert transition cost lines
        if (transitionLines && transitionLines.length > 0) {
          await tx.insert(transitionCostLines).values(
            transitionLines.map((line: any, index: number) => ({
              ...line,
              modelingProjectId: projectId,
              orgId,
              sortOrder: line.sortOrder ?? index,
            }))
          );
        }
        
        // Insert NWC lines
        if (nwcLinesData && nwcLinesData.length > 0) {
          await tx.insert(nwcLines).values(
            nwcLinesData.map((line: any, index: number) => ({
              ...line,
              modelingProjectId: projectId,
              orgId,
              sortOrder: line.sortOrder ?? index,
            }))
          );
        }
      });
      
      // Fetch and return saved data
      const [savedSummary] = await db.select().from(transactionClosingSummary)
        .where(eq(transactionClosingSummary.modelingProjectId, projectId));
      
      const savedClosingLines = await db.select().from(closingCostLines)
        .where(eq(closingCostLines.modelingProjectId, projectId))
        .orderBy(asc(closingCostLines.sortOrder));
      
      const savedTransitionLines = await db.select().from(transitionCostLines)
        .where(eq(transitionCostLines.modelingProjectId, projectId))
        .orderBy(asc(transitionCostLines.sortOrder));
      
      const savedNwcLines = await db.select().from(nwcLines)
        .where(eq(nwcLines.modelingProjectId, projectId))
        .orderBy(asc(nwcLines.sortOrder));
      
      res.json({
        summary: savedSummary,
        closingCostLines: savedClosingLines,
        transitionCostLines: savedTransitionLines,
        nwcLines: savedNwcLines,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to save transaction closing data:', error);
      res.status(500).json({ error: 'Failed to save transaction closing data' });
    }
  });

  // ============================================================================
  // DEBT SCENARIOS - Debt Structure Analysis & Sensitivity Modeling
  // ============================================================================

  // Get all debt scenarios for organization
  app.get('/api/modeling/debt-scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      // TODO: Add to storage interface
      const scenarios = await storage.getDebtScenarios(orgId);
      res.json(scenarios);
    } catch (error) {
      console.error('Failed to fetch debt scenarios:', error);
      res.status(500).json({ error: 'Failed to fetch debt scenarios' });
    }
  });

  // Get scenarios for a specific modeling project
  app.get('/api/modeling/debt-scenarios/project/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      // TODO: Add to storage interface
      const scenarios = await storage.getDebtScenariosByProject(projectId, orgId);
      res.json(scenarios);
    } catch (error) {
      console.error('Failed to fetch debt scenarios for project:', error);
      res.status(500).json({ error: 'Failed to fetch debt scenarios for project' });
    }
  });

  // Get single debt scenario with calculated metrics
  app.get('/api/modeling/debt-scenarios/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      // TODO: Add to storage interface
      const scenario = await storage.getDebtScenario(id, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }

      // Calculate metrics using the debt scenario service
      const metrics = debtScenarioService.calculateMetrics({
        purchasePrice: scenario.purchasePrice,
        loanAmount: scenario.loanAmount,
        noi: scenario.noi,
        interestRate: scenario.baseRate + (scenario.spreadBps / 100),
        amortizationYears: scenario.amortizationYears,
        loanTermYears: scenario.loanTermYears,
        interestOnlyYears: scenario.interestOnlyYears || 0
      });

      // Return scenario with calculated metrics
      res.json({
        ...scenario,
        calculatedMetrics: metrics
      });
    } catch (error) {
      console.error('Failed to fetch debt scenario:', error);
      res.status(500).json({ error: 'Failed to fetch debt scenario' });
    }
  });

  // Create new debt scenario
  app.post('/api/modeling/debt-scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const data = insertDebtScenarioSchema.parse(req.body);
      
      // Calculate initial metrics
      const metrics = debtScenarioService.calculateMetrics({
        purchasePrice: data.purchasePrice,
        loanAmount: data.loanAmount,
        noi: data.noi,
        interestRate: data.baseRate + (data.spreadBps / 100),
        amortizationYears: data.amortizationYears,
        loanTermYears: data.loanTermYears,
        interestOnlyYears: data.interestOnlyYears || 0
      });

      // TODO: Add to storage interface
      const scenario = await storage.createDebtScenario({
        ...data,
        orgId,
        createdBy: userId,
        calculatedLtv: metrics.loanToValue,
        calculatedDscr: metrics.debtServiceCoverageRatio,
        calculatedDebtYield: metrics.debtYield
      });
      
      res.status(201).json({
        ...scenario,
        calculatedMetrics: metrics
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create debt scenario:', error);
      res.status(500).json({ error: 'Failed to create debt scenario' });
    }
  });

  // Update debt scenario handler (shared for both PATCH and PUT)
  const updateDebtScenarioHandler = async (req: any, res: any) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { id } = req.params;
      
      const data = updateDebtScenarioSchema.parse(req.body);
      
      const existingScenario = await storage.getDebtScenario(id, orgId);
      
      if (!existingScenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }

      // Merge existing scenario with updates for metric calculation
      const updatedData = { ...existingScenario, ...data };

      // Recalculate metrics with updated values
      const metrics = debtScenarioService.calculateMetrics({
        purchasePrice: updatedData.purchasePrice,
        loanAmount: updatedData.loanAmount,
        noi: updatedData.noi,
        interestRate: updatedData.baseRate + (updatedData.spreadBps / 100),
        amortizationYears: updatedData.amortizationYears,
        loanTermYears: updatedData.loanTermYears,
        interestOnlyYears: updatedData.interestOnlyYears || 0
      });

      const scenario = await storage.updateDebtScenario(id, {
        ...data,
        updatedBy: userId,
        calculatedLtv: metrics.loanToValue,
        calculatedDscr: metrics.debtServiceCoverageRatio,
        calculatedDebtYield: metrics.debtYield
      }, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }
      
      res.json({
        ...scenario,
        calculatedMetrics: metrics
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update debt scenario:', error);
      res.status(500).json({ error: 'Failed to update debt scenario' });
    }
  };

  // Update debt scenario (PATCH and PUT for compatibility)
  app.patch('/api/modeling/debt-scenarios/:id', authenticateUser, updateDebtScenarioHandler);
  app.put('/api/modeling/debt-scenarios/:id', authenticateUser, updateDebtScenarioHandler);

  // Delete debt scenario
  app.delete('/api/modeling/debt-scenarios/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      // TODO: Add to storage interface
      const success = await storage.deleteDebtScenario(id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete debt scenario:', error);
      res.status(500).json({ error: 'Failed to delete debt scenario' });
    }
  });

  // Recalculate metrics for a scenario (useful after bulk updates or corrections)
  app.post('/api/modeling/debt-scenarios/:id/calculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      // TODO: Add to storage interface
      const scenario = await storage.getDebtScenario(id, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }

      // Calculate comprehensive metrics
      const metrics = debtScenarioService.calculateMetrics({
        purchasePrice: scenario.purchasePrice,
        loanAmount: scenario.loanAmount,
        noi: scenario.noi,
        interestRate: scenario.baseRate + (scenario.spreadBps / 100),
        amortizationYears: scenario.amortizationYears,
        loanTermYears: scenario.loanTermYears,
        interestOnlyYears: scenario.interestOnlyYears || 0
      });

      // Generate amortization schedule
      const amortizationSchedule = debtScenarioService.generateAmortizationSchedule(
        scenario.loanAmount,
        scenario.baseRate + (scenario.spreadBps / 100),
        scenario.amortizationYears,
        (scenario.interestOnlyYears || 0) * 12
      );

      res.json({
        scenario,
        metrics,
        amortizationSchedule: amortizationSchedule.slice(0, 12) // First year only for performance
      });
    } catch (error) {
      console.error('Failed to calculate debt scenario metrics:', error);
      res.status(500).json({ error: 'Failed to calculate debt scenario metrics' });
    }
  });

  // Run sensitivity analysis on a scenario
  app.post('/api/modeling/debt-scenarios/:id/sensitivity', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      // TODO: Add to storage interface
      const scenario = await storage.getDebtScenario(id, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }

      // Parse optional sensitivity parameters from request body
      const { rateSteps, ltvTargets } = req.body;

      // Run comprehensive sensitivity analysis
      const sensitivityAnalysis = debtScenarioService.runSensitivityAnalysis({
        purchasePrice: scenario.purchasePrice,
        loanAmount: scenario.loanAmount,
        noi: scenario.noi,
        interestRate: scenario.baseRate + (scenario.spreadBps / 100),
        amortizationYears: scenario.amortizationYears,
        loanTermYears: scenario.loanTermYears,
        interestOnlyYears: scenario.interestOnlyYears || 0
      });

      // Optional: run custom sensitivity if parameters provided
      let customRateSensitivity;
      let customLtvSensitivity;

      if (rateSteps && Array.isArray(rateSteps)) {
        customRateSensitivity = debtScenarioService.runRateSensitivity({
          purchasePrice: scenario.purchasePrice,
          loanAmount: scenario.loanAmount,
          noi: scenario.noi,
          interestRate: scenario.baseRate + (scenario.spreadBps / 100),
          amortizationYears: scenario.amortizationYears,
          loanTermYears: scenario.loanTermYears,
          interestOnlyYears: scenario.interestOnlyYears || 0
        }, rateSteps);
      }

      if (ltvTargets && Array.isArray(ltvTargets)) {
        customLtvSensitivity = debtScenarioService.runLTVSensitivity({
          purchasePrice: scenario.purchasePrice,
          loanAmount: scenario.loanAmount,
          noi: scenario.noi,
          interestRate: scenario.baseRate + (scenario.spreadBps / 100),
          amortizationYears: scenario.amortizationYears,
          loanTermYears: scenario.loanTermYears,
          interestOnlyYears: scenario.interestOnlyYears || 0
        }, ltvTargets);
      }

      res.json({
        scenario: {
          id: scenario.id,
          name: scenario.name,
          modelingProjectId: scenario.modelingProjectId
        },
        sensitivityAnalysis,
        ...(customRateSensitivity && { customRateSensitivity }),
        ...(customLtvSensitivity && { customLtvSensitivity })
      });
    } catch (error) {
      console.error('Failed to run sensitivity analysis:', error);
      res.status(500).json({ error: 'Failed to run sensitivity analysis' });
    }
  });

  // ========================================================================
  // PERSONA MANAGEMENT
  // ========================================================================

  // Get user's persona assignment
  app.get('/api/personas/me', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const persona = await personaService.getUserPersona(userId, orgId);
      
      if (!persona) {
        return res.status(404).json({ error: 'No persona assigned' });
      }
      
      res.json(persona);
    } catch (error) {
      console.error('Failed to fetch user persona:', error);
      res.status(500).json({ error: 'Failed to fetch user persona' });
    }
  });

  // Assign or update persona for current user
  app.post('/api/personas/me', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const data = insertUserPersonaAssignmentSchema.parse(req.body);
      const persona = await personaService.assignPersona(userId, orgId, data);
      res.json(persona);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to assign persona:', error);
      res.status(500).json({ error: 'Failed to assign persona' });
    }
  });

  // Get user's accessible features
  app.get('/api/personas/features', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const features = await personaService.getUserFeatures(userId, orgId);
      res.json({ features });
    } catch (error) {
      console.error('Failed to fetch user features:', error);
      res.status(500).json({ error: 'Failed to fetch user features' });
    }
  });

  // Check permission for a feature
  app.post('/api/personas/check-permission', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { featureKey } = req.body;
      
      if (!featureKey) {
        return res.status(400).json({ error: 'featureKey is required' });
      }
      
      const hasPermission = await personaService.checkPermission(userId, orgId, featureKey);
      res.json({ hasPermission });
    } catch (error) {
      console.error('Failed to check permission:', error);
      res.status(500).json({ error: 'Failed to check permission' });
    }
  });

  // ========================================================================
  // DASHBOARD WIDGETS & LAYOUTS
  // ========================================================================

  // Get widget registry (optionally filtered by persona)
  app.get('/api/dashboards/widgets', authenticateUser, async (req: any, res) => {
    try {
      const personaType = req.query.personaType;
      const widgets = await dashboardService.getWidgetRegistry(personaType);
      res.json(widgets);
    } catch (error) {
      console.error('Failed to fetch widget registry:', error);
      res.status(500).json({ error: 'Failed to fetch widget registry' });
    }
  });

  // Get user's dashboard layout
  app.get('/api/dashboards/layout', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const personaTemplate = req.query.personaTemplate;
      
      let layout = await dashboardService.getUserDashboardLayout(userId, orgId, personaTemplate);
      
      // If no layout exists, return default template
      if (!layout && personaTemplate) {
        const defaultLayout = await dashboardService.getTemplateByPersona(personaTemplate);
        return res.json({ layout: defaultLayout, isDefault: true });
      }
      
      if (!layout) {
        return res.status(404).json({ error: 'No dashboard layout found' });
      }
      
      res.json(layout);
    } catch (error) {
      console.error('Failed to fetch dashboard layout:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard layout' });
    }
  });

  // Save or update dashboard layout
  app.put('/api/dashboards/layout', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const data = insertUserDashboardLayoutSchema.parse(req.body);
      
      // Validate layout structure
      if (!dashboardService.validateLayout(data.layout as any)) {
        return res.status(400).json({ error: 'Invalid layout structure' });
      }
      
      const layout = await dashboardService.saveDashboardLayout(userId, orgId, data);
      res.json(layout);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to save dashboard layout:', error);
      res.status(500).json({ error: 'Failed to save dashboard layout' });
    }
  });

  // Get default template for a persona
  app.get('/api/dashboards/templates/:persona', authenticateUser, async (req: any, res) => {
    try {
      const { persona } = req.params;
      const template = await dashboardService.getTemplateByPersona(persona);
      res.json({ template });
    } catch (error) {
      console.error('Failed to fetch dashboard template:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard template' });
    }
  });

  // Reset dashboard to default
  app.post('/api/dashboards/reset', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { personaType } = req.body;
      
      if (!personaType) {
        return res.status(400).json({ error: 'personaType is required' });
      }
      
      const layout = await dashboardService.resetToDefault(userId, orgId, personaType);
      res.json(layout);
    } catch (error) {
      console.error('Failed to reset dashboard:', error);
      res.status(500).json({ error: 'Failed to reset dashboard' });
    }
  });

  // Get aggregated dashboard data
  app.get('/api/dashboards/data', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const timeRange = (req.query.timeRange as any) || 'all'; // 7d, 30d, 90d, ytd, all
      const modulesParam = req.query.modules as string;
      const selectedModules = modulesParam && modulesParam !== 'all' ? modulesParam.split(',') : null;
      
      const data = await dashboardService.getAggregatedDashboardData(orgId, timeRange, selectedModules);
      res.json(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // Get CRM trend data for charts
  app.get('/api/dashboards/trends/crm', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const timeRange = (req.query.timeRange as any) || '30d';
      const data = await dashboardService.getCRMTrendData(orgId, timeRange);
      res.json(data);
    } catch (error) {
      console.error('Failed to fetch CRM trend data:', error);
      res.status(500).json({ error: 'Failed to fetch CRM trend data' });
    }
  });

  // Get CRM stage distribution for pie chart
  app.get('/api/dashboards/distribution/crm-stages', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const timeRange = (req.query.timeRange as any) || '30d';
      const data = await dashboardService.getCRMStageDistribution(orgId, timeRange);
      res.json(data);
    } catch (error) {
      console.error('Failed to fetch CRM stage distribution:', error);
      res.status(500).json({ error: 'Failed to fetch stage distribution' });
    }
  });

  // Get revenue trend data for financial modules
  app.get('/api/dashboards/trends/revenue', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const module = (req.query.module as 'fuel' | 'shipStore') || 'fuel';
      const timeRange = (req.query.timeRange as any) || '30d';
      const data = await dashboardService.getRevenueTrendData(orgId, module, timeRange);
      res.json(data);
    } catch (error) {
      console.error('Failed to fetch revenue trend data:', error);
      res.status(500).json({ error: 'Failed to fetch revenue trend data' });
    }
  });

  // Export dashboard to JSON (PDF MVP)
  app.post('/api/dashboards/export/pdf', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { timeRange, modules } = req.body;
      
      // Security: Fetch dashboard data server-side instead of accepting arbitrary client data
      const validatedTimeRange = ['7d', '30d', '90d', 'ytd', 'all'].includes(timeRange) ? timeRange : '30d';
      const validatedModules = Array.isArray(modules) ? modules.filter((m: any) => typeof m === 'string') : null;
      
      // Fetch data server-side to prevent payload injection
      const dashboardData = await dashboardService.getAggregatedDashboardData(orgId, validatedTimeRange, validatedModules);
      
      // Create a simple JSON report
      // For full PDF export, integrate @react-pdf/renderer server-side rendering
      const report = {
        title: `Dashboard Report - ${new Date().toLocaleDateString()}`,
        timeRange: validatedTimeRange,
        modules: validatedModules || ['all'],
        data: dashboardData,
        generatedAt: new Date().toISOString(),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-report-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(report);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      res.status(500).json({ error: 'Failed to export dashboard' });
    }
  });

  // Export dashboard to Excel
  app.post('/api/dashboards/export/excel', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { timeRange, modules } = req.body;
      const XLSX = await import('xlsx');
      
      // Security: Validate input and fetch data server-side
      const validatedTimeRange = ['7d', '30d', '90d', 'ytd', 'all'].includes(timeRange) ? timeRange : '30d';
      const validatedModules = Array.isArray(modules) ? modules.filter((m: any) => typeof m === 'string') : null;
      
      // Fetch data server-side to prevent payload injection
      const dashboardData = await dashboardService.getAggregatedDashboardData(orgId, validatedTimeRange, validatedModules);
      
      // Create workbook with multiple sheets
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet with sanitized data
      const summaryData = [
        ['Dashboard Export'],
        ['Generated:', new Date().toLocaleString()],
        ['Time Range:', validatedTimeRange],
        [''],
        ['Module', 'Key Metrics'],
      ];
      
      // Add CRM data if available
      if (dashboardData?.crm) {
        summaryData.push(['CRM Pipeline', '']);
        summaryData.push(['Pipeline Value', Number(dashboardData.crm.pipelineValue) || 0]);
        summaryData.push(['Active Deals', Number(dashboardData.crm.activeDeals) || 0]);
        summaryData.push(['Win Rate', `${Number(dashboardData.crm.winRate) || 0}%`]);
      }
      
      // Add Due Diligence data if available
      if (dashboardData?.dueDiligence) {
        summaryData.push(['', '']);
        summaryData.push(['Due Diligence', '']);
        summaryData.push(['Active Projects', Number(dashboardData.dueDiligence.activeProjects) || 0]);
        summaryData.push(['Completed Projects', Number(dashboardData.dueDiligence.completedProjects) || 0]);
        summaryData.push(['Completion Rate', `${Number(dashboardData.dueDiligence.completionRate) || 0}%`]);
      }
      
      // Add Fuel data if available
      if (dashboardData?.fuel) {
        summaryData.push(['', '']);
        summaryData.push(['Fuel Operations', '']);
        summaryData.push(['Monthly Revenue', Number(dashboardData.fuel.monthlyRevenue) || 0]);
        summaryData.push(['Monthly Gallons', Number(dashboardData.fuel.monthlyGallons) || 0]);
      }
      
      // Add Ship Store data if available
      if (dashboardData?.shipStore) {
        summaryData.push(['', '']);
        summaryData.push(['Ship Store', '']);
        summaryData.push(['Monthly Revenue', Number(dashboardData.shipStore.monthlyRevenue) || 0]);
        summaryData.push(['Transactions', Number(dashboardData.shipStore.monthlyTransactions) || 0]);
        summaryData.push(['Avg Transaction', Number(dashboardData.shipStore.avgTransaction) || 0]);
      }
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-report-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(excelBuffer);
    } catch (error) {
      console.error('Failed to export Excel:', error);
      res.status(500).json({ error: 'Failed to export dashboard' });
    }
  });

  // Get recent deals for detail panel
  app.get('/api/crm/deals/recent', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { crmDeals, users } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const deals = await db
        .select({
          id: crmDeals.id,
          title: crmDeals.title,
          value: crmDeals.value,
          stage: crmDeals.stage,
          probability: crmDeals.probability,
          expectedCloseDate: crmDeals.expectedCloseDate,
          createdAt: crmDeals.createdAt,
        })
        .from(crmDeals)
        .innerJoin(users, eq(crmDeals.ownerId, users.id))
        .where(eq(users.orgId, orgId))
        .orderBy(desc(crmDeals.createdAt))
        .limit(20);

      res.json(deals);
    } catch (error) {
      console.error('Failed to fetch recent deals:', error);
      res.status(500).json({ error: 'Failed to fetch recent deals' });
    }
  });

  // Get recent sales comps for detail panel
  app.get('/api/analysis/sales-comps/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { salesComps } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const comps = await db
        .select({
          id: salesComps.id,
          propertyName: salesComps.propertyName,
          city: salesComps.city,
          state: salesComps.state,
          salePrice: salesComps.salePrice,
          slipCount: salesComps.slipCount,
          pricePerSlip: salesComps.pricePerSlip,
          saleYear: salesComps.saleYear,
          saleMonth: salesComps.saleMonth,
          createdAt: salesComps.createdAt,
        })
        .from(salesComps)
        .where(eq(salesComps.orgId, orgId))
        .orderBy(desc(salesComps.createdAt))
        .limit(20);

      res.json(comps);
    } catch (error) {
      console.error('Failed to fetch recent sales comps:', error);
      res.status(500).json({ error: 'Failed to fetch recent sales comps' });
    }
  });

  // ============================================================================
  // Demographics & Market Intelligence API
  // ============================================================================

  // Get demographics overview for a specific state
  app.get('/api/demographics/overview/:stateCode', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stateCode } = req.params;
      const { demographicsService } = await import('./services/demographics-service');
      
      const overview = await demographicsService.getDemographicsOverview(orgId, stateCode);
      res.json(overview);
    } catch (error) {
      console.error('Failed to fetch demographics overview:', error);
      res.status(500).json({ error: 'Failed to fetch demographics overview' });
    }
  });

  // Get economic indicators for a state
  app.get('/api/demographics/economic/:stateCode', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stateCode } = req.params;
      const { demographicsService } = await import('./services/demographics-service');
      
      const indicators = await demographicsService.getEconomicIndicators(orgId, stateCode);
      res.json(indicators);
    } catch (error) {
      console.error('Failed to fetch economic indicators:', error);
      res.status(500).json({ error: 'Failed to fetch economic indicators' });
    }
  });

  // Get regional market statistics for a state
  app.get('/api/demographics/market/:stateCode', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stateCode } = req.params;
      const { demographicsService } = await import('./services/demographics-service');
      
      const stats = await demographicsService.getRegionalMarketStats(orgId, stateCode);
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch market statistics:', error);
      res.status(500).json({ error: 'Failed to fetch market statistics' });
    }
  });

  // Get list of available states with transaction counts
  app.get('/api/demographics/states', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { demographicsService } = await import('./services/demographics-service');
      
      const states = await demographicsService.getAvailableStates(orgId);
      res.json(states);
    } catch (error) {
      console.error('Failed to fetch available states:', error);
      res.status(500).json({ error: 'Failed to fetch available states' });
    }
  });

  // Get national overview
  app.get('/api/demographics/national', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { demographicsService } = await import('./services/demographics-service');
      
      const overview = await demographicsService.getNationalOverview(orgId);
      res.json(overview);
    } catch (error) {
      console.error('Failed to fetch national overview:', error);
      res.status(500).json({ error: 'Failed to fetch national overview' });
    }
  });

  // Fetch Census demographics for a specific location (latitude/longitude)
  app.post('/api/demographics/location', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { latitude, longitude, address, radiusMiles } = req.body;
      
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }
      
      const { CensusService } = await import('./services/census-service');
      const censusApiKey = process.env.CENSUS_API_KEY;
      const censusService = new CensusService(censusApiKey);
      
      const demographics = await censusService.getDemographicsForLocation(
        parseFloat(latitude),
        parseFloat(longitude)
      );
      
      res.json({
        location: { latitude, longitude, address },
        radiusMiles: radiusMiles || null,
        demographics,
        fetchedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to fetch location demographics:', error);
      res.status(500).json({ error: 'Failed to fetch location demographics' });
    }
  });

  // Get demographics for a CRM property by ID
  app.get('/api/demographics/property/:propertyId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { propertyId } = req.params;
      
      // Get property from CRM
      const { crmProperties } = await import('@shared/schema');
      const property = await db
        .select()
        .from(crmProperties)
        .where(and(
          eq(crmProperties.id, parseInt(propertyId)),
          eq(crmProperties.orgId, orgId)
        ))
        .limit(1);
      
      if (property.length === 0) {
        return res.status(404).json({ error: 'Property not found' });
      }
      
      const prop = property[0];
      if (!prop.latitude || !prop.longitude) {
        return res.status(400).json({ error: 'Property does not have coordinates' });
      }
      
      const { CensusService } = await import('./services/census-service');
      const censusApiKey = process.env.CENSUS_API_KEY;
      const censusService = new CensusService(censusApiKey);
      
      const demographics = await censusService.getDemographicsForLocation(
        prop.latitude,
        prop.longitude
      );
      
      res.json({
        property: {
          id: prop.id,
          name: prop.name,
          address: prop.address,
          city: prop.city,
          state: prop.state,
          latitude: prop.latitude,
          longitude: prop.longitude
        },
        demographics,
        fetchedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to fetch property demographics:', error);
      res.status(500).json({ error: 'Failed to fetch property demographics' });
    }
  });

  // Compare demographics for multiple locations
  app.post('/api/demographics/compare', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { locations } = req.body;
      
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.status(400).json({ error: 'At least one location is required' });
      }
      
      if (locations.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 locations can be compared' });
      }
      
      const { CensusService } = await import('./services/census-service');
      const censusApiKey = process.env.CENSUS_API_KEY;
      const censusService = new CensusService(censusApiKey);
      
      const results = await Promise.all(
        locations.map(async (loc: { latitude: number; longitude: number; label?: string }) => {
          try {
            const demographics = await censusService.getDemographicsForLocation(
              loc.latitude,
              loc.longitude
            );
            return {
              location: loc,
              demographics,
              success: true
            };
          } catch (error) {
            return {
              location: loc,
              demographics: null,
              success: false,
              error: 'Failed to fetch demographics'
            };
          }
        })
      );
      
      res.json({
        comparisons: results,
        fetchedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to compare demographics:', error);
      res.status(500).json({ error: 'Failed to compare demographics' });
    }
  });

  // Get saved demographic locations for a modeling project
  app.get('/api/demographics/project-locations/:modelingProjectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { modelingProjectId } = req.params;
      
      const { demographicProjectLocations } = await import('@shared/schema');
      const { eq, and, asc } = await import('drizzle-orm');
      
      const locations = await db
        .select()
        .from(demographicProjectLocations)
        .where(and(
          eq(demographicProjectLocations.orgId, orgId),
          eq(demographicProjectLocations.modelingProjectId, modelingProjectId)
        ))
        .orderBy(asc(demographicProjectLocations.sortOrder));

      res.json(locations);
    } catch (error) {
      console.error('Failed to fetch demographic project locations:', error);
      res.status(500).json({ error: 'Failed to fetch demographic project locations' });
    }
  });

  // Save demographic locations for a modeling project (bulk save/update)
  app.post('/api/demographics/project-locations/:modelingProjectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { modelingProjectId } = req.params;
      const { locations } = req.body;

      if (!Array.isArray(locations)) {
        return res.status(400).json({ error: 'locations must be an array' });
      }

      const { demographicProjectLocations } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      // Delete existing locations for this project
      await db
        .delete(demographicProjectLocations)
        .where(and(
          eq(demographicProjectLocations.orgId, orgId),
          eq(demographicProjectLocations.modelingProjectId, modelingProjectId)
        ));

      // Insert new locations
      if (locations.length > 0) {
        const locationsToInsert = locations.map((loc: any, index: number) => ({
          orgId,
          modelingProjectId,
          address: loc.address,
          latitude: loc.lat,
          longitude: loc.lng,
          label: loc.label || null,
          analysisMode: loc.config?.analysisMode || 'distance',
          distanceRings: loc.config?.distanceRings || [1],
          driveTimes: loc.config?.driveTimes || [],
          sortOrder: index,
          createdBy: userId,
        }));

        await db.insert(demographicProjectLocations).values(locationsToInsert);
      }

      res.json({ success: true, count: locations.length });
    } catch (error) {
      console.error('Failed to save demographic project locations:', error);
      res.status(500).json({ error: 'Failed to save demographic project locations' });
    }
  });

  // Update a single demographic location configuration
  app.patch('/api/demographics/project-locations/:locationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { locationId } = req.params;
      const { analysisMode, distanceRings, driveTimes, label } = req.body;

      const { demographicProjectLocations } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const updateData: any = { updatedAt: new Date() };
      if (analysisMode !== undefined) updateData.analysisMode = analysisMode;
      if (distanceRings !== undefined) updateData.distanceRings = distanceRings;
      if (driveTimes !== undefined) updateData.driveTimes = driveTimes;
      if (label !== undefined) updateData.label = label;

      const [updated] = await db
        .update(demographicProjectLocations)
        .set(updateData)
        .where(and(
          eq(demographicProjectLocations.id, locationId),
          eq(demographicProjectLocations.orgId, orgId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Location not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Failed to update demographic location:', error);
      res.status(500).json({ error: 'Failed to update demographic location' });
    }
  });

  // Delete a single demographic location
  app.delete('/api/demographics/project-locations/:locationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { locationId } = req.params;

      const { demographicProjectLocations } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [deleted] = await db
        .delete(demographicProjectLocations)
        .where(and(
          eq(demographicProjectLocations.id, locationId),
          eq(demographicProjectLocations.orgId, orgId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Location not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete demographic location:', error);
      res.status(500).json({ error: 'Failed to delete demographic location' });
    }
  });

  // Get recent fuel transactions for detail panel
  app.get('/api/fuel/transactions/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fuelSales } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const transactions = await db
        .select({
          id: fuelSales.id,
          transactionDate: fuelSales.transactionDate,
          customerName: fuelSales.customerName,
          fuelType: fuelSales.fuelType,
          gallons: fuelSales.gallons,
          pricePerGallon: fuelSales.pricePerGallon,
          totalAmount: fuelSales.totalAmount,
          paymentMethod: fuelSales.paymentMethod,
          createdAt: fuelSales.createdAt,
        })
        .from(fuelSales)
        .where(eq(fuelSales.orgId, orgId))
        .orderBy(desc(fuelSales.transactionDate))
        .limit(20);

      res.json(transactions);
    } catch (error) {
      console.error('Failed to fetch recent fuel transactions:', error);
      res.status(500).json({ error: 'Failed to fetch recent fuel transactions' });
    }
  });

  // Get recent DockTalk articles for detail panel
  app.get('/api/docktalk/articles/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { docktalkArticles } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const articles = await db
        .select({
          id: docktalkArticles.id,
          title: docktalkArticles.title,
          publishedDate: docktalkArticles.publishedDate,
          category: docktalkArticles.category,
          sourceUrl: docktalkArticles.sourceUrl,
          createdAt: docktalkArticles.createdAt,
        })
        .from(docktalkArticles)
        .orderBy(desc(docktalkArticles.publishedDate))
        .limit(20);

      res.json(articles);
    } catch (error) {
      console.error('Failed to fetch recent DockTalk articles:', error);
      res.status(500).json({ error: 'Failed to fetch recent DockTalk articles' });
    }
  });

  // Get recent VDR documents for detail panel
  app.get('/api/vdr/documents/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { vdrDocuments, projects } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const documents = await db
        .select({
          id: vdrDocuments.id,
          fileName: vdrDocuments.fileName,
          fileSize: vdrDocuments.fileSize,
          uploadedBy: vdrDocuments.uploadedBy,
          projectId: vdrDocuments.vdrProjectId,
          projectName: projects.name,
          createdAt: vdrDocuments.createdAt,
        })
        .from(vdrDocuments)
        .innerJoin(projects, eq(vdrDocuments.vdrProjectId, projects.id))
        .where(eq(vdrDocuments.orgId, orgId))
        .orderBy(desc(vdrDocuments.createdAt))
        .limit(20);

      res.json(documents);
    } catch (error) {
      console.error('Failed to fetch recent VDR documents:', error);
      res.status(500).json({ error: 'Failed to fetch recent VDR documents' });
    }
  });

  // Get recent ship store transactions for detail panel
  app.get('/api/ship-store/transactions/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { shipStoreTransactions } = await import('@shared/schema');
      const { desc, eq } = await import('drizzle-orm');
      
      const transactions = await db
        .select({
          id: shipStoreTransactions.id,
          total: shipStoreTransactions.total,
          paymentMethod: shipStoreTransactions.paymentMethod,
          status: shipStoreTransactions.status,
          createdAt: shipStoreTransactions.createdAt,
        })
        .from(shipStoreTransactions)
        .where(eq(shipStoreTransactions.orgId, orgId))
        .orderBy(desc(shipStoreTransactions.createdAt))
        .limit(20);

      res.json(transactions);
    } catch (error) {
      console.error('Failed to fetch recent ship store transactions:', error);
      res.status(500).json({ error: 'Failed to fetch recent ship store transactions' });
    }
  });

  // Get recent due diligence tasks for detail panel
  app.get('/api/projects/tasks/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { tasks, projects } = await import('@shared/schema');
      const { desc, eq } = await import('drizzle-orm');
      
      const recentTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          dueDate: tasks.dueDate,
          projectId: tasks.projectId,
          projectName: projects.name,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(projects.orgId, orgId))
        .orderBy(desc(tasks.createdAt))
        .limit(20);

      res.json(recentTasks);
    } catch (error) {
      console.error('Failed to fetch recent DD tasks:', error);
      res.status(500).json({ error: 'Failed to fetch recent DD tasks' });
    }
  });

  // Get recent rent roll entries for detail panel
  app.get('/api/rent-roll/entries/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { rentRollEntries } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const entries = await db
        .select({
          id: rentRollEntries.id,
          unitNumber: rentRollEntries.unitNumber,
          tenantName: rentRollEntries.tenantName,
          monthlyRate: rentRollEntries.monthlyRate,
          status: rentRollEntries.status,
          leaseEndDate: rentRollEntries.leaseEndDate,
          createdAt: rentRollEntries.createdAt,
        })
        .from(rentRollEntries)
        .where(eq(rentRollEntries.orgId, orgId))
        .orderBy(desc(rentRollEntries.createdAt))
        .limit(20);

      res.json(entries);
    } catch (error) {
      console.error('Failed to fetch recent rent roll entries:', error);
      res.status(500).json({ error: 'Failed to fetch recent rent roll entries' });
    }
  });

  // Get recent modeling projects for detail panel
  app.get('/api/modeling/projects/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { modelingProjects } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const projects = await db
        .select({
          id: modelingProjects.id,
          propertyName: modelingProjects.propertyName,
          clientName: modelingProjects.clientName,
          projectType: modelingProjects.projectType,
          dealOutcome: modelingProjects.dealOutcome,
          estimatedValue: modelingProjects.estimatedValue,
          createdAt: modelingProjects.createdAt,
        })
        .from(modelingProjects)
        .where(eq(modelingProjects.orgId, orgId))
        .orderBy(desc(modelingProjects.createdAt))
        .limit(20);

      res.json(projects);
    } catch (error) {
      console.error('Failed to fetch recent modeling projects:', error);
      res.status(500).json({ error: 'Failed to fetch recent modeling projects' });
    }
  });

  // Custom Dashboard Modules CRUD
  // Get all custom modules for the user
  app.get('/api/dashboards/custom-modules', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dashboardCustomModules } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const modules = await db
        .select()
        .from(dashboardCustomModules)
        .where(eq(dashboardCustomModules.userId, userId))
        .orderBy(desc(dashboardCustomModules.displayOrder));

      res.json(modules);
    } catch (error) {
      console.error('Failed to fetch custom modules:', error);
      res.status(500).json({ error: 'Failed to fetch custom modules' });
    }
  });

  // Create a new custom module
  app.post('/api/dashboards/custom-modules', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { dashboardCustomModules, insertDashboardCustomModuleSchema } = await import('@shared/schema');
      
      const validated = insertDashboardCustomModuleSchema.parse({
        title: req.body.title,
        moduleType: req.body.moduleType,
        filters: req.body.filters || {},
        visualizationType: req.body.visualizationType || 'table',
        chartConfig: req.body.chartConfig || {},
        userId,
        orgId,
      });

      const [newModule] = await db
        .insert(dashboardCustomModules)
        .values(validated)
        .returning();

      res.json(newModule);
    } catch (error) {
      console.error('Failed to create custom module:', error);
      res.status(500).json({ error: 'Failed to create custom module' });
    }
  });

  // Update a custom module
  app.put('/api/dashboards/custom-modules/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const moduleId = req.params.id;
      const { dashboardCustomModules } = await import('@shared/schema');
      const { and } = await import('drizzle-orm');
      
      // Verify ownership
      const existing = await db
        .select()
        .from(dashboardCustomModules)
        .where(and(
          eq(dashboardCustomModules.id, moduleId),
          eq(dashboardCustomModules.userId, userId)
        ))
        .limit(1);

      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Custom module not found' });
      }

      const [updated] = await db
        .update(dashboardCustomModules)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(dashboardCustomModules.id, moduleId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Failed to update custom module:', error);
      res.status(500).json({ error: 'Failed to update custom module' });
    }
  });

  // Delete a custom module
  app.delete('/api/dashboards/custom-modules/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const moduleId = req.params.id;
      const { dashboardCustomModules } = await import('@shared/schema');
      const { and } = await import('drizzle-orm');
      
      // Verify ownership
      const existing = await db
        .select()
        .from(dashboardCustomModules)
        .where(and(
          eq(dashboardCustomModules.id, moduleId),
          eq(dashboardCustomModules.userId, userId)
        ))
        .limit(1);

      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Custom module not found' });
      }

      await db
        .delete(dashboardCustomModules)
        .where(eq(dashboardCustomModules.id, moduleId));

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete custom module:', error);
      res.status(500).json({ error: 'Failed to delete custom module' });
    }
  });

  // Get filtered data for custom module
  app.post('/api/dashboards/custom-modules/data', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { moduleType, filters, limit } = req.body;
      const { getFilteredModuleData } = await import('./services/custom-module-service');
      
      const data = await getFilteredModuleData({ moduleType, filters, limit }, orgId);
      res.json(data);
    } catch (error) {
      console.error('Failed to fetch custom module data:', error);
      res.status(500).json({ error: 'Failed to fetch custom module data' });
    }
  });

  // Generate preview data for custom module
  app.post('/api/dashboards/custom-modules/preview', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { visualizationType, moduleType, config } = req.body;
      const { dashboardService } = await import('./services/dashboard-service');
      
      const previewData = await dashboardService.generateModulePreview(
        orgId,
        visualizationType,
        moduleType,
        config
      );
      
      res.json(previewData);
    } catch (error) {
      console.error('Failed to generate preview data:', error);
      res.status(500).json({ error: 'Failed to generate preview data' });
    }
  });

  // Get user dashboard module preferences
  app.get('/api/dashboards/modules', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { users } = await import('@shared/schema');
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user || user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const config = user[0].dashboardConfig as any || {};
      const selectedModules = config.selectedModules || [];
      
      res.json({ selectedModules });
    } catch (error) {
      console.error('Failed to fetch dashboard modules:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard modules' });
    }
  });

  // Save user dashboard module preferences
  app.put('/api/dashboards/modules', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { selectedModules } = req.body;
      const { users } = await import('@shared/schema');

      if (!Array.isArray(selectedModules)) {
        return res.status(400).json({ error: 'selectedModules must be an array' });
      }

      // Validate module IDs
      const validModuleIds = [
        'crm-pipeline',
        'modeling-projects',
        'sales-comps',
        'rent-roll',
        'due-diligence',
        'vdr-activity',
        'docktalk-feed',
        'fuel-operations',
        'ship-store',
      ];

      const invalidModules = selectedModules.filter(id => !validModuleIds.includes(id));
      if (invalidModules.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid module IDs',
          invalidModules 
        });
      }

      await db.update(users)
        .set({ 
          dashboardConfig: sql`jsonb_set(COALESCE(dashboard_config, '{}'::jsonb), '{selectedModules}', ${JSON.stringify(selectedModules)}::jsonb)`
        })
        .where(eq(users.id, userId));

      res.json({ success: true, selectedModules });
    } catch (error) {
      console.error('Failed to save dashboard modules:', error);
      res.status(500).json({ error: 'Failed to save dashboard modules' });
    }
  });

  // ========================================================================
  // OWNED ASSETS & PORTFOLIO
  // ========================================================================

  // Get all owned assets
  app.get('/api/owned-assets', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        status: req.query.status,
        holdStrategy: req.query.holdStrategy,
        propertyId: req.query.propertyId,
      };
      const assets = await ownedAssetsService.getOwnedAssets(orgId, filters);
      res.json(assets);
    } catch (error) {
      console.error('Failed to fetch owned assets:', error);
      res.status(500).json({ error: 'Failed to fetch owned assets' });
    }
  });

  // Get owned asset by ID with details
  app.get('/api/owned-assets/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const asset = await ownedAssetsService.getOwnedAssetWithDetails(req.params.id, orgId);
      
      if (!asset) {
        return res.status(404).json({ error: 'Owned asset not found' });
      }
      
      res.json(asset);
    } catch (error) {
      console.error('Failed to fetch owned asset:', error);
      res.status(500).json({ error: 'Failed to fetch owned asset' });
    }
  });

  // Create owned asset
  app.post('/api/owned-assets', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const data = insertOwnedAssetSchema.parse(req.body);
      const asset = await ownedAssetsService.createOwnedAsset(orgId, userId, data);
      res.status(201).json(asset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create owned asset:', error);
      res.status(500).json({ error: 'Failed to create owned asset' });
    }
  });

  // Update owned asset
  app.patch('/api/owned-assets/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateOwnedAssetSchema.parse(req.body);
      const asset = await ownedAssetsService.updateOwnedAsset(req.params.id, orgId, data);
      
      if (!asset) {
        return res.status(404).json({ error: 'Owned asset not found' });
      }
      
      res.json(asset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update owned asset:', error);
      res.status(500).json({ error: 'Failed to update owned asset' });
    }
  });

  // Delete owned asset
  app.delete('/api/owned-assets/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await ownedAssetsService.deleteOwnedAsset(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Owned asset not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete owned asset:', error);
      res.status(500).json({ error: 'Failed to delete owned asset' });
    }
  });

  // Get asset performance metrics
  app.get('/api/owned-assets/:id/performance', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const performance = await ownedAssetsService.getAssetPerformance(req.params.id, orgId);
      
      if (!performance) {
        return res.status(404).json({ error: 'Owned asset not found' });
      }
      
      res.json(performance);
    } catch (error) {
      console.error('Failed to fetch asset performance:', error);
      res.status(500).json({ error: 'Failed to fetch asset performance' });
    }
  });

  // Get performance snapshots for an asset
  app.get('/api/owned-assets/:id/snapshots', authenticateUser, async (req: any, res) => {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      };
      const snapshots = await ownedAssetsService.getAssetPerformanceSnapshots(req.params.id, filters);
      res.json(snapshots);
    } catch (error) {
      console.error('Failed to fetch performance snapshots:', error);
      res.status(500).json({ error: 'Failed to fetch performance snapshots' });
    }
  });

  // Create performance snapshot
  app.post('/api/owned-assets/:id/snapshots', authenticateUser, async (req: any, res) => {
    try {
      const data = insertAssetPerformanceSnapshotSchema.parse(req.body);
      const snapshot = await ownedAssetsService.createPerformanceSnapshot(req.params.id, data);
      res.status(201).json(snapshot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create performance snapshot:', error);
      res.status(500).json({ error: 'Failed to create performance snapshot' });
    }
  });

  // Get portfolio summary
  app.get('/api/owned-assets/portfolio/summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const summary = await ownedAssetsService.getPortfolioSummary(orgId);
      res.json(summary);
    } catch (error) {
      console.error('Failed to fetch portfolio summary:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio summary' });
    }
  });

  // Convert deal to owned asset
  app.post('/api/owned-assets/convert-deal', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { propertyId, projectId, acquisitionPrice, acquisitionDate, holdStrategy } = req.body;
      
      if (!propertyId || !acquisitionDate) {
        return res.status(400).json({ error: 'propertyId and acquisitionDate are required' });
      }
      
      const asset = await ownedAssetsService.convertDealToOwnedAsset(orgId, userId, {
        propertyId,
        projectId,
        acquisitionPrice,
        acquisitionDate,
        holdStrategy,
      });
      
      res.status(201).json(asset);
    } catch (error) {
      console.error('Failed to convert deal to owned asset:', error);
      res.status(500).json({ error: 'Failed to convert deal to owned asset' });
    }
  });

  // Portfolio bulk creation routes
  app.post('/api/sales-comps/portfolios', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      // Validate request body using Zod schema
      const validatedData = bulkPortfolioCreateSchema.parse(req.body);
      const { portfolio, comps } = validatedData;

      // Wrap everything in a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Create portfolio first
        const [createdPortfolio] = await tx.insert(scPortfolios).values({
          orgId,
          createdBy: userId,
          name: portfolio.name,
          description: portfolio.description || null,
          notes: portfolio.notes || null,
        }).returning();

        // Create all comps and link to portfolio
        const createdComps = [];
        for (let i = 0; i < comps.length; i++) {
          const compData = comps[i];
          
          // Create the comp using compService (handles property linking, etc.)
          const comp = await compService.createComp({
            ...compData,
            orgId,
            createdBy: userId,
          }, userId);
          
          createdComps.push(comp);

          // Link comp to portfolio
          await tx.insert(scPortfolioComps).values({
            orgId,
            portfolioId: createdPortfolio.id,
            salesCompId: comp.id,
            addedBy: userId,
            orderIndex: i,
          });
        }

        return {
          portfolio: createdPortfolio,
          comps: createdComps,
        };
      });

      // Create audit log (outside transaction since it's not critical)
      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sc_portfolio',
        entityId: result.portfolio.id,
        action: 'create',
        after: {
          portfolio: result.portfolio,
          compCount: result.comps.length,
        },
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating portfolio:", error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create portfolio", error: error instanceof Error ? error.message : String(error) });
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
        entityType: 'sc_project',
        entityId: project.id,
        action: 'create',
        after: project,
      });

      // Auto-run recommendations and add matching comps if project has meaningful profile criteria
      let recommendations = null;
      let addedCount = 0;
      
      // Helper function to check if a value is meaningful
      const isMeaningfulValue = (value: any): boolean => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && !Array.isArray(value)) {
          // For objects, check if any nested value is meaningful
          return Object.values(value).some(isMeaningfulValue);
        }
        // Allow all other values including 0, false, etc.
        return true;
      };
      
      // Deep normalize profile by removing all undefined/null/empty values
      const normalizedProfile = project.profile ? 
        Object.fromEntries(
          Object.entries(project.profile)
            .filter(([_, value]) => isMeaningfulValue(value))
        ) : {};
      
      const hasValidCriteria = Object.keys(normalizedProfile).length > 0;
      
      if (hasValidCriteria) {
        try {
          const projectProfile = normalizedProfile as ProjectProfile;
          const userWeightOverrides = (project.weightOverrides as any) || undefined;
          
          recommendations = await recommendationService.getRecommendations({
            orgId,
            projectProfile,
            userWeightOverrides,
            limit: 50,
          });

          // Auto-add top 30 matching comps to the project
          if (recommendations && recommendations.items && recommendations.items.length > 0) {
            const topComps = recommendations.items.slice(0, 30);
            for (const rec of topComps) {
              try {
                await storage.addCompToScProject(
                  project.id,
                  rec.id,
                  orgId,
                  userId
                );
                addedCount++;
              } catch (addError: any) {
                // Skip duplicates or errors, continue adding others
                if (!addError.message?.includes('duplicate key')) {
                  console.error("Error auto-adding comp:", addError);
                }
              }
            }
          }
        } catch (recError) {
          console.error("Error generating recommendations for new SC project:", recError);
          // Don't fail project creation if recommendations fail
        }
      } else {
      }

      res.status(201).json({ project, recommendations, addedCount });
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
        entityType: 'sc_project',
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
        entityType: 'sc_project',
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
          entityType: 'sc_project_comp',
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
            entityType: 'sc_project_comp',
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
              entityType: 'sc_project_comp',
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
        entityType: 'sc_project_comp',
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
        entityType: 'sc_project_comp',
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

  app.post('/api/sc-projects/:id/auto-populate', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const projectId = req.params.id;
      
      const project = await storage.getScProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Get configuration from request body
      const limit = req.body.limit || 30;
      const minScore = req.body.minScore || 0.3; // Only add comps with score >= 0.3
      const useAI = req.body.useAI !== false; // Default to true, allow disabling
      
      // Get existing comps to exclude
      const projectComps = await storage.getScProjectComps(projectId, orgId);
      const excludeCompIds = projectComps.map(pc => pc.salesCompId);

      // Get recommendations from rule-based system
      const projectProfile = (project.profile as any) || {};
      const userWeightOverrides = (project.weightOverrides as any) || undefined;
      
      // Get larger candidate pool for AI to evaluate
      const candidateLimit = useAI && aiCompMatchingService.isEnabled() ? 100 : limit * 2;
      const recommendations = await recommendationService.getRecommendations({
        orgId,
        projectProfile,
        userWeightOverrides,
        excludeCompIds,
        limit: candidateLimit,
      });

      let topRecommendations = recommendations;
      let aiUsed = false;

      // Enhance with AI scoring if enabled
      if (useAI && aiCompMatchingService.isEnabled() && recommendations.length > 0) {
        try {
          // Take top 30 rule-based candidates for AI evaluation
          const aiCandidates = recommendations.slice(0, 30);
          
          const aiScores = await aiCompMatchingService.scoreComps(
            projectProfile,
            aiCandidates.map(r => r.comp),
            aiCandidates.map(r => ({ compId: r.comp.id, ruleBasedScore: r.score }))
          );

          if (aiScores && aiScores.scores.length > 0) {
            // Combine AI and rule-based scores
            const combinedRecs = aiCandidates.map(rec => {
              const aiScore = aiScores.scores.find(s => s.compId === rec.comp.id);
              if (aiScore) {
                // 60% AI, 40% rule-based
                const combinedScore = aiCompMatchingService.combineScores(rec.score, aiScore.aiScore, 0.6);
                return {
                  ...rec,
                  score: combinedScore,
                  aiScore: aiScore.aiScore,
                  aiRationale: aiScore.rationale,
                  aiKeyFactors: aiScore.keyFactors,
                  aiConfidence: aiScore.confidence,
                  ruleBasedScore: rec.score
                };
              }
              return rec;
            });

            // Re-sort by combined score
            combinedRecs.sort((a, b) => b.score - a.score);
            
            // Merge AI-enhanced top 30 with remaining rule-based candidates
            const remainingCandidates = recommendations.slice(30);
            topRecommendations = [...combinedRecs, ...remainingCandidates];
            topRecommendations.sort((a, b) => b.score - a.score);
            
            aiUsed = true;
          } else {
          }
        } catch (aiError) {
          console.error('AI scoring failed, falling back to rule-based only:', aiError);
          // Continue with rule-based scores
        }
      }

      // Filter by minimum score and take top N
      topRecommendations = topRecommendations
        .filter(rec => rec.score >= minScore)
        .slice(0, limit);

      // Auto-add to project
      let addedCount = 0;
      let skippedCount = 0;
      const addedComps = [];

      for (const rec of topRecommendations) {
        try {
          const projectComp = await storage.addCompToScProject(
            projectId,
            rec.comp.id,
            orgId,
            userId
          );
          addedComps.push({
            ...projectComp,
            score: rec.score,
            reasons: rec.reasons,
            ...(rec.aiScore !== undefined && {
              aiScore: rec.aiScore,
              aiRationale: rec.aiRationale,
              aiKeyFactors: rec.aiKeyFactors,
              aiConfidence: rec.aiConfidence,
              ruleBasedScore: rec.ruleBasedScore
            })
          });
          addedCount++;
        } catch (addError: any) {
          // Skip duplicates or errors
          if (addError.message?.includes('duplicate key')) {
            skippedCount++;
          } else {
            console.error("Error auto-adding comp:", addError);
          }
        }
      }

      res.json({
        success: true,
        addedCount,
        skippedCount,
        totalRecommendations: recommendations.length,
        addedComps,
        message: `Successfully added ${addedCount} comp${addedCount !== 1 ? 's' : ''} to project${skippedCount > 0 ? ` (${skippedCount} already in project)` : ''}`
      });
    } catch (error) {
      console.error("Error auto-populating SC project:", error);
      res.status(500).json({ message: "Failed to auto-populate project" });
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

  // ============ RATE COMPS API ROUTES ============

  // Rate Comps CRUD routes
  app.get('/api/rate-comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const filters = compFiltersSchema.parse(req.query);
      const sqlFilters = rcFilterBuilder.buildFilters(filters);
      
      const { comps, total } = await storage.getRateComps({
        orgId,
        filters: sqlFilters,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page: filters.page,
        pageSize: filters.pageSize,
      });

      res.json({ comps, total, page: filters.page, pageSize: filters.pageSize });
    } catch (error) {
      console.error("Error fetching rate comps:", error);
      res.status(500).json({ message: "Failed to fetch rate comps" });
    }
  });

  app.get('/api/rate-comps/ids', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const ids = await storage.getAllRateCompIds(orgId);
      res.json({ ids });
    } catch (error) {
      console.error('Error getting rate comp IDs:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/rate-comps/column-values/:column', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { column } = req.params;
      const values = await storage.getRateCompColumnUniqueValues(orgId, column);
      res.json({ values });
    } catch (error) {
      console.error('Error getting column values:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Custom Storage Types routes (must be before /:id route)
  app.get('/api/rate-comps/custom-storage-types', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const types = await storage.getRcCustomStorageTypes(orgId);
      res.json(types);
    } catch (error) {
      console.error("Error fetching custom storage types:", error);
      res.status(500).json({ message: "Failed to fetch custom storage types" });
    }
  });

  app.post('/api/rate-comps/custom-storage-types', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: "Storage type name is required" });
      }

      // Check for duplicates (case-insensitive)
      const existing = await storage.getRcCustomStorageTypes(orgId);
      if (existing.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
        return res.status(400).json({ message: "Storage type already exists" });
      }

      const type = await storage.createRcCustomStorageType({
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

  app.delete('/api/rate-comps/custom-storage-types/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteRcCustomStorageType(req.params.id, orgId);

      if (!success) return res.status(404).json({ message: "Storage type not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom storage type:", error);
      res.status(500).json({ message: "Failed to delete custom storage type" });
    }
  });

  // Custom Column Management routes (must be before /:id route)
  app.get('/api/rate-comps/columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const columns = await storage.getRateCompColumns(orgId);
      res.json(columns);
    } catch (error) {
      console.error("Error fetching custom columns:", error);
      res.status(500).json({ message: "Failed to fetch custom columns" });
    }
  });

  app.post('/api/rate-comps/columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { key, label, type, options, required, visible, orderIndex } = req.body;

      if (!key || !label || !type) {
        return res.status(400).json({ message: "Field key, label, and type are required" });
      }

      // Check for duplicate key
      const existing = await storage.getRateCompColumns(orgId);
      if (existing.some(c => c.key === key)) {
        return res.status(400).json({ message: "Column with this key already exists" });
      }

      const column = await storage.createRateCompColumn({
        orgId,
        key,
        label,
        type,
        options: options || null,
        required: required || false,
        visible: visible !== false,
        orderIndex: orderIndex || 0,
      });

      res.status(201).json(column);
    } catch (error) {
      console.error("Error creating custom column:", error);
      res.status(500).json({ message: "Failed to create custom column" });
    }
  });

  app.delete('/api/rate-comps/columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteRateCompColumn(req.params.id, orgId);

      if (!success) return res.status(404).json({ message: "Column not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom column:", error);
      res.status(500).json({ message: "Failed to delete custom column" });
    }
  });

  // Pending Property Profiles routes (must be before /:id route)
  app.get('/api/rate-comps/pending-property-profiles', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const status = req.query.status as string | undefined;
      const profiles = await storage.getRcPendingPropertyProfiles(orgId, status);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching pending property profiles:", error);
      res.status(500).json({ message: "Failed to fetch pending property profiles" });
    }
  });

  app.post('/api/rate-comps/pending-property-profiles', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { compId, status } = req.body;

      if (!compId) {
        return res.status(400).json({ message: "compId is required" });
      }

      const profile = await storage.createRcPendingPropertyProfile({
        compId,
        orgId,
        status: status || 'pending',
      });

      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating pending property profile:", error);
      res.status(500).json({ message: "Failed to create pending property profile" });
    }
  });

  app.patch('/api/rate-comps/pending-property-profiles/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.body;
      
      // Verify ownership before updating
      const existing = await storage.getRcPendingPropertyProfiles(orgId);
      const profile = existing.find(p => p.id === req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Pending property profile not found" });
      }
      
      const updated = await storage.updateRcPendingPropertyProfile(req.params.id, { status });
      res.json(updated);
    } catch (error) {
      console.error("Error updating pending property profile:", error);
      res.status(500).json({ message: "Failed to update pending property profile" });
    }
  });

  app.delete('/api/rate-comps/pending-property-profiles/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Verify ownership before deleting
      const existing = await storage.getRcPendingPropertyProfiles(orgId);
      const profile = existing.find(p => p.id === req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Pending property profile not found" });
      }
      
      const success = await storage.deleteRcPendingPropertyProfile(req.params.id);
      if (!success) return res.status(404).json({ message: "Pending property profile not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pending property profile:", error);
      res.status(500).json({ message: "Failed to delete pending property profile" });
    }
  });

  app.get('/api/rate-comps/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const comp = await storage.getRateComp(req.params.id, orgId);
      if (!comp) return res.status(404).json({ message: "Rate comp not found" });
      res.json(comp);
    } catch (error) {
      console.error("Error fetching rate comp:", error);
      res.status(500).json({ message: "Failed to fetch rate comp" });
    }
  });

  app.post('/api/rate-comps/backfill-properties', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      
      
      const result = await storage.getRateComps({ orgId, pageSize: 10000 });
      const comps = result.comps;
      const compsWithoutProperty = comps.filter(comp => !comp.propertyId && comp.marina);
      
      
      let created = 0;
      let matched = 0;
      let failed = 0;
      
      for (const comp of compsWithoutProperty) {
        try {
          let propertyId = null;
          
          const matchedProperty = await storage.findPropertyByLocation(
            orgId,
            comp.marina!,
            comp.city || undefined,
            comp.state || undefined
          );
          
          if (matchedProperty) {
            propertyId = matchedProperty.id;
            matched++;
          } else {
            const address = [
              comp.address,
              comp.city && comp.state ? `${comp.city}, ${comp.state}` : comp.city || comp.state
            ].filter(Boolean).join(', ');
            
            const newProperty = await storage.createCrmProperty({
              title: comp.marina!,
              type: 'marina',
              status: 'available',
              address: address || undefined,
              ownerId: orgId,
              listingPrice: comp.salePrice ? String(comp.salePrice) : undefined,
              description: `Auto-created from rate comp backfill`,
            });
            
            propertyId = newProperty.id;
            created++;
          }
          
          if (propertyId) {
            await storage.updateRateComp(comp.id, { propertyId }, orgId);
          }
        } catch (error) {
          failed++;
          console.error(`❌ Failed to process rate comp ${comp.id}:`, error);
        }
      }
      
      const summary = {
        total: compsWithoutProperty.length,
        propertiesCreated: created,
        propertiesMatched: matched,
        failed,
      };
      
      
      res.json(summary);
    } catch (error) {
      console.error("Error during property backfill:", error);
      res.status(500).json({ message: "Failed to backfill properties" });
    }
  });

  app.post('/api/rate-comps', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const compData = salesCompCreateSchema.parse(req.body);

      const comp = await rcCompService.createComp({
        ...compData,
        orgId,
        createdBy: userId,
      }, userId);

      res.status(201).json(comp);
    } catch (error) {
      console.error("Error creating rate comp:", error);
      res.status(500).json({ message: "Failed to create rate comp" });
    }
  });

  app.patch('/api/rate-comps/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const updates = salesCompUpdateSchema.parse(req.body);

      const comp = await rcCompService.updateComp(
        req.params.id,
        { ...updates, updatedBy: userId },
        orgId,
        userId
      );

      if (!comp) return res.status(404).json({ message: "Rate comp not found" });
      res.json(comp);
    } catch (error) {
      console.error("Error updating rate comp:", error);
      res.status(500).json({ message: "Failed to update rate comp" });
    }
  });

  app.delete('/api/rate-comps/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const success = await rcCompService.deleteComp(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Rate comp not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting rate comp:", error);
      res.status(500).json({ message: "Failed to delete rate comp" });
    }
  });

  app.post('/api/rate-comps/bulk-update', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { ids, updates } = bulkUpdateSchema.parse(req.body);
      const count = await rcCompService.bulkUpdateComps(ids, updates, orgId, userId);

      res.json({ updated: count });
    } catch (error) {
      console.error("Error bulk updating rate comps:", error);
      res.status(500).json({ message: "Failed to bulk update rate comps" });
    }
  });

  app.post('/api/rate-comps/bulk-delete', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      const count = await rcCompService.bulkDeleteComps(ids, orgId, userId);
      res.json({ deleted: count });
    } catch (error) {
      console.error("Error bulk deleting rate comps:", error);
      res.status(500).json({ message: "Failed to bulk delete rate comps" });
    }
  });

  // Geocoding endpoint
  app.post('/api/rate-comps/:id/geocode', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const comp = await storage.getRateCompById(id, orgId);
      if (!comp) {
        return res.status(404).json({ message: "Rate comp not found" });
      }

      const addressString = geocodingService.buildAddressString({
        marina: comp.marina,
        address: comp.address || undefined,
        city: comp.city || undefined,
        state: comp.state || undefined,
        zip: comp.zip || undefined,
      });

      if (!addressString) {
        return res.status(400).json({ message: "No address information available to geocode" });
      }

      const result = await geocodingService.geocodeAddress(addressString);

      if ('error' in result) {
        return res.status(400).json(result);
      }

      await rcCompService.updateComp(
        id,
        { 
          lat: result.lat.toString(),
          lng: result.lng.toString(),
          updatedBy: userId 
        },
        orgId,
        userId
      );

      res.json(result);
    } catch (error) {
      console.error("Error geocoding rate comp:", error);
      res.status(500).json({ message: "Failed to geocode rate comp" });
    }
  });

  // Upload and Import routes
  app.post('/api/rate-comps/upload', uploadRateComps.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const analysis = await rcParserService.analyzeFile(req.file);
      const fullData = await rcParserService.parseFullFile(req.file);
      
      
      const importRecord = await storage.createRateCompImport({
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
      console.error("Error uploading rate comp file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post('/api/rate-comps/import/:importId/detect-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { mapping, normalization } = req.body;
      
      const result = await rcCompService.detectDuplicates(
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

  app.post('/api/rate-comps/import/:importId/commit', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { mapping, normalization, excludedRows = [], parentPortfolioId } = req.body;
      
      
      const result = await rcCompService.processImport(
        req.params.importId,
        orgId,
        userId,
        mapping,
        normalization,
        excludedRows,
        parentPortfolioId
      );
      

      res.json(result);
    } catch (error) {
      console.error("Error processing rate comp import:", error);
      res.status(500).json({ message: "Failed to process import" });
    }
  });

  app.get('/api/rate-comps/import/:importId/status', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const importRecord = await storage.getRateCompImport(req.params.importId, orgId);
      if (!importRecord) return res.status(404).json({ message: "Import not found" });

      res.json(importRecord);
    } catch (error) {
      console.error("Error fetching import status:", error);
      res.status(500).json({ message: "Failed to fetch import status" });
    }
  });

  // Rate Comp Columns management routes
  app.get('/api/rc-columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const columns = await storage.getRateCompColumns(orgId);
      res.json(columns);
    } catch (error) {
      console.error("Error fetching rate comp columns:", error);
      res.status(500).json({ message: "Failed to fetch columns" });
    }
  });

  app.post('/api/rc-columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const columnData = compColumnCreateSchema.parse(req.body);
      const column = await storage.createRateCompColumn({
        ...columnData,
        orgId,
      });

      res.status(201).json(column);
    } catch (error) {
      console.error("Error creating rate comp column:", error);
      res.status(500).json({ message: "Failed to create column" });
    }
  });

  app.patch('/api/rc-columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const updates = compColumnUpdateSchema.parse(req.body);
      const column = await storage.updateRateCompColumn(req.params.id, updates, orgId);

      if (!column) return res.status(404).json({ message: "Column not found" });
      res.json(column);
    } catch (error) {
      console.error("Error updating rate comp column:", error);
      res.status(500).json({ message: "Failed to update column" });
    }
  });

  app.delete('/api/rc-columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const success = await storage.deleteRateCompColumn(req.params.id, orgId);
      if (!success) return res.status(404).json({ message: "Column not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting rate comp column:", error);
      res.status(500).json({ message: "Failed to delete column" });
    }
  });

  // Analytics endpoint
  app.post('/api/rate-comps/analytics', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: RcAnalyticsFilters = req.body;

      const metrics = await rcCalculateMetrics(orgId, filters);
      const insights = await rcGenerateInsights(metrics, filters);

      res.json({ metrics, insights });
    } catch (error) {
      console.error("Error calculating rate comp analytics:", error);
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  // Saved Searches routes
  app.get('/api/rc-saved-searches', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searches = await storage.getRcSavedSearches(orgId, userId);
      res.json(searches);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  app.get('/api/rc-saved-searches/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const search = await storage.getRcSavedSearch(req.params.id, orgId);
      if (!search) return res.status(404).json({ message: "Saved search not found" });

      res.json(search);
    } catch (error) {
      console.error("Error fetching saved search:", error);
      res.status(500).json({ message: "Failed to fetch saved search" });
    }
  });

  app.post('/api/rc-saved-searches', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searchData = insertScSavedSearchSchema.parse(req.body);
      const search = await storage.createRcSavedSearch({
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

  app.patch('/api/rc-saved-searches/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searchData = updateScSavedSearchSchema.parse(req.body);
      const search = await storage.updateRcSavedSearch(req.params.id, {
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

  app.delete('/api/rc-saved-searches/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const success = await storage.deleteRcSavedSearch(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Saved search not found" });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ message: "Failed to delete saved search" });
    }
  });

  app.post('/api/rc-saved-searches/:id/use', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      await storage.incrementRcSavedSearchUsage(req.params.id, orgId);
      res.status(204).send();
    } catch (error) {
      console.error("Error incrementing saved search usage:", error);
      res.status(500).json({ message: "Failed to update saved search usage" });
    }
  });

  // Pending Properties routes - Review queue for properties created from rate comps
  app.get('/api/rc-pending-properties', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.query;

      const pendingProps = await storage.getRcPendingProperties(orgId, status);
      res.json(pendingProps);
    } catch (error) {
      console.error("Error fetching pending properties:", error);
      res.status(500).json({ message: "Failed to fetch pending properties" });
    }
  });

  app.post('/api/rc-pending-properties/:id/accept', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const property = await storage.acceptRcPendingProperty(id, orgId, userId);
      if (!property) {
        return res.status(404).json({ message: "Pending property not found or already processed" });
      }

      res.json(property);
    } catch (error) {
      console.error("Error accepting pending property:", error);
      res.status(500).json({ message: "Failed to accept pending property" });
    }
  });

  app.post('/api/rc-pending-properties/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const success = await storage.rejectRcPendingProperty(id, orgId, userId);
      if (!success) {
        return res.status(404).json({ message: "Pending property not found or already processed" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error rejecting pending property:", error);
      res.status(500).json({ message: "Failed to reject pending property" });
    }
  });

  // Analytics/Metrics routes
  app.post('/api/rc-analytics/calculate', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: RcAnalyticsFilters = req.body.filters || {};

      const analysis = await rcCalculateMetrics(orgId, filters);
      const insights = await rcGenerateInsights(analysis, filters);

      res.json({
        analysis,
        insights,
      });
    } catch (error) {
      console.error("Error calculating rate comp analytics:", error);
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  app.post('/api/rc-analytics/insights', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: RcAnalyticsFilters = req.body.filters || {};

      const analysis = await rcCalculateMetrics(orgId, filters);
      const insights = await rcGenerateInsights(analysis, filters);

      res.json({ insights });
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // Portfolio bulk creation routes
  app.post('/api/rate-comps/portfolios', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      // Validate request body using Zod schema
      const validatedData = bulkPortfolioCreateSchema.parse(req.body);
      const { portfolio, comps } = validatedData;

      // Wrap everything in a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Create portfolio first
        const [createdPortfolio] = await tx.insert(scPortfolios).values({
          orgId,
          createdBy: userId,
          name: portfolio.name,
          description: portfolio.description || null,
          notes: portfolio.notes || null,
        }).returning();

        // Create all comps and link to portfolio
        const createdComps = [];
        for (let i = 0; i < comps.length; i++) {
          const compData = comps[i];
          
          // Create the comp using rcCompService (handles property linking, etc.)
          const comp = await rcCompService.createComp({
            ...compData,
            orgId,
            createdBy: userId,
          }, userId);
          
          createdComps.push(comp);

          // Link comp to portfolio
          await tx.insert(scPortfolioComps).values({
            orgId,
            portfolioId: createdPortfolio.id,
            salesCompId: comp.id,
            addedBy: userId,
            orderIndex: i,
          });
        }

        return {
          portfolio: createdPortfolio,
          comps: createdComps,
        };
      });

      // Create audit log (outside transaction since it's not critical)
      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_portfolio',
        entityId: result.portfolio.id,
        action: 'create',
        after: {
          portfolio: result.portfolio,
          compCount: result.comps.length,
        },
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating portfolio:", error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create portfolio", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // RC Projects routes
  app.get('/api/rc-projects', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projects = await storage.getRcProjects(orgId, userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching RC projects:", error);
      res.status(500).json({ message: "Failed to fetch RC projects" });
    }
  });

  app.get('/api/rc-projects/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      res.json(project);
    } catch (error) {
      console.error("Error fetching RC project:", error);
      res.status(500).json({ message: "Failed to fetch RC project" });
    }
  });

  app.post('/api/rc-projects', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projectData = scProjectCreateSchema.parse(req.body);
      const project = await storage.createRcProject({
        ...projectData,
        orgId,
        createdBy: userId,
      });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project',
        entityId: project.id,
        action: 'create',
        after: project,
      });

      // Auto-run recommendations and add matching comps if project has meaningful profile criteria
      let recommendations = null;
      let addedCount = 0;
      
      // Helper function to check if a value is meaningful
      const isMeaningfulValue = (value: any): boolean => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && !Array.isArray(value)) {
          // For objects, check if any nested value is meaningful
          return Object.values(value).some(isMeaningfulValue);
        }
        // Allow all other values including 0, false, etc.
        return true;
      };
      
      // Deep normalize profile by removing all undefined/null/empty values
      const normalizedProfile = project.profile ? 
        Object.fromEntries(
          Object.entries(project.profile)
            .filter(([_, value]) => isMeaningfulValue(value))
        ) : {};
      
      const hasValidCriteria = Object.keys(normalizedProfile).length > 0;
      
      if (hasValidCriteria) {
        try {
          const projectProfile = normalizedProfile as ProjectProfile;
          const userWeightOverrides = (project.weightOverrides as any) || undefined;
          
          recommendations = await rcRecommendationService.getRecommendations({
            orgId,
            projectProfile,
            userWeightOverrides,
            limit: 50,
          });

          // Auto-add top 30 matching comps to the project
          if (recommendations && recommendations.items && recommendations.items.length > 0) {
            const topComps = recommendations.items.slice(0, 30);
            for (const rec of topComps) {
              try {
                await storage.addCompToRcProject(
                  project.id,
                  rec.id,
                  orgId,
                  userId
                );
                addedCount++;
              } catch (addError: any) {
                // Skip duplicates or errors, continue adding others
                if (!addError.message?.includes('duplicate key')) {
                  console.error("Error auto-adding comp:", addError);
                }
              }
            }
          }
        } catch (recError) {
          console.error("Error generating recommendations for new RC project:", recError);
          // Don't fail project creation if recommendations fail
        }
      } else {
      }

      res.status(201).json({ project, recommendations, addedCount });
    } catch (error) {
      console.error("Error creating RC project:", error);
      res.status(500).json({ message: "Failed to create RC project" });
    }
  });

  app.put('/api/rc-projects/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const currentProject = await storage.getRcProject(req.params.id, orgId);
      if (!currentProject) return res.status(404).json({ message: "Project not found" });

      const updates = scProjectUpdateSchema.parse(req.body);
      const updatedProject = await storage.updateRcProject(req.params.id, {
        ...updates,
        updatedBy: userId,
      }, orgId);

      if (!updatedProject) return res.status(404).json({ message: "Project not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project',
        entityId: updatedProject.id,
        action: 'update',
        before: currentProject,
        after: updatedProject,
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating RC project:", error);
      res.status(500).json({ message: "Failed to update RC project" });
    }
  });

  app.delete('/api/rc-projects/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const currentProject = await storage.getRcProject(req.params.id, orgId);
      if (!currentProject) return res.status(404).json({ message: "Project not found" });

      const success = await storage.deleteRcProject(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Project not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project',
        entityId: req.params.id,
        action: 'delete',
        before: currentProject,
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting RC project:", error);
      res.status(500).json({ message: "Failed to delete RC project" });
    }
  });

  // RC Project Comps routes
  app.get('/api/rc-projects/:id/comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const projectComps = await storage.getRcProjectComps(req.params.id, orgId);
      res.json(projectComps);
    } catch (error) {
      console.error("Error fetching RC project comps:", error);
      res.status(500).json({ message: "Failed to fetch RC project comps" });
    }
  });

  app.post('/api/rc-projects/:id/comps', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const compData = projectCompCreateSchema.parse(req.body);
      
      try {
        const projectComp = await storage.addCompToRcProject(
          req.params.id,
          compData.salesCompId,
          orgId,
          userId
        );

        await storage.createAuditLog({
          orgId,
          userId,
          entityType: 'rc_project_comp',
          entityId: projectComp.id,
          action: 'create',
          after: projectComp,
        });

        res.status(201).json(projectComp);
      } catch (error: any) {
        if (error.message.includes('duplicate key value') || error.code === '23505') {
          return res.status(409).json({ message: "Rate comp is already added to this project" });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error adding comp to RC project:", error);
      res.status(500).json({ message: "Failed to add comp to RC project" });
    }
  });

  app.post('/api/rc-projects/:id/comps/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const bulkData = projectCompBulkSchema.parse(req.body);
      const results: { success: any[]; failed: any[] } = { success: [], failed: [] };

      for (const rateCompId of bulkData.salesCompIds) {
        try {
          const projectComp = await storage.addCompToRcProject(
            req.params.id,
            rateCompId,
            orgId,
            userId
          );

          await storage.createAuditLog({
            orgId,
            userId,
            entityType: 'rc_project_comp',
            entityId: projectComp.id,
            action: 'create',
            after: projectComp,
          });

          results.success.push({ rateCompId, projectComp });
        } catch (error: any) {
          results.failed.push({ 
            rateCompId, 
            error: error.message.includes('duplicate key') ? 'Already in project' : 'Failed to add' 
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error bulk adding comps to RC project:", error);
      res.status(500).json({ message: "Failed to bulk add comps to RC project" });
    }
  });

  app.delete('/api/rc-projects/:id/comps/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { compIds } = req.body;
      if (!Array.isArray(compIds) || compIds.length === 0) {
        return res.status(400).json({ message: "Invalid or empty comp IDs array" });
      }

      let removedCount = 0;
      for (const compId of compIds) {
        try {
          const success = await storage.removeCompFromRcProject(
            req.params.id,
            compId,
            orgId
          );
          
          if (success) {
            removedCount++;
            await storage.createAuditLog({
              orgId,
              userId,
              entityType: 'rc_project_comp',
              entityId: compId,
              action: 'delete',
              before: { projectId: req.params.id, rateCompId: compId },
            });
          }
        } catch (error) {
          console.error(`Error removing rate comp ${compId} from RC project:`, error);
        }
      }

      res.json({ removed: removedCount });
    } catch (error) {
      console.error("Error bulk removing comps from RC project:", error);
      res.status(500).json({ message: "Failed to bulk remove comps from RC project" });
    }
  });

  app.delete('/api/rc-projects/:id/comps/:compId', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const success = await storage.removeCompFromRcProject(
        req.params.id,
        req.params.compId,
        orgId
      );
      
      if (!success) return res.status(404).json({ message: "Comp not found in project" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project_comp',
        entityId: req.params.compId,
        action: 'delete',
        before: { projectId: req.params.id, rateCompId: req.params.compId },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error removing comp from RC project:", error);
      res.status(500).json({ message: "Failed to remove comp from RC project" });
    }
  });

  app.patch('/api/rc-projects/:id/comps/:compId', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const updates = projectCompUpdateSchema.parse(req.body);
      const updatedProjectComp = await storage.updateRcProjectComp(
        req.params.compId,
        updates,
        orgId
      );

      if (!updatedProjectComp) return res.status(404).json({ message: "Project comp not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project_comp',
        entityId: req.params.compId,
        action: 'update',
        after: updatedProjectComp,
      });

      res.json(updatedProjectComp);
    } catch (error) {
      console.error("Error updating RC project comp:", error);
      res.status(500).json({ message: "Failed to update RC project comp" });
    }
  });

  // Recommendations routes
  app.get('/api/rc-projects/:id/recommendations', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getRcProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const limit = parseInt(req.query.limit as string) || 50;
      const excludeAssigned = req.query.excludeAssigned === 'true';

      let excludeCompIds: string[] = [];
      if (excludeAssigned) {
        const projectComps = await storage.getRcProjectComps(projectId, orgId);
        excludeCompIds = projectComps.map(pc => pc.rateCompId);
      }

      const projectProfile = (project.profile as any) || {};
      const userWeightOverrides = (project.weightOverrides as any) || undefined;

      const recommendations = await rcRecommendationService.getRecommendations({
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

  app.get('/api/rc-projects/:id/preferences', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getRcProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      res.json({
        profile: project.profile || {},
        weightOverrides: project.weightOverrides || {},
      });
    } catch (error) {
      console.error("Error fetching RC project preferences:", error);
      res.status(500).json({ message: "Failed to fetch RC project preferences" });
    }
  });

  app.put('/api/rc-projects/:id/preferences', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getRcProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { profile, weightOverrides } = req.body;

      let validatedProfile, validatedWeights;
      
      try {
        validatedProfile = profile ? scProjectProfileSchema.parse(profile) : project.profile;
        validatedWeights = weightOverrides ? scWeightOverridesSchema.parse(weightOverrides) : project.weightOverrides;
      } catch (validationError: any) {
        console.error("Validation error in RC project preferences:", validationError);
        return res.status(400).json({ 
          message: "Invalid RC project preferences data", 
          details: validationError?.errors || validationError?.message 
        });
      }

      const updatedProject = await storage.updateRcProject(projectId, {
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
      console.error("Error updating RC project preferences:", error);
      res.status(500).json({ message: "Failed to update RC project preferences" });
    }
  });

  app.post('/api/rc-recommendations/feedback', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const feedbackData = insertScRecommendationFeedbackSchema.parse({
        ...req.body,
        orgId,
        userId,
      });

      const feedback = await storage.createRcRecommendationFeedback(feedbackData);

      if (['selected', 'rejected', 'liked'].includes(feedbackData.action)) {
        const project = await storage.getRcProject(feedbackData.projectId, orgId);
        const comp = await storage.getRateComp(feedbackData.salesCompId, orgId);
        
        if (project && comp) {
          const projectProfile = (project.profile as any) || {};
          
          let scoreBreakdown = req.body.breakdown;
          let currentScore = parseFloat(req.body.scoreAtTime) || 0;
          
          if (!scoreBreakdown) {
            const recommendations = await rcRecommendationService.getRecommendations({
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
            await rcRecommendationService.updateLearningWeights({
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
      console.error("Error submitting rate comp recommendation feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Google Maps API key endpoint
  app.get("/api/config/google-maps-key", (req, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || "" });
  });

  // ==================== OPERATIONS - FUEL SALES ROUTES ====================

  // Get all fuel sales for organization
  app.get("/api/operations/fuel-sales", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const sales = await db.query.fuelSales.findMany({
        where: eq(fuelSales.orgId, req.user!.orgId),
        orderBy: desc(fuelSales.transactionDate),
        with: {
          processedByUser: {
            columns: {
              id: true,
              name: true,
              email: true,
            }
          },
        },
      });
      res.json(sales);
    } catch (error) {
      console.error("Error fetching fuel sales:", error);
      res.status(500).json({ message: "Failed to fetch fuel sales" });
    }
  });

  // Create a new fuel sale
  app.post("/api/operations/fuel-sales", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const saleData = insertFuelSaleSchema.parse(req.body);
      const [sale] = await db.insert(fuelSales).values({
        ...saleData,
        orgId: req.user!.orgId,
      }).returning();

      await AuditService.logFuelTransaction(
        req,
        'create',
        sale.id,
        null,
        sale,
        { source: 'manual_entry' }
      );

      res.json(sale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel sale:", error);
      res.status(500).json({ message: "Failed to create fuel sale" });
    }
  });

  // Get a specific fuel sale
  app.get("/api/operations/fuel-sales/:id", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const sale = await db.query.fuelSales.findFirst({
        where: and(
          eq(fuelSales.id, req.params.id),
          eq(fuelSales.orgId, req.user!.orgId)
        ),
        with: {
          processedByUser: {
            columns: {
              id: true,
              name: true,
              email: true,
            }
          },
        },
      });

      if (!sale) {
        return res.status(404).json({ message: "Fuel sale not found" });
      }

      res.json(sale);
    } catch (error) {
      console.error("Error fetching fuel sale:", error);
      res.status(500).json({ message: "Failed to fetch fuel sale" });
    }
  });

  // Update a fuel sale
  app.patch("/api/operations/fuel-sales/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelSaleSchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelSales)
        .where(and(
          eq(fuelSales.id, req.params.id),
          eq(fuelSales.orgId, req.user!.orgId)
        ));

      if (!existing) {
        return res.status(404).json({ message: "Fuel sale not found" });
      }

      const [updated] = await db.update(fuelSales)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(fuelSales.id, req.params.id),
          eq(fuelSales.orgId, req.user!.orgId)
        ))
        .returning();

      await AuditService.logFuelTransaction(
        req,
        'update',
        req.params.id,
        existing,
        updated,
        { modifiedFields: Object.keys(updateData) }
      );

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel sale:", error);
      res.status(500).json({ message: "Failed to update fuel sale" });
    }
  });

  // Delete a fuel sale
  app.delete("/api/operations/fuel-sales/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelSales)
        .where(and(
          eq(fuelSales.id, req.params.id),
          eq(fuelSales.orgId, req.user!.orgId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel sale not found" });
      }

      await AuditService.logFuelTransaction(
        req,
        'delete',
        req.params.id,
        deleted,
        null,
        { deletionReason: req.body?.reason || 'Not specified' }
      );

      res.json({ message: "Fuel sale deleted successfully" });
    } catch (error) {
      console.error("Error deleting fuel sale:", error);
      res.status(500).json({ message: "Failed to delete fuel sale" });
    }
  });

  // Get fuel sales summary/stats
  app.get("/api/operations/fuel-sales/stats/summary", authenticateUser, requirePermission('fuel:read', 'analytics:read'), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let conditions = [eq(fuelSales.orgId, req.user!.orgId)];
      
      if (startDate) {
        conditions.push(gte(fuelSales.transactionDate, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(fuelSales.transactionDate, new Date(endDate as string)));
      }

      const sales = await db.query.fuelSales.findMany({
        where: and(...conditions),
      });

      const stats = {
        totalSales: sales.length,
        totalRevenue: sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
        totalGallons: sales.reduce((sum, sale) => sum + Number(sale.quantityGallons), 0),
        byFuelType: sales.reduce((acc: Record<string, any>, sale) => {
          if (!acc[sale.fuelType]) {
            acc[sale.fuelType] = {
              count: 0,
              gallons: 0,
              revenue: 0,
            };
          }
          acc[sale.fuelType].count++;
          acc[sale.fuelType].gallons += Number(sale.quantityGallons);
          acc[sale.fuelType].revenue += Number(sale.totalAmount);
          return acc;
        }, {}),
        byPaymentMethod: sales.reduce((acc: Record<string, number>, sale) => {
          if (sale.paymentMethod) {
            acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + 1;
          }
          return acc;
        }, {}),
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching fuel sales stats:", error);
      res.status(500).json({ message: "Failed to fetch fuel sales stats" });
    }
  });

  // Import fuel sales from CSV
  app.post("/api/operations/fuel-sales/import-csv", authenticateUser, requirePermission('fuel:import'), async (req, res) => {
    const startTime = new Date();
    const errorLog: string[] = [];
    let recordsProcessed = 0;
    let recordsImported = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;

    try {
      const { data } = req.body;
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ message: "Invalid request: 'data' array is required" });
      }

      recordsProcessed = data.length;

      // Check for duplicates within the CSV data
      const seen = new Set<string>();
      const duplicateIndices = new Set<number>();

      data.forEach((row, index) => {
        const duplicateKey = `${row.transactionDate}|${row.customerName || ''}|${row.quantityGallons}`;
        if (seen.has(duplicateKey)) {
          duplicateIndices.add(index);
        }
        seen.add(duplicateKey);
      });

      // Process each row
      const importPromises = data.map(async (row, index) => {
        try {
          // Skip duplicates
          if (duplicateIndices.has(index)) {
            recordsSkipped++;
            return null;
          }

          // Validate and insert
          const saleData = insertFuelSaleSchema.parse({
            transactionDate: new Date(row.transactionDate),
            fuelType: row.fuelType,
            quantityGallons: row.quantityGallons,
            pricePerGallon: row.pricePerGallon,
            totalAmount: row.totalAmount,
            customerName: row.customerName || null,
            boatName: row.boatName || null,
            slipNumber: row.slipNumber || null,
            paymentMethod: row.paymentMethod || null,
            processedBy: req.user!.id,
            notes: row.notes || null,
          });

          const [sale] = await db.insert(fuelSales).values({
            ...saleData,
            orgId: req.user!.orgId,
          }).returning();

          recordsImported++;
          return sale;
        } catch (error: any) {
          recordsFailed++;
          errorLog.push(`Row ${index + 1}: ${error.message}`);
          return null;
        }
      });

      await Promise.all(importPromises);

      // Create import log
      await db.insert(fuelImportLogs).values({
        orgId: req.user!.orgId,
        source: 'csv_upload',
        importType: 'manual_upload',
        status: recordsFailed > 0 ? 'partial' : 'completed',
        recordsProcessed,
        recordsImported,
        recordsSkipped,
        recordsFailed,
        errorLog: errorLog,
        importData: {
          fileName: 'manual_csv_upload',
          totalRows: recordsProcessed,
        },
        startedAt: startTime,
        completedAt: new Date(),
        createdBy: req.user!.id,
      });

      // Audit log the import
      await AuditService.logFuelTransaction(
        req,
        'import',
        null,
        null,
        null,
        { 
          source: 'csv_upload',
          recordsProcessed,
          recordsImported,
          recordsSkipped,
          recordsFailed,
          status: recordsFailed > 0 ? 'partial' : 'completed',
          duration: new Date().getTime() - startTime.getTime()
        }
      );

      res.json({
        imported: recordsImported,
        skipped: recordsSkipped,
        errors: errorLog,
      });
    } catch (error: any) {
      console.error("Error importing fuel sales:", error);
      
      // Log failed import
      try {
        await db.insert(fuelImportLogs).values({
          orgId: req.user!.orgId,
          source: 'csv_upload',
          importType: 'manual_upload',
          status: 'failed',
          recordsProcessed,
          recordsImported,
          recordsSkipped,
          recordsFailed,
          errorLog: [...errorLog, error.message],
          importData: {},
          startedAt: startTime,
          completedAt: new Date(),
          createdBy: req.user!.id,
        });
      } catch (logError) {
        console.error("Error creating import log:", logError);
      }

      res.status(500).json({ message: "Failed to import fuel sales", error: error.message });
    }
  });

  // ==================== OPERATIONS - FUEL TYPES ROUTES ====================

  // Get all fuel types for organization
  app.get("/api/operations/fuel-types", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const types = await db.query.fuelTypes.findMany({
        where: eq(fuelTypes.orgId, req.user!.orgId),
        orderBy: [fuelTypes.category, fuelTypes.name],
      });
      res.json(types);
    } catch (error) {
      console.error("Error fetching fuel types:", error);
      res.status(500).json({ message: "Failed to fetch fuel types" });
    }
  });

  // Create a new fuel type
  app.post("/api/operations/fuel-types", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const typeData = insertFuelTypeSchema.parse(req.body);
      const [type] = await db.insert(fuelTypes).values({
        ...typeData,
        orgId: req.user!.orgId,
      }).returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'create',
        entityType: 'fuel_type',
        entityId: type.id,
        action: 'Create fuel type',
        afterData: type,
        metadata: { name: type.name, category: type.category },
        isSuccess: true,
      });

      res.json(type);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel type:", error);
      res.status(500).json({ message: "Failed to create fuel type" });
    }
  });

  // Update a fuel type
  app.patch("/api/operations/fuel-types/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelTypeSchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelTypes)
        .where(and(eq(fuelTypes.id, req.params.id), eq(fuelTypes.orgId, req.user!.orgId)));

      if (!existing) {
        return res.status(404).json({ message: "Fuel type not found" });
      }

      const [updated] = await db.update(fuelTypes)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(fuelTypes.id, req.params.id), eq(fuelTypes.orgId, req.user!.orgId)))
        .returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'update',
        entityType: 'fuel_type',
        entityId: req.params.id,
        action: 'Update fuel type',
        beforeData: existing,
        afterData: updated,
        metadata: { modifiedFields: Object.keys(updateData) },
        isSuccess: true,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel type:", error);
      res.status(500).json({ message: "Failed to update fuel type" });
    }
  });

  // Delete a fuel type
  app.delete("/api/operations/fuel-types/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelTypes)
        .where(and(eq(fuelTypes.id, req.params.id), eq(fuelTypes.orgId, req.user!.orgId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel type not found" });
      }

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'delete',
        entityType: 'fuel_type',
        entityId: req.params.id,
        action: 'Delete fuel type',
        beforeData: deleted,
        metadata: { deletionReason: req.body?.reason || 'Not specified' },
        isSuccess: true,
      });

      res.json({ message: "Fuel type deleted successfully" });
    } catch (error) {
      console.error("Error deleting fuel type:", error);
      res.status(500).json({ message: "Failed to delete fuel type" });
    }
  });

  // ==================== OPERATIONS - FUEL INVENTORY ROUTES ====================

  // Get all fuel inventory for organization
  app.get("/api/operations/fuel-inventory", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const inventory = await db.query.fuelInventory.findMany({
        where: eq(fuelInventory.orgId, req.user!.orgId),
        with: {
          fuelType: true,
        },
      });
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching fuel inventory:", error);
      res.status(500).json({ message: "Failed to fetch fuel inventory" });
    }
  });

  // Create a new fuel inventory record
  app.post("/api/operations/fuel-inventory", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const inventoryData = insertFuelInventorySchema.parse(req.body);
      const [inventory] = await db.insert(fuelInventory).values({
        ...inventoryData,
        orgId: req.user!.orgId,
      }).returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'create',
        entityType: 'fuel_inventory',
        entityId: inventory.id,
        action: 'Create fuel inventory',
        afterData: inventory,
        metadata: { fuelTypeId: inventory.fuelTypeId, location: inventory.location },
        isSuccess: true,
      });

      res.json(inventory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel inventory:", error);
      res.status(500).json({ message: "Failed to create fuel inventory" });
    }
  });

  // Update fuel inventory
  app.patch("/api/operations/fuel-inventory/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelInventorySchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelInventory)
        .where(and(eq(fuelInventory.id, req.params.id), eq(fuelInventory.orgId, req.user!.orgId)));

      if (!existing) {
        return res.status(404).json({ message: "Fuel inventory not found" });
      }

      const [updated] = await db.update(fuelInventory)
        .set({ ...updateData, lastUpdated: new Date() })
        .where(and(eq(fuelInventory.id, req.params.id), eq(fuelInventory.orgId, req.user!.orgId)))
        .returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'update',
        entityType: 'fuel_inventory',
        entityId: req.params.id,
        action: 'Update fuel inventory',
        beforeData: existing,
        afterData: updated,
        metadata: { modifiedFields: Object.keys(updateData) },
        isSuccess: true,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel inventory:", error);
      res.status(500).json({ message: "Failed to update fuel inventory" });
    }
  });

  // Delete fuel inventory
  app.delete("/api/operations/fuel-inventory/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelInventory)
        .where(and(eq(fuelInventory.id, req.params.id), eq(fuelInventory.orgId, req.user!.orgId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel inventory not found" });
      }

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'delete',
        entityType: 'fuel_inventory',
        entityId: req.params.id,
        action: 'Delete fuel inventory',
        beforeData: deleted,
        metadata: { deletionReason: req.body?.reason || 'Not specified' },
        isSuccess: true,
      });

      res.json({ message: "Fuel inventory deleted successfully" });
    } catch (error) {
      console.error("Error deleting fuel inventory:", error);
      res.status(500).json({ message: "Failed to delete fuel inventory" });
    }
  });

  // ==================== OPERATIONS - FUEL DELIVERIES ROUTES ====================

  // Get all fuel deliveries for organization
  app.get("/api/operations/fuel-deliveries", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const deliveries = await db.query.fuelDeliveries.findMany({
        where: eq(fuelDeliveries.orgId, req.user!.orgId),
        orderBy: desc(fuelDeliveries.deliveryDate),
        with: {
          fuelType: true,
        },
      });
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching fuel deliveries:", error);
      res.status(500).json({ message: "Failed to fetch fuel deliveries" });
    }
  });

  // Create a new fuel delivery
  app.post("/api/operations/fuel-deliveries", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const deliveryData = insertFuelDeliverySchema.parse(req.body);
      const [delivery] = await db.insert(fuelDeliveries).values({
        ...deliveryData,
        orgId: req.user!.orgId,
      }).returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'create',
        entityType: 'fuel_delivery',
        entityId: delivery.id,
        action: 'Create fuel delivery',
        afterData: delivery,
        metadata: { fuelTypeId: delivery.fuelTypeId, quantity: delivery.quantity },
        isSuccess: true,
      });

      res.json(delivery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel delivery:", error);
      res.status(500).json({ message: "Failed to create fuel delivery" });
    }
  });

  // Update a fuel delivery
  app.patch("/api/operations/fuel-deliveries/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelDeliverySchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelDeliveries)
        .where(and(eq(fuelDeliveries.id, req.params.id), eq(fuelDeliveries.orgId, req.user!.orgId)));

      if (!existing) {
        return res.status(404).json({ message: "Fuel delivery not found" });
      }

      const [updated] = await db.update(fuelDeliveries)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(fuelDeliveries.id, req.params.id), eq(fuelDeliveries.orgId, req.user!.orgId)))
        .returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'update',
        entityType: 'fuel_delivery',
        entityId: req.params.id,
        action: 'Update fuel delivery',
        beforeData: existing,
        afterData: updated,
        metadata: { modifiedFields: Object.keys(updateData) },
        isSuccess: true,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel delivery:", error);
      res.status(500).json({ message: "Failed to update fuel delivery" });
    }
  });

  // Delete a fuel delivery
  app.delete("/api/operations/fuel-deliveries/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelDeliveries)
        .where(and(eq(fuelDeliveries.id, req.params.id), eq(fuelDeliveries.orgId, req.user!.orgId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel delivery not found" });
      }

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'delete',
        entityType: 'fuel_delivery',
        entityId: req.params.id,
        action: 'Delete fuel delivery',
        beforeData: deleted,
        metadata: { deletionReason: req.body?.reason || 'Not specified' },
        isSuccess: true,
      });

      res.json({ message: "Fuel delivery deleted successfully" });
    } catch (error) {
      console.error("Error deleting fuel delivery:", error);
      res.status(500).json({ message: "Failed to delete fuel delivery" });
    }
  });

  // ==================== OPERATIONS - FUEL PROJECTIONS ROUTES ====================

  // Get all fuel financial projections for organization
  app.get("/api/operations/fuel-projections", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const projections = await db.query.fuelFinancialProjections.findMany({
        where: eq(fuelFinancialProjections.orgId, req.user!.orgId),
        orderBy: [fuelFinancialProjections.year, fuelFinancialProjections.month],
      });
      res.json(projections);
    } catch (error) {
      console.error("Error fetching fuel projections:", error);
      res.status(500).json({ message: "Failed to fetch fuel projections" });
    }
  });

  // Create a new fuel projection
  app.post("/api/operations/fuel-projections", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const projectionData = insertFuelProjectionSchema.parse(req.body);
      const [projection] = await db.insert(fuelFinancialProjections).values({
        ...projectionData,
        orgId: req.user!.orgId,
      }).returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'create',
        entityType: 'fuel_projection',
        entityId: projection.id,
        action: 'Create fuel projection',
        afterData: projection,
        metadata: { year: projection.year, month: projection.month },
        isSuccess: true,
      });

      res.json(projection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel projection:", error);
      res.status(500).json({ message: "Failed to create fuel projection" });
    }
  });

  // Update a fuel projection
  app.patch("/api/operations/fuel-projections/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelProjectionSchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelFinancialProjections)
        .where(and(eq(fuelFinancialProjections.id, req.params.id), eq(fuelFinancialProjections.orgId, req.user!.orgId)));

      if (!existing) {
        return res.status(404).json({ message: "Fuel projection not found" });
      }

      const [updated] = await db.update(fuelFinancialProjections)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(fuelFinancialProjections.id, req.params.id), eq(fuelFinancialProjections.orgId, req.user!.orgId)))
        .returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'update',
        entityType: 'fuel_projection',
        entityId: req.params.id,
        action: 'Update fuel projection',
        beforeData: existing,
        afterData: updated,
        metadata: { modifiedFields: Object.keys(updateData) },
        isSuccess: true,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel projection:", error);
      res.status(500).json({ message: "Failed to update fuel projection" });
    }
  });

  // Delete a fuel projection
  app.delete("/api/operations/fuel-projections/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelFinancialProjections)
        .where(and(eq(fuelFinancialProjections.id, req.params.id), eq(fuelFinancialProjections.orgId, req.user!.orgId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel projection not found" });
      }

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'delete',
        entityType: 'fuel_projection',
        entityId: req.params.id,
        action: 'Delete fuel projection',
        beforeData: deleted,
        metadata: { deletionReason: req.body?.reason || 'Not specified' },
        isSuccess: true,
      });

      res.json({ message: "Fuel projection deleted successfully" });
    } catch (error) {
      console.error("Error deleting fuel projection:", error);
      res.status(500).json({ message: "Failed to delete fuel projection" });
    }
  });

  // ==================== OPERATIONS - FUEL IMPORT LOGS ROUTES ====================

  // Get all fuel import logs for organization with filters
  app.get("/api/operations/fuel-import-logs", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const { startDate, endDate, source, status, limit = '100', offset = '0' } = req.query;
      
      let query = db.select()
        .from(fuelImportLogs)
        .where(eq(fuelImportLogs.orgId, req.user!.orgId))
        .$dynamic();

      // Apply filters
      const conditions = [eq(fuelImportLogs.orgId, req.user!.orgId)];
      
      if (startDate) {
        conditions.push(gte(fuelImportLogs.startedAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(fuelImportLogs.startedAt, new Date(endDate as string)));
      }
      if (source) {
        conditions.push(eq(fuelImportLogs.source, source as string));
      }
      if (status) {
        conditions.push(eq(fuelImportLogs.status, status as string));
      }

      const logs = await db.select()
        .from(fuelImportLogs)
        .where(and(...conditions))
        .orderBy(desc(fuelImportLogs.startedAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json(logs);
    } catch (error) {
      console.error("Error fetching fuel import logs:", error);
      res.status(500).json({ message: "Failed to fetch fuel import logs" });
    }
  });

  // Get a single fuel import log by ID
  app.get("/api/operations/fuel-import-logs/:id", authenticateUser, async (req, res) => {
    try {
      const [log] = await db.select()
        .from(fuelImportLogs)
        .where(and(
          eq(fuelImportLogs.id, req.params.id),
          eq(fuelImportLogs.orgId, req.user!.orgId)
        ));

      if (!log) {
        return res.status(404).json({ message: "Import log not found" });
      }

      res.json(log);
    } catch (error) {
      console.error("Error fetching fuel import log:", error);
      res.status(500).json({ message: "Failed to fetch fuel import log" });
    }
  });

  // Get fuel import logs statistics
  app.get("/api/operations/fuel-import-logs/stats", authenticateUser, async (req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all logs from last 30 days
      const logs = await db.select()
        .from(fuelImportLogs)
        .where(and(
          eq(fuelImportLogs.orgId, req.user!.orgId),
          gte(fuelImportLogs.startedAt, thirtyDaysAgo)
        ));

      // Get latest log
      const [latestLog] = await db.select()
        .from(fuelImportLogs)
        .where(eq(fuelImportLogs.orgId, req.user!.orgId))
        .orderBy(desc(fuelImportLogs.startedAt))
        .limit(1);

      const totalImports = logs.length;
      const successfulImports = logs.filter(l => l.status === 'completed').length;
      const successRate = totalImports > 0 ? (successfulImports / totalImports) * 100 : 0;
      const totalRecordsImported = logs.reduce((sum, l) => sum + (l.recordsImported || 0), 0);

      res.json({
        totalImports,
        successRate: Math.round(successRate * 10) / 10,
        totalRecordsImported,
        latestSyncStatus: latestLog?.status || null,
        latestSyncTime: latestLog?.startedAt || null,
      });
    } catch (error) {
      console.error("Error fetching fuel import log stats:", error);
      res.status(500).json({ message: "Failed to fetch fuel import log statistics" });
    }
  });

  // ===== Fuel Integrations Routes =====

  app.use("/api/operations/fuel-integrations", authenticateUser);

  // Get organization's fuel integration settings
  app.get("/api/operations/fuel-integrations", requirePermission('fuel:read'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegration(req.user.orgId);
      
      if (!integration) {
        return res.json(null);
      }
      
      res.json(integration);
    } catch (error) {
      console.error("Error fetching fuel integration:", error);
      res.status(500).json({ message: "Failed to fetch fuel integration" });
    }
  });

  // Get fuel import logs for org
  app.get("/api/operations/fuel-integrations/import-logs", async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const logs = await storage.getFuelImportLogs(req.user.orgId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching fuel import logs:", error);
      res.status(500).json({ message: "Failed to fetch import logs" });
    }
  });

  // Create new fuel integration
  app.post("/api/operations/fuel-integrations", requirePermission('fuel:integration:manage'), async (req: any, res) => {
    try {
      const data = insertFuelIntegrationSchema.parse({
        ...req.body,
        orgId: req.user.orgId
      });

      const existing = await storage.getFuelIntegration(req.user.orgId);
      if (existing) {
        return res.status(400).json({ 
          message: "Integration already exists for this organization. Please update or delete the existing integration first." 
        });
      }

      const integration = await storage.createFuelIntegration(data);

      // Add audit logging using logFuelIntegration
      await AuditService.logFuelIntegration(
        req,
        'create',
        integration.id,
        null,
        integration,
        { provider: integration.provider }
      );

      res.status(201).json(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel integration:", error);
      res.status(500).json({ message: "Failed to create fuel integration" });
    }
  });

  // Update fuel integration settings
  app.patch("/api/operations/fuel-integrations/:id", requirePermission('fuel:integration:manage'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegrationById(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      if (integration.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updateData = updateFuelIntegrationSchema.parse(req.body);
      const updated = await storage.updateFuelIntegration(req.params.id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Integration not found" });
      }

      // Add audit logging using logFuelIntegration
      await AuditService.logFuelIntegration(
        req,
        'update',
        updated.id,
        integration,
        updated,
        { provider: updated.provider, modifiedFields: Object.keys(updateData) }
      );

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel integration:", error);
      res.status(500).json({ message: "Failed to update fuel integration" });
    }
  });

  // Delete fuel integration
  app.delete("/api/operations/fuel-integrations/:id", requirePermission('fuel:integration:manage'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegrationById(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      if (integration.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const deleted = await storage.deleteFuelIntegration(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: "Integration not found" });
      }

      // Add audit logging using logFuelIntegration
      await AuditService.logFuelIntegration(
        req,
        'delete',
        integration.id,
        integration,
        null,
        { provider: integration.provider, deletionReason: req.body?.reason || 'Not specified' }
      );

      res.json({ message: "Integration disconnected successfully" });
    } catch (error) {
      console.error("Error deleting fuel integration:", error);
      res.status(500).json({ message: "Failed to disconnect integration" });
    }
  });

  // Test fuel integration connection
  app.post("/api/operations/fuel-integrations/:id/test", requirePermission('fuel:integration:manage'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegrationById(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      if (integration.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const fuelSyncService = new FuelSyncService(storage);
      const result = await fuelSyncService.testConnection(req.params.id);

      res.json({ 
        ...result,
        provider: integration.provider,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error testing fuel integration:", error);
      res.status(500).json({ 
        success: false,
        message: "Connection test failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Trigger manual sync
  app.post("/api/operations/fuel-integrations/:id/sync", requirePermission('fuel:integration:manage'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegrationById(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      if (integration.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Add audit logging using logFuelIntegration
      await AuditService.logFuelIntegration(
        req,
        'sync',
        integration.id,
        null,
        null,
        { provider: integration.provider, syncInitiated: true }
      );

      // Start sync asynchronously - don't wait for completion
      const fuelSyncService = new FuelSyncService(storage);
      
      // Run sync in background
      fuelSyncService.syncIntegration(integration.id, req.user.id)
        .then(result => {
        })
        .catch(error => {
          console.error('Sync failed:', error);
        });

      res.json({ 
        success: true,
        message: "Sync initiated successfully. Check Import History for progress."
      });
    } catch (error) {
      console.error("Error initiating fuel sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to initiate sync",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ===== FRED API Routes (Financial Benchmarks) =====

  // Get current and historical FRED data
  app.get("/api/benchmarks/fred/:seriesId", authenticateUser, async (req: any, res) => {
    try {
      const { seriesId } = req.params;
      const { startDate } = req.query;

      const FRED_API_KEY = process.env.FRED_API_KEY;
      if (!FRED_API_KEY) {
        return res.status(500).json({ error: "FRED API key not configured" });
      }

      const baseUrl = 'https://api.stlouisfed.org/fred';
      const params = new URLSearchParams({
        series_id: seriesId,
        api_key: FRED_API_KEY,
        file_type: 'json',
        sort_order: 'asc'
      });

      if (startDate) {
        params.append('observation_start', startDate);
      }

      const response = await fetch(`${baseUrl}/series/observations?${params}`);
      
      if (!response.ok) {
        throw new Error(`FRED API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching FRED data:", error);
      res.status(500).json({ error: "Failed to fetch FRED data" });
    }
  });

  // ===== QuickBooks Export Routes =====

  // Preview QuickBooks export data
  app.post("/api/operations/fuel-sales/export-quickbooks/preview", authenticateUser, requirePermission('fuel:export'), async (req: any, res) => {
    try {
      const { startDate, endDate, accountMappings, format } = req.body;

      if (!startDate || !endDate || !accountMappings) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const sales = await db.select()
        .from(fuelSales)
        .where(
          and(
            eq(fuelSales.orgId, req.user.orgId),
            and(
              gte(fuelSales.transactionDate, new Date(startDate)),
              lte(fuelSales.transactionDate, new Date(endDate + 'T23:59:59'))
            )
          )
        )
        .orderBy(fuelSales.transactionDate);

      const preview = generateQuickBooksPreview(sales, accountMappings, format);
      res.json({ preview: preview.slice(0, 10) });
    } catch (error) {
      console.error("Error generating QuickBooks preview:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // Export QuickBooks CSV
  app.post("/api/operations/fuel-sales/export-quickbooks", authenticateUser, requirePermission('fuel:export'), async (req: any, res) => {
    try {
      const { startDate, endDate, accountMappings, format, saveSettings } = req.body;

      if (!startDate || !endDate || !accountMappings) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const sales = await db.select()
        .from(fuelSales)
        .where(
          and(
            eq(fuelSales.orgId, req.user.orgId),
            and(
              gte(fuelSales.transactionDate, new Date(startDate)),
              lte(fuelSales.transactionDate, new Date(endDate + 'T23:59:59'))
            )
          )
        )
        .orderBy(fuelSales.transactionDate);

      if (sales.length === 0) {
        return res.status(404).json({ error: "No sales data found for the selected date range" });
      }

      if (saveSettings) {
        const existingIntegration = await storage.getFuelIntegration(req.user.orgId);
        
        if (existingIntegration) {
          await storage.updateFuelIntegration(existingIntegration.id, {
            settings: {
              ...existingIntegration.settings,
              accountMappings
            }
          });
        } else {
          await storage.createFuelIntegration({
            orgId: req.user.orgId,
            provider: 'quickbooks',
            isEnabled: true,
            settings: { accountMappings }
          });
        }
      }

      const csv = generateQuickBooksCSV(sales, accountMappings, format);
      const filename = `fuel-sales-quickbooks-${new Date().toISOString().split('T')[0]}.csv`;

      // Audit log the export
      await AuditService.logExport(
        req,
        'quickbooks',
        sales.length,
        { startDate, endDate, format, accountMappings }
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting QuickBooks data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // ===== Audit Trail Routes =====

  // Get audit logs with filters
  app.get("/api/operations/fuel/audit-logs", authenticateUser, requirePermission('fuel:read', 'audit:read'), async (req: any, res) => {
    try {
      const { 
        entityType, 
        userId, 
        action, 
        startDate, 
        endDate,
        limit = 100,
        offset = 0 
      } = req.query;

      // Validate limit and offset
      const validLimit = Math.min(Math.max(parseInt(limit as string) || 100, 1), 500);
      const validOffset = Math.max(parseInt(offset as string) || 0, 0);

      let query = db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          userId: auditLogs.userId,
          username: users.username,
          userEmail: users.email,
          beforeState: auditLogs.beforeState,
          afterState: auditLogs.afterState,
          metadata: auditLogs.metadata,
          ipAddress: auditLogs.ipAddress,
          timestamp: auditLogs.timestamp,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.orgId, req.user.orgId))
        .orderBy(desc(auditLogs.timestamp))
        .$dynamic();

      // Apply filters
      const conditions = [eq(auditLogs.orgId, req.user.orgId)];
      
      if (entityType) {
        conditions.push(eq(auditLogs.entityType, entityType as string));
      }
      
      if (userId) {
        conditions.push(eq(auditLogs.userId, userId as string));
      }
      
      if (action) {
        conditions.push(eq(auditLogs.action, action as string));
      }
      
      if (startDate) {
        conditions.push(gte(auditLogs.timestamp, new Date(startDate as string)));
      }
      
      if (endDate) {
        const endDateTime = new Date(endDate as string);
        endDateTime.setHours(23, 59, 59, 999);
        conditions.push(lte(auditLogs.timestamp, endDateTime));
      }

      if (conditions.length > 1) {
        query = query.where(and(...conditions));
      }

      const logs = await query
        .limit(validLimit)
        .offset(validOffset);

      // Get total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

      res.json({
        logs,
        total: Number(countResult[0]?.count || 0),
        limit: validLimit,
        offset: validOffset,
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ===== Debt Scenarios Routes (Modeling Module) =====

  // Get all debt scenarios for organization
  app.get("/api/modeling/debt-scenarios", authenticateUser, async (req: any, res) => {
    try {
      const scenarios = await storage.getDebtScenariosForOrg(req.user.orgId);
      res.json(scenarios);
    } catch (error) {
      console.error("Failed to fetch debt scenarios:", error);
      res.status(500).json({ error: "Failed to fetch debt scenarios" });
    }
  });

  // Get single debt scenario by ID
  app.get("/api/modeling/debt-scenarios/:id", authenticateUser, async (req: any, res) => {
    try {
      const scenario = await storage.getDebtScenario(req.params.id);
      
      if (!scenario) {
        return res.status(404).json({ error: "Scenario not found" });
      }

      // Verify org ownership
      if (scenario.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(scenario);
    } catch (error) {
      console.error("Failed to fetch debt scenario:", error);
      res.status(500).json({ error: "Failed to fetch debt scenario" });
    }
  });

  // Create new debt scenario
  app.post("/api/modeling/debt-scenarios", authenticateUser, async (req: any, res) => {
    try {
      // Parse and validate request body
      const validatedData = insertDebtScenarioSchema.parse(req.body);

      // Normalize numeric fields (convert strings to numbers)
      const scenarioData = {
        ...validatedData,
        purchasePrice: typeof validatedData.purchasePrice === 'string' 
          ? parseFloat(validatedData.purchasePrice) 
          : validatedData.purchasePrice,
        loanAmount: typeof validatedData.loanAmount === 'string' 
          ? parseFloat(validatedData.loanAmount) 
          : validatedData.loanAmount,
        noi: typeof validatedData.noi === 'string' 
          ? parseFloat(validatedData.noi) 
          : validatedData.noi,
        orgId: req.user.orgId,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      };

      const scenario = await storage.createDebtScenario(scenarioData);

      // Audit logging
      await AuditService.logChange({
        orgId: req.user.orgId,
        userId: req.user.id,
        entityType: 'debt_scenario',
        entityId: scenario.id,
        action: 'created',
        changes: {},
        before: null,
        after: scenario,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(scenario);
    } catch (error) {
      console.error("Failed to create debt scenario:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid scenario data", details: error });
      }
      res.status(500).json({ error: "Failed to create debt scenario" });
    }
  });

  // Update debt scenario
  app.put("/api/modeling/debt-scenarios/:id", authenticateUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if scenario exists and belongs to user's org
      const existing = await storage.getDebtScenario(id);
      if (!existing) {
        return res.status(404).json({ error: "Scenario not found" });
      }
      if (existing.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Parse and validate updates
      const validatedData = updateDebtScenarioSchema.parse(req.body);

      // Normalize numeric fields
      const updates: any = { ...validatedData };
      if (updates.purchasePrice !== undefined) {
        updates.purchasePrice = typeof updates.purchasePrice === 'string' 
          ? parseFloat(updates.purchasePrice) 
          : updates.purchasePrice;
      }
      if (updates.loanAmount !== undefined) {
        updates.loanAmount = typeof updates.loanAmount === 'string' 
          ? parseFloat(updates.loanAmount) 
          : updates.loanAmount;
      }
      if (updates.noi !== undefined) {
        updates.noi = typeof updates.noi === 'string' 
          ? parseFloat(updates.noi) 
          : updates.noi;
      }
      updates.updatedBy = req.user.id;

      const updated = await storage.updateDebtScenario(id, updates);

      // Audit logging
      await AuditService.logChange({
        orgId: req.user.orgId,
        userId: req.user.id,
        entityType: 'debt_scenario',
        entityId: id,
        action: 'updated',
        changes: updates,
        before: existing,
        after: updated,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(updated);
    } catch (error) {
      console.error("Failed to update debt scenario:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid scenario data", details: error });
      }
      res.status(500).json({ error: "Failed to update debt scenario" });
    }
  });

  // Delete debt scenario
  app.delete("/api/modeling/debt-scenarios/:id", authenticateUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if scenario exists and belongs to user's org
      const existing = await storage.getDebtScenario(id);
      if (!existing) {
        return res.status(404).json({ error: "Scenario not found" });
      }
      if (existing.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteDebtScenario(id);

      // Audit logging
      await AuditService.logChange({
        orgId: req.user.orgId,
        userId: req.user.id,
        entityType: 'debt_scenario',
        entityId: id,
        action: 'deleted',
        changes: {},
        before: existing,
        after: null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete debt scenario:", error);
      res.status(500).json({ error: "Failed to delete debt scenario" });
    }
  });

  // ===== User Role Management Routes =====

  // Get all users in the organization with their current roles
  app.get("/api/operations/fuel/users", authenticateUser, requireRole('owner', 'admin'), async (req: any, res) => {
    try {
      // Get all users in the organization using LEFT JOIN to include users without roles
      // In production, this would query an organization_members table
      // For demo purposes, we'll show all users and their roles if they have them
      const orgUsers = await db
        .select({
          userId: users.id,
          email: users.email,
          username: users.username,
          role: organizationUserRoles.role,
          isActive: organizationUserRoles.isActive,
        })
        .from(users)
        .leftJoin(
          organizationUserRoles, 
          and(
            eq(users.id, organizationUserRoles.userId),
            eq(organizationUserRoles.orgId, req.user.orgId)
          )
        )
        // For demo, show all users. In production, add WHERE clause for org membership
        .orderBy(users.username);

      // Transform to expected format
      const result = orgUsers.map(u => ({
        id: u.userId,
        email: u.email,
        username: u.username,
        currentRole: u.role || null,
        isActive: u.isActive ?? true,
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching organization users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update a user's role
  app.patch("/api/operations/fuel/users/:userId/role", authenticateUser, requireRole('owner', 'admin'), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !['owner', 'admin', 'editor', 'viewer', 'auditor'].includes(role)) {
        return res.status(400).json({ error: "Invalid role specified" });
      }

      // Prevent users from changing their own role
      if (userId === req.user.id) {
        return res.status(403).json({ error: "Cannot change your own role" });
      }

      // Verify target user exists and belongs to the organization
      const targetUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (targetUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get the current role assignment
      const existingRole = await db
        .select()
        .from(organizationUserRoles)
        .where(
          and(
            eq(organizationUserRoles.userId, userId),
            eq(organizationUserRoles.orgId, req.user.orgId)
          )
        )
        .limit(1);

      const oldRole = existingRole.length > 0 ? existingRole[0] : null;
      
      // Security: Admins cannot manage Owners or other Admins
      if (req.user.role === 'admin') {
        // Check if target user is Owner or Admin
        if (oldRole && (oldRole.role === 'owner' || oldRole.role === 'admin')) {
          return res.status(403).json({ 
            error: "Admins cannot modify Owner or Admin roles" 
          });
        }
        
        // Prevent Admins from assigning Owner role
        if (role === 'owner') {
          return res.status(403).json({ 
            error: "Admins cannot assign Owner role" 
          });
        }
      }

      if (existingRole.length > 0) {
        // Update existing role
        await db
          .update(organizationUserRoles)
          .set({
            role: role,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(organizationUserRoles.userId, userId),
              eq(organizationUserRoles.orgId, req.user.orgId)
            )
          );
      } else {
        // Create new role assignment - verify user belongs to organization first
        // In production, this would check organization membership table
        // For now, we'll create the role assignment
        await db.insert(organizationUserRoles).values({
          userId: userId,
          orgId: req.user.orgId,
          role: role,
          isActive: true,
        });
      }

      // Audit log the role change
      await AuditService.logAuditEvent(
        req,
        'role_change',
        'user',
        userId,
        oldRole ? { role: oldRole.role } : null,
        { role },
        { targetUserId: userId, oldRole: oldRole?.role, newRole: role }
      );

      res.json({ success: true, message: "Role updated successfully" });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate QuickBooks CSV preview
function generateQuickBooksPreview(sales: any[], accountMappings: any, format: string) {
  const grouped = groupSalesByDateAndType(sales);
  const preview = [];

  for (const group of grouped.slice(0, 5)) {
    const fuelTypeMap: Record<string, string> = {
      'diesel': accountMappings.diesel,
      'regular_gas': accountMappings.regularGas,
      'premium_gas': accountMappings.premiumGas,
      'ethanol_free': accountMappings.ethanolFree,
    };

    const revenueAccount = fuelTypeMap[group.fuelType] || '4000';
    const arAccount = accountMappings.accountsReceivable || '1200';
    const amount = parseFloat(group.totalAmount).toFixed(2);
    const fuelTypeName = group.fuelType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const memo = `Fuel Sales - ${fuelTypeName} (${group.count} transactions)`;

    preview.push({
      date: group.date,
      account: arAccount,
      debit: amount,
      credit: '',
      memo,
      name: 'Marina Operations',
      class: 'Fuel',
    });

    preview.push({
      date: group.date,
      account: revenueAccount,
      debit: '',
      credit: amount,
      memo,
      name: 'Marina Operations',
      class: 'Fuel',
    });
  }

  return preview;
}

// Helper function to generate QuickBooks CSV
function generateQuickBooksCSV(sales: any[], accountMappings: any, format: string): string {
  const grouped = groupSalesByDateAndType(sales);
  const rows = [];

  rows.push('Date,Account,Debit,Credit,Memo,Name,Class');

  for (const group of grouped) {
    const fuelTypeMap: Record<string, string> = {
      'diesel': accountMappings.diesel,
      'regular_gas': accountMappings.regularGas,
      'premium_gas': accountMappings.premiumGas,
      'ethanol_free': accountMappings.ethanolFree,
    };

    const revenueAccount = fuelTypeMap[group.fuelType] || '4000';
    const arAccount = accountMappings.accountsReceivable || '1200';
    const amount = parseFloat(group.totalAmount).toFixed(2);
    const fuelTypeName = group.fuelType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const memo = `Fuel Sales - ${fuelTypeName} (${group.count} transactions)`;

    rows.push(`${group.date},${arAccount},${amount},,${memo},Marina Operations,Fuel`);
    rows.push(`${group.date},${revenueAccount},,${amount},${memo},Marina Operations,Fuel`);
  }

  return rows.join('\n');
}

// Helper function to group sales by date and fuel type
function groupSalesByDateAndType(sales: any[]): Array<{
  date: string;
  fuelType: string;
  totalAmount: string;
  gallons: string;
  count: number;
}> {
  const groups: Record<string, any> = {};

  for (const sale of sales) {
    const date = new Date(sale.transactionDate).toISOString().split('T')[0];
    const key = `${date}_${sale.fuelType}`;

    if (!groups[key]) {
      groups[key] = {
        date,
        fuelType: sale.fuelType,
        totalAmount: '0',
        gallons: '0',
        count: 0,
      };
    }

    groups[key].totalAmount = (parseFloat(groups[key].totalAmount) + parseFloat(sale.totalAmount)).toFixed(2);
    groups[key].gallons = (parseFloat(groups[key].gallons) + parseFloat(sale.quantityGallons)).toFixed(2);
    groups[key].count += 1;
  }

  return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
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
