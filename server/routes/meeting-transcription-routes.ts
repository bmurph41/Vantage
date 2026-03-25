/**
 * G.5 — Meeting Transcription + CRM Sync Routes
 *
 * Upload meeting recordings or transcripts. AI extracts summaries,
 * action items, deal mentions, and contact references. Auto-creates
 * CRM tasks, logs activities on mentioned deals/contacts.
 */

import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import {
  meetingRecordings,
  crmActivities,
  crmTasks,
  crmDeals,
  crmContacts,
} from "@shared/schema";
import { eq, and, desc, sql, ilike, count } from "drizzle-orm";

export const meetingTranscriptionRouter = Router();

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// ── Upload & Create ──────────────────────────────────────────────────────

// POST / — upload a meeting recording/transcript
meetingTranscriptionRouter.post("/", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const {
      title,
      platform,
      externalMeetingId,
      startTime,
      duration,
      participants,
      transcriptText,
      transcriptUrl,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }
    if (!transcriptText && !transcriptUrl) {
      return res.status(400).json({ error: "transcriptText or transcriptUrl is required" });
    }

    const [recording] = await db
      .insert(meetingRecordings)
      .values({
        orgId,
        userId,
        title,
        platform: platform || "upload",
        externalMeetingId,
        startTime: startTime ? new Date(startTime) : new Date(),
        duration,
        participants,
        transcriptText,
        transcriptUrl,
        transcriptionStatus: transcriptText ? "complete" : "pending",
        analysisStatus: "pending",
      })
      .returning();

    res.status(201).json(recording);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── AI Analysis ──────────────────────────────────────────────────────────

// POST /:id/analyze — run AI analysis on the transcript
meetingTranscriptionRouter.post("/:id/analyze", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [recording] = await db
      .select()
      .from(meetingRecordings)
      .where(
        and(eq(meetingRecordings.id, req.params.id), eq(meetingRecordings.orgId, orgId)),
      );

    if (!recording) return res.status(404).json({ error: "Recording not found" });
    if (!recording.transcriptText) {
      return res.status(400).json({ error: "No transcript text available for analysis" });
    }

    await db
      .update(meetingRecordings)
      .set({ analysisStatus: "processing" })
      .where(eq(meetingRecordings.id, recording.id));

    const anthropic = getAnthropicClient();
    let analysis: any = null;

    if (anthropic) {
      try {
        // Truncate transcript to fit context (first 15k chars)
        const transcript = recording.transcriptText.slice(0, 15000);

        // Get org's deals and contacts for matching
        const deals = await db
          .select({ id: crmDeals.id, title: crmDeals.title })
          .from(crmDeals)
          .where(eq(crmDeals.orgId, orgId))
          .limit(200);

        const contacts = await db
          .select({
            id: crmContacts.id,
            firstName: crmContacts.firstName,
            lastName: crmContacts.lastName,
            company: crmContacts.company,
          })
          .from(crmContacts)
          .where(eq(crmContacts.orgId, orgId))
          .limit(500);

        const dealNames = deals.map((d) => d.title).join(", ");
        const contactNames = contacts.map((c) => `${c.firstName} ${c.lastName}`).join(", ");

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: `Analyze this meeting transcript and extract structured information.

TRANSCRIPT:
${transcript}

KNOWN DEALS IN OUR SYSTEM: ${dealNames || "None"}
KNOWN CONTACTS: ${contactNames || "None"}

Return a JSON object:
{
  "summary": "3-5 sentence summary of the meeting",
  "key_decisions": ["decision 1", "decision 2"],
  "action_items": [
    { "task": "specific task description", "assignee": "person name", "due_date": "YYYY-MM-DD or TBD", "deal_mention": "deal name if applicable" }
  ],
  "deals_mentioned": ["deal names that match our system"],
  "contacts_mentioned": ["contact names that match our system"],
  "next_steps": "paragraph about follow-ups and next meeting"
}`,
            },
          ],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch {
        // AI failed
      }
    }

    if (!analysis) {
      analysis = {
        summary: "Automated analysis not available. Review transcript manually.",
        key_decisions: [],
        action_items: [],
        deals_mentioned: [],
        contacts_mentioned: [],
        next_steps: "",
      };
    }

    // Resolve deal IDs from names
    const deals = await db
      .select({ id: crmDeals.id, title: crmDeals.title })
      .from(crmDeals)
      .where(eq(crmDeals.orgId, orgId));

    const dealsMentioned: string[] = [];
    for (const mention of analysis.deals_mentioned || []) {
      const match = deals.find(
        (d) => d.title && d.title.toLowerCase().includes(mention.toLowerCase()),
      );
      if (match) dealsMentioned.push(match.id);
    }

    // Resolve contact IDs from names
    const contacts = await db
      .select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
      })
      .from(crmContacts)
      .where(eq(crmContacts.orgId, orgId));

    const contactsMentioned: string[] = [];
    for (const mention of analysis.contacts_mentioned || []) {
      const match = contacts.find((c) => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        return fullName.includes(mention.toLowerCase()) || mention.toLowerCase().includes(fullName);
      });
      if (match) contactsMentioned.push(match.id);
    }

    // Update recording
    const [updated] = await db
      .update(meetingRecordings)
      .set({
        analysisStatus: "complete",
        summary: analysis.summary,
        keyDecisions: analysis.key_decisions,
        actionItems: analysis.action_items,
        dealsMentioned,
        contactsMentioned,
        nextSteps: analysis.next_steps,
      })
      .where(eq(meetingRecordings.id, recording.id))
      .returning();

    res.json({
      recordingId: updated.id,
      analysis: {
        summary: analysis.summary,
        keyDecisions: analysis.key_decisions,
        actionItems: analysis.action_items,
        dealsMentioned,
        contactsMentioned,
        nextSteps: analysis.next_steps,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── CRM Sync ─────────────────────────────────────────────────────────────

// POST /:id/sync-crm — create tasks and log activities from meeting analysis
meetingTranscriptionRouter.post("/:id/sync-crm", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;

    const [recording] = await db
      .select()
      .from(meetingRecordings)
      .where(
        and(eq(meetingRecordings.id, req.params.id), eq(meetingRecordings.orgId, orgId)),
      );

    if (!recording) return res.status(404).json({ error: "Recording not found" });
    if (recording.analysisStatus !== "complete") {
      return res.status(400).json({ error: "Run analysis first before syncing to CRM" });
    }

    const tasksCreated: string[] = [];
    const activitiesLogged: string[] = [];

    // 1. Create tasks from action items
    const actionItems = (recording.actionItems as any[]) || [];
    for (const item of actionItems) {
      // Try to find assignee in users/contacts
      const [task] = await db
        .insert(crmTasks)
        .values({
          title: item.task || "Action item from meeting",
          description: `From meeting: ${recording.title}\nAssignee: ${item.assignee || "Unassigned"}\n${item.deal_mention ? `Deal: ${item.deal_mention}` : ""}`,
          type: "task",
          priority: "medium",
          status: "pending",
          dueDate: item.due_date && item.due_date !== "TBD" ? new Date(item.due_date) : null,
          assigneeId: userId, // Default to current user
          orgId,
        })
        .returning();
      tasksCreated.push(task.id);
    }

    // 2. Log meeting activity on each mentioned deal
    const dealIds = (recording.dealsMentioned as string[]) || [];
    for (const dealId of dealIds) {
      const [activity] = await db
        .insert(crmActivities)
        .values({
          type: "meeting",
          subject: `Meeting: ${recording.title}`,
          description: recording.summary || `Meeting recorded on ${recording.platform}`,
          duration: recording.duration ? Math.round(recording.duration / 60) : null,
          status: "completed",
          entityType: "deal",
          entityId: dealId,
          userId,
          orgId,
          completedAt: recording.startTime || new Date(),
          metadata: {
            meetingRecordingId: recording.id,
            platform: recording.platform,
            participants: recording.participants,
          },
        })
        .returning();
      activitiesLogged.push(activity.id);
    }

    // 3. Log meeting activity on each mentioned contact
    const contactIds = (recording.contactsMentioned as string[]) || [];
    for (const contactId of contactIds) {
      const [activity] = await db
        .insert(crmActivities)
        .values({
          type: "meeting",
          subject: `Meeting: ${recording.title}`,
          description: recording.summary || `Meeting recorded on ${recording.platform}`,
          duration: recording.duration ? Math.round(recording.duration / 60) : null,
          status: "completed",
          entityType: "contact",
          entityId: contactId,
          userId,
          orgId,
          completedAt: recording.startTime || new Date(),
          metadata: {
            meetingRecordingId: recording.id,
            platform: recording.platform,
          },
        })
        .returning();
      activitiesLogged.push(activity.id);
    }

    // Update recording sync status
    await db
      .update(meetingRecordings)
      .set({
        syncedToDealIds: dealIds,
        syncedToContactIds: contactIds,
        activityLoggedAt: new Date(),
        tasksCreatedAt: tasksCreated.length > 0 ? new Date() : null,
        tasksCreatedCount: tasksCreated.length,
      })
      .where(eq(meetingRecordings.id, recording.id));

    res.json({
      recordingId: recording.id,
      tasksCreated: tasksCreated.length,
      taskIds: tasksCreated,
      activitiesLogged: activitiesLogged.length,
      activityIds: activitiesLogged,
      dealsSynced: dealIds.length,
      contactsSynced: contactIds.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── CRUD & Listing ───────────────────────────────────────────────────────

// GET / — list recordings
meetingTranscriptionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { platform, analysisStatus } = req.query;

    const conditions = [eq(meetingRecordings.orgId, orgId)];
    if (platform) conditions.push(eq(meetingRecordings.platform, platform as string));
    if (analysisStatus)
      conditions.push(eq(meetingRecordings.analysisStatus, analysisStatus as string));

    const recordings = await db
      .select()
      .from(meetingRecordings)
      .where(and(...conditions))
      .orderBy(desc(meetingRecordings.createdAt))
      .limit(50);

    res.json(recordings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /:id — get single recording with analysis
meetingTranscriptionRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [recording] = await db
      .select()
      .from(meetingRecordings)
      .where(
        and(eq(meetingRecordings.id, req.params.id), eq(meetingRecordings.orgId, orgId)),
      );
    if (!recording) return res.status(404).json({ error: "Recording not found" });
    res.json(recording);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id — delete recording
meetingTranscriptionRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [deleted] = await db
      .delete(meetingRecordings)
      .where(
        and(eq(meetingRecordings.id, req.params.id), eq(meetingRecordings.orgId, orgId)),
      )
      .returning();
    if (!deleted) return res.status(404).json({ error: "Recording not found" });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /deal/:dealId — get all meetings mentioning a deal
meetingTranscriptionRouter.get("/deal/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const recordings = await db
      .select()
      .from(meetingRecordings)
      .where(
        and(
          eq(meetingRecordings.orgId, orgId),
          sql`${meetingRecordings.dealsMentioned}::jsonb @> ${JSON.stringify([req.params.dealId])}::jsonb`,
        ),
      )
      .orderBy(desc(meetingRecordings.startTime));
    res.json(recordings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
