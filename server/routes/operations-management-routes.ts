import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  workOrders,
  workOrderUpdates,
  vendors,
  vendorRatings,
  capexProjects,
  inspectionTemplates,
  inspections,
} from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth-resolver";

export const operationsManagementRouter = Router();

function getOrgId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedOrgId) return authReq.validatedOrgId;
  return (req as any).tenantId || (req as any).user?.orgId || (req as any).session?.orgId || 'org-1';
}

function getUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedUserId) return authReq.validatedUserId;
  return (req as any).session?.userId || (req as any).user?.id || 'user-1';
}

// ─── 5.1 Work Orders ────────────────────────────────────────────────────

// POST /work-orders — create work order with auto-generated workOrderNumber
operationsManagementRouter.post("/work-orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const year = new Date().getFullYear();

    // Count existing work orders this year to generate sequential number
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, orgId),
          sql`EXTRACT(YEAR FROM ${workOrders.createdAt}) = ${year}`
        )
      );

    const seqNum = (Number(existing) || 0) + 1;
    const workOrderNumber = `WO-${year}-${String(seqNum).padStart(4, "0")}`;

    const [row] = await db
      .insert(workOrders)
      .values({ ...req.body, orgId, workOrderNumber })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// GET /work-orders — list all for org (filter by dealId, status, priority)
