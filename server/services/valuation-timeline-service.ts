import { db } from '../db';
import { 
  valuationSnapshots, 
  valuationSnapshotSources,
  modelingProjects,
  rentRolls,
  rentRollEntries,
  fuelSales,
  shipStoreTransactions,
  compSets,
  compSetItems,
  rateComps,
  salesComps
} from '@shared/schema';
import { eq, and, lte, gte, desc, sql, sum } from 'drizzle-orm';

export interface ValuationTimelineQuery {
  modelingProjectId: string;
  orgId: string;
  asOfDate?: Date;
  userId?: string;
}

export interface OperationsDataSummary {
  rentRoll: {
    totalRevenue: number;
    entryCount: number;
    latestDate: Date | null;
  };
  fuelSales: {
    totalRevenue: number;
    totalCogs: number;
    margin: number;
    transactionCount: number;
    latestDate: Date | null;
  };
  shipStore: {
    totalRevenue: number;
    totalCogs: number;
    margin: number;
    transactionCount: number;
    latestDate: Date | null;
  };
}

export interface CompSetSummary {
  rateSet?: {
    id: string;
    name: string;
    indication: number | null;
    compCount: number;
    computedAt: Date | null;
  };
  salesSet?: {
    id: string;
    name: string;
    indication: number | null;
    compCount: number;
    computedAt: Date | null;
  };
}

export interface ValuationResult {
  snapshotId?: string;
  isHistorical: boolean;
  asOfDate: Date;
  dataAsOfDate: Date;
  
  purchasePrice: number | null;
  indicatedValue: number | null;
  capRate: number | null;
  
  grossRevenue: number;
  operatingExpenses: number;
  noi: number;
  ebitda: number;
  
  revenueBreakdown: {
    rentRoll: number;
    fuel: number;
    fuelCogs: number;
    fuelMargin: number;
    shipStore: number;
    shipStoreCogs: number;
    shipStoreMargin: number;
    other: number;
  };
  
  returns?: {
    irr: number | null;
    equityMultiple: number | null;
    cashOnCash: number | null;
  };
  
  compSummary: CompSetSummary;
  operationsData: OperationsDataSummary;
  
  sources: Array<{
    sourceType: string;
    sourceId: string;
    dataAsOf: Date | null;
    revenueContribution: number;
  }>;
}

export class ValuationTimelineService {
  async getValuationAsOf(query: ValuationTimelineQuery): Promise<ValuationResult> {
    const asOfDate = query.asOfDate || new Date();
    
    const existingSnapshot = await this.findSnapshotForDate(
      query.modelingProjectId,
      query.orgId,
      asOfDate
    );
    
    if (existingSnapshot) {
      return this.snapshotToResult(existingSnapshot);
    }
    
    return this.computeValuationAsOf(query, asOfDate);
  }

