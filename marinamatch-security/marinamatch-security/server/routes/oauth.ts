/**
 * MarinaMatch OAuth Routes
 * 
 * Implements secure OAuth flow for QuickBooks and other integrations.
 * Features:
 * - PKCE (Proof Key for Code Exchange)
 * - State parameter validation (CSRF protection)
 * - Token encryption at rest
 * - Automatic token refresh
 * - Audit logging
 * 
 * USAGE:
 * import { oauthRouter } from './routes/oauth';
 * app.use('/api/oauth', oauthRouter);
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/client'; // Adjust to your DB client
import { integrations } from '../db/security-schema';
import { eq, and } from 'drizzle-orm';
import {
  encryptTokens,
  decryptTokens,
  generateCodeVerifier,
  generateCodeChallenge,
  generateSecureToken,
} from '../utils/encryption';
import { logIntegration } from '../services/audit-logger';
import { requireAuth, csrfProtection } from '../middleware/auth';
import { authorize } from '../middleware/authorization';
import type { TenantContext } from '../types/security';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface OAuthProviderConfig {
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
  usePkce: boolean;
}

// Provider configurations - loaded from environment
const getProviderConfig = (provider: string): OAuthProviderConfig | null => {
  const configs: Record<string, () => OAuthProviderConfig> = {
    quickbooks: () => ({
      name: 'QuickBooks',
      authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
      tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      scopes: ['com.intuit.quickbooks.accounting'], // Minimal scope
      redirectUri: `${process.env.APP_URL}/api/oauth/callback/quickbooks`,
      usePkce: true,
    }),
    // Add other providers here as needed
    // marina_management: () => ({...}),
  };

  const configFn = configs[provider];
  if (!configFn) return null;

  const config = configFn();
  if (!config.clientId || !config.clientSecret) {
    console.warn(`[OAUTH] Missing credentials for provider: ${provider}`);
    return null;
  }

  return config;
};

// State storage (in production, use Redis or database)
// Maps state token -> { orgId, userId, codeVerifier, provider, expiresAt }
const pendingStates = new Map<string, {
  orgId: string;
  userId: string;
  codeVerifier: string;
  provider: string;
  expiresAt: Date;
}>();

// Clean up expired states periodically
setInterval(() => {
  const now = new Date();
  for (const [state, data] of pendingStates.entries()) {
    if (data.expiresAt < now) {
      pendingStates.delete(state);
    }
  }
}, 60 * 1000); // Every minute

// ============================================================================
// ROUTER
// ============================================================================

export const oauthRouter = Router();

// ============================================================================
// INITIATE OAUTH FLOW
// ============================================================================

const connectSchema = z.object({
  provider: z.enum(['quickbooks', 'marina_management']),
});

/**
 * POST /api/oauth/connect
 * Initiates OAuth flow for an integration
 */
