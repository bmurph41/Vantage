import { db } from '../db';
import {
  capitalStacks,
  debtTranches,
  equityLayers,
  capitalStackProjections,
  insertCapitalStackSchema,
  insertDebtTrancheSchema,
  insertEquityLayerSchema,
  type CapitalStack,
  type DebtTranche,
  type EquityLayer,
  type CapitalStackProjection,
  type InsertCapitalStack,
  type InsertDebtTranche,
  type InsertEquityLayer,
} from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export interface DebtServiceCalculation {
  monthlyPayment: number;
  annualDebtService: number;
  interestExpense: number;
  principalPaydown: number;
}

export interface CapitalStackMetrics {
  totalDebt: number;
  totalEquity: number;
  blendedDebtRate: number;
  ltv: number;
  debtYield: number;
  weightedAvgDSCR: number;
}

export interface WaterfallDistribution {
  year: number;
  availableCash: number;
  lpDistribution: number;
  gpDistribution: number;
  lpPrefReturn: number;
  gpPromote: number;
  lpReturnOfCapital: number;
  gpCatchUp: number;
}

export interface ProjectionResult {
  year: number;
  grossRevenue: number;
  operatingExpenses: number;
  noi: number;
  capex: number;
  ncf: number;
  totalDebtService: number;
  principalPaydown: number;
  interestExpense: number;
  cashFlowBeforeDebt: number;
  cashFlowAfterDebt: number;
  lpDistribution: number;
  gpDistribution: number;
  totalDistribution: number;
  dscr: number;
  debtYield: number;
  exitValue: number | null;
  loanPayoff: number | null;
  netSaleProceeds: number | null;
  cumulativeCashFlow: number;
  equityMultiple: number;
  irr: number | null;
  cashOnCash: number;
}

export interface CapitalStackWithDetails extends CapitalStack {
  debtTranches: DebtTranche[];
  equityLayers: EquityLayer[];
  projections: CapitalStackProjection[];
}

export class CapitalStackService {
  // ============================================================================
  // CAPITAL STACK CRUD
  // ============================================================================

  async createCapitalStack(
    orgId: string,
    userId: string,
    data: InsertCapitalStack
  ): Promise<CapitalStack> {
    const validated = insertCapitalStackSchema.parse(data);

    const [result] = await db.insert(capitalStacks).values({
      ...validated,
      orgId,
      createdBy: userId,
      purchasePrice: String(validated.purchasePrice),
      closingCosts: validated.closingCosts ? String(validated.closingCosts) : '0',
      capexReserves: validated.capexReserves ? String(validated.capexReserves) : '0',
      workingCapital: validated.workingCapital ? String(validated.workingCapital) : '0',
      totalCapitalization: String(validated.totalCapitalization),
      totalDebt: validated.totalDebt ? String(validated.totalDebt) : '0',
      totalEquity: validated.totalEquity ? String(validated.totalEquity) : '0',
      exitCapRate: validated.exitCapRate ? String(validated.exitCapRate) : null,
      noiGrowthRate: validated.noiGrowthRate ? String(validated.noiGrowthRate) : '0.02',
    }).returning();

    return result;
  }

