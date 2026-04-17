/**
 * Commercial Tenants Database Schema
 * 
 * Drizzle ORM schema for tenant lease modeling in Valuator.
 * Tables store lease data, rent terms, recoveries, percentage rent, and related configurations.
 */

import { pgTable, uuid, text, numeric, integer, boolean, timestamp, date, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ENUMS
// ============================================

export const leaseTypeEnum = pgEnum("lease_type", [
  "NNN",
  "MOD_GROSS", 
  "FULL_GROSS",
  "ABSOLUTE_NNN",
  "OTHER"
]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "ACTIVE",
  "FUTURE",
  "EXPIRING",
  "EXPIRED",
  "ARCHIVED"
]);

export const securityDepositTypeEnum = pgEnum("security_deposit_type", [
  "CASH",
  "LOC",
  "NONE"
]);

export const termTypeEnum = pgEnum("term_type", [
  "INITIAL",
  "OPTION"
]);

export const rentInputUnitEnum = pgEnum("rent_input_unit", [
  "PSF_YEAR",
  "PER_MONTH",
  "PER_YEAR"
]);

export const escalationTypeEnum = pgEnum("escalation_type", [
  "NONE",
  "PERCENT",
  "FIXED_DOLLAR",
  "DOLLAR_PSF_YEAR",
  "CPI",
  "CPI_CAP_FLOOR",
  "SCHEDULE"
]);

export const recoveryTypeEnum = pgEnum("recovery_type", [
  "CAM",
  "TAXES",
  "INSURANCE",
  "UTILITIES",
  "TRASH",
  "SECURITY",
  "OTHER"
]);

export const recoveryMethodEnum = pgEnum("recovery_method", [
  "PRO_RATA",
  "BASE_YEAR_STOP",
  "EXPENSE_STOP_PSF",
  "FIXED_MONTHLY",
  "FIXED_ANNUAL"
]);

export const breakpointTypeEnum = pgEnum("breakpoint_type", [
  "NATURAL",
  "ARTIFICIAL"
]);

export const settlementFrequencyEnum = pgEnum("settlement_frequency", [
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL"
]);

export const concessionTypeEnum = pgEnum("concession_type", [
  "FREE_RENT",
  "DISCOUNT_PERCENT",
  "DISCOUNT_FIXED",
  "OTHER"
]);

export const tiPaymentTimingEnum = pgEnum("ti_payment_timing", [
  "UPFRONT",
  "REIMBURSEMENT",
  "DRAW_SCHEDULE"
]);

export const lcPaymentTimingEnum = pgEnum("lc_payment_timing", [
  "AT_SIGNING",
  "SPREAD"
]);

// ============================================
// MAIN TABLES
// ============================================

/**
 * tenant_leases - Main lease records
 */
export const tenantLeases = pgTable("tenant_leases", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(), // FK to valuator projects
  
  // Tenant info
  tenantName: text("tenant_name").notNull(),
  suiteLabel: text("suite_label"),
  sf: numeric("sf", { precision: 12, scale: 2 }).notNull(),
  unitCount: integer("unit_count"),
  
  // Lease classification
  leaseType: leaseTypeEnum("lease_type").notNull().default("NNN"),
  
  // Dates
  leaseStartDate: date("lease_start_date").notNull(),
  rentCommencementDate: date("rent_commencement_date"),
  leaseEndDate: date("lease_end_date").notNull(),
  
  // Security deposit
  securityDepositAmount: numeric("security_deposit_amount", { precision: 12, scale: 2 }),
  securityDepositType: securityDepositTypeEnum("security_deposit_type").default("NONE"),
  
  // Other
  notes: text("notes"),
  status: leaseStatusEnum("status").notNull().default("ACTIVE"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("tenant_leases_project_id_idx").on(table.projectId),
  statusIdx: index("tenant_leases_status_idx").on(table.status),
}));

/**
 * tenant_rent_terms - Initial term + option terms
 */
export const tenantRentTerms = pgTable("tenant_rent_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => tenantLeases.id, { onDelete: "cascade" }),
  
  // Term identification
  termType: termTypeEnum("term_type").notNull().default("INITIAL"),
  optionIndex: integer("option_index"), // 1, 2, 3... for options
  
  // Term dates
  termStartDate: date("term_start_date").notNull(),
  termEndDate: date("term_end_date").notNull(),
  
  // Base rent
  baseRentInputUnit: rentInputUnitEnum("base_rent_input_unit").notNull().default("PSF_YEAR"),
  baseRentInputValue: numeric("base_rent_input_value", { precision: 12, scale: 4 }).notNull(),
  
  // Escalations
  escalationType: escalationTypeEnum("escalation_type").notNull().default("NONE"),
  escalationValue: numeric("escalation_value", { precision: 8, scale: 4 }),
  escalationFrequencyMonths: integer("escalation_frequency_months"),
  escalationCapPercent: numeric("escalation_cap_percent", { precision: 6, scale: 4 }),
  escalationFloorPercent: numeric("escalation_floor_percent", { precision: 6, scale: 4 }),
  escalationCpiSeries: text("escalation_cpi_series"),
  scheduleJson: jsonb("schedule_json"), // For SCHEDULE type: [{effectiveDate, value, unit, notes}]
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  leaseIdIdx: index("tenant_rent_terms_lease_id_idx").on(table.leaseId),
}));

