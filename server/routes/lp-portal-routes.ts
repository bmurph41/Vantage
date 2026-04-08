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
    const user = await lpPortalAuth.createLpUser(orgId, {
      email: req.body.email,
      investorId: req.body.investorId,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      fundIds: req.body.fundIds,
      accessLevel: req.body.accessLevel || 'standard',
    }, getUserId(req));
    res.json(user);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.post('/auth/activate', async (req: Request, res: Response) => {
  try {
    const { activationToken, password } = req.body;
    const result = await lpPortalAuth.activateLpUser(activationToken, password);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password, totpToken } = req.body;
    const session = await lpPortalAuth.loginLpUser(email, password, totpToken, {
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });
    res.json(session);
  } catch (e: any) { res.status(401).json({ error: e.message }); }
});

lpPortalRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    await lpPortalAuth.logoutLpUser(token);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/auth/validate', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const session = await lpPortalAuth.validateLpSession(token);
    res.json(session);
  } catch (e: any) { res.status(401).json({ error: e.message }); }
});

// ─── LP Statements ──────────────────────────────────────────────────────────

lpPortalRouter.post('/statements/generate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const statement = await lpStatements.generateStatement(orgId, {
      fundId: req.body.fundId,
      investorId: req.body.investorId,
      periodStart: req.body.periodStart,
      periodEnd: req.body.periodEnd,
      includeCapitalAccount: req.body.includeCapitalAccount !== false,
      includePerformance: req.body.includePerformance !== false,
      includePortfolioSummary: req.body.includePortfolioSummary !== false,
      format: req.body.format || 'json',
    }, getUserId(req));
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
      year: parseInt(req.query.year as string) || undefined,
      quarter: parseInt(req.query.quarter as string) || undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(statements);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.get('/statements/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const statement = await lpStatements.getStatement(orgId, req.params.id);
    res.json(statement);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

lpPortalRouter.get('/statements/:id/html', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const html = await lpStatements.renderStatementHtml(orgId, req.params.id, {
      theme: req.query.theme as string || 'institutional',
      showWatermark: req.query.showWatermark !== 'false',
    });
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── K-1 Tax Documents ──────────────────────────────────────────────────────

lpPortalRouter.post('/k1/generate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const k1 = await k1Generator.generateK1(orgId, {
      fundId: req.body.fundId,
      investorId: req.body.investorId,
      taxYear: req.body.taxYear,
      ordinaryIncome: req.body.ordinaryIncome,
      capitalGainsShortTerm: req.body.capitalGainsShortTerm,
      capitalGainsLongTerm: req.body.capitalGainsLongTerm,
      section1231Gains: req.body.section1231Gains,
      depreciation: req.body.depreciation,
      interestExpense: req.body.interestExpense,
      stateAllocations: req.body.stateAllocations,
      foreignTaxCredit: req.body.foreignTaxCredit,
      ubit: req.body.ubit,
    }, getUserId(req));
    res.json(k1);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/k1/:fundId/:investorId/:taxYear', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const k1 = await k1Generator.getK1(orgId, req.params.fundId, req.params.investorId, parseInt(req.params.taxYear));
    res.json(k1);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ─── Side Letters ───────────────────────────────────────────────────────────

lpPortalRouter.post('/side-letters', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const letter = await sideLetters.createSideLetter(orgId, {
      fundId: req.body.fundId,
      investorId: req.body.investorId,
      provisions: req.body.provisions,
      feeDiscount: req.body.feeDiscount,
      coInvestmentRights: req.body.coInvestmentRights,
      reportingRequirements: req.body.reportingRequirements,
      mfnClause: req.body.mfnClause !== false,
      effectiveDate: req.body.effectiveDate,
      expirationDate: req.body.expirationDate,
    }, getUserId(req));
    res.json(letter);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/side-letters/fund/:fundId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const letters = await sideLetters.getFundSideLetters(orgId, req.params.fundId, {
      investorId: req.query.investorId as string,
      includeExpired: req.query.includeExpired === 'true',
    });
    res.json(letters);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.get('/side-letters/mfn-analysis/:fundId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const analysis = await sideLetters.getMfnAnalysis(orgId, req.params.fundId);
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
