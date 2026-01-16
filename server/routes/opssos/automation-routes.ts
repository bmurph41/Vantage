import { Router } from "express";
import { db } from "../../db";
import { 
  opssosAutomationRules, 
  opssosAutomationRuns,
  opssosScheduledJobs
} from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const automationRouter = Router();

// Get all automation rules
automationRouter.get("/rules", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const rules = await db
      .select()
      .from(opssosAutomationRules)
      .where(eq(opssosAutomationRules.orgId, orgId))
      .orderBy(desc(opssosAutomationRules.createdAt));

    res.json(rules);
  } catch (error) {
    console.error("Error fetching automation rules:", error);
    res.status(500).json({ error: "Failed to fetch automation rules" });
  }
});

// Create automation rule
automationRouter.post("/rules", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { name, enabled, triggerType, conditions, actions } = req.body;

    const [rule] = await db
      .insert(opssosAutomationRules)
      .values({
        orgId,
        name,
        enabled: enabled ?? true,
        triggerType,
        conditions: conditions || [],
        actions: actions || [],
      })
      .returning();

    res.json(rule);
  } catch (error) {
    console.error("Error creating automation rule:", error);
    res.status(500).json({ error: "Failed to create automation rule" });
  }
});

// Toggle rule enabled/disabled
automationRouter.post("/rules/:id/toggle", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    // Get current state
    const [rule] = await db
      .select()
      .from(opssosAutomationRules)
      .where(and(eq(opssosAutomationRules.id, id), eq(opssosAutomationRules.orgId, orgId)));

    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    // Toggle
    const [updated] = await db
      .update(opssosAutomationRules)
      .set({ enabled: !rule.enabled })
      .where(eq(opssosAutomationRules.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error toggling automation rule:", error);
    res.status(500).json({ error: "Failed to toggle automation rule" });
  }
});

// Get automation runs
automationRouter.get("/runs", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const runs = await db
      .select()
      .from(opssosAutomationRuns)
      .where(eq(opssosAutomationRuns.orgId, orgId))
      .orderBy(desc(opssosAutomationRuns.startedAt))
      .limit(100);

    res.json(runs);
  } catch (error) {
    console.error("Error fetching automation runs:", error);
    res.status(500).json({ error: "Failed to fetch automation runs" });
  }
});

// Get scheduled jobs
automationRouter.get("/scheduled", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const jobs = await db
      .select()
      .from(opssosScheduledJobs)
      .where(eq(opssosScheduledJobs.orgId, orgId))
      .orderBy(opssosScheduledJobs.runAt)
      .limit(100);

    res.json(jobs);
  } catch (error) {
    console.error("Error fetching scheduled jobs:", error);
    res.status(500).json({ error: "Failed to fetch scheduled jobs" });
  }
});
