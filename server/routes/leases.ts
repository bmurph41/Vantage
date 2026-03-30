import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import { commercialTenants } from "@shared/schema";
import { eq, and, sql, or, like, desc } from "drizzle-orm";
import { differenceInMonths } from "date-fns";

const router = Router({ mergeParams: true });

// ============================================
// MIDDLEWARE
// ============================================

async function verifyProjectAccess(req: Request, res: Response, next: NextFunction) {
  const { projectId } = req.params;
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
// ENUM MAPPINGS
// ============================================

const LEASE_TYPE_TO_DB: Record<string, string> = {
  "NNN": "nnn",
  "MOD_GROSS": "modified_gross",
  "FULL_GROSS": "full_service",
  "ABSOLUTE_NNN": "absolute_net",
  "OTHER": "double_net",
};

const DB_TO_LEASE_TYPE: Record<string, string> = {
  "nnn": "NNN",
  "modified_gross": "MOD_GROSS",
  "full_service": "FULL_GROSS",
  "absolute_net": "ABSOLUTE_NNN",
  "double_net": "OTHER",
};

const ESCALATION_TYPE_TO_DB: Record<string, string> = {
  "NONE": "none",
  "PERCENT": "fixed_percent",
  "FIXED_DOLLAR": "fixed_dollar",
  "DOLLAR_PSF_YEAR": "fixed_dollar",
  "CPI": "cpi",
  "CPI_CAP_FLOOR": "cpi",
  "SCHEDULE": "none",
};

const DB_TO_ESCALATION_TYPE: Record<string, string> = {
  "none": "NONE",
  "fixed_percent": "PERCENT",
  "fixed_dollar": "FIXED_DOLLAR",
  "cpi": "CPI",
  "fair_market_value": "PERCENT",
};

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

function computeLeaseHealth(
  endDate: string,
  renewalProbability?: number | null
): { score: number; status: "Strong" | "Stable" | "Watch" | "At Risk" } {
  const monthsToExpiration = differenceInMonths(new Date(endDate), new Date());
  let score = 0;

  if (monthsToExpiration > 60) score = 95;
  else if (monthsToExpiration > 36) score = 80;
  else if (monthsToExpiration > 12) score = 60;
  else if (monthsToExpiration > 0) score = 35;
  else score = 10;

  if (renewalProbability && renewalProbability > 50) {
    score = Math.min(100, score + 10);
  }

  let status: "Strong" | "Stable" | "Watch" | "At Risk";
  if (score >= 80) status = "Strong";
  else if (score >= 60) status = "Stable";
  else if (score >= 35) status = "Watch";
  else status = "At Risk";

  return { score, status };
}

function rowToEscalationDisplay(row: any): string {
  const frontendType = DB_TO_ESCALATION_TYPE[row.escalationType] || "NONE";
  let value: number | null = null;

  if (row.escalationType === "fixed_percent" || row.escalationType === "cpi") {
    value = row.escalationRate ? Number(row.escalationRate) * 100 : null;
  } else if (row.escalationType === "fixed_dollar") {
    value = row.escalationAmount ? Number(row.escalationAmount) : null;
  }

  return computeEscalationDisplay(frontendType, value, row.escalationFrequency);
}

function mapStatusToDb(startDate: string, endDate: string): string {
  const status = computeLeaseStatus(startDate, endDate);
  switch (status) {
    case "FUTURE": return "pending";
    case "EXPIRED": return "expired";
    default: return "active";
  }
}

function getOrgId(req: Request): string {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).validatedOrgId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || (req as any).validatedUserId || 'user-1';
}

