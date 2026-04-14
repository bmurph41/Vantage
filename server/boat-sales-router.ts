import { Router, type Request, Response, NextFunction } from 'express';
import { db } from './db';
import {
  boatSalesInventory, boatSalesTransactions, boatSalesTradeIns,
  type BoatSalesInventory, type BoatSalesTransaction, type BoatSalesTradeIn,
  insertBoatSalesInventorySchema, insertBoatSalesTransactionSchema, insertBoatSalesTradeInSchema
} from '@shared/schema';
import { eq, desc, sql, and, gte, lte, or } from 'drizzle-orm';

const router = Router();

function requireManager(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const role = user.role?.toLowerCase();
  if (role === 'owner' || role === 'editor' || role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Manager access required' });
}

// ===== INVENTORY =====

router.get('/inventory', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { status, condition, make, search, minPrice, maxPrice } = req.query;
    const conditions = [eq(boatSalesInventory.orgId, user.orgId)];
    if (status) conditions.push(eq(boatSalesInventory.status, status as string));
    if (condition) conditions.push(eq(boatSalesInventory.condition, condition as string));
    if (make) conditions.push(eq(boatSalesInventory.make, make as string));

    const result = await db.select().from(boatSalesInventory)
      .where(and(...conditions))
      .orderBy(desc(boatSalesInventory.createdAt));

    let filtered = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = result.filter(b => 
        b.stockNumber.toLowerCase().includes(searchLower) ||
        b.make.toLowerCase().includes(searchLower) ||
        b.model.toLowerCase().includes(searchLower)
      );
    }
    if (minPrice) {
      filtered = filtered.filter(b => Number(b.listPrice) >= Number(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter(b => Number(b.listPrice) <= Number(maxPrice));
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ message: 'Error fetching inventory' });
  }
});

router.get('/inventory/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const inventory = await db.select().from(boatSalesInventory)
      .where(eq(boatSalesInventory.orgId, user.orgId));

    const available = inventory.filter(b => b.status === 'available');
    const pending = inventory.filter(b => b.status === 'pending');
    const consignment = inventory.filter(b => b.status === 'consignment');

    const stats = {
      totalUnits: inventory.length,
      availableUnits: available.length,
      pendingUnits: pending.length,
      consignmentUnits: consignment.length,
      totalInventoryValue: available.reduce((sum, b) => sum + Number(b.listPrice || 0), 0),
      totalCost: available.reduce((sum, b) => sum + Number(b.cost || 0), 0),
      potentialProfit: available.reduce((sum, b) => sum + (Number(b.listPrice || 0) - Number(b.cost || 0)), 0),
      avgDaysOnLot: available.length > 0 
        ? available.reduce((sum, b) => sum + (b.daysOnLot || 0), 0) / available.length 
        : 0,
      floorPlanExposure: available.reduce((sum, b) => sum + Number(b.floorPlanAmount || 0), 0),
      newUnits: available.filter(b => b.condition === 'new').length,
      usedUnits: available.filter(b => b.condition !== 'new').length,
      inventoryByMake: Object.entries(
        available.reduce((acc, b) => {
          acc[b.make] = (acc[b.make] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([make, count]) => ({ make, count })),
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory stats' });
  }
});

router.get('/inventory/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [boat] = await db.select().from(boatSalesInventory)
      .where(and(eq(boatSalesInventory.id, req.params.id), eq(boatSalesInventory.orgId, user.orgId)));
    if (!boat) return res.status(404).json({ message: 'Boat not found' });
    res.json(boat);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching boat' });
  }
});

router.post('/inventory', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const count = await db.select({ count: sql`count(*)` }).from(boatSalesInventory)
      .where(eq(boatSalesInventory.orgId, user.orgId));
    const stockNumber = `STK-${String(Number(count[0].count) + 1).padStart(6, '0')}`;

    const data = insertBoatSalesInventorySchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      stockNumber,
      createdBy: user.id 
    });
    const [boat] = await db.insert(boatSalesInventory).values(data).returning();
    res.json(boat);
  } catch (error) {
    console.error('Error creating inventory:', error);
    res.status(400).json({ message: 'Error creating inventory' });
  }
});

