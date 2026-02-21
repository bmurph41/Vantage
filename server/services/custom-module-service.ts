import { db } from '../db';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type { DashboardCustomModule } from '@shared/schema';

interface FilteredDataRequest {
  moduleType: string;
  filters: Record<string, any>;
  limit?: number;
}

export async function getFilteredModuleData(request: FilteredDataRequest, orgId: string) {
  const { moduleType, filters, limit = 100 } = request;

  switch (moduleType) {
    case 'crm':
      return await getFilteredCRMData(filters, orgId, limit);
    case 'salesComps':
      return await getFilteredSalesCompsData(filters, orgId, limit);
    case 'dueDiligence':
      return await getFilteredDDData(filters, orgId, limit);
    case 'rentRoll':
      return await getFilteredRentRollData(filters, orgId, limit);
    case 'vdr':
      return await getFilteredVDRData(filters, orgId, limit);
    case 'fuel':
      return await getFilteredFuelData(filters, orgId, limit);
    case 'shipStore':
      return await getFilteredShipStoreData(filters, orgId, limit);
    case 'modeling':
      return await getFilteredModelingData(filters, orgId, limit);
    case 'docket':
      return await getFilteredDocketData(filters, limit);
    default:
      throw new Error(`Unknown module type: ${moduleType}`);
  }
}

