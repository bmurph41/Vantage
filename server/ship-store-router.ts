import { Router, type Request, Response, NextFunction } from 'express';
import { db } from './db';
import {
  categories, products, transactions, storeSettings,
  scenarios, assumptions, projections, historicalData, shipStoreAuditLogs,
  rentRollEntries, crmContacts,
  type Category, type Product, type Transaction, type StoreSettings,
  type Scenario, type Assumption, type Projection, type HistoricalData, type ShipStoreAuditLog,
  insertCategorySchema, insertProductSchema, insertTransactionSchema, insertStoreSettingsSchema,
  insertScenarioSchema, insertAssumptionSchema, insertProjectionSchema, insertHistoricalDataSchema, insertShipStoreAuditLogSchema
} from '@shared/schema';
import { eq, desc, sql, and, gte, lte, like, or } from 'drizzle-orm';

const router = Router();

// Ship Store uses different auth middleware, so we adapt it here
// MarinaMatch's authenticateUser sets req.user = { id, orgId, role, email }
// Ship Store expects req.user with 'manager' or 'cashier' role

// Middleware to check if user has manager role
function requireManager(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  // Map MarinaMatch roles: owner/editor -> manager, viewer -> cashier
  const role = user.role?.toLowerCase();
  if (role === 'owner' || role === 'editor' || role === 'admin') {
    (req as any).shipStoreRole = 'manager';
    return next();
  }
  return res.status(403).json({ message: 'Manager access required' });
}

// Helper function for audit logging
async function logAudit(params: {
  req: Request;
  entityType: string;
  entityId: string;
  action: string;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
}) {
  const user = (params.req as any).user;
  await db.insert(shipStoreAuditLogs).values({
    userId: user?.id || 'unknown',
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    beforeData: params.beforeData,
    afterData: params.afterData,
    metadata: params.metadata,
  });
}

// ===== CATEGORIES =====

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(categories).orderBy(categories.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

router.post('/categories', requireManager, async (req: Request, res: Response) => {
  try {
    const data = insertCategorySchema.parse(req.body);
    const [category] = await db.insert(categories).values(data).returning();
    
    await logAudit({
      req,
      entityType: 'categories',
      entityId: category.id,
      action: 'create',
      afterData: category,
    });
    
    res.json(category);
  } catch (error) {
    res.status(400).json({ message: 'Error creating category' });
  }
});

// ===== CUSTOMERS =====

router.get('/customers', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.orgId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // TODO: Fetch CRM contacts and Rent Roll tenants
    // For now, returning empty array until SQL issue is resolved
    const allCustomers: Array<{
      id: string;
      name: string;
      email: string | null;
      type: 'contact' | 'tenant';
    }> = [];

    res.json(allCustomers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Error fetching customers' });
  }
});

// ===== PRODUCTS =====

router.get('/products', async (req: Request, res: Response) => {
  try {
    const categoryId = req.query.categoryId as string;
    let query = db.select().from(products).where(eq(products.isActive, true));
    
    if (categoryId) {
      query = db.select().from(products).where(
        and(eq(products.categoryId, categoryId), eq(products.isActive, true))
      );
    }
    
    const result = await query.orderBy(products.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});

router.get('/products/low-stock', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(products)
      .where(
        and(
          eq(products.isActive, true),
          sql`${products.stock} <= ${products.lowStockThreshold}`
        )
      )
      .orderBy(products.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching low stock products' });
  }
});

router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const [product] = await db.select().from(products).where(eq(products.id, req.params.id));
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product' });
  }
});

router.post('/products', requireManager, async (req: Request, res: Response) => {
  try {
    const data = insertProductSchema.parse(req.body);
    const [product] = await db.insert(products).values(data).returning();
    
    await logAudit({
      req,
      entityType: 'products',
      entityId: product.id,
      action: 'create',
      afterData: product,
    });
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: 'Error creating product' });
  }
});

router.put('/products/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const [before] = await db.select().from(products).where(eq(products.id, req.params.id));
    const data = insertProductSchema.partial().parse(req.body);
    const [product] = await db.update(products)
      .set(data)
      .where(eq(products.id, req.params.id))
      .returning();
      
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await logAudit({
      req,
      entityType: 'products',
      entityId: product.id,
      action: 'update',
      beforeData: before,
      afterData: product,
    });
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: 'Error updating product' });
  }
});

