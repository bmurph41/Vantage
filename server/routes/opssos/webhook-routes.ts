import { Router } from "express";
import { db } from "../../db";
import { opssosWebhooks, opssosWebhookDeliveries } from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const webhookRouter = Router();

// Get all webhooks
webhookRouter.get("/", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const webhooks = await db
      .select()
      .from(opssosWebhooks)
      .where(eq(opssosWebhooks.orgId, orgId))
      .orderBy(desc(opssosWebhooks.createdAt));

    res.json(webhooks);
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    res.status(500).json({ error: "Failed to fetch webhooks" });
  }
});

// Create webhook
webhookRouter.post("/", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { url, secret, enabled, eventTypes } = req.body;

    const [webhook] = await db
      .insert(opssosWebhooks)
      .values({
        orgId,
        url,
        secret,
        enabled: enabled ?? true,
        eventTypes: eventTypes || [],
      })
      .returning();

    res.json(webhook);
  } catch (error) {
    console.error("Error creating webhook:", error);
    res.status(500).json({ error: "Failed to create webhook" });
  }
});

// Update webhook
webhookRouter.patch("/:id", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const updates = req.body;

    const [webhook] = await db
      .update(opssosWebhooks)
      .set(updates)
      .where(and(eq(opssosWebhooks.id, id), eq(opssosWebhooks.orgId, orgId)))
      .returning();

    res.json(webhook);
  } catch (error) {
    console.error("Error updating webhook:", error);
    res.status(500).json({ error: "Failed to update webhook" });
  }
});

// Get webhook deliveries
webhookRouter.get("/deliveries", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const deliveries = await db
      .select()
      .from(opssosWebhookDeliveries)
      .where(eq(opssosWebhookDeliveries.orgId, orgId))
      .orderBy(desc(opssosWebhookDeliveries.createdAt))
      .limit(100);

    res.json(deliveries);
  } catch (error) {
    console.error("Error fetching webhook deliveries:", error);
    res.status(500).json({ error: "Failed to fetch webhook deliveries" });
  }
});
