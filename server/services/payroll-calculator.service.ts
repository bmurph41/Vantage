/**
 * PayrollCalculator — Canonical payroll calculation engine
 *
 * For any plan_id and date range, computes:
 *  - Base pay (salary or hourly) with rate events
 *  - Burdens (simple % or itemized)
 *  - Bonuses (FIXED / PCT_SALARY / PERFORMANCE) with day precision
 *  - Adjustments
 *  - Allocation splits
 *  - Rollups by department, worker type, and totals
 */

import { eq, and, gte, lte, asc } from "drizzle-orm";
import { db } from "../../db";
import {
  payrollPlans,
  payrollPlanLines,
  payrollRateEvents,
  payrollWeeklyHours,
  payrollAllocations,
  payrollBonusEvents,
  payrollBurdenProfiles,
  payrollBurdenItems,
  payrollDepartments,
  payrollEmployees,
  payrollPositions,
} from "../../db/payroll-schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Granularity = "weekly" | "monthly";

export interface CalcRequest {
  planId: string;
  granularity: Granularity;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  kpiValues?: Record<string, number>; // for performance bonuses: { REVENUE: 1200000, ... }
}

export interface PeriodResult {
  periodStart: string;
  periodEnd: string;
  basePay: number;
  benefits: number;
  taxes: number;
  workersComp: number;
  otherBurden: number;
  totalBurdens: number;
  bonuses: number;
  adjustments: number;
  totalLoaded: number;
}

export interface LineCalcResult {
  lineId: string;
  positionTitle: string | null;
  employeeName: string | null;
  employeeId: string | null;
  departmentId: string;
  departmentName: string | null;
  workerType: string;
  payType: string;
  headcount: number;
  periods: PeriodResult[];
  annualTotal: {
    basePay: number;
    benefits: number;
    taxes: number;
    workersComp: number;
    otherBurden: number;
    totalBurdens: number;
    bonuses: number;
    adjustments: number;
    totalLoaded: number;
  };
  allocations: AllocatedResult[] | null;
}

export interface AllocatedResult {
  assetId: string | null;
  departmentId: string | null;
  profitCenterId: string | null;
  allocationPct: number;
  allocatedTotal: number;
}

export interface DeptRollup {
  departmentId: string;
  departmentName: string;
  basePay: number;
  totalBurdens: number;
  bonuses: number;
  adjustments: number;
  totalLoaded: number;
  headcount: number;
  lineCount: number;
}

export interface WorkerTypeRollup {
  workerType: string;
  basePay: number;
  totalBurdens: number;
  bonuses: number;
  totalLoaded: number;
  headcount: number;
}

