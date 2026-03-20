import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import {
  opsPortfolios, opsMarinas, opsFuelTransactions, opsShipStoreSales,
  opsServiceWorkOrders, opsBoatRentals, opsBoatClubMemberships, opsBoatSales,
  opsCommercialLeases, opsBookkeepingGl, valuatorProjectContext, opsImportEvents,
  opsParkingLot,
  asmpFuel, asmpShipStore, asmpService, asmpCommercialTenants, asmpBoatRentals,
  asmpBoatClub, asmpBoatSales, asmpBookkeeping, modelingProjects,
  ownedAssets, crmProperties, modelingActuals, modelingFinancialPeriods,
  assetPerformanceSnapshots, returnsLedger
} from '@shared/schema';
import { eq, and, desc, between, sql, gte, lte, SQL, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { resolveOpsModulesForOrg, getOwnedAssetsForOrg } from '../services/operations-module-resolver';
import { getPnlMappingForAssetClass } from '@shared/asset-class-pnl-categories';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const portfolioSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  currency: z.string().default('USD'),
  timezone: z.string().default('America/New_York'),
});

const marinaSchema = z.object({
  name: z.string().min(1).max(255),
  portfolioId: z.string().uuid().optional().nullable(),
  ownershipStatus: z.enum(['OWNED', 'DEAL']).default('OWNED'),
  linkedProjectId: z.string().uuid().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().default('USA'),
  zipCode: z.string().optional().nullable(),
  lat: z.string().optional().nullable(),
  lng: z.string().optional().nullable(),
  slipCount: z.number().int().optional().nullable(),
  waterfront: z.number().optional().nullable(),
  timezone: z.string().default('America/New_York'),
});

const fuelTransactionSchema = z.object({
  fuelType: z.enum(['DIESEL', 'GAS_87', 'GAS_89', 'GAS_93', 'NON_ETHANOL']),
  txnDate: z.string(),
  gallons: z.string().or(z.number()).transform(v => String(v)),
  pricePerGallon: z.string().or(z.number()).transform(v => String(v)),
  grossSales: z.string().or(z.number()).transform(v => String(v)),
  costPerGallon: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  cogs: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  source: z.enum(['MANUAL', 'CSV_IMPORT', 'INTEGRATION']).default('MANUAL'),
  notes: z.string().optional().nullable(),
});

const shipStoreSaleSchema = z.object({
  txnDate: z.string(),
  category: z.string().optional().nullable(),
  productSku: z.string().optional().nullable(),
  productName: z.string().optional().nullable(),
  qty: z.number().int().default(1),
  grossSales: z.string().or(z.number()).transform(v => String(v)),
  cogs: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  source: z.enum(['MANUAL', 'CSV_IMPORT', 'INTEGRATION']).default('MANUAL'),
  notes: z.string().optional().nullable(),
});

const serviceWorkOrderSchema = z.object({
  woNumber: z.string().optional().nullable(),
  openedDate: z.string(),
  closedDate: z.string().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('OPEN'),
  serviceType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  laborHours: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  laborRate: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  laborTotal: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  partsTotal: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  grossTotal: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  technicianId: z.string().uuid().optional().nullable(),
  source: z.enum(['MANUAL', 'CSV_IMPORT', 'INTEGRATION']).default('MANUAL'),
});

const projectContextSchema = z.object({
  marinaId: z.string().uuid().optional().nullable(),
  projectType: z.enum(['OWNED', 'ACQUISITION', 'BROKER_LISTING']),
});

const parkingLotSchema = z.object({
  txnDate: z.string(),
  rateType: z.enum(['HOURLY', 'DAILY', 'MONTHLY', 'EVENT']),
  spacesUsed: z.number().int().default(1),
  hours: z.string().or(z.number()).optional().nullable().transform(v => v ? String(v) : null),
  grossRevenue: z.string().or(z.number()).transform(v => String(v)),
  dayType: z.enum(['weekday', 'weekend', 'holiday', 'event']).default('weekday'),
  source: z.enum(['MANUAL', 'CSV_IMPORT', 'INTEGRATION']).default('MANUAL'),
  notes: z.string().optional().nullable(),
});

const importActualsSchema = z.object({
  scope: z.enum(['ALL', 'FUEL', 'SHIP_STORE', 'SERVICE', 'BOAT_RENTALS', 'BOAT_CLUB', 'BOAT_SALES', 'COMMERCIAL', 'BOOKKEEPING', 'PAYROLL']),
  rangeStart: z.string(),
  rangeEnd: z.string(),
  overwrite: z.boolean().default(false),
});

const pushToModelSchema = z.object({
  ownedAssetId: z.string(),
  scope: z.enum(['ALL', 'REVENUE', 'EXPENSES']).default('ALL'),
  rangeStart: z.string(),
  rangeEnd: z.string(),
});

const pushToAssetSchema = z.object({
  ownedAssetId: z.string(),
  targets: z.array(z.object({
    category: z.string(),
    amount: z.number(),
    month: z.string(),
  })),
});

// ============================================================================
// AUTH HELPERS
// ============================================================================

function getOrgId(req: Request): string {
  const orgId = (req as any).auth?.tenantId || (req as any).orgId;
  if (!orgId) {
    if (process.env.NODE_ENV === 'development') {
      return 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
    }
    throw new Error('Missing organization context');
  }
  return orgId;
}

function getUserId(req: Request): string {
  const userId = (req as any).auth?.userId || (req as any).userId;
  if (!userId) {
    if (process.env.NODE_ENV === 'development') {
      return '85c9cd7a-c453-4dba-9817-d032d5712c4e';
    }
    throw new Error('Missing user context');
  }
  return userId;
}

async function requireProjectInOrg(projectId: string, orgId: string): Promise<boolean> {
  const [project] = await db.select()
    .from(modelingProjects)
    .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
  return !!project;
}

// ============================================================================
// PORTFOLIOS ROUTES
// ============================================================================

router.get('/portfolios', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    
    const portfolios = await db.select()
      .from(opsPortfolios)
      .where(and(eq(opsPortfolios.orgId, orgId), eq(opsPortfolios.userId, userId)))
      .orderBy(desc(opsPortfolios.createdAt));
    
    res.json(portfolios);
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
});

router.post('/portfolios', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    
    const parsed = portfolioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const [portfolio] = await db.insert(opsPortfolios)
      .values({ orgId, userId, ...parsed.data })
      .returning();
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error creating portfolio:', error);
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

router.put('/portfolios/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    
    const parsed = portfolioSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const [portfolio] = await db.update(opsPortfolios)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(opsPortfolios.id, id), eq(opsPortfolios.orgId, orgId)))
      .returning();
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error updating portfolio:', error);
    res.status(500).json({ error: 'Failed to update portfolio' });
  }
});

router.delete('/portfolios/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    
    await db.delete(opsPortfolios)
      .where(and(eq(opsPortfolios.id, id), eq(opsPortfolios.orgId, orgId)));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    res.status(500).json({ error: 'Failed to delete portfolio' });
  }
});

// ============================================================================
// MARINAS ROUTES
// ============================================================================

router.get('/marinas', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { ownershipStatus, portfolioId } = req.query;
    
    const conditions: SQL[] = [eq(opsMarinas.orgId, orgId)];
    
    if (ownershipStatus) {
      conditions.push(eq(opsMarinas.ownershipStatus, ownershipStatus as 'OWNED' | 'DEAL'));
    }
    
    if (portfolioId) {
      conditions.push(eq(opsMarinas.portfolioId, portfolioId as string));
    }
    
    const marinas = await db.select()
      .from(opsMarinas)
      .where(and(...conditions))
      .orderBy(desc(opsMarinas.createdAt));
    
    res.json(marinas);
  } catch (error) {
    console.error('Error fetching marinas:', error);
    res.status(500).json({ error: 'Failed to fetch marinas' });
  }
});

router.get('/marinas/owned', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);

    const marinas = await db.select()
      .from(opsMarinas)
      .where(and(eq(opsMarinas.orgId, orgId), eq(opsMarinas.ownershipStatus, 'OWNED')))
      .orderBy(desc(opsMarinas.createdAt));

    res.json(marinas);
  } catch (error) {
    console.error('Error fetching owned marinas:', error);
    res.status(500).json({ error: 'Failed to fetch owned marinas' });
  }
});

// ============================================================================
// OPERATIONS CONTEXT - DYNAMIC MODULE RESOLUTION & UNIVERSAL ASSETS
// ============================================================================

router.get('/modules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const result = await resolveOpsModulesForOrg(orgId);
    res.json(result);
  } catch (error) {
    console.error('Error resolving operations modules:', error);
    res.status(500).json({ error: 'Failed to resolve operations modules' });
  }
});

router.get('/assets/owned', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const assets = await getOwnedAssetsForOrg(orgId);
    res.json(assets);
  } catch (error) {
    console.error('Error fetching owned assets:', error);
    res.status(500).json({ error: 'Failed to fetch owned assets' });
  }
});

// ============================================================================
// PUSH OPERATIONS DATA TO FINANCIAL MODEL (Phase 3)
// ============================================================================

