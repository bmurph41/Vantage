/**
 * Operations Sync Routes
 * 
 * API endpoints for syncing operations data from marina management systems
 * 
 * Endpoints:
 * - POST /fuel-sales/sync-from-integration - Sync fuel transaction data
 * - POST /rent-roll/sync-from-integration - Sync rent roll / lease data
 * - POST /ship-store/sync-from-integration - Sync ship store transaction data
 * - GET /sync-status - Get status of all sync operations
 * - POST /:integrationKey - Generic sync from specific integration
 * - GET /history/:integrationKey - Get sync history
 */

import { Router } from 'express';
import { z } from 'zod';
import { operationsDataSync } from '../services/operations-data-sync';

const router = Router();

interface AuthenticatedRequest {
  user?: {
    id: string;
    orgId: string;
  };
}

const syncRequestSchema = z.object({
  integrationKey: z.string().optional(),
  entityTypes: z.array(z.enum(['slips', 'tenants', 'transactions'])).optional(),
  fullSync: z.boolean().optional().default(false),
  since: z.string().datetime().optional(),
});

const moduleSyncRequestSchema = z.object({
  integrationKey: z.string().optional(),
  fullSync: z.boolean().optional().default(false),
  since: z.string().datetime().optional(),
});

/**
 * POST /fuel-sales/sync-from-integration
 * Sync fuel transaction data from marina management systems
 */
router.post('/fuel-sales/sync-from-integration', async (req: any, res) => {
  try {
    if (!req.user?.id || !req.user?.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const body = moduleSyncRequestSchema.parse(req.body || {});

    const result = await operationsDataSync.syncFuelSales({
      userId: req.user.id,
      orgId: req.user.orgId,
      integrationKey: body.integrationKey,
      fullSync: body.fullSync,
      since: body.since ? new Date(body.since) : undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Fuel Sales Sync] Error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      error: 'Fuel sales sync failed', 
      message: error.message 
    });
  }
});

/**
 * POST /rent-roll/sync-from-integration
 * Sync rent roll and lease data from marina management systems
 */
router.post('/rent-roll/sync-from-integration', async (req: any, res) => {
  try {
    if (!req.user?.id || !req.user?.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const body = moduleSyncRequestSchema.parse(req.body || {});

    const result = await operationsDataSync.syncRentRoll({
      userId: req.user.id,
      orgId: req.user.orgId,
      integrationKey: body.integrationKey,
      fullSync: body.fullSync,
      since: body.since ? new Date(body.since) : undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Rent Roll Sync] Error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      error: 'Rent roll sync failed', 
      message: error.message 
    });
  }
});

/**
 * POST /ship-store/sync-from-integration
 * Sync ship store transaction data from marina management systems
 */
router.post('/ship-store/sync-from-integration', async (req: any, res) => {
  try {
    if (!req.user?.id || !req.user?.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const body = moduleSyncRequestSchema.parse(req.body || {});

    const result = await operationsDataSync.syncShipStore({
      userId: req.user.id,
      orgId: req.user.orgId,
      integrationKey: body.integrationKey,
      fullSync: body.fullSync,
      since: body.since ? new Date(body.since) : undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Ship Store Sync] Error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      error: 'Ship store sync failed', 
      message: error.message 
    });
  }
});

/**
 * GET /sync-status
 * Get the status of all sync operations for the user
 */
router.get('/sync-status', async (req: any, res) => {
  try {
    if (!req.user?.id || !req.user?.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const status = await operationsDataSync.getSyncStatus(
      req.user.id, 
      req.user.orgId
    );

    res.json(status);
  } catch (error: any) {
    console.error('[Operations Sync Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get sync status', 
      message: error.message 
    });
  }
});

/**
 * POST /:integrationKey
 * Generic sync from a specific integration
 */
router.post('/:integrationKey', async (req: any, res) => {
  try {
    if (!req.user?.id || !req.user?.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { integrationKey } = req.params;
    const body = syncRequestSchema.parse(req.body || {});

    const result = await operationsDataSync.syncFromIntegration({
      integrationKey,
      userId: req.user.id,
      orgId: req.user.orgId,
      entityTypes: body.entityTypes as any,
      fullSync: body.fullSync,
      since: body.since ? new Date(body.since) : undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Operations Sync] Error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      error: 'Sync failed', 
      message: error.message 
    });
  }
});

/**
 * GET /history/:integrationKey
 * Get sync history for a specific integration
 */
router.get('/history/:integrationKey', async (req: any, res) => {
  try {
    if (!req.user?.id || !req.user?.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { integrationKey } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const history = await operationsDataSync.getSyncHistory(
      req.user.id,
      integrationKey,
      limit
    );

    res.json(history);
  } catch (error: any) {
    console.error('[Operations Sync History] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get sync history', 
      message: error.message 
    });
  }
});

/**
 * GET /integrations
 * Get list of supported integrations for operations sync
 */
router.get('/integrations', async (req: any, res) => {
  try {
    if (!req.user?.id || !req.user?.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const integrations = await operationsDataSync.getAvailableIntegrations(
      req.user.id,
      req.user.orgId
    );

    res.json(integrations);
  } catch (error: any) {
    console.error('[Operations Integrations] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get integrations', 
      message: error.message 
    });
  }
});

export default router;
