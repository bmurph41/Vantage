/**
 * Marina KPI Calculator Service
 * 
 * Calculates institutional-grade marina metrics from Rent Roll data:
 * - Occupancy Rate (dock utilization by linear feet)
 * - Average Daily Rate (ADR) for slips
 * - Revenue per Available Linear Foot (RevPALF)
 * - NOI and NOI Margin
 * - Ancillary Revenue aggregation
 */

import { db } from "../../db";
import { 
  rentRolls, 
  rentRollEntries, 
  fuelSales, 
  shipStoreTransactions,
  rentRollSnapshots
} from "@shared/schema";
import { eq, and, gte, lte, sql, sum, count, avg } from "drizzle-orm";

export interface MarinaOccupancyMetrics {
  totalSlips: number;
  occupiedSlips: number;
  vacantSlips: number;
  occupancyRate: number; // 0-100%
  
  // By type breakdown
  wetSlipOccupancy: number;
  dryStorageOccupancy: number;
  seasonalOccupancy: number;
  
  // Linear foot metrics (if available)
  totalLinearFeet: number | null;
  occupiedLinearFeet: number | null;
  lfOccupancyRate: number | null;
}

export interface MarinaRevenueMetrics {
  // Slip revenue
  grossSlipRevenue: number;
  avgMonthlyRate: number;
  avgDailyRate: number; // ADR
  revPalf: number; // Revenue per Available Linear Foot (annualized)
  revenuePerSlip: number;
  
  // Ancillary revenue
  fuelRevenue: number;
  fuelMargin: number;
  fuelGallonsSold: number;
  shipStoreRevenue: number;
  shipStoreMargin: number;
  totalAncillaryRevenue: number;
  
  // Totals
  totalGrossRevenue: number;
  ancillaryRevenuePercent: number;
}

export interface MarinaProfitabilityMetrics {
  grossRevenue: number;
  operatingExpenses: number; // Estimated or provided
  netOperatingIncome: number;
  noiMargin: number; // NOI as % of revenue
  
  // Valuation metrics
  impliedCapRate: number | null; // If valuation provided
  impliedValue: number | null; // NOI / cap rate
}

export interface MarinaDebtMetrics {
  annualDebtService: number | null;
  dscr: number | null; // Debt Service Coverage Ratio
  loanAmount: number | null;
  propertyValue: number | null;
  ltv: number | null; // Loan-to-Value
}

export interface MarinaKpiSummary {
  asOf: Date;
  periodStart: Date;
  periodEnd: Date;
  occupancy: MarinaOccupancyMetrics;
  revenue: MarinaRevenueMetrics;
  profitability: MarinaProfitabilityMetrics;
  debt: MarinaDebtMetrics;
  
  // Trend data (optional, for charts)
  trends?: {
    occupancyTrend: Array<{ period: string; value: number }>;
    revenueTrend: Array<{ period: string; value: number }>;
    adrTrend: Array<{ period: string; value: number }>;
  };
  
  // Data quality
  dataQualityScore: number; // 0-100
  dataWarnings: string[];
}

export interface CalculationParams {
  orgId: string;
  rentRollId?: string;
  projectId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  assumedExpenseRatio?: number; // Default 0.35 (35%)
  assumedCapRate?: number; // For valuation
  propertyValue?: number;
  loanAmount?: number;
  annualDebtService?: number;
  linearFeetPerSlip?: number; // Average linear feet if not tracked per slip
}

export class MarinaKpiCalculator {
  
