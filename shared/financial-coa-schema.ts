import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, numeric, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const finCoaCategories = pgTable("fin_coa_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  coaCode: varchar("coa_code", { length: 128 }).notNull(),
  displayName: varchar("display_name", { length: 256 }).notNull(),
  majorGroup: varchar("major_group", { length: 64 }).notNull(),
  subcategoryGroup: varchar("subcategory_group", { length: 128 }),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("fin_coa_categories_org_code_unique").on(table.orgId, table.coaCode),
  index("fin_coa_categories_org_major_group_idx").on(table.orgId, table.majorGroup),
  index("fin_coa_categories_org_sort_order_idx").on(table.orgId, table.sortOrder),
]);

export const insertFinCoaCategorySchema = createInsertSchema(finCoaCategories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinCoaCategory = z.infer<typeof insertFinCoaCategorySchema>;
export type FinCoaCategory = typeof finCoaCategories.$inferSelect;

export const finSegments = pgTable("fin_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  segmentCode: varchar("segment_code", { length: 128 }).notNull(),
  segmentName: varchar("segment_name", { length: 256 }).notNull(),
  segmentType: varchar("segment_type", { length: 64 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("fin_segments_org_code_unique").on(table.orgId, table.segmentCode),
  index("fin_segments_org_type_idx").on(table.orgId, table.segmentType),
  index("fin_segments_org_sort_order_idx").on(table.orgId, table.sortOrder),
]);

export const insertFinSegmentSchema = createInsertSchema(finSegments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinSegment = z.infer<typeof insertFinSegmentSchema>;
export type FinSegment = typeof finSegments.$inferSelect;

export const finCoaAliases = pgTable("fin_coa_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  coaId: varchar("coa_id").notNull().references(() => finCoaCategories.id),
  segmentId: varchar("segment_id").references(() => finSegments.id),
  aliasLabel: text("alias_label").notNull(),
  normalizedLabel: text("normalized_label").notNull(),
  createdFrom: varchar("created_from", { length: 64 }).notNull().default("seed"),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull().default("1.000"),
  timesMatched: integer("times_matched").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("fin_coa_aliases_org_normalized_idx").on(table.orgId, table.normalizedLabel),
  index("fin_coa_aliases_org_coa_idx").on(table.orgId, table.coaId),
]);

export const insertFinCoaAliasSchema = createInsertSchema(finCoaAliases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinCoaAlias = z.infer<typeof insertFinCoaAliasSchema>;
export type FinCoaAlias = typeof finCoaAliases.$inferSelect;

export const finRawLineItems = pgTable("fin_raw_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  projectId: varchar("project_id").notNull(),
  sourceFileId: varchar("source_file_id"),
  sourceType: varchar("source_type", { length: 64 }).notNull(),
  entityName: varchar("entity_name", { length: 256 }),
  department: varchar("department", { length: 256 }),
  textOriginal: text("text_original").notNull(),
  textNormalized: text("text_normalized").notNull(),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  sampleAmount: numeric("sample_amount", { precision: 18, scale: 4 }),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  latestSeenAt: timestamp("latest_seen_at").notNull().defaultNow(),
  timesSeen: integer("times_seen").notNull().default(1),
}, (table) => [
  index("fin_raw_line_items_org_project_idx").on(table.orgId, table.projectId),
  index("fin_raw_line_items_org_normalized_idx").on(table.orgId, table.textNormalized),
]);

export const insertFinRawLineItemSchema = createInsertSchema(finRawLineItems).omit({ id: true, firstSeenAt: true, latestSeenAt: true });
export type InsertFinRawLineItem = z.infer<typeof insertFinRawLineItemSchema>;
export type FinRawLineItem = typeof finRawLineItems.$inferSelect;

export const finPnlLines = pgTable("fin_pnl_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  projectId: varchar("project_id").notNull(),
  sourceFileId: varchar("source_file_id"),
  rawLineItemId: varchar("raw_line_item_id").references(() => finRawLineItems.id),
  coaId: varchar("coa_id").notNull().references(() => finCoaCategories.id),
  segmentId: varchar("segment_id").references(() => finSegments.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  classificationConfidence: numeric("classification_confidence", { precision: 4, scale: 3 }).notNull().default("1.000"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("fin_pnl_lines_org_project_period_idx").on(table.orgId, table.projectId, table.periodStart),
  index("fin_pnl_lines_org_coa_idx").on(table.orgId, table.coaId),
  index("fin_pnl_lines_org_segment_idx").on(table.orgId, table.segmentId),
]);

export const insertFinPnlLineSchema = createInsertSchema(finPnlLines).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinPnlLine = z.infer<typeof insertFinPnlLineSchema>;
export type FinPnlLine = typeof finPnlLines.$inferSelect;
