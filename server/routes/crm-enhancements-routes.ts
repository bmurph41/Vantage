/**
 * Vantage CRM Enhancements Routes
 * Deal comparisons, email tracking, calendar sync, company hierarchy,
 * relationship scoring, bulk email campaigns, deal rooms
 */

import { Router, Request, Response } from 'express';
import { crmEnhancements } from '../services/crm-enhancements';
import { pool } from '../db';

export const crmEnhancementsRouter = Router();

// ── Compare-Full types ─────────────────────────────────────────────────────
// All interfaces match actual DB schema column names (snake_case from PostgreSQL)

/** Row from crm_deals — uses actual column names (title, stage, expected_close_date) */
interface CrmDealRow {
  id: string;
  title: string | null;
  asset_class: string | null;
  stage: string | null;
  amount: string | null;
  expected_close_date: string | null;
  modeling_project_id: string | null;
  priority: string | null;
  is_closed: boolean | null;
}

/** Row from underwriting_assumptions — per-year pro forma projections */
interface UnderwritingRow {
  year: number;
  effective_gross_revenue: string | null;
  operating_expenses: string | null;
  noi: string | null;
}

/** Row from valuation_snapshots — investment returns snapshot */
interface ValuationSnapshotRow {
  irr: string | null;
  equity_multiple: string | null;
  cash_on_cash: string | null;
  cap_rate: string | null;
  purchase_price: string | null;
  noi: string | null;
  indicated_value: string | null;
}

/** Individual debt tranche (from JSON aggregation over debt_tranches) */
interface DebtTrancheAgg {
  name: string | null;
  principal: string | null;
  interest_rate: string | null;
  term_years: string | null;
}

/** Row from capital_stacks (joined with debt_tranches aggregation) */
interface CapitalStackRow {
  total_capitalization: string | null;
  total_debt: string | null;
  total_equity: string | null;
  ltv: string | null;
  blended_debt_rate: string | null;
  debt_yield: string | null;
  hold_period_years: string | null;
  exit_cap_rate: string | null;
  tranches: DebtTrancheAgg[] | null;
}

/** Row from exit_scenarios — first base-case or most-recent scenario */
interface ExitScenarioRow {
  scenario_type: string | null;
  holding_period_years: number | null;
  exit_cap_rate: string | null;
  projected_sale_price: string | null;
  total_tax_liability: string | null;
  irr: string | null;
  moic: string | null;
}

interface DealComparisonResult {
  dealId: string;
  dealName: string;
  assetClass: string | null;
  stage: string | null;
  amount: number | null;
  closeDate: string | null;
  modelingProjectId: string | null;
  crmMetrics: Record<string, unknown>;
  proForma: {
    purchasePrice: number;
    noi: number[];
    totalRevenue: number[];
    totalExpenses: number[];
    capRate: number;
    indicatedValue: number;
  } | null;
  returns: {
    irr: number;
    equityMultiple: number;
    cashOnCash: number;
    indicatedValue: number;
  } | null;
  capitalStack: {
    totalCapitalization: number;
    totalDebt: number;
    totalEquity: number;
    ltv: number;
    blendedDebtRate: number;
    debtYield: number;
    holdPeriodYears: number;
    exitCapRate: number;
    tranches: { name: string; principal: number; interestRate: number; termYears: number }[];
  } | null;
  exitStrategy: {
    scenarioType: string | null;
    holdingPeriodYears: number;
    exitCapRate: number;
    projectedSalePrice: number;
    totalTaxLiability: number;
    irr: number;
    moic: number;
  } | null;
}

// ──────────────────────────────────────────────────────────────────────────────

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

// ─── Deal Comparisons ───────────────────────────────────────────────────────