  /**
   * Calculate comprehensive marina KPIs for a given rent roll or project
   */
  async calculateKpis(params: CalculationParams): Promise<MarinaKpiSummary> {
    const { 
      orgId, 
      rentRollId, 
      projectId,
      periodStart = new Date(new Date().getFullYear(), 0, 1), // YTD default
      periodEnd = new Date(),
      assumedExpenseRatio = 0.35,
      assumedCapRate,
      propertyValue,
      loanAmount,
      annualDebtService,
      linearFeetPerSlip = 35 // Industry average
    } = params;

    const dataWarnings: string[] = [];

    // 1. Get rent roll entries for occupancy and slip revenue
    const occupancy = await this.calculateOccupancy(orgId, rentRollId, projectId, linearFeetPerSlip, dataWarnings);
    
    // 2. Calculate slip revenue metrics
    const slipRevenue = await this.calculateSlipRevenue(orgId, rentRollId, projectId, occupancy.totalLinearFeet || (occupancy.totalSlips * linearFeetPerSlip));
    
    // 3. Get ancillary revenue (fuel, ship store)
    const ancillaryRevenue = await this.calculateAncillaryRevenue(orgId, periodStart, periodEnd);
    
    // 4. Combine revenue metrics
    const revenue: MarinaRevenueMetrics = {
      ...slipRevenue,
      ...ancillaryRevenue,
      totalGrossRevenue: slipRevenue.grossSlipRevenue + ancillaryRevenue.totalAncillaryRevenue,
      ancillaryRevenuePercent: ancillaryRevenue.totalAncillaryRevenue > 0 
        ? (ancillaryRevenue.totalAncillaryRevenue / (slipRevenue.grossSlipRevenue + ancillaryRevenue.totalAncillaryRevenue)) * 100 
        : 0
    };
    
    // 5. Calculate profitability
    const profitability = this.calculateProfitability(
      revenue.totalGrossRevenue,
      assumedExpenseRatio,
      assumedCapRate,
      propertyValue
    );
    
    // 6. Calculate debt metrics
    const debt = this.calculateDebtMetrics(
      profitability.netOperatingIncome,
      annualDebtService,
      loanAmount,
      propertyValue
    );
    
    // 7. Calculate data quality score
    const dataQualityScore = this.calculateDataQualityScore(occupancy, revenue, dataWarnings);

    return {
      asOf: new Date(),
      periodStart,
      periodEnd,
      occupancy,
      revenue,
      profitability,
      debt,
      dataQualityScore,
      dataWarnings
    };
  }

  /**
   * Calculate occupancy metrics from rent roll entries
   */
  private async calculateOccupancy(
    orgId: string,
    rentRollId: string | undefined,
    projectId: string | undefined,
    linearFeetPerSlip: number,
    dataWarnings: string[]
  ): Promise<MarinaOccupancyMetrics> {
    
    // Build query conditions
    const conditions = [eq(rentRollEntries.orgId, orgId)];
    
    if (rentRollId) {
      conditions.push(eq(rentRollEntries.rentRollId, rentRollId));
    }

    // Get all entries
    const entries = await db
      .select({
        entryType: rentRollEntries.entryType,
        status: rentRollEntries.status,
        monthlyRate: rentRollEntries.monthlyRate,
      })
      .from(rentRollEntries)
      .where(and(...conditions));

    if (entries.length === 0) {
      dataWarnings.push("No rent roll entries found - using placeholder data");
      return this.getPlaceholderOccupancy();
    }

    const totalSlips = entries.length;
    const occupiedEntries = entries.filter(e => e.status === 'active' || e.status === 'reserved');
    const occupiedSlips = occupiedEntries.length;
    const vacantSlips = totalSlips - occupiedSlips;
    
    // Calculate by type
    const wetSlips = entries.filter(e => e.entryType === 'slip');
    const dryStorage = entries.filter(e => e.entryType === 'rack');
    const seasonal = entries.filter(e => e.entryType === 'seasonal');
    
    const wetSlipOccupied = wetSlips.filter(e => e.status === 'active' || e.status === 'reserved').length;
    const dryStorageOccupied = dryStorage.filter(e => e.status === 'active' || e.status === 'reserved').length;
    const seasonalOccupied = seasonal.filter(e => e.status === 'active' || e.status === 'reserved').length;

    // Estimate linear feet (could be enhanced with actual LF data per slip)
    const totalLinearFeet = totalSlips * linearFeetPerSlip;
    const occupiedLinearFeet = occupiedSlips * linearFeetPerSlip;

    return {
      totalSlips,
      occupiedSlips,
      vacantSlips,
      occupancyRate: totalSlips > 0 ? (occupiedSlips / totalSlips) * 100 : 0,
      wetSlipOccupancy: wetSlips.length > 0 ? (wetSlipOccupied / wetSlips.length) * 100 : 0,
      dryStorageOccupancy: dryStorage.length > 0 ? (dryStorageOccupied / dryStorage.length) * 100 : 0,
      seasonalOccupancy: seasonal.length > 0 ? (seasonalOccupied / seasonal.length) * 100 : 0,
      totalLinearFeet,
      occupiedLinearFeet,
      lfOccupancyRate: totalLinearFeet > 0 ? (occupiedLinearFeet / totalLinearFeet) * 100 : null
    };
  }

