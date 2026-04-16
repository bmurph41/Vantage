import { Router } from "express";
import { db } from "../db";
import {
  outreachCampaignSteps,
  outreachCampaignEnrollments,
  outreachCampaigns,
  crmContacts,
  crmProperties,
  insertOutreachCampaignStepSchema,
  insertOutreachCampaignEnrollmentSchema,
} from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";

const router = Router();

// ── Campaign Steps ────────────────────────────────────────────────────

router.get("/campaigns/:id/steps", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [campaign] = await db
      .select()
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const steps = await db
      .select()
      .from(outreachCampaignSteps)
      .where(eq(outreachCampaignSteps.campaignId, req.params.id))
      .orderBy(asc(outreachCampaignSteps.stepNumber));

    res.json(steps);
  } catch (err: any) {
    console.error("Failed to get campaign steps:", err);
    res.status(500).json({ error: "Failed to retrieve campaign steps" });
  }
});

router.post("/campaigns/:id/steps", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [campaign] = await db
      .select()
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const validated = insertOutreachCampaignStepSchema.parse({
      ...req.body,
      campaignId: req.params.id,
      orgId,
    });
    const [step] = await db.insert(outreachCampaignSteps).values(validated).returning();
    res.json(step);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid step data", details: err.errors });
    console.error("Failed to create campaign step:", err);
    res.status(500).json({ error: "Failed to create campaign step" });
  }
});

// Bulk replace all steps for a campaign (used by sequence builder Save)
router.put("/campaigns/:id/steps", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [campaign] = await db
      .select()
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const stepsInput: any[] = Array.isArray(req.body) ? req.body : req.body.steps || [];

    await db.delete(outreachCampaignSteps).where(eq(outreachCampaignSteps.campaignId, req.params.id));

    if (stepsInput.length > 0) {
      const validated = stepsInput.map((s: any, i: number) =>
        insertOutreachCampaignStepSchema.parse({
          campaignId: req.params.id,
          orgId,
          stepNumber: i + 1,
          type: s.type || "email",
          delayDays: s.delayDays ?? 0,
          templateId: s.templateId || null,
          subject: s.subject || null,
          body: s.body || null,
        })
      );
      await db.insert(outreachCampaignSteps).values(validated);
    }

    const steps = await db
      .select()
      .from(outreachCampaignSteps)
      .where(eq(outreachCampaignSteps.campaignId, req.params.id))
      .orderBy(asc(outreachCampaignSteps.stepNumber));

    res.json(steps);
  } catch (err: any) {
    console.error("Failed to save campaign steps:", err);
    res.status(500).json({ error: "Failed to save campaign steps" });
  }
});

router.patch("/campaigns/:id/steps/:stepId", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [existing] = await db
      .select()
      .from(outreachCampaignSteps)
      .where(and(eq(outreachCampaignSteps.id, req.params.stepId), eq(outreachCampaignSteps.orgId, orgId)));
    if (!existing) return res.status(404).json({ error: "Step not found" });

    const { id: _id, campaignId: _c, orgId: _o, createdAt: _ca, ...updateData } = req.body;
    const [updated] = await db
      .update(outreachCampaignSteps)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(outreachCampaignSteps.id, req.params.stepId))
      .returning();
    res.json(updated);
  } catch (err: any) {
    console.error("Failed to update campaign step:", err);
    res.status(500).json({ error: "Failed to update campaign step" });
  }
});

router.delete("/campaigns/:id/steps/:stepId", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [existing] = await db
      .select()
      .from(outreachCampaignSteps)
      .where(and(eq(outreachCampaignSteps.id, req.params.stepId), eq(outreachCampaignSteps.orgId, orgId)));
    if (!existing) return res.status(404).json({ error: "Step not found" });

    await db.delete(outreachCampaignSteps).where(eq(outreachCampaignSteps.id, req.params.stepId));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete campaign step:", err);
    res.status(500).json({ error: "Failed to delete campaign step" });
  }
});

// ── Campaign Enrollments ──────────────────────────────────────────────

