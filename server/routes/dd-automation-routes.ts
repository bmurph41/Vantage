import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  ddAutomationRules, 
  ddMilestoneNotifications, 
  ddChecklistTemplates,
  users,
  projects,
  tasks,
  insertDDAutomationRuleSchema,
  updateDDAutomationRuleSchema,
  insertDDMilestoneNotificationSchema,
  insertDDChecklistTemplateSchema,
  updateDDChecklistTemplateSchema
} from "@shared/schema";
import { eq, and, desc, asc, sql, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// === DD Automation Rules ===

// Get all automation rules for an organization
router.get("/automation-rules", async (req: any, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectId, isActive } = req.query;
    
    let query = db.select().from(ddAutomationRules).where(eq(ddAutomationRules.orgId, orgId));
    
    if (projectId) {
      query = db.select().from(ddAutomationRules).where(
        and(
          eq(ddAutomationRules.orgId, orgId),
          eq(ddAutomationRules.projectId, projectId as string)
        )
      );
    }
    
    const rules = await query.orderBy(asc(ddAutomationRules.priority));
    res.json(rules);
  } catch (error: any) {
    console.error("Error fetching automation rules:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single automation rule
router.get("/automation-rules/:id", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;
    
    const [rule] = await db.select().from(ddAutomationRules).where(
      and(
        eq(ddAutomationRules.id, id),
        eq(ddAutomationRules.orgId, orgId)
      )
    );
    
    if (!rule) {
      return res.status(404).json({ error: "Automation rule not found" });
    }
    
    res.json(rule);
  } catch (error: any) {
    console.error("Error fetching automation rule:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new automation rule
router.post("/automation-rules", async (req: any, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validatedData = insertDDAutomationRuleSchema.parse({
      ...req.body,
      orgId,
      createdBy: userId
    });

    const [newRule] = await db.insert(ddAutomationRules).values(validatedData).returning();
    res.status(201).json(newRule);
  } catch (error: any) {
    console.error("Error creating automation rule:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update an automation rule
router.patch("/automation-rules/:id", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;
    
    const validatedData = updateDDAutomationRuleSchema.parse(req.body);
    
    const [updatedRule] = await db.update(ddAutomationRules)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(
        and(
          eq(ddAutomationRules.id, id),
          eq(ddAutomationRules.orgId, orgId)
        )
      )
      .returning();
    
    if (!updatedRule) {
      return res.status(404).json({ error: "Automation rule not found" });
    }
    
    res.json(updatedRule);
  } catch (error: any) {
    console.error("Error updating automation rule:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete an automation rule
router.delete("/automation-rules/:id", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;
    
    const [deletedRule] = await db.delete(ddAutomationRules)
      .where(
        and(
          eq(ddAutomationRules.id, id),
          eq(ddAutomationRules.orgId, orgId)
        )
      )
      .returning();
    
    if (!deletedRule) {
      return res.status(404).json({ error: "Automation rule not found" });
    }
    
    res.json({ success: true, deletedRule });
  } catch (error: any) {
    console.error("Error deleting automation rule:", error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle automation rule active status
router.post("/automation-rules/:id/toggle", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;
    
    const [existingRule] = await db.select().from(ddAutomationRules).where(
      and(
        eq(ddAutomationRules.id, id),
        eq(ddAutomationRules.orgId, orgId)
      )
    );
    
    if (!existingRule) {
      return res.status(404).json({ error: "Automation rule not found" });
    }
    
    const [updatedRule] = await db.update(ddAutomationRules)
      .set({ isActive: !existingRule.isActive, updatedAt: new Date() })
      .where(eq(ddAutomationRules.id, id))
      .returning();
    
    res.json(updatedRule);
  } catch (error: any) {
    console.error("Error toggling automation rule:", error);
    res.status(500).json({ error: error.message });
  }
});

// === DD Milestone Notifications ===

// Get notifications for current user
router.get("/notifications", async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
    
    if (!userId || !orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { unreadOnly, limit = 50 } = req.query;
    
    let query;
    if (unreadOnly === "true") {
      query = db.select().from(ddMilestoneNotifications).where(
        and(
          eq(ddMilestoneNotifications.userId, userId),
          eq(ddMilestoneNotifications.isRead, false)
        )
      );
    } else {
      query = db.select().from(ddMilestoneNotifications).where(
        eq(ddMilestoneNotifications.userId, userId)
      );
    }
    
    const notifications = await query
      .orderBy(desc(ddMilestoneNotifications.createdAt))
      .limit(Number(limit));
    
    res.json(notifications);
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get unread notification count
router.get("/notifications/count", async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(ddMilestoneNotifications)
      .where(
        and(
          eq(ddMilestoneNotifications.userId, userId),
          eq(ddMilestoneNotifications.isRead, false)
        )
      );
    
    res.json({ unreadCount: result?.count || 0 });
  } catch (error: any) {
    console.error("Error fetching notification count:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.post("/notifications/:id/read", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    const [updatedNotification] = await db.update(ddMilestoneNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(ddMilestoneNotifications.id, id),
          eq(ddMilestoneNotifications.userId, userId)
        )
      )
      .returning();
    
    if (!updatedNotification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    
    res.json(updatedNotification);
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.post("/notifications/mark-all-read", async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await db.update(ddMilestoneNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(ddMilestoneNotifications.userId, userId),
          eq(ddMilestoneNotifications.isRead, false)
        )
      );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a notification (internal use for automation)
router.post("/notifications", async (req: any, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validatedData = insertDDMilestoneNotificationSchema.parse({
      ...req.body,
      orgId
    });

    const [newNotification] = await db.insert(ddMilestoneNotifications).values(validatedData).returning();
    res.status(201).json(newNotification);
  } catch (error: any) {
    console.error("Error creating notification:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// === DD Checklist Templates ===

// Get all templates (system + org-specific)
router.get("/templates", async (req: any, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    
    // Get system templates + org-specific templates
    const templates = await db.select().from(ddChecklistTemplates)
      .where(
        and(
          eq(ddChecklistTemplates.isActive, true),
          sql`(${ddChecklistTemplates.isSystem} = true OR ${ddChecklistTemplates.orgId} = ${orgId} OR ${ddChecklistTemplates.orgId} IS NULL)`
        )
      )
      .orderBy(asc(ddChecklistTemplates.sortOrder), asc(ddChecklistTemplates.name));
    
    res.json(templates);
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single template
router.get("/templates/:id", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    
    const [template] = await db.select().from(ddChecklistTemplates).where(
      eq(ddChecklistTemplates.id, id)
    );
    
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    res.json(template);
  } catch (error: any) {
    console.error("Error fetching template:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a custom template
router.post("/templates", async (req: any, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validatedData = insertDDChecklistTemplateSchema.parse({
      ...req.body,
      orgId,
      createdBy: userId,
      isSystem: false // Only system can create system templates
    });

    const [newTemplate] = await db.insert(ddChecklistTemplates).values(validatedData).returning();
    res.status(201).json(newTemplate);
  } catch (error: any) {
    console.error("Error creating template:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update a template (only org templates, not system)
router.patch("/templates/:id", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;
    
    const validatedData = updateDDChecklistTemplateSchema.parse(req.body);
    
    const [updatedTemplate] = await db.update(ddChecklistTemplates)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(
        and(
          eq(ddChecklistTemplates.id, id),
          eq(ddChecklistTemplates.orgId, orgId),
          eq(ddChecklistTemplates.isSystem, false) // Can't update system templates
        )
      )
      .returning();
    
    if (!updatedTemplate) {
      return res.status(404).json({ error: "Template not found or not editable" });
    }
    
    res.json(updatedTemplate);
  } catch (error: any) {
    console.error("Error updating template:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a template (only org templates)
router.delete("/templates/:id", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;
    
    const [deletedTemplate] = await db.delete(ddChecklistTemplates)
      .where(
        and(
          eq(ddChecklistTemplates.id, id),
          eq(ddChecklistTemplates.orgId, orgId),
          eq(ddChecklistTemplates.isSystem, false) // Can't delete system templates
        )
      )
      .returning();
    
    if (!deletedTemplate) {
      return res.status(404).json({ error: "Template not found or not deletable" });
    }
    
    res.json({ success: true, deletedTemplate });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: error.message });
  }
});

// Apply a template to a project (creates tasks from template)
router.post("/templates/:id/apply", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;
    const orgId = req.user?.orgId;
    
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    // Get the template
    const [template] = await db.select().from(ddChecklistTemplates).where(
      eq(ddChecklistTemplates.id, id)
    );
    
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Verify project belongs to org
    const [project] = await db.select().from(projects).where(
      and(
        eq(projects.id, projectId),
        eq(projects.orgId, orgId)
      )
    );
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Create tasks from template
    const templateTasks = template.tasks as any[];
    const createdTasks = [];
    
    for (let i = 0; i < templateTasks.length; i++) {
      const taskBlueprint = templateTasks[i];
      const [newTask] = await db.insert(tasks).values({
        projectId,
        title: taskBlueprint.title,
        description: taskBlueprint.description || null,
        ddCategory: taskBlueprint.ddCategory || null,
        priority: taskBlueprint.priority || "med",
        deadlineDays: taskBlueprint.deadlineDays || null,
        isMilestone: taskBlueprint.isMilestone || false,
        isGating: taskBlueprint.isGating || false,
        requiresOnSiteInspection: taskBlueprint.requiresOnSiteInspection || false,
        status: "not_started",
        sortOrder: i
      }).returning();
      
      createdTasks.push(newTask);
    }
    
    res.status(201).json({
      success: true,
      templateName: template.name,
      tasksCreated: createdTasks.length,
      tasks: createdTasks
    });
  } catch (error: any) {
    console.error("Error applying template:", error);
    res.status(500).json({ error: error.message });
  }
});

// === Milestone Notification Endpoint ===

// Send notification for a specific milestone
router.post("/projects/:projectId/milestones/:milestoneId/notify", async (req: any, res: Response) => {
  try {
    const { projectId, milestoneId } = req.params;
    const { userIds, message, notificationType = "milestone_completed" } = req.body;
    const orgId = req.user?.orgId;
    const senderId = req.user?.id;
    
    if (!orgId || !senderId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify project belongs to org
    const [project] = await db.select().from(projects).where(
      and(
        eq(projects.id, projectId),
        eq(projects.orgId, orgId)
      )
    );
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Verify milestone exists and belongs to project
    const [milestone] = await db.select().from(tasks).where(
      and(
        eq(tasks.id, milestoneId),
        eq(tasks.projectId, projectId),
        eq(tasks.isMilestone, true)
      )
    );
    
    if (!milestone) {
      return res.status(404).json({ error: "Milestone not found" });
    }

    // Get users to notify - either from request body or all project team members
    let targetUserIds = userIds;
    if (!targetUserIds || targetUserIds.length === 0) {
      // Get all users in the org if no specific users provided
      const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));
      targetUserIds = orgUsers.map(u => u.id);
    }

    // Create notifications for each user
    const notifications = [];
    for (const userId of targetUserIds) {
      const [notification] = await db.insert(ddMilestoneNotifications).values({
        userId,
        projectId,
        orgId,
        milestoneId,
        notificationType,
        title: `Milestone: ${milestone.title}`,
        message: message || `Milestone "${milestone.title}" has been reached in project "${project.name}"`,
        metadata: {
          projectName: project.name,
          milestoneName: milestone.title,
          senderId,
        },
      }).returning();
      
      notifications.push(notification);
    }

    res.status(201).json({
      success: true,
      notificationsSent: notifications.length,
      notifications,
    });
  } catch (error: any) {
    console.error("Error sending milestone notification:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get milestone notification settings for a project
router.get("/projects/:projectId/milestone-settings", async (req: any, res: Response) => {
  try {
    const { projectId } = req.params;
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get all milestones for the project
    const milestones = await db.select().from(tasks).where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.isMilestone, true)
      )
    ).orderBy(asc(tasks.sortOrder));

    // Get automation rules for milestone notifications on this project
    const milestoneRules = await db.select().from(ddAutomationRules).where(
      and(
        eq(ddAutomationRules.projectId, projectId),
        eq(ddAutomationRules.triggerType, "milestone_reached"),
        eq(ddAutomationRules.actionType, "send_notification")
      )
    );

    res.json({
      milestones,
      notificationRules: milestoneRules,
    });
  } catch (error: any) {
    console.error("Error fetching milestone settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Configure milestone notification settings
router.post("/projects/:projectId/milestone-settings", async (req: any, res: Response) => {
  try {
    const { projectId } = req.params;
    const { milestoneId, notifyUserIds, notifyOnStart, notifyOnComplete, daysBefore } = req.body;
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rules = [];

    // Create notification rule for milestone completion if enabled
    if (notifyOnComplete && notifyUserIds?.length > 0) {
      const [rule] = await db.insert(ddAutomationRules).values({
        projectId,
        orgId,
        name: `Notify on milestone completion`,
        description: `Send notification when milestone is completed`,
        triggerType: "milestone_reached",
        triggerCondition: { milestoneId },
        actionType: "send_notification",
        actionConfig: { userIds: notifyUserIds, notificationType: "milestone_completed" },
        isActive: true,
        priority: 0,
        createdBy: userId,
      }).returning();
      rules.push(rule);
    }

    // Create notification rule for deadline approaching if enabled
    if (daysBefore && daysBefore > 0 && notifyUserIds?.length > 0) {
      const [rule] = await db.insert(ddAutomationRules).values({
        projectId,
        orgId,
        name: `Notify ${daysBefore} days before milestone deadline`,
        description: `Send notification ${daysBefore} days before milestone deadline`,
        triggerType: "deadline_approaching",
        triggerCondition: { milestoneId, daysBefore },
        actionType: "send_notification",
        actionConfig: { userIds: notifyUserIds, notificationType: "deadline_approaching" },
        isActive: true,
        priority: 0,
        createdBy: userId,
      }).returning();
      rules.push(rule);
    }

    res.status(201).json({
      success: true,
      rulesCreated: rules.length,
      rules,
    });
  } catch (error: any) {
    console.error("Error configuring milestone settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get users for assignee selection
router.get("/assignees", async (req: any, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const orgUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role
    })
    .from(users)
    .where(eq(users.orgId, orgId))
    .orderBy(asc(users.name));
    
    res.json(orgUsers);
  } catch (error: any) {
    console.error("Error fetching assignees:", error);
    res.status(500).json({ error: error.message });
  }
});

// === Project-Specific Automation Rules ===

// GET automation rules for a specific project
router.get("/projects/:projectId/automation-rules", async (req: any, res: Response) => {
  try {
    const { projectId } = req.params;
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify project belongs to org
    const [project] = await db.select().from(projects).where(
      and(
        eq(projects.id, projectId),
        eq(projects.orgId, orgId)
      )
    );
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const rules = await db.select().from(ddAutomationRules).where(
      and(
        eq(ddAutomationRules.projectId, projectId),
        eq(ddAutomationRules.orgId, orgId)
      )
    ).orderBy(asc(ddAutomationRules.priority));
    
    res.json(rules);
  } catch (error: any) {
    console.error("Error fetching project automation rules:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create automation rule for a specific project
router.post("/projects/:projectId/automation-rules", async (req: any, res: Response) => {
  try {
    const { projectId } = req.params;
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify project belongs to org
    const [project] = await db.select().from(projects).where(
      and(
        eq(projects.id, projectId),
        eq(projects.orgId, orgId)
      )
    );
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const validatedData = insertDDAutomationRuleSchema.parse({
      ...req.body,
      projectId,
      orgId,
      createdBy: userId
    });

    const [newRule] = await db.insert(ddAutomationRules).values(validatedData).returning();
    res.status(201).json(newRule);
  } catch (error: any) {
    console.error("Error creating project automation rule:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// PATCH update automation rule for a specific project
router.patch("/projects/:projectId/automation-rules/:ruleId", async (req: any, res: Response) => {
  try {
    const { projectId, ruleId } = req.params;
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validatedData = updateDDAutomationRuleSchema.parse(req.body);
    
    const [updatedRule] = await db.update(ddAutomationRules)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(
        and(
          eq(ddAutomationRules.id, ruleId),
          eq(ddAutomationRules.projectId, projectId),
          eq(ddAutomationRules.orgId, orgId)
        )
      )
      .returning();
    
    if (!updatedRule) {
      return res.status(404).json({ error: "Automation rule not found" });
    }
    
    res.json(updatedRule);
  } catch (error: any) {
    console.error("Error updating project automation rule:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE automation rule for a specific project
router.delete("/projects/:projectId/automation-rules/:ruleId", async (req: any, res: Response) => {
  try {
    const { projectId, ruleId } = req.params;
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [deletedRule] = await db.delete(ddAutomationRules)
      .where(
        and(
          eq(ddAutomationRules.id, ruleId),
          eq(ddAutomationRules.projectId, projectId),
          eq(ddAutomationRules.orgId, orgId)
        )
      )
      .returning();
    
    if (!deletedRule) {
      return res.status(404).json({ error: "Automation rule not found" });
    }
    
    res.json({ success: true, deletedRule });
  } catch (error: any) {
    console.error("Error deleting project automation rule:", error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle automation rule for a specific project
router.post("/projects/:projectId/automation-rules/:ruleId/toggle", async (req: any, res: Response) => {
  try {
    const { projectId, ruleId } = req.params;
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [existingRule] = await db.select().from(ddAutomationRules).where(
      and(
        eq(ddAutomationRules.id, ruleId),
        eq(ddAutomationRules.projectId, projectId),
        eq(ddAutomationRules.orgId, orgId)
      )
    );
    
    if (!existingRule) {
      return res.status(404).json({ error: "Automation rule not found" });
    }
    
    const [updatedRule] = await db.update(ddAutomationRules)
      .set({ isActive: !existingRule.isActive, updatedAt: new Date() })
      .where(eq(ddAutomationRules.id, ruleId))
      .returning();
    
    res.json(updatedRule);
  } catch (error: any) {
    console.error("Error toggling project automation rule:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