oauthRouter.post(
  '/connect',
  requireAuth,
  csrfProtection,
  authorize('integrations:connect'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;
      const { provider } = connectSchema.parse(req.body);

      // Get provider config
      const config = getProviderConfig(provider);
      if (!config) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PROVIDER', message: 'Integration provider not configured' },
        });
      }

      // Check if already connected
      const existing = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.orgId, context.orgId),
            eq(integrations.type, provider),
            eq(integrations.status, 'connected')
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: { code: 'ALREADY_CONNECTED', message: 'Integration already connected' },
        });
      }

      // Generate PKCE code verifier and challenge
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Generate state token for CSRF protection
      const state = generateSecureToken(32);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store state for callback validation
      pendingStates.set(state, {
        orgId: context.orgId,
        userId: context.userId,
        codeVerifier,
        provider,
        expiresAt,
      });

      // Build authorization URL
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state,
      });

      // Add PKCE parameters if supported
      if (config.usePkce) {
        params.append('code_challenge', codeChallenge);
        params.append('code_challenge_method', 'S256');
      }

      const authorizationUrl = `${config.authorizationUrl}?${params.toString()}`;

      res.json({
        success: true,
        data: { authorizationUrl },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// OAUTH CALLBACK
// ============================================================================

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  realmId: z.string().optional(), // QuickBooks specific
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/**
 * GET /api/oauth/callback/:provider
 * Handles OAuth callback from provider
 */
oauthRouter.get(
  '/callback/:provider',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider } = req.params;

      // Parse and validate query parameters
      const query = callbackQuerySchema.safeParse(req.query);
      if (!query.success) {
        return redirectWithError(res, 'Invalid callback parameters');
      }

      // Check for OAuth error from provider
      if (query.data.error) {
        console.error(`[OAUTH] Provider error: ${query.data.error} - ${query.data.error_description}`);
        return redirectWithError(res, query.data.error_description || 'Authorization denied');
      }

      const { code, state, realmId } = query.data;

      // Validate state token
      const pendingState = pendingStates.get(state);
      if (!pendingState) {
        return redirectWithError(res, 'Invalid or expired state token');
      }

      // Check expiration
      if (pendingState.expiresAt < new Date()) {
        pendingStates.delete(state);
        return redirectWithError(res, 'Authorization session expired');
      }

      // Verify provider matches
      if (pendingState.provider !== provider) {
        pendingStates.delete(state);
        return redirectWithError(res, 'Provider mismatch');
      }

      // Remove state (one-time use)
      pendingStates.delete(state);

      // Get provider config
      const config = getProviderConfig(provider);
      if (!config) {
        return redirectWithError(res, 'Provider not configured');
      }

      // Exchange code for tokens
      const tokenParams: Record<string, string> = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      };

      // Add PKCE verifier if used
      if (config.usePkce) {
        tokenParams.code_verifier = pendingState.codeVerifier;
      }

      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams(tokenParams),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[OAUTH] Token exchange failed: ${errorText}`);
        return redirectWithError(res, 'Failed to complete authorization');
      }

      const tokens = await tokenResponse.json();

      // Encrypt tokens for storage
      const encryptedTokens = encryptTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        tokenType: tokens.token_type,
      });

      // Calculate token expiration
      const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      const refreshTokenExpiresAt = tokens.x_refresh_token_expires_in
        ? new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000)
        : new Date(Date.now() + 100 * 24 * 60 * 60 * 1000); // Default 100 days

      // Save integration to database
      const [integration] = await db
        .insert(integrations)
        .values({
          orgId: pendingState.orgId,
          type: provider,
          status: 'connected',
          encryptedAccessToken: encryptedTokens.encryptedAccessToken,
          encryptedRefreshToken: encryptedTokens.encryptedRefreshToken,
          tokenExpiresAt,
          refreshTokenExpiresAt,
          scopes: config.scopes,
          externalAccountId: realmId || null, // QuickBooks realm ID
          metadata: {
            connectedAt: new Date().toISOString(),
            connectedBy: pendingState.userId,
          },
          lastSyncAt: null,
          lastSyncError: null,
        })
        .returning();

      // Audit log
      await logIntegration(
        'integration_connected',
        pendingState.orgId,
        pendingState.userId,
        provider,
        integration.id,
        req.ip
      );

      // Redirect to success page
      const successUrl = new URL('/settings/integrations', process.env.APP_URL);
      successUrl.searchParams.set('connected', provider);
      res.redirect(successUrl.toString());
    } catch (error) {
      console.error('[OAUTH] Callback error:', error);
      redirectWithError(res, 'An error occurred during authorization');
    }
  }
);

// ============================================================================
// DISCONNECT INTEGRATION
// ============================================================================

/**
 * DELETE /api/oauth/disconnect/:integrationId
 * Disconnects an integration
 */
oauthRouter.delete(
  '/disconnect/:integrationId',
  requireAuth,
  csrfProtection,
  authorize('integrations:disconnect'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;
      const { integrationId } = req.params;

      // Find integration (tenant-scoped)
      const [integration] = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.id, integrationId),
            eq(integrations.orgId, context.orgId)
          )
        )
        .limit(1);

      if (!integration) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Integration not found' },
        });
      }

      // Revoke tokens with provider if possible
      await revokeProviderTokens(integration);

      // Update status to disconnected (soft delete for audit trail)
      await db
        .update(integrations)
        .set({
          status: 'disconnected',
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
          metadata: {
            ...integration.metadata,
            disconnectedAt: new Date().toISOString(),
            disconnectedBy: context.userId,
          },
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integrationId));

      // Audit log
      await logIntegration(
        'integration_disconnected',
        context.orgId,
        context.userId,
        integration.type,
        integrationId,
        req.ip
      );

      res.json({
        success: true,
        data: { message: 'Integration disconnected' },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET INTEGRATION STATUS
// ============================================================================

/**
 * GET /api/oauth/integrations
 * Lists all integrations for the organization
 */
oauthRouter.get(
  '/integrations',
  requireAuth,
  authorize('integrations:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;

      const orgIntegrations = await db
        .select({
          id: integrations.id,
          type: integrations.type,
          status: integrations.status,
          scopes: integrations.scopes,
          externalAccountId: integrations.externalAccountId,
          lastSyncAt: integrations.lastSyncAt,
          lastSyncError: integrations.lastSyncError,
          createdAt: integrations.createdAt,
          // Never expose tokens!
        })
        .from(integrations)
        .where(eq(integrations.orgId, context.orgId));

      res.json({
        success: true,
        data: orgIntegrations,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh tokens for an integration
 * Called automatically when tokens are about to expire
 */
export async function refreshIntegrationTokens(integrationId: string): Promise<boolean> {
  try {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, integrationId))
      .limit(1);

    if (!integration || integration.status !== 'connected') {
      return false;
    }

    // Check if refresh token is expired
    if (integration.refreshTokenExpiresAt && integration.refreshTokenExpiresAt < new Date()) {
      // Mark as expired
      await db
        .update(integrations)
        .set({
          status: 'expired',
          lastSyncError: 'Refresh token expired',
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integrationId));
      return false;
    }

    // Decrypt refresh token
    const tokens = decryptTokens({
      encryptedAccessToken: integration.encryptedAccessToken || '',
      encryptedRefreshToken: integration.encryptedRefreshToken || '',
    });

    if (!tokens.refreshToken) {
      return false;
    }

    // Get provider config
    const config = getProviderConfig(integration.type);
    if (!config) {
      return false;
    }

    // Request new tokens
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[OAUTH] Token refresh failed for ${integrationId}: ${errorText}`);
      
      // Mark as error
      await db
        .update(integrations)
        .set({
          lastSyncError: 'Token refresh failed',
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integrationId));
      
      return false;
    }

    const newTokens = await tokenResponse.json();

    // Encrypt new tokens
    const encryptedTokens = encryptTokens({
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || tokens.refreshToken, // Some providers don't rotate refresh tokens
      expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      tokenType: newTokens.token_type,
    });

    // Update database
    await db
      .update(integrations)
      .set({
        encryptedAccessToken: encryptedTokens.encryptedAccessToken,
        encryptedRefreshToken: encryptedTokens.encryptedRefreshToken,
        tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        refreshTokenExpiresAt: newTokens.x_refresh_token_expires_in
          ? new Date(Date.now() + newTokens.x_refresh_token_expires_in * 1000)
          : integration.refreshTokenExpiresAt,
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));

    // Audit log
    await logIntegration(
      'integration_token_refreshed',
      integration.orgId,
      'system',
      integration.type,
      integrationId
    );

    return true;
  } catch (error) {
    console.error(`[OAUTH] Token refresh error for ${integrationId}:`, error);
    return false;
  }
}

