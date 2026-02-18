import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { db } from "../../db";
import { users, organizations, subscriptions, adminAuditLog, customerNotes } from "@shared/schema";
import { eq, and, or, ilike, sql, desc, asc, count, sum } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const requireAdmin = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user || (user.role !== 'owner' && !user.isAdmin)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.use(requireAdmin);

router.post("/invite", async (req, res) => {
  try {
    const { email, name, orgId, role } = req.body;

    if (!email || !name || !orgId || !role) {
      return res.status(400).json({ error: "email, name, orgId, and role are required" });
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (existingUser) {
      return res.status(400).json({ error: "A user with this email already exists" });
    }

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const tempPassword = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        orgId,
        role: role as any,
        passwordHash: hashedPassword,
        isActive: true,
      })
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "user_invited",
      targetUserId: created.id,
      metadataJson: {
        email,
        name,
        orgId,
        orgName: org.name,
        role,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = created;
    res.json(userWithoutPassword);
  } catch (error) {
    logger.error({ error }, "Error inviting user");
    res.status(500).json({ error: "Failed to invite user" });
  }
});

router.get("/export", async (req, res) => {
  try {
    const { q, status, role, subStatus, planKey, sort = "joined_desc" } = req.query as Record<string, string | undefined>;

    const conditions: any[] = [];

    if (q) {
      const search = `%${q}%`;
      conditions.push(
        or(
          ilike(users.name, search),
          ilike(users.email, search),
          ilike(organizations.name, search)
        )
      );
    }

    if (status === "active") conditions.push(eq(users.isActive, true));
    if (status === "disabled") conditions.push(eq(users.isActive, false));

    if (role) conditions.push(eq(users.role, role as any));
    if (subStatus) conditions.push(eq(subscriptions.status, subStatus as any));
    if (planKey) conditions.push(eq(subscriptions.planKey, planKey));

    const parseSortParam = (s: string | undefined) => {
      if (!s) return desc(users.createdAt);
      const [field, direction] = s.includes(":") ? s.split(":") : [s, "desc"];
      const isAsc = direction === "asc";
      switch (field) {
        case "mrrCents": case "mrr": return isAsc ? asc(subscriptions.mrrCents) : desc(subscriptions.mrrCents);
        case "lastLoginAt": case "last_login": return isAsc ? asc(users.lastLoginAt) : desc(users.lastLoginAt);
        case "name": return isAsc ? asc(users.name) : desc(users.name);
        case "createdAt": case "joined": default: return isAsc ? asc(users.createdAt) : desc(users.createdAt);
      }
    };
    const orderBy = parseSortParam(sort);

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        orgId: users.orgId,
        orgName: organizations.name,
        planName: subscriptions.planName,
        subStatus: subscriptions.status,
        interval: subscriptions.interval,
        mrrCents: subscriptions.mrrCents,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(users)
      .leftJoin(organizations, eq(users.orgId, organizations.id))
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy);

    const escape = (val: any) => {
      if (val == null) return "";
      const s = String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = "Name,Email,Phone,Organization,Role,Status,Date Joined,Last Login,Plan,Sub Status,Interval,MRR ($),Next Billing";
    const csvRows = rows.map(r => [
      escape(r.name),
      escape(r.email),
      escape(r.phone),
      escape(r.orgName),
      escape(r.role),
      r.isActive ? "Active" : "Disabled",
      r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "",
      r.lastLoginAt ? new Date(r.lastLoginAt).toISOString().split("T")[0] : "",
      escape(r.planName),
      escape(r.subStatus),
      escape(r.interval),
      r.mrrCents != null ? (r.mrrCents / 100).toFixed(2) : "",
      r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toISOString().split("T")[0] : "",
    ].join(","));

    const csv = [header, ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=customers-export.csv");
    res.send(csv);
  } catch (error) {
    logger.error({ error }, "Error exporting customers CSV");
    res.status(500).json({ error: "Failed to export customers" });
  }
});

router.get("/", async (req, res) => {
  try {
    const {
      q,
      status,
      role,
      subStatus,
      planKey,
      sort = "joined_desc",
      page = "1",
      pageSize = "25",
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const size = Math.max(1, Math.min(100, parseInt(pageSize || "25", 10)));
    const offset = (pageNum - 1) * size;

    const conditions: any[] = [];

    if (q) {
      const search = `%${q}%`;
      conditions.push(
        or(
          ilike(users.name, search),
          ilike(users.email, search),
          ilike(organizations.name, search)
        )
      );
    }

    if (status === "active") conditions.push(eq(users.isActive, true));
    if (status === "disabled") conditions.push(eq(users.isActive, false));

    if (role) conditions.push(eq(users.role, role as any));
    if (subStatus) conditions.push(eq(subscriptions.status, subStatus as any));
    if (planKey) conditions.push(eq(subscriptions.planKey, planKey));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const parseSortParam = (s: string | undefined) => {
      if (!s) return desc(users.createdAt);
      const [field, direction] = s.includes(":") ? s.split(":") : [s, "desc"];
      const isAsc = direction === "asc";
      switch (field) {
        case "mrrCents": case "mrr": return isAsc ? asc(subscriptions.mrrCents) : desc(subscriptions.mrrCents);
        case "lastLoginAt": case "last_login": return isAsc ? asc(users.lastLoginAt) : desc(users.lastLoginAt);
        case "name": return isAsc ? asc(users.name) : desc(users.name);
        case "createdAt": case "joined": default: return isAsc ? asc(users.createdAt) : desc(users.createdAt);
      }
    };
    const orderBy = parseSortParam(sort);

    const [rows, totalResult, totalsResult] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          orgId: users.orgId,
          orgName: organizations.name,
          planName: subscriptions.planName,
          subStatus: subscriptions.status,
          interval: subscriptions.interval,
          mrrCents: subscriptions.mrrCents,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
        })
        .from(users)
        .leftJoin(organizations, eq(users.orgId, organizations.id))
        .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
        .where(whereClause)
        .orderBy(orderBy)
        .limit(size)
        .offset(offset),

      db
        .select({ total: count() })
        .from(users)
        .leftJoin(organizations, eq(users.orgId, organizations.id))
        .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
        .where(whereClause),

      db
        .select({
          customers: count(),
          activeSubs: sql<number>`count(*) filter (where ${subscriptions.status} = 'active')`.as("active_subs"),
          trialing: sql<number>`count(*) filter (where ${subscriptions.status} = 'trialing')`.as("trialing"),
          pastDue: sql<number>`count(*) filter (where ${subscriptions.status} = 'past_due')`.as("past_due"),
          mrrCents: sql<number>`coalesce(sum(${subscriptions.mrrCents}), 0)`.as("mrr_cents"),
        })
        .from(users)
        .leftJoin(organizations, eq(users.orgId, organizations.id))
        .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
        .where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;
    const totals = totalsResult[0] ?? { customers: 0, activeSubs: 0, trialing: 0, pastDue: 0, mrrCents: 0 };

    res.json({
      rows,
      totals,
      pagination: {
        page: pageNum,
        pageSize: size,
        totalPages: Math.ceil(Number(total) / size),
        total: Number(total),
      },
    });
  } catch (error) {
    logger.error({ error }, "Error listing customers");
    res.status(500).json({ error: "Failed to list customers" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [customer] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        orgId: users.orgId,
        orgName: organizations.name,
        planName: subscriptions.planName,
        subStatus: subscriptions.status,
        interval: subscriptions.interval,
        mrrCents: subscriptions.mrrCents,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        currentPeriodStart: subscriptions.currentPeriodStart,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        provider: subscriptions.provider,
        providerCustomerId: subscriptions.providerCustomerId,
        providerSubscriptionId: subscriptions.providerSubscriptionId,
      })
      .from(users)
      .leftJoin(organizations, eq(users.orgId, organizations.id))
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .where(eq(users.id, id));

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    let usageMetrics = {
      models_count: 0,
      deals_count: 0,
      sales_comps_count: 0,
      dd_projects_count: 0,
      documents_count: 0,
      contacts_count: 0,
    };

    const [notes, auditEntries] = await Promise.all([
      db
        .select()
        .from(customerNotes)
        .where(eq(customerNotes.userId, id))
        .orderBy(desc(customerNotes.createdAt)),
      db
        .select()
        .from(adminAuditLog)
        .where(eq(adminAuditLog.targetUserId, id))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(20),
    ]);

    if (customer.orgId) {
      try {
        const result = await db.execute(sql`
          SELECT 
            (SELECT COUNT(*)::int FROM modeling_project_config WHERE org_id = ${customer.orgId}) as models_count,
            (SELECT COUNT(*)::int FROM crm_deals WHERE org_id = ${customer.orgId}) as deals_count,
            (SELECT COUNT(*)::int FROM sales_comps WHERE org_id = ${customer.orgId}) as sales_comps_count,
            (SELECT COUNT(*)::int FROM dd_projects WHERE org_id = ${customer.orgId}) as dd_projects_count,
            (SELECT COUNT(*)::int FROM vdr_documents WHERE org_id = ${customer.orgId}) as documents_count,
            (SELECT COUNT(*)::int FROM crm_contacts WHERE org_id = ${customer.orgId}) as contacts_count
        `);
        if (result.rows && result.rows.length > 0) {
          const row = result.rows[0] as any;
          usageMetrics = {
            models_count: row.models_count ?? 0,
            deals_count: row.deals_count ?? 0,
            sales_comps_count: row.sales_comps_count ?? 0,
            dd_projects_count: row.dd_projects_count ?? 0,
            documents_count: row.documents_count ?? 0,
            contacts_count: row.contacts_count ?? 0,
          };
        }
      } catch (usageErr) {
        logger.warn({ error: usageErr }, "Failed to fetch usage metrics, returning zeros");
      }
    }

    res.json({
      ...customer,
      notes,
      auditLog: auditEntries,
      usage: usageMetrics,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching customer detail");
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

router.post("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== "active" && status !== "disabled") {
      return res.status(400).json({ error: "Status must be 'active' or 'disabled'" });
    }

    const [existing] = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, id));

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const newIsActive = status === "active";
    const previousStatus = existing.isActive ? "active" : "disabled";

    const [updated] = await db
      .update(users)
      .set({ isActive: newIsActive })
      .where(eq(users.id, id))
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "user_status_change",
      targetUserId: id,
      metadataJson: { previousStatus, newStatus: status },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, "Error toggling customer status");
    res.status(500).json({ error: "Failed to update customer status" });
  }
});