  /**
   * Calculate slip revenue metrics
   */
  private async calculateSlipRevenue(
    orgId: string,
    rentRollId: string | undefined,
    projectId: string | undefined,
    totalLinearFeet: number
  ): Promise<Pick<MarinaRevenueMetrics, 'grossSlipRevenue' | 'avgMonthlyRate' | 'avgDailyRate' | 'revPalf' | 'revenuePerSlip'>> {
    
    const conditions = [
      eq(rentRollEntries.orgId, orgId),
    ];
    
    if (rentRollId) {
      conditions.push(eq(rentRollEntries.rentRollId, rentRollId));
    }

    // Get occupied entries with rates
    const occupiedConditions = [
      ...conditions,
      sql`${rentRollEntries.status} IN ('active', 'reserved')`
    ];

    const revenueData = await db
      .select({
        totalMonthlyRevenue: sql<string>`COALESCE(SUM(${rentRollEntries.monthlyRate}::numeric), 0)`,
        avgRate: sql<string>`COALESCE(AVG(${rentRollEntries.monthlyRate}::numeric), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(rentRollEntries)
      .where(and(...occupiedConditions));

    const data = revenueData[0];
    const monthlyRevenue = parseFloat(data?.totalMonthlyRevenue || '0');
    const avgMonthlyRate = parseFloat(data?.avgRate || '0');
    const occupiedCount = Number(data?.count || 0);
    
    const annualSlipRevenue = monthlyRevenue * 12;
    const avgDailyRate = avgMonthlyRate / 30; // Approximate daily rate
    
    // RevPALF = Annual Revenue / Total Linear Feet
    const revPalf = totalLinearFeet > 0 ? annualSlipRevenue / totalLinearFeet : 0;
    
    // Revenue per slip (annualized)
    const revenuePerSlip = occupiedCount > 0 ? annualSlipRevenue / occupiedCount : 0;

    return {
      grossSlipRevenue: annualSlipRevenue,
      avgMonthlyRate,
      avgDailyRate,
      revPalf,
      revenuePerSlip
    };
  }

  /**
   * Calculate ancillary revenue from fuel sales and ship store
   */
  private async calculateAncillaryRevenue(
    orgId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Pick<MarinaRevenueMetrics, 'fuelRevenue' | 'fuelMargin' | 'fuelGallonsSold' | 'shipStoreRevenue' | 'shipStoreMargin' | 'totalAncillaryRevenue'>> {
    
    // Get fuel sales for period
    let fuelRevenue = 0;
    let fuelMargin = 0;
    let fuelGallonsSold = 0;
    
    try {
      const fuelData = await db
        .select({
          totalRevenue: sql<string>`COALESCE(SUM(${fuelSales.totalAmount}::numeric), 0)`,
          totalGallons: sql<string>`COALESCE(SUM(${fuelSales.quantityGallons}::numeric), 0)`,
        })
        .from(fuelSales)
        .where(and(
          eq(fuelSales.orgId, orgId),
          gte(fuelSales.transactionDate, periodStart),
          lte(fuelSales.transactionDate, periodEnd)
        ));

      fuelRevenue = parseFloat(fuelData[0]?.totalRevenue || '0');
      fuelGallonsSold = parseFloat(fuelData[0]?.totalGallons || '0');
      // Estimate margin at 15% (industry typical)
      fuelMargin = fuelRevenue * 0.15;
    } catch (e) {
      // Fuel sales table may not have data
    }

    // Get ship store revenue for period
    let shipStoreRevenue = 0;
    let shipStoreMargin = 0;
    
    try {
      const storeData = await db
        .select({
          totalRevenue: sql<string>`COALESCE(SUM(${shipStoreTransactions.total}::numeric), 0)`,
          totalCost: sql<string>`COALESCE(SUM(${shipStoreTransactions.subtotal}::numeric * 0.7), 0)`, // Estimate COGS at 70% of subtotal
        })
        .from(shipStoreTransactions)
        .where(and(
          gte(shipStoreTransactions.createdAt, periodStart),
          lte(shipStoreTransactions.createdAt, periodEnd)
        ));

      shipStoreRevenue = parseFloat(storeData[0]?.totalRevenue || '0');
      const costOfGoods = parseFloat(storeData[0]?.totalCost || '0');
      shipStoreMargin = shipStoreRevenue - costOfGoods;
    } catch (e) {
      // Ship store table may not have data
    }

    return {
      fuelRevenue,
      fuelMargin,
      fuelGallonsSold,
      shipStoreRevenue,
      shipStoreMargin,
      totalAncillaryRevenue: fuelRevenue + shipStoreRevenue
    };
  }

  /**
   * Calculate profitability metrics
   */
  private calculateProfitability(
    grossRevenue: number,
    expenseRatio: number,
    assumedCapRate?: number,
    propertyValue?: number
  ): MarinaProfitabilityMetrics {
    
    const operatingExpenses = grossRevenue * expenseRatio;
    const netOperatingIncome = grossRevenue - operatingExpenses;
    const noiMargin = grossRevenue > 0 ? (netOperatingIncome / grossRevenue) * 100 : 0;
    
    // Calculate implied cap rate if value provided
    let impliedCapRate: number | null = null;
    let impliedValue: number | null = null;
    
    if (propertyValue && propertyValue > 0) {
      impliedCapRate = (netOperatingIncome / propertyValue) * 100;
    } else if (assumedCapRate && assumedCapRate > 0) {
      impliedValue = netOperatingIncome / (assumedCapRate / 100);
    }

    return {
      grossRevenue,
      operatingExpenses,
      netOperatingIncome,
      noiMargin,
      impliedCapRate,
      impliedValue
    };
  }

  /**
   * Calculate debt metrics
   */
  private calculateDebtMetrics(
    noi: number,
    annualDebtService?: number,
    loanAmount?: number,
    propertyValue?: number
  ): MarinaDebtMetrics {
    
    let dscr: number | null = null;
    let ltv: number | null = null;
    
    if (annualDebtService && annualDebtService > 0) {
      dscr = noi / annualDebtService;
    }
    
    if (loanAmount && propertyValue && propertyValue > 0) {
      ltv = (loanAmount / propertyValue) * 100;
    }

    return {
      annualDebtService: annualDebtService || null,
      dscr,
      loanAmount: loanAmount || null,
      propertyValue: propertyValue || null,
      ltv
    };
  }

  /**
   * Calculate data quality score based on available data
   */
  private calculateDataQualityScore(
    occupancy: MarinaOccupancyMetrics,
    revenue: MarinaRevenueMetrics,
    warnings: string[]
  ): number {
    let score = 100;
    
    // Deduct for missing data
    if (occupancy.totalSlips === 0) score -= 30;
    if (revenue.grossSlipRevenue === 0) score -= 20;
    if (occupancy.totalLinearFeet === null) score -= 10;
    if (revenue.fuelRevenue === 0) score -= 5;
    if (revenue.shipStoreRevenue === 0) score -= 5;
    
    // Deduct for each warning
    score -= warnings.length * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get placeholder occupancy data when no entries exist
   */
  private getPlaceholderOccupancy(): MarinaOccupancyMetrics {
    return {
      totalSlips: 0,
      occupiedSlips: 0,
      vacantSlips: 0,
      occupancyRate: 0,
      wetSlipOccupancy: 0,
      dryStorageOccupancy: 0,
      seasonalOccupancy: 0,
      totalLinearFeet: null,
      occupiedLinearFeet: null,
      lfOccupancyRate: null
    };
  }

  /**
   * Get monthly trend data for charts
   */
  async calculateTrends(
    orgId: string,
    months: number = 12,
    ownedAssetId?: string
  ): Promise<{
    occupancyTrend: Array<{ period: string; value: number }>;
    revenueTrend: Array<{ period: string; value: number }>;
  }> {
    const safeMonths = Math.max(1, Math.min(36, Math.floor(Number.isFinite(months) ? months : 12)));
    const periodFilter = sql`(${rentRollSnapshots.snapshotYear} * 100 + ${rentRollSnapshots.snapshotMonth}) >= (
      EXTRACT(YEAR FROM NOW() - INTERVAL '${sql.raw(String(safeMonths))} months')::int * 100 +
      EXTRACT(MONTH FROM NOW() - INTERVAL '${sql.raw(String(safeMonths))} months')::int
    )`;
    const whereClause = ownedAssetId
      ? and(eq(rentRollSnapshots.orgId, orgId), eq(rentRollSnapshots.ownedAssetId, ownedAssetId), periodFilter)
      : and(eq(rentRollSnapshots.orgId, orgId), periodFilter);
    const rows = await db
      .select({
        year: rentRollSnapshots.snapshotYear,
        month: rentRollSnapshots.snapshotMonth,
        occupancyRate: avg(rentRollSnapshots.occupancyRate),
        revenue: sum(rentRollSnapshots.grossPotentialRevenue),
      })
      .from(rentRollSnapshots)
      .where(whereClause)
      .groupBy(rentRollSnapshots.snapshotYear, rentRollSnapshots.snapshotMonth)
      .orderBy(rentRollSnapshots.snapshotYear, rentRollSnapshots.snapshotMonth);

    const occupancyTrend: Array<{ period: string; value: number }> = [];
    const revenueTrend: Array<{ period: string; value: number }> = [];

    for (const row of rows) {
      const period = `${row.year}-${String(row.month).padStart(2, '0')}`;
      occupancyTrend.push({ period, value: parseFloat(row.occupancyRate as string ?? '0') });
      revenueTrend.push({ period, value: parseFloat(row.revenue as string ?? '0') });
    }

    return { occupancyTrend, revenueTrend };
  }
}

// Export singleton instance
export const marinaKpiCalculator = new MarinaKpiCalculator();
