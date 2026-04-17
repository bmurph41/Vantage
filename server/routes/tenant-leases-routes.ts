import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  tenantLeases,
  tenantRentTerms,
  tenantRecoveries,
  tenantPercentageRent,
  tenantSales,
  tenantConcessions,
  tenantCapexLeasing,
  tenantRolloverAssumptions,
} from "../../db/schema-commercial-tenants";
import { modelingProjects } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Authorization helpers ──────────────────────────────────────────────────────

async function verifyLeaseAccess(leaseId: string, orgId: string) {
  const [lease] = await db.select().from(tenantLeases).where(eq(tenantLeases.id, leaseId));
  if (!lease) return null;
  const [project] = await db.select({ orgId: modelingProjects.orgId })
    .from(modelingProjects)
    .where(eq(modelingProjects.id, lease.projectId));
  if (!project || project.orgId !== orgId) return null;
  return lease;
}

async function verifyProjectAccess(projectId: string, orgId: string) {
  const [project] = await db.select({ orgId: modelingProjects.orgId })
    .from(modelingProjects)
    .where(eq(modelingProjects.id, projectId));
  return project && project.orgId === orgId;
}

// ── Domain helpers ─────────────────────────────────────────────────────────────

function computeLeaseStatus(leaseStartDate: string, leaseEndDate: string, storedStatus: string): string {
  if (storedStatus === "ARCHIVED") return "ARCHIVED";
  const now = new Date();
  const end = new Date(leaseEndDate);
  const start = new Date(leaseStartDate);
  const twelveMonthsOut = new Date();
  twelveMonthsOut.setMonth(twelveMonthsOut.getMonth() + 12);
  if (end < now) return "EXPIRED";
  if (start > now) return "FUTURE";
  if (end <= twelveMonthsOut) return "EXPIRING";
  return "ACTIVE";
}

function computeHealth(leaseEndDate: string, hasRentTerms: boolean) {
  const now = new Date();
  const end = new Date(leaseEndDate);
  const monthsLeft = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
  let score = 100;
  if (monthsLeft < 0) score -= 40;
  else if (monthsLeft < 6) score -= 30;
  else if (monthsLeft < 12) score -= 20;
  else if (monthsLeft < 24) score -= 10;
  if (!hasRentTerms) score -= 10;
  score = Math.max(0, Math.min(100, score));
  let status: "Strong" | "Stable" | "Watch" | "At Risk";
  if (score >= 80) status = "Strong";
  else if (score >= 60) status = "Stable";
  else if (score >= 40) status = "Watch";
  else status = "At Risk";
  return { score, status };
}

function buildEscalationDisplay(escalationType: string | null, escalationValue: string | null): string {
  if (!escalationType || escalationType === "NONE") return "Flat";
  const val = escalationValue ? parseFloat(escalationValue) : null;
  switch (escalationType) {
    case "PERCENT": return val != null ? `${(val * 100).toFixed(1)}%/yr` : "Fixed %";
    case "FIXED_DOLLAR": return val != null ? `$${val}/yr` : "Fixed $";
    case "DOLLAR_PSF_YEAR": return val != null ? `$${val}/SF/yr` : "$/SF/yr";
    case "CPI": return "CPI";
    case "CPI_CAP_FLOOR": return "CPI (capped)";
    case "SCHEDULE": return "Scheduled";
    default: return "—";
  }
}

function computeMonthlyRent(term: typeof tenantRentTerms.$inferSelect | undefined, sf: number): number {
  if (!term) return 0;
  const val = parseFloat(term.baseRentInputValue) || 0;
  if (term.baseRentInputUnit === "PSF_YEAR") return (val * sf) / 12;
  if (term.baseRentInputUnit === "PER_YEAR") return val / 12;
  return val;
}

type LeaseRow = typeof tenantLeases.$inferSelect;
type RentTermRow = typeof tenantRentTerms.$inferSelect;
type RecoveryRow = typeof tenantRecoveries.$inferSelect;
type PercentageRentRow = typeof tenantPercentageRent.$inferSelect;
type SaleRow = typeof tenantSales.$inferSelect;
type ConcessionRow = typeof tenantConcessions.$inferSelect;
type CapexRow = typeof tenantCapexLeasing.$inferSelect;
type RolloverRow = typeof tenantRolloverAssumptions.$inferSelect;

