// ============================================================
// Sales Comps Extended Routes — CRUD for SC sub-tables
// File: server/routes/sales-comps-extended-routes.ts
//
// Mount in server/routes.ts:
//   import { salesCompsExtendedRouter } from './routes/sales-comps-extended-routes';
//   app.use('/api/sales-comps', salesCompsExtendedRouter);
// ============================================================

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import {
  scSavedFilters,
  scCompTags,
  scCompTagAssignments,
  scScenarios,
  scScenarioComps,
  scMarketBenchmarks,
  scImportBatches,
  insertScImportBatchSchema,
} from '@shared/schema';

const router = Router();

// ============================================================
// Saved Filters
// ============================================================

// GET /saved-filters - list saved filters for current user
router.get('/saved-filters', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const filters = await db.select()
      .from(scSavedFilters)
      .where(and(
        orgId ? eq(scSavedFilters.orgId, orgId) : undefined as any,
        userId ? eq(scSavedFilters.userId, userId) : undefined as any,
      ))
      .orderBy(desc(scSavedFilters.createdAt));
    res.json(filters);
  } catch (error: any) {
    console.error('Error listing saved filters:', error);
    res.status(500).json({ error: 'Failed to list saved filters', message: error.message });
  }
});

// POST /saved-filters - create saved filter
router.post('/saved-filters', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { name, description, filterConfig, isDefault, isShared, sortOrder } = req.body;
    if (!name || !filterConfig) {
      return res.status(400).json({ error: 'name and filterConfig are required' });
    }
    const [filter] = await db.insert(scSavedFilters)
      .values({
        orgId,
        userId,
        name,
        description,
        filterConfig,
        isDefault: isDefault ?? false,
        isShared: isShared ?? false,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    res.status(201).json(filter);
  } catch (error: any) {
    console.error('Error creating saved filter:', error);
    res.status(500).json({ error: 'Failed to create saved filter', message: error.message });
  }
});

// DELETE /saved-filters/:id - delete saved filter
router.delete('/saved-filters/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [deleted] = await db.delete(scSavedFilters)
      .where(and(
        eq(scSavedFilters.id, req.params.id),
        orgId ? eq(scSavedFilters.orgId, orgId) : undefined as any,
      ))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Saved filter not found' });
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error deleting saved filter:', error);
    res.status(500).json({ error: 'Failed to delete saved filter', message: error.message });
  }
});

// ============================================================
// Tags
// ============================================================

// GET /tags - list comp tags
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const tags = await db.select()
      .from(scCompTags)
      .where(orgId ? eq(scCompTags.orgId, orgId) : undefined as any)
      .orderBy(desc(scCompTags.createdAt));
    res.json(tags);
  } catch (error: any) {
    console.error('Error listing comp tags:', error);
    res.status(500).json({ error: 'Failed to list tags', message: error.message });
  }
});

// POST /tags - create comp tag
router.post('/tags', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const [tag] = await db.insert(scCompTags)
      .values({ orgId, name, color, createdBy: userId })
      .returning();
    res.status(201).json(tag);
  } catch (error: any) {
    console.error('Error creating comp tag:', error);
    res.status(500).json({ error: 'Failed to create tag', message: error.message });
  }
});

// DELETE /tags/:id - delete comp tag
router.delete('/tags/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [deleted] = await db.delete(scCompTags)
      .where(and(
        eq(scCompTags.id, req.params.id),
        orgId ? eq(scCompTags.orgId, orgId) : undefined as any,
      ))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Tag not found' });
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error deleting comp tag:', error);
    res.status(500).json({ error: 'Failed to delete tag', message: error.message });
  }
});

// ============================================================
// Tag Assignments
// ============================================================

// POST /tags/assign - assign tag to comp
router.post('/tags/assign', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { compId, tagId } = req.body;
    if (!compId || !tagId) {
      return res.status(400).json({ error: 'compId and tagId are required' });
    }
    const [assignment] = await db.insert(scCompTagAssignments)
      .values({ compId, tagId, orgId, assignedBy: userId })
      .returning();
    res.status(201).json(assignment);
  } catch (error: any) {
    console.error('Error assigning tag:', error);
    res.status(500).json({ error: 'Failed to assign tag', message: error.message });
  }
});

// DELETE /tags/unassign - remove tag from comp
router.delete('/tags/unassign', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { compId, tagId } = req.body;
    if (!compId || !tagId) {
      return res.status(400).json({ error: 'compId and tagId are required' });
    }
    const [deleted] = await db.delete(scCompTagAssignments)
      .where(and(
        eq(scCompTagAssignments.compId, compId),
        eq(scCompTagAssignments.tagId, tagId),
        orgId ? eq(scCompTagAssignments.orgId, orgId) : undefined as any,
      ))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Tag assignment not found' });
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error unassigning tag:', error);
    res.status(500).json({ error: 'Failed to unassign tag', message: error.message });
  }
});

// ============================================================
// Scenarios
// ============================================================

// GET /scenarios - list scenarios
router.get('/scenarios', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const scenarios = await db.select()
      .from(scScenarios)
      .where(orgId ? eq(scScenarios.orgId, orgId) : undefined as any)
      .orderBy(desc(scScenarios.createdAt));
    res.json(scenarios);
  } catch (error: any) {
    console.error('Error listing scenarios:', error);
    res.status(500).json({ error: 'Failed to list scenarios', message: error.message });
  }
});

