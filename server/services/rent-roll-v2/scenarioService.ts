// @ts-nocheck
// NOTE: This module is not yet wired to routes. Generic rent-roll scenario tables
// (scenarios, scenarioCashFlows) must be created in schema.ts before this
// service can be activated.
import { db } from "./db";
import {
  scenarios, 
  scenarioCashFlows, 
  leaseCashFlows, 
  periods,
  leases,
  marinaLocations,
  type Scenario,
  type ScenarioCashFlow,
  type InsertScenario,
  type InsertScenarioCashFlow
} from "@shared/schema";
import { eq, and, inArray, gte, lte, sql, desc } from "drizzle-orm";

// ============================================================================
// FINANCIAL CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate Net Present Value (NPV)
 * NPV = Sum of CF_t / (1 + r)^t for t = 0 to n
 * @param cashFlows Array of cash flows (year 0 is initial investment as negative)
 * @param discountRate Annual discount rate (e.g., 0.08 for 8%)
 * @returns NPV value
 */
export function calculateNPV(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce((npv, cf, year) => {
    return npv + cf / Math.pow(1 + discountRate, year);
  }, 0);
}

/**
 * Calculate Internal Rate of Return (IRR) using Newton-Raphson method
 * Finds the discount rate that makes NPV = 0
 * @param cashFlows Array of cash flows (year 0 is initial investment as negative)
 * @param maxIterations Maximum iterations for convergence
 * @param tolerance Convergence tolerance
 * @returns IRR as a decimal (e.g., 0.15 for 15%)
 */
export function calculateIRR(
  cashFlows: number[], 
  maxIterations: number = 100, 
  tolerance: number = 0.0001
): number | null {
  // Check if IRR is calculable (need at least one sign change)
  const hasPositive = cashFlows.some(cf => cf > 0);
  const hasNegative = cashFlows.some(cf => cf < 0);
  
  if (!hasPositive || !hasNegative) {
    return null; // No IRR exists
  }

  // Initial guess for IRR
  let irr = 0.1;

  for (let i = 0; i < maxIterations; i++) {
    // Calculate NPV at current IRR guess
    let npv = 0;
    let derivative = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + irr, t);
      npv += cashFlows[t] / discountFactor;
      // Derivative of NPV with respect to IRR: d(CF/(1+r)^t)/dr = -t*CF/(1+r)^(t+1)
      derivative -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
    }

    // Check for convergence
    if (Math.abs(npv) < tolerance) {
      return irr;
    }

    // Newton-Raphson update: r_new = r - f(r)/f'(r)
    if (Math.abs(derivative) < 1e-10) {
      // Derivative too small, try bisection fallback
      break;
    }
    
    const newIrr = irr - npv / derivative;
    
    // Bound the IRR to reasonable range (-0.99 to 10)
    if (newIrr < -0.99) {
      irr = -0.99;
    } else if (newIrr > 10) {
      irr = 10;
    } else {
      irr = newIrr;
    }
  }

  // Fallback to bisection method if Newton-Raphson fails
  return calculateIRRBisection(cashFlows, tolerance);
}

/**
 * Calculate IRR using bisection method (fallback for Newton-Raphson)
 */
function calculateIRRBisection(
  cashFlows: number[], 
  tolerance: number = 0.0001
): number | null {
  let low = -0.99;
  let high = 10;
  
  for (let i = 0; i < 1000; i++) {
    const mid = (low + high) / 2;
    const npvMid = calculateNPV(cashFlows, mid);
    
    if (Math.abs(npvMid) < tolerance) {
      return mid;
    }
    
    const npvLow = calculateNPV(cashFlows, low);
    
    if (npvLow * npvMid < 0) {
      high = mid;
    } else {
      low = mid;
    }
  }
  
  return (low + high) / 2;
}

/**
 * Calculate payback period (simple)
 * @param initialInvestment Positive number representing initial investment
 * @param cashFlows Annual cash flows (positive = inflow)
 * @returns Years to payback (can be fractional), null if never payback
 */
export function calculatePaybackPeriod(
  initialInvestment: number, 
  cashFlows: number[]
): number | null {
  let cumulativeCashFlow = -initialInvestment;
  
  for (let year = 0; year < cashFlows.length; year++) {
    cumulativeCashFlow += cashFlows[year];
    
    if (cumulativeCashFlow >= 0) {
      // Interpolate the exact payback year
      const previousCumulative = cumulativeCashFlow - cashFlows[year];
      const fraction = Math.abs(previousCumulative) / cashFlows[year];
      return year + fraction;
    }
  }
  
  return null; // Never payback within the holding period
}

/**
 * Calculate terminal value using cap rate method
 * Terminal Value = Final Year NOI / Exit Cap Rate
 */
export function calculateTerminalValue(finalYearNoi: number, exitCapRate: number): number {
  if (exitCapRate <= 0) return 0;
  return finalYearNoi / exitCapRate;
}

// ============================================================================
// SCENARIO CRUD OPERATIONS
// ============================================================================

