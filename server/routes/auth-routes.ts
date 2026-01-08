import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { enterpriseAuthService, type DeviceInfo } from '../services/enterprise-auth-service';
import { samlPassportService } from '../services/saml-passport-service';
import { db } from '../db';
import { organizations, ssoConfigurations, users, userSessions } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { z } from 'zod';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        orgId: string;
        role: string;
        email?: string;
        name?: string;
      };
    }
  }
}

const router = Router();

const requireSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.sessionToken;
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionData = await enterpriseAuthService.validateSession(sessionToken);
    
    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = {
      id: sessionData.user.id,
      orgId: sessionData.user.orgId,
      role: sessionData.user.role,
      email: sessionData.user.email,
      name: sessionData.user.name,
    };
    
    next();
  } catch (error) {
    logger.error({ error }, 'Session validation error');
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const mfaSchema = z.object({
  userId: z.string(),
  token: z.string().length(6),
  mfaToken: z.string(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  orgId: z.string().optional(),
  orgName: z.string().optional(),
});

function getDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent'] || '';
  return {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent,
    deviceType: detectDeviceType(userAgent),
    browser: extractBrowser(userAgent),
    os: extractOS(userAgent),
  };
}

function detectDeviceType(userAgent: string): string {
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

function extractBrowser(userAgent: string): string {
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
  if (/edge/i.test(userAgent)) return 'Edge';
  return 'Other';
}

function extractOS(userAgent: string): string {
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/macintosh|mac os/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad/i.test(userAgent)) return 'iOS';
  return 'Other';
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const { email, password } = parsed.data;
    const deviceInfo = getDeviceInfo(req);

    const result = await enterpriseAuthService.authenticateWithPassword(email, password, deviceInfo);

    if (!result.success) {
      return res.status(401).json({ error: result.error, code: result.errorCode });
    }

    if (result.requiresMfa) {
      return res.json({
        requiresMfa: true,
        userId: result.user?.id,
        mfaToken: result.mfaToken,
      });
    }

    res.cookie('sessionToken', result.session?.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: sanitizeUser(result.user!),
      session: {
        expiresAt: result.session?.expiresAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Login error');
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/mfa/verify', async (req: Request, res: Response) => {
  try {
    const parsed = mfaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const { userId, token } = parsed.data;
    const deviceInfo = getDeviceInfo(req);

    const result = await enterpriseAuthService.verifyMfa(userId, token, deviceInfo);

    if (!result.success) {
      return res.status(401).json({ error: result.error, code: result.errorCode });
    }

    res.cookie('sessionToken', result.session?.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: sanitizeUser(result.user!),
      session: {
        expiresAt: result.session?.expiresAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'MFA verification error');
    res.status(500).json({ error: 'MFA verification failed' });
  }
});

router.post('/mfa/setup', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const setup = await enterpriseAuthService.setupMfa(userId);
    res.json({
      qrCode: setup.qrCode,
      backupCodes: setup.backupCodes,
    });
  } catch (error) {
    logger.error({ error }, 'MFA setup error');
    res.status(500).json({ error: 'MFA setup failed' });
  }
});

router.post('/mfa/enable', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification code required' });
    }

    const success = await enterpriseAuthService.enableMfa(userId, token);
    if (!success) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'MFA enable error');
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