router.post("/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const { note, tags } = req.body;

    if (!note || typeof note !== "string" || note.trim().length === 0) {
      return res.status(400).json({ error: "Note text is required" });
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id));

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const [created] = await db
      .insert(customerNotes)
      .values({
        userId: id,
        adminUserId: req.user.id,
        note: note.trim(),
        tags: Array.isArray(tags) ? tags : [],
      })
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "customer_note_added",
      targetUserId: id,
      metadataJson: { noteId: created.id },
    });

    res.json(created);
  } catch (error) {
    logger.error({ error }, "Error adding customer note");
    res.status(500).json({ error: "Failed to add customer note" });
  }
});

router.post("/:id/subscription/cancel", async (req, res) => {
  try {
    const { id } = req.params;

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, id));

    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const [updated] = await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, status: "canceled", updatedAt: new Date() })
      .where(eq(subscriptions.userId, id))
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "subscription_canceled",
      targetUserId: id,
      metadataJson: { subscriptionId: sub.id, previousStatus: sub.status },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, "Error canceling subscription");
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

router.post("/:id/subscription/reactivate", async (req, res) => {
  try {
    const { id } = req.params;

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, id));

    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const [updated] = await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: false, status: "active", updatedAt: new Date() })
      .where(eq(subscriptions.userId, id))
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "subscription_reactivated",
      targetUserId: id,
      metadataJson: { subscriptionId: sub.id, previousStatus: sub.status },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, "Error reactivating subscription");
    res.status(500).json({ error: "Failed to reactivate subscription" });
  }
});

