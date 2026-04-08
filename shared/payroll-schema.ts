import { assetClassEnum } from "./analytics-schema";
/**
 * Vantage Payroll Module — Complete Drizzle Schema
 *
 * Tables:
 *   A) Permission scaffolding (payroll_permission_grants)
 *   B) Payroll core tables (plans, departments, positions, employees, lines, etc.)
 *   C) Department P&L bridge tables
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  numeric,
  integer,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const orgRoleEnum = pgEnum("org_role", [
  "ORG_OWNER",
  "ORG_ADMIN",
  "ORG_MANAGER",
  "ORG_MEMBER",
  "ORG_VIEWER",
]);

export const permissionScopeTypeEnum = pgEnum("permission_scope_type", [
  "ORG",
  "PORTFOLIO",
  "ASSET",
  "VALUATION_MODEL",
]);

export const permissionLevelEnum = pgEnum("permission_level", [
  "VIEW",
  "EDIT",
  "ADMIN",
]);

export const detailLevelMaxEnum = pgEnum("detail_level_max", [
  "TOTALS_ONLY",
  "DEPT_TOTALS",
  "POSITION_LINES",
  "EMPLOYEE_DETAIL",
]);

export const planTypeEnum = pgEnum("payroll_plan_type", [
  "OPERATIONS_ACTUAL",
  "OPERATIONS_BUDGET",
  "SELLER_TRAILING",
  "UNDERWRITING_PROFORMA",
  "VALUATOR_ACTUALS_SNAPSHOT",
]);

export const periodGranularityEnum = pgEnum("period_granularity", [
  "WEEKLY",
  "MONTHLY",
]);

export const burdenModeEnum = pgEnum("burden_mode", [
  "SIMPLE_PCT",
  "ITEMIZED",
]);

export const burdenItemTypeEnum = pgEnum("burden_item_type", [
  "BENEFIT",
  "TAX",
  "WORKERS_COMP",
  "OTHER",
]);

export const burdenCalcMethodEnum = pgEnum("burden_calc_method", [
  "PCT_OF_BASE",
  "PCT_OF_BASE_PLUS_BENEFITS",
  "FLAT_PER_PERIOD",
  "FLAT_PER_HOUR",
]);

export const roleGroupEnum = pgEnum("role_group", [
  "OPS",
  "ADMIN",
  "MGMT",
  "MAINT",
  "SEASONAL",
  "OTHER",
]);


export const workerTypeEnum = pgEnum("worker_type", [
  "W2",
  "CONTRACTOR_1099",
]);

export const employeeStatusEnum = pgEnum("employee_status", [
  "ACTIVE",
  "INACTIVE",
]);

export const externalProviderEnum = pgEnum("external_provider", [
  "NONE",
  "ADP",
  "PAYCHEX",
  "OTHER",
]);

export const payTypeEnum = pgEnum("pay_type", ["SALARY", "HOURLY"]);

export const bonusTypeEnum = pgEnum("bonus_type", [
  "FIXED",
  "PCT_SALARY",
  "PERFORMANCE",
]);

export const kpiKeyEnum = pgEnum("kpi_key", [
  "REVENUE",
  "NOI",
  "EBITDA",
  "CUSTOM",
]);

export const syncModeEnum = pgEnum("sync_mode", ["MANUAL"]);

export const integrationProviderEnum = pgEnum("integration_provider", [
  "ADP",
  "PAYCHEX",
  "OTHER",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "DISCONNECTED",
  "CONNECTED",
  "ERROR",
]);

export const statementSectionEnum = pgEnum("statement_section", [
  "REVENUE",
  "COGS",
  "OPEX",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
]);

export const pnlSourceEnum = pgEnum("pnl_source", [
  "QUICKBOOKS",
  "UPLOAD",
  "MANUAL",
  "MODEL",
]);

export const allocationModeEnum = pgEnum("allocation_mode", [
  "NONE",
  "PCT_SPLIT",
]);

export const valuatorPnlSourceEnum = pgEnum("valuator_pnl_source", [
  "SELLER",
  "UNDERWRITING",
  "OPS_SYNC",
  "MANUAL",
]);

export const seasonalityTypeEnum = pgEnum("seasonality_type", [
  "SUMMER_HIGH",
  "SHOULDER",
  "WINTER_LOW",
  "CUSTOM",
]);

// ─── A) PERMISSION TABLE ──────────────────────────────────────────────────────

export const payrollPermissionGrants = pgTable(
  "payroll_permission_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    grantedToUserId: uuid("granted_to_user_id").notNull(),
    grantedByUserId: uuid("granted_by_user_id").notNull(),
    scopeType: permissionScopeTypeEnum("scope_type").notNull(),
    scopeId: uuid("scope_id"),
    permissionLevel: permissionLevelEnum("permission_level").notNull().default("VIEW"),
    detailLevelMax: detailLevelMaxEnum("detail_level_max").notNull().default("TOTALS_ONLY"),
    canExport: boolean("can_export").notNull().default(false),
    canViewEmployeeNames: boolean("can_view_employee_names").notNull().default(false),
    canViewCompRates: boolean("can_view_comp_rates").notNull().default(false),
    canViewBonusDetail: boolean("can_view_bonus_detail").notNull().default(false),
    canViewAllAssets: boolean("can_view_all_assets").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueGrant: uniqueIndex("uq_payroll_perm_grant").on(
      table.orgId,
      table.grantedToUserId,
      table.scopeType,
      table.scopeId
    ),
    grantedToIdx: index("idx_payroll_perm_granted_to").on(table.grantedToUserId),
    orgIdx: index("idx_payroll_perm_org").on(table.orgId),
  })
);

// ─── B) PAYROLL CORE TABLES ───────────────────────────────────────────────────

export const payrollDepartments = pgTable("payroll_departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollProfitCenters = pgTable("payroll_profit_centers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  assetId: uuid("asset_id"),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollBurdenProfiles = pgTable("payroll_burden_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  mode: burdenModeEnum("mode").notNull().default("SIMPLE_PCT"),
  benefitsPct: numeric("benefits_pct", { precision: 8, scale: 6 }),
  taxesPct: numeric("taxes_pct", { precision: 8, scale: 6 }),
  workersCompPct: numeric("workers_comp_pct", { precision: 8, scale: 6 }),
  otherBurdenPct: numeric("other_burden_pct", { precision: 8, scale: 6 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollBurdenItems = pgTable("payroll_burden_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  burdenProfileId: uuid("burden_profile_id")
    .notNull()
    .references(() => payrollBurdenProfiles.id, { onDelete: "cascade" }),
  itemType: burdenItemTypeEnum("item_type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  calcMethod: burdenCalcMethodEnum("calc_method").notNull(),
  rateNumeric: numeric("rate_numeric", { precision: 12, scale: 6 }).notNull(),
  notes: text("notes"),
});

export const payrollPositions = pgTable("payroll_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  defaultDepartmentId: uuid("default_department_id"),
  roleGroup: roleGroupEnum("role_group").notNull().default("OTHER"),
  isTemplate: boolean("is_template").notNull().default(false),
  assetClass: assetClassEnum("asset_class").notNull().default("marina"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollEmployees = pgTable(
  "payroll_employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    assetId: uuid("asset_id"),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    workerType: workerTypeEnum("worker_type").notNull().default("W2"),
    status: employeeStatusEnum("status").notNull().default("ACTIVE"),
    externalProvider: externalProviderEnum("external_provider").notNull().default("NONE"),
    externalEmployeeId: varchar("external_employee_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_payroll_emp_org").on(table.orgId),
    assetIdx: index("idx_payroll_emp_asset").on(table.assetId),
  })
);

export const payrollPlans = pgTable(
  "payroll_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    portfolioId: uuid("portfolio_id"),
    assetId: uuid("asset_id"),
    name: varchar("name", { length: 255 }).notNull(),
    planType: planTypeEnum("plan_type").notNull(),
    scenarioId: uuid("scenario_id"),
    isSourceOfTruthForOwnedModel: boolean("is_source_of_truth_for_owned_model")
      .notNull()
      .default(false),
    periodGranularity: periodGranularityEnum("period_granularity")
      .notNull()
      .default("WEEKLY"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    defaultBurdenProfileId: uuid("default_burden_profile_id"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_payroll_plan_org").on(table.orgId),
    assetIdx: index("idx_payroll_plan_asset").on(table.assetId),
    portfolioIdx: index("idx_payroll_plan_portfolio").on(table.portfolioId),
  })
);

export const payrollPlanLines = pgTable(
  "payroll_plan_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => payrollPlans.id, { onDelete: "cascade" }),
    positionId: uuid("position_id"),
    employeeId: uuid("employee_id"),
    departmentId: uuid("department_id").notNull(),
    profitCenterId: uuid("profit_center_id"),
    headcount: numeric("headcount", { precision: 6, scale: 2 }).notNull().default("1"),
    payType: payTypeEnum("pay_type").notNull(),
    salaryAnnual: numeric("salary_annual", { precision: 14, scale: 2 }),
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 4 }),
    hoursPerWeek: numeric("hours_per_week", { precision: 6, scale: 2 }),
    weeksPerYear: numeric("weeks_per_year", { precision: 4, scale: 1 }),
    adjustments: numeric("adjustments", { precision: 14, scale: 2 }).notNull().default("0"),
    burdenProfileId: uuid("burden_profile_id"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    planIdx: index("idx_payroll_line_plan").on(table.planId),
    deptIdx: index("idx_payroll_line_dept").on(table.departmentId),
  })
);

export const payrollRateEvents = pgTable(
  "payroll_rate_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planLineId: uuid("plan_line_id")
      .notNull()
      .references(() => payrollPlanLines.id, { onDelete: "cascade" }),
    effectiveDate: date("effective_date").notNull(),
    salaryAnnualNew: numeric("salary_annual_new", { precision: 14, scale: 2 }),
    hourlyRateNew: numeric("hourly_rate_new", { precision: 10, scale: 4 }),
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    lineIdx: index("idx_rate_event_line").on(table.planLineId),
  })
);

export const payrollWeeklyHours = pgTable(
  "payroll_weekly_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planLineId: uuid("plan_line_id")
      .notNull()
      .references(() => payrollPlanLines.id, { onDelete: "cascade" }),
    weekStartDate: date("week_start_date").notNull(),
    hours: numeric("hours", { precision: 8, scale: 2 }).notNull(),
  },
  (table) => ({
    lineWeekIdx: index("idx_weekly_hours_line_week").on(
      table.planLineId,
      table.weekStartDate
    ),
  })
);

export const payrollAllocations = pgTable("payroll_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  planLineId: uuid("plan_line_id")
    .notNull()
    .references(() => payrollPlanLines.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id"),
  departmentId: uuid("department_id"),
  profitCenterId: uuid("profit_center_id"),
  allocationPct: numeric("allocation_pct", { precision: 6, scale: 4 }).notNull(),
  allocationNotes: text("allocation_notes"),
});

export const payrollBonusEvents = pgTable(
  "payroll_bonus_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planLineId: uuid("plan_line_id"),
    employeeId: uuid("employee_id"),
    positionId: uuid("position_id"),
    bonusType: bonusTypeEnum("bonus_type").notNull(),
    amountNumeric: numeric("amount_numeric", { precision: 14, scale: 2 }),
    pctNumeric: numeric("pct_numeric", { precision: 8, scale: 6 }),
    kpiKey: kpiKeyEnum("kpi_key"),
    customKpiName: text("custom_kpi_name"),
    payDate: date("pay_date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    lineIdx: index("idx_bonus_line").on(table.planLineId),
    dateIdx: index("idx_bonus_date").on(table.payDate),
  })
);

export const valuationModelPayrollLinks = pgTable("valuation_model_payroll_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  valuationModelId: uuid("valuation_model_id").notNull(),
  operationsPlanId: uuid("operations_plan_id").notNull(),
  valuatorActualsPlanId: uuid("valuator_actuals_plan_id"),
  syncMode: syncModeEnum("sync_mode").notNull().default("MANUAL"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollIntegrations = pgTable("payroll_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  provider: integrationProviderEnum("provider").notNull(),
  status: integrationStatusEnum("status").notNull().default("DISCONNECTED"),
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const seasonalityTemplates = pgTable("seasonality_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  seasonType: seasonalityTypeEnum("season_type").notNull(),
  weeklyHoursPattern: jsonb("weekly_hours_pattern").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── C) DEPARTMENT P&L BRIDGE TABLES ──────────────────────────────────────────

export const pnlCategories = pgTable("pnl_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  statementSection: statementSectionEnum("statement_section").notNull(),
  categoryName: varchar("category_name", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pnlLineItems = pgTable("pnl_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => pnlCategories.id, { onDelete: "cascade" }),
  lineItemName: varchar("line_item_name", { length: 255 }).notNull(),
  isDeptAssignable: boolean("is_dept_assignable").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pnlDepartmentMappings = pgTable("pnl_department_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  sourceType: pnlSourceEnum("source_type").notNull(),
  sourceLineItemKey: varchar("source_line_item_key", { length: 500 }).notNull(),
  departmentId: uuid("department_id"),
  profitCenterId: uuid("profit_center_id"),
  allocationMode: allocationModeEnum("allocation_mode").notNull().default("NONE"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pnlDepartmentAllocations = pgTable("pnl_department_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  mappingId: uuid("mapping_id")
    .notNull()
    .references(() => pnlDepartmentMappings.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").notNull(),
  allocationPct: numeric("allocation_pct", { precision: 6, scale: 4 }).notNull(),
});

export const pnlActualsValues = pgTable(
  "pnl_actuals_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    periodStartDate: date("period_start_date").notNull(),
    statementSection: statementSectionEnum("statement_section").notNull(),
    categoryId: uuid("category_id"),
    lineItemId: uuid("line_item_id"),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    source: pnlSourceEnum("source").notNull(),
    sourceLineItemKey: varchar("source_line_item_key", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    assetPeriodIdx: index("idx_pnl_actuals_asset_period").on(
      table.assetId,
      table.periodStartDate
    ),
  })
);

export const valuatorPnlScenarios = pgTable("valuator_pnl_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  valuationModelId: uuid("valuation_model_id").notNull(),
  scenarioId: uuid("scenario_id"),
  scenarioName: varchar("scenario_name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const valuatorPnlValues = pgTable(
  "valuator_pnl_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    valuationModelId: uuid("valuation_model_id").notNull(),
    scenarioId: uuid("scenario_id"),
    assetId: uuid("asset_id"),
    periodStartDate: date("period_start_date").notNull(),
    statementSection: statementSectionEnum("statement_section").notNull(),
    categoryId: uuid("category_id"),
    lineItemId: uuid("line_item_id"),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    source: valuatorPnlSourceEnum("source").notNull(),
    sourceLineItemKey: varchar("source_line_item_key", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    modelPeriodIdx: index("idx_valuator_pnl_model_period").on(
      table.valuationModelId,
      table.periodStartDate
    ),
  })
);

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const payrollPlansRelations = relations(payrollPlans, ({ many }) => ({
  lines: many(payrollPlanLines),
}));

export const payrollPlanLinesRelations = relations(payrollPlanLines, ({ one, many }) => ({
  plan: one(payrollPlans, {
    fields: [payrollPlanLines.planId],
    references: [payrollPlans.id],
  }),
  department: one(payrollDepartments, {
    fields: [payrollPlanLines.departmentId],
    references: [payrollDepartments.id],
  }),
  position: one(payrollPositions, {
    fields: [payrollPlanLines.positionId],
    references: [payrollPositions.id],
  }),
  employee: one(payrollEmployees, {
    fields: [payrollPlanLines.employeeId],
    references: [payrollEmployees.id],
  }),
  burdenProfile: one(payrollBurdenProfiles, {
    fields: [payrollPlanLines.burdenProfileId],
    references: [payrollBurdenProfiles.id],
  }),
  rateEvents: many(payrollRateEvents),
  weeklyHours: many(payrollWeeklyHours),
  allocations: many(payrollAllocations),
  bonusEvents: many(payrollBonusEvents),
}));

export const payrollBurdenProfilesRelations = relations(
  payrollBurdenProfiles,
  ({ many }) => ({
    items: many(payrollBurdenItems),
  })
);

export const payrollBurdenItemsRelations = relations(payrollBurdenItems, ({ one }) => ({
  profile: one(payrollBurdenProfiles, {
    fields: [payrollBurdenItems.burdenProfileId],
    references: [payrollBurdenProfiles.id],
  }),
}));

export const pnlCategoriesRelations = relations(pnlCategories, ({ many }) => ({
  lineItems: many(pnlLineItems),
}));

export const pnlLineItemsRelations = relations(pnlLineItems, ({ one }) => ({
  category: one(pnlCategories, {
    fields: [pnlLineItems.categoryId],
    references: [pnlCategories.id],
  }),
}));