router.patch('/inventory/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [boat] = await db.update(boatSalesInventory)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(boatSalesInventory.id, req.params.id), eq(boatSalesInventory.orgId, user.orgId)))
      .returning();
    if (!boat) return res.status(404).json({ message: 'Boat not found' });
    res.json(boat);
  } catch (error) {
    res.status(400).json({ message: 'Error updating boat' });
  }
});

router.delete('/inventory/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(boatSalesInventory)
      .where(and(eq(boatSalesInventory.id, req.params.id), eq(boatSalesInventory.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting boat' });
  }
});

// ===== SALES TRANSACTIONS =====

router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { salespersonId, startDate, endDate, financingStatus, search } = req.query;
    const conditions = [eq(boatSalesTransactions.orgId, user.orgId)];
    if (salespersonId) conditions.push(eq(boatSalesTransactions.salespersonId, salespersonId as string));
    if (financingStatus) conditions.push(eq(boatSalesTransactions.financingStatus, financingStatus as string));
    if (startDate) conditions.push(gte(boatSalesTransactions.saleDate, new Date(startDate as string)));
    if (endDate) conditions.push(lte(boatSalesTransactions.saleDate, new Date(endDate as string)));

    const result = await db.select().from(boatSalesTransactions)
      .where(and(...conditions))
      .orderBy(desc(boatSalesTransactions.saleDate));

    let filtered = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = result.filter(t => 
        t.transactionNumber.toLowerCase().includes(searchLower) ||
        t.buyerName.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

router.get('/transactions/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { startDate, endDate } = req.query;
    const conditions = [eq(boatSalesTransactions.orgId, user.orgId)];
    if (startDate) conditions.push(gte(boatSalesTransactions.saleDate, new Date(startDate as string)));
    if (endDate) conditions.push(lte(boatSalesTransactions.saleDate, new Date(endDate as string)));

    const transactions = await db.select().from(boatSalesTransactions).where(and(...conditions));

    const stats = {
      totalSales: transactions.length,
      totalRevenue: transactions.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0),
      totalGrossProfit: transactions.reduce((sum, t) => sum + Number(t.grossProfit || 0), 0),
      avgSalePrice: transactions.length > 0 
        ? transactions.reduce((sum, t) => sum + Number(t.salePrice || 0), 0) / transactions.length 
        : 0,
      avgGrossProfit: transactions.length > 0 
        ? transactions.reduce((sum, t) => sum + Number(t.grossProfit || 0), 0) / transactions.length 
        : 0,
      totalTradeInValue: transactions.reduce((sum, t) => sum + Number(t.tradeInAllowance || 0), 0),
      totalFinancedAmount: transactions.reduce((sum, t) => sum + Number(t.financedAmount || 0), 0),
      financedCount: transactions.filter(t => Number(t.financedAmount || 0) > 0).length,
      cashCount: transactions.filter(t => Number(t.financedAmount || 0) === 0).length,
      totalCommissions: transactions.reduce((sum, t) => sum + Number(t.commissionAmount || 0), 0),
      pendingDelivery: transactions.filter(t => !t.isDelivered).length,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transaction stats' });
  }
});

router.get('/transactions/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const result = await db.select({
      transaction: boatSalesTransactions,
      inventory: boatSalesInventory
    })
    .from(boatSalesTransactions)
    .leftJoin(boatSalesInventory, eq(boatSalesTransactions.inventoryId, boatSalesInventory.id))
    .where(and(eq(boatSalesTransactions.id, req.params.id), eq(boatSalesTransactions.orgId, user.orgId)));

    if (!result[0]) return res.status(404).json({ message: 'Transaction not found' });

    let tradeIn = null;
    if (result[0].transaction.tradeInId) {
      const [ti] = await db.select().from(boatSalesTradeIns)
        .where(eq(boatSalesTradeIns.id, result[0].transaction.tradeInId));
      tradeIn = ti;
    }

    res.json({ ...result[0].transaction, inventory: result[0].inventory, tradeIn });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transaction' });
  }
});

