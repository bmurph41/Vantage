/**
 * PayrollAuthService — Authorization service for payroll + dept P&L
 *
 * Evaluates payroll_permission_grants to determine effective permissions.
 * Most-specific scope wins: VALUATION_MODEL > ASSET > PORTFOLIO > ORG
 *
 * ORG_OWNER and ORG_ADMIN always have full access.
 */

import { eq, and, or, inArray } from "drizzle-orm";
import { db } from "../db"; // adjust to your app's db
import { payrollPermissionGrants } from "@shared/payroll-schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScopeType = "ORG" | "PORTFOLIO" | "ASSET" | "VALUATION_MODEL";
export type PermissionLevel = "VIEW" | "EDIT" | "ADMIN";
export type DetailLevel = "TOTALS_ONLY" | "DEPT_TOTALS" | "POSITION_LINES" | "EMPLOYEE_DETAIL";

export interface EffectivePermissions {
  canView: boolean;
  canEdit: boolean;
  canAdmin: boolean;
  detailLevelMax: DetailLevel;
  canExport: boolean;
  canViewEmployeeNames: boolean;
  canViewCompRates: boolean;
  canViewBonusDetail: boolean;
  canViewAllAssets: boolean;
}

export const NO_ACCESS: EffectivePermissions = {
  canView: false,
  canEdit: false,
  canAdmin: false,
  detailLevelMax: "TOTALS_ONLY",
  canExport: false,
  canViewEmployeeNames: false,
  canViewCompRates: false,
  canViewBonusDetail: false,
  canViewAllAssets: false,
};

export const FULL_ACCESS: EffectivePermissions = {
  canView: true,
  canEdit: true,
  canAdmin: true,
  detailLevelMax: "EMPLOYEE_DETAIL",
  canExport: true,
  canViewEmployeeNames: true,
  canViewCompRates: true,
  canViewBonusDetail: true,
  canViewAllAssets: true,
};

const SCOPE_PRIORITY: Record<ScopeType, number> = {
  VALUATION_MODEL: 4,
  ASSET: 3,
  PORTFOLIO: 2,
  ORG: 1,
};

const DETAIL_LEVEL_ORDER: DetailLevel[] = [
  "TOTALS_ONLY",
  "DEPT_TOTALS",
  "POSITION_LINES",
  "EMPLOYEE_DETAIL",
];

// ─── Service ────────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string;
  orgId: string;
  orgRole: string; // from org_memberships or your existing auth
}

export interface PermissionScope {
  scopeType: ScopeType;
  scopeId?: string | null;
  // For asset-level queries, we may also want to check portfolio-level grants
  portfolioId?: string | null;
}

/**
 * Resolve the effective permissions for a user in a given scope.
 *
 * Evaluation order:
 * 1. If user is ORG_OWNER or ORG_ADMIN → FULL_ACCESS
 * 2. Gather all matching grants (exact scope + parent scopes)
 * 3. Pick the most-specific grant (highest SCOPE_PRIORITY)
 * 4. Return its permission fields
 */
export async function resolveEffectivePermissions(
  auth: AuthContext,
  scope: PermissionScope
): Promise<EffectivePermissions> {
  // ORG_OWNER / ORG_ADMIN bypass
  if (auth.orgRole === "ORG_OWNER" || auth.orgRole === "ORG_ADMIN") {
    return FULL_ACCESS;
  }

  // Build candidate scope chain (most specific → least)
  const scopeChecks: { scopeType: ScopeType; scopeId: string | null }[] = [];

  // Always include exact scope
  scopeChecks.push({
    scopeType: scope.scopeType,
    scopeId: scope.scopeId ?? null,
  });

  // Include parent scopes for inheritance
  if (scope.scopeType === "VALUATION_MODEL" || scope.scopeType === "ASSET") {
    if (scope.portfolioId) {
      scopeChecks.push({ scopeType: "PORTFOLIO", scopeId: scope.portfolioId });
    }
  }
  if (scope.scopeType !== "ORG") {
    scopeChecks.push({ scopeType: "ORG", scopeId: null });
  }

  // Query all grants for this user+org matching any of the candidate scopes
  const grants = await db
    .select()
    .from(payrollPermissionGrants)
    .where(
      and(
        eq(payrollPermissionGrants.orgId, auth.orgId),
        eq(payrollPermissionGrants.grantedToUserId, auth.userId)
      )
    );

  if (grants.length === 0) {
    return NO_ACCESS;
  }

  // Find the best matching grant (most specific scope)
  let bestGrant: (typeof grants)[0] | null = null;
  let bestPriority = -1;

  for (const grant of grants) {
    // Check if this grant matches any of our candidate scopes
    const isMatch = scopeChecks.some(
      (sc) =>
        sc.scopeType === grant.scopeType &&
        (sc.scopeId === null
          ? grant.scopeId === null
          : sc.scopeId === grant.scopeId)
    );

    if (!isMatch) continue;

    const priority = SCOPE_PRIORITY[grant.scopeType as ScopeType] ?? 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      bestGrant = grant;
    }
  }

  if (!bestGrant) {
    return NO_ACCESS;
  }

  const level = bestGrant.permissionLevel as PermissionLevel;

  return {
    canView: true, // any grant implies view
    canEdit: level === "EDIT" || level === "ADMIN",
    canAdmin: level === "ADMIN",
    detailLevelMax: bestGrant.detailLevelMax as DetailLevel,
    canExport: bestGrant.canExport,
    canViewEmployeeNames: bestGrant.canViewEmployeeNames,
    canViewCompRates: bestGrant.canViewCompRates,
    canViewBonusDetail: bestGrant.canViewBonusDetail,
    canViewAllAssets: bestGrant.canViewAllAssets,
  };
}

