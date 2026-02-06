/**
 * Commercial Lease Engine — Drizzle Schema
 * ==========================================
 * Phase 1: Database schema for institutional-grade commercial lease management.
 * 
 * FOUND FILES & INTEGRATION POINTS (Phase 0):
 * - Excel "Commercial_Tenants.xlsm" has fixed 20 tenants, 5 options each, single % rent tier
 * - This schema replaces ALL Excel limitations with unlimited capability
 * - Integrates via lease_monthly_cashflows cache table into Historical + Pro Forma rollups
 * - Does NOT jam data into main P&L ingestion tables — uses rollup endpoints instead
 * 
 * CONVENTIONS: matches existing MarinaMatch patterns (uuid PKs, project_id FK, timestamps)
 */

import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const leaseTypeEnum = pgEnum("cl_lease_type", [
  "retail",
  "office",
  "industrial",
  "other",
]);

export const baseRentModeEnum = pgEnum("base_rent_mode", [
  "PER_SF_YEAR",
  "PER_MONTH",
  "PER_YEAR",
]);

export const escalationTypeEnum = pgEnum("cl_escalation_type", [
  "NONE",
  "FIXED_DOLLAR",
  "FIXED_PER_SF",
  "PERCENT",
  "CPI",
]);

export const chargeLineTypeEnum = pgEnum("charge_line_type", [
  "RECOVERY_CAM",
  "RECOVERY_TAX",
  "RECOVERY_INSURANCE",
  "RECOVERY_UTILITIES",
  "MISC_INCOME",
  "DISCOUNT",
  "TI_AMORTIZATION",
]);

export const chargeAmountModeEnum = pgEnum("charge_amount_mode", [
  "FIXED_MONTHLY",
  "PER_SF_MONTHLY",
]);

export const abatementTypeEnum = pgEnum("abatement_type", [
  "FREE_RENT",
  "PERCENT_DISCOUNT",
  "FIXED_CREDIT",
]);

export const abatementAppliesToEnum = pgEnum("abatement_applies_to", [
  "BASE_ONLY",
  "BASE_PLUS_RECOVERIES",
  "ALL_CHARGES",
]);

export const salesSourceEnum = pgEnum("sales_source", ["ACTUAL", "FORECAST"]);

export const percentRentTimingEnum = pgEnum("percent_rent_timing", [
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL_TRUEUP",
]);

export const breakpointTypeEnum = pgEnum("breakpoint_type", [
  "NATURAL",
  "ARTIFICIAL",
]);

export const yearBasisEnum = pgEnum("year_basis", [
  "CALENDAR",
  "TENANT_FISCAL",
]);

export const tiAllowanceModeEnum = pgEnum("ti_allowance_mode", [
  "PER_SF",
  "FIXED_TOTAL",
]);

export const tiParticipationModeEnum = pgEnum("ti_participation_mode", [
  "NONE",
  "PERCENT_ABOVE_ALLOWANCE",
  "FIXED_CONTRIBUTION",
  "COMBO",
]);

export const tiAmortizeBasisEnum = pgEnum("ti_amortize_basis", [
  "LANDLORD_ONLY",
  "LANDLORD_PLUS_TENANT",
]);

export const tenantShareModeEnum = pgEnum("tenant_share_mode", [
  "BY_SF",
  "FIXED_PERCENT",
]);

export const billingTimingEnum = pgEnum("billing_timing", [
  "MONTHLY_ESTIMATE",
  "MONTHLY_WITH_ANNUAL_TRUEUP",
]);

export const recoveryStopTypeEnum = pgEnum("recovery_stop_type", [
  "NONE",
  "BASE_YEAR_STOP",
  "EXPENSE_STOP_PER_SF",
]);

export const recoveryCategoryEnum = pgEnum("recovery_category", [
  "CAM",
  "TAX",
  "INSURANCE",
  "UTILITIES",
  "OTHER",
]);

// ─── 1) COMMERCIAL LEASES ────────────────────────────────────────────────────

