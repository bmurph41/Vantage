import { db } from '../db';
import { 
  rentRolls,
  rentRollEntries,
  slipAssignments,
  modelingProjects,
  modelingScenarioVersions,
  modelingProjectConfig
} from '@shared/schema';
import { eq, and, gte, lte, desc, or } from 'drizzle-orm';

// ============================================================================
// ARGUS-STYLE LEASE CASH FLOW ENGINE FOR MARINA ASSETS
// ============================================================================

export interface LeaseTerms {
  id: string;
  tenantName: string;
  unitId: string;
  unitType: 'wet_slip' | 'dry_rack' | 'mooring' | 'commercial' | 'seasonal' | 'transient';
  squareFeet?: number;
  linearFeet?: number;
  
  // Lease Dates
  leaseStartDate: Date;
  leaseEndDate: Date;
  
  // Base Rent
  baseRent: number;
  rentPeriod: 'monthly' | 'annual' | 'seasonal';
  
  // Escalations
  escalationType: 'fixed' | 'cpi' | 'stepped' | 'market';
  escalationRate: number;
  escalationFrequency: 'annual' | 'biannual' | 'on_renewal';
  steppedRents?: { effectiveDate: Date; newRent: number }[];
  
  // Renewal Options
  renewalProbability: number;
  renewalTermMonths: number;
  renewalRentBump: number;
  
  // Concessions
  freeRentMonths: number;
  freeRentType: 'upfront' | 'spread';
  
  // Leasing Costs
  tenantImprovementPerSF: number;
  leasingCommissionRate: number;
  leasingCommissionMonths: number;
  
  // Expense Recovery (NNN/CAM)
  recoveryType: 'gross' | 'net' | 'modified_gross' | 'base_year_stop' | 'expense_stop';
  recoveryRate: number;
  baseYearExpenses?: number;
  expenseStopAmount?: number;
  camShare: number;
  taxShare: number;
  insuranceShare: number;
  
  // Other Income
  percentageRent: boolean;
  percentageRentRate: number;
  percentageRentBreakpoint: number;
  miscIncome: number;
  
  // Status
  status: 'active' | 'expired' | 'month_to_month' | 'terminated' | 'pending';
}

export interface MarketAssumptions {
  marketRentPerUnit: number;
  marketRentGrowth: number;
  vacancyRate: number;
  creditLoss: number;
  downtimeMonths: number;
  tiPerSF: number;
  lcRate: number;
  lcMonths: number;
  cpiRate: number;
  
  // Expense assumptions
  camPerUnit: number;
  camGrowthRate: number;
  taxPerUnit: number;
  taxGrowthRate: number;
  insurancePerUnit: number;
  insuranceGrowthRate: number;
  managementFeeRate: number;
  replacementReserveRate: number;
}

export interface LeaseYearCashFlow {
  year: number;
  period: number;
  tenantId: string;
  tenantName: string;
  unitId: string;
  
  // Revenue Components
  baseRent: number;
  escalatedRent: number;
  freeRentAbatement: number;
  netBaseRent: number;
  
  // Recoveries
  camRecovery: number;
  taxRecovery: number;
  insuranceRecovery: number;
  totalRecoveries: number;
  
  // Other Income
  percentageRent: number;
  miscIncome: number;
  
  // Total Revenue
  grossPotentialRent: number;
  effectiveGrossRent: number;
  
  // Costs (at rollover/new lease)
  tenantImprovements: number;
  leasingCommissions: number;
  totalLeasingCosts: number;
  
  // Net
  netEffectiveRent: number;
  
  // Status
  isRenewal: boolean;
  isNewLease: boolean;
  isVacant: boolean;
  monthsOccupied: number;
}

export interface RolloverEvent {
  year: number;
  unitId: string;
  tenantName: string;
  expiringRent: number;
  renewalProbability: number;
  outcome: 'renewal' | 'turnover' | 'vacant';
  newRent: number;
  downtimeMonths: number;
  tiCost: number;
  lcCost: number;
}

export interface PropertyCashFlow {
  projectId: string;
  scenarioType: string;
  analysisDate: string;
  holdPeriod: number;
  
  // Summary by Year
  yearlyTotals: YearlyCashFlowSummary[];
  
  // Lease Detail
  leaseSchedule: LeaseYearCashFlow[];
  
  // Rollover Analysis
  rolloverSchedule: RolloverEvent[];
  
  // Valuation
  metrics: ValuationMetrics;
  
