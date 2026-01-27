// =============================================================================
// P&L CANONICAL MAPPING TABLES
// =============================================================================

// Major groups for P&L line items
export const pnlMajorGroupEnum = pgEnum('pnl_major_group', [
  'Revenue',
  'COGS', 
  'OpEx',
  'Payroll',
  'Other'
]);

// Segment types for business unit classification
export const pnlSegmentTypeEnum = pgEnum('pnl_segment_type', [
  'CORE',
  'ANCILLARY',
  'NON-OPERATING'
]);

// Canonical Line Items (COA Master) - the "gold standard" categories
export const pnlCanonicalLineItems = pgTable('pnl_canonical_line_items', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  coaCode: varchar('coa_code', { length: 100 }).notNull().unique(),
  displayName: text('display_name').notNull(),
  majorGroup: pnlMajorGroupEnum('major_group').notNull(),
  subcategoryGroup: text('subcategory_group').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  isSystemDefault: boolean('is_system_default').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  coaCodeIdx: index('pnl_canonical_coa_code_idx').on(table.coaCode),
  majorGroupIdx: index('pnl_canonical_major_group_idx').on(table.majorGroup),
  subcategoryIdx: index('pnl_canonical_subcategory_idx').on(table.subcategoryGroup),
}));

// Segments (Business Units)
export const pnlSegments = pgTable('pnl_segments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  segmentCode: varchar('segment_code', { length: 100 }).notNull().unique(),
  segmentName: text('segment_name').notNull(),
  segmentType: pnlSegmentTypeEnum('segment_type').notNull(),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  segmentCodeIdx: index('pnl_segments_code_idx').on(table.segmentCode),
  segmentTypeIdx: index('pnl_segments_type_idx').on(table.segmentType),
}));

// Line Item Aliases - maps raw labels to canonical codes
export const pnlLineItemAliases = pgTable('pnl_line_item_aliases', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').references(() => organizations.id),
  rawLabel: text('raw_label').notNull(),
  normalizedLabel: text('normalized_label').notNull(),
  canonicalCoaCode: varchar('canonical_coa_code', { length: 100 }).notNull(),
  segmentCode: varchar('segment_code', { length: 100 }),
  confidence: decimal('confidence', { precision: 5, scale: 4 }).default('1.0'),
  source: text('source').default('seed'),
  notes: text('notes'),
  timesUsed: integer('times_used').default(0),
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('pnl_aliases_org_idx').on(table.orgId),
  normalizedIdx: index('pnl_aliases_normalized_idx').on(table.normalizedLabel),
  coaCodeIdx: index('pnl_aliases_coa_code_idx').on(table.canonicalCoaCode),
}));

// Keyword Rules - for pattern-based matching
export const pnlKeywordRules = pgTable('pnl_keyword_rules', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').references(() => organizations.id),
  keywords: text('keywords').array().notNull(),
  matchType: text('match_type').default('contains'),
  canonicalCoaCode: varchar('canonical_coa_code', { length: 100 }).notNull(),
  segmentCode: varchar('segment_code', { length: 100 }),
  priority: integer('priority').default(100),
  confidence: decimal('confidence', { precision: 5, scale: 4 }).default('0.8'),
  timesMatched: integer('times_matched').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('pnl_keyword_rules_org_idx').on(table.orgId),
  coaCodeIdx: index('pnl_keyword_rules_coa_idx').on(table.canonicalCoaCode),
  priorityIdx: index('pnl_keyword_rules_priority_idx').on(table.priority),
}));

// Type exports
export type PnlCanonicalLineItem = typeof pnlCanonicalLineItems.$inferSelect;
export type InsertPnlCanonicalLineItem = typeof pnlCanonicalLineItems.$inferInsert;
export type PnlSegment = typeof pnlSegments.$inferSelect;
export type InsertPnlSegment = typeof pnlSegments.$inferInsert;
export type PnlLineItemAlias = typeof pnlLineItemAliases.$inferSelect;
export type InsertPnlLineItemAlias = typeof pnlLineItemAliases.$inferInsert;
export type PnlKeywordRule = typeof pnlKeywordRules.$inferSelect;
export type InsertPnlKeywordRule = typeof pnlKeywordRules.$inferInsert;

