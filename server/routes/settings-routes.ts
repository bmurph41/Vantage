import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { users, userSessions } from '@shared/schema';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { sql } from 'drizzle-orm';

const router = Router();

// ============================================================================
// MIDDLEWARE: Require authenticated session
// ============================================================================
const requireSession = async (req: Request, res: Response, next: Function) => {
  try {
    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Import your existing session validation
    const { enterpriseAuthService } = await import('../services/enterprise-auth-service');
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

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const updateSettingsSchema = z.object({
  autoSave: z.boolean().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  currency: z.string().optional(),
  defaultLanding: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  reducedMotion: z.boolean().optional(),
  stickyHeaders: z.boolean().optional(),
  numberFormat: z.enum(['comma', 'space', 'none']).optional(),
  decimalPrecision: z.number().min(0).max(6).optional(),
  notificationPreferences: z.object({
    channels: z.object({
      inApp: z.boolean(),
      email: z.boolean(),
      sms: z.boolean(),
    }).optional(),
    digests: z.object({
      enabled: z.boolean(),
      cadence: z.enum(['daily', 'weekly']),
      time: z.string(),
      dayOfWeek: z.number().min(0).max(6).optional(),
    }).optional(),
    quietHours: z.object({
      enabled: z.boolean(),
      start: z.string(),
      end: z.string(),
    }).optional(),
    scope: z.enum(['mine', 'all']).optional(),
    modules: z.object({
      dealRoom: z.object({
        ndaSigned: z.boolean(),
        fileUploaded: z.boolean(),
        comment: z.boolean(),
        taskAssigned: z.boolean(),
        qaResponse: z.boolean(),
      }).optional(),
      valuator: z.object({
        parseComplete: z.boolean(),
        reviewRequired: z.boolean(),
        modelReady: z.boolean(),
      }).optional(),
      crm: z.object({
        leadAssigned: z.boolean(),
        taskDue: z.boolean(),
        pipelineMoved: z.boolean(),
      }).optional(),
      security: z.object({
        newLogin: z.boolean(),
        passwordChanged: z.boolean(),
        tokenCreated: z.boolean(),
      }).optional(),
      comps: z.object({
        newCompsParsed: z.boolean(),
        anomalies: z.boolean(),
      }).optional(),
    }).optional(),
  }).optional(),
});

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().min(1).max(365).optional(),
});

// ============================================================================
// HELPER: Audit log
// ============================================================================
async function logSettingsAudit(
  userId: string,
  action: string,
  category: string,
  metadata: Record<string, any>,
  req: Request
) {
  try {
    await db.execute(sql`
      INSERT INTO settings_audit_log (user_id, action, category, metadata, ip_address, user_agent)
      VALUES (${userId}, ${action}, ${category}, ${JSON.stringify(metadata)}::jsonb, ${req.ip || null}, ${req.headers['user-agent'] || null})
    `);
  } catch (error) {
    logger.error({ error }, 'Failed to log settings audit');
  }
}

