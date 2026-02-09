/**
 * Deal Workspace Schema - Drizzle ORM
 * 
 * New tables: dealWorkspaces, workspaceMembers, confidentialityAgreements,
 * agreementExecutions, ddMilestones, vdrFolders, vdrDocuments, vdrActivityLog, workspaceTasks
 */
import {
  pgTable, serial, integer, text, varchar, timestamp, boolean, jsonb,
  pgEnum, bigint, index,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const workspaceStatusEnum = pgEnum("workspace_status", [
  "draft", "active", "under_contract", "closing", "closed", "terminated", "archived",
]);

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner_admin", "internal_member", "buyer", "seller", "broker",
  "lender", "attorney", "accountant", "consultant", "viewer",
]);

export const vdrPermissionEnum = pgEnum("vdr_permission", [
  "none", "view", "download", "upload", "admin",
]);

export const ddPermissionEnum = pgEnum("dd_permission", [
  "none", "view", "edit", "admin",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending", "accepted", "declined", "revoked",
]);

export const accessPolicyEnum = pgEnum("access_policy", [
  "auto_approve", "manual_approve",
]);

export const agreementExecutionStatusEnum = pgEnum("agreement_execution_status", [
  "executed", "pending_review", "rejected",
]);

export const milestoneTypeEnum = pgEnum("milestone_type", [
  "dd_start", "dd_expiration", "closing", "financing_contingency", "inspection_deadline", "custom",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "upcoming", "due_soon", "overdue", "completed",
]);

export const vdrActionEnum = pgEnum("vdr_action", [
  "view", "download", "upload", "move", "rename", "delete", "restore",
  "create_folder", "update_permissions", "execute_ca", "approve_ca", "reject_ca",
]);

export const securityLevelEnum = pgEnum("security_level", [
  "public", "confidential", "restricted",
]);

export const wsTaskStatusEnum = pgEnum("workspace_task_status", [
  "not_started", "in_progress", "blocked", "completed", "skipped",
]);

// ─── Deal Workspaces ─────────────────────────────────────────────────────────

export const dealWorkspaces = pgTable("deal_workspaces", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  dealId: integer("deal_id"),
  propertyId: integer("property_id"),
  ddProjectId: integer("dd_project_id"),
  modelingProjectId: integer("modeling_project_id"),
  status: workspaceStatusEnum("status").default("draft").notNull(),
  stage: varchar("stage", { length: 100 }),
  role: varchar("role", { length: 50 }).default("buyer"),
  targetPrice: text("target_price"),
  ddStartDate: timestamp("dd_start_date"),
  ddExpirationDate: timestamp("dd_expiration_date"),
  closingDate: timestamp("closing_date"),
  expectedCloseDate: timestamp("expected_close_date"),
  lastActivityAt: timestamp("last_activity_at"),
  lastActivityType: text("last_activity_type"),
  lastActivityDescription: text("last_activity_description"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  orgIdx: index("dw_org_idx").on(t.orgId),
  dealIdx: index("dw_deal_idx").on(t.dealId),
}));

// ─── Workspace Members ───────────────────────────────────────────────────────

export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id"),
  email: varchar("email", { length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  role: workspaceRoleEnum("role").default("viewer").notNull(),
  vdrPermission: vdrPermissionEnum("vdr_permission").default("none").notNull(),
  ddPermission: ddPermissionEnum("dd_permission").default("none").notNull(),
  inviteStatus: inviteStatusEnum("invite_status").default("pending").notNull(),
  invitedBy: integer("invited_by"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  wsIdx: index("wm_workspace_idx").on(t.workspaceId),
  userIdx: index("wm_user_idx").on(t.userId),
}));

// ─── Confidentiality Agreements ──────────────────────────────────────────────

export const confidentialityAgreements = pgTable("confidentiality_agreements", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  orgId: integer("org_id").notNull(),
  version: varchar("version", { length: 20 }).default("1.0.0").notNull(),
  title: text("title").notNull(),
  bodyHtml: text("body_html").notNull(),
  accessPolicy: accessPolicyEnum("access_policy").default("auto_approve").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  wsIdx: index("ca_workspace_idx").on(t.workspaceId),
}));

// ─── Agreement Executions ────────────────────────────────────────────────────

export const agreementExecutions = pgTable("agreement_executions", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  agreementId: integer("agreement_id").notNull(),
  memberId: integer("member_id"),
  email: varchar("email", { length: 255 }),
  userId: integer("user_id"),
  status: agreementExecutionStatusEnum("status").default("executed").notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  notes: text("notes"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  wsIdx: index("ae_workspace_idx").on(t.workspaceId),
  agIdx: index("ae_agreement_idx").on(t.agreementId),
}));

