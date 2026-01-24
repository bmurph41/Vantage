import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { 
  opsPortfolios, opsMarinas, opsFuelTransactions, opsShipStoreSales,
  opsServiceWorkOrders, opsBoatRentals, opsBoatClubMemberships, opsBoatSales,
  opsCommercialLeases, opsBookkeepingGl, valuatorProjectContext, opsImportEvents,
  asmpFuel, asmpShipStore, asmpService, asmpCommercialTenants, asmpBoatRentals,
  asmpBoatClub, asmpBoatSales, asmpBookkeeping, modelingProjects
} from '@shared/schema';
import { eq, and, desc, between, sql, gte, lte, SQL } from 'drizzle-orm';
import { z } from 'zod';

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

const importActualsSchema = z.object({
  scope: z.enum(['ALL', 'FUEL', 'SHIP_STORE', 'SERVICE', 'BOAT_RENTALS', 'BOAT_CLUB', 'BOAT_SALES', 'COMMERCIAL']),
  rangeStart: z.string(),
  rangeEnd: z.string(),
  overwrite: z.boolean().default(false),
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
    
    const [context] = await db.select()
      .from(valuatorProjectContext)
      .where(eq(valuatorProjectContext.projectId, projectId));
    
    if (!context || context.projectType !== 'OWNED' || !context.marinaId) {
      return res.status(400).json({ error: 'Import actuals only available for owned marina projects' });
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
    
    const durationMs = Date.now() - startTime;
    
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
    
    res.json({
      success: true,
      data: {
        imported: {
          fuelTransactions: importedFuel,
          shipStoreSales: importedStore,
        },
      },
    });
  } catch (error) {
    console.error('Error importing operations data:', error);
    res.status(500).json({ error: 'Failed to import operations data' });
  }
});

export default router;
