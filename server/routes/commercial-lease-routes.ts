/**
 * Commercial Lease Engine Routes
 * ==============================
 * Drop-in file matching existing Vantage patterns.
 * 
 * Registration: app.use('/api/commercial-leases', commercialLeaseRoutes);
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { modelingProjects, asmpCommercialTenants } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import * as storage from "../services/lease-storage";

const router = Router();

// ============================================================================
// AUTH HELPERS (mirrors operations-context-routes pattern)
// ============================================================================

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.orgId || (req as any).tenantId;
  if (!orgId) {
    throw new Error('Missing organization context');
  }
  return orgId;
}

async function requireProjectInOrg(projectId: string, orgId: string): Promise<boolean> {
  const [project] = await db.select()
    .from(modelingProjects)
    .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
  return !!project;
}

// ============================================================================
// LEASE LIST + CREATE (scoped by project)
// ============================================================================

router.get("/projects/:projectId/leases", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const { limit, offset, search, leaseType, active, sortBy, sortDir } = req.query;
    const result = await storage.listLeases(db, projectId, {
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      search: search as string,
      leaseType: leaseType as string,
      active: active !== undefined ? active === "true" : undefined,
      sortBy: sortBy as string,
      sortDir: (sortDir as 'asc' | 'desc') || 'asc',
    });
    res.json(result); // { data, total, limit, offset, hasMore }
  } catch (e: any) {
    console.error("[CommercialLeaseEngine] Error listing leases:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/projects/:projectId/leases", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const lease = await storage.createLease(db, { ...req.body, projectId });
    await storage.recomputeAndStoreCashflows(db, lease.id).catch(() => {});
    res.status(201).json(lease);
  } catch (e: any) {
    console.error("[CommercialLeaseEngine] Error creating lease:", e);
    res.status(400).json({ error: e.message });
  }
});

// ============================================================================
// LEASE DETAIL / UPDATE / DELETE
// ============================================================================

router.get("/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    if (!detail) return res.status(404).json({ error: "Lease not found" });
    // Org-scope check: lease must belong to this org (operations context) or
    // to a project owned by this org (valuator context)
    if (detail.orgId && detail.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!detail.orgId && detail.projectId) {
      const allowed = await requireProjectInOrg(detail.projectId, orgId);
      if (!allowed) return res.status(403).json({ error: "Access denied" });
    }
    res.json(detail);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    const updated = await storage.updateLease(db, req.params.leaseId, req.body);
    if (!updated) return res.status(404).json({ error: "Lease not found" });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    await storage.deleteLease(db, req.params.leaseId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// TERMS CRUD
// ============================================================================

router.get("/leases/:leaseId/terms", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    res.json(detail?.terms || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/terms", async (req: Request, res: Response) => {
  try {
    const term = await storage.upsertTerm(db, { ...req.body, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(term);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/leases/:leaseId/terms/:termId", async (req: Request, res: Response) => {
  try {
    const term = await storage.upsertTerm(db, { ...req.body, id: req.params.termId, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json(term);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leases/:leaseId/terms/:termId", async (req: Request, res: Response) => {
  try {
    await storage.deleteTerm(db, req.params.termId);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// CHARGE LINES CRUD
// ============================================================================

router.get("/leases/:leaseId/charge-lines", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    res.json(detail?.chargeLines || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/charge-lines", async (req: Request, res: Response) => {
  try {
    const cl = await storage.upsertChargeLine(db, { ...req.body, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(cl);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/leases/:leaseId/charge-lines/:id", async (req: Request, res: Response) => {
  try {
    const cl = await storage.upsertChargeLine(db, { ...req.body, id: req.params.id, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json(cl);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leases/:leaseId/charge-lines/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteChargeLine(db, req.params.id);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// ABATEMENTS CRUD
// ============================================================================

router.get("/leases/:leaseId/abatements", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    res.json(detail?.abatements || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/abatements", async (req: Request, res: Response) => {
  try {
    const abat = await storage.upsertAbatement(db, { ...req.body, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(abat);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/leases/:leaseId/abatements/:id", async (req: Request, res: Response) => {
  try {
    const abat = await storage.upsertAbatement(db, { ...req.body, id: req.params.id, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json(abat);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leases/:leaseId/abatements/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteAbatement(db, req.params.id);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// SALES CRUD
// ============================================================================

router.get("/leases/:leaseId/sales", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    res.json(detail?.sales || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/sales", async (req: Request, res: Response) => {
  try {
    const sale = await storage.upsertSale(db, { ...req.body, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(sale);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leases/:leaseId/sales/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteSale(db, req.params.id);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// PERCENT RENT RULES CRUD
// ============================================================================

router.get("/leases/:leaseId/percent-rent", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    res.json(detail?.percentRentRules || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/percent-rent", async (req: Request, res: Response) => {
  try {
    const rule = await storage.upsertPercentRentRule(db, { ...req.body, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(rule);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/leases/:leaseId/percent-rent/:id", async (req: Request, res: Response) => {
  try {
    const rule = await storage.upsertPercentRentRule(db, { ...req.body, id: req.params.id, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json(rule);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leases/:leaseId/percent-rent/:id", async (req: Request, res: Response) => {
  try {
    await storage.deletePercentRentRule(db, req.params.id);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// TI PROGRAM + DRAWS
// ============================================================================

router.get("/leases/:leaseId/ti-program", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    res.json(detail?.tiPrograms || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/ti-program", async (req: Request, res: Response) => {
  try {
    const prog = await storage.upsertTiProgram(db, { ...req.body, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(prog);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/leases/:leaseId/ti-program/:id", async (req: Request, res: Response) => {
  try {
    const prog = await storage.upsertTiProgram(db, { ...req.body, id: req.params.id, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json(prog);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/leases/:leaseId/ti-draws", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    const allDraws: any[] = [];
    for (const prog of detail?.tiPrograms || []) {
      if ((prog as any).draws) allDraws.push(...(prog as any).draws);
    }
    res.json(allDraws);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/ti-draws", async (req: Request, res: Response) => {
  try {
    const draw = await storage.upsertTiDraw(db, req.body);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(draw);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leases/:leaseId/ti-draws/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteTiDraw(db, req.params.id);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// RECOVERY MODEL + CATEGORIES
// ============================================================================

router.get("/leases/:leaseId/recovery-model", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    res.json(detail?.recoveryModels || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/recovery-model", async (req: Request, res: Response) => {
  try {
    const model = await storage.upsertRecoveryModel(db, { ...req.body, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(model);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/leases/:leaseId/recovery-model/:id", async (req: Request, res: Response) => {
  try {
    const model = await storage.upsertRecoveryModel(db, { ...req.body, id: req.params.id, leaseId: req.params.leaseId });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json(model);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/leases/:leaseId/recovery-categories", async (req: Request, res: Response) => {
  try {
    const detail = await storage.getLeaseDetail(db, req.params.leaseId);
    const allCats: any[] = [];
    for (const model of detail?.recoveryModels || []) {
      if (model.categories) allCats.push(...model.categories);
    }
    res.json(allCats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/recovery-categories", async (req: Request, res: Response) => {
  try {
    const cat = await storage.upsertRecoveryCategory(db, req.body);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.status(201).json(cat);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/leases/:leaseId/recovery-categories/:id", async (req: Request, res: Response) => {
  try {
    const cat = await storage.upsertRecoveryCategory(db, { ...req.body, id: req.params.id });
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json(cat);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/leases/:leaseId/recovery-categories/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteRecoveryCategory(db, req.params.id);
    await storage.recomputeAndStoreCashflows(db, req.params.leaseId).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// CASHFLOWS + RECOMPUTE
// ============================================================================

router.get("/leases/:leaseId/cashflows", async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const rows = await storage.getCashflows(db, req.params.leaseId, from as string, to as string);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leases/:leaseId/cashflows/recompute", async (req: Request, res: Response) => {
  try {
    const rows = await storage.recomputeAndStoreCashflows(db, req.params.leaseId, req.body.startMonthEnd, req.body.endMonthEnd);
    res.json({ count: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// PROJECT ROLLUP (feeds into Pro Forma bridge)
// ============================================================================

router.get("/projects/:projectId/lease-rollup", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const { from, to } = req.query;
    const rollup = await storage.getProjectLeaseRollup(db, projectId, from as string, to as string);
    res.json(rollup);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// PROJECT STATS (KPIs independent of pagination)
// ============================================================================

router.get("/projects/:projectId/stats", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const stats = await storage.getProjectLeaseStats(db, projectId);
    res.json(stats);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================================================
// BULK RECOMPUTE (all active leases in project)
// ============================================================================

router.post("/projects/:projectId/bulk-recompute", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const result = await storage.bulkRecomputeProject(db, projectId, req.body.horizonStart, req.body.horizonEnd);
    res.json(result); // { recomputed, errors }
  } catch (e: any) {
    console.error("[CommercialLeaseEngine] Bulk recompute error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// BULK IMPORT (CSV/JSON array of leases)
// ============================================================================

router.post("/projects/:projectId/import", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const { leases: leaseData } = req.body;
    if (!Array.isArray(leaseData) || leaseData.length === 0) {
      return res.status(400).json({ error: "Request body must include a 'leases' array" });
    }
    if (leaseData.length > 500) {
      return res.status(400).json({ error: "Maximum 500 leases per import batch" });
    }

    const created: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < leaseData.length; i++) {
      try {
        const row = leaseData[i];
        if (!row.tenantName || !row.commencementDate || !row.expirationDate) {
          errors.push(`Row ${i + 1}: Missing required fields (tenantName, commencementDate, expirationDate)`);
          continue;
        }
        const lease = await storage.createLease(db, {
          ...row,
          projectId,
          sf: row.sf || "0",
          units: row.units || 1,
        });
        created.push(lease);
      } catch (e: any) {
        errors.push(`Row ${i + 1} (${leaseData[i]?.tenantName || 'unknown'}): ${e.message}`);
      }
    }

    // Bulk recompute all new leases
    if (created.length > 0) {
      await Promise.allSettled(
        created.map((l: any) => storage.recomputeAndStoreCashflows(db, l.id).catch(() => {}))
      );
    }

    res.status(201).json({
      imported: created.length,
      failed: errors.length,
      total: leaseData.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error("[CommercialLeaseEngine] Import error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// PRO FORMA SYNC STATUS + TOGGLE
// ============================================================================

router.get("/projects/:projectId/sync-status", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const [project] = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, projectId));

    const config = (project?.customMetrics as any) || {};
    const syncEnabled = config.commercialLeaseSyncEnabled !== false;
    const lastSyncedAt = config.commercialLeaseLastSyncedAt || null;

    const countResult = await db.select({ count: sql`count(*)::int` })
      .from(asmpCommercialTenants)
      .where(eq(asmpCommercialTenants.projectId, projectId));
    const monthsSynced = (countResult[0] as any)?.count || 0;

    res.json({ syncEnabled, lastSyncedAt, monthsSynced });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/projects/:projectId/sync-toggle", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const { syncEnabled } = req.body;

    const [project] = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, projectId));
    const config = (project?.customMetrics as any) || {};
    config.commercialLeaseSyncEnabled = !!syncEnabled;

    await db.update(modelingProjects)
      .set({ customMetrics: config, updatedAt: new Date() })
      .where(eq(modelingProjects.id, projectId));

    if (syncEnabled) {
      try {
        const { syncLeaseRollupToAssumptions } = await import("../services/commercial-lease-bridge");
        await syncLeaseRollupToAssumptions(projectId, orgId);
        config.commercialLeaseLastSyncedAt = new Date().toISOString();
        await db.update(modelingProjects)
          .set({ customMetrics: config })
          .where(eq(modelingProjects.id, projectId));
      } catch (syncErr) {
        console.warn("[CommercialLeaseEngine] Auto-sync after toggle-on failed:", syncErr);
      }
    }

    res.json({ syncEnabled: !!syncEnabled });
  } catch (e: any) {
    console.error("[CommercialLeaseEngine] Sync toggle error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// PRO FORMA BRIDGE — sync lease rollup into asmpCommercialTenants
// ============================================================================

router.post("/projects/:projectId/sync-to-proforma", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const { syncLeaseRollupToAssumptions } = await import("../services/commercial-lease-bridge");
    const result = await syncLeaseRollupToAssumptions(projectId, orgId);

    const [project] = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, projectId));
    const config = (project?.customMetrics as any) || {};
    config.commercialLeaseLastSyncedAt = new Date().toISOString();
    await db.update(modelingProjects)
      .set({ customMetrics: config })
      .where(eq(modelingProjects.id, projectId));

    res.json(result);
  } catch (e: any) {
    console.error("[CommercialLeaseEngine] Sync error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// CSV EXPORT
// ============================================================================

router.get("/leases/:leaseId/cashflows/export-csv", async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const rows = await storage.getCashflows(db, req.params.leaseId, from as string, to as string);
    const headers = [
      "month_end", "base_rent", "recoveries_cam", "recoveries_tax",
      "recoveries_insurance", "recoveries_utilities", "misc_income",
      "discounts", "percent_rent", "ti_landlord_capex",
      "ti_tenant_contribution", "ti_amortization_charge", "total_rent",
    ];
    const csvLines = [headers.join(",")];
    for (const r of rows) {
      csvLines.push([
        r.monthEnd, r.baseRent, r.recoveriesCam, r.recoveriesTax,
        r.recoveriesInsurance, r.recoveriesUtilities, r.miscIncome,
        r.discounts, r.percentRent, r.tiLandlordCapex,
        r.tiTenantContribution, r.tiAmortizationCharge, r.totalRent,
      ].join(","));
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="lease-cashflows-${req.params.leaseId}.csv"`);
    res.send(csvLines.join("\n"));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
