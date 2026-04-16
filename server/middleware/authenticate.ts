/**
 * Standalone authentication middleware for routes mounted outside registerRoutes().
 * Mirrors the authenticateUser logic from routes.ts using enterpriseAuthService.
 */

import { Request, Response, NextFunction } from 'express';
import { enterpriseAuthService } from '../services/enterprise-auth-service';
import { setTenantContext, clearTenantContext } from './tenant-context';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

if (process.env.ALLOW_DEMO_AUTH === 'true') {
  console.warn('[AUTH] ⚠️ ALLOW_DEMO_AUTH is enabled — demo credentials active. Do NOT use in production.');
}

const PUBLIC_PATHS = ['/api/auth/', '/api/health', '/api/stripe/webhook', '/api/legal/', '/api/config', '/api/packs/catalog'];

export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  if (!req.originalUrl.startsWith('/api/')) {
    return next();
  }

  if (PUBLIC_PATHS.some(p => req.originalUrl.startsWith(p))) return next();

  try {
    let resolvedUser: { id: string; orgId: string; role: string; email: string; name: string } | null = null;

    const sessionToken = (req as any).cookies?.sessionToken;

    if (sessionToken) {
      const sessionData = await enterpriseAuthService.validateSession(sessionToken);

      if (sessionData) {
        resolvedUser = {
          id: sessionData.user.id,
          orgId: sessionData.user.orgId,
          role: sessionData.user.role,
          email: sessionData.user.email,
          name: sessionData.user.name,
        };
      }
    }

    if (!resolvedUser) {
      const isAuth = typeof (req as any).isAuthenticated === 'function' ? (req as any).isAuthenticated() : false;
      if (isAuth) {
        const passportUser = (req as any).user as any;
        const replitClaims = passportUser?.claims || {};
        const replitUserId = replitClaims.sub;
        if (replitUserId) {
          const [dbUser] = await db.select().from(users).where(eq(users.id, replitUserId)).limit(1);
          if (dbUser) {
            resolvedUser = {
              id: dbUser.id,
              orgId: dbUser.orgId,
              role: dbUser.role || 'viewer',
              email: dbUser.email || replitClaims.email || '',
              name: dbUser.name || replitClaims.first_name || '',
            };
          } else if (replitClaims.email) {
            const [invitedUser] = await db.select().from(users).where(eq(users.email, replitClaims.email)).limit(1);
            if (invitedUser) {
              resolvedUser = {
                id: invitedUser.id,
                orgId: invitedUser.orgId,
                role: invitedUser.role || 'viewer',
                email: invitedUser.email,
                name: invitedUser.name || replitClaims.first_name || '',
              };
            }
          }
        }
      }
    }

    if (!resolvedUser && process.env.ALLOW_DEMO_AUTH === 'true') {
      console.warn('[AUTH] Using demo auth fallback for request:', req.originalUrl);
      resolvedUser = {
        id: "85c9cd7a-c453-4dba-9817-d032d5712c4e",
        orgId: "cd3719c3-ef82-4ccc-acb9-261c80fb64b4",
        role: "owner",
        email: "brettmurphy41@gmail.com",
        name: "Brett Murphy",
      };
    }

    if (!resolvedUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    (req as any).user = resolvedUser;

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