function formatLeaseForList(
  lease: LeaseRow,
  rentTerms: RentTermRow[],
  recoveries: RecoveryRow[],
  percentageRent: PercentageRentRow[],
) {
  const sf = parseFloat(lease.sf) || 0;
  const initialTerm = rentTerms.find(t => t.termType === "INITIAL") ?? rentTerms[0];
  const baseRentMonthly = computeMonthlyRent(initialTerm, sf);
  const status = computeLeaseStatus(lease.leaseStartDate, lease.leaseEndDate, lease.status);
  const health = computeHealth(lease.leaseEndDate, rentTerms.length > 0);
  return {
    id: lease.id,
    projectId: lease.projectId,
    tenantName: lease.tenantName,
    suiteLabel: lease.suiteLabel,
    sf,
    leaseType: lease.leaseType,
    leaseStartDate: lease.leaseStartDate,
    leaseEndDate: lease.leaseEndDate,
    baseRentMonthly,
    escalationDisplay: buildEscalationDisplay(
      initialTerm?.escalationType ?? null,
      initialTerm?.escalationValue ?? null,
    ),
    optionsCount: rentTerms.filter(t => t.termType === "OPTION").length,
    percentRentEnabled: percentageRent.some(pr => pr.enabled),
    recoveriesEnabled: recoveries.length > 0,
    status,
    health,
  };
}

async function getLeaseWithChildren(leaseId: string) {
  const [lease] = await db.select().from(tenantLeases).where(eq(tenantLeases.id, leaseId));
  if (!lease) return null;
  const [rentTerms, recoveries, percentageRent, sales, concessions, capexLeasing, rollover] =
    await Promise.all([
      db.select().from(tenantRentTerms).where(eq(tenantRentTerms.leaseId, leaseId)).orderBy(asc(tenantRentTerms.termStartDate)),
      db.select().from(tenantRecoveries).where(eq(tenantRecoveries.leaseId, leaseId)),
      db.select().from(tenantPercentageRent).where(eq(tenantPercentageRent.leaseId, leaseId)),
      db.select().from(tenantSales).where(eq(tenantSales.leaseId, leaseId)).orderBy(desc(tenantSales.periodEndDate)),
      db.select().from(tenantConcessions).where(eq(tenantConcessions.leaseId, leaseId)).orderBy(asc(tenantConcessions.startDate)),
      db.select().from(tenantCapexLeasing).where(eq(tenantCapexLeasing.leaseId, leaseId)),
      db.select().from(tenantRolloverAssumptions).where(eq(tenantRolloverAssumptions.leaseId, leaseId)),
    ]);
  return { ...lease, rentTerms, recoveries, percentageRent, sales, concessions, capexLeasing, rollover };
}

async function duplicateLease(leaseId: string, orgId: string): Promise<typeof tenantLeases.$inferSelect | null> {
  const existing = await verifyLeaseAccess(leaseId, orgId);
  if (!existing) return null;
  const full = await getLeaseWithChildren(leaseId);
  if (!full) return null;

  const { id, createdAt, updatedAt, rentTerms, recoveries, percentageRent, sales, concessions, capexLeasing, rollover, ...leaseData } = full;
  const [newLease] = await db.insert(tenantLeases).values({
    ...leaseData,
    tenantName: `${leaseData.tenantName} (Copy)`,
  }).returning();

  if (rentTerms.length) {
    await db.insert(tenantRentTerms).values(
      rentTerms.map(({ id: _id, createdAt: _ca, updatedAt: _ua, leaseId: _lid, ...t }) => ({ ...t, leaseId: newLease.id }))
    );
  }
  if (recoveries.length) {
    await db.insert(tenantRecoveries).values(
      recoveries.map(({ id: _id, createdAt: _ca, updatedAt: _ua, leaseId: _lid, ...r }) => ({ ...r, leaseId: newLease.id }))
    );
  }
  if (concessions.length) {
    await db.insert(tenantConcessions).values(
      concessions.map(({ id: _id, createdAt: _ca, updatedAt: _ua, leaseId: _lid, ...c }) => ({ ...c, leaseId: newLease.id }))
    );
  }
  if (capexLeasing.length) {
    await db.insert(tenantCapexLeasing).values(
      capexLeasing.map(({ id: _id, createdAt: _ca, updatedAt: _ua, leaseId: _lid, ...cx }) => ({ ...cx, leaseId: newLease.id }))
    );
  }
  if (percentageRent.length) {
    await db.insert(tenantPercentageRent).values(
      percentageRent.map(({ id: _id, createdAt: _ca, updatedAt: _ua, leaseId: _lid, ...pr }) => ({ ...pr, leaseId: newLease.id }))
    );
  }
  return newLease;
}

