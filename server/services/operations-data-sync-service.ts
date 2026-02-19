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
  modelingProjects
} from '@shared/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';

export interface SyncConfig {
  projectId: string;
  orgId: string;
  userId?: string;
  dataSources: ('rent_roll' | 'fuel_sales' | 'ship_store')[];
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
}

export const operationsDataSyncService = new OperationsDataSyncService();
