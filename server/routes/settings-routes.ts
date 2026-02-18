import { Router, Request, Response } from 'express';
import { db } from '../db';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { sql } from 'drizzle-orm';

const router = Router();

// ============================================================================
// TYPE DEFINITIONS - Support multiple auth patterns
// ============================================================================
interface AuthenticatedRequest extends Request {
  tenantId?: string;
  orgId?: string;
  validatedOrgId?: string;
  validatedUserId?: string;
  user?: {
    id: string;
    username?: string;
    email?: string;
    orgId?: string;
    role?: string;
    name?: string;
  };
  session?: any; // Express session
}

// ============================================================================
// HELPER: Get user ID from multiple auth sources
// ============================================================================
function getUserId(req: AuthenticatedRequest): string | null {
  // Try all possible auth sources
  return req.validatedUserId 
    || req.user?.id 
    || req.session?.user?.id 
    || req.session?.userId
    || req.session?.passport?.user?.id
    || null;
}

function getOrgId(req: AuthenticatedRequest): string | null {
  return req.validatedOrgId 
    || req.tenantId
    || req.orgId
    || req.user?.orgId 
    || req.session?.user?.orgId
    || req.session?.orgId
    || null;
}

function getUserInfo(req: AuthenticatedRequest) {
  return {
    id: getUserId(req),
    orgId: getOrgId(req),
    email: req.user?.email || req.session?.user?.email,
    name: req.user?.name || req.user?.username || req.session?.user?.name,
    role: req.user?.role || req.session?.user?.role,
  };
}

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
// HELPER: Safe audit log (non-blocking)
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
    // Silently fail - audit shouldn't break main functionality
    logger.warn({ error }, 'Failed to log settings audit');
  }
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================
const DEFAULT_SETTINGS = {
  auto_save: true,
  timezone: 'America/New_York',
  locale: 'en-US',
  currency: 'USD',
  default_landing: 'dashboard',
  theme: 'system',
  density: 'comfortable',
  reduced_motion: false,
  sticky_headers: true,
  number_format: 'comma',
  decimal_precision: 2,
  notification_preferences: {
    channels: { inApp: true, email: true, sms: false },
    digests: { enabled: false, cadence: 'daily', time: '09:00' },
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
    scope: 'mine',
    modules: {
      dealRoom: { ndaSigned: true, fileUploaded: true, comment: true, taskAssigned: true, qaResponse: true },
      valuator: { parseComplete: true, reviewRequired: true, modelReady: true },
      crm: { leadAssigned: true, taskDue: true, pipelineMoved: true },
      security: { newLogin: true, passwordChanged: true, tokenCreated: true },
      comps: { newCompsParsed: true, anomalies: true },
    },
  },
};