// ── Validation Schemas ────────────────────────────────────────────────────────

const leaseTypeValues = ["NNN", "MOD_GROSS", "FULL_GROSS", "ABSOLUTE_NNN", "OTHER"] as const;
const leaseStatusValues = ["ACTIVE", "FUTURE", "EXPIRING", "EXPIRED", "ARCHIVED"] as const;
const securityDepositTypeValues = ["CASH", "LOC", "NONE"] as const;
const termTypeValues = ["INITIAL", "OPTION"] as const;
const rentInputUnitValues = ["PSF_YEAR", "PER_MONTH", "PER_YEAR"] as const;
const escalationTypeValues = ["NONE", "PERCENT", "FIXED_DOLLAR", "DOLLAR_PSF_YEAR", "CPI", "CPI_CAP_FLOOR", "SCHEDULE"] as const;
const recoveryTypeValues = ["CAM", "TAXES", "INSURANCE", "UTILITIES", "TRASH", "SECURITY", "OTHER"] as const;
const recoveryMethodValues = ["PRO_RATA", "BASE_YEAR_STOP", "EXPENSE_STOP_PSF", "FIXED_MONTHLY", "FIXED_ANNUAL"] as const;
const concessionTypeValues = ["FREE_RENT", "DISCOUNT_PERCENT", "DISCOUNT_FIXED", "OTHER"] as const;
const tiPaymentTimingValues = ["UPFRONT", "REIMBURSEMENT", "DRAW_SCHEDULE"] as const;
const lcPaymentTimingValues = ["AT_SIGNING", "SPREAD"] as const;
const breakpointTypeValues = ["NATURAL", "ARTIFICIAL"] as const;
const settlementFrequencyValues = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;

const numericString = z.preprocess(
  (val) => (val === "" || val == null ? null : val),
  z.string().regex(/^-?\d+(\.\d+)?$/, "Must be a number").nullable()
).optional();

function normalizeForDb<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v])
  ) as T;
}

const insertLeaseSchema = z.object({
  projectId: z.string().uuid(),
  tenantName: z.string().min(1, "Tenant name is required"),
  suiteLabel: z.string().nullable().optional(),
  sf: z.string().regex(/^\d+(\.\d+)?$/, "Invalid SF"),
  unitCount: z.number().int().nullable().optional(),
  leaseType: z.enum(leaseTypeValues).default("NNN"),
  leaseStartDate: z.string().min(1, "Start date required"),
  rentCommencementDate: z.string().nullable().optional(),
  leaseEndDate: z.string().min(1, "End date required"),
  securityDepositAmount: numericString,
  securityDepositType: z.enum(securityDepositTypeValues).default("NONE"),
  notes: z.string().nullable().optional(),
  status: z.enum(leaseStatusValues).default("ACTIVE"),
});

const insertRentTermSchema = z.object({
  leaseId: z.string().uuid(),
  termType: z.enum(termTypeValues).default("INITIAL"),
  optionIndex: z.number().int().nullable().optional(),
  termStartDate: z.string().min(1, "Start date required"),
  termEndDate: z.string().min(1, "End date required"),
  baseRentInputUnit: z.enum(rentInputUnitValues).default("PSF_YEAR"),
  baseRentInputValue: z.string().regex(/^\d+(\.\d+)?$/, "Invalid rent value"),
  escalationType: z.enum(escalationTypeValues).default("NONE"),
  escalationValue: numericString,
  escalationFrequencyMonths: z.number().int().nullable().optional(),
  escalationCapPercent: numericString,
  escalationFloorPercent: numericString,
  escalationCpiSeries: z.string().nullable().optional(),
  scheduleJson: z.any().nullable().optional(),
});

const insertRecoverySchema = z.object({
  leaseId: z.string().uuid(),
  recoveryType: z.enum(recoveryTypeValues),
  method: z.enum(recoveryMethodValues),
  amount: numericString,
  psfAmount: numericString,
  adminFeePercent: numericString,
  grossUpToOccupancy: numericString,
  nonrecoverablePercent: numericString,
  expenseGrowthRatePercent: numericString,
});