export const commercialLeases = pgTable(
  "commercial_leases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
    tenantName: text("tenant_name").notNull(),
    leaseType: leaseTypeEnum("lease_type").notNull().default("retail"),
    suite: text("suite"),
    sf: numeric("sf", { precision: 14, scale: 2 }).notNull().default("0"),
    units: integer("units").notNull().default(1),
    active: boolean("active").notNull().default(true),
    commencementDate: date("commencement_date").notNull(),
    rentCommencementDate: date("rent_commencement_date"),
    expirationDate: date("expiration_date").notNull(),
    securityDeposit: numeric("security_deposit", { precision: 14, scale: 2 }),
    fiscalYearEndMonth: integer("fiscal_year_end_month")
      .notNull()
      .default(12),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_commercial_leases_project").on(table.projectId),
  ]
);

// ─── 2) LEASE TERMS ──────────────────────────────────────────────────────────

export const leaseTerms = pgTable(
  "lease_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => commercialLeases.id, { onDelete: "cascade" }),
    termIndex: integer("term_index").notNull().default(0),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    baseRentMode: baseRentModeEnum("base_rent_mode")
      .notNull()
      .default("PER_SF_YEAR"),
    baseRentValue: numeric("base_rent_value", { precision: 14, scale: 4 })
      .notNull()
      .default("0"),
    escalationType: escalationTypeEnum("escalation_type")
      .notNull()
      .default("NONE"),
    escalationValue: numeric("escalation_value", { precision: 14, scale: 6 })
      .notNull()
      .default("0"),
    escalationCycleMonths: integer("escalation_cycle_months")
      .notNull()
      .default(12),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_terms_lease").on(table.leaseId),
  ]
);

// ─── 3) LEASE CHARGE LINES ───────────────────────────────────────────────────

export const leaseChargeLines = pgTable(
  "lease_charge_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => commercialLeases.id, { onDelete: "cascade" }),
    lineName: text("line_name").notNull(),
    lineType: chargeLineTypeEnum("line_type").notNull(),
    amountMode: chargeAmountModeEnum("amount_mode")
      .notNull()
      .default("FIXED_MONTHLY"),
    amountValue: numeric("amount_value", { precision: 14, scale: 4 })
      .notNull()
      .default("0"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    escalationType: escalationTypeEnum("escalation_type").default("NONE"),
    escalationValue: numeric("escalation_value", { precision: 14, scale: 6 }).default("0"),
    escalationCycleMonths: integer("escalation_cycle_months").default(12),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_charge_lines_lease").on(table.leaseId),
  ]
);

// ─── 4) LEASE ABATEMENTS ─────────────────────────────────────────────────────

export const leaseAbatements = pgTable(
  "lease_abatements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => commercialLeases.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    abatementType: abatementTypeEnum("abatement_type").notNull(),
    value: numeric("value", { precision: 14, scale: 6 }).notNull().default("0"),
    appliesTo: abatementAppliesToEnum("applies_to")
      .notNull()
      .default("BASE_ONLY"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_abatements_lease").on(table.leaseId),
  ]
);

// ─── 5) LEASE SALES ──────────────────────────────────────────────────────────

export const leaseSales = pgTable(
  "lease_sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => commercialLeases.id, { onDelete: "cascade" }),
    monthEnd: date("month_end").notNull(),
    salesAmount: numeric("sales_amount", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    source: salesSourceEnum("source").notNull().default("ACTUAL"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_sales_lease").on(table.leaseId),
    uniqueIndex("idx_lease_sales_unique").on(table.leaseId, table.monthEnd),
  ]
);

// ─── 6) LEASE PERCENT RENT RULES ─────────────────────────────────────────────

export const leasePercentRentRules = pgTable(
  "lease_percent_rent_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => commercialLeases.id, { onDelete: "cascade" }),
    timing: percentRentTimingEnum("timing").notNull().default("ANNUAL_TRUEUP"),
    breakpointType: breakpointTypeEnum("breakpoint_type")
      .notNull()
      .default("NATURAL"),
    artificialBreakpointAmount: numeric("artificial_breakpoint_amount", {
      precision: 16,
      scale: 2,
    }),
    tiersJson: jsonb("tiers_json")
      .notNull()
      .default([{ threshold: 0, rate: 0 }]),
    trueupYearBasis: yearBasisEnum("trueup_year_basis")
      .notNull()
      .default("CALENDAR"),
    salesGrowthRate: numeric("sales_growth_rate", { precision: 8, scale: 6 }).default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_percent_rent_lease").on(table.leaseId),
  ]
);