/**
 * tenant_recoveries - CAM, taxes, insurance, etc.
 */
export const tenantRecoveries = pgTable("tenant_recoveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => tenantLeases.id, { onDelete: "cascade" }),
  
  // Recovery config
  recoveryType: recoveryTypeEnum("recovery_type").notNull(),
  method: recoveryMethodEnum("method").notNull(),
  
  // Amounts (usage depends on method)
  amount: numeric("amount", { precision: 12, scale: 2 }), // For base year stop, fixed amounts
  psfAmount: numeric("psf_amount", { precision: 8, scale: 4 }), // For expense stop
  
  // Adjustments
  adminFeePercent: numeric("admin_fee_percent", { precision: 5, scale: 2 }),
  grossUpToOccupancy: numeric("gross_up_to_occupancy", { precision: 5, scale: 2 }),
  nonrecoverablePercent: numeric("nonrecoverable_percent", { precision: 5, scale: 2 }),
  expenseGrowthRatePercent: numeric("expense_growth_rate_percent", { precision: 5, scale: 2 }),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  leaseIdIdx: index("tenant_recoveries_lease_id_idx").on(table.leaseId),
}));

/**
 * tenant_percentage_rent - Retail % rent configuration
 */
export const tenantPercentageRent = pgTable("tenant_percentage_rent", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => tenantLeases.id, { onDelete: "cascade" }),
  
  enabled: boolean("enabled").notNull().default(false),
  
  // Breakpoint
  breakpointType: breakpointTypeEnum("breakpoint_type").default("NATURAL"),
  breakpointAmountAnnual: numeric("breakpoint_amount_annual", { precision: 14, scale: 2 }),
  
  // Overage
  overagePercent: numeric("overage_percent", { precision: 6, scale: 4 }), // e.g., 0.06 for 6%
  settlementFrequency: settlementFrequencyEnum("settlement_frequency").default("MONTHLY"),
  
  // Exclusions (stored as JSON)
  exclusionsJson: jsonb("exclusions_json"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  leaseIdIdx: index("tenant_percentage_rent_lease_id_idx").on(table.leaseId),
}));

/**
 * tenant_sales - Monthly sales data for % rent
 */
export const tenantSales = pgTable("tenant_sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => tenantLeases.id, { onDelete: "cascade" }),
  
  periodEndDate: date("period_end_date").notNull(), // Month-end date
  grossSales: numeric("gross_sales", { precision: 14, scale: 2 }).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  leaseIdIdx: index("tenant_sales_lease_id_idx").on(table.leaseId),
}));

/**
 * tenant_concessions - Free rent, discounts, etc.
 */
export const tenantConcessions = pgTable("tenant_concessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => tenantLeases.id, { onDelete: "cascade" }),
  
  concessionType: concessionTypeEnum("concession_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(), // Amount or percentage
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  leaseIdIdx: index("tenant_concessions_lease_id_idx").on(table.leaseId),
}));

/**
 * tenant_capex_leasing - TI and LC configurations
 */
export const tenantCapexLeasing = pgTable("tenant_capex_leasing", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => tenantLeases.id, { onDelete: "cascade" }),
  
  // Tenant Improvements
  tiAllowancePsf: numeric("ti_allowance_psf", { precision: 8, scale: 2 }),
  tiTotal: numeric("ti_total", { precision: 12, scale: 2 }),
  tiPaymentTiming: tiPaymentTimingEnum("ti_payment_timing").default("UPFRONT"),
  
  // Leasing Commissions
  lcPercentInitial: numeric("lc_percent_initial", { precision: 6, scale: 4 }),
  lcPercentRenewal: numeric("lc_percent_renewal", { precision: 6, scale: 4 }),
  lcPaymentTiming: lcPaymentTimingEnum("lc_payment_timing").default("AT_SIGNING"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  leaseIdIdx: index("tenant_capex_leasing_lease_id_idx").on(table.leaseId),
}));

/**
 * tenant_rollover_assumptions - Renewal and vacancy modeling
 */
export const tenantRolloverAssumptions = pgTable("tenant_rollover_assumptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => tenantLeases.id, { onDelete: "cascade" }),
  
  assumeRenewal: boolean("assume_renewal").notNull().default(false),
  renewalProbability: numeric("renewal_probability", { precision: 5, scale: 4 }), // 0 to 1
  downtimeMonths: integer("downtime_months").default(0),
  
  // Market rent assumptions
  marketRentPsfYear: numeric("market_rent_psf_year", { precision: 10, scale: 2 }),
  marketRentGrowthPercent: numeric("market_rent_growth_percent", { precision: 5, scale: 2 }),
  
  // Renewal costs
  renewalTiPsf: numeric("renewal_ti_psf", { precision: 8, scale: 2 }),
  renewalLcPercent: numeric("renewal_lc_percent", { precision: 6, scale: 4 }),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  leaseIdIdx: index("tenant_rollover_assumptions_lease_id_idx").on(table.leaseId),
}));