router.post('/push-to-model', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const parsed = pushToModelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { ownedAssetId, scope, rangeStart, rangeEnd } = parsed.data;

    // Resolve asset type and linked project
    const [asset] = await db.select({
      id: ownedAssets.id,
      propertyId: ownedAssets.propertyId,
      projectId: ownedAssets.projectId,
      propertyType: crmProperties.type,
    })
      .from(ownedAssets)
      .innerJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
      .where(and(eq(ownedAssets.id, ownedAssetId), eq(ownedAssets.orgId, orgId)));

    if (!asset) {
      return res.status(404).json({ error: 'Owned asset not found' });
    }

    if (!asset.projectId) {
      return res.status(400).json({ error: 'Asset has no linked modeling project' });
    }

    const assetType = asset.propertyType || 'marina';
    const pnlMappings = getPnlMappingForAssetClass(assetType);
    let rowsWritten = 0;

    // For marina assets, use existing fuel/ship-store/service tables
    if (assetType === 'marina') {
      // Find the marina linked to this asset
      const [marina] = await db.select({ id: opsMarinas.id })
        .from(opsMarinas)
        .where(and(eq(opsMarinas.orgId, orgId), eq(opsMarinas.linkedProjectId, asset.projectId)));

      if (marina) {
        if (scope === 'ALL' || scope === 'REVENUE') {
          // Sync fuel data
          const fuelData = await db.select({
            month: sql<string>`date_trunc('month', ${opsFuelTransactions.txnDate})::date`,
            revenue: sql<string>`sum(${opsFuelTransactions.grossSales})`,
            cogs: sql<string>`sum(${opsFuelTransactions.cogs})`,
          })
            .from(opsFuelTransactions)
            .where(and(
              eq(opsFuelTransactions.marinaId, marina.id),
              between(opsFuelTransactions.txnDate, rangeStart, rangeEnd)
            ))
            .groupBy(sql`date_trunc('month', ${opsFuelTransactions.txnDate})::date`);

          for (const row of fuelData) {
            const d = new Date(row.month);
            await db.insert(modelingActuals).values({
              orgId,
              modelingProjectId: asset.projectId!,
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              category: 'Revenue',
              subcategory: 'Fuel Revenue',
              department: 'Fuel',
              amount: row.revenue,
              dataSource: 'ops_sync',
              syncedAt: new Date(),
            });
            rowsWritten++;
          }

          // Sync commercial tenant data
          const tenantData = await db.select({
            month: sql<string>`date_trunc('month', ${opsCommercialLeases.startDate})::date`,
            revenue: sql<string>`sum(${opsCommercialLeases.baseRent})`,
          })
            .from(opsCommercialLeases)
            .where(and(
              eq(opsCommercialLeases.marinaId, marina.id),
              eq(opsCommercialLeases.status, 'active'),
            ))
            .groupBy(sql`date_trunc('month', ${opsCommercialLeases.startDate})::date`);

          for (const row of tenantData) {
            const d = new Date(row.month);
            await db.insert(modelingActuals).values({
              orgId,
              modelingProjectId: asset.projectId!,
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              category: 'Revenue',
              subcategory: 'Commercial Tenant Revenue',
              department: 'Leasing',
              amount: row.revenue,
              dataSource: 'ops_sync',
              syncedAt: new Date(),
            });
            rowsWritten++;
          }
        }
      }
    } else {
      // For non-marina assets: use bookkeeping GL and commercial tenant data
      // Find any linked marina (ops infrastructure uses opsMarinas as the parent)
      const [marina] = await db.select({ id: opsMarinas.id })
        .from(opsMarinas)
        .where(and(eq(opsMarinas.orgId, orgId), eq(opsMarinas.linkedProjectId, asset.projectId)));

      if (marina) {
        if (scope === 'ALL' || scope === 'REVENUE') {
          // Sync commercial tenant revenue
          const tenantData = await db.select({
            month: sql<string>`date_trunc('month', ${opsCommercialLeases.startDate})::date`,
            revenue: sql<string>`sum(${opsCommercialLeases.baseRent} + coalesce(${opsCommercialLeases.cam}, 0))`,
          })
            .from(opsCommercialLeases)
            .where(and(
              eq(opsCommercialLeases.marinaId, marina.id),
              eq(opsCommercialLeases.status, 'active'),
            ))
            .groupBy(sql`date_trunc('month', ${opsCommercialLeases.startDate})::date`);

          for (const row of tenantData) {
            const d = new Date(row.month);
            const mapping = pnlMappings.find(m => m.profitCenter === 'base_rent' || m.profitCenter === 'residential_rent');
            await db.insert(modelingActuals).values({
              orgId,
              modelingProjectId: asset.projectId!,
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              category: mapping?.category || 'Revenue',
              subcategory: mapping?.subcategory || 'Rental Revenue',
              department: mapping?.department || 'Leasing',
              amount: row.revenue,
              dataSource: 'ops_sync',
              syncedAt: new Date(),
            });
            rowsWritten++;
          }
        }

        if (scope === 'ALL' || scope === 'EXPENSES') {
          // Sync bookkeeping GL expenses
          const glData = await db.select({
            month: sql<string>`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
            accountType: opsBookkeepingGl.accountType,
            accountName: opsBookkeepingGl.accountName,
            total: sql<string>`sum(${opsBookkeepingGl.amount})`,
          })
            .from(opsBookkeepingGl)
            .where(and(
              eq(opsBookkeepingGl.marinaId, marina.id),
              between(opsBookkeepingGl.periodStart, rangeStart, rangeEnd)
            ))
            .groupBy(
              sql`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
              opsBookkeepingGl.accountType,
              opsBookkeepingGl.accountName
            );

          for (const row of glData) {
            const d = new Date(row.month);
            const isExpense = row.accountType === 'expense' || row.accountType === 'EXPENSE';
            await db.insert(modelingActuals).values({
              orgId,
              modelingProjectId: asset.projectId!,
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              category: isExpense ? 'Expense' : 'Revenue',
              subcategory: row.accountName || 'General',
              department: 'Operations',
              amount: row.total,
              dataSource: 'ops_sync',
              syncedAt: new Date(),
            });
            rowsWritten++;
          }
        }
      }
    }

    res.json({ success: true, rowsWritten, assetType });
  } catch (error) {
    console.error('Error pushing to model:', error);
    res.status(500).json({ error: 'Failed to push operations data to model' });
  }
});

router.post('/push-portfolio-to-model', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const schema = z.object({ rangeStart: z.string(), rangeEnd: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { rangeStart, rangeEnd } = parsed.data;
    const assets = await getOwnedAssetsForOrg(orgId);
    const results: Array<{ assetId: string; assetName: string; assetType: string; rowsWritten: number }> = [];

    for (const asset of assets) {
      if (!asset.projectId) continue;

      // Delegate each asset to push-to-model logic
      const assetType = asset.assetType;
      const pnlMappings = getPnlMappingForAssetClass(assetType);
      let rowsWritten = 0;

      // Find linked marina
      const [marina] = await db.select({ id: opsMarinas.id })
        .from(opsMarinas)
        .where(and(eq(opsMarinas.orgId, orgId), eq(opsMarinas.linkedProjectId, asset.projectId)));

      if (marina) {
        // Sync bookkeeping GL data for all asset types
        const glData = await db.select({
          month: sql<string>`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
          accountType: opsBookkeepingGl.accountType,
          accountName: opsBookkeepingGl.accountName,
          total: sql<string>`sum(${opsBookkeepingGl.amount})`,
        })
          .from(opsBookkeepingGl)
          .where(and(
            eq(opsBookkeepingGl.marinaId, marina.id),
            between(opsBookkeepingGl.periodStart, rangeStart, rangeEnd)
          ))
          .groupBy(
            sql`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
            opsBookkeepingGl.accountType,
            opsBookkeepingGl.accountName
          );

        for (const row of glData) {
          const d = new Date(row.month);
          const isExpense = row.accountType === 'expense' || row.accountType === 'EXPENSE';
          await db.insert(modelingActuals).values({
            orgId,
            modelingProjectId: asset.projectId!,
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            category: isExpense ? 'Expense' : 'Revenue',
            subcategory: row.accountName || 'General',
            department: 'Operations',
            amount: row.total,
            dataSource: 'ops_sync',
            syncedAt: new Date(),
          });
          rowsWritten++;
        }
      }

      results.push({ assetId: asset.id, assetName: asset.name, assetType, rowsWritten });
    }

    res.json({ success: true, assetsSynced: results.length, results });
  } catch (error) {
    console.error('Error pushing portfolio to model:', error);
    res.status(500).json({ error: 'Failed to push portfolio operations data to models' });
  }
});

// ============================================================================
// PUSH TARGETS BACK TO INDIVIDUAL ASSETS (Phase 5)
// ============================================================================

router.post('/push-to-asset', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const parsed = pushToAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { ownedAssetId, targets } = parsed.data;

    // Verify asset belongs to org
    const [asset] = await db.select()
      .from(ownedAssets)
      .where(and(eq(ownedAssets.id, ownedAssetId), eq(ownedAssets.orgId, orgId)));

    if (!asset) {
      return res.status(404).json({ error: 'Owned asset not found' });
    }

    // Write performance snapshots with budget targets
    for (const target of targets) {
      await db.insert(assetPerformanceSnapshots).values({
        ownedAssetId,
        snapshotDate: target.month,
        metrics: {
          budgetTarget: true,
          category: target.category,
          amount: target.amount,
          source: 'model_push',
          pushedBy: userId,
          pushedAt: new Date().toISOString(),
        },
      });
    }

    res.json({ success: true, targetsWritten: targets.length });
  } catch (error) {
    console.error('Error pushing targets to asset:', error);
    res.status(500).json({ error: 'Failed to push targets to asset' });
  }
});

router.get('/assets/:assetId/performance', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { assetId } = req.params;

    // Verify asset belongs to org
    const [asset] = await db.select({
      id: ownedAssets.id,
      propertyId: ownedAssets.propertyId,
      projectId: ownedAssets.projectId,
      propertyType: crmProperties.type,
      propertyTitle: crmProperties.title,
    })
      .from(ownedAssets)
      .innerJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
      .where(and(eq(ownedAssets.id, assetId), eq(ownedAssets.orgId, orgId)));

    if (!asset) {
      return res.status(404).json({ error: 'Owned asset not found' });
    }

    // Get performance snapshots
    const snapshots = await db.select()
      .from(assetPerformanceSnapshots)
      .where(eq(assetPerformanceSnapshots.ownedAssetId, assetId))
      .orderBy(desc(assetPerformanceSnapshots.snapshotDate));

    // Get actuals from modeling if project is linked
    let actuals: any[] = [];
    if (asset.projectId) {
      actuals = await db.select()
        .from(modelingActuals)
        .where(eq(modelingActuals.modelingProjectId, asset.projectId))
        .orderBy(desc(modelingActuals.year), desc(modelingActuals.month));
    }

    // Compute budget vs actual variance
    const budgetSnapshots = snapshots.filter(s =>
      (s.metrics as any)?.budgetTarget === true
    );
    const variance: Array<{ category: string; budgeted: number; actual: number; variance: number; month: string }> = [];

    for (const budget of budgetSnapshots) {
      const metrics = budget.metrics as any;
      const matchingActuals = actuals.filter(a =>
        a.subcategory === metrics.category &&
        `${a.year}-${String(a.month).padStart(2, '0')}-01` === budget.snapshotDate
      );
      const actualAmount = matchingActuals.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
      variance.push({
        category: metrics.category,
        budgeted: metrics.amount,
        actual: actualAmount,
        variance: actualAmount - metrics.amount,
        month: budget.snapshotDate as string,
      });
    }

    res.json({
      asset: {
        id: asset.id,
        name: asset.propertyTitle,
        type: asset.propertyType,
        projectId: asset.projectId,
      },
      snapshots: snapshots.slice(0, 24),
      actuals: actuals.slice(0, 100),
      budgetVsActual: variance,
    });
  } catch (error) {
    console.error('Error fetching asset performance:', error);
    res.status(500).json({ error: 'Failed to fetch asset performance' });
  }
});

router.get('/marinas/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    
    const [marina] = await db.select()
      .from(opsMarinas)
      .where(and(eq(opsMarinas.id, id), eq(opsMarinas.orgId, orgId)));
    
    if (!marina) {
      return res.status(404).json({ error: 'Marina not found' });
    }
    
    res.json(marina);
  } catch (error) {
    console.error('Error fetching marina:', error);
    res.status(500).json({ error: 'Failed to fetch marina' });
  }
});

router.post('/marinas', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    
    const parsed = marinaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const [marina] = await db.insert(opsMarinas)
      .values({ ...parsed.data, orgId })
      .returning();
    
    res.json(marina);
  } catch (error) {
    console.error('Error creating marina:', error);
    res.status(500).json({ error: 'Failed to create marina' });
  }
});

router.put('/marinas/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    
    const parsed = marinaSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const [marina] = await db.update(opsMarinas)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(opsMarinas.id, id), eq(opsMarinas.orgId, orgId)))
      .returning();
    
    res.json(marina);
  } catch (error) {
    console.error('Error updating marina:', error);
    res.status(500).json({ error: 'Failed to update marina' });
  }
});

// ============================================================================
// FUEL TRANSACTIONS ROUTES (ACTUALS)
// ============================================================================

router.get('/marinas/:marinaId/fuel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { marinaId } = req.params;
    const { startDate, endDate, aggregation } = req.query;
    
    let conditions = [eq(opsFuelTransactions.orgId, orgId), eq(opsFuelTransactions.marinaId, marinaId)];
    
    if (startDate && endDate) {
      conditions.push(between(opsFuelTransactions.txnDate, startDate as string, endDate as string));
    }
    
    const transactions = await db.select()
      .from(opsFuelTransactions)
      .where(and(...conditions))
      .orderBy(desc(opsFuelTransactions.txnDate));
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching fuel transactions:', error);
    res.status(500).json({ error: 'Failed to fetch fuel transactions' });
  }
});

