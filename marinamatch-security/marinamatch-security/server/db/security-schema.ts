/**
 * MarinaMatch Security Schema
 * 
 * This file defines all security-related database tables using Drizzle ORM.
 * Includes: organizations, users, roles, permissions, documents, audit logs, integrations.
 * 
 * INTEGRATION GUIDE:
 * 1. Add this to your existing schema file or create new: server/db/security-schema.ts
 * 2. Run: npx drizzle-kit generate
 * 3. Run: npx drizzle-kit migrate
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  timestamp, 
  boolean, 
  integer,
  bigint,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended', 'pending_verification']);
export const documentStatusEnum = pgEnum('document_status', ['pending', 'quarantine', 'approved', 'rejected', 'deleted']);
export const integrationTypeEnum = pgEnum('integration_type', ['quickbooks', 'marina_management', 'other']);
export const integrationStatusEnum = pgEnum('integration_status', ['connected', 'disconnected', 'error', 'expired']);
export const auditActionEnum = pgEnum('audit_action', [
  'login', 'logout', 'login_failed', 'session_created', 'session_destroyed',
  'document_upload', 'document_download', 'document_delete', 'document_view',
  'role_assigned', 'role_revoked', 'permission_granted', 'permission_revoked',
  'integration_connected', 'integration_disconnected', 'integration_token_refreshed',
  'model_applied', 'model_created', 'model_updated',
  'user_created', 'user_updated', 'user_deleted',
  'org_created', 'org_updated', 'org_settings_changed',
  'data_export', 'data_deletion_requested', 'break_glass_access'
]);

// ============================================================================
// ORGANIZATIONS (Tenants)
// ============================================================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  
  // Billing and subscription
  subscriptionTier: varchar('subscription_tier', { length: 50 }).default('free'),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('active'),
  
  // Quotas
  maxUsers: integer('max_users').default(5),
  maxStorageBytes: bigint('max_storage_bytes', { mode: 'number' }).default(5368709120), // 5GB
  currentStorageBytes: bigint('current_storage_bytes', { mode: 'number' }).default(0),
  
  // Settings
  settings: jsonb('settings').default({}),
  
  // Data retention
  documentRetentionDays: integer('document_retention_days').default(2555), // 7 years
  auditLogRetentionDays: integer('audit_log_retention_days').default(2555),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // Soft delete
}, (table) => ({
  slugIdx: uniqueIndex('org_slug_idx').on(table.slug),
}));

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  
  // Auth provider info (Replit OIDC or other)
  externalId: varchar('external_id', { length: 255 }), // ID from auth provider
  authProvider: varchar('auth_provider', { length: 50 }).default('replit'),
  
  // Profile
  email: varchar('email', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  
  // Status
  status: userStatusEnum('status').default('active').notNull(),
  
  // MFA (scaffolding)
  mfaEnabled: boolean('mfa_enabled').default(false),
  mfaSecret: text('mfa_secret'), // Encrypted TOTP secret
  mfaBackupCodes: jsonb('mfa_backup_codes'), // Encrypted backup codes
  
  // Security
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  
  // Super admin flag (break-glass)
  isSuperAdmin: boolean('is_super_admin').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  orgIdIdx: index('user_org_id_idx').on(table.orgId),
  emailIdx: index('user_email_idx').on(table.email),
  externalIdIdx: uniqueIndex('user_external_id_idx').on(table.externalId),
}));

// ============================================================================
// SESSIONS
// ============================================================================

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  
  // Session token (hashed)
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  
  // CSRF token
  csrfToken: varchar('csrf_token', { length: 64 }).notNull(),
  
  // Metadata
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  
  // Expiration
  expiresAt: timestamp('expires_at').notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('session_user_id_idx').on(table.userId),
  tokenHashIdx: uniqueIndex('session_token_hash_idx').on(table.tokenHash),
  expiresAtIdx: index('session_expires_at_idx').on(table.expiresAt),
}));

// ============================================================================
// ROLES
// ============================================================================

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id),
  
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // System roles cannot be deleted
  isSystem: boolean('is_system').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgNameIdx: uniqueIndex('role_org_name_idx').on(table.orgId, table.name),
}));

// ============================================================================
// PERMISSIONS
// ============================================================================

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Format: resource:action (e.g., documents:upload, model:write)
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  
  // Resource and action extracted for querying
  resource: varchar('resource', { length: 50 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  resourceActionIdx: uniqueIndex('permission_resource_action_idx').on(table.resource, table.action),
}));

// ============================================================================
// ROLE PERMISSIONS (Many-to-Many)
// ============================================================================

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

// ============================================================================
// USER ROLES (Many-to-Many)
// ============================================================================

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  
  // Who assigned this role
  assignedBy: uuid('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));

// ============================================================================
// DOCUMENTS
// ============================================================================

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
  
  // File metadata
  originalFilename: varchar('original_filename', { length: 500 }).notNull(),
  storagePath: varchar('storage_path', { length: 1000 }).notNull(), // UUID-based path
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  
  // Integrity
  checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
  
  // Classification
  documentType: varchar('document_type', { length: 50 }), // 'pnl', 'rent_roll', 'lease', 'other'
  classification: varchar('classification', { length: 50 }).default('confidential'),
  
  // Status
  status: documentStatusEnum('status').default('pending').notNull(),
  quarantineReason: text('quarantine_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  
  // Versioning
  version: integer('version').default(1).notNull(),
  previousVersionId: uuid('previous_version_id').references(() => documents.id),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  
  // Retention
  retentionExpiresAt: timestamp('retention_expires_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  orgIdIdx: index('document_org_id_idx').on(table.orgId),
  uploadedByIdx: index('document_uploaded_by_idx').on(table.uploadedBy),
  checksumIdx: index('document_checksum_idx').on(table.checksumSha256),
  statusIdx: index('document_status_idx').on(table.status),
}));

// ============================================================================
// INTEGRATIONS
// ============================================================================

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  
  // Integration type
  type: integrationTypeEnum('type').notNull(),
  status: integrationStatusEnum('status').default('disconnected').notNull(),
  
  // Provider-specific identifier (e.g., QuickBooks realmId)
  externalId: varchar('external_id', { length: 255 }),
  
  // Encrypted tokens (AES-256-GCM)
  accessTokenEncrypted: text('access_token_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiresAt: timestamp('token_expires_at'),
  
  // Scopes granted
  scopes: jsonb('scopes').default([]),
  
  // Connection metadata
  connectedBy: uuid('connected_by').references(() => users.id),
  connectedAt: timestamp('connected_at'),
  lastSyncAt: timestamp('last_sync_at'),
  lastError: text('last_error'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgTypeIdx: uniqueIndex('integration_org_type_idx').on(table.orgId, table.type),
}));

// ============================================================================
// AUDIT LOGS (Append-Only)
// ============================================================================

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id),
  
  // Actor
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorType: varchar('actor_type', { length: 50 }).default('user'), // 'user', 'system', 'integration'
  
  // Action
  action: auditActionEnum('action').notNull(),
  
  // Resource
  resourceType: varchar('resource_type', { length: 100 }).notNull(),
  resourceId: uuid('resource_id'),
  
  // Before/After state (redacted sensitive fields)
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  
  // Request context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  requestId: varchar('request_id', { length: 64 }),
  
  // Tamper evidence (hash chain)
  previousLogHash: varchar('previous_log_hash', { length: 64 }),
  logHash: varchar('log_hash', { length: 64 }).notNull(),
  
  // Additional context
  metadata: jsonb('metadata').default({}),
  
  // Timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdIdx: index('audit_org_id_idx').on(table.orgId),
  actorIdIdx: index('audit_actor_id_idx').on(table.actorUserId),
  actionIdx: index('audit_action_idx').on(table.action),
  resourceIdx: index('audit_resource_idx').on(table.resourceType, table.resourceId),
  createdAtIdx: index('audit_created_at_idx').on(table.createdAt),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  documents: many(documents),
  integrations: many(integrations),
  auditLogs: many(auditLogs),
  roles: many(roles),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  sessions: many(sessions),
  uploadedDocuments: many(documents),
  userRoles: many(userRoles),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [sessions.orgId],
    references: [organizations.id],
  }),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.orgId],
    references: [organizations.id],
  }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assigner: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  organization: one(organizations, {
    fields: [documents.orgId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [documents.reviewedBy],
    references: [users.id],
  }),
  previousVersion: one(documents, {
    fields: [documents.previousVersionId],
    references: [documents.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrations.orgId],
    references: [organizations.id],
  }),
  connector: one(users, {
    fields: [integrations.connectedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Integration = typeof integrations.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
