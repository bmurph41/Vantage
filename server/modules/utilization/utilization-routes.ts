import { Router } from 'express';
import { generateMockSummary } from './utilization-service';

export function createUtilizationRouter(): Router {
  const router = Router();

  router.get('/ping', (_req, res) => {
    res.json({ ok: true, module: 'utilization', version: '0.1.0' });
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

  return router;
}
