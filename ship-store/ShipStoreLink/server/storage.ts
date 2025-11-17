import { 
  users, products, categories, transactions, financialMetrics, storeSettings,
  scenarios, assumptions, projections, historicalData, auditLogs,
  type User, type InsertUser, type Product, type InsertProduct, 
  type Category, type InsertCategory, type Transaction, type InsertTransaction,
  type FinancialMetric, type StoreSettings, type InsertStoreSettings,
  type Scenario, type InsertScenario, type Assumption, type InsertAssumption,
  type Projection, type InsertProjection, type HistoricalData, type InsertHistoricalData,
  type AuditLog, type InsertAuditLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte, like, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Products
  getProducts(categoryId?: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  getLowStockProducts(): Promise<Product[]>;
  updateProductStock(id: string, quantity: number): Promise<Product | undefined>;

  // Transactions
  getTransactions(limit?: number, offset?: number): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]>;
  getRecentTransactions(limit?: number): Promise<Transaction[]>;
  getTotalTransactionsCount(): Promise<number>;

  // Financial Metrics
  getDashboardMetrics(): Promise<{
    todaysSales: number;
    totalTransactions: number;
    averageOrderValue: number;
    lowStockItems: number;
    growthMetrics: {
      dailyGrowth: number;
      weeklyGrowth: number;
      monthlyGrowth: number;
    };
    velocityMetrics: {
      transactionsPerHour: number;
      revenuePerHour: number;
    };
    trendMetrics: {
      last7DaysAvg: number;
      last30DaysAvg: number;
      bestDay: { date: string; sales: number };
      worstDay: { date: string; sales: number };
    };
  }>;
  getSalesData(days: number): Promise<Array<{ date: string; sales: number }>>;
  getTopCategories(): Promise<Array<{ name: string; percentage: number; color: string }>>;
  getFinancialMetrics(period: string): Promise<FinancialMetric[]>;

  // Store Settings
  getStoreSettings(): Promise<StoreSettings | undefined>;
  updateStoreSettings(settings: Partial<InsertStoreSettings>): Promise<StoreSettings>;

  // Financial Modeling - Scenarios
  getScenarios(): Promise<Scenario[]>;
  getScenario(id: string): Promise<Scenario | undefined>;
  createScenario(scenario: InsertScenario): Promise<Scenario>;
  updateScenario(id: string, scenario: Partial<InsertScenario>): Promise<Scenario | undefined>;
  deleteScenario(id: string): Promise<boolean>;

  // Financial Modeling - Assumptions
  getAssumptionsByScenario(scenarioId: string): Promise<Assumption | undefined>;
  createAssumption(assumption: InsertAssumption): Promise<Assumption>;
  updateAssumption(id: string, assumption: Partial<InsertAssumption>): Promise<Assumption | undefined>;

  // Financial Modeling - Projections
  getProjectionsByScenario(scenarioId: string): Promise<Projection[]>;
  createProjection(projection: InsertProjection): Promise<Projection>;
  bulkCreateProjections(projections: InsertProjection[]): Promise<Projection[]>;
  deleteProjectionsByScenario(scenarioId: string): Promise<boolean>;

  // Financial Modeling - Historical Data
  getHistoricalData(filters?: { 
    period?: string; 
    year?: number; 
    dataSource?: string;
  }): Promise<HistoricalData[]>;
  createHistoricalData(data: InsertHistoricalData): Promise<HistoricalData>;
  bulkCreateHistoricalData(data: InsertHistoricalData[]): Promise<HistoricalData[]>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getProducts(categoryId?: string): Promise<Product[]> {
    if (categoryId) {
      return await db.select().from(products)
        .where(and(eq(products.categoryId, categoryId), eq(products.isActive, true)))
        .orderBy(products.name);
    }
    return await db.select().from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db
      .insert(products)
      .values(product)
      .returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const [updated] = await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return !!updated;
  }

  async getLowStockProducts(): Promise<Product[]> {
    return await db.select().from(products)
      .where(and(
        eq(products.isActive, true),
        sql`${products.stock} <= ${products.lowStockThreshold}`
      ))
      .orderBy(products.stock);
  }

  async updateProductStock(id: string, quantity: number): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ 
        stock: sql`${products.stock} - ${quantity}`,
        updatedAt: new Date()
      })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async getTransactions(limit = 50, offset = 0): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(and(
        gte(transactions.createdAt, startDate),
        lte(transactions.createdAt, endDate)
      ))
      .orderBy(desc(transactions.createdAt));
  }

  async getRecentTransactions(limit = 10): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  async getTotalTransactionsCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(transactions);
    return result.count;
  }

  async getDashboardMetrics(): Promise<{
    todaysSales: number;
    totalTransactions: number;
    averageOrderValue: number;
    lowStockItems: number;
    growthMetrics: {
      dailyGrowth: number;
      weeklyGrowth: number;
      monthlyGrowth: number;
    };
    velocityMetrics: {
      transactionsPerHour: number;
      revenuePerHour: number;
    };
    trendMetrics: {
      last7DaysAvg: number;
      last30DaysAvg: number;
      bestDay: { date: string; sales: number };
      worstDay: { date: string; sales: number };
    };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's sales
    const [todaysSalesResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.total}), 0)` })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, today),
        lte(transactions.createdAt, tomorrow),
        eq(transactions.status, "completed")
      ));

    // Today's transactions count
    const [todaysTransactionsResult] = await db
      .select({ count: count() })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, today),
        lte(transactions.createdAt, tomorrow),
        eq(transactions.status, "completed")
      ));

    // Average order value (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [avgOrderResult] = await db
      .select({ 
        avg: sql<number>`COALESCE(AVG(${transactions.total}), 0)` 
      })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, thirtyDaysAgo),
        eq(transactions.status, "completed")
      ));

    // Low stock items count
    const [lowStockResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.isActive, true),
        sql`${products.stock} <= ${products.lowStockThreshold}`
      ));

    // Growth Metrics
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const [yesterdaySales] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.total}), 0)` })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, yesterday),
        lte(transactions.createdAt, today),
        eq(transactions.status, "completed")
      ));

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const [thisWeekSales] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.total}), 0)` })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, thisWeekStart),
        eq(transactions.status, "completed")
      ));

    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
    const [lastWeekSales] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.total}), 0)` })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, lastWeekStart),
        lte(transactions.createdAt, lastWeekEnd),
        eq(transactions.status, "completed")
      ));

    const [thisMonthSales] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.total}), 0)` })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, thirtyDaysAgo),
        eq(transactions.status, "completed")
      ));

    const lastMonthStart = new Date(today);
    lastMonthStart.setDate(lastMonthStart.getDate() - 60);
    const lastMonthEnd = new Date(today);
    lastMonthEnd.setDate(lastMonthEnd.getDate() - 30);
    const [lastMonthSales] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.total}), 0)` })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, lastMonthStart),
        lte(transactions.createdAt, lastMonthEnd),
        eq(transactions.status, "completed")
      ));

    // Velocity Metrics
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [last7DaysData] = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(${transactions.total}), 0)`,
        count: count()
      })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, sevenDaysAgo),
        eq(transactions.status, "completed")
      ));

    // Trend Metrics - Get daily sales in chronological order
    const dailySalesRaw = await db
      .select({
        date: sql<string>`DATE(${transactions.createdAt})`,
        sales: sql<number>`COALESCE(SUM(${transactions.total}), 0)`
      })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, thirtyDaysAgo),
        eq(transactions.status, "completed")
      ))
      .groupBy(sql`DATE(${transactions.createdAt})`)
      .orderBy(sql`DATE(${transactions.createdAt}) DESC`);

    // Create a complete date series for the last 30 days (fill missing days with 0)
    const dailySales: { date: string; sales: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const existingDay = dailySalesRaw.find(d => d.date === dateStr);
      dailySales.push({
        date: dateStr,
        sales: existingDay ? Number(existingDay.sales) : 0
      });
    }

    // Sort by sales to find best/worst days
    const sortedBySales = [...dailySales].sort((a, b) => b.sales - a.sales);
    const bestDay = sortedBySales[0] || { date: "N/A", sales: 0 };
    const worstDay = sortedBySales[sortedBySales.length - 1] || { date: "N/A", sales: 0 };
    
    // Calculate averages using most recent days (already in reverse chronological order)
    const last7Days = dailySales.slice(0, 7);
    const avgSalesLast7Days = last7Days.reduce((sum, day) => sum + day.sales, 0) / 7;
    const avgSalesLast30Days = dailySales.reduce((sum, day) => sum + day.sales, 0) / 30;

    // Calculate growth percentages
    const todaysSalesNum = Number(todaysSalesResult.total) || 0;
    const yesterdaySalesNum = Number(yesterdaySales.total) || 0;
    const thisWeekSalesNum = Number(thisWeekSales.total) || 0;
    const lastWeekSalesNum = Number(lastWeekSales.total) || 0;
    const thisMonthSalesNum = Number(thisMonthSales.total) || 0;
    const lastMonthSalesNum = Number(lastMonthSales.total) || 0;

    const dailyGrowth = yesterdaySalesNum > 0 
      ? ((todaysSalesNum - yesterdaySalesNum) / yesterdaySalesNum) * 100 
      : 0;
    const weeklyGrowth = lastWeekSalesNum > 0 
      ? ((thisWeekSalesNum - lastWeekSalesNum) / lastWeekSalesNum) * 100 
      : 0;
    const monthlyGrowth = lastMonthSalesNum > 0 
      ? ((thisMonthSalesNum - lastMonthSalesNum) / lastMonthSalesNum) * 100 
      : 0;

    // Velocity calculations
    const last7DaysSales = Number(last7DaysData.total) || 0;
    const last7DaysCount = last7DaysData.count || 0;
    const hoursIn7Days = 168;

    return {
      todaysSales: todaysSalesNum,
      totalTransactions: todaysTransactionsResult.count || 0,
      averageOrderValue: Number(avgOrderResult.avg) || 0,
      lowStockItems: lowStockResult.count || 0,
      growthMetrics: {
        dailyGrowth: parseFloat(dailyGrowth.toFixed(2)),
        weeklyGrowth: parseFloat(weeklyGrowth.toFixed(2)),
        monthlyGrowth: parseFloat(monthlyGrowth.toFixed(2)),
      },
      velocityMetrics: {
        transactionsPerHour: parseFloat((last7DaysCount / hoursIn7Days).toFixed(2)),
        revenuePerHour: parseFloat((last7DaysSales / hoursIn7Days).toFixed(2)),
      },
      trendMetrics: {
        last7DaysAvg: parseFloat(avgSalesLast7Days.toFixed(2)),
        last30DaysAvg: parseFloat(avgSalesLast30Days.toFixed(2)),
        bestDay: { 
          date: bestDay.date, 
          sales: Number(bestDay.sales)
        },
        worstDay: { 
          date: worstDay.date, 
          sales: Number(worstDay.sales)
        },
      },
    };
  }

  async getSalesData(days: number): Promise<Array<{ date: string; sales: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const salesData = await db
      .select({
        date: sql<string>`DATE(${transactions.createdAt})`,
        sales: sql<number>`COALESCE(SUM(${transactions.total}), 0)`
      })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, startDate),
        eq(transactions.status, "completed")
      ))
      .groupBy(sql`DATE(${transactions.createdAt})`)
      .orderBy(sql`DATE(${transactions.createdAt})`);

    return salesData;
  }

  async getTopCategories(): Promise<Array<{ name: string; percentage: number; color: string }>> {
    // This is a simplified implementation - in reality you'd calculate from transaction items
    const categoriesData = await db.select().from(categories);
    const colors = ["hsl(214, 82%, 39%)", "hsl(160, 84%, 39%)", "hsl(43, 74%, 66%)", "hsl(27, 87%, 67%)"];
    
    return categoriesData.slice(0, 4).map((cat, index) => ({
      name: cat.name,
      percentage: [32, 28, 18, 22][index] || 0,
      color: colors[index] || colors[0]
    }));
  }

  async getFinancialMetrics(period: string): Promise<FinancialMetric[]> {
    return await db.select().from(financialMetrics)
      .where(eq(financialMetrics.period, period))
      .orderBy(desc(financialMetrics.periodStart));
  }

  async getStoreSettings(): Promise<StoreSettings | undefined> {
    const [settings] = await db.select().from(storeSettings).limit(1);
    return settings || undefined;
  }

  async updateStoreSettings(settings: Partial<InsertStoreSettings>): Promise<StoreSettings> {
    const existing = await this.getStoreSettings();
    
    if (existing) {
      const [updated] = await db
        .update(storeSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(storeSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(storeSettings)
        .values(settings)
        .returning();
      return created;
    }
  }

  // Financial Modeling - Scenarios
  async getScenarios(): Promise<Scenario[]> {
    return await db.select().from(scenarios)
      .where(eq(scenarios.isActive, true))
      .orderBy(desc(scenarios.createdAt));
  }

  async getScenario(id: string): Promise<Scenario | undefined> {
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, id));
    return scenario || undefined;
  }

  async createScenario(scenario: InsertScenario): Promise<Scenario> {
    const [newScenario] = await db
      .insert(scenarios)
      .values(scenario)
      .returning();
    return newScenario;
  }

  async updateScenario(id: string, scenario: Partial<InsertScenario>): Promise<Scenario | undefined> {
    const [updated] = await db
      .update(scenarios)
      .set({ ...scenario, updatedAt: new Date() })
      .where(eq(scenarios.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteScenario(id: string): Promise<boolean> {
    const result = await db
      .update(scenarios)
      .set({ isActive: false })
      .where(eq(scenarios.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Financial Modeling - Assumptions
  async getAssumptionsByScenario(scenarioId: string): Promise<Assumption | undefined> {
    const [assumption] = await db.select().from(assumptions)
      .where(eq(assumptions.scenarioId, scenarioId));
    return assumption || undefined;
  }

  async createAssumption(assumption: InsertAssumption): Promise<Assumption> {
    const [newAssumption] = await db
      .insert(assumptions)
      .values(assumption)
      .returning();
    return newAssumption;
  }

  async updateAssumption(id: string, assumption: Partial<InsertAssumption>): Promise<Assumption | undefined> {
    const [updated] = await db
      .update(assumptions)
      .set({ ...assumption, updatedAt: new Date() })
      .where(eq(assumptions.id, id))
      .returning();
    return updated || undefined;
  }

  // Financial Modeling - Projections
  async getProjectionsByScenario(scenarioId: string): Promise<Projection[]> {
    return await db.select().from(projections)
      .where(eq(projections.scenarioId, scenarioId))
      .orderBy(projections.periodYear, projections.periodMonth);
  }

  async createProjection(projection: InsertProjection): Promise<Projection> {
    const [newProjection] = await db
      .insert(projections)
      .values(projection)
      .returning();
    return newProjection;
  }

  async bulkCreateProjections(projectionsList: InsertProjection[]): Promise<Projection[]> {
    const created = await db
      .insert(projections)
      .values(projectionsList)
      .returning();
    return created;
  }

  async deleteProjectionsByScenario(scenarioId: string): Promise<boolean> {
    const result = await db.delete(projections)
      .where(eq(projections.scenarioId, scenarioId));
    return (result.rowCount ?? 0) > 0;
  }

  // Financial Modeling - Historical Data
  async getHistoricalData(filters?: { 
    period?: string; 
    year?: number; 
    dataSource?: string;
  }): Promise<HistoricalData[]> {
    let query = db.select().from(historicalData);
    
    const conditions = [];
    if (filters?.period) {
      conditions.push(eq(historicalData.period, filters.period));
    }
    if (filters?.year) {
      conditions.push(eq(historicalData.periodYear, filters.year));
    }
    if (filters?.dataSource) {
      conditions.push(eq(historicalData.dataSource, filters.dataSource));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(
      desc(historicalData.periodYear),
      desc(historicalData.periodMonth)
    );
  }

  async createHistoricalData(data: InsertHistoricalData): Promise<HistoricalData> {
    const [newData] = await db
      .insert(historicalData)
      .values(data)
      .returning();
    return newData;
  }

  async bulkCreateHistoricalData(dataList: InsertHistoricalData[]): Promise<HistoricalData[]> {
    const created = await db
      .insert(historicalData)
      .values(dataList)
      .returning();
    return created;
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getAuditLogs(filters?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    
    const conditions = [];
    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(auditLogs.createdAt, filters.endDate));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, entityType),
        eq(auditLogs.entityId, entityId)
      ))
      .orderBy(desc(auditLogs.createdAt));
  }
}

export const storage = new DatabaseStorage();
