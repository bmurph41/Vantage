import { pgTable, varchar, text, timestamp, integer, numeric, boolean, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql, relations } from "drizzle-orm";
import { organizations } from "./schema";

export const pnlJobStatusEnum = ['queued', 'processing', 'parsed', 'mapped', 'stored', 'completed', 'failed'] as const;
export type PnlJobStatus = typeof pnlJobStatusEnum[number];

export const pnlMappingMethodEnum = ['alias', 'regex', 'ai', 'manual', 'rule', 'none'] as const;
export type PnlMappingMethod = typeof pnlMappingMethodEnum[number];

export const pnlPeriodTypeEnum = ['month', 'quarter', 'year'] as const;
export type PnlPeriodType = typeof pnlPeriodTypeEnum[number];

export const pnlCoaSectionEnum = ['revenue', 'cogs', 'expense', 'other', 'payroll'] as const;
export type PnlCoaSection = typeof pnlCoaSectionEnum[number];

export const pnlDocuments = pgTable('pnl_documents', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull(),
  assetId: varchar('asset_id'),
  modelingProjectId: varchar('modeling_project_id'),
  uploadedByUserId: varchar('uploaded_by_user_id'),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  sha256: text('sha256').notNull(),
  storagePath: text('storage_path').notNull(),
  statementType: text('statement_type').notNull().default('pnl'),
  yearHint: integer('year_hint'),
  meta: jsonb('meta').notNull().default({}),
  fileData: text('file_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgShaUnique: unique('pnl_documents_org_sha_unique').on(table.orgId, table.sha256),
  assetIdx: index('pnl_documents_asset_idx').on(table.assetId),
  projectIdx: index('pnl_documents_project_idx').on(table.modelingProjectId),
}));

export const pnlJobs = pgTable('pnl_jobs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull(),
  assetId: varchar('asset_id'),
  documentId: varchar('document_id').notNull().references(() => pnlDocuments.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'),
  stage: text('stage').notNull().default('ingest'),
  retryCount: integer('retry_count').notNull().default(0),
  lastError: jsonb('last_error').notNull().default({}),
  parserVersion: text('parser_version').notNull().default('v1'),
  mapperVersion: text('mapper_version').notNull().default('v1'),
  fileData: text('file_data'),
  parseMetricsJson: jsonb('parse_metrics_json'),
  validationJson: jsonb('validation_json'),
  validationStatus: text('validation_status'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  documentIdx: index('pnl_jobs_document_idx').on(table.documentId),
  statusIdx: index('pnl_jobs_status_idx').on(table.status),
  orgIdx: index('pnl_jobs_org_idx').on(table.orgId),
}));

export const pnlParsedStatements = pgTable('pnl_parsed_statements', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull(),
  documentId: varchar('document_id').notNull().references(() => pnlDocuments.id, { onDelete: 'cascade' }),
  jobId: varchar('job_id').notNull().references(() => pnlJobs.id, { onDelete: 'cascade' }),
  parsedJson: jsonb('parsed_json').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull().default('0'),
  fileData: text('file_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  documentUnique: unique('pnl_parsed_statements_doc_unique').on(table.documentId),
  jobIdx: index('pnl_parsed_statements_job_idx').on(table.jobId),
}));

export const pnlCanonicalLineItems = pgTable('pnl_canonical_line_items', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull(),
  canonicalKey: text('canonical_key').notNull(),
  displayName: text('display_name').notNull(),
  department: text('department').notNull(),
  section: text('section').notNull(),
  parentId: varchar('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  fileData: text('file_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgKeyUnique: unique('pnl_canonical_line_items_org_key_unique').on(table.orgId, table.canonicalKey),
  sectionIdx: index('pnl_canonical_section_idx').on(table.section),
}));

export const pnlLineItemAliases = pgTable('pnl_line_item_aliases', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull(),
  aliasText: text('alias_text').notNull(),
  aliasRegex: text('alias_regex'),
  vendorHint: text('vendor_hint'),
  canonicalLineItemId: varchar('canonical_line_item_id').notNull().references(() => pnlCanonicalLineItems.id, { onDelete: 'cascade' }),
  weight: integer('weight').notNull().default(10),
  fileData: text('file_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  aliasOrgIdx: index('pnl_alias_org_alias_idx').on(table.orgId, table.aliasText),
  canonicalIdx: index('pnl_alias_canonical_idx').on(table.canonicalLineItemId),
}));