  async getValuationTimeline(
    modelingProjectId: string,
    orgId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ValuationResult[]> {
    const conditions = [
      eq(valuationSnapshots.modelingProjectId, modelingProjectId),
      eq(valuationSnapshots.orgId, orgId)
    ];
    
    if (startDate) {
      conditions.push(gte(valuationSnapshots.snapshotDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(valuationSnapshots.snapshotDate, endDate));
    }
    
    const snapshots = await db.select()
      .from(valuationSnapshots)
      .where(and(...conditions))
      .orderBy(desc(valuationSnapshots.snapshotDate));
    
    return snapshots.map(s => this.snapshotToResult(s));
  }

  async createSnapshot(
    query: ValuationTimelineQuery,
    trigger: 'manual' | 'scheduled' | 'data_change' | 'comp_update' | 'model_save' = 'manual',
    triggerNote?: string
  ): Promise<ValuationResult> {
    const asOfDate = query.asOfDate || new Date();
    const valuation = await this.computeValuationAsOf(query, asOfDate);
    
    const [snapshot] = await db.insert(valuationSnapshots).values({
      orgId: query.orgId,
      modelingProjectId: query.modelingProjectId,
      snapshotDate: asOfDate,
      dataAsOfDate: valuation.dataAsOfDate.toISOString().split('T')[0],
      createdBy: query.userId,
      trigger,
      triggerNote,
      purchasePrice: valuation.purchasePrice?.toString(),
      indicatedValue: valuation.indicatedValue?.toString(),
      capRate: valuation.capRate?.toString(),
      grossRevenue: valuation.grossRevenue.toString(),
      effectiveGrossIncome: valuation.grossRevenue.toString(),
      operatingExpenses: valuation.operatingExpenses.toString(),
      noi: valuation.noi.toString(),
      ebitda: valuation.ebitda.toString(),
      rentRollRevenue: valuation.revenueBreakdown.rentRoll.toString(),
      fuelRevenue: valuation.revenueBreakdown.fuel.toString(),
      fuelCogs: valuation.revenueBreakdown.fuelCogs.toString(),
      fuelMargin: valuation.revenueBreakdown.fuelMargin.toString(),
      shipStoreRevenue: valuation.revenueBreakdown.shipStore.toString(),
      shipStoreCogs: valuation.revenueBreakdown.shipStoreCogs.toString(),
      shipStoreMargin: valuation.revenueBreakdown.shipStoreMargin.toString(),
      otherRevenue: valuation.revenueBreakdown.other.toString(),
      irr: valuation.returns?.irr?.toString(),
      equityMultiple: valuation.returns?.equityMultiple?.toString(),
      cashOnCash: valuation.returns?.cashOnCash?.toString(),
      rateCompSetId: valuation.compSummary.rateSet?.id,
      salesCompSetId: valuation.compSummary.salesSet?.id,
      rateIndication: valuation.compSummary.rateSet?.indication?.toString(),
      salesIndication: valuation.compSummary.salesSet?.indication?.toString(),
      inputData: { asOfDate: asOfDate.toISOString() },
      computedData: valuation,
      modelVersion: '1.0.0'
    }).returning();
    
    for (const source of valuation.sources) {
      await db.insert(valuationSnapshotSources).values({
        snapshotId: snapshot.id,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        dataAsOf: source.dataAsOf?.toISOString().split('T')[0],
        revenueContribution: source.revenueContribution.toString(),
        metadata: {}
      });
    }
    
    return { ...valuation, snapshotId: snapshot.id };
  }

  private async findSnapshotForDate(
    modelingProjectId: string,
    orgId: string,
    asOfDate: Date
  ): Promise<typeof valuationSnapshots.$inferSelect | null> {
    const startOfDay = new Date(asOfDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(asOfDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [snapshot] = await db.select()
      .from(valuationSnapshots)
      .where(and(
        eq(valuationSnapshots.modelingProjectId, modelingProjectId),
        eq(valuationSnapshots.orgId, orgId),
        gte(valuationSnapshots.snapshotDate, startOfDay),
        lte(valuationSnapshots.snapshotDate, endOfDay)
      ))
      .orderBy(desc(valuationSnapshots.snapshotDate))
      .limit(1);
    
    return snapshot || null;
  }

  private async computeValuationAsOf(
    query: ValuationTimelineQuery,
    asOfDate: Date
  ): Promise<ValuationResult> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, query.modelingProjectId),
        eq(modelingProjects.orgId, query.orgId)
      ));
    
    if (!project) {
      throw new Error('Modeling project not found');
    }
    
    const operationsData = await this.getOperationsDataAsOf(query.orgId, project.id, asOfDate);
    const compSummary = await this.getCompSummary(query.orgId, project.id);
    
    const grossRevenue = 
      operationsData.rentRoll.totalRevenue +
      operationsData.fuelSales.totalRevenue +
      operationsData.shipStore.totalRevenue;
    
    const totalCogs = 
      operationsData.fuelSales.totalCogs +
      operationsData.shipStore.totalCogs;
    
    const grossProfit = grossRevenue - totalCogs;
    const expenseRatio = 0.35;
    const operatingExpenses = grossProfit * expenseRatio;
    const noi = grossProfit - operatingExpenses;
    const ebitda = noi * 1.05;
    
    const purchasePrice = project.purchasePrice ? parseFloat(project.purchasePrice) : null;
    
    let capRate = project.year1CapRate ? parseFloat(project.year1CapRate) / 100 : null;
    if (!capRate && compSummary.salesSet?.indication) {
      capRate = 0.075;
    }
    
    let indicatedValue = capRate && noi > 0 ? noi / capRate : null;
    if (compSummary.salesSet?.indication && project.totalStorageUnits) {
      const compIndicatedValue = compSummary.salesSet.indication * project.totalStorageUnits;
      indicatedValue = indicatedValue 
        ? (indicatedValue + compIndicatedValue) / 2 
        : compIndicatedValue;
    }
    
    const latestDate = this.getLatestDate([
      operationsData.rentRoll.latestDate,
      operationsData.fuelSales.latestDate,
      operationsData.shipStore.latestDate
    ]);
    
    const sources: ValuationResult['sources'] = [];
    
    if (operationsData.rentRoll.entryCount > 0) {
      sources.push({
        sourceType: 'rent_roll',
        sourceId: project.id,
        dataAsOf: operationsData.rentRoll.latestDate,
        revenueContribution: operationsData.rentRoll.totalRevenue
      });
    }
    
    if (operationsData.fuelSales.transactionCount > 0) {
      sources.push({
        sourceType: 'fuel_sales',
        sourceId: project.id,
        dataAsOf: operationsData.fuelSales.latestDate,
        revenueContribution: operationsData.fuelSales.totalRevenue
      });
    }
    
    if (operationsData.shipStore.transactionCount > 0) {
      sources.push({
        sourceType: 'ship_store',
        sourceId: project.id,
        dataAsOf: operationsData.shipStore.latestDate,
        revenueContribution: operationsData.shipStore.totalRevenue
      });
    }
    
    if (compSummary.rateSet) {
      sources.push({
        sourceType: 'rate_comp',
        sourceId: compSummary.rateSet.id,
        dataAsOf: compSummary.rateSet.computedAt,
        revenueContribution: 0
      });
    }
    
    if (compSummary.salesSet) {
      sources.push({
        sourceType: 'sales_comp',
        sourceId: compSummary.salesSet.id,
        dataAsOf: compSummary.salesSet.computedAt,
        revenueContribution: 0
      });
    }
    
    return {
      isHistorical: false,
      asOfDate,
      dataAsOfDate: latestDate || asOfDate,
      purchasePrice,
      indicatedValue,
      capRate,
      grossRevenue,
      operatingExpenses,
      noi,
      ebitda,
      revenueBreakdown: {
        rentRoll: operationsData.rentRoll.totalRevenue,
        fuel: operationsData.fuelSales.totalRevenue,
        fuelCogs: operationsData.fuelSales.totalCogs,
        fuelMargin: operationsData.fuelSales.margin,
        shipStore: operationsData.shipStore.totalRevenue,
        shipStoreCogs: operationsData.shipStore.totalCogs,
        shipStoreMargin: operationsData.shipStore.margin,
        other: 0
      },
      returns: project.ebitda && purchasePrice ? {
        irr: null,
        equityMultiple: null,
        cashOnCash: null
      } : undefined,
      compSummary,
      operationsData,
      sources
    };
  }