router.post("/:id/subscription/extend-trial", async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 14 } = req.body;

    const numDays = Math.min(Math.max(1, Number(days) || 14), 90);

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, id));

    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    if (sub.status !== "trialing") {
      return res.status(400).json({ error: "Can only extend trial for subscriptions with 'trialing' status" });
    }

    const currentEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : new Date();
    currentEnd.setDate(currentEnd.getDate() + numDays);

    const [updated] = await db
      .update(subscriptions)
      .set({ currentPeriodEnd: currentEnd, updatedAt: new Date() })
      .where(eq(subscriptions.userId, id))
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "trial_extended",
      targetUserId: id,
      metadataJson: { subscriptionId: sub.id, daysAdded: numDays, newPeriodEnd: currentEnd.toISOString() },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, "Error extending trial");
    res.status(500).json({ error: "Failed to extend trial" });
  }
});

router.post("/:id/subscription/change-plan", async (req, res) => {
  try {
    const { id } = req.params;
    const { planKey, planName, interval, mrrCents } = req.body;

    if (!planKey || !planName) {
      return res.status(400).json({ error: "planKey and planName are required" });
    }

    if (interval && interval !== "month" && interval !== "year") {
      return res.status(400).json({ error: "interval must be 'month' or 'year'" });
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, id));

    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const oldPlan = { planKey: sub.planKey, planName: sub.planName, interval: sub.interval, mrrCents: sub.mrrCents };

    const updateData: any = { planKey, planName, updatedAt: new Date() };
    if (interval) updateData.interval = interval;
    if (mrrCents !== undefined) updateData.mrrCents = Number(mrrCents);

    const [updated] = await db
      .update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.userId, id))
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "plan_changed",
      targetUserId: id,
      metadataJson: {
        subscriptionId: sub.id,
        oldPlan,
        newPlan: { planKey, planName, interval: interval || sub.interval, mrrCents: mrrCents !== undefined ? Number(mrrCents) : sub.mrrCents },
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, "Error changing plan");
    res.status(500).json({ error: "Failed to change plan" });
  }
});

