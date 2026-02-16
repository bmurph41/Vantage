import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../db';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { mmStandardAccounts, financialLineItemsNormalized, coaAuditLog } from '@shared/schema';
import { coaService } from '../services/coa-service';
import { coaMappingService } from '../services/coa-mapping-service';
import { normalizationEngine } from '../services/normalization-engine';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function featureGate(_req: Request, res: Response, next: Function) {
  if (process.env.FEATURE_COA_MAPPING !== 'true') {
    return res.status(404).json({ error: 'COA mapping feature is not enabled' });
  }
  next();
}

router.use(featureGate);

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return rows;
}

router.get('/api/coa', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const tree = req.query.tree === 'true';
    const accounts = await coaService.listAccounts(orgId, tree);
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { accountName, accountType, accountNumber, detailType, parentId, source } = req.body;
    if (!accountName || !accountType) {
      return res.status(400).json({ error: 'accountName and accountType are required' });
    }
    const account = await coaService.createAccount(orgId, {
      orgId,
      accountName,
      accountType,
      accountNumber: accountNumber || null,
      detailType: detailType || null,
      parentId: parentId || null,
      source: source || 'manual',
    });
    res.status(201).json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/api/coa/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const account = await coaService.updateAccount(orgId, req.params.id, req.body);
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/coa/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    await coaService.deleteAccount(orgId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa/import/csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const content = file.buffer.toString('utf-8');
    const rows = parseCsv(content);
    if (!rows.length) return res.status(400).json({ error: 'No data rows found in CSV' });
    const result = await coaService.importFromCsv(orgId, rows, userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa/template', (_req: Request, res: Response) => {
  const template = 'account_number,account_name,account_type,detail_type,parent\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="coa-template.csv"');
  res.send(template);
});

router.get('/api/coa/mapping', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const mappings = await coaMappingService.listMappings(orgId);
    res.json(mappings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa/mapping/progress', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const progress = await coaMappingService.getMappingProgress(orgId);
    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa/mapping', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { coaAccountId, mmStandardAccountId, confidenceScore, mappingSource, notes, locked } = req.body;
    if (!coaAccountId || !mmStandardAccountId) {
      return res.status(400).json({ error: 'coaAccountId and mmStandardAccountId are required' });
    }
    const mapping = await coaMappingService.upsertMapping(orgId, {
      coaAccountId,
      mmStandardAccountId,
      confidenceScore,
      mappingSource,
      notes,
      locked,
    });
    res.json(mapping);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa/mapping/bulk', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { mappings } = req.body;
    if (!Array.isArray(mappings) || !mappings.length) {
      return res.status(400).json({ error: 'mappings array is required' });
    }
    const result = await coaMappingService.bulkUpsertMappings(orgId, mappings);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/coa/mapping/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    await coaMappingService.deleteMapping(orgId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa/mapping/suggestions/generate', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await coaMappingService.generateSuggestions(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa/mapping/suggestions', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const status = req.query.status as string | undefined;
    const suggestions = await coaMappingService.listSuggestions(orgId, status);
    res.json(suggestions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa/mapping/suggestions/:id/accept', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const mapping = await coaMappingService.acceptSuggestion(orgId, req.params.id);
    res.json(mapping);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa/mapping/suggestions/:id/reject', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    await coaMappingService.rejectSuggestion(orgId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa/standard-accounts', async (_req: Request, res: Response) => {
  try {
    const accounts = await db
      .select()
      .from(mmStandardAccounts)
      .where(eq(mmStandardAccounts.isActive, true))
      .orderBy(asc(mmStandardAccounts.sortOrder));
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/financial-normalization/run', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { projectId, sourceDocId, autoApplySuggestions, confidenceThreshold } = req.body;
    const result = await normalizationEngine.run(orgId, {
      projectId,
      sourceDocId,
      autoApplySuggestions,
      confidenceThreshold,
      userId,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/financial-normalization/status', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });

    const [lastRun] = await db
      .select()
      .from(coaAuditLog)
      .where(and(
        eq(coaAuditLog.orgId, orgId),
        eq(coaAuditLog.action, 'generated_normalized_lines')
      ))
      .orderBy(desc(coaAuditLog.createdAt))
      .limit(1);

    const [normalizedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(financialLineItemsNormalized)
      .where(eq(financialLineItemsNormalized.orgId, orgId));

    const [unmappedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(financialLineItemsNormalized)
      .where(and(
        eq(financialLineItemsNormalized.orgId, orgId),
        eq(financialLineItemsNormalized.classificationSource, 'unmapped')
      ));

    res.json({
      lastRunAt: lastRun?.createdAt || null,
      totalNormalizedLines: normalizedCount?.count || 0,
      unmappedLines: unmappedCount?.count || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa/audit-log', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await coaService.getAuditLog(orgId, limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
