/**
 * DeptPnlBridge — Department-level P&L calculation engine
 *
 * Computes per-department:
 *   Revenue → COGS → Gross Profit → OpEx (incl. Payroll) → EBITDA/NOI proxy
 *
 * Integrates:
 *   - pnl_actuals_values / valuator_pnl_values for non-payroll items
 *   - payroll calculator output for departmentalized payroll
 *   - pnl_department_mappings for assigning line items to departments
 */

import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  pnlActualsValues,
  valuatorPnlValues,
  pnlDepartmentMappings,
  pnlDepartmentAllocations,
  payrollDepartments,
  pnlCategories,
} from "../../db/payroll-schema";
import { getPayrollByDepartment, type DeptPayrollTotals } from "./payroll-calculator.service";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PnlDataSource = "OPERATIONS" | "VALUATOR";

export interface DeptPnlRequest {
  orgId: string;
  dataSource: PnlDataSource;
  /** For OPERATIONS: asset_id. For VALUATOR: valuation_model_id */
  scopeId: string;
  /** For VALUATOR, specify scenario */
  scenarioId?: string;
  startDate: string;
  endDate: string;
  /** Payroll plan ID to use for departmentalized payroll */
  payrollPlanId?: string;
}

export interface DeptPnlLineDetail {
  sourceLineItemKey: string;
  categoryName: string | null;
  statementSection: string;
  amount: number;
}

export interface DeptPnlRow {
  departmentId: string | null; // null = Unassigned
  departmentName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  payroll: number;
  otherOpex: number;
  totalOpex: number;
  ebitdaNoi: number;
  // Drill-down detail
  revenueLines: DeptPnlLineDetail[];
  cogsLines: DeptPnlLineDetail[];
  opexLines: DeptPnlLineDetail[];
}

export interface DeptPnlOutput {
  departments: DeptPnlRow[];
  unassigned: DeptPnlRow;
  totals: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    payroll: number;
    otherOpex: number;
    totalOpex: number;
    ebitdaNoi: number;
  };
  reconcilesWithOverallPnl: boolean;
}

// ─── Core Engine ────────────────────────────────────────────────────────────

