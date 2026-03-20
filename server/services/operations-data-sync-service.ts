import { db } from '../db';
import {
  modelingActuals,
  operationsDataSyncJobs,
  operationsDataMappings,
  rentRolls,
  rentRollEntries,
  fuelSales,
  shipStoreTransactions,
  shipStoreProducts,
  modelingProjects,
  returnsLedger,
  ownedAssets,
  crmProperties,
  fundDealAllocations,
  opsCommercialLeases,
  opsBookkeepingGl,
  opsMarinas
} from '@shared/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { getPnlMappingForAssetClass } from '@shared/asset-class-pnl-categories';

export interface SyncConfig {
  projectId: string;
  orgId: string;
  userId?: string;
  dataSources: ('rent_roll' | 'fuel_sales' | 'ship_store' | 'commercial_tenants' | 'bookkeeping_gl' | 'payroll')[];
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  syncType: 'full' | 'incremental' | 'manual';
}

export interface SyncResult {
  jobId: string;
  status: 'completed' | 'partial' | 'failed';
  recordsProcessed: number;
  recordsImported: number;
  recordsSkipped: number;
  recordsFailed: number;
  errors: string[];
  summary: {
    rentRoll?: { revenue: number; records: number };
    fuelSales?: { revenue: number; cogs: number; records: number };
    shipStore?: { revenue: number; cogs: number; records: number };
  };
}

