import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertProjectSchema, insertProjectSettingsSchema, insertTaskSchema, 
  insertProjectTemplateSchema, insertAuditLogSchema,
  insertTimelineNoteSchema, insertProjectShareSchema, insertRiskSchema 
} from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
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
        taskPayload.dateOnSite = "";
      }

      const updates = insertTaskSchema.partial().parse(taskPayload);
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

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
      const noteData = insertTimelineNoteSchema.parse({
        ...req.body,
        taskId: req.params.taskId,
        authorId: req.user.id,
      });
      
      const note = await storage.createTimelineNote(noteData);
      res.json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  app.put("/api/dd/timeline-notes/:id", async (req: any, res) => {
    try {
      const updates = insertTimelineNoteSchema.partial().parse(req.body);
      const note = await storage.updateTimelineNote(req.params.id, updates);
      res.json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.delete("/api/dd/timeline-notes/:id", async (req: any, res) => {
    try {
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
          (riskDetails[4 - impact][likelihood] as any[]).push({
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

  const httpServer = createServer(app);
  return httpServer;
}
