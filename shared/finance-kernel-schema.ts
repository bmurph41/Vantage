import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb, pgEnum, unique, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./schema";

export const fkEntityTypeEnum = pgEnum("fk_entity_type", ["portfolio", "marina", "deal", "other"]);
export const fkPeriodTypeEnum = pgEnum("fk_period_type", ["month", "quarter", "year"]);
export const fkAccountTypeEnum = pgEnum("fk_account_type", ["income", "cogs", "expense", "other_income", "other_expense", "asset", "liability", "equity"]);
export const fkNormalBalanceEnum = pgEnum("fk_normal_balance", ["debit", "credit"]);
export const fkSourceSystemEnum = pgEnum("fk_source_system", ["manual", "upload", "qbo", "intacct", "netsuite", "other"]);
export const fkPostedStatusEnum = pgEnum("fk_posted_status", ["draft", "review", "posted"]);
export const fkBatchStatusEnum = pgEnum("fk_batch_status", ["created", "review", "posted", "void"]);

export const fkEntities = pgTable("fk_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  type: fkEntityTypeEnum("type").notNull(),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
  externalRefJson: jsonb("external_ref_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fk_entities_org_id_idx").on(table.orgId),
  index("fk_entities_type_idx").on(table.type),
]);

export const fkPeriods = pgTable("fk_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  periodType: fkPeriodTypeEnum("period_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("fk_periods_unique").on(table.orgId, table.periodType, table.startDate, table.endDate),
]);

export const fkAccounts = pgTable("fk_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  code: text("code"),
  name: text("name").notNull(),
  accountType: fkAccountTypeEnum("account_type").notNull(),
  normalBalance: fkNormalBalanceEnum("normal_balance").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fk_accounts_org_id_idx").on(table.orgId),
  unique("fk_accounts_name_type_unique").on(table.orgId, table.name, table.accountType),
]);

export const fkDimensions = pgTable("fk_dimensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("fk_dimensions_key_unique").on(table.orgId, table.key),
]);

export const fkDimensionValues = pgTable("fk_dimension_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  dimensionId: varchar("dimension_id").notNull().references(() => fkDimensions.id),
  valueKey: text("value_key").notNull(),
  valueLabel: text("value_label").notNull(),
  entityId: varchar("entity_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fk_dimension_values_dimension_id_idx").on(table.dimensionId),
  unique("fk_dimension_values_unique").on(table.dimensionId, table.valueKey, table.entityId),
]);

export const fkPostingBatches = pgTable("fk_posting_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  sourceSystem: fkSourceSystemEnum("source_system").notNull(),
  status: fkBatchStatusEnum("status").notNull().default("created"),
  entityId: varchar("entity_id"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  statsJson: jsonb("stats_json"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("fk_posting_batches_org_id_idx").on(table.orgId),
  index("fk_posting_batches_status_idx").on(table.status),
]);

export const fkTransactions = pgTable("fk_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  batchId: varchar("batch_id").references(() => fkPostingBatches.id),
  entityId: varchar("entity_id").notNull(),
  sourceSystem: fkSourceSystemEnum("source_system").notNull(),
  sourceObjectType: text("source_object_type"),
  sourceObjectId: text("source_object_id"),
  txnDate: date("txn_date").notNull(),
  memo: text("memo"),
  currency: text("currency").notNull().default("USD"),
  postedStatus: fkPostedStatusEnum("posted_status").notNull().default("draft"),
  idempotencyKey: text("idempotency_key"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fk_transactions_org_id_idx").on(table.orgId),
  index("fk_transactions_entity_id_idx").on(table.entityId),
  index("fk_transactions_batch_id_idx").on(table.batchId),
  index("fk_transactions_txn_date_idx").on(table.txnDate),
  unique("fk_transactions_idempotency_unique").on(table.orgId, table.idempotencyKey),
]);

export const fkTransactionLines = pgTable("fk_transaction_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  transactionId: varchar("transaction_id").notNull().references(() => fkTransactions.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => fkAccounts.id),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  lineMemo: text("line_memo"),
  dimensionValueIds: jsonb("dimension_value_ids").$type<string[]>(),
  vendorName: text("vendor_name"),
  customerName: text("customer_name"),
  mappingExplanation: jsonb("mapping_explanation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fk_transaction_lines_transaction_id_idx").on(table.transactionId),
  index("fk_transaction_lines_account_id_idx").on(table.accountId),
]);

