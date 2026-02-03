import { Router, Request, Response } from 'express';
import { db } from '../db';
import { userIntegrations, integrationSyncHistory } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ConnectorFactory } from '../integrations/connectors';
import { OperationsDataSyncService } from '../services/operations-data-sync';

const router = Router();

const MARINA_INTEGRATIONS = [
  {
    key: 'dockmaster',
    name: 'DockMaster',
    description: 'Enterprise marina management with slip rentals, fuel, and service',
    logo: '/integrations/dockmaster.png',
    supportedModules: ['rent_roll', 'fuel_sales', 'ship_store'],
    authType: 'api_key',
    requiredFields: ['apiKey', 'siteId'],
  },
  {
    key: 'dockwa',
    name: 'Dockwa',
    description: 'Reservations, payments, and marina operations',
    logo: '/integrations/dockwa.png',
    supportedModules: ['rent_roll', 'fuel_sales'],
    authType: 'oauth2',
    requiredFields: ['apiKey', 'marinaId'],
  },
  {
    key: 'storable_marine',
    name: 'Storable Marine (Molo)',
    description: 'Cloud-based marina and boatyard management',
    logo: '/integrations/storable.png',
    supportedModules: ['rent_roll', 'fuel_sales'],
    authType: 'api_key',
    requiredFields: ['apiKey'],
  },
  {
    key: 'scribble',
    name: 'Scribble / MarinaGo',
    description: 'Marina management with reservations and fuel sales',
    logo: '/integrations/scribble.png',
    supportedModules: ['rent_roll', 'fuel_sales', 'ship_store'],
    authType: 'api_key',
    requiredFields: ['apiKey', 'siteCode'],
  },
  {
    key: 'marina_office',
    name: 'Marina Office',
    description: 'Traditional marina management software',
    logo: '/integrations/marina-office.png',
    supportedModules: ['rent_roll', 'fuel_sales', 'ship_store'],
    authType: 'basic',
    requiredFields: ['username', 'password', 'siteUrl'],
  },
];

router.get('/available', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const connected = await db
      .select({
        integrationKey: userIntegrations.integrationKey,
        isConnected: userIntegrations.isConnected,
        lastSyncAt: userIntegrations.lastSyncAt,
        errorMessage: userIntegrations.errorMessage,
      })
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId)
      ));

    const integrations = MARINA_INTEGRATIONS.map(integration => {
      const connection = connected.find(c => c.integrationKey === integration.key);
      return {
        ...integration,
        isConnected: connection?.isConnected || false,
        lastSyncAt: connection?.lastSyncAt || null,
        errorMessage: connection?.errorMessage || null,
      };
    });

    res.json({ integrations });
  } catch (error) {
    console.error('[marina-integrations] Error fetching available integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

router.get('/connected', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const connected = await db
      .select()
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId),
        eq(userIntegrations.isConnected, true)
      ));

    const enriched = connected.map(conn => {
      const info = MARINA_INTEGRATIONS.find(i => i.key === conn.integrationKey);
      return {
        id: conn.id,
        integrationKey: conn.integrationKey,
        name: info?.name || conn.integrationKey,
        description: info?.description,
        logo: info?.logo,
        supportedModules: info?.supportedModules || [],
        isConnected: conn.isConnected,
        lastSyncAt: conn.lastSyncAt,
        errorMessage: conn.errorMessage,
        connectedAt: conn.createdAt,
      };
    });

    res.json({ integrations: enriched });
  } catch (error) {
    console.error('[marina-integrations] Error fetching connected integrations:', error);
    res.status(500).json({ error: 'Failed to fetch connected integrations' });
  }
});