router.patch('/products/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const [before] = await db.select().from(products).where(eq(products.id, req.params.id));
    const data = insertProductSchema.partial().parse(req.body);
    const [product] = await db.update(products)
      .set(data)
      .where(eq(products.id, req.params.id))
      .returning();
      
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await logAudit({
      req,
      entityType: 'products',
      entityId: product.id,
      action: 'update',
      beforeData: before,
      afterData: product,
    });
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: 'Error updating product' });
  }
});

router.delete('/products/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const [before] = await db.select().from(products).where(eq(products.id, req.params.id));
    const result = await db.delete(products).where(eq(products.id, req.params.id));
    
    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await logAudit({
      req,
      entityType: 'products',
      entityId: req.params.id,
      action: 'delete',
      beforeData: before,
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product' });
  }
});

// ===== TRANSACTIONS =====

router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await db.select().from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

router.get('/transactions/count', async (req: Request, res: Response) => {
  try {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(transactions);
    res.json({ count: result?.count || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error counting transactions' });
  }
});

router.get('/transactions/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await db.select().from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recent transactions' });
  }
});

router.post('/transactions', async (req: Request, res: Response) => {
  try {
    const data = insertTransactionSchema.parse(req.body);
    const [transaction] = await db.insert(transactions).values(data).returning();
    
    // Update product stock if needed
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.productId) {
          await db.update(products)
            .set({
              stock: sql`${products.stock} - ${item.quantity}`
            })
            .where(eq(products.id, item.productId));
        }
      }
    }
    
    await logAudit({
      req,
      entityType: 'transactions',
      entityId: transaction.id,
      action: 'create',
      afterData: transaction,
    });
    
    res.json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(400).json({ message: 'Error creating transaction', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ===== DASHBOARD METRICS =====

router.get('/dashboard/metrics', async (req: Request, res: Response) => {
  try {
    // Calculate basic metrics
    const [totalRevenueResult] = await db.select({
      totalRevenue: sql<number>`COALESCE(SUM(${transactions.total}), 0)`
    }).from(transactions);
    
    const [transactionCountResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(transactions);
    
    const [activeProductsResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(products).where(eq(products.isActive, true));
    
    const [inventoryValueResult] = await db.select({
      value: sql<number>`COALESCE(SUM(${products.stock} * ${products.cost}), 0)`
    }).from(products).where(eq(products.isActive, true));
    
    res.json({
      totalRevenue: totalRevenueResult?.totalRevenue || 0,
      transactionCount: transactionCountResult?.count || 0,
      activeProducts: activeProductsResult?.count || 0,
      inventoryValue: inventoryValueResult?.value || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard metrics' });
  }
});

// ===== STORE SETTINGS =====

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const [settings] = await db.select().from(storeSettings).limit(1);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

router.put('/settings', requireManager, async (req: Request, res: Response) => {
  try {
    const data = insertStoreSettingsSchema.partial().parse(req.body);
    
    // Get existing settings
    const [existing] = await db.select().from(storeSettings).limit(1);
    
    let settings;
    if (existing) {
      // Update existing
      [settings] = await db.update(storeSettings)
        .set(data)
        .where(eq(storeSettings.id, existing.id))
        .returning();
    } else {
      // Create new
      [settings] = await db.insert(storeSettings).values(data).returning();
    }
    
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: 'Error updating settings' });
  }
});

// ===== ANALYTICS =====

router.get('/analytics/sales-trends', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await db.select({
      date: sql<string>`DATE(${shipStoreTransactions.createdAt})`,
      revenue: sql<number>`SUM(CAST(${shipStoreTransactions.total} AS DECIMAL))`,
      transactions: sql<number>`COUNT(*)`,
    })
    .from(shipStoreTransactions)
    .where(gte(shipStoreTransactions.createdAt, startDate))
    .groupBy(sql`DATE(${shipStoreTransactions.createdAt})`)
    .orderBy(sql`DATE(${shipStoreTransactions.createdAt})`);

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales trends' });
  }
});

router.get('/analytics/top-products', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const topProducts = await db.select({
      productId: shipStoreTransactionItems.productId,
      name: shipStoreTransactionItems.name,
      quantity: sql<number>`SUM(${shipStoreTransactionItems.quantity})`,
      revenue: sql<number>`SUM(${shipStoreTransactionItems.price} * ${shipStoreTransactionItems.quantity})`,
    })
    .from(shipStoreTransactionItems)
    .innerJoin(shipStoreTransactions, eq(shipStoreTransactionItems.transactionId, shipStoreTransactions.id))
    .where(gte(shipStoreTransactions.createdAt, startDate))
    .groupBy(shipStoreTransactionItems.productId, shipStoreTransactionItems.name)
    .orderBy(desc(sql<number>`SUM(${shipStoreTransactionItems.price} * ${shipStoreTransactionItems.quantity})`))
    .limit(10);

    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top products' });
  }
});

