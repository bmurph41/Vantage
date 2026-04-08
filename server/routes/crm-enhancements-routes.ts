/**
 * Vantage CRM Enhancements Routes
 * Deal comparisons, email tracking, calendar sync, company hierarchy,
 * relationship scoring, bulk email campaigns, deal rooms
 */

import { Router, Request, Response } from 'express';
import { crmEnhancements } from '../services/crm-enhancements';

export const crmEnhancementsRouter = Router();

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