export const fkAccountAliases = pgTable("fk_account_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  sourceSystem: fkSourceSystemEnum("source_system").notNull(),
  sourceAccountId: text("source_account_id").notNull(),
  sourceAccountName: text("source_account_name"),
  targetAccountId: varchar("target_account_id").notNull().references(() => fkAccounts.id),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fk_account_aliases_org_id_idx").on(table.orgId),
  unique("fk_account_aliases_unique").on(table.orgId, table.sourceSystem, table.sourceAccountId, table.targetAccountId),
]);

export const fkAuditLog = pgTable("fk_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  requestId: text("request_id"),
  actorUserId: varchar("actor_user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fk_audit_log_org_id_idx").on(table.orgId),
  index("fk_audit_log_resource_type_idx").on(table.resourceType),
  index("fk_audit_log_created_at_idx").on(table.createdAt),
]);

export const insertFkEntitySchema = createInsertSchema(fkEntities).omit({ id: true, createdAt: true });
export const insertFkPeriodSchema = createInsertSchema(fkPeriods).omit({ id: true, createdAt: true });
export const insertFkAccountSchema = createInsertSchema(fkAccounts).omit({ id: true, createdAt: true });
export const insertFkDimensionSchema = createInsertSchema(fkDimensions).omit({ id: true, createdAt: true });
export const insertFkDimensionValueSchema = createInsertSchema(fkDimensionValues).omit({ id: true, createdAt: true });
export const insertFkPostingBatchSchema = createInsertSchema(fkPostingBatches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFkTransactionSchema = createInsertSchema(fkTransactions).omit({ id: true, createdAt: true });
export const insertFkTransactionLineSchema = createInsertSchema(fkTransactionLines).omit({ id: true, createdAt: true });
export const insertFkAccountAliasSchema = createInsertSchema(fkAccountAliases).omit({ id: true, createdAt: true });
export const insertFkAuditLogSchema = createInsertSchema(fkAuditLog).omit({ id: true, createdAt: true });

export type InsertFkEntity = z.infer<typeof insertFkEntitySchema>;
export type InsertFkPeriod = z.infer<typeof insertFkPeriodSchema>;
export type InsertFkAccount = z.infer<typeof insertFkAccountSchema>;
export type InsertFkDimension = z.infer<typeof insertFkDimensionSchema>;
export type InsertFkDimensionValue = z.infer<typeof insertFkDimensionValueSchema>;
export type InsertFkPostingBatch = z.infer<typeof insertFkPostingBatchSchema>;
export type InsertFkTransaction = z.infer<typeof insertFkTransactionSchema>;
export type InsertFkTransactionLine = z.infer<typeof insertFkTransactionLineSchema>;
export type InsertFkAccountAlias = z.infer<typeof insertFkAccountAliasSchema>;
export type InsertFkAuditLog = z.infer<typeof insertFkAuditLogSchema>;

export type FkEntity = typeof fkEntities.$inferSelect;
export type FkPeriod = typeof fkPeriods.$inferSelect;
export type FkAccount = typeof fkAccounts.$inferSelect;
export type FkDimension = typeof fkDimensions.$inferSelect;
export type FkDimensionValue = typeof fkDimensionValues.$inferSelect;
export type FkPostingBatch = typeof fkPostingBatches.$inferSelect;
export type FkTransaction = typeof fkTransactions.$inferSelect;
export type FkTransactionLine = typeof fkTransactionLines.$inferSelect;
export type FkAccountAlias = typeof fkAccountAliases.$inferSelect;
export type FkAuditLog = typeof fkAuditLog.$inferSelect;