router.get('/marinas/:marinaId/fuel/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { marinaId } = req.params;
    const { startDate, endDate } = req.query;
    
    let conditions = [eq(opsFuelTransactions.orgId, orgId), eq(opsFuelTransactions.marinaId, marinaId)];
    
    if (startDate && endDate) {
      conditions.push(between(opsFuelTransactions.txnDate, startDate as string, endDate as string));
    }
    
    const summary = await db.select({
      totalGallons: sql<string>`sum(${opsFuelTransactions.gallons})`,
      totalRevenue: sql<string>`sum(${opsFuelTransactions.grossSales})`,
      totalCogs: sql<string>`sum(${opsFuelTransactions.cogs})`,
      grossProfit: sql<string>`sum(${opsFuelTransactions.grossSales}) - sum(${opsFuelTransactions.cogs})`,
      avgPricePerGallon: sql<string>`avg(${opsFuelTransactions.grossSales} / NULLIF(${opsFuelTransactions.gallons}, 0))`,
      avgCostPerGallon: sql<string>`avg(${opsFuelTransactions.cogs} / NULLIF(${opsFuelTransactions.gallons}, 0))`,
      txnCount: sql<number>`count(*)`,
    })
    .from(opsFuelTransactions)
    .where(and(...conditions));
    
    res.json(summary[0] || {});
  } catch (error) {
    console.error('Error fetching fuel summary:', error);
    res.status(500).json({ error: 'Failed to fetch fuel summary' });
  }
});

router.post('/marinas/:marinaId/fuel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { marinaId } = req.params;
    
    const parsed = fuelTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const [transaction] = await db.insert(opsFuelTransactions)
      .values({ ...parsed.data, marinaId, orgId, createdBy: userId })
      .returning();
    
    res.json(transaction);
  } catch (error) {
    console.error('Error creating fuel transaction:', error);
    res.status(500).json({ error: 'Failed to create fuel transaction' });
  }
});

router.put('/fuel/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    
    const parsed = fuelTransactionSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const [transaction] = await db.update(opsFuelTransactions)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(opsFuelTransactions.id, id), eq(opsFuelTransactions.orgId, orgId)))
      .returning();
    
    res.json(transaction);
  } catch (error) {
    console.error('Error updating fuel transaction:', error);
    res.status(500).json({ error: 'Failed to update fuel transaction' });
  }
});

router.delete('/fuel/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    
    await db.delete(opsFuelTransactions)
      .where(and(eq(opsFuelTransactions.id, id), eq(opsFuelTransactions.orgId, orgId)));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting fuel transaction:', error);
    res.status(500).json({ error: 'Failed to delete fuel transaction' });
  }
});

// ============================================================================
// SHIP STORE SALES ROUTES (ACTUALS)
// ============================================================================

router.get('/marinas/:marinaId/ship-store', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { marinaId } = req.params;
    const { startDate, endDate } = req.query;
    
    let conditions = [eq(opsShipStoreSales.orgId, orgId), eq(opsShipStoreSales.marinaId, marinaId)];
    
    if (startDate && endDate) {
      conditions.push(between(opsShipStoreSales.txnDate, startDate as string, endDate as string));
    }
    
    const sales = await db.select()
      .from(opsShipStoreSales)
      .where(and(...conditions))
      .orderBy(desc(opsShipStoreSales.txnDate));
    
    res.json(sales);
  } catch (error) {
    console.error('Error fetching ship store sales:', error);
    res.status(500).json({ error: 'Failed to fetch ship store sales' });
  }
});

router.get('/marinas/:marinaId/ship-store/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { marinaId } = req.params;
    const { startDate, endDate } = req.query;
    
    let conditions = [eq(opsShipStoreSales.orgId, orgId), eq(opsShipStoreSales.marinaId, marinaId)];
    
    if (startDate && endDate) {
      conditions.push(between(opsShipStoreSales.txnDate, startDate as string, endDate as string));
    }
    
    const summary = await db.select({
      totalRevenue: sql<string>`sum(${opsShipStoreSales.grossSales})`,
      totalCogs: sql<string>`sum(${opsShipStoreSales.cogs})`,
      grossProfit: sql<string>`sum(${opsShipStoreSales.grossSales}) - sum(${opsShipStoreSales.cogs})`,
      txnCount: sql<number>`sum(${opsShipStoreSales.txnCount})`,
      avgTicket: sql<string>`avg(${opsShipStoreSales.grossSales} / NULLIF(${opsShipStoreSales.txnCount}, 0))`,
    })
    .from(opsShipStoreSales)
    .where(and(...conditions));
    
    res.json(summary[0] || {});
  } catch (error) {
    console.error('Error fetching ship store summary:', error);
    res.status(500).json({ error: 'Failed to fetch ship store summary' });
  }
});

router.post('/marinas/:marinaId/ship-store', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { marinaId } = req.params;
    
    const parsed = shipStoreSaleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const [sale] = await db.insert(opsShipStoreSales)
      .values({ ...parsed.data, marinaId, orgId, createdBy: userId })
      .returning();
    
    res.json(sale);
  } catch (error) {
    console.error('Error creating ship store sale:', error);
    res.status(500).json({ error: 'Failed to create ship store sale' });
  }
});

// ============================================================================
// SERVICE WORK ORDERS ROUTES (ACTUALS)
// ============================================================================

router.get('/marinas/:marinaId/service', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { marinaId } = req.params;
    const { startDate, endDate, status } = req.query;
    
    const conditions: SQL[] = [eq(opsServiceWorkOrders.orgId, orgId), eq(opsServiceWorkOrders.marinaId, marinaId)];
    
    if (startDate && endDate) {
      conditions.push(between(opsServiceWorkOrders.openDate, startDate as string, endDate as string));
    }
    
    if (status) {
      conditions.push(eq(opsServiceWorkOrders.status, status as string));
    }
    
    const workOrders = await db.select()
      .from(opsServiceWorkOrders)
      .where(and(...conditions))
      .orderBy(desc(opsServiceWorkOrders.openDate));
    
    res.json(workOrders);
  } catch (error) {
    console.error('Error fetching service work orders:', error);
    res.status(500).json({ error: 'Failed to fetch service work orders' });
  }
});

router.post('/marinas/:marinaId/service', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { marinaId } = req.params;
    
    const parsed = serviceWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const [workOrder] = await db.insert(opsServiceWorkOrders)
      .values({ ...parsed.data, marinaId, orgId, createdBy: userId })
      .returning();
    
    res.json(workOrder);
  } catch (error) {
    console.error('Error creating service work order:', error);
    res.status(500).json({ error: 'Failed to create service work order' });
  }
});

// ============================================================================
// VALUATOR PROJECT CONTEXT ROUTES
// ============================================================================

router.get('/projects/:projectId/context', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const [context] = await db.select()
      .from(valuatorProjectContext)
      .where(eq(valuatorProjectContext.projectId, projectId));
    
    if (!context) {
      return res.json({
        projectId,
        projectType: 'ACQUISITION',
        defaultDataSource: 'ASSUMPTIONS',
        marinaId: null,
        lastImportAt: null,
        assumptionsCoverageMonths: 0
      });
    }
    
    res.json(context);
  } catch (error) {
    console.error('Error fetching project context:', error);
    res.status(500).json({ error: 'Failed to fetch project context' });
  }
});

router.get('/projects/contexts-by-marina/:marinaId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { marinaId } = req.params;
    
    const marina = await db.select()
      .from(opsMarinas)
      .where(and(eq(opsMarinas.id, marinaId), eq(opsMarinas.orgId, orgId)));
    
    if (marina.length === 0) {
      return res.status(404).json({ error: 'Marina not found' });
    }
    
    const contexts = await db.select()
      .from(valuatorProjectContext)
      .where(eq(valuatorProjectContext.marinaId, marinaId));
    
    res.json(contexts);
  } catch (error) {
    console.error('Error fetching project contexts by marina:', error);
    res.status(500).json({ error: 'Failed to fetch project contexts' });
  }
});

router.post('/projects/:projectId/context', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const parsed = projectContextSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const data = parsed.data;
    const existing = await db.select()
      .from(valuatorProjectContext)
      .where(eq(valuatorProjectContext.projectId, projectId));
    
    let result;
    if (existing.length > 0) {
      [result] = await db.update(valuatorProjectContext)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(valuatorProjectContext.projectId, projectId))
        .returning();
    } else {
      [result] = await db.insert(valuatorProjectContext)
        .values({ ...data, projectId })
        .returning();
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating project context:', error);
    res.status(500).json({ error: 'Failed to update project context' });
  }
});

// ============================================================================
// ASSUMPTIONS ROUTES (PER MODULE)
// ============================================================================

router.get('/projects/:projectId/assumptions/fuel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const assumptions = await db.select()
      .from(asmpFuel)
      .where(eq(asmpFuel.projectId, projectId))
      .orderBy(asmpFuel.periodMonth);
    
    res.json(assumptions);
  } catch (error) {
    console.error('Error fetching fuel assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch fuel assumptions' });
  }
});

router.post('/projects/:projectId/assumptions/fuel/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { rows } = req.body;
    
    const results = [];
    for (const row of rows) {
      const existing = await db.select()
        .from(asmpFuel)
        .where(and(eq(asmpFuel.projectId, projectId), eq(asmpFuel.periodMonth, row.periodMonth)));
      
      let result;
      if (existing.length > 0) {
        [result] = await db.update(asmpFuel)
          .set({ ...row, updatedAt: new Date() })
          .where(and(eq(asmpFuel.projectId, projectId), eq(asmpFuel.periodMonth, row.periodMonth)))
          .returning();
      } else {
        [result] = await db.insert(asmpFuel)
          .values({ ...row, projectId, orgId })
          .returning();
      }
      results.push(result);
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating fuel assumptions:', error);
    res.status(500).json({ error: 'Failed to bulk update fuel assumptions' });
  }
});

router.get('/projects/:projectId/assumptions/ship-store', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const assumptions = await db.select()
      .from(asmpShipStore)
      .where(eq(asmpShipStore.projectId, projectId))
      .orderBy(asmpShipStore.periodMonth);
    
    res.json(assumptions);
  } catch (error) {
    console.error('Error fetching ship store assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch ship store assumptions' });
  }
});

router.post('/projects/:projectId/assumptions/ship-store/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { rows } = req.body;
    
    const results = [];
    for (const row of rows) {
      const existing = await db.select()
        .from(asmpShipStore)
        .where(and(eq(asmpShipStore.projectId, projectId), eq(asmpShipStore.periodMonth, row.periodMonth)));
      
      let result;
      if (existing.length > 0) {
        [result] = await db.update(asmpShipStore)
          .set({ ...row, updatedAt: new Date() })
          .where(and(eq(asmpShipStore.projectId, projectId), eq(asmpShipStore.periodMonth, row.periodMonth)))
          .returning();
      } else {
        [result] = await db.insert(asmpShipStore)
          .values({ ...row, projectId, orgId })
          .returning();
      }
      results.push(result);
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating ship store assumptions:', error);
    res.status(500).json({ error: 'Failed to bulk update ship store assumptions' });
  }
});

// ============================================================================
// ASSUMPTIONS CRUD - Service Department
// ============================================================================

router.get('/projects/:projectId/assumptions/service', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const assumptions = await db.select()
      .from(asmpService)
      .where(eq(asmpService.projectId, projectId))
      .orderBy(asmpService.periodMonth);
    res.json(assumptions);
  } catch (error) {
    console.error('Error fetching service assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch service assumptions' });
  }
});

router.post('/projects/:projectId/assumptions/service/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { rows } = req.body;
    const results = [];
    for (const row of rows) {
      const existing = await db.select()
        .from(asmpService)
        .where(and(eq(asmpService.projectId, projectId), eq(asmpService.periodMonth, row.periodMonth)));
      let result;
      if (existing.length > 0) {
        [result] = await db.update(asmpService)
          .set({ ...row, updatedAt: new Date() })
          .where(and(eq(asmpService.projectId, projectId), eq(asmpService.periodMonth, row.periodMonth)))
          .returning();
      } else {
        [result] = await db.insert(asmpService)
          .values({ ...row, projectId, orgId })
          .returning();
      }
      results.push(result);
    }
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating service assumptions:', error);
    res.status(500).json({ error: 'Failed to bulk update service assumptions' });
  }
});

