/**
 * Broker Registration & Admin Approval Routes
 *
 * User-facing:
 *   POST   /api/broker-registration         — submit a registration
 *   GET    /api/broker-registration/me      — fetch current user registration
 *   PATCH  /api/broker-registration/me      — update pending registration
 *
 * Admin-facing (mounted separately at /api/admin/broker):
 *   GET    /registrations                   — paginated queue
 *   GET    /registrations/:id               — detail
 *   POST   /registrations/:id/approve       — approve + create profile (tx)
 *   POST   /registrations/:id/reject        — reject with reason
 *   POST   /registrations/:id/suspend       — suspend (and unpublish profile if any)
 */

import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { brokerRegistrations, brokerProfiles } from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function getUserContext(req: Request): { userId: string; orgId: string } | null {
  const user = (req as any).user || (req as any).session?.user;
  if (!user?.id) return null;
  const orgId =
    (req as any).user?.orgId ||
    (req as any).session?.user?.orgId ||
    (req as any).tenantId ||
    (req as any).orgId;
  if (!orgId) return null;
  return { userId: user.id, orgId };
}

function slugify(input: string): string {
  return (input || "broker")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

// Inline admin check (no requireAdmin middleware exists in server/middleware)
export function requireAdminInline(req: Request, res: Response, next: NextFunction) {
  const role =
    (req as any).user?.role ||
    (req as any).session?.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "admin_required", message: "Admin role required." });
  }
  next();
}

// ────────────────────────────────────────────────────────────────────────────
// User-facing router
// ────────────────────────────────────────────────────────────────────────────

export const brokerRegistrationRouter = Router();