export interface CalcOutput {
  planId: string;
  planName: string;
  granularity: Granularity;
  startDate: string;
  endDate: string;
  lineResults: LineCalcResult[];
  departmentRollups: DeptRollup[];
  workerTypeRollups: WorkerTypeRollup[];
  grandTotals: {
    basePay: number;
    benefits: number;
    taxes: number;
    workersComp: number;
    otherBurden: number;
    totalBurdens: number;
    bonuses: number;
    adjustments: number;
    totalLoaded: number;
    totalHeadcount: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNum(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

/** Get Monday-start week boundaries within a date range */
function getWeekPeriods(start: string, end: string): { start: string; end: string }[] {
  const periods: { start: string; end: string }[] = [];
  let current = new Date(start);
  // Align to Monday
  const day = current.getDay();
  if (day !== 1) {
    current.setDate(current.getDate() - ((day + 6) % 7));
  }
  const endDate = new Date(end);

  while (current <= endDate) {
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    periods.push({
      start: current.toISOString().split("T")[0],
      end: (weekEnd > endDate ? endDate : weekEnd).toISOString().split("T")[0],
    });
    current.setDate(current.getDate() + 7);
  }
  return periods;
}

/** Get month boundaries within a date range */
function getMonthPeriods(start: string, end: string): { start: string; end: string }[] {
  const periods: { start: string; end: string }[] = [];
  let current = new Date(start);
  current.setDate(1); // first of month
  const endDate = new Date(end);

  while (current <= endDate) {
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    periods.push({
      start: current.toISOString().split("T")[0],
      end: (monthEnd > endDate ? endDate : monthEnd).toISOString().split("T")[0],
    });
    current.setMonth(current.getMonth() + 1);
    current.setDate(1);
  }
  return periods;
}

/** Find applicable rate for a given date from sorted rate events */
function getEffectiveRate(
  rateEvents: { effectiveDate: string; salaryAnnualNew: string | null; hourlyRateNew: string | null }[],
  baseSalary: number,
  baseHourly: number,
  asOfDate: string
): { salary: number; hourlyRate: number } {
  let salary = baseSalary;
  let hourlyRate = baseHourly;

  for (const evt of rateEvents) {
    if (evt.effectiveDate <= asOfDate) {
      if (evt.salaryAnnualNew !== null) salary = parseNum(evt.salaryAnnualNew);
      if (evt.hourlyRateNew !== null) hourlyRate = parseNum(evt.hourlyRateNew);
    } else {
      break; // sorted ascending, so once we pass the date, stop
    }
  }

  return { salary, hourlyRate };
}

/** Count weeks in a month period */
function weeksInPeriod(start: string, end: string): number {
  const d1 = new Date(start);
  const d2 = new Date(end);
  const days = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24) + 1;
  return days / 7;
}

// ─── Main Calculator ────────────────────────────────────────────────────────

export async function calculatePayroll(req: CalcRequest): Promise<CalcOutput> {
  // 1) Load plan
  const [plan] = await db
    .select()
    .from(payrollPlans)
    .where(eq(payrollPlans.id, req.planId));

  if (!plan) throw new Error(`Plan not found: ${req.planId}`);

  // 2) Load all lines with relations
  const lines = await db
    .select()
    .from(payrollPlanLines)
    .where(eq(payrollPlanLines.planId, req.planId))
    .orderBy(asc(payrollPlanLines.sortOrder));

  // 3) Load departments for name lookup
  const depts = await db
    .select()
    .from(payrollDepartments)
    .where(eq(payrollDepartments.orgId, plan.orgId));
  const deptMap = Object.fromEntries(depts.map((d) => [d.id, d.name]));

  // 4) Load all employees and positions for this org
  const employees = await db
    .select()
    .from(payrollEmployees)
    .where(eq(payrollEmployees.orgId, plan.orgId));
  const empMap = Object.fromEntries(
    employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`])
  );
  const empWorkerTypeMap = Object.fromEntries(
    employees.map((e) => [e.id, e.workerType])
  );

  const positions = await db
    .select()
    .from(payrollPositions)
    .where(eq(payrollPositions.orgId, plan.orgId));
  const posMap = Object.fromEntries(positions.map((p) => [p.id, p.title]));

  // 5) Load burden profiles + items
  const burdenProfiles = await db
    .select()
    .from(payrollBurdenProfiles)
    .where(eq(payrollBurdenProfiles.orgId, plan.orgId));
  const burdenProfileMap = Object.fromEntries(burdenProfiles.map((b) => [b.id, b]));

  const allBurdenItems = await db.select().from(payrollBurdenItems);
  const burdenItemsByProfile: Record<string, (typeof allBurdenItems)[0][]> = {};
  for (const item of allBurdenItems) {
    if (!burdenItemsByProfile[item.burdenProfileId]) {
      burdenItemsByProfile[item.burdenProfileId] = [];
    }
    burdenItemsByProfile[item.burdenProfileId].push(item);
  }

  // 6) Get periods
  const periods =
    req.granularity === "weekly"
      ? getWeekPeriods(req.startDate, req.endDate)
      : getMonthPeriods(req.startDate, req.endDate);

  // 7) Process each line
  const lineResults: LineCalcResult[] = [];

  for (const line of lines) {
    // Load rate events for this line
    const rateEvents = await db
      .select()
      .from(payrollRateEvents)
      .where(eq(payrollRateEvents.planLineId, line.id))
      .orderBy(asc(payrollRateEvents.effectiveDate));

    // Load weekly hours overrides
    const weeklyHoursRows = await db
      .select()
      .from(payrollWeeklyHours)
      .where(eq(payrollWeeklyHours.planLineId, line.id));
    const weeklyHoursMap = Object.fromEntries(
      weeklyHoursRows.map((w) => [w.weekStartDate, parseNum(w.hours)])
    );

    // Load allocations
    const allocRows = await db
      .select()
      .from(payrollAllocations)
      .where(eq(payrollAllocations.planLineId, line.id));

    // Load bonus events in range
    const bonusRows = await db
      .select()
      .from(payrollBonusEvents)
      .where(
        and(
          eq(payrollBonusEvents.planLineId, line.id),
          gte(payrollBonusEvents.payDate, req.startDate),
          lte(payrollBonusEvents.payDate, req.endDate)
        )
      );

    // Get burden profile
    const burdenProfileId = line.burdenProfileId ?? plan.defaultBurdenProfileId;
    const burdenProfile = burdenProfileId ? burdenProfileMap[burdenProfileId] : null;
    const burdenItems = burdenProfileId ? burdenItemsByProfile[burdenProfileId] ?? [] : [];

    const headcount = parseNum(line.headcount);
    const baseSalary = parseNum(line.salaryAnnual);
    const baseHourly = parseNum(line.hourlyRate);
    const baseHoursPerWeek = parseNum(line.hoursPerWeek);
    const lineAdjustments = parseNum(line.adjustments);

    const periodResults: PeriodResult[] = [];

    for (const period of periods) {
      // Get effective rate for this period
      const { salary, hourlyRate } = getEffectiveRate(
        rateEvents,
        baseSalary,
        baseHourly,
        period.start
      );

      // Calculate base pay
      let basePay = 0;
      if (line.payType === "SALARY") {
        if (req.granularity === "weekly") {
          basePay = (salary / 52) * headcount;
        } else {
          basePay = (salary / 12) * headcount;
        }
      } else {
        // HOURLY
        let hours: number;
        if (req.granularity === "weekly") {
          // Check for override
          hours = weeklyHoursMap[period.start] ?? baseHoursPerWeek;
          basePay = hours * hourlyRate * headcount;
        } else {
          // Monthly: sum weekly hours that fall in this month
          const monthWeeks = getWeekPeriods(period.start, period.end);
          let totalHours = 0;
          for (const wk of monthWeeks) {
            totalHours += weeklyHoursMap[wk.start] ?? baseHoursPerWeek;
          }
          basePay = totalHours * hourlyRate * headcount;
        }
      }

      // Calculate burdens
      let benefits = 0;
      let taxes = 0;
      let workersComp = 0;
      let otherBurden = 0;

      if (burdenProfile) {
        if (burdenProfile.mode === "SIMPLE_PCT") {
          benefits = basePay * parseNum(burdenProfile.benefitsPct);
          taxes = (basePay + benefits) * parseNum(burdenProfile.taxesPct);
          workersComp = basePay * parseNum(burdenProfile.workersCompPct);
          otherBurden = basePay * parseNum(burdenProfile.otherBurdenPct);
        } else {
          // ITEMIZED
          let benefitsTotal = 0;
          for (const item of burdenItems) {
            const rate = parseNum(item.rateNumeric);
            let amount = 0;

            switch (item.calcMethod) {
              case "PCT_OF_BASE":
                amount = basePay * rate;
                break;
              case "PCT_OF_BASE_PLUS_BENEFITS":
                amount = (basePay + benefitsTotal) * rate;
                break;
              case "FLAT_PER_PERIOD":
                amount = rate * headcount;
                break;
              case "FLAT_PER_HOUR": {
                const hrs =
                  req.granularity === "weekly"
                    ? (weeklyHoursMap[period.start] ?? baseHoursPerWeek)
                    : baseHoursPerWeek * weeksInPeriod(period.start, period.end);
                amount = rate * hrs * headcount;
                break;
              }
            }

            switch (item.itemType) {
              case "BENEFIT":
                benefits += amount;
                benefitsTotal += amount;
                break;
              case "TAX":
                taxes += amount;
                break;
              case "WORKERS_COMP":
                workersComp += amount;
                break;
              case "OTHER":
                otherBurden += amount;
                break;
            }
          }
        }
      }

      const totalBurdens = benefits + taxes + workersComp + otherBurden;

      // Bonuses in this period
      let periodBonuses = 0;
      for (const bonus of bonusRows) {
        if (bonus.payDate >= period.start && bonus.payDate <= period.end) {
          switch (bonus.bonusType) {
            case "FIXED":
              periodBonuses += parseNum(bonus.amountNumeric);
              break;
            case "PCT_SALARY":
              periodBonuses += parseNum(bonus.pctNumeric) * salary;
              break;
            case "PERFORMANCE": {
              const kpiVal =
                req.kpiValues?.[bonus.kpiKey ?? "CUSTOM"] ?? 0;
              periodBonuses += parseNum(bonus.pctNumeric) * kpiVal;
              break;
            }
          }
        }
      }

      // Adjustments (spread equally across periods or monthly lump)
      const periodAdjustments =
        req.granularity === "weekly"
          ? lineAdjustments / 52
          : lineAdjustments / 12;

      const totalLoaded = basePay + totalBurdens + periodBonuses + periodAdjustments;

      periodResults.push({
        periodStart: period.start,
        periodEnd: period.end,
        basePay: Math.round(basePay * 100) / 100,
        benefits: Math.round(benefits * 100) / 100,
        taxes: Math.round(taxes * 100) / 100,
        workersComp: Math.round(workersComp * 100) / 100,
        otherBurden: Math.round(otherBurden * 100) / 100,
        totalBurdens: Math.round(totalBurdens * 100) / 100,
        bonuses: Math.round(periodBonuses * 100) / 100,
        adjustments: Math.round(periodAdjustments * 100) / 100,
        totalLoaded: Math.round(totalLoaded * 100) / 100,
      });
    }

    // Sum annual totals
    const annualTotal = periodResults.reduce(
      (acc, p) => ({
        basePay: acc.basePay + p.basePay,
        benefits: acc.benefits + p.benefits,
        taxes: acc.taxes + p.taxes,
        workersComp: acc.workersComp + p.workersComp,
        otherBurden: acc.otherBurden + p.otherBurden,
        totalBurdens: acc.totalBurdens + p.totalBurdens,
        bonuses: acc.bonuses + p.bonuses,
        adjustments: acc.adjustments + p.adjustments,
        totalLoaded: acc.totalLoaded + p.totalLoaded,
      }),
      {
        basePay: 0,
        benefits: 0,
        taxes: 0,
        workersComp: 0,
        otherBurden: 0,
        totalBurdens: 0,
        bonuses: 0,
        adjustments: 0,
        totalLoaded: 0,
      }
    );

    // Build allocation results
    let allocResults: AllocatedResult[] | null = null;
    if (allocRows.length > 0) {
      allocResults = allocRows.map((a) => ({
        assetId: a.assetId,
        departmentId: a.departmentId,
        profitCenterId: a.profitCenterId,
        allocationPct: parseNum(a.allocationPct),
        allocatedTotal:
          Math.round(annualTotal.totalLoaded * parseNum(a.allocationPct) * 100) / 100,
      }));
    }

    const workerType =
      line.employeeId && empWorkerTypeMap[line.employeeId]
        ? empWorkerTypeMap[line.employeeId]
        : "W2";

    lineResults.push({
      lineId: line.id,
      positionTitle: line.positionId ? posMap[line.positionId] ?? null : null,
      employeeName: line.employeeId ? empMap[line.employeeId] ?? null : null,
      employeeId: line.employeeId,
      departmentId: line.departmentId,
      departmentName: deptMap[line.departmentId] ?? null,
      workerType,
      payType: line.payType,
      headcount,
      periods: periodResults,
      annualTotal,
      allocations: allocResults,
    });
  }

  // ─── Rollups ────────────────────────────────────────────────────────────

  // Department rollups
  const deptRollupMap: Record<string, DeptRollup> = {};
  for (const lr of lineResults) {
    const dId = lr.departmentId;
    if (!deptRollupMap[dId]) {
      deptRollupMap[dId] = {
        departmentId: dId,
        departmentName: lr.departmentName ?? "Unknown",
        basePay: 0,
        totalBurdens: 0,
        bonuses: 0,
        adjustments: 0,
        totalLoaded: 0,
        headcount: 0,
        lineCount: 0,
      };
    }
    const dr = deptRollupMap[dId];
    dr.basePay += lr.annualTotal.basePay;
    dr.totalBurdens += lr.annualTotal.totalBurdens;
    dr.bonuses += lr.annualTotal.bonuses;
    dr.adjustments += lr.annualTotal.adjustments;
    dr.totalLoaded += lr.annualTotal.totalLoaded;
    dr.headcount += lr.headcount;
    dr.lineCount += 1;
  }
  const departmentRollups = Object.values(deptRollupMap);

  // Worker type rollups
  const wtMap: Record<string, WorkerTypeRollup> = {};
  for (const lr of lineResults) {
    const wt = lr.workerType;
    if (!wtMap[wt]) {
      wtMap[wt] = {
        workerType: wt,
        basePay: 0,
        totalBurdens: 0,
        bonuses: 0,
        totalLoaded: 0,
        headcount: 0,
      };
    }
    wtMap[wt].basePay += lr.annualTotal.basePay;
    wtMap[wt].totalBurdens += lr.annualTotal.totalBurdens;
    wtMap[wt].bonuses += lr.annualTotal.bonuses;
    wtMap[wt].totalLoaded += lr.annualTotal.totalLoaded;
    wtMap[wt].headcount += lr.headcount;
  }
  const workerTypeRollups = Object.values(wtMap);

  // Grand totals
  const grandTotals = lineResults.reduce(
    (acc, lr) => ({
      basePay: acc.basePay + lr.annualTotal.basePay,
      benefits: acc.benefits + lr.annualTotal.benefits,
      taxes: acc.taxes + lr.annualTotal.taxes,
      workersComp: acc.workersComp + lr.annualTotal.workersComp,
      otherBurden: acc.otherBurden + lr.annualTotal.otherBurden,
      totalBurdens: acc.totalBurdens + lr.annualTotal.totalBurdens,
      bonuses: acc.bonuses + lr.annualTotal.bonuses,
      adjustments: acc.adjustments + lr.annualTotal.adjustments,
      totalLoaded: acc.totalLoaded + lr.annualTotal.totalLoaded,
      totalHeadcount: acc.totalHeadcount + lr.headcount,
    }),
    {
      basePay: 0,
      benefits: 0,
      taxes: 0,
      workersComp: 0,
      otherBurden: 0,
      totalBurdens: 0,
      bonuses: 0,
      adjustments: 0,
      totalLoaded: 0,
      totalHeadcount: 0,
    }
  );

  return {
    planId: plan.id,
    planName: plan.name,
    granularity: req.granularity,
    startDate: req.startDate,
    endDate: req.endDate,
    lineResults,
    departmentRollups,
    workerTypeRollups,
    grandTotals,
  };
}

// ─── Department Payroll Totals (for P&L bridge consumption) ─────────────────

export interface DeptPayrollTotals {
  departmentId: string;
  departmentName: string;
  totalPayroll: number;
  basePay: number;
  burdens: number;
  bonuses: number;
}

/**
 * Get payroll totals by department for a given plan + date range.
 * Used by the Department P&L bridge engine.
 */
export async function getPayrollByDepartment(
  planId: string,
  startDate: string,
  endDate: string
): Promise<DeptPayrollTotals[]> {
  const output = await calculatePayroll({
    planId,
    granularity: "monthly",
    startDate,
    endDate,
  });

  return output.departmentRollups.map((dr) => ({
    departmentId: dr.departmentId,
    departmentName: dr.departmentName,
    totalPayroll: dr.totalLoaded,
    basePay: dr.basePay,
    burdens: dr.totalBurdens,
    bonuses: dr.bonuses,
  }));
}