function mapRowToLease(row: any) {
  const sf = Number(row.squareFootage) || 0;
  const currentBaseRent = Number(row.currentBaseRent) || 0;
  const baseRentMonthly = currentBaseRent / 12;

  const startDate = row.leaseCommencementDate;
  const endDate = row.leaseExpirationDate;

  const dbStatus = row.tenantStatus;
  let displayStatus: string;
  if (dbStatus === "terminated") {
    displayStatus = "ARCHIVED";
  } else {
    displayStatus = computeLeaseStatus(startDate, endDate);
  }

  const hasRecoveries = !!(
    (row.estimatedCamPerSF && Number(row.estimatedCamPerSF) > 0) ||
    (row.estimatedTaxPerSF && Number(row.estimatedTaxPerSF) > 0) ||
    (row.estimatedInsurancePerSF && Number(row.estimatedInsurancePerSF) > 0) ||
    (row.totalEstimatedNNN && Number(row.totalEstimatedNNN) > 0)
  );

  const hasPercentRent = !!(row.percentageRentRate && Number(row.percentageRentRate) > 0);

  const health = computeLeaseHealth(
    endDate,
    row.renewalProbability ? Number(row.renewalProbability) : null
  );

  return {
    id: row.id,
    tenantName: row.tenantName,
    suiteLabel: row.suiteNumber || null,
    sf,
    leaseType: DB_TO_LEASE_TYPE[row.leaseType] || "OTHER",
    leaseStartDate: startDate,
    leaseEndDate: endDate,
    baseRentMonthly,
    escalationDisplay: rowToEscalationDisplay(row),
    optionsCount: row.renewalOptions || 0,
    percentRentEnabled: hasPercentRent,
    recoveriesEnabled: hasRecoveries,
    status: displayStatus,
    health,
  };
}

// ============================================
// ROUTES
// ============================================

// GET /api/valuator/:projectId/leases - List all leases
router.get("/", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { status, leaseType, search } = req.query;
    
    const conditions: any[] = [eq(commercialTenants.modelingProjectId, projectId)];
    
    if (status !== "ARCHIVED") {
      conditions.push(sql`${commercialTenants.tenantStatus} != 'terminated'`);
    }
    
    if (status === "ARCHIVED") {
      conditions.push(eq(commercialTenants.tenantStatus, "terminated" as any));
    }
    
    if (leaseType && typeof leaseType === "string") {
      const dbLeaseType = LEASE_TYPE_TO_DB[leaseType];
      if (dbLeaseType) {
        conditions.push(eq(commercialTenants.leaseType, dbLeaseType as any));
      }
    }
    
    if (search) {
      conditions.push(
        or(
          like(commercialTenants.tenantName, `%${search}%`),
          like(commercialTenants.suiteNumber, `%${search}%`)
        )
      );
    }
    
    const rows = await db.select()
      .from(commercialTenants)
      .where(and(...conditions))
      .orderBy(desc(commercialTenants.createdAt));
    
    let enrichedLeases = rows.map(mapRowToLease);
    
    if (status && status !== "all" && status !== "ARCHIVED") {
      enrichedLeases = enrichedLeases.filter(l => l.status === status);
    }
    
    res.json({ data: enrichedLeases });
  } catch (error) {
    console.error("Error fetching leases:", error);
    res.status(500).json({ error: "Failed to fetch leases" });
  }
});

