import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireTenantMatch, enforceTenant } from '../middleware/tenant-isolation';

// Mock logger
vi.mock('../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Mock db
vi.mock('../db', () => ({
  db: { execute: vi.fn() },
}));

// Mock error-handler to get the TenantIsolationError
vi.mock('../middleware/error-handler', async () => {
  class TenantIsolationError extends Error {
    statusCode = 404;
    code = 'TENANT_ISOLATION';
    constructor() {
      super('Resource not found');
      this.name = 'TenantIsolationError';
    }
  }
  return { TenantIsolationError };
});

function mockReq(overrides: any = {}) {
  return {
    path: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as any;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  return res;
}

describe('Tenant Isolation', () => {
  describe('requireTenantMatch', () => {
    it('returns 401 if no user is present', () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      requireTenantMatch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows request when orgId matches user orgId', () => {
      const req = mockReq({
        user: { id: 'u1', orgId: 'org-1' },
        query: { orgId: 'org-1' },
      });
      const res = mockRes();
      const next = vi.fn();

      requireTenantMatch(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('blocks cross-tenant access via query param (calls next with TenantIsolationError)', () => {
      const req = mockReq({
        user: { id: 'u1', orgId: 'org-A' },
        query: { orgId: 'org-B' },
      });
      const res = mockRes();
      const next = vi.fn();

      requireTenantMatch(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
      }));
    });

    it('blocks cross-tenant access via body param', () => {
      const req = mockReq({
        user: { id: 'u1', orgId: 'org-A' },
        body: { orgId: 'org-B' },
      });
      const res = mockRes();
      const next = vi.fn();

      requireTenantMatch(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
      }));
    });

    it('blocks cross-tenant access via route param', () => {
      const req = mockReq({
        user: { id: 'u1', orgId: 'org-A' },
        params: { orgId: 'org-B' },
      });
      const res = mockRes();
      const next = vi.fn();

      requireTenantMatch(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
      }));
    });

    it('allows request when no orgId is specified', () => {
      const req = mockReq({
        user: { id: 'u1', orgId: 'org-1' },
      });
      const res = mockRes();
      const next = vi.fn();

      requireTenantMatch(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('enforceTenant', () => {
    it('returns 401 if no user on API routes', () => {
      const req = mockReq({ path: '/api/test' });
      const res = mockRes();
      const next = vi.fn();

      enforceTenant(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('injects user orgId into POST body', () => {
      const req = mockReq({
        path: '/api/test',
        method: 'POST',
        user: { id: 'u1', orgId: 'org-1' },
        body: { name: 'test' },
      });
      const res = mockRes();
      const next = vi.fn();

      enforceTenant(req, res, next);

      expect(req.body.orgId).toBe('org-1');
      expect(next).toHaveBeenCalled();
    });

    it('overrides attacker orgId in POST body with user orgId', () => {
      const req = mockReq({
        path: '/api/test',
        method: 'POST',
        user: { id: 'u1', orgId: 'org-1' },
        body: { orgId: 'org-evil', data: 'sensitive' },
      });
      const res = mockRes();
      const next = vi.fn();

      enforceTenant(req, res, next);

      expect(req.body.orgId).toBe('org-1');
    });

    it('sets tenantId on request', () => {
      const req = mockReq({
        path: '/api/test',
        user: { id: 'u1', orgId: 'org-1' },
      });
      const res = mockRes();
      const next = vi.fn();

      enforceTenant(req, res, next);

      expect(req.tenantId).toBe('org-1');
    });

    it('blocks user with missing orgId', () => {
      const req = mockReq({
        path: '/api/test',
        user: { id: 'u1' },
      });
      const res = mockRes();
      const next = vi.fn();

      enforceTenant(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
      }));
    });
  });
});
