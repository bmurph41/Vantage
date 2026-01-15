import { Router, type Request, Response, NextFunction } from 'express';
import { db } from './db';
import {
  shipStoreCategories, shipStoreProducts, shipStoreTransactions, shipStoreSettings,
  shipStoreScenarios, shipStoreAssumptions, shipStoreProjections, shipStoreHistoricalData, shipStoreAuditLogs, shipStoreProductHistory,
  rentRollEntries, crmContacts,
  type ShipStoreCategory, type ShipStoreProduct, type ShipStoreTransaction, type ShipStoreSettings,
  type ShipStoreScenario, type ShipStoreAssumption, type ShipStoreProjection, type ShipStoreHistoricalData, type ShipStoreAuditLog,
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
    const result = await db.select().from(shipStoreCategories).orderBy(shipStoreCategories.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

router.post('/categories', requireManager, async (req: Request, res: Response) => {
  try {
    const data = insertCategorySchema.parse(req.body);
    const [category] = await db.insert(shipStoreCategories).values(data).returning();
    
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
    let query = db.select().from(shipStoreProducts).where(eq(shipStoreProducts.isActive, true));
    
    if (categoryId) {
      query = db.select().from(shipStoreProducts).where(
        and(eq(shipStoreProducts.categoryId, categoryId), eq(shipStoreProducts.isActive, true))
      );
    }
    
    const result = await query.orderBy(shipStoreProducts.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});

router.get('/products/low-stock', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(shipStoreProducts)
      .where(
        and(
          eq(shipStoreProducts.isActive, true),
          sql`${shipStoreProducts.stock} <= ${shipStoreProducts.lowStockThreshold}`
        )
      )
      .orderBy(shipStoreProducts.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching low stock products' });
  }
});

router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const [product] = await db.select().from(shipStoreProducts).where(eq(shipStoreProducts.id, req.params.id));
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
    const [product] = await db.insert(shipStoreProducts).values(data).returning();
    
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
    const [before] = await db.select().from(shipStoreProducts).where(eq(shipStoreProducts.id, req.params.id));
    const data = insertProductSchema.partial().parse(req.body);
    const [product] = await db.update(shipStoreProducts)
      .set(data)
      .where(eq(shipStoreProducts.id, req.params.id))
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
    const [before] = await db.select().from(shipStoreProducts).where(eq(shipStoreProducts.id, req.params.id));
    const data = insertProductSchema.partial().parse(req.body);
    const [product] = await db.update(shipStoreProducts)
      .set(data)
      .where(eq(shipStoreProducts.id, req.params.id))
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
    const [before] = await db.select().from(shipStoreProducts).where(eq(shipStoreProducts.id, req.params.id));
    const result = await db.delete(shipStoreProducts).where(eq(shipStoreProducts.id, req.params.id));
    
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
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    
    const result = await db.select().from(shipStoreTransactions)
      .where(orgId ? eq(shipStoreTransactions.orgId, orgId) : undefined)
      .orderBy(desc(shipStoreTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

router.get('/transactions/count', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(shipStoreTransactions)
      .where(orgId ? eq(shipStoreTransactions.orgId, orgId) : undefined);
    res.json({ count: result?.count || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error counting transactions' });
  }
});

router.get('/transactions/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    
    const result = await db.select().from(shipStoreTransactions)
      .where(orgId ? eq(shipStoreTransactions.orgId, orgId) : undefined)
      .orderBy(desc(shipStoreTransactions.createdAt))
      .limit(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recent transactions' });
  }
});

router.post('/transactions', async (req: Request, res: Response) => {
  try {
    const data = insertTransactionSchema.parse(req.body);
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    
    // Validate stock availability before creating transaction
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.productId) {
          const [product] = await db.select()
            .from(shipStoreProducts)
            .where(eq(shipStoreProducts.id, item.productId))
            .limit(1);
          
          if (!product) {
            return res.status(400).json({ 
              message: `Product ${item.name} not found` 
            });
          }
          
          if (product.stock < item.quantity) {
            return res.status(400).json({ 
              message: `Insufficient stock for ${item.name}. Available: ${product.stock}, Requested: ${item.quantity}` 
            });
          }
        }
      }
    }
    
    // Create transaction with orgId for multi-tenant isolation
    const [transaction] = await db.insert(shipStoreTransactions).values({
      ...data,
      orgId: orgId || null
    }).returning();
    
    // Update product stock
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.productId) {
          await db.update(shipStoreProducts)
            .set({
              stock: sql`${shipStoreProducts.stock} - ${item.quantity}`
            })
            .where(eq(shipStoreProducts.id, item.productId));
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
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    
    // Calculate basic metrics with orgId filtering for multi-tenant security
    const [totalRevenueResult] = await db.select({
      totalRevenue: sql<number>`COALESCE(SUM(${shipStoreTransactions.total}), 0)`
    }).from(shipStoreTransactions)
      .where(orgId ? eq(shipStoreTransactions.orgId, orgId) : undefined);
    
    const [transactionCountResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(shipStoreTransactions)
      .where(orgId ? eq(shipStoreTransactions.orgId, orgId) : undefined);
    
    const [activeProductsResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(shipStoreProducts).where(eq(shipStoreProducts.isActive, true));
    
    const [inventoryValueResult] = await db.select({
      value: sql<number>`COALESCE(SUM(${shipStoreProducts.stock} * ${shipStoreProducts.cost}), 0)`
    }).from(shipStoreProducts).where(eq(shipStoreProducts.isActive, true));
    
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
    const [settings] = await db.select().from(shipStoreSettings).limit(1);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

router.put('/settings', requireManager, async (req: Request, res: Response) => {
  try {
    const data = insertStoreSettingsSchema.partial().parse(req.body);
    
    // Get existing settings
    const [existing] = await db.select().from(shipStoreSettings).limit(1);
    
    let settings;
    if (existing) {
      // Update existing
      [settings] = await db.update(shipStoreSettings)
        .set(data)
        .where(eq(shipStoreSettings.id, existing.id))
        .returning();
    } else {
      // Create new
      [settings] = await db.insert(shipStoreSettings).values(data).returning();
    }
    
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: 'Error updating settings' });
  }
});

// ===== ANALYTICS =====

router.get('/analytics/sales-trends', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    // Use date series to ensure all days are included, even with zero transactions
    // Filter by orgId for multi-tenant security
    const transactions = await db.execute(sql`
      SELECT 
        d::date as date,
        COALESCE(SUM(CAST(t.total AS DECIMAL)), 0) as revenue,
        COALESCE(COUNT(t.id), 0) as transactions
      FROM generate_series(
        ${startDate.toISOString().split('T')[0]}::date,
        ${endDate.toISOString().split('T')[0]}::date,
        '1 day'::interval
      ) d
      LEFT JOIN ship_store_transactions t ON DATE(t.created_at) = d::date
        AND (${orgId}::text IS NULL OR t.org_id = ${orgId})
      GROUP BY d
      ORDER BY d
    `);

    res.json(transactions.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales trends' });
  }
});

router.get('/analytics/top-products', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Use PostgreSQL JSONB functions to extract and aggregate items
    // Filter by orgId for multi-tenant security
    const topProducts = await db.execute(sql`
      SELECT 
        item->>'productId' as "productId",
        item->>'name' as name,
        SUM((item->>'quantity')::numeric) as quantity,
        SUM((item->>'price')::numeric * (item->>'quantity')::numeric) as revenue
      FROM ship_store_transactions t,
      jsonb_array_elements(t.items) as item
      WHERE t.created_at >= ${startDate.toISOString()}
        AND (${orgId}::text IS NULL OR t.org_id = ${orgId})
      GROUP BY item->>'productId', item->>'name'
      ORDER BY revenue DESC
      LIMIT 10
    `);

    res.json(topProducts.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top products' });
  }
});

router.get('/analytics/category-revenue', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Use PostgreSQL JSONB functions with lateral join to get category revenue
    // Filter by orgId for multi-tenant security
    const categoryRevenue = await db.execute(sql`
      SELECT 
        c.name,
        SUM((item->>'price')::numeric * (item->>'quantity')::numeric) as value
      FROM ship_store_transactions t,
      jsonb_array_elements(t.items) as item
      LEFT JOIN ship_store_products p ON p.id = (item->>'productId')
      LEFT JOIN ship_store_categories c ON c.id = p.category_id
      WHERE t.created_at >= ${startDate.toISOString()}
        AND c.name IS NOT NULL
        AND (${orgId}::text IS NULL OR t.org_id = ${orgId})
      GROUP BY c.name
      ORDER BY value DESC
    `);

    res.json(categoryRevenue.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category revenue' });
  }
});

router.get('/analytics/product-performance', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId || user?.orgId;
    
    // Use PostgreSQL JSONB functions to aggregate product performance
    // Filter transactions by orgId for multi-tenant security
    const productStats = await db.execute(sql`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.stock,
        c.name as "categoryName",
        COALESCE(SUM((item->>'quantity')::numeric), 0) as "unitsSold",
        COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::numeric), 0) as revenue,
        COALESCE(AVG((item->>'price')::numeric), 0) as "avgPrice"
      FROM ship_store_products p
      LEFT JOIN ship_store_categories c ON c.id = p.category_id
      LEFT JOIN ship_store_transactions t ON (${orgId}::text IS NULL OR t.org_id = ${orgId})
      LEFT JOIN LATERAL jsonb_array_elements(t.items) as item ON (item->>'productId') = p.id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.sku, p.stock, c.name
      ORDER BY "unitsSold" DESC
    `);

    res.json(productStats.rows);
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