export class OperationsDataSyncService {
  async syncOperationsData(config: SyncConfig): Promise<SyncResult> {
    const job = await this.createSyncJob(config);
    
    const result: SyncResult = {
      jobId: job.id,
      status: 'completed',
      recordsProcessed: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      errors: [],
      summary: {}
    };

    try {
      await this.updateJobStatus(job.id, 'in_progress');

      for (const source of config.dataSources) {
        try {
          await this.clearExistingActuals(config.projectId, source);
          
          switch (source) {
            case 'rent_roll':
              result.summary.rentRoll = await this.syncRentRollData(config, job.id, result);
              break;
            case 'fuel_sales':
              result.summary.fuelSales = await this.syncFuelSalesData(config, job.id, result);
              break;
            case 'ship_store':
              result.summary.shipStore = await this.syncShipStoreData(config, job.id, result);
              break;
          }
        } catch (err) {
          const errorMsg = `Error syncing ${source}: ${err instanceof Error ? err.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          result.status = 'partial';
        }
      }

      await this.updateJobCompletion(job.id, result);
      return result;
    } catch (err) {
      result.status = 'failed';
      result.errors.push(err instanceof Error ? err.message : 'Unknown error');
      await this.updateJobCompletion(job.id, result);
      throw err;
    }
  }

  private async clearExistingActuals(projectId: string, dataSource: string) {
    await db.delete(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, projectId),
        eq(modelingActuals.dataSource, dataSource as any)
      ));
  }

  private async createSyncJob(config: SyncConfig) {
    const [job] = await db.insert(operationsDataSyncJobs).values({
      orgId: config.orgId,
      modelingProjectId: config.projectId,
      syncType: config.syncType,
      dataSources: config.dataSources,
      dateRangeStart: config.dateRangeStart?.toISOString().split('T')[0],
      dateRangeEnd: config.dateRangeEnd?.toISOString().split('T')[0],
      status: 'pending',
      triggeredBy: config.userId,
      startedAt: new Date()
    }).returning();
    
    return job;
  }

  private async updateJobStatus(jobId: string, status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial') {
    await db.update(operationsDataSyncJobs)
      .set({ status })
      .where(eq(operationsDataSyncJobs.id, jobId));
  }

  private async updateJobCompletion(jobId: string, result: SyncResult) {
    await db.update(operationsDataSyncJobs)
      .set({
        status: result.status,
        completedAt: new Date(),
        recordsProcessed: result.recordsProcessed,
        recordsImported: result.recordsImported,
        recordsSkipped: result.recordsSkipped,
        recordsFailed: result.recordsFailed,
        errorLog: result.errors
      })
      .where(eq(operationsDataSyncJobs.id, jobId));
  }

  private async syncRentRollData(
    config: SyncConfig, 
    jobId: string, 
    result: SyncResult
  ): Promise<{ revenue: number; records: number }> {
    let totalRevenue = 0;
    let records = 0;

    const rentRollsData = await db.select()
      .from(rentRolls)
      .where(eq(rentRolls.orgId, config.orgId));

    const monthlyBySubcategory: Record<string, Record<string, number>> = {};

    for (const roll of rentRollsData) {
      const entries = await db.select()
        .from(rentRollEntries)
        .where(eq(rentRollEntries.rentRollId, roll.id));

      const effectiveDate = new Date(roll.effectiveDate);
      const year = effectiveDate.getFullYear();
      const month = effectiveDate.getMonth() + 1;
      const periodKey = `${year}-${month}`;

      for (const entry of entries) {
        result.recordsProcessed++;
        
        if (entry.status !== 'active') {
          result.recordsSkipped++;
          continue;
        }

        const monthlyRate = parseFloat(entry.monthlyRate || '0');
        const entryType = entry.entryType || 'slip';
        
        const subcategory = this.mapRentRollEntryTypeToSubcategory(entryType);
        const key = `${periodKey}|${subcategory}`;
        
        if (!monthlyBySubcategory[key]) {
          monthlyBySubcategory[key] = { year, month, amount: 0 };
        }
        monthlyBySubcategory[key].amount = (monthlyBySubcategory[key].amount || 0) + monthlyRate;
        
        totalRevenue += monthlyRate;
        records++;
      }
    }

    for (const [key, data] of Object.entries(monthlyBySubcategory)) {
      const [periodStr, subcategory] = key.split('|');
      const [year, month] = periodStr.split('-').map(Number);
      const amount = (data as any).amount || data;
      
      if (typeof amount === 'number' && amount > 0) {
        await db.insert(modelingActuals).values({
          orgId: config.orgId,
          modelingProjectId: config.projectId,
          year,
          month,
          category: 'Revenue',
          subcategory: subcategory,
          department: 'Storage',
          lineItemDescription: `${subcategory} Revenue`,
          amount: amount.toFixed(2),
          dataSource: 'rent_roll',
          sourceRecordType: 'rent_roll_aggregate',
          syncJobId: jobId,
          createdBy: config.userId
        });
        result.recordsImported++;
      }
    }

    return { revenue: totalRevenue, records };
  }

  private async syncFuelSalesData(
    config: SyncConfig, 
    jobId: string, 
    result: SyncResult
  ): Promise<{ revenue: number; cogs: number; records: number }> {
    let totalRevenue = 0;
    let totalCogs = 0;
    let records = 0;

    const conditions = [eq(fuelSales.orgId, config.orgId)];
    if (config.dateRangeStart) {
      conditions.push(gte(fuelSales.transactionDate, config.dateRangeStart));
    }
    if (config.dateRangeEnd) {
      conditions.push(lte(fuelSales.transactionDate, config.dateRangeEnd));
    }

    const transactions = await db.select()
      .from(fuelSales)
      .where(and(...conditions));

    const monthlyData: Record<string, { revenue: number; cogs: number; revenueByType: Record<string, number> }> = {};

    for (const txn of transactions) {
      result.recordsProcessed++;
      
      const date = new Date(txn.transactionDate);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = { revenue: 0, cogs: 0, revenueByType: {} };
      }

      const revenue = parseFloat(txn.totalAmount);
      const costPerGallon = txn.costPerGallon ? parseFloat(txn.costPerGallon) : parseFloat(txn.pricePerGallon) * 0.80;
      const cogs = costPerGallon * parseFloat(txn.quantityGallons);

      monthlyData[key].revenue += revenue;
      monthlyData[key].cogs += cogs;
      
      const fuelType = txn.fuelType || 'diesel';
      monthlyData[key].revenueByType[fuelType] = (monthlyData[key].revenueByType[fuelType] || 0) + revenue;

      totalRevenue += revenue;
      totalCogs += cogs;
      records++;
    }

    for (const [period, data] of Object.entries(monthlyData)) {
      const [year, month] = period.split('-').map(Number);

      await db.insert(modelingActuals).values({
        orgId: config.orgId,
        modelingProjectId: config.projectId,
        year,
        month,
        category: 'Revenue',
        subcategory: 'Fuel Sales',
        department: 'Fuel',
        lineItemDescription: 'Fuel Sales Revenue',
        amount: data.revenue.toFixed(2),
        dataSource: 'fuel_sales',
        sourceRecordType: 'fuel_sales_aggregate',
        syncJobId: jobId,
        createdBy: config.userId
      });

      await db.insert(modelingActuals).values({
        orgId: config.orgId,
        modelingProjectId: config.projectId,
        year,
        month,
        category: 'COGS',
        subcategory: 'Fuel',
        department: 'Fuel',
        lineItemDescription: 'Fuel Cost of Goods',
        amount: data.cogs.toFixed(2),
        dataSource: 'fuel_sales',
        sourceRecordType: 'fuel_sales_aggregate',
        syncJobId: jobId,
        createdBy: config.userId
      });

      result.recordsImported += 2;
    }

    return { revenue: totalRevenue, cogs: totalCogs, records };
  }

  private async syncShipStoreData(
    config: SyncConfig, 
    jobId: string, 
    result: SyncResult
  ): Promise<{ revenue: number; cogs: number; records: number }> {
    let totalRevenue = 0;
    let totalCogs = 0;
    let records = 0;

    const transactions = await db.select()
      .from(shipStoreTransactions);

    const products = await db.select()
      .from(shipStoreProducts);
    
    const productCostMap = products.reduce((acc, p) => {
      acc[p.id] = parseFloat(p.cost || '0');
      return acc;
    }, {} as Record<string, number>);

    const monthlyData: Record<string, { revenue: number; cogs: number }> = {};

    for (const txn of transactions) {
      result.recordsProcessed++;
      
      if (txn.status !== 'completed') {
        result.recordsSkipped++;
        continue;
      }

      const date = new Date(txn.createdAt!);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = { revenue: 0, cogs: 0 };
      }

      const revenue = parseFloat(txn.total);
      
      let cogs = 0;
      const items = txn.items as any[];
      if (items && Array.isArray(items)) {
        for (const item of items) {
          const productCost = productCostMap[item.productId] || 0;
          cogs += productCost * (item.quantity || 1);
        }
      }
      
      if (cogs === 0) {
        cogs = revenue * 0.60;
      }

      monthlyData[key].revenue += revenue;
      monthlyData[key].cogs += cogs;

      totalRevenue += revenue;
      totalCogs += cogs;
      records++;
    }

    for (const [period, data] of Object.entries(monthlyData)) {
      const [year, month] = period.split('-').map(Number);

      await db.insert(modelingActuals).values({
        orgId: config.orgId,
        modelingProjectId: config.projectId,
        year,
        month,
        category: 'Revenue',
        subcategory: 'Ship Store',
        department: "Ship's Store",
        lineItemDescription: 'Retail Sales',
        amount: data.revenue.toFixed(2),
        dataSource: 'ship_store',
        sourceRecordType: 'ship_store_aggregate',
        syncJobId: jobId,
        createdBy: config.userId
      });

      await db.insert(modelingActuals).values({
        orgId: config.orgId,
        modelingProjectId: config.projectId,
        year,
        month,
        category: 'COGS',
        subcategory: 'Ship Store',
        department: "Ship's Store",
        lineItemDescription: 'Retail Cost of Goods',
        amount: data.cogs.toFixed(2),
        dataSource: 'ship_store',
        sourceRecordType: 'ship_store_aggregate',
        syncJobId: jobId,
        createdBy: config.userId
      });

      result.recordsImported += 2;
    }

    return { revenue: totalRevenue, cogs: totalCogs, records };
  }

  private mapRentRollEntryTypeToSubcategory(entryType: string): string {
    const mapping: Record<string, string> = {
      'slip': 'Wet Slips',
      'rack': 'Dry Storage',
      'commercial': 'Third-Party Leases',
      'seasonal': 'Seasonal Storage'
    };
    return mapping[entryType] || 'Other Dockage';
  }

  async getActualsForProject(
    projectId: string, 
    year?: number
  ): Promise<any[]> {
    const conditions = [eq(modelingActuals.modelingProjectId, projectId)];
    if (year) {
      conditions.push(eq(modelingActuals.year, year));
    }

    return db.select()
      .from(modelingActuals)
      .where(and(...conditions))
      .orderBy(modelingActuals.year, modelingActuals.month, modelingActuals.category);
  }

  async getAvailableYears(projectId: string): Promise<number[]> {
    const years = await db.selectDistinct({ year: modelingActuals.year })
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId))
      .orderBy(modelingActuals.year);
    
    return years.map(y => y.year);
  }

  async getActualsForMultipleYears(
    projectId: string, 
    years: number[]
  ): Promise<Record<number, any[]>> {
    if (years.length === 0) return {};
    
    const actuals = await db.select()
      .from(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, projectId),
        inArray(modelingActuals.year, years)
      ))
      .orderBy(modelingActuals.year, modelingActuals.month, modelingActuals.category);

    return actuals.reduce((acc, item) => {
      if (!acc[item.year]) {
        acc[item.year] = [];
      }
      acc[item.year].push(item);
      return acc;
    }, {} as Record<number, any[]>);
  }

  async getSyncJobHistory(projectId: string, limit = 10) {
    return db.select()
      .from(operationsDataSyncJobs)
      .where(eq(operationsDataSyncJobs.modelingProjectId, projectId))
      .orderBy(sql`${operationsDataSyncJobs.createdAt} DESC`)
      .limit(limit);
  }

  async getDataSourceSummary(projectId: string) {
    const actuals = await db.select({
      dataSource: modelingActuals.dataSource,
      count: sql<number>`count(*)`,
      totalAmount: sql<string>`sum(${modelingActuals.amount}::numeric)`
    })
    .from(modelingActuals)
    .where(eq(modelingActuals.modelingProjectId, projectId))
    .groupBy(modelingActuals.dataSource);

    return actuals;
  }

  /**
   * Sync commercial tenant data into modelingActuals
   */
  async syncCommercialTenantData(
    projectId: string,
    orgId: string,
    marinaId: string,
    assetClass: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{ records: number; revenue: number }> {
    const conditions: any[] = [
      eq(opsCommercialLeases.marinaId, marinaId),
      eq(opsCommercialLeases.status, 'active'),
    ];

    const tenantData = await db.select({
      month: sql<string>`date_trunc('month', ${opsCommercialLeases.startDate})::date`,
      revenue: sql<string>`sum(${opsCommercialLeases.baseRent} + coalesce(${opsCommercialLeases.cam}, 0))`,
    })
      .from(opsCommercialLeases)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('month', ${opsCommercialLeases.startDate})::date`);

    const pnlMappings = getPnlMappingForAssetClass(assetClass);
    const mapping = pnlMappings.find(m => m.profitCenter === 'base_rent' || m.profitCenter === 'commercial_tenants');
    let totalRevenue = 0;

    for (const row of tenantData) {
      const d = new Date(row.month);
      const amount = parseFloat(row.revenue || '0');
      totalRevenue += amount;

      await db.insert(modelingActuals).values({
        orgId,
        modelingProjectId: projectId,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        category: mapping?.category || 'Revenue',
        subcategory: mapping?.subcategory || 'Commercial Tenant Revenue',
        department: mapping?.department || 'Leasing',
        amount: row.revenue,
        dataSource: 'ops_sync',
        syncedAt: new Date(),
      });
    }

    return { records: tenantData.length, revenue: totalRevenue };
  }

  /**
   * Sync bookkeeping GL data into modelingActuals
   */
  async syncBookkeepingGlData(
    projectId: string,
    orgId: string,
    marinaId: string,
    assetClass: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{ records: number; revenue: number; expenses: number }> {
    const conditions: any[] = [eq(opsBookkeepingGl.marinaId, marinaId)];
    if (dateRange) {
      conditions.push(gte(opsBookkeepingGl.periodStart, dateRange.start.toISOString().slice(0, 10)));
      conditions.push(lte(opsBookkeepingGl.periodEnd, dateRange.end.toISOString().slice(0, 10)));
    }

    const glData = await db.select({
      month: sql<string>`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
      accountType: opsBookkeepingGl.accountType,
      accountName: opsBookkeepingGl.accountName,
      total: sql<string>`sum(${opsBookkeepingGl.amount})`,
    })
      .from(opsBookkeepingGl)
      .where(and(...conditions))
      .groupBy(
        sql`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
        opsBookkeepingGl.accountType,
        opsBookkeepingGl.accountName
      );

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const row of glData) {
      const d = new Date(row.month);
      const amount = parseFloat(row.total || '0');
      const isExpense = row.accountType === 'expense' || row.accountType === 'EXPENSE';

      if (isExpense) {
        totalExpenses += Math.abs(amount);
      } else {
        totalRevenue += amount;
      }

      await db.insert(modelingActuals).values({
        orgId,
        modelingProjectId: projectId,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        category: isExpense ? 'Expense' : 'Revenue',
        subcategory: row.accountName || 'General',
        department: 'Operations',
        amount: row.total,
        dataSource: 'ops_sync',
        syncedAt: new Date(),
      });
    }

    return { records: glData.length, revenue: totalRevenue, expenses: totalExpenses };
  }

  /**
   * Sync payroll data into modelingActuals (from bookkeeping GL with payroll account types)
   */
  async syncPayrollData(
    projectId: string,
    orgId: string,
    marinaId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{ records: number; total: number }> {
    const conditions: any[] = [
      eq(opsBookkeepingGl.marinaId, marinaId),
      sql`lower(${opsBookkeepingGl.accountName}) like '%payroll%' or lower(${opsBookkeepingGl.accountName}) like '%salary%' or lower(${opsBookkeepingGl.accountName}) like '%wages%'`,
    ];
    if (dateRange) {
      conditions.push(gte(opsBookkeepingGl.periodStart, dateRange.start.toISOString().slice(0, 10)));
      conditions.push(lte(opsBookkeepingGl.periodEnd, dateRange.end.toISOString().slice(0, 10)));
    }

    const payrollData = await db.select({
      month: sql<string>`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
      total: sql<string>`sum(${opsBookkeepingGl.amount})`,
    })
      .from(opsBookkeepingGl)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`);

    let totalAmount = 0;

    for (const row of payrollData) {
      const d = new Date(row.month);
      const amount = parseFloat(row.total || '0');
      totalAmount += Math.abs(amount);

      await db.insert(modelingActuals).values({
        orgId,
        modelingProjectId: projectId,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        category: 'Expense',
        subcategory: 'Payroll',
        department: 'Administration',
        amount: row.total,
        dataSource: 'ops_sync',
        syncedAt: new Date(),
      });
    }

    return { records: payrollData.length, total: totalAmount };
  }

  /**
   * Sync operations cashflow to returnsLedger.
   * Computes monthly NOI from ops data and inserts/updates returnsLedger
   * with bucket OPERATING_CASHFLOW.
   */
  async syncToReturnsLedger(
    ownedAssetId: string,
    orgId: string,
    userId: string,
    dateRange: { start: string; end: string }
  ): Promise<{ entriesWritten: number }> {
    // Look up the owned asset
    const [asset] = await db.select({
      id: ownedAssets.id,
      propertyId: ownedAssets.propertyId,
      projectId: ownedAssets.projectId,
      propertyType: crmProperties.type,
    })
      .from(ownedAssets)
      .innerJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
      .where(and(eq(ownedAssets.id, ownedAssetId), eq(ownedAssets.orgId, orgId)));

    if (!asset || !asset.projectId) {
      return { entriesWritten: 0 };
    }

    // Get monthly NOI from modelingActuals
    const monthlyData = await db.select({
      year: modelingActuals.year,
      month: modelingActuals.month,
      category: modelingActuals.category,
      total: sql<string>`sum(${modelingActuals.amount}::numeric)`,
    })
      .from(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, asset.projectId),
        gte(modelingActuals.year, parseInt(dateRange.start.slice(0, 4))),
        lte(modelingActuals.year, parseInt(dateRange.end.slice(0, 4)))
      ))
      .groupBy(modelingActuals.year, modelingActuals.month, modelingActuals.category);

    // Group by year-month to compute NOI
    const monthMap = new Map<string, { revenue: number; expense: number }>();
    for (const row of monthlyData) {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { revenue: 0, expense: 0 });
      }
      const entry = monthMap.get(key)!;
      const amount = parseFloat(row.total || '0');
      if (row.category === 'Revenue') {
        entry.revenue += amount;
      } else {
        entry.expense += Math.abs(amount);
      }
    }

    // Look up if this asset is part of a fund
    let fundId: string | null = null;
    if (asset.projectId) {
      const [alloc] = await db.select({ fundId: fundDealAllocations.fundId })
        .from(fundDealAllocations)
        .where(eq(fundDealAllocations.modelingProjectId, asset.projectId))
        .limit(1);
      if (alloc) {
        fundId = alloc.fundId;
      }
    }

    let entriesWritten = 0;
    for (const [monthKey, data] of monthMap) {
      const noi = data.revenue - data.expense;
      const asOfDate = `${monthKey}-01`;

      await db.insert(returnsLedger).values({
        orgId,
        userId,
        propertyId: asset.propertyId,
        modelId: asset.projectId,
        fundId,
        asOfDate,
        frequency: 'MONTHLY',
        bucket: 'OPERATING_CASHFLOW',
        amount: String(noi),
        source: 'OPS_SYNC',
        memo: `Auto-synced from operations data for ${asset.propertyType || 'unknown'} asset`,
      });
      entriesWritten++;
    }

    return { entriesWritten };
  }
}

export const operationsDataSyncService = new OperationsDataSyncService();