const insertPercentageRentSchema = z.object({
  leaseId: z.string().uuid(),
  enabled: z.boolean().default(false),
  breakpointType: z.enum(breakpointTypeValues).nullable().optional(),
  breakpointAmountAnnual: numericString,
  overagePercent: numericString,
  settlementFrequency: z.enum(settlementFrequencyValues).nullable().optional(),
  exclusionsJson: z.any().nullable().optional(),
});

const insertSaleSchema = z.object({
  leaseId: z.string().uuid(),
  periodEndDate: z.string().min(1, "Period end date required"),
  grossSales: z.string().regex(/^\d+(\.\d+)?$/, "Invalid gross sales"),
});

const insertConcessionSchema = z.object({
  leaseId: z.string().uuid(),
  concessionType: z.enum(concessionTypeValues),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  value: z.string().regex(/^\d+(\.\d+)?$/, "Invalid value"),
  notes: z.string().nullable().optional(),
});

const insertCapexSchema = z.object({
  leaseId: z.string().uuid(),
  tiAllowancePsf: numericString,
  tiTotal: numericString,
  tiPaymentTiming: z.enum(tiPaymentTimingValues).nullable().optional(),
  lcPercentInitial: numericString,
  lcPercentRenewal: numericString,
  lcPaymentTiming: z.enum(lcPaymentTimingValues).nullable().optional(),
});

const insertRolloverSchema = z.object({
  leaseId: z.string().uuid(),
  assumeRenewal: z.boolean().default(false),
  renewalProbability: numericString,
  downtimeMonths: z.number().int().nullable().optional(),
  marketRentPsfYear: numericString,
  marketRentGrowthPercent: numericString,
  renewalTiPsf: numericString,
  renewalLcPercent: numericString,
});

// ── KPI computation helper ─────────────────────────────────────────────────────