// ─── Redaction Helpers ──────────────────────────────────────────────────────

export function canViewDetailLevel(
  perms: EffectivePermissions,
  required: DetailLevel
): boolean {
  const maxIdx = DETAIL_LEVEL_ORDER.indexOf(perms.detailLevelMax);
  const reqIdx = DETAIL_LEVEL_ORDER.indexOf(required);
  return reqIdx <= maxIdx;
}

/**
 * Redact fields from a payroll line based on permissions.
 * Returns a sanitized copy.
 */
export function redactPayrollLine(
  line: Record<string, any>,
  perms: EffectivePermissions
): Record<string, any> {
  const out = { ...line };

  if (!perms.canViewEmployeeNames) {
    if (out.employeeFirstName) out.employeeFirstName = "***";
    if (out.employeeLastName) out.employeeLastName = "***";
    if (out.employeeDisplayName) out.employeeDisplayName = `Employee #${out.sortOrder ?? "?"}`;
    if (out.employee) {
      out.employee = {
        ...out.employee,
        firstName: "***",
        lastName: "***",
        displayName: `Employee #${out.sortOrder ?? "?"}`,
      };
    }
  }

  if (!perms.canViewCompRates) {
    delete out.salaryAnnual;
    delete out.hourlyRate;
    delete out.hoursPerWeek;
    // keep totals but not rates
  }

  if (!perms.canViewBonusDetail) {
    delete out.bonusEvents;
    // bonusTotalOnly remains
  }

  return out;
}

/**
 * Filter calc output based on detail level.
 */
export function filterCalcOutput(
  output: any,
  perms: EffectivePermissions
): any {
  if (!canViewDetailLevel(perms, "POSITION_LINES")) {
    // Strip individual line detail, keep only department/total rollups
    delete output.lineResults;
  }
  if (!canViewDetailLevel(perms, "DEPT_TOTALS")) {
    // Strip department breakdown, keep only grand totals
    delete output.departmentRollups;
    delete output.workerTypeRollups;
  }
  return output;
}

// ─── Middleware helper ──────────────────────────────────────────────────────

/**
 * Express middleware factory — attaches `req.payrollPerms` to the request.
 * Usage:
 *   router.get("/plans/:id", requirePayrollAccess("ASSET"), handler)
 *
 * The middleware reads scope info from req.params / req.query and resolves permissions.
 * If no access → 403.
 */
export function requirePayrollAccess(defaultScopeType: ScopeType = "ORG") {
  return async (req: any, res: any, next: any) => {
    try {
      const rawRole = req.user?.orgRole ?? req.user?.role ?? "ORG_VIEWER";
      const roleMap: Record<string, string> = {
        owner: "ORG_OWNER",
        admin: "ORG_ADMIN",
        editor: "ORG_ADMIN",
        viewer: "ORG_VIEWER",
      };
      const auth: AuthContext = {
        userId: req.user?.id,
        orgId: req.user?.orgId ?? req.query.orgId ?? req.params.orgId,
        orgRole: roleMap[rawRole] ?? rawRole,
      };

      if (!auth.userId || !auth.orgId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Determine scope from request context
      const scope: PermissionScope = {
        scopeType: (req.query.scopeType as ScopeType) ?? defaultScopeType,
        scopeId: req.params.assetId ?? req.params.modelId ?? req.query.scopeId,
        portfolioId: req.query.portfolioId ?? req.params.portfolioId,
      };

      const perms = await resolveEffectivePermissions(auth, scope);

      if (!perms.canView) {
        return res
          .status(403)
          .json({ error: "Insufficient payroll permissions" });
      }

      req.payrollPerms = perms;
      req.payrollAuth = auth;
      next();
    } catch (err) {
      console.error("PayrollAuth error:", err);
      return res.status(500).json({ error: "Authorization check failed" });
    }
  };
}

/**
 * Middleware for permission grant management — only ORG_OWNER / ORG_ADMIN.
 */
export function requirePayrollAdmin() {
  return async (req: any, res: any, next: any) => {
    const orgRole = req.user?.orgRole;
    if (orgRole !== "ORG_OWNER" && orgRole !== "ORG_ADMIN") {
      return res.status(403).json({
        error: "Only org owners and admins can manage payroll permissions",
      });
    }
    next();
  };
}
