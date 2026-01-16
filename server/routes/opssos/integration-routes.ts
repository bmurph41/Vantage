import { Router } from "express";
import { db } from "../../db";
import { opssosIntegrations } from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const integrationRouter = Router();

// Get all integrations
integrationRouter.get("/", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const integrations = await db
      .select()
      .from(opssosIntegrations)
      .where(eq(opssosIntegrations.orgId, orgId))
      .orderBy(desc(opssosIntegrations.createdAt));

    res.json(integrations);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

// Create integration
integrationRouter.post("/", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { provider, status, credentialsEncrypted, settings } = req.body;

    const [integration] = await db
      .insert(opssosIntegrations)
      .values({
        orgId,
        provider,
        status: status || "inactive",
        credentialsEncrypted,
        settings: settings || {},
      })
      .returning();

    res.json(integration);
  } catch (error) {
    console.error("Error creating integration:", error);
    res.status(500).json({ error: "Failed to create integration" });
  }
});

// Update integration
integrationRouter.patch("/:id", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const updates = req.body;

    const [integration] = await db
      .update(opssosIntegrations)
      .set(updates)
      .where(and(eq(opssosIntegrations.id, id), eq(opssosIntegrations.orgId, orgId)))
      .returning();

    res.json(integration);
  } catch (error) {
    console.error("Error updating integration:", error);
    res.status(500).json({ error: "Failed to update integration" });
  }
});