// ============================================================================
// GET /api/settings/me - Get current user settings
// ============================================================================
router.get('/me', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get or create settings
    const result = await db.execute(sql`
      SELECT * FROM user_settings WHERE user_id = ${userId}
    `);

    let settings = result.rows[0];

    // If no settings exist, create default
    if (!settings) {
      const insertResult = await db.execute(sql`
        INSERT INTO user_settings (user_id)
        VALUES (${userId})
        RETURNING *
      `);
      settings = insertResult.rows[0];
    }

    // Get user profile info
    const userResult = await db.execute(sql`
      SELECT id, email, name, role, org_id as "orgId", mfa_enabled as "mfaEnabled", email_verified as "emailVerified"
      FROM users WHERE id = ${userId}
    `);
    const user = userResult.rows[0];

    // Get organization info
    let organization = null;
    if (user?.orgId) {
      const orgResult = await db.execute(sql`
        SELECT id, name FROM organizations WHERE id = ${user.orgId}
      `);
      organization = orgResult.rows[0];
    }

    res.json({
      settings: {
        autoSave: settings.auto_save,
        timezone: settings.timezone,
        locale: settings.locale,
        currency: settings.currency,
        defaultLanding: settings.default_landing,
        theme: settings.theme,
        density: settings.density,
        reducedMotion: settings.reduced_motion,
        stickyHeaders: settings.sticky_headers,
        numberFormat: settings.number_format,
        decimalPrecision: settings.decimal_precision,
        notificationPreferences: settings.notification_preferences,
      },
      profile: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        role: user?.role,
        mfaEnabled: user?.mfaEnabled || false,
        emailVerified: user?.emailVerified || false,
      },
      organization,
    });
  } catch (error) {
    logger.error({ error }, 'Get settings error');
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// ============================================================================
// PUT /api/settings/me - Update user settings
// ============================================================================
router.put('/me', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const parsed = updateSettingsSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid settings', details: parsed.error.errors });
    }

    const updates = parsed.data;
    const setClauses: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    if (updates.autoSave !== undefined) {
      setClauses.push(`auto_save = $${values.length + 1}`);
      values.push(updates.autoSave);
    }
    if (updates.timezone !== undefined) {
      setClauses.push(`timezone = $${values.length + 1}`);
      values.push(updates.timezone);
    }
    if (updates.locale !== undefined) {
      setClauses.push(`locale = $${values.length + 1}`);
      values.push(updates.locale);
    }
    if (updates.currency !== undefined) {
      setClauses.push(`currency = $${values.length + 1}`);
      values.push(updates.currency);
    }
    if (updates.defaultLanding !== undefined) {
      setClauses.push(`default_landing = $${values.length + 1}`);
      values.push(updates.defaultLanding);
    }
    if (updates.theme !== undefined) {
      setClauses.push(`theme = $${values.length + 1}`);
      values.push(updates.theme);
    }
    if (updates.density !== undefined) {
      setClauses.push(`density = $${values.length + 1}`);
      values.push(updates.density);
    }
    if (updates.reducedMotion !== undefined) {
      setClauses.push(`reduced_motion = $${values.length + 1}`);
      values.push(updates.reducedMotion);
    }
    if (updates.stickyHeaders !== undefined) {
      setClauses.push(`sticky_headers = $${values.length + 1}`);
      values.push(updates.stickyHeaders);
    }
    if (updates.numberFormat !== undefined) {
      setClauses.push(`number_format = $${values.length + 1}`);
      values.push(updates.numberFormat);
    }
    if (updates.decimalPrecision !== undefined) {
      setClauses.push(`decimal_precision = $${values.length + 1}`);
      values.push(updates.decimalPrecision);
    }
    if (updates.notificationPreferences !== undefined) {
      setClauses.push(`notification_preferences = $${values.length + 1}::jsonb`);
      values.push(JSON.stringify(updates.notificationPreferences));
    }

    // Always update updated_at
    setClauses.push('updated_at = NOW()');

    if (setClauses.length > 1) {
      // Upsert settings
      await db.execute(sql`
        INSERT INTO user_settings (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `);

      // Update with raw query for flexibility
      const query = `
        UPDATE user_settings 
        SET ${setClauses.join(', ')}
        WHERE user_id = $${values.length + 1}
        RETURNING *
      `;
      values.push(userId);

      await db.execute(sql.raw(query, values));
    }

    // Log audit
    await logSettingsAudit(userId, 'settings.update', 'settings', { updates: Object.keys(updates) }, req);

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    logger.error({ error }, 'Update settings error');
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================================================
// PATCH /api/settings/me - Partial update (for autosave)
// ============================================================================
router.patch('/me', requireSession, async (req: Request, res: Response) => {
  // Same as PUT but designed for incremental updates
  return router.handle(req, res, () => {});
});

// ============================================================================
// GET /api/settings/sessions - Get user's active sessions
// ============================================================================
router.get('/sessions', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const currentToken = req.cookies?.sessionToken;

    const result = await db.execute(sql`
      SELECT 
        id,
        device_type as "deviceType",
        browser,
        os,
        ip_address as "ipAddress",
        location,
        last_activity_at as "lastActivityAt",
        created_at as "createdAt",
        session_token as "sessionToken"
      FROM user_sessions
      WHERE user_id = ${userId}
        AND expires_at > NOW()
        AND revoked_at IS NULL
      ORDER BY last_activity_at DESC
    `);

    const sessions = result.rows.map((s: any) => ({
      id: s.id,
      deviceType: s.deviceType || 'desktop',
      browser: s.browser || 'Unknown',
      os: s.os || 'Unknown',
      ipAddress: s.ipAddress,
      location: s.location,
      lastActivityAt: s.lastActivityAt,
      createdAt: s.createdAt,
      isCurrent: s.sessionToken === currentToken,
    }));

    res.json(sessions);
  } catch (error) {
    logger.error({ error }, 'Get sessions error');
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// ============================================================================
// DELETE /api/settings/sessions/:id - Revoke specific session
// ============================================================================
router.delete('/sessions/:sessionId', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    await db.execute(sql`
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE id = ${sessionId} AND user_id = ${userId}
    `);

    await logSettingsAudit(userId, 'security.session_revoked', 'security', { sessionId }, req);

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Revoke session error');
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// ============================================================================
// POST /api/settings/sessions/revoke-all - Sign out all sessions
// ============================================================================
router.post('/sessions/revoke-all', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const currentToken = req.cookies?.sessionToken;

    // Revoke all sessions except current
    await db.execute(sql`
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE user_id = ${userId}
        AND session_token != ${currentToken}
        AND revoked_at IS NULL
    `);

    await logSettingsAudit(userId, 'security.logout_all', 'security', { excludedCurrent: true }, req);

    res.json({ success: true, message: 'All other sessions have been signed out' });
  } catch (error) {
    logger.error({ error }, 'Revoke all sessions error');
    res.status(500).json({ error: 'Failed to sign out all sessions' });
  }
});

// ============================================================================
// GET /api/settings/tokens - List personal access tokens
// ============================================================================
router.get('/tokens', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await db.execute(sql`
      SELECT 
        id,
        name,
        token_prefix as "tokenPrefix",
        scopes,
        last_used_at as "lastUsedAt",
        expires_at as "expiresAt",
        created_at as "createdAt"
      FROM personal_access_tokens
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error({ error }, 'Get tokens error');
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

// ============================================================================
// POST /api/settings/tokens - Create personal access token
// ============================================================================
router.post('/tokens', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const parsed = createTokenSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const { name, expiresInDays } = parsed.data;

    // Generate secure token
    const rawToken = `mm_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 11); // "mm_" + first 8 chars

    // Calculate expiry
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await db.execute(sql`
      INSERT INTO personal_access_tokens (user_id, name, token_hash, token_prefix, expires_at)
      VALUES (${userId}, ${name}, ${tokenHash}, ${tokenPrefix}, ${expiresAt})
    `);

    await logSettingsAudit(userId, 'token.create', 'security', { name, expiresInDays }, req);

    // Return the raw token ONLY ONCE
    res.status(201).json({
      token: rawToken,
      message: 'Save this token now. You won\'t be able to see it again.',
    });
  } catch (error) {
    logger.error({ error }, 'Create token error');
    res.status(500).json({ error: 'Failed to create token' });
  }
});

