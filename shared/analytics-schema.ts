import { pgTable, varchar, text, decimal, integer, boolean, jsonb, timestamp, date, index, unique, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// Institutional Analytics Schema
// Multi-Asset Class Performance Metrics and KPI Framework
// ============================================================================

// Asset Class Enum - supports marina plus core CRE asset types
export const assetClassEnum = pgEnum("asset_class", [
  "marina",
  "multifamily",
  "retail",
  "office",
  "hotel",
  "industrial",
  "mixed_use"
]);

// KPI Category Enum - groups metrics by type
export const kpiCategoryEnum = pgEnum("kpi_category", [
  "occupancy",
  "revenue",
  "expense",
  "profitability",
  "valuation",
  "debt",
  "operational",
  "benchmarking"
]);

// Period Type Enum - time granularity for snapshots
export const periodTypeEnum = pgEnum("period_type", [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
  "ytd",
  "trailing_12"
]);

// Comp Set Type Enum - for benchmarking comparisons
export const compSetTypeEnum = pgEnum("comp_set_type", [
  "custom",
  "regional",
  "national",
  "asset_class",
  "market_segment"
]);

// ============================================================================
// KPI Definitions Registry - Defines available metrics per asset class
// ============================================================================
export const kpiDefinitions = pgTable("kpi_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  code: text("code").notNull().unique(), // e.g., "marina_revpalf", "mf_occupancy"
  name: text("name").notNull(), // Display name: "Revenue per Available Linear Foot"
  description: text("description"),
  assetClass: assetClassEnum("asset_class").notNull(),
  category: kpiCategoryEnum("category").notNull(),
  formula: text("formula"), // Human-readable formula description
  unit: text("unit").notNull(), // "%", "$", "days", "ratio"
  precision: integer("precision").default(2), // Decimal places
  isHigherBetter: boolean("is_higher_better").default(true),
  benchmarkLow: decimal("benchmark_low", { precision: 15, scale: 4 }),
  benchmarkMid: decimal("benchmark_mid", { precision: 15, scale: 4 }),
  benchmarkHigh: decimal("benchmark_high", { precision: 15, scale: 4 }),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assetClassIdx: index("kpi_definitions_asset_class_idx").on(table.assetClass),
  categoryIdx: index("kpi_definitions_category_idx").on(table.category),
  codeIdx: index("kpi_definitions_code_idx").on(table.code),
}));

// ============================================================================
// Performance Snapshots - Point-in-time metric values per asset
// ============================================================================
export const performanceSnapshots = pgTable("performance_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  assetClass: assetClassEnum("asset_class").notNull(),
  assetId: varchar("asset_id").notNull(), // FK to modelingProjects, rentRolls, or deals
  assetType: text("asset_type").notNull(), // "modeling_project", "rent_roll", "deal"
  periodType: periodTypeEnum("period_type").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Snapshot of all KPIs as JSON for flexibility
  metrics: jsonb("metrics").notNull().$type<Record<string, number | null>>(),
  
  // Pre-computed key metrics for fast queries (denormalized)
  occupancyRate: decimal("occupancy_rate", { precision: 7, scale: 4 }),
  grossRevenue: decimal("gross_revenue", { precision: 15, scale: 2 }),
  netOperatingIncome: decimal("net_operating_income", { precision: 15, scale: 2 }),
  capRate: decimal("cap_rate", { precision: 7, scale: 4 }),
  
  // Marina-specific metrics
  revPalf: decimal("rev_palf", { precision: 10, scale: 2 }), // Revenue per Available Linear Foot
  adr: decimal("adr", { precision: 10, scale: 2 }), // Average Daily Rate
  totalLinearFeet: integer("total_linear_feet"),
  occupiedLinearFeet: integer("occupied_linear_feet"),
  
  // Multifamily-specific
  avgRentPerUnit: decimal("avg_rent_per_unit", { precision: 10, scale: 2 }),
  turnoverRate: decimal("turnover_rate", { precision: 7, scale: 4 }),
  
  // Retail-specific
  walt: decimal("walt", { precision: 5, scale: 2 }), // Weighted Average Lease Term (years)
  salesPerSqft: decimal("sales_per_sqft", { precision: 10, scale: 2 }),
  occupancyCostRatio: decimal("occupancy_cost_ratio", { precision: 7, scale: 4 }),
  
  // Hotel-specific
  revPar: decimal("rev_par", { precision: 10, scale: 2 }), // Revenue per Available Room
  
  // Debt metrics
  dscr: decimal("dscr", { precision: 7, scale: 4 }), // Debt Service Coverage Ratio
  ltv: decimal("ltv", { precision: 7, scale: 4 }), // Loan-to-Value
  
  // Metadata
  dataQualityScore: integer("data_quality_score"), // 0-100
  sourceData: jsonb("source_data"), // References to source records
  notes: text("notes"),
  isProjected: boolean("is_projected").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("performance_snapshots_org_idx").on(table.orgId),
  assetIdx: index("performance_snapshots_asset_idx").on(table.assetId, table.assetType),
  periodIdx: index("performance_snapshots_period_idx").on(table.periodStart, table.periodEnd),
  assetClassIdx: index("performance_snapshots_asset_class_idx").on(table.assetClass),
  orgAssetPeriod: unique("performance_snapshots_unique").on(
    table.orgId, table.assetId, table.periodType, table.periodStart
  ),
}));