// ─── 7) LEASE TI PROGRAMS ────────────────────────────────────────────────────

export const leaseTiPrograms = pgTable(
  "lease_ti_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => commercialLeases.id, { onDelete: "cascade" }),
    allowanceMode: tiAllowanceModeEnum("allowance_mode")
      .notNull()
      .default("PER_SF"),
    allowanceValue: numeric("allowance_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    landlordCapTotal: numeric("landlord_cap_total", { precision: 14, scale: 2 }),
    tenantParticipationMode: tiParticipationModeEnum("tenant_participation_mode")
      .notNull()
      .default("NONE"),
    tenantParticipationValue: numeric("tenant_participation_value", {
      precision: 14,
      scale: 6,
    }),
    tenantFixedContribution: numeric("tenant_fixed_contribution", {
      precision: 14,
      scale: 2,
    }),
    amortizeEnabled: boolean("amortize_enabled").notNull().default(false),
    amortizeAmountBasis: tiAmortizeBasisEnum("amortize_amount_basis")
      .notNull()
      .default("LANDLORD_ONLY"),
    amortizeRateAnnual: numeric("amortize_rate_annual", {
      precision: 8,
      scale: 6,
    }),
    amortizeTermMonths: integer("amortize_term_months"),
    amortizeStartMonthEnd: date("amortize_start_month_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_ti_programs_lease").on(table.leaseId),
  ]
);

// ─── 8) LEASE TI DRAWS ──────────────────────────────────────────────────────

export const leaseTiDraws = pgTable(
  "lease_ti_draws",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tiProgramId: uuid("ti_program_id")
      .notNull()
      .references(() => leaseTiPrograms.id, { onDelete: "cascade" }),
    drawDate: date("draw_date").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_ti_draws_program").on(table.tiProgramId),
  ]
);

// ─── 9) LEASE RECOVERY MODELS ───────────────────────────────────────────────

