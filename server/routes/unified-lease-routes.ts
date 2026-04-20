/**
 * Unified Lease Routes
 * ====================
 * Operations-context endpoints + Connect flow.
 * 
 * Mount at: app.use("/api/commercial-leases", authenticateUser, unifiedLeaseRoutes)
 * 
 * These routes ADD to the existing commercial-lease-routes.ts.
 * The existing /projects/:projectId/* routes stay as-is.
 * These add /operations/* and /projects/:projectId/import-from-operations.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { commercialLeases, leaseTerms } from "@shared/commercial-lease-schema";
import { modelingProjects } from "@shared/schema";
import {
  listOperationsLeases,
  getOperationsStats,
  getAvailableForImport,
} from "../services/lease-ops-storage";
import {
  importFromOperations,
  pushToOperations,
} from "../services/lease-connect";

const router = Router();

// ─── Auth helper (matches commercial-lease-routes pattern) ─────────────────
function getOrgId(req: Request): string {
  const orgId = (req as any).user?.orgId || (req as any).tenantId;
  if (!orgId) {
    throw new Error("Unauthorized – org context missing");
  }
  return orgId;
}

async function requireProjectInOrg(projectId: string, orgId: string): Promise<boolean> {
  const [project] = await db
    .select({ id: modelingProjects.id })
    .from(modelingProjects)
    .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
  return !!project;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATIONS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /operations/leases — List org-scoped leases
router.get("/operations/leases", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { propertyId, search, status, leaseType, limit, offset, sortBy, sortDir } = req.query;

    const result = await listOperationsLeases(db, orgId, {
      propertyId: propertyId as string,
      search: search as string,
      status: (status as any) || "all",
      leaseType: leaseType as string,
      limit: limit ? parseInt(limit as string) : 25,
      offset: offset ? parseInt(offset as string) : 0,
      sortBy: sortBy as string,
      sortDir: (sortDir as "asc" | "desc") || "asc",
    });

    res.json(result);
  } catch (error: any) {
    console.error("[UnifiedLeases] Error listing operations leases:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /operations/stats — KPI summary for Operations
router.get("/operations/stats", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { propertyId } = req.query;

    const stats = await getOperationsStats(db, orgId, propertyId as string);
    res.json(stats);
  } catch (error: any) {
    console.error("[UnifiedLeases] Error getting operations stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /operations/leases/:leaseId — Get single Operations lease with details
router.get("/operations/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { leaseId } = req.params;

    const [lease] = await db
      .select()
      .from(commercialLeases)
      .where(
        and(
          eq(commercialLeases.id, leaseId),
          eq(commercialLeases.orgId, orgId),
          eq(commercialLeases.leaseContext, "operations")
        )
      );

    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }

    // Get terms
    const terms = await db
      .select()
      .from(leaseTerms)
      .where(eq(leaseTerms.leaseId, leaseId));

    res.json({ ...lease, terms });
  } catch (error: any) {
    console.error("[UnifiedLeases] Error getting operations lease:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /operations/leases — Create Operations lease
router.post("/operations/leases", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { lease: leaseData, initialTerm } = req.body;

    if (!leaseData?.tenantName || !leaseData?.commencementDate || !leaseData?.expirationDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create the lease
    const [lease] = await db
      .insert(commercialLeases)
      .values({
        ...leaseData,
        orgId,
        projectId: null, // Operations leases have no project
        leaseContext: "operations",
        propertyId: leaseData.propertyId || null,
        sf: String(leaseData.sf || 0),
        active: leaseData.active !== false,
      })
      .returning();

    // Create initial term if provided
    if (initialTerm) {
      await db.insert(leaseTerms).values({
        leaseId: lease.id,
        termIndex: 0,
        startDate: initialTerm.termStartDate || leaseData.commencementDate,
        endDate: initialTerm.termEndDate || leaseData.expirationDate,
        baseRentMode: initialTerm.baseRentInputUnit || "PER_SF_YEAR",
        baseRentValue: String(initialTerm.baseRentInputValue || 0),
        escalationType: initialTerm.escalationType || "NONE",
        escalationValue: String(initialTerm.escalationValue || 0),
        escalationCycleMonths: initialTerm.escalationFrequencyMonths || 12,
      });
    }

    res.status(201).json(lease);
  } catch (error: any) {
    console.error("[UnifiedLeases] Error creating operations lease:", error);
    res.status(400).json({ error: error.message });
  }
});

// PATCH /operations/leases/:leaseId — Update Operations lease
router.patch("/operations/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { leaseId } = req.params;

    // Verify ownership
    const [existing] = await db
      .select({ id: commercialLeases.id })
      .from(commercialLeases)
      .where(
        and(
          eq(commercialLeases.id, leaseId),
          eq(commercialLeases.orgId, orgId),
          eq(commercialLeases.leaseContext, "operations")
        )
      );

    if (!existing) {
      return res.status(404).json({ error: "Lease not found" });
    }

    const { lease: leaseUpdates, initialTerm } = req.body;

    // Update lease fields
    if (leaseUpdates) {
      const { id: _id, orgId: _oid, leaseContext: _ctx, ...safeUpdates } = leaseUpdates;
      if (safeUpdates.sf) safeUpdates.sf = String(safeUpdates.sf);

      await db
        .update(commercialLeases)
        .set({ ...safeUpdates, updatedAt: new Date() })
        .where(eq(commercialLeases.id, leaseId));
    }

    // Update initial term if provided
    if (initialTerm) {
      const [existingTerm] = await db
        .select()
        .from(leaseTerms)
        .where(
          and(eq(leaseTerms.leaseId, leaseId), eq(leaseTerms.termIndex, 0))
        );

      const termData = {
        startDate: initialTerm.termStartDate,
        endDate: initialTerm.termEndDate,
        baseRentMode: initialTerm.baseRentInputUnit,
        baseRentValue: String(initialTerm.baseRentInputValue || 0),
        escalationType: initialTerm.escalationType || "NONE",
        escalationValue: String(initialTerm.escalationValue || 0),
        escalationCycleMonths: initialTerm.escalationFrequencyMonths || 12,
        updatedAt: new Date(),
      };

      if (existingTerm) {
        await db
          .update(leaseTerms)
          .set(termData)
          .where(eq(leaseTerms.id, existingTerm.id));
      } else {
        await db.insert(leaseTerms).values({
          ...termData,
          leaseId,
          termIndex: 0,
        });
      }
    }

    // Fetch and return updated
    const [updated] = await db
      .select()
      .from(commercialLeases)
      .where(eq(commercialLeases.id, leaseId));

    res.json(updated);
  } catch (error: any) {
    console.error("[UnifiedLeases] Error updating operations lease:", error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /operations/leases/:leaseId — Delete Operations lease
router.delete("/operations/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { leaseId } = req.params;

    const [existing] = await db
      .select({ id: commercialLeases.id })
      .from(commercialLeases)
      .where(
        and(
          eq(commercialLeases.id, leaseId),
          eq(commercialLeases.orgId, orgId),
          eq(commercialLeases.leaseContext, "operations")
        )
      );

    if (!existing) {
      return res.status(404).json({ error: "Lease not found" });
    }

    // Cascade deletes handle sub-resources
    await db.delete(commercialLeases).where(eq(commercialLeases.id, leaseId));
    res.status(204).send();
  } catch (error: any) {
    console.error("[UnifiedLeases] Error deleting operations lease:", error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECT FLOW ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /projects/:projectId/available-ops-leases — Leases available for import
router.get(
  "/projects/:projectId/available-ops-leases",
  async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req);
      const { projectId } = req.params;
      const { propertyId } = req.query;

      if (!await requireProjectInOrg(projectId, orgId)) {
        return res.status(404).json({ error: "Project not found" });
      }

      const available = await getAvailableForImport(
        db,
        orgId,
        projectId,
        propertyId as string
      );

      res.json(available);
    } catch (error: any) {
      console.error("[UnifiedLeases] Error getting available leases:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /projects/:projectId/import-from-operations — Import Operations leases
router.post(
  "/projects/:projectId/import-from-operations",
  async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req);
      const { projectId } = req.params;
      const { leaseIds, mode = "snapshot" } = req.body;

      if (!await requireProjectInOrg(projectId, orgId)) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!Array.isArray(leaseIds) || leaseIds.length === 0) {
        return res.status(400).json({ error: "No lease IDs provided" });
      }

      if (leaseIds.length > 100) {
        return res.status(400).json({ error: "Maximum 100 leases per import" });
      }

      const result = await importFromOperations(
        db,
        orgId,
        projectId,
        leaseIds,
        mode as "snapshot" | "linked"
      );

      res.json(result);
    } catch (error: any) {
      console.error("[UnifiedLeases] Error importing from operations:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /leases/:leaseId/push-to-operations — Push changes back to Operations
router.post(
  "/leases/:leaseId/push-to-operations",
  async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req);
      const { leaseId } = req.params;

      const result = await pushToOperations(db, orgId, leaseId);
      res.json(result);
    } catch (error: any) {
      console.error("[UnifiedLeases] Error pushing to operations:", error);
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;
