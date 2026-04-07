/**
 * Payroll API Routes — CRUD + Calculator + Sync
 *
 * All routes protected by payroll authorization middleware.
 * Response data is redacted based on effective permissions.
 */

import { Router, Request, Response } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  payrollPlans,
  payrollPlanLines,
  payrollRateEvents,
  payrollWeeklyHours,
  payrollAllocations,
  payrollBonusEvents,
  payrollDepartments,
  payrollPositions,
  payrollEmployees,
  payrollBurdenProfiles,
  payrollBurdenItems,
  seasonalityTemplates,
  payrollIntegrations,
  valuationModelPayrollLinks,
} from "../../db/payroll-schema";
import {
  requirePayrollAccess,
  redactPayrollLine,
  filterCalcOutput,
  canViewDetailLevel,
  type EffectivePermissions,
} from "../services/payroll-auth.service";
import { calculatePayroll } from "../services/payroll-calculator.service";

export const payrollRouter = Router();

// Attach auth to all payroll routes
const checkAccess = requirePayrollAccess("ORG");

// ─── PLANS ──────────────────────────────────────────────────────────────────

payrollRouter.get("/plans", checkAccess, async (req: Request, res: Response) => {
  try {
    const { portfolioId, assetId, type, orgId } = req.query;
    let conditions: any[] = [];

    if (orgId) conditions.push(eq(payrollPlans.orgId, orgId as string));
    if (portfolioId) conditions.push(eq(payrollPlans.portfolioId, portfolioId as string));
    if (assetId) conditions.push(eq(payrollPlans.assetId, assetId as string));
    if (type) conditions.push(eq(payrollPlans.planType, type as any));

    const plans = await db
      .select()
      .from(payrollPlans)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.post("/plans", requirePayrollAccess("ORG"), async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const [plan] = await db.insert(payrollPlans).values(req.body).returning();
    res.status(201).json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.get("/plans/:id", checkAccess, async (req: Request, res: Response) => {
  try {
    const [plan] = await db
      .select()
      .from(payrollPlans)
      .where(eq(payrollPlans.id, req.params.id));

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const perms = (req as any).payrollPerms as EffectivePermissions;

    // Load lines
    const lines = await db
      .select()
      .from(payrollPlanLines)
      .where(eq(payrollPlanLines.planId, plan.id));

    // Redact lines based on permissions
    const redactedLines = lines.map((l) => redactPayrollLine(l, perms));

    // If detail level doesn't allow position lines, strip them
    if (!canViewDetailLevel(perms, "POSITION_LINES")) {
      res.json({ plan, lineCount: lines.length });
    } else {
      res.json({ plan, lines: redactedLines });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.put("/plans/:id", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const [updated] = await db
      .update(payrollPlans)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(payrollPlans.id, req.params.id))
      .returning();

    res.json({ plan: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.delete("/plans/:id", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canAdmin) return res.status(403).json({ error: "Admin permission required" });

    await db.delete(payrollPlans).where(eq(payrollPlans.id, req.params.id));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PLAN LINES ─────────────────────────────────────────────────────────────

payrollRouter.post("/plans/:id/lines", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    if (!req.body.departmentId) {
      return res.status(400).json({ error: "departmentId is required" });
    }

    const [line] = await db
      .insert(payrollPlanLines)
      .values({ ...req.body, planId: req.params.id })
      .returning();

    res.status(201).json({ line });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.put("/lines/:lineId", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const [updated] = await db
      .update(payrollPlanLines)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(payrollPlanLines.id, req.params.lineId))
      .returning();

    res.json({ line: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.delete("/lines/:lineId", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    await db.delete(payrollPlanLines).where(eq(payrollPlanLines.id, req.params.lineId));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RATE EVENTS ────────────────────────────────────────────────────────────

payrollRouter.post(
  "/lines/:lineId/rate-events",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const perms = (req as any).payrollPerms as EffectivePermissions;
      if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

      const [event] = await db
        .insert(payrollRateEvents)
        .values({ ...req.body, planLineId: req.params.lineId })
        .returning();

      res.status(201).json({ rateEvent: event });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── WEEKLY HOURS BULK ──────────────────────────────────────────────────────

payrollRouter.post(
  "/lines/:lineId/weekly-hours/bulk",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const perms = (req as any).payrollPerms as EffectivePermissions;
      if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

      const { hours } = req.body; // array of { weekStartDate, hours }
      if (!Array.isArray(hours)) {
        return res.status(400).json({ error: "hours must be an array" });
      }

      // Delete existing hours for this line
      await db
        .delete(payrollWeeklyHours)
        .where(eq(payrollWeeklyHours.planLineId, req.params.lineId));

      // Insert new
      if (hours.length > 0) {
        const rows = hours.map((h: any) => ({
          planLineId: req.params.lineId,
          weekStartDate: h.weekStartDate,
          hours: h.hours.toString(),
        }));
        await db.insert(payrollWeeklyHours).values(rows);
      }

      res.json({ saved: hours.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── ALLOCATIONS BULK ───────────────────────────────────────────────────────

payrollRouter.post(
  "/lines/:lineId/allocations/bulk",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const perms = (req as any).payrollPerms as EffectivePermissions;
      if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

      const { allocations } = req.body;
      if (!Array.isArray(allocations)) {
        return res.status(400).json({ error: "allocations must be an array" });
      }

      // Validate total pct <= 1
      const total = allocations.reduce((s: number, a: any) => s + (parseFloat(a.allocationPct) || 0), 0);
      if (total > 1.0001) {
        return res.status(400).json({ error: "Allocation percentages exceed 100%" });
      }

      await db
        .delete(payrollAllocations)
        .where(eq(payrollAllocations.planLineId, req.params.lineId));

      if (allocations.length > 0) {
        await db.insert(payrollAllocations).values(
          allocations.map((a: any) => ({
            planLineId: req.params.lineId,
            assetId: a.assetId ?? null,
            departmentId: a.departmentId ?? null,
            profitCenterId: a.profitCenterId ?? null,
            allocationPct: a.allocationPct.toString(),
            allocationNotes: a.allocationNotes ?? null,
          }))
        );
      }

      res.json({ saved: allocations.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── BONUS EVENTS ───────────────────────────────────────────────────────────

payrollRouter.post(
  "/lines/:lineId/bonus-events",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const perms = (req as any).payrollPerms as EffectivePermissions;
      if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

      const [bonus] = await db
        .insert(payrollBonusEvents)
        .values({ ...req.body, planLineId: req.params.lineId })
        .returning();

      res.status(201).json({ bonus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── CALCULATION ────────────────────────────────────────────────────────────

payrollRouter.get("/plans/:id/calc", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    const { granularity, start, end } = req.query;

    const output = await calculatePayroll({
      planId: req.params.id,
      granularity: (granularity as "weekly" | "monthly") ?? "monthly",
      startDate: start as string,
      endDate: end as string,
    });

    // Redact based on permissions
    const filtered = filterCalcOutput(output, perms);

    // Redact individual line fields
    if (filtered.lineResults) {
      filtered.lineResults = filtered.lineResults.map((lr: any) =>
        redactPayrollLine(lr, perms)
      );
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEPARTMENTS ────────────────────────────────────────────────────────────

payrollRouter.get("/departments", checkAccess, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).payrollAuth.orgId;
    const depts = await db
      .select()
      .from(payrollDepartments)
      .where(eq(payrollDepartments.orgId, orgId as string));
    res.json({ departments: depts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.post("/departments", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const [dept] = await db.insert(payrollDepartments).values(req.body).returning();
    res.status(201).json({ department: dept });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POSITIONS (LIBRARY) ───────────────────────────────────────────────────

payrollRouter.get("/positions", checkAccess, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).payrollAuth.orgId;
    const { templateOnly, assetClass } = req.query;

    let conditions: any[] = [eq(payrollPositions.orgId, orgId as string)];
    if (templateOnly === "true") conditions.push(eq(payrollPositions.isTemplate, true));
    if (assetClass) conditions.push(eq(payrollPositions.assetClass, assetClass as any));

    const pos = await db
      .select()
      .from(payrollPositions)
      .where(and(...conditions));

    res.json({ positions: pos });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.post("/positions", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const [pos] = await db.insert(payrollPositions).values(req.body).returning();
    res.status(201).json({ position: pos });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────

payrollRouter.get("/employees", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    const orgId = (req as any).payrollAuth.orgId;

    const emps = await db
      .select()
      .from(payrollEmployees)
      .where(eq(payrollEmployees.orgId, orgId as string));

    const redacted = emps.map((e) => {
      if (!perms.canViewEmployeeNames) {
        return {
          ...e,
          firstName: "***",
          lastName: "***",
          displayName: `Employee #${e.id.slice(0, 6)}`,
        };
      }
      return e;
    });

    res.json({ employees: redacted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.post("/employees", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const [emp] = await db.insert(payrollEmployees).values(req.body).returning();
    res.status(201).json({ employee: emp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BURDEN PROFILES ────────────────────────────────────────────────────────

payrollRouter.get("/burden-profiles", checkAccess, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).payrollAuth.orgId;
    const profiles = await db
      .select()
      .from(payrollBurdenProfiles)
      .where(eq(payrollBurdenProfiles.orgId, orgId as string));

    // Load items for itemized profiles
    const profileIds = profiles.filter((p) => p.mode === "ITEMIZED").map((p) => p.id);
    let items: any[] = [];
    if (profileIds.length > 0) {
      items = await db
        .select()
        .from(payrollBurdenItems)
        .where(inArray(payrollBurdenItems.burdenProfileId, profileIds));
    }

    const itemsByProfile: Record<string, any[]> = {};
    for (const item of items) {
      if (!itemsByProfile[item.burdenProfileId]) itemsByProfile[item.burdenProfileId] = [];
      itemsByProfile[item.burdenProfileId].push(item);
    }

    const result = profiles.map((p) => ({
      ...p,
      items: itemsByProfile[p.id] ?? [],
    }));

    res.json({ burdenProfiles: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.post("/burden-profiles", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;
    if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

    const { items, ...profileData } = req.body;
    const [profile] = await db.insert(payrollBurdenProfiles).values(profileData).returning();

    if (items?.length > 0 && profile.mode === "ITEMIZED") {
      await db.insert(payrollBurdenItems).values(
        items.map((it: any) => ({ ...it, burdenProfileId: profile.id }))
      );
    }

    res.status(201).json({ burdenProfile: profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEASONALITY TEMPLATES ──────────────────────────────────────────────────

payrollRouter.get("/seasonality-templates", checkAccess, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).payrollAuth.orgId;
    const templates = await db
      .select()
      .from(seasonalityTemplates)
      .where(eq(seasonalityTemplates.orgId, orgId as string));

    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

payrollRouter.post(
  "/lines/:lineId/apply-seasonality",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const perms = (req as any).payrollPerms as EffectivePermissions;
      if (!perms.canEdit) return res.status(403).json({ error: "Edit permission required" });

      const { templateId, startDate } = req.body;

      // Load template
      const [template] = await db
        .select()
        .from(seasonalityTemplates)
        .where(eq(seasonalityTemplates.id, templateId));

      if (!template) return res.status(404).json({ error: "Template not found" });

      const pattern = template.weeklyHoursPattern as number[];
      if (!Array.isArray(pattern) || pattern.length !== 52) {
        return res.status(400).json({ error: "Invalid template pattern" });
      }

      // Generate 52 weekly hours starting from startDate
      const start = new Date(startDate);
      const day = start.getDay();
      if (day !== 1) start.setDate(start.getDate() - ((day + 6) % 7)); // align to Monday

      const hours = pattern.map((h, i) => {
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + i * 7);
        return {
          weekStartDate: weekStart.toISOString().split("T")[0],
          hours: h.toString(),
        };
      });

      // Delete existing and insert
      await db
        .delete(payrollWeeklyHours)
        .where(eq(payrollWeeklyHours.planLineId, req.params.lineId));

      await db.insert(payrollWeeklyHours).values(
        hours.map((h) => ({
          planLineId: req.params.lineId,
          ...h,
        }))
      );

      res.json({ applied: 52 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── INTEGRATIONS ───────────────────────────────────────────────────────────

payrollRouter.get("/integrations", checkAccess, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).payrollAuth.orgId;
    const integrations = await db
      .select()
      .from(payrollIntegrations)
      .where(eq(payrollIntegrations.orgId, orgId as string));

    // Never expose tokens
    const safe = integrations.map(({ accessTokenEncrypted, refreshTokenEncrypted, ...rest }) => rest);
    res.json({ integrations: safe });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CSV EXPORT ─────────────────────────────────────────────────────────────

payrollRouter.get("/plans/:id/export", checkAccess, async (req: Request, res: Response) => {
  try {
    const perms = (req as any).payrollPerms as EffectivePermissions;

    if (!perms.canExport) {
      return res.status(403).json({ error: "Export permission required" });
    }

    const { granularity, start, end } = req.query;
    const output = await calculatePayroll({
      planId: req.params.id,
      granularity: (granularity as "weekly" | "monthly") ?? "monthly",
      startDate: start as string,
      endDate: end as string,
    });

    // Build CSV
    const headers = [
      "Position",
      perms.canViewEmployeeNames ? "Employee" : null,
      "Department",
      "Worker Type",
      "Headcount",
      perms.canViewCompRates ? "Pay Type" : null,
      perms.canViewCompRates ? "Annual Salary / Hourly Rate" : null,
      "Base Pay",
      "Benefits",
      "Taxes",
      "Workers Comp",
      "Other Burden",
      "Total Burdens",
      "Bonuses",
      "Adjustments",
      "Total Loaded",
    ].filter(Boolean);

    const rows = output.lineResults.map((lr) => {
      const row: (string | number)[] = [lr.positionTitle ?? ""];
      if (perms.canViewEmployeeNames) row.push(lr.employeeName ?? "");
      row.push(lr.departmentName ?? "");
      row.push(lr.workerType);
      row.push(lr.headcount);
      if (perms.canViewCompRates) {
        row.push(lr.payType);
        row.push(lr.payType === "SALARY" ? lr.annualTotal.basePay : "");
      }
      row.push(lr.annualTotal.basePay);
      row.push(lr.annualTotal.benefits);
      row.push(lr.annualTotal.taxes);
      row.push(lr.annualTotal.workersComp);
      row.push(lr.annualTotal.otherBurden);
      row.push(lr.annualTotal.totalBurdens);
      row.push(lr.annualTotal.bonuses);
      row.push(lr.annualTotal.adjustments);
      row.push(lr.annualTotal.totalLoaded);
      return row;
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="payroll-export-${req.params.id}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