// ============================================================================
// ASSUMPTIONS CRUD - Commercial Tenants
// ============================================================================

router.get('/projects/:projectId/assumptions/commercial-tenants', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const assumptions = await db.select()
      .from(asmpCommercialTenants)
      .where(eq(asmpCommercialTenants.projectId, projectId))
      .orderBy(asmpCommercialTenants.periodMonth);
    res.json(assumptions);
  } catch (error) {
    console.error('Error fetching commercial tenant assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch commercial tenant assumptions' });
  }
});

router.post('/projects/:projectId/assumptions/commercial-tenants/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { rows } = req.body;
    const results = [];
    for (const row of rows) {
      const existing = await db.select()
        .from(asmpCommercialTenants)
        .where(and(eq(asmpCommercialTenants.projectId, projectId), eq(asmpCommercialTenants.periodMonth, row.periodMonth)));
      let result;
      if (existing.length > 0) {
        [result] = await db.update(asmpCommercialTenants)
          .set({ ...row, updatedAt: new Date() })
          .where(and(eq(asmpCommercialTenants.projectId, projectId), eq(asmpCommercialTenants.periodMonth, row.periodMonth)))
          .returning();
      } else {
        [result] = await db.insert(asmpCommercialTenants)
          .values({ ...row, projectId, orgId })
          .returning();
      }
      results.push(result);
    }
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating commercial tenant assumptions:', error);
    res.status(500).json({ error: 'Failed to bulk update commercial tenant assumptions' });
  }
});

// ============================================================================
// ASSUMPTIONS CRUD - Boat Rentals
// ============================================================================

router.get('/projects/:projectId/assumptions/boat-rentals', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const assumptions = await db.select()
      .from(asmpBoatRentals)
      .where(eq(asmpBoatRentals.projectId, projectId))
      .orderBy(asmpBoatRentals.periodMonth);
    res.json(assumptions);
  } catch (error) {
    console.error('Error fetching boat rental assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch boat rental assumptions' });
  }
});

router.post('/projects/:projectId/assumptions/boat-rentals/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { rows } = req.body;
    const results = [];
    for (const row of rows) {
      const existing = await db.select()
        .from(asmpBoatRentals)
        .where(and(eq(asmpBoatRentals.projectId, projectId), eq(asmpBoatRentals.periodMonth, row.periodMonth)));
      let result;
      if (existing.length > 0) {
        [result] = await db.update(asmpBoatRentals)
          .set({ ...row, updatedAt: new Date() })
          .where(and(eq(asmpBoatRentals.projectId, projectId), eq(asmpBoatRentals.periodMonth, row.periodMonth)))
          .returning();
      } else {
        [result] = await db.insert(asmpBoatRentals)
          .values({ ...row, projectId, orgId })
          .returning();
      }
      results.push(result);
    }
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating boat rental assumptions:', error);
    res.status(500).json({ error: 'Failed to bulk update boat rental assumptions' });
  }
});

// ============================================================================
// ASSUMPTIONS CRUD - Boat Club
// ============================================================================

router.get('/projects/:projectId/assumptions/boat-club', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const assumptions = await db.select()
      .from(asmpBoatClub)
      .where(eq(asmpBoatClub.projectId, projectId))
      .orderBy(asmpBoatClub.periodMonth);
    res.json(assumptions);
  } catch (error) {
    console.error('Error fetching boat club assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch boat club assumptions' });
  }
});

router.post('/projects/:projectId/assumptions/boat-club/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { rows } = req.body;
    const results = [];
    for (const row of rows) {
      const existing = await db.select()
        .from(asmpBoatClub)
        .where(and(eq(asmpBoatClub.projectId, projectId), eq(asmpBoatClub.periodMonth, row.periodMonth)));
      let result;
      if (existing.length > 0) {
        [result] = await db.update(asmpBoatClub)
          .set({ ...row, updatedAt: new Date() })
          .where(and(eq(asmpBoatClub.projectId, projectId), eq(asmpBoatClub.periodMonth, row.periodMonth)))
          .returning();
      } else {
        [result] = await db.insert(asmpBoatClub)
          .values({ ...row, projectId, orgId })
          .returning();
      }
      results.push(result);
    }
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating boat club assumptions:', error);
    res.status(500).json({ error: 'Failed to bulk update boat club assumptions' });
  }
});

// ============================================================================
// ASSUMPTIONS CRUD - Boat Sales
// ============================================================================

router.get('/projects/:projectId/assumptions/boat-sales', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const assumptions = await db.select()
      .from(asmpBoatSales)
      .where(eq(asmpBoatSales.projectId, projectId))
      .orderBy(asmpBoatSales.periodMonth);
    res.json(assumptions);
  } catch (error) {
    console.error('Error fetching boat sales assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch boat sales assumptions' });
  }
});

router.post('/projects/:projectId/assumptions/boat-sales/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { rows } = req.body;
    const results = [];
    for (const row of rows) {
      const existing = await db.select()
        .from(asmpBoatSales)
        .where(and(eq(asmpBoatSales.projectId, projectId), eq(asmpBoatSales.periodMonth, row.periodMonth)));
      let result;
      if (existing.length > 0) {
        [result] = await db.update(asmpBoatSales)
          .set({ ...row, updatedAt: new Date() })
          .where(and(eq(asmpBoatSales.projectId, projectId), eq(asmpBoatSales.periodMonth, row.periodMonth)))
          .returning();
      } else {
        [result] = await db.insert(asmpBoatSales)
          .values({ ...row, projectId, orgId })
          .returning();
      }
      results.push(result);
    }
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating boat sales assumptions:', error);
    res.status(500).json({ error: 'Failed to bulk update boat sales assumptions' });
  }
});

// ============================================================================
// ASSUMPTIONS CRUD - Bookkeeping
// ============================================================================

router.get('/projects/:projectId/assumptions/bookkeeping', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const assumptions = await db.select()
      .from(asmpBookkeeping)
      .where(eq(asmpBookkeeping.projectId, projectId))
      .orderBy(asmpBookkeeping.periodMonth);
    res.json(assumptions);
  } catch (error) {
    console.error('Error fetching bookkeeping assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch bookkeeping assumptions' });
  }
});

router.post('/projects/:projectId/assumptions/bookkeeping/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { rows } = req.body;
    const results = [];
    for (const row of rows) {
      const existing = await db.select()
        .from(asmpBookkeeping)
        .where(and(eq(asmpBookkeeping.projectId, projectId), eq(asmpBookkeeping.periodMonth, row.periodMonth)));
      let result;
      if (existing.length > 0) {
        [result] = await db.update(asmpBookkeeping)
          .set({ ...row, updatedAt: new Date() })
          .where(and(eq(asmpBookkeeping.projectId, projectId), eq(asmpBookkeeping.periodMonth, row.periodMonth)))
          .returning();
      } else {
        [result] = await db.insert(asmpBookkeeping)
          .values({ ...row, projectId, orgId })
          .returning();
      }
      results.push(result);
    }
    res.json(results);
  } catch (error) {
    console.error('Error bulk updating bookkeeping assumptions:', error);
    res.status(500).json({ error: 'Failed to bulk update bookkeeping assumptions' });
  }
});

router.delete('/projects/:projectId/assumptions/bookkeeping/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId, id } = req.params;
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const [deleted] = await db.delete(asmpBookkeeping)
      .where(and(eq(asmpBookkeeping.id, id), eq(asmpBookkeeping.projectId, projectId)))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bookkeeping entry:', error);
    res.status(500).json({ error: 'Failed to delete bookkeeping entry' });
  }
});

// ============================================================================
// IMPORT ACTUALS TO ASSUMPTIONS
// ============================================================================