  private async getOperationsDataAsOf(
    orgId: string,
    projectId: string,
    asOfDate: Date
  ): Promise<OperationsDataSummary> {
    const asOfDateStr = asOfDate.toISOString().split('T')[0];
    
    const rentRollData = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(${rentRollEntries.monthlyRent}), 0)`,
      entryCount: sql<string>`COUNT(*)`,
      latestDate: sql<string>`MAX(${rentRollEntries.startDate})`
    })
    .from(rentRollEntries)
    .innerJoin(rentRolls, eq(rentRollEntries.rentRollId, rentRolls.id))
    .where(and(
      eq(rentRolls.orgId, orgId),
      lte(rentRollEntries.startDate, asOfDateStr)
    ));
    
    const fuelData = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(${fuelSales.totalAmount}), 0)`,
      totalCogs: sql<string>`COALESCE(SUM(${fuelSales.costAmount}), 0)`,
      transactionCount: sql<string>`COUNT(*)`,
      latestDate: sql<string>`MAX(${fuelSales.transactionDate})`
    })
    .from(fuelSales)
    .where(and(
      eq(fuelSales.orgId, orgId),
      lte(fuelSales.transactionDate, asOfDate)
    ));
    
    const shipStoreData = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(${shipStoreTransactions.totalAmount}), 0)`,
      totalCogs: sql<string>`COALESCE(SUM(${shipStoreTransactions.totalCost}), 0)`,
      transactionCount: sql<string>`COUNT(*)`,
      latestDate: sql<string>`MAX(${shipStoreTransactions.transactionDate})`
    })
    .from(shipStoreTransactions)
    .where(and(
      eq(shipStoreTransactions.orgId, orgId),
      lte(shipStoreTransactions.transactionDate, asOfDate)
    ));
    
    const rentRoll = rentRollData[0];
    const fuel = fuelData[0];
    const shipStore = shipStoreData[0];
    
    const fuelRevenue = parseFloat(fuel?.totalRevenue || '0');
    const fuelCogs = parseFloat(fuel?.totalCogs || '0');
    const shipStoreRevenue = parseFloat(shipStore?.totalRevenue || '0');
    const shipStoreCogs = parseFloat(shipStore?.totalCost || '0');
    
    return {
      rentRoll: {
        totalRevenue: parseFloat(rentRoll?.totalRevenue || '0') * 12,
        entryCount: parseInt(rentRoll?.entryCount || '0'),
        latestDate: rentRoll?.latestDate ? new Date(rentRoll.latestDate) : null
      },
      fuelSales: {
        totalRevenue: fuelRevenue,
        totalCogs: fuelCogs,
        margin: fuelRevenue - fuelCogs,
        transactionCount: parseInt(fuel?.transactionCount || '0'),
        latestDate: fuel?.latestDate ? new Date(fuel.latestDate) : null
      },
      shipStore: {
        totalRevenue: shipStoreRevenue,
        totalCogs: shipStoreCogs,
        margin: shipStoreRevenue - shipStoreCogs,
        transactionCount: parseInt(shipStore?.transactionCount || '0'),
        latestDate: shipStore?.latestDate ? new Date(shipStore.latestDate) : null
      }
    };
  }

  private async getCompSummary(orgId: string, projectId: string): Promise<CompSetSummary> {
    const sets = await db.select()
      .from(compSets)
      .where(and(
        eq(compSets.orgId, orgId),
        sql`${compSets.deletedAt} IS NULL`
      ))
      .orderBy(desc(compSets.lastComputedAt));
    
    const summary: CompSetSummary = {};
    
    for (const set of sets) {
      const items = await db.select()
        .from(compSetItems)
        .where(eq(compSetItems.compSetId, set.id));
      
      if (set.compType === 'RATE' && !summary.rateSet) {
        const result = set.lastComputeResult as any;
        summary.rateSet = {
          id: set.id,
          name: set.name,
          indication: result?.weightedIndications?.wetSlip || null,
          compCount: items.length,
          computedAt: set.lastComputedAt
        };
      }
      
      if (set.compType === 'SALES' && !summary.salesSet) {
        const result = set.lastComputeResult as any;
        summary.salesSet = {
          id: set.id,
          name: set.name,
          indication: result?.weightedIndications?.pricePerSlip || null,
          compCount: items.length,
          computedAt: set.lastComputedAt
        };
      }
    }
    
    return summary;
  }

  private snapshotToResult(snapshot: typeof valuationSnapshots.$inferSelect): ValuationResult {
    return {
      snapshotId: snapshot.id,
      isHistorical: true,
      asOfDate: snapshot.snapshotDate,
      dataAsOfDate: new Date(snapshot.dataAsOfDate),
      purchasePrice: snapshot.purchasePrice ? parseFloat(snapshot.purchasePrice) : null,
      indicatedValue: snapshot.indicatedValue ? parseFloat(snapshot.indicatedValue) : null,
      capRate: snapshot.capRate ? parseFloat(snapshot.capRate) : null,
      grossRevenue: parseFloat(snapshot.grossRevenue || '0'),
      operatingExpenses: parseFloat(snapshot.operatingExpenses || '0'),
      noi: parseFloat(snapshot.noi || '0'),
      ebitda: parseFloat(snapshot.ebitda || '0'),
      revenueBreakdown: {
        rentRoll: parseFloat(snapshot.rentRollRevenue || '0'),
        fuel: parseFloat(snapshot.fuelRevenue || '0'),
        fuelCogs: parseFloat(snapshot.fuelCogs || '0'),
        fuelMargin: parseFloat(snapshot.fuelMargin || '0'),
        shipStore: parseFloat(snapshot.shipStoreRevenue || '0'),
        shipStoreCogs: parseFloat(snapshot.shipStoreCogs || '0'),
        shipStoreMargin: parseFloat(snapshot.shipStoreMargin || '0'),
        other: parseFloat(snapshot.otherRevenue || '0')
      },
      returns: snapshot.irr || snapshot.equityMultiple || snapshot.cashOnCash ? {
        irr: snapshot.irr ? parseFloat(snapshot.irr) : null,
        equityMultiple: snapshot.equityMultiple ? parseFloat(snapshot.equityMultiple) : null,
        cashOnCash: snapshot.cashOnCash ? parseFloat(snapshot.cashOnCash) : null
      } : undefined,
      compSummary: {
        rateSet: snapshot.rateCompSetId ? {
          id: snapshot.rateCompSetId,
          name: '',
          indication: snapshot.rateIndication ? parseFloat(snapshot.rateIndication) : null,
          compCount: 0,
          computedAt: null
        } : undefined,
        salesSet: snapshot.salesCompSetId ? {
          id: snapshot.salesCompSetId,
          name: '',
          indication: snapshot.salesIndication ? parseFloat(snapshot.salesIndication) : null,
          compCount: 0,
          computedAt: null
        } : undefined
      },
      operationsData: (snapshot.computedData as any)?.operationsData || {
        rentRoll: { totalRevenue: 0, entryCount: 0, latestDate: null },
        fuelSales: { totalRevenue: 0, totalCogs: 0, margin: 0, transactionCount: 0, latestDate: null },
        shipStore: { totalRevenue: 0, totalCogs: 0, margin: 0, transactionCount: 0, latestDate: null }
      },
      sources: []
    };
  }

  private getLatestDate(dates: (Date | null)[]): Date | null {
    const validDates = dates.filter((d): d is Date => d !== null);
    if (validDates.length === 0) return null;
    return validDates.reduce((latest, d) => d > latest ? d : latest);
  }
}

export const valuationTimelineService = new ValuationTimelineService();