export const pnlFacts = pgTable('pnl_facts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull(),
  assetId: varchar('asset_id'),
  documentId: varchar('document_id').notNull().references(() => pnlDocuments.id, { onDelete: 'cascade' }),
  canonicalLineItemId: varchar('canonical_line_item_id').notNull().references(() => pnlCanonicalLineItems.id, { onDelete: 'restrict' }),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  periodType: text('period_type').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalPeriod: integer('fiscal_period').notNull(),
  value: numeric('value', { precision: 18, scale: 2 }).notNull(),
  sourceLabel: text('source_label').notNull(),
  sourceTrace: jsonb('source_trace').notNull().default({}),
  extractionConfidence: numeric('extraction_confidence', { precision: 5, scale: 4 }).notNull().default('0'),
  mappingConfidence: numeric('mapping_confidence', { precision: 5, scale: 4 }).notNull().default('0'),
  mappingMethod: text('mapping_method').notNull().default('rule'),
  fileData: text('file_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  docLinePeriodUnique: unique('pnl_facts_doc_line_period_unique').on(
    table.documentId,
    table.canonicalLineItemId,
    table.periodStart,
    table.periodEnd
  ),
  orgAssetIdx: index('pnl_facts_org_asset_idx').on(table.orgId, table.assetId),
  fiscalYearIdx: index('pnl_facts_fiscal_year_idx').on(table.fiscalYear),
}));

export const pnlReviewItems = pgTable('pnl_review_items', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull(),
  jobId: varchar('job_id').notNull().references(() => pnlJobs.id, { onDelete: 'cascade' }),
  documentId: varchar('document_id').notNull().references(() => pnlDocuments.id, { onDelete: 'cascade' }),
  extractedLabel: text('extracted_label').notNull(),
  normalizedLabel: text('normalized_label').notNull(),
  suggestedCanonicalLineItemId: varchar('suggested_canonical_line_item_id').references(() => pnlCanonicalLineItems.id, { onDelete: 'set null' }),
  suggestionJson: jsonb('suggestion_json').notNull().default({}),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull().default('0'),
  status: text('status').notNull().default('needs_review'),
  resolvedBy: varchar('resolved_by'),
  fileData: text('file_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobIdx: index('pnl_review_items_job_idx').on(table.jobId),
  statusIdx: index('pnl_review_items_status_idx').on(table.status),
}));

export const pnlDocumentsRelations = relations(pnlDocuments, ({ many }) => ({
  jobs: many(pnlJobs),
  parsedStatements: many(pnlParsedStatements),
  facts: many(pnlFacts),
  reviewItems: many(pnlReviewItems),
}));

export const pnlJobsRelations = relations(pnlJobs, ({ one, many }) => ({
  document: one(pnlDocuments, {
    fields: [pnlJobs.documentId],
    references: [pnlDocuments.id],
  }),
  parsedStatement: one(pnlParsedStatements),
  reviewItems: many(pnlReviewItems),
}));

export const pnlParsedStatementsRelations = relations(pnlParsedStatements, ({ one }) => ({
  document: one(pnlDocuments, {
    fields: [pnlParsedStatements.documentId],
    references: [pnlDocuments.id],
  }),
  job: one(pnlJobs, {
    fields: [pnlParsedStatements.jobId],
    references: [pnlJobs.id],
  }),
}));

export const pnlCanonicalLineItemsRelations = relations(pnlCanonicalLineItems, ({ many, one }) => ({
  aliases: many(pnlLineItemAliases),
  facts: many(pnlFacts),
  parent: one(pnlCanonicalLineItems, {
    fields: [pnlCanonicalLineItems.parentId],
    references: [pnlCanonicalLineItems.id],
  }),
}));

export const pnlLineItemAliasesRelations = relations(pnlLineItemAliases, ({ one }) => ({
  canonicalLineItem: one(pnlCanonicalLineItems, {
    fields: [pnlLineItemAliases.canonicalLineItemId],
    references: [pnlCanonicalLineItems.id],
  }),
}));

export const pnlFactsRelations = relations(pnlFacts, ({ one }) => ({
  document: one(pnlDocuments, {
    fields: [pnlFacts.documentId],
    references: [pnlDocuments.id],
  }),
  canonicalLineItem: one(pnlCanonicalLineItems, {
    fields: [pnlFacts.canonicalLineItemId],
    references: [pnlCanonicalLineItems.id],
  }),
}));