router.post('/transactions', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const count = await db.select({ count: sql`count(*)` }).from(boatSalesTransactions)
      .where(eq(boatSalesTransactions.orgId, user.orgId));
    const transactionNumber = `SALE-${String(Number(count[0].count) + 1).padStart(6, '0')}`;

    const data = insertBoatSalesTransactionSchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      transactionNumber,
      createdBy: user.id 
    });
    const [transaction] = await db.insert(boatSalesTransactions).values(data).returning();

    await db.update(boatSalesInventory)
      .set({ status: 'sold', updatedAt: new Date() })
      .where(eq(boatSalesInventory.id, req.body.inventoryId));

    res.json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(400).json({ message: 'Error creating transaction' });
  }
});

router.patch('/transactions/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [transaction] = await db.update(boatSalesTransactions)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(boatSalesTransactions.id, req.params.id), eq(boatSalesTransactions.orgId, user.orgId)))
      .returning();
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json(transaction);
  } catch (error) {
    res.status(400).json({ message: 'Error updating transaction' });
  }
});

router.delete('/transactions/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [transaction] = await db.select().from(boatSalesTransactions)
      .where(and(eq(boatSalesTransactions.id, req.params.id), eq(boatSalesTransactions.orgId, user.orgId)));
    
    if (transaction) {
      await db.update(boatSalesInventory)
        .set({ status: 'available', updatedAt: new Date() })
        .where(eq(boatSalesInventory.id, transaction.inventoryId));
    }

    await db.delete(boatSalesTransactions)
      .where(and(eq(boatSalesTransactions.id, req.params.id), eq(boatSalesTransactions.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction' });
  }
});

// ===== TRADE-INS =====

router.get('/trade-ins', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { status, search } = req.query;
    const conditions = [eq(boatSalesTradeIns.orgId, user.orgId)];
    if (status) conditions.push(eq(boatSalesTradeIns.status, status as string));

    const result = await db.select().from(boatSalesTradeIns)
      .where(and(...conditions))
      .orderBy(desc(boatSalesTradeIns.createdAt));

    let filtered = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = result.filter(t => 
        t.tradeInNumber.toLowerCase().includes(searchLower) ||
        t.customerName.toLowerCase().includes(searchLower) ||
        t.make.toLowerCase().includes(searchLower) ||
        t.model.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching trade-ins:', error);
    res.status(500).json({ message: 'Error fetching trade-ins' });
  }
});

router.get('/trade-ins/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [tradeIn] = await db.select().from(boatSalesTradeIns)
      .where(and(eq(boatSalesTradeIns.id, req.params.id), eq(boatSalesTradeIns.orgId, user.orgId)));
    if (!tradeIn) return res.status(404).json({ message: 'Trade-in not found' });
    res.json(tradeIn);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trade-in' });
  }
});

router.post('/trade-ins', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const count = await db.select({ count: sql`count(*)` }).from(boatSalesTradeIns)
      .where(eq(boatSalesTradeIns.orgId, user.orgId));
    const tradeInNumber = `TRD-${String(Number(count[0].count) + 1).padStart(6, '0')}`;

    const data = insertBoatSalesTradeInSchema.parse({ 
      ...req.body, 
      orgId: user.orgId, 
      tradeInNumber,
      createdBy: user.id 
    });
    const [tradeIn] = await db.insert(boatSalesTradeIns).values(data).returning();
    res.json(tradeIn);
  } catch (error) {
    console.error('Error creating trade-in:', error);
    res.status(400).json({ message: 'Error creating trade-in' });
  }
});

