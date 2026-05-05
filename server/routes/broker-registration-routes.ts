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
import { brokerRegistrations, brokerProfiles, users, crmNotifications, organizationUserRoles, brokerCredentialAudit, brokerRegistrationEvents } from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { verifyAndPersistLicense } from "../services/broker-license-verification";
import { sendEmail, wrapEmailTemplate, sendBrokerRereviewEmail } from "../services/email-service";

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

// ── Broker Profile Lookup Endpoints ─────────────────────────────────────────
// These resolve from broker_profiles (post-approval) rather than registrations.

brokerRegistrationRouter.get("/profile/by-user/:userId", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const targetUserId = req.params.userId;
    if (!targetUserId) return res.json({ profile: null });

    const rows = await db
      .select()
      .from(brokerProfiles)
      .where(
        and(
          eq(brokerProfiles.userId, targetUserId),
          eq(brokerProfiles.orgId, ctx.orgId),
        ),
      )
      .limit(1);

    if (!rows[0]) return res.json({ profile: null });

    const profile = rows[0];
    const regRows = await db
      .select({ licenseVerificationStatus: brokerRegistrations.licenseVerificationStatus })
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.id, profile.registrationId))
      .limit(1);

    return res.json({
      profile: {
        ...profile,
        licenseVerificationStatus: regRows[0]?.licenseVerificationStatus ?? "unverified",
      },
    });
  } catch (err: any) {
    console.error("[broker-registration] GET /profile/by-user error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerRegistrationRouter.get("/profile/:profileId", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const profileId = req.params.profileId;
    if (!profileId) return res.json({ profile: null });

    const rows = await db
      .select()
      .from(brokerProfiles)
      .where(
        and(
          eq(brokerProfiles.id, profileId),
          eq(brokerProfiles.orgId, ctx.orgId),
        ),
      )
      .limit(1);

    if (!rows[0]) return res.json({ profile: null });

    const profile = rows[0];
    const regRows = await db
      .select({ licenseVerificationStatus: brokerRegistrations.licenseVerificationStatus })
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.id, profile.registrationId))
      .limit(1);

    return res.json({
      profile: {
        ...profile,
        licenseVerificationStatus: regRows[0]?.licenseVerificationStatus ?? "unverified",
      },
    });
  } catch (err: any) {
    console.error("[broker-registration] GET /profile/:profileId error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerRegistrationRouter.get("/profile/by-email", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
    if (!email) return res.json({ profile: null });

    const rows = await db
      .select()
      .from(brokerProfiles)
      .where(
        and(
          eq(brokerProfiles.contactEmail, email),
          eq(brokerProfiles.orgId, ctx.orgId),
        ),
      )
      .limit(1);

    if (!rows[0]) return res.json({ profile: null });

    const profile = rows[0];
    const regRows = await db
      .select({ licenseVerificationStatus: brokerRegistrations.licenseVerificationStatus })
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.id, profile.registrationId))
      .limit(1);

    return res.json({
      profile: {
        ...profile,
        licenseVerificationStatus: regRows[0]?.licenseVerificationStatus ?? "unverified",
      },
    });
  } catch (err: any) {
    console.error("[broker-registration] GET /profile/by-email error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

// ── Registration Lookup Endpoints (fall-back when no profile exists yet) ─────

brokerRegistrationRouter.get("/by-user/:userId", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const targetUserId = req.params.userId;
    if (!targetUserId) return res.json({ registration: null });

    const rows = await db
      .select()
      .from(brokerRegistrations)
      .where(
        and(
          eq(brokerRegistrations.userId, targetUserId),
          eq(brokerRegistrations.orgId, ctx.orgId),
        ),
      )
      .orderBy(desc(brokerRegistrations.submittedAt))
      .limit(1);

    const current = rows[0] || null;
    return res.json({ registration: current });
  } catch (err: any) {
    console.error("[broker-registration] GET /by-user error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerRegistrationRouter.get("/by-email", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.json({ registration: null });

    const rows = await db
      .select()
      .from(brokerRegistrations)
      .where(
        and(
          sql`lower(${brokerRegistrations.email}) = ${email}`,
          eq(brokerRegistrations.orgId, ctx.orgId),
        ),
      )
      .orderBy(desc(brokerRegistrations.submittedAt));

    const current = rows.find((r) => r.status !== "rejected") || rows[0] || null;
    return res.json({ registration: current });
  } catch (err: any) {
    console.error("[broker-registration] GET /by-email error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

brokerRegistrationRouter.post("/", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Not authenticated." });

    const {
      legalFirstName,
      legalLastName,
      legalName: rawLegalName,
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

    const legalName =
      rawLegalName ||
      (legalFirstName && legalLastName
        ? `${legalFirstName.trim()} ${legalLastName.trim()}`
        : legalFirstName?.trim() || legalLastName?.trim() || null);

    if (!legalName || !companyName || !email) {
      return res.status(400).json({
        error: "invalid_input",
        message: "Legal name, companyName, and email are required.",
      });
    }

    if (!licenseNumber || !licenseState || !licenseExpiresAt) {
      return res.status(400).json({
        error: "invalid_input",
        message: "licenseNumber, licenseState, and licenseExpiresAt are required.",
      });
    }

    const expiryDate = new Date(licenseExpiresAt);
    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      return res.status(400).json({
        error: "invalid_input",
        message: "licenseExpiresAt must be a valid future date.",
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
        legalFirstName: legalFirstName?.trim() || null,
        legalLastName: legalLastName?.trim() || null,
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

    // Fire-and-forget license verification — does not block the response
    if (row?.id && licenseNumber && licenseState) {
      verifyAndPersistLicense(row.id, {
        licenseNumber,
        licenseState,
        legalName,
      }).catch((err) =>
        console.error("[broker-registration] background verify error:", err),
      );
    }

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

    const editableStatuses = ["pending", "approved", "suspended"];
    if (!editableStatuses.includes(current.status)) {
      return res.status(409).json({
        error: "not_editable",
        message: `Cannot edit a registration in state '${current.status}'.`,
      });
    }

    // Pending registrations allow all fields; approved/suspended only allow credential fields
    const credentialFields = [
      "legalFirstName",
      "legalLastName",
      "legalName",
      "companyName",
      "licenseNumber",
      "licenseState",
      "licenseExpiresAt",
      "licenseDocumentUrl",
    ] as const;

    const allFields = [
      ...credentialFields,
      "email",
      "phone",
      "yearsExperience",
      "specialties",
      "bio",
      "website",
      "linkedinUrl",
    ] as const;

    const allowed = current.status === "pending" ? allFields : credentialFields;

    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (key in (req.body || {})) updates[key] = req.body[key];
    }

    // Recompute legalName if first/last names are being updated
    if ("legalFirstName" in updates || "legalLastName" in updates) {
      const firstName = updates.legalFirstName ?? current.legalFirstName ?? "";
      const lastName = updates.legalLastName ?? current.legalLastName ?? "";
      if (firstName || lastName) {
        updates.legalName = `${firstName} ${lastName}`.trim();
      }
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(brokerRegistrations)
      .set(updates)
      .where(eq(brokerRegistrations.id, current.id))
      .returning();

    // ── Audit log: write one row per changed credential field ─────────────────
    if (current.status === "approved" || current.status === "suspended") {
      const auditableFields = [
        "legalFirstName",
        "legalLastName",
        "legalName",
        "companyName",
        "licenseNumber",
        "licenseState",
        "licenseExpiresAt",
        "licenseDocumentUrl",
      ] as const;

      function normalizeAuditValue(value: unknown): string | null {
        if (value == null) return null;
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        const s = String(value);
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
        return s || null;
      }

      const auditRows = auditableFields
        .filter((field) => field in updates)
        .map((field) => ({
          registrationId: current.id,
          changedBy: ctx.userId,
          fieldName: field,
          oldValue: normalizeAuditValue((current as Record<string, unknown>)[field]),
          newValue: normalizeAuditValue(updates[field]),
        }))
        .filter((row) => row.oldValue !== row.newValue);

      if (auditRows.length > 0) {
        await db.insert(brokerCredentialAudit).values(auditRows);
      }
    }

    // Propagate credential changes to the linked broker_profiles row if it exists
    const profileUpdates: Record<string, any> = {};
    if ("legalName" in updates) profileUpdates.displayName = updated.legalName;
    if ("legalFirstName" in updates) profileUpdates.legalFirstName = updated.legalFirstName;
    if ("legalLastName" in updates) profileUpdates.legalLastName = updated.legalLastName;
    if ("companyName" in updates) profileUpdates.companyName = updated.companyName;
    if ("licenseNumber" in updates) profileUpdates.licenseNumber = updated.licenseNumber;
    if ("licenseState" in updates) profileUpdates.licenseState = updated.licenseState;

    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updatedAt = new Date();
      await db
        .update(brokerProfiles)
        .set(profileUpdates)
        .where(eq(brokerProfiles.registrationId, current.id));
    }

    // Notify admins when an approved/suspended broker changes credential fields
    if (current.status === "approved" || current.status === "suspended") {
      const credentialFieldLabels: Record<string, string> = {
        legalFirstName: "First name",
        legalLastName: "Last name",
        legalName: "Legal name",
        companyName: "Company name",
        licenseNumber: "License number",
        licenseState: "License state",
        licenseExpiresAt: "License expiry date",
        licenseDocumentUrl: "License document",
      };

      // Normalize a value to a comparable string; dates are reduced to ISO date strings
      // so that semantically equal dates (e.g. Date object vs. ISO string) don't produce
      // false-positive change alerts.
      function normalizeForComparison(value: unknown): string {
        if (value == null) return "";
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        const s = String(value);
        // If the value looks like a full ISO timestamp, keep only the date portion
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
        return s;
      }

      const currentCredentialSnapshot: Record<typeof credentialFields[number], unknown> = {
        legalFirstName: current.legalFirstName,
        legalLastName: current.legalLastName,
        legalName: current.legalName,
        companyName: current.companyName,
        licenseNumber: current.licenseNumber,
        licenseState: current.licenseState,
        licenseExpiresAt: current.licenseExpiresAt,
        licenseDocumentUrl: current.licenseDocumentUrl,
      };

      const changedCredentials = credentialFields.filter(
        (field) =>
          field in updates &&
          normalizeForComparison(updates[field]) !== normalizeForComparison(currentCredentialSnapshot[field]),
      );

      if (changedCredentials.length > 0) {
        const changedLabels = changedCredentials
          .map((f) => credentialFieldLabels[f] || f)
          .join(", ");
        const brokerName = updated.legalName || `${updated.legalFirstName ?? ""} ${updated.legalLastName ?? ""}`.trim() || updated.email;
        const adminDetailPath = `/admin/broker/registrations/${current.id}`;

        // Fire-and-forget: notification failures must not roll back the already-committed update
        Promise.resolve().then(async () => {
          try {
            const adminRoleRows = await db
              .select({ userId: organizationUserRoles.userId })
              .from(organizationUserRoles)
              .where(
                and(
                  eq(organizationUserRoles.orgId, ctx.orgId),
                  eq(organizationUserRoles.isActive, true),
                  inArray(organizationUserRoles.role, ["admin", "owner"]),
                ),
              );

            const adminUserIds = [...new Set(adminRoleRows.map((r) => r.userId))];

            const adminUsers = adminUserIds.length > 0
              ? await db
                  .select({ id: users.id, email: users.email, name: users.name })
                  .from(users)
                  .where(inArray(users.id, adminUserIds))
              : [];

            if (adminUsers.length > 0) {
              const APP_URL = process.env.APP_URL || "https://vantage.com";
              const reviewUrl = `${APP_URL}${adminDetailPath}`;

              await Promise.all(
                adminUsers.map((admin) =>
                  db.insert(crmNotifications).values({
                    orgId: ctx.orgId,
                    userId: admin.id,
                    type: "broker_credential_update",
                    title: `Broker credentials updated: ${brokerName}`,
                    message: `Broker ${brokerName} (${current.status}) updated the following credential fields: ${changedLabels}. Please reverify before they continue publishing listings. Review at ${adminDetailPath}`,
                    entityType: "broker_registration",
                    entityId: current.id,
                    triggeredBy: ctx.userId,
                    metadata: {
                      brokerName,
                      changedFields: changedCredentials,
                      registrationStatus: current.status,
                      adminDetailPath,
                    },
                  }),
                ),
              );

              // Also send an email to each admin (fire-and-forget within fire-and-forget)
              const emailSubject = `Action required: Broker credentials updated — ${brokerName}`;
              const emailText = [
                `Hello${' '}Admin,`,
                ``,
                `Broker ${brokerName} (status: ${current.status}) has updated their credentials.`,
                ``,
                `Changed fields: ${changedLabels}`,
                ``,
                `Please reverify this broker before they continue publishing listings.`,
                ``,
                `Review the registration: ${reviewUrl}`,
                ``,
                `— The Vantage Team`,
              ].join("\n");
              const emailHtml = wrapEmailTemplate(`
                <h2 style="margin-top: 0; color: #1e293b;">Broker Credentials Updated</h2>
                <p>Hello Admin,</p>
                <p>
                  Broker <strong>${brokerName}</strong>
                  (status: <strong>${current.status}</strong>)
                  has updated their credentials and may require reverification before continuing to publish listings.
                </p>
                <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
                  <tr>
                    <td style="padding: 8px; background:#f1f5f9; font-weight:600; border-radius:4px 0 0 4px; width:40%;">Changed fields</td>
                    <td style="padding: 8px; background:#f8fafc; border-radius:0 4px 4px 0;">${changedLabels}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background:#f1f5f9; font-weight:600; border-radius:4px 0 0 4px;">Registration status</td>
                    <td style="padding: 8px; background:#f8fafc; border-radius:0 4px 4px 0;">${current.status}</td>
                  </tr>
                </table>
                <div style="text-align:center; margin: 32px 0;">
                  <a href="${reviewUrl}" style="background: linear-gradient(135deg, #0891b2, #2563eb); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Review Registration</a>
                </div>
                <p style="color:#64748b; font-size:14px;">Please reverify the broker's credentials before they continue publishing listings.</p>
              `);

              await Promise.all(
                adminUsers.map((admin) =>
                  sendEmail({
                    to: admin.email,
                    subject: emailSubject,
                    text: emailText,
                    html: emailHtml,
                  }).catch((emailErr) => {
                    console.error(
                      `[broker-registration] email to admin ${admin.email} failed:`,
                      emailErr,
                    );
                  }),
                ),
              );
            }
          } catch (notifyErr) {
            console.error("[broker-registration] admin credential-change notification failed:", notifyErr);
          }
        });
      }
    }

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
            legalFirstName: reg.legalFirstName ?? null,
            legalLastName: reg.legalLastName ?? null,
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

      await tx.insert(brokerRegistrationEvents).values({
        registrationId: reg.id,
        eventType: "approved",
        fromStatus: reg.status,
        toStatus: "approved",
        actorId: adminUser?.id || null,
        reason: null,
        metadata: { brokerTier: brokerTier || "starter" },
      });

      return { registration: updatedReg, profile };
    });

    // Fire-and-forget license re-verification on admin approval
    const approvedReg = result.registration;
    if (approvedReg?.id && approvedReg.licenseNumber && approvedReg.licenseState) {
      verifyAndPersistLicense(approvedReg.id, {
        licenseNumber: approvedReg.licenseNumber,
        licenseState: approvedReg.licenseState,
        legalName: approvedReg.legalName,
      }).catch((err) =>
        console.error("[broker-admin] background verify on approve error:", err),
      );
    }

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
    const existing = await db
      .select({ status: brokerRegistrations.status })
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.id, req.params.id))
      .limit(1);
    const fromStatus = existing[0]?.status ?? null;

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

    await db.insert(brokerRegistrationEvents).values({
      registrationId: updated.id,
      eventType: "rejected",
      fromStatus,
      toStatus: "rejected",
      actorId: adminUser?.id || null,
      reason,
      metadata: null,
    });

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
      const [currentReg] = await tx
        .select({ status: brokerRegistrations.status })
        .from(brokerRegistrations)
        .where(eq(brokerRegistrations.id, req.params.id))
        .limit(1);
      const fromStatus = currentReg?.status ?? null;

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

      await tx.insert(brokerRegistrationEvents).values({
        registrationId: updatedReg.id,
        eventType: "suspended",
        fromStatus,
        toStatus: "suspended",
        actorId: adminUser?.id || null,
        reason,
        metadata: null,
      });

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

// ── Request re-review (admin flags approved broker for re-verification) ───────

brokerAdminRouter.post("/registrations/:id/request-rereview", async (req: Request, res: Response) => {
  try {
    const result = await db.transaction(async (tx) => {
      const [reg] = await tx
        .select()
        .from(brokerRegistrations)
        .where(eq(brokerRegistrations.id, req.params.id));

      if (!reg) {
        throw Object.assign(new Error("Registration not found."), { status: 404, code: "not_found" });
      }
      if (reg.status !== "approved") {
        throw Object.assign(
          new Error("Only approved registrations can be flagged for re-review."),
          { status: 409, code: "invalid_state" },
        );
      }

      // Enforce that credentials were updated after the last review
      if (
        !reg.updatedAt ||
        !reg.reviewedAt ||
        new Date(reg.updatedAt) <= new Date(reg.reviewedAt)
      ) {
        throw Object.assign(
          new Error("Credentials have not been updated since the last review. No re-review needed."),
          { status: 409, code: "no_credential_change" },
        );
      }

      const adminUser = (req as any).user || (req as any).session?.user;

      const [updatedReg] = await tx
        .update(brokerRegistrations)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(brokerRegistrations.id, reg.id))
        .returning();

      await tx
        .update(brokerProfiles)
        .set({ isPublishable: false, updatedAt: new Date() })
        .where(eq(brokerProfiles.registrationId, reg.id));

      await tx.insert(brokerRegistrationEvents).values({
        registrationId: reg.id,
        eventType: "rereview_requested",
        fromStatus: reg.status,
        toStatus: "pending",
        actorId: adminUser?.id || null,
        reason: (req.body || {}).reason || null,
        metadata: null,
      });

      return { registration: updatedReg };
    });

    // Fire-and-forget: notify the broker by email that their profile was flagged for re-review
    const updatedReg = result.registration;
    const brokerEmail = updatedReg.email;
    const brokerName =
      updatedReg.legalName ||
      `${updatedReg.legalFirstName ?? ""} ${updatedReg.legalLastName ?? ""}`.trim() ||
      brokerEmail;

    if (brokerEmail) {
      sendBrokerRereviewEmail(brokerEmail, brokerName)
        .then((sent) => {
          if (!sent) {
            console.warn("[broker-admin] request-rereview: email not delivered to", brokerEmail);
          }
        })
        .catch((err) =>
          console.error("[broker-admin] request-rereview email error:", err),
        );
    }

    return res.json(result);
  } catch (err: any) {
    console.error("[broker-admin] request-rereview error:", err);
    return res
      .status(err?.status || 500)
      .json({ error: err?.code || "server_error", message: err?.message || "Server error" });
  }
});

// ── Registration event history ────────────────────────────────────────────────

brokerAdminRouter.get("/registrations/:id/events", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(brokerRegistrationEvents)
      .where(eq(brokerRegistrationEvents.registrationId, req.params.id))
      .orderBy(desc(brokerRegistrationEvents.createdAt));
    return res.json({ events: rows });
  } catch (err: any) {
    console.error("[broker-admin] GET /registrations/:id/events error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

// ── Credential audit log ──────────────────────────────────────────────────────

brokerAdminRouter.get("/registrations/:id/audit", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(brokerCredentialAudit)
      .where(eq(brokerCredentialAudit.registrationId, req.params.id))
      .orderBy(desc(brokerCredentialAudit.changedAt));
    return res.json({ audit: rows });
  } catch (err: any) {
    console.error("[broker-admin] GET /registrations/:id/audit error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

// ── Manual re-verification trigger ───────────────────────────────────────────

brokerAdminRouter.post("/registrations/:id/reverify", async (req: Request, res: Response) => {
  try {
    const [reg] = await db
      .select()
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.id, req.params.id));
    if (!reg) {
      return res.status(404).json({ error: "not_found", message: "Registration not found." });
    }
    if (!reg.licenseNumber || !reg.licenseState) {
      return res.status(400).json({
        error: "invalid_input",
        message: "Registration has no licenseNumber or licenseState to verify.",
      });
    }

    const result = await verifyAndPersistLicense(reg.id, {
      licenseNumber: reg.licenseNumber,
      licenseState: reg.licenseState,
      legalName: reg.legalName,
    });

    const [updated] = await db
      .select()
      .from(brokerRegistrations)
      .where(eq(brokerRegistrations.id, reg.id));

    return res.json({ registration: updated, verificationResult: result });
  } catch (err: any) {
    console.error("[broker-admin] reverify error:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Server error" });
  }
});

export default brokerRegistrationRouter;
