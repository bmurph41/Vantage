import { Router } from "express";
import { db } from "../../db";
import { 
  opssosConversations, 
  opssosMessages, 
  opssosMessageTemplates,
  crmContacts,
  users
} from "../../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const inboxRouter = Router();

// Get all conversations
inboxRouter.get("/conversations", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const status = req.query.status as string | undefined;
    
    const conditions = [eq(opssosConversations.orgId, orgId)];
    if (status && status !== "all") {
      conditions.push(eq(opssosConversations.status, status as any));
    }

    const conversations = await db
      .select({
        id: opssosConversations.id,
        contactId: opssosConversations.contactId,
        dealId: opssosConversations.dealId,
        assetId: opssosConversations.assetId,
        channel: opssosConversations.channel,
        status: opssosConversations.status,
        assignedUserId: opssosConversations.assignedUserId,
        lastMessageAt: opssosConversations.lastMessageAt,
        createdAt: opssosConversations.createdAt,
        contactName: sql<string>`COALESCE(${crmContacts.firstName} || ' ' || ${crmContacts.lastName}, 'Unknown')`,
      })
      .from(opssosConversations)
      .leftJoin(crmContacts, eq(opssosConversations.contactId, crmContacts.id))
      .where(and(...conditions))
      .orderBy(desc(opssosConversations.lastMessageAt));

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get single conversation with messages
inboxRouter.get("/conversations/:id", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const [conversation] = await db
      .select()
      .from(opssosConversations)
      .where(and(eq(opssosConversations.id, id), eq(opssosConversations.orgId, orgId)));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await db
      .select()
      .from(opssosMessages)
      .where(eq(opssosMessages.conversationId, id))
      .orderBy(opssosMessages.createdAt);

    res.json({ ...conversation, messages });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Assign conversation to user
inboxRouter.post("/conversations/:id/assign", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { userId } = req.body;

    const [updated] = await db
      .update(opssosConversations)
      .set({ assignedUserId: userId })
      .where(and(eq(opssosConversations.id, id), eq(opssosConversations.orgId, orgId)))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error assigning conversation:", error);
    res.status(500).json({ error: "Failed to assign conversation" });
  }
});

// Send or add note
inboxRouter.post("/messages", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { conversationId, body, direction } = req.body;

    const [message] = await db
      .insert(opssosMessages)
      .values({
        orgId,
        conversationId,
        body,
        direction: direction || "out",
        status: "sent",
        sentAt: new Date(),
      })
      .returning();

    // Update conversation lastMessageAt
    await db
      .update(opssosConversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(opssosConversations.id, conversationId));

    res.json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Schedule message
inboxRouter.post("/messages/schedule", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { conversationId, body, scheduledFor } = req.body;

    const [message] = await db
      .insert(opssosMessages)
      .values({
        orgId,
        conversationId,
        body,
        direction: "out",
        status: "scheduled",
        scheduledFor: new Date(scheduledFor),
      })
      .returning();

    res.json(message);
  } catch (error) {
    console.error("Error scheduling message:", error);
    res.status(500).json({ error: "Failed to schedule message" });
  }
});

// Get message templates
inboxRouter.get("/templates", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const templates = await db
      .select()
      .from(opssosMessageTemplates)
      .where(eq(opssosMessageTemplates.orgId, orgId));

    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Create message template
inboxRouter.post("/templates", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { groupName, title, body } = req.body;

    const [template] = await db
      .insert(opssosMessageTemplates)
      .values({ orgId, groupName, title, body })
      .returning();

    res.json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});