router.patch('/trade-ins/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const updateData: any = { ...req.body, updatedAt: new Date() };
    
    if (req.body.status === 'evaluated') {
      updateData.evaluatedBy = user.id;
      updateData.evaluatedDate = new Date();
    }

    const [tradeIn] = await db.update(boatSalesTradeIns)
      .set(updateData)
      .where(and(eq(boatSalesTradeIns.id, req.params.id), eq(boatSalesTradeIns.orgId, user.orgId)))
      .returning();
    if (!tradeIn) return res.status(404).json({ message: 'Trade-in not found' });
    res.json(tradeIn);
  } catch (error) {
    res.status(400).json({ message: 'Error updating trade-in' });
  }
});

router.post('/trade-ins/:id/convert-to-inventory', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [tradeIn] = await db.select().from(boatSalesTradeIns)
      .where(and(eq(boatSalesTradeIns.id, req.params.id), eq(boatSalesTradeIns.orgId, user.orgId)));
    
    if (!tradeIn) return res.status(404).json({ message: 'Trade-in not found' });
    if (tradeIn.convertedToInventoryId) {
      return res.status(400).json({ message: 'Trade-in already converted to inventory' });
    }

    const count = await db.select({ count: sql`count(*)` }).from(boatSalesInventory)
      .where(eq(boatSalesInventory.orgId, user.orgId));
    const stockNumber = `STK-${String(Number(count[0].count) + 1).padStart(6, '0')}`;

    const [inventory] = await db.insert(boatSalesInventory).values({
      orgId: user.orgId,
      stockNumber,
      make: tradeIn.make,
      model: tradeIn.model,
      year: tradeIn.year,
      length: tradeIn.length,
      condition: tradeIn.condition,
      status: 'trade_in',
      engineMake: tradeIn.engineMake,
      engineModel: tradeIn.engineModel,
      engineHours: tradeIn.engineHours,
      registrationNumber: tradeIn.registrationNumber,
      hullId: tradeIn.hullId,
      listPrice: tradeIn.estimatedRetailValue || '0',
      cost: tradeIn.acceptedAllowance || tradeIn.offeredAllowance || '0',
      images: tradeIn.images,
      internalNotes: tradeIn.conditionNotes,
      createdBy: user.id,
    }).returning();

    await db.update(boatSalesTradeIns)
      .set({ 
        convertedToInventoryId: inventory.id, 
        status: 'completed',
        updatedAt: new Date() 
      })
      .where(eq(boatSalesTradeIns.id, req.params.id));

    res.json({ inventory, tradeIn: { ...tradeIn, convertedToInventoryId: inventory.id } });
  } catch (error) {
    console.error('Error converting trade-in to inventory:', error);
    res.status(400).json({ message: 'Error converting trade-in to inventory' });
  }
});