operationsManagementRouter.get("/work-orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const conditions = [eq(workOrders.orgId, orgId)];

    if (req.query.dealId) {
      conditions.push(eq(workOrders.dealId, req.query.dealId as string));
    }
    if (req.query.status) {
      conditions.push(eq(workOrders.status, req.query.status as string));
    }
    if (req.query.priority) {
      conditions.push(eq(workOrders.priority, req.query.priority as string));
    }

    const rows = await db
      .select()
      .from(workOrders)
      .where(and(...conditions))
      .orderBy(desc(workOrders.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /work-orders/summary/deal/:dealId — cost summary for deal
operationsManagementRouter.get("/work-orders/summary/deal/:dealId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { dealId } = req.params;

    const [summary] = await db
      .select({
        totalWorkOrders: count(),
        totalEstimatedCost: sql<string>`COALESCE(SUM(${workOrders.estimatedCost}::numeric), 0)`,
        totalActualCost: sql<string>`COALESCE(SUM(${workOrders.actualCost}::numeric), 0)`,
        totalLaborHours: sql<string>`COALESCE(SUM(${workOrders.laborHours}::numeric), 0)`,
      })
      .from(workOrders)
      .where(and(eq(workOrders.orgId, orgId), eq(workOrders.dealId, dealId)));

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /work-orders/:id — get single
operationsManagementRouter.get("/work-orders/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, req.params.id), eq(workOrders.orgId, orgId)));

    if (!row) return res.status(404).json({ error: "Work order not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// PUT /work-orders/:id — update
operationsManagementRouter.put("/work-orders/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .update(workOrders)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(workOrders.id, req.params.id), eq(workOrders.orgId, orgId)))
      .returning();

    if (!row) return res.status(404).json({ error: "Work order not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// PATCH /work-orders/:id/status — update status + create workOrderUpdate entry
operationsManagementRouter.patch("/work-orders/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { status, note } = req.body;

    // Get current status
    const [current] = await db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, req.params.id), eq(workOrders.orgId, orgId)));

    if (!current) return res.status(404).json({ error: "Work order not found" });

    const previousStatus = current.status;

    const [updated] = await db
      .update(workOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(workOrders.id, req.params.id))
      .returning();

    // Create status change update
    await db.insert(workOrderUpdates).values({
      workOrderId: req.params.id,
      userId,
      updateType: "status_change",
      previousStatus,
      newStatus: status,
      note: note || null,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /work-orders/:id/updates — add update/note
operationsManagementRouter.post("/work-orders/:id/updates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const [row] = await db
      .insert(workOrderUpdates)
      .values({
        ...req.body,
        workOrderId: req.params.id,
        userId,
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// GET /work-orders/:id/updates — get updates for work order
operationsManagementRouter.get("/work-orders/:id/updates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select()
      .from(workOrderUpdates)
      .where(eq(workOrderUpdates.workOrderId, req.params.id))
      .orderBy(desc(workOrderUpdates.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── 5.2 Vendors ────────────────────────────────────────────────────────

// GET /vendors — list all vendors for org
operationsManagementRouter.get("/vendors", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.orgId, orgId))
      .orderBy(desc(vendors.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /vendors — create vendor
operationsManagementRouter.post("/vendors", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .insert(vendors)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// GET /vendors/:id — get vendor detail
operationsManagementRouter.get("/vendors/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, req.params.id), eq(vendors.orgId, orgId)));

    if (!row) return res.status(404).json({ error: "Vendor not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// PUT /vendors/:id — update vendor
operationsManagementRouter.put("/vendors/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .update(vendors)
      .set(req.body)
      .where(and(eq(vendors.id, req.params.id), eq(vendors.orgId, orgId)))
      .returning();

    if (!row) return res.status(404).json({ error: "Vendor not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// DELETE /vendors/:id — delete vendor
operationsManagementRouter.delete("/vendors/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .delete(vendors)
      .where(and(eq(vendors.id, req.params.id), eq(vendors.orgId, orgId)))
      .returning();

    if (!row) return res.status(404).json({ error: "Vendor not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /vendors/:id/work-orders — work orders assigned to vendor
operationsManagementRouter.get("/vendors/:id/work-orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const rows = await db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.vendorId, req.params.id), eq(workOrders.orgId, orgId)))
      .orderBy(desc(workOrders.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /vendors/:id/ratings — add rating
operationsManagementRouter.post("/vendors/:id/ratings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const [row] = await db
      .insert(vendorRatings)
      .values({
        ...req.body,
        vendorId: req.params.id,
        ratedBy: userId,
      })
      .returning();

    // Update vendor avg_rating
    const [avg] = await db
      .select({
        avgRating: sql<string>`ROUND(AVG(${vendorRatings.rating}), 2)`,
      })
      .from(vendorRatings)
      .where(eq(vendorRatings.vendorId, req.params.id));

    await db
      .update(vendors)
      .set({ avgRating: avg.avgRating })
      .where(eq(vendors.id, req.params.id));

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// GET /vendors/:id/ratings — get ratings
operationsManagementRouter.get("/vendors/:id/ratings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select()
      .from(vendorRatings)
      .where(eq(vendorRatings.vendorId, req.params.id))
      .orderBy(desc(vendorRatings.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── 5.3 CapEx ──────────────────────────────────────────────────────────

// POST /capex — create capex project
operationsManagementRouter.post("/capex", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .insert(capexProjects)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// GET /capex — list (filter by dealId, status)
operationsManagementRouter.get("/capex", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const conditions = [eq(capexProjects.orgId, orgId)];

    if (req.query.dealId) {
      conditions.push(eq(capexProjects.dealId, req.query.dealId as string));
    }
    if (req.query.status) {
      conditions.push(eq(capexProjects.status, req.query.status as string));
    }

    const rows = await db
      .select()
      .from(capexProjects)
      .where(and(...conditions))
      .orderBy(desc(capexProjects.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /capex/summary/deal/:dealId — budget vs actual summary
operationsManagementRouter.get("/capex/summary/deal/:dealId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { dealId } = req.params;

    const [summary] = await db
      .select({
        totalProjects: count(),
        totalBudgeted: sql<string>`COALESCE(SUM(${capexProjects.budgetedAmount}::numeric), 0)`,
        totalContracted: sql<string>`COALESCE(SUM(${capexProjects.contractedAmount}::numeric), 0)`,
        totalActualSpend: sql<string>`COALESCE(SUM(${capexProjects.actualSpendToDate}::numeric), 0)`,
        totalProjectedCost: sql<string>`COALESCE(SUM(${capexProjects.projectedTotalCost}::numeric), 0)`,
      })
      .from(capexProjects)
      .where(and(eq(capexProjects.orgId, orgId), eq(capexProjects.dealId, dealId)));

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /capex/:id — get single
operationsManagementRouter.get("/capex/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .select()
      .from(capexProjects)
      .where(and(eq(capexProjects.id, req.params.id), eq(capexProjects.orgId, orgId)));

    if (!row) return res.status(404).json({ error: "CapEx project not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// PUT /capex/:id — update
operationsManagementRouter.put("/capex/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .update(capexProjects)
      .set(req.body)
      .where(and(eq(capexProjects.id, req.params.id), eq(capexProjects.orgId, orgId)))
      .returning();

    if (!row) return res.status(404).json({ error: "CapEx project not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ─── 5.4 Inspections ───────────────────────────────────────────────────

// POST /inspection-templates — create template
operationsManagementRouter.post("/inspection-templates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .insert(inspectionTemplates)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// GET /inspection-templates — list templates for org
operationsManagementRouter.get("/inspection-templates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const rows = await db
      .select()
      .from(inspectionTemplates)
      .where(eq(inspectionTemplates.orgId, orgId))
      .orderBy(desc(inspectionTemplates.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /inspections — create/schedule inspection
operationsManagementRouter.post("/inspections", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .insert(inspections)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// GET /inspections — list (filter by dealId, status)
operationsManagementRouter.get("/inspections", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const conditions = [eq(inspections.orgId, orgId)];

    if (req.query.dealId) {
      conditions.push(eq(inspections.dealId, req.query.dealId as string));
    }
    if (req.query.status) {
      conditions.push(eq(inspections.status, req.query.status as string));
    }

    const rows = await db
      .select()
      .from(inspections)
      .where(and(...conditions))
      .orderBy(desc(inspections.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /inspections/:id — get single
operationsManagementRouter.get("/inspections/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .select()
      .from(inspections)
      .where(and(eq(inspections.id, req.params.id), eq(inspections.orgId, orgId)));

    if (!row) return res.status(404).json({ error: "Inspection not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// PUT /inspections/:id — update (findings, status, rating)
operationsManagementRouter.put("/inspections/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const [row] = await db
      .update(inspections)
      .set(req.body)
      .where(and(eq(inspections.id, req.params.id), eq(inspections.orgId, orgId)))
      .returning();

    if (!row) return res.status(404).json({ error: "Inspection not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});
