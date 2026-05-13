import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  tenantId?: string;
  orgId?: string;
  user?: {
    id: string;
    username?: string;
    email?: string;
    orgId?: string;
  };
  session?: {
    userId?: string;
    user?: {
      id?: string;
      orgId?: string;
    };
    orgId?: string;
  };
}

const isProduction = process.env.NODE_ENV === 'production';

export function extractOrgId(req: AuthenticatedRequest): string | null {
  const orgId = req.tenantId
    || req.orgId
    || req.user?.orgId
    || req.session?.user?.orgId
    || req.session?.orgId;

  if (!orgId) return null;

  // Reject mock dev identifiers in production. Matches auth-resolver.ts:36-38.
  if (orgId === 'org-1' || orgId === 'default-org') {
    return isProduction ? null : orgId;
  }

  return orgId;
}

export function extractUserId(req: AuthenticatedRequest): string | null {
  const userId = req.user?.id || req.session?.userId || req.session?.user?.id;

  if (!userId) return null;

  if (userId === 'user-1' || userId === 'system') {
    return isProduction ? null : userId;
  }

  return userId;
}

export function requireStrictOrg() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const orgId = extractOrgId(req);
    
    if (!orgId) {
      console.warn(`[OrgGuard] Missing orgId for ${req.method} ${req.path}`);
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'MISSING_ORG_ID' 
      });
    }
    
    (req as any).validatedOrgId = orgId;
    next();
  };
}

export function requireStrictAuth() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const orgId = extractOrgId(req);
    const userId = extractUserId(req);
    
    if (!orgId) {
      console.warn(`[AuthGuard] Missing orgId for ${req.method} ${req.path}`);
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'MISSING_ORG_ID' 
      });
    }
    
    if (!userId) {
      console.warn(`[AuthGuard] Missing userId for ${req.method} ${req.path}`);
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'MISSING_USER_ID' 
      });
    }
    
    (req as any).validatedOrgId = orgId;
    (req as any).validatedUserId = userId;
    next();
  };
}

export function getValidatedOrgId(req: AuthenticatedRequest): string {
  const orgId = (req as any).validatedOrgId || extractOrgId(req);
  if (!orgId) {
    throw new Error('Organization ID not available - ensure requireStrictOrg middleware is applied');
  }
  return orgId;
}

export function getValidatedUserId(req: AuthenticatedRequest): string {
  const userId = (req as any).validatedUserId || extractUserId(req);
  if (!userId) {
    throw new Error('User ID not available - ensure requireStrictAuth middleware is applied');
  }
  return userId;
}

export function getSafeOrgId(req: AuthenticatedRequest): string {
  const orgId = extractOrgId(req);
  if (!orgId) {
    throw new Error('Organization ID not available - ensure authentication middleware is applied');
  }
  return orgId;
}

export function getSafeUserId(req: AuthenticatedRequest): string {
  const userId = extractUserId(req);
  if (!userId) {
    throw new Error('User ID not available - ensure authentication middleware is applied');
  }
  return userId;
}