  async getCapitalStack(
    orgId: string,
    capitalStackId: string
  ): Promise<CapitalStack | null> {
    const [result] = await db.select()
      .from(capitalStacks)
      .where(and(
        eq(capitalStacks.id, capitalStackId),
        eq(capitalStacks.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  async getCapitalStackWithDetails(
    orgId: string,
    capitalStackId: string
  ): Promise<CapitalStackWithDetails | null> {
    const stack = await this.getCapitalStack(orgId, capitalStackId);
    if (!stack) return null;

    const [tranches, layers, projections] = await Promise.all([
      this.getDebtTranches(orgId, capitalStackId),
      this.getEquityLayers(orgId, capitalStackId),
      this.getProjections(orgId, capitalStackId)
    ]);

    return {
      ...stack,
      debtTranches: tranches,
      equityLayers: layers,
      projections
    };
  }

  async getCapitalStacksByProject(
    orgId: string,
    modelingProjectId: string
  ): Promise<CapitalStack[]> {
    return db.select()
      .from(capitalStacks)
      .where(and(
        eq(capitalStacks.orgId, orgId),
        eq(capitalStacks.modelingProjectId, modelingProjectId),
        eq(capitalStacks.isActive, true)
      ))
      .orderBy(desc(capitalStacks.createdAt));
  }

  async updateCapitalStack(
    orgId: string,
    capitalStackId: string,
    data: Partial<InsertCapitalStack>
  ): Promise<CapitalStack | null> {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    if (data.purchasePrice !== undefined) updateData.purchasePrice = String(data.purchasePrice);
    if (data.closingCosts !== undefined) updateData.closingCosts = String(data.closingCosts);
    if (data.capexReserves !== undefined) updateData.capexReserves = String(data.capexReserves);
    if (data.workingCapital !== undefined) updateData.workingCapital = String(data.workingCapital);
    if (data.totalCapitalization !== undefined) updateData.totalCapitalization = String(data.totalCapitalization);
    if (data.totalDebt !== undefined) updateData.totalDebt = String(data.totalDebt);
    if (data.totalEquity !== undefined) updateData.totalEquity = String(data.totalEquity);
    if (data.exitCapRate !== undefined) updateData.exitCapRate = String(data.exitCapRate);
    if (data.noiGrowthRate !== undefined) updateData.noiGrowthRate = String(data.noiGrowthRate);

    const [result] = await db.update(capitalStacks)
      .set(updateData)
      .where(and(
        eq(capitalStacks.id, capitalStackId),
        eq(capitalStacks.orgId, orgId)
      ))
      .returning();

    return result || null;
  }

  async deleteCapitalStack(
    orgId: string,
    capitalStackId: string
  ): Promise<boolean> {
    const result = await db.delete(capitalStacks)
      .where(and(
        eq(capitalStacks.id, capitalStackId),
        eq(capitalStacks.orgId, orgId)
      ));

    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // DEBT TRANCHES CRUD
  // ============================================================================

  async createDebtTranche(
    orgId: string,
    data: InsertDebtTranche
  ): Promise<DebtTranche> {
    const validated = insertDebtTrancheSchema.parse(data);

    const debtService = this.calculateDebtService(
      parseFloat(String(validated.principal)),
      parseFloat(String(validated.interestRate)),
      validated.amortizationYears || 25,
      validated.interestOnlyMonths || 0
    );

    const [result] = await db.insert(debtTranches).values({
      ...validated,
      orgId,
      principal: String(validated.principal),
      interestRate: String(validated.interestRate),
      originationFeePct: validated.originationFeePct ? String(validated.originationFeePct) : '0.01',
      minDscr: validated.minDscr ? String(validated.minDscr) : null,
      maxLtv: validated.maxLtv ? String(validated.maxLtv) : null,
      monthlyPayment: String(debtService.monthlyPayment),
      annualDebtService: String(debtService.annualDebtService),
    }).returning();

    await this.recalculateCapitalStackMetrics(orgId, result.capitalStackId);

    return result;
  }

  async getDebtTranche(
    orgId: string,
    trancheId: string
  ): Promise<DebtTranche | null> {
    const [result] = await db.select()
      .from(debtTranches)
      .where(and(
        eq(debtTranches.id, trancheId),
        eq(debtTranches.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  async getDebtTranches(
    orgId: string,
    capitalStackId: string
  ): Promise<DebtTranche[]> {
    return db.select()
      .from(debtTranches)
      .where(and(
        eq(debtTranches.orgId, orgId),
        eq(debtTranches.capitalStackId, capitalStackId)
      ))
      .orderBy(asc(debtTranches.priority), asc(debtTranches.sortOrder));
  }

  async updateDebtTranche(
    orgId: string,
    trancheId: string,
    data: Partial<InsertDebtTranche>
  ): Promise<DebtTranche | null> {
    const existing = await this.getDebtTranche(orgId, trancheId);
    if (!existing) return null;

    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    if (data.principal !== undefined) updateData.principal = String(data.principal);
    if (data.interestRate !== undefined) updateData.interestRate = String(data.interestRate);
    if (data.originationFeePct !== undefined) updateData.originationFeePct = String(data.originationFeePct);
    if (data.minDscr !== undefined) updateData.minDscr = String(data.minDscr);
    if (data.maxLtv !== undefined) updateData.maxLtv = String(data.maxLtv);

    const principal = parseFloat(String(data.principal ?? existing.principal));
    const interestRate = parseFloat(String(data.interestRate ?? existing.interestRate));
    const amortYears = data.amortizationYears ?? existing.amortizationYears ?? 25;
    const ioMonths = data.interestOnlyMonths ?? existing.interestOnlyMonths ?? 0;

    const debtService = this.calculateDebtService(principal, interestRate, amortYears, ioMonths);
    updateData.monthlyPayment = String(debtService.monthlyPayment);
    updateData.annualDebtService = String(debtService.annualDebtService);

    const [result] = await db.update(debtTranches)
      .set(updateData)
      .where(and(
        eq(debtTranches.id, trancheId),
        eq(debtTranches.orgId, orgId)
      ))
      .returning();

    if (result) {
      await this.recalculateCapitalStackMetrics(orgId, result.capitalStackId);
    }

    return result || null;
  }

  async deleteDebtTranche(
    orgId: string,
    trancheId: string
  ): Promise<boolean> {
    const existing = await this.getDebtTranche(orgId, trancheId);
    if (!existing) return false;

    const result = await db.delete(debtTranches)
      .where(and(
        eq(debtTranches.id, trancheId),
        eq(debtTranches.orgId, orgId)
      ));

    if ((result.rowCount ?? 0) > 0) {
      await this.recalculateCapitalStackMetrics(orgId, existing.capitalStackId);
    }

    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // EQUITY LAYERS CRUD
  // ============================================================================

  async createEquityLayer(
    orgId: string,
    data: InsertEquityLayer
  ): Promise<EquityLayer> {
    const validated = insertEquityLayerSchema.parse(data);

    const [result] = await db.insert(equityLayers).values({
      ...validated,
      orgId,
      commitmentAmount: String(validated.commitmentAmount),
      fundedAmount: validated.fundedAmount ? String(validated.fundedAmount) : '0',
      ownershipPct: String(validated.ownershipPct),
      preferredReturn: validated.preferredReturn ? String(validated.preferredReturn) : null,
    }).returning();

    await this.recalculateCapitalStackMetrics(orgId, result.capitalStackId);

    return result;
  }

  async getEquityLayer(
    orgId: string,
    layerId: string
  ): Promise<EquityLayer | null> {
    const [result] = await db.select()
      .from(equityLayers)
      .where(and(
        eq(equityLayers.id, layerId),
        eq(equityLayers.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  async getEquityLayers(
    orgId: string,
    capitalStackId: string
  ): Promise<EquityLayer[]> {
    return db.select()
      .from(equityLayers)
      .where(and(
        eq(equityLayers.orgId, orgId),
        eq(equityLayers.capitalStackId, capitalStackId)
      ))
      .orderBy(asc(equityLayers.waterfallPriority), asc(equityLayers.sortOrder));
  }

  async updateEquityLayer(
    orgId: string,
    layerId: string,
    data: Partial<InsertEquityLayer>
  ): Promise<EquityLayer | null> {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    if (data.commitmentAmount !== undefined) updateData.commitmentAmount = String(data.commitmentAmount);
    if (data.fundedAmount !== undefined) updateData.fundedAmount = String(data.fundedAmount);
    if (data.ownershipPct !== undefined) updateData.ownershipPct = String(data.ownershipPct);
    if (data.preferredReturn !== undefined) updateData.preferredReturn = String(data.preferredReturn);

    const [result] = await db.update(equityLayers)
      .set(updateData)
      .where(and(
        eq(equityLayers.id, layerId),
        eq(equityLayers.orgId, orgId)
      ))
      .returning();

    if (result) {
      await this.recalculateCapitalStackMetrics(orgId, result.capitalStackId);
    }

    return result || null;
  }

  async deleteEquityLayer(
    orgId: string,
    layerId: string
  ): Promise<boolean> {
    const existing = await this.getEquityLayer(orgId, layerId);
    if (!existing) return false;

    const result = await db.delete(equityLayers)
      .where(and(
        eq(equityLayers.id, layerId),
        eq(equityLayers.orgId, orgId)
      ));

    if ((result.rowCount ?? 0) > 0) {
      await this.recalculateCapitalStackMetrics(orgId, existing.capitalStackId);
    }

    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // PROJECTIONS
  // ============================================================================

  async getProjections(
    orgId: string,
    capitalStackId: string
  ): Promise<CapitalStackProjection[]> {
    return db.select()
      .from(capitalStackProjections)
      .where(and(
        eq(capitalStackProjections.orgId, orgId),
        eq(capitalStackProjections.capitalStackId, capitalStackId)
      ))
      .orderBy(asc(capitalStackProjections.year));
  }

  async generateProjections(
    orgId: string,
    capitalStackId: string,
    baseNOI: number
  ): Promise<ProjectionResult[]> {
    const stack = await this.getCapitalStackWithDetails(orgId, capitalStackId);
    if (!stack) {
      throw new Error('Capital stack not found');
    }

    const holdPeriod = stack.holdPeriodYears || 5;
    const noiGrowthRate = parseFloat(stack.noiGrowthRate?.toString() || '0.02');
    const exitCapRate = parseFloat(stack.exitCapRate?.toString() || '0.07');
    const totalEquity = parseFloat(stack.totalEquity?.toString() || '0');
    const purchasePrice = parseFloat(stack.purchasePrice?.toString() || '0');

    await db.delete(capitalStackProjections)
      .where(and(
        eq(capitalStackProjections.orgId, orgId),
        eq(capitalStackProjections.capitalStackId, capitalStackId)
      ));

    const results: ProjectionResult[] = [];
    const cashFlows: number[] = [-totalEquity];
    let cumulativeCashFlow = 0;

    for (let year = 1; year <= holdPeriod; year++) {
      const noi = baseNOI * Math.pow(1 + noiGrowthRate, year - 1);
      const grossRevenue = noi / 0.6;
      const operatingExpenses = grossRevenue - noi;
      const capex = noi * 0.03;
      const ncf = noi - capex;

      const { totalDebtService, totalPrincipal, totalInterest } = 
        this.calculateTotalDebtService(stack.debtTranches, year);

      const cashFlowBeforeDebt = ncf;
      const cashFlowAfterDebt = ncf - totalDebtService;

      const { lpDistribution, gpDistribution } = this.calculateWaterfallDistribution(
        cashFlowAfterDebt,
        stack.equityLayers,
        year,
        totalEquity
      );

      const totalDistribution = lpDistribution + gpDistribution;
      const dscr = totalDebtService > 0 ? noi / totalDebtService : 0;
      const totalDebt = stack.debtTranches.reduce(
        (sum, t) => sum + parseFloat(t.principal?.toString() || '0'), 0
      );
      const debtYield = totalDebt > 0 ? (noi / totalDebt) * 100 : 0;

      cumulativeCashFlow += cashFlowAfterDebt;

      let exitValue: number | null = null;
      let loanPayoff: number | null = null;
      let netSaleProceeds: number | null = null;

      if (year === holdPeriod) {
        const exitNOI = baseNOI * Math.pow(1 + noiGrowthRate, holdPeriod);
        exitValue = exitNOI / exitCapRate;
        loanPayoff = this.calculateRemainingBalance(stack.debtTranches, holdPeriod);
        netSaleProceeds = exitValue - loanPayoff;
        cumulativeCashFlow += netSaleProceeds;
      }

      const equityMultiple = totalEquity > 0 ? cumulativeCashFlow / totalEquity : 0;
      const cashOnCash = totalEquity > 0 ? (cashFlowAfterDebt / totalEquity) * 100 : 0;

      cashFlows.push(year === holdPeriod ? cashFlowAfterDebt + (netSaleProceeds || 0) : cashFlowAfterDebt);

      const projection: ProjectionResult = {
        year,
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        operatingExpenses: Math.round(operatingExpenses * 100) / 100,
        noi: Math.round(noi * 100) / 100,
        capex: Math.round(capex * 100) / 100,
        ncf: Math.round(ncf * 100) / 100,
        totalDebtService: Math.round(totalDebtService * 100) / 100,
        principalPaydown: Math.round(totalPrincipal * 100) / 100,
        interestExpense: Math.round(totalInterest * 100) / 100,
        cashFlowBeforeDebt: Math.round(cashFlowBeforeDebt * 100) / 100,
        cashFlowAfterDebt: Math.round(cashFlowAfterDebt * 100) / 100,
        lpDistribution: Math.round(lpDistribution * 100) / 100,
        gpDistribution: Math.round(gpDistribution * 100) / 100,
        totalDistribution: Math.round(totalDistribution * 100) / 100,
        dscr: Math.round(dscr * 100) / 100,
        debtYield: Math.round(debtYield * 100) / 100,
        exitValue: exitValue ? Math.round(exitValue * 100) / 100 : null,
        loanPayoff: loanPayoff ? Math.round(loanPayoff * 100) / 100 : null,
        netSaleProceeds: netSaleProceeds ? Math.round(netSaleProceeds * 100) / 100 : null,
        cumulativeCashFlow: Math.round(cumulativeCashFlow * 100) / 100,
        equityMultiple: Math.round(equityMultiple * 100) / 100,
        irr: null,
        cashOnCash: Math.round(cashOnCash * 100) / 100
      };

      results.push(projection);
    }

    const irr = this.calculateIRR(cashFlows);

    for (const projection of results) {
      projection.irr = irr !== null ? Math.round(irr * 10000) / 100 : null;

      await db.insert(capitalStackProjections).values({
        orgId,
        capitalStackId,
        year: projection.year,
        grossRevenue: String(projection.grossRevenue),
        operatingExpenses: String(projection.operatingExpenses),
        noi: String(projection.noi),
        capex: String(projection.capex),
        ncf: String(projection.ncf),
        totalDebtService: String(projection.totalDebtService),
        principalPaydown: String(projection.principalPaydown),
        interestExpense: String(projection.interestExpense),
        cashFlowBeforeDebt: String(projection.cashFlowBeforeDebt),
        cashFlowAfterDebt: String(projection.cashFlowAfterDebt),
        lpDistribution: String(projection.lpDistribution),
        gpDistribution: String(projection.gpDistribution),
        totalDistribution: String(projection.totalDistribution),
        dscr: String(projection.dscr),
        debtYield: String(projection.debtYield),
        exitValue: projection.exitValue ? String(projection.exitValue) : null,
        loanPayoff: projection.loanPayoff ? String(projection.loanPayoff) : null,
        netSaleProceeds: projection.netSaleProceeds ? String(projection.netSaleProceeds) : null,
        cumulativeCashFlow: String(projection.cumulativeCashFlow),
        equityMultiple: String(projection.equityMultiple),
        irr: projection.irr ? String(projection.irr) : null,
        cashOnCash: String(projection.cashOnCash),
      });
    }

    return results;
  }

  // ============================================================================
  // CALCULATIONS
  // ============================================================================

  calculateDebtService(
    principal: number,
    annualRate: number,
    amortizationYears: number,
    interestOnlyMonths: number = 0
  ): DebtServiceCalculation {
    const monthlyRate = annualRate / 100 / 12;
    const totalPayments = amortizationYears * 12;

    let monthlyPayment: number;
    let annualInterest: number;
    let annualPrincipal: number;

    if (interestOnlyMonths > 0 && interestOnlyMonths >= 12) {
      monthlyPayment = principal * monthlyRate;
      annualInterest = monthlyPayment * 12;
      annualPrincipal = 0;
    } else {
      if (monthlyRate === 0) {
        monthlyPayment = principal / totalPayments;
        annualInterest = 0;
      } else {
        monthlyPayment = principal *
          (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
          (Math.pow(1 + monthlyRate, totalPayments) - 1);
        annualInterest = principal * (annualRate / 100);
      }
      annualPrincipal = (monthlyPayment * 12) - annualInterest;
    }

    return {
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      annualDebtService: Math.round(monthlyPayment * 12 * 100) / 100,
      interestExpense: Math.round(annualInterest * 100) / 100,
      principalPaydown: Math.round(Math.max(0, annualPrincipal) * 100) / 100
    };
  }

  calculateTotalDebtService(
    tranches: DebtTranche[],
    year: number
  ): { totalDebtService: number; totalPrincipal: number; totalInterest: number } {
    let totalDebtService = 0;
    let totalPrincipal = 0;
    let totalInterest = 0;

    for (const tranche of tranches) {
      const principal = parseFloat(tranche.principal?.toString() || '0');
      const rate = parseFloat(tranche.interestRate?.toString() || '0');
      const amortYears = tranche.amortizationYears || 25;
      const ioMonths = tranche.interestOnlyMonths || 0;
      const termYears = tranche.termYears || 10;

      if (year > termYears) continue;

      const effectiveIOMonths = Math.max(0, ioMonths - (year - 1) * 12);
      const service = this.calculateDebtService(principal, rate, amortYears, effectiveIOMonths);

      totalDebtService += service.annualDebtService;
      totalPrincipal += service.principalPaydown;
      totalInterest += service.interestExpense;
    }

    return { totalDebtService, totalPrincipal, totalInterest };
  }

  calculateBlendedDebtRate(tranches: DebtTranche[]): number {
    let totalPrincipal = 0;
    let weightedRate = 0;

    for (const tranche of tranches) {
      const principal = parseFloat(tranche.principal?.toString() || '0');
      const rate = parseFloat(tranche.interestRate?.toString() || '0');
      totalPrincipal += principal;
      weightedRate += principal * rate;
    }

    if (totalPrincipal === 0) return 0;
    return Math.round((weightedRate / totalPrincipal) * 100) / 100;
  }

  calculateLTV(totalDebt: number, purchasePrice: number): number {
    if (purchasePrice === 0) return 0;
    return Math.round((totalDebt / purchasePrice) * 10000) / 100;
  }

  calculateDebtYield(noi: number, totalDebt: number): number {
    if (totalDebt === 0) return 0;
    return Math.round((noi / totalDebt) * 10000) / 100;
  }

  calculateWaterfallDistribution(
    availableCash: number,
    layers: EquityLayer[],
    year: number,
    totalEquity: number
  ): { lpDistribution: number; gpDistribution: number } {
    if (availableCash <= 0 || layers.length === 0) {
      return { lpDistribution: 0, gpDistribution: 0 };
    }

    let lpDistribution = 0;
    let gpDistribution = 0;
    let remainingCash = availableCash;

    const lpLayers = layers.filter(l => l.investorType === 'lp' || l.layerType === 'preferred');
    const gpLayers = layers.filter(l => l.investorType === 'gp' || l.layerType === 'promote');

    for (const layer of lpLayers) {
      if (remainingCash <= 0) break;

      const prefReturn = parseFloat(layer.preferredReturn?.toString() || '0') / 100;
      const commitment = parseFloat(layer.commitmentAmount?.toString() || '0');
      const ownershipPct = parseFloat(layer.ownershipPct?.toString() || '0') / 100;

      if (prefReturn > 0) {
        const prefAmount = commitment * prefReturn;
        const prefPayout = Math.min(remainingCash, prefAmount);
        lpDistribution += prefPayout;
        remainingCash -= prefPayout;
      }

      if (remainingCash > 0 && layer.isParticipating) {
        const participation = remainingCash * ownershipPct;
        lpDistribution += participation;
        remainingCash -= participation;
      }
    }

    for (const layer of gpLayers) {
      if (remainingCash <= 0) break;

      const catchUpPct = parseFloat(layer.catchUpPct?.toString() || '0') / 100;
      if (catchUpPct > 0) {
        const catchUp = remainingCash * catchUpPct;
        gpDistribution += catchUp;
        remainingCash -= catchUp;
      }

      const promoteTiers = layer.promoteTiers || [];
      for (const tier of promoteTiers) {
        if (remainingCash <= 0) break;
        const gpSplit = tier.gpSplit / 100;
        const promote = remainingCash * gpSplit;
        gpDistribution += promote;
        remainingCash -= promote;
      }
    }

    if (remainingCash > 0) {
      const totalLP = lpLayers.reduce((sum, l) => sum + parseFloat(l.ownershipPct?.toString() || '0'), 0) / 100;
      lpDistribution += remainingCash * totalLP;
      gpDistribution += remainingCash * (1 - totalLP);
    }

    return {
      lpDistribution: Math.round(lpDistribution * 100) / 100,
      gpDistribution: Math.round(gpDistribution * 100) / 100
    };
  }

  calculateRemainingBalance(tranches: DebtTranche[], years: number): number {
    let totalRemaining = 0;

    for (const tranche of tranches) {
      const principal = parseFloat(tranche.principal?.toString() || '0');
      const rate = parseFloat(tranche.interestRate?.toString() || '0') / 100;
      const amortYears = tranche.amortizationYears || 25;
      const ioMonths = tranche.interestOnlyMonths || 0;
      const termYears = tranche.termYears || 10;

      if (years >= termYears) {
        continue;
      }

      const monthlyRate = rate / 12;
      const totalPayments = amortYears * 12;
      const paymentsMade = Math.max(0, years * 12 - ioMonths);

      if (paymentsMade <= 0 || monthlyRate === 0) {
        totalRemaining += principal;
        continue;
      }

      const monthlyPayment = principal *
        (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
        (Math.pow(1 + monthlyRate, totalPayments) - 1);

      const remainingBalance = principal * Math.pow(1 + monthlyRate, paymentsMade) -
        monthlyPayment * ((Math.pow(1 + monthlyRate, paymentsMade) - 1) / monthlyRate);

      totalRemaining += Math.max(0, remainingBalance);
    }

    return Math.round(totalRemaining * 100) / 100;
  }

  /**
   * Generate projections using ACTUAL Pro Forma engine output.
   * Ensures Capital Stack shows the same numbers as the Pro Forma tab.
   */
  async generateProjectionsFromProForma(
    orgId: string,
    capitalStackId: string,
    proFormaData: ProFormaProjectionData
  ): Promise<ProjectionResult[]> {
    const stack = await this.getCapitalStackWithDetails(orgId, capitalStackId);
    if (!stack) throw new Error('Capital stack not found');

    const holdPeriod = proFormaData.holdPeriod;
    const totalEquity = parseFloat(stack.totalEquity?.toString() || '0');
    const purchasePrice = proFormaData.purchasePrice;

    await db.delete(capitalStackProjections)
      .where(and(
        eq(capitalStackProjections.orgId, orgId),
        eq(capitalStackProjections.capitalStackId, capitalStackId)
      ));

    const results: ProjectionResult[] = [];
    const cashFlows: number[] = [-totalEquity];
    let cumulativeCashFlow = 0;

    for (let year = 1; year <= holdPeriod; year++) {
      const yearIdx = year - 1;
      const noi = proFormaData.noi[yearIdx] || 0;
      const grossRevenue = proFormaData.revenue[yearIdx] || 0;
      const operatingExpenses = proFormaData.expenses[yearIdx] || 0;
      const capex = proFormaData.capex[yearIdx] || 0;
      const ncf = noi - capex;

      const { totalDebtService, totalPrincipal, totalInterest } = 
        this.calculateTotalDebtService(stack.debtTranches, year);

      const cashFlowBeforeDebt = proFormaData.cashFlowBeforeDebtService[yearIdx] || ncf;
      const cashFlowAfterDebt = proFormaData.leveredCashFlow[yearIdx] || (cashFlowBeforeDebt - totalDebtService);

      const { lpDistribution, gpDistribution } = this.calculateWaterfallDistribution(
        cashFlowAfterDebt, stack.equityLayers, year, totalEquity
      );

      const totalDistribution = lpDistribution + gpDistribution;
      const dscr = totalDebtService > 0 ? noi / totalDebtService : 0;
      const totalDebt = stack.debtTranches.reduce(
        (sum, t) => sum + parseFloat(t.principal?.toString() || '0'), 0
      );
      const debtYield = totalDebt > 0 ? (noi / totalDebt) * 100 : 0;
      cumulativeCashFlow += cashFlowAfterDebt;

      let exitValue: number | null = null;
      let loanPayoff: number | null = null;
      let netSaleProceeds: number | null = null;

      if (year === holdPeriod) {
        exitValue = proFormaData.exitValue;
        loanPayoff = this.calculateRemainingBalance(stack.debtTranches, holdPeriod);
        netSaleProceeds = exitValue - (loanPayoff || 0);
        cumulativeCashFlow += netSaleProceeds;
      }

      const equityMultiple = totalEquity > 0 ? cumulativeCashFlow / totalEquity : 0;
      const cashOnCash = totalEquity > 0 ? (cashFlowAfterDebt / totalEquity) * 100 : 0;
      cashFlows.push(year === holdPeriod ? cashFlowAfterDebt + (netSaleProceeds || 0) : cashFlowAfterDebt);

      results.push({
        year,
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        operatingExpenses: Math.round(operatingExpenses * 100) / 100,
        noi: Math.round(noi * 100) / 100,
        capex: Math.round(capex * 100) / 100,
        ncf: Math.round(ncf * 100) / 100,
        totalDebtService: Math.round(totalDebtService * 100) / 100,
        principalPaydown: Math.round(totalPrincipal * 100) / 100,
        interestExpense: Math.round(totalInterest * 100) / 100,
        cashFlowBeforeDebt: Math.round(cashFlowBeforeDebt * 100) / 100,
        cashFlowAfterDebt: Math.round(cashFlowAfterDebt * 100) / 100,
        lpDistribution: Math.round(lpDistribution * 100) / 100,
        gpDistribution: Math.round(gpDistribution * 100) / 100,
        totalDistribution: Math.round(totalDistribution * 100) / 100,
        dscr: Math.round(dscr * 100) / 100,
        debtYield: Math.round(debtYield * 100) / 100,
        exitValue: exitValue ? Math.round(exitValue * 100) / 100 : null,
        loanPayoff: loanPayoff ? Math.round(loanPayoff * 100) / 100 : null,
        netSaleProceeds: netSaleProceeds ? Math.round(netSaleProceeds * 100) / 100 : null,
        cumulativeCashFlow: Math.round(cumulativeCashFlow * 100) / 100,
        equityMultiple: Math.round(equityMultiple * 100) / 100,
        irr: null,
        cashOnCash: Math.round(cashOnCash * 100) / 100
      });
    }

    const irr = this.calculateIRR(cashFlows);
    for (const p of results) {
      p.irr = irr !== null ? Math.round(irr * 10000) / 100 : null;
      await db.insert(capitalStackProjections).values({
        orgId, capitalStackId,
        year: p.year,
        grossRevenue: String(p.grossRevenue),
        operatingExpenses: String(p.operatingExpenses),
        noi: String(p.noi),
        capex: String(p.capex),
        ncf: String(p.ncf),
        totalDebtService: String(p.totalDebtService),
        principalPaydown: String(p.principalPaydown),
        interestExpense: String(p.interestExpense),
        cashFlowBeforeDebt: String(p.cashFlowBeforeDebt),
        cashFlowAfterDebt: String(p.cashFlowAfterDebt),
        lpDistribution: String(p.lpDistribution),
        gpDistribution: String(p.gpDistribution),
        totalDistribution: String(p.totalDistribution),
        dscr: String(p.dscr),
        debtYield: String(p.debtYield),
        exitValue: p.exitValue ? String(p.exitValue) : null,
        loanPayoff: p.loanPayoff ? String(p.loanPayoff) : null,
        netSaleProceeds: p.netSaleProceeds ? String(p.netSaleProceeds) : null,
        cumulativeCashFlow: String(p.cumulativeCashFlow),
        equityMultiple: String(p.equityMultiple),
        irr: irr !== null ? String(Math.round(irr * 10000) / 100) : null,
        cashOnCash: String(p.cashOnCash),
      });
    }
    return results;
  }

  calculateIRR(cashFlows: number[], guess: number = 0.1, maxIterations: number = 100, tolerance: number = 0.0001): number | null {
    if (cashFlows.length < 2) return null;

    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivativeNpv = 0;

      for (let j = 0; j < cashFlows.length; j++) {
        const discountFactor = Math.pow(1 + rate, j);
        npv += cashFlows[j] / discountFactor;
        if (j > 0) {
          derivativeNpv -= (j * cashFlows[j]) / Math.pow(1 + rate, j + 1);
        }
      }

      if (Math.abs(npv) < tolerance) {
        return rate;
      }

      if (derivativeNpv === 0) {
        return null;
      }

      const newRate = rate - npv / derivativeNpv;

      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }

      rate = newRate;

      if (rate < -1) {
        return null;
      }
    }

    return null;
  }

  // ============================================================================
  // METRICS RECALCULATION
  // ============================================================================

  async recalculateCapitalStackMetrics(
    orgId: string,
    capitalStackId: string
  ): Promise<CapitalStackMetrics | null> {
    const stack = await this.getCapitalStack(orgId, capitalStackId);
    if (!stack) return null;

    const tranches = await this.getDebtTranches(orgId, capitalStackId);
    const layers = await this.getEquityLayers(orgId, capitalStackId);

    const totalDebt = tranches.reduce(
      (sum, t) => sum + parseFloat(t.principal?.toString() || '0'), 0
    );

    const totalEquity = layers.reduce(
      (sum, l) => sum + parseFloat(l.commitmentAmount?.toString() || '0'), 0
    );

    const blendedDebtRate = this.calculateBlendedDebtRate(tranches);
    const purchasePrice = parseFloat(stack.purchasePrice?.toString() || '0');
    const ltv = this.calculateLTV(totalDebt, purchasePrice);

    const assumedNOI = purchasePrice * 0.065;
    const debtYield = this.calculateDebtYield(assumedNOI, totalDebt);

    await db.update(capitalStacks)
      .set({
        totalDebt: String(totalDebt),
        totalEquity: String(totalEquity),
        blendedDebtRate: String(blendedDebtRate),
        ltv: String(ltv),
        debtYield: String(debtYield),
        updatedAt: new Date()
      })
      .where(eq(capitalStacks.id, capitalStackId));

    return {
      totalDebt,
      totalEquity,
      blendedDebtRate,
      ltv,
      debtYield,
      weightedAvgDSCR: 0
    };
  }

  async getCapitalStackMetrics(
    orgId: string,
    capitalStackId: string,
    currentNOI: number
  ): Promise<CapitalStackMetrics | null> {
    const stack = await this.getCapitalStackWithDetails(orgId, capitalStackId);
    if (!stack) return null;

    const totalDebt = stack.debtTranches.reduce(
      (sum, t) => sum + parseFloat(t.principal?.toString() || '0'), 0
    );

    const totalEquity = stack.equityLayers.reduce(
      (sum, l) => sum + parseFloat(l.commitmentAmount?.toString() || '0'), 0
    );

    const blendedDebtRate = this.calculateBlendedDebtRate(stack.debtTranches);
    const purchasePrice = parseFloat(stack.purchasePrice?.toString() || '0');
    const ltv = this.calculateLTV(totalDebt, purchasePrice);
    const debtYield = this.calculateDebtYield(currentNOI, totalDebt);

    const { totalDebtService } = this.calculateTotalDebtService(stack.debtTranches, 1);
    const weightedAvgDSCR = totalDebtService > 0 ? currentNOI / totalDebtService : 0;

    return {
      totalDebt,
      totalEquity,
      blendedDebtRate,
      ltv,
      debtYield,
      weightedAvgDSCR: Math.round(weightedAvgDSCR * 100) / 100
    };
  }
}

export const capitalStackService = new CapitalStackService();
