/**
 * Document Builder Schema Extensions
 * New tables and enums for the multi-document builder system
 */

import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { crmDeals } from '../schema';

// =============================================================================
// Enums
// =============================================================================

export const documentTypeEnum = pgEnum('document_type', [
  'offering_memorandum',
  'executive_summary',
  'pitch_deck',
  'ic_memo',
  'teaser',
  'lender_package',
  'due_diligence_summary',
  'custom'
]);

export const documentStatusEnum = pgEnum('document_status', [
  'draft',
  'in_progress',
  'review',
  'approved',
  'generating',
  'completed',
  'failed'
]);

export const audiencePersonaEnum = pgEnum('audience_persona', [
  'institutional_investor',
  'private_equity',
  'family_office',
  'lender',
  'investment_committee',
  'board_of_directors',
  'potential_buyer',
  'broker'
]);

export const assetClassEnum = pgEnum('asset_class', [
  'marina',
  'rv_park',
  'mobile_home_park',
  'self_storage',
  'multifamily',
  'mixed_use',
  'other'
]);

export const exportFormatEnum = pgEnum('export_format', [
  'pdf',
  'pptx',
  'docx'
]);

export const exportStatusEnum = pgEnum('export_status', [
  'queued',
  'processing',
  'completed',
  'failed'
]);

export const dataSourceEnum = pgEnum('data_source', [
  'deal',
  'property',
  'valuator',
  'sales_comps',
  'rate_comps',
  'rent_roll',
  'demographics',
  'due_diligence',
  'modeling',
  'manual'
]);

// =============================================================================
// Section Library Table
// =============================================================================

export const omSectionLibrary = pgTable('om_section_library', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()::text`),
  sectionKey: varchar('section_key', { length: 100 }).notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(),
  supportedDocTypes: jsonb('supported_doc_types').$type<string[]>().notNull().default([]),
  requiredDataBindings: jsonb('required_data_bindings').notNull().default([]),
  optionalDataBindings: jsonb('optional_data_bindings').notNull().default([]),
  requiredMedia: jsonb('required_media').notNull().default([]),
  optionalMedia: jsonb('optional_media').notNull().default([]),
  schema: jsonb('schema').notNull(),
  defaultLayouts: jsonb('default_layouts').notNull().default([]),
  aiPromptTemplates: jsonb('ai_prompt_templates').notNull().default([]),
  completionRules: jsonb('completion_rules').notNull().default([]),
  estimatedPages: integer('estimated_pages').notNull().default(1),
  marinaSpecific: boolean('marina_specific').notNull().default(false),
  isSystemDefault: boolean('is_system_default').notNull().default(true),
  organizationId: varchar('organization_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sectionKeyIdx: index('om_section_library_key_idx').on(table.sectionKey),
  categoryIdx: index('om_section_library_category_idx').on(table.category),
  orgIdx: index('om_section_library_org_idx').on(table.organizationId),
}));

// =============================================================================
// Document Builder Documents Table
// =============================================================================

export const omBuilderDocuments = pgTable('om_builder_documents', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()::text`),
  dealId: varchar('deal_id').notNull().references(() => crmDeals.id, { onDelete: 'cascade' }),
  documentType: documentTypeEnum('document_type').notNull(),
  title: text('title').notNull(),
  audience: audiencePersonaEnum('audience'),
  assetClass: assetClassEnum('asset_class'),
  themeId: varchar('theme_id'),
  templateId: varchar('template_id'),
  brandKitId: varchar('brand_kit_id'),
  status: documentStatusEnum('status').notNull().default('draft'),
  
  // Document configuration
  config: jsonb('config').$type<{
    sections: string[];
    settings: Record<string, any>;
  }>().notNull().default({ sections: [], settings: {} }),
  
  // Metadata
  metadata: jsonb('metadata').$type<{
    propertyName?: string;
    propertyAddress?: string;
    preparedBy?: string;
    preparedFor?: string;
    confidentialityLevel?: string;
    generatedAt?: string;
    version?: number;
    exemplarIds?: string[];
  }>().default({}),
  
  // Working state
  workingSnapshot: jsonb('working_snapshot'),
  
  // Completion tracking
  completionStatus: jsonb('completion_status').$type<{
    totalSections: number;
    completedSections: number;
    percentage: number;
    readyToExport: boolean;
  }>().default({ totalSections: 0, completedSections: 0, percentage: 0, readyToExport: false }),
  
  // Audit fields
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  dealIdx: index('om_builder_documents_deal_idx').on(table.dealId),
  typeIdx: index('om_builder_documents_type_idx').on(table.documentType),
  statusIdx: index('om_builder_documents_status_idx').on(table.status),
  createdByIdx: index('om_builder_documents_created_by_idx').on(table.createdBy),
}));