router.post('/projects/:projectId/import-actuals', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const parsed = importActualsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }
    
    const { scope, rangeStart, rangeEnd, overwrite } = parsed.data;
    const startTime = Date.now();
    
    // Check for project context - support owned assets of any type, not just marinas
    const [context] = await db.select()
      .from(valuatorProjectContext)
      .where(eq(valuatorProjectContext.projectId, projectId));

    if (!context || context.projectType !== 'OWNED') {
      return res.status(400).json({ error: 'Import actuals only available for owned asset projects' });
    }

    // Resolve asset type for P&L mapping
    let assetType = 'marina';
    const [linkedAsset] = await db.select({
      propertyType: crmProperties.type,
    })
      .from(ownedAssets)
      .innerJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
      .where(and(eq(ownedAssets.projectId, projectId), eq(ownedAssets.orgId, orgId)));
    if (linkedAsset) {
      assetType = linkedAsset.propertyType || 'marina';
    }

    const marinaId = context.marinaId;
    let rowsWritten = 0;
    const monthsAffected = new Set<string>();
    
    if (scope === 'ALL' || scope === 'FUEL') {
      const fuelData = await db.select({
        month: sql<string>`date_trunc('month', ${opsFuelTransactions.txnDate})::date`,
        gallons: sql<string>`sum(${opsFuelTransactions.gallons})`,
        revenue: sql<string>`sum(${opsFuelTransactions.grossSales})`,
        cogs: sql<string>`sum(${opsFuelTransactions.cogs})`,
      })
      .from(opsFuelTransactions)
      .where(and(
        eq(opsFuelTransactions.marinaId, marinaId),
        between(opsFuelTransactions.txnDate, rangeStart, rangeEnd)
      ))
      .groupBy(sql`date_trunc('month', ${opsFuelTransactions.txnDate})::date`);
      
      for (const row of fuelData) {
        const periodMonth = row.month;
        monthsAffected.add(periodMonth);
        
        if (overwrite) {
          await db.delete(asmpFuel)
            .where(and(eq(asmpFuel.projectId, projectId), eq(asmpFuel.periodMonth, periodMonth)));
        }
        
        const existing = await db.select().from(asmpFuel)
          .where(and(eq(asmpFuel.projectId, projectId), eq(asmpFuel.periodMonth, periodMonth)));
        
        if (existing.length === 0) {
          await db.insert(asmpFuel).values({
            projectId,
            orgId,
            periodMonth,
            gallons: row.gallons,
            revenue: row.revenue,
            cogs: row.cogs,
            grossProfit: String(Number(row.revenue) - Number(row.cogs)),
            importedAt: new Date(),
            importSource: 'ACTUALS'
          });
          rowsWritten++;
        }
      }
    }
    
    if (scope === 'ALL' || scope === 'SHIP_STORE') {
      const storeData = await db.select({
        month: sql<string>`date_trunc('month', ${opsShipStoreSales.txnDate})::date`,
        revenue: sql<string>`sum(${opsShipStoreSales.grossSales})`,
        cogs: sql<string>`sum(${opsShipStoreSales.cogs})`,
        txnCount: sql<number>`sum(${opsShipStoreSales.txnCount})`,
      })
      .from(opsShipStoreSales)
      .where(and(
        eq(opsShipStoreSales.marinaId, marinaId),
        between(opsShipStoreSales.txnDate, rangeStart, rangeEnd)
      ))
      .groupBy(sql`date_trunc('month', ${opsShipStoreSales.txnDate})::date`);
      
      for (const row of storeData) {
        const periodMonth = row.month;
        monthsAffected.add(periodMonth);
        
        if (overwrite) {
          await db.delete(asmpShipStore)
            .where(and(eq(asmpShipStore.projectId, projectId), eq(asmpShipStore.periodMonth, periodMonth)));
        }
        
        const existing = await db.select().from(asmpShipStore)
          .where(and(eq(asmpShipStore.projectId, projectId), eq(asmpShipStore.periodMonth, periodMonth)));
        
        if (existing.length === 0) {
          await db.insert(asmpShipStore).values({
            projectId,
            orgId,
            periodMonth,
            revenue: row.revenue,
            cogs: row.cogs,
            grossProfit: String(Number(row.revenue) - Number(row.cogs)),
            txnCount: row.txnCount,
            importedAt: new Date(),
            importSource: 'ACTUALS'
          });
          rowsWritten++;
        }
      }
    }

    // Import bookkeeping GL data (works for all asset classes)
    if ((scope === 'ALL' || scope === 'BOOKKEEPING') && marinaId) {
      const pnlMappings = getPnlMappingForAssetClass(assetType);
      const glData = await db.select({
        month: sql<string>`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
        accountType: opsBookkeepingGl.accountType,
        accountName: opsBookkeepingGl.accountName,
        total: sql<string>`sum(${opsBookkeepingGl.amount})`,
      })
        .from(opsBookkeepingGl)
        .where(and(
          eq(opsBookkeepingGl.marinaId, marinaId),
          between(opsBookkeepingGl.periodStart, rangeStart, rangeEnd)
        ))
        .groupBy(
          sql`date_trunc('month', ${opsBookkeepingGl.periodStart})::date`,
          opsBookkeepingGl.accountType,
          opsBookkeepingGl.accountName
        );

      for (const row of glData) {
        const periodMonth = row.month;
        monthsAffected.add(periodMonth);
        const d = new Date(periodMonth);
        const isExpense = row.accountType === 'expense' || row.accountType === 'EXPENSE';

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
        rowsWritten++;
      }
    }

    // Import commercial tenant data (works for all asset classes with tenants)
    if ((scope === 'ALL' || scope === 'COMMERCIAL') && marinaId) {
      const pnlMappings = getPnlMappingForAssetClass(assetType);
      const tenantData = await db.select({
        month: sql<string>`date_trunc('month', ${opsCommercialLeases.startDate})::date`,
        revenue: sql<string>`sum(${opsCommercialLeases.baseRent} + coalesce(${opsCommercialLeases.cam}, 0))`,
      })
        .from(opsCommercialLeases)
        .where(and(
          eq(opsCommercialLeases.marinaId, marinaId),
          eq(opsCommercialLeases.status, 'active'),
        ))
        .groupBy(sql`date_trunc('month', ${opsCommercialLeases.startDate})::date`);

      const mapping = pnlMappings.find(m => m.profitCenter === 'base_rent' || m.profitCenter === 'commercial_tenants');
      for (const row of tenantData) {
        const periodMonth = row.month;
        monthsAffected.add(periodMonth);
        const d = new Date(periodMonth);

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
        rowsWritten++;
      }
    }

    const durationMs = Date.now() - startTime;

    // Only log import event if we have a valid marina reference
    if (marinaId) {
      await db.insert(opsImportEvents).values({
        projectId,
        marinaId,
        orgId,
        scope: scope as any,
        rangeStart,
        rangeEnd,
        overwrite: overwrite || false,
        rowsWritten,
        monthsAffected: monthsAffected.size,
        durationMs,
        status: 'completed',
        createdBy: userId
      });
    }

    await db.update(valuatorProjectContext)
      .set({
        lastImportAt: new Date(),
        assumptionsCoverageMonths: monthsAffected.size,
        updatedAt: new Date()
      })
      .where(eq(valuatorProjectContext.projectId, projectId));
    
    res.json({
      success: true,
      rowsWritten,
      monthsAffected: monthsAffected.size,
      durationMs
    });
  } catch (error) {
    console.error('Error importing actuals:', error);
    res.status(500).json({ error: 'Failed to import actuals' });
  }
});

router.get('/projects/:projectId/import-history', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const events = await db.select()
      .from(opsImportEvents)
      .where(eq(opsImportEvents.projectId, projectId))
      .orderBy(desc(opsImportEvents.createdAt));
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

// ============================================================================
// MODULE OUTPUT AGGREGATOR (For Pro Forma)
// ============================================================================

router.get('/projects/:projectId/module-outputs', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    const { startMonth, endMonth } = req.query;
    
    if (!await requireProjectInOrg(projectId, orgId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const outputs: any[] = [];
    
    const fuelData = await db.select().from(asmpFuel)
      .where(eq(asmpFuel.projectId, projectId))
      .orderBy(asmpFuel.periodMonth);
    
    for (const row of fuelData) {
      outputs.push({
        module: 'FUEL',
        month: row.periodMonth,
        revenue: row.revenue,
        cogs: row.cogs,
        grossProfit: row.grossProfit,
        drivers: { gallons: row.gallons }
      });
    }
    
    const storeData = await db.select().from(asmpShipStore)
      .where(eq(asmpShipStore.projectId, projectId))
      .orderBy(asmpShipStore.periodMonth);
    
    for (const row of storeData) {
      outputs.push({
        module: 'SHIP_STORE',
        month: row.periodMonth,
        revenue: row.revenue,
        cogs: row.cogs,
        grossProfit: row.grossProfit,
        drivers: { txnCount: row.txnCount, avgTicket: row.avgTicket }
      });
    }
    
    const serviceData = await db.select().from(asmpService)
      .where(eq(asmpService.projectId, projectId))
      .orderBy(asmpService.periodMonth);
    
    for (const row of serviceData) {
      outputs.push({
        module: 'SERVICE',
        month: row.periodMonth,
        revenue: row.totalRevenue,
        cogs: row.cogs,
        grossProfit: row.grossProfit,
        drivers: { laborRevenue: row.laborRevenue, partsRevenue: row.partsRevenue }
      });
    }

    const rentalData = await db.select().from(asmpBoatRentals)
      .where(eq(asmpBoatRentals.projectId, projectId))
      .orderBy(asmpBoatRentals.periodMonth);

    for (const row of rentalData) {
      outputs.push({
        module: 'BOAT_RENTALS',
        month: row.periodMonth,
        revenue: row.revenue,
        cogs: null,
        grossProfit: row.revenue,
        drivers: { hours: row.hours, avgRatePerHour: row.avgRatePerHour, utilizationPct: row.utilizationPct }
      });
    }

    const clubData = await db.select().from(asmpBoatClub)
      .where(eq(asmpBoatClub.projectId, projectId))
      .orderBy(asmpBoatClub.periodMonth);

    for (const row of clubData) {
      outputs.push({
        module: 'BOAT_CLUB',
        month: row.periodMonth,
        revenue: row.monthlyRecurringRevenue,
        cogs: null,
        grossProfit: row.monthlyRecurringRevenue,
        drivers: { memberCount: row.memberCount, avgMonthlyDues: row.avgMonthlyDues, churnPct: row.churnPct }
      });
    }

    const boatSalesData = await db.select().from(asmpBoatSales)
      .where(eq(asmpBoatSales.projectId, projectId))
      .orderBy(asmpBoatSales.periodMonth);

    for (const row of boatSalesData) {
      outputs.push({
        module: 'BOAT_SALES',
        month: row.periodMonth,
        revenue: row.revenue,
        cogs: row.cogs,
        grossProfit: row.grossProfit,
        drivers: { units: row.units, avgSalePrice: row.avgSalePrice, marginPct: row.marginPct }
      });
    }

    const tenantData = await db.select().from(asmpCommercialTenants)
      .where(eq(asmpCommercialTenants.projectId, projectId))
      .orderBy(asmpCommercialTenants.periodMonth);

    for (const row of tenantData) {
      outputs.push({
        module: 'COMMERCIAL_TENANTS',
        month: row.periodMonth,
        revenue: row.totalRevenue,
        cogs: null,
        grossProfit: row.totalRevenue,
        drivers: { tenantCount: row.tenantCount, occupancyPct: row.occupancyPct, avgRentPerSqft: row.avgRentPerSqft }
      });
    }

    const bkData = await db.select().from(asmpBookkeeping)
      .where(eq(asmpBookkeeping.projectId, projectId))
      .orderBy(asmpBookkeeping.periodMonth);

    for (const row of bkData) {
      outputs.push({
        module: 'BOOKKEEPING',
        month: row.periodMonth,
        revenue: row.revenueTotalOverride,
        cogs: row.expenseTotalOverride,
        grossProfit: row.noiOverride,
        drivers: {}
      });
    }
    
    res.json(outputs);
  } catch (error) {
    console.error('Error fetching module outputs:', error);
    res.status(500).json({ error: 'Failed to fetch module outputs' });
  }
});

// ============================================================================
// SEED DATA (Development Only)
// ============================================================================

router.post('/seed', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Seed only available in development' });
    }
    
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    
    const portfolioId = randomUUID();
    await db.insert(opsPortfolios).values({
      id: portfolioId,
      orgId,
      userId,
      name: "Coastal Holdings Portfolio",
      description: "Primary portfolio of owned marina properties",
    });
    
    const marina1Id = randomUUID();
    const marina2Id = randomUUID();
    
    await db.insert(opsMarinas).values([
      {
        id: marina1Id,
        orgId,
        portfolioId,
        name: "Sunset Bay Marina",
        address: "123 Harbor Drive",
        city: "Miami",
        state: "FL",
        slipCount: 120,
        wetSlips: 100,
        dryStorage: 20,
        ownershipStatus: "OWNED",
      },
      {
        id: marina2Id,
        orgId,
        portfolioId,
        name: "Crystal Cove Marina",
        address: "456 Ocean Boulevard",
        city: "Fort Lauderdale",
        state: "FL",
        slipCount: 85,
        wetSlips: 75,
        dryStorage: 10,
        ownershipStatus: "OWNED",
      },
    ]);
    
    const today = new Date();
    const fuelTransactions = [];
    
    for (let i = 0; i < 60; i++) {
      const txDate = new Date(today);
      txDate.setDate(txDate.getDate() - i);
      
      const numTxToday = Math.floor(Math.random() * 5) + 1;
      for (let j = 0; j < numTxToday; j++) {
        const gallons = Math.floor(Math.random() * 150) + 20;
        const pricePerGallon = 4.25 + (Math.random() * 0.5);
        const cogs = gallons * (pricePerGallon * 0.75);
        
        fuelTransactions.push({
          id: randomUUID(),
          orgId,
          marinaId: i % 2 === 0 ? marina1Id : marina2Id,
          txnDate: txDate,
          fuelType: ["DIESEL", "GAS_87", "GAS_93"][Math.floor(Math.random() * 3)] as "DIESEL" | "GAS_87" | "GAS_93",
          gallons: gallons.toString(),
          pricePerGallon: pricePerGallon.toFixed(2),
          grossSales: (gallons * pricePerGallon).toFixed(2),
          cogs: cogs.toFixed(2),
        });
      }
    }
    
    await db.insert(opsFuelTransactions).values(fuelTransactions);
    
    const shipStoreSales = [];
    
    for (let i = 0; i < 45; i++) {
      const txDate = new Date(today);
      txDate.setDate(txDate.getDate() - i);
      
      const numSalesToday = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numSalesToday; j++) {
        const items = Math.floor(Math.random() * 5) + 1;
        const subtotal = Math.floor(Math.random() * 200) + 20;
        const taxRate = 0.07;
        const tax = subtotal * taxRate;
        const cogs = subtotal * 0.55;
        
        shipStoreSales.push({
          id: randomUUID(),
          orgId,
          marinaId: i % 2 === 0 ? marina1Id : marina2Id,
          txnDate: txDate,
          itemCount: items,
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: (subtotal + tax).toFixed(2),
          cogs: cogs.toFixed(2),
          category: "SUPPLIES",
        });
      }
    }
    
    await db.insert(opsShipStoreSales).values(shipStoreSales);
    
    res.json({
      success: true,
      data: {
        portfolioId,
        marinas: [
          { id: marina1Id, name: "Sunset Bay Marina" },
          { id: marina2Id, name: "Crystal Cove Marina" },
        ],
        fuelTransactions: fuelTransactions.length,
        shipStoreSales: shipStoreSales.length,
      }
    });
  } catch (error) {
    console.error('Error seeding operations data:', error);
    res.status(500).json({ error: 'Failed to seed operations data' });
  }
});

// ============================================================================
// VALUATOR OPERATIONS - Project-scoped operations data for standalone modeling
// These routes support the dual-context architecture where Operations modules
// exist both in the sidebar (marina-centric) and in Valuator (project-centric)
// ============================================================================

// GET project fuel transactions (Valuator context)
router.get('/projects/:projectId/ops/fuel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    await requireProjectInOrg(projectId, orgId);
    
    let conditions: SQL<unknown>[] = [
      eq(opsFuelTransactions.modelingProjectId, projectId),
      eq(opsFuelTransactions.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      conditions.push(
        gte(opsFuelTransactions.txnDate, startDate as string),
        lte(opsFuelTransactions.txnDate, endDate as string)
      );
    }
    
    const transactions = await db
      .select()
      .from(opsFuelTransactions)
      .where(and(...conditions))
      .orderBy(desc(opsFuelTransactions.txnDate));
    
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching project fuel transactions:', error);
    res.status(500).json({ error: 'Failed to fetch fuel transactions' });
  }
});

// POST create fuel transaction for project (Valuator context)
router.post('/projects/:projectId/ops/fuel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    
    await requireProjectInOrg(projectId, orgId);
    
    const validated = fuelTransactionSchema.parse(req.body);
    
    const [transaction] = await db.insert(opsFuelTransactions).values({
      id: randomUUID(),
      orgId,
      modelingProjectId: projectId,
      marinaId: null,
      txnDate: validated.txnDate,
      fuelType: validated.fuelType,
      gallons: validated.gallons,
      grossSales: validated.grossSales,
      cogs: validated.cogs || "0",
      source: validated.source,
      notes: validated.notes,
      createdBy: userId,
    }).returning();
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error creating project fuel transaction:', error);
    res.status(500).json({ error: 'Failed to create fuel transaction' });
  }
});

// PUT update fuel transaction for project (Valuator context)
router.put('/projects/:projectId/ops/fuel/:txnId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId, txnId } = req.params;
    
    await requireProjectInOrg(projectId, orgId);
    
    const validated = fuelTransactionSchema.partial().parse(req.body);
    
    const [updated] = await db
      .update(opsFuelTransactions)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(and(
        eq(opsFuelTransactions.id, txnId),
        eq(opsFuelTransactions.modelingProjectId, projectId),
        eq(opsFuelTransactions.orgId, orgId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating project fuel transaction:', error);
    res.status(500).json({ error: 'Failed to update fuel transaction' });
  }
});

// DELETE fuel transaction for project (Valuator context)
router.delete('/projects/:projectId/ops/fuel/:txnId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId, txnId } = req.params;
    
    await requireProjectInOrg(projectId, orgId);
    
    const [deleted] = await db
      .delete(opsFuelTransactions)
      .where(and(
        eq(opsFuelTransactions.id, txnId),
        eq(opsFuelTransactions.modelingProjectId, projectId),
        eq(opsFuelTransactions.orgId, orgId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json({ success: true, data: deleted });
  } catch (error) {
    console.error('Error deleting project fuel transaction:', error);
    res.status(500).json({ error: 'Failed to delete fuel transaction' });
  }
});

// GET project fuel summary (Valuator context)
router.get('/projects/:projectId/ops/fuel/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    await requireProjectInOrg(projectId, orgId);
    
    let conditions: SQL<unknown>[] = [
      eq(opsFuelTransactions.modelingProjectId, projectId),
      eq(opsFuelTransactions.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      conditions.push(
        gte(opsFuelTransactions.txnDate, startDate as string),
        lte(opsFuelTransactions.txnDate, endDate as string)
      );
    }
    
    const result = await db
      .select({
        fuelType: opsFuelTransactions.fuelType,
        totalGallons: sql<string>`sum(${opsFuelTransactions.gallons})`,
        totalRevenue: sql<string>`sum(${opsFuelTransactions.grossSales})`,
        totalCogs: sql<string>`sum(${opsFuelTransactions.cogs})`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(opsFuelTransactions)
      .where(and(...conditions))
      .groupBy(opsFuelTransactions.fuelType);
    
    const totals = result.reduce((acc, row) => ({
      totalGallons: acc.totalGallons + parseFloat(row.totalGallons || '0'),
      totalRevenue: acc.totalRevenue + parseFloat(row.totalRevenue || '0'),
      totalCogs: acc.totalCogs + parseFloat(row.totalCogs || '0'),
      transactionCount: acc.transactionCount + (row.transactionCount || 0),
    }), { totalGallons: 0, totalRevenue: 0, totalCogs: 0, transactionCount: 0 });
    
    res.json({
      success: true,
      data: {
        byFuelType: result,
        totals: {
          ...totals,
          grossMargin: totals.totalRevenue - totals.totalCogs,
          marginPercent: totals.totalRevenue > 0 
            ? ((totals.totalRevenue - totals.totalCogs) / totals.totalRevenue * 100).toFixed(2) 
            : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching project fuel summary:', error);
    res.status(500).json({ error: 'Failed to fetch fuel summary' });
  }
});

// GET project ship store sales (Valuator context)
router.get('/projects/:projectId/ops/ship-store', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    await requireProjectInOrg(projectId, orgId);
    
    let conditions: SQL<unknown>[] = [
      eq(opsShipStoreSales.modelingProjectId, projectId),
      eq(opsShipStoreSales.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      conditions.push(
        gte(opsShipStoreSales.txnDate, startDate as string),
        lte(opsShipStoreSales.txnDate, endDate as string)
      );
    }
    
    const sales = await db
      .select()
      .from(opsShipStoreSales)
      .where(and(...conditions))
      .orderBy(desc(opsShipStoreSales.txnDate));
    
    res.json({ success: true, data: sales });
  } catch (error) {
    console.error('Error fetching project ship store sales:', error);
    res.status(500).json({ error: 'Failed to fetch ship store sales' });
  }
});

// POST create ship store sale for project (Valuator context)
router.post('/projects/:projectId/ops/ship-store', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    
    await requireProjectInOrg(projectId, orgId);
    
    const validated = shipStoreSaleSchema.parse(req.body);
    
    const [sale] = await db.insert(opsShipStoreSales).values({
      id: randomUUID(),
      orgId,
      modelingProjectId: projectId,
      marinaId: null,
      txnDate: validated.txnDate,
      category: validated.category || "GENERAL",
      grossSales: validated.grossSales,
      cogs: validated.cogs || "0",
      txnCount: validated.qty,
      source: validated.source,
      notes: validated.notes,
      createdBy: userId,
    }).returning();
    
    res.json({ success: true, data: sale });
  } catch (error) {
    console.error('Error creating project ship store sale:', error);
    res.status(500).json({ error: 'Failed to create ship store sale' });
  }
});

// PUT update ship store sale for project (Valuator context)
router.put('/projects/:projectId/ops/ship-store/:saleId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId, saleId } = req.params;
    
    await requireProjectInOrg(projectId, orgId);
    
    const validated = shipStoreSaleSchema.partial().parse(req.body);
    
    const [updated] = await db
      .update(opsShipStoreSales)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(and(
        eq(opsShipStoreSales.id, saleId),
        eq(opsShipStoreSales.modelingProjectId, projectId),
        eq(opsShipStoreSales.orgId, orgId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating project ship store sale:', error);
    res.status(500).json({ error: 'Failed to update ship store sale' });
  }
});

// DELETE ship store sale for project (Valuator context)
router.delete('/projects/:projectId/ops/ship-store/:saleId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId, saleId } = req.params;
    
    await requireProjectInOrg(projectId, orgId);
    
    const [deleted] = await db
      .delete(opsShipStoreSales)
      .where(and(
        eq(opsShipStoreSales.id, saleId),
        eq(opsShipStoreSales.modelingProjectId, projectId),
        eq(opsShipStoreSales.orgId, orgId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    res.json({ success: true, data: deleted });
  } catch (error) {
    console.error('Error deleting project ship store sale:', error);
    res.status(500).json({ error: 'Failed to delete ship store sale' });
  }
});

// GET project ship store summary (Valuator context)
router.get('/projects/:projectId/ops/ship-store/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    await requireProjectInOrg(projectId, orgId);
    
    let conditions: SQL<unknown>[] = [
      eq(opsShipStoreSales.modelingProjectId, projectId),
      eq(opsShipStoreSales.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      conditions.push(
        gte(opsShipStoreSales.txnDate, startDate as string),
        lte(opsShipStoreSales.txnDate, endDate as string)
      );
    }
    
    const result = await db
      .select({
        category: opsShipStoreSales.category,
        totalRevenue: sql<string>`sum(${opsShipStoreSales.grossSales})`,
        totalCogs: sql<string>`sum(${opsShipStoreSales.cogs})`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(opsShipStoreSales)
      .where(and(...conditions))
      .groupBy(opsShipStoreSales.category);
    
    const totals = result.reduce((acc, row) => ({
      totalRevenue: acc.totalRevenue + parseFloat(row.totalRevenue || '0'),
      totalCogs: acc.totalCogs + parseFloat(row.totalCogs || '0'),
      transactionCount: acc.transactionCount + (row.transactionCount || 0),
    }), { totalRevenue: 0, totalCogs: 0, transactionCount: 0 });
    
    res.json({
      success: true,
      data: {
        byCategory: result,
        totals: {
          ...totals,
          grossMargin: totals.totalRevenue - totals.totalCogs,
          marginPercent: totals.totalRevenue > 0 
            ? ((totals.totalRevenue - totals.totalCogs) / totals.totalRevenue * 100).toFixed(2) 
            : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching project ship store summary:', error);
    res.status(500).json({ error: 'Failed to fetch ship store summary' });
  }
});

// GET combined operations summary for project (Valuator context)
router.get('/projects/:projectId/ops/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    await requireProjectInOrg(projectId, orgId);
    
    let fuelConditions: SQL<unknown>[] = [
      eq(opsFuelTransactions.modelingProjectId, projectId),
      eq(opsFuelTransactions.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      fuelConditions.push(
        gte(opsFuelTransactions.txnDate, startDate as string),
        lte(opsFuelTransactions.txnDate, endDate as string)
      );
    }
    
    const fuelResult = await db
      .select({
        totalGallons: sql<string>`sum(${opsFuelTransactions.gallons})`,
        totalRevenue: sql<string>`sum(${opsFuelTransactions.grossSales})`,
        totalCogs: sql<string>`sum(${opsFuelTransactions.cogs})`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(opsFuelTransactions)
      .where(and(...fuelConditions));
    
    let storeConditions: SQL<unknown>[] = [
      eq(opsShipStoreSales.modelingProjectId, projectId),
      eq(opsShipStoreSales.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      storeConditions.push(
        gte(opsShipStoreSales.txnDate, startDate as string),
        lte(opsShipStoreSales.txnDate, endDate as string)
      );
    }
    
    const storeResult = await db
      .select({
        totalRevenue: sql<string>`sum(${opsShipStoreSales.grossSales})`,
        totalCogs: sql<string>`sum(${opsShipStoreSales.cogs})`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(opsShipStoreSales)
      .where(and(...storeConditions));
    
    const fuelData = fuelResult[0] || { totalGallons: '0', totalRevenue: '0', totalCogs: '0', transactionCount: 0 };
    const storeData = storeResult[0] || { totalRevenue: '0', totalCogs: '0', transactionCount: 0 };
    
    const fuelRevenue = parseFloat(fuelData.totalRevenue || '0');
    const fuelCogs = parseFloat(fuelData.totalCogs || '0');
    const storeRevenue = parseFloat(storeData.totalRevenue || '0');
    const storeCogs = parseFloat(storeData.totalCogs || '0');
    
    const totalRevenue = fuelRevenue + storeRevenue;
    const totalCogs = fuelCogs + storeCogs;
    
    res.json({
      success: true,
      data: {
        fuel: {
          totalGallons: parseFloat(fuelData.totalGallons || '0'),
          totalRevenue: fuelRevenue,
          totalCogs: fuelCogs,
          grossMargin: fuelRevenue - fuelCogs,
          transactionCount: fuelData.transactionCount || 0,
        },
        shipStore: {
          totalRevenue: storeRevenue,
          totalCogs: storeCogs,
          grossMargin: storeRevenue - storeCogs,
          transactionCount: storeData.transactionCount || 0,
        },
        combined: {
          totalRevenue,
          totalCogs,
          grossMargin: totalRevenue - totalCogs,
          marginPercent: totalRevenue > 0 
            ? ((totalRevenue - totalCogs) / totalRevenue * 100).toFixed(2) 
            : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching project operations summary:', error);
    res.status(500).json({ error: 'Failed to fetch operations summary' });
  }
});

// ============================================================================
// IMPORT FROM ACTUALS - Copy operations data from owned marinas to project
// ============================================================================

// GET available marinas with operations data for import
router.get('/projects/:projectId/ops/import/available', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    
    await requireProjectInOrg(projectId, orgId);
    
    const marinas = await db
      .select({
        id: opsMarinas.id,
        name: opsMarinas.name,
        location: opsMarinas.location,
      })
      .from(opsMarinas)
      .where(eq(opsMarinas.orgId, orgId));
    
    const marinasWithData = await Promise.all(marinas.map(async (marina) => {
      const [fuelCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(opsFuelTransactions)
        .where(and(
          eq(opsFuelTransactions.marinaId, marina.id),
          eq(opsFuelTransactions.orgId, orgId)
        ));
      
      const [storeCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(opsShipStoreSales)
        .where(and(
          eq(opsShipStoreSales.marinaId, marina.id),
          eq(opsShipStoreSales.orgId, orgId)
        ));
      
      return {
        ...marina,
        fuelTransactionCount: fuelCount?.count || 0,
        shipStoreSaleCount: storeCount?.count || 0,
        hasData: (fuelCount?.count || 0) > 0 || (storeCount?.count || 0) > 0,
      };
    }));
    
    res.json({
      success: true,
      data: marinasWithData.filter(m => m.hasData),
    });
  } catch (error) {
    console.error('Error fetching available marinas:', error);
    res.status(500).json({ error: 'Failed to fetch available marinas' });
  }
});

// POST import operations data from marina to project
router.post('/projects/:projectId/ops/import', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    const { marinaId, dataTypes, startDate, endDate } = req.body;
    
    if (!marinaId || !dataTypes || !Array.isArray(dataTypes)) {
      return res.status(400).json({ error: 'marinaId and dataTypes[] required' });
    }
    
    await requireProjectInOrg(projectId, orgId);
    
    let importedFuel = 0;
    let importedStore = 0;
    
    if (dataTypes.includes('fuel')) {
      let conditions: SQL<unknown>[] = [
        eq(opsFuelTransactions.marinaId, marinaId),
        eq(opsFuelTransactions.orgId, orgId),
      ];
      
      if (startDate && endDate) {
        conditions.push(
          gte(opsFuelTransactions.txnDate, startDate),
          lte(opsFuelTransactions.txnDate, endDate)
        );
      }
      
      const marinaFuel = await db
        .select()
        .from(opsFuelTransactions)
        .where(and(...conditions));
      
      for (const txn of marinaFuel) {
        await db.insert(opsFuelTransactions).values({
          id: randomUUID(),
          orgId,
          modelingProjectId: projectId,
          marinaId: null,
          txnDate: txn.txnDate,
          fuelType: txn.fuelType,
          gallons: txn.gallons,
          grossSales: txn.grossSales,
          cogs: txn.cogs,
          source: 'CSV_IMPORT',
          notes: `Imported from marina on ${new Date().toISOString().split('T')[0]}`,
          createdBy: userId,
        });
        importedFuel++;
      }
    }
    
    if (dataTypes.includes('ship-store')) {
      let conditions: SQL<unknown>[] = [
        eq(opsShipStoreSales.marinaId, marinaId),
        eq(opsShipStoreSales.orgId, orgId),
      ];
      
      if (startDate && endDate) {
        conditions.push(
          gte(opsShipStoreSales.txnDate, startDate),
          lte(opsShipStoreSales.txnDate, endDate)
        );
      }
      
      const marinaSales = await db
        .select()
        .from(opsShipStoreSales)
        .where(and(...conditions));
      
      for (const sale of marinaSales) {
        await db.insert(opsShipStoreSales).values({
          id: randomUUID(),
          orgId,
          modelingProjectId: projectId,
          marinaId: null,
          txnDate: sale.txnDate,
          category: sale.category,
          grossSales: sale.grossSales,
          cogs: sale.cogs,
          txnCount: sale.txnCount,
          source: 'CSV_IMPORT',
          notes: `Imported from marina on ${new Date().toISOString().split('T')[0]}`,
          createdBy: userId,
        });
        importedStore++;
      }
    }
    
    let importedService = 0;
    if (dataTypes.includes('service')) {
      let conditions: SQL<unknown>[] = [
        eq(opsServiceWorkOrders.marinaId, marinaId),
        eq(opsServiceWorkOrders.orgId, orgId),
      ];
      
      if (startDate && endDate) {
        conditions.push(
          gte(opsServiceWorkOrders.openDate, startDate),
          lte(opsServiceWorkOrders.openDate, endDate)
        );
      }
      
      const marinaService = await db
        .select()
        .from(opsServiceWorkOrders)
        .where(and(...conditions));
      
      for (const order of marinaService) {
        await db.insert(opsServiceWorkOrders).values({
          id: randomUUID(),
          orgId,
          modelingProjectId: projectId,
          marinaId: null,
          openDate: order.openDate,
          closeDate: order.closeDate,
          laborRevenue: order.laborRevenue,
          partsRevenue: order.partsRevenue,
          cogs: order.cogs,
          status: order.status,
          source: 'CSV_IMPORT',
          notes: `Imported from marina on ${new Date().toISOString().split('T')[0]}`,
          createdBy: userId,
        });
        importedService++;
      }
    }
    
    let importedRentals = 0;
    if (dataTypes.includes('rentals')) {
      let conditions: SQL<unknown>[] = [
        eq(opsBoatRentals.marinaId, marinaId),
        eq(opsBoatRentals.orgId, orgId),
      ];
      
      if (startDate && endDate) {
        conditions.push(
          gte(opsBoatRentals.rentalDate, startDate),
          lte(opsBoatRentals.rentalDate, endDate)
        );
      }
      
      const marinaRentals = await db
        .select()
        .from(opsBoatRentals)
        .where(and(...conditions));
      
      for (const rental of marinaRentals) {
        await db.insert(opsBoatRentals).values({
          id: randomUUID(),
          orgId,
          modelingProjectId: projectId,
          marinaId: null,
          rentalDate: rental.rentalDate,
          hours: rental.hours,
          grossSales: rental.grossSales,
          channel: rental.channel,
          boatType: rental.boatType,
          source: 'CSV_IMPORT',
          notes: `Imported from marina on ${new Date().toISOString().split('T')[0]}`,
          createdBy: userId,
        });
        importedRentals++;
      }
    }
    
    res.json({
      success: true,
      data: {
        imported: {
          fuelTransactions: importedFuel,
          serviceWorkOrders: importedService,
          boatRentals: importedRentals,
          shipStoreSales: importedStore,
        },
      },
    });
  } catch (error) {
    console.error('Error importing operations data:', error);
    res.status(500).json({ error: 'Failed to import operations data' });
  }
});


// ============================================================================
// SERVICE DEPT ROUTES (Valuator context - project-scoped)
// ============================================================================

router.get('/projects/:projectId/ops/service', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    const orgId = req.tenantId!;
    
    await requireProjectInOrg(projectId, orgId);
    
    let conditions: SQL<unknown>[] = [
      eq(opsServiceWorkOrders.modelingProjectId, projectId),
      eq(opsServiceWorkOrders.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      conditions.push(
        gte(opsServiceWorkOrders.openDate, startDate as string),
        lte(opsServiceWorkOrders.openDate, endDate as string)
      );
    }
    
    const workOrders = await db
      .select()
      .from(opsServiceWorkOrders)
      .where(and(...conditions))
      .orderBy(desc(opsServiceWorkOrders.openDate));
    
    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Error fetching project service work orders:', error);
    res.status(500).json({ error: 'Failed to fetch service work orders' });
  }
});

router.post('/projects/:projectId/ops/service', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const orgId = req.tenantId!;
    const userId = req.userId;
    
    await requireProjectInOrg(projectId, orgId);
    
    const [workOrder] = await db.insert(opsServiceWorkOrders).values({
      id: randomUUID(),
      orgId,
      modelingProjectId: projectId,
      marinaId: null,
      openDate: req.body.openDate,
      closeDate: req.body.closeDate || null,
      laborRevenue: req.body.laborRevenue || '0',
      partsRevenue: req.body.partsRevenue || '0',
      cogs: req.body.cogs || '0',
      status: req.body.status || 'closed',
      source: 'MANUAL',
      notes: req.body.notes || null,
      createdBy: userId,
    }).returning();
    
    res.json({ success: true, data: workOrder });
  } catch (error) {
    console.error('Error creating service work order:', error);
    res.status(500).json({ error: 'Failed to create service work order' });
  }
});

router.put('/projects/:projectId/ops/service/:orderId', async (req: Request, res: Response) => {
  try {
    const { projectId, orderId } = req.params;
    const orgId = req.tenantId!;
    
    await requireProjectInOrg(projectId, orgId);
    
    const updateData: any = { updatedAt: new Date() };
    if (req.body.openDate !== undefined) updateData.openDate = req.body.openDate;
    if (req.body.closeDate !== undefined) updateData.closeDate = req.body.closeDate || null;
    if (req.body.laborRevenue !== undefined) updateData.laborRevenue = req.body.laborRevenue;
    if (req.body.partsRevenue !== undefined) updateData.partsRevenue = req.body.partsRevenue;
    if (req.body.cogs !== undefined) updateData.cogs = req.body.cogs;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;
    
    const [updated] = await db.update(opsServiceWorkOrders)
      .set(updateData)
      .where(and(
        eq(opsServiceWorkOrders.id, orderId),
        eq(opsServiceWorkOrders.modelingProjectId, projectId),
        eq(opsServiceWorkOrders.orgId, orgId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating service work order:', error);
    res.status(500).json({ error: 'Failed to update service work order' });
  }
});

router.delete('/projects/:projectId/ops/service/:orderId', async (req: Request, res: Response) => {
  try {
    const { projectId, orderId } = req.params;
    const orgId = req.tenantId!;
    
    await requireProjectInOrg(projectId, orgId);
    
    await db.delete(opsServiceWorkOrders)
      .where(and(
        eq(opsServiceWorkOrders.id, orderId),
        eq(opsServiceWorkOrders.modelingProjectId, projectId),
        eq(opsServiceWorkOrders.orgId, orgId)
      ));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting service work order:', error);
    res.status(500).json({ error: 'Failed to delete service work order' });
  }
});

router.get('/projects/:projectId/ops/service/summary', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    const orgId = req.tenantId!;
    
    await requireProjectInOrg(projectId, orgId);
    
    let conditions: SQL<unknown>[] = [
      eq(opsServiceWorkOrders.modelingProjectId, projectId),
      eq(opsServiceWorkOrders.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      conditions.push(
        gte(opsServiceWorkOrders.openDate, startDate as string),
        lte(opsServiceWorkOrders.openDate, endDate as string)
      );
    }
    
    const result = await db
      .select({
        totalLaborRevenue: sql<number>`COALESCE(SUM(${opsServiceWorkOrders.laborRevenue}), 0)`,
        totalPartsRevenue: sql<number>`COALESCE(SUM(${opsServiceWorkOrders.partsRevenue}), 0)`,
        totalCogs: sql<number>`COALESCE(SUM(${opsServiceWorkOrders.cogs}), 0)`,
        orderCount: sql<string>`COUNT(*)`,
      })
      .from(opsServiceWorkOrders)
      .where(and(...conditions));
    
    const row = result[0];
    const totalLaborRevenue = Number(row?.totalLaborRevenue || 0);
    const totalPartsRevenue = Number(row?.totalPartsRevenue || 0);
    const totalRevenue = totalLaborRevenue + totalPartsRevenue;
    const totalCogs = Number(row?.totalCogs || 0);
    const grossMargin = totalRevenue - totalCogs;
    const marginPercent = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        totalLaborRevenue,
        totalPartsRevenue,
        totalRevenue,
        totalCogs,
        grossMargin,
        marginPercent,
        orderCount: row?.orderCount || '0',
      },
    });
  } catch (error) {
    console.error('Error fetching service summary:', error);
    res.status(500).json({ error: 'Failed to fetch service summary' });
  }
});

// ============================================================================
// BOAT RENTALS ROUTES (Valuator context - project-scoped)
// ============================================================================

router.get('/projects/:projectId/ops/rentals', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    const orgId = req.tenantId!;
    
    await requireProjectInOrg(projectId, orgId);
    
    let conditions: SQL<unknown>[] = [
      eq(opsBoatRentals.modelingProjectId, projectId),
      eq(opsBoatRentals.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      conditions.push(
        gte(opsBoatRentals.rentalDate, startDate as string),
        lte(opsBoatRentals.rentalDate, endDate as string)
      );
    }
    
    const rentals = await db
      .select()
      .from(opsBoatRentals)
      .where(and(...conditions))
      .orderBy(desc(opsBoatRentals.rentalDate));
    
    res.json({ success: true, data: rentals });
  } catch (error) {
    console.error('Error fetching project boat rentals:', error);
    res.status(500).json({ error: 'Failed to fetch boat rentals' });
  }
});

router.post('/projects/:projectId/ops/rentals', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const orgId = req.tenantId!;
    const userId = req.userId;
    
    await requireProjectInOrg(projectId, orgId);
    
    const [rental] = await db.insert(opsBoatRentals).values({
      id: randomUUID(),
      orgId,
      modelingProjectId: projectId,
      marinaId: null,
      rentalDate: req.body.rentalDate,
      hours: req.body.hours,
      grossSales: req.body.grossSales,
      channel: req.body.channel || null,
      boatType: req.body.boatType || null,
      source: 'MANUAL',
      notes: req.body.notes || null,
      createdBy: userId,
    }).returning();
    
    res.json({ success: true, data: rental });
  } catch (error) {
    console.error('Error creating boat rental:', error);
    res.status(500).json({ error: 'Failed to create boat rental' });
  }
});

router.put('/projects/:projectId/ops/rentals/:rentalId', async (req: Request, res: Response) => {
  try {
    const { projectId, rentalId } = req.params;
    const orgId = req.tenantId!;
    
    await requireProjectInOrg(projectId, orgId);
    
    const updateData: any = { updatedAt: new Date() };
    if (req.body.rentalDate !== undefined) updateData.rentalDate = req.body.rentalDate;
    if (req.body.hours !== undefined) updateData.hours = req.body.hours;
    if (req.body.grossSales !== undefined) updateData.grossSales = req.body.grossSales;
    if (req.body.channel !== undefined) updateData.channel = req.body.channel || null;
    if (req.body.boatType !== undefined) updateData.boatType = req.body.boatType || null;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;
    
    const [updated] = await db.update(opsBoatRentals)
      .set(updateData)
      .where(and(
        eq(opsBoatRentals.id, rentalId),
        eq(opsBoatRentals.modelingProjectId, projectId),
        eq(opsBoatRentals.orgId, orgId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating boat rental:', error);
    res.status(500).json({ error: 'Failed to update boat rental' });
  }
});

router.delete('/projects/:projectId/ops/rentals/:rentalId', async (req: Request, res: Response) => {
  try {
    const { projectId, rentalId } = req.params;
    const orgId = req.tenantId!;
    
    await requireProjectInOrg(projectId, orgId);
    
    await db.delete(opsBoatRentals)
      .where(and(
        eq(opsBoatRentals.id, rentalId),
        eq(opsBoatRentals.modelingProjectId, projectId),
        eq(opsBoatRentals.orgId, orgId)
      ));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting boat rental:', error);
    res.status(500).json({ error: 'Failed to delete boat rental' });
  }
});

router.get('/projects/:projectId/ops/rentals/summary', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    const orgId = req.tenantId!;
    
    await requireProjectInOrg(projectId, orgId);
    
    let conditions: SQL<unknown>[] = [
      eq(opsBoatRentals.modelingProjectId, projectId),
      eq(opsBoatRentals.orgId, orgId),
    ];
    
    if (startDate && endDate) {
      conditions.push(
        gte(opsBoatRentals.rentalDate, startDate as string),
        lte(opsBoatRentals.rentalDate, endDate as string)
      );
    }
    
    const result = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${opsBoatRentals.grossSales}), 0)`,
        totalHours: sql<number>`COALESCE(SUM(${opsBoatRentals.hours}), 0)`,
        rentalCount: sql<string>`COUNT(*)`,
      })
      .from(opsBoatRentals)
      .where(and(...conditions));
    
    const row = result[0];
    const totalRevenue = Number(row?.totalRevenue || 0);
    const totalHours = Number(row?.totalHours || 0);
    const averageRevenuePerHour = totalHours > 0 ? totalRevenue / totalHours : 0;
    
    res.json({
      success: true,
      data: {
        totalRevenue,
        totalHours,
        averageRevenuePerHour,
        rentalCount: row?.rentalCount || '0',
      },
    });
  } catch (error) {
    console.error('Error fetching rentals summary:', error);
    res.status(500).json({ error: 'Failed to fetch rentals summary' });
  }
});

