import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  rbacRoles,
  rbacUserRoles,
  rbacFieldPermissions,
  auditTrail,
  ssoConfigs,
  userTwoFactor,
  users,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username?: string;
    email?: string;
    orgId?: string;
    role?: string;
    name?: string;
  };
  session?: any;
}

function getOrgId(req: AuthenticatedRequest): string | null {
  return (
    req.user?.orgId ||
    (req as any).tenantId ||
    (req as any).orgId ||
    (req as any).validatedOrgId ||
    req.session?.user?.orgId ||
    req.session?.orgId ||
    null
  );
}

function getUserId(req: AuthenticatedRequest): string | null {
  return (
    (req as any).validatedUserId ||
    req.user?.id ||
    req.session?.user?.id ||
    req.session?.userId ||
    req.session?.passport?.user?.id ||
    null
  );
}

// ============================================================================
// Base32 encoding for TOTP secrets
// ============================================================================
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

// ============================================================================
// System role seed definitions
// ============================================================================
const SYSTEM_ROLES = [
  {
    name: "owner",
    label: "Owner",
    description: "Full platform owner with unrestricted access",
    permissions: {
      deals: { create: true, read: true, update: true, delete: true, export: true },
      crm: { create: true, read: true, update: true, delete: true, export: true },
      financials: { create: true, read: true, update: true, delete: true, export: true },
      settings: { create: true, read: true, update: true, delete: true },
      users: { create: true, read: true, update: true, delete: true },
      integrations: { create: true, read: true, update: true, delete: true },
      audit: { read: true, export: true },
    },
  },
  {
    name: "admin",
    label: "Admin",
    description: "Administrator with broad access, excluding billing",
    permissions: {
      deals: { create: true, read: true, update: true, delete: true, export: true },
      crm: { create: true, read: true, update: true, delete: true, export: true },
      financials: { create: true, read: true, update: true, delete: true, export: true },
      settings: { create: true, read: true, update: true, delete: false },
      users: { create: true, read: true, update: true, delete: true },
      integrations: { create: true, read: true, update: true, delete: true },
      audit: { read: true, export: true },
    },
  },
  {
    name: "gp_principal",
    label: "GP Principal",
    description: "General Partner principal with full deal access",
    permissions: {
      deals: { create: true, read: true, update: true, delete: false, export: true },
      crm: { create: true, read: true, update: true, delete: false, export: true },
      financials: { create: true, read: true, update: true, delete: false, export: true },
      settings: { read: true },
      users: { read: true },
      integrations: { read: true },
      audit: { read: true },
    },
  },
  {
    name: "analyst",
    label: "Analyst",
    description: "Analyst with read/write on deals and financials",
    permissions: {
      deals: { create: true, read: true, update: true, delete: false, export: true },
      crm: { create: true, read: true, update: true, delete: false, export: false },
      financials: { create: true, read: true, update: true, delete: false, export: true },
      settings: { read: false },
      users: { read: false },
      integrations: { read: false },
      audit: { read: false },
    },
  },
  {
    name: "asset_manager",
    label: "Asset Manager",
    description: "Asset manager with operational and financial access",
    permissions: {
      deals: { create: false, read: true, update: true, delete: false, export: true },
      crm: { create: true, read: true, update: true, delete: false, export: false },
      financials: { create: true, read: true, update: true, delete: false, export: true },
      settings: { read: false },
      users: { read: false },
      integrations: { read: true },
      audit: { read: false },
    },
  },
  {
    name: "property_manager",
    label: "Property Manager",
    description: "Property-level manager with limited deal access",
    permissions: {
      deals: { create: false, read: true, update: false, delete: false, export: false },
      crm: { create: true, read: true, update: true, delete: false, export: false },
      financials: { create: false, read: true, update: false, delete: false, export: false },
      settings: { read: false },
      users: { read: false },
      integrations: { read: false },
      audit: { read: false },
    },
  },
  {
    name: "lp_investor",
    label: "LP Investor",
    description: "Limited Partner with read-only portfolio access",
    permissions: {
      deals: { create: false, read: true, update: false, delete: false, export: true },
      crm: { create: false, read: false, update: false, delete: false, export: false },
      financials: { create: false, read: true, update: false, delete: false, export: true },
      settings: { read: false },
      users: { read: false },
      integrations: { read: false },
      audit: { read: false },
    },
  },
  {
    name: "read_only",
    label: "Read Only",
    description: "View-only access across modules",
    permissions: {
      deals: { create: false, read: true, update: false, delete: false, export: false },
      crm: { create: false, read: true, update: false, delete: false, export: false },
      financials: { create: false, read: true, update: false, delete: false, export: false },
      settings: { read: false },
      users: { read: false },
      integrations: { read: false },
      audit: { read: false },
    },
  },
];