brokerRegistrationRouter.post("/", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const {
      legalName,
      companyName,
      email,
      phone,
      licenseNumber,
      licenseState,
      licenseExpiresAt,
      licenseDocumentUrl,
      yearsExperience,
      specialties,
      bio,
      website,
      linkedinUrl,
    } = req.body || {};

    if (!legalName || !companyName || !email) {
      return res.status(400).json({
        error: "invalid_input",
        message: "legalName, companyName, and email are required.",
      });
    }

    // Check for an existing pending/approved row
    const existing = await db
      .select()
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.userId, ctx.userId))
      .orderBy(desc(brokerRegistrations.submittedAt));

    const blocking = existing.find(
      (r) => r.status === "pending" || r.status === "approved" || r.status === "suspended",
    );
    if (blocking) {
      return res.status(409).json({
        error: "registration_exists",
        message: `Existing registration in ${blocking.status} state.`,
        registration: blocking,
      });
    }

    // If last is rejected, mark prior as superseded
    const lastRejected = existing.find((r) => r.status === "rejected");
    if (lastRejected) {
      const priorReason = lastRejected.rejectionReason || "";
      await db
        .update(brokerRegistrations)
        .set({
          rejectionReason: `${priorReason}${priorReason ? " | " : ""}superseded by resubmission`,
          updatedAt: new Date(),
        })
        .where(eq(brokerRegistrations.id, lastRejected.id));
    }

    const [row] = await db
      .insert(brokerRegistrations)
      .values({
        userId: ctx.userId,
        orgId: ctx.orgId,
        legalName,
        companyName,
        email,
        phone: phone ?? null,
        licenseNumber: licenseNumber ?? null,
        licenseState: licenseState ?? null,
        licenseExpiresAt: licenseExpiresAt ?? null,
        licenseDocumentUrl: licenseDocumentUrl ?? null,
        yearsExperience: yearsExperience ?? null,
        specialties: specialties ?? null,
        bio: bio ?? null,
        website: website ?? null,
        linkedinUrl: linkedinUrl ?? null,
        status: "pending",
      })
      .returning();

    return res.status(201).json({ registration: row });
  } catch (err: any) {
    console.error("[broker-registration] POST / error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerRegistrationRouter.get("/me", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const rows = await db
      .select()
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.userId, ctx.userId))
      .orderBy(desc(brokerRegistrations.submittedAt));

    const current = rows[0] || null;
    return res.json({ registration: current });
  } catch (err: any) {
    console.error("[broker-registration] GET /me error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerRegistrationRouter.patch("/me", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const rows = await db
      .select()
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.userId, ctx.userId))
      .orderBy(desc(brokerRegistrations.submittedAt));
    const current = rows[0];
    if (!current) {
      return res.status(404).json({ error: "not_found", message: "No registration on file." });
    }
    if (current.status !== "pending") {
      return res.status(409).json({
        error: "not_editable",
        message: `Cannot edit a registration in state '${current.status}'.`,
      });
    }

    const allowed = [
      "legalName",
      "companyName",
      "email",
      "phone",
      "licenseNumber",
      "licenseState",
      "licenseExpiresAt",
      "licenseDocumentUrl",
      "yearsExperience",
      "specialties",
      "bio",
      "website",
      "linkedinUrl",
    ] as const;
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (key in (req.body || {})) updates[key] = req.body[key];
    }
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(brokerRegistrations)
      .set(updates)
      .where(eq(brokerRegistrations.id, current.id))
      .returning();

    return res.json({ registration: updated });
  } catch (err: any) {
    console.error("[broker-registration] PATCH /me error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Admin router
// ────────────────────────────────────────────────────────────────────────────

export const brokerAdminRouter = Router();

brokerAdminRouter.get("/registrations", async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || "pending");
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "25"), 10)));
    const offset = (page - 1) * pageSize;

    const whereExpr =
      status === "all"
        ? sql`true`
        : eq(brokerRegistrations.status, status);

    const items = await db
      .select()
      .from(brokerRegistrations)
      .where(whereExpr as any)
      .orderBy(desc(brokerRegistrations.submittedAt))
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brokerRegistrations)
      .where(whereExpr as any);

    return res.json({
      items,
      pagination: {
        page,
        pageSize,
        total: Number(count) || 0,
        totalPages: Math.max(1, Math.ceil((Number(count) || 0) / pageSize)),
      },
    });
  } catch (err: any) {
    console.error("[broker-admin] GET /registrations error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerAdminRouter.get("/registrations/:id", async (req: Request, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.id, req.params.id));
    if (!row) return res.status(404).json({ error: "not_found", message: "Registration not found." });

    const [profile] = await db
      .select()
      .from(brokerProfiles)
      .where(eq(brokerProfiles.registrationId, row.id));

    return res.json({ registration: row, profile: profile || null });
  } catch (err: any) {
    console.error("[broker-admin] GET /registrations/:id error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerAdminRouter.post("/registrations/:id/approve", async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).user || (req as any).session?.user;
    const { brokerTier } = req.body || {};

    const result = await db.transaction(async (tx) => {
      const [reg] = await tx
        .select()
        .from(brokerRegistrations)
        .where(eq(brokerRegistrations.id, req.params.id));
      if (!reg) {
        throw Object.assign(new Error("Registration not found."), { status: 404, code: "not_found" });
      }
      if (reg.status === "approved") {
        throw Object.assign(new Error("Already approved."), { status: 409, code: "already_approved" });
      }

      const [existingProfile] = await tx
        .select()
        .from(brokerProfiles)
        .where(eq(brokerProfiles.registrationId, reg.id));

      let profile = existingProfile;
      if (!profile) {
        const slug = `${slugify(reg.legalName)}-${randomSuffix()}`;
        const [inserted] = await tx
          .insert(brokerProfiles)
          .values({
            registrationId: reg.id,
            userId: reg.userId,
            orgId: reg.orgId,
            slug,
            displayName: reg.legalName,
            companyName: reg.companyName,
            bio: reg.bio,
            specialties: reg.specialties,
            yearsExperience: reg.yearsExperience,
            licenseNumber: reg.licenseNumber,
            licenseState: reg.licenseState,
            contactEmail: reg.email,
            contactPhone: reg.phone,
            website: reg.website,
            linkedinUrl: reg.linkedinUrl,
            brokerTier: brokerTier || "starter",
            isPublishable: false,
          })
          .returning();
        profile = inserted;
      }

      const [updatedReg] = await tx
        .update(brokerRegistrations)
        .set({
          status: "approved",
          reviewedBy: adminUser?.id || null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(brokerRegistrations.id, reg.id))
        .returning();

      return { registration: updatedReg, profile };
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[broker-admin] approve error:", err);
    return res
      .status(err?.status || 500)
      .json({ error: err?.code || "server_error", message: err?.message || "Server error" });
  }
});

brokerAdminRouter.post("/registrations/:id/reject", async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).user || (req as any).session?.user;
    const { reason } = req.body || {};
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "invalid_input", message: "reason is required." });
    }
    const [updated] = await db
      .update(brokerRegistrations)
      .set({
        status: "rejected",
        rejectionReason: reason,
        reviewedBy: adminUser?.id || null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(brokerRegistrations.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "not_found", message: "Registration not found." });
    return res.json({ registration: updated });
  } catch (err: any) {
    console.error("[broker-admin] reject error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerAdminRouter.post("/registrations/:id/suspend", async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).user || (req as any).session?.user;
    const { reason } = req.body || {};
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "invalid_input", message: "reason is required." });
    }

    const result = await db.transaction(async (tx) => {
      const [updatedReg] = await tx
        .update(brokerRegistrations)
        .set({
          status: "suspended",
          rejectionReason: reason,
          reviewedBy: adminUser?.id || null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(brokerRegistrations.id, req.params.id))
        .returning();
      if (!updatedReg) {
        throw Object.assign(new Error("Registration not found."), { status: 404, code: "not_found" });
      }

      await tx
        .update(brokerProfiles)
        .set({ isPublishable: false, updatedAt: new Date() })
        .where(eq(brokerProfiles.registrationId, updatedReg.id));

      return { registration: updatedReg };
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[broker-admin] suspend error:", err);
    return res
      .status(err?.status || 500)
      .json({ error: err?.code || "server_error", message: err?.message || "Server error" });
  }
});

export default brokerRegistrationRouter;
