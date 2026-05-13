/**
 * Vantage LP Portal Routes
 * LP authentication, statement generation, K-1 tax documents,
 * side letters, investor letter templates
 */

import { Router, Request, Response } from 'express';
import { lpPortalAuth, lpStatements, k1Generator, sideLetters } from '../services/lp-portal-service';
import { investorLetters } from '../services/document-enhancements';
import { generateStatementPDF } from '../services/lp-statement-pdf';
import { generateK1PDF } from '../services/k1-statement-pdf';
import type { LPStatement, LPStatementData, K1Data } from '../services/lp-portal-service';

/**
 * Bridge the storage-shape (LPStatementData, stringly-typed for JSONB stability)
 * into the PDF builder's StatementData shape (nested objects, numeric).
 * pdf-lib needs numbers; stored data is currency strings via Decimal.toFixed(2).
 */
function statementForPDF(statement: LPStatement, fundDisplayName?: string) {
  const d = (s: string | number | null | undefined): number => {
    if (s == null) return 0;
    const n = typeof s === 'string' ? parseFloat(s) : s;
    return Number.isFinite(n) ? n : 0;
  };
  const data = statement.data as LPStatementData;
  return {
    fund: {
      name: fundDisplayName ?? data.fundName,
      vintage: null,
      status: 'active',
      targetSize: 0,
      committedCapital: 0,
    },
    investor: {
      name: data.investorName,
      type: '',
      commitmentAmount: d(data.commitment),
      commitmentPct: 0,
      calledCapital: d(data.calledCapital),
      unfundedCommitment: d(data.unfundedCommitment),
    },
    capitalAccount: (() => {
      // Read directly from the stored rollforward when present; otherwise
      // derive from flat fields.
      const rf = data.capitalAccountRollforward ?? [];
      const findAmount = (label: string): number => {
        const hit = rf.find((r) => r.description?.toLowerCase().includes(label.toLowerCase()));
        return hit ? d(hit.amount) : 0;
      };
      return {
        openingBalance: findAmount('beginning'),
        contributions: findAmount('contributions') || d(data.calledCapital),
        distributions: -Math.abs(findAmount('distributions')) || -d(data.distributions),
        preferredReturnAccrued: findAmount('preferred') || d(data.preferredReturn),
        unrealizedGainLoss: findAmount('unrealized'),
        endingBalance: findAmount('ending') || d(data.capitalAccountBalance),
      };
    })(),
    distributions: (data.periodActivity ?? [])
      .filter((a) => a.type === 'distribution' || a.type === 'return_of_capital')
      .map((a) => ({
        date: a.date,
        type: a.type,
        returnOfCapital: 0,
        preferredReturn: 0,
        carriedInterest: 0,
        profitShare: 0,
        total: d(a.amount),
      })),
    preferredReturn: {
      rate: 0,
      totalAccrued: d(data.preferredReturn),
      totalPaid: 0,
      unpaidBalance: d(data.preferredReturn),
    },
    performance: {
      grossIrr: null,
      netIrr: d(data.irr),
      tvpi: d(data.tvpi),
      dpi: d(data.dpi),
      rvpi: d(data.rvpi),
      nav: d(data.capitalAccountBalance),
    },
    dealExposure: [],
  };
}

export const lpPortalRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

type LpScope =
  | { kind: 'lp'; orgId: string; investorId: string }
  | { kind: 'gp'; orgId: string };

// LP bearer session (Authorization: Bearer) takes precedence and locks the
// caller to their own investor_id. Otherwise fall back to the global GP
// session populated by authenticateUser — GP admins keep full org visibility.
async function resolveScope(req: Request): Promise<LpScope | null> {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const user = await lpPortalAuth.validateSession(auth.slice(7));
    if (!user) return null;
    return { kind: 'lp', orgId: user.orgId, investorId: user.investorId };
  }
  const orgId = getOrgId(req);
  if (!orgId) return null;
  return { kind: 'gp', orgId };
}