async function getFilteredCRMData(filters: Record<string, any>, orgId: string, limit: number) {
  const { crmDeals } = await import('@shared/schema');
  
  let query = db.select().from(crmDeals).where(eq(crmDeals.orgId, orgId));

  const conditions = [eq(crmDeals.orgId, orgId)];
  
  if (filters.status) {
    conditions.push(eq(crmDeals.stage, filters.status));
  }
  
  if (filters.minValue !== undefined) {
    conditions.push(sql`${crmDeals.value}::numeric >= ${Number(filters.minValue)}`);
  }
  
  if (filters.maxValue !== undefined) {
    conditions.push(sql`${crmDeals.value}::numeric <= ${Number(filters.maxValue)}`);
  }

  if (filters.dateRange?.from) {
    conditions.push(gte(crmDeals.createdAt, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(crmDeals.createdAt, new Date(filters.dateRange.to)));
  }

  const results = await db
    .select()
    .from(crmDeals)
    .where(and(...conditions))
    .orderBy(desc(crmDeals.createdAt))
    .limit(limit);

  return results;
}

async function getFilteredSalesCompsData(filters: Record<string, any>, orgId: string, limit: number) {
  const { salesComps } = await import('@shared/schema');
  
  const conditions = [eq(salesComps.orgId, orgId)];
  
  if (filters.location) {
    conditions.push(sql`LOWER(${salesComps.location}) LIKE LOWER(${'%' + filters.location + '%'})`);
  }
  
  if (filters.minValue !== undefined) {
    conditions.push(sql`${salesComps.salePrice}::numeric >= ${Number(filters.minValue)}`);
  }
  
  if (filters.maxValue !== undefined) {
    conditions.push(sql`${salesComps.salePrice}::numeric <= ${Number(filters.maxValue)}`);
  }

  if (filters.dateRange?.from) {
    conditions.push(gte(salesComps.saleDate, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(salesComps.saleDate, new Date(filters.dateRange.to)));
  }

  const results = await db
    .select()
    .from(salesComps)
    .where(and(...conditions))
    .orderBy(desc(salesComps.saleDate))
    .limit(limit);

  return results;
}

async function getFilteredDDData(filters: Record<string, any>, orgId: string, limit: number) {
  const { tasks, projects } = await import('@shared/schema');
  
  const conditions = [eq(projects.orgId, orgId)];
  
  if (filters.status) {
    conditions.push(eq(tasks.status, filters.status));
  }

  if (filters.dateRange?.from) {
    conditions.push(gte(tasks.createdAt, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(tasks.createdAt, new Date(filters.dateRange.to)));
  }

  const results = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
      projectName: projects.name,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);

  return results;
}

async function getFilteredRentRollData(filters: Record<string, any>, orgId: string, limit: number) {
  const { rentRollEntries } = await import('@shared/schema');
  
  const conditions = [eq(rentRollEntries.orgId, orgId)];
  
  if (filters.status) {
    conditions.push(eq(rentRollEntries.status, filters.status));
  }
  
  if (filters.minValue !== undefined) {
    conditions.push(sql`${rentRollEntries.monthlyRate}::numeric >= ${Number(filters.minValue)}`);
  }
  
  if (filters.maxValue !== undefined) {
    conditions.push(sql`${rentRollEntries.monthlyRate}::numeric <= ${Number(filters.maxValue)}`);
  }

  if (filters.dateRange?.from) {
    conditions.push(gte(rentRollEntries.createdAt, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(rentRollEntries.createdAt, new Date(filters.dateRange.to)));
  }

  const results = await db
    .select()
    .from(rentRollEntries)
    .where(and(...conditions))
    .orderBy(desc(rentRollEntries.createdAt))
    .limit(limit);

  return results;
}

async function getFilteredVDRData(filters: Record<string, any>, orgId: string, limit: number) {
  const { vdrDocuments, vdrProjects } = await import('@shared/schema');
  
  const conditions = [eq(vdrProjects.orgId, orgId)];

  if (filters.dateRange?.from) {
    conditions.push(gte(vdrDocuments.createdAt, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(vdrDocuments.createdAt, new Date(filters.dateRange.to)));
  }

  const results = await db
    .select({
      id: vdrDocuments.id,
      fileName: vdrDocuments.fileName,
      fileSize: vdrDocuments.fileSize,
      uploadedBy: vdrDocuments.uploadedBy,
      projectId: vdrDocuments.projectId,
      projectName: vdrProjects.name,
      createdAt: vdrDocuments.createdAt,
    })
    .from(vdrDocuments)
    .innerJoin(vdrProjects, eq(vdrDocuments.projectId, vdrProjects.id))
    .where(and(...conditions))
    .orderBy(desc(vdrDocuments.createdAt))
    .limit(limit);

  return results;
}

async function getFilteredFuelData(filters: Record<string, any>, orgId: string, limit: number) {
  const { fuelTransactions } = await import('@shared/schema');
  
  const conditions = [eq(fuelTransactions.orgId, orgId)];
  
  if (filters.minValue !== undefined) {
    conditions.push(sql`${fuelTransactions.totalAmount}::numeric >= ${Number(filters.minValue)}`);
  }
  
  if (filters.maxValue !== undefined) {
    conditions.push(sql`${fuelTransactions.totalAmount}::numeric <= ${Number(filters.maxValue)}`);
  }

  if (filters.dateRange?.from) {
    conditions.push(gte(fuelTransactions.transactionDate, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(fuelTransactions.transactionDate, new Date(filters.dateRange.to)));
  }

  const results = await db
    .select()
    .from(fuelTransactions)
    .where(and(...conditions))
    .orderBy(desc(fuelTransactions.transactionDate))
    .limit(limit);

  return results;
}

async function getFilteredShipStoreData(filters: Record<string, any>, orgId: string, limit: number) {
  const { shipStoreTransactions } = await import('@shared/schema');
  
  const conditions = [eq(shipStoreTransactions.orgId, orgId)];
  
  if (filters.status) {
    conditions.push(eq(shipStoreTransactions.status, filters.status));
  }
  
  if (filters.minValue !== undefined) {
    conditions.push(sql`${shipStoreTransactions.total}::numeric >= ${Number(filters.minValue)}`);
  }
  
  if (filters.maxValue !== undefined) {
    conditions.push(sql`${shipStoreTransactions.total}::numeric <= ${Number(filters.maxValue)}`);
  }

  if (filters.dateRange?.from) {
    conditions.push(gte(shipStoreTransactions.createdAt, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(shipStoreTransactions.createdAt, new Date(filters.dateRange.to)));
  }

  const results = await db
    .select()
    .from(shipStoreTransactions)
    .where(and(...conditions))
    .orderBy(desc(shipStoreTransactions.createdAt))
    .limit(limit);

  return results;
}

async function getFilteredModelingData(filters: Record<string, any>, orgId: string, limit: number) {
  const { modelingProjects } = await import('@shared/schema');
  
  const conditions = [eq(modelingProjects.orgId, orgId)];
  
  if (filters.status) {
    conditions.push(eq(modelingProjects.dealOutcome, filters.status));
  }
  
  if (filters.minValue !== undefined) {
    conditions.push(sql`${modelingProjects.estimatedValue}::numeric >= ${Number(filters.minValue)}`);
  }
  
  if (filters.maxValue !== undefined) {
    conditions.push(sql`${modelingProjects.estimatedValue}::numeric <= ${Number(filters.maxValue)}`);
  }

  if (filters.dateRange?.from) {
    conditions.push(gte(modelingProjects.createdAt, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(modelingProjects.createdAt, new Date(filters.dateRange.to)));
  }

  const results = await db
    .select()
    .from(modelingProjects)
    .where(and(...conditions))
    .orderBy(desc(modelingProjects.createdAt))
    .limit(limit);

  return results;
}

async function getFilteredDocketData(filters: Record<string, any>, limit: number) {
  const { docketArticles } = await import('@shared/schema');
  
  const conditions: any[] = [];
  
  if (filters.category) {
    conditions.push(sql`${docketArticles.category} = ${filters.category}`);
  }

  if (filters.dateRange?.from) {
    conditions.push(gte(docketArticles.publishedAt, new Date(filters.dateRange.from)));
  }
  
  if (filters.dateRange?.to) {
    conditions.push(lte(docketArticles.publishedAt, new Date(filters.dateRange.to)));
  }

  const query = conditions.length > 0
    ? db.select().from(docketArticles).where(and(...conditions))
    : db.select().from(docketArticles);

  const results = await query
    .orderBy(desc(docketArticles.publishedAt))
    .limit(limit);

  return results;
}