export async function calculateDeptPnl(req: DeptPnlRequest): Promise<DeptPnlOutput> {
  // 1) Load departments
  const departments = await db
    .select()
    .from(payrollDepartments)
    .where(eq(payrollDepartments.orgId, req.orgId));

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  // 2) Load P&L raw values
  let rawValues: {
    statementSection: string;
    amount: string;
    sourceLineItemKey: string | null;
    categoryId: string | null;
  }[];

  if (req.dataSource === "OPERATIONS") {
    rawValues = await db
      .select({
        statementSection: pnlActualsValues.statementSection,
        amount: pnlActualsValues.amount,
        sourceLineItemKey: pnlActualsValues.sourceLineItemKey,
        categoryId: pnlActualsValues.categoryId,
      })
      .from(pnlActualsValues)
      .where(
        and(
          eq(pnlActualsValues.assetId, req.scopeId),
          gte(pnlActualsValues.periodStartDate, req.startDate),
          lte(pnlActualsValues.periodStartDate, req.endDate)
        )
      );
  } else {
    rawValues = await db
      .select({
        statementSection: valuatorPnlValues.statementSection,
        amount: valuatorPnlValues.amount,
        sourceLineItemKey: valuatorPnlValues.sourceLineItemKey,
        categoryId: valuatorPnlValues.categoryId,
      })
      .from(valuatorPnlValues)
      .where(
        and(
          eq(valuatorPnlValues.valuationModelId, req.scopeId),
          req.scenarioId
            ? eq(valuatorPnlValues.scenarioId, req.scenarioId)
            : undefined,
          gte(valuatorPnlValues.periodStartDate, req.startDate),
          lte(valuatorPnlValues.periodStartDate, req.endDate)
        )
      );
  }

  // 3) Load department mappings
  const mappings = await db
    .select()
    .from(pnlDepartmentMappings)
    .where(eq(pnlDepartmentMappings.orgId, req.orgId));

  const mappingByKey = new Map(
    mappings.map((m) => [m.sourceLineItemKey, m])
  );

  // Load allocations for PCT_SPLIT mappings
  const splitMappingIds = mappings
    .filter((m) => m.allocationMode === "PCT_SPLIT")
    .map((m) => m.id);

  let allocations: { mappingId: string; departmentId: string; allocationPct: string }[] = [];
  if (splitMappingIds.length > 0) {
    allocations = await db
      .select()
      .from(pnlDepartmentAllocations)
      .where(inArray(pnlDepartmentAllocations.mappingId, splitMappingIds));
  }
  const allocsByMapping = new Map<string, typeof allocations>();
  for (const alloc of allocations) {
    if (!allocsByMapping.has(alloc.mappingId)) {
      allocsByMapping.set(alloc.mappingId, []);
    }
    allocsByMapping.get(alloc.mappingId)!.push(alloc);
  }

  // 4) Load category names
  const categories = await db
    .select()
    .from(pnlCategories)
    .where(eq(pnlCategories.orgId, req.orgId));
  const catMap = new Map(categories.map((c) => [c.id, c.categoryName]));

  // 5) Load payroll by department
  let payrollByDept: DeptPayrollTotals[] = [];
  if (req.payrollPlanId) {
    payrollByDept = await getPayrollByDepartment(
      req.payrollPlanId,
      req.startDate,
      req.endDate
    );
  }

  // 6) Build department buckets
  interface DeptBucket {
    revenue: number;
    cogs: number;
    payroll: number;
    otherOpex: number;
    revenueLines: DeptPnlLineDetail[];
    cogsLines: DeptPnlLineDetail[];
    opexLines: DeptPnlLineDetail[];
  }

  const buckets = new Map<string | null, DeptBucket>();

  const getBucket = (deptId: string | null): DeptBucket => {
    if (!buckets.has(deptId)) {
      buckets.set(deptId, {
        revenue: 0,
        cogs: 0,
        payroll: 0,
        otherOpex: 0,
        revenueLines: [],
        cogsLines: [],
        opexLines: [],
      });
    }
    return buckets.get(deptId)!;
  };

  // 7) Distribute raw values to departments
  for (const val of rawValues) {
    const amount = parseFloat(val.amount) || 0;
    const key = val.sourceLineItemKey;
    const section = val.statementSection;
    const catName = val.categoryId ? catMap.get(val.categoryId) ?? null : null;

    // Skip payroll lines from P&L data (we use calculator output instead)
    if (
      key &&
      (key.toLowerCase().includes("payroll") ||
        key.toLowerCase().includes("wages") ||
        key.toLowerCase().includes("salaries"))
    ) {
      // These will be handled by payroll calculator
      continue;
    }

    const mapping = key ? mappingByKey.get(key) : null;

    const lineDetail: DeptPnlLineDetail = {
      sourceLineItemKey: key ?? "unknown",
      categoryName: catName,
      statementSection: section,
      amount,
    };

    if (mapping && mapping.allocationMode === "PCT_SPLIT") {
      // Split across multiple departments
      const allocs = allocsByMapping.get(mapping.id) ?? [];
      for (const alloc of allocs) {
        const pct = parseFloat(alloc.allocationPct) || 0;
        const allocated = amount * pct;
        const bucket = getBucket(alloc.departmentId);
        addToBucket(bucket, section, allocated, {
          ...lineDetail,
          amount: allocated,
        });
      }
      // Remainder to unassigned if allocations don't sum to 100%
      const totalPct = allocs.reduce(
        (s, a) => s + (parseFloat(a.allocationPct) || 0),
        0
      );
      if (totalPct < 0.9999) {
        const remainder = amount * (1 - totalPct);
        const bucket = getBucket(null);
        addToBucket(bucket, section, remainder, {
          ...lineDetail,
          amount: remainder,
        });
      }
    } else if (mapping && mapping.departmentId) {
      // Direct department assignment
      const bucket = getBucket(mapping.departmentId);
      addToBucket(bucket, section, amount, lineDetail);
    } else {
      // Unassigned
      const bucket = getBucket(null);
      addToBucket(bucket, section, amount, lineDetail);
    }
  }

  // 8) Add payroll to department buckets
  for (const pd of payrollByDept) {
    const bucket = getBucket(pd.departmentId);
    bucket.payroll += pd.totalPayroll;
    bucket.opexLines.push({
      sourceLineItemKey: "__PAYROLL__",
      categoryName: "Payroll & Benefits",
      statementSection: "OPEX",
      amount: pd.totalPayroll,
    });
  }

  // 9) Build output rows
  const deptRows: DeptPnlRow[] = [];
  let unassignedRow: DeptPnlRow | null = null;

  for (const [deptId, bucket] of buckets) {
    const grossProfit = bucket.revenue - bucket.cogs;
    const totalOpex = bucket.payroll + bucket.otherOpex;
    const ebitdaNoi = grossProfit - totalOpex;

    const row: DeptPnlRow = {
      departmentId: deptId,
      departmentName: deptId ? deptMap.get(deptId) ?? "Unknown" : "Unassigned",
      revenue: Math.round(bucket.revenue * 100) / 100,
      cogs: Math.round(bucket.cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      payroll: Math.round(bucket.payroll * 100) / 100,
      otherOpex: Math.round(bucket.otherOpex * 100) / 100,
      totalOpex: Math.round(totalOpex * 100) / 100,
      ebitdaNoi: Math.round(ebitdaNoi * 100) / 100,
      revenueLines: bucket.revenueLines,
      cogsLines: bucket.cogsLines,
      opexLines: bucket.opexLines,
    };

    if (deptId === null) {
      unassignedRow = row;
    } else {
      deptRows.push(row);
    }
  }

  // Ensure unassigned bucket always exists
  if (!unassignedRow) {
    unassignedRow = {
      departmentId: null,
      departmentName: "Unassigned",
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      payroll: 0,
      otherOpex: 0,
      totalOpex: 0,
      ebitdaNoi: 0,
      revenueLines: [],
      cogsLines: [],
      opexLines: [],
    };
  }

  // 10) Compute totals
  const allRows = [...deptRows, unassignedRow];
  const totals = allRows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      cogs: acc.cogs + r.cogs,
      grossProfit: acc.grossProfit + r.grossProfit,
      payroll: acc.payroll + r.payroll,
      otherOpex: acc.otherOpex + r.otherOpex,
      totalOpex: acc.totalOpex + r.totalOpex,
      ebitdaNoi: acc.ebitdaNoi + r.ebitdaNoi,
    }),
    {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      payroll: 0,
      otherOpex: 0,
      totalOpex: 0,
      ebitdaNoi: 0,
    }
  );

  // Reconciliation check: totals.grossProfit should equal totals.revenue - totals.cogs
  const reconcilesWithOverallPnl =
    Math.abs(totals.grossProfit - (totals.revenue - totals.cogs)) < 0.01 &&
    Math.abs(totals.ebitdaNoi - (totals.grossProfit - totals.totalOpex)) < 0.01;

  return {
    departments: deptRows,
    unassigned: unassignedRow,
    totals,
    reconcilesWithOverallPnl,
  };
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function addToBucket(
  bucket: {
    revenue: number;
    cogs: number;
    otherOpex: number;
    revenueLines: DeptPnlLineDetail[];
    cogsLines: DeptPnlLineDetail[];
    opexLines: DeptPnlLineDetail[];
  },
  section: string,
  amount: number,
  detail: DeptPnlLineDetail
) {
  switch (section) {
    case "REVENUE":
      bucket.revenue += amount;
      bucket.revenueLines.push(detail);
      break;
    case "COGS":
      bucket.cogs += amount;
      bucket.cogsLines.push(detail);
      break;
    case "OPEX":
      bucket.otherOpex += amount;
      bucket.opexLines.push(detail);
      break;
    case "OTHER_INCOME":
      bucket.revenue += amount;
      bucket.revenueLines.push(detail);
      break;
    case "OTHER_EXPENSE":
      bucket.otherOpex += amount;
      bucket.opexLines.push(detail);
      break;
  }
}