export const pnlReviewItemsRelations = relations(pnlReviewItems, ({ one }) => ({
  job: one(pnlJobs, {
    fields: [pnlReviewItems.jobId],
    references: [pnlJobs.id],
  }),
  document: one(pnlDocuments, {
    fields: [pnlReviewItems.documentId],
    references: [pnlDocuments.id],
  }),
  suggestedCanonicalLineItem: one(pnlCanonicalLineItems, {
    fields: [pnlReviewItems.suggestedCanonicalLineItemId],
    references: [pnlCanonicalLineItems.id],
  }),
}));

export const pnlKeywordMatchTypeEnum = ['exact', 'phrase', 'token', 'regex'] as const;
export type PnlKeywordMatchType = typeof pnlKeywordMatchTypeEnum[number];

export const pnlDepartmentEnum = ['Storage', 'Fuel', 'Marina & Amenities', "Ship's Store", 'Service', 'Boat Sales', 'Boat Brokerage', 'General', 'Payroll'] as const;
export type PnlDepartment = typeof pnlDepartmentEnum[number];

export const pnlBucketEnum = ['Revenue', 'COGS', 'Expense'] as const;
export type PnlBucket = typeof pnlBucketEnum[number];

export const pnlKeywordRules = pgTable('pnl_keyword_rules', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id'),
  department: text('department').notNull(),
  bucket: text('bucket').notNull(),
  keyword: text('keyword').notNull(),
  matchType: text('match_type').notNull().default('phrase'),
  priority: integer('priority').notNull().default(100),
  canonicalLineItemId: varchar('canonical_line_item_id').references(() => pnlCanonicalLineItems.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  source: text('source').notNull().default('seed'),
  timesMatched: integer('times_matched').notNull().default(0),
  fileData: text('file_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgKeywordIdx: index('pnl_keyword_rules_org_keyword_idx').on(table.orgId, table.keyword),
  deptBucketIdx: index('pnl_keyword_rules_dept_bucket_idx').on(table.department, table.bucket),
  priorityIdx: index('pnl_keyword_rules_priority_idx').on(table.priority),
}));

export const pnlKeywordRulesRelations = relations(pnlKeywordRules, ({ one }) => ({
  canonicalLineItem: one(pnlCanonicalLineItems, {
    fields: [pnlKeywordRules.canonicalLineItemId],
    references: [pnlCanonicalLineItems.id],
  }),
}));

export const pnlDepartmentVerificationStatusEnum = ['pending', 'verified', 'skipped'] as const;
export type PnlDepartmentVerificationStatus = typeof pnlDepartmentVerificationStatusEnum[number];

export const pnlDepartmentVerifications = pgTable('pnl_department_verifications', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull(),
  jobId: varchar('job_id').notNull().references(() => pnlJobs.id, { onDelete: 'cascade' }),
  documentId: varchar('document_id').notNull().references(() => pnlDocuments.id, { onDelete: 'cascade' }),
  extractedLabel: text('extracted_label').notNull(),
  normalizedLabel: text('normalized_label').notNull(),
  ambiguousKeyword: text('ambiguous_keyword').notNull(),
  possibleDepartments: jsonb('possible_departments').notNull().$type<AmbiguousDepartmentOption[]>(),
  ambiguityReason: text('ambiguity_reason').notNull(),
  selectedDepartment: text('selected_department'),
  selectedBucket: text('selected_bucket'),
  status: text('status').notNull().default('pending'),
  resolvedByUserId: varchar('resolved_by_user_id'),
  saveToKeywordBank: boolean('save_to_keyword_bank').notNull().default(false),
  keywordRuleId: varchar('keyword_rule_id').references(() => pnlKeywordRules.id, { onDelete: 'set null' }),
  fileData: text('file_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => ({
  jobIdx: index('pnl_dept_verifications_job_idx').on(table.jobId),
  statusIdx: index('pnl_dept_verifications_status_idx').on(table.status),
  orgIdx: index('pnl_dept_verifications_org_idx').on(table.orgId),
  normalizedLabelIdx: index('pnl_dept_verifications_normalized_idx').on(table.normalizedLabel),
}));

export interface AmbiguousDepartmentOption {
  department: string;
  bucket: string;
  description: string;
}