// ============================================================================
// PARKING LOT CRUD
// ============================================================================

router.get('/projects/:projectId/ops/parking-lot', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    const orgId = req.tenantId!;

    await requireProjectInOrg(projectId, orgId);

    let conditions: SQL<unknown>[] = [
      eq(opsParkingLot.modelingProjectId, projectId),
      eq(opsParkingLot.orgId, orgId),
    ];

    if (startDate && endDate) {
      conditions.push(
        gte(opsParkingLot.txnDate, startDate as string),
        lte(opsParkingLot.txnDate, endDate as string)
      );
    }

    const records = await db
      .select()
      .from(opsParkingLot)
      .where(and(...conditions))
      .orderBy(desc(opsParkingLot.txnDate));

    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching parking lot records:', error);
    res.status(500).json({ error: 'Failed to fetch parking lot records' });
  }
});

router.post('/projects/:projectId/ops/parking-lot', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const orgId = req.tenantId!;
    const userId = req.userId;

    await requireProjectInOrg(projectId, orgId);

    const parsed = parkingLotSchema.parse(req.body);

    const [record] = await db.insert(opsParkingLot).values({
      id: randomUUID(),
      orgId,
      modelingProjectId: projectId,
      marinaId: null,
      txnDate: parsed.txnDate,
      rateType: parsed.rateType,
      spacesUsed: parsed.spacesUsed,
      hours: parsed.hours,
      grossRevenue: parsed.grossRevenue,
      dayType: parsed.dayType,
      source: 'MANUAL',
      notes: parsed.notes || null,
      createdBy: userId,
    }).returning();

    res.json({ success: true, data: record });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating parking lot record:', error);
    res.status(500).json({ error: 'Failed to create parking lot record' });
  }
});

