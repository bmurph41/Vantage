/**
 * Vantage Integrations Engine Routes
 * Third-party connections: QuickBooks, Xero, Stripe, Twilio, Plaid,
 * Calendar sync, tracked email delivery
 */

import { Router, Request, Response } from 'express';
import { integrationsEngine } from '../services/integrations-engine';
import { requireNotBeta } from '../middleware/require-not-beta';

export const integrationsEngineRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

// ─── Connection Management ──────────────────────────────────────────────────

integrationsEngineRouter.get('/connections', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const connections = await integrationsEngine.listConnections(orgId);
    res.json(connections);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

integrationsEngineRouter.post('/connections/:provider/connect', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const connection = await integrationsEngine.connectProvider(orgId, req.params.provider, req.body, getUserId(req));
    res.json(connection);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/connections/:provider/disconnect', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.disconnectProvider(orgId, req.params.provider, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.get('/connections/:provider/status', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const status = await integrationsEngine.getConnectionStatus(orgId, req.params.provider);
    res.json(status);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── QuickBooks Online ──────────────────────────────────────────────────────

integrationsEngineRouter.get('/qbo/auth-url', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const authUrl = await integrationsEngine.getQboAuthUrl(orgId, getUserId(req));
    res.json({ authUrl });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

integrationsEngineRouter.get('/qbo/callback', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.handleQboCallback(orgId, {
      code: req.query.code as string,
      realmId: req.query.realmId as string,
      state: req.query.state as string,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/qbo/sync/chart-of-accounts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.syncQboChartOfAccounts(orgId, {
      direction: req.body.direction || 'pull',
      mappingOverrides: req.body.mappingOverrides,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/qbo/sync/invoices', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.syncQboInvoices(orgId, {
      direction: req.body.direction || 'push',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/qbo/sync/bills', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.syncQboBills(orgId, {
      direction: req.body.direction || 'push',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Xero ───────────────────────────────────────────────────────────────────

integrationsEngineRouter.get('/xero/auth-url', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const authUrl = await integrationsEngine.getXeroAuthUrl(orgId, getUserId(req));
    res.json({ authUrl });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

integrationsEngineRouter.get('/xero/callback', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.handleXeroCallback(orgId, {
      code: req.query.code as string,
      state: req.query.state as string,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/xero/sync/accounts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.syncXeroAccounts(orgId, {
      direction: req.body.direction || 'pull',
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Stripe ─────────────────────────────────────────────────────────────────

integrationsEngineRouter.post('/stripe/checkout', requireNotBeta, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const session = await integrationsEngine.createStripeCheckoutSession(orgId, {
      priceId: req.body.priceId,
      quantity: req.body.quantity || 1,
      successUrl: req.body.successUrl,
      cancelUrl: req.body.cancelUrl,
      metadata: req.body.metadata,
    }, getUserId(req));
    res.json(session);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/stripe/portal', requireNotBeta, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const portal = await integrationsEngine.createStripePortalSession(orgId, {
      returnUrl: req.body.returnUrl,
    }, getUserId(req));
    res.json(portal);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/stripe/usage', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.reportStripeUsage(orgId, {
      subscriptionItemId: req.body.subscriptionItemId,
      quantity: req.body.quantity,
      timestamp: req.body.timestamp,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Twilio ─────────────────────────────────────────────────────────────────

integrationsEngineRouter.post('/twilio/send-sms', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.sendSms(orgId, {
      to: req.body.to,
      body: req.body.body,
      contactId: req.body.contactId,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/twilio/send-2fa', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.send2faCode(orgId, {
      phoneNumber: req.body.phoneNumber,
      channel: req.body.channel || 'sms',
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/twilio/verify-2fa', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.verify2faCode(orgId, {
      phoneNumber: req.body.phoneNumber,
      code: req.body.code,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Plaid ──────────────────────────────────────────────────────────────────

integrationsEngineRouter.post('/plaid/link-token', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const token = await integrationsEngine.createPlaidLinkToken(orgId, {
      products: req.body.products || ['transactions'],
      accountFilters: req.body.accountFilters,
    }, getUserId(req));
    res.json(token);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/plaid/exchange-token', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.exchangePlaidPublicToken(orgId, {
      publicToken: req.body.publicToken,
      institutionId: req.body.institutionId,
      institutionName: req.body.institutionName,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/plaid/sync-transactions', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.syncPlaidTransactions(orgId, {
      accountId: req.body.accountId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.get('/plaid/balance/:accountId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const balance = await integrationsEngine.getPlaidBalance(orgId, req.params.accountId);
    res.json(balance);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── Calendar Sync ──────────────────────────────────────────────────────────

integrationsEngineRouter.get('/calendar/auth-url/:provider', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const authUrl = await integrationsEngine.getCalendarAuthUrl(orgId, req.params.provider, getUserId(req));
    res.json({ authUrl });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.get('/calendar/callback/:provider', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.handleCalendarCallback(orgId, req.params.provider, {
      code: req.query.code as string,
      state: req.query.state as string,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

integrationsEngineRouter.post('/calendar/sync/:provider', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.syncCalendar(orgId, req.params.provider, {
      calendarId: req.body.calendarId,
      direction: req.body.direction || 'both',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Tracked Email ──────────────────────────────────────────────────────────

integrationsEngineRouter.post('/email/send-tracked', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await integrationsEngine.sendTrackedEmail(orgId, {
      to: req.body.to,
      subject: req.body.subject,
      htmlBody: req.body.htmlBody,
      contactId: req.body.contactId,
      dealId: req.body.dealId,
      trackOpens: req.body.trackOpens !== false,
      trackClicks: req.body.trackClicks !== false,
    }, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Public tracking endpoints (no auth required)
integrationsEngineRouter.get('/email/track/open/:trackingId', async (req: Request, res: Response) => {
  try {
    await integrationsEngine.recordEmailOpen(req.params.trackingId, {
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });
    // Return 1x1 transparent pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(pixel);
  } catch (e: any) { res.status(204).send(); }
});

integrationsEngineRouter.get('/email/track/click/:trackingId', async (req: Request, res: Response) => {
  try {
    const destination = await integrationsEngine.recordEmailClick(req.params.trackingId, {
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      url: req.query.url as string,
    });
    res.redirect(destination || '/');
  } catch (e: any) { res.redirect('/'); }
});

integrationsEngineRouter.get('/email/metrics', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const metrics = await integrationsEngine.getEmailMetrics(orgId, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      contactId: req.query.contactId as string,
      dealId: req.query.dealId as string,
    });
    res.json(metrics);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
