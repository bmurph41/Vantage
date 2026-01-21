import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { modelingScenarioTemplates, modelingCases, modelingProjects } from '@shared/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    orgId: string;
    role: string;
    email?: string;
    name?: string;
  };
}

const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  scope: z.enum(['org', 'user']),
  color: z.string().max(50).optional(),
  revenueGrowthRate: z.string().optional(),
  expenseGrowthRate: z.string().optional(),
  exitCapRate: z.string().optional(),
  occupancyRate: z.string().optional(),
  discountRate: z.string().optional(),
  holdPeriodYears: z.number().optional(),
  leaseUpSchedule: z.any().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const saveFromCaseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  scope: z.enum(['org', 'user']).default('org'),
});

const canAccessTemplate = (
  template: { scope: string; orgId: string | null; createdBy: string },
  userId: string,
  orgId: string
): boolean => {
  if (template.scope === 'global') return true;
  if (template.scope === 'org' && template.orgId === orgId) return true;
  if (template.scope === 'user' && template.createdBy === userId) return true;
  return false;
};

const canModifyTemplate = (
  template: { scope: string; orgId: string | null; createdBy: string; isSystem: boolean },
  userId: string,
  orgId: string
): boolean => {
  if (template.isSystem) return false;
  if (template.scope === 'global') return false;
  if (template.scope === 'org' && template.orgId === orgId && template.createdBy === userId) return true;
  if (template.scope === 'user' && template.createdBy === userId) return true;
  return false;
};

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    
    const templates = await db
      .select()
      .from(modelingScenarioTemplates)
      .where(
        or(
          eq(modelingScenarioTemplates.scope, 'global'),
          and(
            eq(modelingScenarioTemplates.scope, 'org'),
            eq(modelingScenarioTemplates.orgId, orgId)
          ),
          and(
            eq(modelingScenarioTemplates.scope, 'user'),
            eq(modelingScenarioTemplates.createdBy, userId)
          )
        )
      )
      .orderBy(desc(modelingScenarioTemplates.usageCount), modelingScenarioTemplates.name);
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching scenario templates:', error);
    res.status(500).json({ error: 'Failed to fetch scenario templates' });
  }
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    
    const parseResult = createTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request data', details: parseResult.error.errors });
    }
    
    const data = parseResult.data;
    
    const [template] = await db
      .insert(modelingScenarioTemplates)
      .values({
        name: data.name,
        description: data.description,
        scope: data.scope,
        color: data.color,
        revenueGrowthRate: data.revenueGrowthRate,
        expenseGrowthRate: data.expenseGrowthRate,
        exitCapRate: data.exitCapRate,
        occupancyRate: data.occupancyRate,
        discountRate: data.discountRate,
        holdPeriodYears: data.holdPeriodYears,
        leaseUpSchedule: data.leaseUpSchedule,
        orgId: data.scope === 'user' ? null : orgId,
        createdBy: userId,
      })
      .returning();
    
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating scenario template:', error);
    res.status(500).json({ error: 'Failed to create scenario template' });
  }
});

router.patch('/:templateId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const userId = req.user!.id;
    const orgId = req.user!.orgId;
    
    const parseResult = updateTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request data', details: parseResult.error.errors });
    }
    
    const existing = await db
      .select()
      .from(modelingScenarioTemplates)
      .where(eq(modelingScenarioTemplates.id, templateId))
      .limit(1);
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (!canModifyTemplate(existing[0], userId, orgId)) {
      return res.status(403).json({ error: 'Not authorized to update this template' });
    }
    
    const updates = parseResult.data;
    
    const [updated] = await db
      .update(modelingScenarioTemplates)
      .set({ 
        ...updates, 
        updatedAt: new Date(),
      })
      .where(eq(modelingScenarioTemplates.id, templateId))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating scenario template:', error);
    res.status(500).json({ error: 'Failed to update scenario template' });
  }
});

router.delete('/:templateId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const userId = req.user!.id;
    const orgId = req.user!.orgId;
    
    const existing = await db
      .select()
      .from(modelingScenarioTemplates)
      .where(eq(modelingScenarioTemplates.id, templateId))
      .limit(1);
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (!canModifyTemplate(existing[0], userId, orgId)) {
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }
    
    await db
      .delete(modelingScenarioTemplates)
      .where(eq(modelingScenarioTemplates.id, templateId));
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting scenario template:', error);
    res.status(500).json({ error: 'Failed to delete scenario template' });
  }
});

router.post('/apply/:templateId/project/:projectId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, templateId } = req.params;
    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    
    const [template] = await db
      .select()
      .from(modelingScenarioTemplates)
      .where(eq(modelingScenarioTemplates.id, templateId))
      .limit(1);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (!canAccessTemplate(template, userId, orgId)) {
      return res.status(403).json({ error: 'Not authorized to use this template' });
    }
    
    const [project] = await db
      .select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found or not accessible' });
    }
    
    const existingCases = await db
      .select()
      .from(modelingCases)
      .where(eq(modelingCases.projectId, projectId));
    
    const [newCase] = await db
      .insert(modelingCases)
      .values({
        projectId,
        orgId,
        name: template.name,
        description: template.description,
        color: template.color,
        revenueGrowthRate: template.revenueGrowthRate,
        expenseGrowthRate: template.expenseGrowthRate,
        exitCapRate: template.exitCapRate,
        occupancyRate: template.occupancyRate,
        discountRate: template.discountRate,
        holdPeriodYears: template.holdPeriodYears,
        leaseUpSchedule: template.leaseUpSchedule,
        sortOrder: existingCases.length,
        isDefault: existingCases.length === 0,
        isEnabled: true,
        createdBy: userId,
      })
      .returning();
    
    await db
      .update(modelingScenarioTemplates)
      .set({ usageCount: sql`${modelingScenarioTemplates.usageCount} + 1` })
      .where(eq(modelingScenarioTemplates.id, templateId));
    
    res.status(201).json(newCase);
  } catch (error) {
    console.error('Error applying scenario template:', error);
    res.status(500).json({ error: 'Failed to apply scenario template' });
  }
});

router.post('/save-from-case/:caseId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    
    const parseResult = saveFromCaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request data', details: parseResult.error.errors });
    }
    
    const { name, description, scope } = parseResult.data;
    
    const [existingCase] = await db
      .select()
      .from(modelingCases)
      .where(and(
        eq(modelingCases.id, caseId),
        eq(modelingCases.orgId, orgId)
      ))
      .limit(1);
    
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found or not accessible' });
    }
    
    const [template] = await db
      .insert(modelingScenarioTemplates)
      .values({
        orgId: scope === 'user' ? null : orgId,
        createdBy: userId,
        name: name || existingCase.name,
        description: description || existingCase.description,
        scope,
        color: existingCase.color,
        revenueGrowthRate: existingCase.revenueGrowthRate,
        expenseGrowthRate: existingCase.expenseGrowthRate,
        exitCapRate: existingCase.exitCapRate,
        occupancyRate: existingCase.occupancyRate,
        discountRate: existingCase.discountRate,
        holdPeriodYears: existingCase.holdPeriodYears,
        leaseUpSchedule: existingCase.leaseUpSchedule,
      })
      .returning();
    
    res.status(201).json(template);
  } catch (error) {
    console.error('Error saving case as template:', error);
    res.status(500).json({ error: 'Failed to save case as template' });
  }
});

export default router;
