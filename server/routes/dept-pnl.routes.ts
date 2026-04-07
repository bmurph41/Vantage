/**
 * Department P&L Bridge API Routes
 * Computes departmentalized P&L with payroll integration
 */

import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import {
  pnlDepartmentMappings,
  pnlDepartmentAllocations,
  pnlCategories,
  pnlLineItems,
  pnlActualsValues,
  valuatorPnlValues,
} from "../../db/payroll-schema";
import { requirePayrollAccess, type EffectivePermissions } from "../services/payroll-auth.service";
import { calculateDeptPnl, type DeptPnlRequest } from "../services/dept-pnl-bridge.service";

export const deptPnlRouter = Router();

const checkAccess = requirePayrollAccess("ORG");

// ─── DEPARTMENT P&L CALCULATION ─────────────────────────────────────────────

deptPnlRouter.get("/calculate", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    const auth = (req as any).payrollAuth;
    const { dataSource, scopeId, scenarioId, startDate, endDate, payrollPlanId } = req.query;

    if (!dataSource || !scopeId || !startDate || !endDate) {
      return res.status(400).json({
        error: "Required: dataSource, scopeId, startDate, endDate",
      });
    }

    const request: DeptPnlRequest = {
      orgId: auth.orgId,
      dataSource: dataSource as any,
      scopeId: scopeId as string,
      scenarioId: scenarioId as string | undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      payrollPlanId: payrollPlanId as string | undefined,
    };

    const output = await calculateDeptPnl(request);

    // Redact drill-down if user doesn't have sufficient detail level
    if (perms.detailLevelMax === "TOTALS_ONLY") {
      // Strip department breakdown entirely
      return res.json({
        totals: output.totals,
        reconcilesWithOverallPnl: output.reconcilesWithOverallPnl,
      });
    }

    if (perms.detailLevelMax === "DEPT_TOTALS") {
      // Strip line-level detail from departments
      const stripped = output.departments.map((d) => ({
        ...d,
        revenueLines: [],
        cogsLines: [],
        opexLines: [],
      }));
      return res.json({
        departments: stripped,
        unassigned: { ...output.unassigned, revenueLines: [], cogsLines: [], opexLines: [] },
        totals: output.totals,
        reconcilesWithOverallPnl: output.reconcilesWithOverallPnl,
      });
    }

    res.json(output);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── P&L CATEGORIES ─────────────────────────────────────────────────────────

deptPnlRouter.get("/categories", checkAccess, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).payrollAuth.orgId;
    const categories = await db
      .select()
      .from(pnlCategories)
      .where(eq(pnlCategories.orgId, orgId as string));

    res.json({ categories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

deptPnlRouter.post("/categories", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const [cat] = await db.insert(pnlCategories).values(req.body).returning();
    res.status(201).json({ category: cat });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEPARTMENT MAPPINGS ────────────────────────────────────────────────────

deptPnlRouter.get("/mappings", checkAccess, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).payrollAuth.orgId;
    const mappings = await db
      .select()
      .from(pnlDepartmentMappings)
      .where(eq(pnlDepartmentMappings.orgId, orgId as string));

    // Load allocations for split mappings
    const splitIds = mappings.filter((m) => m.allocationMode === "PCT_SPLIT").map((m) => m.id);
    let allocs: any[] = [];
    if (splitIds.length > 0) {
      allocs = await db
        .select()
        .from(pnlDepartmentAllocations);
      // Filter client-side for simplicity
      allocs = allocs.filter((a: any) => splitIds.includes(a.mappingId));
    }

    const allocsByMapping = new Map<string, any[]>();
    for (const a of allocs) {
      if (!allocsByMapping.has(a.mappingId)) allocsByMapping.set(a.mappingId, []);
      allocsByMapping.get(a.mappingId)!.push(a);
    }

    const result = mappings.map((m) => ({
      ...m,
      allocations: allocsByMapping.get(m.id) ?? [],
    }));

    res.json({ mappings: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

deptPnlRouter.post("/mappings", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const { allocations, ...mappingData } = req.body;

    const [mapping] = await db.insert(pnlDepartmentMappings).values(mappingData).returning();

    // Create allocations if PCT_SPLIT
    if (mappingData.allocationMode === "PCT_SPLIT" && Array.isArray(allocations)) {
      const totalPct = allocations.reduce(
        (s: number, a: any) => s + (parseFloat(a.allocationPct) || 0),
        0
      );
      if (totalPct > 1.0001) {
        return res.status(400).json({ error: "Allocation percentages exceed 100%" });
      }

      if (allocations.length > 0) {
        await db.insert(pnlDepartmentAllocations).values(
          allocations.map((a: any) => ({
            mappingId: mapping.id,
            departmentId: a.departmentId,
            allocationPct: a.allocationPct.toString(),
          }))
        );
      }
    }

    res.status(201).json({ mapping });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

deptPnlRouter.put("/mappings/:id", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const { allocations, ...mappingData } = req.body;

    const [updated] = await db
      .update(pnlDepartmentMappings)
      .set({ ...mappingData, updatedAt: new Date() })
      .where(eq(pnlDepartmentMappings.id, req.params.id))
      .returning();

    // Replace allocations
    if (allocations !== undefined) {
      await db
        .delete(pnlDepartmentAllocations)
        .where(eq(pnlDepartmentAllocations.mappingId, req.params.id));

      if (Array.isArray(allocations) && allocations.length > 0) {
        await db.insert(pnlDepartmentAllocations).values(
          allocations.map((a: any) => ({
            mappingId: req.params.id,
            departmentId: a.departmentId,
            allocationPct: a.allocationPct.toString(),
          }))
        );
      }
    }

    res.json({ mapping: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

deptPnlRouter.delete("/mappings/:id", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    await db
      .delete(pnlDepartmentMappings)
      .where(eq(pnlDepartmentMappings.id, req.params.id));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UNASSIGNED ITEMS ───────────────────────────────────────────────────────

deptPnlRouter.get("/unassigned", checkAccess, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).payrollAuth?.orgId;
    const { assetId, startDate, endDate } = req.query;

    if (!assetId || !startDate || !endDate) {
      return res.status(400).json({ error: "assetId, startDate, endDate required" });
    }

    // Get all unique source_line_item_keys from actuals
    const actuals = await db
      .select({
        sourceLineItemKey: pnlActualsValues.sourceLineItemKey,
        statementSection: pnlActualsValues.statementSection,
      })
      .from(pnlActualsValues)
      .where(
        and(
          eq(pnlActualsValues.assetId, assetId as string),
          eq(pnlActualsValues.orgId, orgId)
        )
      );

    // Get existing mappings
    const mappings = await db
      .select()
      .from(pnlDepartmentMappings)
      .where(eq(pnlDepartmentMappings.orgId, orgId));

    const mappedKeys = new Set(mappings.map((m) => m.sourceLineItemKey));

    // Find unassigned
    const unassigned = actuals
      .filter((a) => a.sourceLineItemKey && !mappedKeys.has(a.sourceLineItemKey))
      .reduce(
        (acc: { key: string; section: string }[], a) => {
          if (!acc.find((x) => x.key === a.sourceLineItemKey)) {
            acc.push({
              key: a.sourceLineItemKey!,
              section: a.statementSection,
            });
          }
          return acc;
        },
        []
      );

    res.json({ unassigned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── P&L EXPORT ─────────────────────────────────────────────────────────────

deptPnlRouter.get("/export", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canExport) {
      return res.status(403).json({ error: "Export permission required" });
    }

    const auth = (req as any).payrollAuth;
    const { dataSource, scopeId, scenarioId, startDate, endDate, payrollPlanId } = req.query;

    const output = await calculateDeptPnl({
      orgId: auth.orgId,
      dataSource: dataSource as any,
      scopeId: scopeId as string,
      scenarioId: scenarioId as string | undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      payrollPlanId: payrollPlanId as string | undefined,
    });

    const headers = [
      "Department",
      "Revenue",
      "COGS",
      "Gross Profit",
      "Payroll",
      "Other OpEx",
      "Total OpEx",
      "EBITDA/NOI",
    ];

    const allRows = [...output.departments, output.unassigned];
    const csvRows = allRows.map((d) =>
      [
        d.departmentName,
        d.revenue,
        d.cogs,
        d.grossProfit,
        d.payroll,
        d.otherOpex,
        d.totalOpex,
        d.ebitdaNoi,
      ].join(",")
    );

    // Add totals row
    csvRows.push(
      [
        "TOTAL",
        output.totals.revenue,
        output.totals.cogs,
        output.totals.grossProfit,
        output.totals.payroll,
        output.totals.otherOpex,
        output.totals.totalOpex,
        output.totals.ebitdaNoi,
      ].join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=dept-pnl-export.csv");
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