router.post("/:id/resend-verification", async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, id));

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await db
      .update(users)
      .set({ emailVerified: false })
      .where(eq(users.id, id));

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "verification_resent",
      targetUserId: id,
      metadataJson: {
        email: existing.email,
        name: existing.name,
      },
    });

    res.json({ success: true, message: "Verification email queued for resend" });
  } catch (error) {
    logger.error({ error }, "Error resending verification");
    res.status(500).json({ error: "Failed to resend verification" });
  }
});

router.post("/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, id));

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const resetToken = crypto.randomUUID();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "password_reset_initiated",
      targetUserId: id,
      metadataJson: {
        email: existing.email,
        name: existing.name,
        resetToken,
      },
    });

    res.json({ success: true, message: "Password reset link has been generated" });
  } catch (error) {
    logger.error({ error }, "Error initiating password reset");
    res.status(500).json({ error: "Failed to initiate password reset" });
  }
});

router.get("/audit-trail", async (req, res) => {
  try {
    const { action, page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const size = Math.max(1, Math.min(100, parseInt(pageSize || "50", 10)));
    const offset = (pageNum - 1) * size;

    const conditions: any[] = [];
    if (action) conditions.push(eq(adminAuditLog.action, action));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.execute(sql`
      SELECT 
        a.id, a.action, a.metadata_json, a.created_at,
        a.admin_user_id, admin_u.name as admin_name, admin_u.email as admin_email,
        a.target_user_id, target_u.name as target_name, target_u.email as target_email
      FROM admin_audit_log a
      LEFT JOIN users admin_u ON admin_u.id = a.admin_user_id
      LEFT JOIN users target_u ON target_u.id = a.target_user_id
      ${action ? sql`WHERE a.action = ${action}` : sql``}
      ORDER BY a.created_at DESC
      LIMIT ${size} OFFSET ${offset}
    `);

    const [totalResult] = await db.select({ total: count() }).from(adminAuditLog)
      .where(whereClause);

    res.json({
      rows: rows.rows,
      pagination: {
        page: pageNum,
        pageSize: size,
        totalPages: Math.ceil(Number(totalResult?.total ?? 0) / size),
        total: Number(totalResult?.total ?? 0),
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching audit trail");
    res.status(500).json({ error: "Failed to fetch audit trail" });
  }
});

export default router;