export const pnlDepartmentVerificationsRelations = relations(pnlDepartmentVerifications, ({ one }) => ({
  job: one(pnlJobs, {
    fields: [pnlDepartmentVerifications.jobId],
    references: [pnlJobs.id],
  }),
  document: one(pnlDocuments, {
    fields: [pnlDepartmentVerifications.documentId],
    references: [pnlDocuments.id],
  }),
  keywordRule: one(pnlKeywordRules, {
    fields: [pnlDepartmentVerifications.keywordRuleId],
    references: [pnlKeywordRules.id],
  }),
}));

export const insertPnlDepartmentVerificationSchema = createInsertSchema(pnlDepartmentVerifications).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});
export type PnlDepartmentVerification = typeof pnlDepartmentVerifications.$inferSelect;
export type InsertPnlDepartmentVerification = z.infer<typeof insertPnlDepartmentVerificationSchema>;

export const insertPnlDocumentSchema = createInsertSchema(pnlDocuments).omit({
  id: true,
  createdAt: true,
});
export type PnlDocument = typeof pnlDocuments.$inferSelect;
export type InsertPnlDocument = z.infer<typeof insertPnlDocumentSchema>;

export const insertPnlJobSchema = createInsertSchema(pnlJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PnlJob = typeof pnlJobs.$inferSelect;
export type InsertPnlJob = z.infer<typeof insertPnlJobSchema>;

export const insertPnlParsedStatementSchema = createInsertSchema(pnlParsedStatements).omit({
  id: true,
  createdAt: true,
});
export type PnlParsedStatement = typeof pnlParsedStatements.$inferSelect;
export type InsertPnlParsedStatement = z.infer<typeof insertPnlParsedStatementSchema>;

export const insertPnlCanonicalLineItemSchema = createInsertSchema(pnlCanonicalLineItems).omit({
  id: true,
  createdAt: true,
});
export type PnlCanonicalLineItem = typeof pnlCanonicalLineItems.$inferSelect;
export type InsertPnlCanonicalLineItem = z.infer<typeof insertPnlCanonicalLineItemSchema>;

export const insertPnlLineItemAliasSchema = createInsertSchema(pnlLineItemAliases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PnlLineItemAlias = typeof pnlLineItemAliases.$inferSelect;
export type InsertPnlLineItemAlias = z.infer<typeof insertPnlLineItemAliasSchema>;

export const insertPnlFactSchema = createInsertSchema(pnlFacts).omit({
  id: true,
  createdAt: true,
});
export type PnlFact = typeof pnlFacts.$inferSelect;
export type InsertPnlFact = z.infer<typeof insertPnlFactSchema>;

export const insertPnlReviewItemSchema = createInsertSchema(pnlReviewItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PnlReviewItem = typeof pnlReviewItems.$inferSelect;
export type InsertPnlReviewItem = z.infer<typeof insertPnlReviewItemSchema>;

export const insertPnlKeywordRuleSchema = createInsertSchema(pnlKeywordRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PnlKeywordRule = typeof pnlKeywordRules.$inferSelect;
export type InsertPnlKeywordRule = z.infer<typeof insertPnlKeywordRuleSchema>;

export interface ParsedPeriod {
  label: string;
  start: string;
  end: string;
  type: PnlPeriodType;
  year: number;
  periodNo: number;
}

export interface ParsedRowValue {
  periodIndex: number;
  value: number | null;
  trace: {
    page?: number;
    row?: number;
    col?: number;
    raw?: string;
  };
}

export interface ParsedRow {
  label: string;
  normalizedLabel: string;
  values: ParsedRowValue[];
  sectionHint?: 'revenue' | 'cogs' | 'expense' | 'payroll' | null;
  trace?: {
    page?: number;
    row?: number;
  };
  mapping?: {
    canonicalLineItemId: string | null;
    mappingMethod: PnlMappingMethod;
    mappingConfidence: number;
    normalizedLabel: string;
    resolvedDepartment?: string | null;
    resolvedBucket?: string | null;
    resolvedByKeywordBank?: boolean;
  };
}

export interface ParsedStatementPayload {
  jobId: string;
  documentId: string;
  parserVersion: string;
  confidence: number;
  vendorHint?: string | null;
  periods: ParsedPeriod[];
  rows: ParsedRow[];
}
