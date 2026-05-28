/**
 * Project Profile CRUD (Phase 2B Session 2, 2026-05-28)
 *
 * Mounted under /api/v1/projects with authenticateUser + enforceTenant per
 * the documentExtraction precedent. The /api/v1 catch-all router below uses
 * authenticateApiKey for external white-label access; this sub-mount is
 * user-session-scoped (in-app UI).
 */

import express, { Request, Response } from "express";
import {
  addCustomCategory,
  getAssetClassDefaultProfile,
  getProjectProfile,
  saveProjectProfile,
  updateProfitCenterState,
} from "../services/project-profile-service";
import type { ProfitCenterStateKind } from "@shared/profit-center-id-map";

const VALID_STATES: ReadonlySet<ProfitCenterStateKind> = new Set([
  "default",
  "declared_yes",
  "declared_no",
  "system_suggested",
  "user_confirmed",
  "user_removed",
]);

const VALID_SECTIONS = new Set([
  "revenue",
  "cogs",
  "expense",
  "non_operating",
  "business_income",
]);

export const projectProfileRouter = express.Router({ mergeParams: true });

function resolveOrgId(req: Request): string | null {
  const user = (req as any).user || (req as any).resolvedUser;
  if (!user) return null;
  return user.orgId || user.org_id || (req as any).tenantId || null;
}

/**
 * GET /api/v1/projects/:projectId/profile
 *
 * Returns the stored profile merged with the asset-class default vocabulary:
 * any PC the project hasn't expressed a stance on falls back to status
 * 'default'. The merged shape is what consumers will read in Session 3+.
 *
 * If the project has no stored profile yet (column was '{}' on row create
 * before the one-shot migration ran for it), the asset-class default is
 * returned without writing it — write happens on first mutation.
 */
projectProfileRouter.get(
  "/:projectId/profile",
  async (req: Request, res: Response) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId } = req.params;
    const current = await getProjectProfile(projectId, orgId);
    if (!current) return res.status(404).json({ error: "Project not found" });

    const defaults = await getAssetClassDefaultProfile(current.assetClass);
    const mergedProfitCenters = { ...defaults.profitCenters };
    for (const [code, state] of Object.entries(current.profile.profitCenters)) {
      mergedProfitCenters[code] = state;
    }

    return res.json({
      assetClass: current.assetClass,
      profile: {
        profitCenters: mergedProfitCenters,
        customCategories: current.profile.customCategories,
        lastSystemDiscoveryAt: current.profile.lastSystemDiscoveryAt,
      },
    });
  },
);

/**
 * PATCH /api/v1/projects/:projectId/profile/profit-centers/:code
 *
 * Update one PC's state. Body: { status, label?, declaredAt?, discoveredAt?,
 * discoverySource? }. Returns the resulting state, or 400 if the code is not
 * canonical or the status is not a valid kind.
 */
projectProfileRouter.patch(
  "/:projectId/profile/profit-centers/:code",
  async (req: Request, res: Response) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, code } = req.params;
    const { status, label, declaredAt, discoveredAt, discoverySource } = req.body ?? {};

    if (status !== undefined && !VALID_STATES.has(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    const result = await updateProfitCenterState(projectId, orgId, code, {
      status,
      label,
      declaredAt,
      discoveredAt,
      discoverySource,
    });
    if (!result) {
      return res
        .status(400)
        .json({ error: `Unknown PC code or project: ${code}` });
    }
    return res.json({ state: result });
  },
);

/**
 * POST /api/v1/projects/:projectId/profile/custom-categories
 *
 * Append a custom category. Body: { id, label, suggestedSection,
 * addedAt?, occurrenceCount?, proposedForGlobal? }. Returns the full updated
 * custom-categories list.
 */
projectProfileRouter.post(
  "/:projectId/profile/custom-categories",
  async (req: Request, res: Response) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId } = req.params;
    const { id, label, suggestedSection, addedAt, occurrenceCount, proposedForGlobal } =
      req.body ?? {};

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id is required" });
    }
    if (!label || typeof label !== "string") {
      return res.status(400).json({ error: "label is required" });
    }
    if (!VALID_SECTIONS.has(suggestedSection)) {
      return res
        .status(400)
        .json({ error: `Invalid suggestedSection: ${suggestedSection}` });
    }

    const result = await addCustomCategory(projectId, orgId, {
      id,
      label,
      suggestedSection,
      addedAt: addedAt ?? new Date().toISOString(),
      occurrenceCount: typeof occurrenceCount === "number" ? occurrenceCount : 1,
      proposedForGlobal: Boolean(proposedForGlobal),
    });
    if (!result) return res.status(404).json({ error: "Project not found" });
    return res.json({ customCategories: result });
  },
);

/**
 * PUT /api/v1/projects/:projectId/profile (full replace)
 *
 * Convenience for batch updates from the wizard — replaces both profitCenters
 * and customCategories. Validates every PC code and every status value. Use
 * the PATCH endpoint above for incremental edits.
 */
projectProfileRouter.put(
  "/:projectId/profile",
  async (req: Request, res: Response) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId } = req.params;
    const { profitCenters, customCategories, lastSystemDiscoveryAt } = req.body ?? {};

    if (profitCenters && typeof profitCenters !== "object") {
      return res.status(400).json({ error: "profitCenters must be an object" });
    }

    const current = await getProjectProfile(projectId, orgId);
    if (!current) return res.status(404).json({ error: "Project not found" });

    if (profitCenters) {
      for (const [code, state] of Object.entries(
        profitCenters as Record<string, any>,
      )) {
        if (state?.status && !VALID_STATES.has(state.status)) {
          return res
            .status(400)
            .json({ error: `Invalid status on ${code}: ${state.status}` });
        }
      }
    }

    const next = {
      profitCenters: profitCenters ?? current.profile.profitCenters,
      customCategories: Array.isArray(customCategories)
        ? customCategories
        : current.profile.customCategories,
      lastSystemDiscoveryAt:
        lastSystemDiscoveryAt ?? current.profile.lastSystemDiscoveryAt,
    };
    await saveProjectProfile(projectId, orgId, next);
    return res.json({ profile: next });
  },
);
