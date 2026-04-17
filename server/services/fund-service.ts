import Decimal from 'decimal.js';
import { db, pool } from '../db';
import {
  funds,
  fundInvestors,
  fundDealAllocations,
  fundCapitalMovements,
  fundCashFlows,
  fundCapitalStackTemplates,
  fundWaterfallCalculations,
  modelingProjects,
  returnsLedger,
  insertFundSchema,
  insertFundInvestorSchema,
  insertFundDealAllocationSchema,
  insertFundCapitalMovementSchema,
  insertFundCashFlowSchema,
  insertFundCapitalStackTemplateSchema,
  insertFundWaterfallCalculationSchema,
  type Fund,
  type FundInvestor,
  type FundDealAllocation,
  type FundCapitalMovement,
  type FundCashFlow,
  type FundCapitalStackTemplate,
  type FundWaterfallCalculation,
  type InsertFund,
  type InsertFundInvestor,
  type InsertFundDealAllocation,
  type InsertFundCapitalMovement,
  type InsertFundCashFlow,
  type InsertFundCapitalStackTemplate,
  type InsertFundWaterfallCalculation,
} from '@shared/schema';
import { eq, and, desc, asc, sql, gte, lte, inArray, sum } from 'drizzle-orm';
import { encrypt, isEncrypted } from './encryption-service';

/** Transaction-aware DB handle — either the root `db` or a `tx` from db.transaction() */
type DbOrTx = typeof db;

export interface FundMetrics {
  committedCapital: number;
  calledCapital: number;
  unfundedCommitments: number;
  distributedCapital: number;
  recycledCapital: number;
  dryPowder: number;
  deployedCapital: number;
  grossIrr: number | null;
  netIrr: number | null;
  grossMoic: number | null;
  netMoic: number | null;
  tvpi: number | null;
  dpi: number | null;
  rvpi: number | null;
  nav: number;
  dealCount: number;
  activeDeals: number;
  exitedDeals: number;
}

export interface FundWithDetails extends Fund {
  investors: FundInvestor[];
  allocations: (FundDealAllocation & { projectName?: string })[];
  metrics: FundMetrics;
}

export interface InvestorCapitalAccount {
  investorId: string;
  investorName: string;
  investorType: string;
  commitment: number;
  calledCapital: number;
  unfundedCommitment: number;
  distributions: number;
  preferredReturnAccrued: number;
  preferredReturnPaid: number;
  carriedInterestEarned: number;
  carriedInterestPaid: number;
  capitalAccountBalance: number;
  ownershipPct: number;
}

export interface WaterfallTierResult {
  tier: number;
  irrHurdle: number;
  amountAvailable: number;
  lpAmount: number;
  gpAmount: number;
}

export interface WaterfallDistributionResult {
  totalDistributable: number;
  returnOfCapital: number;
  preferredReturn: number;
  gpCatchUp: number;
  tiers: WaterfallTierResult[];
  totalLpDistribution: number;
  totalGpDistribution: number;
  effectiveLpSplit: number;
  effectiveGpSplit: number;
}

export interface XirrCashFlow {
  date: Date;
  amount: number;
}

/**
 * Convert a potentially null/undefined DB numeric field to a number using Decimal.js
 * for precision. DB stores numeric columns as strings; this replaces parseFloat
 * to avoid floating-point rounding errors in financial calculations.
 */
function d(value: any, fallback: string = '0'): Decimal {
  if (value == null) return new Decimal(fallback);
  const s = value.toString();
  if (!s || s === 'NaN' || s === 'null' || s === 'undefined') return new Decimal(fallback);
  try { return new Decimal(s); } catch { return new Decimal(fallback); }
}

/** Convert DB numeric to JS number via Decimal (precision-safe conversion) */
function dn(value: any, fallback: string = '0'): number {
  return d(value, fallback).toNumber();
}

export class FundService {
  // ============================================================================
  // FUND CRUD OPERATIONS
  // ============================================================================

  async createFund(
    orgId: string,
    userId: string,
    data: any
  ): Promise<Fund> {
    const transformedData = {
      ...data,
      orgId,
      createdBy: userId,
      targetSize: data.targetSize != null ? String(data.targetSize) : null,
      hardCap: data.hardCap != null ? String(data.hardCap) : null,
      committedCapital: data.committedCapital != null ? String(data.committedCapital) : '0',
      calledCapital: data.calledCapital != null ? String(data.calledCapital) : '0',
      distributedCapital: data.distributedCapital != null ? String(data.distributedCapital) : '0',
      recycledCapital: data.recycledCapital != null ? String(data.recycledCapital) : '0',
      managementFeePct: data.managementFeePct != null ? String(data.managementFeePct) : '0.02',
      carriedInterestPct: data.carriedInterestPct != null ? String(data.carriedInterestPct) : '0.20',
      preferredReturn: data.preferredReturn != null ? String(data.preferredReturn) : '0.08',
      gpCatchUpPct: data.gpCatchUpPct != null ? String(data.gpCatchUpPct) : '1.00',
      recyclingLimitPct: data.recyclingLimitPct != null ? String(data.recyclingLimitPct) : '0.25',
      maxSingleInvestmentPct: data.maxSingleInvestmentPct != null ? String(data.maxSingleInvestmentPct) : '0.20',
      minInvestmentSize: data.minInvestmentSize != null ? String(data.minInvestmentSize) : null,
      maxInvestmentSize: data.maxInvestmentSize != null ? String(data.maxInvestmentSize) : null,
    };

    const validated = insertFundSchema.parse(transformedData);

    const [result] = await db.insert(funds).values(validated).returning();

    return result;
  }