router.put('/projects/:projectId/ops/parking-lot/:recordId', async (req: Request, res: Response) => {
  try {
    const { projectId, recordId } = req.params;
    const orgId = req.tenantId!;

    await requireProjectInOrg(projectId, orgId);

    const parsed = parkingLotSchema.partial().parse(req.body);

    const updateData: any = { updatedAt: new Date() };
    if (parsed.txnDate !== undefined) updateData.txnDate = parsed.txnDate;
    if (parsed.rateType !== undefined) updateData.rateType = parsed.rateType;
    if (parsed.spacesUsed !== undefined) updateData.spacesUsed = parsed.spacesUsed;
    if (parsed.hours !== undefined) updateData.hours = parsed.hours;
    if (parsed.grossRevenue !== undefined) updateData.grossRevenue = parsed.grossRevenue;
    if (parsed.dayType !== undefined) updateData.dayType = parsed.dayType;
    if (parsed.notes !== undefined) updateData.notes = parsed.notes || null;

    const [updated] = await db.update(opsParkingLot)
      .set(updateData)
      .where(and(
        eq(opsParkingLot.id, recordId),
        eq(opsParkingLot.modelingProjectId, projectId),
        eq(opsParkingLot.orgId, orgId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Parking lot record not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating parking lot record:', error);
    res.status(500).json({ error: 'Failed to update parking lot record' });
  }
});

router.delete('/projects/:projectId/ops/parking-lot/:recordId', async (req: Request, res: Response) => {
  try {
    const { projectId, recordId } = req.params;
    const orgId = req.tenantId!;

    await requireProjectInOrg(projectId, orgId);

    await db.delete(opsParkingLot)
      .where(and(
        eq(opsParkingLot.id, recordId),
        eq(opsParkingLot.modelingProjectId, projectId),
        eq(opsParkingLot.orgId, orgId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting parking lot record:', error);
    res.status(500).json({ error: 'Failed to delete parking lot record' });
  }
});

router.get('/projects/:projectId/ops/parking-lot/summary', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    const orgId = req.tenantId!;

    await requireProjectInOrg(projectId, orgId);

    let conditions: SQL<unknown>[] = [
      eq(opsParkingLot.modelingProjectId, projectId),
      eq(opsParkingLot.orgId, orgId),
    ];

    if (startDate && endDate) {
      conditions.push(
        gte(opsParkingLot.txnDate, startDate as string),
        lte(opsParkingLot.txnDate, endDate as string)
      );
    }

    const byRateType = await db
      .select({
        rateType: opsParkingLot.rateType,
        totalRevenue: sql<number>`COALESCE(SUM(${opsParkingLot.grossRevenue}), 0)`,
        totalSpaces: sql<number>`COALESCE(SUM(${opsParkingLot.spacesUsed}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(opsParkingLot)
      .where(and(...conditions))
      .groupBy(opsParkingLot.rateType);

    const byDayType = await db
      .select({
        dayType: opsParkingLot.dayType,
        totalRevenue: sql<number>`COALESCE(SUM(${opsParkingLot.grossRevenue}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(opsParkingLot)
      .where(and(...conditions))
      .groupBy(opsParkingLot.dayType);

    const totalResult = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${opsParkingLot.grossRevenue}), 0)`,
        totalSpaces: sql<number>`COALESCE(SUM(${opsParkingLot.spacesUsed}), 0)`,
        transactionCount: sql<number>`COUNT(*)::int`,
      })
      .from(opsParkingLot)
      .where(and(...conditions));

    const totals = totalResult[0];

    res.json({
      success: true,
      data: {
        byRateType,
        byDayType,
        totalRevenue: Number(totals?.totalRevenue || 0),
        totalSpaces: Number(totals?.totalSpaces || 0),
        transactionCount: Number(totals?.transactionCount || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching parking lot summary:', error);
    res.status(500).json({ error: 'Failed to fetch parking lot summary' });
  }
});

export default router;