/**
 * Get valid access token for an integration
 * Automatically refreshes if needed
 */
export async function getValidAccessToken(integrationId: string): Promise<string | null> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration || integration.status !== 'connected') {
    return null;
  }

  // Check if token needs refresh (5 minute buffer)
  const needsRefresh = integration.tokenExpiresAt 
    && integration.tokenExpiresAt < new Date(Date.now() + 5 * 60 * 1000);

  if (needsRefresh) {
    const refreshed = await refreshIntegrationTokens(integrationId);
    if (!refreshed) {
      return null;
    }

    // Re-fetch integration with new tokens
    const [updatedIntegration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, integrationId))
      .limit(1);

    if (!updatedIntegration?.encryptedAccessToken) {
      return null;
    }

    const tokens = decryptTokens({
      encryptedAccessToken: updatedIntegration.encryptedAccessToken,
      encryptedRefreshToken: updatedIntegration.encryptedRefreshToken || '',
    });

    return tokens.accessToken;
  }

  // Return existing token
  const tokens = decryptTokens({
    encryptedAccessToken: integration.encryptedAccessToken || '',
    encryptedRefreshToken: integration.encryptedRefreshToken || '',
  });

  return tokens.accessToken;
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

const webhookSchema = z.object({
  eventType: z.string(),
  payload: z.unknown(),
});

