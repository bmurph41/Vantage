import { Request, Response, NextFunction } from "express";

export interface OmUser {
  id: string;
  email?: string;
  name?: string;
  organizationId?: string;
  role: "admin" | "editor" | "viewer";
}

export interface OmRequestContext {
  user?: OmUser;
  projectId?: string;
  organizationId?: string;
}

declare global {
  namespace Express {
    interface Request {
      omContext?: OmRequestContext;
    }
  }
}

export interface AuthConfig {
  extractUser?: (req: Request) => OmUser | undefined;
  extractProjectId?: (req: Request) => string | undefined;
  extractOrganizationId?: (req: Request) => string | undefined;
  requireAuth?: boolean;
}

const defaultConfig: AuthConfig = {
  extractUser: (req) => {
    if (req.headers["x-om-user-id"]) {
      return {
        id: req.headers["x-om-user-id"] as string,
        email: req.headers["x-om-user-email"] as string | undefined,
        name: req.headers["x-om-user-name"] as string | undefined,
        organizationId: req.headers["x-om-org-id"] as string | undefined,
        role: (req.headers["x-om-user-role"] as OmUser["role"]) || "viewer",
      };
    }
    if ((req as any).user) {
      return (req as any).user as OmUser;
    }
    return undefined;
  },
  extractProjectId: (req) => {
    return (req.headers["x-om-project-id"] as string) || req.params.projectId || req.query.projectId as string;
  },
  extractOrganizationId: (req) => {
    return req.headers["x-om-org-id"] as string | undefined;
  },
  requireAuth: false,
};

export function createOmAuthMiddleware(config: AuthConfig = {}) {
  const mergedConfig = { ...defaultConfig, ...config };
  
  return (req: Request, res: Response, next: NextFunction) => {
    const user = mergedConfig.extractUser?.(req);
    const projectId = mergedConfig.extractProjectId?.(req);
    const organizationId = mergedConfig.extractOrganizationId?.(req);
    
    req.omContext = {
      user,
      projectId,
      organizationId,
    };
    
    if (mergedConfig.requireAuth && !user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    next();
  };
}

export function requireRole(...roles: OmUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.omContext?.user;
    
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
}

export function requireProjectAccess() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { projectId, user, organizationId } = req.omContext || {};
    
    if (!projectId) {
      return res.status(400).json({ error: "Project context required" });
    }
    
    next();
  };
}

export const omAuth = createOmAuthMiddleware();
export const omAuthRequired = createOmAuthMiddleware({ requireAuth: true });