router.post('/connect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;
    const { integrationKey, credentials } = req.body;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!integrationKey || !credentials) {
      return res.status(400).json({ error: 'Integration key and credentials are required' });
    }

    const integrationInfo = MARINA_INTEGRATIONS.find(i => i.key === integrationKey);
    if (!integrationInfo) {
      return res.status(400).json({ error: 'Unknown integration' });
    }

    const missingFields = integrationInfo.requiredFields.filter(field => !credentials[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    const existing = await db.query.userIntegrations.findFirst({
      where: and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId),
        eq(userIntegrations.integrationKey, integrationKey)
      )
    });

    if (existing) {
      await db.update(userIntegrations)
        .set({
          encryptedAccessToken: JSON.stringify(credentials),
          isConnected: true,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(userIntegrations.id, existing.id));
    } else {
      await db.insert(userIntegrations).values({
        userId,
        orgId,
        integrationKey,
        encryptedAccessToken: JSON.stringify(credentials),
        isConnected: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    res.json({ success: true, message: `Connected to ${integrationInfo.name}` });
  } catch (error) {
    console.error('[marina-integrations] Error connecting integration:', error);
    res.status(500).json({ error: 'Failed to connect integration' });
  }
});

router.post('/disconnect/:integrationKey', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;
    const { integrationKey } = req.params;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await db.update(userIntegrations)
      .set({
        isConnected: false,
        encryptedAccessToken: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId),
        eq(userIntegrations.integrationKey, integrationKey)
      ));

    res.json({ success: true, message: 'Integration disconnected' });
  } catch (error) {
    console.error('[marina-integrations] Error disconnecting integration:', error);
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
});

router.post('/sync/:integrationKey', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;
    const { integrationKey } = req.params;
    const { entityTypes, fullSync } = req.body;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const integration = await db.query.userIntegrations.findFirst({
      where: and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId),
        eq(userIntegrations.integrationKey, integrationKey),
        eq(userIntegrations.isConnected, true)
      )
    });

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found or not connected' });
    }

    const syncService = new OperationsDataSyncService();
    const result = await syncService.syncFromIntegration({
      integrationKey,
      userId,
      orgId,
      entityTypes: entityTypes || ['slips', 'tenants', 'transactions'],
      fullSync: fullSync ?? true,
    });

    res.json({
      success: result.success,
      syncId: result.syncId,
      recordsProcessed: result.recordsProcessed,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      recordsFailed: result.recordsFailed,
      duration: result.duration,
      errors: result.errors,
      summary: result.summary,
    });
  } catch (error) {
    console.error('[marina-integrations] Error syncing integration:', error);
    res.status(500).json({ error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/sync-history/:integrationKey', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;
    const { integrationKey } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const history = await db
      .select()
      .from(integrationSyncHistory)
      .where(and(
        eq(integrationSyncHistory.userId, userId),
        eq(integrationSyncHistory.orgId, orgId),
        eq(integrationSyncHistory.integrationKey, integrationKey)
      ))
      .orderBy(desc(integrationSyncHistory.completedAt))
      .limit(limit);

    res.json({ history });
  } catch (error) {
    console.error('[marina-integrations] Error fetching sync history:', error);
    res.status(500).json({ error: 'Failed to fetch sync history' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const connected = await db
      .select()
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId),
        eq(userIntegrations.isConnected, true)
      ));

    const statuses = await Promise.all(connected.map(async (conn) => {
      const info = MARINA_INTEGRATIONS.find(i => i.key === conn.integrationKey);
      
      const [latestSync] = await db
        .select()
        .from(integrationSyncHistory)
        .where(and(
          eq(integrationSyncHistory.userId, userId),
          eq(integrationSyncHistory.orgId, orgId),
          eq(integrationSyncHistory.integrationKey, conn.integrationKey)
        ))
        .orderBy(desc(integrationSyncHistory.completedAt))
        .limit(1);

      return {
        integrationKey: conn.integrationKey,
        name: info?.name || conn.integrationKey,
        isConnected: true,
        lastSyncAt: conn.lastSyncAt,
        lastSyncStatus: latestSync?.status || null,
        lastSyncRecords: latestSync?.recordsProcessed || 0,
        lastSyncErrors: latestSync?.errorCount || 0,
        supportedModules: info?.supportedModules || [],
      };
    }));

    res.json({ 
      totalConnected: connected.length,
      integrations: statuses,
    });
  } catch (error) {
    console.error('[marina-integrations] Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

router.post('/test-connection/:integrationKey', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;
    const { integrationKey } = req.params;
    const { credentials } = req.body;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ConnectorFactory.isRegistered(integrationKey)) {
      return res.status(400).json({ error: 'Unknown integration', connected: false });
    }

    const connector = ConnectorFactory.create({
      integrationKey,
      credentials: credentials || {},
      settings: {},
      userId,
      orgId,
    });

    const result = await connector.testConnection();
    res.json(result);
  } catch (error) {
    console.error('[marina-integrations] Error testing connection:', error);
    res.status(500).json({ 
      connected: false, 
      message: error instanceof Error ? error.message : 'Connection test failed' 
    });
  }
});

export default router;
