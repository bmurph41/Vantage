import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  tenantId?: string;
  orgId?: string;
  validatedOrgId?: string;
  validatedUserId?: string;
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
const devAllowAnonOrg = process.env.DEV_ALLOW_ANON_ORG === 'true' || !isProduction;

function extractOrgId(req: AuthenticatedRequest): string | null {
  const orgId = req.tenantId 
    || req.orgId 
    || req.user?.orgId 
    || req.session?.user?.orgId 
    || req.session?.orgId;
  
  if (!orgId) return null;
  
  if (orgId === 'org-1' || orgId === 'default-org') {
    return isProduction ? null : orgId;
  }
  
  return orgId;
}

function extractUserId(req: AuthenticatedRequest): string | null {
  const userId = req.user?.id || req.session?.userId || req.session?.user?.id;
  
  if (!userId) return null;
  
  if (userId === 'user-1' || userId === 'system') {
    return isProduction ? null : userId;
  }
  
  return userId;
}

export function authResolver() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const orgId = extractOrgId(req);
    const userId = extractUserId(req);
    
    if (orgId) {
      req.validatedOrgId = orgId;
    }
    
    if (userId) {
      req.validatedUserId = userId;
    }
    
    next();
  };
}

export function devMockAuthMiddleware() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (isProduction) {
      return next();
    }
    
    if (!devAllowAnonOrg) {
      return next();
    }
    
    if (!req.validatedOrgId) {
      console.warn(`[DevAuth] Injecting mock orgId for ${req.method} ${req.path}`);
      req.validatedOrgId = 'org-1';
      req.tenantId = 'org-1';
    }
    
    if (!req.validatedUserId) {
      console.warn(`[DevAuth] Injecting mock userId for ${req.method} ${req.path}`);
      req.validatedUserId = 'user-1';
    }
    
    next();
  };
}

export function requireAuth(options?: { allowPublic?: boolean }) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (options?.allowPublic) {
      return next();
    }
    
    if (!req.validatedOrgId) {
      console.error(`[AuthGuard] Missing orgId for ${req.method} ${req.path}`);
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'MISSING_ORG_ID' 
      });
    }
    
    if (!req.validatedUserId) {
      console.error(`[AuthGuard] Missing userId for ${req.method} ${req.path}`);
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'MISSING_USER_ID' 
      });
    }
    
    next();
  };
}

export function getValidatedOrgId(req: AuthenticatedRequest): string {
  if (!req.validatedOrgId) {
    throw new Error('Organization ID not available - ensure auth middleware is applied');
  }
  return req.validatedOrgId;
}

export function getValidatedUserId(req: AuthenticatedRequest): string {
  if (!req.validatedUserId) {
    throw new Error('User ID not available - ensure auth middleware is applied');
  }
  return req.validatedUserId;
}

export const publicRoutes = new Set([
  '/api/health',
  '/api/webhooks/stripe',
  '/api/webhooks/constant-contact',
  '/api/email-marketing/constant-contact/callback',
]);

export function isPublicRoute(path: string): boolean {
  if (publicRoutes.has(path)) {
    return true;
  }
  
  for (const route of publicRoutes) {
    if (path.startsWith(route)) {
      return true;
    }
  }
  
  return false;
}