// ============================================================================
// Comp Sets - Groupings for benchmark comparisons
// ============================================================================
export const compSets = pgTable("comp_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  assetClass: assetClassEnum("asset_class").notNull(),
  compSetType: compSetTypeEnum("comp_set_type").notNull().default("custom"),
  
  // Criteria for automatic comp set membership
  criteria: jsonb("criteria").$type<{
    region?: string;
    minSlips?: number;
    maxSlips?: number;
    minRevenue?: number;
    maxRevenue?: number;
    tags?: string[];
  }>(),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("comp_sets_org_idx").on(table.orgId),
  assetClassIdx: index("comp_sets_asset_class_idx").on(table.assetClass),
}));

// ============================================================================
// Comp Set Members - Assets included in a comp set
// ============================================================================
export const compSetMembers = pgTable("comp_set_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  compSetId: varchar("comp_set_id").notNull(),
  assetId: varchar("asset_id").notNull(),
  assetType: text("asset_type").notNull(),
  isPrimary: boolean("is_primary").default(false), // Subject property
  weight: decimal("weight", { precision: 5, scale: 4 }).default("1.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  compSetIdx: index("comp_set_members_comp_set_idx").on(table.compSetId),
  assetIdx: index("comp_set_members_asset_idx").on(table.assetId),
  uniqueMember: unique("comp_set_members_unique").on(table.compSetId, table.assetId),
}));

// ============================================================================
// Market Benchmarks - External market data for comparisons
// ============================================================================
export const marketBenchmarks = pgTable("market_benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id"),
  assetClass: assetClassEnum("asset_class").notNull(),
  region: text("region"), // State, MSA, or custom region
  marketSegment: text("market_segment"), // "Class A", "Coastal", etc.
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Benchmark values by KPI code
  benchmarks: jsonb("benchmarks").notNull().$type<Record<string, {
    value: number;
    percentile25?: number;
    percentile50?: number;
    percentile75?: number;
    sampleSize?: number;
  }>>(),
  
  source: text("source"), // "Internal", "CoStar", "STR", etc.
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("market_benchmarks_org_idx").on(table.orgId),
  assetClassIdx: index("market_benchmarks_asset_class_idx").on(table.assetClass),
  regionIdx: index("market_benchmarks_region_idx").on(table.region),
  periodIdx: index("market_benchmarks_period_idx").on(table.periodStart),
}));