async function computeProjectKpis(projectId: string) {
  const leaseRows = await db.select().from(tenantLeases).where(eq(tenantLeases.projectId, projectId));
  let totalBaseRentMonthly = 0;
  let totalRecoveriesMonthly = 0;
  let totalSf = 0;
  let activeLeaseCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let weightedRentSum = 0;
  let weightedSfSum = 0;

  for (const lease of leaseRows) {
    const sf = parseFloat(lease.sf) || 0;
    const status = computeLeaseStatus(lease.leaseStartDate, lease.leaseEndDate, lease.status);
    if (status === "EXPIRED") { expiredCount++; continue; }
    if (status === "ARCHIVED") continue;
    if (status === "EXPIRING") expiringCount++;
    if (status === "ACTIVE") activeLeaseCount++;

    const [rentTerms, recoveries] = await Promise.all([
      db.select().from(tenantRentTerms).where(and(eq(tenantRentTerms.leaseId, lease.id), eq(tenantRentTerms.termType, "INITIAL"))).limit(1),
      db.select().from(tenantRecoveries).where(eq(tenantRecoveries.leaseId, lease.id)),
    ]);

    const monthlyRent = computeMonthlyRent(rentTerms[0], sf);
    totalBaseRentMonthly += monthlyRent;
    totalSf += sf;
    weightedRentSum += monthlyRent * 12;
    weightedSfSum += sf;

    for (const rec of recoveries) {
      const amount = parseFloat(rec.amount ?? "0") || 0;
      const psfAmt = parseFloat(rec.psfAmount ?? "0") || 0;
      if (rec.method === "FIXED_MONTHLY") totalRecoveriesMonthly += amount;
      else if (rec.method === "FIXED_ANNUAL") totalRecoveriesMonthly += amount / 12;
      else if (rec.method === "EXPENSE_STOP_PSF") totalRecoveriesMonthly += (psfAmt * sf) / 12;
      else if (rec.amount) totalRecoveriesMonthly += amount / 12;
    }
  }

  return {
    totalBaseRentMonthly,
    totalRecoveriesMonthly,
    totalPercentRentMtd: 0,
    totalPercentRentYtd: 0,
    weightedAvgRentPsf: weightedSfSum > 0 ? weightedRentSum / weightedSfSum : 0,
    totalSf,
    activeLeaseCount,
    expiringCount,
    expiredCount,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES mounted at /api/tenant-leases
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/tenant-leases?projectId=xxx[&status=xxx]
router.get("/", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId, status } = req.query;
    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({ error: "projectId is required" });
    }
    const hasAccess = await verifyProjectAccess(projectId, orgId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    const leaseRows = await db.select().from(tenantLeases)
      .where(eq(tenantLeases.projectId, projectId))
      .orderBy(desc(tenantLeases.createdAt));

    const formatted = await Promise.all(leaseRows.map(async (lease) => {
      const [rentTerms, recoveries, percentageRent] = await Promise.all([
        db.select().from(tenantRentTerms).where(eq(tenantRentTerms.leaseId, lease.id)).orderBy(asc(tenantRentTerms.termStartDate)),
        db.select().from(tenantRecoveries).where(eq(tenantRecoveries.leaseId, lease.id)),
        db.select().from(tenantPercentageRent).where(eq(tenantPercentageRent.leaseId, lease.id)),
      ]);
      return formatLeaseForList(lease, rentTerms, recoveries, percentageRent);
    }));

    const filtered = status ? formatted.filter(l => l.status === status) : formatted;
    res.json({ data: filtered, total: filtered.length });
  } catch (error: any) {
    console.error("[TenantLeases] GET /:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tenant-leases/kpis?projectId=xxx
router.get("/kpis", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId } = req.query;
    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({ error: "projectId is required" });
    }
    const hasAccess = await verifyProjectAccess(projectId, orgId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    const data = await computeProjectKpis(projectId);
    res.json({ data });
  } catch (error: any) {
    console.error("[TenantLeases] GET /kpis:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tenant-leases/:leaseId
router.get("/:leaseId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    const lease = await verifyLeaseAccess(leaseId, orgId);
    if (!lease) return res.status(404).json({ error: "Lease not found" });
    const full = await getLeaseWithChildren(leaseId);
    res.json(full);
  } catch (error: any) {
    console.error("[TenantLeases] GET /:leaseId:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tenant-leases
router.post("/", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const validated = insertLeaseSchema.parse(req.body);
    const hasAccess = await verifyProjectAccess(validated.projectId, orgId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    const [lease] = await db.insert(tenantLeases).values(normalizeForDb(validated)).returning();
    res.status(201).json(lease);
  } catch (error: any) {
    console.error("[TenantLeases] POST /:", error);
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/tenant-leases/:leaseId
router.patch("/:leaseId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    const existing = await verifyLeaseAccess(leaseId, orgId);
    if (!existing) return res.status(404).json({ error: "Lease not found" });

    const updateSchema = insertLeaseSchema.omit({ projectId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantLeases)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(eq(tenantLeases.id, leaseId))
      .returning();
    res.json(updated);
  } catch (error: any) {
    console.error("[TenantLeases] PATCH /:leaseId:", error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/tenant-leases/:leaseId
router.delete("/:leaseId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    const existing = await verifyLeaseAccess(leaseId, orgId);
    if (!existing) return res.status(404).json({ error: "Lease not found" });
    await db.delete(tenantLeases).where(eq(tenantLeases.id, leaseId));
    res.status(204).send();
  } catch (error: any) {
    console.error("[TenantLeases] DELETE /:leaseId:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tenant-leases/:leaseId/duplicate
// Copies: lease, rent terms, recoveries, concessions, capex, percentage rent (excludes sales)
router.post("/:leaseId/duplicate", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    const newLease = await duplicateLease(leaseId, orgId);
    if (!newLease) return res.status(404).json({ error: "Lease not found" });
    res.status(201).json(newLease);
  } catch (error: any) {
    console.error("[TenantLeases] POST /:leaseId/duplicate:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── RENT TERMS ────────────────────────────────────────────────────────────────

router.get("/:leaseId/rent-terms", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const terms = await db.select().from(tenantRentTerms).where(eq(tenantRentTerms.leaseId, leaseId)).orderBy(asc(tenantRentTerms.termStartDate));
    res.json(terms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:leaseId/rent-terms", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const validated = insertRentTermSchema.parse({ ...req.body, leaseId });
    const [term] = await db.insert(tenantRentTerms).values(normalizeForDb(validated)).returning();
    res.status(201).json(term);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:leaseId/rent-terms/:termId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, termId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const updateSchema = insertRentTermSchema.omit({ leaseId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantRentTerms)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(and(eq(tenantRentTerms.id, termId), eq(tenantRentTerms.leaseId, leaseId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Rent term not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:leaseId/rent-terms/:termId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, termId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const result = await db.delete(tenantRentTerms)
      .where(and(eq(tenantRentTerms.id, termId), eq(tenantRentTerms.leaseId, leaseId)))
      .returning();
    if (!result.length) return res.status(404).json({ error: "Rent term not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── RECOVERIES ────────────────────────────────────────────────────────────────

router.get("/:leaseId/recoveries", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const rows = await db.select().from(tenantRecoveries).where(eq(tenantRecoveries.leaseId, leaseId));
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:leaseId/recoveries", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const validated = insertRecoverySchema.parse({ ...req.body, leaseId });
    const [row] = await db.insert(tenantRecoveries).values(normalizeForDb(validated)).returning();
    res.status(201).json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:leaseId/recoveries/:recoveryId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, recoveryId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const updateSchema = insertRecoverySchema.omit({ leaseId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantRecoveries)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(and(eq(tenantRecoveries.id, recoveryId), eq(tenantRecoveries.leaseId, leaseId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Recovery not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:leaseId/recoveries/:recoveryId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, recoveryId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const result = await db.delete(tenantRecoveries)
      .where(and(eq(tenantRecoveries.id, recoveryId), eq(tenantRecoveries.leaseId, leaseId)))
      .returning();
    if (!result.length) return res.status(404).json({ error: "Recovery not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PERCENTAGE RENT ───────────────────────────────────────────────────────────

router.get("/:leaseId/percentage-rent", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const [row] = await db.select().from(tenantPercentageRent).where(eq(tenantPercentageRent.leaseId, leaseId));
    res.json(row ?? null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:leaseId/percentage-rent", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const validated = insertPercentageRentSchema.parse({ ...req.body, leaseId });
    const [existing] = await db.select().from(tenantPercentageRent).where(eq(tenantPercentageRent.leaseId, leaseId));
    if (existing) {
      const [updated] = await db.update(tenantPercentageRent)
        .set({ ...normalizeForDb(validated), updatedAt: new Date() })
        .where(and(eq(tenantPercentageRent.id, existing.id), eq(tenantPercentageRent.leaseId, leaseId)))
        .returning();
      return res.json(updated);
    }
    const [row] = await db.insert(tenantPercentageRent).values(normalizeForDb(validated)).returning();
    res.status(201).json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:leaseId/percentage-rent/:prId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, prId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const updateSchema = insertPercentageRentSchema.omit({ leaseId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantPercentageRent)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(and(eq(tenantPercentageRent.id, prId), eq(tenantPercentageRent.leaseId, leaseId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Percentage rent config not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:leaseId/percentage-rent/:prId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, prId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const result = await db.delete(tenantPercentageRent)
      .where(and(eq(tenantPercentageRent.id, prId), eq(tenantPercentageRent.leaseId, leaseId)))
      .returning();
    if (!result.length) return res.status(404).json({ error: "Percentage rent config not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── SALES ──────────────────────────────────────────────────────────────────────

router.get("/:leaseId/sales", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const rows = await db.select().from(tenantSales)
      .where(eq(tenantSales.leaseId, leaseId))
      .orderBy(desc(tenantSales.periodEndDate));
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:leaseId/sales", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const validated = insertSaleSchema.parse({ ...req.body, leaseId });
    const [row] = await db.insert(tenantSales).values(normalizeForDb(validated)).returning();
    res.status(201).json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:leaseId/sales/:saleId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, saleId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const updateSchema = insertSaleSchema.omit({ leaseId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantSales)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(and(eq(tenantSales.id, saleId), eq(tenantSales.leaseId, leaseId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Sales record not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:leaseId/sales/:saleId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, saleId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const result = await db.delete(tenantSales)
      .where(and(eq(tenantSales.id, saleId), eq(tenantSales.leaseId, leaseId)))
      .returning();
    if (!result.length) return res.status(404).json({ error: "Sales record not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── CONCESSIONS ───────────────────────────────────────────────────────────────

router.get("/:leaseId/concessions", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const rows = await db.select().from(tenantConcessions)
      .where(eq(tenantConcessions.leaseId, leaseId))
      .orderBy(asc(tenantConcessions.startDate));
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:leaseId/concessions", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const validated = insertConcessionSchema.parse({ ...req.body, leaseId });
    const [row] = await db.insert(tenantConcessions).values(normalizeForDb(validated)).returning();
    res.status(201).json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:leaseId/concessions/:concessionId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, concessionId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const updateSchema = insertConcessionSchema.omit({ leaseId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantConcessions)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(and(eq(tenantConcessions.id, concessionId), eq(tenantConcessions.leaseId, leaseId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Concession not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:leaseId/concessions/:concessionId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, concessionId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const result = await db.delete(tenantConcessions)
      .where(and(eq(tenantConcessions.id, concessionId), eq(tenantConcessions.leaseId, leaseId)))
      .returning();
    if (!result.length) return res.status(404).json({ error: "Concession not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── CAPEX / LEASING COSTS ─────────────────────────────────────────────────────

router.get("/:leaseId/capex", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const [row] = await db.select().from(tenantCapexLeasing).where(eq(tenantCapexLeasing.leaseId, leaseId));
    res.json(row ?? null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:leaseId/capex", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const validated = insertCapexSchema.parse({ ...req.body, leaseId });
    const [existing] = await db.select().from(tenantCapexLeasing).where(eq(tenantCapexLeasing.leaseId, leaseId));
    if (existing) {
      const [updated] = await db.update(tenantCapexLeasing)
        .set({ ...normalizeForDb(validated), updatedAt: new Date() })
        .where(and(eq(tenantCapexLeasing.id, existing.id), eq(tenantCapexLeasing.leaseId, leaseId)))
        .returning();
      return res.json(updated);
    }
    const [row] = await db.insert(tenantCapexLeasing).values(normalizeForDb(validated)).returning();
    res.status(201).json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:leaseId/capex/:capexId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, capexId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const updateSchema = insertCapexSchema.omit({ leaseId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantCapexLeasing)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(and(eq(tenantCapexLeasing.id, capexId), eq(tenantCapexLeasing.leaseId, leaseId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "CapEx record not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:leaseId/capex/:capexId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, capexId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const result = await db.delete(tenantCapexLeasing)
      .where(and(eq(tenantCapexLeasing.id, capexId), eq(tenantCapexLeasing.leaseId, leaseId)))
      .returning();
    if (!result.length) return res.status(404).json({ error: "CapEx record not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── ROLLOVER ASSUMPTIONS ──────────────────────────────────────────────────────

router.get("/:leaseId/rollover", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const [row] = await db.select().from(tenantRolloverAssumptions).where(eq(tenantRolloverAssumptions.leaseId, leaseId));
    res.json(row ?? null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:leaseId/rollover", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const validated = insertRolloverSchema.parse({ ...req.body, leaseId });
    const [existing] = await db.select().from(tenantRolloverAssumptions).where(eq(tenantRolloverAssumptions.leaseId, leaseId));
    if (existing) {
      const [updated] = await db.update(tenantRolloverAssumptions)
        .set({ ...normalizeForDb(validated), updatedAt: new Date() })
        .where(and(eq(tenantRolloverAssumptions.id, existing.id), eq(tenantRolloverAssumptions.leaseId, leaseId)))
        .returning();
      return res.json(updated);
    }
    const [row] = await db.insert(tenantRolloverAssumptions).values(normalizeForDb(validated)).returning();
    res.status(201).json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:leaseId/rollover/:rolloverId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, rolloverId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const updateSchema = insertRolloverSchema.omit({ leaseId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantRolloverAssumptions)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(and(eq(tenantRolloverAssumptions.id, rolloverId), eq(tenantRolloverAssumptions.leaseId, leaseId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Rollover assumption not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:leaseId/rollover/:rolloverId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { leaseId, rolloverId } = req.params;
    if (!await verifyLeaseAccess(leaseId, orgId)) return res.status(404).json({ error: "Lease not found" });
    const result = await db.delete(tenantRolloverAssumptions)
      .where(and(eq(tenantRolloverAssumptions.id, rolloverId), eq(tenantRolloverAssumptions.leaseId, leaseId)))
      .returning();
    if (!result.length) return res.status(404).json({ error: "Rollover assumption not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

// ═════════════════════════════════════════════════════════════════════════════
// VALUATOR-SCOPED ROUTER (mounted at /api/valuator)
// Provides /:projectId/leases endpoints used by the frontend
// ═════════════════════════════════════════════════════════════════════════════

export const valuatorLeaseRouter = Router({ mergeParams: true });

valuatorLeaseRouter.get("/:projectId/leases", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId } = req.params;
    const { status } = req.query;
    const hasAccess = await verifyProjectAccess(projectId, orgId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    const leaseRows = await db.select().from(tenantLeases)
      .where(eq(tenantLeases.projectId, projectId))
      .orderBy(desc(tenantLeases.createdAt));

    const formatted = await Promise.all(leaseRows.map(async (lease) => {
      const [rentTerms, recoveries, percentageRent] = await Promise.all([
        db.select().from(tenantRentTerms).where(eq(tenantRentTerms.leaseId, lease.id)).orderBy(asc(tenantRentTerms.termStartDate)),
        db.select().from(tenantRecoveries).where(eq(tenantRecoveries.leaseId, lease.id)),
        db.select().from(tenantPercentageRent).where(eq(tenantPercentageRent.leaseId, lease.id)),
      ]);
      return formatLeaseForList(lease, rentTerms, recoveries, percentageRent);
    }));

    const filtered = status ? formatted.filter(l => l.status === status) : formatted;
    res.json({ data: filtered, total: filtered.length });
  } catch (error: any) {
    console.error("[ValuatorLeases] GET /:projectId/leases:", error);
    res.status(500).json({ error: error.message });
  }
});

valuatorLeaseRouter.get("/:projectId/leases/kpis", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId } = req.params;
    const hasAccess = await verifyProjectAccess(projectId, orgId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    const data = await computeProjectKpis(projectId);
    res.json({ data });
  } catch (error: any) {
    console.error("[ValuatorLeases] GET /:projectId/leases/kpis:", error);
    res.status(500).json({ error: error.message });
  }
});

valuatorLeaseRouter.get("/:projectId/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId, leaseId } = req.params;
    const lease = await verifyLeaseAccess(leaseId, orgId);
    if (!lease) return res.status(404).json({ error: "Lease not found" });
    if (lease.projectId !== projectId) return res.status(404).json({ error: "Lease not found in this project" });
    const full = await getLeaseWithChildren(leaseId);
    res.json(full);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

valuatorLeaseRouter.post("/:projectId/leases", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId } = req.params;
    const hasAccess = await verifyProjectAccess(projectId, orgId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    const validated = insertLeaseSchema.parse({ ...req.body, projectId });
    const [lease] = await db.insert(tenantLeases).values(normalizeForDb(validated)).returning();
    res.status(201).json(lease);
  } catch (error: any) {
    console.error("[ValuatorLeases] POST /:projectId/leases:", error);
    res.status(400).json({ error: error.message });
  }
});

valuatorLeaseRouter.patch("/:projectId/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId, leaseId } = req.params;
    const existing = await verifyLeaseAccess(leaseId, orgId);
    if (!existing) return res.status(404).json({ error: "Lease not found" });
    if (existing.projectId !== projectId) return res.status(404).json({ error: "Lease not found in this project" });
    const updateSchema = insertLeaseSchema.omit({ projectId: true }).partial();
    const validated = updateSchema.parse(req.body);
    const [updated] = await db.update(tenantLeases)
      .set({ ...normalizeForDb(validated), updatedAt: new Date() })
      .where(eq(tenantLeases.id, leaseId))
      .returning();
    res.json(updated);
  } catch (error: any) {
    console.error("[ValuatorLeases] PATCH /:projectId/leases/:leaseId:", error);
    res.status(400).json({ error: error.message });
  }
});

valuatorLeaseRouter.delete("/:projectId/leases/:leaseId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId, leaseId } = req.params;
    const existing = await verifyLeaseAccess(leaseId, orgId);
    if (!existing) return res.status(404).json({ error: "Lease not found" });
    if (existing.projectId !== projectId) return res.status(404).json({ error: "Lease not found in this project" });
    await db.delete(tenantLeases).where(eq(tenantLeases.id, leaseId));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

valuatorLeaseRouter.post("/:projectId/leases/:leaseId/duplicate", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { projectId, leaseId } = req.params;
    const existing = await verifyLeaseAccess(leaseId, orgId);
    if (!existing) return res.status(404).json({ error: "Lease not found" });
    if (existing.projectId !== projectId) return res.status(404).json({ error: "Lease not found in this project" });
    const newLease = await duplicateLease(leaseId, orgId);
    if (!newLease) return res.status(404).json({ error: "Lease not found" });
    res.status(201).json(newLease);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