// ─── DD Milestones ───────────────────────────────────────────────────────────

export const ddMilestones = pgTable("dd_milestones", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  orgId: integer("org_id").notNull(),
  type: milestoneTypeEnum("type").notNull(),
  title: text("title").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: milestoneStatusEnum("status").default("upcoming").notNull(),
  notes: text("notes"),
  calendarEventId: varchar("calendar_event_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  wsIdx: index("dm_workspace_idx").on(t.workspaceId),
}));

// ─── VDR Folders ─────────────────────────────────────────────────────────────

export const vdrFolders = pgTable("vdr_folders", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  projectId: integer("project_id"),
  orgId: integer("org_id").notNull(),
  parentFolderId: integer("parent_folder_id"),
  name: text("name").notNull(),
  templateKey: varchar("template_key", { length: 100 }),
  securityLevel: securityLevelEnum("security_level").default("confidential").notNull(),
  sortOrder: integer("sort_order").default(0),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by"),
}, (t) => ({
  wsIdx: index("vf_workspace_idx").on(t.workspaceId),
  parentIdx: index("vf_parent_idx").on(t.parentFolderId),
}));

// ─── VDR Documents ───────────────────────────────────────────────────────────

export const vdrDocuments = pgTable("vdr_documents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  projectId: integer("project_id"),
  orgId: integer("org_id").notNull(),
  folderId: integer("folder_id").notNull(),
  name: text("name").notNull(),
  originalName: text("original_name"),
  version: integer("version").default(1).notNull(),
  fileHash: varchar("file_hash", { length: 128 }),
  mimeType: varchar("mime_type", { length: 255 }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  storagePath: text("storage_path"),
  status: varchar("status", { length: 50 }).default("active"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by"),
  aiParsed: boolean("ai_parsed").default(false),
  aiParseJobId: varchar("ai_parse_job_id", { length: 255 }),
  uploadedBy: integer("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  wsIdx: index("vd_workspace_idx").on(t.workspaceId),
  folderIdx: index("vd_folder_idx").on(t.folderId),
}));

// ─── VDR Activity Log ────────────────────────────────────────────────────────

export const vdrActivityLog = pgTable("vdr_activity_log", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  orgId: integer("org_id").notNull(),
  documentId: integer("document_id"),
  folderId: integer("folder_id"),
  memberId: integer("member_id"),
  userId: integer("user_id"),
  action: vdrActionEnum("action").notNull(),
  meta: jsonb("meta"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  wsIdx: index("val_workspace_idx").on(t.workspaceId),
  createdIdx: index("val_created_idx").on(t.createdAt),
}));

// ─── Workspace Tasks ─────────────────────────────────────────────────────────

export const workspaceTasks = pgTable("workspace_tasks", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  projectId: integer("project_id"),
  orgId: integer("org_id").notNull(),
  templateKey: varchar("template_key", { length: 100 }),
  category: varchar("category", { length: 100 }),
  title: text("title").notNull(),
  description: text("description"),
  status: wsTaskStatusEnum("status").default("not_started").notNull(),
  dueDate: timestamp("due_date"),
  milestoneAnchor: varchar("milestone_anchor", { length: 50 }),
  defaultDueOffsetDays: integer("default_due_offset_days"),
  assignedToMemberId: integer("assigned_to_member_id"),
  assignedToUserId: integer("assigned_to_user_id"),
  dependencyTaskId: integer("dependency_task_id"),
  calendarEventId: varchar("calendar_event_id", { length: 255 }),
  required: boolean("required").default(false),
  tags: jsonb("tags"),
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  wsIdx: index("wt_workspace_idx").on(t.workspaceId),
  statusIdx: index("wt_status_idx").on(t.status),
  dueIdx: index("wt_due_idx").on(t.dueDate),
}));

// ─── Type exports ────────────────────────────────────────────────────────────

export type DealWorkspace = typeof dealWorkspaces.$inferSelect;
export type InsertDealWorkspace = typeof dealWorkspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type VdrFolder = typeof vdrFolders.$inferSelect;
export type VdrDocument = typeof vdrDocuments.$inferSelect;
export type WorkspaceTask = typeof workspaceTasks.$inferSelect;
export type DdMilestone = typeof ddMilestones.$inferSelect;