// ============================================================================
// Ancillary Revenue Sources - Tracks non-slip revenue streams
// ============================================================================
export const ancillaryRevenueSources = pgTable("ancillary_revenue_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  assetId: varchar("asset_id").notNull(),
  assetType: text("asset_type").notNull(),
  
  sourceType: text("source_type").notNull(), // "fuel", "ship_store", "service", "restaurant", "rental"
  sourceName: text("source_name").notNull(),
  
  // Revenue metrics
  grossRevenue: decimal("gross_revenue", { precision: 15, scale: 2 }),
  costOfGoods: decimal("cost_of_goods", { precision: 15, scale: 2 }),
  grossMargin: decimal("gross_margin", { precision: 15, scale: 2 }),
  marginPercent: decimal("margin_percent", { precision: 7, scale: 4 }),
  
  // Volume metrics (type-specific)
  volumeMetrics: jsonb("volume_metrics").$type<{
    gallonsSold?: number;
    transactionCount?: number;
    avgTicket?: number;
    unitsPerDay?: number;
  }>(),
  
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Link to source data
  sourceTable: text("source_table"), // "fuel_sales", "ship_store_transactions"
  sourceIds: text("source_ids").array(), // Array of source record IDs
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("ancillary_revenue_org_idx").on(table.orgId),
  assetIdx: index("ancillary_revenue_asset_idx").on(table.assetId),
  sourceTypeIdx: index("ancillary_revenue_source_type_idx").on(table.sourceType),
  periodIdx: index("ancillary_revenue_period_idx").on(table.periodStart),
}));

// ============================================================================
// Analytics Dashboard Widgets - User-configured analytics displays
// ============================================================================
export const analyticsWidgets = pgTable("analytics_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  userId: varchar("user_id"),
  
  name: text("name").notNull(),
  widgetType: text("widget_type").notNull(), // "kpi_card", "trend_chart", "comp_table", "gauge"
  assetClass: assetClassEnum("asset_class"),
  
  // Configuration
  config: jsonb("config").notNull().$type<{
    kpiCode?: string;
    kpiCodes?: string[];
    chartType?: "line" | "bar" | "area" | "pie";
    timeRange?: "1m" | "3m" | "6m" | "1y" | "3y" | "ytd" | "all";
    compSetId?: string;
    showBenchmark?: boolean;
    showTrend?: boolean;
    colorScheme?: string;
  }>(),
  
  // Layout
  gridX: integer("grid_x").default(0),
  gridY: integer("grid_y").default(0),
  gridW: integer("grid_w").default(4),
  gridH: integer("grid_h").default(3),
  
  dashboardId: varchar("dashboard_id"), // Optional: for grouped dashboards
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("analytics_widgets_org_idx").on(table.orgId),
  userIdx: index("analytics_widgets_user_idx").on(table.userId),
  dashboardIdx: index("analytics_widgets_dashboard_idx").on(table.dashboardId),
}));

// ============================================================================
// Insert Schemas and Types
// ============================================================================