  // Audit
  assumptions: MarketAssumptions;
  lastCalculated: string;
}

export interface YearlyCashFlowSummary {
  year: number;
  
  // Revenue
  potentialBaseRent: number;
  scheduledBaseRent: number;
  absorptionVacancy: number;
  freeRent: number;
  effectiveBaseRent: number;
  
  // Recoveries
  camRecoveries: number;
  taxRecoveries: number;
  insuranceRecoveries: number;
  totalRecoveries: number;
  
  // Other Income
  percentageRent: number;
  miscIncome: number;
  
  // Gross Revenue
  totalPotentialRevenue: number;
  vacancyCredit: number;
  effectiveGrossRevenue: number;
  
  // Expenses (recoverable)
  camExpenses: number;
  taxExpenses: number;
  insuranceExpenses: number;
  
  // Expenses (non-recoverable)
  managementFee: number;
  utilities: number;
  repairsAndMaintenance: number;
  generalAndAdmin: number;
  otherExpenses: number;
  totalOperatingExpenses: number;
  
  // NOI
  netOperatingIncome: number;
  
  // Below Line
  tenantImprovements: number;
  leasingCommissions: number;
  capitalReserves: number;
  totalCapitalCosts: number;
  
  // Cash Flow
  cashFlowBeforeDebt: number;
  
  // Metrics
  occupancyRate: number;
  avgRentPerUnit: number;
  expenseRatio: number;
}

export interface ValuationMetrics {
  // Entry
  purchasePrice: number;
  goingInCapRate: number;
  pricePerUnit: number;
  pricePerSF: number;
  
  // Exit
  exitCapRate: number;
  exitNOI: number;
  exitValue: number;
  saleCosts: number;
  netSaleProceeds: number;
  
  // Returns
  unleveredIRR: number;
  leveredIRR: number;
  equityMultiple: number;
  cashOnCash: number[];
  avgCashOnCash: number;
  npv: number;
  discountRate: number;
  
  // Risk
  breakEvenOccupancy: number;
  dscr: number[];
  avgDSCR: number;
}

export class LeaseCashFlowEngine {
  
  // ============================================================================
  // MAIN CALCULATION ENGINE
  // ============================================================================
  
  async calculatePropertyCashFlow(
    projectId: string,
    orgId: string,
    scenarioType: string = 'base',
    overrideAssumptions?: Partial<MarketAssumptions>
  ): Promise<PropertyCashFlow> {
    
    // Fetch project data
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Fetch scenario
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, scenarioType),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .limit(1);
    
