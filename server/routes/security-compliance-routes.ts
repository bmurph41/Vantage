/**
 * Vantage Security & Compliance Routes
 * 2FA, security events, session management, GDPR, IP allowlists, KYC
 */

import { Router, Request, Response } from 'express';
import { securityService } from '../services/security-compliance-service';

export const securityComplianceRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

// ─── Two-Factor Authentication ──────────────────────────────────────────────

securityComplianceRouter.post('/2fa/setup-totp', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const setup = await securityService.setupTotp(orgId, getUserId(req));
    res.json(setup);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

securityComplianceRouter.post('/2fa/verify-totp', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { token } = req.body;
    const result = await securityService.verifyTotp(orgId, getUserId(req), token);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

securityComplianceRouter.post('/2fa/enable', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { token, backupCodes } = req.body;
    const result = await securityService.enable2fa(orgId, getUserId(req), token, backupCodes);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

securityComplianceRouter.post('/2fa/disable', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { password } = req.body;
    const result = await securityService.disable2fa(orgId, getUserId(req), password);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Security Events ────────────────────────────────────────────────────────

securityComplianceRouter.get('/security-events', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const events = await securityService.getSecurityEvents(orgId, {
      eventType: req.query.eventType as string,
      severity: req.query.severity as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(events);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

securityComplianceRouter.get('/security-events/user/:userId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const events = await securityService.getUserSecurityEvents(orgId, req.params.userId, {
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(events);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Session Management ─────────────────────────────────────────────────────

securityComplianceRouter.get('/sessions/active', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const sessions = await securityService.getActiveSessions(orgId, getUserId(req));
    res.json(sessions);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

securityComplianceRouter.post('/sessions/force-logout', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { sessionId, targetUserId } = req.body;
    const result = await securityService.forceLogout(orgId, sessionId, targetUserId, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

securityComplianceRouter.post('/sessions/revoke-all', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { targetUserId } = req.body;
    const result = await securityService.revokeAllSessions(orgId, targetUserId || getUserId(req), getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Data Retention Policies ────────────────────────────────────────────────

securityComplianceRouter.get('/retention-policies', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const policies = await securityService.getRetentionPolicies(orgId);
    res.json(policies);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

securityComplianceRouter.post('/retention-policies', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const policy = await securityService.createRetentionPolicy(orgId, req.body, getUserId(req));
    res.json(policy);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── GDPR Compliance ────────────────────────────────────────────────────────

securityComplianceRouter.post('/gdpr/export-request', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { subjectEmail, dataCategories } = req.body;
    const request = await securityService.createGdprExportRequest(orgId, subjectEmail, dataCategories, getUserId(req));
    res.json(request);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

securityComplianceRouter.post('/gdpr/deletion-request', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { subjectEmail, reason, retainFinancialRecords } = req.body;
    const request = await securityService.createGdprDeletionRequest(orgId, subjectEmail, reason, retainFinancialRecords, getUserId(req));
    res.json(request);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

securityComplianceRouter.get('/gdpr/consent', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const consent = await securityService.getConsentRecords(orgId, {
      subjectEmail: req.query.subjectEmail as string,
      consentType: req.query.consentType as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(consent);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

securityComplianceRouter.post('/gdpr/consent', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { subjectEmail, consentType, granted, ipAddress } = req.body;
    const record = await securityService.recordConsent(orgId, subjectEmail, consentType, granted, ipAddress, getUserId(req));
    res.json(record);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── IP Allowlist ───────────────────────────────────────────────────────────

securityComplianceRouter.get('/ip-allowlist', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const entries = await securityService.getIpAllowlist(orgId);
    res.json(entries);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

securityComplianceRouter.post('/ip-allowlist', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { cidr, label, expiresAt } = req.body;
    const entry = await securityService.addIpAllowlistEntry(orgId, cidr, label, expiresAt, getUserId(req));
    res.json(entry);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── KYC / AML ──────────────────────────────────────────────────────────────

securityComplianceRouter.post('/kyc/initiate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { investorId, documentType, documentData } = req.body;
    const result = await securityService.initiateKyc(orgId, investorId, documentType, documentData, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

securityComplianceRouter.get('/kyc/:investorId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const status = await securityService.getKycStatus(orgId, req.params.investorId);
    res.json(status);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});