export const insertKpiDefinitionSchema = createInsertSchema(kpiDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateKpiDefinitionSchema = insertKpiDefinitionSchema.partial();
export type KpiDefinition = typeof kpiDefinitions.$inferSelect;
export type InsertKpiDefinition = z.infer<typeof insertKpiDefinitionSchema>;

export const insertPerformanceSnapshotSchema = createInsertSchema(performanceSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePerformanceSnapshotSchema = insertPerformanceSnapshotSchema.partial();
export type PerformanceSnapshot = typeof performanceSnapshots.$inferSelect;
export type InsertPerformanceSnapshot = z.infer<typeof insertPerformanceSnapshotSchema>;

export const insertCompSetSchema = createInsertSchema(compSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateCompSetSchema = insertCompSetSchema.partial();
export type CompSet = typeof compSets.$inferSelect;
export type InsertCompSet = z.infer<typeof insertCompSetSchema>;

export const insertCompSetMemberSchema = createInsertSchema(compSetMembers).omit({
  id: true,
  createdAt: true,
});
export type CompSetMember = typeof compSetMembers.$inferSelect;
export type InsertCompSetMember = z.infer<typeof insertCompSetMemberSchema>;

export const insertMarketBenchmarkSchema = createInsertSchema(marketBenchmarks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateMarketBenchmarkSchema = insertMarketBenchmarkSchema.partial();
export type MarketBenchmark = typeof marketBenchmarks.$inferSelect;
export type InsertMarketBenchmark = z.infer<typeof insertMarketBenchmarkSchema>;

export const insertAncillaryRevenueSourceSchema = createInsertSchema(ancillaryRevenueSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateAncillaryRevenueSourceSchema = insertAncillaryRevenueSourceSchema.partial();
export type AncillaryRevenueSource = typeof ancillaryRevenueSources.$inferSelect;
export type InsertAncillaryRevenueSource = z.infer<typeof insertAncillaryRevenueSourceSchema>;

export const insertAnalyticsWidgetSchema = createInsertSchema(analyticsWidgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateAnalyticsWidgetSchema = insertAnalyticsWidgetSchema.partial();
export type AnalyticsWidget = typeof analyticsWidgets.$inferSelect;
export type InsertAnalyticsWidget = z.infer<typeof insertAnalyticsWidgetSchema>;

// ============================================================================
// Type Helpers for KPI Values
// ============================================================================
export type AssetClass = typeof assetClassEnum.enumValues[number];
export type KpiCategory = typeof kpiCategoryEnum.enumValues[number];
export type PeriodType = typeof periodTypeEnum.enumValues[number];
export type CompSetType = typeof compSetTypeEnum.enumValues[number];

// Marina-specific KPI codes
export const MARINA_KPI_CODES = {
  OCCUPANCY_RATE: "marina_occupancy_rate",
  ADR: "marina_adr",
  REVPALF: "marina_revpalf",
  NOI: "marina_noi",
  NOI_MARGIN: "marina_noi_margin",
  CAP_RATE: "marina_cap_rate",
  FUEL_REVENUE: "marina_fuel_revenue",
  FUEL_MARGIN: "marina_fuel_margin",
  ANCILLARY_REVENUE: "marina_ancillary_revenue",
  DSCR: "marina_dscr",
  LTV: "marina_ltv",
  REVENUE_PER_SLIP: "marina_revenue_per_slip",
  WAITLIST_LENGTH: "marina_waitlist_length",
  RETENTION_RATE: "marina_retention_rate",
} as const;

// Multifamily KPI codes
export const MULTIFAMILY_KPI_CODES = {
  OCCUPANCY_RATE: "mf_occupancy_rate",
  AVG_RENT: "mf_avg_rent",
  RENT_PSF: "mf_rent_psf",
  TURNOVER_RATE: "mf_turnover_rate",
  NOI: "mf_noi",
  EXPENSE_RATIO: "mf_expense_ratio",
  CAP_RATE: "mf_cap_rate",
  CASH_ON_CASH: "mf_cash_on_cash",
  DSCR: "mf_dscr",
  LTV: "mf_ltv",
} as const;

// Retail KPI codes
export const RETAIL_KPI_CODES = {
  OCCUPANCY_RATE: "retail_occupancy_rate",
  WALT: "retail_walt",
  SALES_PSF: "retail_sales_psf",
  OCR: "retail_ocr",
  AVG_RENT_PSF: "retail_avg_rent_psf",
  NOI: "retail_noi",
  CAP_RATE: "retail_cap_rate",
  TENANT_CONCENTRATION: "retail_tenant_concentration",
} as const;

// Office KPI codes
export const OFFICE_KPI_CODES = {
  OCCUPANCY_RATE: "office_occupancy_rate",
  WALT: "office_walt",
  AVG_RENT_PSF: "office_avg_rent_psf",
  RENT_VS_MARKET: "office_rent_vs_market",
  TENANT_CONCENTRATION: "office_tenant_concentration",
  NOI: "office_noi",
  CAP_RATE: "office_cap_rate",
  VALUE_PSF: "office_value_psf",
} as const;

// Hotel KPI codes
export const HOTEL_KPI_CODES = {
  OCCUPANCY_RATE: "hotel_occupancy_rate",
  ADR: "hotel_adr",
  REVPAR: "hotel_revpar",
  GOPPAR: "hotel_goppar",
  NOI: "hotel_noi",
  CAP_RATE: "hotel_cap_rate",
  VALUE_PER_KEY: "hotel_value_per_key",
} as const;
