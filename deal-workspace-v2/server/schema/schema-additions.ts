/**
 * Deal Workspace Schema Additions
 * 
 * INSTRUCTIONS: Append this content to the bottom of shared/schema.ts
 * (above the zod schema exports section).
 * 
 * These are ONLY the new tables. Existing tables (deal_workspaces, vdr_folders,
 * vdr_documents, tasks, projects, vdrAuditLogs) are reused as-is.
 * The migration SQL adds columns to those existing tables.
 */

// ─── New Enums ───────────────────────────────────────────────────────────────

export const wsMemberRoleEnum = pgEnum('ws_member_role', [
  'owner_admin', 'internal_member', 'buyer', 'seller', 'broker',
  'lender', 'attorney', 'accountant', 'consultant', 'viewer',
]);

export const wsInviteStatusEnum = pgEnum('ws_invite_status', [
  'pending', 'accepted', 'declined', 'revoked',
]);

export const wsAccessPolicyEnum = pgEnum('ws_access_policy', [
  'auto_approve', 'manual_approve',
]);

export const wsCaExecutionStatusEnum = pgEnum('ws_ca_execution_status', [
  'executed', 'pending_review', 'rejected',
]);

export const wsMilestoneTypeEnum = pgEnum('ws_milestone_type', [
  'dd_start', 'dd_expiration', 'closing', 'financing_contingency',
  'inspection_deadline', 'custom',
]);

export const wsMilestoneStatusEnum = pgEnum('ws_milestone_status', [
  'upcoming', 'due_soon', 'overdue', 'completed',
]);

export const wsDdPermissionEnum = pgEnum('ws_dd_permission', [
  'none', 'view', 'edit', 'admin',
]);

export const wsSecurityLevelEnum = pgEnum('ws_security_level', [
  'public', 'confidential', 'restricted',
]);

// ─── Workspace Members ───────────────────────────────────────────────────────

export const workspaceMembers = pgTable('workspace_members', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar('workspace_id').notNull().references(() => dealWorkspaces.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').references(() => users.id),
  email: varchar('email', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  role: wsMemberRoleEnum('role').notNull().default('viewer'),
  vdrPermission: vdrPermissionLevelEnum('vdr_permission').notNull().default('no_access'),
  ddPermission: wsDdPermissionEnum('dd_permission').notNull().default('none'),
  inviteStatus: wsInviteStatusEnum('invite_status').notNull().default('pending'),
  invitedBy: varchar('invited_by'),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  workspaceIdx: index('wm_workspace_idx').on(table.workspaceId),
  userIdx: index('wm_user_idx').on(table.userId),
  orgIdx: index('wm_org_idx').on(table.orgId),
}));

// ─── Confidentiality Agreements ──────────────────────────────────────────────

export const confidentialityAgreements = pgTable('confidentiality_agreements', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar('workspace_id').notNull().references(() => dealWorkspaces.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
  title: text('title').notNull(),
  bodyHtml: text('body_html').notNull(),
  accessPolicy: wsAccessPolicyEnum('access_policy').notNull().default('auto_approve'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  workspaceIdx: index('ca_workspace_idx').on(table.workspaceId),
}));

// ─── Agreement Executions ────────────────────────────────────────────────────

export const agreementExecutions = pgTable('agreement_executions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar('workspace_id').notNull().references(() => dealWorkspaces.id, { onDelete: 'cascade' }),
  agreementId: varchar('agreement_id').notNull().references(() => confidentialityAgreements.id, { onDelete: 'cascade' }),
  memberId: varchar('member_id'),
  email: varchar('email', { length: 255 }),
  userId: varchar('user_id'),
  status: wsCaExecutionStatusEnum('status').notNull().default('executed'),
  executedAt: timestamp('executed_at').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  notes: text('notes'),
  reviewedBy: varchar('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  workspaceIdx: index('ae_workspace_idx').on(table.workspaceId),
  agreementIdx: index('ae_agreement_idx').on(table.agreementId),
  userIdx: index('ae_user_idx').on(table.userId),
}));

// ─── DD Milestones ───────────────────────────────────────────────────────────

export const ddMilestones = pgTable('dd_milestones', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar('workspace_id').notNull().references(() => dealWorkspaces.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  type: wsMilestoneTypeEnum('type').notNull(),
  title: text('title').notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: wsMilestoneStatusEnum('status').notNull().default('upcoming'),
  notes: text('notes'),
  calendarEventId: varchar('calendar_event_id', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  workspaceIdx: index('dm_workspace_idx').on(table.workspaceId),
  dueIdx: index('dm_due_idx').on(table.dueDate),
}));

// ─── Type exports ────────────────────────────────────────────────────────────

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type ConfidentialityAgreement = typeof confidentialityAgreements.$inferSelect;
export type AgreementExecution = typeof agreementExecutions.$inferSelect;
export type DdMilestone = typeof ddMilestones.$inferSelect;
