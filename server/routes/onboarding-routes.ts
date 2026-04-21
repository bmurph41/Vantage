/**
 * Onboarding Wizard + Notification Wiring
 *
 * 1. First-run onboarding: org setup, team invites, checklist tracking
 * 2. In-app notification center: create, list, mark read, preferences
 * 3. Email notification dispatch: wired to deal stages, approvals, DD milestones
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  userOnboarding,
  users,
  organizations,
  crmNotifications,
  crmDeals,
  organizationPacks,
  adminAuditLog,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { sendInviteEmail } from "../services/email-service";
import { enterpriseAuthService } from "../services/enterprise-auth-service";

export const onboardingRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════
// 1. ONBOARDING WIZARD
// ═══════════════════════════════════════════════════════════════════════════

// GET /status — get onboarding status + checklist for current user
onboardingRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const orgId = (req as any).user.orgId;

    // Get or create onboarding record
    let [onboarding] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));

    if (!onboarding) {
      [onboarding] = await db
        .insert(userOnboarding)
        .values({ userId, orgId, completedSteps: [], toursCompleted: [], tooltipsDismissed: [] })
        .returning();
    }

    // Compute checklist status from real data
    const completedSteps = (onboarding.completedSteps || []) as string[];

    // Check actual data for auto-completion
    const [dealCount] = await db.select({ c: count() }).from(crmDeals).where(eq(crmDeals.orgId, orgId));
    const [packCount] = await db.select({ c: count() }).from(organizationPacks).where(eq(organizationPacks.orgId, orgId));
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const [teamCount] = await db.select({ c: count() }).from(users).where(eq(users.orgId, orgId));

    const checklist = [
      { key: "org_profile", label: "Set up organization profile", completed: completedSteps.includes("org_profile") || !!(org?.name && org.name !== "Default Organization") },
      { key: "invite_team", label: "Invite team members", completed: completedSteps.includes("invite_team") || (teamCount?.c || 0) > 1 },
      { key: "first_deal", label: "Create your first deal", completed: completedSteps.includes("first_deal") || (dealCount?.c || 0) > 0 },
      { key: "connect_integration", label: "Connect an integration", completed: completedSteps.includes("connect_integration") },
      { key: "activate_pack", label: "Activate a feature pack", completed: completedSteps.includes("activate_pack") || (packCount?.c || 0) > 0 },
      { key: "explore_modeling", label: "Explore financial modeling", completed: completedSteps.includes("explore_modeling") },
      { key: "upload_comps", label: "Upload or browse comps", completed: completedSteps.includes("upload_comps") },
    ];

    const completedCount = checklist.filter((c) => c.completed).length;
    const totalSteps = checklist.length;
    const progressPct = Math.round((completedCount / totalSteps) * 100);

    res.json({
      isOnboardingComplete: onboarding.isOnboardingComplete || progressPct === 100,
      completedAt: onboarding.completedAt,
      progressPct,
      completedCount,
      totalSteps,
      checklist,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /complete-step — mark an onboarding step as done
onboardingRouter.post("/complete-step", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { step } = req.body;

    if (!step) return res.status(400).json({ error: "step is required" });

    const [onboarding] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));

    if (!onboarding) return res.status(404).json({ error: "Onboarding record not found" });

    const steps = (onboarding.completedSteps || []) as string[];
    if (!steps.includes(step)) {
      steps.push(step);
    }

    const [updated] = await db
      .update(userOnboarding)
      .set({ completedSteps: steps, updatedAt: new Date() })
      .where(eq(userOnboarding.id, onboarding.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /dismiss — mark onboarding as complete (skip remaining)
onboardingRouter.post("/dismiss", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const [updated] = await db
      .update(userOnboarding)
      .set({ isOnboardingComplete: true, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Onboarding record not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /setup-org — initial org setup (name, industry, etc.)
onboardingRouter.post("/setup-org", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { name, industry, assetClassFocus, assetClasses, teamSize } = req.body;

    const setData: Record<string, any> = {};
    if (name) setData.name = name;
    if (assetClasses !== undefined) setData.assetClasses = assetClasses;

    const [updated] = await db
      .update(organizations)
      .set(setData)
      .where(eq(organizations.id, orgId))
      .returning();

    // Mark step complete
    const [onboarding] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));

    if (onboarding) {
      const steps = (onboarding.completedSteps || []) as string[];
      if (!steps.includes("org_profile")) {
        steps.push("org_profile");
        await db.update(userOnboarding)
          .set({ completedSteps: steps, updatedAt: new Date() })
          .where(eq(userOnboarding.id, onboarding.id));
      }
    }

    res.json({ org: updated, step: "org_profile" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /set-asset-classes — save the org's target asset classes (and optional role) and mark step complete
onboardingRouter.post("/set-asset-classes", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { assetClasses, userRole } = req.body;

    if (!Array.isArray(assetClasses)) {
      return res.status(400).json({ error: "assetClasses must be an array" });
    }

    const updatePayload: Record<string, any> = { assetClasses };
    if (userRole !== undefined) {
      const validRoles = ["owner", "broker", "investor"];
      if (!validRoles.includes(userRole)) {
        return res.status(400).json({ error: "userRole must be one of: owner, broker, investor" });
      }
      updatePayload.userRole = userRole;
    }

    // Fetch current org for audit comparison
    const [currentOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    const previousClasses: string[] = (currentOrg?.assetClasses as string[]) ?? [];

    const [updated] = await db
      .update(organizations)
      .set(updatePayload)
      .where(eq(organizations.id, orgId))
      .returning();

    // Mark step complete
    const [onboarding] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));

    if (onboarding) {
      const steps = (onboarding.completedSteps || []) as string[];
      if (!steps.includes("asset_classes")) {
        steps.push("asset_classes");
        await db.update(userOnboarding)
          .set({ completedSteps: steps, updatedAt: new Date() })
          .where(eq(userOnboarding.id, onboarding.id));
      }
    }

    // Audit log
    try {
      await db.insert(adminAuditLog).values({
        adminUserId: userId,
        action: "asset_classes_updated",
        targetUserId: userId,
        metadataJson: {
          orgId,
          previousClasses,
          newClasses: assetClasses,
        },
      });
    } catch (_auditErr) {
      // Non-fatal: audit failure should not block the response
    }

    res.json({ org: updated, step: "asset_classes" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /invite-team — send team invites (batch)
onboardingRouter.post("/invite-team", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { invites } = req.body; // [{ email, role }]

    if (!invites?.length) return res.status(400).json({ error: "invites[] required" });

    const created: any[] = [];
    for (const invite of invites) {
      if (!invite.email) continue;

      // Check if user already exists
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, invite.email));

      if (existing) {
        created.push({ email: invite.email, status: "already_exists" });
        continue;
      }

      // Create placeholder user (they'll set password on invite accept)
      const [newUser] = await db
        .insert(users)
        .values({
          email: invite.email,
          name: invite.name || invite.email.split("@")[0],
          orgId,
          role: invite.role || "editor",
          isActive: true,
          emailVerified: false,
        })
        .returning();

      created.push({ email: invite.email, userId: newUser.id, status: "invited" });

      // Send invite email (fire-and-forget per invitee)
      (async () => {
        try {
          const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
          const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
          const inviteUrl = await enterpriseAuthService.generateInviteToken(newUser.id);
          await sendInviteEmail(invite.email, inviteUrl, {
            inviteeName: newUser.name || undefined,
            inviterName: inviter?.name || undefined,
            orgName: org?.name || undefined,
          });
        } catch (emailErr) {
          console.error('[Invite] Failed to send invite email:', emailErr);
        }
      })();
    }

    // Mark step complete
    const [onboarding] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));

    if (onboarding) {
      const steps = (onboarding.completedSteps || []) as string[];
      if (!steps.includes("invite_team")) {
        steps.push("invite_team");
        await db.update(userOnboarding)
          .set({ completedSteps: steps, updatedAt: new Date() })
          .where(eq(userOnboarding.id, onboarding.id));
      }
    }

    res.json({ invited: created.length, results: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. IN-APP NOTIFICATION CENTER
// ═══════════════════════════════════════════════════════════════════════════

// GET /notifications — list notifications for current user
onboardingRouter.get("/notifications", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const orgId = (req as any).user.orgId;
    const { unreadOnly, limit = "50", offset = "0" } = req.query;

    const conditions = [
      eq(crmNotifications.userId, userId),
      eq(crmNotifications.orgId, orgId),
    ];
    if (unreadOnly === "true") conditions.push(eq(crmNotifications.isRead, false));

    const notifications = await db
      .select()
      .from(crmNotifications)
      .where(and(...conditions))
      .orderBy(desc(crmNotifications.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [{ unread }] = await db
      .select({ unread: count() })
      .from(crmNotifications)
      .where(
        and(
          eq(crmNotifications.userId, userId),
          eq(crmNotifications.orgId, orgId),
          eq(crmNotifications.isRead, false),
        ),
      );

    res.json({ notifications, unreadCount: unread || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /notifications/mark-read — mark notifications as read
onboardingRouter.post("/notifications/mark-read", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { notificationIds, markAll } = req.body;

    if (markAll) {
      await db
        .update(crmNotifications)
        .set({ isRead: true })
        .where(and(eq(crmNotifications.userId, userId), eq(crmNotifications.isRead, false)));
      return res.json({ marked: "all" });
    }

    if (notificationIds?.length) {
      for (const id of notificationIds) {
        await db
          .update(crmNotifications)
          .set({ isRead: true })
          .where(and(eq(crmNotifications.id, id), eq(crmNotifications.userId, userId)));
      }
    }

    res.json({ marked: notificationIds?.length || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /notifications/send — create an in-app notification (internal use / API)
onboardingRouter.post("/notifications/send", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { userId, type, title, message, entityType, entityId, triggeredBy } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ error: "userId and title are required" });
    }

    const [notification] = await db
      .insert(crmNotifications)
      .values({
        orgId,
        userId,
        type: type || "system",
        title,
        message,
        entityType,
        entityId,
        triggeredBy: triggeredBy || (req as any).user.id,
      })
      .returning();

    res.status(201).json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. NOTIFICATION DISPATCH TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════

// POST /notifications/dispatch — trigger notifications for an event
onboardingRouter.post("/notifications/dispatch", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const triggeredBy = (req as any).user.id;
    const { event, entityType, entityId, targetUserIds, data } = req.body;

    if (!event || !targetUserIds?.length) {
      return res.status(400).json({ error: "event and targetUserIds[] are required" });
    }

    // Build notification content based on event type
    const templates: Record<string, (d: any) => { type: string; title: string; message: string }> = {
      deal_stage_changed: (d) => ({
        type: "deal_update",
        title: `Deal stage changed: ${d.dealTitle}`,
        message: `"${d.dealTitle}" moved to ${d.newStage}${d.changedBy ? ` by ${d.changedBy}` : ""}`,
      }),
      deal_assigned: (d) => ({
        type: "assignment",
        title: `Deal assigned to you: ${d.dealTitle}`,
        message: `You've been assigned to "${d.dealTitle}"`,
      }),
      approval_requested: (d) => ({
        type: "approval",
        title: `Approval needed: ${d.title}`,
        message: `${d.requestedBy} is requesting your approval on "${d.title}"`,
      }),
      approval_decided: (d) => ({
        type: "approval",
        title: `Approval ${d.decision}: ${d.title}`,
        message: `${d.approverName} ${d.decision} "${d.title}"`,
      }),
      dd_milestone_approaching: (d) => ({
        type: "deadline",
        title: `DD milestone approaching: ${d.milestoneName}`,
        message: `"${d.milestoneName}" is due in ${d.daysUntil} days`,
      }),
      dd_item_overdue: (d) => ({
        type: "deadline",
        title: `DD item overdue: ${d.itemTitle}`,
        message: `"${d.itemTitle}" was due ${d.daysOverdue} days ago`,
      }),
      finding_critical: (d) => ({
        type: "red_flag",
        title: `Critical DD finding: ${d.findingTitle}`,
        message: `A critical finding was recorded: "${d.findingTitle}" — ${d.recommendation || "Review immediately"}`,
      }),
      meeting_analyzed: (d) => ({
        type: "thread_update",
        title: `Meeting analyzed: ${d.meetingTitle}`,
        message: `${d.actionItemCount} action items extracted from "${d.meetingTitle}"`,
      }),
      comment_mention: (d) => ({
        type: "mention",
        title: `You were mentioned in a comment`,
        message: `${d.mentionedBy} mentioned you in "${d.threadTitle || d.entityTitle}"`,
      }),
    };

    const template = templates[event];
    if (!template) {
      return res.status(400).json({ error: `Unknown event type: ${event}. Available: ${Object.keys(templates).join(", ")}` });
    }

    const content = template(data || {});
    const created: string[] = [];

    for (const userId of targetUserIds) {
      const [notification] = await db
        .insert(crmNotifications)
        .values({
          orgId,
          userId,
          type: content.type,
          title: content.title,
          message: content.message,
          entityType,
          entityId,
          triggeredBy,
        })
        .returning();
      created.push(notification.id);
    }

    // Attempt email delivery (fire-and-forget)
    try {
      const { sendEmail } = await import("../services/email-service");

      for (const userId of targetUserIds) {
        const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId));
        if (user?.email) {
          await sendEmail({
            to: user.email,
            subject: content.title,
            text: `${content.message}\n\nView in Vantage: ${process.env.APP_URL || "https://app.vantage.com"}`,
            html: `<p>${content.message}</p><p><a href="${process.env.APP_URL || "https://app.vantage.com"}">View in Vantage</a></p>`,
          });
        }
      }
    } catch {
      // Email delivery failed — notifications still created in-app
    }

    res.json({ dispatched: created.length, event, notificationIds: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