// GET /api/valuator/:projectId/leases/kpis - Get portfolio KPIs
router.get("/kpis", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const rows = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.modelingProjectId, projectId),
        sql`${commercialTenants.tenantStatus} != 'terminated'`
      ));
    
    let totalBaseRentMonthly = 0;
    let totalRecoveriesMonthly = 0;
    let totalPercentRentMtd = 0;
    let totalPercentRentYtd = 0;
    let totalSf = 0;
    let activeLeaseCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let weightedRentSum = 0;
    
    for (const row of rows) {
      const sf = Number(row.squareFootage) || 0;
      const currentBaseRent = Number(row.currentBaseRent) || 0;
      const status = computeLeaseStatus(row.leaseCommencementDate, row.leaseExpirationDate);
      
      if (status === "EXPIRED") {
        expiredCount++;
        continue;
      }
      
      if (status === "EXPIRING") expiringCount++;
      if (status === "ACTIVE" || status === "EXPIRING") activeLeaseCount++;
      
      const monthlyRent = currentBaseRent / 12;
      totalBaseRentMonthly += monthlyRent;
      totalSf += sf;
      weightedRentSum += currentBaseRent;
      
      const totalNNN = Number(row.totalEstimatedNNN) || 0;
      if (totalNNN > 0) {
        totalRecoveriesMonthly += totalNNN / 12;
      } else {
        const cam = (Number(row.estimatedCamPerSF) || 0) * sf;
        const tax = (Number(row.estimatedTaxPerSF) || 0) * sf;
        const ins = (Number(row.estimatedInsurancePerSF) || 0) * sf;
        totalRecoveriesMonthly += (cam + tax + ins) / 12;
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
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const sf = payload.lease.sf;
    const monthlyRent = computeMonthlyRent(
      payload.initialTerm.baseRentInputUnit,
      payload.initialTerm.baseRentInputValue,
      sf
    );
    const annualRent = monthlyRent * 12;
    const baseRentPerSF = sf > 0 ? annualRent / sf : 0;

    const dbLeaseType = (LEASE_TYPE_TO_DB[payload.lease.leaseType] || "nnn") as any;
    const dbEscalationType = (ESCALATION_TYPE_TO_DB[payload.initialTerm.escalationType] || "none") as any;
    const dbStatus = mapStatusToDb(payload.lease.leaseStartDate, payload.lease.leaseEndDate) as any;

    let escalationRate: string | null = null;
    let escalationAmount: string | null = null;

    if (payload.initialTerm.escalationValue != null) {
      if (["PERCENT", "CPI", "CPI_CAP_FLOOR"].includes(payload.initialTerm.escalationType)) {
        escalationRate = String(payload.initialTerm.escalationValue / 100);
      } else if (["FIXED_DOLLAR", "DOLLAR_PSF_YEAR"].includes(payload.initialTerm.escalationType)) {
        escalationAmount = String(payload.initialTerm.escalationValue);
      }
    }

    let estimatedCamPerSF: string | null = null;
    let estimatedTaxPerSF: string | null = null;
    let estimatedInsurancePerSF: string | null = null;
    let adminFeePercent: string | null = null;

    if (payload.recoveries?.length) {
      for (const rec of payload.recoveries) {
        const psfVal = rec.psfAmount
          ? String(rec.psfAmount)
          : (rec.amount && sf > 0 ? String(Number(rec.amount) / sf) : null);

        switch (rec.recoveryType) {
          case "CAM": estimatedCamPerSF = psfVal; break;
          case "TAXES": estimatedTaxPerSF = psfVal; break;
          case "INSURANCE": estimatedInsurancePerSF = psfVal; break;
        }
        if (rec.adminFeePercent) {
          adminFeePercent = String(rec.adminFeePercent / 100);
        }
      }
    }

    let percentageRentRate: string | null = null;
    let naturalBreakpoint: string | null = null;
    let artificialBreakpoint: string | null = null;

    if (payload.percentageRent?.enabled) {
      percentageRentRate = payload.percentageRent.overagePercent
        ? String(payload.percentageRent.overagePercent / 100)
        : null;

      if (payload.percentageRent.breakpointType === "NATURAL" && payload.percentageRent.breakpointAmountAnnual) {
        naturalBreakpoint = String(payload.percentageRent.breakpointAmountAnnual);
      } else if (payload.percentageRent.breakpointType === "ARTIFICIAL" && payload.percentageRent.breakpointAmountAnnual) {
        artificialBreakpoint = String(payload.percentageRent.breakpointAmountAnnual);
      }
    }

    let tiAllowance: string | null = null;
    let tiAllowancePerSF: string | null = null;

    if (payload.capexLeasing) {
      tiAllowance = payload.capexLeasing.tiTotal ? String(payload.capexLeasing.tiTotal) : null;
      tiAllowancePerSF = payload.capexLeasing.tiAllowancePsf ? String(payload.capexLeasing.tiAllowancePsf) : null;
    }

    let assumeRenewal = true;
    let renewalProbability: string | null = null;
    let releaseDowntimeMonths = 6;

    if (payload.rolloverAssumptions) {
      assumeRenewal = payload.rolloverAssumptions.assumeRenewal;
      renewalProbability = payload.rolloverAssumptions.renewalProbability
        ? String(payload.rolloverAssumptions.renewalProbability)
        : null;
      releaseDowntimeMonths = payload.rolloverAssumptions.downtimeMonths ?? 6;
    }

    const [newRow] = await db.insert(commercialTenants).values({
      orgId,
      modelingProjectId: projectId,
      tenantName: payload.lease.tenantName,
      suiteNumber: payload.lease.suiteLabel || null,
      squareFootage: String(sf),
      leaseCommencementDate: payload.lease.leaseStartDate,
      rentStartDate: payload.lease.rentCommencementDate || null,
      leaseExpirationDate: payload.lease.leaseEndDate,
      leaseType: dbLeaseType,
      tenantStatus: dbStatus,
      currentBaseRent: String(annualRent),
      baseRentPerSF: String(baseRentPerSF),
      escalationType: dbEscalationType,
      escalationRate,
      escalationAmount,
      escalationFrequency: payload.initialTerm.escalationFrequencyMonths || 12,
      securityDeposit: payload.lease.securityDepositAmount ? String(payload.lease.securityDepositAmount) : null,
      estimatedCamPerSF,
      estimatedTaxPerSF,
      estimatedInsurancePerSF,
      adminFeePercent,
      percentageRentRate,
      naturalBreakpoint,
      artificialBreakpoint,
      tiAllowance,
      tiAllowancePerSF,
      assumeRenewal,
      renewalProbability,
      releaseDowntimeMonths,
      renewalOptions: payload.optionTerms?.length || 0,
      notes: payload.lease.notes || null,
      createdBy: userId,
    }).returning();

    res.status(201).json({ data: newRow });
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

    const [row] = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.id, leaseId),
        eq(commercialTenants.modelingProjectId, projectId)
      ))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Lease not found" });
    }

    res.json({ data: mapRowToLease(row) });
  } catch (error) {
    console.error("Error fetching lease:", error);
    res.status(500).json({ error: "Failed to fetch lease" });
  }
});