crmEnhancementsRouter.post('/deal-comparisons', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const comparison = await crmEnhancements.createDealComparison(orgId, {
      name: req.body.name,
      dealIds: req.body.dealIds,
      metrics: req.body.metrics,
      weightings: req.body.weightings,
    }, getUserId(req));
    res.json(comparison);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/deal-comparisons', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const comparisons = await crmEnhancements.listDealComparisons(orgId, {
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(comparisons);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/deal-comparisons/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const comparison = await crmEnhancements.getDealComparison(orgId, req.params.id);
    res.json(comparison);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── Email Tracking ─────────────────────────────────────────────────────────

crmEnhancementsRouter.post('/email-tracking/pixel/:emailId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const tracking = await crmEnhancements.generateTrackingPixel(orgId, req.params.emailId, getUserId(req));
    res.json(tracking);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.post('/email-tracking/link/:emailId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const trackedLink = await crmEnhancements.generateTrackedLink(orgId, req.params.emailId, {
      originalUrl: req.body.originalUrl,
      linkLabel: req.body.linkLabel,
    }, getUserId(req));
    res.json(trackedLink);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Public tracking endpoints (no auth required)
crmEnhancementsRouter.get('/email-tracking/open/:trackingId', async (req: Request, res: Response) => {
  try {
    await crmEnhancements.recordEmailOpen(req.params.trackingId, {
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString(),
    });
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(pixel);
  } catch (e: any) { res.status(204).send(); }
});

crmEnhancementsRouter.get('/email-tracking/click/:trackingId', async (req: Request, res: Response) => {
  try {
    const destination = await crmEnhancements.recordEmailClick(req.params.trackingId, {
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString(),
    });
    res.redirect(destination || '/');
  } catch (e: any) { res.redirect('/'); }
});

crmEnhancementsRouter.get('/email-tracking/engagement', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const engagement = await crmEnhancements.getEmailEngagement(orgId, {
      contactId: req.query.contactId as string,
      dealId: req.query.dealId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(engagement);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Calendar Sync ──────────────────────────────────────────────────────────

crmEnhancementsRouter.post('/calendar/sync/google', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await crmEnhancements.syncGoogleCalendar(orgId, {
      accessToken: req.body.accessToken,
      calendarId: req.body.calendarId,
      syncDirection: req.body.syncDirection || 'both',
      lookAheadDays: req.body.lookAheadDays || 90,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.post('/calendar/sync/outlook', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await crmEnhancements.syncOutlookCalendar(orgId, {
      accessToken: req.body.accessToken,
      calendarId: req.body.calendarId,
      syncDirection: req.body.syncDirection || 'both',
      lookAheadDays: req.body.lookAheadDays || 90,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.post('/calendar/events', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const event = await crmEnhancements.createCalendarEvent(orgId, {
      title: req.body.title,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      description: req.body.description,
      location: req.body.location,
      attendeeContactIds: req.body.attendeeContactIds,
      dealId: req.body.dealId,
      reminderMinutes: req.body.reminderMinutes || 15,
    }, getUserId(req));
    res.json(event);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/calendar/upcoming', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const events = await crmEnhancements.getUpcomingEvents(orgId, getUserId(req), {
      days: parseInt(req.query.days as string) || 14,
      dealId: req.query.dealId as string,
      contactId: req.query.contactId as string,
      limit: parseInt(req.query.limit as string) || 50,
    });
    res.json(events);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Company Hierarchy ──────────────────────────────────────────────────────

crmEnhancementsRouter.post('/companies/:id/parent', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await crmEnhancements.setCompanyParent(orgId, req.params.id, {
      parentCompanyId: req.body.parentCompanyId,
      relationshipType: req.body.relationshipType || 'subsidiary',
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/companies/:id/hierarchy', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const hierarchy = await crmEnhancements.getCompanyHierarchy(orgId, req.params.id, {
      depth: parseInt(req.query.depth as string) || 5,
      includeDeals: req.query.includeDeals === 'true',
      includeContacts: req.query.includeContacts === 'true',
    });
    res.json(hierarchy);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

crmEnhancementsRouter.post('/companies/merge', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await crmEnhancements.mergeCompanies(orgId, {
      primaryCompanyId: req.body.primaryCompanyId,
      secondaryCompanyId: req.body.secondaryCompanyId,
      fieldResolution: req.body.fieldResolution,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Relationship Scoring ───────────────────────────────────────────────────

crmEnhancementsRouter.get('/contacts/:id/relationship-score', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const score = await crmEnhancements.getRelationshipScore(orgId, req.params.id);
    res.json(score);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/contacts/stale', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const stale = await crmEnhancements.getStaleContacts(orgId, {
      daysSinceContact: parseInt(req.query.daysSinceContact as string) || 30,
      minRelationshipScore: parseFloat(req.query.minRelationshipScore as string) || 0,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(stale);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/contacts/best-connections', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const connections = await crmEnhancements.getBestConnections(orgId, {
      companyId: req.query.companyId as string,
      assetClass: req.query.assetClass as string,
      market: req.query.market as string,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json(connections);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Bulk Email Campaigns ───────────────────────────────────────────────────

crmEnhancementsRouter.post('/bulk-email', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const campaign = await crmEnhancements.sendBulkEmail(orgId, {
      name: req.body.name,
      subject: req.body.subject,
      htmlBody: req.body.htmlBody,
      contactIds: req.body.contactIds,
      filterCriteria: req.body.filterCriteria,
      trackOpens: req.body.trackOpens !== false,
      trackClicks: req.body.trackClicks !== false,
    }, getUserId(req));
    res.json(campaign);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.post('/bulk-email/schedule', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const scheduled = await crmEnhancements.scheduleBulkEmail(orgId, {
      name: req.body.name,
      subject: req.body.subject,
      htmlBody: req.body.htmlBody,
      contactIds: req.body.contactIds,
      filterCriteria: req.body.filterCriteria,
      scheduledAt: req.body.scheduledAt,
      timezone: req.body.timezone || 'UTC',
    }, getUserId(req));
    res.json(scheduled);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/bulk-email/:campaignId/status', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const status = await crmEnhancements.getBulkEmailStatus(orgId, req.params.campaignId);
    res.json(status);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

crmEnhancementsRouter.post('/unsubscribe/:contactId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await crmEnhancements.unsubscribeContact(orgId, req.params.contactId, {
      reason: req.body.reason,
      categories: req.body.categories,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/unsubscribes', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const unsubscribes = await crmEnhancements.getUnsubscribes(orgId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(unsubscribes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Deal Rooms ─────────────────────────────────────────────────────────────

crmEnhancementsRouter.post('/deals/:dealId/create-room', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const room = await crmEnhancements.createDealRoom(orgId, req.params.dealId, {
      name: req.body.name,
      accessLevel: req.body.accessLevel || 'invited',
      invitedContactIds: req.body.invitedContactIds,
      enabledModules: req.body.enabledModules || ['documents', 'messaging', 'timeline'],
      ndaRequired: req.body.ndaRequired || false,
    }, getUserId(req));
    res.json(room);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

crmEnhancementsRouter.get('/deals/:dealId/room-status', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const status = await crmEnhancements.getDealRoomStatus(orgId, req.params.dealId);
    res.json(status);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── Deal Model Comparison (Full Aggregation) ────────────────────────────────

export async function dealCompareFullHandler(req: Request, res: Response): Promise<void> {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });

    const { dealIds } = req.body;
    if (!Array.isArray(dealIds) || dealIds.length < 2 || dealIds.length > 6) {
      return res.status(400).json({ error: 'dealIds must be an array of 2–6 deal IDs' });
    }

    // 1. Fetch CRM deals using actual column names from crm_deals schema
    const dealsResult = await pool.query(
      `SELECT id, title, asset_class, stage, amount, expected_close_date,
              modeling_project_id, priority, is_closed
       FROM crm_deals
       WHERE id = ANY($1::text[]) AND org_id = $2`,
      [dealIds, orgId]
    );

    if (dealsResult.rows.length < 2) {
      return res.status(400).json({ error: 'At least 2 valid deals must be found for the given IDs in your organization' });
    }

    // 2. Build per-deal data (ordered to match requested dealIds)
    const dealMap = new Map((dealsResult.rows as CrmDealRow[]).map((r) => [r.id, r]));
    const orderedDeals = dealIds
      .map((id: string) => dealMap.get(id))
      .filter((d): d is CrmDealRow => d !== undefined);

    const results = await Promise.all(orderedDeals.map(async (deal) => {
      const base: DealComparisonResult = {
        dealId: deal.id,
        dealName: deal.title || deal.id,
        assetClass: deal.asset_class,
        stage: deal.stage,
        amount: deal.amount ? Number(deal.amount) : null,
        closeDate: deal.expected_close_date,
        modelingProjectId: deal.modeling_project_id,
        crmMetrics: {},
        proForma: null,
        returns: null,
        capitalStack: null,
        exitStrategy: null,
      };

      if (!deal.modeling_project_id) return base;

      const projectId = deal.modeling_project_id;

      // Pro forma (underwriting_assumptions) + returns (valuation_snapshots)
      try {
        const [uwResult, vsResult] = await Promise.all([
          pool.query(
            `SELECT year, effective_gross_revenue, operating_expenses, noi
             FROM underwriting_assumptions
             WHERE modeling_project_id = $1
             ORDER BY year ASC`,
            [projectId]
          ),
          pool.query(
            `SELECT irr, equity_multiple, cash_on_cash, cap_rate, purchase_price, noi, indicated_value
             FROM valuation_snapshots
             WHERE modeling_project_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [projectId]
          ),
        ]);

        const snap = vsResult.rows[0] as ValuationSnapshotRow | undefined;
        const uwRows = uwResult.rows as UnderwritingRow[];

        if (uwRows.length > 0) {
          base.proForma = {
            purchasePrice: snap ? Number(snap.purchase_price || 0) : 0,
            noi: uwRows.map((r) => Number(r.noi || 0)),
            totalRevenue: uwRows.map((r) => Number(r.effective_gross_revenue || 0)),
            totalExpenses: uwRows.map((r) => Number(r.operating_expenses || 0)),
            capRate: snap ? Number(snap.cap_rate || 0) : 0,
            indicatedValue: snap ? Number(snap.indicated_value || 0) : 0,
          };
        }

        if (snap) {
          base.returns = {
            irr: Number(snap.irr || 0),
            equityMultiple: Number(snap.equity_multiple || 0),
            cashOnCash: Number(snap.cash_on_cash || 0),
            indicatedValue: Number(snap.indicated_value || 0),
          };
        }
      } catch (pfErr) {
        console.warn(`[compare-full] pro forma/returns query failed for project ${projectId}:`, (pfErr as Error).message);
      }

      // Capital stack (capital_stacks + debt_tranches)
      try {
        const csResult = await pool.query(
          `SELECT cs.total_capitalization, cs.total_debt, cs.total_equity,
                  cs.ltv, cs.blended_debt_rate, cs.debt_yield,
                  cs.hold_period_years, cs.exit_cap_rate,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'name', dt.name,
                        'principal', dt.principal,
                        'interest_rate', dt.interest_rate,
                        'term_years', dt.term_years
                      )
                    ) FILTER (WHERE dt.id IS NOT NULL),
                    '[]'::json
                  ) as tranches
           FROM capital_stacks cs
           LEFT JOIN debt_tranches dt ON dt.capital_stack_id = cs.id
           WHERE cs.modeling_project_id = $1 AND cs.is_active = true
           GROUP BY cs.id
           ORDER BY cs.created_at DESC LIMIT 1`,
          [projectId]
        );
        if (csResult.rows.length > 0) {
          const cs = csResult.rows[0] as CapitalStackRow;
          base.capitalStack = {
            totalCapitalization: Number(cs.total_capitalization || 0),
            totalDebt: Number(cs.total_debt || 0),
            totalEquity: Number(cs.total_equity || 0),
            ltv: Number(cs.ltv || 0),
            blendedDebtRate: Number(cs.blended_debt_rate || 0),
            debtYield: Number(cs.debt_yield || 0),
            holdPeriodYears: Number(cs.hold_period_years || 0),
            exitCapRate: Number(cs.exit_cap_rate || 0),
            tranches: ((cs.tranches as DebtTrancheAgg[]) || [])
              .filter((t): t is DebtTrancheAgg & { name: string } => t !== null && !!t.name)
              .map((t) => ({
                name: t.name,
                principal: Number(t.principal || 0),
                interestRate: Number(t.interest_rate || 0),
                termYears: Number(t.term_years || 0),
              })),
          };
        }
      } catch (csErr) {
        console.warn(`[compare-full] capital stack query failed for project ${projectId}:`, (csErr as Error).message);
      }

      // Exit strategy (exit_scenarios — base case or most recent non-draft)
      try {
        const exitResult = await pool.query(
          `SELECT scenario_type, holding_period_years, exit_cap_rate,
                  projected_sale_price, total_tax_liability, irr, moic
           FROM exit_scenarios
           WHERE modeling_project_id = $1 AND status != 'draft'
           ORDER BY is_base_case DESC, created_at DESC LIMIT 1`,
          [projectId]
        );
        if (exitResult.rows.length > 0) {
          const ex = exitResult.rows[0] as ExitScenarioRow;
          base.exitStrategy = {
            scenarioType: ex.scenario_type,
            holdingPeriodYears: Number(ex.holding_period_years || 0),
            exitCapRate: Number(ex.exit_cap_rate || 0),
            projectedSalePrice: Number(ex.projected_sale_price || 0),
            totalTaxLiability: Number(ex.total_tax_liability || 0),
            irr: Number(ex.irr || 0),
            moic: Number(ex.moic || 0),
          };
        }
      } catch (exitErr) {
        console.warn(`[compare-full] exit strategy query failed for project ${projectId}:`, (exitErr as Error).message);
      }

      return base;
    }));

    res.json({ deals: results });
  } catch (e: unknown) {
    console.error('[compare-full]', e);
    const msg = e instanceof Error ? e.message : 'Internal server error';
    res.status(500).json({ error: msg });
  }
}

crmEnhancementsRouter.post('/deals/compare-full', dealCompareFullHandler);