function forbidIfLp(scope: LpScope, res: Response): boolean {
  if (scope.kind === 'lp') {
    res.status(403).json({ error: 'This endpoint is restricted to GP administrators.' });
    return true;
  }
  return false;
}

function denyInvestorMismatch(scope: LpScope, investorId: string | undefined, res: Response): boolean {
  if (scope.kind === 'lp' && investorId && investorId !== scope.investorId) {
    res.status(403).json({ error: 'Investor scope mismatch.' });
    return true;
  }
  return false;
}

// ─── LP Authentication ──────────────────────────────────────────────────────

lpPortalRouter.post('/auth/create-user', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (forbidIfLp(scope, res)) return;
    const name = req.body.name
      || [req.body.firstName, req.body.lastName].filter(Boolean).join(' ').trim()
      || req.body.email;
    const user = await lpPortalAuth.createPortalUser(scope.orgId, {
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
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (forbidIfLp(scope, res)) return;
    const { fundId, investorId, periodEnd } = req.body;
    if (!fundId || !investorId || !periodEnd) {
      return res.status(400).json({ error: 'fundId, investorId, and periodEnd are required' });
    }
    const statement = await lpStatements.generateQuarterlyStatement(scope.orgId, fundId, investorId, periodEnd);
    res.json(statement);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/statements', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    const queryInvestorId = req.query.investorId as string | undefined;
    if (denyInvestorMismatch(scope, queryInvestorId, res)) return;
    const statements = await lpStatements.listStatements(scope.orgId, {
      fundId: req.query.fundId as string,
      investorId: scope.kind === 'lp' ? scope.investorId : queryInvestorId,
      statementType: req.query.statementType as string,
      limit: parseInt(req.query.limit as string) || 50,
    });
    res.json(statements);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.get('/statements/:id', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    const statement = await lpStatements.getStatement(scope.orgId, req.params.id);
    if (!statement) return res.status(404).json({ error: 'Statement not found' });
    if (scope.kind === 'lp' && (statement as any).investorId !== scope.investorId) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    res.json(statement);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.get('/statements/:id/html', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (scope.kind === 'lp') {
      const statement = await lpStatements.getStatement(scope.orgId, req.params.id);
      if (!statement || (statement as any).investorId !== scope.investorId) {
        return res.status(404).json({ error: 'Statement not found' });
      }
    }
    const html = await lpStatements.renderStatementHtml(scope.orgId, req.params.id);
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

lpPortalRouter.get('/statements/:id/pdf', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    const statement = await lpStatements.getStatement(scope.orgId, req.params.id);
    if (!statement) return res.status(404).json({ error: 'Statement not found' });
    if (scope.kind === 'lp' && (statement as any).investorId !== scope.investorId) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const pdfData = statementForPDF(statement);
    const pdfBytes = await generateStatementPDF(pdfData, statement.periodEnd);
    const filename = `LP_Statement_${statement.periodLabel || statement.id}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(pdfBytes.byteLength),
      'Cache-Control': 'private, no-store',
    });
    res.end(Buffer.from(pdfBytes));
  } catch (e: any) {
    console.error('[LP Portal] Statement PDF render error:', e);
    res.status(500).json({ error: 'Failed to render statement PDF' });
  }
});

// ─── K-1 Tax Documents ──────────────────────────────────────────────────────

lpPortalRouter.post('/k1/generate', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (forbidIfLp(scope, res)) return;
    const { fundId, investorId, taxYear } = req.body;
    if (!fundId || !investorId || !taxYear) {
      return res.status(400).json({ error: 'fundId, investorId, and taxYear are required' });
    }
    const k1 = await k1Generator.generateK1(scope.orgId, fundId, investorId, parseInt(String(taxYear), 10));
    res.json(k1);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/k1/:fundId/:investorId/:taxYear', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (denyInvestorMismatch(scope, req.params.investorId, res)) return;
    const k1 = await k1Generator.getK1(scope.orgId, req.params.fundId, req.params.investorId, parseInt(req.params.taxYear, 10));
    if (!k1) return res.status(404).json({ error: 'K-1 not found' });
    res.json(k1);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

lpPortalRouter.get('/k1/:fundId/:investorId/:taxYear/pdf', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (denyInvestorMismatch(scope, req.params.investorId, res)) return;
    const taxYear = parseInt(req.params.taxYear, 10);
    if (!Number.isFinite(taxYear)) {
      return res.status(400).json({ error: 'Invalid tax year' });
    }
    const k1 = await k1Generator.getK1(scope.orgId, req.params.fundId, req.params.investorId, taxYear);
    if (!k1) return res.status(404).json({ error: 'K-1 not found' });

    const pdfBytes = await generateK1PDF(k1 as K1Data);
    const safeInvestor = (k1 as K1Data).investorName?.replace(/[^A-Za-z0-9_-]+/g, '_') ?? 'Investor';
    const filename = `K1_${safeInvestor}_${taxYear}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(pdfBytes.byteLength),
      'Cache-Control': 'private, no-store',
    });
    res.end(Buffer.from(pdfBytes));
  } catch (e: any) {
    console.error('[LP Portal] K-1 PDF render error:', e);
    res.status(500).json({ error: 'Failed to render K-1 PDF' });
  }
});

// ─── Side Letters ───────────────────────────────────────────────────────────

lpPortalRouter.post('/side-letters', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (forbidIfLp(scope, res)) return;
    const { fundId, investorId, investorName, provisions, effectiveDate, expirationDate, documentUrl } = req.body;
    if (!fundId || !investorId || !investorName || !provisions || !effectiveDate) {
      return res.status(400).json({ error: 'fundId, investorId, investorName, provisions, and effectiveDate are required' });
    }
    const letter = await sideLetters.createSideLetter(scope.orgId, {
      fundId, investorId, investorName, provisions, effectiveDate, expirationDate, documentUrl,
    }, getUserId(req));
    res.json(letter);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.get('/side-letters/fund/:fundId', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    const queryInvestorId = req.query.investorId as string | undefined;
    if (denyInvestorMismatch(scope, queryInvestorId, res)) return;
    let letters = await sideLetters.getSideLettersForFund(scope.orgId, req.params.fundId);
    const effectiveInvestorId = scope.kind === 'lp' ? scope.investorId : queryInvestorId;
    if (effectiveInvestorId) {
      letters = letters.filter(l => l.investorId === effectiveInvestorId);
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
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (forbidIfLp(scope, res)) return; // MFN exposes other investors' terms
    const analysis = await sideLetters.getMFNAnalysis(scope.orgId, req.params.fundId);
    res.json(analysis);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Investor Letters ───────────────────────────────────────────────────────

lpPortalRouter.post('/investor-letters/seed-defaults', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (forbidIfLp(scope, res)) return;
    const result = await investorLetters.seedDefaultTemplates(scope.orgId, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

lpPortalRouter.post('/investor-letters/templates', async (req: Request, res: Response) => {
  try {
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (forbidIfLp(scope, res)) return;
    const template = await investorLetters.createTemplate(scope.orgId, {
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
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (forbidIfLp(scope, res)) return;
    const templates = await investorLetters.listTemplates(scope.orgId, {
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
    const scope = await resolveScope(req);
    if (!scope) return res.status(401).json({ error: 'Authentication required' });
    if (denyInvestorMismatch(scope, req.body.investorId, res)) return;
    const rendered = await investorLetters.renderTemplate(scope.orgId, {
      templateId: req.body.templateId,
      variables: req.body.variables,
      investorId: scope.kind === 'lp' ? scope.investorId : req.body.investorId,
      fundId: req.body.fundId,
      format: req.body.format || 'html',
    }, getUserId(req));
    res.json(rendered);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
