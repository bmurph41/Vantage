import { db } from '../db';
import {
  funds,
  fundInvestors,
  fundDealAllocations,
  fundCapitalMovements,
  fundCashFlows,
  fundCapitalStackTemplates,
  fundWaterfallCalculations,
  modelingProjects,
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
    const amount = parseFloat(movement.amount?.toString() || '0');

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

    const committedCapital = parseFloat(fund.committedCapital?.toString() || '0');
    const calledCapital = parseFloat(fund.calledCapital?.toString() || '0');
    const distributedCapital = parseFloat(fund.distributedCapital?.toString() || '0');
    const recycledCapital = parseFloat(fund.recycledCapital?.toString() || '0');

    const unfundedCommitments = investors.reduce((sum, inv) => {
      return sum + parseFloat(inv.unfundedCommitment?.toString() || '0');
    }, 0);

    const deployedCapital = allocations.reduce((sum, alloc) => {
      return sum + parseFloat(alloc.fundedAmount?.toString() || '0');
    }, 0);

    const dryPowder = calledCapital - deployedCapital + recycledCapital;

    let nav = 0;
    for (const alloc of allocations) {
      if (alloc.exitStatus !== 'exited' && alloc.exitStatus !== 'written_off') {
        nav += parseFloat(alloc.currentValue?.toString() || alloc.fundedAmount?.toString() || '0');
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
        amount: parseFloat(cf.grossAmount?.toString() || '0'),
      }));
      
      if (nav > 0) {
        xirrFlows.push({ date: new Date(), amount: nav });
      }

      grossIrr = this.calculateXirr(xirrFlows);

      const netFlows: XirrCashFlow[] = cashFlows.map(cf => ({
        date: new Date(cf.flowDate),
        amount: parseFloat(cf.netAmount?.toString() || '0'),
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
    metrics: FundMetrics
  ): Promise<FundWaterfallCalculation> {
    await db.update(fundWaterfallCalculations)
      .set({ isLatest: false })
      .where(and(
        eq(fundWaterfallCalculations.fundId, fundId),
        eq(fundWaterfallCalculations.isLatest, true)
      ));

    const [saved] = await db.insert(fundWaterfallCalculations).values({
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
      (sum, inv) => sum + parseFloat(inv.commitmentAmount?.toString() || '0'),
      0
    );

    return investors.map(inv => {
      const commitment = parseFloat(inv.commitmentAmount?.toString() || '0');
      return {
        investorId: inv.id,
        investorName: inv.investorName,
        investorType: inv.investorType,
        commitment,
        calledCapital: parseFloat(inv.calledCapital?.toString() || '0'),
        unfundedCommitment: parseFloat(inv.unfundedCommitment?.toString() || String(commitment)),
        distributions: parseFloat(inv.distributedCapital?.toString() || '0'),
        preferredReturnAccrued: parseFloat(inv.preferredReturnAccrued?.toString() || '0'),
        preferredReturnPaid: parseFloat(inv.preferredReturnPaid?.toString() || '0'),
        carriedInterestEarned: parseFloat(inv.carriedInterestEarned?.toString() || '0'),
        carriedInterestPaid: parseFloat(inv.carriedInterestPaid?.toString() || '0'),
        capitalAccountBalance: parseFloat(inv.capitalAccountBalance?.toString() || '0'),
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
      (sum, inv) => sum + parseFloat(inv.commitmentAmount?.toString() || '0'),
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
    additionalAmount: number
  ): Promise<void> {
    const fund = await this.getFund(orgId, fundId);
    if (!fund) return;

    const current = parseFloat(fund.calledCapital?.toString() || '0');
    await db.update(funds)
      .set({
        calledCapital: String(current + additionalAmount),
        updatedAt: new Date(),
      })
      .where(eq(funds.id, fundId));
  }

  private async updateFundDistributedCapital(
    orgId: string,
    fundId: string,
    additionalAmount: number
  ): Promise<void> {
    const fund = await this.getFund(orgId, fundId);
    if (!fund) return;

    const current = parseFloat(fund.distributedCapital?.toString() || '0');
    await db.update(funds)
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

    const current = parseFloat(fund.recycledCapital?.toString() || '0');
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
    additionalAmount: number
  ): Promise<void> {
    const investor = await this.getInvestor(orgId, investorId);
    if (!investor) return;

    const currentCalled = parseFloat(investor.calledCapital?.toString() || '0');
    const commitment = parseFloat(investor.commitmentAmount?.toString() || '0');

    await db.update(fundInvestors)
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
    additionalAmount: number
  ): Promise<void> {
    const investor = await this.getInvestor(orgId, investorId);
    if (!investor) return;

    const currentDistributed = parseFloat(investor.distributedCapital?.toString() || '0');
    const currentBalance = parseFloat(investor.capitalAccountBalance?.toString() || '0');

    await db.update(fundInvestors)
      .set({
        distributedCapital: String(currentDistributed + additionalAmount),
        capitalAccountBalance: String(currentBalance - additionalAmount),
        updatedAt: new Date(),
      })
      .where(eq(fundInvestors.id, investorId));
  }

  async recalculateFundMetrics(orgId: string, fundId: string): Promise<void> {
    const metrics = await this.calculateFundMetrics(orgId, fundId);

    await db.update(funds)
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
