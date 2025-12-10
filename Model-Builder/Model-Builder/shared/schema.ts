import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// OM Tables
export const oms = pgTable("oms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(), // Reference to external project system
  name: text("name").notNull(),
  status: text("status").notNull().default('draft'), // draft | review | published | archived
  version: integer("version").notNull().default(1),
  settings: jsonb("settings"), // Branding, theme settings
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const omPages = pgTable("om_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  omId: varchar("om_id").notNull().references(() => oms.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  orderIndex: integer("order_index").notNull(),
  layout: jsonb("layout"), // OmPageLayoutConfig
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const omBlocks = pgTable("om_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => omPages.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // text | chart | table | kpi | image | map
  orderIndex: integer("order_index").notNull(),
  content: jsonb("content").notNull(), // Block-specific content
  dataBinding: jsonb("data_binding"), // OmDataBinding
  style: jsonb("style"), // OmBlockStyle
  aiMetadata: jsonb("ai_metadata"), // For tracking AI generation
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const omTemplates = pgTable("om_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerType: text("owner_type").notNull(), // global | org | user
  ownerId: varchar("owner_id"),
  name: text("name").notNull(),
  scope: text("scope").notNull(), // block | page | om
  category: text("category"),
  templateData: jsonb("template_data").notNull(), // Serialized structure
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Datasets table for uploaded Excel/CSV data
export const datasets = pgTable("datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // underwriting | sales_comps | rent_comps | custom
  sourceFileName: text("source_file_name"),
  data: jsonb("data").notNull(), // Parsed JSON data from Excel/CSV
  sheetNames: text("sheet_names").array(), // Available sheets (for Excel)
  metadata: jsonb("metadata"), // Additional info like column headers, data types
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert Schemas
export const insertOmSchema = createInsertSchema(oms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOmPageSchema = createInsertSchema(omPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOmBlockSchema = createInsertSchema(omBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOmTemplateSchema = createInsertSchema(omTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDatasetSchema = createInsertSchema(datasets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Om = typeof oms.$inferSelect;
export type InsertOm = z.infer<typeof insertOmSchema>;
export type OmPage = typeof omPages.$inferSelect;
export type InsertOmPage = z.infer<typeof insertOmPageSchema>;
export type OmBlock = typeof omBlocks.$inferSelect;
export type InsertOmBlock = z.infer<typeof insertOmBlockSchema>;
export type OmTemplate = typeof omTemplates.$inferSelect;
export type InsertOmTemplate = z.infer<typeof insertOmTemplateSchema>;
export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = z.infer<typeof insertDatasetSchema>;