router.delete('/trade-ins/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    await db.delete(boatSalesTradeIns)
      .where(and(eq(boatSalesTradeIns.id, req.params.id), eq(boatSalesTradeIns.orgId, user.orgId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting trade-in' });
  }
});

// ===== ANALYTICS =====

router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const { startDate, endDate } = req.query;
    
    const inventory = await db.select().from(boatSalesInventory)
      .where(eq(boatSalesInventory.orgId, user.orgId));

    const transactionConditions = [eq(boatSalesTransactions.orgId, user.orgId)];
    if (startDate) transactionConditions.push(gte(boatSalesTransactions.saleDate, new Date(startDate as string)));
    if (endDate) transactionConditions.push(lte(boatSalesTransactions.saleDate, new Date(endDate as string)));
    
    const transactions = await db.select().from(boatSalesTransactions).where(and(...transactionConditions));
    const tradeIns = await db.select().from(boatSalesTradeIns)
      .where(eq(boatSalesTradeIns.orgId, user.orgId));

    const available = inventory.filter(b => b.status === 'available');

    const summary = {
      inventorySummary: {
        totalUnits: inventory.length,
        availableUnits: available.length,
        totalValue: available.reduce((sum, b) => sum + Number(b.listPrice || 0), 0),
        avgDaysOnLot: available.length > 0 
          ? available.reduce((sum, b) => sum + (b.daysOnLot || 0), 0) / available.length 
          : 0,
      },
      salesSummary: {
        totalSales: transactions.length,
        totalRevenue: transactions.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0),
        totalGrossProfit: transactions.reduce((sum, t) => sum + Number(t.grossProfit || 0), 0),
        avgSalePrice: transactions.length > 0 
          ? transactions.reduce((sum, t) => sum + Number(t.salePrice || 0), 0) / transactions.length 
          : 0,
        profitMargin: transactions.length > 0 && transactions.reduce((sum, t) => sum + Number(t.salePrice || 0), 0) > 0
          ? (transactions.reduce((sum, t) => sum + Number(t.grossProfit || 0), 0) / 
             transactions.reduce((sum, t) => sum + Number(t.salePrice || 0), 0)) * 100
          : 0,
      },
      tradeInSummary: {
        totalTradeIns: tradeIns.length,
        pendingEvaluation: tradeIns.filter(t => t.status === 'pending_evaluation').length,
        totalValue: tradeIns.reduce((sum, t) => sum + Number(t.acceptedAllowance || 0), 0),
      },
      topSellingMakes: Object.entries(
        transactions.reduce((acc, t) => {
          const inv = inventory.find(i => i.id === t.inventoryId);
          if (inv) {
            acc[inv.make] = (acc[inv.make] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>)
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([make, count]) => ({ make, count })),
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// ============================================================================
// GET /dashboard — Aggregated dashboard data (inventory + transaction stats)
// ============================================================================
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) return res.status(401).json({ message: 'Authentication required' });

    const [inventory, transactions] = await Promise.all([
      db.select().from(boatSalesInventory).where(eq(boatSalesInventory.orgId, user.orgId)),
      db.select().from(boatSalesTransactions).where(eq(boatSalesTransactions.orgId, user.orgId))
        .orderBy(desc(boatSalesTransactions.saleDate)),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeListings = inventory.filter(b => b.status === 'available' || b.status === 'consignment');
    const underContract = inventory.filter(b => b.status === 'pending');
    const closedMtd = transactions.filter(t => t.saleDate && new Date(t.saleDate) >= monthStart);
    const revenueMtd = closedMtd.reduce((sum, t) => sum + Number(t.salePrice || 0), 0);
    const grossProfitMtd = closedMtd.reduce((sum, t) => sum + Number(t.grossProfit || 0), 0);

    const recentTransactions = transactions.slice(0, 10).map(t => ({
      id: t.id,
      stockNumber: t.stockNumber,
      buyerName: t.buyerName,
      salePrice: Number(t.salePrice || 0),
      grossProfit: Number(t.grossProfit || 0),
      saleDate: t.saleDate,
      saleType: t.saleType,
    }));

    const activeInventory = activeListings.slice(0, 20).map(b => ({
      id: b.id,
      stockNumber: b.stockNumber,
      year: b.year,
      make: b.make,
      model: b.model,
      condition: b.condition,
      listPrice: Number(b.listPrice || 0),
      status: b.status,
      daysInInventory: b.createdAt
        ? Math.floor((now.getTime() - new Date(b.createdAt).getTime()) / 86400000)
        : null,
    }));

    res.json({
      pipeline: {
        activeListings: activeListings.length,
        underContract: underContract.length,
        closedMtd: closedMtd.length,
      },
      revenue: { mtd: Math.round(revenueMtd * 100) / 100, grossProfitMtd: Math.round(grossProfitMtd * 100) / 100 },
      activeInventory,
      recentTransactions,
    });
  } catch (error) {
    console.error('Boat sales dashboard error:', error);
    res.status(500).json({ message: 'Error fetching boat sales dashboard' });
  }
});

export default router;
