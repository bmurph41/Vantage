/**
 * Vantage Reporting Engine Routes
 * Scheduled reports, custom reports, dashboards, portfolio analytics,
 * operational reports, investor packages
 */

import { Router, Request, Response } from 'express';
import { reportingEngine } from '../services/reporting-engine';

export const reportingEngineRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

// ─── Report Schedules ───────────────────────────────────────────────────────

reportingEngineRouter.post('/schedules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const schedule = await reportingEngine.createReportSchedule(orgId, req.body, getUserId(req));
    res.json(schedule);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

reportingEngineRouter.get('/schedules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const schedules = await reportingEngine.listReportSchedules(orgId, {
      reportType: req.query.reportType as string,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(schedules);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.post('/schedules/:id/execute', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await reportingEngine.executeScheduledReport(orgId, req.params.id, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Custom Reports ─────────────────────────────────────────────────────────

reportingEngineRouter.post('/custom-reports', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await reportingEngine.createCustomReport(orgId, req.body, getUserId(req));
    res.json(report);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

reportingEngineRouter.get('/custom-reports', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const reports = await reportingEngine.listSavedReports(orgId);
    res.json(reports);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.get('/custom-reports/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await reportingEngine.getCustomReport(orgId, req.params.id);
    res.json(report);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

reportingEngineRouter.post('/custom-reports/:id/execute', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await reportingEngine.executeCustomReport(orgId, req.params.id, {
      parameters: req.body.parameters,
      format: req.body.format || 'json',
    });
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Dashboards ─────────────────────────────────────────────────────────────

reportingEngineRouter.post('/dashboards', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const dashboard = await reportingEngine.createDashboard(orgId, req.body, getUserId(req));
    res.json(dashboard);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

reportingEngineRouter.get('/dashboards', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const dashboards = await reportingEngine.listDashboards(orgId, {
      visibility: req.query.visibility as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(dashboards);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.get('/dashboards/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const dashboard = await reportingEngine.getDashboard(orgId, req.params.id);
    res.json(dashboard);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

reportingEngineRouter.post('/dashboards/:id/widgets', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const widget = await reportingEngine.addDashboardWidget(orgId, req.params.id, req.body, getUserId(req));
    res.json(widget);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

reportingEngineRouter.get('/dashboards/:id/data', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const data = await reportingEngine.getDashboardData(orgId, req.params.id, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      refresh: req.query.refresh === 'true',
    });
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Portfolio Analytics ────────────────────────────────────────────────────

reportingEngineRouter.get('/portfolio/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const summary = await reportingEngine.getPortfolioSummary(orgId, {
      asOfDate: req.query.asOfDate as string,
      fundId: req.query.fundId as string,
    });
    res.json(summary);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.get('/portfolio/noi', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const noi = await reportingEngine.getPortfolioNoi(orgId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      groupBy: req.query.groupBy as string || 'property',
    });
    res.json(noi);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.get('/portfolio/composition', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const composition = await reportingEngine.getPortfolioComposition(orgId, {
      dimension: req.query.dimension as string || 'asset-class',
      metric: req.query.metric as string || 'value',
    });
    res.json(composition);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.get('/portfolio/risk', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const risk = await reportingEngine.getPortfolioRiskMetrics(orgId, {
      confidenceLevel: parseFloat(req.query.confidenceLevel as string) || 0.95,
      horizon: req.query.horizon as string || '1Y',
    });
    res.json(risk);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Operational Reports ────────────────────────────────────────────────────

reportingEngineRouter.get('/occupancy-trends', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const trends = await reportingEngine.getOccupancyTrends(orgId, {
      propertyId: req.query.propertyId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      granularity: req.query.granularity as string || 'monthly',
    });
    res.json(trends);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.get('/delinquency', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await reportingEngine.getDelinquencyReport(orgId, {
      asOfDate: req.query.asOfDate as string,
      propertyId: req.query.propertyId as string,
      minDaysPastDue: parseInt(req.query.minDaysPastDue as string) || 1,
    });
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.get('/collections-waterfall', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const waterfall = await reportingEngine.getCollectionsWaterfall(orgId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      propertyId: req.query.propertyId as string,
    });
    res.json(waterfall);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Investor Packages ──────────────────────────────────────────────────────

reportingEngineRouter.post('/investor-package/:fundId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const pkg = await reportingEngine.generateInvestorPackage(orgId, req.params.fundId, {
      quarter: req.body.quarter,
      year: req.body.year,
      sections: req.body.sections,
      format: req.body.format || 'pdf',
    }, getUserId(req));
    res.json(pkg);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

reportingEngineRouter.post('/fund-fact-sheet/:fundId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const factSheet = await reportingEngine.generateFundFactSheet(orgId, req.params.fundId, {
      asOfDate: req.body.asOfDate,
      includeDisclaimer: req.body.includeDisclaimer !== false,
    }, getUserId(req));
    res.json(factSheet);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Form Analytics ─────────────────────────────────────────────────────────

reportingEngineRouter.get('/form-analytics/:formId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const analytics = await reportingEngine.getFormAnalytics(orgId, req.params.formId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(analytics);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

reportingEngineRouter.get('/form-conversion/:formId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const conversion = await reportingEngine.getFormConversionMetrics(orgId, req.params.formId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      groupBy: req.query.groupBy as string || 'day',
    });
    res.json(conversion);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
