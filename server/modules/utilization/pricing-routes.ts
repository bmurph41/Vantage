import { Router } from 'express';
import {
  getRulesForOrg,
  createRule,
  seedDefaultRules,
  evaluateRules,
  getRecommendations,
  updateRecommendationStatus,
} from './pricing-service';

export function createPricingRouter(): Router {
  const router = Router();

  router.get('/ping', (_req, res) => {
    res.json({ ok: true, module: 'pricing', version: '1.0.0' });
  });

  router.get('/rules', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization required' });

      const rules = await getRulesForOrg(orgId);
      res.json({ rules });
    } catch (error: any) {
      console.error('[Pricing] Error fetching rules:', error);
      res.status(500).json({ error: 'Failed to fetch pricing rules' });
    }
  });

  router.post('/rules', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization required' });

      const { name, description, unitType, bandKey, conditions, action, adjustmentPct, cooldownDays, priority } = req.body;
      if (!name || !conditions || !Array.isArray(conditions) || conditions.length === 0) {
        return res.status(400).json({ error: 'name and conditions are required' });
      }

      const rule = await createRule({
        orgId,
        name,
        description,
        unitType,
        bandKey,
        conditions,
        action: action || 'increase',
        adjustmentPct: adjustmentPct ?? 5,
        cooldownDays,
        priority,
      });
      res.json(rule);
    } catch (error: any) {
      console.error('[Pricing] Error creating rule:', error);
      res.status(500).json({ error: 'Failed to create pricing rule' });
    }
  });

  router.post('/rules/seed', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization required' });

      const result = await seedDefaultRules(orgId);
      res.json(result);
    } catch (error: any) {
      console.error('[Pricing] Error seeding rules:', error);
      res.status(500).json({ error: 'Failed to seed default rules' });
    }
  });

  router.post('/evaluate', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization required' });

      const { propertyId } = req.body;
      if (!propertyId) return res.status(400).json({ error: 'propertyId is required' });

      const result = await evaluateRules(orgId, propertyId);
      res.json(result);
    } catch (error: any) {
      console.error('[Pricing] Error evaluating rules:', error);
      res.status(500).json({ error: 'Failed to evaluate pricing rules' });
    }
  });

  router.get('/recommendations', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization required' });

      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;

      const recs = await getRecommendations(orgId, propertyId, status);
      res.json({ recommendations: recs });
    } catch (error: any) {
      console.error('[Pricing] Error fetching recommendations:', error);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  });

  router.post('/recommendations/:id/dismiss', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization required' });

      const { notes } = req.body;
      const updated = await updateRecommendationStatus(
        req.params.id, orgId, 'dismissed', req.user?.id, notes
      );
      res.json(updated);
    } catch (error: any) {
      console.error('[Pricing] Error dismissing recommendation:', error);
      res.status(500).json({ error: error.message || 'Failed to dismiss recommendation' });
    }
  });

  router.post('/recommendations/:id/accept', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization required' });

      const { notes } = req.body;
      const updated = await updateRecommendationStatus(
        req.params.id, orgId, 'accepted', req.user?.id, notes
      );
      res.json(updated);
    } catch (error: any) {
      console.error('[Pricing] Error accepting recommendation:', error);
      res.status(500).json({ error: error.message || 'Failed to accept recommendation' });
    }
  });

  router.post('/recommendations/:id/implement', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization required' });

      const { notes } = req.body;
      const updated = await updateRecommendationStatus(
        req.params.id, orgId, 'implemented', req.user?.id, notes
      );
      res.json(updated);
    } catch (error: any) {
      console.error('[Pricing] Error marking recommendation implemented:', error);
      res.status(500).json({ error: error.message || 'Failed to mark recommendation implemented' });
    }
  });

  return router;
}