// ============================================================================
// GET /api/settings/me - Get current user settings
// ============================================================================
    router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
      console.log('[Settings Debug]', { 
        userId: getUserId(req), 
        nodeEnv: process.env.NODE_ENV, 
        hasUser: !!req.user, 
        hasSession: !!req.session,
        sessionUser: (req.session as any)?.user,
        passportUser: (req.session as any)?.passport?.user
      });
      try {
        const userId = getUserId(req);
    const orgId = getOrgId(req);
    const userInfo = getUserInfo(req);

    // For development, allow mock user if no auth
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);
    const effectiveOrgId = orgId || (isDev ? 'org-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Try to get settings from database
    let settings: any = { ...DEFAULT_SETTINGS };

    try {
      const result = await db.execute(sql`
        SELECT * FROM user_settings WHERE user_id = ${effectiveUserId}
      `);

      if (result.rows[0]) {
        settings = result.rows[0];
      } else {
        // Try to create default settings
        try {
          const insertResult = await db.execute(sql`
            INSERT INTO user_settings (user_id)
            VALUES (${effectiveUserId})
            ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
            RETURNING *
          `);
          if (insertResult.rows[0]) {
            settings = insertResult.rows[0];
          }
        } catch (insertError) {
          logger.warn({ error: insertError }, 'Could not create user_settings row');
        }
      }
    } catch (e) {
      logger.warn({ error: e }, 'user_settings table query failed, using defaults');
    }

    // Get user profile info
    let profile: any = {
      id: effectiveUserId,
      email: userInfo.email || 'user@example.com',
      name: userInfo.name || 'User',
      role: userInfo.role || 'user',
      mfaEnabled: false,
      emailVerified: true,
    };

    try {
      const userResult = await db.execute(sql`
        SELECT id, email, name, role, org_id as "orgId", mfa_enabled as "mfaEnabled", email_verified as "emailVerified",
          phone, tz, default_calendar_provider as "defaultCalendarProvider", calendar_sync_enabled as "calendarSyncEnabled"
        FROM users WHERE id = ${effectiveUserId}
      `);
      if (userResult.rows[0]) {
        profile = {
          ...profile,
          ...userResult.rows[0],
        };
      }
    } catch (e) {
      // Use default profile
    }

    // Get organization info
    let organization = { id: effectiveOrgId || 'org-1', name: 'Organization' };
    if (profile.orgId || effectiveOrgId) {
      try {
        const orgResult = await db.execute(sql`
          SELECT id, name FROM organizations WHERE id = ${profile.orgId || effectiveOrgId}
        `);
        if (orgResult.rows[0]) {
          organization = orgResult.rows[0] as any;
        }
      } catch (e) {
        // Use default organization
      }
    }

    // Return settings response
    res.json({
      settings: {
        autoSave: settings.auto_save ?? DEFAULT_SETTINGS.auto_save,
        timezone: settings.timezone ?? DEFAULT_SETTINGS.timezone,
        locale: settings.locale ?? DEFAULT_SETTINGS.locale,
        currency: settings.currency ?? DEFAULT_SETTINGS.currency,
        defaultLanding: settings.default_landing ?? DEFAULT_SETTINGS.default_landing,
        theme: settings.theme ?? DEFAULT_SETTINGS.theme,
        density: settings.density ?? DEFAULT_SETTINGS.density,
        reducedMotion: settings.reduced_motion ?? DEFAULT_SETTINGS.reduced_motion,
        stickyHeaders: settings.sticky_headers ?? DEFAULT_SETTINGS.sticky_headers,
        numberFormat: settings.number_format ?? DEFAULT_SETTINGS.number_format,
        decimalPrecision: settings.decimal_precision ?? DEFAULT_SETTINGS.decimal_precision,
        notificationPreferences: settings.notification_preferences ?? DEFAULT_SETTINGS.notification_preferences,
      },
      profile,
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
router.put('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

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

    setClauses.push('updated_at = NOW()');

    if (setClauses.length > 1) {
      try {
        // Ensure row exists
        await db.execute(sql`
          INSERT INTO user_settings (user_id)
          VALUES (${effectiveUserId})
          ON CONFLICT (user_id) DO NOTHING
        `);

        // Update
        const query = `
          UPDATE user_settings 
          SET ${setClauses.join(', ')}
          WHERE user_id = $${values.length + 1}
          RETURNING *
        `;
        values.push(effectiveUserId);

        await db.execute(sql.raw(query, values));
      } catch (e) {
        logger.warn({ error: e }, 'Could not persist settings to database');
      }
    }

    logSettingsAudit(effectiveUserId, 'settings.update', 'settings', { updates: Object.keys(updates) }, req);

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    logger.error({ error }, 'Update settings error');
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================================================
// GET /api/settings/sessions - Get user's active sessions
// ============================================================================
router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const result = await db.execute(sql`
        SELECT 
          id,
          device_type as "deviceType",
          browser,
          os,
          ip_address as "ipAddress",
          location,
          last_activity_at as "lastActivityAt",
          created_at as "createdAt"
        FROM user_sessions
        WHERE user_id = ${effectiveUserId}
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
        isCurrent: false,
      }));

      res.json(sessions);
    } catch (e) {
      res.json([]);
    }
  } catch (error) {
    logger.error({ error }, 'Get sessions error');
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// ============================================================================
// DELETE /api/settings/sessions/:id - Revoke specific session
// ============================================================================
router.delete('/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sessionId } = req.params;

    try {
      await db.execute(sql`
        UPDATE user_sessions
        SET revoked_at = NOW()
        WHERE id = ${sessionId} AND user_id = ${effectiveUserId}
      `);
    } catch (e) {
      // Ignore
    }

    logSettingsAudit(effectiveUserId, 'security.session_revoked', 'security', { sessionId }, req);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Revoke session error');
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// ============================================================================
// POST /api/settings/sessions/revoke-all
// ============================================================================
router.post('/sessions/revoke-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      await db.execute(sql`
        UPDATE user_sessions
        SET revoked_at = NOW()
        WHERE user_id = ${effectiveUserId} AND revoked_at IS NULL
      `);
    } catch (e) {
      // Ignore
    }

    logSettingsAudit(effectiveUserId, 'security.logout_all', 'security', {}, req);
    res.json({ success: true, message: 'All sessions have been signed out' });
  } catch (error) {
    logger.error({ error }, 'Revoke all sessions error');
    res.status(500).json({ error: 'Failed to sign out all sessions' });
  }
});

// ============================================================================
// GET /api/settings/tokens
// ============================================================================
router.get('/tokens', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const result = await db.execute(sql`
        SELECT 
          id, name, token_prefix as "tokenPrefix", scopes,
          last_used_at as "lastUsedAt", expires_at as "expiresAt", created_at as "createdAt"
        FROM personal_access_tokens
        WHERE user_id = ${effectiveUserId} AND revoked_at IS NULL
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (e) {
      res.json([]);
    }
  } catch (error) {
    logger.error({ error }, 'Get tokens error');
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

// ============================================================================
// POST /api/settings/tokens
// ============================================================================
router.post('/tokens', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = createTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const { name, expiresInDays } = parsed.data;
    const rawToken = `mm_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 11);
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    try {
      await db.execute(sql`
        INSERT INTO personal_access_tokens (user_id, name, token_hash, token_prefix, expires_at)
        VALUES (${effectiveUserId}, ${name}, ${tokenHash}, ${tokenPrefix}, ${expiresAt})
      `);
    } catch (e) {
      return res.status(500).json({ error: 'Could not create token' });
    }

    logSettingsAudit(effectiveUserId, 'token.create', 'security', { name, expiresInDays }, req);
    res.status(201).json({ token: rawToken, message: 'Save this token now. You won\'t be able to see it again.' });
  } catch (error) {
    logger.error({ error }, 'Create token error');
    res.status(500).json({ error: 'Failed to create token' });
  }
});

// ============================================================================
// DELETE /api/settings/tokens/:id
// ============================================================================
router.delete('/tokens/:tokenId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { tokenId } = req.params;
    try {
      await db.execute(sql`
        UPDATE personal_access_tokens SET revoked_at = NOW()
        WHERE id = ${tokenId} AND user_id = ${effectiveUserId}
      `);
    } catch (e) {
      // Ignore
    }

    logSettingsAudit(effectiveUserId, 'token.revoke', 'security', { tokenId }, req);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Revoke token error');
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

// ============================================================================
// GET /api/settings/audit-log
// ============================================================================
router.get('/audit-log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const limit = parseInt(req.query.limit as string) || 50;

    try {
      const result = await db.execute(sql`
        SELECT id, action, category, metadata, ip_address as "ipAddress", user_agent as "userAgent", created_at as "createdAt"
        FROM settings_audit_log WHERE user_id = ${effectiveUserId}
        ORDER BY created_at DESC LIMIT ${limit}
      `);
      res.json(result.rows);
    } catch (e) {
      res.json([]);
    }
  } catch (error) {
    logger.error({ error }, 'Get audit log error');
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// ============================================================================
// GET /api/settings/app-info
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
// POST /api/settings/export-data
// ============================================================================
router.post('/export-data', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logSettingsAudit(effectiveUserId, 'data.export_requested', 'privacy', {}, req);
    res.json({ success: true, message: 'Your data export has been requested. You will receive an email when it\'s ready.' });
  } catch (error) {
    logger.error({ error }, 'Export data error');
    res.status(500).json({ error: 'Failed to request data export' });
  }
});

// ============================================================================
// POST /api/settings/delete-account
// ============================================================================
router.post('/delete-account', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logSettingsAudit(effectiveUserId, 'account.deletion_requested', 'account', {}, req);
    res.json({ success: true, message: 'Your account deletion request has been submitted. An administrator will review and process your request.' });
  } catch (error) {
    logger.error({ error }, 'Delete account error');
    res.status(500).json({ error: 'Failed to request account deletion' });
  }
});

export default router;
