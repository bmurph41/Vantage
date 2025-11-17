import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  role: text("role").default("manager"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  categoryId: varchar("category_id").references(() => categories.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  stock: integer("stock").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  barcode: text("barcode"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // stripe, square, cash
  paymentIntentId: text("payment_intent_id"),
  status: text("status").default("completed"), // completed, refunded, failed
  items: jsonb("items").$type<Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    sku: string;
  }>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financialMetrics = pgTable("financial_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  period: text("period").notNull(), // daily, weekly, monthly, yearly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }),
  totalTransactions: integer("total_transactions"),
  averageOrderValue: decimal("average_order_value", { precision: 10, scale: 2 }),
  grossMargin: decimal("gross_margin", { precision: 5, scale: 2 }),
  operatingCosts: decimal("operating_costs", { precision: 10, scale: 2 }),
  netProfit: decimal("net_profit", { precision: 10, scale: 2 }),
  topCategories: jsonb("top_categories").$type<Array<{
    categoryId: string;
    name: string;
    revenue: number;
    percentage: number;
  }>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const storeSettings = pgTable("store_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeName: text("store_name").default("Ship Store"),
  address: text("address"),
  phone: text("phone"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).default("8.25"),
  currency: text("currency").default("USD"),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  autoSync: boolean("auto_sync").default(true),
  emailReceipts: boolean("email_receipts").default(false),
  lowStockAlerts: boolean("low_stock_alerts").default(true),
  stripePublishableKey: text("stripe_publishable_key"),
  stripeSecretKey: text("stripe_secret_key"),
  squareApplicationId: text("square_application_id"),
  quickbooksConnected: boolean("quickbooks_connected").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Financial modeling tables for pro forma and scenario planning
export const scenarios = pgTable("scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  scenarioType: text("scenario_type").notNull(), // base, optimistic, pessimistic, custom
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const assumptions = pgTable("assumptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar("scenario_id").references(() => scenarios.id).notNull().unique(),
  
  // Revenue assumptions
  revenueGrowthRate: decimal("revenue_growth_rate", { precision: 5, scale: 2 }), // Annual %
  monthlyRevenueGrowth: decimal("monthly_revenue_growth", { precision: 5, scale: 2 }), // Monthly %
  seasonalityFactors: jsonb("seasonality_factors").$type<{
    [month: number]: number; // 1-12 with multipliers (e.g., 1.2 for 20% above average)
  }>(),
  
  // Cost assumptions
  cogsPercentage: decimal("cogs_percentage", { precision: 5, scale: 2 }), // % of revenue
  operatingExpenseGrowth: decimal("opex_growth", { precision: 5, scale: 2 }),
  fixedCosts: decimal("fixed_costs", { precision: 10, scale: 2 }), // Monthly fixed costs
  
  // Margin assumptions
  targetGrossMargin: decimal("target_gross_margin", { precision: 5, scale: 2 }),
  targetOperatingMargin: decimal("target_operating_margin", { precision: 5, scale: 2 }),
  
  // New initiatives
  newProductLaunchImpact: jsonb("new_product_impact").$type<Array<{
    month: number;
    year: number;
    revenueIncrease: number;
    description: string;
  }>>(),
  
  // Category-specific assumptions
  categoryGrowthRates: jsonb("category_growth_rates").$type<{
    [categoryId: string]: number; // Growth rate per category
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projections = pgTable("projections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar("scenario_id").references(() => scenarios.id).notNull(),
  
  period: text("period").notNull(), // monthly, quarterly, yearly
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month"), // 1-12 for monthly
  periodQuarter: integer("period_quarter"), // 1-4 for quarterly
  
  // P&L projections
  projectedRevenue: decimal("projected_revenue", { precision: 12, scale: 2 }),
  projectedCOGS: decimal("projected_cogs", { precision: 12, scale: 2 }),
  projectedGrossProfit: decimal("projected_gross_profit", { precision: 12, scale: 2 }),
  projectedOpex: decimal("projected_opex", { precision: 12, scale: 2 }),
  projectedNetIncome: decimal("projected_net_income", { precision: 12, scale: 2 }),
  
  // Metrics
  grossMarginPercent: decimal("gross_margin_percent", { precision: 5, scale: 2 }),
  operatingMarginPercent: decimal("operating_margin_percent", { precision: 5, scale: 2 }),
  netMarginPercent: decimal("net_margin_percent", { precision: 5, scale: 2 }),
  
  // Category breakdown
  categoryBreakdown: jsonb("category_breakdown").$type<Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    percentage: number;
  }>>(),
  
  calculationMetadata: jsonb("calculation_metadata").$type<{
    basedOnHistorical: boolean;
    dataPoints: number;
    confidence: string; // high, medium, low
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const historicalData = pgTable("historical_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  dataSource: text("data_source").notNull(), // pos, import, quickbooks, manual
  period: text("period").notNull(), // monthly, quarterly, yearly
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month"), // 1-12
  periodQuarter: integer("period_quarter"), // 1-4
  
  // Financial data
  revenue: decimal("revenue", { precision: 12, scale: 2 }),
  cogs: decimal("cogs", { precision: 12, scale: 2 }),
  grossProfit: decimal("gross_profit", { precision: 12, scale: 2 }),
  operatingExpenses: decimal("operating_expenses", { precision: 12, scale: 2 }),
  netIncome: decimal("net_income", { precision: 12, scale: 2 }),
  
  // Additional metrics
  transactionCount: integer("transaction_count"),
  averageOrderValue: decimal("average_order_value", { precision: 10, scale: 2 }),
  
  // Category data
  categoryData: jsonb("category_data").$type<Array<{
    categoryId?: string;
    categoryName: string;
    revenue: number;
    units: number;
  }>>(),
  
  // Import metadata
  importMetadata: jsonb("import_metadata").$type<{
    fileName?: string;
    importedAt?: string;
    mappings?: { [key: string]: string };
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit log for compliance tracking
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  entityType: text("entity_type").notNull(), // scenarios, assumptions, projections, historical_data, products, etc.
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(), // create, update, delete, import, export, generate
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  changedFields: jsonb("changed_fields").$type<string[]>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type<{
    reason?: string;
    source?: string;
    recordCount?: number;
    [key: string]: any;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  description: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  sku: true,
  categoryId: true,
  price: true,
  cost: true,
  stock: true,
  lowStockThreshold: true,
  barcode: true,
  description: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  subtotal: true,
  tax: true,
  total: true,
  paymentMethod: true,
  paymentIntentId: true,
  items: true,
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertScenarioSchema = createInsertSchema(scenarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssumptionSchema = createInsertSchema(assumptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectionSchema = createInsertSchema(projections).omit({
  id: true,
  createdAt: true,
});

export const insertHistoricalDataSchema = createInsertSchema(historicalData).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type FinancialMetric = typeof financialMetrics.$inferSelect;
export type StoreSettings = typeof storeSettings.$inferSelect;
export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;

export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;

export type Assumption = typeof assumptions.$inferSelect;
export type InsertAssumption = z.infer<typeof insertAssumptionSchema>;

export type Projection = typeof projections.$inferSelect;
export type InsertProjection = z.infer<typeof insertProjectionSchema>;

export type HistoricalData = typeof historicalData.$inferSelect;
export type InsertHistoricalData = z.infer<typeof insertHistoricalDataSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
