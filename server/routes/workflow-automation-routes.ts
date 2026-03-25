import { Router } from 'express';
import { storage } from '../storage';
import { insertWorkflowAutomationSchema } from '@shared/schema';
import {
  evaluateAutomations,
  dryRunAutomation,
  TRIGGER_TYPES,
  WORKFLOW_TEMPLATES,
} from '../services/workflow-engine';

export const workflowAutomationRouter = Router();

// ── List all automations for the org ───────────────────────────────────
workflowAutomationRouter.get('/', async (req: any, res) => {
  try {
    const automations = await storage.getWorkflowAutomations(req.user.orgId);
    res.json(automations);
  } catch (error: any) {
    console.error('Failed to list workflow automations:', error);
    res.status(500).json({ error: 'Failed to list workflow automations' });
  }
});

// ── Get single automation ──────────────────────────────────────────────
workflowAutomationRouter.get('/:id', async (req: any, res) => {
  try {
    const automation = await storage.getWorkflowAutomation(req.params.id, req.user.orgId);
    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json(automation);
  } catch (error: any) {
    console.error('Failed to get workflow automation:', error);
    res.status(500).json({ error: 'Failed to get workflow automation' });
  }
});

// ── Create automation ──────────────────────────────────────────────────
workflowAutomationRouter.post('/', async (req: any, res) => {
  try {
    const body = req.body;

    if (!body.name || !body.triggerType || !body.actions) {
      return res.status(400).json({ error: 'name, triggerType, and actions are required' });
    }

    if (!(body.triggerType in TRIGGER_TYPES)) {
      return res.status(400).json({ error: `Invalid trigger type: ${body.triggerType}`, validTriggers: Object.keys(TRIGGER_TYPES) });
    }

    if (!Array.isArray(body.actions) || body.actions.length === 0) {
      return res.status(400).json({ error: 'actions must be a non-empty array' });
    }

    const automation = await storage.createWorkflowAutomation({
      orgId: req.user.orgId,
      name: body.name,
      description: body.description || null,
      isActive: body.isActive !== false,
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig || {},
      conditions: body.conditions || null,
      actions: body.actions,
      createdBy: req.user.id,
    });

    res.status(201).json(automation);
  } catch (error: any) {
    console.error('Failed to create workflow automation:', error);
    res.status(500).json({ error: 'Failed to create workflow automation' });
  }
});

// ── Update automation ──────────────────────────────────────────────────
workflowAutomationRouter.put('/:id', async (req: any, res) => {
  try {
    const existing = await storage.getWorkflowAutomation(req.params.id, req.user.orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    if (req.body.triggerType && !(req.body.triggerType in TRIGGER_TYPES)) {
      return res.status(400).json({ error: `Invalid trigger type: ${req.body.triggerType}` });
    }

    const updated = await storage.updateWorkflowAutomation(req.params.id, req.user.orgId, req.body);
    res.json(updated);
  } catch (error: any) {
    console.error('Failed to update workflow automation:', error);
    res.status(500).json({ error: 'Failed to update workflow automation' });
  }
});

// ── Toggle active/inactive ─────────────────────────────────────────────
workflowAutomationRouter.patch('/:id/toggle', async (req: any, res) => {
  try {
    const existing = await storage.getWorkflowAutomation(req.params.id, req.user.orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const updated = await storage.updateWorkflowAutomation(req.params.id, req.user.orgId, {
      isActive: !existing.isActive,
    });
    res.json(updated);
  } catch (error: any) {
    console.error('Failed to toggle workflow automation:', error);
    res.status(500).json({ error: 'Failed to toggle workflow automation' });
  }
});

// ── Delete automation ──────────────────────────────────────────────────
workflowAutomationRouter.delete('/:id', async (req: any, res) => {
  try {
    const deleted = await storage.deleteWorkflowAutomation(req.params.id, req.user.orgId);
    if (!deleted) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete workflow automation:', error);
    res.status(500).json({ error: 'Failed to delete workflow automation' });
  }
});

// ── Get execution log ──────────────────────────────────────────────────
workflowAutomationRouter.get('/:id/executions', async (req: any, res) => {
  try {
    const existing = await storage.getWorkflowAutomation(req.params.id, req.user.orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const logs = await storage.getWorkflowExecutionLogs(req.params.id, limit);
    res.json(logs);
  } catch (error: any) {
    console.error('Failed to get execution logs:', error);
    res.status(500).json({ error: 'Failed to get execution logs' });
  }
});

// ── Dry-run / test automation against an entity ────────────────────────
workflowAutomationRouter.post('/:id/test', async (req: any, res) => {
  try {
    const { entityId } = req.body;
    if (!entityId) {
      return res.status(400).json({ error: 'entityId is required' });
    }

    const result = await dryRunAutomation(req.params.id, req.user.orgId, entityId);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to test workflow automation:', error);
    res.status(400).json({ error: error.message || 'Failed to test automation' });
  }
});

// ── List available trigger types ───────────────────────────────────────
workflowAutomationRouter.get('/meta/triggers', async (_req: any, res) => {
  res.json(TRIGGER_TYPES);
});

// ── List pre-built templates ───────────────────────────────────────────
workflowAutomationRouter.get('/meta/templates', async (_req: any, res) => {
  res.json(WORKFLOW_TEMPLATES);
});

// ── Create automation from template ────────────────────────────────────
workflowAutomationRouter.post('/from-template', async (req: any, res) => {
  try {
    const { templateId } = req.body;
    const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found', available: WORKFLOW_TEMPLATES.map(t => t.id) });
    }

    const automation = await storage.createWorkflowAutomation({
      orgId: req.user.orgId,
      name: template.name,
      description: template.description,
      isActive: true,
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig,
      conditions: template.conditions,
      actions: template.actions,
      createdBy: req.user.id,
    });

    res.status(201).json(automation);
  } catch (error: any) {
    console.error('Failed to create automation from template:', error);
    res.status(500).json({ error: 'Failed to create automation from template' });
  }
});
