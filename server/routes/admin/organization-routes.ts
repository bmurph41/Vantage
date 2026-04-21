import { Router } from "express";
import { db } from "../../db";
import { users, organizations, subscriptions, adminAuditLog, organizationPacks } from "@shared/schema";
import { eq, and, or, ilike, sql, desc, asc, count } from "drizzle-orm";
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

router.get("/", async (req, res) => {
  try {
    const {
      q,
      sort = "createdAt:desc",
      page = "1",
      pageSize = "25",
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const size = Math.max(1, Math.min(100, parseInt(pageSize || "25", 10)));
    const offset = (pageNum - 1) * size;

    const conditions: any[] = [];

    if (q) {
      const search = `%${q}%`;
      conditions.push(ilike(organizations.name, search));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const parseSortParam = (s: string | undefined) => {
      if (!s) return desc(organizations.createdAt);
      const [field, direction] = s.includes(":") ? s.split(":") : [s, "desc"];
      const isAsc = direction === "asc";
      switch (field) {
        case "name": return isAsc ? asc(organizations.name) : desc(organizations.name);
        case "createdAt": default: return isAsc ? asc(organizations.createdAt) : desc(organizations.createdAt);
      }
    };
    const orderBy = parseSortParam(sort);

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          ssoEnabled: organizations.ssoEnabled,
          mfaRequired: organizations.mfaRequired,
          benchmarkOptIn: organizations.benchmarkOptIn,
          createdAt: organizations.createdAt,
          memberCount: sql<number>`count(distinct ${users.id})`.as("member_count"),
          planName: subscriptions.planName,
          subStatus: subscriptions.status,
          mrrCents: subscriptions.mrrCents,
          interval: subscriptions.interval,
        })
        .from(organizations)
        .leftJoin(users, eq(users.orgId, organizations.id))
        .leftJoin(subscriptions, eq(subscriptions.orgId, organizations.id))
        .where(whereClause)
        .groupBy(organizations.id, subscriptions.planName, subscriptions.status, subscriptions.mrrCents, subscriptions.interval)
        .orderBy(orderBy)
        .limit(size)
        .offset(offset),

      db
        .select({ total: count() })
        .from(organizations)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;

    res.json({
      rows,
      pagination: {
        page: pageNum,
        pageSize: size,
        totalPages: Math.ceil(Number(total) / size),
        total: Number(total),
      },
    });
  } catch (error) {
    logger.error({ error }, "Error listing organizations");
    res.status(500).json({ error: "Failed to list organizations" });
  }
});

// GET /asset-class-audit — paginated asset_classes_updated events with org context.
// Must be declared BEFORE /:orgId to avoid the wildcard param swallowing it.
router.get("/asset-class-audit", async (req, res) => {
  try {
    const { page = "1", pageSize = "50", q } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const size = Math.max(1, Math.min(100, parseInt(pageSize || "50", 10)));
    const offset = (pageNum - 1) * size;
    const orgSearch = q?.trim() ?? "";

    const rows = await db.execute(sql`
      SELECT
        a.id,
        a.created_at,
        a.admin_user_id,
        u.name  AS user_name,
        u.email AS user_email,
        a.metadata_json,
        o.id    AS org_id,
        o.name  AS org_name
      FROM admin_audit_log a
      LEFT JOIN users         u ON u.id = a.admin_user_id
      LEFT JOIN organizations o ON o.id = (a.metadata_json->>'orgId')
      WHERE a.action = 'asset_classes_updated'
      ${orgSearch ? sql`AND o.name ILIKE ${"%" + orgSearch + "%"}` : sql``}
      ORDER BY a.created_at DESC
      LIMIT ${size} OFFSET ${offset}
    `);

    const totalRows = await db.execute(sql`
      SELECT count(*) AS total
      FROM admin_audit_log a
      LEFT JOIN organizations o ON o.id = (a.metadata_json->>'orgId')
      WHERE a.action = 'asset_classes_updated'
      ${orgSearch ? sql`AND o.name ILIKE ${"%" + orgSearch + "%"}` : sql``}
    `);
    const total = Number((totalRows.rows[0] as any)?.total ?? 0);

    res.json({
      rows: rows.rows,
      pagination: {
        page: pageNum,
        pageSize: size,
        totalPages: Math.ceil(total / size),
        total,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching asset class audit");
    res.status(500).json({ error: "Failed to fetch asset class audit" });
  }
});

router.get("/:orgId", async (req, res) => {
  try {
    const { orgId } = req.params;

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const [members, sub, packs] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(eq(users.orgId, orgId)),
      db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.orgId, orgId)),
      db
        .select()
        .from(organizationPacks)
        .where(eq(organizationPacks.orgId, orgId)),
    ]);

    res.json({
      ...org,
      members,
      subscription: sub[0] || null,
      packs,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching organization detail");
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

router.post("/:orgId/transfer-ownership", async (req, res) => {
  try {
    const { orgId } = req.params;
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ error: "newOwnerId is required" });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const [newOwner] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, newOwnerId), eq(users.orgId, orgId)));

    if (!newOwner) {
      return res.status(400).json({ error: "New owner must be a member of this organization" });
    }

    const [currentOwner] = await db
      .select()
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.role, "owner")));

    await db.transaction(async (tx) => {
      if (currentOwner) {
        await tx
          .update(users)
          .set({ role: "editor" })
          .where(eq(users.id, currentOwner.id));
      }

      await tx
        .update(users)
        .set({ role: "owner" })
        .where(eq(users.id, newOwnerId));

      await tx.insert(adminAuditLog).values({
        adminUserId: req.user.id,
        action: "ownership_transferred",
        targetUserId: newOwnerId,
        metadataJson: {
          orgId,
          orgName: org.name,
          previousOwnerId: currentOwner?.id || null,
          previousOwnerName: currentOwner?.name || null,
          newOwnerId,
          newOwnerName: newOwner.name,
        },
      });
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error transferring ownership");
    res.status(500).json({ error: "Failed to transfer ownership" });
  }
});

router.post("/:orgId/packs/grant", async (req, res) => {
  try {
    const { orgId } = req.params;
    const { packType, notes } = req.body;

    if (!packType) {
      return res.status(400).json({ error: "packType is required" });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const [created] = await db
      .insert(organizationPacks)
      .values({
        orgId,
        packType,
        status: "active",
        purchasedBy: req.user.id,
        notes: notes || null,
      })
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "pack_granted",
      metadataJson: {
        orgId,
        orgName: org.name,
        packType,
        packId: created.id,
        notes: notes || null,
      },
    });

    res.json(created);
  } catch (error) {
    logger.error({ error }, "Error granting pack");
    res.status(500).json({ error: "Failed to grant pack" });
  }
});

router.post("/:orgId/packs/revoke", async (req, res) => {
  try {
    const { orgId } = req.params;
    const { packType } = req.body;

    if (!packType) {
      return res.status(400).json({ error: "packType is required" });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const [updated] = await db
      .update(organizationPacks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(organizationPacks.orgId, orgId),
          eq(organizationPacks.packType, packType)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Pack not found for this organization" });
    }

    await db.insert(adminAuditLog).values({
      adminUserId: req.user.id,
      action: "pack_revoked",
      metadataJson: {
        orgId,
        orgName: org.name,
        packType,
        packId: updated.id,
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ error }, "Error revoking pack");
    res.status(500).json({ error: "Failed to revoke pack" });
  }
});

export default router;
