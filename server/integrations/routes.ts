import { Router, Request, Response } from 'express';
import { db } from '../db';
import { integrations, userIntegrations, users } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { INTEGRATION_REGISTRY, getIntegrationByKey, getIntegrationsByContext } from './registry';
import { encrypt, decrypt } from './crypto';
import crypto from 'crypto';

export const integrationsRouter = Router();

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

function requireUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

integrationsRouter.get('/api/integrations', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const catalogItems = await db.select().from(integrations).where(eq(integrations.isActive, true));
    
    const userItems = await db.select().from(userIntegrations).where(eq(userIntegrations.userId, userId));
    const connectedSet = new Set(userItems.filter(u => u.isConnected).map(u => u.integrationKey));
    const userItemsMap = new Map(userItems.map(u => [u.integrationKey, u]));

    const items = catalogItems.map(i => ({
      key: i.key,
      name: i.name,
      description: i.description,
      categories: i.categories,
      contexts: i.contexts,
      uiPlacements: i.uiPlacements,
      authType: i.authType,
      websiteUrl: i.websiteUrl,
      iconUrl: i.iconUrl,
      capabilities: i.capabilities,
      settingsSchema: i.settingsSchema,
      status: connectedSet.has(i.key) ? 'connected' : 'available',
      lastSyncAt: userItemsMap.get(i.key)?.lastSyncAt || null,
      errorMessage: userItemsMap.get(i.key)?.errorMessage || null,
    }));

    res.json({ items });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

integrationsRouter.get('/api/integrations/context/:contextKey', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { contextKey } = req.params;

  try {
    const catalogItems = await db.select().from(integrations).where(eq(integrations.isActive, true));
    const userItems = await db.select().from(userIntegrations).where(eq(userIntegrations.userId, userId));
    const connectedSet = new Set(userItems.filter(u => u.isConnected).map(u => u.integrationKey));
    const userItemsMap = new Map(userItems.map(u => [u.integrationKey, u]));

    const regMap = new Map(INTEGRATION_REGISTRY.map(i => [i.key, i]));

    const filtered = catalogItems.filter(i => {
      const reg = regMap.get(i.key);
      return (i.contexts as string[])?.includes(contextKey) || reg?.contexts?.includes(contextKey);
    });

    const items = filtered.map(i => ({
      key: i.key,
      name: i.name,
      description: i.description,
      categories: i.categories,
      contexts: i.contexts,
      authType: i.authType,
      websiteUrl: i.websiteUrl,
      iconUrl: i.iconUrl,
      capabilities: i.capabilities,
      settingsSchema: i.settingsSchema,
      status: connectedSet.has(i.key) ? 'connected' : 'available',
      lastSyncAt: userItemsMap.get(i.key)?.lastSyncAt || null,
      settings: userItemsMap.get(i.key)?.settings || {},
    }));

    res.json({ contextKey, items });
  } catch (error) {
    console.error('Error fetching context integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations for context' });
  }
});

