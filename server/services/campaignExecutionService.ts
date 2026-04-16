/**
 * Campaign Execution Service
 * Runs a cron job every 15 minutes to process due campaign enrollments.
 * For each enrollment where status='active' AND nextStepAt <= now:
 *   - Email steps: sends via SendGrid
 *   - Call steps: creates a pending crmActivity
 *   - Wait steps: just advances the sequence
 * Logs each execution in crmActivities and advances the enrollment state.
 */

import cron from "node-cron";
import { db } from "../db";
import {
  outreachCampaignEnrollments,
  outreachCampaignSteps,
  outreachCampaigns,
  crmContacts,
  crmActivities,
} from "@shared/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { getUncachableSendGridClient } from "../sendgrid-client";

let isRunning = false;

async function processEnrollment(enrollment: any, steps: any[], contact: any, campaign: any) {
  const currentStep = steps.find((s) => s.stepNumber === enrollment.currentStep);
  if (!currentStep) {
    // No more steps — mark completed
    await db
      .update(outreachCampaignEnrollments)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(outreachCampaignEnrollments.id, enrollment.id));
    return;
  }

  if (currentStep.type === "email") {
    await executeEmailStep(enrollment, currentStep, contact, campaign);
  } else if (currentStep.type === "call") {
    await executeCallStep(enrollment, currentStep, contact, campaign);
  }
  // 'wait' steps just advance

  // Advance to next step
  const nextStep = steps.find((s) => s.stepNumber === enrollment.currentStep + 1);
  if (nextStep) {
    const nextStepAt = new Date();
    nextStepAt.setDate(nextStepAt.getDate() + (nextStep.delayDays || 0));

    await db
      .update(outreachCampaignEnrollments)
      .set({
        currentStep: enrollment.currentStep + 1,
        nextStepAt,
        updatedAt: new Date(),
      })
      .where(eq(outreachCampaignEnrollments.id, enrollment.id));
  } else {
    // Completed all steps
    await db
      .update(outreachCampaignEnrollments)
      .set({ status: "completed", completedAt: new Date(), nextStepAt: null, updatedAt: new Date() })
      .where(eq(outreachCampaignEnrollments.id, enrollment.id));
  }
}

async function executeEmailStep(enrollment: any, step: any, contact: any, campaign: any) {
  if (!contact?.email) return;

  const subject =
    step.subject ||
    (step.templateId ? "Follow-up from your outreach campaign" : `Outreach: ${campaign.name}`);

  const body = step.body || `Hi ${contact.firstName || "there"},\n\nThank you for your time.\n\nBest regards`;

  const mergedBody = body
    .replace(/\{\{firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{companyName\}\}/g, contact.company || "")
    .replace(/\{\{email\}\}/g, contact.email || "");

  const mergedSubject = subject
    .replace(/\{\{firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{companyName\}\}/g, contact.company || "");

  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    await client.send({
      to: contact.email,
      from: fromEmail,
      subject: mergedSubject,
      text: mergedBody,
      html: `<p>${mergedBody.replace(/\n/g, "<br/>")}</p>`,
    });

    // Log activity
    await db.insert(crmActivities).values({
      type: "email",
      subject: mergedSubject,
      description: `Campaign email sent: ${campaign.name} (Step ${enrollment.currentStep})`,
      direction: "outbound",
      outcome: "sent",
      status: "completed",
      entityType: "contact",
      entityId: contact.id,
      userId: enrollment.enrolledBy || enrollment.orgId,
      orgId: enrollment.orgId,
      completedAt: new Date(),
      metadata: { campaignId: campaign.id, enrollmentId: enrollment.id, stepNumber: enrollment.currentStep },
    });

    // Update sent count on campaign
    await db
      .update(outreachCampaigns)
      .set({ sentCount: (campaign.sentCount || 0) + 1, updatedAt: new Date() })
      .where(eq(outreachCampaigns.id, campaign.id));
  } catch (err: any) {
    console.error(`[campaignExecution] Failed to send email for enrollment ${enrollment.id}:`, err.message);
  }
}

async function executeCallStep(enrollment: any, step: any, contact: any, campaign: any) {
  try {
    await db.insert(crmActivities).values({
      type: "call",
      subject: `Scheduled call: ${campaign.name} (Step ${enrollment.currentStep})`,
      description: `Campaign call task for ${contact.firstName || ""} ${contact.lastName || ""} — ${campaign.name}`,
      direction: "outbound",
      outcome: "no_answer",
      status: "scheduled",
      entityType: "contact",
      entityId: contact.id,
      userId: enrollment.enrolledBy || enrollment.orgId,
      scheduledAt: new Date(),
      orgId: enrollment.orgId,
      metadata: { campaignId: campaign.id, enrollmentId: enrollment.id, stepNumber: enrollment.currentStep },
    });
  } catch (err: any) {
    console.error(`[campaignExecution] Failed to create call task for enrollment ${enrollment.id}:`, err.message);
  }
}

export async function runCampaignExecutionJob() {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();

    // Get all due active enrollments
    const dueEnrollments = await db
      .select({
        enrollment: outreachCampaignEnrollments,
        contact: crmContacts,
        campaign: outreachCampaigns,
      })
      .from(outreachCampaignEnrollments)
      .leftJoin(crmContacts, eq(outreachCampaignEnrollments.contactId, crmContacts.id))
      .leftJoin(outreachCampaigns, eq(outreachCampaignEnrollments.campaignId, outreachCampaigns.id))
      .where(
        and(
          eq(outreachCampaignEnrollments.status, "active"),
          isNotNull(outreachCampaignEnrollments.nextStepAt),
          lte(outreachCampaignEnrollments.nextStepAt, now)
        )
      )
      .limit(100);

    if (dueEnrollments.length === 0) return;

    console.log(`[campaignExecution] Processing ${dueEnrollments.length} due enrollments`);

    // Group by campaign to fetch steps once per campaign
    const campaignIds = [...new Set(dueEnrollments.map((e) => e.enrollment.campaignId))];
    const stepsMap: Record<string, any[]> = {};

    for (const campaignId of campaignIds) {
      stepsMap[campaignId] = await db
        .select()
        .from(outreachCampaignSteps)
        .where(eq(outreachCampaignSteps.campaignId, campaignId))
        .orderBy(outreachCampaignSteps.stepNumber);
    }

    for (const { enrollment, contact, campaign } of dueEnrollments) {
      if (!campaign) continue;
      const steps = stepsMap[enrollment.campaignId] || [];
      await processEnrollment(enrollment, steps, contact, campaign);
    }
  } catch (err: any) {
    console.error("[campaignExecution] Job error:", err.message);
  } finally {
    isRunning = false;
  }
}

export function startCampaignExecutionScheduler() {
  console.log("[campaignExecution] Starting campaign execution scheduler (every 15 min)");
  cron.schedule("*/15 * * * *", () => {
    runCampaignExecutionJob().catch((err) =>
      console.error("[campaignExecution] Unhandled error in cron job:", err)
    );
  });
}