// =============================================================================
// Document Sections Table
// =============================================================================

export const omDocumentSections = pgTable('om_document_sections', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()::text`),
  documentId: varchar('document_id').notNull().references(() => omBuilderDocuments.id, { onDelete: 'cascade' }),
  sectionKey: varchar('section_key', { length: 100 }).notNull(),
  order: integer('order').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
  customTitle: text('custom_title'),
  
  // Data bindings
  dataBindings: jsonb('data_bindings').$type<Array<{
    bindingKey: string;
    source: string;
    field: string;
    value: any;
    locked: boolean;
    overridden: boolean;
    originalValue?: any;
  }>>().notNull().default([]),
  
  // Media assignments
  media: jsonb('media').$type<Array<{
    mediaKey: string;
    assetId: string;
    url: string;
    caption?: string;
    altText?: string;
    isCover?: boolean;
  }>>().notNull().default([]),
  
  // Content
  content: jsonb('content').$type<{
    narrative?: string;
    bullets?: string[];
    tables?: any[];
    charts?: any[];
    customFields?: Record<string, any>;
  }>().notNull().default({}),
  
  // Generation tracking
  aiGenerated: boolean('ai_generated').notNull().default(false),
  lastAiGeneratedAt: timestamp('last_ai_generated_at'),
  
  // Completion status
  completionStatus: jsonb('completion_status').$type<{
    isComplete: boolean;
    completedFields: string[];
    missingFields: string[];
    missingMedia: string[];
    warnings: string[];
    percentage: number;
  }>().default({
    isComplete: false,
    completedFields: [],
    missingFields: [],
    missingMedia: [],
    warnings: [],
    percentage: 0
  }),
  
  // Page references
  pageIds: jsonb('page_ids').$type<string[]>().default([]),
  
  // Rendered output cache
  renderedContent: text('rendered_content'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  documentIdx: index('om_document_sections_document_idx').on(table.documentId),
  orderIdx: index('om_document_sections_order_idx').on(table.documentId, table.order),
  sectionKeyIdx: index('om_document_sections_key_idx').on(table.sectionKey),
}));

// =============================================================================
// Exemplars Table
// =============================================================================

export const omExemplars = pgTable('om_exemplars', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()::text`),
  name: text('name').notNull(),
  description: text('description'),
  documentType: documentTypeEnum('document_type').notNull(),
  assetClass: assetClassEnum('asset_class'),
  
  // Uploaded file
  uploadedFileUrl: text('uploaded_file_url').notNull(),
  uploadedFileName: text('uploaded_file_name').notNull(),
  fileSizeBytes: integer('file_size_bytes'),
  
  // Extracted data (RAG-style)
  extractedStructure: jsonb('extracted_structure').$type<{
    sections: Array<{
      title: string;
      pageNumbers: number[];
      contentTypes: string[];
      estimatedWordCount: number;
    }>;
    pageCount: number;
    hasTableOfContents: boolean;
    hasAppendix: boolean;
  }>(),
  
  extractedStyles: jsonb('extracted_styles').$type<{
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
    };
    typography: {
      headingFont?: string;
      bodyFont?: string;
      headingSizes: number[];
    };
    layout: {
      margins: { top: number; right: number; bottom: number; left: number };
      hasHeaderFooter: boolean;
      hasPageNumbers: boolean;
    };
  }>(),
  
  // Embeddings for RAG (optional - for future use)
  embeddings: jsonb('embeddings'),
  
  // Ownership
  organizationId: varchar('organization_id'),
  userId: varchar('user_id').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  docTypeIdx: index('om_exemplars_doc_type_idx').on(table.documentType),
  orgIdx: index('om_exemplars_org_idx').on(table.organizationId),
  userIdx: index('om_exemplars_user_idx').on(table.userId),
  publicIdx: index('om_exemplars_public_idx').on(table.isPublic),
}));

// =============================================================================
// Export Jobs Table
// =============================================================================

export const omExportJobs = pgTable('om_export_jobs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()::text`),
  documentId: varchar('document_id').notNull().references(() => omBuilderDocuments.id, { onDelete: 'cascade' }),
  format: exportFormatEnum('format').notNull(),
  status: exportStatusEnum('status').notNull().default('queued'),
  
  // Output
  outputUrl: text('output_url'),
  outputFileName: text('output_file_name'),
  fileSizeBytes: integer('file_size_bytes'),
  
  // Error tracking
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  
  // Options
  options: jsonb('options').$type<{
    includeAppendix?: boolean;
    includeTableOfContents?: boolean;
    watermark?: string;
    confidentialFooter?: boolean;
    companyLogo?: string;
    pageSize?: string;
    orientation?: string;
    quality?: string;
  }>().default({}),
  
  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  documentIdx: index('om_export_jobs_document_idx').on(table.documentId),
  statusIdx: index('om_export_jobs_status_idx').on(table.status),
}));