/**
 * POST /api/oauth/webhook/:provider
 * Handles incoming webhooks from providers
 */
oauthRouter.post(
  '/webhook/:provider',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider } = req.params;

      // Get raw body for signature verification
      const rawBody = JSON.stringify(req.body);
      const signature = req.headers['intuit-signature'] 
        || req.headers['x-webhook-signature']
        || '';

      // Verify webhook signature
      const isValid = await verifyWebhookSignature(provider, rawBody, signature as string);
      if (!isValid) {
        console.warn(`[WEBHOOK] Invalid signature for ${provider}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Parse webhook payload
      const webhook = webhookSchema.safeParse(req.body);
      if (!webhook.success) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      // Process webhook (implement provider-specific handling)
      await processWebhook(provider, webhook.data.eventType, webhook.data.payload);

      // Always return 200 to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('[WEBHOOK] Error processing webhook:', error);
      // Still return 200 to prevent retries for unrecoverable errors
      res.status(200).json({ received: true, error: 'Processing error' });
    }
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function redirectWithError(res: Response, message: string): void {
  const errorUrl = new URL('/settings/integrations', process.env.APP_URL);
  errorUrl.searchParams.set('error', message);
  res.redirect(errorUrl.toString());
}

async function revokeProviderTokens(integration: typeof integrations.$inferSelect): Promise<void> {
  if (!integration.encryptedAccessToken) return;

  try {
    const tokens = decryptTokens({
      encryptedAccessToken: integration.encryptedAccessToken,
      encryptedRefreshToken: integration.encryptedRefreshToken || '',
    });

    // Provider-specific revocation
    if (integration.type === 'quickbooks') {
      const config = getProviderConfig('quickbooks');
      if (config) {
        await fetch('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          },
          body: JSON.stringify({ token: tokens.accessToken }),
        });
      }
    }
  } catch (error) {
    console.warn('[OAUTH] Failed to revoke provider tokens:', error);
    // Non-fatal - we still disconnect locally
  }
}

async function verifyWebhookSignature(
  provider: string,
  payload: string,
  signature: string
): Promise<boolean> {
  if (!signature) return false;

  const webhookSecrets: Record<string, string | undefined> = {
    quickbooks: process.env.QUICKBOOKS_WEBHOOK_SECRET,
  };

  const secret = webhookSecrets[provider];
  if (!secret) {
    console.warn(`[WEBHOOK] No secret configured for provider: ${provider}`);
    return false;
  }

  // Verify HMAC signature
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function processWebhook(
  provider: string,
  eventType: string,
  payload: unknown
): Promise<void> {
  console.log(`[WEBHOOK] Processing ${provider} event: ${eventType}`);
  
  // Implement provider-specific webhook handling
  // This would typically:
  // 1. Parse the event type
  // 2. Find the relevant integration by external account ID
  // 3. Process the event (sync data, update status, etc.)
  // 4. Log the event

  // For now, just log
  // TODO: Implement specific handlers for each provider/event type
}

// ============================================================================
// TOKEN REFRESH SCHEDULER
// ============================================================================

/**
 * Background job to refresh tokens before they expire
 * Should be called periodically (e.g., every 15 minutes)
 */
export async function refreshExpiringTokens(): Promise<void> {
  try {
    // Find integrations with tokens expiring in the next hour
    const expiringThreshold = new Date(Date.now() + 60 * 60 * 1000);

    const expiringIntegrations = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.status, 'connected'),
          // Note: Drizzle comparison - this is simplified
        )
      );

    for (const integration of expiringIntegrations) {
      await refreshIntegrationTokens(integration.id);
    }
  } catch (error) {
    console.error('[OAUTH] Error refreshing expiring tokens:', error);
  }
}

export default oauthRouter;
