/**
 * Vantage Workflow Enhancements Routes
 * Webhooks, Slack/Teams notifications, scheduled triggers,
 * workflow pipelines, approval queues, analytics
 */

import { Router, Request, Response } from 'express';
import { workflowEnhancements } from '../services/workflow-enhancements';

export const workflowEnhancementsRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

// ─── Webhooks ───────────────────────────────────────────────────────────────

workflowEnhancementsRouter.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const webhook = await workflowEnhancements.createWebhook(orgId, {
      name: req.body.name,
      url: req.body.url,
      events: req.body.events,
      secret: req.body.secret,
      headers: req.body.headers,
      isActive: req.body.isActive !== false,
    }, getUserId(req));
    res.json(webhook);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const webhooks = await workflowEnhancements.listWebhooks(orgId, {
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(webhooks);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

workflowEnhancementsRouter.post('/webhooks/:id/test', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await workflowEnhancements.testWebhook(orgId, req.params.id, {
      samplePayload: req.body.samplePayload,
    });
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.get('/webhooks/:id/deliveries', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const deliveries = await workflowEnhancements.getWebhookDeliveries(orgId, req.params.id, {
      status: req.query.status as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(deliveries);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Slack / Teams Notifications ────────────────────────────────────────────

workflowEnhancementsRouter.post('/slack/configure', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const config = await workflowEnhancements.configureSlack(orgId, {
      webhookUrl: req.body.webhookUrl,
      defaultChannel: req.body.defaultChannel,
      eventMappings: req.body.eventMappings,
    }, getUserId(req));
    res.json(config);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.post('/slack/notify', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await workflowEnhancements.sendSlackNotification(orgId, {
      channel: req.body.channel,
      message: req.body.message,
      blocks: req.body.blocks,
      threadTs: req.body.threadTs,
    });
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.post('/teams/configure', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const config = await workflowEnhancements.configureTeams(orgId, {
      webhookUrl: req.body.webhookUrl,
      eventMappings: req.body.eventMappings,
    }, getUserId(req));
    res.json(config);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.post('/teams/notify', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await workflowEnhancements.sendTeamsNotification(orgId, {
      title: req.body.title,
      message: req.body.message,
      sections: req.body.sections,
      actions: req.body.actions,
    });
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Scheduled Triggers ─────────────────────────────────────────────────────

workflowEnhancementsRouter.post('/scheduled-triggers', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const trigger = await workflowEnhancements.createScheduledTrigger(orgId, {
      name: req.body.name,
      cronExpression: req.body.cronExpression,
      workflowId: req.body.workflowId,
      timezone: req.body.timezone || 'UTC',
      payload: req.body.payload,
    }, getUserId(req));
    res.json(trigger);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.get('/scheduled-triggers', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const triggers = await workflowEnhancements.listScheduledTriggers(orgId, {
      status: req.query.status as string,
      workflowId: req.query.workflowId as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(triggers);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

workflowEnhancementsRouter.patch('/scheduled-triggers/:id/pause', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const trigger = await workflowEnhancements.pauseScheduledTrigger(orgId, req.params.id, getUserId(req));
    res.json(trigger);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.patch('/scheduled-triggers/:id/resume', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const trigger = await workflowEnhancements.resumeScheduledTrigger(orgId, req.params.id, getUserId(req));
    res.json(trigger);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Workflow Pipelines ─────────────────────────────────────────────────────

workflowEnhancementsRouter.post('/pipelines', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const pipeline = await workflowEnhancements.createWorkflowPipeline(orgId, {
      name: req.body.name,
      description: req.body.description,
      steps: req.body.steps,
      errorHandling: req.body.errorHandling || 'stop',
    }, getUserId(req));
    res.json(pipeline);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.get('/pipelines', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const pipelines = await workflowEnhancements.listWorkflowPipelines(orgId, {
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(pipelines);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

workflowEnhancementsRouter.post('/pipelines/:id/execute', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const execution = await workflowEnhancements.executeWorkflowPipeline(orgId, req.params.id, {
      input: req.body.input,
      dryRun: req.body.dryRun === true,
    }, getUserId(req));
    res.json(execution);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.get('/pipeline-executions/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const execution = await workflowEnhancements.getPipelineExecution(orgId, req.params.id);
    res.json(execution);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── Approval Queues ────────────────────────────────────────────────────────

workflowEnhancementsRouter.post('/approvals/request', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const approval = await workflowEnhancements.createApprovalRequest(orgId, {
      type: req.body.type,
      entityId: req.body.entityId,
      entityType: req.body.entityType,
      approverIds: req.body.approverIds,
      requiredApprovals: req.body.requiredApprovals || 1,
      description: req.body.description,
      metadata: req.body.metadata,
      expiresAt: req.body.expiresAt,
    }, getUserId(req));
    res.json(approval);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.get('/approvals/queue', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const queue = await workflowEnhancements.getApprovalQueue(orgId, getUserId(req), {
      status: req.query.status as string || 'pending',
      type: req.query.type as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(queue);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

workflowEnhancementsRouter.post('/approvals/:id/approve', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await workflowEnhancements.approveRequest(orgId, req.params.id, {
      comment: req.body.comment,
      conditions: req.body.conditions,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

workflowEnhancementsRouter.post('/approvals/:id/reject', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await workflowEnhancements.rejectRequest(orgId, req.params.id, {
      reason: req.body.reason,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Workflow Analytics ─────────────────────────────────────────────────────

workflowEnhancementsRouter.get('/analytics/stats', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const stats = await workflowEnhancements.getWorkflowStats(orgId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(stats);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

workflowEnhancementsRouter.get('/analytics/top-workflows', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const top = await workflowEnhancements.getTopWorkflows(orgId, {
      metric: req.query.metric as string || 'executions',
      limit: parseInt(req.query.limit as string) || 10,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(top);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

workflowEnhancementsRouter.get('/analytics/failures', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const failures = await workflowEnhancements.getWorkflowFailures(orgId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      workflowId: req.query.workflowId as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(failures);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