router.get('/analytics/category-revenue', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const categoryRevenue = await db.select({
      name: shipStoreCategories.name,
      value: sql<number>`SUM(${shipStoreTransactionItems.price} * ${shipStoreTransactionItems.quantity})`,
    })
    .from(shipStoreTransactionItems)
    .innerJoin(shipStoreTransactions, eq(shipStoreTransactionItems.transactionId, shipStoreTransactions.id))
    .innerJoin(shipStoreProducts, eq(shipStoreTransactionItems.productId, shipStoreProducts.id))
    .innerJoin(shipStoreCategories, eq(shipStoreProducts.categoryId, shipStoreCategories.id))
    .where(gte(shipStoreTransactions.createdAt, startDate))
    .groupBy(shipStoreCategories.name)
    .orderBy(desc(sql<number>`SUM(${shipStoreTransactionItems.price} * ${shipStoreTransactionItems.quantity})`));

    res.json(categoryRevenue);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category revenue' });
  }
});

router.get('/analytics/product-performance', async (req: Request, res: Response) => {
  try {
    const productStats = await db.select({
      id: shipStoreProducts.id,
      name: shipStoreProducts.name,
      sku: shipStoreProducts.sku,
      stock: shipStoreProducts.stock,
      categoryName: shipStoreCategories.name,
      unitsSold: sql<number>`COALESCE(SUM(${shipStoreTransactionItems.quantity}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${shipStoreTransactionItems.price} * ${shipStoreTransactionItems.quantity}), 0)`,
      avgPrice: sql<number>`COALESCE(AVG(${shipStoreTransactionItems.price}), 0)`,
    })
    .from(shipStoreProducts)
    .leftJoin(shipStoreCategories, eq(shipStoreProducts.categoryId, shipStoreCategories.id))
    .leftJoin(shipStoreTransactionItems, eq(shipStoreProducts.id, shipStoreTransactionItems.productId))
    .groupBy(shipStoreProducts.id, shipStoreProducts.name, shipStoreProducts.sku, shipStoreProducts.stock, shipStoreCategories.name)
    .orderBy(desc(sql<number>`COALESCE(SUM(${shipStoreTransactionItems.quantity}), 0)`));

    res.json(productStats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product performance' });
  }
});

router.get('/analytics/price-history/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    // Get price history from audit logs
    const priceChanges = await db.select({
      date: sql<string>`DATE(${shipStoreAuditLogs.createdAt})`,
      price: sql<number>`CAST((${shipStoreAuditLogs.afterData}->>'price') AS DECIMAL)`,
    })
    .from(shipStoreAuditLogs)
    .where(
      and(
        eq(shipStoreAuditLogs.entityType, 'product'),
        eq(shipStoreAuditLogs.entityId, productId),
        eq(shipStoreAuditLogs.action, 'update'),
        sql`${shipStoreAuditLogs.changedFields} ? 'price'`
      )
    )
    .orderBy(shipStoreAuditLogs.createdAt);

    // If no price changes found, get current price
    if (priceChanges.length === 0) {
      const [product] = await db.select({ price: shipStoreProducts.price })
        .from(shipStoreProducts)
        .where(eq(shipStoreProducts.id, productId));
      
      if (product) {
        res.json([{
          date: new Date().toISOString().split('T')[0],
          price: parseFloat(product.price),
        }]);
      } else {
        res.json([]);
      }
    } else {
      res.json(priceChanges);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching price history' });
  }
});

// ===== AUDIT LOGS =====

router.get('/audit-logs', requireManager, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await db.select().from(shipStoreAuditLogs)
      .orderBy(desc(shipStoreAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
});

router.get('/audit-logs/:entityType/:entityId', requireManager, async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const result = await db.select().from(shipStoreAuditLogs)
      .where(
        and(
          eq(shipStoreAuditLogs.entityType, entityType),
          eq(shipStoreAuditLogs.entityId, entityId)
        )
      )
      .orderBy(desc(shipStoreAuditLogs.createdAt));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
});

export default router;