export const leaseRecoveryModels = pgTable(
  "lease_recovery_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => commercialLeases.id, { onDelete: "cascade" }),
    totalPropertyNraSf: numeric("total_property_nra_sf", {
      precision: 14,
      scale: 2,
    }),
    tenantShareMode: tenantShareModeEnum("tenant_share_mode")
      .notNull()
      .default("BY_SF"),
    tenantSharePercent: numeric("tenant_share_percent", {
      precision: 8,
      scale: 6,
    }),
    billingTiming: billingTimingEnum("billing_timing")
      .notNull()
      .default("MONTHLY_WITH_ANNUAL_TRUEUP"),
    stopYearBasis: yearBasisEnum("stop_year_basis")
      .notNull()
      .default("CALENDAR"),
    baseYear: integer("base_year"),
    grossupEnabled: boolean("grossup_enabled").notNull().default(false),
    grossupOccupancyThreshold: numeric("grossup_occupancy_threshold", {
      precision: 8,
      scale: 6,
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_recovery_models_lease").on(table.leaseId),
  ]
);

// ─── 10) LEASE RECOVERY CATEGORIES ──────────────────────────────────────────

export const leaseRecoveryCategories = pgTable(
  "lease_recovery_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recoveryModelId: uuid("recovery_model_id")
      .notNull()
      .references(() => leaseRecoveryModels.id, { onDelete: "cascade" }),
    category: recoveryCategoryEnum("category").notNull(),
    stopType: recoveryStopTypeEnum("stop_type").notNull().default("NONE"),
    baseYearAmountTotal: numeric("base_year_amount_total", {
      precision: 14,
      scale: 2,
    }),
    expenseStopPerSf: numeric("expense_stop_per_sf", {
      precision: 14,
      scale: 4,
    }),
    annualExpenseForecast: jsonb("annual_expense_forecast"),
    annualGrowthRate: numeric("annual_growth_rate", {
      precision: 8,
      scale: 6,
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lease_recovery_cats_model").on(table.recoveryModelId),
  ]
);

// ─── 11) LEASE MONTHLY CASHFLOWS (computed cache) ───────────────────────────

export const leaseMonthlyCashflows = pgTable(
  "lease_monthly_cashflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => commercialLeases.id, { onDelete: "cascade" }),
    monthEnd: date("month_end").notNull(),
    baseRent: numeric("base_rent", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    recoveriesCam: numeric("recoveries_cam", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    recoveriesTax: numeric("recoveries_tax", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    recoveriesInsurance: numeric("recoveries_insurance", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    recoveriesUtilities: numeric("recoveries_utilities", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    miscIncome: numeric("misc_income", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    discounts: numeric("discounts", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    percentRent: numeric("percent_rent", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    tiLandlordCapex: numeric("ti_landlord_capex", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    tiTenantContribution: numeric("ti_tenant_contribution", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    tiAmortizationCharge: numeric("ti_amortization_charge", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    totalRent: numeric("total_rent", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_cashflows_lease_month").on(table.leaseId, table.monthEnd),
    index("idx_cashflows_month").on(table.monthEnd),
  ]
);

// ─── RELATIONS ──────────────────────────────────────────────────────────────

export const commercialLeasesRelations = relations(
  commercialLeases,
  ({ many }) => ({
    terms: many(leaseTerms),
    chargeLines: many(leaseChargeLines),
    abatements: many(leaseAbatements),
    sales: many(leaseSales),
    percentRentRules: many(leasePercentRentRules),
    tiPrograms: many(leaseTiPrograms),
    recoveryModels: many(leaseRecoveryModels),
    cashflows: many(leaseMonthlyCashflows),
  })
);

export const leaseTermsRelations = relations(leaseTerms, ({ one }) => ({
  lease: one(commercialLeases, {
    fields: [leaseTerms.leaseId],
    references: [commercialLeases.id],
  }),
}));

export const leaseChargeLinesRelations = relations(
  leaseChargeLines,
  ({ one }) => ({
    lease: one(commercialLeases, {
      fields: [leaseChargeLines.leaseId],
      references: [commercialLeases.id],
    }),
  })
);

export const leaseAbatementsRelations = relations(
  leaseAbatements,
  ({ one }) => ({
    lease: one(commercialLeases, {
      fields: [leaseAbatements.leaseId],
      references: [commercialLeases.id],
    }),
  })
);

export const leaseSalesRelations = relations(leaseSales, ({ one }) => ({
  lease: one(commercialLeases, {
    fields: [leaseSales.leaseId],
    references: [commercialLeases.id],
  }),
}));

export const leasePercentRentRulesRelations = relations(
  leasePercentRentRules,
  ({ one }) => ({
    lease: one(commercialLeases, {
      fields: [leasePercentRentRules.leaseId],
      references: [commercialLeases.id],
    }),
  })
);

export const leaseTiProgramsRelations = relations(
  leaseTiPrograms,
  ({ one, many }) => ({
    lease: one(commercialLeases, {
      fields: [leaseTiPrograms.leaseId],
      references: [commercialLeases.id],
    }),
    draws: many(leaseTiDraws),
  })
);

export const leaseTiDrawsRelations = relations(leaseTiDraws, ({ one }) => ({
  program: one(leaseTiPrograms, {
    fields: [leaseTiDraws.tiProgramId],
    references: [leaseTiPrograms.id],
  }),
}));

export const leaseRecoveryModelsRelations = relations(
  leaseRecoveryModels,
  ({ one, many }) => ({
    lease: one(commercialLeases, {
      fields: [leaseRecoveryModels.leaseId],
      references: [commercialLeases.id],
    }),
    categories: many(leaseRecoveryCategories),
  })
);

export const leaseRecoveryCategoriesRelations = relations(
  leaseRecoveryCategories,
  ({ one }) => ({
    model: one(leaseRecoveryModels, {
      fields: [leaseRecoveryCategories.recoveryModelId],
      references: [leaseRecoveryModels.id],
    }),
  })
);

export const leaseMonthlyCashflowsRelations = relations(
  leaseMonthlyCashflows,
  ({ one }) => ({
    lease: one(commercialLeases, {
      fields: [leaseMonthlyCashflows.leaseId],
      references: [commercialLeases.id],
    }),
  })
);