// =============================================================================
// Data Binding Cache Table (for resolved bindings)
// =============================================================================

export const omBindingCache = pgTable('om_binding_cache', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()::text`),
  documentId: varchar('document_id').notNull().references(() => omBuilderDocuments.id, { onDelete: 'cascade' }),
  bindingKey: varchar('binding_key', { length: 100 }).notNull(),
  source: dataSourceEnum('source').notNull(),
  field: varchar('field', { length: 200 }).notNull(),
  resolvedValue: jsonb('resolved_value'),
  resolvedAt: timestamp('resolved_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  documentIdx: index('om_binding_cache_document_idx').on(table.documentId),
  bindingKeyIdx: index('om_binding_cache_binding_idx').on(table.documentId, table.bindingKey),
}));

// =============================================================================
// Document Version History Table
// =============================================================================

export const omDocumentVersions = pgTable('om_document_versions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()::text`),
  documentId: varchar('document_id').notNull().references(() => omBuilderDocuments.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  title: text('title').notNull(),
  snapshot: jsonb('snapshot').notNull(), // full document + sections snapshot
  changeDescription: text('change_description'),
  status: documentStatusEnum('status').notNull().default('draft'),
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  omId: varchar('om_id'),
  snapshotJson: jsonb('snapshot_json'),
  thumbnailUrl: text('thumbnail_url'),
  changeSummary: text('change_summary'),
}, (table) => ({
  documentIdx: index('om_doc_versions_document_idx').on(table.documentId),
  versionIdx: index('om_doc_versions_version_idx').on(table.documentId, table.versionNumber),
}));
export type OmDocumentVersion = typeof omDocumentVersions.$inferSelect;

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