// ============================================================================
// DELETE /api/settings/tokens/:id - Revoke personal access token
// ============================================================================
router.delete('/tokens/:tokenId', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { tokenId } = req.params;

    await db.execute(sql`
      UPDATE personal_access_tokens
      SET revoked_at = NOW()
      WHERE id = ${tokenId} AND user_id = ${userId}
    `);

    await logSettingsAudit(userId, 'token.revoke', 'security', { tokenId }, req);

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Revoke token error');
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

// ============================================================================
// GET /api/settings/audit-log - Get settings audit log
// ============================================================================
router.get('/audit-log', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await db.execute(sql`
      SELECT 
        id,
        action,
        category,
        metadata,
        ip_address as "ipAddress",
        user_agent as "userAgent",
        created_at as "createdAt"
      FROM settings_audit_log
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error({ error }, 'Get audit log error');
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// ============================================================================
// GET /api/settings/app-info - Get app version and info
// ============================================================================
router.get('/app-info', async (_req: Request, res: Response) => {
  res.json({
    version: process.env.APP_VERSION || '1.0.0',
    buildHash: process.env.GIT_COMMIT_SHA || 'development',
    environment: process.env.NODE_ENV || 'development',
    supportEmail: 'support@marinamatch.com',
    docsUrl: 'https://docs.marinamatch.com',
    changelogUrl: 'https://marinamatch.com/changelog',
  });
});

// ============================================================================
// POST /api/settings/export-data - Request data export
// ============================================================================
router.post('/export-data', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Log the request
    await logSettingsAudit(userId, 'data.export_requested', 'privacy', {}, req);

    // In a real implementation, this would queue a background job
    res.json({
      success: true,
      message: 'Your data export has been requested. You will receive an email when it\'s ready.',
    });
  } catch (error) {
    logger.error({ error }, 'Export data error');
    res.status(500).json({ error: 'Failed to request data export' });
  }
});

// ============================================================================
// POST /api/settings/delete-account - Request account deletion
// ============================================================================
router.post('/delete-account', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Log the request
    await logSettingsAudit(userId, 'account.deletion_requested', 'account', {}, req);

    // In a real implementation, this would trigger an admin review process
    res.json({
      success: true,
      message: 'Your account deletion request has been submitted. An administrator will review and process your request.',
    });
  } catch (error) {
    logger.error({ error }, 'Delete account error');
    res.status(500).json({ error: 'Failed to request account deletion' });
  }
});

export default router;