integrationsRouter.get('/api/integrations/:key', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { key } = req.params;

  try {
    const [integration] = await db.select().from(integrations).where(eq(integrations.key, key)).limit(1);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const [userIntegration] = await db.select().from(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.integrationKey, key)))
      .limit(1);

    res.json({
      ...integration,
      status: userIntegration?.isConnected ? 'connected' : 'available',
      settings: userIntegration?.settings || {},
      lastSyncAt: userIntegration?.lastSyncAt || null,
      errorMessage: userIntegration?.errorMessage || null,
    });
  } catch (error) {
    console.error('Error fetching integration:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

integrationsRouter.post('/api/integrations/:key/connect', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { key } = req.params;
  const { apiKey, settings } = req.body;
  const orgId = getOrgId(req);

  try {
    const [integration] = await db.select().from(integrations).where(eq(integrations.key, key)).limit(1);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const regItem = getIntegrationByKey(key);

    if (integration.authType === 'oauth' || regItem?.authType === 'oauth') {
      const state = crypto.randomBytes(32).toString('hex');
      
      await db.insert(userIntegrations).values({
        userId,
        orgId,
        integrationKey: key,
        isConnected: false,
        oauthState: state,
        settings: settings || {},
      }).onConflictDoUpdate({
        target: [userIntegrations.userId, userIntegrations.integrationKey],
        set: {
          oauthState: state,
          settings: settings || {},
          updatedAt: new Date(),
        },
      });

      return res.json({
        authorizeUrl: `/api/integrations/${key}/oauth/authorize?state=${state}`,
        message: 'Redirect user to authorize URL',
      });
    }

    if (integration.authType === 'apiKey' || regItem?.authType === 'apiKey') {
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }

      const encryptedApiKey = encrypt(apiKey);

      await db.insert(userIntegrations).values({
        userId,
        orgId,
        integrationKey: key,
        isConnected: true,
        encryptedApiKey,
        settings: settings || {},
      }).onConflictDoUpdate({
        target: [userIntegrations.userId, userIntegrations.integrationKey],
        set: {
          isConnected: true,
          encryptedApiKey,
          settings: settings || {},
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

      return res.json({ success: true, status: 'connected' });
    }

    await db.insert(userIntegrations).values({
      userId,
      orgId,
      integrationKey: key,
      isConnected: true,
      settings: settings || {},
    }).onConflictDoUpdate({
      target: [userIntegrations.userId, userIntegrations.integrationKey],
      set: {
        isConnected: true,
        settings: settings || {},
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, status: 'connected' });
  } catch (error) {
    console.error('Error connecting integration:', error);
    res.status(500).json({ error: 'Failed to connect integration' });
  }
});

integrationsRouter.post('/api/integrations/:key/disconnect', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { key } = req.params;

  try {
    await db.update(userIntegrations)
      .set({
        isConnected: false,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        encryptedApiKey: null,
        tokenExpiresAt: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.integrationKey, key)));

    res.json({ success: true, status: 'disconnected' });
  } catch (error) {
    console.error('Error disconnecting integration:', error);
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
});

integrationsRouter.patch('/api/integrations/:key/settings', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { key } = req.params;
  const { settings } = req.body;

  try {
    const [userIntegration] = await db.select().from(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.integrationKey, key)))
      .limit(1);

    if (!userIntegration) {
      return res.status(404).json({ error: 'Integration connection not found' });
    }

    const [integration] = await db.select().from(integrations).where(eq(integrations.key, key)).limit(1);
    const schema = integration?.settingsSchema as { fields: Array<{ key: string; type: string }> } | null;
    
    const processedSettings: Record<string, any> = { ...userIntegration.settings };
    for (const [fieldKey, value] of Object.entries(settings || {})) {
      const field = schema?.fields?.find(f => f.key === fieldKey);
      if (field?.type === 'secret' && typeof value === 'string' && value) {
        processedSettings[fieldKey] = encrypt(value);
      } else {
        processedSettings[fieldKey] = value;
      }
    }

    await db.update(userIntegrations)
      .set({
        settings: processedSettings,
        updatedAt: new Date(),
      })
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.integrationKey, key)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating integration settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

integrationsRouter.get('/api/integrations/:key/oauth/authorize', async (req: Request, res: Response) => {
  const { key } = req.params;
  const { state } = req.query;

  res.status(501).json({ 
    error: 'OAuth not implemented', 
    message: `OAuth authorization for ${key} would redirect to the provider. State: ${state}` 
  });
});

integrationsRouter.get('/api/integrations/:key/oauth/callback', async (req: Request, res: Response) => {
  const { key } = req.params;
  const { code, state } = req.query;

  res.status(501).json({ 
    error: 'OAuth callback not implemented',
    message: `Would exchange code for tokens. Integration: ${key}, Code: ${code}, State: ${state}` 
  });
});
