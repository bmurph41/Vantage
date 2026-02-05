/**
 * Security Middleware Test Suite
 * 
 * Comprehensive tests for authentication, authorization, CSRF protection,
 * and tenant isolation middleware components.
 * 
 * Run: npx vitest run server/middleware/security.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  authResolver, 
  requireAuth, 
  getValidatedOrgId, 
  getValidatedUserId,
  isPublicRoute,
  AuthenticatedRequest,
} from './auth-resolver';
import { csrfProtection } from './csrf';
import { tenantContextMiddleware, validateTenantAccess } from './tenant-context';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createMockRequest(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    method: 'GET',
    path: '/api/test',
    headers: {},
    cookies: {},
    query: {},
    body: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    on: vi.fn(),
  };
  return res as Response;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

// ─── Auth Resolver Tests ───────────────────────────────────────────────────────

describe('authResolver middleware', () => {
  it('should extract orgId from user object', () => {
    const req = createMockRequest({
      user: { id: 'user-123', orgId: 'org-456' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    authResolver()(req, res, next);

    expect(req.validatedOrgId).toBe('org-456');
    expect(req.validatedUserId).toBe('user-123');
    expect(next).toHaveBeenCalled();
  });

  it('should extract orgId from session', () => {
    const req = createMockRequest({
      session: { userId: 'user-789', orgId: 'org-abc' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    authResolver()(req, res, next);

    expect(req.validatedOrgId).toBe('org-abc');
    expect(req.validatedUserId).toBe('user-789');
    expect(next).toHaveBeenCalled();
  });

  it('should extract orgId from tenantId property', () => {
    const req = createMockRequest({
      tenantId: 'tenant-xyz',
    });
    const res = createMockResponse();
    const next = createMockNext();

    authResolver()(req, res, next);

    expect(req.validatedOrgId).toBe('tenant-xyz');
    expect(next).toHaveBeenCalled();
  });

  it('should not set validatedOrgId when no org info present', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    authResolver()(req, res, next);

    expect(req.validatedOrgId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('should prioritize tenantId over user.orgId', () => {
    const req = createMockRequest({
      tenantId: 'priority-tenant',
      user: { id: 'user-1', orgId: 'fallback-org' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    authResolver()(req, res, next);

    expect(req.validatedOrgId).toBe('priority-tenant');
    expect(next).toHaveBeenCalled();
  });
});

// ─── Require Auth Tests ────────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  it('should allow access when orgId and userId are validated', () => {
    const req = createMockRequest({
      validatedOrgId: 'org-123',
      validatedUserId: 'user-456',
    });
    const res = createMockResponse();
    const next = createMockNext();

    requireAuth()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 when orgId is missing', () => {
    const req = createMockRequest({
      validatedUserId: 'user-456',
    });
    const res = createMockResponse();
    const next = createMockNext();

    requireAuth()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MISSING_ORG_ID' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when userId is missing', () => {
    const req = createMockRequest({
      validatedOrgId: 'org-123',
    });
    const res = createMockResponse();
    const next = createMockNext();

    requireAuth()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MISSING_USER_ID' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow access with allowPublic option even without auth', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    requireAuth({ allowPublic: true })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ─── Helper Function Tests ─────────────────────────────────────────────────────

describe('getValidatedOrgId', () => {
  it('should return orgId when present', () => {
    const req = createMockRequest({
      validatedOrgId: 'org-test',
    });

    expect(getValidatedOrgId(req)).toBe('org-test');
  });

  it('should throw when orgId is missing', () => {
    const req = createMockRequest();

    expect(() => getValidatedOrgId(req)).toThrow('Organization ID not available');
  });
});

describe('getValidatedUserId', () => {
  it('should return userId when present', () => {
    const req = createMockRequest({
      validatedUserId: 'user-test',
    });

    expect(getValidatedUserId(req)).toBe('user-test');
  });

  it('should throw when userId is missing', () => {
    const req = createMockRequest();

    expect(() => getValidatedUserId(req)).toThrow('User ID not available');
  });
});

describe('isPublicRoute', () => {
  it('should return true for health endpoint', () => {
    expect(isPublicRoute('/api/health')).toBe(true);
  });

  it('should return true for stripe webhook', () => {
    expect(isPublicRoute('/api/webhooks/stripe')).toBe(true);
  });

  it('should return false for protected routes', () => {
    expect(isPublicRoute('/api/projects')).toBe(false);
    expect(isPublicRoute('/api/crm/contacts')).toBe(false);
  });

  it('should handle route prefixes correctly', () => {
    expect(isPublicRoute('/api/webhooks/stripe')).toBe(true);
    expect(isPublicRoute('/api/webhooks/constant-contact')).toBe(true);
    expect(isPublicRoute('/api/email-marketing/constant-contact/callback')).toBe(true);
  });
});

// ─── CSRF Protection Tests ─────────────────────────────────────────────────────

describe('csrfProtection middleware', () => {
  it('should allow GET requests and set CSRF cookie if missing', () => {
    const req = createMockRequest({
      method: 'GET',
      cookies: {},
    });
    const res = createMockResponse();
    const next = createMockNext();

    csrfProtection(req as any, res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      'csrf_token',
      expect.any(String),
      expect.objectContaining({
        httpOnly: false,
        sameSite: 'strict',
      })
    );
    expect(next).toHaveBeenCalled();
  });

  it('should not set cookie if already present on GET', () => {
    const req = createMockRequest({
      method: 'GET',
      cookies: { csrf_token: 'existing-token' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    csrfProtection(req as any, res, next);

    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('should allow POST with matching cookie and header tokens', () => {
    const token = 'valid-csrf-token-12345678901234567890123456789012';
    const req = createMockRequest({
      method: 'POST',
      path: '/api/projects',
      cookies: { csrf_token: token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockResponse();
    const next = createMockNext();

    csrfProtection(req as any, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject POST without CSRF header', () => {
    const req = createMockRequest({
      method: 'POST',
      path: '/api/projects',
      cookies: { csrf_token: 'some-token' },
      headers: {},
    });
    const res = createMockResponse();
    const next = createMockNext();

    csrfProtection(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
  });

  it('should reject POST with mismatched tokens', () => {
    const req = createMockRequest({
      method: 'POST',
      path: '/api/projects',
      cookies: { csrf_token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      headers: { 'x-csrf-token': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    csrfProtection(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should exempt webhook paths from CSRF', () => {
    const req = createMockRequest({
      method: 'POST',
      path: '/api/stripe/webhook',
      cookies: {},
      headers: {},
    });
    const res = createMockResponse();
    const next = createMockNext();

    csrfProtection(req as any, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should exempt login/register from CSRF', () => {
    const loginReq = createMockRequest({
      method: 'POST',
      path: '/api/auth/login',
      cookies: {},
      headers: {},
    });
    const registerReq = createMockRequest({
      method: 'POST',
      path: '/api/auth/register',
      cookies: {},
      headers: {},
    });
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    const next1 = createMockNext();
    const next2 = createMockNext();

    csrfProtection(loginReq as any, res1, next1);
    csrfProtection(registerReq as any, res2, next2);

    expect(next1).toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
  });

  it('should allow HEAD and OPTIONS requests', () => {
    const headReq = createMockRequest({ method: 'HEAD', cookies: {} });
    const optionsReq = createMockRequest({ method: 'OPTIONS', cookies: {} });
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    const next1 = createMockNext();
    const next2 = createMockNext();

    csrfProtection(headReq as any, res1, next1);
    csrfProtection(optionsReq as any, res2, next2);

    expect(next1).toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
  });
});

// ─── Tenant Isolation Tests ────────────────────────────────────────────────────

describe('validateTenantAccess middleware', () => {
  it('should allow access when user orgId matches resource orgId', () => {
    const req = createMockRequest({
      user: { id: 'user-1', orgId: 'org-abc' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    validateTenantAccess('org-abc')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('should deny access when user orgId differs from resource orgId', () => {
    const req = createMockRequest({
      user: { id: 'user-1', orgId: 'org-abc' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    validateTenantAccess('org-different')(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should deny access when user is not authenticated', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    validateTenantAccess('org-abc')(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should allow access when resourceOrgId is empty string', () => {
    const req = createMockRequest({
      user: { id: 'user-1', orgId: 'org-abc' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    validateTenantAccess('')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── Integration Scenarios ─────────────────────────────────────────────────────

describe('Security middleware integration scenarios', () => {
  it('should handle full auth chain: resolver → requireAuth', () => {
    const req = createMockRequest({
      user: { id: 'user-123', orgId: 'org-456' },
    });
    const res = createMockResponse();
    const next1 = createMockNext();
    const next2 = createMockNext();

    authResolver()(req, res, next1);
    requireAuth()(req, res, next2);

    expect(next1).toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
    expect(req.validatedOrgId).toBe('org-456');
    expect(req.validatedUserId).toBe('user-123');
  });

  it('should reject cross-tenant data access attempt', () => {
    const req = createMockRequest({
      user: { id: 'attacker', orgId: 'org-evil' },
      validatedOrgId: 'org-evil',
    });
    const res = createMockResponse();
    const next = createMockNext();

    validateTenantAccess('org-victim')(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle unauthenticated request to protected endpoint', () => {
    const req = createMockRequest({
      method: 'POST',
      path: '/api/projects',
    });
    const res = createMockResponse();
    const next1 = createMockNext();
    const next2 = createMockNext();

    authResolver()(req, res, next1);
    requireAuth()(req, res, next2);

    expect(next1).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next2).not.toHaveBeenCalled();
  });
});