export const insertOmBuilderDocumentSchema = createInsertSchema(omBuilderDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmBuilderDocumentSchema = insertOmBuilderDocumentSchema.partial();
export type InsertOmBuilderDocument = z.infer<typeof insertOmBuilderDocumentSchema>;
export type OmBuilderDocument = typeof omBuilderDocuments.$inferSelect;

export const insertOmDocumentSectionSchema = createInsertSchema(omDocumentSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmDocumentSectionSchema = insertOmDocumentSectionSchema.partial();
export type InsertOmDocumentSection = z.infer<typeof insertOmDocumentSectionSchema>;
export type OmDocumentSection = typeof omDocumentSections.$inferSelect;

export const insertOmExemplarSchema = createInsertSchema(omExemplars).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmExemplarSchema = insertOmExemplarSchema.partial();
export type InsertOmExemplar = z.infer<typeof insertOmExemplarSchema>;
export type OmExemplar = typeof omExemplars.$inferSelect;

export const insertOmExportJobSchema = createInsertSchema(omExportJobs).omit({
  id: true,
  createdAt: true,
});
export type InsertOmExportJob = z.infer<typeof insertOmExportJobSchema>;
export type OmExportJob = typeof omExportJobs.$inferSelect;

// =============================================================================
// SQL Migration (for reference)
// =============================================================================

export const MIGRATION_SQL = `
-- Document Builder Schema Extensions Migration
-- Run this after existing OM Builder tables are created

-- Create enums
DO $$ BEGIN
  CREATE TYPE document_type AS ENUM (
    'offering_memorandum', 'executive_summary', 'pitch_deck', 'ic_memo',
    'teaser', 'lender_package', 'due_diligence_summary', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'draft', 'in_progress', 'review', 'approved', 'generating', 'completed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE audience_persona AS ENUM (
    'institutional_investor', 'private_equity', 'family_office', 'lender',
    'investment_committee', 'board_of_directors', 'potential_buyer', 'broker'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_class AS ENUM (
    'marina', 'rv_park', 'mobile_home_park', 'self_storage', 'multifamily', 'mixed_use', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE export_format AS ENUM ('pdf', 'pptx', 'docx');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE export_status AS ENUM ('queued', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE data_source AS ENUM (
    'deal', 'property', 'valuator', 'sales_comps', 'rate_comps',
    'rent_roll', 'demographics', 'due_diligence', 'modeling', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Section Library Table
CREATE TABLE IF NOT EXISTS om_section_library (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  section_key VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  supported_doc_types JSONB NOT NULL DEFAULT '[]',
  required_data_bindings JSONB NOT NULL DEFAULT '[]',
  optional_data_bindings JSONB NOT NULL DEFAULT '[]',
  required_media JSONB NOT NULL DEFAULT '[]',
  optional_media JSONB NOT NULL DEFAULT '[]',
  schema JSONB NOT NULL,
  default_layouts JSONB NOT NULL DEFAULT '[]',
  ai_prompt_templates JSONB NOT NULL DEFAULT '[]',
  completion_rules JSONB NOT NULL DEFAULT '[]',
  estimated_pages INTEGER NOT NULL DEFAULT 1,
  marina_specific BOOLEAN NOT NULL DEFAULT false,
  is_system_default BOOLEAN NOT NULL DEFAULT true,
  organization_id VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS om_section_library_key_idx ON om_section_library(section_key);
CREATE INDEX IF NOT EXISTS om_section_library_category_idx ON om_section_library(category);
CREATE INDEX IF NOT EXISTS om_section_library_org_idx ON om_section_library(organization_id);

-- Builder Documents Table
CREATE TABLE IF NOT EXISTS om_builder_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  deal_id VARCHAR NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  title TEXT NOT NULL,
  audience audience_persona,
  asset_class asset_class,
  theme_id VARCHAR,
  template_id VARCHAR,
  brand_kit_id VARCHAR,
  status document_status NOT NULL DEFAULT 'draft',
  config JSONB NOT NULL DEFAULT '{"sections": [], "settings": {}}',
  metadata JSONB DEFAULT '{}',
  working_snapshot JSONB,
  completion_status JSONB DEFAULT '{"totalSections": 0, "completedSections": 0, "percentage": 0, "readyToExport": false}',
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS om_builder_documents_deal_idx ON om_builder_documents(deal_id);
CREATE INDEX IF NOT EXISTS om_builder_documents_type_idx ON om_builder_documents(document_type);
CREATE INDEX IF NOT EXISTS om_builder_documents_status_idx ON om_builder_documents(status);
CREATE INDEX IF NOT EXISTS om_builder_documents_created_by_idx ON om_builder_documents(created_by);

-- Document Sections Table
CREATE TABLE IF NOT EXISTS om_document_sections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id VARCHAR NOT NULL REFERENCES om_builder_documents(id) ON DELETE CASCADE,
  section_key VARCHAR(100) NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  custom_title TEXT,
  data_bindings JSONB NOT NULL DEFAULT '[]',
  media JSONB NOT NULL DEFAULT '[]',
  content JSONB NOT NULL DEFAULT '{}',
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  last_ai_generated_at TIMESTAMP,
  completion_status JSONB DEFAULT '{"isComplete": false, "completedFields": [], "missingFields": [], "missingMedia": [], "warnings": [], "percentage": 0}',
  page_ids JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS om_document_sections_document_idx ON om_document_sections(document_id);
CREATE INDEX IF NOT EXISTS om_document_sections_order_idx ON om_document_sections(document_id, "order");
CREATE INDEX IF NOT EXISTS om_document_sections_key_idx ON om_document_sections(section_key);

-- Exemplars Table
CREATE TABLE IF NOT EXISTS om_exemplars (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  document_type document_type NOT NULL,
  asset_class asset_class,
  uploaded_file_url TEXT NOT NULL,
  uploaded_file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  extracted_structure JSONB,
  extracted_styles JSONB,
  embeddings JSONB,
  organization_id VARCHAR,
  user_id VARCHAR NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS om_exemplars_doc_type_idx ON om_exemplars(document_type);
CREATE INDEX IF NOT EXISTS om_exemplars_org_idx ON om_exemplars(organization_id);
CREATE INDEX IF NOT EXISTS om_exemplars_user_idx ON om_exemplars(user_id);
CREATE INDEX IF NOT EXISTS om_exemplars_public_idx ON om_exemplars(is_public);

-- Export Jobs Table
CREATE TABLE IF NOT EXISTS om_export_jobs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id VARCHAR NOT NULL REFERENCES om_builder_documents(id) ON DELETE CASCADE,
  format export_format NOT NULL,
  status export_status NOT NULL DEFAULT 'queued',
  output_url TEXT,
  output_file_name TEXT,
  file_size_bytes INTEGER,
  error_message TEXT,
  error_details JSONB,
  options JSONB DEFAULT '{}',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS om_export_jobs_document_idx ON om_export_jobs(document_id);
CREATE INDEX IF NOT EXISTS om_export_jobs_status_idx ON om_export_jobs(status);

-- Binding Cache Table
CREATE TABLE IF NOT EXISTS om_binding_cache (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id VARCHAR NOT NULL REFERENCES om_builder_documents(id) ON DELETE CASCADE,
  binding_key VARCHAR(100) NOT NULL,
  source data_source NOT NULL,
  field VARCHAR(200) NOT NULL,
  resolved_value JSONB,
  resolved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS om_binding_cache_document_idx ON om_binding_cache(document_id);
CREATE INDEX IF NOT EXISTS om_binding_cache_binding_idx ON om_binding_cache(document_id, binding_key);
`;
