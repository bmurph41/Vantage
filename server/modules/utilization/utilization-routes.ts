import { Router } from 'express';
import { generateMockSummary } from './utilization-service-mock';
import {
  getSummary,
  recomputeSnapshots,
  fetchBandBreakdown,
  fetchByType,
  fetchDrilldownEvents,
  getOfflineBreakdown,
  computeCompressionAnalytics,
} from './utilization-service';
import { diagnoseUnderutilization } from './diagnosis-engine';
import { requireRole } from '../../middleware/rbac';
import type { AssetClass } from './utilization-config';
import type { UtilizationMode } from './utilization-types';
import { startOfMonth, endOfMonth } from './overlap';

export function createUtilizationRouter(): Router {
  const router = Router();

  router.get('/ping', (_req, res) => {
    res.json({ ok: true, module: 'utilization', version: '1.0.0' });
  });

  router.get('/mock-summary', (_req, res) => {
    try {
      const summary = generateMockSummary();
      res.json(summary);
    } catch (error: any) {
      console.error('[Utilization] Error generating mock summary:', error);
      res.status(500).json({ error: 'Failed to generate mock summary' });
    }
  });

  router.get('/summary', async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string;
      if (!propertyId) {
        return res.status(400).json({ error: 'propertyId is required' });
      }

      const now = new Date();
      const periodStart = (req.query.periodStart as string) || startOfMonth(now);
      const periodEnd = (req.query.periodEnd as string) || endOfMonth(now);
      const assetClass = (req.query.assetClass as AssetClass) || 'marina';
      const mode = (req.query.mode as UtilizationMode) || 'contracted';
      const unitTypes = req.query.unitTypes ? (req.query.unitTypes as string).split(',') : undefined;

      const summary = await getSummary(propertyId, periodStart, periodEnd, assetClass, mode, unitTypes);
      res.json(summary);
    } catch (error: any) {
      console.error('[Utilization] Error computing summary:', error);
      res.status(500).json({ error: 'Failed to compute utilization summary' });
    }
  });

  router.get('/by-type', async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string;
      if (!propertyId) {
        return res.status(400).json({ error: 'propertyId is required' });
      }

      const now = new Date();
      const periodStart = (req.query.periodStart as string) || startOfMonth(now);
      const periodEnd = (req.query.periodEnd as string) || endOfMonth(now);
      const assetClass = (req.query.assetClass as AssetClass) || 'marina';
      const mode = (req.query.mode as UtilizationMode) || 'contracted';
      const unitTypes = req.query.unitTypes ? (req.query.unitTypes as string).split(',') : undefined;

      const byType = await fetchByType(propertyId, periodStart, periodEnd, assetClass, mode, unitTypes);
      res.json({ propertyId, periodStart, periodEnd, assetClass, mode, byUnitType: byType });
    } catch (error: any) {
      console.error('[Utilization] Error fetching by-type breakdown:', error);
      res.status(500).json({ error: 'Failed to fetch unit type breakdown' });
    }
  });

  router.get('/by-band', async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string;
      if (!propertyId) {
        return res.status(400).json({ error: 'propertyId is required' });
      }

      const now = new Date();
      const periodStart = (req.query.periodStart as string) || startOfMonth(now);
      const periodEnd = (req.query.periodEnd as string) || endOfMonth(now);
      const mode = (req.query.mode as UtilizationMode) || 'contracted';
      const unitTypes = req.query.unitTypes ? (req.query.unitTypes as string).split(',') : undefined;

      let bands = await fetchBandBreakdown(propertyId, periodStart, periodEnd, mode);
      if (unitTypes?.length) {
        bands = bands.filter((b: any) => unitTypes.includes(b.unitType));
      }
      res.json({ propertyId, periodStart, periodEnd, mode, bands });
    } catch (error: any) {
      console.error('[Utilization] Error fetching band breakdown:', error);
      res.status(500).json({ error: 'Failed to fetch band breakdown' });
    }
  });

  router.get('/drilldown-events', async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string;
      if (!propertyId) {
        return res.status(400).json({ error: 'propertyId is required' });
      }

      const now = new Date();
      const periodStart = (req.query.periodStart as string) || startOfMonth(now);
      const periodEnd = (req.query.periodEnd as string) || endOfMonth(now);
      const mode = (req.query.mode as UtilizationMode) || 'contracted';
      const unitType = req.query.unitType as string | undefined;
      const bandKey = req.query.bandKey as string | undefined;
      const unitTypes = req.query.unitTypes ? (req.query.unitTypes as string).split(',') : undefined;

      const result = await fetchDrilldownEvents(propertyId, periodStart, periodEnd, mode, unitType, bandKey, unitTypes);
      res.json({ propertyId, periodStart, periodEnd, mode, ...result });
    } catch (error: any) {
      console.error('[Utilization] Error fetching drilldown events:', error);
      res.status(500).json({ error: 'Failed to fetch drilldown events' });
    }
  });

  router.get('/offline-breakdown', async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string;
      if (!propertyId) {
        return res.status(400).json({ error: 'propertyId is required' });
      }

      const now = new Date();
      const periodStart = (req.query.periodStart as string) || startOfMonth(now);
      const periodEnd = (req.query.periodEnd as string) || endOfMonth(now);
      const assetClass = (req.query.assetClass as AssetClass) || 'marina';
      const mode = (req.query.mode as UtilizationMode) || 'contracted';

      const breakdown = await getOfflineBreakdown(propertyId, periodStart, periodEnd, assetClass, mode);
      res.json({ propertyId, periodStart, periodEnd, ...breakdown });
    } catch (error: any) {
      console.error('[Utilization] Error fetching offline breakdown:', error);
      res.status(500).json({ error: 'Failed to fetch offline breakdown' });
    }
  });

  router.get('/compression', async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string;
      if (!propertyId) {
        return res.status(400).json({ error: 'propertyId is required' });
      }

      const now = new Date();
      const periodStart = (req.query.periodStart as string) || startOfMonth(now);
      const periodEnd = (req.query.periodEnd as string) || endOfMonth(now);
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 90;
      const mode = (req.query.mode as UtilizationMode) || 'contracted';
      const unitTypes = req.query.unitTypes ? (req.query.unitTypes as string).split(',') : undefined;

      const analytics = await computeCompressionAnalytics(
        propertyId, periodStart, periodEnd, threshold, mode, unitTypes
      );
      res.json(analytics);
    } catch (error: any) {
      console.error('[Utilization] Error computing compression analytics:', error);
      res.status(500).json({ error: 'Failed to compute compression analytics' });
    }
  });

  router.post('/recompute', requireRole('owner', 'admin'), async (req: any, res) => {
    try {
      const { propertyId, startMonth, endMonth, assetClass, mode } = req.body;

      if (!propertyId || !startMonth || !endMonth) {
        return res.status(400).json({ error: 'propertyId, startMonth, and endMonth are required' });
      }

      const orgId = req.user?.organizationId;
      if (!orgId) {
        return res.status(403).json({ error: 'Organization context required. Must be authenticated.' });
      }

      const result = await recomputeSnapshots(
        orgId,
        propertyId,
        startMonth,
        endMonth,
        assetClass || 'marina',
        mode || 'contracted'
      );

      res.json({ ok: true, ...result });
    } catch (error: any) {
      console.error('[Utilization] Error recomputing snapshots:', error);
      res.status(500).json({ error: 'Failed to recompute snapshots' });
    }
  });

  router.get('/diagnosis', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required.' });

      const propertyId = req.query.propertyId as string;
      const periodStart = req.query.periodStart as string;
      const periodEnd = req.query.periodEnd as string;

      if (!propertyId || !periodStart || !periodEnd) {
        return res.status(400).json({ error: 'propertyId, periodStart, and periodEnd are required' });
      }

      const diagnoses = await diagnoseUnderutilization(propertyId, orgId, periodStart, periodEnd);
      res.json({ diagnoses, count: diagnoses.length });
    } catch (error: any) {
      console.error('[Utilization] Diagnosis error:', error);
      res.status(500).json({ error: 'Failed to compute underutilization diagnosis' });
    }
  });

  return router;
}
