/**
 * Valuator Payroll Routes — Import, Clone, Sync, Update Actuals
 */

import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import {
  payrollPlans,
  payrollPlanLines,
  valuationModelPayrollLinks,
} from "../../db/payroll-schema";
import { requirePayrollAccess } from "../services/payroll-auth.service";
import { calculatePayroll } from "../services/payroll-calculator.service";

export const valuatorPayrollRouter = Router();

const checkAccess = requirePayrollAccess("VALUATION_MODEL");

// ─── IMPORT SELLER PAYROLL (CSV/XLSX mapping) ──────────────────────────────

valuatorPayrollRouter.post(
  "/:modelId/payroll/import",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      const { rows, name, startDate, endDate } = req.body;
      // rows: array of { positionTitle, departmentName, payType, salaryAnnual, hourlyRate, hoursPerWeek, headcount, workerType }

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "Import rows required" });
      }

      const auth = (req as any).payrollAuth;

      // Create a SELLER_TRAILING plan
      const [plan] = await db
        .insert(payrollPlans)
        .values({
          orgId: auth.orgId,
          name: name ?? `Seller Payroll - ${new Date().toISOString().split("T")[0]}`,
          planType: "SELLER_TRAILING",
          startDate: startDate ?? new Date().toISOString().split("T")[0],
          endDate: endDate ?? new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
          periodGranularity: "MONTHLY",
          createdBy: auth.userId,
        })
        .returning();

      // Create lines from imported rows
      // Note: departmentId is required — caller must map department names to IDs before import
      const lines = rows.map((row: any, idx: number) => ({
        planId: plan.id,
        departmentId: row.departmentId, // REQUIRED
        payType: row.payType ?? "SALARY",
        salaryAnnual: row.salaryAnnual?.toString() ?? null,
        hourlyRate: row.hourlyRate?.toString() ?? null,
        hoursPerWeek: row.hoursPerWeek?.toString() ?? null,
        headcount: (row.headcount ?? 1).toString(),
        notes: row.positionTitle ?? null,
        sortOrder: idx,
      }));

      const inserted = await db.insert(payrollPlanLines).values(lines).returning();

      res.status(201).json({
        plan,
        linesImported: inserted.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── CLONE TO PRO FORMA ────────────────────────────────────────────────────

valuatorPayrollRouter.post(
  "/:modelId/payroll/clone-to-proforma",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      const { sourcePlanId, scenarioId, name, yearPreset } = req.body;
      const auth = (req as any).payrollAuth;

      // Load source plan
      const [sourcePlan] = await db
        .select()
        .from(payrollPlans)
        .where(eq(payrollPlans.id, sourcePlanId));

      if (!sourcePlan) return res.status(404).json({ error: "Source plan not found" });

      // Create pro forma plan
      const [proformaPlan] = await db
        .insert(payrollPlans)
        .values({
          orgId: auth.orgId,
          name: name ?? `Pro Forma - ${yearPreset ?? "Year 1"} - ${sourcePlan.name}`,
          planType: "UNDERWRITING_PROFORMA",
          scenarioId: scenarioId ?? null,
          startDate: sourcePlan.startDate,
          endDate: sourcePlan.endDate,
          periodGranularity: sourcePlan.periodGranularity,
          defaultBurdenProfileId: sourcePlan.defaultBurdenProfileId,
          createdBy: auth.userId,
        })
        .returning();

      // Copy lines
      const sourceLines = await db
        .select()
        .from(payrollPlanLines)
        .where(eq(payrollPlanLines.planId, sourcePlanId));

      if (sourceLines.length > 0) {
        const newLines = sourceLines.map((line) => ({
          planId: proformaPlan.id,
          positionId: line.positionId,
          employeeId: null, // pro forma collapses employees to positions
          departmentId: line.departmentId,
          profitCenterId: line.profitCenterId,
          headcount: line.headcount,
          payType: line.payType,
          salaryAnnual: line.salaryAnnual,
          hourlyRate: line.hourlyRate,
          hoursPerWeek: line.hoursPerWeek,
          weeksPerYear: line.weeksPerYear,
          adjustments: line.adjustments,
          burdenProfileId: line.burdenProfileId,
          notes: line.notes,
          sortOrder: line.sortOrder,
        }));

        await db.insert(payrollPlanLines).values(newLines);
      }

      // Apply year preset adjustments
      if (yearPreset === "YEAR_1_TRANSITION") {
        // Year 1 typically has higher staffing / overlap costs
        // No structural changes, but flag as transition year
      } else if (yearPreset === "YEAR_2") {
        // Could apply efficiency adjustments — for now, just clone
      } else if (yearPreset === "YEAR_3_STABILIZED") {
        // Stabilized — could remove seasonal overlap positions
      }

      res.status(201).json({
        proformaPlan,
        linesCloned: sourceLines.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── SYNC NOW (Ops → Valuator Actuals Snapshot) ────────────────────────────

valuatorPayrollRouter.post(
  "/:modelId/payroll/sync-now",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;
      const { operationsPlanId } = req.body;
      const auth = (req as any).payrollAuth;

      // Load source ops plan
      const [opsPlan] = await db
        .select()
        .from(payrollPlans)
        .where(eq(payrollPlans.id, operationsPlanId));

      if (!opsPlan) return res.status(404).json({ error: "Operations plan not found" });

      // Check if snapshot already exists
      const [existingLink] = await db
        .select()
        .from(valuationModelPayrollLinks)
        .where(
          and(
            eq(valuationModelPayrollLinks.valuationModelId, modelId),
            eq(valuationModelPayrollLinks.operationsPlanId, operationsPlanId)
          )
        );

      let snapshotPlanId: string;

      if (existingLink?.valuatorActualsPlanId) {
        // Delete existing snapshot lines and re-create
        snapshotPlanId = existingLink.valuatorActualsPlanId;
        await db
          .delete(payrollPlanLines)
          .where(eq(payrollPlanLines.planId, snapshotPlanId));

        // Update plan dates
        await db
          .update(payrollPlans)
          .set({
            startDate: opsPlan.startDate,
            endDate: opsPlan.endDate,
            updatedAt: new Date(),
          })
          .where(eq(payrollPlans.id, snapshotPlanId));
      } else {
        // Create new snapshot plan
        const [snapshot] = await db
          .insert(payrollPlans)
          .values({
            orgId: auth.orgId,
            assetId: opsPlan.assetId,
            name: `Actuals Snapshot - ${opsPlan.name}`,
            planType: "VALUATOR_ACTUALS_SNAPSHOT",
            startDate: opsPlan.startDate,
            endDate: opsPlan.endDate,
            periodGranularity: opsPlan.periodGranularity,
            isSourceOfTruthForOwnedModel: true,
            createdBy: auth.userId,
          })
          .returning();
        snapshotPlanId = snapshot.id;
      }

      // Copy lines from ops
      const opsLines = await db
        .select()
        .from(payrollPlanLines)
        .where(eq(payrollPlanLines.planId, operationsPlanId));

      if (opsLines.length > 0) {
        await db.insert(payrollPlanLines).values(
          opsLines.map((line) => ({
            ...line,
            id: undefined, // let DB generate new IDs
            planId: snapshotPlanId,
          }))
        );
      }

      // Upsert link
      if (existingLink) {
        await db
          .update(valuationModelPayrollLinks)
          .set({
            valuatorActualsPlanId: snapshotPlanId,
            lastSyncedAt: new Date(),
          })
          .where(eq(valuationModelPayrollLinks.id, existingLink.id));
      } else {
        await db.insert(valuationModelPayrollLinks).values({
          valuationModelId: modelId,
          operationsPlanId,
          valuatorActualsPlanId: snapshotPlanId,
          syncMode: "MANUAL",
          lastSyncedAt: new Date(),
        });
      }

      res.json({
        snapshotPlanId,
        linesSynced: opsLines.length,
        syncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── UPDATE ACTUALS (refresh snapshot, preserve assumptions) ────────────────

valuatorPayrollRouter.post(
  "/:modelId/payroll/update-actuals",
  checkAccess,
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.params;

      // Find the link
      const [link] = await db
        .select()
        .from(valuationModelPayrollLinks)
        .where(eq(valuationModelPayrollLinks.valuationModelId, modelId));

      if (!link) {
        return res.status(404).json({ error: "No sync link found for this model" });
      }

      // Re-sync: same as sync-now but we preserve the pro forma plans
      // Only the actuals snapshot is updated
      const opsPlanId = link.operationsPlanId;
      const snapshotPlanId = link.valuatorActualsPlanId;

      if (!snapshotPlanId) {
        return res.status(400).json({ error: "No snapshot plan to update" });
      }

      // Clear snapshot lines
      await db
        .delete(payrollPlanLines)
        .where(eq(payrollPlanLines.planId, snapshotPlanId));

      // Copy latest ops lines
      const opsLines = await db
        .select()
        .from(payrollPlanLines)
        .where(eq(payrollPlanLines.planId, opsPlanId));

      if (opsLines.length > 0) {
        await db.insert(payrollPlanLines).values(
          opsLines.map((line) => ({
            ...line,
            id: undefined,
            planId: snapshotPlanId,
          }))
        );
      }

      // Update timestamp
      await db
        .update(valuationModelPayrollLinks)
        .set({ lastSyncedAt: new Date() })
        .where(eq(valuationModelPayrollLinks.id, link.id));

      // NOTE: Pro forma plans and their assumptions are NOT touched.
      // The Valuator UI re-runs model outputs using the updated actuals.

      res.json({
        updated: true,
        linesSynced: opsLines.length,
        syncedAt: new Date().toISOString(),
        message: "Actuals refreshed. Pro forma assumptions unchanged.",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