/**
 * Get all scenarios for an organization
 */
export async function getScenarios(
  organizationId: string,
  projectId?: string
): Promise<Scenario[]> {
  const conditions = [eq(scenarios.organizationId, organizationId)];
  
  if (projectId) {
    conditions.push(eq(scenarios.projectId, projectId));
  }

  return db.query.scenarios.findMany({
    where: and(...conditions),
    orderBy: [desc(scenarios.createdAt)],
  });
}

/**
 * Get a single scenario by ID
 */
export async function getScenarioById(id: string): Promise<Scenario | undefined> {
  return db.query.scenarios.findFirst({
    where: eq(scenarios.id, id),
  });
}

/**
 * Create a new scenario
 */
export async function createScenario(data: InsertScenario): Promise<Scenario> {
  const [scenario] = await db.insert(scenarios).values(data).returning();
  return scenario;
}

/**
 * Update an existing scenario
 */
export async function updateScenario(
  id: string, 
  data: Partial<InsertScenario>
): Promise<Scenario | undefined> {
  const [updated] = await db
    .update(scenarios)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(scenarios.id, id))
    .returning();
  return updated;
}

/**
 * Delete a scenario
 */
export async function deleteScenario(id: string): Promise<boolean> {
  const result = await db.delete(scenarios).where(eq(scenarios.id, id));
  return true;
}

// ============================================================================
// SCENARIO CASH FLOW OPERATIONS
// ============================================================================

/**
 * Get cash flow projections for a scenario
 */
export async function getScenarioCashFlows(
  scenarioId: string
): Promise<ScenarioCashFlow[]> {
  return db.query.scenarioCashFlows.findMany({
    where: eq(scenarioCashFlows.scenarioId, scenarioId),
    orderBy: [scenarioCashFlows.year],
  });
}

/**
 * Save cash flow projections for a scenario (replaces existing)
 */
export async function saveScenarioCashFlows(
  scenarioId: string,
  cashFlows: InsertScenarioCashFlow[]
): Promise<ScenarioCashFlow[]> {
  // Delete existing cash flows
  await db.delete(scenarioCashFlows).where(eq(scenarioCashFlows.scenarioId, scenarioId));
  
  if (cashFlows.length === 0) {
    return [];
  }
  
  // Insert new cash flows
  const inserted = await db
    .insert(scenarioCashFlows)
    .values(cashFlows.map(cf => ({ ...cf, scenarioId })))
    .returning();
  
  return inserted;
}

// ============================================================================
// SCENARIO CALCULATION OPERATIONS
// ============================================================================

interface ProjectCashFlowSummary {
  year: number;
  calendarYear: number;
  totalRevenue: number;
}

/**
 * Get historical and current cash flows from lease data for a project
 */
export async function getProjectCashFlowData(
  projectId: string
): Promise<ProjectCashFlowSummary[]> {
  // Get all lease cash flows for the project
  const projectLeases = await db.query.leases.findMany({
    where: and(
      eq(leases.locationId, projectId),
      eq(leases.isActive, true)
    ),
  });
  
  if (projectLeases.length === 0) {
    return [];
  }
  
  const leaseIds = projectLeases.map(l => l.id);
  
  // Get all periods with cash flows
  const cashFlowData = await db
    .select({
      year: periods.year,
      month: periods.month,
      rentAmount: leaseCashFlows.rentAmount,
    })
    .from(leaseCashFlows)
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .where(inArray(leaseCashFlows.leaseId, leaseIds));
  
  // Aggregate by year
  const yearlyData: Map<number, number> = new Map();
  
  for (const row of cashFlowData) {
    const year = row.year;
    const amount = parseFloat(row.rentAmount || "0");
    yearlyData.set(year, (yearlyData.get(year) || 0) + amount);
  }
  
  // Convert to array
  const result: ProjectCashFlowSummary[] = [];
  const sortedYears = Array.from(yearlyData.keys()).sort((a, b) => a - b);
  
  for (let i = 0; i < sortedYears.length; i++) {
    result.push({
      year: i + 1,
      calendarYear: sortedYears[i],
      totalRevenue: yearlyData.get(sortedYears[i]) || 0,
    });
  }
  
  return result;
}

export interface ScenarioCalculationResult {
  npv: number;
  irr: number | null;
  paybackYears: number | null;
  cashFlowProjections: {
    year: number;
    calendarYear: number;
    revenue: number;
    expenses: number;
    noi: number;
    cashFlow: number;
    terminalValue: number;
    cumulativeCashFlow: number;
  }[];
}

/**
 * Calculate scenario metrics using project data and assumptions
 */