// POST /scenarios - create scenario
router.post('/scenarios', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { name, description, dealId, projectId, modelingProjectId, status } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const [scenario] = await db.insert(scScenarios)
      .values({
        orgId,
        name,
        description,
        dealId,
        projectId,
        modelingProjectId,
        status: status ?? 'active',
        createdBy: userId,
      })
      .returning();
    res.status(201).json(scenario);
  } catch (error: any) {
    console.error('Error creating scenario:', error);
    res.status(500).json({ error: 'Failed to create scenario', message: error.message });
  }
});

// GET /scenarios/:id - get scenario
router.get('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [scenario] = await db.select()
      .from(scScenarios)
      .where(and(
        eq(scScenarios.id, req.params.id),
        orgId ? eq(scScenarios.orgId, orgId) : undefined as any,
      ))
      .limit(1);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    res.json(scenario);
  } catch (error: any) {
    console.error('Error getting scenario:', error);
    res.status(500).json({ error: 'Failed to get scenario', message: error.message });
  }
});

// PATCH /scenarios/:id - update scenario
router.patch('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { name, description, dealId, projectId, modelingProjectId, status } = req.body;
    const [scenario] = await db.update(scScenarios)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(dealId !== undefined && { dealId }),
        ...(projectId !== undefined && { projectId }),
        ...(modelingProjectId !== undefined && { modelingProjectId }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(scScenarios.id, req.params.id),
        orgId ? eq(scScenarios.orgId, orgId) : undefined as any,
      ))
      .returning();
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    res.json(scenario);
  } catch (error: any) {
    console.error('Error updating scenario:', error);
    res.status(500).json({ error: 'Failed to update scenario', message: error.message });
  }
});

// ============================================================
// Scenario Comps
// ============================================================

// POST /scenarios/:id/comps - add comp to scenario
router.post('/scenarios/:id/comps', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { compId, notes } = req.body;
    if (!compId) {
      return res.status(400).json({ error: 'compId is required' });
    }
    const [scenarioComp] = await db.insert(scScenarioComps)
      .values({
        scenarioId: req.params.id,
        compId,
        orgId,
        addedBy: userId,
        notes,
      })
      .returning();
    res.status(201).json(scenarioComp);
  } catch (error: any) {
    console.error('Error adding comp to scenario:', error);
    res.status(500).json({ error: 'Failed to add comp to scenario', message: error.message });
  }
});

// DELETE /scenarios/:id/comps/:compId - remove comp from scenario
router.delete('/scenarios/:id/comps/:compId', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [deleted] = await db.delete(scScenarioComps)
      .where(and(
        eq(scScenarioComps.scenarioId, req.params.id),
        eq(scScenarioComps.compId, req.params.compId),
        orgId ? eq(scScenarioComps.orgId, orgId) : undefined as any,
      ))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Scenario comp not found' });
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error removing comp from scenario:', error);
    res.status(500).json({ error: 'Failed to remove comp from scenario', message: error.message });
  }
});

// ============================================================
// Market Benchmarks
// ============================================================

// GET /benchmarks - list market benchmarks
router.get('/benchmarks', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const benchmarks = await db.select()
      .from(scMarketBenchmarks)
      .where(orgId ? eq(scMarketBenchmarks.orgId, orgId) : undefined as any)
      .orderBy(desc(scMarketBenchmarks.year));
    res.json(benchmarks);
  } catch (error: any) {
    console.error('Error listing market benchmarks:', error);
    res.status(500).json({ error: 'Failed to list benchmarks', message: error.message });
  }
});

// POST /benchmarks - create market benchmark
router.post('/benchmarks', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { name, source, region, state, waterType, year, quarter, metrics } = req.body;
    if (!name || !source || year === undefined || !metrics) {
      return res.status(400).json({ error: 'name, source, year, and metrics are required' });
    }
    const [benchmark] = await db.insert(scMarketBenchmarks)
      .values({
        orgId,
        name,
        source,
        region,
        state,
        waterType,
        year,
        quarter,
        metrics,
        createdBy: userId,
      })
      .returning();
    res.status(201).json(benchmark);
  } catch (error: any) {
    console.error('Error creating market benchmark:', error);
    res.status(500).json({ error: 'Failed to create benchmark', message: error.message });
  }
});

// ============================================================
// Import Batches
// ============================================================

// GET /import-batches - list import batches
router.get('/import-batches', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const batches = await db.select()
      .from(scImportBatches)
      .where(orgId ? eq(scImportBatches.orgId, orgId) : undefined as any)
      .orderBy(desc(scImportBatches.createdAt));
    res.json(batches);
  } catch (error: any) {
    console.error('Error listing import batches:', error);
    res.status(500).json({ error: 'Failed to list import batches', message: error.message });
  }
});

// POST /import-batches - create import batch
router.post('/import-batches', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const parsed = insertScImportBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const [batch] = await db.insert(scImportBatches)
      .values({ ...parsed.data, orgId, createdBy: userId })
      .returning();
    res.status(201).json(batch);
  } catch (error: any) {
    console.error('Error creating import batch:', error);
    res.status(500).json({ error: 'Failed to create import batch', message: error.message });
  }
});

// GET /import-batches/:id - get import batch
router.get('/import-batches/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const [batch] = await db.select()
      .from(scImportBatches)
      .where(and(
        eq(scImportBatches.id, req.params.id),
        orgId ? eq(scImportBatches.orgId, orgId) : undefined as any,
      ))
      .limit(1);
    if (!batch) return res.status(404).json({ error: 'Import batch not found' });
    res.json(batch);
  } catch (error: any) {
    console.error('Error getting import batch:', error);
    res.status(500).json({ error: 'Failed to get import batch', message: error.message });
  }
});

export default router;
export { router as salesCompsExtendedRouter };
