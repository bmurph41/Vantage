/**
 * MarinaMatch Security Types
 * 
 * Shared type definitions for authentication, authorization, and security.
 */

import type { User, Organization, Session, Role, Permission } from '../db/security-schema';

// ============================================================================
// TENANT CONTEXT
// ============================================================================

export interface TenantContext {
  orgId: string;
  userId: string;
  sessionId: string;
  roles: string[];
  permissions: Set<string>;
  isSuperAdmin: boolean;
}

// ============================================================================
// REQUEST EXTENSIONS
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      requestId?: string;
    }
    
    interface Locals {
      tenantContext?: TenantContext;
    }
  }
}

// ============================================================================
// SESSION
// ============================================================================

export interface SessionData {
  userId: string;
  orgId: string;
  sessionId: string;
  csrfToken: string;
  expiresAt: Date;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  user?: UserWithRoles;
  error?: string;
}

// ============================================================================
// USER
// ============================================================================

export interface UserWithRoles extends User {
  roles: RoleWithPermissions[];
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

// ============================================================================
// AUTHORIZATION
// ============================================================================

export type PermissionCheck = 
  | string // Simple permission name: 'documents:read'
  | { resource: string; action: string } // Structured check
  | ((context: TenantContext, resourceId?: string) => boolean | Promise<boolean>); // Custom function

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  requiredPermission?: string;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'session_created'
  | 'session_destroyed'
  | 'document_upload'
  | 'document_download'
  | 'document_delete'
  | 'document_view'
  | 'role_assigned'
  | 'role_revoked'
  | 'permission_granted'
  | 'permission_revoked'
  | 'integration_connected'
  | 'integration_disconnected'
  | 'integration_token_refreshed'
  | 'model_applied'
  | 'model_created'
  | 'model_updated'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'org_created'
  | 'org_updated'
  | 'org_settings_changed'
  | 'data_export'
  | 'data_deletion_requested'
  | 'break_glass_access';

export interface AuditLogEntry {
  orgId?: string;
  actorUserId?: string;
  actorType?: 'user' | 'system' | 'integration';
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

export type AllowedMimeType =
  | 'application/pdf'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'text/csv'
  | 'image/jpeg'
  | 'image/png';

export interface FileUploadMetadata {
  originalFilename: string;
  mimeType: AllowedMimeType;
  sizeBytes: number;
  checksumSha256: string;
  documentType?: string;
  classification?: string;
}

export interface UploadResult {
  success: boolean;
  documentId?: string;
  storagePath?: string;
  error?: string;
  quarantined?: boolean;
}

// ============================================================================
// INTEGRATION / OAUTH
// ============================================================================

export type IntegrationType = 'quickbooks' | 'marina_management' | 'other';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'expired';

export interface OAuthState {
  orgId: string;
  userId: string;
  integrationType: IntegrationType;
  codeVerifier: string; // PKCE
  nonce: string;
  redirectPath?: string;
  createdAt: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  tag: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class AuthenticationError extends SecurityError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_REQUIRED', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends SecurityError {
  constructor(
    message: string = 'Permission denied',
    public requiredPermission?: string
  ) {
    super(message, 'PERMISSION_DENIED', 403);
    this.name = 'AuthorizationError';
  }
}

export class TenantIsolationError extends SecurityError {
  constructor(message: string = 'Access to this resource is not permitted') {
    super(message, 'TENANT_ISOLATION_VIOLATION', 403);
    this.name = 'TenantIsolationError';
  }
}

export class RateLimitError extends SecurityError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends SecurityError {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class FileUploadError extends SecurityError {
  constructor(message: string, code: string = 'FILE_UPLOAD_ERROR') {
    super(message, code, 400);
    this.name = 'FileUploadError';
  }
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface SecurityConfig {
  session: {
    cookieName: string;
    maxAge: number; // milliseconds
    sameSite: 'strict' | 'lax' | 'none';
    secure: boolean;
    httpOnly: boolean;
    domain?: string;
  };
  csrf: {
    headerName: string;
    cookieName: string;
  };
  rateLimit: {
    general: {
      windowMs: number;
      max: number;
    };
    auth: {
      windowMs: number;
      max: number;
    };
    upload: {
      windowMs: number;
      max: number;
    };
  };
  upload: {
    maxSizeBytes: number;
    allowedMimeTypes: AllowedMimeType[];
    quarantineEnabled: boolean;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
  };
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
