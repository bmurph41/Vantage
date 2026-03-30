import { Router } from 'express';
import { valuationTimelineService } from '../services/valuation-timeline-service';
import { valuationSyncService } from '../services/valuation-sync-service';
import { z } from 'zod';

const router = Router();

const asOfQuerySchema = z.object({
  asOfDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

const createSnapshotSchema = z.object({
  asOfDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  trigger: z.enum(['manual', 'scheduled', 'data_change', 'comp_update', 'model_save']).optional(),
  triggerNote: z.string().optional(),
});

const timelineQuerySchema = z.object({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

router.get('/projects/:projectId/as-of', async (req, res) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
    const userId = req.headers['x-user-id'] as string || (req as any).userId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }
    
    const { projectId } = req.params;
    const query = asOfQuerySchema.parse(req.query);
    
    const result = await valuationTimelineService.getValuationAsOf({
      modelingProjectId: projectId,
      orgId,
      asOfDate: query.asOfDate,
      userId
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error getting valuation as-of:', error);
    res.status(500).json({ 
      error: 'Failed to get valuation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/projects/:projectId/timeline', async (req, res) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }
    
    const { projectId } = req.params;
    const query = timelineQuerySchema.parse(req.query);
    
    const results = await valuationTimelineService.getValuationTimeline(
      projectId,
      orgId,
      query.startDate,
      query.endDate
    );
    
    res.json(results);
  } catch (error) {
    console.error('Error getting valuation timeline:', error);
    res.status(500).json({ 
      error: 'Failed to get timeline',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/projects/:projectId/snapshots', async (req, res) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
    const userId = req.headers['x-user-id'] as string || (req as any).userId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }
    
    const { projectId } = req.params;
    const body = createSnapshotSchema.parse(req.body);
    
    const result = await valuationTimelineService.createSnapshot(
      {
        modelingProjectId: projectId,
        orgId,
        asOfDate: body.asOfDate,
        userId
      },
      body.trigger || 'manual',
      body.triggerNote
    );
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating valuation snapshot:', error);
    res.status(500).json({ 
      error: 'Failed to create snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/projects/:projectId/current', async (req, res) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
    const userId = req.headers['x-user-id'] as string || (req as any).userId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }
    
    const { projectId } = req.params;
    
    const result = await valuationTimelineService.getValuationAsOf({
      modelingProjectId: projectId,
      orgId,
      asOfDate: new Date(),
      userId
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error getting current valuation:', error);
    res.status(500).json({ 
      error: 'Failed to get current valuation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
    const userId = req.headers['x-user-id'] as string || (req as any).userId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }
    
    const result = await valuationSyncService.triggerManualSync(orgId, userId);
    
    res.json({ 
      success: true,
      message: `Synced ${result.projectsSynced} projects`,
      ...result
    });
  } catch (error) {
    console.error('Error syncing valuations:', error);
    res.status(500).json({ 
      error: 'Failed to sync valuations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const pushToModelingSchema = z.object({
  metrics: z.object({
    noi: z.number().optional(),
    grossRevenue: z.number().optional(),
    operatingExpenses: z.number().optional(),
    capRate: z.number().optional(),
    indicatedValue: z.number().optional(),
  }).optional(),
  note: z.string().optional(),
});

router.post('/projects/:projectId/push-to-modeling', async (req, res) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
    const userId = req.headers['x-user-id'] as string || (req as any).userId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }
    
    const { projectId } = req.params;
    const body = pushToModelingSchema.parse(req.body);
    
    const currentValuation = await valuationTimelineService.getValuationAsOf({
      modelingProjectId: projectId,
      orgId,
      asOfDate: new Date(),
      userId
    });
    
    if (!currentValuation) {
      return res.status(404).json({ error: 'No valuation data available' });
    }
    
    const { modelingProjects } = await import('@shared/schema');
    const { db } = await import('../db');
    const { eq } = await import('drizzle-orm');
    
    const metricsToUpdate = body.metrics || {
      noi: currentValuation.noi,
      grossRevenue: currentValuation.grossRevenue,
      operatingExpenses: currentValuation.operatingExpenses,
      capRate: currentValuation.capRate,
      indicatedValue: currentValuation.indicatedValue,
    };
    
    const updateData: Record<string, any> = {};
    if (metricsToUpdate.indicatedValue !== undefined) {
      updateData.currentValuation = String(metricsToUpdate.indicatedValue);
    }
    if (metricsToUpdate.capRate !== undefined) {
      updateData.year1CapRate = String(metricsToUpdate.capRate);
    }
    if (metricsToUpdate.noi !== undefined) {
      updateData.projectedNoi = String(metricsToUpdate.noi);
    }
    updateData.updatedAt = new Date();
    
    const [updated] = await db.update(modelingProjects)
      .set(updateData)
      .where(eq(modelingProjects.id, projectId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Modeling project not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Valuation metrics pushed to modeling project',
      project: updated,
      metricsPushed: metricsToUpdate
    });
  } catch (error) {
    console.error('Error pushing to modeling:', error);
    res.status(500).json({ 
      error: 'Failed to push metrics to modeling',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