// ============================================
// RELATIONS
// ============================================

export const tenantLeasesRelations = relations(tenantLeases, ({ many }) => ({
  rentTerms: many(tenantRentTerms),
  recoveries: many(tenantRecoveries),
  percentageRent: many(tenantPercentageRent),
  sales: many(tenantSales),
  concessions: many(tenantConcessions),
  capexLeasing: many(tenantCapexLeasing),
  rolloverAssumptions: many(tenantRolloverAssumptions),
}));

export const tenantRentTermsRelations = relations(tenantRentTerms, ({ one }) => ({
  lease: one(tenantLeases, {
    fields: [tenantRentTerms.leaseId],
    references: [tenantLeases.id],
  }),
}));

export const tenantRecoveriesRelations = relations(tenantRecoveries, ({ one }) => ({
  lease: one(tenantLeases, {
    fields: [tenantRecoveries.leaseId],
    references: [tenantLeases.id],
  }),
}));

export const tenantPercentageRentRelations = relations(tenantPercentageRent, ({ one }) => ({
  lease: one(tenantLeases, {
    fields: [tenantPercentageRent.leaseId],
    references: [tenantLeases.id],
  }),
}));

export const tenantSalesRelations = relations(tenantSales, ({ one }) => ({
  lease: one(tenantLeases, {
    fields: [tenantSales.leaseId],
    references: [tenantLeases.id],
  }),
}));

export const tenantConcessionsRelations = relations(tenantConcessions, ({ one }) => ({
  lease: one(tenantLeases, {
    fields: [tenantConcessions.leaseId],
    references: [tenantLeases.id],
  }),
}));

export const tenantCapexLeasingRelations = relations(tenantCapexLeasing, ({ one }) => ({
  lease: one(tenantLeases, {
    fields: [tenantCapexLeasing.leaseId],
    references: [tenantLeases.id],
  }),
}));

export const tenantRolloverAssumptionsRelations = relations(tenantRolloverAssumptions, ({ one }) => ({
  lease: one(tenantLeases, {
    fields: [tenantRolloverAssumptions.leaseId],
    references: [tenantLeases.id],
  }),
}));

// ============================================
// INSERT SCHEMAS (drizzle-zod derived)
// ============================================

export const insertTenantLeaseSchema = createInsertSchema(tenantLeases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantRentTermSchema = createInsertSchema(tenantRentTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantRecoverySchema = createInsertSchema(tenantRecoveries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantPercentageRentSchema = createInsertSchema(tenantPercentageRent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantSaleSchema = createInsertSchema(tenantSales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantConcessionSchema = createInsertSchema(tenantConcessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantCapexLeasingSchema = createInsertSchema(tenantCapexLeasing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantRolloverAssumptionsSchema = createInsertSchema(tenantRolloverAssumptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Inferred insert types
export type InsertTenantLease = z.infer<typeof insertTenantLeaseSchema>;
export type InsertTenantRentTerm = z.infer<typeof insertTenantRentTermSchema>;
export type InsertTenantRecovery = z.infer<typeof insertTenantRecoverySchema>;
export type InsertTenantPercentageRent = z.infer<typeof insertTenantPercentageRentSchema>;
export type InsertTenantSale = z.infer<typeof insertTenantSaleSchema>;
export type InsertTenantConcession = z.infer<typeof insertTenantConcessionSchema>;
export type InsertTenantCapexLeasing = z.infer<typeof insertTenantCapexLeasingSchema>;
export type InsertTenantRolloverAssumptions = z.infer<typeof insertTenantRolloverAssumptionsSchema>;

// Select types
export type TenantLease = typeof tenantLeases.$inferSelect;
export type TenantRentTerm = typeof tenantRentTerms.$inferSelect;
export type TenantRecovery = typeof tenantRecoveries.$inferSelect;
export type TenantPercentageRent = typeof tenantPercentageRent.$inferSelect;
export type TenantSale = typeof tenantSales.$inferSelect;
export type TenantConcession = typeof tenantConcessions.$inferSelect;
export type TenantCapexLeasing = typeof tenantCapexLeasing.$inferSelect;
export type TenantRolloverAssumptions = typeof tenantRolloverAssumptions.$inferSelect;

// ============================================
// EXPORT ALL
// ============================================

export default {
  // Enums
  leaseTypeEnum,
  leaseStatusEnum,
  securityDepositTypeEnum,
  termTypeEnum,
  rentInputUnitEnum,
  escalationTypeEnum,
  recoveryTypeEnum,
  recoveryMethodEnum,
  breakpointTypeEnum,
  settlementFrequencyEnum,
  concessionTypeEnum,
  tiPaymentTimingEnum,
  lcPaymentTimingEnum,
  // Tables
  tenantLeases,
  tenantRentTerms,
  tenantRecoveries,
  tenantPercentageRent,
  tenantSales,
  tenantConcessions,
  tenantCapexLeasing,
  tenantRolloverAssumptions,
};
