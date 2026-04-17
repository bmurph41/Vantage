/**
 * Vantage LP Portal Routes
 * LP authentication, statement generation, K-1 tax documents,
 * side letters, investor letter templates
 */

import { Router, Request, Response } from 'express';
import { lpPortalAuth, lpStatements, k1Generator, sideLetters } from '../services/lp-portal-service';
import { investorLetters } from '../services/document-enhancements';

export const lpPortalRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

// ─── LP Authentication ──────────────────────────────────────────────────────

lpPortalRouter.post('/auth/create-user', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const name = req.body.name
      || [req.body.firstName, req.body.lastName].filter(Boolean).join(' ').trim()
      || req.body.email;
    const user = await lpPortalAuth.createPortalUser(orgId, {
      email: req.body.email,
      investorId: req.body.investorId,
      name,
    });
    res.json(user);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.post('/auth/activate', async (req: Request, res: Response) => {
  try {
    const { activationToken, password } = req.body;
    const result = await lpPortalAuth.activatePortalUser(activationToken, password);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const session = await lpPortalAuth.authenticateLP(email, password);
    res.json(session);
  } catch (e: any) { res.status(401).json({ error: e.message }); }
});

lpPortalRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    await lpPortalAuth.logoutLP(token);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/auth/validate', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const session = await lpPortalAuth.validateSession(token);
    res.json(session);
  } catch (e: any) { res.status(401).json({ error: e.message }); }
});

// ─── LP Statements ──────────────────────────────────────────────────────────

lpPortalRouter.post('/statements/generate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { fundId, investorId, periodEnd } = req.body;
    if (!fundId || !investorId || !periodEnd) {
      return res.status(400).json({ error: 'fundId, investorId, and periodEnd are required' });
    }
    const statement = await lpStatements.generateQuarterlyStatement(orgId, fundId, investorId, periodEnd);
    res.json(statement);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/statements', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const statements = await lpStatements.listStatements(orgId, {
      fundId: req.query.fundId as string,
      investorId: req.query.investorId as string,
      statementType: req.query.statementType as string,
      limit: parseInt(req.query.limit as string) || 50,
    });
    res.json(statements);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.get('/statements/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const statement = await lpStatements.getStatement(orgId, req.params.id);
    if (!statement) return res.status(404).json({ error: 'Statement not found' });
    res.json(statement);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.get('/statements/:id/html', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const html = await lpStatements.renderStatementHtml(orgId, req.params.id);
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── K-1 Tax Documents ──────────────────────────────────────────────────────

lpPortalRouter.post('/k1/generate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { fundId, investorId, taxYear } = req.body;
    if (!fundId || !investorId || !taxYear) {
      return res.status(400).json({ error: 'fundId, investorId, and taxYear are required' });
    }
    const k1 = await k1Generator.generateK1(orgId, fundId, investorId, parseInt(String(taxYear), 10));
    res.json(k1);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/k1/:fundId/:investorId/:taxYear', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const k1 = await k1Generator.getK1(orgId, req.params.fundId, req.params.investorId, parseInt(req.params.taxYear, 10));
    if (!k1) return res.status(404).json({ error: 'K-1 not found' });
    res.json(k1);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Side Letters ───────────────────────────────────────────────────────────

lpPortalRouter.post('/side-letters', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { fundId, investorId, investorName, provisions, effectiveDate, expirationDate, documentUrl } = req.body;
    if (!fundId || !investorId || !investorName || !provisions || !effectiveDate) {
      return res.status(400).json({ error: 'fundId, investorId, investorName, provisions, and effectiveDate are required' });
    }
    const letter = await sideLetters.createSideLetter(orgId, {
      fundId, investorId, investorName, provisions, effectiveDate, expirationDate, documentUrl,
    }, getUserId(req));
    res.json(letter);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/side-letters/fund/:fundId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    let letters = await sideLetters.getSideLettersForFund(orgId, req.params.fundId);
    if (req.query.investorId) {
      letters = letters.filter(l => l.investorId === req.query.investorId);
    }
    if (req.query.includeExpired !== 'true') {
      const now = Date.now();
      letters = letters.filter(l => !l.expirationDate || new Date(l.expirationDate as any).getTime() > now);
    }
    res.json(letters);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.get('/side-letters/mfn-analysis/:fundId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const analysis = await sideLetters.getMFNAnalysis(orgId, req.params.fundId);
    res.json(analysis);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Investor Letters ───────────────────────────────────────────────────────

lpPortalRouter.post('/investor-letters/seed-defaults', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await investorLetters.seedDefaultTemplates(orgId, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.post('/investor-letters/templates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const template = await investorLetters.createTemplate(orgId, {
      name: req.body.name,
      type: req.body.type,
      subject: req.body.subject,
      htmlBody: req.body.htmlBody,
      variables: req.body.variables,
      category: req.body.category,
    }, getUserId(req));
    res.json(template);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/investor-letters/templates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const templates = await investorLetters.listTemplates(orgId, {
      type: req.query.type as string,
      category: req.query.category as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(templates);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.post('/investor-letters/render', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const rendered = await investorLetters.renderTemplate(orgId, {
      templateId: req.body.templateId,
      variables: req.body.variables,
      investorId: req.body.investorId,
      fundId: req.body.fundId,
      format: req.body.format || 'html',
    }, getUserId(req));
    res.json(rendered);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