// POST /api/valuator/:projectId/leases/:leaseId/duplicate - Duplicate lease
router.post("/:leaseId/duplicate", async (req: Request, res: Response) => {
  try {
    const { projectId, leaseId } = req.params;
    const userId = getUserId(req);

    const [original] = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.id, leaseId),
        eq(commercialTenants.modelingProjectId, projectId)
      ))
      .limit(1);

    if (!original) {
      return res.status(404).json({ error: "Lease not found" });
    }

    const { id, createdAt, updatedAt, ...rest } = original;

    const [newRow] = await db.insert(commercialTenants).values({
      ...rest,
      tenantName: `${original.tenantName} (Copy)`,
      createdBy: userId,
      updatedBy: null,
    }).returning();

    res.status(201).json({ data: newRow });
  } catch (error) {
    console.error("Error duplicating lease:", error);
    res.status(500).json({ error: "Failed to duplicate lease" });
  }
});

// DELETE /api/valuator/:projectId/leases/:leaseId - Archive (soft delete) lease
router.delete("/:leaseId", async (req: Request, res: Response) => {
  try {
    const { projectId, leaseId } = req.params;

    const [updated] = await db.update(commercialTenants)
      .set({ tenantStatus: "terminated", isActive: false, updatedAt: new Date() })
      .where(and(
        eq(commercialTenants.id, leaseId),
        eq(commercialTenants.modelingProjectId, projectId)
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

export default router;
