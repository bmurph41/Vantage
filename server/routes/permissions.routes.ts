/**
 * Payroll Permission Grants — CRUD routes
 * Only accessible by ORG_OWNER / ORG_ADMIN
 */

import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { payrollPermissionGrants } from "../../db/payroll-schema";
import {
  requirePayrollAdmin,
  resolveEffectivePermissions,
  type AuthContext,
  type PermissionScope,
} from "../services/payroll-auth.service";

export const permissionsRouter = Router();

// All routes require ORG_OWNER/ORG_ADMIN
permissionsRouter.use(requirePayrollAdmin());

// ─── LIST GRANTS ────────────────────────────────────────────────────────────

permissionsRouter.get("/grants", async (req: Request, res: Response) => {
  try {
    const { orgId, userId } = req.query;
    let conditions: any[] = [];

    if (orgId) conditions.push(eq(payrollPermissionGrants.orgId, orgId as string));
    if (userId) conditions.push(eq(payrollPermissionGrants.grantedToUserId, userId as string));

    const grants = await db
      .select()
      .from(payrollPermissionGrants)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ grants });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE GRANT ───────────────────────────────────────────────────────────

permissionsRouter.post("/grants", async (req: Request, res: Response) => {
  try {
    const {
      orgId,
      grantedToUserId,
      scopeType,
      scopeId,
      permissionLevel,
      detailLevelMax,
      canExport,
      canViewEmployeeNames,
      canViewCompRates,
      canViewBonusDetail,
      canViewAllAssets,
    } = req.body;

    // Validate: can_view_employee_names requires EMPLOYEE_DETAIL level
    if (canViewEmployeeNames && detailLevelMax !== "EMPLOYEE_DETAIL") {
      return res.status(400).json({
        error: "can_view_employee_names requires detail_level_max of EMPLOYEE_DETAIL",
      });
    }

    const [grant] = await db
      .insert(payrollPermissionGrants)
      .values({
        orgId,
        grantedToUserId,
        grantedByUserId: (req as any).user?.id,
        scopeType,
        scopeId: scopeId ?? null,
        permissionLevel: permissionLevel ?? "VIEW",
        detailLevelMax: detailLevelMax ?? "TOTALS_ONLY",
        canExport: canExport ?? false,
        canViewEmployeeNames: canViewEmployeeNames ?? false,
        canViewCompRates: canViewCompRates ?? false,
        canViewBonusDetail: canViewBonusDetail ?? false,
        canViewAllAssets: canViewAllAssets ?? false,
      })
      .onConflictDoUpdate({
        target: [
          payrollPermissionGrants.orgId,
          payrollPermissionGrants.grantedToUserId,
          payrollPermissionGrants.scopeType,
          payrollPermissionGrants.scopeId,
        ],
        set: {
          permissionLevel: permissionLevel ?? "VIEW",
          detailLevelMax: detailLevelMax ?? "TOTALS_ONLY",
          canExport: canExport ?? false,
          canViewEmployeeNames: canViewEmployeeNames ?? false,
          canViewCompRates: canViewCompRates ?? false,
          canViewBonusDetail: canViewBonusDetail ?? false,
          canViewAllAssets: canViewAllAssets ?? false,
          grantedByUserId: (req as any).user?.id,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json({ grant });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE GRANT ───────────────────────────────────────────────────────────

permissionsRouter.put("/grants/:id", async (req: Request, res: Response) => {
  try {
    const [updated] = await db
      .update(payrollPermissionGrants)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(payrollPermissionGrants.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Grant not found" });
    res.json({ grant: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE GRANT ───────────────────────────────────────────────────────────

permissionsRouter.delete("/grants/:id", async (req: Request, res: Response) => {
  try {
    await db
      .delete(payrollPermissionGrants)
      .where(eq(payrollPermissionGrants.id, req.params.id));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EFFECTIVE PERMISSIONS (PREVIEW) ────────────────────────────────────────

permissionsRouter.get("/effective", async (req: Request, res: Response) => {
  try {
    const { userId, orgId, scopeType, scopeId, portfolioId } = req.query;

    if (!userId || !orgId) {
      return res.status(400).json({ error: "userId and orgId required" });
    }

    // For preview purposes, we simulate the auth context
    // In production, you'd look up the user's org role
    const auth: AuthContext = {
      userId: userId as string,
      orgId: orgId as string,
      orgRole: "ORG_MEMBER", // simulate non-admin for preview
    };

    const scope: PermissionScope = {
      scopeType: (scopeType as any) ?? "ORG",
      scopeId: scopeId as string,
      portfolioId: portfolioId as string,
    };

    const effective = await resolveEffectivePermissions(auth, scope);
    res.json({ effective });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
