/**
 * Standalone authentication middleware for routes mounted outside registerRoutes().
 * Mirrors the authenticateUser logic from routes.ts using enterpriseAuthService.
 */

import { Request, Response, NextFunction } from 'express';
import { enterpriseAuthService } from '../services/enterprise-auth-service';
import { setTenantContext, clearTenantContext } from './tenant-context';

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/api/auth/', '/api/health', '/api/stripe/webhook', '/api/legal/'];

export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  // Only protect API routes
  if (!req.path.startsWith('/api/')) return next();

  // Skip authentication for public routes
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) return next();

  try {
    const sessionToken = (req as any).cookies?.sessionToken;

    if (sessionToken) {
      // Validate session using enterprise auth service
      const sessionData = await enterpriseAuthService.validateSession(sessionToken);

      if (sessionData) {
        (req as any).user = {
          id: sessionData.user.id,
          orgId: sessionData.user.orgId,
          role: sessionData.user.role,
          email: sessionData.user.email,
          name: sessionData.user.name,
        };
      }
    }

    // Fall back to demo user in development if no session
    if (!(req as any).user && process.env.NODE_ENV !== 'production') {
      (req as any).user = {
        id: "85c9cd7a-c453-4dba-9817-d032d5712c4e",
        orgId: "cd3719c3-ef82-4ccc-acb9-261c80fb64b4",
        role: "owner",
        email: "brettmurphy41@gmail.com",
        name: "Demo User",
      };
    }

    if (!(req as any).user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Set tenant context for RLS
    if ((req as any).user?.orgId) {
      await setTenantContext((req as any).user.orgId);

      res.on('finish', () => {
        clearTenantContext().catch(err => {
          console.error('Error clearing tenant context:', err);
        });
      });
    }

    next();
  } catch (error: any) {
    console.error('Authentication/tenant context error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