  async getFund(orgId: string, fundId: string): Promise<Fund | null> {
    const [result] = await db.select()
      .from(funds)
      .where(and(
        eq(funds.id, fundId),
        eq(funds.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  async getFundsByOrg(orgId: string): Promise<Fund[]> {
    return db.select()
      .from(funds)
      .where(eq(funds.orgId, orgId))
      .orderBy(desc(funds.vintage), desc(funds.createdAt));
  }

  async getFundWithDetails(orgId: string, fundId: string): Promise<FundWithDetails | null> {
    const fund = await this.getFund(orgId, fundId);
    if (!fund) return null;

    const [investors, allocationsRaw] = await Promise.all([
      this.getInvestorsByFund(orgId, fundId),
      db.select({
        allocation: fundDealAllocations,
        projectName: modelingProjects.marinaName,
      })
        .from(fundDealAllocations)
        .leftJoin(modelingProjects, eq(fundDealAllocations.modelingProjectId, modelingProjects.id))
        .where(and(
          eq(fundDealAllocations.fundId, fundId),
          eq(fundDealAllocations.orgId, orgId)
        ))
    ]);

    const allocations = allocationsRaw.map(r => ({
      ...r.allocation,
      projectName: r.projectName || undefined,
    }));

    const metrics = await this.calculateFundMetrics(orgId, fundId);

    return {
      ...fund,
      investors,
      allocations,
      metrics,
    };
  }

  async updateFund(
    orgId: string,
    fundId: string,
    data: Partial<InsertFund>
  ): Promise<Fund | null> {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    const numericFields = [
      'targetSize', 'hardCap', 'committedCapital', 'calledCapital',
      'distributedCapital', 'recycledCapital', 'managementFeePct',
      'carriedInterestPct', 'preferredReturn', 'gpCatchUpPct',
      'recyclingLimitPct', 'maxSingleInvestmentPct', 'minInvestmentSize',
      'maxInvestmentSize', 'grossIrr', 'netIrr', 'grossMoic', 'netMoic',
      'tvpi', 'dpi', 'rvpi', 'pme'
    ];

    for (const field of numericFields) {
      if (data[field as keyof typeof data] !== undefined) {
        updateData[field] = String(data[field as keyof typeof data]);
      }
    }

    const [result] = await db.update(funds)
      .set(updateData)
      .where(and(
        eq(funds.id, fundId),
        eq(funds.orgId, orgId)
      ))
      .returning();

    return result || null;
  }

  async deleteFund(orgId: string, fundId: string): Promise<boolean> {
    const result = await db.delete(funds)
      .where(and(
        eq(funds.id, fundId),
        eq(funds.orgId, orgId)
      ));

    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // FUND INVESTOR CRUD
  // ============================================================================

  async createInvestor(
    orgId: string,
    data: InsertFundInvestor
  ): Promise<FundInvestor> {
    const validated = insertFundInvestorSchema.parse(data);

    const [result] = await db.insert(fundInvestors).values({
      ...validated,
      orgId,
      // Encrypt PII before write. isEncrypted guards re-encryption of values
      // that came in already-encrypted (e.g., migrations, replays).
      taxId: validated.taxId && !isEncrypted(validated.taxId)
        ? encrypt(validated.taxId)
        : validated.taxId,
      commitmentAmount: String(validated.commitmentAmount),
      commitmentPct: validated.commitmentPct ? String(validated.commitmentPct) : null,
      calledCapital: validated.calledCapital ? String(validated.calledCapital) : '0',
      unfundedCommitment: validated.unfundedCommitment ? String(validated.unfundedCommitment) : String(validated.commitmentAmount),
      distributedCapital: validated.distributedCapital ? String(validated.distributedCapital) : '0',
      returnedCapital: validated.returnedCapital ? String(validated.returnedCapital) : '0',
      preferredReturnAccrued: validated.preferredReturnAccrued ? String(validated.preferredReturnAccrued) : '0',
      preferredReturnPaid: validated.preferredReturnPaid ? String(validated.preferredReturnPaid) : '0',
      capitalAccountBalance: validated.capitalAccountBalance ? String(validated.capitalAccountBalance) : '0',
      carriedInterestPct: validated.carriedInterestPct ? String(validated.carriedInterestPct) : null,
      carriedInterestEarned: validated.carriedInterestEarned ? String(validated.carriedInterestEarned) : '0',
      carriedInterestPaid: validated.carriedInterestPaid ? String(validated.carriedInterestPaid) : '0',
      feeDiscount: validated.feeDiscount ? String(validated.feeDiscount) : null,
    }).returning();

    await this.updateFundCommittedCapital(orgId, validated.fundId);

    return result;
  }

  async getInvestor(orgId: string, investorId: string): Promise<FundInvestor | null> {
    const [result] = await db.select()
      .from(fundInvestors)
      .where(and(
        eq(fundInvestors.id, investorId),
        eq(fundInvestors.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  async getInvestorsByFund(orgId: string, fundId: string): Promise<FundInvestor[]> {
    return db.select()
      .from(fundInvestors)
      .where(and(
        eq(fundInvestors.fundId, fundId),
        eq(fundInvestors.orgId, orgId),
        eq(fundInvestors.isActive, true)
      ))
      .orderBy(desc(fundInvestors.commitmentAmount));
  }

  async updateInvestor(
    orgId: string,
    investorId: string,
    data: Partial<InsertFundInvestor>
  ): Promise<FundInvestor | null> {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    // Encrypt taxId on update if a plaintext value was supplied. Keep existing
    // encrypted values unchanged (callers may round-trip the stored blob).
    if (typeof data.taxId === 'string' && data.taxId && !isEncrypted(data.taxId)) {
      updateData.taxId = encrypt(data.taxId);
    }

    const numericFields = [
      'commitmentAmount', 'commitmentPct', 'calledCapital', 'unfundedCommitment',
      'distributedCapital', 'returnedCapital', 'preferredReturnAccrued',
      'preferredReturnPaid', 'capitalAccountBalance', 'carriedInterestPct',
      'carriedInterestEarned', 'carriedInterestPaid', 'feeDiscount'
    ];

    for (const field of numericFields) {
      if (data[field as keyof typeof data] !== undefined) {
        updateData[field] = String(data[field as keyof typeof data]);
      }
    }

    const [result] = await db.update(fundInvestors)
      .set(updateData)
      .where(and(
        eq(fundInvestors.id, investorId),
        eq(fundInvestors.orgId, orgId)
      ))
      .returning();

    if (result) {
      await this.updateFundCommittedCapital(orgId, result.fundId);
    }

    return result || null;
  }

  async deleteInvestor(orgId: string, investorId: string): Promise<boolean> {
    const investor = await this.getInvestor(orgId, investorId);
    if (!investor) return false;

    const result = await db.delete(fundInvestors)
      .where(and(
        eq(fundInvestors.id, investorId),
        eq(fundInvestors.orgId, orgId)
      ));

    if ((result.rowCount ?? 0) > 0) {
      await this.updateFundCommittedCapital(orgId, investor.fundId);
    }

    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // FUND DEAL ALLOCATIONS
  // ============================================================================

  async createDealAllocation(
    orgId: string,
    data: InsertFundDealAllocation
  ): Promise<FundDealAllocation> {
    const validated = insertFundDealAllocationSchema.parse(data);

    const [result] = await db.insert(fundDealAllocations).values({
      ...validated,
      orgId,
      allocationPct: String(validated.allocationPct),
      allocatedEquity: String(validated.allocatedEquity),
      fundedAmount: validated.fundedAmount ? String(validated.fundedAmount) : '0',
      costBasis: validated.costBasis ? String(validated.costBasis) : null,
      currentValue: validated.currentValue ? String(validated.currentValue) : null,
      unrealizedGain: validated.unrealizedGain ? String(validated.unrealizedGain) : null,
      realizedGain: validated.realizedGain ? String(validated.realizedGain) : '0',
      dealIrr: validated.dealIrr ? String(validated.dealIrr) : null,
      dealMoic: validated.dealMoic ? String(validated.dealMoic) : null,
    }).returning();

    return result;
  }

  async getDealAllocation(orgId: string, allocationId: string): Promise<FundDealAllocation | null> {
    const [result] = await db.select()
      .from(fundDealAllocations)
      .where(and(
        eq(fundDealAllocations.id, allocationId),
        eq(fundDealAllocations.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  async getAllocationsByFund(orgId: string, fundId: string): Promise<FundDealAllocation[]> {
    return db.select()
      .from(fundDealAllocations)
      .where(and(
        eq(fundDealAllocations.fundId, fundId),
        eq(fundDealAllocations.orgId, orgId)
      ))
      .orderBy(desc(fundDealAllocations.investmentDate));
  }

  async getAllocationsByProject(
    orgId: string,
    modelingProjectId: string
  ): Promise<(FundDealAllocation & { fundName?: string })[]> {
    const results = await db.select({
      allocation: fundDealAllocations,
      fundName: funds.name,
    })
      .from(fundDealAllocations)
      .leftJoin(funds, eq(fundDealAllocations.fundId, funds.id))
      .where(and(
        eq(fundDealAllocations.modelingProjectId, modelingProjectId),
        eq(fundDealAllocations.orgId, orgId)
      ));

    return results.map(r => ({
      ...r.allocation,
      fundName: r.fundName || undefined,
    }));
  }

  async getAllocationByProject(
    orgId: string,
    modelingProjectId: string
  ): Promise<(FundDealAllocation & { fundName?: string }) | null> {
    const results = await db.select({
      allocation: fundDealAllocations,
      fundName: funds.name,
    })
      .from(fundDealAllocations)
      .leftJoin(funds, eq(fundDealAllocations.fundId, funds.id))
      .where(and(
        eq(fundDealAllocations.modelingProjectId, modelingProjectId),
        eq(fundDealAllocations.orgId, orgId)
      ))
      .limit(1);

    if (results.length === 0) return null;
    
    return {
      ...results[0].allocation,
      fundName: results[0].fundName || undefined,
    };
  }

  async updateDealAllocation(
    orgId: string,
    allocationId: string,
    data: Partial<InsertFundDealAllocation>
  ): Promise<FundDealAllocation | null> {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    const numericFields = [
      'allocationPct', 'allocatedEquity', 'fundedAmount', 'costBasis',
      'currentValue', 'unrealizedGain', 'realizedGain', 'dealIrr', 'dealMoic'
    ];

    for (const field of numericFields) {
      if (data[field as keyof typeof data] !== undefined) {
        updateData[field] = String(data[field as keyof typeof data]);
      }
    }

    const [result] = await db.update(fundDealAllocations)
      .set(updateData)
      .where(and(
        eq(fundDealAllocations.id, allocationId),
        eq(fundDealAllocations.orgId, orgId)
      ))
      .returning();

    return result || null;
  }

  async deleteDealAllocation(orgId: string, allocationId: string): Promise<boolean> {
    const result = await db.delete(fundDealAllocations)
      .where(and(
        eq(fundDealAllocations.id, allocationId),
        eq(fundDealAllocations.orgId, orgId)
      ));

    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // CAPITAL MOVEMENTS
  // ============================================================================

  async createCapitalMovement(
    orgId: string,
    userId: string,
    data: InsertFundCapitalMovement
  ): Promise<FundCapitalMovement> {
    const validated = insertFundCapitalMovementSchema.parse(data);

    const [result] = await db.insert(fundCapitalMovements).values({
      ...validated,
      orgId,
      createdBy: userId,
      amount: String(validated.amount),
      preferredReturn: validated.preferredReturn ? String(validated.preferredReturn) : '0',
      returnOfCapital: validated.returnOfCapital ? String(validated.returnOfCapital) : '0',
      carriedInterest: validated.carriedInterest ? String(validated.carriedInterest) : '0',
      recycledAmount: validated.recycledAmount ? String(validated.recycledAmount) : '0',
    }).returning();

    if (result.status === 'completed') {
      await this.processCapitalMovement(orgId, result);
    }

    return result;
  }

  async getCapitalMovement(orgId: string, movementId: string): Promise<FundCapitalMovement | null> {
    const [result] = await db.select()
      .from(fundCapitalMovements)
      .where(and(
        eq(fundCapitalMovements.id, movementId),
        eq(fundCapitalMovements.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  async getCapitalMovementsByFund(
    orgId: string,
    fundId: string,
    options?: { movementType?: string; startDate?: Date; endDate?: Date }
  ): Promise<FundCapitalMovement[]> {
    let query = db.select()
      .from(fundCapitalMovements)
      .where(and(
        eq(fundCapitalMovements.fundId, fundId),
        eq(fundCapitalMovements.orgId, orgId)
      ));

    return query.orderBy(desc(fundCapitalMovements.movementDate));
  }

  async updateCapitalMovement(
    orgId: string,
    movementId: string,
    data: Partial<InsertFundCapitalMovement>
  ): Promise<FundCapitalMovement | null> {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    const numericFields = ['amount', 'preferredReturn', 'returnOfCapital', 'carriedInterest', 'recycledAmount'];

    for (const field of numericFields) {
      if (data[field as keyof typeof data] !== undefined) {
        updateData[field] = String(data[field as keyof typeof data]);
      }
    }

    const [result] = await db.update(fundCapitalMovements)
      .set(updateData)
      .where(and(
        eq(fundCapitalMovements.id, movementId),
        eq(fundCapitalMovements.orgId, orgId)
      ))
      .returning();

    return result || null;
  }

  async deleteCapitalMovement(orgId: string, movementId: string): Promise<boolean> {
    const result = await db.delete(fundCapitalMovements)
      .where(and(
        eq(fundCapitalMovements.id, movementId),
        eq(fundCapitalMovements.orgId, orgId)
      ));

    return (result.rowCount ?? 0) > 0;
  }

  private async processCapitalMovement(orgId: string, movement: FundCapitalMovement): Promise<void> {
    const amount = dn(movement.amount);

    if (movement.movementType === 'call' || movement.movementType === 'contribution') {
      await this.updateFundCalledCapital(orgId, movement.fundId, amount);
      
      if (movement.fundInvestorId) {
        await this.updateInvestorCalledCapital(orgId, movement.fundInvestorId, amount);
      }
    } else if (movement.movementType === 'distribution' || movement.movementType === 'return_of_capital') {
      await this.updateFundDistributedCapital(orgId, movement.fundId, amount);
      
      if (movement.fundInvestorId) {
        await this.updateInvestorDistributedCapital(orgId, movement.fundInvestorId, amount);
      }
    } else if (movement.movementType === 'recycling') {
      await this.updateFundRecycledCapital(orgId, movement.fundId, amount);
    }
  }

  // ============================================================================
  // CASH FLOWS (for IRR calculation)
  // ============================================================================

  async createCashFlow(
    orgId: string,
    data: InsertFundCashFlow
  ): Promise<FundCashFlow> {
    const validated = insertFundCashFlowSchema.parse(data);

    const [result] = await db.insert(fundCashFlows).values({
      ...validated,
      orgId,
      grossAmount: String(validated.grossAmount),
      netAmount: String(validated.netAmount),
      investmentAmount: validated.investmentAmount ? String(validated.investmentAmount) : '0',
      managementFees: validated.managementFees ? String(validated.managementFees) : '0',
      expenses: validated.expenses ? String(validated.expenses) : '0',
      preferredReturn: validated.preferredReturn ? String(validated.preferredReturn) : '0',
      returnOfCapital: validated.returnOfCapital ? String(validated.returnOfCapital) : '0',
      gainDistribution: validated.gainDistribution ? String(validated.gainDistribution) : '0',
      carriedInterest: validated.carriedInterest ? String(validated.carriedInterest) : '0',
      cumulativeContributions: validated.cumulativeContributions ? String(validated.cumulativeContributions) : null,
      cumulativeDistributions: validated.cumulativeDistributions ? String(validated.cumulativeDistributions) : null,
      runningNav: validated.runningNav ? String(validated.runningNav) : null,
    }).returning();

    return result;
  }

  async getCashFlowsByFund(orgId: string, fundId: string): Promise<FundCashFlow[]> {
    return db.select()
      .from(fundCashFlows)
      .where(and(
        eq(fundCashFlows.fundId, fundId),
        eq(fundCashFlows.orgId, orgId)
      ))
      .orderBy(asc(fundCashFlows.flowDate));
  }

  // ============================================================================
  // CAPITAL STACK TEMPLATES
  // ============================================================================

  async createCapitalStackTemplate(
    orgId: string,
    userId: string,
    data: InsertFundCapitalStackTemplate
  ): Promise<FundCapitalStackTemplate> {
    const validated = insertFundCapitalStackTemplateSchema.parse(data);

    if (validated.isDefault && validated.fundId) {
      await db.update(fundCapitalStackTemplates)
        .set({ isDefault: false })
        .where(and(
          eq(fundCapitalStackTemplates.fundId, validated.fundId),
          eq(fundCapitalStackTemplates.orgId, orgId)
        ));
    }

    const [result] = await db.insert(fundCapitalStackTemplates).values({
      ...validated,
      orgId,
      createdBy: userId,
      targetLtv: validated.targetLtv ? String(validated.targetLtv) : '0.65',
      preferredReturn: validated.preferredReturn ? String(validated.preferredReturn) : '0.08',
      gpCatchUpPct: validated.gpCatchUpPct ? String(validated.gpCatchUpPct) : '1.00',
    }).returning();

    return result;
  }

  async getCapitalStackTemplate(
    orgId: string,
    templateId: string
  ): Promise<FundCapitalStackTemplate | null> {
    const [result] = await db.select()
      .from(fundCapitalStackTemplates)
      .where(and(
        eq(fundCapitalStackTemplates.id, templateId),
        eq(fundCapitalStackTemplates.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  async getTemplatesByFund(orgId: string, fundId: string): Promise<FundCapitalStackTemplate[]> {
    return db.select()
      .from(fundCapitalStackTemplates)
      .where(and(
        eq(fundCapitalStackTemplates.fundId, fundId),
        eq(fundCapitalStackTemplates.orgId, orgId)
      ))
      .orderBy(desc(fundCapitalStackTemplates.isDefault), asc(fundCapitalStackTemplates.name));
  }

  async updateCapitalStackTemplate(
    orgId: string,
    templateId: string,
    data: Partial<InsertFundCapitalStackTemplate>
  ): Promise<FundCapitalStackTemplate | null> {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    const numericFields = ['targetLtv', 'preferredReturn', 'gpCatchUpPct'];

    for (const field of numericFields) {
      if (data[field as keyof typeof data] !== undefined) {
        updateData[field] = String(data[field as keyof typeof data]);
      }
    }

    const [result] = await db.update(fundCapitalStackTemplates)
      .set(updateData)
      .where(and(
        eq(fundCapitalStackTemplates.id, templateId),
        eq(fundCapitalStackTemplates.orgId, orgId)
      ))
      .returning();

    return result || null;
  }

  async deleteCapitalStackTemplate(orgId: string, templateId: string): Promise<boolean> {
    const result = await db.delete(fundCapitalStackTemplates)
      .where(and(
        eq(fundCapitalStackTemplates.id, templateId),
        eq(fundCapitalStackTemplates.orgId, orgId)
      ));

    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // FUND METRICS CALCULATIONS
  // ============================================================================

  async calculateFundMetrics(orgId: string, fundId: string): Promise<FundMetrics> {
    const fund = await this.getFund(orgId, fundId);
    if (!fund) {
      return this.getEmptyMetrics();
    }

    const [investors, allocations] = await Promise.all([
      this.getInvestorsByFund(orgId, fundId),
      this.getAllocationsByFund(orgId, fundId),
    ]);

    const committedCapital = dn(fund.committedCapital);
    const calledCapital = dn(fund.calledCapital);
    const distributedCapital = dn(fund.distributedCapital);
    const recycledCapital = dn(fund.recycledCapital);

    const unfundedCommitments = investors.reduce((sum, inv) => {
      return sum + dn(inv.unfundedCommitment);
    }, 0);

    const deployedCapital = allocations.reduce((sum, alloc) => {
      return sum + dn(alloc.fundedAmount);
    }, 0);

    const dryPowder = calledCapital - deployedCapital + recycledCapital;

    let nav = 0;
    for (const alloc of allocations) {
      if (alloc.exitStatus !== 'exited' && alloc.exitStatus !== 'written_off') {
        nav += dn(alloc.currentValue ?? alloc.fundedAmount);
      }
    }

    const activeDeals = allocations.filter(a => a.exitStatus === 'active').length;
    const exitedDeals = allocations.filter(a => a.exitStatus === 'exited').length;

    const tvpi = calledCapital > 0 ? (distributedCapital + nav) / calledCapital : null;
    const dpi = calledCapital > 0 ? distributedCapital / calledCapital : null;
    const rvpi = calledCapital > 0 ? nav / calledCapital : null;

    const cashFlows = await this.getCashFlowsByFund(orgId, fundId);
    let grossIrr: number | null = null;
    let netIrr: number | null = null;

    if (cashFlows.length > 1) {
      const xirrFlows: XirrCashFlow[] = cashFlows.map(cf => ({
        date: new Date(cf.flowDate),
        amount: dn(cf.grossAmount),
      }));
      
      if (nav > 0) {
        xirrFlows.push({ date: new Date(), amount: nav });
      }

      grossIrr = this.calculateXirr(xirrFlows);

      const netFlows: XirrCashFlow[] = cashFlows.map(cf => ({
        date: new Date(cf.flowDate),
        amount: dn(cf.netAmount),
      }));
      
      if (nav > 0) {
        netFlows.push({ date: new Date(), amount: nav });
      }

      netIrr = this.calculateXirr(netFlows);
    }

    const grossMoic = calledCapital > 0 ? (distributedCapital + nav) / calledCapital : null;
    const netMoic = grossMoic; // Simplified; would subtract fees for accurate net

    return {
      committedCapital,
      calledCapital,
      unfundedCommitments,
      distributedCapital,
      recycledCapital,
      dryPowder,
      deployedCapital,
      grossIrr,
      netIrr,
      grossMoic,
      netMoic,
      tvpi,
      dpi,
      rvpi,
      nav,
      dealCount: allocations.length,
      activeDeals,
      exitedDeals,
    };
  }

  private getEmptyMetrics(): FundMetrics {
    return {
      committedCapital: 0,
      calledCapital: 0,
      unfundedCommitments: 0,
      distributedCapital: 0,
      recycledCapital: 0,
      dryPowder: 0,
      deployedCapital: 0,
      grossIrr: null,
      netIrr: null,
      grossMoic: null,
      netMoic: null,
      tvpi: null,
      dpi: null,
      rvpi: null,
      nav: 0,
      dealCount: 0,
      activeDeals: 0,
      exitedDeals: 0,
    };
  }

  // ============================================================================
  // XIRR CALCULATION (Extended IRR with dates)
  // ============================================================================

  calculateXirr(
    cashFlows: XirrCashFlow[],
    guess: number = 0.1,
    maxIterations: number = 100,
    tolerance: number = 0.0001
  ): number | null {
    if (cashFlows.length < 2) return null;

    const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstDate = sorted[0].date;

    const daysFraction = (date: Date): number => {
      const diffMs = date.getTime() - firstDate.getTime();
      return diffMs / (365.25 * 24 * 60 * 60 * 1000);
    };

    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivativeNpv = 0;

      for (const cf of sorted) {
        const t = daysFraction(cf.date);
        const discountFactor = Math.pow(1 + rate, t);
        npv += cf.amount / discountFactor;
        if (t > 0) {
          derivativeNpv -= (t * cf.amount) / Math.pow(1 + rate, t + 1);
        }
      }

      if (Math.abs(npv) < tolerance) {
        return Math.round(rate * 10000) / 10000;
      }

      if (derivativeNpv === 0) {
        return null;
      }

      const newRate = rate - npv / derivativeNpv;

      if (Math.abs(newRate - rate) < tolerance) {
        return Math.round(newRate * 10000) / 10000;
      }

      rate = newRate;

      if (rate < -0.99 || rate > 10) {
        return null;
      }
    }

    return null;
  }

  // ============================================================================
  // WATERFALL DISTRIBUTION CALCULATION
  // ============================================================================

  calculateWaterfallDistribution(
    totalDistributable: number,
    calledCapital: number,
    preferredReturnRate: number,
    gpCatchUpPct: number,
    promoteTiers: { irrHurdle: number; gpSplit: number; lpSplit: number }[],
    yearsHeld: number = 1
  ): WaterfallDistributionResult {
    let remaining = totalDistributable;
    let lpDistribution = 0;
    let gpDistribution = 0;

    const returnOfCapital = Math.min(remaining, calledCapital);
    remaining -= returnOfCapital;
    lpDistribution += returnOfCapital;

    const preferredReturnAmount = calledCapital * preferredReturnRate * yearsHeld;
    const prefPaid = Math.min(remaining, preferredReturnAmount);
    remaining -= prefPaid;
    lpDistribution += prefPaid;

    let gpCatchUp = 0;
    if (gpCatchUpPct > 0 && remaining > 0 && promoteTiers.length > 0) {
      const firstTierGpSplit = promoteTiers[0].gpSplit / 100;
      const catchUpTarget = lpDistribution * (firstTierGpSplit / (1 - firstTierGpSplit));
      const catchUpAmount = Math.min(remaining, catchUpTarget * gpCatchUpPct);
      gpCatchUp = catchUpAmount;
      gpDistribution += catchUpAmount;
      remaining -= catchUpAmount;
    }

    const tiers: WaterfallTierResult[] = [];

    for (let i = 0; i < promoteTiers.length && remaining > 0; i++) {
      const tier = promoteTiers[i];
      const gpSplit = tier.gpSplit / 100;
      const lpSplit = tier.lpSplit / 100;

      let tierAmount = remaining;
      if (i < promoteTiers.length - 1) {
        const nextHurdle = promoteTiers[i + 1].irrHurdle;
        const currentHurdle = tier.irrHurdle;
        tierAmount = Math.min(remaining, calledCapital * (nextHurdle - currentHurdle) * yearsHeld);
      }

      const lpAmount = tierAmount * lpSplit;
      const gpAmount = tierAmount * gpSplit;

      tiers.push({
        tier: i + 1,
        irrHurdle: tier.irrHurdle,
        amountAvailable: tierAmount,
        lpAmount,
        gpAmount,
      });

      lpDistribution += lpAmount;
      gpDistribution += gpAmount;
      remaining -= tierAmount;
    }

    const totalDist = lpDistribution + gpDistribution;
    const effectiveLpSplit = totalDist > 0 ? lpDistribution / totalDist : 0;
    const effectiveGpSplit = totalDist > 0 ? gpDistribution / totalDist : 0;

    return {
      totalDistributable,
      returnOfCapital,
      preferredReturn: prefPaid,
      gpCatchUp,
      tiers,
      totalLpDistribution: Math.round(lpDistribution * 100) / 100,
      totalGpDistribution: Math.round(gpDistribution * 100) / 100,
      effectiveLpSplit: Math.round(effectiveLpSplit * 10000) / 100,
      effectiveGpSplit: Math.round(effectiveGpSplit * 10000) / 100,
    };
  }

  async storeWaterfallCalculation(
    orgId: string,
    fundId: string,
    result: WaterfallDistributionResult,
    metrics: FundMetrics,
    txn?: DbOrTx
  ): Promise<FundWaterfallCalculation> {
    const d = txn || db;
    await d.update(fundWaterfallCalculations)
      .set({ isLatest: false })
      .where(and(
        eq(fundWaterfallCalculations.fundId, fundId),
        eq(fundWaterfallCalculations.isLatest, true)
      ));

    const [saved] = await d.insert(fundWaterfallCalculations).values({
      orgId,
      fundId,
      calculationDate: new Date(),
      periodEnd: new Date(),
      totalContributions: String(metrics.calledCapital),
      totalDistributions: String(metrics.distributedCapital),
      unrealizedValue: String(metrics.nav),
      totalValue: String(metrics.distributedCapital + metrics.nav),
      returnOfCapital: String(result.returnOfCapital),
      preferredReturnAmount: String(result.preferredReturn),
      gpCatchUp: String(result.gpCatchUp),
      promoteTierBreakdown: result.tiers,
      totalLpDistribution: String(result.totalLpDistribution),
      totalGpDistribution: String(result.totalGpDistribution),
      grossIrr: metrics.grossIrr ? String(metrics.grossIrr) : null,
      netIrr: metrics.netIrr ? String(metrics.netIrr) : null,
      tvpi: metrics.tvpi ? String(metrics.tvpi) : null,
      dpi: metrics.dpi ? String(metrics.dpi) : null,
      rvpi: metrics.rvpi ? String(metrics.rvpi) : null,
      isLatest: true,
    }).returning();

    return saved;
  }

  async getLatestWaterfallCalculation(
    orgId: string,
    fundId: string
  ): Promise<FundWaterfallCalculation | null> {
    const [result] = await db.select()
      .from(fundWaterfallCalculations)
      .where(and(
        eq(fundWaterfallCalculations.fundId, fundId),
        eq(fundWaterfallCalculations.orgId, orgId),
        eq(fundWaterfallCalculations.isLatest, true)
      ))
      .limit(1);

    return result || null;
  }

  async getWaterfallHistory(
    orgId: string,
    fundId: string
  ): Promise<FundWaterfallCalculation[]> {
    return db.select()
      .from(fundWaterfallCalculations)
      .where(and(
        eq(fundWaterfallCalculations.fundId, fundId),
        eq(fundWaterfallCalculations.orgId, orgId)
      ))
      .orderBy(desc(fundWaterfallCalculations.calculationDate));
  }

  // ============================================================================
  // INVESTOR CAPITAL ACCOUNTS
  // ============================================================================

  async getInvestorCapitalAccounts(
    orgId: string,
    fundId: string
  ): Promise<InvestorCapitalAccount[]> {
    const investors = await this.getInvestorsByFund(orgId, fundId);
    const fund = await this.getFund(orgId, fundId);
    
    const totalCommitment = investors.reduce(
      (sum, inv) => sum + dn(inv.commitmentAmount),
      0
    );

    return investors.map(inv => {
      const commitment = dn(inv.commitmentAmount);
      return {
        investorId: inv.id,
        investorName: inv.investorName,
        investorType: inv.investorType,
        commitment,
        calledCapital: dn(inv.calledCapital),
        unfundedCommitment: dn(inv.unfundedCommitment ?? commitment),
        distributions: dn(inv.distributedCapital),
        preferredReturnAccrued: dn(inv.preferredReturnAccrued),
        preferredReturnPaid: dn(inv.preferredReturnPaid),
        carriedInterestEarned: dn(inv.carriedInterestEarned),
        carriedInterestPaid: dn(inv.carriedInterestPaid),
        capitalAccountBalance: dn(inv.capitalAccountBalance),
        ownershipPct: totalCommitment > 0 ? (commitment / totalCommitment) * 100 : 0,
      };
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async updateFundCommittedCapital(orgId: string, fundId: string): Promise<void> {
    const investors = await this.getInvestorsByFund(orgId, fundId);
    const totalCommitted = investors.reduce(
      (sum, inv) => sum + dn(inv.commitmentAmount),
      0
    );

    await db.update(funds)
      .set({
        committedCapital: String(totalCommitted),
        updatedAt: new Date(),
      })
      .where(eq(funds.id, fundId));
  }

  private async updateFundCalledCapital(
    orgId: string,
    fundId: string,
    additionalAmount: number,
    txn?: DbOrTx
  ): Promise<void> {
    const d = txn || db;
    const fund = await this.getFund(orgId, fundId);
    if (!fund) return;

    const current = dn(fund.calledCapital);
    await d.update(funds)
      .set({
        calledCapital: String(current + additionalAmount),
        updatedAt: new Date(),
      })
      .where(eq(funds.id, fundId));
  }

  private async updateFundDistributedCapital(
    orgId: string,
    fundId: string,
    additionalAmount: number,
    txn?: DbOrTx
  ): Promise<void> {
    const d = txn || db;
    const fund = await this.getFund(orgId, fundId);
    if (!fund) return;

    const current = dn(fund.distributedCapital);
    await d.update(funds)
      .set({
        distributedCapital: String(current + additionalAmount),
        updatedAt: new Date(),
      })
      .where(eq(funds.id, fundId));
  }

  private async updateFundRecycledCapital(
    orgId: string,
    fundId: string,
    additionalAmount: number
  ): Promise<void> {
    const fund = await this.getFund(orgId, fundId);
    if (!fund) return;

    const current = dn(fund.recycledCapital);
    await db.update(funds)
      .set({
        recycledCapital: String(current + additionalAmount),
        updatedAt: new Date(),
      })
      .where(eq(funds.id, fundId));
  }

  private async updateInvestorCalledCapital(
    orgId: string,
    investorId: string,
    additionalAmount: number,
    txn?: DbOrTx
  ): Promise<void> {
    const d = txn || db;
    const investor = await this.getInvestor(orgId, investorId);
    if (!investor) return;

    const currentCalled = dn(investor.calledCapital);
    const commitment = dn(investor.commitmentAmount);

    await d.update(fundInvestors)
      .set({
        calledCapital: String(currentCalled + additionalAmount),
        unfundedCommitment: String(commitment - (currentCalled + additionalAmount)),
        capitalAccountBalance: String(currentCalled + additionalAmount),
        updatedAt: new Date(),
      })
      .where(eq(fundInvestors.id, investorId));
  }

  private async updateInvestorDistributedCapital(
    orgId: string,
    investorId: string,
    additionalAmount: number,
    txn?: DbOrTx
  ): Promise<void> {
    const d = txn || db;
    const investor = await this.getInvestor(orgId, investorId);
    if (!investor) return;

    const currentDistributed = dn(investor.distributedCapital);
    const currentBalance = dn(investor.capitalAccountBalance);

    await d.update(fundInvestors)
      .set({
        distributedCapital: String(currentDistributed + additionalAmount),
        capitalAccountBalance: String(currentBalance - additionalAmount),
        updatedAt: new Date(),
      })
      .where(eq(fundInvestors.id, investorId));
  }

  // ============================================================================
  // PREFERRED RETURN ACCRUAL
  // ============================================================================

  /**
   * Accrue preferred return for all active investors in a fund.
   * Supports simple, annual compounding, quarterly compounding, and continuous compounding.
   * Creates capital account entries and updates investor records.
   */
  async accruePreferredReturn(
    orgId: string,
    fundId: string,
    options: {
      asOfDate?: Date;
      compoundingMethod?: 'simple' | 'annual' | 'quarterly' | 'continuous';
      periodMonths?: number; // defaults to 3 (quarterly)
    } = {}
  ): Promise<{
    investorsAccrued: number;
    totalAccrued: number;
    details: { investorId: string; investorName: string; accrualAmount: number; newAccruedBalance: number }[];
  }> {
    return await db.transaction(async (tx) => {
      const fund = await this.getFund(orgId, fundId);
      if (!fund) throw new Error('Fund not found');

      const investors = await this.getInvestorsByFund(orgId, fundId);
      const prefRate = dn(fund.preferredReturn, '0.08');
      const compounding = options.compoundingMethod || 'simple';
      const periodMonths = options.periodMonths || 3;
      const periodFraction = periodMonths / 12;
      const asOfDate = options.asOfDate || new Date();

      const details: { investorId: string; investorName: string; accrualAmount: number; newAccruedBalance: number }[] = [];
      let totalAccrued = 0;

      for (const investor of investors) {
        if (!investor.isActive) continue;

        const calledCapital = dn(investor.calledCapital);
        const distributedCapital = dn(investor.distributedCapital);
        const returnedCapital = dn(investor.returnedCapital);
        const currentAccrued = dn(investor.preferredReturnAccrued);
        const currentPaid = dn(investor.preferredReturnPaid);

        // Unreturned capital basis for preferred return calculation
        const unreturnedCapital = calledCapital - returnedCapital;
        if (unreturnedCapital <= 0) continue;

        // Include unpaid accrued pref in compounding base
        const unpaidPref = currentAccrued - currentPaid;

        let accrualAmount: number;

        switch (compounding) {
          case 'annual':
            // Compound annually: accrual on (unreturned capital + unpaid pref) for the period
            accrualAmount = (unreturnedCapital + unpaidPref) * prefRate * periodFraction;
            break;
          case 'quarterly':
            // Compound quarterly: (1 + r/4)^periods - 1 applied to base
            accrualAmount = (unreturnedCapital + unpaidPref) * (Math.pow(1 + prefRate / 4, periodMonths / 3) - 1);
            break;
          case 'continuous':
            // Continuous compounding: e^(rt) - 1 applied to base
            accrualAmount = (unreturnedCapital + unpaidPref) * (Math.exp(prefRate * periodFraction) - 1);
            break;
          default: // simple
            accrualAmount = unreturnedCapital * prefRate * periodFraction;
            break;
        }

        accrualAmount = Math.round(accrualAmount * 100) / 100;
        if (accrualAmount <= 0) continue;

        const newAccruedBalance = currentAccrued + accrualAmount;

        // Update investor record
        await tx.update(fundInvestors)
          .set({
            preferredReturnAccrued: String(newAccruedBalance),
            updatedAt: new Date(),
          })
          .where(eq(fundInvestors.id, investor.id));

        details.push({
          investorId: investor.id,
          investorName: investor.investorName,
          accrualAmount,
          newAccruedBalance,
        });

        totalAccrued += accrualAmount;
      }

      // Record as capital movement for the fund
      if (totalAccrued > 0) {
        await tx.insert(fundCapitalMovements).values({
          orgId,
          fundId,
          movementType: 'fee',
          movementDate: asOfDate,
          amount: String(totalAccrued),
          preferredReturn: String(totalAccrued),
          status: 'completed',
          description: `Preferred return accrual (${compounding}) for ${periodMonths}-month period ending ${asOfDate.toISOString().split('T')[0]}`,
          createdBy: null,
        });
      }

      return {
        investorsAccrued: details.length,
        totalAccrued: Math.round(totalAccrued * 100) / 100,
        details,
      };
    });
  }

  // ============================================================================
  // NAV CALCULATION PIPELINE
  // ============================================================================

  /**
   * Calculate fund NAV by aggregating deal-level valuations.
   * NAV = Sum of active deal current values + cash reserves - outstanding liabilities.
   * Updates fund record and returns per-investor NAV allocation.
   */
  async calculateFundNav(
    orgId: string,
    fundId: string,
    options: {
      asOfDate?: Date;
      cashOnHand?: number;
      outstandingLiabilities?: number;
    } = {}
  ): Promise<{
    totalNav: number;
    grossAssetValue: number;
    cashOnHand: number;
    outstandingLiabilities: number;
    dealBreakdown: { allocationId: string; projectName?: string; currentValue: number; costBasis: number; unrealizedGain: number }[];
    investorAllocations: { investorId: string; investorName: string; ownershipPct: number; navAllocation: number; navPerUnit: number }[];
  }> {
    const fund = await this.getFund(orgId, fundId);
    if (!fund) throw new Error('Fund not found');

    const allocations = await this.getAllocationsByFund(orgId, fundId);
    const investors = await this.getInvestorsByFund(orgId, fundId);

    const cashOnHand = options.cashOnHand || 0;
    const outstandingLiabilities = options.outstandingLiabilities || 0;

    // Aggregate deal-level values
    const dealBreakdown: { allocationId: string; projectName?: string; currentValue: number; costBasis: number; unrealizedGain: number }[] = [];
    let grossAssetValue = 0;

    for (const alloc of allocations) {
      if (alloc.exitStatus === 'exited' || alloc.exitStatus === 'written_off') continue;

      const currentValue = dn(alloc.currentValue ?? alloc.fundedAmount);
      const costBasis = dn(alloc.costBasis ?? alloc.fundedAmount);
      const unrealizedGain = currentValue - costBasis;

      grossAssetValue += currentValue;

      // Fetch project name
      let projectName: string | undefined;
      if (alloc.modelingProjectId) {
        const [project] = await db.select({ name: modelingProjects.marinaName })
          .from(modelingProjects)
          .where(eq(modelingProjects.id, alloc.modelingProjectId))
          .limit(1);
        projectName = project?.name || undefined;
      }

      dealBreakdown.push({
        allocationId: alloc.id,
        projectName,
        currentValue: Math.round(currentValue * 100) / 100,
        costBasis: Math.round(costBasis * 100) / 100,
        unrealizedGain: Math.round(unrealizedGain * 100) / 100,
      });
    }

    const totalNav = grossAssetValue + cashOnHand - outstandingLiabilities;

    // Calculate per-investor allocation
    const totalCommitment = investors.reduce(
      (sum, inv) => sum + dn(inv.commitmentAmount),
      0
    );

    const investorAllocations = investors.map(inv => {
      const commitment = dn(inv.commitmentAmount);
      const ownershipPct = totalCommitment > 0 ? (commitment / totalCommitment) * 100 : 0;
      const navAllocation = totalNav * (ownershipPct / 100);

      return {
        investorId: inv.id,
        investorName: inv.investorName,
        ownershipPct: Math.round(ownershipPct * 100) / 100,
        navAllocation: Math.round(navAllocation * 100) / 100,
        navPerUnit: commitment > 0 ? Math.round((navAllocation / commitment) * 10000) / 10000 : 0,
      };
    });

    // Persist to fund record
    await db.update(funds)
      .set({ updatedAt: new Date() })
      .where(eq(funds.id, fundId));

    // Store as cash flow entry for the NAV snapshot
    await db.insert(fundCashFlows).values({
      orgId,
      fundId,
      flowDate: options.asOfDate || new Date(),
      flowType: 'inflow',
      grossAmount: '0',
      netAmount: '0',
      runningNav: String(Math.round(totalNav * 100) / 100),
      description: `NAV snapshot: $${(totalNav / 1_000_000).toFixed(2)}M`,
    });

    return {
      totalNav: Math.round(totalNav * 100) / 100,
      grossAssetValue: Math.round(grossAssetValue * 100) / 100,
      cashOnHand,
      outstandingLiabilities,
      dealBreakdown,
      investorAllocations,
    };
  }

  // ============================================================================
  // FUND-LEVEL CAPITAL CALLS
  // ============================================================================

  /**
   * Create a fund-level capital call and automatically generate per-investor line items
   * based on each investor's commitment percentage.
   */
  async createFundCapitalCall(
    orgId: string,
    userId: string,
    fundId: string,
    data: {
      totalAmount: number;
      purpose: string;
      dueDate: string;
      callNumber?: number;
      notes?: string;
      dealAllocationId?: string;
    }
  ): Promise<{
    capitalCall: FundCapitalMovement;
    investorLineItems: {
      investorId: string;
      investorName: string;
      commitmentPct: number;
      amountCalled: number;
      unfundedBefore: number;
      unfundedAfter: number;
    }[];
    totalAllocated: number;
  }> {
    return await db.transaction(async (tx) => {
      const fund = await this.getFund(orgId, fundId);
      if (!fund) throw new Error('Fund not found');

      const investors = await this.getInvestorsByFund(orgId, fundId);
      if (investors.length === 0) throw new Error('No active investors in fund');

      const totalCommitment = investors.reduce(
        (sum, inv) => sum + dn(inv.commitmentAmount),
        0
      );

      // Validate call doesn't exceed unfunded commitments
      const totalUnfunded = investors.reduce(
        (sum, inv) => sum + dn(inv.unfundedCommitment),
        0
      );

      if (data.totalAmount > totalUnfunded) {
        throw new Error(`Capital call of $${data.totalAmount.toLocaleString()} exceeds total unfunded commitments of $${totalUnfunded.toLocaleString()}`);
      }

      // Determine call number
      const existingMovements = await this.getCapitalMovementsByFund(orgId, fundId);
      const callCount = existingMovements.filter(m => m.movementType === 'call').length;
      const callNumber = data.callNumber || callCount + 1;

      // Create the fund-level capital movement
      const [capitalCall] = await tx.insert(fundCapitalMovements).values({
        orgId,
        fundId,
        movementType: 'call',
        movementDate: new Date(),
        dueDate: new Date(data.dueDate),
        amount: String(data.totalAmount),
        callNumber,
        callPurpose: data.purpose as any,
        dealAllocationId: data.dealAllocationId || null,
        status: 'pending',
        description: data.notes || `Capital call #${callNumber}: ${data.purpose}`,
        createdBy: userId,
      }).returning();

      // Generate per-investor line items
      const investorLineItems: {
        investorId: string;
        investorName: string;
        commitmentPct: number;
        amountCalled: number;
        unfundedBefore: number;
        unfundedAfter: number;
      }[] = [];

      let totalAllocated = 0;

      for (const investor of investors) {
        const commitment = dn(investor.commitmentAmount);
        const commitmentPct = totalCommitment > 0 ? commitment / totalCommitment : 0;
        const unfundedBefore = dn(investor.unfundedCommitment);

        // Calculate pro-rata share, but cap at investor's unfunded commitment
        let amountCalled = Math.round(data.totalAmount * commitmentPct * 100) / 100;
        amountCalled = Math.min(amountCalled, unfundedBefore);

        if (amountCalled <= 0) continue;

        const unfundedAfter = unfundedBefore - amountCalled;

        // Create per-investor capital movement
        await tx.insert(fundCapitalMovements).values({
          orgId,
          fundId,
          fundInvestorId: investor.id,
          movementType: 'call',
          movementDate: new Date(),
          dueDate: new Date(data.dueDate),
          amount: String(amountCalled),
          callNumber,
          callPurpose: data.purpose as any,
          status: 'pending',
          description: `Capital call #${callNumber} - ${investor.investorName}`,
          createdBy: userId,
        });

        investorLineItems.push({
          investorId: investor.id,
          investorName: investor.investorName,
          commitmentPct: Math.round(commitmentPct * 10000) / 100,
          amountCalled,
          unfundedBefore,
          unfundedAfter,
        });

        totalAllocated += amountCalled;
      }

      return {
        capitalCall,
        investorLineItems,
        totalAllocated: Math.round(totalAllocated * 100) / 100,
      };
    });
  }

  /**
   * Mark a fund capital call as completed (all payments received).
   * Updates investor balances and fund totals.
   */
  async completeFundCapitalCall(
    orgId: string,
    fundId: string,
    callNumber: number
  ): Promise<{
    investorsUpdated: number;
    totalReceived: number;
  }> {
    return await db.transaction(async (tx) => {
      const fund = await this.getFund(orgId, fundId);
      if (!fund) throw new Error('Fund not found');

      // Find all movements for this call
      const movements = await tx.select()
        .from(fundCapitalMovements)
        .where(and(
          eq(fundCapitalMovements.fundId, fundId),
          eq(fundCapitalMovements.orgId, orgId),
          eq(fundCapitalMovements.callNumber, callNumber),
          eq(fundCapitalMovements.movementType, 'call'),
        ));

      let investorsUpdated = 0;
      let totalReceived = 0;

      for (const movement of movements) {
        if (movement.status === 'completed') continue;

        // Mark movement as completed
        await tx.update(fundCapitalMovements)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(fundCapitalMovements.id, movement.id));

        const amount = dn(movement.amount);

        // Update investor balances if investor-specific
        if (movement.fundInvestorId) {
          await this.updateInvestorCalledCapital(orgId, movement.fundInvestorId, amount, tx);
          investorsUpdated++;
        }

        totalReceived += amount;
      }

      // Update fund-level called capital
      if (totalReceived > 0) {
        await this.updateFundCalledCapital(orgId, fundId, totalReceived, tx);

        // Create cash flow entry
        await tx.insert(fundCashFlows).values({
          orgId,
          fundId,
          flowDate: new Date(),
          flowType: 'inflow',
          grossAmount: String(totalReceived),
          netAmount: String(totalReceived),
          investmentAmount: String(totalReceived),
          description: `Capital call #${callNumber} completed: $${totalReceived.toLocaleString()}`,
        });
      }

      return { investorsUpdated, totalReceived: Math.round(totalReceived * 100) / 100 };
    });
  }

  // ============================================================================
  // DISTRIBUTION WORKFLOW (with Waterfall)
  // ============================================================================

  /**
   * Create a fund distribution, run the waterfall, and allocate to investors.
   * Full workflow: calculate waterfall → allocate to LPs/GP → create movements → update accounts.
   */
  async processFundDistribution(
    orgId: string,
    userId: string,
    fundId: string,
    data: {
      totalProceeds: number;
      distributionType: 'operating' | 'return_of_capital' | 'capital_gain' | 'refinance' | 'exit';
      dealAllocationId?: string;
      notes?: string;
      yearsHeld?: number;
    }
  ): Promise<{
    waterfallResult: WaterfallDistributionResult;
    investorDistributions: {
      investorId: string;
      investorName: string;
      ownershipPct: number;
      returnOfCapital: number;
      preferredReturn: number;
      profitShare: number;
      carriedInterest: number;
      totalDistribution: number;
    }[];
    totalDistributed: number;
    gpCarry: number;
  }> {
    return await db.transaction(async (tx) => {
      const fund = await this.getFund(orgId, fundId);
      if (!fund) throw new Error('Fund not found');

      const investors = await this.getInvestorsByFund(orgId, fundId);
      const metrics = await this.calculateFundMetrics(orgId, fundId);

      // Run waterfall
      const yearsHeld = data.yearsHeld || (fund.investmentPeriodYears || 5);
      const waterfallResult = this.calculateWaterfallDistribution(
        data.totalProceeds,
        metrics.calledCapital,
        dn(fund.preferredReturn, '0.08'),
        dn(fund.gpCatchUpPct, '1.00'),
        fund.promoteTiers || [{ irrHurdle: 0.08, gpSplit: 20, lpSplit: 80 }],
        yearsHeld
      );

      // Store waterfall calculation
      await this.storeWaterfallCalculation(orgId, fundId, waterfallResult, metrics, tx);

      // Calculate ownership percentages
      const totalCommitment = investors.reduce(
        (sum, inv) => sum + dn(inv.commitmentAmount),
        0
      );

      const investorDistributions: {
        investorId: string;
        investorName: string;
        ownershipPct: number;
        returnOfCapital: number;
        preferredReturn: number;
        profitShare: number;
        carriedInterest: number;
        totalDistribution: number;
      }[] = [];

      let totalDistributed = 0;

      for (const investor of investors) {
        const commitment = dn(investor.commitmentAmount);
        const ownershipPct = totalCommitment > 0 ? commitment / totalCommitment : 0;
        const isGp = investor.investorType === 'gp';

        // LP gets pro-rata share of LP distributions
        // GP gets their carry plus pro-rata share of any GP commitment returns
        let returnOfCapital: number;
        let preferredReturn: number;
        let profitShare: number;
        let carriedInterest: number;

        if (isGp) {
          returnOfCapital = waterfallResult.returnOfCapital * ownershipPct;
          preferredReturn = waterfallResult.preferredReturn * ownershipPct;
          carriedInterest = waterfallResult.totalGpDistribution - (waterfallResult.returnOfCapital * ownershipPct);
          profitShare = 0;
        } else {
          returnOfCapital = waterfallResult.returnOfCapital * ownershipPct;
          preferredReturn = waterfallResult.preferredReturn * ownershipPct;

          // LP profit share is their pro-rata of remaining LP distributions after ROC and pref
          const lpRemainder = waterfallResult.totalLpDistribution - waterfallResult.returnOfCapital - waterfallResult.preferredReturn;
          profitShare = lpRemainder > 0 ? lpRemainder * ownershipPct : 0;
          carriedInterest = 0;
        }

        const totalDistribution = Math.round((returnOfCapital + preferredReturn + profitShare + carriedInterest) * 100) / 100;

        // Create distribution capital movement for this investor
        await tx.insert(fundCapitalMovements).values({
          orgId,
          fundId,
          fundInvestorId: investor.id,
          movementType: 'distribution',
          movementDate: new Date(),
          amount: String(totalDistribution),
          returnOfCapital: String(Math.round(returnOfCapital * 100) / 100),
          preferredReturn: String(Math.round(preferredReturn * 100) / 100),
          carriedInterest: String(Math.round(carriedInterest * 100) / 100),
          dealAllocationId: data.dealAllocationId || null,
          status: 'completed',
          description: `${data.distributionType} distribution - ${investor.investorName}`,
          createdBy: userId,
        });

        // Update investor balances
        await this.updateInvestorDistributedCapital(orgId, investor.id, totalDistribution, tx);

        // Update preferred return paid
        if (preferredReturn > 0) {
          const currentPrefPaid = dn(investor.preferredReturnPaid);
          await tx.update(fundInvestors)
            .set({
              preferredReturnPaid: String(currentPrefPaid + preferredReturn),
              updatedAt: new Date(),
            })
            .where(eq(fundInvestors.id, investor.id));
        }

        // Update carried interest paid (GP only)
        if (carriedInterest > 0 && isGp) {
          const currentCarryPaid = dn(investor.carriedInterestPaid);
          const currentCarryEarned = dn(investor.carriedInterestEarned);
          await tx.update(fundInvestors)
            .set({
              carriedInterestEarned: String(Math.max(currentCarryEarned, currentCarryPaid + carriedInterest)),
              carriedInterestPaid: String(currentCarryPaid + carriedInterest),
              updatedAt: new Date(),
            })
            .where(eq(fundInvestors.id, investor.id));
        }

        investorDistributions.push({
          investorId: investor.id,
          investorName: investor.investorName,
          ownershipPct: Math.round(ownershipPct * 10000) / 100,
          returnOfCapital: Math.round(returnOfCapital * 100) / 100,
          preferredReturn: Math.round(preferredReturn * 100) / 100,
          profitShare: Math.round(profitShare * 100) / 100,
          carriedInterest: Math.round(carriedInterest * 100) / 100,
          totalDistribution,
        });

        totalDistributed += totalDistribution;
      }

      // Update fund-level distributed capital
      await this.updateFundDistributedCapital(orgId, fundId, totalDistributed, tx);

      // Create cash flow entry
      await tx.insert(fundCashFlows).values({
        orgId,
        fundId,
        flowDate: new Date(),
        flowType: 'outflow',
        grossAmount: String(-totalDistributed),
        netAmount: String(-totalDistributed),
        returnOfCapital: String(waterfallResult.returnOfCapital),
        preferredReturn: String(waterfallResult.preferredReturn),
        gainDistribution: String(waterfallResult.totalLpDistribution - waterfallResult.returnOfCapital - waterfallResult.preferredReturn),
        carriedInterest: String(waterfallResult.totalGpDistribution),
        description: `${data.distributionType} distribution: $${totalDistributed.toLocaleString()}`,
      });

      // Recalculate fund metrics
      await this.recalculateFundMetrics(orgId, fundId, tx);

      return {
        waterfallResult,
        investorDistributions,
        totalDistributed: Math.round(totalDistributed * 100) / 100,
        gpCarry: Math.round((waterfallResult.totalGpDistribution - waterfallResult.gpCatchUp) * 100) / 100,
      };
    });
  }

  // ============================================================================
  // LP INVESTOR STATEMENT
  // ============================================================================

  /**
   * Generate a comprehensive investor statement for a specific LP.
   * Includes: capital account summary, commitment status, distributions breakdown,
   * preferred return tracking, fund performance metrics, and deal-level detail.
   */
  async generateInvestorStatement(
    orgId: string,
    fundId: string,
    investorId: string,
    options: {
      asOfDate?: Date;
      periodStart?: Date;
      periodEnd?: Date;
    } = {}
  ): Promise<{
    fund: {
      name: string;
      vintage: number | null;
      status: string;
      targetSize: number;
      committedCapital: number;
    };
    investor: {
      name: string;
      type: string;
      commitmentAmount: number;
      commitmentPct: number;
      calledCapital: number;
      unfundedCommitment: number;
    };
    capitalAccount: {
      openingBalance: number;
      contributions: number;
      distributions: number;
      preferredReturnAccrued: number;
      unrealizedGainLoss: number;
      endingBalance: number;
    };
    distributions: {
      date: Date;
      type: string;
      returnOfCapital: number;
      preferredReturn: number;
      carriedInterest: number;
      profitShare: number;
      total: number;
    }[];
    preferredReturn: {
      rate: number;
      totalAccrued: number;
      totalPaid: number;
      unpaidBalance: number;
    };
    performance: {
      grossIrr: number | null;
      netIrr: number | null;
      tvpi: number | null;
      dpi: number | null;
      rvpi: number | null;
      nav: number;
    };
    dealExposure: {
      allocationId: string;
      projectName: string;
      investedAmount: number;
      currentValue: number;
      unrealizedGain: number;
      exitStatus: string;
    }[];
    movements: FundCapitalMovement[];
  }> {
    const fund = await this.getFund(orgId, fundId);
    if (!fund) throw new Error('Fund not found');

    const investor = await this.getInvestor(orgId, investorId);
    if (!investor) throw new Error('Investor not found');

    const metrics = await this.calculateFundMetrics(orgId, fundId);

    // Get all capital movements for this investor
    const allMovements = await db.select()
      .from(fundCapitalMovements)
      .where(and(
        eq(fundCapitalMovements.fundId, fundId),
        eq(fundCapitalMovements.orgId, orgId),
        eq(fundCapitalMovements.fundInvestorId, investorId),
      ))
      .orderBy(desc(fundCapitalMovements.movementDate));

    // Calculate capital account summary
    const contributions = allMovements
      .filter(m => m.movementType === 'call' || m.movementType === 'contribution')
      .filter(m => m.status === 'completed')
      .reduce((sum, m) => sum + dn(m.amount), 0);

    const distributionMovements = allMovements
      .filter(m => m.movementType === 'distribution' || m.movementType === 'return_of_capital')
      .filter(m => m.status === 'completed');

    const totalDistributed = distributionMovements
      .reduce((sum, m) => sum + dn(m.amount), 0);

    // Build distributions breakdown
    const distributions = distributionMovements.map(m => ({
      date: new Date(m.movementDate),
      type: m.movementType,
      returnOfCapital: dn(m.returnOfCapital),
      preferredReturn: dn(m.preferredReturn),
      carriedInterest: dn(m.carriedInterest),
      profitShare: dn(m.amount) -
        dn(m.returnOfCapital) -
        dn(m.preferredReturn) -
        dn(m.carriedInterest),
      total: dn(m.amount),
    }));

    // Preferred return tracking
    const prefRate = dn(fund.preferredReturn, '0.08');
    const totalAccrued = dn(investor.preferredReturnAccrued);
    const totalPrefPaid = dn(investor.preferredReturnPaid);

    // Deal exposure
    const allocations = await this.getAllocationsByFund(orgId, fundId);
    const commitment = dn(investor.commitmentAmount);
    const totalFundCommitment = (await this.getInvestorsByFund(orgId, fundId))
      .reduce((sum, inv) => sum + dn(inv.commitmentAmount), 0);
    const ownershipPct = totalFundCommitment > 0 ? commitment / totalFundCommitment : 0;

    const dealExposure = [];
    for (const alloc of allocations) {
      if (alloc.exitStatus === 'written_off') continue;
      const investedAmount = dn(alloc.fundedAmount) * ownershipPct;
      const currentValue = dn(alloc.currentValue ?? alloc.fundedAmount) * ownershipPct;

      let projectName = 'Unknown Project';
      if (alloc.modelingProjectId) {
        const [project] = await db.select({ name: modelingProjects.marinaName })
          .from(modelingProjects)
          .where(eq(modelingProjects.id, alloc.modelingProjectId))
          .limit(1);
        projectName = project?.name || 'Unknown Project';
      }

      dealExposure.push({
        allocationId: alloc.id,
        projectName,
        investedAmount: Math.round(investedAmount * 100) / 100,
        currentValue: Math.round(currentValue * 100) / 100,
        unrealizedGain: Math.round((currentValue - investedAmount) * 100) / 100,
        exitStatus: alloc.exitStatus || 'active',
      });
    }

    // Unrealized gain/loss for capital account
    const investorNav = metrics.nav * ownershipPct;
    const unrealizedGainLoss = investorNav - (contributions - totalDistributed);

    return {
      fund: {
        name: fund.name,
        vintage: fund.vintage,
        status: fund.status,
        targetSize: dn(fund.targetSize),
        committedCapital: dn(fund.committedCapital),
      },
      investor: {
        name: investor.investorName,
        type: investor.investorType,
        commitmentAmount: commitment,
        commitmentPct: Math.round(ownershipPct * 10000) / 100,
        calledCapital: dn(investor.calledCapital),
        unfundedCommitment: dn(investor.unfundedCommitment ?? commitment),
      },
      capitalAccount: {
        openingBalance: 0,
        contributions,
        distributions: totalDistributed,
        preferredReturnAccrued: totalAccrued,
        unrealizedGainLoss: Math.round(unrealizedGainLoss * 100) / 100,
        endingBalance: Math.round((contributions - totalDistributed + unrealizedGainLoss) * 100) / 100,
      },
      distributions,
      preferredReturn: {
        rate: prefRate,
        totalAccrued,
        totalPaid: totalPrefPaid,
        unpaidBalance: Math.round((totalAccrued - totalPrefPaid) * 100) / 100,
      },
      performance: {
        grossIrr: metrics.grossIrr,
        netIrr: metrics.netIrr,
        tvpi: metrics.tvpi,
        dpi: metrics.dpi,
        rvpi: metrics.rvpi,
        nav: Math.round(investorNav * 100) / 100,
      },
      dealExposure,
      movements: allMovements,
    };
  }

  /**
   * Sync deal-level IRR/MOIC from returnsLedger into fundDealAllocations.
   * For each allocation in the fund, compute deal returns and update dealIrr/dealMoic.
   */
  async syncDealReturns(orgId: string, fundId: string): Promise<{ updatedDeals: number }> {
    const allocations = await this.getAllocationsByFund(orgId, fundId);
    let updatedDeals = 0;

    for (const alloc of allocations) {
      if (!alloc.modelingProjectId) continue;

      // Get the project's propertyId
      const [project] = await db.select({ propertyId: modelingProjects.propertyId })
        .from(modelingProjects)
        .where(eq(modelingProjects.id, alloc.modelingProjectId))
        .limit(1);

      if (!project?.propertyId) continue;

      // Get returnsLedger entries for this property
      const entries = await db.select()
        .from(returnsLedger)
        .where(and(
          eq(returnsLedger.orgId, orgId),
          eq(returnsLedger.propertyId, project.propertyId)
        ))
        .orderBy(returnsLedger.asOfDate);

      if (entries.length < 2) continue;

      // Compute XIRR
      const cashflows: { date: Date; amount: number }[] = entries.map(e => ({
        date: new Date(e.asOfDate as string),
        amount: dn(e.amount),
      }));

      const irr = this.calculateXirr(cashflows);

      // Compute MOIC
      const totalIn = cashflows.filter(cf => cf.amount < 0).reduce((s, cf) => s + Math.abs(cf.amount), 0);
      const totalOut = cashflows.filter(cf => cf.amount > 0).reduce((s, cf) => s + cf.amount, 0);
      const moic = totalIn > 0 ? totalOut / totalIn : null;

      // Update the allocation
      await db.update(fundDealAllocations)
        .set({
          dealIrr: irr !== null ? String(Math.round(irr * 10000) / 100) : null,
          dealMoic: moic !== null ? String(Math.round(moic * 100) / 100) : null,
          updatedAt: new Date(),
        })
        .where(eq(fundDealAllocations.id, alloc.id));

      updatedDeals++;
    }

    return { updatedDeals };
  }

  // ============================================================================
  // IMMUTABLE LEDGER — Capital Account Ledger (pool.query, not Drizzle)
  // ============================================================================

  /**
   * Insert an immutable ledger entry. Uses pool.query() because the table
   * has PostgreSQL RULES that prevent UPDATE/DELETE (Drizzle won't work).
   */
  async insertLedgerEntry(
    orgId: string,
    fundId: string,
    investorId: string | null,
    entryType: string,
    amount: number,
    description: string | null,
    referenceId: string | null = null,
    effectiveDate: Date = new Date(),
    createdBy: string | null = null
  ): Promise<{ id: string }> {
    const validTypes = [
      'capital_call', 'distribution', 'pref_return_accrual',
      'management_fee', 'carried_interest', 'adjustment',
      'return_of_capital', 'reversal',
    ];
    if (!validTypes.includes(entryType)) {
      throw new Error(`Invalid ledger entry type: ${entryType}`);
    }
    if (amount === 0) {
      throw new Error('Ledger entry amount must be non-zero');
    }

    const result = await pool.query(
      `INSERT INTO fund_ledger_entries
        (org_id, fund_id, investor_id, entry_type, amount, description, reference_id, effective_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [orgId, fundId, investorId, entryType, amount, description, referenceId, effectiveDate, createdBy]
    );

    return { id: result.rows[0].id };
  }

  /**
   * Derive capital account balance from the immutable ledger.
   * If investorId is provided, returns that investor's balance.
   * Otherwise returns fund-level totals grouped by entry type.
   */
  async getLedgerBalance(
    orgId: string,
    fundId: string,
    investorId?: string
  ): Promise<
    | { investorId: string; balance: number; breakdown: Record<string, number> }
    | { fundTotal: number; byType: Record<string, number>; byInvestor: Record<string, number> }
  > {
    if (investorId) {
      const result = await pool.query(
        `SELECT entry_type, COALESCE(SUM(amount), 0) AS total
         FROM fund_ledger_entries
         WHERE org_id = $1 AND fund_id = $2 AND investor_id = $3
         GROUP BY entry_type`,
        [orgId, fundId, investorId]
      );

      const breakdown: Record<string, number> = {};
      let balance = new Decimal(0);
      for (const row of result.rows) {
        const val = d(row.total);
        breakdown[row.entry_type] = val.toNumber();
        balance = balance.plus(val);
      }

      return { investorId, balance: balance.toNumber(), breakdown };
    }

    // Fund-level: totals by type and by investor
    const byTypeResult = await pool.query(
      `SELECT entry_type, COALESCE(SUM(amount), 0) AS total
       FROM fund_ledger_entries
       WHERE org_id = $1 AND fund_id = $2
       GROUP BY entry_type`,
      [orgId, fundId]
    );

    const byType: Record<string, number> = {};
    let fundTotal = new Decimal(0);
    for (const row of byTypeResult.rows) {
      const val = d(row.total);
      byType[row.entry_type] = val.toNumber();
      fundTotal = fundTotal.plus(val);
    }

    const byInvestorResult = await pool.query(
      `SELECT investor_id, COALESCE(SUM(amount), 0) AS total
       FROM fund_ledger_entries
       WHERE org_id = $1 AND fund_id = $2 AND investor_id IS NOT NULL
       GROUP BY investor_id`,
      [orgId, fundId]
    );

    const byInvestor: Record<string, number> = {};
    for (const row of byInvestorResult.rows) {
      byInvestor[row.investor_id] = dn(row.total);
    }

    return { fundTotal: fundTotal.toNumber(), byType, byInvestor };
  }

  /**
   * Get paginated ledger entries with optional date range and investor filter.
   */
  async getLedgerEntries(
    orgId: string,
    fundId: string,
    investorId?: string,
    options: { startDate?: Date; endDate?: Date; limit?: number; offset?: number } = {}
  ): Promise<{ entries: any[]; total: number }> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const conditions: string[] = ['org_id = $1', 'fund_id = $2'];
    const params: any[] = [orgId, fundId];
    let paramIdx = 3;

    if (investorId) {
      conditions.push(`investor_id = $${paramIdx}`);
      params.push(investorId);
      paramIdx++;
    }
    if (options.startDate) {
      conditions.push(`effective_date >= $${paramIdx}`);
      params.push(options.startDate);
      paramIdx++;
    }
    if (options.endDate) {
      conditions.push(`effective_date <= $${paramIdx}`);
      params.push(options.endDate);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM fund_ledger_entries WHERE ${whereClause}`,
      params
    );
    const total = countResult.rows[0].total;

    const dataResult = await pool.query(
      `SELECT id, org_id, fund_id, investor_id, entry_type, amount,
              description, reference_id, effective_date, created_at, created_by
       FROM fund_ledger_entries
       WHERE ${whereClause}
       ORDER BY effective_date DESC, created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const entries = dataResult.rows.map(row => ({
      id: row.id,
      orgId: row.org_id,
      fundId: row.fund_id,
      investorId: row.investor_id,
      entryType: row.entry_type,
      amount: dn(row.amount),
      description: row.description,
      referenceId: row.reference_id,
      effectiveDate: row.effective_date,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }));

    return { entries, total };
  }

  /**
   * Reconcile derived ledger balances vs stored mutable capitalAccountBalance
   * on each investor. Returns list of discrepancies.
   */
  async reconcileLedgerVsStored(
    orgId: string,
    fundId: string
  ): Promise<{
    investorCount: number;
    discrepancies: {
      investorId: string;
      investorName: string;
      storedBalance: number;
      ledgerBalance: number;
      difference: number;
    }[];
    allMatch: boolean;
  }> {
    const investors = await this.getInvestorsByFund(orgId, fundId);

    // Get all investor ledger balances in one query
    const ledgerResult = await pool.query(
      `SELECT investor_id, COALESCE(SUM(amount), 0) AS ledger_balance
       FROM fund_ledger_entries
       WHERE org_id = $1 AND fund_id = $2 AND investor_id IS NOT NULL
       GROUP BY investor_id`,
      [orgId, fundId]
    );

    const ledgerMap: Record<string, number> = {};
    for (const row of ledgerResult.rows) {
      ledgerMap[row.investor_id] = dn(row.ledger_balance);
    }

    const discrepancies: {
      investorId: string;
      investorName: string;
      storedBalance: number;
      ledgerBalance: number;
      difference: number;
    }[] = [];

    for (const inv of investors) {
      const storedBalance = dn(inv.capitalAccountBalance);
      const ledgerBalance = ledgerMap[inv.id] ?? 0;
      const difference = Math.round((storedBalance - ledgerBalance) * 100) / 100;

      if (Math.abs(difference) >= 0.01) {
        discrepancies.push({
          investorId: inv.id,
          investorName: inv.investorName,
          storedBalance,
          ledgerBalance,
          difference,
        });
      }
    }

    return {
      investorCount: investors.length,
      discrepancies,
      allMatch: discrepancies.length === 0,
    };
  }

  async recalculateFundMetrics(orgId: string, fundId: string, txn?: DbOrTx): Promise<void> {
    const d = txn || db;
    const metrics = await this.calculateFundMetrics(orgId, fundId);

    await d.update(funds)
      .set({
        grossIrr: metrics.grossIrr ? String(metrics.grossIrr) : null,
        netIrr: metrics.netIrr ? String(metrics.netIrr) : null,
        grossMoic: metrics.grossMoic ? String(metrics.grossMoic) : null,
        netMoic: metrics.netMoic ? String(metrics.netMoic) : null,
        tvpi: metrics.tvpi ? String(metrics.tvpi) : null,
        dpi: metrics.dpi ? String(metrics.dpi) : null,
        rvpi: metrics.rvpi ? String(metrics.rvpi) : null,
        updatedAt: new Date(),
      })
      .where(eq(funds.id, fundId));
  }
}

export const fundService = new FundService();
