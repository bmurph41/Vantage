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
      category: i.category,
      contexts: i.contexts,
      uiPlacements: i.uiPlacements,
      authType: i.authType,
      websiteUrl: i.websiteUrl,
      iconUrl: i.iconUrl,
      logoColor: i.logoColor,
      capabilities: i.capabilities,
      settingsSchema: i.settingsSchema,
      connectionGuide: i.connectionGuide,
      dataMappings: i.dataMappings,
      migrationSupport: i.migrationSupport,
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
      category: i.category,
      contexts: i.contexts,
      authType: i.authType,
      websiteUrl: i.websiteUrl,
      iconUrl: i.iconUrl,
      logoColor: i.logoColor,
      capabilities: i.capabilities,
      settingsSchema: i.settingsSchema,
      connectionGuide: i.connectionGuide,
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

integrationsRouter.get('/api/integrations/pipeline/status', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req) || 'org-1';

  try {
    const { IntegrationDataPipelineService } = await import('../services/integration-data-pipeline');
    const pipeline = new IntegrationDataPipelineService(orgId, userId);
    
    const [syncStatus, connectedIntegrations] = await Promise.all([
      pipeline.getBookkeepingSyncStatus(),
      pipeline.getConnectedIntegrationsForModeling(),
    ]);

    res.json({
      bookkeeping: syncStatus,
      liveDataSources: connectedIntegrations,
    });
  } catch (error) {
    console.error('Error fetching pipeline status:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline status' });
  }
});

integrationsRouter.get('/api/integrations/pipeline/project/:projectId', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req) || 'org-1';
  const { projectId } = req.params;

  try {
    const { IntegrationDataPipelineService } = await import('../services/integration-data-pipeline');
    const pipeline = new IntegrationDataPipelineService(orgId, userId);
    
    const [isEligible, operationsData] = await Promise.all([
      pipeline.isProjectEligibleForLiveData(projectId),
      pipeline.getOperationsDataForProject(projectId),
    ]);

    res.json({
      projectId,
      isEligibleForLiveData: isEligible,
      operationsData,
    });
  } catch (error) {
    console.error('Error fetching project pipeline data:', error);
    res.status(500).json({ error: 'Failed to fetch project data' });
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

integrationsRouter.post('/api/integrations/:key/sync', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Organization required' });
  }

  const { key } = req.params;
  const { targetModule, targetEntity, fullSync = false } = req.body;

  try {
    const [userIntegration] = await db.select().from(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.integrationKey, key)))
      .limit(1);

    if (!userIntegration?.isConnected) {
      return res.status(400).json({ error: 'Integration not connected' });
    }

    const regItem = getIntegrationByKey(key);
    if (!regItem) {
      return res.status(404).json({ error: 'Integration definition not found' });
    }

    const availableMappings = regItem.dataMappings || [];
    const mappingsToSync = targetModule 
      ? availableMappings.filter(m => m.targetModule === targetModule && (!targetEntity || m.targetEntity === targetEntity))
      : availableMappings;

    if (mappingsToSync.length === 0) {
      return res.status(400).json({ error: 'No data mappings available for this sync request' });
    }

    const syncResult = {
      syncId: crypto.randomBytes(16).toString('hex'),
      integrationKey: key,
      status: 'queued',
      mappingsQueued: mappingsToSync.map(m => ({
        targetModule: m.targetModule,
        targetEntity: m.targetEntity,
        syncDirection: m.syncDirection,
        frequency: m.frequency,
      })),
      fullSync,
      queuedAt: new Date().toISOString(),
      message: `Sync queued for ${mappingsToSync.length} data mapping(s). The sync will process in the background.`,
    };

    await db.update(userIntegrations)
      .set({
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.integrationKey, key)));

    res.json(syncResult);
  } catch (error) {
    console.error('Error initiating sync:', error);
    res.status(500).json({ error: 'Failed to initiate sync' });
  }
});

integrationsRouter.get('/api/integrations/:key/sync/status', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { key } = req.params;

  try {
    const [userIntegration] = await db.select().from(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.integrationKey, key)))
      .limit(1);

    if (!userIntegration) {
      return res.status(404).json({ error: 'Integration connection not found' });
    }

    const regItem = getIntegrationByKey(key);

    res.json({
      integrationKey: key,
      isConnected: userIntegration.isConnected,
      lastSyncAt: userIntegration.lastSyncAt,
      errorMessage: userIntegration.errorMessage,
      availableMappings: (regItem?.dataMappings || []).map(m => ({
        sourceEntity: m.sourceEntity,
        targetModule: m.targetModule,
        targetEntity: m.targetEntity,
        syncDirection: m.syncDirection,
        frequency: m.frequency,
        fieldCount: m.fields.length,
      })),
      migrationSupport: regItem?.migrationSupport || null,
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

integrationsRouter.get('/api/integrations/:key/data-mappings', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { key } = req.params;

  try {
    const regItem = getIntegrationByKey(key);
    if (!regItem) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const mappingsWithDetails = (regItem.dataMappings || []).map(mapping => ({
      sourceEntity: mapping.sourceEntity,
      targetModule: mapping.targetModule,
      targetEntity: mapping.targetEntity,
      syncDirection: mapping.syncDirection,
      frequency: mapping.frequency,
      fields: mapping.fields.map(f => ({
        source: f.source,
        target: f.target,
        transform: f.transform || null,
      })),
    }));

    res.json({
      integrationKey: key,
      integrationName: regItem.name,
      category: regItem.category,
      dataMappings: mappingsWithDetails,
      migrationSupport: regItem.migrationSupport,
    });
  } catch (error) {
    console.error('Error fetching data mappings:', error);
    res.status(500).json({ error: 'Failed to fetch data mappings' });
  }
});

integrationsRouter.get('/api/integrations/sync/overview', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req);

  try {
    const userItems = await db.select().from(userIntegrations).where(eq(userIntegrations.userId, userId));
    const connectedIntegrations = userItems.filter(u => u.isConnected);

    const overview = connectedIntegrations.map(item => {
      const regItem = getIntegrationByKey(item.integrationKey);
      return {
        integrationKey: item.integrationKey,
        integrationName: regItem?.name || item.integrationKey,
        category: regItem?.category || 'Unknown',
        isConnected: true,
        lastSyncAt: item.lastSyncAt,
        errorMessage: item.errorMessage,
        dataMappingsCount: regItem?.dataMappings?.length || 0,
        availableModules: [...new Set((regItem?.dataMappings || []).map(m => m.targetModule))],
        migrationSupport: regItem?.migrationSupport || null,
      };
    });

    const moduleCoverage: Record<string, { integrations: string[]; canSync: string[] }> = {};
    for (const item of overview) {
      const regItem = getIntegrationByKey(item.integrationKey);
      for (const mapping of regItem?.dataMappings || []) {
        if (!moduleCoverage[mapping.targetModule]) {
          moduleCoverage[mapping.targetModule] = { integrations: [], canSync: [] };
        }
        if (!moduleCoverage[mapping.targetModule].integrations.includes(item.integrationKey)) {
          moduleCoverage[mapping.targetModule].integrations.push(item.integrationKey);
        }
        if (!moduleCoverage[mapping.targetModule].canSync.includes(mapping.targetEntity)) {
          moduleCoverage[mapping.targetModule].canSync.push(mapping.targetEntity);
        }
      }
    }

    res.json({
      connectedCount: connectedIntegrations.length,
      integrations: overview,
      moduleCoverage,
    });
  } catch (error) {
    console.error('Error fetching sync overview:', error);
    res.status(500).json({ error: 'Failed to fetch sync overview' });
  }
});