export async function calculateScenarioMetrics(
  scenarioId: string
): Promise<ScenarioCalculationResult> {
  const scenario = await getScenarioById(scenarioId);
  
  if (!scenario) {
    throw new Error("Scenario not found");
  }
  
  const discountRate = parseFloat(scenario.discountRate || "0.08");
  const revenueGrowth = parseFloat(scenario.revenueGrowthRate || "0.03");
  const expenseGrowth = parseFloat(scenario.expenseGrowthRate || "0.02");
  const holdingPeriod = scenario.holdingPeriodYears || 5;
  const exitCapRate = parseFloat(scenario.exitCapRate || "0.07");
  const initialInvestment = parseFloat(scenario.initialInvestment || "0");
  
  // Get base cash flow data from project
  let baseRevenue = 0;
  const baseExpenseRatio = 0.4; // Default expense ratio of 40%
  const currentYear = new Date().getFullYear();
  
  if (scenario.projectId) {
    const projectCashFlows = await getProjectCashFlowData(scenario.projectId);
    // Use the most recent year's revenue as base
    if (projectCashFlows.length > 0) {
      const mostRecent = projectCashFlows[projectCashFlows.length - 1];
      baseRevenue = mostRecent.totalRevenue;
    }
  }
  
  // Check for custom cash flows
  const customCashFlows = scenario.customCashFlows as { year: number; cashFlow: number }[] | null;
  
  // Generate projections
  const projections: ScenarioCalculationResult["cashFlowProjections"] = [];
  const cashFlowsForIRR: number[] = [-initialInvestment]; // Year 0 is initial investment
  let cumulativeCashFlow = -initialInvestment;
  
  for (let year = 1; year <= holdingPeriod; year++) {
    let revenue: number;
    let expenses: number;
    let noi: number;
    let cashFlow: number;
    let terminalValue = 0;
    
    if (customCashFlows && customCashFlows.length > 0) {
      // Use custom cash flows if provided
      const customCf = customCashFlows.find(cf => cf.year === year);
      cashFlow = customCf?.cashFlow || 0;
      revenue = cashFlow / (1 - baseExpenseRatio); // Derive revenue
      expenses = revenue * baseExpenseRatio;
      noi = revenue - expenses;
    } else {
      // Project based on growth rates
      revenue = baseRevenue * Math.pow(1 + revenueGrowth, year);
      expenses = revenue * baseExpenseRatio * Math.pow(1 + expenseGrowth, year) / Math.pow(1 + revenueGrowth, year);
      noi = revenue - expenses;
      cashFlow = noi; // Simplified - can add cap ex, debt service later
    }
    
    // Add terminal value in the final year
    if (year === holdingPeriod && exitCapRate > 0) {
      terminalValue = calculateTerminalValue(noi, exitCapRate);
      cashFlow += terminalValue;
    }
    
    cumulativeCashFlow += cashFlow;
    
    projections.push({
      year,
      calendarYear: currentYear + year,
      revenue,
      expenses,
      noi,
      cashFlow: cashFlow - terminalValue, // Exclude terminal for display
      terminalValue,
      cumulativeCashFlow,
    });
    
    cashFlowsForIRR.push(cashFlow);
  }
  
  // Calculate metrics
  const npv = calculateNPV(cashFlowsForIRR, discountRate);
  const irr = calculateIRR(cashFlowsForIRR);
  const operatingCashFlows = projections.map(p => p.noi);
  const paybackYears = calculatePaybackPeriod(initialInvestment, operatingCashFlows);
  
  // Update scenario with calculated values
  await db
    .update(scenarios)
    .set({
      calculatedNpv: npv.toFixed(2),
      calculatedIrr: irr?.toFixed(4) || null,
      calculatedPaybackYears: paybackYears?.toFixed(2) || null,
      lastCalculatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(scenarios.id, scenarioId));
  
  // Save projections to database
  await saveScenarioCashFlows(
    scenarioId,
    projections.map(p => ({
      scenarioId,
      year: p.year,
      calendarYear: p.calendarYear,
      revenue: p.revenue.toFixed(2),
      expenses: p.expenses.toFixed(2),
      noi: p.noi.toFixed(2),
      cashFlow: p.cashFlow.toFixed(2),
      terminalValue: p.terminalValue.toFixed(2),
      isProjection: true,
    }))
  );
  
  return {
    npv,
    irr,
    paybackYears,
    cashFlowProjections: projections,
  };
}

/**
 * Run quick calculation without saving (for preview/sensitivity analysis)
 */
export function calculateQuickMetrics(
  initialInvestment: number,
  discountRate: number,
  cashFlows: number[],
  exitCapRate?: number,
  finalYearNoi?: number
): { npv: number; irr: number | null; paybackYears: number | null } {
  // Add terminal value to final cash flow if provided
  const adjustedCashFlows = [...cashFlows];
  if (exitCapRate && exitCapRate > 0 && finalYearNoi && adjustedCashFlows.length > 0) {
    const terminalValue = calculateTerminalValue(finalYearNoi, exitCapRate);
    adjustedCashFlows[adjustedCashFlows.length - 1] += terminalValue;
  }
  
  const allCashFlows = [-initialInvestment, ...adjustedCashFlows];
  
  return {
    npv: calculateNPV(allCashFlows, discountRate),
    irr: calculateIRR(allCashFlows),
    paybackYears: calculatePaybackPeriod(initialInvestment, cashFlows),
  };
}