router.get("/campaigns/:id/enrollments", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [campaign] = await db
      .select()
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const enrollments = await db
      .select({
        enrollment: outreachCampaignEnrollments,
        contactFirstName: crmContacts.firstName,
        contactLastName: crmContacts.lastName,
        contactEmail: crmContacts.email,
        contactCompany: crmContacts.company,
        propertyTitle: crmProperties.title,
      })
      .from(outreachCampaignEnrollments)
      .leftJoin(crmContacts, eq(outreachCampaignEnrollments.contactId, crmContacts.id))
      .leftJoin(crmProperties, eq(outreachCampaignEnrollments.propertyId, crmProperties.id))
      .where(eq(outreachCampaignEnrollments.campaignId, req.params.id))
      .orderBy(desc(outreachCampaignEnrollments.createdAt));

    const flat = enrollments.map(({ enrollment, contactFirstName, contactLastName, contactEmail, contactCompany, propertyTitle }) => ({
      ...enrollment,
      contactName: [contactFirstName, contactLastName].filter(Boolean).join(" ") || "Unknown",
      contactEmail,
      contactCompany,
      propertyTitle,
    }));

    res.json(flat);
  } catch (err: any) {
    console.error("Failed to get campaign enrollments:", err);
    res.status(500).json({ error: "Failed to retrieve campaign enrollments" });
  }
});

router.post("/campaigns/:id/enrollments", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [campaign] = await db
      .select()
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // Get the first step to compute nextStepAt
    const [firstStep] = await db
      .select()
      .from(outreachCampaignSteps)
      .where(eq(outreachCampaignSteps.campaignId, req.params.id))
      .orderBy(asc(outreachCampaignSteps.stepNumber))
      .limit(1);

    const nextStepAt = new Date();
    if (firstStep?.delayDays) {
      nextStepAt.setDate(nextStepAt.getDate() + firstStep.delayDays);
    }

    // Support bulk enrollment: contactIds array or single contactId
    const contactIds: string[] = Array.isArray(req.body.contactIds)
      ? req.body.contactIds
      : req.body.contactId
      ? [req.body.contactId]
      : [];

    if (contactIds.length === 0) {
      return res.status(400).json({ error: "contactId or contactIds required" });
    }

    const results = [];
    for (const contactId of contactIds) {
      const [enrollment] = await db
        .insert(outreachCampaignEnrollments)
        .values({
          campaignId: req.params.id,
          contactId,
          propertyId: req.body.propertyId || null,
          orgId,
          status: "active",
          currentStep: 1,
          nextStepAt,
          enrolledBy: req.user.id,
          notes: req.body.notes || null,
        })
        .returning();
      results.push(enrollment);
    }

    // Update campaign targetCount
    await db
      .update(outreachCampaigns)
      .set({ targetCount: campaign.targetCount + results.length, updatedAt: new Date() })
      .where(eq(outreachCampaigns.id, req.params.id));

    res.json(results.length === 1 ? results[0] : results);
  } catch (err: any) {
    console.error("Failed to create enrollment:", err);
    res.status(500).json({ error: "Failed to create enrollment" });
  }
});

router.patch("/campaigns/:campaignId/enrollments/:id", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [existing] = await db
      .select()
      .from(outreachCampaignEnrollments)
      .where(and(eq(outreachCampaignEnrollments.id, req.params.id), eq(outreachCampaignEnrollments.orgId, orgId)));
    if (!existing) return res.status(404).json({ error: "Enrollment not found" });

    const { id: _id, campaignId: _c, orgId: _o, createdAt: _ca, ...updateData } = req.body;
    if (updateData.status === "completed" && !updateData.completedAt) {
      updateData.completedAt = new Date();
    }
    const [updated] = await db
      .update(outreachCampaignEnrollments)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(outreachCampaignEnrollments.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    console.error("Failed to update enrollment:", err);
    res.status(500).json({ error: "Failed to update enrollment" });
  }
});

router.delete("/campaigns/:campaignId/enrollments/:id", async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const [existing] = await db
      .select()
      .from(outreachCampaignEnrollments)
      .where(and(eq(outreachCampaignEnrollments.id, req.params.id), eq(outreachCampaignEnrollments.orgId, orgId)));
    if (!existing) return res.status(404).json({ error: "Enrollment not found" });

    await db.delete(outreachCampaignEnrollments).where(eq(outreachCampaignEnrollments.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete enrollment:", err);
    res.status(500).json({ error: "Failed to delete enrollment" });
  }
});

export default router;
