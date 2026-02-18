import { Router } from "express";
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

    res.json({
      ...customer,
      notes,
      auditLog: auditEntries,
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

export default router;
