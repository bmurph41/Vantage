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

export function extractOrgId(req: AuthenticatedRequest): string | null {
  const orgId = req.tenantId 
    || req.orgId 
    || req.user?.orgId 
    || req.session?.user?.orgId 
    || req.session?.orgId;
  
  if (!orgId || orgId === 'org-1' || orgId === 'default-org') {
    const actualOrg = req.tenantId || req.orgId || req.user?.orgId || req.session?.orgId;
    if (!actualOrg) {
      return null;
    }
    return actualOrg;
  }
  
  return orgId;
}

export function extractUserId(req: AuthenticatedRequest): string | null {
  const userId = req.user?.id || req.session?.userId || req.session?.user?.id;
  
  if (!userId || userId === 'user-1' || userId === 'system') {
    const actualUser = req.user?.id || req.session?.userId;
    if (!actualUser) {
      return null;
    }
    return actualUser;
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
