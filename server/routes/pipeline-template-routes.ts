/**
 * Pipeline Template Routes
 *
 * CRUD for pipeline templates (pre-configured stage sequences by deal type)
 * and applying a template to create a new pipeline deal.
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = Router();

async function getDb() {
  const { db } = await import('../db');
  return db;
}

async function getSchema() {
  return import('@shared/schema');
}

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || null;
}

// GET /templates — list all templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const templates = await db
      .select()
      .from(schema.pipelineTemplates)
      .where(eq(schema.pipelineTemplates.orgId, orgId))
      .orderBy(desc(schema.pipelineTemplates.createdAt));

    res.json(templates);
  } catch (error) {
    console.error('Error fetching pipeline templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /templates — create a template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { name, dealType, stages, defaultChecklistTemplate, isDefault } = req.body;
    if (!name || !dealType) {
      return res.status(400).json({ error: 'name and dealType are required' });
    }

    const db = await getDb();
    const schema = await getSchema();

    const [template] = await db.insert(schema.pipelineTemplates).values({
      orgId,
      name,
      dealType,
      stages: stages || [],
      defaultChecklistTemplate: defaultChecklistTemplate || null,
      isDefault: isDefault ?? false,
    }).returning();

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating pipeline template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /templates/:id — update template
router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { id } = req.params;
    const { name, dealType, stages, defaultChecklistTemplate, isDefault } = req.body;

    const db = await getDb();
    const schema = await getSchema();

    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (dealType !== undefined) updates.dealType = dealType;
    if (stages !== undefined) updates.stages = stages;
    if (defaultChecklistTemplate !== undefined) updates.defaultChecklistTemplate = defaultChecklistTemplate;
    if (isDefault !== undefined) updates.isDefault = isDefault;

    const [updated] = await db.update(schema.pipelineTemplates)
      .set(updates)
      .where(and(
        eq(schema.pipelineTemplates.id, id),
        eq(schema.pipelineTemplates.orgId, orgId),
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Template not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating pipeline template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /templates/:id
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { id } = req.params;
    const db = await getDb();
    const schema = await getSchema();

    const [deleted] = await db.delete(schema.pipelineTemplates)
      .where(and(
        eq(schema.pipelineTemplates.id, id),
        eq(schema.pipelineTemplates.orgId, orgId),
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pipeline template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// POST /templates/:id/apply — apply template to create deal with pre-configured stages
router.post('/templates/:id/apply', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(401).json({ error: 'Authentication required' });

    const { id } = req.params;
    const { dealTitle, dealValue, pipelineId } = req.body;

    if (!dealTitle) return res.status(400).json({ error: 'dealTitle is required' });

    const db = await getDb();
    const schema = await getSchema();

    // Get template
    const [template] = await db
      .select()
      .from(schema.pipelineTemplates)
      .where(and(
        eq(schema.pipelineTemplates.id, id),
        eq(schema.pipelineTemplates.orgId, orgId),
      ))
      .limit(1);

    if (!template) return res.status(404).json({ error: 'Template not found' });

    const templateStages = (template.stages as any[]) || [];
    const firstStage = templateStages[0];

    // Create the deal using the first stage from the template
    const [deal] = await db.insert(schema.crmDeals).values({
      orgId,
      title: dealTitle,
      amount: dealValue ? String(dealValue) : null,
      stage: firstStage?.name || 'lead',
      pipelineId: pipelineId || null,
      assetClass: template.dealType === 'acquisition' ? 'marina' : undefined,
      priority: 'medium',
      currentStageEnteredAt: new Date(),
      ownerId: userId,
    }).returning();

    res.status(201).json({
      deal,
      appliedTemplate: {
        id: template.id,
        name: template.name,
        stages: templateStages,
      },
    });
  } catch (error) {
    console.error('Error applying pipeline template:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

export default router;