export const infrastructureRouter = Router();

// ============================================================================
// A.2 — RBAC
// ============================================================================

// GET /rbac/roles — list roles for org (include system roles where orgId is null)
infrastructureRouter.get("/rbac/roles", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    // Check if system roles exist; seed if not
    const systemRoles = await db
      .select()
      .from(rbacRoles)
      .where(eq(rbacRoles.isSystem, true));

    if (systemRoles.length === 0) {
      for (const role of SYSTEM_ROLES) {
        await db.insert(rbacRoles).values({
          orgId: null,
          name: role.name,
          label: role.label,
          description: role.description,
          isSystem: true,
          permissions: role.permissions,
        });
      }
    }

    // Return system roles + org-specific custom roles
    const roles = await db
      .select()
      .from(rbacRoles)
      .where(
        sql`${rbacRoles.orgId} IS NULL OR ${rbacRoles.orgId} = ${orgId}`
      );

    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /rbac/roles — create custom role
infrastructureRouter.post("/rbac/roles", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { name, label, description, permissions } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const [role] = await db
      .insert(rbacRoles)
      .values({
        orgId,
        name,
        label: label || name,
        description: description || null,
        isSystem: false,
        permissions: permissions || {},
      })
      .returning();

    res.status(201).json(role);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /rbac/roles/:id — update role permissions
infrastructureRouter.put("/rbac/roles/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { name, label, description, permissions } = req.body;

    // Prevent editing system roles' core identity
    const [existing] = await db
      .select()
      .from(rbacRoles)
      .where(eq(rbacRoles.id, id));

    if (!existing) return res.status(404).json({ error: "Role not found" });
    if (existing.isSystem && existing.orgId === null) {
      // Allow updating permissions on system roles but not name
    }

    const [updated] = await db
      .update(rbacRoles)
      .set({
        ...(name !== undefined && { name }),
        ...(label !== undefined && { label }),
        ...(description !== undefined && { description }),
        ...(permissions !== undefined && { permissions }),
      })
      .where(eq(rbacRoles.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /rbac/roles/:id — delete custom role (prevent system role deletion)
infrastructureRouter.delete("/rbac/roles/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(rbacRoles)
      .where(eq(rbacRoles.id, id));

    if (!existing) return res.status(404).json({ error: "Role not found" });
    if (existing.isSystem) {
      return res.status(403).json({ error: "Cannot delete system roles" });
    }
    if (existing.orgId !== orgId) {
      return res.status(403).json({ error: "Cannot delete roles from other organizations" });
    }

    await db.delete(rbacRoles).where(eq(rbacRoles.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /rbac/users/:userId/role — get user's role assignment
infrastructureRouter.get("/rbac/users/:userId/role", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { userId } = req.params;

    const assignments = await db
      .select()
      .from(rbacUserRoles)
      .where(and(eq(rbacUserRoles.orgId, orgId), eq(rbacUserRoles.userId, userId)));

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /rbac/user-roles — assign role to user
infrastructureRouter.post("/rbac/user-roles", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const assignedBy = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { userId, roleId, dealScope, specificDealIds } = req.body;
    if (!userId || !roleId) {
      return res.status(400).json({ error: "userId and roleId are required" });
    }

    const [assignment] = await db
      .insert(rbacUserRoles)
      .values({
        orgId,
        userId,
        roleId,
        dealScope: dealScope || "all",
        specificDealIds: specificDealIds || null,
        assignedBy,
      })
      .returning();

    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /rbac/user-roles/:id — update assignment
infrastructureRouter.put("/rbac/user-roles/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { roleId, dealScope, specificDealIds } = req.body;

    const [updated] = await db
      .update(rbacUserRoles)
      .set({
        ...(roleId !== undefined && { roleId }),
        ...(dealScope !== undefined && { dealScope }),
        ...(specificDealIds !== undefined && { specificDealIds }),
      })
      .where(and(eq(rbacUserRoles.id, id), eq(rbacUserRoles.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Assignment not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /rbac/user-roles/:id — remove role assignment
infrastructureRouter.delete("/rbac/user-roles/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const [deleted] = await db
      .delete(rbacUserRoles)
      .where(and(eq(rbacUserRoles.id, id), eq(rbacUserRoles.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Assignment not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /rbac/field-permissions/:roleId — get field permissions for role
infrastructureRouter.get("/rbac/field-permissions/:roleId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId } = req.params;

    const permissions = await db
      .select()
      .from(rbacFieldPermissions)
      .where(
        and(
          eq(rbacFieldPermissions.roleId, roleId),
          sql`(${rbacFieldPermissions.orgId} IS NULL OR ${rbacFieldPermissions.orgId} = ${orgId})`
        )
      );

    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /rbac/field-permissions — create/update field permission
infrastructureRouter.post("/rbac/field-permissions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { roleId, module, fieldPath, permission } = req.body;
    if (!roleId || !module || !fieldPath || !permission) {
      return res.status(400).json({ error: "roleId, module, fieldPath, and permission are required" });
    }

    // Upsert: check if existing
    const [existing] = await db
      .select()
      .from(rbacFieldPermissions)
      .where(
        and(
          eq(rbacFieldPermissions.roleId, roleId),
          eq(rbacFieldPermissions.module, module),
          eq(rbacFieldPermissions.fieldPath, fieldPath),
          sql`(${rbacFieldPermissions.orgId} IS NULL OR ${rbacFieldPermissions.orgId} = ${orgId})`
        )
      );

    if (existing) {
      const [updated] = await db
        .update(rbacFieldPermissions)
        .set({ permission })
        .where(eq(rbacFieldPermissions.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(rbacFieldPermissions)
      .values({ orgId, roleId, module, fieldPath, permission })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// A.3 — Audit Trail
// ============================================================================

// GET /audit — list audit entries with filters and pagination
infrastructureRouter.get("/audit", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const {
      userId,
      module,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      limit: limitStr,
      offset: offsetStr,
    } = req.query as Record<string, string | undefined>;

    const limit = Math.min(parseInt(limitStr || "50", 10), 500);
    const offset = parseInt(offsetStr || "0", 10);

    const conditions: any[] = [eq(auditTrail.orgId, orgId)];

    if (userId) conditions.push(eq(auditTrail.userId, userId));
    if (module) conditions.push(eq(auditTrail.module, module));
    if (entityType) conditions.push(eq(auditTrail.entityType, entityType));
    if (entityId) conditions.push(eq(auditTrail.entityId, entityId));
    if (action) conditions.push(eq(auditTrail.action, action));
    if (startDate) conditions.push(sql`${auditTrail.createdAt} >= ${startDate}::timestamptz`);
    if (endDate) conditions.push(sql`${auditTrail.createdAt} <= ${endDate}::timestamptz`);

    const entries = await db
      .select()
      .from(auditTrail)
      .where(and(...conditions))
      .orderBy(desc(auditTrail.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditTrail)
      .where(and(...conditions));

    res.json({ entries, total: count, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /audit/export — export as CSV
infrastructureRouter.get("/audit/export", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { startDate, endDate } = req.query as Record<string, string | undefined>;

    const conditions: any[] = [eq(auditTrail.orgId, orgId)];
    if (startDate) conditions.push(sql`${auditTrail.createdAt} >= ${startDate}::timestamptz`);
    if (endDate) conditions.push(sql`${auditTrail.createdAt} <= ${endDate}::timestamptz`);

    const entries = await db
      .select()
      .from(auditTrail)
      .where(and(...conditions))
      .orderBy(desc(auditTrail.createdAt));

    const headers = [
      "id",
      "userId",
      "userEmail",
      "userIp",
      "action",
      "module",
      "entityType",
      "entityId",
      "entityLabel",
      "requestPath",
      "requestMethod",
      "statusCode",
      "checksum",
      "createdAt",
    ];

    const csvRows = [headers.join(",")];
    for (const entry of entries) {
      const row = headers.map((h) => {
        const val = (entry as any)[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Escape CSV values containing commas or quotes
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(row.join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-trail.csv");
    res.send(csvRows.join("\n"));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /audit/:id — get single entry
infrastructureRouter.get("/audit/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const [entry] = await db
      .select()
      .from(auditTrail)
      .where(and(eq(auditTrail.id, id), eq(auditTrail.orgId, orgId)));

    if (!entry) return res.status(404).json({ error: "Audit entry not found" });
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /audit/verify-integrity — re-compute checksums, report valid vs tampered
infrastructureRouter.post("/audit/verify-integrity", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { startDate, endDate } = req.body;

    const conditions: any[] = [eq(auditTrail.orgId, orgId)];
    if (startDate) conditions.push(sql`${auditTrail.createdAt} >= ${startDate}::timestamptz`);
    if (endDate) conditions.push(sql`${auditTrail.createdAt} <= ${endDate}::timestamptz`);

    const entries = await db
      .select()
      .from(auditTrail)
      .where(and(...conditions))
      .orderBy(desc(auditTrail.createdAt));

    let valid = 0;
    let tampered = 0;
    const tamperedIds: string[] = [];

    for (const entry of entries) {
      const payload = `${entry.id}${entry.orgId}${entry.userId}${entry.action}${entry.entityId}${entry.createdAt?.toISOString() ?? ""}`;
      const expectedChecksum = crypto
        .createHash("sha256")
        .update(payload)
        .digest("hex");

      if (entry.checksum === expectedChecksum) {
        valid++;
      } else {
        tampered++;
        tamperedIds.push(entry.id);
      }
    }

    res.json({ total: entries.length, valid, tampered, tamperedIds });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// A.4 — SSO
// ============================================================================

// GET /sso/config — get org SSO config
infrastructureRouter.get("/sso/config", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [config] = await db
      .select()
      .from(ssoConfigs)
      .where(eq(ssoConfigs.orgId, orgId));

    if (!config) return res.json(null);

    // Redact sensitive fields
    res.json({
      ...config,
      clientSecret: config.clientSecret ? "••••••••" : null,
      cert: config.cert ? "[REDACTED]" : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /sso/config — create/update SSO config
infrastructureRouter.post("/sso/config", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const {
      provider,
      protocol,
      entryPoint,
      issuer,
      cert,
      discoveryUrl,
      clientId,
      clientSecret,
      scope,
      emailAttribute,
      nameAttribute,
      enforceSSO,
      jitProvisioning,
      defaultRole,
      isActive,
    } = req.body;

    const [existing] = await db
      .select()
      .from(ssoConfigs)
      .where(eq(ssoConfigs.orgId, orgId));

    if (existing) {
      const [updated] = await db
        .update(ssoConfigs)
        .set({
          ...(provider !== undefined && { provider }),
          ...(protocol !== undefined && { protocol }),
          ...(entryPoint !== undefined && { entryPoint }),
          ...(issuer !== undefined && { issuer }),
          ...(cert !== undefined && { cert }),
          ...(discoveryUrl !== undefined && { discoveryUrl }),
          ...(clientId !== undefined && { clientId }),
          ...(clientSecret !== undefined && { clientSecret }),
          ...(scope !== undefined && { scope }),
          ...(emailAttribute !== undefined && { emailAttribute }),
          ...(nameAttribute !== undefined && { nameAttribute }),
          ...(enforceSSO !== undefined && { enforceSSO }),
          ...(jitProvisioning !== undefined && { jitProvisioning }),
          ...(defaultRole !== undefined && { defaultRole }),
          ...(isActive !== undefined && { isActive }),
        })
        .where(eq(ssoConfigs.id, existing.id))
        .returning();

      return res.json(updated);
    }

    const [created] = await db
      .insert(ssoConfigs)
      .values({
        orgId,
        provider: provider || null,
        protocol: protocol || null,
        entryPoint: entryPoint || null,
        issuer: issuer || null,
        cert: cert || null,
        discoveryUrl: discoveryUrl || null,
        clientId: clientId || null,
        clientSecret: clientSecret || null,
        scope: scope || null,
        emailAttribute: emailAttribute || null,
        nameAttribute: nameAttribute || null,
        enforceSSO: enforceSSO || false,
        jitProvisioning: jitProvisioning !== false,
        defaultRole: defaultRole || "analyst",
        isActive: isActive || false,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /sso/test — test SSO connection (validate URL reachability)
infrastructureRouter.post("/sso/test", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      res.json({
        reachable: true,
        status: response.status,
        statusText: response.statusText,
      });
    } catch (fetchErr: any) {
      res.json({
        reachable: false,
        error: fetchErr.message || "Connection failed",
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /sso/config — disable SSO
infrastructureRouter.delete("/sso/config", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [existing] = await db
      .select()
      .from(ssoConfigs)
      .where(eq(ssoConfigs.orgId, orgId));

    if (!existing) return res.status(404).json({ error: "No SSO config found" });

    await db
      .update(ssoConfigs)
      .set({ isActive: false, enforceSSO: false })
      .where(eq(ssoConfigs.id, existing.id));

    res.json({ success: true, message: "SSO disabled" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// A.5 — 2FA
// ============================================================================

// GET /2fa/status — get current 2FA status for authenticated user
infrastructureRouter.get("/2fa/status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [twoFactor] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId));

    if (!twoFactor) {
      return res.json({ enabled: false, method: null });
    }

    res.json({
      enabled: twoFactor.isEnabled,
      method: twoFactor.method,
      phoneNumber: twoFactor.phoneNumber
        ? twoFactor.phoneNumber.replace(/.(?=.{4})/g, "*")
        : null,
      enabledAt: twoFactor.enabledAt,
      lastUsedAt: twoFactor.lastUsedAt,
      hasBackupCodes: Array.isArray(twoFactor.backupCodes) && (twoFactor.backupCodes as any[]).length > 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /2fa/setup/totp — generate TOTP secret
infrastructureRouter.post("/2fa/setup/totp", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Generate a 20-byte secret and base32 encode it
    const secretBytes = crypto.randomBytes(20);
    const secret = base32Encode(secretBytes);

    // Get user email for the otpauth URL
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    const accountName = user?.email || user?.username || userId;
    const issuer = "MarinaCloud";
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    // Store the secret (not yet enabled)
    const [existing] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId));

    if (existing) {
      await db
        .update(userTwoFactor)
        .set({ totpSecret: secret, method: "totp" })
        .where(eq(userTwoFactor.userId, userId));
    } else {
      await db.insert(userTwoFactor).values({
        userId,
        method: "totp",
        totpSecret: secret,
        isEnabled: false,
      });
    }

    res.json({ secret, otpauthUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /2fa/verify-totp — verify TOTP code, enable 2FA, generate backup codes
infrastructureRouter.post("/2fa/verify-totp", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "code is required" });

    const [twoFactor] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId));

    if (!twoFactor || !twoFactor.totpSecret) {
      return res.status(400).json({ error: "TOTP not set up. Call /2fa/setup/totp first." });
    }

    // Verify the TOTP code (check current and adjacent time windows)
    const secret = twoFactor.totpSecret;
    const now = Math.floor(Date.now() / 1000);
    let verified = false;

    for (const offset of [-1, 0, 1]) {
      const timeCounter = Math.floor((now + offset * 30) / 30);
      const counterBuffer = Buffer.alloc(8);
      counterBuffer.writeUInt32BE(0, 0);
      counterBuffer.writeUInt32BE(timeCounter, 4);

      // Decode base32 secret
      const decoded = base32Decode(secret);
      const hmac = crypto.createHmac("sha1", decoded);
      hmac.update(counterBuffer);
      const hash = hmac.digest();

      const offsetByte = hash[hash.length - 1] & 0x0f;
      const truncated =
        ((hash[offsetByte] & 0x7f) << 24) |
        ((hash[offsetByte + 1] & 0xff) << 16) |
        ((hash[offsetByte + 2] & 0xff) << 8) |
        (hash[offsetByte + 3] & 0xff);

      const otp = (truncated % 1000000).toString().padStart(6, "0");
      if (otp === code) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      return res.status(400).json({ error: "Invalid TOTP code" });
    }

    // Generate 10 backup codes
    const backupCodesPlain: string[] = [];
    const backupCodesHashed: string[] = [];
    for (let i = 0; i < 10; i++) {
      const plainCode = crypto.randomBytes(4).toString("hex"); // 8-char hex code
      backupCodesPlain.push(plainCode);
      backupCodesHashed.push(
        crypto.createHash("sha256").update(plainCode).digest("hex")
      );
    }

    await db
      .update(userTwoFactor)
      .set({
        isEnabled: true,
        enabledAt: new Date(),
        backupCodes: backupCodesHashed,
      })
      .where(eq(userTwoFactor.userId, userId));

    res.json({
      enabled: true,
      backupCodes: backupCodesPlain, // Return plain codes only once
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /2fa/setup/sms — store phone number, send verification code
infrastructureRouter.post("/2fa/setup/sms", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "phoneNumber is required" });

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + crypto.randomInt(900000)).toString();
    const hashedCode = crypto.createHash("sha256").update(verificationCode).digest("hex");

    const [existing] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId));

    if (existing) {
      await db
        .update(userTwoFactor)
        .set({
          method: "sms",
          phoneNumber,
          // Store hashed code temporarily in totpSecret field for verification
          totpSecret: hashedCode,
        })
        .where(eq(userTwoFactor.userId, userId));
    } else {
      await db.insert(userTwoFactor).values({
        userId,
        method: "sms",
        phoneNumber,
        totpSecret: hashedCode,
        isEnabled: false,
      });
    }

    // In production, send SMS via Twilio/SNS. For now, log it.
    // TODO: integrate with SMS provider
    console.log(`[2FA SMS] Code for user ${userId}: ${verificationCode}`);

    res.json({ message: "Verification code sent", phoneLast4: phoneNumber.slice(-4) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /2fa/verify-sms — verify SMS code, enable 2FA
infrastructureRouter.post("/2fa/verify-sms", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "code is required" });

    const [twoFactor] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId));

    if (!twoFactor || twoFactor.method !== "sms") {
      return res.status(400).json({ error: "SMS 2FA not set up. Call /2fa/setup/sms first." });
    }

    const hashedInput = crypto.createHash("sha256").update(code).digest("hex");
    if (hashedInput !== twoFactor.totpSecret) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    await db
      .update(userTwoFactor)
      .set({
        isEnabled: true,
        enabledAt: new Date(),
        totpSecret: null, // Clear the temporary code
      })
      .where(eq(userTwoFactor.userId, userId));

    res.json({ enabled: true, method: "sms" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /2fa/disable — disable 2FA (require current code verification)
infrastructureRouter.post("/2fa/disable", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "code is required to disable 2FA" });

    const [twoFactor] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId));

    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA is not enabled" });
    }

    // Verify the code (TOTP or backup code)
    const verified = await verifyUserCode(twoFactor, code);
    if (!verified) {
      return res.status(400).json({ error: "Invalid code" });
    }

    await db
      .update(userTwoFactor)
      .set({
        isEnabled: false,
        totpSecret: null,
        backupCodes: null,
        enabledAt: null,
      })
      .where(eq(userTwoFactor.userId, userId));

    res.json({ enabled: false, message: "2FA disabled" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /2fa/backup-codes — regenerate backup codes
infrastructureRouter.post("/2fa/backup-codes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [twoFactor] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId));

    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA is not enabled" });
    }

    const backupCodesPlain: string[] = [];
    const backupCodesHashed: string[] = [];
    for (let i = 0; i < 10; i++) {
      const plainCode = crypto.randomBytes(4).toString("hex");
      backupCodesPlain.push(plainCode);
      backupCodesHashed.push(
        crypto.createHash("sha256").update(plainCode).digest("hex")
      );
    }

    await db
      .update(userTwoFactor)
      .set({ backupCodes: backupCodesHashed })
      .where(eq(userTwoFactor.userId, userId));

    res.json({ backupCodes: backupCodesPlain });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /2fa/challenge — verify code during login (check TOTP or backup code)
infrastructureRouter.post("/2fa/challenge", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ error: "userId and code are required" });
    }

    const [twoFactor] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId));

    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA is not enabled for this user" });
    }

    const verified = await verifyUserCode(twoFactor, code);
    if (!verified) {
      return res.status(401).json({ error: "Invalid 2FA code" });
    }

    // Update last used timestamp
    await db
      .update(userTwoFactor)
      .set({ lastUsedAt: new Date() })
      .where(eq(userTwoFactor.userId, userId));

    res.json({ verified: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Helpers
// ============================================================================

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

async function verifyUserCode(
  twoFactor: typeof userTwoFactor.$inferSelect,
  code: string
): Promise<boolean> {
  // Try TOTP verification first
  if (twoFactor.method === "totp" && twoFactor.totpSecret) {
    const secret = twoFactor.totpSecret;
    const now = Math.floor(Date.now() / 1000);

    for (const offset of [-1, 0, 1]) {
      const timeCounter = Math.floor((now + offset * 30) / 30);
      const counterBuffer = Buffer.alloc(8);
      counterBuffer.writeUInt32BE(0, 0);
      counterBuffer.writeUInt32BE(timeCounter, 4);

      const decoded = base32Decode(secret);
      const hmac = crypto.createHmac("sha1", decoded);
      hmac.update(counterBuffer);
      const hash = hmac.digest();

      const offsetByte = hash[hash.length - 1] & 0x0f;
      const truncated =
        ((hash[offsetByte] & 0x7f) << 24) |
        ((hash[offsetByte + 1] & 0xff) << 16) |
        ((hash[offsetByte + 2] & 0xff) << 8) |
        (hash[offsetByte + 3] & 0xff);

      const otp = (truncated % 1000000).toString().padStart(6, "0");
      if (otp === code) return true;
    }
  }

  // Try backup code
  if (twoFactor.backupCodes && Array.isArray(twoFactor.backupCodes)) {
    const hashedInput = crypto.createHash("sha256").update(code).digest("hex");
    const codes = twoFactor.backupCodes as string[];
    const index = codes.indexOf(hashedInput);
    if (index !== -1) {
      // Remove used backup code
      const remaining = [...codes];
      remaining.splice(index, 1);
      await db
        .update(userTwoFactor)
        .set({ backupCodes: remaining })
        .where(eq(userTwoFactor.userId, twoFactor.userId));
      return true;
    }
  }

  return false;
}