    // Fetch config
    const [config] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);
    
    // Fetch rent roll
    const rentRoll = await this.fetchRentRoll(projectId, orgId);
    
    // Build assumptions
    const assumptions = this.buildMarketAssumptions(project, scenario, config, overrideAssumptions);
    
    // Convert rent roll to lease terms
    const leases = this.convertToLeaseTerms(rentRoll, assumptions);
    
    // Calculate hold period
    const holdPeriod = config?.holdPeriod || 10;
    const baseYear = new Date().getFullYear();
    
    // Generate lease-by-lease cash flows
    const leaseSchedule: LeaseYearCashFlow[] = [];
    const rolloverSchedule: RolloverEvent[] = [];
    
    for (let year = 0; year < holdPeriod; year++) {
      const periodYear = baseYear + year;
      
      for (const lease of leases) {
        const leaseCF = this.calculateLeaseYearCashFlow(
          lease,
          year,
          periodYear,
          assumptions,
          rolloverSchedule
        );
        leaseSchedule.push(leaseCF);
      }
    }
    
    // Aggregate to yearly totals
    const yearlyTotals = this.aggregateYearlyCashFlows(
      leaseSchedule,
      assumptions,
      holdPeriod,
      baseYear,
      leases.length
    );
    
    // Calculate valuation metrics
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '0');
    const metrics = this.calculateValuationMetrics(
      yearlyTotals,
      purchasePrice,
      assumptions,
      holdPeriod,
      leases.length
    );
    
    return {
      projectId,
      scenarioType,
      analysisDate: new Date().toISOString(),
      holdPeriod,
      yearlyTotals,
      leaseSchedule,
      rolloverSchedule,
      metrics,
      assumptions,
      lastCalculated: new Date().toISOString()
    };
  }
  
  // ============================================================================
  // RENT ROLL INTEGRATION
  // ============================================================================
  
  private async fetchRentRoll(projectId: string, orgId: string): Promise<any[]> {
    // Try to fetch from rentRollEntries linked to a rentRoll for this project
    const [rentRollRecord] = await db.select()
      .from(rentRolls)
      .where(and(
        eq(rentRolls.orgId, orgId),
        eq(rentRolls.context, 'valuation')
      ))
      .orderBy(desc(rentRolls.createdAt))
      .limit(1);
    
    if (rentRollRecord) {
      const entries = await db.select()
        .from(rentRollEntries)
        .where(eq(rentRollEntries.rentRollId, rentRollRecord.id));
      
      if (entries.length > 0) {
        return entries;
      }
    }
    
    // Fallback to slip assignments
    const assignments = await db.select()
      .from(slipAssignments)
      .where(eq(slipAssignments.orgId, orgId));
    
    if (assignments.length > 0) {
      return assignments;
    }
    
    // Return synthetic rent roll for modeling
    return this.generateSyntheticRentRoll();
  }
  
  private generateSyntheticRentRoll(): any[] {
    // Generate a realistic marina rent roll for modeling purposes
    const entries = [];
    const unitTypes = [
      { type: 'wet_slip', count: 50, avgRent: 850, variance: 0.3 },
      { type: 'dry_rack', count: 100, avgRent: 350, variance: 0.2 },
      { type: 'commercial', count: 3, avgRent: 3500, variance: 0.4 },
    ];
    
    let id = 1;
    const now = new Date();
    
    for (const ut of unitTypes) {
      for (let i = 0; i < ut.count; i++) {
        const rentVariance = 1 + (Math.random() - 0.5) * ut.variance;
        const monthlyRent = Math.round(ut.avgRent * rentVariance);
        const leaseMonths = [12, 24, 36][Math.floor(Math.random() * 3)];
        const startOffset = Math.floor(Math.random() * 24) - 12;
        
        const startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() + startOffset);
        
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + leaseMonths);
        
        entries.push({
          id: `synth-${id++}`,
          slipNumber: `${ut.type.substring(0, 1).toUpperCase()}${String(i + 1).padStart(3, '0')}`,
          slipType: ut.type,
          tenantName: `Tenant ${id}`,
          monthlyRent: String(monthlyRent),
          startDate,
          endDate: endDate > now ? endDate : null,
          renewalDate: endDate > now ? endDate : null,
          status: endDate > now ? 'active' : Math.random() > 0.1 ? 'active' : 'expired',
          linearFeet: ut.type === 'wet_slip' ? 25 + Math.floor(Math.random() * 35) : null,
        });
      }
    }
    
    return entries;
  }
  
  private convertToLeaseTerms(rentRoll: any[], assumptions: MarketAssumptions): LeaseTerms[] {
    return rentRoll.map((entry, idx) => {
      const monthlyRent = parseFloat(entry.monthlyRent?.toString() || entry.monthlyRate?.toString() || '500');
      const startDate = entry.startDate ? new Date(entry.startDate) : new Date();
      const endDate = entry.endDate || entry.renewalDate 
        ? new Date(entry.endDate || entry.renewalDate)
        : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      return {
        id: entry.id || `lease-${idx}`,
        tenantName: entry.tenantName || entry.customerName || `Tenant ${idx + 1}`,
        unitId: entry.slipNumber || entry.unitNumber || `U${idx + 1}`,
        unitType: this.mapUnitType(entry.slipType || entry.entryType || 'wet_slip'),
        squareFeet: entry.squareFeet || entry.sqft,
        linearFeet: entry.linearFeet || entry.length,
        
        leaseStartDate: startDate,
        leaseEndDate: endDate,
        
        baseRent: monthlyRent * 12,
        rentPeriod: 'annual',
        
        escalationType: 'fixed',
        escalationRate: assumptions.marketRentGrowth,
        escalationFrequency: 'annual',
        
        renewalProbability: entry.renewalProbability || 0.75,
        renewalTermMonths: 12,
        renewalRentBump: assumptions.marketRentGrowth,
        
        freeRentMonths: 0,
        freeRentType: 'upfront',
        
        tenantImprovementPerSF: entry.unitType === 'commercial' ? assumptions.tiPerSF : 0,
        leasingCommissionRate: assumptions.lcRate,
        leasingCommissionMonths: assumptions.lcMonths,
        
        recoveryType: entry.recoveryType || 'net',
        recoveryRate: entry.recoveryRate || 1.0,
        baseYearExpenses: entry.baseYearExpenses,
        expenseStopAmount: entry.expenseStopAmount,
        camShare: entry.camShare || 1.0,
        taxShare: entry.taxShare || 1.0,
        insuranceShare: entry.insuranceShare || 1.0,
        
        percentageRent: false,
        percentageRentRate: 0,
        percentageRentBreakpoint: 0,
        miscIncome: 0,
        
        status: entry.status || 'active'
      } as LeaseTerms;
    });
  }
  
  private mapUnitType(type: string): LeaseTerms['unitType'] {
    const mapping: Record<string, LeaseTerms['unitType']> = {
      'wet': 'wet_slip',
      'wet_slip': 'wet_slip',
      'slip': 'wet_slip',
      'dry': 'dry_rack',
      'dry_rack': 'dry_rack',
      'rack': 'dry_rack',
      'mooring': 'mooring',
      'commercial': 'commercial',
      'seasonal': 'seasonal',
      'transient': 'transient'
    };
    return mapping[type.toLowerCase()] || 'wet_slip';
  }
  
  // ============================================================================
  // ASSUMPTIONS BUILDER
  // ============================================================================
  
  private buildMarketAssumptions(
    project: any,
    scenario: any,
    config: any,
    overrides?: Partial<MarketAssumptions>
  ): MarketAssumptions {
    const baseAssumptions: MarketAssumptions = {
      marketRentPerUnit: 10000,
      marketRentGrowth: parseFloat(scenario?.revenueGrowthRate?.toString() || '3') / 100,
      vacancyRate: 0.05,
      creditLoss: 0.01,
      downtimeMonths: 2,
      tiPerSF: 15,
      lcRate: 0.04,
      lcMonths: 1,
      cpiRate: 0.025,
      
      camPerUnit: 500,
      camGrowthRate: 0.025,
      taxPerUnit: 800,
      taxGrowthRate: 0.02,
      insurancePerUnit: 300,
      insuranceGrowthRate: 0.03,
      managementFeeRate: 0.04,
      replacementReserveRate: 0.02
    };
    
    return { ...baseAssumptions, ...overrides };
  }
  
  // ============================================================================
  // LEASE CASH FLOW CALCULATION
  // ============================================================================
  
  private calculateLeaseYearCashFlow(
    lease: LeaseTerms,
    yearIndex: number,
    periodYear: number,
    assumptions: MarketAssumptions,
    rolloverSchedule: RolloverEvent[]
  ): LeaseYearCashFlow {
    
    const yearStart = new Date(periodYear, 0, 1);
    const yearEnd = new Date(periodYear, 11, 31);
    
    // Check if lease is active during this year
    const leaseActive = lease.leaseEndDate >= yearStart && lease.leaseStartDate <= yearEnd;
    const isExpiring = lease.leaseEndDate >= yearStart && lease.leaseEndDate <= yearEnd;
    
    // Calculate months occupied
    let monthsOccupied = 12;
    let isVacant = false;
    let isRenewal = false;
    let isNewLease = false;
    
    if (!leaseActive) {
      // Lease expired before this year - check for renewal
      const existingRollover = rolloverSchedule.find(
        r => r.unitId === lease.unitId && r.year < periodYear
      );
      
      if (existingRollover?.outcome === 'renewal') {
        isRenewal = true;
      } else if (existingRollover?.outcome === 'turnover') {
        isNewLease = true;
        monthsOccupied = Math.max(0, 12 - existingRollover.downtimeMonths);
      } else {
        isVacant = true;
        monthsOccupied = 0;
      }
    }
    
    // Handle expiring leases
    if (isExpiring) {
      const renewalDetermined = Math.random() < lease.renewalProbability;
      const rolloverEvent: RolloverEvent = {
        year: periodYear,
        unitId: lease.unitId,
        tenantName: lease.tenantName,
        expiringRent: lease.baseRent,
        renewalProbability: lease.renewalProbability,
        outcome: renewalDetermined ? 'renewal' : 'turnover',
        newRent: lease.baseRent * (1 + lease.renewalRentBump),
        downtimeMonths: renewalDetermined ? 0 : assumptions.downtimeMonths,
        tiCost: renewalDetermined ? 0 : (lease.squareFeet || 0) * assumptions.tiPerSF,
        lcCost: renewalDetermined 
          ? lease.baseRent * assumptions.lcRate * 0.5 
          : lease.baseRent * assumptions.lcRate
      };
      rolloverSchedule.push(rolloverEvent);
      
      if (!renewalDetermined) {
        monthsOccupied = Math.ceil(
          (lease.leaseEndDate.getMonth() + 1) - assumptions.downtimeMonths
        );
      }
    }
    
    // Calculate rent with escalations
    const yearsFromStart = Math.max(0, yearIndex);
    const escalatedRent = this.calculateEscalatedRent(lease, yearsFromStart, assumptions);
    
    // Free rent calculation
    const freeRentAbatement = this.calculateFreeRent(lease, yearIndex);
    
    // Net base rent
    const occupancyFactor = monthsOccupied / 12;
    const netBaseRent = (escalatedRent - freeRentAbatement) * occupancyFactor;
    
    // Expense recoveries (for NNN/modified gross)
    const recoveries = this.calculateRecoveries(lease, assumptions, yearIndex, occupancyFactor);
    
    // Leasing costs at rollover
    const rollover = rolloverSchedule.find(r => r.unitId === lease.unitId && r.year === periodYear);
    const tenantImprovements = rollover?.tiCost || 0;
    const leasingCommissions = rollover?.lcCost || 0;
    
    // Totals
    const grossPotentialRent = escalatedRent;
    const effectiveGrossRent = netBaseRent + recoveries.total + lease.miscIncome;
    const netEffectiveRent = effectiveGrossRent - tenantImprovements - leasingCommissions;
    
    return {
      year: periodYear,
      period: yearIndex + 1,
      tenantId: lease.id,
      tenantName: lease.tenantName,
      unitId: lease.unitId,
      
      baseRent: lease.baseRent,
      escalatedRent,
      freeRentAbatement,
      netBaseRent,
      
      camRecovery: recoveries.cam,
      taxRecovery: recoveries.tax,
      insuranceRecovery: recoveries.insurance,
      totalRecoveries: recoveries.total,
      
      percentageRent: 0,
      miscIncome: lease.miscIncome * occupancyFactor,
      
      grossPotentialRent,
      effectiveGrossRent,
      
      tenantImprovements,
      leasingCommissions,
      totalLeasingCosts: tenantImprovements + leasingCommissions,
      
      netEffectiveRent,
      
      isRenewal,
      isNewLease,
      isVacant,
      monthsOccupied
    };
  }
  
  private calculateEscalatedRent(
    lease: LeaseTerms,
    yearsFromStart: number,
    assumptions: MarketAssumptions
  ): number {
    switch (lease.escalationType) {
      case 'fixed':
        return lease.baseRent * Math.pow(1 + lease.escalationRate, yearsFromStart);
      
      case 'cpi':
        return lease.baseRent * Math.pow(1 + assumptions.cpiRate, yearsFromStart);
      
      case 'stepped':
        if (lease.steppedRents && lease.steppedRents.length > 0) {
          const now = new Date();
          now.setFullYear(now.getFullYear() + yearsFromStart);
          const applicableStep = lease.steppedRents
            .filter(s => s.effectiveDate <= now)
            .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime())[0];
          return applicableStep?.newRent || lease.baseRent;
        }
        return lease.baseRent;
      
      case 'market':
        return assumptions.marketRentPerUnit * Math.pow(1 + assumptions.marketRentGrowth, yearsFromStart);
      
      default:
        return lease.baseRent * Math.pow(1 + lease.escalationRate, yearsFromStart);
    }
  }
  
  private calculateFreeRent(lease: LeaseTerms, yearIndex: number): number {
    if (lease.freeRentMonths === 0) return 0;
    
    const monthlyRent = lease.baseRent / 12;
    
    if (lease.freeRentType === 'upfront' && yearIndex === 0) {
      return monthlyRent * Math.min(lease.freeRentMonths, 12);
    }
    
    if (lease.freeRentType === 'spread') {
      // Spread free rent over first few years
      const spreadYears = Math.ceil(lease.freeRentMonths / 12);
      if (yearIndex < spreadYears) {
        return monthlyRent * Math.min(12, lease.freeRentMonths - yearIndex * 12);
      }
    }
    
    return 0;
  }
  
  private calculateRecoveries(
    lease: LeaseTerms,
    assumptions: MarketAssumptions,
    yearIndex: number,
    occupancyFactor: number
  ): { cam: number; tax: number; insurance: number; total: number } {
    
    if (lease.recoveryType === 'gross') {
      return { cam: 0, tax: 0, insurance: 0, total: 0 };
    }
    
    const camExpense = assumptions.camPerUnit * Math.pow(1 + assumptions.camGrowthRate, yearIndex);
    const taxExpense = assumptions.taxPerUnit * Math.pow(1 + assumptions.taxGrowthRate, yearIndex);
    const insuranceExpense = assumptions.insurancePerUnit * Math.pow(1 + assumptions.insuranceGrowthRate, yearIndex);
    
    let cam = 0, tax = 0, insurance = 0;
    
    switch (lease.recoveryType) {
      case 'net':
        cam = camExpense * lease.camShare * lease.recoveryRate * occupancyFactor;
        tax = taxExpense * lease.taxShare * lease.recoveryRate * occupancyFactor;
        insurance = insuranceExpense * lease.insuranceShare * lease.recoveryRate * occupancyFactor;
        break;
      
      case 'modified_gross':
        // Tenant pays increases over base year
        const baseYearExpenses = lease.baseYearExpenses || (camExpense + taxExpense + insuranceExpense);
        const currentExpenses = camExpense + taxExpense + insuranceExpense;
        const increase = Math.max(0, currentExpenses - baseYearExpenses);
        cam = increase * lease.camShare * occupancyFactor;
        break;
      
      case 'base_year_stop':
        // Similar to modified gross with base year stop
        const baseYear = lease.baseYearExpenses || assumptions.camPerUnit + assumptions.taxPerUnit + assumptions.insurancePerUnit;
        const currentTotal = camExpense + taxExpense + insuranceExpense;
        const excess = Math.max(0, currentTotal - baseYear);
        cam = excess * lease.recoveryRate * occupancyFactor;
        break;
      
      case 'expense_stop':
        // Tenant pays above expense stop amount
        const stopAmount = lease.expenseStopAmount || 0;
        const totalExpenses = camExpense + taxExpense + insuranceExpense;
        const aboveStop = Math.max(0, totalExpenses - stopAmount);
        cam = aboveStop * lease.recoveryRate * occupancyFactor;
        break;
    }
    
    return { cam, tax, insurance, total: cam + tax + insurance };
  }
  
  // ============================================================================
  // AGGREGATION
  // ============================================================================
  
  private aggregateYearlyCashFlows(
    leaseSchedule: LeaseYearCashFlow[],
    assumptions: MarketAssumptions,
    holdPeriod: number,
    baseYear: number,
    totalUnits: number
  ): YearlyCashFlowSummary[] {
    
    const yearlyTotals: YearlyCashFlowSummary[] = [];
    
    for (let y = 0; y < holdPeriod; y++) {
      const periodYear = baseYear + y;
      const yearLeases = leaseSchedule.filter(l => l.year === periodYear);
      
      // Revenue totals
      const potentialBaseRent = yearLeases.reduce((sum, l) => sum + l.grossPotentialRent, 0);
      const scheduledBaseRent = yearLeases.reduce((sum, l) => sum + l.escalatedRent, 0);
      const freeRent = yearLeases.reduce((sum, l) => sum + l.freeRentAbatement, 0);
      const effectiveBaseRent = yearLeases.reduce((sum, l) => sum + l.netBaseRent, 0);
      
      // Vacancy/absorption
      const occupiedMonths = yearLeases.reduce((sum, l) => sum + l.monthsOccupied, 0);
      const possibleMonths = yearLeases.length * 12;
      const occupancyRate = possibleMonths > 0 ? occupiedMonths / possibleMonths : 0;
      const absorptionVacancy = scheduledBaseRent * (1 - occupancyRate);
      
      // Recoveries
      const camRecoveries = yearLeases.reduce((sum, l) => sum + l.camRecovery, 0);
      const taxRecoveries = yearLeases.reduce((sum, l) => sum + l.taxRecovery, 0);
      const insuranceRecoveries = yearLeases.reduce((sum, l) => sum + l.insuranceRecovery, 0);
      const totalRecoveries = camRecoveries + taxRecoveries + insuranceRecoveries;
      
      // Other income
      const percentageRent = yearLeases.reduce((sum, l) => sum + l.percentageRent, 0);
      const miscIncome = yearLeases.reduce((sum, l) => sum + l.miscIncome, 0);
      
      // Total potential & effective gross
      const totalPotentialRevenue = potentialBaseRent + totalRecoveries + percentageRent + miscIncome;
      const vacancyCredit = absorptionVacancy * assumptions.creditLoss;
      const effectiveGrossRevenue = effectiveBaseRent + totalRecoveries + percentageRent + miscIncome - vacancyCredit;
      
      // Expenses (grown from base)
      const camExpenses = assumptions.camPerUnit * totalUnits * Math.pow(1 + assumptions.camGrowthRate, y);
      const taxExpenses = assumptions.taxPerUnit * totalUnits * Math.pow(1 + assumptions.taxGrowthRate, y);
      const insuranceExpenses = assumptions.insurancePerUnit * totalUnits * Math.pow(1 + assumptions.insuranceGrowthRate, y);
      const managementFee = effectiveGrossRevenue * assumptions.managementFeeRate;
      const utilities = effectiveGrossRevenue * 0.03; // 3% of revenue
      const repairsAndMaintenance = effectiveGrossRevenue * 0.04; // 4% of revenue
      const generalAndAdmin = effectiveGrossRevenue * 0.02; // 2% of revenue
      const otherExpenses = 0;
      
      const totalOperatingExpenses = camExpenses + taxExpenses + insuranceExpenses + 
        managementFee + utilities + repairsAndMaintenance + generalAndAdmin + otherExpenses;
      
      // NOI
      const netOperatingIncome = effectiveGrossRevenue - totalOperatingExpenses;
      
      // Capital costs
      const tenantImprovements = yearLeases.reduce((sum, l) => sum + l.tenantImprovements, 0);
      const leasingCommissions = yearLeases.reduce((sum, l) => sum + l.leasingCommissions, 0);
      const capitalReserves = effectiveGrossRevenue * assumptions.replacementReserveRate;
      const totalCapitalCosts = tenantImprovements + leasingCommissions + capitalReserves;
      
      // Cash flow
      const cashFlowBeforeDebt = netOperatingIncome - totalCapitalCosts;
      
      // Metrics
      const avgRentPerUnit = totalUnits > 0 ? effectiveBaseRent / totalUnits : 0;
      const expenseRatio = effectiveGrossRevenue > 0 ? totalOperatingExpenses / effectiveGrossRevenue : 0;
      
      yearlyTotals.push({
        year: periodYear,
        potentialBaseRent,
        scheduledBaseRent,
        absorptionVacancy,
        freeRent,
        effectiveBaseRent,
        camRecoveries,
        taxRecoveries,
        insuranceRecoveries,
        totalRecoveries,
        percentageRent,
        miscIncome,
        totalPotentialRevenue,
        vacancyCredit,
        effectiveGrossRevenue,
        camExpenses,
        taxExpenses,
        insuranceExpenses,
        managementFee,
        utilities,
        repairsAndMaintenance,
        generalAndAdmin,
        otherExpenses,
        totalOperatingExpenses,
        netOperatingIncome,
        tenantImprovements,
        leasingCommissions,
        capitalReserves,
        totalCapitalCosts,
        cashFlowBeforeDebt,
        occupancyRate,
        avgRentPerUnit,
        expenseRatio
      });
    }
    
    return yearlyTotals;
  }
  
  // ============================================================================
  // VALUATION METRICS
  // ============================================================================
  
  private calculateValuationMetrics(
    yearlyTotals: YearlyCashFlowSummary[],
    purchasePrice: number,
    assumptions: MarketAssumptions,
    holdPeriod: number,
    totalUnits: number
  ): ValuationMetrics {
    
    const year1NOI = yearlyTotals[0]?.netOperatingIncome || 0;
    const exitYearNOI = yearlyTotals[holdPeriod - 1]?.netOperatingIncome || year1NOI;
    const exitCapRate = 0.075; // 7.5% exit cap
    
    const exitValue = exitCapRate > 0 ? exitYearNOI / exitCapRate : 0;
    const saleCosts = exitValue * 0.02; // 2% sale costs
    const netSaleProceeds = exitValue - saleCosts;
    
    const goingInCapRate = purchasePrice > 0 ? year1NOI / purchasePrice : 0;
    const pricePerUnit = totalUnits > 0 ? purchasePrice / totalUnits : 0;
    const pricePerSF = 0; // Would need SF data
    
    // Cash flows for IRR
    const cashFlows = [
      -purchasePrice,
      ...yearlyTotals.slice(0, -1).map(y => y.cashFlowBeforeDebt),
      (yearlyTotals[holdPeriod - 1]?.cashFlowBeforeDebt || 0) + netSaleProceeds
    ];
    
    const unleveredIRR = this.calculateIRR(cashFlows);
    
    // Equity multiple
    const totalCashInflows = cashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
    const equityMultiple = purchasePrice > 0 ? (totalCashInflows + purchasePrice) / purchasePrice : 0;
    
    // Cash on cash
    const cashOnCash = yearlyTotals.map(y => 
      purchasePrice > 0 ? y.cashFlowBeforeDebt / purchasePrice : 0
    );
    const avgCashOnCash = cashOnCash.reduce((sum, c) => sum + c, 0) / cashOnCash.length;
    
    // NPV
    const discountRate = 0.08; // 8% discount rate
    const npv = this.calculateNPV(cashFlows, discountRate);
    
    // Break-even occupancy
    const fixedExpenses = yearlyTotals[0]?.totalOperatingExpenses || 0;
    const potentialRent = yearlyTotals[0]?.potentialBaseRent || 1;
    const breakEvenOccupancy = potentialRent > 0 ? fixedExpenses / potentialRent : 1;
    
    return {
      purchasePrice,
      goingInCapRate: goingInCapRate * 100,
      pricePerUnit,
      pricePerSF,
      exitCapRate: exitCapRate * 100,
      exitNOI: exitYearNOI,
      exitValue,
      saleCosts,
      netSaleProceeds,
      unleveredIRR: unleveredIRR * 100,
      leveredIRR: unleveredIRR * 100 * 1.2, // Simplified levered calc
      equityMultiple,
      cashOnCash: cashOnCash.map(c => c * 100),
      avgCashOnCash: avgCashOnCash * 100,
      npv,
      discountRate: discountRate * 100,
      breakEvenOccupancy: breakEvenOccupancy * 100,
      dscr: yearlyTotals.map(() => 1.5), // Would need debt info
      avgDSCR: 1.5
    };
  }
  
  private calculateIRR(cashFlows: number[], guess: number = 0.1): number {
    const maxIterations = 100;
    const precision = 0.00001;
    let rate = guess;
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;
      
      for (let j = 0; j < cashFlows.length; j++) {
        npv += cashFlows[j] / Math.pow(1 + rate, j);
        dnpv -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
      }
      
      if (Math.abs(dnpv) < precision) break;
      
      const newRate = rate - npv / dnpv;
      if (Math.abs(newRate - rate) < precision) {
        return newRate;
      }
      rate = newRate;
    }
    
    return rate;
  }
  
  private calculateNPV(cashFlows: number[], rate: number): number {
    return cashFlows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, i), 0);
  }
  
  // ============================================================================
  // ROLLOVER ANALYSIS
  // ============================================================================
  
  async getRolloverSchedule(
    projectId: string,
    orgId: string
  ): Promise<{ year: number; expiringUnits: number; expiringRent: number; percentOfTotal: number }[]> {
    const cashFlow = await this.calculatePropertyCashFlow(projectId, orgId);
    
    const rolloverByYear: Record<number, { units: number; rent: number }> = {};
    const totalRent = cashFlow.yearlyTotals[0]?.potentialBaseRent || 1;
    
    for (const event of cashFlow.rolloverSchedule) {
      if (!rolloverByYear[event.year]) {
        rolloverByYear[event.year] = { units: 0, rent: 0 };
      }
      rolloverByYear[event.year].units++;
      rolloverByYear[event.year].rent += event.expiringRent;
    }
    
    return Object.entries(rolloverByYear)
      .map(([year, data]) => ({
        year: parseInt(year),
        expiringUnits: data.units,
        expiringRent: data.rent,
        percentOfTotal: (data.rent / totalRent) * 100
      }))
      .sort((a, b) => a.year - b.year);
  }
  
  // ============================================================================
  // TENANT PERFORMANCE
  // ============================================================================
  
  async getTenantPerformance(
    projectId: string,
    orgId: string
  ): Promise<{
    tenantId: string;
    tenantName: string;
    unitId: string;
    annualRent: number;
    percentOfTotal: number;
    leaseExpiry: string;
    monthsRemaining: number;
    occupancyCost?: number;
  }[]> {
    const cashFlow = await this.calculatePropertyCashFlow(projectId, orgId);
    const year1Leases = cashFlow.leaseSchedule.filter(l => l.period === 1);
    const totalRent = year1Leases.reduce((sum, l) => sum + l.effectiveGrossRent, 0);
    
    return year1Leases.map(lease => ({
      tenantId: lease.tenantId,
      tenantName: lease.tenantName,
      unitId: lease.unitId,
      annualRent: lease.effectiveGrossRent,
      percentOfTotal: totalRent > 0 ? (lease.effectiveGrossRent / totalRent) * 100 : 0,
      leaseExpiry: 'N/A',
      monthsRemaining: lease.monthsOccupied
    }));
  }
}

export const leaseCashFlowEngine = new LeaseCashFlowEngine();
