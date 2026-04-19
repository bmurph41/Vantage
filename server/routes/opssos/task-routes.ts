import { Router } from "express";
import { db } from "../../db";
import { 
  opssosTasks, 
  opssosChecklistTemplates,
  opssosTaskChecklists,
  users
} from "../../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const taskRouter = Router();

// Get all tasks
taskRouter.get("/", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const tasks = await db
      .select({
        id: opssosTasks.id,
        dealId: opssosTasks.dealId,
        assetId: opssosTasks.assetId,
        assignedUserId: opssosTasks.assignedUserId,
        title: opssosTasks.title,
        description: opssosTasks.description,
        status: opssosTasks.status,
        dueAt: opssosTasks.dueAt,
        costCents: opssosTasks.costCents,
        createdAt: opssosTasks.createdAt,
        assignedUserName: users.name,
      })
      .from(opssosTasks)
      .leftJoin(users, eq(opssosTasks.assignedUserId, users.id))
      .where(eq(opssosTasks.orgId, orgId))
      .orderBy(desc(opssosTasks.createdAt));

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Create task
taskRouter.post("/", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { dealId, assetId, assignedUserId, title, description, status, dueAt, costCents } = req.body;

    const [task] = await db
      .insert(opssosTasks)
      .values({
        orgId,
        dealId,
        assetId,
        assignedUserId,
        title,
        description,
        status: status || "todo",
        dueAt: dueAt ? new Date(dueAt) : null,
        costCents,
      })
      .returning();

    res.json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// Update task
taskRouter.patch("/:id", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const updates = req.body;

    if (updates.dueAt) {
      updates.dueAt = new Date(updates.dueAt);
    }

    const [task] = await db
      .update(opssosTasks)
      .set(updates)
      .where(and(eq(opssosTasks.id, id), eq(opssosTasks.orgId, orgId)))
      .returning();

    res.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// Apply checklist template to task
taskRouter.post("/:id/apply-checklist-template", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { templateId } = req.body;

    // Get template
    const [template] = await db
      .select()
      .from(opssosChecklistTemplates)
      .where(and(eq(opssosChecklistTemplates.id, templateId), eq(opssosChecklistTemplates.orgId, orgId)));

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Create checklist for task
    const [checklist] = await db
      .insert(opssosTaskChecklists)
      .values({
        orgId,
        taskId: id,
        items: template.items,
      })
      .returning();

    res.json(checklist);
  } catch (error) {
    console.error("Error applying checklist template:", error);
    res.status(500).json({ error: "Failed to apply checklist template" });
  }
});

// Get checklist templates
taskRouter.get("/checklist-templates", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const templates = await db
      .select()
      .from(opssosChecklistTemplates)
      .where(eq(opssosChecklistTemplates.orgId, orgId));

    res.json(templates);
  } catch (error) {
    console.error("Error fetching checklist templates:", error);
    res.status(500).json({ error: "Failed to fetch checklist templates" });
  }
});

// Create checklist template
taskRouter.post("/checklist-templates", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { name, items } = req.body;

    const [template] = await db
      .insert(opssosChecklistTemplates)
      .values({ orgId, name, items: items || [] })
      .returning();

    res.json(template);
  } catch (error) {
    console.error("Error creating checklist template:", error);
    res.status(500).json({ error: "Failed to create checklist template" });
  }
});
