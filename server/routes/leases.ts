/**
 * Commercial Tenants API Routes for Valuator
 * 
 * Matches the existing Valuator API patterns:
 * - Routes under /api/valuator/:projectId/leases
 * - Returns { data: ... } wrapper
 * - Uses same auth/project access patterns
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@/db";
import { 
  tenantLeases, 
  tenantRentTerms, 
  tenantRecoveries, 
  tenantPercentageRent,
  tenantSales,
  tenantConcessions,
  tenantCapexLeasing,
  tenantRolloverAssumptions
} from "@/db/schema";
import { eq, and, sql, gte, lte, inArray, or, like, desc } from "drizzle-orm";
import { calculateLeaseHealth, calculateLeaseSchedule, calculateLeaseKpis } from "@/lib/leases/leaseCashflowEngine";
import { differenceInMonths, addMonths, format } from "date-fns";

const router = Router({ mergeParams: true });

// ============================================
// MIDDLEWARE
// ============================================

// Verify project access (placeholder - integrate with your auth)
async function verifyProjectAccess(req: Request, res: Response, next: NextFunction) {
  const { projectId } = req.params;
  // TODO: Add actual project ownership verification
  if (!projectId) {
    return res.status(400).json({ error: "Project ID required" });
  }
  next();
}

router.use(verifyProjectAccess);

// ============================================
// VALIDATION SCHEMAS
// ============================================

const leaseTypeEnum = z.enum(["NNN", "MOD_GROSS", "FULL_GROSS", "ABSOLUTE_NNN", "OTHER"]);
const leaseStatusEnum = z.enum(["ACTIVE", "FUTURE", "EXPIRING", "EXPIRED", "ARCHIVED"]);
const rentInputUnitEnum = z.enum(["PSF_YEAR", "PER_MONTH", "PER_YEAR"]);
const escalationTypeEnum = z.enum(["NONE", "PERCENT", "FIXED_DOLLAR", "DOLLAR_PSF_YEAR", "CPI", "CPI_CAP_FLOOR", "SCHEDULE"]);
const securityDepositTypeEnum = z.enum(["CASH", "LOC", "NONE"]);
const recoveryTypeEnum = z.enum(["CAM", "TAXES", "INSURANCE", "UTILITIES", "TRASH", "SECURITY", "OTHER"]);
const recoveryMethodEnum = z.enum(["PRO_RATA", "BASE_YEAR_STOP", "EXPENSE_STOP_PSF", "FIXED_MONTHLY", "FIXED_ANNUAL"]);
const breakpointTypeEnum = z.enum(["NATURAL", "ARTIFICIAL"]);
const settlementFrequencyEnum = z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]);
const concessionTypeEnum = z.enum(["FREE_RENT", "DISCOUNT_PERCENT", "DISCOUNT_FIXED", "OTHER"]);
const tiPaymentTimingEnum = z.enum(["UPFRONT", "REIMBURSEMENT", "DRAW_SCHEDULE"]);
const lcPaymentTimingEnum = z.enum(["AT_SIGNING", "SPREAD"]);

const createLeaseSchema = z.object({
  lease: z.object({
    tenantName: z.string().min(1),
    suiteLabel: z.string().nullable().optional(),
    sf: z.number().positive(),
    unitCount: z.number().int().positive().nullable().optional(),
    leaseType: leaseTypeEnum,
    leaseStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rentCommencementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    leaseEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    securityDepositAmount: z.number().nullable().optional(),
    securityDepositType: securityDepositTypeEnum.optional(),
    notes: z.string().nullable().optional(),
  }),
  initialTerm: z.object({
    termStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    termEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseRentInputUnit: rentInputUnitEnum,
    baseRentInputValue: z.number().nonnegative(),
    escalationType: escalationTypeEnum,
    escalationValue: z.number().nullable().optional(),
    escalationFrequencyMonths: z.number().int().positive().nullable().optional(),
    escalationCapPercent: z.number().nullable().optional(),
    escalationFloorPercent: z.number().nullable().optional(),
    scheduleJson: z.array(z.object({
      effectiveDate: z.string(),
      value: z.number(),
      unit: rentInputUnitEnum,
      notes: z.string().optional(),
    })).nullable().optional(),
  }),
  optionTerms: z.array(z.object({
    optionIndex: z.number().int().positive(),
    termStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    termEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseRentInputUnit: rentInputUnitEnum,
    baseRentInputValue: z.number().nonnegative(),
    escalationType: escalationTypeEnum,
    escalationValue: z.number().nullable().optional(),
    escalationFrequencyMonths: z.number().int().positive().nullable().optional(),
  })).optional(),
  recoveries: z.array(z.object({
    recoveryType: recoveryTypeEnum,
    method: recoveryMethodEnum,
    amount: z.number().nullable().optional(),
    psfAmount: z.number().nullable().optional(),
    adminFeePercent: z.number().nullable().optional(),
    nonrecoverablePercent: z.number().nullable().optional(),
    expenseGrowthRatePercent: z.number().nullable().optional(),
  })).optional(),
  percentageRent: z.object({
    enabled: z.boolean(),
    breakpointType: breakpointTypeEnum.optional(),
    breakpointAmountAnnual: z.number().nullable().optional(),
    overagePercent: z.number().nullable().optional(),
    settlementFrequency: settlementFrequencyEnum.optional(),
  }).optional(),
  concessions: z.array(z.object({
    concessionType: concessionTypeEnum,
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    value: z.number(),
    notes: z.string().nullable().optional(),
  })).optional(),
  capexLeasing: z.object({
    tiAllowancePsf: z.number().nullable().optional(),
    tiTotal: z.number().nullable().optional(),
    tiPaymentTiming: tiPaymentTimingEnum.optional(),
    lcPercentInitial: z.number().nullable().optional(),
    lcPercentRenewal: z.number().nullable().optional(),
    lcPaymentTiming: lcPaymentTimingEnum.optional(),
  }).optional(),
  rolloverAssumptions: z.object({
    assumeRenewal: z.boolean(),
    renewalProbability: z.number().nullable().optional(),
    downtimeMonths: z.number().int().nonnegative().optional(),
    marketRentPsfYear: z.number().nullable().optional(),
    marketRentGrowthPercent: z.number().nullable().optional(),
    renewalTiPsf: z.number().nullable().optional(),
    renewalLcPercent: z.number().nullable().optional(),
  }).optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function computeLeaseStatus(startDate: string, endDate: string): "ACTIVE" | "FUTURE" | "EXPIRING" | "EXPIRED" {
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end < today) return "EXPIRED";
  if (start > today) return "FUTURE";
  
  const monthsToExpiration = differenceInMonths(end, today);
  if (monthsToExpiration <= 12) return "EXPIRING";
  
  return "ACTIVE";
}

function computeEscalationDisplay(
  escalationType: string,
  escalationValue: number | null,
  escalationFrequencyMonths: number | null
): string {
  if (escalationType === "NONE" || !escalationValue) return "—";
  
  const freq = escalationFrequencyMonths === 12 ? "annual" : 
               escalationFrequencyMonths === 60 ? "every 5 years" :
               `every ${escalationFrequencyMonths} mo`;
  
  switch (escalationType) {
    case "PERCENT":
    case "CPI":
    case "CPI_CAP_FLOOR":
      return `${escalationValue}% ${freq}`;
    case "FIXED_DOLLAR":
      return `$${escalationValue.toLocaleString()} ${freq}`;
    case "DOLLAR_PSF_YEAR":
      return `$${escalationValue}/SF ${freq}`;
    case "SCHEDULE":
      return "Step schedule";
    default:
      return "—";
  }
}

function computeMonthlyRent(unit: string, value: number, sf: number): number {
  switch (unit) {
    case "PSF_YEAR": return (value * sf) / 12;
    case "PER_MONTH": return value;
    case "PER_YEAR": return value / 12;
    default: return 0;
  }
}

// ============================================
// ROUTES
// ============================================

// GET /api/valuator/:projectId/leases - List all leases
router.get("/", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { status, leaseType, search, percentRentEnabled, recoveriesEnabled } = req.query;
    
    // Build query conditions
    const conditions = [eq(tenantLeases.projectId, projectId)];
    
    // Exclude archived unless specifically requested
    if (status !== "ARCHIVED") {
      conditions.push(sql`${tenantLeases.status} != 'ARCHIVED'`);
    }
    
    // Apply filters
    if (status && status !== "all") {
      if (Array.isArray(status)) {
        conditions.push(inArray(tenantLeases.status, status as string[]));
      } else {
        conditions.push(eq(tenantLeases.status, status as string));
      }
    }
    
    if (leaseType) {
      if (Array.isArray(leaseType)) {
        conditions.push(inArray(tenantLeases.leaseType, leaseType as string[]));
      } else {
        conditions.push(eq(tenantLeases.leaseType, leaseType as string));
      }
    }
    
    if (search) {
      conditions.push(
        or(
          like(tenantLeases.tenantName, `%${search}%`),
          like(tenantLeases.suiteLabel, `%${search}%`)
        )
      );
    }
    
    // Fetch leases
    const leaseRows = await db.select()
      .from(tenantLeases)
      .where(and(...conditions))
      .orderBy(desc(tenantLeases.createdAt));
    
    // Enrich with computed fields
    const enrichedLeases = await Promise.all(leaseRows.map(async (lease) => {
      // Get initial term for rent info
      const [initialTerm] = await db.select()
        .from(tenantRentTerms)
        .where(and(
          eq(tenantRentTerms.leaseId, lease.id),
          eq(tenantRentTerms.termType, "INITIAL")
        ))
        .limit(1);
      
      // Count options
      const [optionsResult] = await db.select({ count: sql<number>`count(*)` })
        .from(tenantRentTerms)
        .where(and(
          eq(tenantRentTerms.leaseId, lease.id),
          eq(tenantRentTerms.termType, "OPTION")
        ));
      
      // Check % rent
      const [percentRent] = await db.select()
        .from(tenantPercentageRent)
        .where(eq(tenantPercentageRent.leaseId, lease.id))
        .limit(1);
      
      // Check recoveries
      const [recoveriesResult] = await db.select({ count: sql<number>`count(*)` })
        .from(tenantRecoveries)
        .where(eq(tenantRecoveries.leaseId, lease.id));
      
      // Get rollover for health calc
      const [rollover] = await db.select()
        .from(tenantRolloverAssumptions)
        .where(eq(tenantRolloverAssumptions.leaseId, lease.id))
        .limit(1);
      
      // Compute status (may override stored status)
      const computedStatus = lease.status === "ARCHIVED" 
        ? "ARCHIVED" 
        : computeLeaseStatus(lease.leaseStartDate, lease.leaseEndDate);
      
      // Compute health
      const health = calculateLeaseHealth({
        leaseEndDate: lease.leaseEndDate,
        leaseType: lease.leaseType,
        assumeRenewal: rollover?.assumeRenewal || false,
        renewalProbability: rollover?.renewalProbability ? Number(rollover.renewalProbability) : undefined,
      });
      
      const sf = Number(lease.sf);
      const baseRentMonthly = initialTerm 
        ? computeMonthlyRent(
            initialTerm.baseRentInputUnit, 
            Number(initialTerm.baseRentInputValue), 
            sf
          )
        : 0;
      
      return {
        id: lease.id,
        tenantName: lease.tenantName,
        suiteLabel: lease.suiteLabel,
        sf,
        leaseType: lease.leaseType,
        leaseStartDate: lease.leaseStartDate,
        leaseEndDate: lease.leaseEndDate,
        status: computedStatus,
        baseRentMonthly,
        escalationDisplay: initialTerm 
          ? computeEscalationDisplay(
              initialTerm.escalationType,
              initialTerm.escalationValue ? Number(initialTerm.escalationValue) : null,
              initialTerm.escalationFrequencyMonths
            )
          : "—",
        optionsCount: Number(optionsResult?.count || 0),
        percentRentEnabled: percentRent?.enabled || false,
        recoveriesEnabled: Number(recoveriesResult?.count || 0) > 0,
        health,
      };
    }));
    
    // Apply client-side filters for % rent and recoveries
    let filteredLeases = enrichedLeases;
    if (percentRentEnabled === "true") {
      filteredLeases = filteredLeases.filter(l => l.percentRentEnabled);
    }
    if (recoveriesEnabled === "true") {
      filteredLeases = filteredLeases.filter(l => l.recoveriesEnabled);
    }
    
    res.json({ data: filteredLeases });
  } catch (error) {
    console.error("Error fetching leases:", error);
    res.status(500).json({ error: "Failed to fetch leases" });
  }
});

// GET /api/valuator/:projectId/leases/kpis - Get portfolio KPIs
router.get("/kpis", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    // Fetch all active leases
    const leases = await db.select()
      .from(tenantLeases)
      .where(and(
        eq(tenantLeases.projectId, projectId),
        sql`${tenantLeases.status} != 'ARCHIVED'`
      ));
    
    const today = new Date();
    let totalBaseRentMonthly = 0;
    let totalRecoveriesMonthly = 0;
    let totalPercentRentMtd = 0;
    let totalPercentRentYtd = 0;
    let totalSf = 0;
    let activeLeaseCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let weightedRentSum = 0;
    
    for (const lease of leases) {
      const sf = Number(lease.sf);
      const status = computeLeaseStatus(lease.leaseStartDate, lease.leaseEndDate);
      
      if (status === "EXPIRED") {
        expiredCount++;
        continue;
      }
      
      if (status === "EXPIRING") expiringCount++;
      if (status === "ACTIVE" || status === "EXPIRING") activeLeaseCount++;
      
      // Get rent term
      const [term] = await db.select()
        .from(tenantRentTerms)
        .where(and(
          eq(tenantRentTerms.leaseId, lease.id),
          eq(tenantRentTerms.termType, "INITIAL")
        ))
        .limit(1);
      
      if (term) {
        const monthlyRent = computeMonthlyRent(
          term.baseRentInputUnit,
          Number(term.baseRentInputValue),
          sf
        );
        totalBaseRentMonthly += monthlyRent;
        totalSf += sf;
        weightedRentSum += monthlyRent * 12; // Annualized for weighted calc
      }
      
      // Sum recoveries (simplified - would need full calc in production)
      const recoveries = await db.select()
        .from(tenantRecoveries)
        .where(eq(tenantRecoveries.leaseId, lease.id));
      
      for (const recovery of recoveries) {
        if (recovery.method === "FIXED_MONTHLY" && recovery.amount) {
          totalRecoveriesMonthly += Number(recovery.amount);
        } else if (recovery.method === "FIXED_ANNUAL" && recovery.amount) {
          totalRecoveriesMonthly += Number(recovery.amount) / 12;
        }
      }
    }
    
    const weightedAvgRentPsf = totalSf > 0 ? weightedRentSum / totalSf : 0;
    
    res.json({
      data: {
        totalBaseRentMonthly,
        totalRecoveriesMonthly,
        totalPercentRentMtd,
        totalPercentRentYtd,
        weightedAvgRentPsf,
        totalSf,
        activeLeaseCount,
        expiringCount,
        expiredCount,
      }
    });
  } catch (error) {
    console.error("Error fetching KPIs:", error);
    res.status(500).json({ error: "Failed to fetch KPIs" });
  }
});

// POST /api/valuator/:projectId/leases - Create new lease
router.post("/", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const payload = createLeaseSchema.parse(req.body);
    
    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Compute initial status
      const status = computeLeaseStatus(
        payload.lease.leaseStartDate, 
        payload.lease.leaseEndDate
      );
      
      // Create lease
      const [newLease] = await tx.insert(tenantLeases).values({
        projectId,
        tenantName: payload.lease.tenantName,
        suiteLabel: payload.lease.suiteLabel,
        sf: String(payload.lease.sf),
        unitCount: payload.lease.unitCount,
        leaseType: payload.lease.leaseType,
        leaseStartDate: payload.lease.leaseStartDate,
        rentCommencementDate: payload.lease.rentCommencementDate,
        leaseEndDate: payload.lease.leaseEndDate,
        securityDepositAmount: payload.lease.securityDepositAmount ? String(payload.lease.securityDepositAmount) : null,
        securityDepositType: payload.lease.securityDepositType || "NONE",
        notes: payload.lease.notes,
        status,
      }).returning();
      
      const leaseId = newLease.id;
      
      // Create initial term
      await tx.insert(tenantRentTerms).values({
        leaseId,
        termType: "INITIAL",
        optionIndex: null,
        termStartDate: payload.initialTerm.termStartDate,
        termEndDate: payload.initialTerm.termEndDate,
        baseRentInputUnit: payload.initialTerm.baseRentInputUnit,
        baseRentInputValue: String(payload.initialTerm.baseRentInputValue),
        escalationType: payload.initialTerm.escalationType,
        escalationValue: payload.initialTerm.escalationValue ? String(payload.initialTerm.escalationValue) : null,
        escalationFrequencyMonths: payload.initialTerm.escalationFrequencyMonths,
        escalationCapPercent: payload.initialTerm.escalationCapPercent ? String(payload.initialTerm.escalationCapPercent) : null,
        escalationFloorPercent: payload.initialTerm.escalationFloorPercent ? String(payload.initialTerm.escalationFloorPercent) : null,
        scheduleJson: payload.initialTerm.scheduleJson,
      });
      
      // Create option terms
      if (payload.optionTerms?.length) {
        for (const opt of payload.optionTerms) {
          await tx.insert(tenantRentTerms).values({
            leaseId,
            termType: "OPTION",
            optionIndex: opt.optionIndex,
            termStartDate: opt.termStartDate,
            termEndDate: opt.termEndDate,
            baseRentInputUnit: opt.baseRentInputUnit,
            baseRentInputValue: String(opt.baseRentInputValue),
            escalationType: opt.escalationType,
            escalationValue: opt.escalationValue ? String(opt.escalationValue) : null,
            escalationFrequencyMonths: opt.escalationFrequencyMonths,
          });
        }
      }
      
      // Create recoveries
      if (payload.recoveries?.length) {
        for (const rec of payload.recoveries) {
          await tx.insert(tenantRecoveries).values({
            leaseId,
            recoveryType: rec.recoveryType,
            method: rec.method,
            amount: rec.amount ? String(rec.amount) : null,
            psfAmount: rec.psfAmount ? String(rec.psfAmount) : null,
            adminFeePercent: rec.adminFeePercent ? String(rec.adminFeePercent) : null,
            nonrecoverablePercent: rec.nonrecoverablePercent ? String(rec.nonrecoverablePercent) : null,
            expenseGrowthRatePercent: rec.expenseGrowthRatePercent ? String(rec.expenseGrowthRatePercent) : null,
          });
        }
      }
      
      // Create percentage rent config
      if (payload.percentageRent?.enabled) {
        await tx.insert(tenantPercentageRent).values({
          leaseId,
          enabled: true,
          breakpointType: payload.percentageRent.breakpointType || "NATURAL",
          breakpointAmountAnnual: payload.percentageRent.breakpointAmountAnnual 
            ? String(payload.percentageRent.breakpointAmountAnnual) 
            : null,
          overagePercent: payload.percentageRent.overagePercent 
            ? String(payload.percentageRent.overagePercent) 
            : null,
          settlementFrequency: payload.percentageRent.settlementFrequency || "MONTHLY",
        });
      }
      
      // Create concessions
      if (payload.concessions?.length) {
        for (const con of payload.concessions) {
          await tx.insert(tenantConcessions).values({
            leaseId,
            concessionType: con.concessionType,
            startDate: con.startDate,
            endDate: con.endDate,
            value: String(con.value),
            notes: con.notes,
          });
        }
      }
      
      // Create capex/leasing config
      if (payload.capexLeasing) {
        await tx.insert(tenantCapexLeasing).values({
          leaseId,
          tiAllowancePsf: payload.capexLeasing.tiAllowancePsf 
            ? String(payload.capexLeasing.tiAllowancePsf) 
            : null,
          tiTotal: payload.capexLeasing.tiTotal 
            ? String(payload.capexLeasing.tiTotal) 
            : null,
          tiPaymentTiming: payload.capexLeasing.tiPaymentTiming || "UPFRONT",
          lcPercentInitial: payload.capexLeasing.lcPercentInitial 
            ? String(payload.capexLeasing.lcPercentInitial) 
            : null,
          lcPercentRenewal: payload.capexLeasing.lcPercentRenewal 
            ? String(payload.capexLeasing.lcPercentRenewal) 
            : null,
          lcPaymentTiming: payload.capexLeasing.lcPaymentTiming || "AT_SIGNING",
        });
      }
      
      // Create rollover assumptions
      if (payload.rolloverAssumptions) {
        await tx.insert(tenantRolloverAssumptions).values({
          leaseId,
          assumeRenewal: payload.rolloverAssumptions.assumeRenewal,
          renewalProbability: payload.rolloverAssumptions.renewalProbability 
            ? String(payload.rolloverAssumptions.renewalProbability) 
            : null,
          downtimeMonths: payload.rolloverAssumptions.downtimeMonths || 0,
          marketRentPsfYear: payload.rolloverAssumptions.marketRentPsfYear 
            ? String(payload.rolloverAssumptions.marketRentPsfYear) 
            : null,
          marketRentGrowthPercent: payload.rolloverAssumptions.marketRentGrowthPercent 
            ? String(payload.rolloverAssumptions.marketRentGrowthPercent) 
            : null,
          renewalTiPsf: payload.rolloverAssumptions.renewalTiPsf 
            ? String(payload.rolloverAssumptions.renewalTiPsf) 
            : null,
          renewalLcPercent: payload.rolloverAssumptions.renewalLcPercent 
            ? String(payload.rolloverAssumptions.renewalLcPercent) 
            : null,
        });
      }
      
      return newLease;
    });
    
    res.status(201).json({ data: result });
  } catch (error) {
    console.error("Error creating lease:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create lease" });
  }
});

// GET /api/valuator/:projectId/leases/:leaseId - Get lease details
router.get("/:leaseId", async (req: Request, res: Response) => {
  try {
    const { projectId, leaseId } = req.params;
    
    const [lease] = await db.select()
      .from(tenantLeases)
      .where(and(
        eq(tenantLeases.id, leaseId),
        eq(tenantLeases.projectId, projectId)
      ))
      .limit(1);
    
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    
    const rentTerms = await db.select()
      .from(tenantRentTerms)
      .where(eq(tenantRentTerms.leaseId, leaseId));
    
    const recoveries = await db.select()
      .from(tenantRecoveries)
      .where(eq(tenantRecoveries.leaseId, leaseId));
    
    const [percentageRent] = await db.select()
      .from(tenantPercentageRent)
      .where(eq(tenantPercentageRent.leaseId, leaseId))
      .limit(1);
    
    const sales = await db.select()
      .from(tenantSales)
      .where(eq(tenantSales.leaseId, leaseId));
    
    const concessions = await db.select()
      .from(tenantConcessions)
      .where(eq(tenantConcessions.leaseId, leaseId));
    
    const [capexLeasing] = await db.select()
      .from(tenantCapexLeasing)
      .where(eq(tenantCapexLeasing.leaseId, leaseId))
      .limit(1);
    
    const [rolloverAssumptions] = await db.select()
      .from(tenantRolloverAssumptions)
      .where(eq(tenantRolloverAssumptions.leaseId, leaseId))
      .limit(1);
    
    res.json({
      data: {
        lease,
        rentTerms,
        recoveries,
        percentageRent: percentageRent || null,
        sales,
        concessions,
        capexLeasing: capexLeasing || null,
        rolloverAssumptions: rolloverAssumptions || null,
      }
    });
  } catch (error) {
    console.error("Error fetching lease:", error);
    res.status(500).json({ error: "Failed to fetch lease" });
  }
});

// POST /api/valuator/:projectId/leases/:leaseId/duplicate - Duplicate lease
router.post("/:leaseId/duplicate", async (req: Request, res: Response) => {
  try {
    const { projectId, leaseId } = req.params;
    
    // Fetch original lease and all related data
    const [originalLease] = await db.select()
      .from(tenantLeases)
      .where(and(
        eq(tenantLeases.id, leaseId),
        eq(tenantLeases.projectId, projectId)
      ))
      .limit(1);
    
    if (!originalLease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    
    const result = await db.transaction(async (tx) => {
      // Create new lease with modified name
      const [newLease] = await tx.insert(tenantLeases).values({
        ...originalLease,
        id: undefined, // Let DB generate new ID
        tenantName: `${originalLease.tenantName} (Copy)`,
        createdAt: undefined,
        updatedAt: undefined,
      }).returning();
      
      // Copy rent terms
      const originalTerms = await db.select()
        .from(tenantRentTerms)
        .where(eq(tenantRentTerms.leaseId, leaseId));
      
      for (const term of originalTerms) {
        await tx.insert(tenantRentTerms).values({
          ...term,
          id: undefined,
          leaseId: newLease.id,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }
      
      // Copy recoveries
      const originalRecoveries = await db.select()
        .from(tenantRecoveries)
        .where(eq(tenantRecoveries.leaseId, leaseId));
      
      for (const rec of originalRecoveries) {
        await tx.insert(tenantRecoveries).values({
          ...rec,
          id: undefined,
          leaseId: newLease.id,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }
      
      // Copy percentage rent config
      const [originalPercentRent] = await db.select()
        .from(tenantPercentageRent)
        .where(eq(tenantPercentageRent.leaseId, leaseId))
        .limit(1);
      
      if (originalPercentRent) {
        await tx.insert(tenantPercentageRent).values({
          ...originalPercentRent,
          id: undefined,
          leaseId: newLease.id,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }
      
      // Copy concessions
      const originalConcessions = await db.select()
        .from(tenantConcessions)
        .where(eq(tenantConcessions.leaseId, leaseId));
      
      for (const con of originalConcessions) {
        await tx.insert(tenantConcessions).values({
          ...con,
          id: undefined,
          leaseId: newLease.id,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }
      
      return newLease;
    });
    
    res.status(201).json({ data: result });
  } catch (error) {
    console.error("Error duplicating lease:", error);
    res.status(500).json({ error: "Failed to duplicate lease" });
  }
});

// DELETE /api/valuator/:projectId/leases/:leaseId - Archive (soft delete) lease
router.delete("/:leaseId", async (req: Request, res: Response) => {
  try {
    const { projectId, leaseId } = req.params;
    
    const [updated] = await db.update(tenantLeases)
      .set({ status: "ARCHIVED", updatedAt: new Date() })
      .where(and(
        eq(tenantLeases.id, leaseId),
        eq(tenantLeases.projectId, projectId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Lease not found" });
    }
    
    res.json({ data: { success: true } });
  } catch (error) {
    console.error("Error archiving lease:", error);
    res.status(500).json({ error: "Failed to archive lease" });
  }
});

// GET /api/valuator/:projectId/leases/:leaseId/schedule - Get lease cash flow schedule
router.get("/:leaseId/schedule", async (req: Request, res: Response) => {
  try {
    const { projectId, leaseId } = req.params;
    const { horizonMonths = "120", cpiPercent = "2.5" } = req.query;
    
    // Fetch all lease data
    const [lease] = await db.select()
      .from(tenantLeases)
      .where(and(
        eq(tenantLeases.id, leaseId),
        eq(tenantLeases.projectId, projectId)
      ))
      .limit(1);
    
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    
    const rentTerms = await db.select()
      .from(tenantRentTerms)
      .where(eq(tenantRentTerms.leaseId, leaseId));
    
    const recoveries = await db.select()
      .from(tenantRecoveries)
      .where(eq(tenantRecoveries.leaseId, leaseId));
    
    const [percentageRent] = await db.select()
      .from(tenantPercentageRent)
      .where(eq(tenantPercentageRent.leaseId, leaseId))
      .limit(1);
    
    const sales = await db.select()
      .from(tenantSales)
      .where(eq(tenantSales.leaseId, leaseId));
    
    const concessions = await db.select()
      .from(tenantConcessions)
      .where(eq(tenantConcessions.leaseId, leaseId));
    
    const [rollover] = await db.select()
      .from(tenantRolloverAssumptions)
      .where(eq(tenantRolloverAssumptions.leaseId, leaseId))
      .limit(1);
    
    // Calculate schedule
    const schedule = calculateLeaseSchedule({
      lease: {
        ...lease,
        sf: Number(lease.sf),
        securityDepositAmount: lease.securityDepositAmount ? Number(lease.securityDepositAmount) : null,
      },
      rentTerms: rentTerms.map(t => ({
        ...t,
        baseRentInputValue: Number(t.baseRentInputValue),
        escalationValue: t.escalationValue ? Number(t.escalationValue) : null,
        escalationCapPercent: t.escalationCapPercent ? Number(t.escalationCapPercent) : null,
        escalationFloorPercent: t.escalationFloorPercent ? Number(t.escalationFloorPercent) : null,
      })),
      recoveries: recoveries.map(r => ({
        ...r,
        amount: r.amount ? Number(r.amount) : null,
        psfAmount: r.psfAmount ? Number(r.psfAmount) : null,
        adminFeePercent: r.adminFeePercent ? Number(r.adminFeePercent) : null,
        nonrecoverablePercent: r.nonrecoverablePercent ? Number(r.nonrecoverablePercent) : null,
        expenseGrowthRatePercent: r.expenseGrowthRatePercent ? Number(r.expenseGrowthRatePercent) : null,
      })),
      percentageRent: percentageRent ? {
        ...percentageRent,
        breakpointAmountAnnual: percentageRent.breakpointAmountAnnual 
          ? Number(percentageRent.breakpointAmountAnnual) 
          : null,
        overagePercent: percentageRent.overagePercent 
          ? Number(percentageRent.overagePercent) 
          : null,
      } : null,
      sales: sales.map(s => ({
        ...s,
        grossSales: Number(s.grossSales),
      })),
      concessions: concessions.map(c => ({
        ...c,
        value: Number(c.value),
      })),
      rolloverAssumptions: rollover ? {
        ...rollover,
        renewalProbability: rollover.renewalProbability ? Number(rollover.renewalProbability) : null,
        marketRentPsfYear: rollover.marketRentPsfYear ? Number(rollover.marketRentPsfYear) : null,
        marketRentGrowthPercent: rollover.marketRentGrowthPercent ? Number(rollover.marketRentGrowthPercent) : null,
        renewalTiPsf: rollover.renewalTiPsf ? Number(rollover.renewalTiPsf) : null,
        renewalLcPercent: rollover.renewalLcPercent ? Number(rollover.renewalLcPercent) : null,
      } : null,
      horizonMonths: parseInt(horizonMonths as string),
      cpiAssumptionPercent: parseFloat(cpiPercent as string),
    });
    
    res.json({ data: schedule });
  } catch (error) {
    console.error("Error calculating schedule:", error);
    res.status(500).json({ error: "Failed to calculate schedule" });
  }
});

export default router;
