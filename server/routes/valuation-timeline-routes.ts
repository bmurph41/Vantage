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
    const orgId = req.headers['x-org-id'] as string || (req as any).orgId;
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
    const orgId = req.headers['x-org-id'] as string || (req as any).orgId;
    
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
    const orgId = req.headers['x-org-id'] as string || (req as any).orgId;
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
    const orgId = req.headers['x-org-id'] as string || (req as any).orgId;
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
    const orgId = req.headers['x-org-id'] as string || (req as any).orgId;
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

export default router;