router.post('/mfa/disable', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await enterpriseAuthService.disableMfa(userId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'MFA disable error');
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const { email, password, name, orgId, orgName } = parsed.data;

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    let organizationId = orgId;
    if (!organizationId && orgName) {
      const [newOrg] = await db.insert(organizations)
        .values({ name: orgName })
        .returning();
      organizationId = newOrg.id;
    }

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization required' });
    }

    const passwordHash = await enterpriseAuthService.hashPassword(password);

    const [newUser] = await db.insert(users)
      .values({
        orgId: organizationId,
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: 'owner',
        isActive: true,
      })
      .returning();

    const deviceInfo = getDeviceInfo(req);
    const result = await enterpriseAuthService.authenticateWithPassword(email, password, deviceInfo);

    if (result.success && result.session) {
      res.cookie('sessionToken', result.session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/',
      });
    }

    res.status(201).json({
      user: sanitizeUser(newUser),
      organization: { id: organizationId },
    });
  } catch (error) {
    logger.error({ error }, 'Registration error');
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionToken = req.cookies.sessionToken;
    if (sessionToken) {
      const session = await db.query.userSessions.findFirst({
        where: eq(userSessions.sessionToken, sessionToken)
      });
      
      if (session) {
        await enterpriseAuthService.revokeSession(session.id, session.userId);
      }
    }

    res.clearCookie('sessionToken');
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Logout error');
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const sessionToken = req.cookies?.sessionToken;
    
    if (sessionToken) {
      const sessionData = await enterpriseAuthService.validateSession(sessionToken);
      
      if (sessionData) {
        const [user] = await db.select()
          .from(users)
          .where(eq(users.id, sessionData.user.id))
          .limit(1);

        if (user) {
          const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, user.orgId)
          });

          return res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            orgId: user.orgId,
            orgName: org?.name || 'Unknown Organization',
          });
        }
      }
    }
    
    // Development mode fallback - return demo user
    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        id: 'user-1',
        email: 'brettmurphy41@gmail.com',
        name: 'Demo User',
        role: 'owner',
        orgId: 'org-1',
        orgName: 'Demo Organization',
      });
    }

    return res.status(401).json({ error: 'Not authenticated' });
  } catch (error) {
    logger.error({ error }, 'Get current user error');
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

router.get('/sessions', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const sessions = await enterpriseAuthService.getUserSessions(userId);
    res.json(sessions.map(s => ({
      id: s.id,
      deviceType: s.deviceType,
      browser: s.browser,
      os: s.os,
      location: s.location,
      lastActivityAt: s.lastActivityAt,
      createdAt: s.createdAt,
      isCurrent: s.sessionToken === req.cookies.sessionToken,
    })));
  } catch (error) {
    logger.error({ error }, 'Get sessions error');
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

router.delete('/sessions/:sessionId', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    await enterpriseAuthService.revokeSession(sessionId, userId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Revoke session error');
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

router.delete('/sessions', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const currentToken = req.cookies.sessionToken;
    await enterpriseAuthService.revokeAllSessions(userId, currentToken);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Revoke all sessions error');
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

router.get('/saml/login/:orgId', async (req: Request, res: Response, next: NextFunction) => {
  const { orgId } = req.params;
  
  const strategy = await samlPassportService.getOrInitializeStrategy(orgId);
  if (!strategy) {
    return res.status(400).json({ error: 'SSO not configured for this organization' });
  }

  passport.authenticate(`saml-${orgId}`, {
    failureRedirect: '/login?error=sso_failed',
  })(req, res, next);
});

router.post('/saml/callback/:orgId', 
  async (req: Request, res: Response, next: NextFunction) => {
    const { orgId } = req.params;
    
    const strategy = await samlPassportService.getOrInitializeStrategy(orgId);
    if (!strategy) {
      return res.redirect('/login?error=sso_not_configured');
    }

    passport.authenticate(`saml-${orgId}`, {
      failureRedirect: '/login?error=sso_failed',
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as any;
    
    if (user.requiresMfa) {
      return res.redirect(`/login/mfa?userId=${user.id}&mfaToken=${user.mfaToken}`);
    }

    res.cookie('sessionToken', user.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    res.redirect('/');
  }
);

router.get('/saml/metadata/:orgId', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  
  await samlPassportService.getOrInitializeStrategy(orgId);
  const metadata = samlPassportService.generateMetadata(orgId);
  
  if (!metadata) {
    return res.status(404).json({ error: 'SSO not configured' });
  }

  res.type('application/xml');
  res.send(metadata);
});

router.get('/sso/config', requireSession, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;

    const config = await enterpriseAuthService.getSsoConfiguration(orgId);
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId)
    });

    res.json({
      ssoEnabled: org?.ssoEnabled || false,
      ssoEnforced: org?.ssoEnforced || false,
      mfaRequired: org?.mfaRequired || false,
      provider: config?.provider,
      entityId: config?.entityId,
      ssoUrl: config?.ssoUrl,
      isActive: config?.isActive || false,
      lastTestedAt: config?.lastTestedAt,
      jitProvisioningEnabled: config?.jitProvisioningEnabled || false,
      defaultRole: config?.defaultRole || 'viewer',
    });
  } catch (error) {
    logger.error({ error }, 'Get SSO config error');
    res.status(500).json({ error: 'Failed to get SSO configuration' });
  }
});

router.put('/sso/config', requireSession, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;

    const { 
      provider, 
      entityId, 
      ssoUrl, 
      sloUrl, 
      certificate, 
      metadataUrl,
      jitProvisioningEnabled,
      defaultRole,
      isActive,
    } = req.body;

    const config = await enterpriseAuthService.saveSsoConfiguration(orgId, {
      provider,
      entityId,
      ssoUrl,
      sloUrl,
      certificate,
      metadataUrl,
      jitProvisioningEnabled,
      defaultRole,
      isActive,
    });

    await samlPassportService.refreshStrategy(orgId);

    res.json({ success: true, config });
  } catch (error) {
    logger.error({ error }, 'Update SSO config error');
    res.status(500).json({ error: 'Failed to update SSO configuration' });
  }
});

router.post('/sso/test', requireSession, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;

    const result = await enterpriseAuthService.testSsoConfiguration(orgId);
    res.json(result);
  } catch (error) {
    logger.error({ error }, 'Test SSO config error');
    res.status(500).json({ error: 'Failed to test SSO configuration' });
  }
});

router.put('/security/settings', requireSession, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;

    const { 
      ssoEnabled, 
      ssoEnforced, 
      mfaRequired, 
      sessionTimeoutMinutes,
      ipAllowlist,
      allowedEmailDomains,
    } = req.body;

    await db.update(organizations)
      .set({
        ssoEnabled,
        ssoEnforced,
        mfaRequired,
        sessionTimeoutMinutes,
        ipAllowlist,
        allowedEmailDomains,
      })
      .where(eq(organizations.id, orgId));

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Update security settings error');
    res.status(500).json({ error: 'Failed to update security settings' });
  }
});

router.get('/security/audit-log', requireSession, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;

    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await enterpriseAuthService.getSecurityAuditLog(orgId, { limit });
    
    res.json(logs);
  } catch (error) {
    logger.error({ error }, 'Get audit log error');
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

function sanitizeUser(user: any) {
  const { passwordHash, mfaSecret, mfaBackupCodes, ...safeUser } = user;
  return safeUser;
}

export default router;
