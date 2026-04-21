/**
 * Organization Settings Routes
 *
 * User-facing org management: profile, team, branding, roles.
 * Separate from admin routes — these are for org owners/admins.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  organizations,
  users,
  orgBranding,
  organizationPacks,
  organizationUserRoles,
  adminAuditLog,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { getAssetClassTier, getMaxAssetClasses } from "@shared/billing-constants";
import { sendInviteEmail } from "../services/email-service";
import { enterpriseAuthService } from "../services/enterprise-auth-service";

export const orgSettingsRouter = Router();

// ── Org Profile ──────────────────────────────────────────────────────────

// GET / — get org profile
orgSettingsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const [branding] = await db.select().from(orgBranding).where(eq(orgBranding.orgId, orgId));

    const [memberCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.orgId, orgId));

    const packs = await db
      .select()
      .from(organizationPacks)
      .where(and(eq(organizationPacks.orgId, orgId), eq(organizationPacks.status, "active")));

    res.json({
      ...org,
      branding: branding || null,
      memberCount: memberCount?.count || 0,
      activePacks: packs,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT / — update org profile
orgSettingsRouter.put("/", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { name, sessionTimeoutMinutes, mfaRequired, allowedEmailDomains, assetClasses } = req.body;

    const updateData: Record<string, any> = {};
    if (name) updateData.name = name;
    if (sessionTimeoutMinutes !== undefined) updateData.sessionTimeoutMinutes = sessionTimeoutMinutes;
    if (mfaRequired !== undefined) updateData.mfaRequired = mfaRequired;
    if (allowedEmailDomains !== undefined) updateData.allowedEmailDomains = allowedEmailDomains;
    if (assetClasses !== undefined) updateData.assetClasses = assetClasses;

    const [updated] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, orgId))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Branding ─────────────────────────────────────────────────────────────

// GET /branding
orgSettingsRouter.get("/branding", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [branding] = await db.select().from(orgBranding).where(eq(orgBranding.orgId, orgId));
    res.json(branding || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /branding — upsert branding
orgSettingsRouter.put("/branding", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { firmName, logoUrl, primaryColor, secondaryColor, accentColor, loginPageTagline, supportEmail } = req.body;

    const [existing] = await db.select().from(orgBranding).where(eq(orgBranding.orgId, orgId));

    if (existing) {
      const [updated] = await db
        .update(orgBranding)
        .set({ firmName, logoUrl, primaryColor, secondaryColor, accentColor, loginPageTagline, supportEmail })
        .where(eq(orgBranding.orgId, orgId))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(orgBranding)
      .values({ orgId, firmName, logoUrl, primaryColor, secondaryColor, accentColor, loginPageTagline, supportEmail })
      .returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Team Members ─────────────────────────────────────────────────────────

// GET /team — list all team members
orgSettingsRouter.get("/team", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        mfaEnabled: users.mfaEnabled,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.orgId, orgId))
      .orderBy(desc(users.createdAt));

    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /team/invite — invite a new member
orgSettingsRouter.post("/team/invite", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { email, name, role = "editor" } = req.body;

    if (!email) return res.status(400).json({ error: "email is required" });

    // ── Seat enforcement: check if org has available seats ──
    const { seatEnforcementService } = await import('../services/seat-enforcement-service');
    const { allowed, reason, seatStatus } = await seatEnforcementService.canAddUser(orgId);
    if (!allowed) {
      return res.status(403).json({
        error: reason,
        code: 'SEAT_LIMIT_REACHED',
        seatStatus,
      });
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      if (existing.orgId === orgId) {
        return res.status(409).json({ error: "User already in this organization" });
      }
      return res.status(409).json({ error: "Email already registered in another organization" });
    }

    const [created] = await db
      .insert(users)
      .values({
        email,
        name: name || email.split("@")[0],
        orgId,
        role: role as any,
        isActive: true,
        emailVerified: false,
      })
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: userId,
      action: "user_invited",
      targetUserId: created.id,
      metadataJson: { email, role, orgId },
    });

    // Send invite email (fire-and-forget — don't block the response)
    (async () => {
      try {
        const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
        const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
        const inviteUrl = await enterpriseAuthService.generateInviteToken(created.id);
        await sendInviteEmail(email, inviteUrl, {
          inviteeName: created.name || undefined,
          inviterName: inviter?.name || undefined,
          orgName: org?.name || undefined,
        });
      } catch (emailErr) {
        // Log but don't fail the request — user is already created in DB
        console.error('[Invite] Failed to send invite email:', emailErr);
      }
    })();

    const { passwordHash: _, ...safe } = created as any;
    res.status(201).json(safe);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /team/:memberId — update member role or status
orgSettingsRouter.patch("/team/:memberId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const adminUserId = (req as any).user.id;
    const { memberId } = req.params;
    const { role, isActive } = req.body;

    // Verify member belongs to this org
    const [member] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, memberId), eq(users.orgId, orgId)));

    if (!member) return res.status(404).json({ error: "Member not found" });

    // Prevent self-demotion from owner
    if (memberId === adminUserId && role && role !== "owner") {
      return res.status(400).json({ error: "Cannot change your own role. Transfer ownership first." });
    }

    const updateData: Record<string, any> = {};
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, memberId))
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId,
      action: role ? "role_changed" : "user_status_change",
      targetUserId: memberId,
      metadataJson: { previousRole: member.role, newRole: role, isActive },
    });

    const { passwordHash: _, ...safe } = updated as any;
    res.json(safe);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /team/:memberId — remove member from org
orgSettingsRouter.delete("/team/:memberId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const adminUserId = (req as any).user.id;
    const { memberId } = req.params;

    if (memberId === adminUserId) {
      return res.status(400).json({ error: "Cannot remove yourself" });
    }

    const [member] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, memberId), eq(users.orgId, orgId)));

    if (!member) return res.status(404).json({ error: "Member not found" });

    // Soft disable rather than delete
    await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, memberId));

    await db.insert(adminAuditLog).values({
      adminUserId,
      action: "user_deactivated",
      targetUserId: memberId,
      metadataJson: { email: member.email, name: member.name },
    });

    res.json({ removed: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /team/transfer-ownership — transfer org ownership
orgSettingsRouter.post("/team/transfer-ownership", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const currentUserId = (req as any).user.id;
    const { newOwnerId } = req.body;

    if (!newOwnerId) return res.status(400).json({ error: "newOwnerId is required" });

    const [newOwner] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, newOwnerId), eq(users.orgId, orgId)));

    if (!newOwner) return res.status(404).json({ error: "New owner must be a member of this org" });

    await db.transaction(async (tx) => {
      await tx.update(users).set({ role: "editor" }).where(eq(users.id, currentUserId));
      await tx.update(users).set({ role: "owner" }).where(eq(users.id, newOwnerId));

      await tx.insert(adminAuditLog).values({
        adminUserId: currentUserId,
        action: "ownership_transferred",
        targetUserId: newOwnerId,
        metadataJson: { previousOwnerId: currentUserId, newOwnerName: newOwner.name },
      });
    });

    res.json({ transferred: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /team/audit — recent team changes
orgSettingsRouter.get("/team/audit", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    // Get audit entries for users in this org
    const orgUserIds = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.orgId, orgId));

    const userIds = orgUserIds.map((u) => u.id);
    if (userIds.length === 0) return res.json([]);

    const entries = await db.execute(sql`
      SELECT a.id, a.action, a.metadata_json, a.created_at,
        admin_u.name as admin_name, target_u.name as target_name, target_u.email as target_email
      FROM admin_audit_log a
      LEFT JOIN users admin_u ON admin_u.id = a.admin_user_id
      LEFT JOIN users target_u ON target_u.id = a.target_user_id
      WHERE a.target_user_id = ANY(${userIds})
      ORDER BY a.created_at DESC
      LIMIT 50
    `);

    res.json(entries.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Asset Class Entitlements ─────────────────────────────────────────────────

// GET /entitlements — return org's entitled asset classes, role, and tier info
orgSettingsRouter.get("/entitlements", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [org] = await db
      .select({ assetClasses: organizations.assetClasses, userRole: organizations.userRole })
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) return res.status(404).json({ error: "Organization not found" });

    const assetClasses: string[] = org.assetClasses ?? [];
    const userRole: string | null = org.userRole ?? null;
    const count = assetClasses.length;

    const tier = count === 0 ? null : getAssetClassTier(count);
    const maxAssetClasses = tier ? getMaxAssetClasses(tier.key) : 2;

    res.json({
      assetClasses,
      userRole,
      assetClassTier: tier?.key ?? null,
      assetClassTierName: tier?.name ?? null,
      assetClassCount: count,
      maxAssetClasses: maxAssetClasses === Infinity ? null : maxAssetClasses,
      priceMonthly: tier?.priceMonthly ?? 0,
      priceAnnual: tier?.priceAnnual ?? 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
